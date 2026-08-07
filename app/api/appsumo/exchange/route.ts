import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Exchanges an AppSumo authorization code for license details.
// Called client-side from the activate page to avoid exposing client_secret.
export async function POST(req: Request) {
  const { code } = await req.json();
  if (!code) return NextResponse.json({ error: 'Missing code' }, { status: 400 });

  // 1. Exchange code for access token
  const tokenRes = await fetch('https://appsumo.com/openid/token/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: process.env.APPSUMO_CLIENT_ID!,
      client_secret: process.env.APPSUMO_CLIENT_SECRET!,
      redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/appsumo/activate`,
    }),
  });

  if (!tokenRes.ok) {
    const body = await tokenRes.text();
    console.error('[AppSumo Exchange] Token error:', body);
    return NextResponse.json({ error: 'Failed to exchange code' }, { status: 502 });
  }

  const { access_token } = await tokenRes.json();

  // 2. Fetch license info with access token
  const infoRes = await fetch(`https://appsumo.com/openid/license_key/?access_token=${access_token}`);

  if (!infoRes.ok) {
    const body = await infoRes.text();
    console.error('[AppSumo Exchange] License key error:', body);
    return NextResponse.json({ error: 'Failed to fetch license info' }, { status: 502 });
  }

  const info = await infoRes.json();
  // Returns: { license_key, license_status, tier, ... }
  console.log('[AppSumo Exchange] License info:', JSON.stringify(info));

  // Also fetch email via userinfo
  let email: string | undefined;
  try {
    const userRes = await fetch('https://appsumo.com/openid/userinfo/', {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    if (userRes.ok) {
      const user = await userRes.json();
      email = user.email;
    }
  } catch {}

  // Persist the buyer's email against the license as soon as we learn it. This
  // is the earliest point we know who they are — a buyer who lands here and then
  // abandons signup would otherwise leave no contact trail at all.
  if (info.license_key && email) {
    try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );
      const { data: existing } = await supabase
        .from('appsumo_licenses')
        .select('license_key')
        .eq('license_key', info.license_key)
        .maybeSingle();

      if (existing) {
        // Only touch the email — never overwrite tier/status from this path.
        await supabase
          .from('appsumo_licenses')
          .update({ buyer_email: email.trim().toLowerCase(), updated_at: new Date().toISOString() })
          .eq('license_key', info.license_key);
      } else if (typeof info.tier === 'number') {
        // Webhook hasn't landed yet (or was missed) — tier is NOT NULL, so we can
        // only create the row when AppSumo actually told us the tier.
        await supabase.from('appsumo_licenses').insert({
          license_key: info.license_key,
          tier: info.tier,
          status: 'active',
          buyer_email: email.trim().toLowerCase(),
        });
      }
    } catch (err) {
      // Never block activation on bookkeeping.
      console.error('[AppSumo Exchange] Failed to persist buyer email:', err);
    }
  }

  return NextResponse.json({
    email,
    license_key: info.license_key,
    tier: info.tier ?? null,
  });
}
