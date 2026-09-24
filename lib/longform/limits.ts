/**
 * Input size limits for the long-form pipeline.
 *
 * Why these exist: /api/long-form/generate runs under `maxDuration = 60`
 * (Vercel Hobby's hard ceiling). The route spends up to ~27s on web research
 * before it even calls Vertex, and the brief is injected into the prompt
 * verbatim — see `buildLongFormPrompt`'s "## Source Context" block. An
 * unbounded brief inflates prefill, pushes the model toward more/longer
 * sections, and tips the whole request past 60s.
 *
 * Capping the brief is the only lever that is actually enforceable; the
 * brief generator is also told to stay under BRIEF_SOFT_LIMIT_CHARS, but a
 * user can always paste something longer. Note the brief is NOT the largest
 * part of the prompt — the static instruction blocks run ~28k chars and the
 * web research block up to ~10k, so trimming here has limited leverage.
 */

/** Hard ceiling on the Source Context field. Requests above this are rejected. */
export const MAX_CONTEXT_CHARS = 12_000;

/** Minimum the pipeline needs to produce anything useful. */
export const MIN_CONTEXT_CHARS = 50;

/** Point at which the UI starts warning the user they're getting close. */
export const CONTEXT_WARN_CHARS = 9_000;

/** Target the Technical Brief generator is instructed to write to. */
export const BRIEF_SOFT_LIMIT_CHARS = 7_000;

/** Rough chars-per-word used only for the human-readable counter. */
const CHARS_PER_WORD = 6;

export const MAX_CONTEXT_WORDS = Math.round(MAX_CONTEXT_CHARS / CHARS_PER_WORD);

export function contextTooLongError(length: number): string {
  return `Source context is ${length.toLocaleString()} characters — the limit is ${MAX_CONTEXT_CHARS.toLocaleString()} (about ${MAX_CONTEXT_WORDS.toLocaleString()} words). Trim the brief down to its Key Arguments, Structure, and Research Anchors; longer briefs push generation past the 60s function timeout.`;
}
