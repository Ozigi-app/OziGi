/**
 * Audit Stage 4f: Audience calibration audit
 * ------------------------------------------
 * The engine could already tell you a draft was sloppy. It could not tell you
 * the draft was aimed at the wrong reader - a beginner tutorial that assumes
 * fluency, a developer guide with no code in it, a reproducibility piece with
 * no method.
 *
 * This infers the reader the draft actually serves from signals in the text and
 * compares that against the reader the writer asked for. Signal-based, not
 * model-based, so it runs inside the fast audit budget.
 *
 * Profiles live in lib/prompts/audience.ts - the same source the prompt uses,
 * so the check and the instruction cannot drift apart.
 */

import type { AuditFlag, LongFormAudience } from '@/lib/types/longform';
import { isLongFormAudience, AUDIENCE_PROFILES } from '@/lib/prompts/audience';

interface AudienceSignals {
  words: number;
  codeBlocks: number;
  /** Inline code spans + acronyms, per 100 words. */
  jargonDensity: number;
  /** Places a term is actually explained rather than assumed. */
  definitionMarkers: number;
  analogyMarkers: number;
  methodologyMarkers: number;
  /** Line-level walkthrough of a snippet, which beginners need and developers don't. */
  codeWalkthroughMarkers: number;
  numericClaims: number;
  /** "fast", "lightweight" etc. in a sentence containing no number. */
  unqualifiedPerfClaims: number;
}

const DEFINITION_RE =
  /\b(?:which\s+means|in\s+other\s+words|that\s+is,|put\s+simply|simply\s+put|refers\s+to|stands\s+for|is\s+short\s+for|think\s+of\s+(?:it|this)\s+as|known\s+as)\b/gi;
const ANALOGY_RE =
  /\b(?:like\s+a\s+\w+|similar\s+to\s+(?:a|an|how)|the\s+same\s+way\s+(?:a|an|that)|imagine\s+(?:a|an|you)|akin\s+to|it'?s\s+basically\s+a)\b/gi;
const METHODOLOGY_RE =
  /\b(?:dataset|sample\s+size|baseline|hyper-?parameter|reproduc(?:e|ible|ibility)|variance|standard\s+deviation|random\s+seed|ablation|held-?out|cross-?validat)/gi;
const CODE_WALKTHROUGH_RE =
  /\b(?:the\s+first\s+line|this\s+line|on\s+line\s+\d|the\s+(?:first|second|third)\s+argument|line\s+by\s+line|each\s+parameter)\b/gi;
const PERF_WORD_RE = /\b(?:fast|faster|fastest|slow|slower|quick|quickly|performant|lightweight|efficient|blazing|snappy)\b/i;

function stripFences(markdown: string): string {
  return markdown.replace(/```[\s\S]*?```/g, ' ');
}

function collectSignals(markdown: string): AudienceSignals {
  const prose = stripFences(markdown);
  const words = Math.max(1, prose.split(/\s+/).filter(Boolean).length);

  const codeBlocks = (markdown.match(/```[^\n]*\n[\s\S]*?```/g) || []).length;
  const inlineCode = (prose.match(/`[^`\n]+`/g) || []).length;
  const acronyms = (prose.match(/\b[A-Z]{2,6}\b/g) || []).length;

  // Unqualified performance claims: a speed word in a sentence with no number.
  let unqualifiedPerfClaims = 0;
  for (const sentence of prose.split(/(?<=[.!?])\s+/)) {
    if (PERF_WORD_RE.test(sentence) && !/\d/.test(sentence)) unqualifiedPerfClaims++;
  }

  return {
    words,
    codeBlocks,
    jargonDensity: (inlineCode + acronyms) / (words / 100),
    definitionMarkers: (prose.match(DEFINITION_RE) || []).length,
    analogyMarkers: (prose.match(ANALOGY_RE) || []).length,
    methodologyMarkers: (prose.match(METHODOLOGY_RE) || []).length,
    codeWalkthroughMarkers: (prose.match(CODE_WALKTHROUGH_RE) || []).length,
    numericClaims: (prose.match(/\b\d[\d,.]*\s*(?:%|ms|s\b|MB|GB|x\b)/gi) || []).length,
    unqualifiedPerfClaims,
  };
}

/**
 * @param audience The reader the writer asked for.
 * @param structure Generation mode, used where a check only applies to task content.
 */
export function auditAudience(
  draftMarkdown: string,
  audience?: string,
  structure?: string
): AuditFlag[] {
  if (!isLongFormAudience(audience)) return [];

  const flags: AuditFlag[] = [];
  const s = collectSignals(draftMarkdown);
  const profile = AUDIENCE_PROFILES[audience as LongFormAudience];
  const isTaskMode = structure === 'how-to' || structure === 'tutorial' || structure === 'reference';

  if (audience === 'beginner') {
    if (s.jargonDensity > 3 && s.definitionMarkers < 3) {
      flags.push({
        type: 'audience-mismatch',
        severity: 'warning',
        message: `Written for ${profile.label}, but reads for a developer: ${s.jargonDensity.toFixed(1)} technical terms per 100 words with only ${s.definitionMarkers} of them explained. Define each term where it first appears.`,
      });
    }
    if (s.codeBlocks > 0 && s.codeWalkthroughMarkers === 0) {
      flags.push({
        type: 'audience-mismatch',
        severity: 'warning',
        message: `${s.codeBlocks} code block(s) with no line-level explanation. A beginner cannot tell which part they are supposed to change.`,
      });
    }
    if (s.analogyMarkers === 0 && s.words > 600) {
      flags.push({
        type: 'audience-mismatch',
        severity: 'info',
        message: 'No analogies anywhere in a beginner piece - anchor at least the central concept to something the reader already knows.',
      });
    }
  }

  if (audience === 'developer') {
    if (s.codeBlocks === 0 && isTaskMode) {
      flags.push({
        type: 'audience-mismatch',
        severity: 'warning',
        message: `Written for ${profile.label} as a ${structure}, but contains no code. This reader came for something to copy.`,
      });
    }
    if (s.analogyMarkers >= 5) {
      flags.push({
        type: 'audience-mismatch',
        severity: 'info',
        message: `${s.analogyMarkers} analogies in a piece for ${profile.label} - this reader wants the mechanism, not a metaphor for it.`,
      });
    }
  }

  if (audience === 'practitioner') {
    if (s.methodologyMarkers === 0 && s.numericClaims < 3) {
      flags.push({
        type: 'audience-mismatch',
        severity: 'warning',
        message: `Written for ${profile.label}, but states no methodology and almost no measurements. This reader evaluates the method before the conclusion.`,
      });
    }
  }

  // Applies to every reader who evaluates claims rather than taking them.
  if (audience !== 'beginner' && s.unqualifiedPerfClaims >= 3) {
    flags.push({
      type: 'audience-mismatch',
      severity: 'info',
      message: `${s.unqualifiedPerfClaims} performance claims with no number attached ("fast", "lightweight"). Attach a measurement and the setup it came from.`,
    });
  }

  return flags;
}
