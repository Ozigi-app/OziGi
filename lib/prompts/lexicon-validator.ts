/**
 * Lexicon Validator
 * -----------------
 * Programmatic enforcement layer for the Anti-AI rules in ./anti-ai.ts.
 *
 * The prompt rules are advisory — the LLM may comply or it may not. This
 * module runs AFTER generation, scans the output for banned words, phrases,
 * openers, contrast structures, and Gemini-specific structural tells, and
 * returns a typed report. Routes use the report to decide whether to retry
 * with a strict repair directive, surface warnings to the user, or both.
 *
 * Pure functions, no IO, safe to import anywhere.
 */

import {
  BANNED_WORDS,
  BANNED_PHRASES,
  BANNED_OPENERS,
  BANNED_CLOSERS,
  BANNED_REGEX_PATTERNS,
} from './anti-ai';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ViolationKind =
  | 'banned-word'
  | 'banned-phrase'
  | 'banned-opener'
  | 'banned-closer'
  | 'banned-structure'
  | 'banned-contrast'
  | 'banned-cadence';

export interface Violation {
  kind: ViolationKind;
  /** Canonical term that triggered the match (lowercased). */
  term: string;
  /** ~80-char window of source text around the match, for human review. */
  snippet: string;
  /** Optional caller-supplied label, e.g. "linkedin", "section[2]:heading". */
  location?: string;
}

export interface ValidationReport {
  violations: Violation[];
  /**
   * Weighted slop score. 0 = clean. Above ~3 means a retry is warranted.
   * Words/phrases = 1 each. Openers/closers/structure/contrast = 2 each.
   */
  slopScore: number;
  clean: boolean;
}

export interface CampaignShape {
  campaign?: Array<{
    day?: number;
    x?: string;
    linkedin?: string;
    discord?: string;
    slack?: string;
  }>;
  email?: string;
}

