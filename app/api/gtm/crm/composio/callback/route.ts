import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

/**
 * GET /api/gtm/crm/composio/callback
 *
 * Composio v3 redirects here after OAuth completes with:
 *   ?status=success&connected_account_id=<id>&provider=<p>&userId=<u>
 *
 * We persist the connectedAccountId so future CRM calls go through Composio.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)

  const status             = searchParams.get('status')               // 'success' | 'failed'
  const connectedAccountId = searchParams.get('connected_account_id')
  const provider           = searchParams.get('provider')
  const userId             = searchParams.get('userId')

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  if (status === 'failed' || !connectedAccountId || !provider || !userId) {
    console.error('[Composio callback] bad params:', Object.fromEntries(searchParams))
    return NextResponse.redirect(`${appUrl}/dashboard/gtm/settings?error=composio_failed`)
  }

  const { error } = await supabaseAdmin
    .from('crm_connections')
    .upsert(
      {
        user_id:             userId,
        provider,
        composio_account_id: connectedAccountId,
        is_active:           true,
      },
      { onConflict: 'user_id,provider' }
    )

  if (error) {
    console.error('[Composio callback] DB upsert failed:', error)
    return NextResponse.redirect(`${appUrl}/dashboard/gtm/settings?error=composio_save_failed`)
  }

  return NextResponse.redirect(`${appUrl}/dashboard/gtm/settings?connected=${provider}`)
}
