// Custom LinkedIn OAuth 2.0 flow (member authorization) — used instead of the
// Supabase OIDC link so we receive a REFRESH TOKEN and can auto-renew the
// ~60-day access token indefinitely.
//
// Requires, on the LinkedIn app:
//   - "Sign In with LinkedIn using OpenID Connect" product (for /v2/userinfo)
//   - "Share on LinkedIn" product (grants w_member_social — posting)
//   - Programmatic refresh tokens enabled (grants refresh_token)
//   - Authorized redirect URL === the value getRedirectUri() returns

const AUTH_URL = "https://www.linkedin.com/oauth/v2/authorization";
const TOKEN_URL = "https://www.linkedin.com/oauth/v2/accessToken";

// openid+profile → /v2/userinfo (author URN); w_member_social → posting.
const SCOPES = "openid profile email w_member_social";

export function getRedirectUri(): string {
  // Dedicated callback for this flow. Must be registered on the LinkedIn app.
  // LINKEDIN_REDIRECT_URI is already taken by the Supabase OIDC callback, so use
  // an override or derive from APP_URL.
  const explicit = process.env.LINKEDIN_OAUTH_REDIRECT_URI;
  if (explicit) return explicit;
  const appUrl = process.env.APP_URL || "http://localhost:3000";
  return `${appUrl}/api/linkedin/oauth/callback`;
}

export function buildAuthUrl(state: string): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.LINKEDIN_CLIENT_ID!,
    redirect_uri: getRedirectUri(),
    scope: SCOPES,
    state,
  });
  return `${AUTH_URL}?${params.toString()}`;
}

export interface LinkedInTokens {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  refresh_token_expires_in?: number;
  scope?: string;
}

export async function exchangeCodeForTokens(code: string): Promise<LinkedInTokens> {
  const params = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: getRedirectUri(),
    client_id: process.env.LINKEDIN_CLIENT_ID!,
    client_secret: process.env.LINKEDIN_CLIENT_SECRET!,
  });

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Token exchange failed: ${res.status} ${body}`);
  }
  return (await res.json()) as LinkedInTokens;
}
