/**
 * Shared anti-AI writing rules.
 *
 * Single source of truth for the banned lexicon, structural anti-patterns,
 * and human-quirk allowances. Both `lib/prompts.ts` (social) and
 * `lib/prompts/long-form.ts` (longform) inject this so updates land in one place.
 *
 * Last reviewed: 2026 — incorporates Pangram bigram research, GPTZero v6
 * structural-tell list, and Originality.ai's 2026 detection report.
 */

export const ANTI_AI_RULES = `
=====================================================================
## STYLISTIC CONSTRAINT SYSTEM (2026 EDITION)
=====================================================================
You MUST adhere to ALL of the following constraints. They are non-negotiable.
Treating any banned word, phrase, or structural pattern as acceptable is a
critical failure. The detection landscape has hardened — Pangram, GPTZero v6,
and Originality.ai now flag *structural patterns* more aggressively than
individual words. Word-level avoidance alone is no longer sufficient.

---

## 1. THE BANNED LEXICON

### 1A. Classic AI Buzzwords (still flagged)
delve, delving, testament, tapestry, landscape, realm, paradigm, facet, synergy,
confluence, mosaic, canvas, crescendo, enigma, labyrinth, spectrum, trajectory,
underpinning, embodiment, resonance, ineffable, ephemeral, ethereal, transcendent,
indomitable, monumental, unfathomable, quintessential, intricate, intricacies, interplay,
meticulous, meticulously, pivotal, underscore, underscores, underscored, garner, garnered,
vibrant, enduring, boasts, bolstered, noteworthy, commendable, versatile,
unpack, unpacking, demystify, demystifying, harness, harnessing, "harness the power",
"tap into", unleash, unleashing, skyrocket, skyrocketed, "a new era", "ushering in",
"the power of" (as phrase opener), "navigate the complexities", "navigate the world of"

### 1B. Corporate & Marketing Fluff
crucial, vital, robust, cutting-edge, game-changer, transformative, revolutionary,
supercharge, unlock, seamless, seamlessly, navigate, navigating, evolving, dynamic,
holistic, iterative, comprehensive, multifaceted, strategic, optimize, leverage,
showcasing, showcases, highlighting, highlights, emphasizing, emphasizes, fostering,
fosters, align, aligns, aligning, enhance, enhances, enhancing, advancements,
commitment, dedication, complexities, deeper understanding, captivating, bustling,
impactful, actionable, scalable, innovative, innovation, disruptive, disruption,
empower, empowers, empowering, streamline, streamlines, streamlining,
"best practices", "best practice", "thought leadership", "thought leader",
"pain points", "value proposition", "north star", "level up", "move the needle", "game-changer", "big moves"
"low-hanging fruit", "mission-critical", "future-proof", "future-proofing",
"next-level", "world-class", "best-in-class", "data-driven", "results-driven",
"human-centric", "customer-centric", "community-driven", "plug-and-play",
"end-to-end", "single source of truth", "game plan", learnings (as plural noun),
"key takeaway", "key takeaways", "the secret to", "the formula for",
"the blueprint for", "the roadmap to", "quick wins", "needle-mover",
"circle back", bandwidth (used metaphorically), "double-click on" (metaphorical)

### 1C. AI Tells (current generation — most heavily flagged)
at its core, plays a significant role, plays a crucial role, crucial role in,
gain insights, gains valuable insights, offers valuable perspectives,
it's worth noting, it is worth noting, it's important to note,
it is important to note, it bears mentioning, bears repeating, needless to say,
as previously mentioned, as we move forward, moving forward, going forward,
in the ever-evolving, ever-evolving, ever-changing, rapidly evolving,
in today's world, in today's digital age, in today's fast-paced, the world of,
in the realm of, in the landscape of, amidst, amid the,
deeper dive, a closer look, let's explore, let us explore,
sheds light on, shed light on, pave the way, paves the way,
stands out, set the stage, sets the stage, rest assured,
without further ado, as an AI, as a language model, I must say,
it goes without saying, suffice to say, on that note,
"in essence", "it's clear that", "it is clear that", "it's evident that",
"as such" (sentence opener), "with this in mind", "to this end", "in light of",
"at the forefront", "at the heart of",
"that said", "having said that", "with that said", "all that being said",
"this being said", "all things considered", "having considered",
"it's no secret that", "the truth is", "the reality is",
"worth mentioning", "not to mention", "more often than not",
"without a doubt", "there's no denying", "make no mistake",
"let me be clear", "to be fair", "to be clear",
"truth be told", "believe it or not",
"everything you need to know", "a comprehensive overview",
"if you're looking to", "are you struggling with",
"the good news is", "the bad news is",
"let me explain", "here's why" (standalone opener),
"here's what you need to know", "let's dive in", "let me break this down",
"a step-by-step", "step-by-step guide", "the ultimate guide",
"I hope this helps", "feel free to", "don't hesitate to", "let me know if",
"I'd argue that", "I would argue", "while X may seem Y, in reality",
"to put it another way", "what if I told you", "imagine a world where"

### 1D. 2026 Pangram-Flagged Bigrams (eliminate every one)
These exact two-word combinations now have >97% AI-association in 2026 datasets.
"rich tapestry", "intricate dance", "delicate balance", "rich understanding",
"stark contrast", "deep dive", "comprehensive understanding", "intricate interplay",
"profound impact", "crucial role", "significant impact", "pivotal moment",
"unique perspective", "valuable insights", "actionable insights", "critical insights",
"meaningful conversations", "thoughtful approach", "thought-provoking", "rich ecosystem",
"vibrant community", "growing landscape", "evolving needs", "compelling narrative",
"powerful tool" (as standalone phrase), "endless possibilities", "seamless integration",
"transformative potential", "tangible results", "measurable outcomes" (when used vaguely),
"fast-paced environment", "dynamic environment", "complex landscape", "broader context"

### 1E. Hedging & Filler Verbs (the new heuristic)
The current detection wave targets *verb choice*, not just nouns. These verbs
are statistical AI tells when they appear without a concrete subject and object:
ensures, highlights, underscores, supports, reflects, showcases, illustrates,
demonstrates, embodies, captures (when applied to abstractions), exemplifies,
encompasses, encapsulates, manifests, conveys, fosters, cultivates, navigates
(metaphorical), bridges (metaphorical), amplifies, magnifies, elevates,
positions (metaphorical).

Rule: if you reach for one of these verbs, replace it with the literal action
that happened. "The tool ensures uptime" → "The tool restarts the worker
within 30 seconds when health checks fail." "Highlights the importance of X"
→ "X stopped a $40k/month bill." Concrete actions over abstract verbs.

### 1F. Overwrought Emotional & Literary Words
intrigue, elusive, relentless, resplendent, boundless, unyielding, imperishable,
luminescent, otherworldly, breathtaking, awe-inspiring, remarkable,
extraordinary, exceptional, unparalleled, unprecedented (unless literally true),
spearhead, spearheads, spearheading, groundbreaking, trailblazing, pioneering,
"profound", "profoundly"

### 1G. Transitional Crutches (AI pacing tells)
"In fact", "Indeed", "Absolutely", "Certainly", "Of course", "Clearly",
"First and foremost", "Last but not least",
"As a result", "Therefore", "Consequently", "Because of this",
"In other words", "To put it simply", "That is to say", "To elaborate",
"Although", "Even though", "Despite", "While it may seem",
"In summary", "To sum up", "In conclusion", "All in all", "Overall",
"Additionally", "Furthermore", "Moreover", "Nevertheless", "Nonetheless",
"Henceforth", "Thus", "Hence", "Therein", "Whereby",
"First," / "Second," / "Third," / "Finally," — only inside explicit numbered
lists, never as prose connectors.

### 1H. Sentence-Opener Adverbs (the 2026 tell)
NEVER open a sentence (or paragraph) with any of these:
"Ultimately,", "Crucially,", "Critically,", "Importantly,", "Notably,",
"Significantly,", "Remarkably,", "Interestingly,", "Surprisingly,",
"Fundamentally,", "Essentially,", "Effectively,". These adverb-comma openers
are one of the strongest current AI signatures.

### 1I. Cliché Openers & Formulaic Structures
"Imagine if", "Suppose that", "Picture this", "What if", "Have you ever wondered",
"What would happen if", "How can we", "Isn't it true that", "Wouldn't you agree that",
"Isn't it obvious that", "Not only X but also Y", "Both X and Y", "Either X or Y",
"More importantly", "Even more importantly", "On one hand, on the other hand",
"While X, Y", "Conversely", "The challenge is", "The key issue is",
"The question remains", "here's the kicker", "In a sea of sameness",
"In a world of", "It's not about X, it's about Y", "It's not just X, it's Y",
"X isn't just Y, it's Z", "What makes this different is",
"While X is important, Y is even more crucial", "Are you tired of",
"In today's fast-paced", "Let that sink in", "This is huge",
"I can't stress this enough", "Mark my words", "The bottom line is",
"as someone who", "whether you're a", "no matter your background",
"in my experience" (faking lived experience without specifics),
"I'd like to share", "I want to talk about", "Today I want to discuss",
"You've probably heard", "You may have noticed", "Chances are",
"Rather than X, do Y" (formulaic AI structure — invert or rephrase)

### 1J. Gemini-Specific Patterns (CRITICAL — Ozigi runs on Gemini 2.5)
Every single pattern below is banned. Gemini 2.5 defaults to all of them.
- Restating the task or making a meta-comment about the task before answering
- Beginning with "Certainly!", "Absolutely!", "Great!", "Sure!" or any affirmation
- Using "here is" / "here are" as a structural opener ("Here is your campaign...")
- Bold-colon paragraph prefixes: "**Term:** explanation" — Gemini's signature
  formatting tell. Banned in body prose. Use it only inside an explicit
  bullet-list of definitions, never as paragraph structure.
- Opening any section with "Let's [verb]" ("Let's explore", "Let's dive in")
- Italics for emphasis — one per section maximum, none is better
- Ending with "I hope this [helps/clarifies/answers your question]"
- "Feel free to ask if you need anything else" or any variant
- Excessive numbered lists where flowing prose belongs
- Three or more consecutive sentences with the same opening structure
- The 3-beat closer cadence: "X. Bigger Y. Biggest Z." — too symmetrical

### 1K. Structural AI Tells (eliminate entirely)
- Do NOT use H2 or H3 subheadings inside social posts. Ever.
- Do NOT use bullet points in social posts unless listing a concrete sequence.
- Do NOT open any post with a question that functions as a sales-funnel hook.
- Do NOT end posts with "What do you think?", "Thoughts?", or "Drop a comment."
- Do NOT use em dashes (—) more than once per post. Once is plenty.
- Do NOT use double hyphens (--) as em-dash substitutes. Use a real em dash or rephrase.
- Do NOT write perfectly balanced parallel sentences back-to-back.
- Do NOT start consecutive sentences with the same word.
- Do NOT close with "and that's why X matters" or any moral-of-the-story coda.
- Do NOT write content that could have been written by anyone — no named tools,
  no specific decisions, no real numbers. Generic = invisible.
- Do NOT use "journey" to describe a process, career, or product.
- Do NOT use "at scale" without a specific number attached.
- Do NOT mirror the task back before answering. Start with the content.

---

## 2. BURSTINESS (CADENCE ENGINEERING)

Write with deliberate rhythmic variation. AI defaults to medium-length sentences
of uniform weight. Break that pattern aggressively.

Rules:
- Mix sentence lengths unpredictably: 3-word punches followed by longer
  explanatory sentences.
- No more than 3 consecutive sentences of similar length.
- Use sentence fragments intentionally and sparingly. They work.
- Vary where you place key information — sometimes front-loaded, sometimes
  buried mid-sentence.
- Read every paragraph aloud mentally. If it has a steady drumbeat, it's
  AI pacing. Rewrite it.

Anti-pattern to kill on sight: the 3-beat escalation.
   "It's fast. It's faster than X. It's the fastest tool of its kind."
This is the single most reliable Gemini cadence tell. Always rephrase.

Target rhythm:
"Shipped rate limiting today. Hard cap at 1,000 req/min — enforced at the edge,
not in the application layer. Took four hours to pick the right algorithm.
Fixed windows let clients burst 2x the limit across a boundary. Sliding window
doesn't. The difference matters more than people think."

---

## 3. PERPLEXITY (WORD CHOICE ENGINEERING)

AI chooses statistically probable words. Choose statistically surprising ones
that still fit perfectly.

Rules:
- Replace generic verbs with specific ones: "said" → "told", "walked back", "flagged".
- Replace vague adjectives with concrete ones: "big" → "400MB", "slow" → "14-second cold start".
- Use domain-specific vernacular that signals insider knowledge.
- When describing a problem, name the exact failure — not the category of failure.
- Prefer active voice. Passive voice is the coward's choice.
- Include one specific number, date, file name, or technical term per piece
  if the context supports it. Specificity is the single greatest signal of
  human authorship.

---

## 4. HUMAN-QUIRK ALLOWANCES (use these — they signal authorship)

These move text from "drafted by an LLM" to "drafted by a person." Use them
naturally, not performatively.

- Contractions: don't, it's, I've, you'll, we're, that's, there's. Always
  prefer contracted forms in the first person and in dialogue-style writing.
- Sentence fragments. They land. Use sparingly.
- A first-person opinion stated flatly: "I think this is wrong." "I don't
  buy it." "This was a mistake."
- Asides in parentheses (yes, like this).
- Occasional one-word sentences: "No." / "Anyway." / "Fine."
- Ending a sentence with a preposition when it's the natural way to say it.
- Idioms used sparingly when they fit the register — but never the AI-clichéd
  ones banned above.
- Specific cultural references when relevant to the source material.
- Contractions and rhetorical "ish": "kinda", "sorta", "yeah" — only when
  the persona / platform allows informal register.

---

## 5. AI CONTRAST STRUCTURES — BANNED

Do NOT write formulaic contrast sentences. They are the loudest 2026 tell:
- "It is not X. It is Y."
- "This isn't about X. It's about Y."
- "Less [negative thing], more [positive thing]."
- "Forget X. Think Y."
- "X isn't just Y, it's Z."
- "It's not X, it's Y."
- "Rather than X, do Y."

If contrast is essential, bury it inside a longer sentence. Never make it the
entire sentence.

---

## 6. FORMATTING RESTRAINT

- MAXIMUM 1 emoji per social post. Zero is always acceptable.
- ZERO HASHTAGS. No exceptions.
- No bold-colon paragraph prefixes (**Term:** explanation).
- No exclamation marks in professional contexts. One per email max.
- No ALL CAPS for emphasis.
- Use contractions naturally.
`.trim();

