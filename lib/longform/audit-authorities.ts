/**
 * Audit Stage 4e: Authority audit
 * Extracts named people from the draft and verifies each one:
 *  - Appears in the source budget, OR
 *  - Their site (if cited) resolved at Stage 2
 * Failures are flagged as likely hallucinations.
 */

import type { AuditFlag, SourceBudgetEntry } from '@/lib/types/longform';

// Simple heuristic NER: "Firstname Lastname" patterns
const PERSON_NAME_RE = /\b([A-Z][a-z]{1,20})\s+([A-Z][a-z]{1,20})\b/g;

// Words that look like names but aren't
const FALSE_POSITIVE_NAMES = new Set([
  'New York', 'San Francisco', 'Los Angeles', 'United States', 'North America',
  'South America', 'Open Source', 'Machine Learning', 'Deep Learning',
  'Real World', 'Best Practice', 'Case Study', 'Tech Stack',
  'Rest Api', 'Web App', 'Log Out', 'Sign Up', 'Sign In',
]);

function extractPersonNames(text: string): string[] {
  const names = new Set<string>();
  const re = new RegExp(PERSON_NAME_RE.source, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const full = `${m[1]} ${m[2]}`;
    if (!FALSE_POSITIVE_NAMES.has(full)) {
      names.add(full);
    }
  }
  return Array.from(names);
}

function nameAppearsInBudget(name: string, budget: SourceBudgetEntry[]): boolean {
  const lower = name.toLowerCase();
  return budget.some(
    (e) =>
      e.url.toLowerCase().includes(lower.replace(' ', '')) ||
      e.url.toLowerCase().includes(lower.replace(' ', '-')) ||
      e.justification.toLowerCase().includes(lower)
  );
}

function nameHasResolvedSite(name: string, budget: SourceBudgetEntry[]): boolean {
  const slug = name.toLowerCase().replace(/\s+/g, '');
  return budget.some(
    (e) =>
      (e.url.includes(slug) || e.url.includes(name.toLowerCase().replace(' ', '-'))) &&
      (e.status === 'resolved' || e.status === 'redirected')
  );
}

export function auditAuthorities(
  draftMarkdown: string,
  sourceBudget: SourceBudgetEntry[]
): AuditFlag[] {
  const flags: AuditFlag[] = [];
  const names = extractPersonNames(draftMarkdown);

  for (const name of names) {
    const inBudget = nameAppearsInBudget(name, sourceBudget);
    const hasSite = nameHasResolvedSite(name, sourceBudget);

    if (!inBudget && !hasSite) {
      const re = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);
      const match = re.exec(draftMarkdown);
      flags.push({
        type: 'fabricated-authority',
        severity: 'error',
        message: `"${name}" appears as an authority but is not in the source budget — verify this person exists and is relevant`,
        offset: match?.index,
        span_text: name,
      });
    }
  }

  return flags;
}
