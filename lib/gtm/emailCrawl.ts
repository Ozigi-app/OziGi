/**
 * Collect publicly published email addresses from a company's OWN website.
 *
 * Guardrails, because this runs against third-party sites:
 *  - obeys robots.txt (for OzigiBot, falling back to `*`); a robots.txt that
 *    errors with 5xx is treated as "do not crawl", per the usual convention
 *  - same site only, at most MAX_PAGES pages, with a pause between requests
 *  - keeps only addresses on the target domain, so we never harvest third parties
 *  - goes through safeFetch (no private networks)
 */
import { safeFetch } from '@/lib/gtm/safeFetch'

const MAX_PAGES = 5
const PAUSE_MS = 600
const PATHS = ['/', '/contact', '/contact-us', '/about', '/about-us', '/team', '/company']

const ROLE_LOCALS = new Set([
  'info', 'contact', 'hello', 'hi', 'sales', 'support', 'help', 'team', 'admin', 'office',
  'press', 'media', 'careers', 'jobs', 'billing', 'enquiries', 'inquiries', 'marketing',
  'partnerships', 'partners', 'legal', 'privacy', 'security', 'hey', 'mail', 'general',
])

export interface CrawledEmail {
  email: string
  role: boolean
  page: string
}

export interface CrawlResult {
  domain: string
  allowed: boolean            // false when robots.txt forbids us
  pagesFetched: number
  emails: CrawledEmail[]
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

/** Minimal robots.txt: the longest matching rule for our agent (else `*`) wins. */
export function robotsAllows(robots: string, path: string, agent = 'ozigibot'): boolean {
  const groups: { agents: string[]; rules: { allow: boolean; path: string }[] }[] = []
  let cur: (typeof groups)[number] | null = null
  let lastWasAgent = false
  for (const raw of robots.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, '').trim()
    const m = /^([a-z-]+)\s*:\s*(.*)$/i.exec(line)
    if (!m) continue
    const key = m[1].toLowerCase(), val = m[2].trim()
    if (key === 'user-agent') {
      if (!cur || !lastWasAgent) { cur = { agents: [], rules: [] }; groups.push(cur) }
      cur.agents.push(val.toLowerCase())
      lastWasAgent = true
    } else {
      lastWasAgent = false
      if (cur && (key === 'allow' || key === 'disallow') && val) {
        cur.rules.push({ allow: key === 'allow', path: val })
      }
    }
  }
  const group =
    groups.find(g => g.agents.includes(agent)) ?? groups.find(g => g.agents.includes('*'))
  if (!group) return true

  let best: { allow: boolean; len: number } | null = null
  for (const r of group.rules) {
    const pattern = r.path.replace(/\*$/, '')
    const hit = r.path.endsWith('$')
      ? path === r.path.slice(0, -1)
      : path.startsWith(pattern.replace(/\$$/, ''))
    if (hit && (!best || pattern.length > best.len || (pattern.length === best.len && r.allow))) {
      best = { allow: r.allow, len: pattern.length }
    }
  }
  return best ? best.allow : true
}

/** Cloudflare's "email protection" hides addresses as hex: first byte is the XOR key. */
export function decodeCfEmail(hex: string): string | null {
  if (!/^[0-9a-f]{4,}$/i.test(hex) || hex.length % 2) return null
  const key = parseInt(hex.slice(0, 2), 16)
  let out = ''
  for (let i = 2; i < hex.length; i += 2) out += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16) ^ key)
  return out
}

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+/gi
const JUNK = /noreply|no-reply|donotreply|do-not-reply|example\.|sentry|wixpress|@2x|\.(png|jpe?g|gif|svg|webp)$/i

export function extractEmails(html: string, domain: string): string[] {
  const found = new Set<string>()
  const add = (s: string) => {
    const e = s.trim().toLowerCase().replace(/^mailto:/, '').split('?')[0]
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) || JUNK.test(e)) return
    const host = e.split('@')[1]
    if (host === domain || host.endsWith('.' + domain)) found.add(e)
  }
  for (const m of html.matchAll(/data-cfemail="([0-9a-f]+)"/gi)) {
    const decoded = decodeCfEmail(m[1]); if (decoded) add(decoded)
  }
  for (const m of html.matchAll(/mailto:([^"'>\s]+)/gi)) add(decodeURIComponent(m[1]))
  const text = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ')
  for (const m of text.matchAll(EMAIL_RE)) add(m[0])
  return [...found]
}

export async function crawlDomainForEmails(
  domain: string,
  opts: { allowPrivate?: boolean; baseUrl?: string } = {},
): Promise<CrawlResult> {
  // baseUrl exists for tests (a local server); production always derives it from the domain.
  const base = opts.baseUrl ?? `https://${domain}`
  const result: CrawlResult = { domain, allowed: true, pagesFetched: 0, emails: [] }

  let robots = ''
  try {
    const r = await safeFetch(`${base}/robots.txt`, opts)
    if (r.status >= 500) { result.allowed = false; return result }
    if (r.status === 200) robots = r.body
  } catch {
    return result // unreachable site: nothing to find, nothing to claim
  }

  const seen = new Map<string, CrawledEmail>()
  for (const path of PATHS) {
    if (result.pagesFetched >= MAX_PAGES) break
    if (!robotsAllows(robots, path)) { if (path === '/') result.allowed = false; continue }
    if (result.pagesFetched > 0) await sleep(PAUSE_MS)
    try {
      const page = await safeFetch(`${base}${path}`, opts)
      if (page.status !== 200) continue
      result.pagesFetched++
      for (const email of extractEmails(page.body, domain)) {
        if (!seen.has(email)) seen.set(email, { email, role: ROLE_LOCALS.has(email.split('@')[0]), page: path })
      }
    } catch { /* one bad page should not end the crawl */ }
  }
  result.emails = [...seen.values()]
  return result
}
