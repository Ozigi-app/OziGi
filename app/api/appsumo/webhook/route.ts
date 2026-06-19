import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const TIER_TO_PLAN: Record<number, string> = {
  1: 'appsumo_launch',
  2: 'appsumo_builder',
  3: 'appsumo_dominate',
};

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(req: Request) {
  const rawBody = await req.text();
  const event = JSON.parse(rawBody);
  const { action, license_key, license_tier, test: isTest } = event;

  // Skip signature check for AppSumo test/validation requests
  if (!isTest) {
    const signature = req.headers.get('x-appsumo-signature');
    const expectedSig = crypto
      .createHmac('sha256', process.env.APPSUMO_API_KEY!)
      .update(rawBody)
      .digest('hex');

    const signaturesMatch =
      signature !== null &&
      crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig));

    if (!signaturesMatch) {
      console.error('[AppSumo Webhook] Invalid signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }
  }

  console.log('[AppSumo Webhook]', action, license_key, 'tier:', license_tier, isTest ? '(test)' : '');

  const supabase = adminClient();

  if (action === 'activate' || action === 'upgrade' || action === 'downgrade') {
    const plan = TIER_TO_PLAN[license_tier] ?? 'appsumo_launch';

    // Upsert the license record — user_id is set when the buyer redeems
    await supabase.from('appsumo_licenses').upsert(
      { license_key, tier: license_tier, status: 'active', updated_at: new Date().toISOString() },
      { onConflict: 'license_key' }
    );

    // If this key is already claimed by a user, update their plan immediately
    const { data: license } = await supabase
      .from('appsumo_licenses')
      .select('user_id')
      .eq('license_key', license_key)
      .maybeSingle();

    if (license?.user_id) {
      await supabase
        .from('profiles')
        .update({ plan, appsumo_tier: license_tier, updated_at: new Date().toISOString() })
        .eq('id', license.user_id);
    }
  }

  if (action === 'disable') {
    await supabase
      .from('appsumo_licenses')
      .update({ status: 'disabled', updated_at: new Date().toISOString() })
      .eq('license_key', license_key);

    // Downgrade the user if they already redeemed this key
    const { data: license } = await supabase
      .from('appsumo_licenses')
      .select('user_id')
      .eq('license_key', license_key)
      .maybeSingle();

    if (license?.user_id) {
      await supabase
        .from('profiles')
        .update({
          plan: 'free',
          appsumo_license_key: null,
          appsumo_tier: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', license.user_id);
    }
  }

  return NextResponse.json({ success: true });
}
