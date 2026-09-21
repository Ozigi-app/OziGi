/**
 * AI Slop Checker — detection & scoring engine
 * --------------------------------------------
 * Powers the public /slop-checker page. This is `lib/prompts/lexicon-validator.ts`
 * pointed at arbitrary pasted text instead of Ozigi's own generation output,
 * with three differences that matter:
 *
 *   1. It reports EVERY occurrence with character offsets, not the first hit
 *      per term — the page highlights spans inline, and a density score needs
 *      repeats to count.
 *   2. It weights hits (word 1 / phrase 2 / structural 3) and divides by word
 *      count, so the output is a rate rather than a raw violation count.
 *   3. It applies a per-context multiplier — the same buzzword costs more in a
 *      cold email than in a blog post.
 *
 * Both files read the same lists from `lib/prompts/banned-lexicon.ts`, so the
 * checker and the internal validator can't drift apart.
 *
 * Runs entirely in the browser. Pure functions, no IO, no imports that touch
 * the server — pasted text never leaves the page, which is what the copy on
 * /slop-checker promises.
 */

import {
  BANNED_WORDS,
  BANNED_PHRASES,
  BANNED_OPENERS,
  BANNED_CLOSERS,
  BANNED_REGEX_PATTERNS,
  termPatternBody,
} from '../prompts/banned-lexicon';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type HitCategory = 'buzzword' | 'cliche' | 'structural';

export interface Hit {
  /** Character offset into the ORIGINAL text (not the masked copy). */
  start: number;
  end: number;
  /** The matched substring, as the user typed it. */
  text: string;
  category: HitCategory;
  weight: number;
  /** Human-facing explanation, shown on hover/tap over the highlight. */
  reason: string;
}

export type Context = 'general' | 'email' | 'linkedin' | 'newsletter' | 'blog';

export type Band = 'reads-human' | 'some-tells' | 'sounds-ai' | 'heavy-slop';

export interface Breakdown {
  buzzwords: number;
  cliches: number;
  structural: number;
}

export interface SlopReport {
  totalWords: number;
  /** 0 (heavy slop) – 100 (reads human). */
  humanScore: number;
  band: Band;
  bandLabel: string;
  /** One-line plain-English read on the score. */
  verdict: string;
  /** Sum of hit weights. */
  penalty: number;
  /** Weighted penalty per 100 words, context-adjusted. */
  density: number;
  hits: Hit[];
  breakdown: Breakdown;
}

// ---------------------------------------------------------------------------
// Checker-only additions
// ---------------------------------------------------------------------------

/**
 * Terms the public checker flags that the internal validator doesn't.
 *
 * The production lexicon is tuned for Ozigi's own output, where the prompt has
 * already been told to avoid this vocabulary — it doesn't need to catch every
 * generic word a stranger might paste in. These are the widely-documented AI
 * tells (the public "60+ AI words to avoid" set) that weren't already covered.
 * Kept separate so the production lists stay the production lists.
 */
export const CHECKER_EXTRA_WORDS: readonly string[] = [
  'leverage', 'leveraging', 'leverages', 'landscape', 'sphere', 'arena',
  'unlock', 'unlocking', 'unlocks', 'myriad', 'plethora', 'boast', 'boasting',
  'holistic', 'synergistic', 'bustling', 'nestled', 'whimsical', 'indelible',
  'resonate', 'resonates', 'resonating', 'underscoring', 'showcase',
  'showcased', 'illuminate', 'illuminating', 'unravel', 'unraveling',
  'unveil', 'unveiling', 'unparalleled', 'unwavering', 'tireless',
  'tirelessly', 'embark', 'embarking', 'ecosystem', 'aforementioned',
  'indispensable', 'invaluable', 'vital', 'comprehensive', 'foster',
  'navigate', 'revolutionize', 'revolutionizing', 'elevated',
];

