/**
 * Turn "a person at a company" into an email address we can stand behind.
 *
 * Runs providers in order and stops at the first one that returns an address
 * it vouches for (see emailProviders.ts). Guesses are collected and returned
 * so a human can look at them, but `usable` is true only for a vouched-for
 * address: a wrong address is a bounce on the user's own inbox.
 */
import { checkEmailDomain } from '@/lib/gtm/emailCheck'
import { crawlDomainForEmails, type CrawlResult } from '@/lib/gtm/emailCrawl'
import { defaultProviders, type EmailProvider, type FinderContext } from '@/lib/gtm/emailProviders'
import { reportFailure } from '@/lib/monitor'

export { generateCandidates, inferPatterns, normalizeNamePart } from '@/lib/gtm/emailPatterns'

export type FinderStatus =
  | 'found_on_site' | 'verified' | 'catch_all_guess' | 'unverified_guess' | 'not_found' | 'invalid_domain'

export interface FinderResult {
  status: FinderStatus
  usable: boolean
  email: string | null
  /** Which provider produced `email` (null when nothing was found). */
  source: string | null
  /** Providers consulted, in order, so a caller can see what a lookup cost. */
  tried: string[]
  /** Role addresses published on the site (info@, sales@...): safe fallbacks for company-level outreach. */
  roleEmails: string[]
  crawlAllowed: boolean
}

export async function findEmail(
  input: { firstName: string; lastName: string; domain: string },
  providers: EmailProvider[] = defaultProviders(),
): Promise<FinderResult> {
  const domain = input.domain.trim().toLowerCase()
  const result: FinderResult = {
    status: 'not_found', usable: false, email: null, source: null,
    tried: [], roleEmails: [], crawlAllowed: true,
  }

  const domainOk = await checkEmailDomain(`x@${domain}`)
  if (!domainOk.ok) return { ...result, status: 'invalid_domain' }

  // Memoised so site + pattern providers share one crawl (and one polite pass over the site).
  const crawlRef: { p: Promise<CrawlResult> | null } = { p: null }
  const ctx: FinderContext = {
    firstName: input.firstName,
    lastName: input.lastName,
    domain,
    getCrawl: () => (crawlRef.p ??= crawlDomainForEmails(domain)),
  }

  let bestGuess: { email: string; source: string; reason: 'catch_all' | 'unverified' } | null = null

  for (const provider of providers) {
    if (!provider.enabled()) continue
    result.tried.push(provider.name)
    let outcome
    try {
      outcome = await provider.find(ctx)
    } catch (err) {
      // One broken provider must not end the waterfall.
      await reportFailure('gtm.find_email.provider', err, { provider: provider.name })
      continue
    }

    if (outcome.kind === 'found') {
      result.email = outcome.email
      result.source = provider.name
      result.usable = true
      result.status = outcome.confidence === 'on_site' ? 'found_on_site' : 'verified'
      break
    }
    // Keep the first guess only: providers are ordered best-first.
    if (outcome.kind === 'guess' && !bestGuess) {
      bestGuess = { email: outcome.email, source: provider.name, reason: outcome.reason }
    }
  }

  if (crawlRef.p) {
    const c = await crawlRef.p
    result.crawlAllowed = c.allowed
    result.roleEmails = c.emails.filter(e => e.role).map(e => e.email)
  }

  if (!result.usable && bestGuess) {
    result.email = bestGuess.email
    result.source = bestGuess.source
    result.status = bestGuess.reason === 'catch_all' ? 'catch_all_guess' : 'unverified_guess'
  }
  return result
}
