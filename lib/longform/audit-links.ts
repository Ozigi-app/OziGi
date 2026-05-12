/**
 * Audit Stage 4a: Link audit
 * Re-fetches every URL in the draft and flags:
 *  - Dead links not in the source budget (introduced by the model during drafting)
 *  - Source-budget URLs that 404'd at Stage 2 but somehow survived into the draft
 */

import type { AuditFlag, SourceBudgetEntry } from '@/lib/types/longform';

const FETCH_TIMEOUT_MS = 8_000;

function extractLinks(markdown: string): string[] {
  const urls: string[] = [];
  const inlineLink = /\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)/g;
  let m: RegExpExecArray | null;
  while ((m = inlineLink.exec(markdown)) !== null) {
    urls.push(m[2]);
  }
  return [...new Set(urls)];
}

async function headUrl(url: string): Promise<number | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), FETCH_TIMEOUT_MS);
    fetch(url, { method: 'HEAD', redirect: 'follow', headers: { 'User-Agent': 'OzigiAudit/1.0' } })
      .then((r) => { clearTimeout(timer); resolve(r.status); })
      .catch(() => { clearTimeout(timer); resolve(null); });
  });
}

export async function auditLinks(
  draftMarkdown: string,
  sourceBudget: SourceBudgetEntry[]
): Promise<AuditFlag[]> {
  const flags: AuditFlag[] = [];
  const urls = extractLinks(draftMarkdown);
  if (urls.length === 0) return flags;

  const budgetUrls = new Set(sourceBudget.map((e) => e.url));
  const deadBudgetUrls = new Set(
    sourceBudget.filter((e) => e.status === 'dead').map((e) => e.url)
  );

  const checks = await Promise.all(
    urls.map(async (url) => ({ url, status: await headUrl(url) }))
  );

  for (const { url, status } of checks) {
    if (deadBudgetUrls.has(url)) {
      flags.push({
        type: 'dead-link',
        severity: 'error',
        message: `URL was dead at Stage 2 but still appears in draft: ${url}`,
        url,
      });
    } else if (status !== null && status >= 400) {
      const inBudget = budgetUrls.has(url);
      flags.push({
        type: 'dead-link',
        severity: inBudget ? 'warning' : 'error',
        message: `${inBudget ? 'Budget URL now returns' : 'Out-of-budget URL returns'} HTTP ${status}: ${url}`,
        url,
      });
    }
  }

  return flags;
}
