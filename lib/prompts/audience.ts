/**
 * Audience calibration
 * --------------------
 * `tone`, `depth`, and `structure` are not independent knobs. Who the reader is
 * determines all three at once, plus a handful of things none of them capture:
 * whether code leads or trails, whether analogies belong, what an acceptable
 * benchmark claim looks like, and how the piece should open.
 *
 * This module is the single source of truth for that calibration. It feeds:
 *   - lib/prompts/long-form.ts  (injects the profile block into the prompt)
 *   - app/long-form/page.tsx    (pre-fills tone/depth/structure defaults)
 *   - lib/longform/audit-audience.ts (checks the draft against the profile)
 */

import type { LongFormAudience } from '@/lib/types/longform';

export interface AudienceProfile {
  id: LongFormAudience;
  label: string;
  /** One-line description shown under the form select. */
  hint: string;
  jargon: string;
  code: string;
  theory: string;
  structurePreference: string;
  toneGuidance: string;
  opening: string;
  benchmark: string;
  analogies: string;
  length: string;
}

export const AUDIENCE_PROFILES: Record<LongFormAudience, AudienceProfile> = {
  developer: {
    id: 'developer',
    label: 'Developer',
    hint: 'Engineers, architects, DevOps — shipping against a deadline.',
    jargon:
      'High. Use standard terminology without defining it. Defining `API`, `endpoint`, or `async` insults this reader.',
    code:
      'Essential. Lead with it. The first code block should appear before the third paragraph, and it must be copy-pasteable as-is.',
    theory:
      'Minimal. Include only where it changes an implementation decision. No derivations.',
    structurePreference:
      'Task-oriented. Organize around what the reader is trying to do, not around how the system is built.',
    toneGuidance:
      'Direct, peer-to-peer. Assume competence. Skip encouragement and reassurance.',
    opening:
      'Open with the problem statement or working code — never with background on why the topic matters.',
    benchmark:
      'Ground performance claims in a stated setup: "on an M2 with Node 22, this cut cold start from 840ms to 210ms". Never claim "fast" unqualified.',
    analogies: 'Rarely needed. Prefer the real mechanism over a metaphor for it.',
    length: 'As short as the task allows. Cut anything that does not change what the reader types.',
  },
  practitioner: {
    id: 'practitioner',
    label: 'Technical Practitioner',
    hint: 'Data scientists, ML engineers, researchers — they will try to reproduce this.',
    jargon:
      'Very high, domain-specific. Precise terms expected; approximate usage reads as unserious.',
    code:
      'Important, and it must be reproducible: include hyperparameters, seeds, dataset versions, and environment.',
    theory:
      'Welcome. Give the intuition first, then the formula. Do not hide the math behind a metaphor.',
    structurePreference:
      'Problem-oriented. State the problem, the method, the result, and the limitations, in that order.',
    toneGuidance: 'Rigorous, precise, collegial. Hedge where the evidence genuinely hedges.',
    opening: 'Open with the problem context and the known limitations of existing approaches.',
    benchmark:
      'Report full methodology: dataset, sample size, hardware, and variance. A number without a method is noise to this reader.',
    analogies: 'Rarely needed.',
    length: 'As deep as the subject requires. Do not truncate the method section to hit a word count.',
  },
  'technical-writer': {
    id: 'technical-writer',
    label: 'Technical Writer',
    hint: 'Docs professionals evaluating structure and information design.',
    jargon: 'Medium, and variable. Define domain terms; assume fluency in documentation vocabulary.',
    code: 'Helpful but optional. When present, it illustrates a documentation pattern, not a build.',
    theory: 'High-level summaries. Prioritize the shape of the idea over its internals.',
    structurePreference:
      'Concept-first. Establish what the thing is and who it serves before showing it in use.',
    toneGuidance: 'Clear and considered. This reader notices sloppy structure faster than sloppy code.',
    opening: 'Open with what it is and who it is for.',
    benchmark: 'Cite sources explicitly. Attribute every claim you did not personally verify.',
    analogies: 'Occasionally useful for framing an unfamiliar concept.',
    length: 'Match the content type. A reference page and an explainer should not be the same length.',
  },
  beginner: {
    id: 'beginner',
    label: 'Beginner / Non-Technical',
    hint: 'Career changers, students, business stakeholders — no domain vocabulary yet.',
    jargon:
      'Minimal. Every term gets defined the first time it appears, in the sentence where it appears — not in a glossary at the end.',
    code:
      'Optional. When you include it, explain it line by line, and show the expected output so the reader can tell whether it worked.',
    theory: 'Avoid, or translate fully into plain language. No notation.',
    structurePreference:
      'Outcome-first. Say what the reader will be able to do by the end, then walk there in order.',
    toneGuidance:
      'Warm and patient, never condescending. "This trips up almost everyone" beats "this is simple".',
    opening: 'Open with a real-world scenario the reader already recognizes.',
    benchmark: 'Translate numbers into practical meaning: "about as long as it takes to make coffee".',
    analogies: 'Essential and frequent. Anchor every new concept to something already familiar.',
    length: 'As long as needed, but break it up. Prioritize white space and short paragraphs.',
  },
  mixed: {
    id: 'mixed',
    label: 'Mixed / Layered',
    hint: 'Technical and non-technical readers in one piece.',
    jargon:
      'Layered. Introduce each term in plain language once, then use it freely. Never alternate between defining and assuming.',
    code:
      'Present but skippable. Structure so a non-technical reader can skip every code block and still follow the argument.',
    theory: 'Summarize in prose; put the depth in an aside or a clearly-marked deeper section.',
    structurePreference:
      'Outcome-first with technical depth nested underneath, so each reader can stop at their level.',
    toneGuidance: 'Clear and direct. Do not write to the average of the two readers — serve both explicitly.',
    opening: 'Open with the outcome or stakes, which both audiences share.',
    benchmark: 'Give the number and its plain-language meaning in the same sentence.',
    analogies: 'Use for the concepts the non-technical reader needs; skip for the rest.',
    length: 'Longer than a single-audience piece. Layering costs words.',
  },
};

