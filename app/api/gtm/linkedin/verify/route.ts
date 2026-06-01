import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

// User submits their 2FA code — worker is polling for this
export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { code } = await req.json()
  if (!code) return NextResponse.json({ error: 'Code required' }, { status: 400 })

  // Find the session waiting for 2FA
  const { data: session } = await supabaseAdmin
    .from('linkedin_sessions')
    .select('id, status')
    .eq('user_id', user.id)
    .eq('status', 'pending_2fa')
    .single()

  if (!session) {
    return NextResponse.json({ error: 'No pending 2FA session found' }, { status: 404 })
  }

  // Write the code — worker will pick it up within 5 seconds
  await supabaseAdmin
    .from('linkedin_sessions')
    .update({ verification_code: code.trim() })
    .eq('id', session.id)

  return NextResponse.json({ ok: true, message: 'Code submitted — completing login…' })
}
