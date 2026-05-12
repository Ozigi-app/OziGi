/**
 * Audit Stage 4d: Prose pattern audit
 * Scores the draft for structural AI-cadence tells:
 *  - List-of-three density
 *  - "Not X, but Y" / "It's not X, it's Y" constructions
 *  - Paragraph length variance (uniform = AI tell)
 *  - Section-closer summary lines (heading restatement)
 */

import type { AuditFlag, ProseAuditScore } from '@/lib/types/longform';

const LIST_OF_THREE_RE = /\b\w[\w\s,]+(,\s*\w[\w\s]*){2,}\b/g;
const NOT_X_BUT_Y_RE = /\b(?:not\s+just|it'?s?\s+not|rather\s+than)\s+\w[\w\s]*,?\s+but\s+\w/gi;
const SECTION_HEADER_RE = /^#{1,3}\s+(.+)$/m;

function countListsOfThree(text: string): number {
  const sentences = text.split(/(?<=[.!?])\s+/);
  let count = 0;
  for (const s of sentences) {
    const items = s.match(/,\s+[^,]+/g);
    if (items && items.length >= 2) count++;
  }
  return count;
}

function countNotXButY(text: string): number {
  const matches = text.match(NOT_X_BUT_Y_RE);
  return matches ? matches.length : 0;
}

function paragraphLengthCV(text: string): number {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 40 && !p.startsWith('#') && !p.startsWith('```'));
  if (paragraphs.length < 3) return 1;
  const wordCounts = paragraphs.map((p) => p.split(/\s+/).length);
  const mean = wordCounts.reduce((a, b) => a + b, 0) / wordCounts.length;
  const variance = wordCounts.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / wordCounts.length;
  const stdDev = Math.sqrt(variance);
  return mean > 0 ? stdDev / mean : 1;
}

interface Section {
  heading: string;
  body: string;
}

function parseSections(markdown: string): Section[] {
  const sections: Section[] = [];
  const lines = markdown.split('\n');
  let current: Section | null = null;
  for (const line of lines) {
    const hMatch = /^#{1,3}\s+(.+)$/.exec(line);
    if (hMatch) {
      if (current) sections.push(current);
      current = { heading: hMatch[1].trim(), body: '' };
    } else if (current) {
      current.body += line + '\n';
    }
  }
  if (current) sections.push(current);
  return sections;
}

function sectionCloserFlags(sections: Section[]): number {
  let count = 0;
  for (const { heading, body } of sections) {
    const paragraphs = body.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
    const last = paragraphs[paragraphs.length - 1];
    if (!last) continue;
    // Check if the closing sentence restates key words from the heading
    const headingWords = heading.toLowerCase().split(/\W+/).filter((w) => w.length > 4);
    const lastSentence = last.split(/(?<=[.!?])\s+/).pop() || '';
    const matches = headingWords.filter((w) => lastSentence.toLowerCase().includes(w));
    if (matches.length >= 2) count++;
  }
  return count;
}

export function auditProse(draftMarkdown: string): { flags: AuditFlag[]; score: ProseAuditScore } {
  const flags: AuditFlag[] = [];
  const wordCount = draftMarkdown.split(/\s+/).length;

  const listOfThreeCount = countListsOfThree(draftMarkdown);
  const notXButYCount = countNotXButY(draftMarkdown);
  const cv = paragraphLengthCV(draftMarkdown);
  const sections = parseSections(draftMarkdown);
  const sectionCloserCount = sectionCloserFlags(sections);

  // Thresholds from spec
  const listDensity = listOfThreeCount / (wordCount / 100);
  if (listDensity > 2) {
    flags.push({
      type: 'prose-list-of-three',
      severity: 'warning',
      message: `High list-of-three density: ${listOfThreeCount} instances per ~${Math.round(wordCount / 100) * 100} words (threshold: >2 per 100 words)`,
    });
  }

  const notXButYPer500 = notXButYCount / (wordCount / 500);
  if (notXButYPer500 > 1) {
    flags.push({
      type: 'prose-not-x-but-y',
      severity: 'warning',
      message: `${notXButYCount} "not X, but Y" / "it's not X, it's Y" constructions — threshold: >1 per 500 words`,
    });
  }

  if (cv < 0.3 && sections.length >= 3) {
    flags.push({
      type: 'prose-uniform-length',
      severity: 'warning',
      message: `Uniform paragraph length detected (CV=${cv.toFixed(2)}, threshold <0.30) — a common AI structural tell`,
    });
  }

  if (sectionCloserCount > 0) {
    flags.push({
      type: 'prose-section-closer',
      severity: 'warning',
      message: `${sectionCloserCount} section(s) end with a sentence that restates the heading — cut or rewrite these closers`,
    });
  }

  const score: ProseAuditScore = {
    list_of_three_count: listOfThreeCount,
    not_x_but_y_count: notXButYCount,
    paragraph_length_cv: parseFloat(cv.toFixed(3)),
    section_closer_count: sectionCloserCount,
    flagged: flags.length > 0,
  };

  return { flags, score };
}
