import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildAuthUrl } from '@/lib/gtm/gmail'
import { getPlanStatus } from '@/lib/plan'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Multi-inbox gate — first account always allowed; second requires Pro
  const planStatus = await getPlanStatus(user.id)
  if (!planStatus.hasMultiInbox) {
    const { count } = await supabaseAdmin
      .from('email_accounts')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_active', true)
    if ((count ?? 0) >= 1) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
      return NextResponse.redirect(`${appUrl}/pricing?gate=multi_inbox`)
    }
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
