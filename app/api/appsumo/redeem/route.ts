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

  // Check the license exists and is active
  const { data: license } = await supabaseAdmin
    .from('appsumo_licenses')
    .select('tier, status, user_id')
    .eq('license_key', license_key.trim())
    .maybeSingle();

  if (!license) {
    return NextResponse.json({ error: 'Invalid license key' }, { status: 404 });
  }
  if (license.status === 'disabled') {
    return NextResponse.json({ error: 'This license key has been refunded and is no longer active' }, { status: 410 });
  }
  if (license.user_id && license.user_id !== user.id) {
    return NextResponse.json({ error: 'This license key is already in use by another account' }, { status: 409 });
  }

  const plan = TIER_TO_PLAN[license.tier] ?? 'appsumo_launch';

  // Claim the key and set the plan in one go
  const [licenseUpdate, profileUpdate] = await Promise.all([
    supabaseAdmin
      .from('appsumo_licenses')
      .update({ user_id: user.id, updated_at: new Date().toISOString() })
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
