/**
 * Per-source search terms.
 *
 * A campaign's ICP `keywords` are written for LinkedIn ("words in this person's
 * headline or bio": B2B, SaaS, Growth). npm, GitHub and dev.to were then
 * searched with those same words, but a developer's package or bio does not say
 * "Growth", so npm matched 31 publishers and little of it was relevant. This asks
 * the model for the terms the SAME people would actually use on each source.
 *
 * Stored inside the existing `icp_config` JSON (no migration) and generated
 * lazily on the first scrape, so existing campaigns pick it up too. Any failure
 * falls back to the original keywords: translation must never stop a scrape.
 */
import { getVertexAIClient } from '@/lib/genai-client'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { reportFailure } from '@/lib/monitor'
import type { Campaign, IcpConfig, SourceQueries } from '@/lib/types/gtm'

const MODEL = 'gemini-3-flash-preview'
const GENERATE_TIMEOUT_MS = 25_000
const MAX_TERMS = 8

/**
 * Terms go straight into third-party search queries (GitHub's accepts
 * qualifiers like `user:`, `stars:>1000`, `OR`), so keep plain words only.
 */
export function sanitizeTerms(raw: unknown, max = MAX_TERMS): string[] {
  if (!Array.isArray(raw)) return []
  const out: string[] = []
  for (const item of raw) {
    if (typeof item !== 'string') continue
    const term = item.toLowerCase().replace(/[^a-z0-9 +#.\-]/g, ' ').replace(/\s+/g, ' ').trim()
    if (term.length < 2 || term.length > 40) continue
    if (/^(or|and|not)$/.test(term)) continue
    if (!out.includes(term)) out.push(term)
    if (out.length >= max) break
  }
  return out
}

export function parseSourceQueries(raw: unknown): SourceQueries | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const result: SourceQueries = {
    npm: sanitizeTerms(r.npm),
    github: sanitizeTerms(r.github),
    devto: sanitizeTerms(r.devto),
    hackernews: sanitizeTerms(r.hackernews),
  }
  // Useless if neither of the sources that actually yield leads got any terms.
  return result.npm.length || result.github.length ? result : null
}

function buildPrompt(c: Pick<Campaign, 'icp_description' | 'icp_config' | 'product_name' | 'product_description'>): string {
  const icp = c.icp_config
  return `We find sales leads by searching developer communities. Translate this ideal customer into search terms for each source.

Who we want to reach: ${c.icp_description || '(not given)'}
Job titles: ${(icp.job_titles ?? []).join(', ') || 'any'}
Industries: ${(icp.industries ?? []).join(', ') || 'any'}
What we sell: ${[c.product_name, c.product_description].filter(Boolean).join(' - ') || '(not given)'}

The people we want are usually NOT developers by title, but many of them build software, run SaaS products or publish code. For each source, give short terms that THESE people would actually use there, not marketing words about their business:

- npm: topics of packages about THE WORK these people do, i.e. their problem domain, not generic infrastructure (e.g. for outreach/growth people: "cold email", "lead generation", "outreach", "crm", "email verification", "scraper"). Never generic building blocks such as "auth", "api", "dashboard", "billing" or "analytics": their maintainers are library developers, not our customers.
- github: phrases that appear in the BIO of their GitHub profile (e.g. "founder", "indie hacker", "building saas", "startup")
- devto: tags on articles they write (single lowercase words, e.g. "saas", "startup", "productivity")
- hackernews: words in their stories or comments

Rules: at most ${MAX_TERMS} terms per source, 1-3 words each, lowercase, plain words only (no operators, no quotes, no punctuation, no tool or site names).

Return JSON only: {"npm": [], "github": [], "devto": [], "hackernews": []}`
}

export async function generateSourceQueries(
  c: Pick<Campaign, 'icp_description' | 'icp_config' | 'product_name' | 'product_description'>,
): Promise<SourceQueries | null> {
  const ai = await getVertexAIClient()
  const call = ai.models.generateContent({
    model: MODEL,
    contents: [{ role: 'user', parts: [{ text: buildPrompt(c) }] }],
    config: { responseMimeType: 'application/json', temperature: 0.2 },
  })
  const response = await Promise.race([
    call,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error('source query generation timed out')), GENERATE_TIMEOUT_MS)),
  ])
  return parseSourceQueries(JSON.parse(response.text ?? '{}'))
}

/**
 * The campaign's stored terms, generating and saving them on first use.
 * Never throws: returns null (callers fall back to the raw keywords).
 */
export async function ensureSourceQueries(campaign: Campaign): Promise<SourceQueries | null> {
  const existing = parseSourceQueries(campaign.icp_config?.source_queries)
  if (existing) return existing
  try {
    const generated = await generateSourceQueries(campaign)
    if (!generated) return null
    await supabaseAdmin
      .from('campaigns')
      .update({ icp_config: { ...campaign.icp_config, source_queries: generated } })
      .eq('id', campaign.id)
    return generated
  } catch (err) {
    await reportFailure('gtm.source_queries', err, { userId: campaign.user_id, campaignId: campaign.id })
    return null
  }
}

/**
 * The ICP to hand a scraper for one source: that source's terms first, then the
 * original keywords as a tail. Measured on npm, the translated terms and the
 * original keywords found almost entirely DIFFERENT people (3 of 100 overlapped)
 * of similar quality, so using both roughly doubles the pool. With no terms it
 * is the original ICP, unchanged. `job_titles` are dropped when translated
 * because GitHub's search treated a multi-word title like "Head of Growth" as
 * separate required words.
 */
export function icpForSource(
  icp: IcpConfig,
  queries: SourceQueries | null,
  source: keyof SourceQueries,
): IcpConfig {
  const terms = queries?.[source] ?? []
  if (!terms.length) return icp
  return { ...icp, keywords: [...new Set([...terms, ...(icp.keywords ?? [])])], job_titles: [] }
}
