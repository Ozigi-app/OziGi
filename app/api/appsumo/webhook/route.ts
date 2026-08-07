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

// AppSumo has used several names for the buyer's address across integrations,
// and nests it under `extra` in some payloads. Take the first thing that looks
// like an email rather than betting on one field name.
function extractEmail(payload: Record<string, unknown> | null): string | null {
  if (!payload) return null;
  const candidates = [
    payload.activation_email,
    payload.email,
    payload.buyer_email,
    payload.customer_email,
    payload.user_email,
    (payload.extra as Record<string, unknown> | undefined)?.email,
    (payload.extra as Record<string, unknown> | undefined)?.activation_email,
    (payload.buyer as Record<string, unknown> | undefined)?.email,
  ];
  for (const c of candidates) {
    if (typeof c === 'string' && c.includes('@')) return c.trim().toLowerCase();
  }
  return null;
}

export async function POST(req: Request) {
  const rawBody = await req.text();

  let event: Record<string, unknown> | null = null;
  try {
    event = JSON.parse(rawBody);
  } catch {
    event = null;
  }

  const action = event?.event as string | undefined;
  const license_key = event?.license_key as string | undefined;
  const prev_license_key = (event?.prev_license_key ?? null) as string | null;
  const license_tier = event?.tier as number | undefined;
  const isTest = Boolean(event?.test);
  const buyerEmail = extractEmail(event);

  const supabase = adminClient();

  // Log the event before doing anything else, so nothing is ever lost — not a
  // rejected signature, not an unparseable body, not an event type we don't
  // handle yet. Never let a logging failure break the webhook.
  const logEvent = async (signatureValid: boolean) => {
    try {
      await supabase.from('appsumo_events').insert({
        event: action ?? null,
        license_key: license_key ?? null,
        prev_license_key,
        tier: typeof license_tier === 'number' ? license_tier : null,
        buyer_email: buyerEmail,
        is_test: isTest,
        signature_valid: signatureValid,
        payload: event,
        raw_body: event ? null : rawBody.slice(0, 10_000),
      });
    } catch (err) {
      console.error('[AppSumo Webhook] Failed to log event:', err);
    }
  };

  // Skip signature check for AppSumo test/validation requests
  if (!isTest) {
    const signature = req.headers.get('x-appsumo-signature') ?? '';
    const timestamp = req.headers.get('x-appsumo-timestamp') ?? '';
    const expectedSig = crypto
      .createHmac('sha256', process.env.APPSUMO_API_KEY!)
      .update(timestamp + rawBody)
      .digest('hex');

    let signaturesMatch = false;
    try {
      const sigBuf = Buffer.from(signature);
      const expBuf = Buffer.from(expectedSig);
      signaturesMatch = sigBuf.length === expBuf.length &&
        crypto.timingSafeEqual(sigBuf, expBuf);
    } catch {
      signaturesMatch = false;
    }

    if (!signaturesMatch) {
      await logEvent(false);
      console.error('[AppSumo Webhook] Invalid signature — received:', signature, 'expected:', expectedSig);
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }
  }

  await logEvent(true);

  console.log(
    '[AppSumo Webhook]', action, license_key,
    'tier:', license_tier,
    prev_license_key ? `prev: ${prev_license_key}` : '',
    buyerEmail ? `email: ${buyerEmail}` : '(no email in payload)',
    isTest ? '(test)' : ''
  );

  if (!license_key) {
    return NextResponse.json({ event: action ?? null, success: true, note: 'no license_key' });
  }

  if (action === 'activate' || action === 'upgrade' || action === 'downgrade') {
    const plan = TIER_TO_PLAN[license_tier!] ?? 'appsumo_launch';

    // On a tier change AppSumo issues a NEW key and deactivates the old one.
    // Carry the buyer across so an upgrade doesn't orphan a redeemed account.
    let carriedUserId: string | null = null;
    let carriedEmail: string | null = null;
    if (prev_license_key) {
      const { data: prev } = await supabase
        .from('appsumo_licenses')
        .select('user_id, buyer_email')
        .eq('license_key', prev_license_key)
        .maybeSingle();
      carriedUserId = prev?.user_id ?? null;
      carriedEmail = prev?.buyer_email ?? null;
    }

    // Don't clobber an existing user_id/email with nulls on a repeat event.
    const upsertRow: Record<string, unknown> = {
      license_key,
      tier: license_tier,
      status: 'active',
      prev_license_key,
      refunded_at: null,
      updated_at: new Date().toISOString(),
    };
    if (carriedUserId) upsertRow.user_id = carriedUserId;
    if (buyerEmail ?? carriedEmail) upsertRow.buyer_email = buyerEmail ?? carriedEmail;

    await supabase
      .from('appsumo_licenses')
      .upsert(upsertRow, { onConflict: 'license_key' });

    // Release the old key. AppSumo sends `deactivate` for it moments later; if it
    // still pointed at this user, that event would demote them to free seconds
    // after they upgraded.
    if (carriedUserId && prev_license_key) {
      await supabase
        .from('appsumo_licenses')
        .update({ user_id: null, updated_at: new Date().toISOString() })
        .eq('license_key', prev_license_key);
    }

    // If this key is already claimed by a user, update their plan immediately
    const { data: license } = await supabase
      .from('appsumo_licenses')
      .select('user_id')
      .eq('license_key', license_key)
      .maybeSingle();

    if (license?.user_id) {
      await supabase
        .from('profiles')
        .update({
          plan,
          appsumo_tier: license_tier,
          appsumo_license_key: license_key,
          updated_at: new Date().toISOString(),
        })
        .eq('id', license.user_id);
    }
  }

  if (action === 'deactivate') {
    const disableRow: Record<string, unknown> = {
      status: 'disabled',
      refunded_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    if (buyerEmail) disableRow.buyer_email = buyerEmail;

    await supabase
      .from('appsumo_licenses')
      .update(disableRow)
      .eq('license_key', license_key);

    // Downgrade the user if they already redeemed this key
    const { data: license } = await supabase
      .from('appsumo_licenses')
      .select('user_id')
      .eq('license_key', license_key)
      .maybeSingle();

    if (license?.user_id) {
      // Only demote if this is still the user's live key. If a tier change moved
      // them onto a newer one, this deactivate is just AppSumo retiring the old
      // key — demoting here would strip a paying customer's plan.
      const { data: profile } = await supabase
        .from('profiles')
        .select('appsumo_license_key')
        .eq('id', license.user_id)
        .maybeSingle();

      if (!profile?.appsumo_license_key || profile.appsumo_license_key === license_key) {
        await supabase
          .from('profiles')
          .update({
            plan: 'free',
            appsumo_license_key: null,
            appsumo_tier: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', license.user_id);
      } else {
        console.log(
          '[AppSumo Webhook] Skipping downgrade —', license.user_id,
          'has since moved to', profile.appsumo_license_key
        );
      }
    }
  }

  return NextResponse.json({ event: action ?? null, success: true });
}
