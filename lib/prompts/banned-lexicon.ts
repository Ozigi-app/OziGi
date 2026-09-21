/**
 * Banned Lexicon — the shared, code-facing word/phrase/pattern lists.
 * ------------------------------------------------------------------
 * Extracted out of `./anti-ai.ts` so more than one consumer can read the
 * same source of truth without pulling the ~300-line prose rulebook into
 * its bundle:
 *
 *   - `lib/prompts/anti-ai.ts`          re-exports these and keeps the
 *                                       LLM-facing prose rules in sync
 *                                       (dev-mode drift guard lives there)
 *   - `lib/prompts/lexicon-validator.ts` scans Ozigi's own generation
 *                                       output before it ships
 *   - `lib/slop-checker/engine.ts`      scores arbitrary pasted text on
 *                                       the public /slop-checker page
 *                                       (runs in the browser — this file
 *                                       must stay free of server imports)
 *
 * Editing rule: when you add a term here, add it to the prose rules in
 * `anti-ai.ts` too, or the dev-mode drift guard there will warn about it.
 */

/** Single tokens. Word-bounded match, case-insensitive. */
export const BANNED_WORDS: readonly string[] = [
  // 1A — classic AI buzzwords
  'delve', 'delving', 'testament', 'tapestry', 'realm', 'paradigm', 'synergy',
  'confluence', 'mosaic', 'crescendo', 'enigma', 'labyrinth', 'underpinning',
  'embodiment', 'ineffable', 'ephemeral', 'ethereal', 'transcendent',
  'indomitable', 'monumental', 'unfathomable', 'quintessential',
  'intricate', 'intricacies', 'interplay', 'meticulous', 'meticulously',
  'pivotal', 'underscore', 'underscores', 'underscored', 'garner', 'garnered',
  'vibrant', 'boasts', 'bolstered', 'noteworthy', 'commendable',
  'unpack', 'unpacking', 'demystify', 'demystifying', 'harness', 'harnessing',
  'unleash', 'unleashing', 'skyrocket', 'skyrocketed',
  // 1B — corporate fluff
  'crucial', 'robust', 'transformative', 'revolutionary', 'supercharge',
  'seamless', 'seamlessly', 'navigating', 'multifaceted', 'showcasing',
  'showcases', 'fostering', 'fosters', 'innovative', 'innovation',
  'disruptive', 'disruption', 'empower', 'empowers', 'empowering',
  'streamline', 'streamlines', 'streamlining', 'learnings',
  // 1F — overwrought
  'resplendent', 'boundless', 'unyielding', 'imperishable', 'luminescent',
  'otherworldly', 'breathtaking', 'awe-inspiring', 'spearhead', 'spearheads',
  'spearheading', 'groundbreaking', 'trailblazing', 'pioneering',
  'profound', 'profoundly',
  // 1L — community-sourced 2026 additions
  'elevate', 'elevating', 'frictionless', 'bespoke', 'turnkey',
  'hyper-personalized',
  // 1J — Gemini affirmations as standalone tells
  // (handled by opener regex below, not by word-list)
];

