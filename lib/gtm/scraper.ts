import { getVertexAIClient } from '@/lib/genai-client'
import type { IcpConfig, Lead } from '@/lib/types/gtm'
import { enrichFromWebsite, newEnrichBudget } from '@/lib/gtm/leadEnrich'
import { reportFailure } from '@/lib/monitor'

const GITHUB_API = 'https://api.github.com'
const DEVTO_API = 'https://dev.to/api'
const GITHUB_TOKEN = process.env.GITHUB_TOKEN  // optional but raises rate limit from 60 to 5000 req/hr

type RawLead = Omit<Lead, 'id' | 'campaign_id' | 'user_id' | 'status' | 'created_at' | 'updated_at'>

function githubHeaders() {
  const h: Record<string, string> = { Accept: 'application/vnd.github.v3+json' }
  if (GITHUB_TOKEN) h['Authorization'] = `Bearer ${GITHUB_TOKEN}`
  return h
}

/**
 * A scrape source that errors returns [] and the run carries on, so a revoked
 * token or a rate limit looked exactly like "found nothing" (GitHub returned
 * 401 on every run and nobody knew). Report it; Error Tracking groups repeats.
 */
async function reportScrapeFailure(source: string, res: Response, what: string): Promise<void> {
  let body = ''
  try { body = (await res.text()).slice(0, 200) } catch { /* ignore */ }
  await reportFailure(`gtm.scrape.${source}`, new Error(`${what}: HTTP ${res.status} ${body}`))
}

