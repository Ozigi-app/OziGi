import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { Composio } from '@composio/core'
import { getPlanStatus } from '@/lib/plan'

// Composio toolkit slugs for supported CRMs
const TOOLKIT: Record<string, string> = {
  hubspot: 'hubspot',
  zoho:    'zoho',
}

/**
 * POST /api/gtm/crm/composio
 * Body: { provider: 'hubspot' | 'zoho' }
 *
 * Uses the Composio SDK to initiate an OAuth flow.
 * The SDK auto-discovers (or creates) the managed auth config for the toolkit.
 * Returns { redirectUrl } — frontend redirects the user there.
 */
export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Plan gate — CRM sync requires Growth or Pro
  const planStatus = await getPlanStatus(user.id)
  if (!planStatus.hasCrmSync) {
    return NextResponse.json(
      { error: 'CRM sync is available on Growth and Pro plans.' },
      { status: 403 }
    )
  }

  const { provider } = await req.json()
  const toolkit = TOOLKIT[provider]
  if (!toolkit) {
    return NextResponse.json({ error: `Unknown provider: ${provider}` }, { status: 400 })
  }

  const apiKey = process.env.COMPOSIO_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'COMPOSIO_API_KEY not set' }, { status: 500 })
  }

  const appUrl      = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const callbackUrl = `${appUrl}/api/gtm/crm/composio/callback?provider=${provider}&userId=${user.id}`

  try {
    const composio = new Composio({ apiKey })

    // authorize() auto-discovers or creates the Composio-managed auth config,
    // then returns a ConnectionRequest with a redirect URL for the OAuth flow.
    const connectionRequest = await composio.toolkits.authorize(user.id, toolkit, undefined)

    const redirectUrl = (connectionRequest as any).redirectUrl as string | undefined

    if (!redirectUrl) {
      console.error('[Composio] no redirectUrl in connectionRequest:', connectionRequest)
      return NextResponse.json({ error: 'Composio did not return a redirect URL' }, { status: 502 })
    }

    return NextResponse.json({
      redirectUrl,
      connectedAccountId: (connectionRequest as any).connectedAccountId,
    })
  } catch (err: any) {
    console.error('[Composio] authorize failed:', err?.message ?? err)
    return NextResponse.json(
      { error: err?.message ?? 'Failed to initiate Composio OAuth' },
      { status: 502 }
    )
  }
}
