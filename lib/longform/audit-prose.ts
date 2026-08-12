/**
 * Audit Stage 4d: Prose pattern audit
 * -----------------------------------
 * Structural AI-cadence detection. This is the counterpart to the word-level
 * bans in lib/prompts/anti-ai.ts: a model dodges a banned word list by reaching
 * for a synonym, but it cannot synonym its way out of writing thirty paragraphs
 * of identical length, opening four sentences in a row with "You", or restating
 * every heading in its own closing line.
 *
 * All detectors are pure JS and run on masked prose (code fences and link
 * targets blanked out, offsets preserved) so `runFastAudit` stays under its
 * ~100ms budget and code samples never pollute prose statistics.
 *
 * Detectors:
 *   D1  list-of-three density              D9   repeated sentence openers
 *   D2  "not X, but Y" contrast framing     D10  sentence-length uniformity
 *   D3  paragraph-length uniformity         D11  repeated distinctive words
 *   D4  heading-restating section closers    D12  repeated thematic points
 *   D5  em-dash density                     D13  narrated code
 *   D6  rhetorical-question transitions      D14  meta-references / recaps
 *   D7  passive-voice habit                 D15  formatting tells
 *   D8  hedging density                     D16  marketing tells
 *                                           D17  contraction-free prose
 */

import type { AuditFlag, ProseAuditScore } from '@/lib/types/longform';

export interface ProseAuditOptions {
  /**
   * Whether the requested tone implies contractions. The `professional` tone
   * explicitly bans them, so D17 only runs for tones that expect them.
   */
  expectContractions?: boolean;
}

// ---------------------------------------------------------------------------
// Masking — blank out non-prose spans while preserving byte offsets
// ---------------------------------------------------------------------------

/** Replace every non-newline character in `slice` with a space. */
function blank(slice: string): string {
  return slice.replace(/[^\n]/g, ' ');
}

/**
 * Blank out fenced code content and markdown link targets so prose detectors
 * never read them. Offsets into the result stay valid against the original
 * markdown, which is what AuditFlag.offset points at.
 */
function maskNonProse(markdown: string): string {
  let out = markdown;

  // Fenced code blocks: keep the ``` delimiters, blank the body.
  out = out.replace(/(```[^\n]*\n)([\s\S]*?)(```)/g, (_m, open, body, close) => {
    return open + blank(body) + close;
  });

  // Markdown link targets: keep [anchor text], blank the (url).
  out = out.replace(/\]\(([^)\n]*)\)/g, (_m, url) => `](${blank(url)})`);

  return out;
}

/** Strip inline-code spans from a string (used for word-frequency work only). */
function stripInlineCode(text: string): string {
  return text.replace(/`[^`\n]*`/g, ' ');
}

// ---------------------------------------------------------------------------
// Segmentation
// ---------------------------------------------------------------------------

interface Span {
  text: string;
  offset: number;
}

const ABBREVIATIONS = new Set([
  'e.g', 'i.e', 'etc', 'vs', 'cf', 'al', 'approx', 'dr', 'mr', 'mrs', 'ms',
  'st', 'fig', 'no', 'inc', 'ltd', 'co', 'jr', 'sr',
]);

/** Split into sentences, keeping each sentence's offset in the source string. */
function splitSentences(text: string, baseOffset = 0): Span[] {
  const spans: Span[] = [];
  const re = /[.!?]+["')\]]?\s+/g;
  let start = 0;
  let m: RegExpExecArray | null;

  while ((m = re.exec(text)) !== null) {
    const end = m.index + m[0].length;
    const candidate = text.slice(start, end);

    // Don't split on a known abbreviation ("e.g. ") or a decimal ("3. 5" won't
    // occur, but "v1. " after a version might).
    const lastWord = candidate.trimEnd().replace(/[.!?"')\]]+$/, '').split(/[\s(]/).pop() ?? '';
    if (ABBREVIATIONS.has(lastWord.toLowerCase())) continue;

    if (candidate.trim().length > 0) {
      spans.push({ text: candidate.trim(), offset: baseOffset + start });
    }
    start = end;
  }

  const tail = text.slice(start);
  if (tail.trim().length > 0) {
    spans.push({ text: tail.trim(), offset: baseOffset + start });
  }
  return spans;
}

/** Split into paragraphs (offsets preserved), dropping headings and blank runs. */
function splitParagraphs(text: string, opts: { includeHeadings?: boolean } = {}): Span[] {
  const spans: Span[] = [];
  const parts = text.split(/(\n{2,})/);
  let cursor = 0;
  for (const part of parts) {
    if (!/^\n+$/.test(part)) {
      const trimmed = part.trim();
      const isHeading = trimmed.startsWith('#');
      const isFence = trimmed.startsWith('```');
      if (trimmed.length > 0 && (opts.includeHeadings || (!isHeading && !isFence))) {
        const lead = part.length - part.trimStart().length;
        spans.push({ text: trimmed, offset: cursor + lead });
      }
    }
    cursor += part.length;
  }
  return spans;
}