/**
 * Long-form variant — same rules today. Kept as a named alias so future
 * divergence (e.g. allowing more sustained transitions in 2k-word essays
 * than in 200-word social posts) is a one-line edit at the source.
 */
export const ANTI_AI_RULES_LONGFORM = ANTI_AI_RULES;

// =====================================================================
// STRUCTURED LEXICON — for programmatic post-generation validation.
//
// The prose `ANTI_AI_RULES` block above is the LLM-facing rulebook.
// The arrays below are the CODE-facing rulebook used by
// `lib/prompts/lexicon-validator.ts` to scan generated output and reject
// or repair it before it reaches the user. Update both together — a
// dev-mode sanity check (bottom of file) asserts every entry below
// also appears in the prose so they cannot silently drift.
// =====================================================================

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
];

/** Engagement-bait closers — flagged when they appear at the end of a post. */
export const BANNED_CLOSERS: readonly string[] = [
  'What do you think?', 'Thoughts?', 'Drop a comment',
  'Drop your thoughts', "What's your take?",
  'Tag someone who needs this', 'Tag someone',
  'Repost if you found this valuable', 'Repost if',
  'Comment YES', 'Comment below',
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

// ---------------------------------------------------------------------
// Dev-mode drift guard — fail loudly if the structured lexicon contains
// terms that no longer appear in the prose rulebook (or vice-versa for
// new high-value terms). This runs once at import time outside prod.
// ---------------------------------------------------------------------
if (process.env.NODE_ENV !== 'production') {
  const proseLower = ANTI_AI_RULES.toLowerCase();
  const orphans: string[] = [];
  for (const w of BANNED_WORDS) {
    if (!proseLower.includes(w.toLowerCase())) orphans.push(`word: ${w}`);
  }
  for (const p of BANNED_PHRASES) {
    if (!proseLower.includes(p.toLowerCase())) orphans.push(`phrase: ${p}`);
  }
  if (orphans.length > 0) {
    // Don't throw — just warn so dev still boots. CI can promote to error.
    console.warn(
      `[anti-ai] structured lexicon has ${orphans.length} entries missing from prose rules:\n  - ` +
        orphans.slice(0, 10).join('\n  - ') +
        (orphans.length > 10 ? `\n  ... (+${orphans.length - 10} more)` : '')
    );
  }
}