export const CHECKER_EXTRA_PHRASES: readonly string[] = [
  'navigate the complexities of', 'gain valuable insights',
  'gain a deeper understanding', "in today's competitive landscape",
  'unlock the power of', 'unlock the full potential', 'in conclusion',
  'to sum up', 'in summary', 'a testament to', 'stand the test of time',
  'leave no stone unturned', 'push the boundaries of', 'raise the bar',
  'unlock new possibilities', 'the tip of the iceberg', 'opens the door to',
  'plays a pivotal role', 'serves as a testament', 'on the same page',
  'seamlessly integrate', 'ahead of the curve', 'dive deep into',
  "let's delve into", "let's dive into",
];

/**
 * Structural patterns the checker adds on top of BANNED_REGEX_PATTERNS.
 *
 * The production contrast regexes are deliberately tight — they run against
 * Ozigi's own output, where a false positive costs a wasted regeneration. They
 * cap the first clause at three words, so the canonical form the page's copy
 * leads with ("It's not just about working harder, it's about working
 * smarter") slips through. These are the looser variants, checker-only.
 */
const CHECKER_EXTRA_PATTERNS: { label: string; pattern: RegExp }[] = [
  {
    label: 'contrast: "It\'s not (just) X, it\'s Y"',
    pattern: /\bit'?s\s+not\s+(?:just\s+|only\s+|merely\s+|simply\s+)?[^.!?]{2,70}[,.]\s*it'?s\b/gi,
  },
  {
    label: 'contrast: "not only X but also Y"',
    pattern: /\bnot\s+only\b[^.!?]{2,80}\bbut\s+(?:also\s+)?/gi,
  },
  {
    label: 'contrast: "X is not about Y, it\'s about Z"',
    pattern: /\b(?:is|are|was|were)\s+not\s+about\s+[^.!?]{2,60}[,.]\s*it'?s\s+about\b/gi,
  },
];

const ALL_PATTERNS: { label: string; pattern: RegExp }[] = [
  ...BANNED_REGEX_PATTERNS.map(({ label, pattern }) => ({ label, pattern })),
  ...CHECKER_EXTRA_PATTERNS,
];

function dedupeTerms(terms: readonly string[]): string[] {
  return Array.from(new Set(terms.map((t) => t.toLowerCase())));
}

const WORD_LIST: string[] = dedupeTerms([...BANNED_WORDS, ...CHECKER_EXTRA_WORDS]);
const PHRASE_LIST: string[] = dedupeTerms([...BANNED_PHRASES, ...CHECKER_EXTRA_PHRASES]);

// ---------------------------------------------------------------------------
// Matching helpers — mirror lexicon-validator.ts so both agree on what counts
// ---------------------------------------------------------------------------

/**
 * Case-insensitive whole-word/whole-phrase matcher built from a literal term.
 * Apostrophes match ASCII (') or curly, and a separator in the term matches any
 * separator in the text, so "game-changer" also catches "game changer".
 * Lookarounds (rather than \b) mean trailing punctuation is fine but interior
 * letters aren't — "delve" must not fire inside "delved" unless "delved" is
 * itself listed.
 */
function termToRegex(term: string): RegExp {
  const body = termPatternBody(term);
  return new RegExp(`(?<![\\p{L}\\p{N}])${body}(?![\\p{L}\\p{N}])`, 'giu');
}

/**
 * Replace code fences, inline code, URLs, and email addresses with spaces of
 * identical length. Same exemption the internal validator applies — nobody's
 * prose is worse because a package name in a code sample contains a banned
 * word — and equal-length substitution keeps every offset valid against the
 * original string.
 */
