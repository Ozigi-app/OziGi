import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

const TIER_TO_PLAN: Record<number, string> = {
  1: 'appsumo_launch',
  2: 'appsumo_builder',
  3: 'appsumo_dominate',
};

export async function POST(req: Request) {
  const { license_key } = await req.json();

  if (!license_key || typeof license_key !== 'string') {
    return NextResponse.json({ error: 'license_key is required' }, { status: 400 });
  }

  // Get the authenticated user from the session cookie
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
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // A failed redemption used to vanish silently — the buyer saw an error and we
  // had no record they'd ever tried. Log every rejection with the email so they
  // can be found and rescued.
  const logFailure = async (reason: string, status: number) => {
    console.error('[AppSumo Redeem] REJECTED', reason, '— key:', license_key.trim(), 'user:', user.email);
    try {
      await supabaseAdmin.from('appsumo_events').insert({
        event: 'redeem_failed',
        license_key: license_key.trim(),
        buyer_email: user.email?.trim().toLowerCase() ?? null,
        signature_valid: true,
        payload: { reason, status, user_id: user.id },
      });
    } catch (err) {
      console.error('[AppSumo Redeem] Failed to log rejection:', err);
    }
  };

  // Check the license exists and is active
  const { data: license } = await supabaseAdmin
    .from('appsumo_licenses')
    .select('tier, status, user_id')
    .eq('license_key', license_key.trim())
    .maybeSingle();

  if (!license) {
    await logFailure('unknown_license_key', 404);
    return NextResponse.json(
      { error: "We couldn't find that license key. We've logged this and will sort it out — email hello@ozigi.app and we'll get you set up." },
      { status: 404 }
    );
  }
  if (license.status === 'disabled') {
    // A key retired by a tier change also lands here. Follow the chain forward
    // so an upgraded buyer isn't told their live purchase was "refunded".
    const { data: successor } = await supabaseAdmin
      .from('appsumo_licenses')
      .select('license_key')
      .eq('prev_license_key', license_key.trim())
      .eq('status', 'active')
      .maybeSingle();

    if (successor) {
      await logFailure('superseded_key_used', 409);
      return NextResponse.json(
        {
          error: 'That key was replaced when your plan changed. Use your current key instead.',
          current_license_key: successor.license_key,
        },
        { status: 409 }
      );
    }

    await logFailure('license_disabled', 410);
    return NextResponse.json({ error: 'This license key is no longer active' }, { status: 410 });
  }
  if (license.user_id && license.user_id !== user.id) {
    await logFailure('already_claimed', 409);
    return NextResponse.json({ error: 'This license key is already in use by another account' }, { status: 409 });
  }

  const plan = TIER_TO_PLAN[license.tier] ?? 'appsumo_launch';

  // Claim the key and set the plan in one go
  const licenseClaim: Record<string, unknown> = {
    user_id: user.id,
    updated_at: new Date().toISOString(),
  };
  // Only write the email if we have one — never null out an address the
  // webhook or OAuth exchange already captured.
  if (user.email) licenseClaim.buyer_email = user.email.trim().toLowerCase();

  const [licenseUpdate, profileUpdate] = await Promise.all([
    supabaseAdmin
      .from('appsumo_licenses')
      .update(licenseClaim)
      .eq('license_key', license_key.trim()),
    supabaseAdmin
      .from('profiles')
      .update({
        plan,
        appsumo_license_key: license_key.trim(),
        appsumo_tier: license.tier,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id),
  ]);

  if (licenseUpdate.error || profileUpdate.error) {
    console.error('[AppSumo Redeem] DB error', licenseUpdate.error, profileUpdate.error);
    return NextResponse.json({ error: 'Failed to activate license' }, { status: 500 });
  }

  console.log('[AppSumo Redeem] User', user.id, 'activated', license_key, '→', plan);
  return NextResponse.json({ plan, tier: license.tier });
}
