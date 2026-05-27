import { getVertexAIClient } from '@/lib/genai-client'
import type { IcpConfig, Lead } from '@/lib/types/gtm'

const GITHUB_API = 'https://api.github.com'
const DEVTO_API = 'https://dev.to/api'
const GITHUB_TOKEN = process.env.GITHUB_TOKEN  // optional but raises rate limit from 60 to 5000 req/hr

type RawLead = Omit<Lead, 'id' | 'campaign_id' | 'user_id' | 'status' | 'created_at' | 'updated_at'>

function githubHeaders() {
  const h: Record<string, string> = { Accept: 'application/vnd.github.v3+json' }
  if (GITHUB_TOKEN) h['Authorization'] = `Bearer ${GITHUB_TOKEN}`
  return h
}

// Search GitHub users matching ICP keywords. Returns up to `limit` raw leads.
export async function scrapeGitHub(icpConfig: IcpConfig, limit = 30): Promise<RawLead[]> {
  const keywords = [
    ...(icpConfig.keywords ?? []),
    ...(icpConfig.job_titles ?? []),
  ].slice(0, 5).join(' OR ')

  const query = encodeURIComponent(`${keywords} in:bio type:user`)
  const url = `${GITHUB_API}/search/users?q=${query}&per_page=${Math.min(limit, 30)}&sort=followers`

  const searchRes = await fetch(url, { headers: githubHeaders() })
  if (!searchRes.ok) {
    console.error('[scraper:github] search failed', await searchRes.text())
    return []
  }

  const { items } = await searchRes.json() as { items: Array<{ login: string }> }

  const leads: RawLead[] = []

  for (const item of items.slice(0, limit)) {
    try {
      const profileRes = await fetch(`${GITHUB_API}/users/${item.login}`, {
        headers: githubHeaders(),
      })
      if (!profileRes.ok) continue

      const profile = await profileRes.json() as {
        login: string
        name: string | null
        email: string | null
        bio: string | null
        company: string | null
        location: string | null
        blog: string | null
        twitter_username: string | null
        public_repos: number
        followers: number
        html_url: string
      }

      // Skip accounts with no useful signal
      if (!profile.bio && !profile.email && !profile.company) continue

      leads.push({
        source: 'github',
        source_id: profile.login,
        name: profile.name ?? profile.login,
        email: profile.email ?? null,
        github_username: profile.login,
        linkedin_url: null,
        linkedin_profile_id: null,
        twitter_handle: profile.twitter_username ?? null,
        bio: profile.bio ?? null,
        company: profile.company?.replace(/^@/, '') ?? null,
        location: profile.location ?? null,
        tags: extractTagsFromBio(profile.bio ?? ''),
        icp_match_score: null,
      })

      // Polite delay to avoid hammering the API
      await sleep(100)
    } catch {
      continue
    }
  }

  return leads
}

// Search Dev.to articles by tag, extract unique authors.
export async function scrapeDevTo(icpConfig: IcpConfig, limit = 30): Promise<RawLead[]> {
  const tags = (icpConfig.keywords ?? [])
    .map(k => k.toLowerCase().replace(/\s+/g, ''))
    .slice(0, 3)

  const seen = new Set<string>()
  const leads: RawLead[] = []

  for (const tag of tags) {
    if (leads.length >= limit) break

    const url = `${DEVTO_API}/articles?tag=${tag}&per_page=30&top=30`
    const res = await fetch(url, { headers: { 'api-key': process.env.DEVTO_API_KEY ?? '' } })
    if (!res.ok) continue

    const articles = await res.json() as Array<{
      user: {
        username: string
        name: string
        twitter_username: string | null
        github_username: string | null
        profile_image: string
        website_url: string | null
      }
      tag_list: string[]
    }>

    for (const article of articles) {
      const username = article.user.username
      if (seen.has(username)) continue
      seen.add(username)

      leads.push({
        source: 'devto',
        source_id: username,
        name: article.user.name ?? username,
        email: null,  // Dev.to API doesn't expose emails
        github_username: article.user.github_username ?? null,
        linkedin_url: null,
        linkedin_profile_id: null,
        twitter_handle: article.user.twitter_username ?? null,
        bio: null,
        company: null,
        location: null,
        tags: article.tag_list ?? [],
        icp_match_score: null,
      })

      if (leads.length >= limit) break
    }

    await sleep(200)
  }

  return leads
}

// Score a batch of leads against the ICP using Gemini — returns leads with icp_match_score filled
export async function scoreLeads(leads: RawLead[], icpConfig: IcpConfig): Promise<RawLead[]> {
  if (leads.length === 0) return []

  const ai = await getVertexAIClient()

  const prompt = `Score each lead against this ICP (Ideal Customer Profile).

ICP:
- Job titles: ${icpConfig.job_titles?.join(', ') ?? 'any'}
- Industries: ${icpConfig.industries?.join(', ') ?? 'any'}
- Keywords: ${icpConfig.keywords?.join(', ') ?? 'any'}
- Company sizes: ${icpConfig.company_sizes?.join(', ') ?? 'any'}

Leads (JSON array):
${JSON.stringify(leads.map((l, i) => ({
  i,
  name: l.name,
  bio: l.bio,
  company: l.company,
  tags: l.tags,
  location: l.location,
})), null, 2)}

For each lead, output a score from 0.0 to 1.0 where:
- 1.0 = perfect ICP match
- 0.5 = partial match
- 0.0 = no match

Return a JSON array of numbers, one per lead, same order: [0.8, 0.3, ...]`

  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    config: { responseMimeType: 'application/json', temperature: 0.1 },
  })

  const scores = JSON.parse(response.text ?? '[]') as number[]

  return leads.map((lead, i) => ({
    ...lead,
    icp_match_score: scores[i] ?? null,
  }))
}

function extractTagsFromBio(bio: string): string[] {
  const techTerms = /\b(react|vue|angular|node|python|typescript|javascript|rust|go|java|kotlin|swift|aws|gcp|azure|docker|kubernetes|postgres|redis|graphql|api|saas|startup|founder|developer|engineer|cto|fullstack|backend|frontend|ml|ai|open.?source)\b/gi
  const matches = bio.match(techTerms) ?? []
  return [...new Set(matches.map(m => m.toLowerCase()))]
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
