import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { encrypt } from '@/lib/gtm/encrypt'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { li_at, linkedin_email, jsessionid, bcookie, li_a } = await req.json()
  if (!li_at || !linkedin_email) {
    return NextResponse.json({ error: 'li_at cookie value and LinkedIn email required' }, { status: 400 })
  }

  // Capture the user's actual browser User-Agent. LinkedIn binds bcookie to a
  // specific browser UA — if our worker uses a different UA, bcookie becomes a
  // fingerprint mismatch signal and the session is invalidated.
  const userAgent = req.headers.get('user-agent') ?? undefined

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
    // li_a is LinkedIn's application cookie containing the member identity token.
    // Without it, LinkedIn's SPA can't fully initialise the authenticated session
    // and shows the sign-in auth wall over profile pages even when li_at is valid.
    ...(li_a ? [{
      name: 'li_a',
      value: (li_a as string).trim(),
      domain: '.linkedin.com',
      path: '/',
      expires: -1,
      httpOnly: true,
      secure: true,
      sameSite: 'None' as const,
    }] : []),
  ]

  // Store cookies + userAgent together so the worker can replay the exact
  // browser fingerprint the user had when these cookies were issued.
  const sessionData = { cookies, userAgent }

  const { error } = await supabaseAdmin
    .from('linkedin_sessions')
    .upsert(
      {
        user_id: user.id,
        linkedin_email,
        session_cookies: encrypt(JSON.stringify(sessionData)),
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
