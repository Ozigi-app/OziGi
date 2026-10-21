/**
 * Email-finding providers. The finder runs them in order (a "waterfall") and
 * stops at the first usable answer, so cheap and free sources come first and
 * paid ones are only called when those find nothing.
 *
 * To add a provider (Apollo, Hunter, a data vendor...): write an object that
 * satisfies EmailProvider, return it from `defaultProviders()` AFTER the free
 * ones, and set `paid: true`. Check the vendor's terms allow embedding their
 * data in a product you sell before wiring one in.
 *
 * Contract for `find`:
 *  - return `found` ONLY for an address you would stand behind sending to
 *  - return `guess` for a best guess a human could look at (never auto-sent)
 *  - return `none` when you have nothing; throwing is also fine, the finder
 *    treats it as `none` and moves on to the next provider
 */
import type { CrawlResult } from '@/lib/gtm/emailCrawl'
import { verifyEmail, verifierConfigured } from '@/lib/gtm/emailVerify'
import { generateCandidates, inferPatterns, matchesPerson, normalizeNamePart } from '@/lib/gtm/emailPatterns'

export interface FinderContext {
  firstName: string
  lastName: string
  domain: string
  /** The company-site crawl, run at most once per lookup no matter how many providers want it. */
  getCrawl: () => Promise<CrawlResult>
}

export type ProviderOutcome =
  | { kind: 'found'; email: string; confidence: 'on_site' | 'verified' }
  | { kind: 'guess'; email: string; reason: 'catch_all' | 'unverified' }
  | { kind: 'none' }

export interface EmailProvider {
  name: string
  /** Paid providers cost money per call: keep them last, and meter them. */
  paid: boolean
  enabled(): boolean
  find(ctx: FinderContext): Promise<ProviderOutcome>
}

/** Looks for the person's own address on the company's website. Free. */
export const siteProvider: EmailProvider = {
  name: 'company_site',
  paid: false,
  enabled: () => true,
  async find(ctx) {
    const crawl = await ctx.getCrawl()
    const first = normalizeNamePart(ctx.firstName)
    const last = normalizeNamePart(ctx.lastName)
    const hit = crawl.emails.find(e => !e.role && matchesPerson(e.email, first, last))
    return hit ? { kind: 'found', email: hit.email, confidence: 'on_site' } : { kind: 'none' }
  },
}

const MAX_VERIFY = 4

/**
 * Generates likely addresses (company pattern first, learned from the site),
 * then has the verifier confirm one. Without a verifier it can only guess.
 */
export const patternProvider: EmailProvider = {
  name: 'pattern_verify',
  paid: false, // the verifier costs per check, but needs no vendor relationship for data
  enabled: () => true,
  async find(ctx) {
    const crawl = await ctx.getCrawl()
    const candidates = generateCandidates(ctx.firstName, ctx.lastName, ctx.domain, inferPatterns(crawl.emails))
    if (!candidates.length) return { kind: 'none' }

    if (!verifierConfigured()) return { kind: 'guess', email: candidates[0], reason: 'unverified' }

    for (const candidate of candidates.slice(0, MAX_VERIFY)) {
      const v = await verifyEmail(candidate)
      if (v === 'valid') return { kind: 'found', email: candidate, confidence: 'verified' }
      // Catch-all: the server says yes to everything, so no candidate can be confirmed.
      if (v === 'catch_all') return { kind: 'guess', email: candidates[0], reason: 'catch_all' }
    }
    return { kind: 'none' }
  },
}

export function defaultProviders(): EmailProvider[] {
  return [siteProvider, patternProvider]
}
