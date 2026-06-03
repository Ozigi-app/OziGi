import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { sessionId } = await req.json()
  if (!sessionId) return NextResponse.json({ error: 'sessionId required' }, { status: 400 })

  // Reset status so the connect form reappears. Clears cookies so the worker
  // won't pick up the old expired session.
  const { error } = await supabaseAdmin
    .from('linkedin_sessions')
    .update({
      status: 'needs_login',
      session_cookies: null,
      login_error: null,
      verification_code: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', sessionId)
    .eq('user_id', user.id)   // ensure users can only reset their own sessions

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