/** Multi-word phrases. Matched as case-insensitive whole-token sequences. */
export const BANNED_PHRASES: readonly string[] = [
  // 1A
  'harness the power', 'tap into', 'a new era', 'ushering in',
  'navigate the complexities', 'navigate the world of',
  // 1B
  'cutting-edge', 'game-changer', 'best practices', 'best practice',
  'thought leadership', 'thought leader', 'pain points', 'value proposition',
  'north star', 'level up', 'move the needle', 'big moves',
  'low-hanging fruit', 'mission-critical', 'future-proof', 'future-proofing',
  'next-level', 'world-class', 'best-in-class', 'data-driven',
  'results-driven', 'human-centric', 'customer-centric', 'community-driven',
  'plug-and-play', 'end-to-end', 'single source of truth', 'game plan',
  'key takeaway', 'key takeaways', 'the secret to', 'the formula for',
  'the blueprint for', 'the roadmap to', 'quick wins', 'needle-mover',
  'circle back', 'double-click on', 'deeper understanding',
  // 1C — AI tells
  'at its core', 'plays a significant role', 'plays a crucial role',
  'crucial role in', 'gain insights', 'gains valuable insights',
  'offers valuable perspectives', "it's worth noting", 'it is worth noting',
  "it's important to note", 'it is important to note', 'it bears mentioning',
  'bears repeating', 'needless to say', 'as previously mentioned',
  'as we move forward', 'moving forward', 'going forward',
  'in the ever-evolving', 'ever-evolving', 'ever-changing',
  'rapidly evolving', "in today's world", "in today's digital age",
  "in today's fast-paced", 'the world of', 'in the realm of',
  'in the landscape of', 'deeper dive', 'a closer look', "let's explore",
  'let us explore', 'sheds light on', 'shed light on', 'pave the way',
  'paves the way', 'set the stage', 'sets the stage', 'rest assured',
  'without further ado', 'as an AI', 'as a language model',
  'it goes without saying', 'suffice to say', 'on that note',
  'in essence', "it's clear that", 'it is clear that', "it's evident that",
  'with this in mind', 'to this end', 'in light of', 'at the forefront',
  'at the heart of', 'that said', 'having said that', 'with that said',
  'all that being said', 'this being said', 'all things considered',
  'having considered', "it's no secret that", 'the truth is',
  'the reality is', 'worth mentioning', 'not to mention',
  'more often than not', 'without a doubt', "there's no denying",
  'make no mistake', 'let me be clear', 'to be fair', 'to be clear',
  'truth be told', 'believe it or not', 'everything you need to know',
  'a comprehensive overview', "if you're looking to",
  'are you struggling with', 'the good news is', 'the bad news is',
  'let me explain', "here's what you need to know", "let's dive in",
  'let me break this down', 'a step-by-step', 'step-by-step guide',
  'the ultimate guide', 'I hope this helps', 'feel free to',
  "don't hesitate to", 'let me know if', "I'd argue that", 'I would argue',
  'to put it another way', 'what if I told you', 'imagine a world where',
  // 1D — Pangram bigrams
  'rich tapestry', 'intricate dance', 'delicate balance', 'rich understanding',
  'stark contrast', 'deep dive', 'comprehensive understanding',
  'intricate interplay', 'profound impact', 'crucial role',
  'significant impact', 'pivotal moment', 'unique perspective',
  'valuable insights', 'actionable insights', 'critical insights',
  'meaningful conversations', 'thoughtful approach', 'thought-provoking',
  'rich ecosystem', 'vibrant community', 'growing landscape',
  'evolving needs', 'compelling narrative', 'powerful tool',
  'endless possibilities', 'seamless integration', 'transformative potential',
  'tangible results', 'measurable outcomes', 'fast-paced environment',
  'dynamic environment', 'complex landscape', 'broader context',
  // 1I — formulaic
  'in a sea of sameness', 'let that sink in', 'this is huge',
  "I can't stress this enough", 'mark my words', 'the bottom line is',
  // 1K — moral coda
  "and that's why",
  // 1L — community-sourced 2026 additions
  'at the end of the day', 'when it comes to', "here's the thing",
  'unlock the potential', 'take it to the next level',
  'level the playing field', 'best of both worlds', 'the takeaway is',
];

/**
 * Sentence/post openers. Matched at start of text, after a sentence-ending
 * punctuation, or after a paragraph break. Case-insensitive.
 */
export const BANNED_OPENERS: readonly string[] = [
  // 1H — adverb-comma openers (the 2026 tell)
  'Ultimately,', 'Crucially,', 'Critically,', 'Importantly,', 'Notably,',
  'Significantly,', 'Remarkably,', 'Interestingly,', 'Surprisingly,',
  'Fundamentally,', 'Essentially,', 'Effectively,',
  // 1J — Gemini affirmations / restatements / "here is" openers
  'Certainly!', 'Absolutely!', 'Great!', 'Sure!', 'Of course!',
  'Certainly,', 'Absolutely,', 'Of course,', 'Indeed,',
  'Here is', 'Here are', "Here's",
  "Let's explore", "Let's dive", "Let's break", "Let's unpack",
  "Let's take a look", "Let's discuss",
  // 1G — transitional crutches as openers
  'In fact,', 'Indeed,', 'Clearly,',
  'First and foremost,', 'Last but not least,',
  'In summary,', 'To sum up,', 'In conclusion,', 'All in all,', 'Overall,',
  'Furthermore,', 'Moreover,', 'Nevertheless,', 'Nonetheless,',
  'Henceforth,', 'Thus,', 'Hence,',
  // 1I — cliché openers (sentence-start variants)
  'Imagine if', 'Suppose that', 'Picture this', 'What if I told you',
  'Have you ever wondered', 'Wouldn\'t you agree that',
  'Isn\'t it obvious that', 'More importantly,', 'Even more importantly,',
  'Are you tired of',
  // 1L — community-sourced 2026 additions
  'In short,', 'Simply put,', 'Long story short,', 'Bottom line,',
  "Here's the deal,", 'Plain and simple,', 'Real talk,',
];

