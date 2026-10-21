/**
 * Pure helpers for guessing a person's address from their name. No network.
 */
import type { CrawledEmail } from '@/lib/gtm/emailCrawl'

export type Pattern = 'first.last' | 'first_last' | 'first-last' | 'firstlast' | 'flast' | 'first' | 'f.last' | 'last' | 'firstl'

const DEFAULT_ORDER: Pattern[] = ['first.last', 'first', 'flast', 'firstlast', 'f.last', 'first_last', 'last', 'firstl', 'first-last']

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
export function matchesPerson(email: string, first: string, last: string): boolean {
  const local = email.split('@')[0].replace(/[^a-z]/g, '')
  if (!first || !last) return !!first && local === first
  return local === first + last || local === last + first || local === first[0] + last || local === first + last[0] || local === first
}
