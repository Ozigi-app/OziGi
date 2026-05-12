/**
 * Audit Stage 4b: Citation match audit
 * Every URL linked inline in the draft must be present in the source budget.
 * Out-of-budget URLs are model hallucinations and must be flagged.
 */

import type { AuditFlag, SourceBudgetEntry } from '@/lib/types/longform';

function extractLinks(markdown: string): Array<{ url: string; anchor: string; offset: number }> {
  const results: Array<{ url: string; anchor: string; offset: number }> = [];
  const re = /\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(markdown)) !== null) {
    results.push({ anchor: m[1], url: m[2], offset: m.index });
  }
  return results;
}

export function auditCitations(
  draftMarkdown: string,
  sourceBudget: SourceBudgetEntry[]
): AuditFlag[] {
  const flags: AuditFlag[] = [];
  const budgetUrls = new Set(sourceBudget.map((e) => e.url));
  const links = extractLinks(draftMarkdown);

  for (const { url, anchor, offset } of links) {
    if (!budgetUrls.has(url)) {
      flags.push({
        type: 'out-of-budget-url',
        severity: 'error',
        message: `Link "${anchor}" (${url}) was not in the source budget — likely hallucinated`,
        url,
        offset,
        length: `[${anchor}](${url})`.length,
        span_text: `[${anchor}](${url})`,
      });
    }
  }

  return flags;
}
