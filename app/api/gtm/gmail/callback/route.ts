import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { exchangeCode, getGmailAddress, verifyState } from '@/lib/gtm/gmail'
import { encrypt } from '@/lib/gtm/encrypt'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  if (error) {
    return NextResponse.redirect(`${origin}/dashboard/gtm/settings?error=gmail_denied`)
  }

  if (!code || !state) {
    return NextResponse.redirect(`${origin}/dashboard/gtm/settings?error=gmail_invalid`)
  }

  const cookieStore = await cookies()
  const oauthCookie = cookieStore.get('gtm_gmail_oauth')?.value

  if (!oauthCookie) {
    return NextResponse.redirect(`${origin}/dashboard/gtm/settings?error=gmail_expired`)
  }

  const [userId, nonce] = oauthCookie.split(':')
  if (!userId || !nonce || !verifyState(userId, nonce, state)) {
    return NextResponse.redirect(`${origin}/dashboard/gtm/settings?error=gmail_csrf`)
  }

  try {
    const tokens = await exchangeCode(code, origin)

    if (!tokens.refresh_token) {
      // This happens if the user has already granted access before and didn't revoke.
      // The prompt:'consent' in buildAuthUrl forces a new refresh token, so this
      // should only happen if something went wrong.
      return NextResponse.redirect(`${origin}/dashboard/gtm/settings?error=gmail_no_refresh_token`)
    }

    const emailAddress = await getGmailAddress(tokens.access_token)
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString()

    const { error: dbError } = await supabaseAdmin
      .from('email_accounts')
      .upsert(
        {
          user_id: userId,
          provider: 'gmail',
          email_address: emailAddress,
          oauth_refresh_token_enc: encrypt(tokens.refresh_token),
          oauth_access_token_enc: encrypt(tokens.access_token),
          oauth_token_expires_at: expiresAt,
          is_active: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,email_address' }
      )

    if (dbError) throw dbError

    const response = NextResponse.redirect(`${origin}/dashboard/gtm/settings?connected=gmail`)
    response.cookies.delete('gtm_gmail_oauth')
    return response
  } catch (err) {
    console.error('[gtm/gmail/callback]', err)
    return NextResponse.redirect(`${origin}/dashboard/gtm/settings?error=gmail_failed`)
  }
}
