/**
 * Audit Stage 4e: Structure / mode-boundary audit
 * -----------------------------------------------
 * Diataxis holds that a page serves exactly one of four reader needs -
 * learning (tutorial), doing (how-to), looking up (reference), or understanding
 * (explanation) - and that pages fail mostly by drifting between them: the
 * tutorial that stops to explain architecture, the reference page that turns
 * into a walkthrough.
 *
 * The generator is told which mode it is writing in. This checks whether the
 * draft actually stayed there. Every check is deliberately high-confidence:
 * a missing structural element, not a stylistic opinion.
 */

import type { AuditFlag } from '@/lib/types/longform';

/** Prose only - code samples are not evidence of mode. */
function stripCode(markdown: string): string {
  return markdown.replace(/```[\s\S]*?```/g, ' ').replace(/`[^`\n]*`/g, ' ');
}

function countMatches(text: string, re: RegExp): number {
  return (text.match(re) || []).length;
}

function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

const ORDERED_ITEM_RE = /^\s*(?:\d+[.)]|step\s+\d+)\s+/gim;
const IMPERATIVE_RE =
  /^\s*(?:Run|Install|Open|Create|Add|Set|Copy|Paste|Navigate|Click|Replace|Update|Deploy|Configure|Import|Export|Save|Start|Stop|Restart|Edit|Download|Clone|Build|Push|Pull)\b/gim;
const VERIFICATION_RE =
  /\b(?:you\s+should\s+see|you'?ll\s+see|expected\s+output|the\s+output\s+(?:should|will)|confirm\s+that|verify\s+that|to\s+check\s+(?:that|it)|if\s+everything\s+worked)\b/gi;
const PREREQ_RE =
  /\b(?:prerequisite|before\s+you\s+(?:begin|start)|you'?ll\s+need|requires?\s+(?:node|python|docker|an?\s+account)|make\s+sure\s+you\s+have)\b/gi;
const EXPLANATION_RE =
  /\b(?:the\s+reason\s+(?:is|for|why)|this\s+is\s+because|historically|conceptually|in\s+theory|under\s+the\s+hood|the\s+trade-?off|why\s+this\s+(?:works|matters))\b/gi;
const STANCE_RE =
  /\b(?:I\s+(?:think|believe|argue|would|have|prefer)|we\s+should|the\s+case\s+(?:for|against)|is\s+(?:wrong|a\s+mistake|overrated|underrated)|stop\s+\w+ing|you\s+should\s+not)\b/gi;
const TABLE_RE = /^\|.+\|\s*$/gm;

/**
 * @param structure The mode the draft was generated in (form value).
 * @returns Flags where the draft left that mode.
 */
export function auditStructure(draftMarkdown: string, structure?: string): AuditFlag[] {
  if (!structure) return [];

  const flags: AuditFlag[] = [];
  const prose = stripCode(draftMarkdown);
  const words = Math.max(1, wordCount(prose));
  const headings = countMatches(draftMarkdown, /^#{2,3}\s+/gm);

  const orderedItems = countMatches(draftMarkdown, ORDERED_ITEM_RE);
  const imperatives = countMatches(draftMarkdown, IMPERATIVE_RE);
  const verifications = countMatches(prose, VERIFICATION_RE);
  const explanations = countMatches(prose, EXPLANATION_RE);

  const isTaskMode = structure === 'how-to' || structure === 'tutorial';

  if (isTaskMode) {
    if (orderedItems < 3 && imperatives < 3) {
      flags.push({
        type: 'mode-boundary',
        severity: 'warning',
        message: `A ${structure} with no step sequence - found ${orderedItems} numbered items and ${imperatives} imperative openers. The reader cannot follow along.`,
      });
    }

    if (verifications === 0) {
      flags.push({
        type: 'mode-boundary',
        severity: 'warning',
        message: `A ${structure} with no verification step - the reader never learns how to tell whether it worked. Add expected output after at least one step.`,
      });
    }

    if (countMatches(prose, PREREQ_RE) === 0) {
      flags.push({
        type: 'mode-boundary',
        severity: 'info',
        message: `A ${structure} with no stated prerequisites - say what the reader needs installed before step one.`,
      });
    }

    // Drift: a task page that spends its length on background.
    if (explanations / (words / 500) > 2.5) {
      flags.push({
        type: 'mode-boundary',
        severity: 'warning',
        message: `This ${structure} keeps stopping to explain why (${explanations} explanatory asides) - move the background into a linked explanation page and keep the steps moving.`,
      });
    }
  }

  if (structure === 'reference') {
    const youDensity = countMatches(prose, /\byou\b/gi) / (words / 100);
    if (youDensity > 2) {
      flags.push({
        type: 'mode-boundary',
        severity: 'warning',
        message: `Reference page reads as a walkthrough (${youDensity.toFixed(1)} uses of "you" per 100 words) - reference is looked up mid-task, not read start to finish. Describe the thing, not the reader's journey.`,
      });
    }
    if (countMatches(draftMarkdown, TABLE_RE) === 0 && headings < 4) {
      flags.push({
        type: 'mode-boundary',
        severity: 'warning',
        message: 'Reference page has no table and fewer than four headings - there is nothing to scan. Structure it for lookup.',
      });
    }
  }

  if (structure === 'explanation') {
    if (orderedItems >= 4 && imperatives >= 3) {
      flags.push({
        type: 'mode-boundary',
        severity: 'warning',
        message: 'Explanation page has drifted into a procedure - move the steps to a how-to and keep this page on why it works.',
      });
    }
  }

  if (structure === 'listicle') {
    if (orderedItems < 3 && headings < 4) {
      flags.push({
        type: 'mode-boundary',
        severity: 'warning',
        message: 'Listicle has no enumerable items - found neither numbered items nor per-item headings.',
      });
    }
  }

  if (structure === 'opinion') {
    if (countMatches(prose, STANCE_RE) === 0) {
      flags.push({
        type: 'mode-boundary',
        severity: 'warning',
        message: 'Opinion piece takes no position - no first-person stance or argumentative claim found. Say what you actually think.',
      });
    }
  }

  if (structure === 'analysis') {
    const numbers = countMatches(prose, /\b\d[\d,.]*%?\b/g);
    if (numbers < 5) {
      flags.push({
        type: 'mode-boundary',
        severity: 'info',
        message: `Analysis with almost no data (${numbers} numeric references) - analysis without evidence is an opinion piece.`,
      });
    }
  }

  return flags;
}
