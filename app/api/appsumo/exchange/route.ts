import { NextResponse } from 'next/server';

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
  const infoRes = await fetch('https://appsumo.com/openid/userinfo/', {
    headers: { Authorization: `Bearer ${access_token}` },
  });

  if (!infoRes.ok) {
    const body = await infoRes.text();
    console.error('[AppSumo Exchange] Userinfo error:', body);
    return NextResponse.json({ error: 'Failed to fetch license info' }, { status: 502 });
  }

  const info = await infoRes.json();
  // Returns: { email, appsumo_license_key, license_status, plan_id, ... }
  console.log('[AppSumo Exchange] License info:', JSON.stringify(info));

  return NextResponse.json({
    email: info.email,
    license_key: info.appsumo_license_key ?? info.license_key,
    tier: info.plan_id ?? null,
  });
}
