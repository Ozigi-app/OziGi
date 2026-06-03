import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { encrypt } from '@/lib/gtm/encrypt'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { li_at, linkedin_email } = await req.json()
  if (!li_at || !linkedin_email) {
    return NextResponse.json({ error: 'li_at cookie value and LinkedIn email required' }, { status: 400 })
  }

  // Build a minimal Playwright-compatible cookie array — browser.ts:loadSession()
  // calls context.addCookies() with this, and isLoggedIn() checks for li_at.
  const cookies = [
    {
      name: 'li_at',
      value: (li_at as string).trim(),
      domain: '.www.linkedin.com',
      path: '/',
      expires: -1,
      httpOnly: true,
      secure: true,
      sameSite: 'None' as const,
    },
  ]

  const { error } = await supabaseAdmin
    .from('linkedin_sessions')
    .upsert(
      {
        user_id: user.id,
        linkedin_email,
        session_cookies: encrypt(JSON.stringify(cookies)),
        status: 'active',
        login_error: null,
        verification_code: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,linkedin_email' }
    )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