/**
 * Sensible starting points for the other form controls once an audience is
 * picked. The user can still override any of them — these are defaults, not locks.
 */
export const AUDIENCE_DEFAULTS: Record<
  LongFormAudience,
  { tone: string; depth: string; structure: string }
> = {
  developer: { tone: 'technical', depth: 'intermediate', structure: 'how-to' },
  practitioner: { tone: 'technical', depth: 'advanced', structure: 'analysis' },
  'technical-writer': { tone: 'professional', depth: 'intermediate', structure: 'explanation' },
  beginner: { tone: 'casual', depth: 'beginner', structure: 'tutorial' },
  mixed: { tone: 'professional', depth: 'intermediate', structure: 'narrative' },
};

export const AUDIENCE_IDS = Object.keys(AUDIENCE_PROFILES) as LongFormAudience[];

export function isLongFormAudience(value: unknown): value is LongFormAudience {
  return typeof value === 'string' && (AUDIENCE_IDS as string[]).includes(value);
}

/** Prompt block describing the reader across every calibration dimension. */
export function buildAudienceBlock(audience: LongFormAudience): string {
  const p = AUDIENCE_PROFILES[audience];
  return `
## Reader: ${p.label}
${p.hint}

Calibrate every paragraph to this reader. Where this conflicts with the tone or
depth settings below, this section wins — those describe delivery, this describes
who is on the other end.

- JARGON: ${p.jargon}
- CODE: ${p.code}
- THEORY / MATH: ${p.theory}
- STRUCTURE: ${p.structurePreference}
- TONE: ${p.toneGuidance}
- OPENING: ${p.opening}
- CLAIMS & BENCHMARKS: ${p.benchmark}
- ANALOGIES: ${p.analogies}
- LENGTH: ${p.length}
`.trim();
}
