import { supabaseAdmin } from '@/lib/supabase/admin'

/**
 * Validate the Bearer token the Ozigi browser extension sends on every request
 * and resolve it to a user id. Returns null when the token is missing, malformed,
 * revoked, or unknown. Also stamps last_used_at so the settings page can show
 * whether the extension is actively connected.
 */
export async function userIdFromExtensionToken(req: Request): Promise<string | null> {
  const auth = req.headers.get('authorization') ?? ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : ''
  // Tokens are UUIDs — cheap shape check before hitting the DB.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token)) return null

  const { data } = await supabaseAdmin
    .from('linkedin_extension_tokens')
    .select('user_id, revoked')
    .eq('token', token)
    .maybeSingle()

  if (!data || data.revoked) return null

  // Best-effort touch; never blocks the request.
  supabaseAdmin
    .from('linkedin_extension_tokens')
    .update({ last_used_at: new Date().toISOString() })
    .eq('token', token)
    .then(() => {}, () => {})

  return data.user_id
}

// The extension's background service worker makes these calls with host
// permissions (no CORS preflight), but we return permissive CORS headers so a
// content-script fallback also works, and so preflight OPTIONS succeeds.
export const extensionCors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type',
}