export interface LongFormShape {
  title: string;
  subtitle?: string;
  sections: Array<{ heading: string; content: string }>;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const SNIPPET_RADIUS = 36;

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Build a case-insensitive whole-word/whole-phrase regex from a literal term.
 * Apostrophes in the term match either ASCII (') or curly (’) variants.
 * Hyphens match ASCII (-) only — that's the canonical AI form anyway.
 */
function termToRegex(term: string, opts: { wordBounded?: boolean } = {}): RegExp {
  const wordBounded = opts.wordBounded ?? true;
  const escaped = escapeRegExp(term).replace(/'/g, "['’]");
  const body = escaped.replace(/\\\s+/g, '\\s+');
  // Use lookarounds so trailing/leading punctuation is allowed but interior
  // letters don't match (so "delve" doesn't match inside "delivery").
  const left = wordBounded ? '(?<![\\p{L}\\p{N}])' : '';
  const right = wordBounded ? '(?![\\p{L}\\p{N}])' : '';
  return new RegExp(`${left}${body}${right}`, 'giu');
}

/**
 * Strip code blocks, inline code, and URLs from text, replacing them with
 * spaces of equal length so absolute offsets are preserved. The validator
 * only checks user-facing prose — code samples and URLs are exempt.
 */
function stripCodeAndUrls(text: string): string {
  let out = text;
  // ```fenced code blocks```
  out = out.replace(/```[\s\S]*?```/g, (m) => ' '.repeat(m.length));
  // `inline code`
  out = out.replace(/`[^`\n]*`/g, (m) => ' '.repeat(m.length));
  // bare URLs and the URL portion of markdown links: [anchor](url)
  out = out.replace(/\((https?:\/\/[^)\s]+)\)/g, (m) => ' '.repeat(m.length));
  out = out.replace(/https?:\/\/\S+/g, (m) => ' '.repeat(m.length));
  return out;
}

function snippetAt(text: string, idx: number, len: number): string {
  const start = Math.max(0, idx - SNIPPET_RADIUS);
  const end = Math.min(text.length, idx + len + SNIPPET_RADIUS);
  const prefix = start > 0 ? '…' : '';
  const suffix = end < text.length ? '…' : '';
  return prefix + text.slice(start, end).replace(/\s+/g, ' ').trim() + suffix;
}

function weightFor(kind: ViolationKind): number {
  switch (kind) {
    case 'banned-word':
    case 'banned-phrase':
      return 1;
    case 'banned-opener':
    case 'banned-closer':
    case 'banned-structure':
    case 'banned-contrast':
    case 'banned-cadence':
      return 2;
  }
}

// ---------------------------------------------------------------------------
// Compiled matchers (built once per process)
// ---------------------------------------------------------------------------

interface CompiledTerm {
  term: string;
  re: RegExp;
}

const WORD_MATCHERS: CompiledTerm[] = BANNED_WORDS.map((t) => ({
  term: t,
  re: termToRegex(t, { wordBounded: true }),
}));

const PHRASE_MATCHERS: CompiledTerm[] = BANNED_PHRASES.map((t) => ({
  term: t,
  re: termToRegex(t, { wordBounded: true }),
}));

const OPENER_MATCHERS: CompiledTerm[] = BANNED_OPENERS.map((t) => {
  const escaped = escapeRegExp(t).replace(/'/g, "['’]").replace(/\\\s+/g, '\\s+');
  // Anchor at start-of-text, after a sentence-ending punctuation+space, or
  // at the start of a new paragraph.
  return {
    term: t,
    re: new RegExp(`(?:^|(?<=[.!?]\\s)|(?<=\\n\\s*))${escaped}`, 'gi'),
  };
});

const CLOSER_MATCHERS: CompiledTerm[] = BANNED_CLOSERS.map((t) => {
  const escaped = escapeRegExp(t).replace(/'/g, "['’]").replace(/\\\s+/g, '\\s+');
  // Closers fire when they appear in the final ~120 chars of the text.
  return { term: t, re: new RegExp(escaped, 'gi') };
});

// ---------------------------------------------------------------------------
// Public API — text-level
// ---------------------------------------------------------------------------

/**
 * Scan a block of prose for lexicon violations. Code blocks, inline code,
 * and URLs are exempt (the user's complaint is about the human-facing copy).
 */
export function validateText(
  text: string,
  location?: string
): ValidationReport {
  if (!text || typeof text !== 'string') {
    return { violations: [], slopScore: 0, clean: true };
  }

  const cleaned = stripCodeAndUrls(text);
  const violations: Violation[] = [];
  const seen = new Set<string>(); // dedupe per-text by `${kind}:${term}`

  const push = (
    kind: ViolationKind,
    term: string,
    idx: number,
    matchLen: number
  ) => {
    const key = `${kind}:${term.toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    violations.push({
      kind,
      term: term.toLowerCase(),
      snippet: snippetAt(cleaned, idx, matchLen),
      location,
    });
  };

  // 1. words
  for (const { term, re } of WORD_MATCHERS) {
    re.lastIndex = 0;
    const m = re.exec(cleaned);
    if (m) push('banned-word', term, m.index, m[0].length);
  }

  // 2. phrases
  for (const { term, re } of PHRASE_MATCHERS) {
    re.lastIndex = 0;
    const m = re.exec(cleaned);
    if (m) push('banned-phrase', term, m.index, m[0].length);
  }

  // 3. openers
  for (const { term, re } of OPENER_MATCHERS) {
    re.lastIndex = 0;
    const m = re.exec(cleaned);
    if (m) push('banned-opener', term, m.index, m[0].length);
  }

  // 4. closers — only consider matches in final ~140 chars of cleaned text
  if (cleaned.length > 0) {
    const tailStart = Math.max(0, cleaned.length - 140);
    const tail = cleaned.slice(tailStart);
    for (const { term, re } of CLOSER_MATCHERS) {
      re.lastIndex = 0;
      const m = re.exec(tail);
      if (m) push('banned-closer', term, tailStart + m.index, m[0].length);
    }
  }

  // 5. regex patterns (bold-colon, double-hyphen, contrast structures)
  for (const { label, pattern, kind } of BANNED_REGEX_PATTERNS) {
    const re = new RegExp(pattern.source, pattern.flags);
    re.lastIndex = 0;
    const m = re.exec(cleaned);
    if (m) push(kind, label, m.index, m[0].length);
  }

  // 6. cadence: same-word opener three sentences in a row.
  // Split on sentence terminators, take leading word of each non-empty
  // sentence, look for any run of 3+ identical openings.
  const sentences = cleaned
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  if (sentences.length >= 3) {
    let runWord: string | null = null;
    let runCount = 0;
    let runStartIdx = -1;
    for (let i = 0; i < sentences.length; i++) {
      const firstWord = sentences[i].split(/\s+/)[0]?.replace(/[.,!?;:]+$/, '').toLowerCase() ?? '';
      if (firstWord && firstWord === runWord) {
        runCount += 1;
        if (runCount >= 3 && runStartIdx >= 0) {
          push('banned-cadence', `repeated opener "${firstWord}" across 3+ consecutive sentences`, runStartIdx, sentences.slice(i - 2, i + 1).join(' ').length);
          break;
        }
      } else {
        runWord = firstWord;
        runCount = 1;
        runStartIdx = cleaned.indexOf(sentences[i]);
      }
    }
  }

  // 7. multiple em-dashes (rule §1K — "more than once per post")
  const emDashCount = (cleaned.match(/—/g) || []).length;
  if (emDashCount > 1) {
    const idx = cleaned.indexOf('—');
    push('banned-structure', `${emDashCount} em-dashes (max 1 per post)`, idx, 1);
  }

  const slopScore = violations.reduce((s, v) => s + weightFor(v.kind), 0);
  return { violations, slopScore, clean: violations.length === 0 };
}

// ---------------------------------------------------------------------------
// Public API — shape-level wrappers
// ---------------------------------------------------------------------------

export function validateCampaign(campaign: CampaignShape): ValidationReport {
  const all: Violation[] = [];
  let score = 0;

  if (Array.isArray(campaign.campaign)) {
    campaign.campaign.forEach((day, dayIdx) => {
      const dayLabel = `day${day?.day ?? dayIdx + 1}`;
      for (const platform of ['x', 'linkedin', 'discord', 'slack'] as const) {
        const text = (day as any)[platform];
        if (typeof text === 'string' && text.length > 0) {
          const r = validateText(text, `${dayLabel}.${platform}`);
          all.push(...r.violations);
          score += r.slopScore;
        }
      }
    });
  }

  if (typeof campaign.email === 'string' && campaign.email.length > 0) {
    const r = validateText(campaign.email, 'email');
    all.push(...r.violations);
    score += r.slopScore;
  }

  return { violations: all, slopScore: score, clean: all.length === 0 };
}

export function validateLongForm(article: LongFormShape): ValidationReport {
  const all: Violation[] = [];
  let score = 0;

  const titleR = validateText(article.title || '', 'title');
  all.push(...titleR.violations);
  score += titleR.slopScore;

  if (article.subtitle) {
    const r = validateText(article.subtitle, 'subtitle');
    all.push(...r.violations);
    score += r.slopScore;
  }

  if (Array.isArray(article.sections)) {
    article.sections.forEach((section, i) => {
      const headingR = validateText(section.heading || '', `section[${i}].heading`);
      all.push(...headingR.violations);
      score += headingR.slopScore;

      const contentR = validateText(section.content || '', `section[${i}].content`);
      all.push(...contentR.violations);
      score += contentR.slopScore;
    });
  }

  return { violations: all, slopScore: score, clean: all.length === 0 };
}

// ---------------------------------------------------------------------------
// Repair directive — appended to the original prompt on retry
// ---------------------------------------------------------------------------

/**
 * Build a strict revision directive that names the EXACT terms found and
 * forbids them in the retry. The LLM gets the original prompt plus this
 * appended block plus a copy of its own rejected output for context.
 *
 * Design notes:
 *  - We surface up to 25 violations to keep the prompt size bounded.
 *  - We group by kind so the model can scan and react predictably.
 *  - We explicitly say "rewrite from scratch" — paraphrasing a slop
 *    paragraph almost always produces more slop.
 */
export function buildRepairDirective(report: ValidationReport): string {
  if (report.clean) return '';

  const grouped = new Map<ViolationKind, Violation[]>();
  for (const v of report.violations.slice(0, 40)) {
    if (!grouped.has(v.kind)) grouped.set(v.kind, []);
    grouped.get(v.kind)!.push(v);
  }

  const sectionTitle: Record<ViolationKind, string> = {
    'banned-word': 'Banned words used (must not appear in any form)',
    'banned-phrase': 'Banned phrases used',
    'banned-opener': 'Banned sentence/paragraph openers',
    'banned-closer': 'Banned engagement-bait closers',
    'banned-structure': 'Banned structural patterns',
    'banned-contrast': 'Banned contrast structures',
    'banned-cadence': 'Banned cadence patterns',
  };

  const blocks: string[] = [];
  for (const [kind, list] of grouped) {
    const lines = list
      .slice(0, 10)
      .map((v) => `  - "${v.term}"${v.location ? ` [in ${v.location}]` : ''}: …${v.snippet}…`);
    blocks.push(`### ${sectionTitle[kind]}\n${lines.join('\n')}`);
  }

  return `
=====================================================================
URGENT REVISION REQUEST — PREVIOUS OUTPUT FAILED THE STYLISTIC CONSTRAINT SYSTEM
=====================================================================

Your previous response contained ${report.violations.length} violation${
    report.violations.length === 1 ? '' : 's'
  } of the Banned Lexicon (slop score: ${report.slopScore}). The user has
explicitly complained about AI slop. This is a critical failure.

Rewrite the response from scratch. Do NOT paraphrase the previous output
sentence-by-sentence — that produces more slop. Read the source context
again and write completely new copy.

The following EXACT terms appeared and are now strictly forbidden — they
must not appear in any form (lowercase, uppercase, conjugated, plural,
or as part of a larger phrase):

${blocks.join('\n\n')}

Additional non-negotiables for this retry:
  - Zero adverb-comma openers ("Ultimately,", "Crucially,", "Notably,", etc.)
  - Zero "Here is/are" / "Let's [verb]" / "Certainly" / "Absolutely" openers
  - Zero bold-colon paragraph prefixes ("**Term:** explanation")
  - Zero "It's not X, it's Y" / "Less X, more Y" / "Forget X. Think Y" structures
  - Zero "What do you think?" / "Thoughts?" / "Drop a comment" closers
  - Maximum one em-dash per post; never use double hyphens (--)
  - Every post must contain at least one specific number, named tool,
    or concrete decision drawn from the source context

Return the SAME output schema as the original request. JSON only, no commentary.
`.trim();
}

// ---------------------------------------------------------------------------
// Compact summary for client-facing warnings
// ---------------------------------------------------------------------------

export interface LexiconWarning {
  count: number;
  slopScore: number;
  topTerms: string[];      // most-impactful violations, deduped
  byLocation: Record<string, number>;
}

export function summarizeForClient(report: ValidationReport): LexiconWarning | null {
  if (report.clean) return null;
  const topTerms = Array.from(
    new Set(report.violations.slice(0, 12).map((v) => v.term))
  );
  const byLocation: Record<string, number> = {};
  for (const v of report.violations) {
    const loc = v.location ?? 'unknown';
    byLocation[loc] = (byLocation[loc] ?? 0) + 1;
  }
  return {
    count: report.violations.length,
    slopScore: report.slopScore,
    topTerms,
    byLocation,
  };
}
