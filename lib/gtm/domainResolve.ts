/**
 * Work out a lead's company website, because the email finder needs a domain
 * and most leads only carry a company name (or nothing).
 *
 * Order, cheapest and most certain first:
 *   1. a domain/URL already written in the lead's company or bio text
 *   2. a company name -> guessed domains (acme.com, acme.io...), accepted ONLY
 *      if that site's own title/site name says it is that company
 * No match returns null. A wrong domain is worse than none: the finder would
 * then email-guess at the wrong company's staff.
 */
import { checkEmailDomain } from '@/lib/gtm/emailCheck'
import { robotsAllows } from '@/lib/gtm/emailCrawl'
import { safeFetch } from '@/lib/gtm/safeFetch'

const NOT_A_COMPANY_SITE = /(^|\.)(github|githubusercontent|linkedin|twitter|x|medium|dev|youtube|youtu|facebook|instagram|npmjs|t|gmail|google|notion|substack|linktr|bit|carrd|vercel|netlify|herokuapp|wixsite|wordpress|blogspot|gitlab|bitbucket|reddit|discord|slack|calendly|hashnode|producthunt)\.(com|io|co|so|ee|ly|me|app|dev|page|net|org|bio|st|to|ee)$/i

const URL_RE = /https?:\/\/(?:www\.)?([a-z0-9][a-z0-9.-]*\.[a-z]{2,})/gi
const BARE_RE = /\b((?:[a-z0-9-]+\.)+(?:com|io|co|ai|dev|app|net|org|so|xyz|tech|cloud|sh|me|us|uk|ng|ke|za|ca|au|de|fr|in))\b/gi

export function extractDomainFromText(text: string): string | null {
  for (const re of [URL_RE, BARE_RE]) {
    re.lastIndex = 0
    for (const m of text.matchAll(re)) {
      const d = m[1].toLowerCase()
      if (!NOT_A_COMPANY_SITE.test(d) && !/@/.test(text.slice(Math.max(0, m.index! - 1), m.index!))) return d
    }
  }
  return null
}

// Legal-entity endings only. "Labs"/"Technologies" are often part of the real name (acmelabs.com).
const SUFFIXES = /\b(inc|llc|ltd|limited|corp|corporation|co|company|gmbh|plc)\.?$/i

/** "CTO at Acme Inc. | ex-Google" -> "Acme". Only used when there is no company field. */
export function extractCompanyName(bio: string): string | null {
  const m = /(?:\bat|@)\s+([A-Z0-9][\w&.\-' ]{1,40})/i.exec(bio)
  if (!m) return null
  const name = m[1].split(/[|·•,;(/\n]| - | – | and | & /i)[0].trim().replace(SUFFIXES, '').trim()
  // Real company names start with a capital or digit. "a new startup called X" or
  // "the speed of light" are sentence fragments, not employers.
  if (!/^[A-Z0-9]/.test(name)) return null
  return name.length >= 3 ? name : null
}

export function normalizeCompany(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(SUFFIXES, '').replace(/[^a-z0-9]/g, '')
}

const TLDS = ['com', 'io', 'ai', 'co', 'dev', 'app']

export function guessDomains(company: string): string[] {
  const slug = normalizeCompany(company)
  if (slug.length < 4) return [] // too short to tell apart from unrelated sites
  return TLDS.map(t => `${slug}.${t}`)
}

/** The site's own claim about who it is: og:site_name, else the first segment of <title>. */
export function siteIdentity(html: string): string[] {
  const out: string[] = []
  const og = /<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i.exec(html)
    ?? /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:site_name["']/i.exec(html)
  if (og) out.push(og[1])
  const title = /<title[^>]*>([^<]{1,200})<\/title>/i.exec(html)
  if (title) out.push(title[1].split(/[|\-–—:·]/)[0])
  return out.map(s => s.trim()).filter(Boolean)
}

/** Strict on purpose: the site must name itself as the company, not merely mention it. */
export function identityMatches(html: string, company: string): boolean {
  const want = normalizeCompany(company)
  if (want.length < 4) return false
  return siteIdentity(html).some(id => normalizeCompany(id) === want)
}

export interface ResolvedDomain {
  domain: string
  how: 'text' | 'guessed_verified'
}

export async function resolveDomain(
  lead: { company?: string | null; bio?: string | null },
  opts: { allowPrivate?: boolean; baseFor?: (domain: string) => string } = {},
): Promise<ResolvedDomain | null> {
  const company = (lead.company ?? '').trim()
  const bio = (lead.bio ?? '').trim()

  const fromText = extractDomainFromText(`${company} ${bio}`)
  if (fromText && (await checkEmailDomain(`x@${fromText}`)).ok) return { domain: fromText, how: 'text' }

  const name = company || extractCompanyName(bio) || ''
  if (!name) return null

  for (const domain of guessDomains(name)) {
    if (!(await checkEmailDomain(`x@${domain}`)).ok) continue // doesn't exist: no fetch needed
    const base = opts.baseFor?.(domain) ?? `https://${domain}`
    try {
      const robots = await safeFetch(`${base}/robots.txt`, opts)
      if (robots.status >= 500 || (robots.status === 200 && !robotsAllows(robots.body, '/'))) continue
      const home = await safeFetch(`${base}/`, opts)
      if (home.status === 200 && identityMatches(home.body, name)) return { domain, how: 'guessed_verified' }
    } catch { /* unreachable: try the next guess */ }
  }
  return null
}