// Search GitHub users matching ICP keywords. Returns up to `limit` raw leads.
export async function scrapeGitHub(icpConfig: IcpConfig, limit = 30): Promise<RawLead[]> {
  // Quote multi-word terms: unquoted, "indie hacker" became two separate required words.
  const keywords = [
    ...(icpConfig.keywords ?? []),
    ...(icpConfig.job_titles ?? []),
  ].slice(0, 5).map(k => (/\s/.test(k) ? `"${k}"` : k)).join(' OR ')

  const query = encodeURIComponent(`${keywords} in:bio type:user`)
  const url = `${GITHUB_API}/search/users?q=${query}&per_page=${Math.min(limit, 30)}&sort=followers`

  const searchRes = await fetch(url, { headers: githubHeaders() })
  if (!searchRes.ok) {
    await reportScrapeFailure('github', searchRes, 'user search failed')
    return []
  }

  const { items } = await searchRes.json() as { items: Array<{ login: string }> }

  const leads: RawLead[] = []
  const enrichBudget = newEnrichBudget()
  const ghFailure = { status: 0, count: 0 }
  const onGhFail = (status: number) => { ghFailure.count++; ghFailure.status ||= status }

  for (const item of items.slice(0, limit)) {
    try {
      const profileRes = await fetch(`${GITHUB_API}/users/${item.login}`, {
        headers: githubHeaders(),
      })
      if (!profileRes.ok) { onGhFail(profileRes.status); continue }

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

      // Enrich: if profile email is hidden, mine it from commit history
      let email = profile.email ?? null
      if (!email) {
        email = await getCommitEmail(profile.login, onGhFail)
        if (email) console.log(`[scraper:github] commit email found for ${profile.login}`)
      }
      // Still nothing: the profile's own website may publish one. The cron drops
      // email-less leads, so this is the last chance to keep them.
      if (!email) {
        email = await enrichFromWebsite({ name: profile.name, email }, profile.blog, enrichBudget)
        if (email) console.log(`[scraper:github] website email found for ${profile.login}`)
      }

      leads.push({
        source: 'github',
        source_id: profile.login,
        name: profile.name ?? profile.login,
        email,
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

  if (ghFailure.count > 0) {
    await reportFailure('gtm.scrape.github', new Error(`${ghFailure.count} GitHub API call(s) failed, first status ${ghFailure.status}`))
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
  const enrichBudget = newEnrichBudget()
  const ghFailure = { status: 0, count: 0 }
  const onGhFail = (status: number) => { ghFailure.count++; ghFailure.status ||= status }

  for (const tag of tags) {
    if (leads.length >= limit) break

    const url = `${DEVTO_API}/articles?tag=${tag}&per_page=30&top=30`
    const res = await fetch(url, { headers: { 'api-key': process.env.DEVTO_API_KEY ?? '' } })
    if (!res.ok) { await reportScrapeFailure('devto', res, `article search for tag ${tag} failed`); continue }

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

      // Enrich: Dev.to doesn't expose emails, but if the author has a linked
      // GitHub username we can mine their commit history for a real address
      let devtoEmail: string | null = null
      if (article.user.github_username) {
        devtoEmail = await getCommitEmail(article.user.github_username, onGhFail)
        if (devtoEmail) console.log(`[scraper:devto] commit email found for ${username}`)
      }
      if (!devtoEmail) {
        devtoEmail = await enrichFromWebsite({ name: article.user.name, email: devtoEmail }, article.user.website_url, enrichBudget)
        if (devtoEmail) console.log(`[scraper:devto] website email found for ${username}`)
      }

      leads.push({
        source: 'devto',
        source_id: username,
        name: article.user.name ?? username,
        email: devtoEmail,
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

  if (ghFailure.count > 0) {
    await reportFailure('gtm.scrape.devto', new Error(`${ghFailure.count} GitHub lookup(s) for dev.to authors failed, first status ${ghFailure.status}`))
  }
  return leads
}

// Search Hacker News stories/comments via Algolia, extract unique active authors.
export async function scrapeHackerNews(icpConfig: IcpConfig, limit = 30): Promise<RawLead[]> {
  const keywords = [
    ...(icpConfig.keywords ?? []),
    ...(icpConfig.job_titles ?? []),
  ].slice(0, 4).join(' ')

  const url = `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(keywords)}&tags=story&hitsPerPage=100`
  const res = await fetch(url)
  if (!res.ok) {
    await reportScrapeFailure('hackernews', res, 'story search failed')
    return []
  }

  const data = await res.json() as { hits: Array<{ author: string }> }

  const seen = new Set<string>()
  const leads: RawLead[] = []

  for (const hit of data.hits) {
    if (!hit.author || seen.has(hit.author)) continue
    seen.add(hit.author)

    if (leads.length >= limit) break

    try {
      const userRes = await fetch(`https://hacker-news.firebaseio.com/v0/user/${hit.author}.json`)
      if (!userRes.ok) continue

      const user = await userRes.json() as {
        id: string
        about?: string
      } | null
      if (!user?.id) continue

      const bio = user.about ? stripHtml(user.about) : null

      // Some HN users embed their email in the about field
      const emailMatch = bio?.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)
      const email = emailMatch && isValidEmail(emailMatch[0]) ? emailMatch[0] : null

      leads.push({
        source: 'hackernews',
        source_id: user.id,
        name: user.id,
        email,
        github_username: null,
        linkedin_url: null,
        linkedin_profile_id: null,
        twitter_handle: null,
        bio,
        company: null,
        location: null,
        tags: extractTagsFromBio(bio ?? ''),
        icp_match_score: null,
      })

      await sleep(100)
    } catch {
      continue
    }
  }

  return leads
}

// Search npm packages by keyword, extract package authors/publishers.
// npm is particularly valuable because authors often include real emails in package metadata.
export async function scrapeNpm(
  icpConfig: IcpConfig,
  limit = 30,
  // Publishers this campaign already has. Skipped BEFORE counting toward `limit`,
  // so each run reaches past the top results it saved last time instead of
  // re-finding (and re-scoring) the same people.
  known: ReadonlySet<string> = new Set(),
): Promise<RawLead[]> {
  // One search per keyword, merged. npm's search ANDs the words in a query, so
  // "B2B SaaS Growth" matched only packages that mention all three (31 publishers
  // for a campaign with 11 keywords). Each keyword on its own casts a much wider net.
  const keywords = [...new Set((icpConfig.keywords ?? []).map(k => k.trim()).filter(Boolean))].slice(0, 12)
  if (!keywords.length) return []

  const seen = new Set<string>()
  const leads: RawLead[] = []

  for (const keyword of keywords) {
    if (leads.length >= limit) break

    const url = `https://registry.npmjs.org/-/v1/search?text=${encodeURIComponent(keyword)}&size=100`
    const res = await fetch(url)
    if (!res.ok) {
      await reportScrapeFailure('npm', res, `search for "${keyword}" failed`)
      continue
    }

    const data = await res.json() as {
      objects?: Array<{
        package: {
          name: string
          description: string
          keywords?: string[]
          author?: { name?: string; email?: string }
          publisher: { username: string; email: string }
          links: { homepage?: string; repository?: string }
        }
      }>
    }

    for (const obj of data.objects ?? []) {
      const pkg = obj.package
      const username = pkg.publisher?.username
      if (!username || seen.has(username) || known.has(username)) continue
      seen.add(username)

      // Prefer publisher email (always present) over author email
      const email = pkg.publisher?.email ?? pkg.author?.email ?? null
      // npm publisher emails are almost always real — still validate
      if (!isValidEmail(email ?? '')) continue

      const name = pkg.author?.name ?? username

      leads.push({
        source: 'npm',
        source_id: username,
        name,
        email,
        github_username: null,
        linkedin_url: null,
        linkedin_profile_id: null,
        twitter_handle: null,
        bio: pkg.description ?? null,
        company: null,
        location: null,
        tags: pkg.keywords?.slice(0, 10) ?? extractTagsFromBio(pkg.description ?? ''),
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
    model: 'gemini-3-flash-preview',
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    config: { responseMimeType: 'application/json', temperature: 0.1 },
  })

  const scores = JSON.parse(response.text ?? '[]') as number[]

  return leads.map((lead, i) => ({
    ...lead,
    icp_match_score: scores[i] ?? null,
  }))
}

/**
 * Commit-email enrichment — port of _get_commit_email from free_outbound_email_agent.
 * Walks the user's most-recently-pushed public repos and reads the commit author
 * email, which is almost always a real address even when the profile email is hidden.
 */
async function getCommitEmail(username: string, onFail?: (status: number) => void): Promise<string | null> {
  const reposRes = await fetch(
    `${GITHUB_API}/users/${username}/repos?sort=pushed&per_page=10&type=owner`,
    { headers: githubHeaders() }
  )
  // 404 = the linked GitHub account is gone or renamed (common on dev.to profiles).
  // That's bad lead data, not a scraper failure; 403/429/5xx still get reported.
  if (reposRes.status === 404) return null
  if (!reposRes.ok) { onFail?.(reposRes.status); return null }

  const repos = await reposRes.json() as Array<{ name: string; fork: boolean; private: boolean }>

  for (const repo of repos) {
    if (repo.fork || repo.private) continue

    try {
      const commitsRes = await fetch(
        `${GITHUB_API}/repos/${username}/${repo.name}/commits?author=${username}&per_page=1`,
        { headers: githubHeaders() }
      )
      if (!commitsRes.ok) continue

      const commits = await commitsRes.json() as Array<{
        commit: { author: { email: string } }
      }>
      if (!commits?.length) continue

      const email = commits[0]?.commit?.author?.email ?? ''
      if (isValidEmail(email)) return email
    } catch {
      // skip this repo, try next
    }

    await sleep(300)
  }

  return null
}

function isValidEmail(email: string): boolean {
  if (!email) return false
  if (email.includes('noreply')) return false   // catches github noreply addresses
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function extractTagsFromBio(bio: string): string[] {
  const techTerms = /\b(react|vue|angular|node|python|typescript|javascript|rust|go|java|kotlin|swift|aws|gcp|azure|docker|kubernetes|postgres|redis|graphql|api|saas|startup|founder|developer|engineer|cto|fullstack|backend|frontend|ml|ai|open.?source)\b/gi
  const matches = bio.match(techTerms) ?? []
  return [...new Set(matches.map(m => m.toLowerCase()))]
}

// Strip HTML tags from HN "about" fields, which are stored as raw HTML.
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