function maskExemptRegions(text: string): string {
  const blank = (m: string) => ' '.repeat(m.length);
  return text
    .replace(/```[\s\S]*?```/g, blank)
    .replace(/`[^`\n]*`/g, blank)
    .replace(/\(https?:\/\/[^)\s]+\)/g, blank)
    .replace(/https?:\/\/\S+/g, blank)
    .replace(/\S+@\S+\.\S+/g, blank);
}

export function countWords(text: string): number {
  return (text.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) || []).length;
}

const WORD_MATCHERS = WORD_LIST.map((term) => ({ term, re: termToRegex(term) }));
const PHRASE_MATCHERS = PHRASE_LIST.map((term) => ({ term, re: termToRegex(term) }));

const OPENER_MATCHERS = BANNED_OPENERS.map((term) => {
  const body = termPatternBody(term);
  // Start of text, after sentence-ending punctuation, or at a new paragraph.
  return { term, re: new RegExp(`(?:^|(?<=[.!?]\\s)|(?<=\\n[ \\t]*))${body}`, 'gi') };
});

const CLOSER_MATCHERS = BANNED_CLOSERS.map((term) => ({
  term,
  re: new RegExp(termPatternBody(term), 'gi'),
}));

// ---------------------------------------------------------------------------
// Detectors
// ---------------------------------------------------------------------------

function quote(s: string): string {
  const trimmed = s.trim().replace(/\s+/g, ' ');
  return trimmed.length > 42 ? `${trimmed.slice(0, 40)}…` : trimmed;
}

/** Guards against a zero-length match parking the regex on one index. */
function advance(re: RegExp, m: RegExpExecArray) {
  if (m[0].length === 0) re.lastIndex += 1;
}

function collect(
  masked: string,
  original: string,
  matchers: { re: RegExp }[],
  build: (text: string) => Omit<Hit, 'start' | 'end' | 'text'>
): Hit[] {
  const hits: Hit[] = [];
  for (const { re } of matchers) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(masked))) {
      const text = original.slice(m.index, m.index + m[0].length);
      hits.push({ start: m.index, end: m.index + m[0].length, text, ...build(text) });
      advance(re, m);
    }
  }
  return hits;
}

function findWordHits(masked: string, original: string): Hit[] {
  return collect(masked, original, WORD_MATCHERS, (text) => ({
    category: 'buzzword',
    weight: 1,
    reason: `“${quote(
      text
    )}” — generic AI-vocabulary word. It sounds like it is doing work, but a reader cannot picture anything more specific after reading it.`,
  }));
}

function findPhraseHits(masked: string, original: string): Hit[] {
  return collect(masked, original, PHRASE_MATCHERS, (text) => ({
    category: 'cliche',
    weight: 2,
    reason: `“${quote(
      text
    )}” — formulaic filler phrase. It shows up constantly in AI drafts and almost never in something a person typed and then reread.`,
  }));
}

function findOpenerHits(masked: string, original: string): Hit[] {
  return collect(masked, original, OPENER_MATCHERS, (text) => ({
    category: 'structural',
    weight: 3,
    reason: `“${quote(
      text
    )}” — essay-transition opener. Language models reach for these to start a paragraph; people usually just start the sentence.`,
  }));
}

function findCloserHits(masked: string, original: string): Hit[] {
  if (masked.length === 0) return [];
  // Closers only count when they land at the end — "thoughts?" mid-paragraph
  // is a real question, not engagement bait.
  const tailStart = Math.max(0, masked.trimEnd().length - 160);
  const tail = masked.slice(tailStart);
  return collect(tail, original.slice(tailStart), CLOSER_MATCHERS, (text) => ({
    category: 'cliche',
    weight: 2,
    reason: `“${quote(
      text
    )}” — engagement-bait sign-off. It asks for a reaction instead of ending on something worth reacting to.`,
  })).map((h) => ({ ...h, start: h.start + tailStart, end: h.end + tailStart }));
}

function patternReason(label: string, text: string): string {
  if (label.startsWith('contrast')) {
    return `“${quote(
      text
    )}” — contrast framing. A sentence built out of "not X, but Y" reads as AI even with zero buzzwords in it, which is why structural hits cost three times a single flagged word.`;
  }
  if (label.startsWith('bold-colon')) {
    return `“${quote(
      text
    )}” — bold-label list formatting. This is the default ChatGPT/Claude listicle shape and the fastest thing for a reader to clock.`;
  }
  if (label.startsWith('double-hyphen')) {
    return `“${quote(
      text
    )}” — a double hyphen standing in for an em-dash. Common in model output, rare in text someone typed.`;
  }
  return `“${quote(text)}” — ${label}.`;
}

function findPatternHits(masked: string, original: string): Hit[] {
  const hits: Hit[] = [];
  for (const { label, pattern } of ALL_PATTERNS) {
    const flags = pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`;
    const re = new RegExp(pattern.source, flags);
    let m: RegExpExecArray | null;
    while ((m = re.exec(masked))) {
      const text = original.slice(m.index, m.index + m[0].length);
      hits.push({
        start: m.index,
        end: m.index + m[0].length,
        text,
        category: 'structural',
        weight: 3,
        reason: patternReason(label, text),
      });
      advance(re, m);
    }
  }
  return hits;
}

