import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { userIdFromExtensionToken, extensionCors } from '@/lib/gtm/extensionAuth'

// Hands the extension the next LinkedIn people-search to run in the user's own
// logged-in tab. This replaces the headless worker's /search endpoint: LinkedIn
// serves search results to a real session and withholds them from a flagged
// headless one, the same reason sending moved into the extension.
//
// Server-side scrapers (github/devto/npm/hackernews) all set linkedin_url null,
// so this is the ONLY producer of leads the connect flow can act on.

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: extensionCors })
}

interface IcpConfig {
  job_titles?: string[]
  keywords?: string[]
  locations?: string[]
}

// Mirrors the retired worker's URL builder so results stay comparable.
function buildSearchUrl(icp: IcpConfig): string {
  const terms = [
    ...(icp.job_titles ?? []).slice(0, 2),
    ...(icp.keywords ?? []).slice(0, 2),
  ].filter(Boolean)
  const query = encodeURIComponent(terms.join(' ') || 'software engineer')
  return `https://www.linkedin.com/search/results/people/?keywords=${query}&origin=GLOBAL_SEARCH_HEADER`
}

export async function GET(req: Request) {
  const userId = await userIdFromExtensionToken(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: extensionCors })

  // Active campaigns that asked for LinkedIn sourcing.
  // Newest first, and deterministic: several campaigns can carry the LinkedIn
  // source, and without an explicit order the leads would land against an
  // arbitrary one from run to run.
  const { data: campaigns, error } = await supabaseAdmin
    .from('campaigns')
    .select('id, name, icp_config, sources, status')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: extensionCors })

  const linkedinCampaigns = (campaigns ?? []).filter(c =>
    Array.isArray(c.sources) && c.sources.includes('linkedin')
  )
  if (!linkedinCampaigns.length) return NextResponse.json({ job: null }, { headers: extensionCors })

  // One search per campaign per day — searching is far more rate-limit sensitive
  // than sending, and repeat runs mostly re-find the same people.
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  for (const campaign of linkedinCampaigns) {
    const { count } = await supabaseAdmin
      .from('leads')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', campaign.id)
      .eq('source', 'linkedin')
      .gte('created_at', since)

    if ((count ?? 0) > 0) continue // already searched for this campaign today

    return NextResponse.json({
      job: {
        campaignId: campaign.id,
        campaignName: campaign.name ?? null, // so the extension log says which one
        searchUrl: buildSearchUrl((campaign.icp_config ?? {}) as IcpConfig),
        limit: 25,
      },
    }, { headers: extensionCors })
  }

  return NextResponse.json({ job: null }, { headers: extensionCors })
}
