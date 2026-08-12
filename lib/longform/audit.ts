/**
 * Stage 4: AUDIT orchestrator
 * Runs the audit sub-modules in parallel and aggregates results into a single
 * AuditReport with all flags attached to specific spans.
 *
 * Sub-modules:
 *   citations / code / prose / authorities   - always run (pure JS)
 *   structure / audience                     - run when generation context is known
 *   links                                    - network I/O, full audit only
 */

import type { AuditReport, AuditContext, SourceBudgetEntry } from '@/lib/types/longform';
import { auditLinks } from './audit-links';
import { auditCitations } from './audit-citations';
import { auditCode } from './audit-code';
import { auditProse } from './audit-prose';
import { auditAuthorities } from './audit-authorities';
import { auditStructure } from './audit-structure';
import { auditAudience } from './audit-audience';

/** Tones whose instructions permit contractions (see lib/prompts/long-form.ts). */
const CONVERSATIONAL_TONES = new Set(['casual', 'storytelling']);

/**
 * Fast audit: pure-JS checks only (<100ms). Run inline in the generate route
 * so it never threatens the 60s Vercel ceiling.
 * auditLinks (network I/O) is intentionally excluded here - call runFullAudit
 * from the review API endpoint, where it gets its own 60s budget.
 *
 * `context` carries the generation parameters (tone, structure, audience) so the
 * calibration checks know what the draft was supposed to be. Omit it and those
 * checks simply do not run - every other check is unaffected.
 */
export function runFastAudit(
  postId: string,
  planId: string | null,
  draftMarkdown: string,
  sourceBudget: SourceBudgetEntry[],
  context: AuditContext = {}
): AuditReport {
  const citationFlags = auditCitations(draftMarkdown, sourceBudget);
  const codeFlags = auditCode(draftMarkdown);
  const { flags: proseFlags, score: proseScore } = auditProse(draftMarkdown, {
    expectContractions: context.tone ? CONVERSATIONAL_TONES.has(context.tone) : false,
  });
  const authorityFlags = auditAuthorities(draftMarkdown, sourceBudget);
  const structureFlags = auditStructure(draftMarkdown, context.structure);
  const audienceFlags = auditAudience(draftMarkdown, context.audience, context.structure);

  const allFlags = [
    ...citationFlags,
    ...codeFlags,
    ...proseFlags,
    ...authorityFlags,
    ...structureFlags,
    ...audienceFlags,
  ];

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
  sourceBudget: SourceBudgetEntry[],
  context: AuditContext = {}
): Promise<AuditReport> {
  const fast = runFastAudit(postId, planId, draftMarkdown, sourceBudget, context);
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
