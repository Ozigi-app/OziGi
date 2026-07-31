import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

// GET  → the user's current extension token (creating one if none exists yet).
// POST → rotate: revoke any existing tokens and issue a fresh one.
// The token is pasted into the Ozigi browser extension once; the extension
// then authenticates to the pending/result endpoints with it.

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: existing } = await supabaseAdmin
    .from('linkedin_extension_tokens')
    .select('token')
    .eq('user_id', user.id)
    .eq('revoked', false)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existing?.token) return NextResponse.json({ token: existing.token })

  const { data: created, error } = await supabaseAdmin
    .from('linkedin_extension_tokens')
    .insert({ user_id: user.id })
    .select('token')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ token: created.token })
}

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await supabaseAdmin
    .from('linkedin_extension_tokens')
    .update({ revoked: true })
    .eq('user_id', user.id)
    .eq('revoked', false)

  const { data: created, error } = await supabaseAdmin
    .from('linkedin_extension_tokens')
    .insert({ user_id: user.id })
    .select('token')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ token: created.token })
}
