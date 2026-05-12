/**
 * Stage 4: AUDIT orchestrator
 * Runs all five audit sub-modules in parallel and aggregates results
 * into a single AuditReport with all flags attached to specific spans.
 */

import type { AuditReport, SourceBudgetEntry } from '@/lib/types/longform';
import { auditLinks } from './audit-links';
import { auditCitations } from './audit-citations';
import { auditCode } from './audit-code';
import { auditProse } from './audit-prose';
import { auditAuthorities } from './audit-authorities';

/**
 * Fast audit: pure-JS checks only (<100ms). Run inline in the generate route
 * so it never threatens the 60s Vercel ceiling.
 * auditLinks (network I/O) is intentionally excluded here — call runFullAudit
 * from the review API endpoint, where it gets its own 60s budget.
 */
export function runFastAudit(
  postId: string,
  planId: string | null,
  draftMarkdown: string,
  sourceBudget: SourceBudgetEntry[]
): AuditReport {
  const citationFlags = auditCitations(draftMarkdown, sourceBudget);
  const codeFlags = auditCode(draftMarkdown);
  const { flags: proseFlags, score: proseScore } = auditProse(draftMarkdown);
  const authorityFlags = auditAuthorities(draftMarkdown, sourceBudget);

  const allFlags = [...citationFlags, ...codeFlags, ...proseFlags, ...authorityFlags];

  const totalLinks = (draftMarkdown.match(/\]\(https?:\/\//g) || []).length;
  const deadCitationCount = citationFlags.filter((f) => f.type === 'dead-link').length;
  const deadLinkRate = totalLinks > 0 ? deadCitationCount / totalLinks : 0;

  return {
    post_id: postId,
    plan_id: planId,
    flags: allFlags,
    dead_link_rate: parseFloat(deadLinkRate.toFixed(3)),
    link_audit_passed: true, // populated by runFullAudit
    citation_audit_passed: citationFlags.length === 0,
    code_audit_passed: codeFlags.filter((f) => f.severity === 'error').length === 0,
    prose_audit_score: proseScore,
    authority_audit_passed: authorityFlags.length === 0,
  };
}

/**
 * Full audit: fast checks + network link re-fetch.
 * Run from the review API endpoint (its own serverless invocation / 60s budget).
 */
export async function runFullAudit(
  postId: string,
  planId: string | null,
  draftMarkdown: string,
  sourceBudget: SourceBudgetEntry[]
): Promise<AuditReport> {
  const fast = runFastAudit(postId, planId, draftMarkdown, sourceBudget);
  const linkFlags = await auditLinks(draftMarkdown, sourceBudget);

  const allFlags = [...fast.flags, ...linkFlags];
  const totalLinks = (draftMarkdown.match(/\]\(https?:\/\//g) || []).length;
  const deadLinkCount = linkFlags.filter((f) => f.type === 'dead-link').length;
  const deadLinkRate = totalLinks > 0 ? deadLinkCount / totalLinks : 0;

  return {
    ...fast,
    flags: allFlags,
    dead_link_rate: parseFloat(deadLinkRate.toFixed(3)),
    link_audit_passed: linkFlags.filter((f) => f.severity === 'error').length === 0,
  };
}
