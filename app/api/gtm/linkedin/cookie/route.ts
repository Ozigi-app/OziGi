import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { encrypt } from '@/lib/gtm/encrypt'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { li_at, linkedin_email, jsessionid, bcookie } = await req.json()
  if (!li_at || !linkedin_email) {
    return NextResponse.json({ error: 'li_at cookie value and LinkedIn email required' }, { status: 400 })
  }

  // Build a Playwright-compatible cookie array. More cookies = more stable session.
  // li_at alone causes LinkedIn to detect fingerprint mismatch after a few requests.
  const cookies = [
    {
      name: 'li_at',
      value: (li_at as string).trim(),
      domain: '.linkedin.com',
      path: '/',
      expires: -1,
      httpOnly: true,
      secure: true,
      sameSite: 'None' as const,
    },
    ...(jsessionid ? [{
      name: 'JSESSIONID',
      value: (jsessionid as string).trim(),
      domain: '.www.linkedin.com',
      path: '/',
      expires: -1,
      httpOnly: true,
      secure: true,
      sameSite: 'None' as const,
    }] : []),
    ...(bcookie ? [{
      name: 'bcookie',
      value: (bcookie as string).trim(),
      domain: '.linkedin.com',
      path: '/',
      expires: -1,
      httpOnly: false,
      secure: true,
      sameSite: 'None' as const,
    }] : []),
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
        last_used_at: null,   // reset so warmup fires for the new session
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,linkedin_email' }
    )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
