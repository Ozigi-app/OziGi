/**
 * CRM integration — HubSpot and Zoho adapters.
 *
 * Credentials are stored per-user in crm_connections (encrypted).
 * syncLeadToCRM fetches whichever provider is active for that user.
 * Silent no-op if the user has no CRM connected.
 */

import { supabaseAdmin } from '@/lib/supabase/admin'
import { decrypt } from '@/lib/gtm/encrypt'
import type { Lead } from '@/lib/types/gtm'

// ─── Zoho token cache (in-process, per refresh token) ────────────────────────
const zohoTokenCache = new Map<string, { token: string; expiry: number }>()

async function getZohoToken(clientId: string, clientSecret: string, refreshToken: string): Promise<string | null> {
  const cached = zohoTokenCache.get(refreshToken)
  if (cached && Date.now() < cached.expiry - 60_000) return cached.token

  const res = await fetch(
    `https://accounts.zoho.com/oauth/v2/token?` +
    `refresh_token=${refreshToken}&client_id=${clientId}&client_secret=${clientSecret}&grant_type=refresh_token`,
    { method: 'POST' }
  )
  if (!res.ok) return null

  const data = await res.json() as { access_token?: string; expires_in?: number }
  if (!data.access_token) return null

  zohoTokenCache.set(refreshToken, {
    token:  data.access_token,
    expiry: Date.now() + (data.expires_in ?? 3600) * 1000,
  })
  return data.access_token
}

// ─── HubSpot ──────────────────────────────────────────────────────────────────

async function hubspotUpsert(lead: Lead, apiKey: string): Promise<string | null> {
  const [first, ...rest] = (lead.name ?? '').trim().split(' ')
  const headers = { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }

  const properties = {
    email:          lead.email ?? '',
    firstname:      first ?? '',
    lastname:       rest.join(' '),
    company:        lead.company ?? '',
    twitterhandle:  lead.twitter_handle ?? '',
    description:    (lead.bio ?? '').slice(0, 1000),
    leadsource:     `Ozigi – ${lead.source}`,
    hs_lead_status: 'NEW',
  }

  const createRes = await fetch('https://api.hubapi.com/crm/v3/objects/contacts', {
    method: 'POST', headers, body: JSON.stringify({ properties }),
  })

  if (createRes.status === 201) return ((await createRes.json()) as { id: string }).id

  if (createRes.status === 409) {
    const searchRes = await fetch('https://api.hubapi.com/crm/v3/objects/contacts/search', {
      method: 'POST', headers,
      body: JSON.stringify({ filterGroups: [{ filters: [{ propertyName: 'email', operator: 'EQ', value: lead.email }] }] }),
    })
    if (searchRes.ok) {
      const d = await searchRes.json() as { results: Array<{ id: string }> }
      return d.results[0]?.id ?? null
    }
  }

  console.error('[crm:hubspot] upsert failed:', createRes.status)
  return null
}

// ─── Zoho ─────────────────────────────────────────────────────────────────────

async function zohoUpsert(lead: Lead, clientId: string, clientSecret: string, refreshToken: string): Promise<string | null> {
  const token = await getZohoToken(clientId, clientSecret, refreshToken)
  if (!token) return null

  const [first, ...rest] = (lead.name ?? '').trim().split(' ')
  const res = await fetch('https://www.zohoapis.com/crm/v2/Leads', {
    method:  'POST',
    headers: { Authorization: `Zoho-oauthtoken ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: [{
      First_Name:  first ?? '',
      Last_Name:   rest.join(' ') || '.',
      Email:       lead.email ?? '',
      Company:     lead.company ?? lead.github_username ?? 'Independent',
      Description: (lead.bio ?? '').slice(0, 500),
      Lead_Source: `Ozigi – ${lead.source}`,
      Lead_Status: 'Not Contacted',
    }] }),
  })

  const data = await res.json() as { data: Array<{ status: string; details: { id: string }; code?: string }> }
  const result = data.data?.[0]
  if (result?.status === 'success' || result?.code === 'DUPLICATE_DATA') return result.details?.id ?? null

  console.error('[crm:zoho] upsert failed:', JSON.stringify(data))
  return null
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Upsert a lead into the CRM connected by this user.
 * Silent no-op if no CRM is configured for this user.
 */
export async function syncLeadToCRM(lead: Lead, userId: string): Promise<string | null> {
  if (!lead.email) return null

  const { data: conn } = await supabaseAdmin
    .from('crm_connections')
    .select('provider, api_key_enc, zoho_client_id, zoho_client_secret_enc, zoho_refresh_token_enc')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('created_at', { ascending: true })
    .limit(1)
    .single()

  if (!conn) return null   // no CRM connected

  try {
    if (conn.provider === 'hubspot' && conn.api_key_enc) {
      return hubspotUpsert(lead, decrypt(conn.api_key_enc))
    }

    if (conn.provider === 'zoho' && conn.zoho_client_id && conn.zoho_client_secret_enc && conn.zoho_refresh_token_enc) {
      return zohoUpsert(
        lead,
        conn.zoho_client_id,
        decrypt(conn.zoho_client_secret_enc),
        decrypt(conn.zoho_refresh_token_enc)
      )
    }
  } catch (e) {
    console.error('[crm] sync error:', e)
  }

  return null
}