/** Engagement-bait closers — flagged when they appear at the end of a post. */
export const BANNED_CLOSERS: readonly string[] = [
  'What do you think?', 'Thoughts?', 'Drop a comment',
  'Drop your thoughts', "What's your take?",
  'Tag someone who needs this', 'Tag someone',
  'Repost if you found this valuable', 'Repost if',
  'Comment YES', 'Comment below',
  // 1L — community-sourced 2026 additions
  'Follow for more', 'Save this for later', 'Save this post',
  "Who's with me?", 'Agree or disagree?', 'Like and subscribe',
  'Hit the follow button',
];

/** Regex anti-patterns. Each gets a label for the violation report. */
export const BANNED_REGEX_PATTERNS: readonly { label: string; pattern: RegExp; kind: 'banned-structure' | 'banned-contrast' | 'banned-cadence' }[] = [
  // §1J — Gemini's bold-colon paragraph prefix tell
  {
    label: 'bold-colon paragraph prefix (**Term:**)',
    kind: 'banned-structure',
    pattern: /\*\*[^*\n]{1,40}:\*\*/g,
  },
  // §1K — double-hyphen em-dash substitute
  {
    label: 'double-hyphen em-dash substitute (--)',
    kind: 'banned-structure',
    pattern: /(?:\s|\w)--(?:\s|\w)/g,
  },
  // §5 — banned contrast structures
  {
    label: 'contrast: "It is not X. It is Y."',
    kind: 'banned-contrast',
    pattern: /\bit\s+is\s+not\s+[\w\s,'-]{1,40}\.\s+it\s+is\s+[\w\s,'-]{1,40}\b/gi,
  },
  {
    label: "contrast: \"This isn't about X. It's about Y.\"",
    kind: 'banned-contrast',
    pattern: /\bthis\s+isn'?t\s+about\s+[\w\s,'-]{1,40}\.\s+it'?s\s+about\b/gi,
  },
  {
    label: 'contrast: "Less X, more Y."',
    kind: 'banned-contrast',
    pattern: /\bless\s+[\w-]+(?:\s+[\w-]+){0,2},?\s+more\s+[\w-]+/gi,
  },
  {
    label: 'contrast: "Forget X. Think Y."',
    kind: 'banned-contrast',
    pattern: /\bforget\s+[\w-]+\.\s+think\s+[\w-]+/gi,
  },
  {
    label: "contrast: \"X isn't just Y, it's Z\"",
    kind: 'banned-contrast',
    pattern: /\b\w+\s+isn'?t\s+just\s+[\w-]+,?\s+it'?s\s+[\w-]+/gi,
  },
  {
    label: "contrast: \"It's not X, it's Y\"",
    kind: 'banned-contrast',
    pattern: /\bit'?s\s+not\s+[\w-]+(?:\s+[\w-]+){0,2},?\s+it'?s\s+[\w-]+/gi,
  },
  {
    label: 'contrast: "Rather than X, do Y"',
    kind: 'banned-contrast',
    pattern: /\brather\s+than\s+[\w-]+(?:\s+[\w-]+){0,2},?\s+(?:do|use|try|consider|opt\s+for)\s+[\w-]+/gi,
  },
];

// ---------------------------------------------------------------------------
// Shared term → regex body
// ---------------------------------------------------------------------------

/**
 * Separator class used between the tokens of a multi-token term.
 *
 * A listed term fixes one spelling, but the tell does not care: "game-changer",
 * "game changer" and "game\nchanger" are the same phrase, and a model told to
 * avoid the hyphenated form will happily emit the spaced one. So any separator
 * in a term matches any separator in the text — hyphen (ASCII or the Unicode
 * dash range), whitespace, or a run of both.
 */
const TERM_SEPARATOR = '[\\s\\u2010-\\u2015-]+';

/**
 * Escape a literal term for use inside a RegExp. Hyphens and whitespace are
 * left alone here — `termPatternBody` rewrites them into `TERM_SEPARATOR`.
 */
export function escapeTerm(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Build the body of a matcher for one literal term: apostrophes match ASCII or
 * curly, and every internal separator matches any separator. Callers add their
 * own anchors (word boundaries for words and phrases, start-of-sentence for
 * openers), so this returns the body only.
 */
export function termPatternBody(term: string): string {
  return escapeTerm(term)
    .replace(/'/g, "['\u2019]")
    .replace(/[\s\u2010-\u2015-]+/g, TERM_SEPARATOR);
}
