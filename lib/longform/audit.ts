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

export async function runAudit(
  postId: string,
  planId: string | null,
  draftMarkdown: string,
  sourceBudget: SourceBudgetEntry[]
): Promise<AuditReport> {
  const [linkFlags, codeFlags, proseResult, authorityFlags, citationFlags] = await Promise.all([
    auditLinks(draftMarkdown, sourceBudget),
    Promise.resolve(auditCode(draftMarkdown)),
    Promise.resolve(auditProse(draftMarkdown)),
    Promise.resolve(auditAuthorities(draftMarkdown, sourceBudget)),
    Promise.resolve(auditCitations(draftMarkdown, sourceBudget)),
  ]);

  const allFlags = [
    ...citationFlags,
    ...linkFlags,
    ...codeFlags,
    ...proseResult.flags,
    ...authorityFlags,
  ];

  const deadLinkCount = [...linkFlags, ...citationFlags].filter(
    (f) => f.type === 'dead-link'
  ).length;
  const totalLinks = (draftMarkdown.match(/\]\(https?:\/\//g) || []).length;
  const deadLinkRate = totalLinks > 0 ? deadLinkCount / totalLinks : 0;

  return {
    post_id: postId,
    plan_id: planId,
    flags: allFlags,
    dead_link_rate: parseFloat(deadLinkRate.toFixed(3)),
    link_audit_passed: linkFlags.filter((f) => f.severity === 'error').length === 0,
    citation_audit_passed: citationFlags.length === 0,
    code_audit_passed: codeFlags.filter((f) => f.severity === 'error').length === 0,
    prose_audit_score: proseResult.score,
    authority_audit_passed: authorityFlags.length === 0,
  };
}