/** Em-dash tic. One per ~200 words is normal prose; past that it is a pattern. */
function findEmDashHits(masked: string, original: string, totalWords: number): Hit[] {
  const baseline = Math.max(1, Math.floor(totalWords / 200));
  const re = /—/g;
  const matches: RegExpExecArray[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(masked))) matches.push(m);
  return matches.slice(baseline).map((dm, i) => ({
    start: dm.index,
    end: dm.index + dm[0].length,
    text: original.slice(dm.index, dm.index + dm[0].length),
    category: 'structural' as const,
    weight: 3,
    reason: `Em-dash number ${baseline + i + 1} in ${totalWords} words. One or two reads as style; this many reads as a tic — models lean hard on the em-dash once they have used it once.`,
  }));
}

/** Three sentences in a row opening on the same word. */
function findCadenceHits(masked: string, original: string): Hit[] {
  const hits: Hit[] = [];
  const sentenceRe = /[^.!?\n]+[.!?]*/g;
  let m: RegExpExecArray | null;
  let runWord: string | null = null;
  let runCount = 0;

  while ((m = sentenceRe.exec(masked))) {
    const raw = m[0];
    if (raw.trim().length === 0) continue;
    const offset = m.index + (raw.length - raw.trimStart().length);
    const firstToken = raw.trim().split(/\s+/)[0] || '';
    const word = firstToken.replace(/[^\p{L}\p{N}'’-]/gu, '').toLowerCase();
    if (!word) {
      runWord = null;
      runCount = 0;
      continue;
    }
    if (word === runWord) {
      runCount += 1;
      if (runCount >= 3) {
        // Anchor the highlight on the third opener only, so one cadence flag
        // does not swallow every word hit inside three sentences of text.
        hits.push({
          start: offset,
          end: offset + firstToken.length,
          text: original.slice(offset, offset + firstToken.length),
          category: 'structural',
          weight: 3,
          reason: `Third sentence in a row opening on “${word}”. Repeated sentence openings are a rhythm tell — human drafts vary the entry point without trying.`,
        });
        runWord = null;
        runCount = 0;
      }
    } else {
      runWord = word;
      runCount = 1;
    }
  }
  return hits;
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

/** Overlapping spans collapse to the longest one so nothing double-counts. */
function dedupe(hits: Hit[]): Hit[] {
  const sorted = [...hits].sort(
    (a, b) => a.start - b.start || b.end - b.start - (a.end - a.start)
  );
  const out: Hit[] = [];
  let lastEnd = -1;
  for (const h of sorted) {
    if (h.start >= lastEnd) {
      out.push(h);
      lastEnd = h.end;
    }
  }
  return out;
}

/**
 * The same phrase costs more where the reader has less patience. A cold email
 * or a LinkedIn DM gets three seconds and one whiff of template kills it; a
 * blog post is read by someone who already chose to be there.
 */
export const CONTEXT_MULTIPLIER: Record<Context, number> = {
  general: 1,
  email: 1.3,
  linkedin: 1.3,
  newsletter: 1.1,
  blog: 0.85,
};

/** Where "Fix this in Ozigi" sends people, per context. */
export const CONTEXT_CTA: Record<Context, { href: string; label: string }> = {
  general: { href: '/long-form', label: 'article generator' },
  email: { href: '/email-outreach', label: 'cold email generator' },
  linkedin: { href: '/linkedin-outreach', label: 'LinkedIn generator' },
  newsletter: { href: '/newsletter', label: 'newsletter generator' },
  blog: { href: '/long-form', label: 'article generator' },
};

export const CONTEXT_OPTIONS: { value: Context; label: string }[] = [
  { value: 'general', label: 'General' },
  { value: 'email', label: 'Cold email' },
  { value: 'linkedin', label: 'LinkedIn post' },
  { value: 'newsletter', label: 'Newsletter' },
  { value: 'blog', label: 'Blog post' },
];

/** Below this the sample is too short for a density score to mean much. */
export const MIN_WORDS = 40;

/**
 * Converts density into a 0–100 score. Calibrated against reference samples so
 * that clean, specific writing lands 90+, ordinary marketing copy with a few
 * tells lands in the 55–79 band, and text assembled entirely out of stock
 * phrases bottoms out under 30. Retune here if the lexicon grows and scores
 * drift — the score bands themselves are load-bearing copy.
 */
const SCORE_MULTIPLIER = 7;

function bandFor(score: number): { band: Band; bandLabel: string; verdict: string } {
  if (score >= 80)
    return {
      band: 'reads-human',
      bandLabel: 'Reads human',
      verdict: 'Barely any of the usual tells. This reads like someone actually wrote it.',
    };
  if (score >= 55)
    return {
      band: 'some-tells',
      bandLabel: 'Some AI tells',
      verdict: 'Mostly fine, but a few phrases give it away. Worth a pass.',
    };
  if (score >= 30)
    return {
      band: 'sounds-ai',
      bandLabel: 'Sounds AI-generated',
      verdict: 'This reads like a first draft from a language model, not a final one.',
    };
  return {
    band: 'heavy-slop',
    bandLabel: 'Heavy AI slop',
    verdict: 'This is textbook AI output. A reader would clock it in the first sentence.',
  };
}

export function analyze(text: string, context: Context = 'general'): SlopReport {
  const source = typeof text === 'string' ? text : '';
  const masked = maskExemptRegions(source);
  const totalWords = countWords(masked);

  const hits = dedupe([
    ...findWordHits(masked, source),
    ...findPhraseHits(masked, source),
    ...findOpenerHits(masked, source),
    ...findCloserHits(masked, source),
    ...findPatternHits(masked, source),
    ...findEmDashHits(masked, source, totalWords),
    ...findCadenceHits(masked, source),
  ]);

  const penalty = hits.reduce((sum, h) => sum + h.weight, 0);
  const density =
    totalWords > 0 ? ((penalty * 100) / totalWords) * CONTEXT_MULTIPLIER[context] : 0;
  const humanScore = Math.max(
    0,
    Math.min(100, Math.round(100 - density * SCORE_MULTIPLIER))
  );

  return {
    totalWords,
    humanScore,
    penalty,
    density,
    hits,
    breakdown: {
      buzzwords: hits.filter((h) => h.category === 'buzzword').length,
      cliches: hits.filter((h) => h.category === 'cliche').length,
      structural: hits.filter((h) => h.category === 'structural').length,
    },
    ...bandFor(humanScore),
  };
}

/**
 * Splits text into render-ready runs — plain and flagged — so a component can
 * map over them without doing offset arithmetic itself.
 */
export interface Segment {
  text: string;
  hit?: Hit;
}

export function toSegments(text: string, hits: Hit[]): Segment[] {
  const ordered = [...hits].sort((a, b) => a.start - b.start);
  const segments: Segment[] = [];
  let cursor = 0;
  for (const hit of ordered) {
    if (hit.start > cursor) segments.push({ text: text.slice(cursor, hit.start) });
    segments.push({ text: text.slice(hit.start, hit.end), hit });
    cursor = hit.end;
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor) });
  return segments;
}
