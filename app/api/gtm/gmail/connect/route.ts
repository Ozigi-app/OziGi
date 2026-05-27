import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildAuthUrl } from '@/lib/gtm/gmail'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const origin = new URL(request.url).origin
  const { url, nonce } = buildAuthUrl(origin, user.id)

  // Store userId + nonce in a short-lived httpOnly cookie so the callback
  // can verify the CSRF state without a round-trip to the DB.
  const response = NextResponse.redirect(url)
  response.cookies.set('gtm_gmail_oauth', `${user.id}:${nonce}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600, // 10 minutes
    path: '/',
  })

  return response
}