interface Section {
  heading: string;
  body: string;
  offset: number;
}

function parseSections(markdown: string): Section[] {
  const sections: Section[] = [];
  const lines = markdown.split('\n');
  let current: Section | null = null;
  let cursor = 0;
  for (const line of lines) {
    const hMatch = /^#{1,3}\s+(.+)$/.exec(line);
    if (hMatch) {
      if (current) sections.push(current);
      current = { heading: hMatch[1].trim(), body: '', offset: cursor + line.length + 1 };
    } else if (current) {
      current.body += line + '\n';
    }
    cursor += line.length + 1;
  }
  if (current) sections.push(current);
  return sections;
}

function wordCountOf(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

/** ~80-char window around an offset, for the reviewer to eyeball. */
function snippetAt(source: string, offset: number, length = 0): string {
  const start = Math.max(0, offset - 10);
  const end = Math.min(source.length, offset + Math.max(length, 70));
  return source.slice(start, end).replace(/\s+/g, ' ').trim();
}

// ---------------------------------------------------------------------------
// D1-D4 — original detectors (unchanged behaviour, now on masked prose)
// ---------------------------------------------------------------------------

function countListsOfThree(text: string): number {
  const sentences = text.split(/(?<=[.!?])\s+/);
  let count = 0;
  for (const s of sentences) {
    const items = s.match(/,\s+[^,]+/g);
    if (items && items.length >= 2) count++;
  }
  return count;
}

const NOT_X_BUT_Y_RE = /\b(?:not\s+just|it'?s?\s+not|rather\s+than)\s+\w[\w\s]*,?\s+but\s+\w/gi;

function countNotXButY(text: string): number {
  const matches = text.match(NOT_X_BUT_Y_RE);
  return matches ? matches.length : 0;
}

function paragraphLengthCV(paragraphs: Span[]): number {
  const bodies = paragraphs.filter((p) => p.text.length > 40);
  if (bodies.length < 3) return 1;
  const wordCounts = bodies.map((p) => wordCountOf(p.text));
  const mean = wordCounts.reduce((a, b) => a + b, 0) / wordCounts.length;
  const variance =
    wordCounts.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / wordCounts.length;
  const stdDev = Math.sqrt(variance);
  return mean > 0 ? stdDev / mean : 1;
}

function sectionCloserFlags(sections: Section[]): number {
  let count = 0;
  for (const { heading, body } of sections) {
    const paragraphs = body.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
    const last = paragraphs[paragraphs.length - 1];
    if (!last) continue;
    const headingWords = heading.toLowerCase().split(/\W+/).filter((w) => w.length > 4);
    const lastSentence = last.split(/(?<=[.!?])\s+/).pop() || '';
    const matches = headingWords.filter((w) => lastSentence.toLowerCase().includes(w));
    if (matches.length >= 2) count++;
  }
  return count;
}

// ---------------------------------------------------------------------------
// D5 — em-dash density
// ---------------------------------------------------------------------------

function countEmDashes(text: string): number {
  return (text.match(/[—–]/g) || []).length;
}

// ---------------------------------------------------------------------------
// D6 — rhetorical questions used as transitions
// ---------------------------------------------------------------------------

/**
 * Only counts the transition use: a question that opens the first paragraph of
 * a section, or a paragraph that is nothing but a question. A question followed
 * by its answer inside a body paragraph is legitimate and is not counted.
 */
function findRhetoricalTransitions(sections: Section[]): Span[] {
  const hits: Span[] = [];
  for (const section of sections) {
    const paragraphs = splitParagraphs(section.body);
    paragraphs.forEach((p, idx) => {
      const sentences = splitSentences(p.text);
      const first = sentences[0];
      if (!first) return;
      const isQuestion = first.text.trimEnd().endsWith('?');
      if (!isQuestion) return;
      const isSectionOpener = idx === 0;
      const isStandalone = sentences.length === 1;
      if (isSectionOpener || isStandalone) {
        hits.push({ text: first.text, offset: section.offset + p.offset });
      }
    });
  }
  return hits;
}

// ---------------------------------------------------------------------------
// D7 — passive voice
// ---------------------------------------------------------------------------

const PASSIVE_RE =
  /\b(?:is|are|was|were|be|been|being|gets?|got)\s+(?:\w+ly\s+)?(?:\w+ed|written|shown|made|done|given|taken|seen|known|built|found|held|sent|kept|left|put|run|thrown|drawn|chosen|driven|hidden|broken|spoken|proven)\b/i;

function passiveRatio(sentences: Span[]): { ratio: number; examples: Span[] } {
  if (sentences.length === 0) return { ratio: 0, examples: [] };
  const examples: Span[] = [];
  for (const s of sentences) {
    if (PASSIVE_RE.test(s.text)) examples.push(s);
  }
  return { ratio: examples.length / sentences.length, examples };
}

// ---------------------------------------------------------------------------
// D8 — hedging
// ---------------------------------------------------------------------------

const HEDGE_RE =
  /\b(?:it seems like|it seems that|it might be the case|it may be the case|arguably|in some sense|somewhat|to some extent|you may want to consider|you might want to consider|could potentially|may potentially|relatively speaking|more or less|fairly straightforward)\b/gi;

// ---------------------------------------------------------------------------
// D9 — repeated sentence openers
// ---------------------------------------------------------------------------

function findRepeatedOpeners(paragraphs: Span[]): Array<Span & { word: string; run: number }> {
  const hits: Array<Span & { word: string; run: number }> = [];
  for (const p of paragraphs) {
    const sentences = splitSentences(p.text, p.offset);
    let runWord = '';
    let runStart = 0;
    let runLength = 0;
    for (let i = 0; i <= sentences.length; i++) {
      const word =
        i < sentences.length
          ? (sentences[i].text.match(/^[A-Za-z']+/)?.[0] ?? '').toLowerCase()
          : '';
      if (word && word === runWord) {
        runLength++;
      } else {
        if (runLength >= 3 && runWord.length >= 2) {
          hits.push({
            text: runWord,
            word: runWord,
            run: runLength,
            offset: sentences[runStart].offset,
          });
        }
        runWord = word;
        runStart = i;
        runLength = 1;
      }
    }
  }
  return hits;
}

// ---------------------------------------------------------------------------
// D10 — sentence-length uniformity
// ---------------------------------------------------------------------------

/**
 * Runs of 4+ consecutive sentences all within +/-30% of the run mean.
 * Keeps a running sum rather than re-slicing the window on every extension,
 * so cost stays linear in sentence count on long drafts.
 */
function findUniformSentenceRuns(sentences: Span[]): Span[] {
  const hits: Span[] = [];
  const counts = sentences.map((s) => wordCountOf(s.text));
  let i = 0;
  while (i < counts.length) {
    let j = i + 1;
    let sum = counts[i];
    let min = counts[i];
    let max = counts[i];
    while (j < counts.length) {
      const nextSum = sum + counts[j];
      const nextMin = Math.min(min, counts[j]);
      const nextMax = Math.max(max, counts[j]);
      const mean = nextSum / (j - i + 1);
      if (mean < 5) break;
      // The band holds for the whole window iff it holds for its extremes.
      if ((mean - nextMin) / mean > 0.3 || (nextMax - mean) / mean > 0.3) break;
      sum = nextSum;
      min = nextMin;
      max = nextMax;
      j++;
    }
    const runLength = j - i;
    if (runLength >= 4) {
      hits.push({ text: `${runLength} sentences`, offset: sentences[i].offset });
      i = j;
    } else {
      i++;
    }
  }
  return hits;
}

// ---------------------------------------------------------------------------
// D11 — repeated distinctive words
// ---------------------------------------------------------------------------

const STOPWORDS = new Set([
  'about', 'above', 'after', 'again', 'against', 'along', 'among', 'around',
  'because', 'been', 'before', 'being', 'below', 'between', 'both', 'cannot',
  'could', 'doing', 'down', 'during', 'each', 'either', 'every', 'from',
  'further', 'given', 'having', 'here', 'however', 'into', 'itself', 'just',
  'like', 'made', 'make', 'making', 'many', 'more', 'most', 'much', 'must',
  'need', 'neither', 'never', 'once', 'only', 'other', 'over', 'own', 'same',
  'should', 'since', 'some', 'such', 'than', 'that', 'their', 'them', 'then',
  'there', 'these', 'they', 'this', 'those', 'through', 'under', 'until',
  'very', 'were', 'what', 'when', 'where', 'which', 'while', 'will', 'with',
  'within', 'without', 'would', 'your', 'yours', 'also', 'still', 'even',
  'first', 'second', 'third', 'next', 'last', 'want', 'wants', 'know', 'used',
  'using', 'uses', 'does', 'done', 'goes', 'went', 'take', 'takes', 'come',
  'comes', 'look', 'looks', 'work', 'works', 'seem', 'seems', 'thing', 'things',
]);

function tokenize(text: string): string[] {
  return stripInlineCode(text)
    .toLowerCase()
    .split(/[^a-z'-]+/)
    .filter((w) => w.length >= 5 && !STOPWORDS.has(w));
}

/**
 * Words repeated 3+ times inside a single paragraph. Topic words legitimately
 * repeat, so anything appearing in a heading is exempt — a post about webhooks
 * is allowed to say "webhook".
 */
function findRepeatedWords(
  paragraphs: Span[],
  headingWords: Set<string>
): Array<Span & { word: string; count: number }> {
  const hits: Array<Span & { word: string; count: number }> = [];
  for (const p of paragraphs) {
    if (wordCountOf(p.text) < 40) continue;
    const freq = new Map<string, number>();
    for (const w of tokenize(p.text)) {
      if (headingWords.has(w)) continue;
      freq.set(w, (freq.get(w) ?? 0) + 1);
    }
    for (const [word, count] of freq) {
      if (count >= 3) hits.push({ text: word, word, count, offset: p.offset });
    }
  }
  return hits;
}

// ---------------------------------------------------------------------------
// D12 — repeated thematic points
// ---------------------------------------------------------------------------

const THEME_SIMILARITY_THRESHOLD = 0.5;

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  for (const x of a) if (b.has(x)) shared++;
  return shared / (a.size + b.size - shared);
}

/**
 * Substantial paragraphs in *different* sections that share most of their
 * content vocabulary — the thesis being re-derived instead of advanced.
 */
function findRepeatedThemes(sections: Section[]): Array<Span & { pairedWith: string }> {
  const entries: Array<{ set: Set<string>; offset: number; heading: string; text: string }> = [];
  for (const section of sections) {
    for (const p of splitParagraphs(section.body)) {
      if (wordCountOf(p.text) < 25) continue;
      const set = new Set(tokenize(p.text));
      if (set.size < 8) continue;
      entries.push({ set, offset: section.offset + p.offset, heading: section.heading, text: p.text });
    }
  }

  const hits: Array<Span & { pairedWith: string }> = [];
  const claimed = new Set<number>();
  for (let i = 0; i < entries.length; i++) {
    if (claimed.has(i)) continue;
    for (let j = i + 1; j < entries.length; j++) {
      if (claimed.has(j)) continue;
      if (entries[i].heading === entries[j].heading) continue;
      // Jaccard <= min(|a|,|b|) / max(|a|,|b|), so paragraphs of very different
      // vocabulary size cannot clear the threshold. Exact prune, not a heuristic:
      // it skips the set intersection without changing a single result.
      const a = entries[i].set.size;
      const b = entries[j].set.size;
      if (Math.min(a, b) / Math.max(a, b) <= THEME_SIMILARITY_THRESHOLD) continue;
      if (jaccard(entries[i].set, entries[j].set) > THEME_SIMILARITY_THRESHOLD) {
        hits.push({
          text: entries[j].text.slice(0, 80),
          offset: entries[j].offset,
          pairedWith: entries[i].heading,
        });
        claimed.add(j);
        break;
      }
    }
  }
  return hits;
}

// ---------------------------------------------------------------------------
// D13 — narrated code
// ---------------------------------------------------------------------------

const NARRATED_CODE_RE =
  /\b(?:the\s+(?:code|snippet|example|function|script|block)\s+(?:below|above)|below,?\s+(?:we|you)\s+\w+|this\s+(?:code|snippet|function|example)\s+(?:simply\s+)?(?:imports?|creates?|initiali[sz]es?|defines?|loops?|sets?|adds?|returns?|declares?|instantiates?))\b/i;

/**
 * A lead-in that only restates what the code plainly shows.
 *
 * Runs on masked prose (fence bodies blanked, offsets intact) so a previous
 * block's code can never be mistaken for a lead-in paragraph. Paragraphs are
 * split once and walked with a moving pointer rather than re-splitting the
 * document prefix per fence, which was quadratic on code-heavy drafts.
 */
function findNarratedCode(prose: string, paragraphs: Span[]): Span[] {
  const hits: Span[] = [];
  const fenceRe = /```[^\n]*\n[\s\S]*?```/g;
  let m: RegExpExecArray | null;
  let cursor = 0;

  while ((m = fenceRe.exec(prose)) !== null) {
    // Advance to the last paragraph that starts before this fence.
    while (cursor < paragraphs.length && paragraphs[cursor].offset < m.index) cursor++;
    const lead = paragraphs[cursor - 1];
    if (!lead) continue;

    const lastSentence = splitSentences(lead.text).pop();
    if (!lastSentence) continue;
    if (NARRATED_CODE_RE.test(lastSentence.text)) {
      hits.push({ text: lastSentence.text.slice(0, 120), offset: lead.offset });
    }
  }
  return hits;
}

// ---------------------------------------------------------------------------
// D14 — meta-references and conclusion recaps
// ---------------------------------------------------------------------------

const META_REFERENCE_RE =
  /\b(?:in\s+this\s+(?:tutorial|article|guide|post|section)\s*,?\s*(?:we|you|I)\b|in\s+the\s+next\s+section|in\s+the\s+previous\s+section|as\s+(?:mentioned|discussed|noted|shown)\s+(?:above|earlier|previously)|now\s+that\s+we'?(?:ve|have)\s+covered|as\s+we\s+(?:saw|covered)\s+(?:earlier|above)|by\s+the\s+end\s+of\s+this\s+(?:article|post|guide))\b/gi;

const RECAP_HEADING_RE = /\b(?:conclusion|wrapping\s+up|summary|final\s+thoughts|to\s+sum\s+up|recap)\b/i;
const RECAP_BODY_RE =
  /\b(?:we\s+(?:learned|covered|walked\s+through|explored|looked\s+at)|you\s+(?:learned|now\s+know)|in\s+this\s+(?:guide|article|post|tutorial))\b/i;

// ---------------------------------------------------------------------------
// D15 — formatting tells
// ---------------------------------------------------------------------------

const EMOJI_RE =
  /[\u{1F300}-\u{1FAFF}\u{2190}-\u{21FF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}]/u;

/** Quotation marks around one or two ordinary words, not a real quotation. */
const SCARE_QUOTE_RE = /(?<![:,]\s)["“]([a-z][a-z'-]{2,}(?:\s+[a-z][a-z'-]{2,})?)["”]/g;

/** Bold applied to a short run inside a sentence, not as a lead-in label. */
const INLINE_BOLD_RE = /(?<=\S[ ,;])\*\*([^*\n]{2,40})\*\*/g;

// ---------------------------------------------------------------------------
// D16 — marketing tells
// ---------------------------------------------------------------------------

const MARKETING_PATTERNS: Array<{ re: RegExp; label: string }> = [
  {
    re: /\b(simple|lightweight|minimal|small|easy|tiny|basic|humble|modest|thin)\s+(?:yet|but)\s+(powerful|full-featured|complete|robust|capable|flexible|comprehensive|mighty|extensible)\b/gi,
    label: 'paired-adjective ("simple yet powerful")',
  },
  {
    re: /\bvery\s+(?:fast|slow|large|small|simple|easy|hard|difficult|high|low|good|bad|important|useful|common|popular)\b/gi,
    label: '"very" where a measurement belongs',
  },
  {
    re: /\bwhether\s+you'?(?:re|are)\s+[^.,;]{3,60}\s+or\s+[^.,;]{3,60}[,.]/gi,
    label: 'fake inclusivity ("whether you\'re X or Y")',
  },
  {
    re: /\b(?:can\s+be\s+(?:disastrous|catastrophic|devastating)|absolutely\s+(?:critical|essential)|critical\s+for\s+any\s+serious|mission[-\s]critical\s+for)\b/gi,
    label: 'manufactured stakes',
  },
  {
    re: /\b(?:here'?s\s+the\s+(?:thing|kicker|catch|problem)|so\s+here'?s\s+what\s+happens|here'?s\s+where\s+it\s+gets)\b/gi,
    label: 'faux-conversational pivot',
  },
];

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

/** Penalty applied to `structural_score` for each detector that fires. */
const SCORE_WEIGHTS: Record<string, number> = {
  'prose-list-of-three': 6,
  'prose-not-x-but-y': 8,
  'prose-uniform-length': 10,
  'prose-section-closer': 8,
  'prose-em-dash': 5,
  'prose-rhetorical-question': 7,
  'prose-passive-voice': 6,
  'prose-hedging': 5,
  'prose-repeated-opener': 6,
  'prose-sentence-uniformity': 10,
  'prose-repeated-word': 4,
  'prose-repeated-theme': 9,
  'prose-narrated-code': 6,
  'prose-meta-reference': 6,
  'prose-formatting-tell': 4,
  'prose-marketing-tell': 6,
  'prose-no-contractions': 4,
};

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

export function auditProse(
  draftMarkdown: string,
  options: ProseAuditOptions = {}
): { flags: AuditFlag[]; score: ProseAuditScore } {
  const flags: AuditFlag[] = [];
  const prose = maskNonProse(draftMarkdown);

  const sections = parseSections(prose);
  const paragraphs = splitParagraphs(prose);
  const proseBody = paragraphs.map((p) => p.text).join('\n\n');
  const wordCount = Math.max(1, wordCountOf(proseBody));
  const sentences = paragraphs.flatMap((p) => splitSentences(p.text, p.offset));

  const per = (n: number, unit: number) => n / (wordCount / unit);

  // --- D1: list-of-three density -----------------------------------------
  const listOfThreeCount = countListsOfThree(proseBody);
  if (per(listOfThreeCount, 100) > 2) {
    flags.push({
      type: 'prose-list-of-three',
      severity: 'warning',
      message: `High list-of-three density: ${listOfThreeCount} instances across ~${wordCount} words (threshold: >2 per 100 words)`,
    });
  }

  // --- D2: "not X, but Y" -------------------------------------------------
  const notXButYCount = countNotXButY(proseBody);
  if (per(notXButYCount, 500) > 1) {
    flags.push({
      type: 'prose-not-x-but-y',
      severity: 'warning',
      message: `${notXButYCount} "not X, but Y" / "it's not X, it's Y" constructions — threshold: >1 per 500 words`,
    });
  }

  // --- D3: paragraph-length uniformity ------------------------------------
  const cv = paragraphLengthCV(paragraphs);
  if (cv < 0.3 && sections.length >= 3) {
    flags.push({
      type: 'prose-uniform-length',
      severity: 'warning',
      message: `Uniform paragraph length detected (CV=${cv.toFixed(2)}, threshold <0.30) — a common AI structural tell`,
    });
  }

  // --- D4: heading-restating closers --------------------------------------
  const sectionCloserCount = sectionCloserFlags(sections);
  if (sectionCloserCount > 0) {
    flags.push({
      type: 'prose-section-closer',
      severity: 'warning',
      message: `${sectionCloserCount} section(s) end with a sentence that restates the heading — cut or rewrite these closers`,
    });
  }

  // --- D5: em-dash density -------------------------------------------------
  const emDashCount = countEmDashes(proseBody);
  const emDashPer1000 = parseFloat(per(emDashCount, 1000).toFixed(2));
  if (emDashCount >= 3 && emDashPer1000 > 4) {
    flags.push({
      type: 'prose-em-dash',
      severity: 'warning',
      message: `${emDashCount} em/en dashes (${emDashPer1000} per 1,000 words, threshold: 4) — convert some asides to commas, parentheses, or separate sentences`,
    });
  }

  // --- D6: rhetorical-question transitions --------------------------------
  const rhetorical = findRhetoricalTransitions(sections);
  if (per(rhetorical.length, 500) > 1) {
    flags.push({
      type: 'prose-rhetorical-question',
      severity: 'warning',
      message: `${rhetorical.length} rhetorical questions used as section transitions (threshold: >1 per 500 words) — state the point instead of asking it`,
      offset: rhetorical[0]?.offset,
      span_text: rhetorical[0]?.text.slice(0, 120),
      details: rhetorical.slice(0, 4).map((r) => r.text.slice(0, 100)).join(' | '),
    });
  }

  // --- D7: passive voice ---------------------------------------------------
  const { ratio: passiveVoiceRatio, examples: passiveExamples } = passiveRatio(sentences);
  if (passiveVoiceRatio > 0.2 && sentences.length >= 10) {
    flags.push({
      type: 'prose-passive-voice',
      severity: 'warning',
      message: `${Math.round(passiveVoiceRatio * 100)}% of sentences are passive (threshold: 20%) — name the actor and use an active verb`,
      offset: passiveExamples[0]?.offset,
      details: passiveExamples.slice(0, 3).map((s) => s.text.slice(0, 100)).join(' | '),
    });
  }

  // --- D8: hedging ---------------------------------------------------------
  const hedgeMatches = proseBody.match(HEDGE_RE) ?? [];
  if (per(hedgeMatches.length, 500) > 2) {
    flags.push({
      type: 'prose-hedging',
      severity: 'warning',
      message: `${hedgeMatches.length} hedging phrases (threshold: >2 per 500 words) — commit to the claim or cut it`,
      details: Array.from(new Set(hedgeMatches.map((h) => h.toLowerCase()))).slice(0, 6).join(', '),
    });
  }

  // --- D9: repeated sentence openers ---------------------------------------
  const repeatedOpeners = findRepeatedOpeners(paragraphs);
  for (const hit of repeatedOpeners.slice(0, 5)) {
    flags.push({
      type: 'prose-repeated-opener',
      severity: 'warning',
      message: `${hit.run} consecutive sentences open with "${hit.word}" — vary the sentence openings`,
      offset: hit.offset,
      span_text: snippetAt(draftMarkdown, hit.offset),
    });
  }

  // --- D10: sentence-length uniformity --------------------------------------
  const uniformRuns = findUniformSentenceRuns(sentences);
  for (const run of uniformRuns.slice(0, 4)) {
    flags.push({
      type: 'prose-sentence-uniformity',
      severity: 'warning',
      message: `Metronomic rhythm: ${run.text} in a row are within 30% of the same length — break one up or merge two`,
      offset: run.offset,
      span_text: snippetAt(draftMarkdown, run.offset),
    });
  }

  // --- D11: repeated distinctive words --------------------------------------
  const headingWords = new Set<string>();
  for (const s of sections) for (const w of tokenize(s.heading)) headingWords.add(w);
  const repeatedWords = findRepeatedWords(paragraphs, headingWords);
  for (const hit of repeatedWords.slice(0, 5)) {
    flags.push({
      type: 'prose-repeated-word',
      severity: 'info',
      message: `"${hit.word}" appears ${hit.count} times in one paragraph — vary the wording or restructure`,
      offset: hit.offset,
      span_text: hit.word,
    });
  }

  // --- D12: repeated thematic points ----------------------------------------
  const repeatedThemes = findRepeatedThemes(sections);
  for (const hit of repeatedThemes.slice(0, 4)) {
    flags.push({
      type: 'prose-repeated-theme',
      severity: 'warning',
      message: `This paragraph restates a point already made under "${hit.pairedWith}" — advance the argument instead of re-deriving it`,
      offset: hit.offset,
      span_text: hit.text,
    });
  }

  // --- D13: narrated code ----------------------------------------------------
  const narratedCode = findNarratedCode(prose, paragraphs);
  for (const hit of narratedCode.slice(0, 6)) {
    flags.push({
      type: 'prose-narrated-code',
      severity: 'warning',
      message: 'Code lead-in only restates what the code shows — explain why this code, what it costs, or what to watch for instead',
      offset: hit.offset,
      span_text: hit.text,
    });
  }

  // --- D14: meta-references and recaps ---------------------------------------
  const metaMatches = proseBody.match(META_REFERENCE_RE) ?? [];
  let metaReferenceCount = metaMatches.length;
  for (const match of Array.from(new Set(metaMatches)).slice(0, 5)) {
    flags.push({
      type: 'prose-meta-reference',
      severity: 'warning',
      message: `Meta-reference "${match.trim()}" — the reader can see the structure; describe the content instead`,
    });
  }

  const lastSection = sections[sections.length - 1];
  if (lastSection && RECAP_HEADING_RE.test(lastSection.heading) && RECAP_BODY_RE.test(lastSection.body)) {
    metaReferenceCount++;
    flags.push({
      type: 'prose-meta-reference',
      severity: 'warning',
      message: `Closing section "${lastSection.heading}" recaps steps the reader just read — end on an implication, a limitation, or what to do next`,
      offset: lastSection.offset,
    });
  }

  // --- D15: formatting tells --------------------------------------------------
  let formattingTellCount = 0;

  const scareQuotes = Array.from(proseBody.matchAll(SCARE_QUOTE_RE));
  if (scareQuotes.length >= 2) {
    formattingTellCount += scareQuotes.length;
    flags.push({
      type: 'prose-formatting-tell',
      severity: 'info',
      message: `${scareQuotes.length} scare-quoted words (e.g. "${scareQuotes[0][1]}") — if the word is right, use it plainly; if it isn't, pick a better one`,
      details: scareQuotes.slice(0, 5).map((m) => m[1]).join(', '),
    });
  }

  const boldParagraphs = paragraphs.filter((p) => Array.from(p.text.matchAll(INLINE_BOLD_RE)).length > 0);
  if (boldParagraphs.length >= 2) {
    formattingTellCount += boldParagraphs.length;
    flags.push({
      type: 'prose-formatting-tell',
      severity: 'info',
      message: `${boldParagraphs.length} paragraphs bold a short phrase mid-sentence — bold is for terms and labels, not emphasis`,
      offset: boldParagraphs[0].offset,
    });
  }

  const emojiHeadings = sections.filter((s) => EMOJI_RE.test(s.heading));
  if (emojiHeadings.length > 0) {
    formattingTellCount += emojiHeadings.length;
    flags.push({
      type: 'prose-formatting-tell',
      severity: 'info',
      message: `${emojiHeadings.length} heading(s) contain decorative emoji — remove them`,
      details: emojiHeadings.map((s) => s.heading).slice(0, 5).join(' | '),
    });
  }

  // --- D16: marketing tells ---------------------------------------------------
  let marketingTellCount = 0;
  for (const { re, label } of MARKETING_PATTERNS) {
    const matches = Array.from(proseBody.matchAll(re));
    if (matches.length === 0) continue;
    marketingTellCount += matches.length;
    flags.push({
      type: 'prose-marketing-tell',
      severity: 'warning',
      message: `${matches.length}× ${label} — replace with the specific claim`,
      offset: matches[0].index,
      span_text: matches[0][0].slice(0, 120),
    });
  }

  // --- D17: contraction-free prose ---------------------------------------------
  const contractionCount = (proseBody.match(/\b\w+['’](?:s|t|re|ve|ll|d|m)\b/gi) ?? []).length;
  if (options.expectContractions && wordCount >= 400 && contractionCount === 0) {
    flags.push({
      type: 'prose-no-contractions',
      severity: 'info',
      message: 'No contractions anywhere in a conversational piece — "it is" and "do not" throughout reads as machine-formal',
    });
  }

  // --- Score ---------------------------------------------------------------
  const penalty = flags.reduce((sum, f) => sum + (SCORE_WEIGHTS[f.type] ?? 4), 0);
  const structuralScore = Math.max(0, Math.min(100, 100 - penalty));

  const score: ProseAuditScore = {
    list_of_three_count: listOfThreeCount,
    not_x_but_y_count: notXButYCount,
    paragraph_length_cv: parseFloat(cv.toFixed(3)),
    section_closer_count: sectionCloserCount,
    em_dash_per_1000: emDashPer1000,
    rhetorical_question_count: rhetorical.length,
    passive_voice_ratio: parseFloat(passiveVoiceRatio.toFixed(3)),
    hedge_count: hedgeMatches.length,
    repeated_opener_count: repeatedOpeners.length,
    sentence_uniformity_runs: uniformRuns.length,
    repeated_word_count: repeatedWords.length,
    repeated_theme_count: repeatedThemes.length,
    narrated_code_count: narratedCode.length,
    meta_reference_count: metaReferenceCount,
    formatting_tell_count: formattingTellCount,
    marketing_tell_count: marketingTellCount,
    contraction_count: contractionCount,
    structural_score: structuralScore,
    flagged: flags.length > 0,
  };

  return { flags, score };
}
