import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

// Polled by the settings page to track login progress
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data } = await supabaseAdmin
    .from('linkedin_sessions')
    .select('id, linkedin_email, status, login_error, last_used_at, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  return NextResponse.json({ sessions: data ?? [] })
}
