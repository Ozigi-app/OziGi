import crypto from 'crypto'
import { decrypt, encrypt } from './encrypt'
import { supabaseAdmin } from '@/lib/supabase/admin'

const GMAIL_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const GMAIL_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GMAIL_SEND_URL = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send'
const SCOPES = ['https://www.googleapis.com/auth/gmail.send'].join(' ')

export function getCallbackUrl(origin: string) {
  return `${origin}/api/gtm/gmail/callback`
}

// Builds the Google OAuth authorization URL and a signed CSRF state value.
// state = HMAC-SHA256(userId + ':' + nonce) so the callback can verify it.
export function buildAuthUrl(origin: string, userId: string): { url: string; state: string; nonce: string } {
  const nonce = crypto.randomUUID()
  const state = crypto
    .createHmac('sha256', process.env.CRON_SECRET!)
    .update(`${userId}:${nonce}`)
    .digest('hex')

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_GMAIL_CLIENT_ID!,
    redirect_uri: getCallbackUrl(origin),
    response_type: 'code',
    scope: SCOPES,
    access_type: 'offline',
    prompt: 'consent',   // force refresh_token on every connect
    state,
  })

  return { url: `${GMAIL_AUTH_URL}?${params}`, state, nonce }
}

export function verifyState(userId: string, nonce: string, state: string): boolean {
  const expected = crypto
    .createHmac('sha256', process.env.CRON_SECRET!)
    .update(`${userId}:${nonce}`)
    .digest('hex')
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(state))
}

interface TokenResponse {
  access_token: string
  refresh_token?: string
  expires_in: number
  token_type: string
}

export async function exchangeCode(code: string, origin: string): Promise<TokenResponse> {
  const res = await fetch(GMAIL_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_GMAIL_CLIENT_ID!,
      client_secret: process.env.GOOGLE_GMAIL_CLIENT_SECRET!,
      redirect_uri: getCallbackUrl(origin),
      grant_type: 'authorization_code',
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Token exchange failed: ${err}`)
  }
  return res.json()
}

export async function refreshAccessToken(accountId: string): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from('email_accounts')
    .select('oauth_refresh_token_enc, oauth_access_token_enc, oauth_token_expires_at')
    .eq('id', accountId)
    .single()

  if (error || !data) throw new Error('Account not found')

  // Return cached token if still valid (5-min buffer)
  if (data.oauth_access_token_enc && data.oauth_token_expires_at) {
    const expiresAt = new Date(data.oauth_token_expires_at).getTime()
    if (Date.now() < expiresAt - 5 * 60 * 1000) {
      return decrypt(data.oauth_access_token_enc)
    }
  }

  const refreshToken = decrypt(data.oauth_refresh_token_enc!)
  const res = await fetch(GMAIL_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_GMAIL_CLIENT_ID!,
      client_secret: process.env.GOOGLE_GMAIL_CLIENT_SECRET!,
      grant_type: 'refresh_token',
    }),
  })

  if (!res.ok) throw new Error(`Token refresh failed: ${await res.text()}`)

  const tokens: TokenResponse = await res.json()

  await supabaseAdmin
    .from('email_accounts')
    .update({
      oauth_access_token_enc: encrypt(tokens.access_token),
      oauth_token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
    })
    .eq('id', accountId)

  return tokens.access_token
}

// Builds a RFC 2822 message and sends via Gmail REST API
export async function sendViaGmail(
  accountId: string,
  to: string,
  subject: string,
  htmlBody: string,
  fromName: string,
  fromEmail: string
): Promise<void> {
  const accessToken = await refreshAccessToken(accountId)

  const message = [
    `From: "${fromName}" <${fromEmail}>`,
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=utf-8',
    '',
    htmlBody,
  ].join('\r\n')

  const encoded = Buffer.from(message)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

  const res = await fetch(GMAIL_SEND_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw: encoded }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Gmail send failed: ${err}`)
  }
}

// Fetch the authenticated user's email address from Google
export async function getGmailAddress(accessToken: string): Promise<string> {
  const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo?fields=email', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new Error('Failed to fetch Gmail user info')
  const { email } = await res.json()
  return email as string
}
