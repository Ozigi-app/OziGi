import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

const TIER_TO_PLAN: Record<number, string> = {
  1: 'appsumo_launch',
  2: 'appsumo_builder',
  3: 'appsumo_dominate',
};

// Attaches an AppSumo license to the signed-in user when we already know the
// purchase is theirs but nothing ever claimed it.
//
// The activate page only auto-redeems from a key cached in localStorage. A buyer
// who confirms their email on a different device, or who returns via the normal
// login page, never hits that path — their license sits active and unclaimed
// while they sit on the free plan. (That is exactly what happened on 2026-08-07.)
// This runs on sign-in from anywhere and closes that hole.
export async function POST() {
  const cookieStore = await cookies();
  const supabaseUser = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cs) => cs.forEach(({ name, value, options }) => cookieStore.set(name, value, options)),
      },
    }
  );

  const { data: { user } } = await supabaseUser.auth.getUser();
  if (!user) {
    return NextResponse.json({ claimed: false, reason: 'not_authenticated' }, { status: 401 });
  }

  // Email is the only thing tying a buyer to a license here, so it has to be a
  // verified one. An unconfirmed address would let anyone claim a stranger's
  // purchase just by typing their email at signup.
  if (!user.email || !user.email_confirmed_at) {
    return NextResponse.json({ claimed: false, reason: 'email_unconfirmed' });
  }

  const email = user.email.trim().toLowerCase();

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Already on an AppSumo plan — nothing to do. This is the common case, so keep
  // it to one cheap read.
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('plan, appsumo_license_key')
    .eq('id', user.id)
    .maybeSingle();

  if (profile?.appsumo_license_key || profile?.plan?.startsWith('appsumo_')) {
    return NextResponse.json({ claimed: false, reason: 'already_on_appsumo_plan' });
  }

  // An active, unclaimed license bought with this address. Best tier first, so a
  // buyer who somehow has two gets the one they'd want.
  const { data: candidates } = await supabaseAdmin
    .from('appsumo_licenses')
    .select('license_key, tier')
    .eq('buyer_email', email)
    .eq('status', 'active')
    .is('user_id', null)
    .order('tier', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(1);

  const license = candidates?.[0];
  if (!license) {
    return NextResponse.json({ claimed: false, reason: 'no_matching_license' });
  }

  const plan = TIER_TO_PLAN[license.tier] ?? 'appsumo_launch';

  // Claim the key first. If the profile update then fails we'd rather have an
  // orphaned claim we can see than hand out a plan with no license behind it.
  const { error: claimErr } = await supabaseAdmin
    .from('appsumo_licenses')
    .update({ user_id: user.id, updated_at: new Date().toISOString() })
    .eq('license_key', license.license_key)
    .is('user_id', null);          // lose the race rather than steal a claim

  if (claimErr) {
    console.error('[AppSumo AutoClaim] Failed to claim', license.license_key, claimErr);
    return NextResponse.json({ claimed: false, reason: 'claim_failed' }, { status: 500 });
  }

  const { error: profileErr } = await supabaseAdmin
    .from('profiles')
    .update({
      plan,
      appsumo_tier: license.tier,
      appsumo_license_key: license.license_key,
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id);

  if (profileErr) {
    console.error('[AppSumo AutoClaim] Claimed key but failed to set plan', license.license_key, profileErr);
    return NextResponse.json({ claimed: false, reason: 'profile_update_failed' }, { status: 500 });
  }

  try {
    await supabaseAdmin.from('appsumo_events').insert({
      event: 'auto_claimed',
      license_key: license.license_key,
      tier: license.tier,
      buyer_email: email,
      signature_valid: true,
      payload: { user_id: user.id, plan, matched_on: 'buyer_email' },
    });
  } catch (err) {
    console.error('[AppSumo AutoClaim] Failed to log claim:', err);
  }

  console.log('[AppSumo AutoClaim] Attached', license.license_key, 'to', email, '→', plan);
  return NextResponse.json({ claimed: true, plan, tier: license.tier });
}
