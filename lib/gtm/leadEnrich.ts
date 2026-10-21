/**
 * Recover an email for a scraped lead from the website it already told us
 * about (GitHub `blog`, dev.to `website_url`), BEFORE the scrape cron drops
 * leads that have no email.
 *
 * Bounded on purpose: each lookup crawls a third-party site politely (a pause
 * between pages), and the scrape cron has a hard time limit. A budget keeps
 * enrichment from eating the run that discovers the leads in the first place.
 */
import { extractDomainFromText } from '@/lib/gtm/domainResolve'
import { findEmail, type FinderResult } from '@/lib/gtm/emailFinder'

export interface EnrichBudget {
  remaining: number
  deadline: number
}

const PER_LOOKUP_MS = 15_000

export function newEnrichBudget(maxLookups = 8, totalMs = 60_000): EnrichBudget {
  return { remaining: maxLookups, deadline: Date.now() + totalMs }
}

type Finder = (input: { firstName: string; lastName: string; domain: string }) => Promise<FinderResult>

/** "Ada Lovelace" -> Ada / Lovelace. A single token (often just a username) is not a name worth guessing from. */
export function splitName(name: string | null): { firstName: string; lastName: string } | null {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean)
  if (parts.length < 2) return null
  return { firstName: parts[0], lastName: parts[parts.length - 1] }
}

/**
 * Returns the email to use, or null. Only an address the finder vouches for
 * (`usable`) is returned: a guess would become a bounce on the user's inbox.
 */
export async function enrichFromWebsite(
  lead: { name: string | null; email: string | null },
  website: string | null | undefined,
  budget: EnrichBudget,
  finder: Finder = findEmail,
): Promise<string | null> {
  if (lead.email || !website) return null
  if (budget.remaining <= 0 || Date.now() >= budget.deadline) return null

  const domain = extractDomainFromText(website)
  const name = splitName(lead.name)
  if (!domain || !name) return null

  budget.remaining--
  try {
    const result = await Promise.race([
      finder({ ...name, domain }),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('lookup timeout')), PER_LOOKUP_MS)),
    ])
    return result.usable ? result.email : null
  } catch {
    return null // enrichment is a bonus: never let it fail the scrape
  }
}
