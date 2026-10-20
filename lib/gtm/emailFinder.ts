/**
 * Turn "a person at a company" into an email address we can stand behind.
 *
 * Order of trust:
 *   1. found_on_site   the person's own address is published on the company site
 *   2. verified        a candidate the verifier confirms as a real mailbox
 *   3. catch_all_guess / unverified_guess   best guess only, NOT usable
 *
 * `usable` is true only for 1 and 2. Guesses are returned so a human can look
 * at them, but nothing should send to a guess: a wrong address is a bounce on
 * the user's own inbox.
 */
import { checkEmailDomain } from '@/lib/gtm/emailCheck'
import { crawlDomainForEmails, type CrawledEmail } from '@/lib/gtm/emailCrawl'
import { verifyEmail, verifierConfigured } from '@/lib/gtm/emailVerify'

export type FinderStatus =
  | 'found_on_site' | 'verified' | 'catch_all_guess' | 'unverified_guess' | 'not_found' | 'invalid_domain'

export interface FinderResult {
  status: FinderStatus
  usable: boolean
  email: string | null
  /** Role addresses published on the site (info@, sales@...): safe fallbacks for company-level outreach. */
  roleEmails: string[]
  crawlAllowed: boolean
  verifierUsed: boolean
}

type Pattern = 'first.last' | 'first_last' | 'first-last' | 'firstlast' | 'flast' | 'first' | 'f.last' | 'last' | 'firstl'

const DEFAULT_ORDER: Pattern[] = ['first.last', 'first', 'flast', 'firstlast', 'f.last', 'first_last', 'last', 'firstl', 'first-last']
const MAX_VERIFY = 4

export function normalizeNamePart(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]/g, '')
}

function build(p: Pattern, first: string, last: string): string | null {
  switch (p) {
    case 'first.last': return last ? `${first}.${last}` : null
    case 'first_last': return last ? `${first}_${last}` : null
    case 'first-last': return last ? `${first}-${last}` : null
    case 'firstlast':  return last ? `${first}${last}` : null
    case 'flast':      return last ? `${first[0]}${last}` : null
    case 'f.last':     return last ? `${first[0]}.${last}` : null
    case 'firstl':     return last ? `${first}${last[0]}` : null
    case 'last':       return last || null
    case 'first':      return first
  }
}

/** Patterns the company's published personal addresses point to, most telling first. */
export function inferPatterns(published: CrawledEmail[]): Pattern[] {
  const out: Pattern[] = []
  for (const { email, role } of published) {
    if (role) continue
    const local = email.split('@')[0]
    if (/^[a-z]+\.[a-z]+$/.test(local)) out.push(local.split('.')[0].length === 1 ? 'f.last' : 'first.last')
    else if (/^[a-z]+_[a-z]+$/.test(local)) out.push('first_last')
    else if (/^[a-z]+-[a-z]+$/.test(local)) out.push('first-last')
  }
  return [...new Set(out)]
}

export function generateCandidates(
  firstName: string, lastName: string, domain: string, preferred: Pattern[] = [],
): string[] {
  const first = normalizeNamePart(firstName)
  const last = normalizeNamePart(lastName)
  if (!first) return []
  const order = [...new Set([...preferred, ...DEFAULT_ORDER])]
  const locals = order.map(p => build(p, first, last)).filter((l): l is string => !!l)
  return [...new Set(locals)].map(l => `${l}@${domain}`)
}

/** Does a published address look like it belongs to this person? */
function matchesPerson(email: string, first: string, last: string): boolean {
  const local = email.split('@')[0].replace(/[^a-z]/g, '')
  if (!first || !last) return !!first && local === first
  return local === first + last || local === last + first || local === first[0] + last || local === first + last[0] || local === first
}

export async function findEmail(input: {
  firstName: string
  lastName: string
  domain: string
}): Promise<FinderResult> {
  const domain = input.domain.trim().toLowerCase()
  const base: FinderResult = {
    status: 'not_found', usable: false, email: null, roleEmails: [],
    crawlAllowed: true, verifierUsed: false,
  }

  const domainOk = await checkEmailDomain(`x@${domain}`)
  if (!domainOk.ok) return { ...base, status: 'invalid_domain' }

  const crawl = await crawlDomainForEmails(domain)
  base.crawlAllowed = crawl.allowed
  base.roleEmails = crawl.emails.filter(e => e.role).map(e => e.email)

  const first = normalizeNamePart(input.firstName)
  const last = normalizeNamePart(input.lastName)

  const onSite = crawl.emails.find(e => !e.role && matchesPerson(e.email, first, last))
  if (onSite) return { ...base, status: 'found_on_site', usable: true, email: onSite.email }

  const candidates = generateCandidates(input.firstName, input.lastName, domain, inferPatterns(crawl.emails))
  if (!candidates.length) return base

  if (!verifierConfigured()) {
    return { ...base, status: 'unverified_guess', email: candidates[0] }
  }

  base.verifierUsed = true
  for (const candidate of candidates.slice(0, MAX_VERIFY)) {
    const v = await verifyEmail(candidate)
    if (v === 'valid') return { ...base, status: 'verified', usable: true, email: candidate }
    // Catch-all: the server says yes to everything, so no candidate can be confirmed.
    if (v === 'catch_all') return { ...base, status: 'catch_all_guess', email: candidates[0] }
  }
  return base
}
