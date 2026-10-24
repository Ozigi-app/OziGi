/**
 * Audit Stage 4e: Authority audit
 * Extracts named people the draft cites AS AUTHORITIES and verifies each one:
 *  - Appears in the source budget, OR
 *  - Their site (if cited) resolved at Stage 2
 * Failures are flagged as likely hallucinations.
 *
 * A "name" is only treated as an authority when the prose attributes something to
 * it ("according to Jane Smith", "Kent Beck, creator of ...", "Martin Fowler argues").
 * Two capitalised words on their own are not enough: "Sustainable Cadence" or
 * "Audit Recent" are headings and phrases, and flagging them buried the real findings.
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

const ROLE = '(?:founder|co-founder|creator|author|ceo|cto|cfo|coo|vp|professor|prof\\.?|dr\\.?|engineer|researcher|maintainer|architect|economist|analyst)';
const VERB = '(?:said|says|wrote|writes|argues|argued|notes|noted|explains|explained|coined|popularized|popularised|found|finds|showed|shows|calls|called|described|describes|recommends|recommended|suggests|suggested|observed|observes|claims|claimed|reported|reports)';

// Text immediately BEFORE the name that presents it as a source.
const CUE_BEFORE = new RegExp(
  `(?:according to|as (?:said|noted|argued|put|described|explained) by|(?:cited|quoted|credited|reported|written|published|popularized|popularised|coined) by|per|via|${ROLE}\\s+(?:of\\s+\\S+\\s+)?|\\b${VERB})\\s*$`,
  'i'
);

// Text immediately AFTER the name that presents it as a source.
const CUE_AFTER = new RegExp(
  `^(?:['’]s\\b|,\\s*(?:the\\s+|a\\s+|an\\s+)?(?:\\w+\\s+)?${ROLE}\\b|\\s+${VERB}\\b|\\s+\\()`,
  'i'
);

/** Drop code, headings, links' URLs and quoted code so only prose is scanned. */
function proseOnly(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`\n]*`/g, ' ')
    .replace(/^\s{0,3}#{1,6}\s.*$/gm, ' ')
    .replace(/\]\((?:[^)\s]+)\)/g, ']')
    .replace(/https?:\/\/\S+/g, ' ');
}

function extractPersonNames(text: string): string[] {
  const prose = proseOnly(text);
  const names = new Set<string>();
  const re = new RegExp(PERSON_NAME_RE.source, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(prose)) !== null) {
    const full = `${m[1]} ${m[2]}`;
    if (FALSE_POSITIVE_NAMES.has(full)) continue;

    const before = prose.slice(Math.max(0, m.index - 40), m.index);
    const after = prose.slice(m.index + m[0].length, m.index + m[0].length + 40);
    if (CUE_BEFORE.test(before) || CUE_AFTER.test(after)) {
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
