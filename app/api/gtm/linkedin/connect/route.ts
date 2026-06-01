import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { encrypt } from '@/lib/gtm/encrypt'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { linkedin_email, linkedin_password } = await req.json()

  if (!linkedin_email || !linkedin_password) {
    return NextResponse.json({ error: 'Email and password required' }, { status: 400 })
  }

  // Save encrypted credentials
  const { error: credErr } = await supabaseAdmin
    .from('linkedin_credentials')
    .upsert(
      {
        user_id: user.id,
        linkedin_email,
        linkedin_password_enc: encrypt(linkedin_password),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,linkedin_email' }
    )

  if (credErr) return NextResponse.json({ error: credErr.message }, { status: 500 })

  // Trigger the worker to log in (fire and forget — login may take minutes if 2FA)
  const workerUrl = process.env.LINKEDIN_WORKER_URL
    ?? (process.env.NODE_ENV !== 'production' ? 'http://localhost:8080' : null)

  if (workerUrl) {
    fetch(`${workerUrl}/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.WORKER_SECRET}`,
      },
      body: JSON.stringify({ userId: user.id }),
    }).catch(e => console.error('[gtm/linkedin/connect] worker trigger failed:', e))
  } else {
    console.warn('[gtm/linkedin/connect] LINKEDIN_WORKER_URL not set — worker not triggered')
  }

  return NextResponse.json({ ok: true, message: 'Login started — check back in a moment.' })
}
