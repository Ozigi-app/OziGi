import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { encrypt, decrypt } from '@/lib/gtm/encrypt'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabaseAdmin
    .from('crm_connections')
    .select('id, provider, zoho_client_id, is_active, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ connections: data ?? [] })
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as {
    provider: 'hubspot' | 'zoho'
    api_key?: string           // HubSpot
    zoho_client_id?: string    // Zoho
    zoho_client_secret?: string
    zoho_refresh_token?: string
  }

  const { provider } = body
  if (!provider) return NextResponse.json({ error: 'provider is required' }, { status: 400 })

  let row: Record<string, unknown> = { user_id: user.id, provider, is_active: true }

  if (provider === 'hubspot') {
    if (!body.api_key) return NextResponse.json({ error: 'api_key is required for HubSpot' }, { status: 400 })
    row.api_key_enc = encrypt(body.api_key)
  } else if (provider === 'zoho') {
    if (!body.zoho_client_id || !body.zoho_client_secret || !body.zoho_refresh_token) {
      return NextResponse.json({ error: 'zoho_client_id, zoho_client_secret, and zoho_refresh_token are required' }, { status: 400 })
    }
    row.zoho_client_id         = body.zoho_client_id
    row.zoho_client_secret_enc = encrypt(body.zoho_client_secret)
    row.zoho_refresh_token_enc = encrypt(body.zoho_refresh_token)
  } else {
    return NextResponse.json({ error: 'provider must be hubspot or zoho' }, { status: 400 })
  }

  // Verify credentials before saving
  const testError = await testConnection(provider, body)
  if (testError) return NextResponse.json({ error: `Connection test failed: ${testError}` }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('crm_connections')
    .upsert(row, { onConflict: 'user_id,provider' })
    .select('id, provider, is_active, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ connection: data }, { status: 201 })
}

// ─── Test connection before saving ────────────────────────────────────────────

async function testConnection(
  provider: string,
  body: Record<string, string | undefined>
): Promise<string | null> {
  try {
    if (provider === 'hubspot') {
      const res = await fetch('https://api.hubapi.com/crm/v3/objects/contacts?limit=1', {
        headers: { Authorization: `Bearer ${body.api_key}` },
      })
      if (!res.ok) return `HubSpot returned ${res.status} — check your API key`
    }

    if (provider === 'zoho') {
      const tokenRes = await fetch(
        `https://accounts.zoho.com/oauth/v2/token?` +
        `refresh_token=${body.zoho_refresh_token}&client_id=${body.zoho_client_id}` +
        `&client_secret=${body.zoho_client_secret}&grant_type=refresh_token`,
        { method: 'POST' }
      )
      const data = await tokenRes.json() as { access_token?: string; error?: string }
      if (!data.access_token) return `Zoho auth failed: ${data.error ?? 'invalid credentials'}`
    }

    return null
  } catch (e) {
    return e instanceof Error ? e.message : 'Network error'
  }
}

