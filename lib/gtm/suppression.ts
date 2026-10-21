/**
 * Suppression: addresses we must not (re)contact, matched across ALL of a
 * sender's campaigns, not just the one lead row.
 *
 * Scoped per sender (user_id) on purpose. An opt-out is a request to stop
 * hearing from that sender; it is not a reason to withhold mail that a
 * different user sends under their own name.
 */
import { supabaseAdmin } from '@/lib/supabase/admin'
import type { LeadStatus } from '@/lib/types/gtm'

export type Suppression = 'opted_out' | 'bounced' | 'replied' | 'already_contacted'

// Strongest first: if several rows disagree, the most restrictive one wins.
const PRECEDENCE: Suppression[] = ['opted_out', 'bounced', 'replied', 'already_contacted']

/** Escape LIKE wildcards: '_' is common in emails and would otherwise match any character. */
function likeLiteral(s: string): string {
  return s.replace(/[\\%_]/g, c => `\\${c}`)
}

export function suppressionFromStatuses(statuses: string[]): Suppression | null {
  const found = new Set<Suppression>()
  for (const s of statuses) {
    if (s === 'opted_out' || s === 'bounced' || s === 'replied') found.add(s)
    else if (s === 'contacted') found.add('already_contacted')
  }
  return PRECEDENCE.find(p => found.has(p)) ?? null
}

/**
 * Is this address suppressed because ANOTHER lead row of the same sender says so?
 * `already_contacted` only matters for a first email: later sequence steps go
 * to leads we have, by design, already contacted.
 */
export async function findSuppression(
  userId: string,
  email: string,
  excludeLeadId: string,
  step: number,
): Promise<Suppression | null> {
  const { data } = await supabaseAdmin
    .from('leads')
    .select('status')
    .eq('user_id', userId)
    .ilike('email', likeLiteral(email.trim()))
    .neq('id', excludeLeadId)
    .in('status', ['opted_out', 'bounced', 'replied', 'contacted'])
    .limit(20)

  const result = suppressionFromStatuses((data ?? []).map(r => r.status as string))
  if (result === 'already_contacted' && step !== 1) return null
  return result
}

/** The lead status that mirrors a suppression, so the row stops being picked up as pending. */
export function statusFor(s: Suppression): LeadStatus {
  return s === 'already_contacted' ? 'not_qualified' : s
}

/** Opt a person out everywhere this sender could reach them. */
export async function optOutEverywhere(userId: string, email: string): Promise<void> {
  await supabaseAdmin
    .from('leads')
    .update({ status: 'opted_out', updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .ilike('email', likeLiteral(email.trim()))
}
