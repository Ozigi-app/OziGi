import { ANTI_AI_RULES_LONGFORM } from "./anti-ai";
import type { SourceBudgetEntry } from '@/lib/types/longform';

/**
 * Long-form content generation prompt builder
 * CRITICAL: This is separate from buildGenerationPrompt in lib/prompts.ts
 * DO NOT modify buildGenerationPrompt - this is an additive feature
 *
 * v2 Enhancements:
 *  - Web research grounding (Exa + Tavily + Firecrawl)
 *  - In-content markdown links to real, current sources
 *  - High-quality code blocks (with language tags) for technical content
 *  - ASCII / line diagrams for system, flow, and architecture explanations
 *  - Research anchors + audience + key arguments framework (gold-standard quality)
 *  - Depth levels (beginner / intermediate / advanced)
 */

export interface WebSourceSnippet {
  title: string;
  url: string;
  /** Short excerpt or summary of the page (~300-1500 chars). */
  text: string;
  /** Optional published date if known (ISO string). */
  publishedAt?: string;
}

export interface WebResearchBundle {
  /** The query strings used to gather these results (1-3). */
  queries: string[];
  /** All harvested sources, deduped by URL. */
  sources: WebSourceSnippet[];
}

export type LongFormDepth = 'beginner' | 'intermediate' | 'advanced';

export interface LongFormParams {
  context: string;
  personaVoice?: string;
  tone: 'professional' | 'casual' | 'technical' | 'storytelling';
  targetLength: number; // word count target
  structure: 'narrative' | 'listicle' | 'how-to' | 'opinion' | 'analysis';
  additionalInstructions?: string;
  /** Optional research bundle gathered from the live web. */
  research?: WebResearchBundle;
  /** Reader expertise level - drives depth and assumed knowledge. */
  depth?: LongFormDepth;
  /** Verified source budget from Stage 2 — when present, Stage 3 constraints are injected. */
  verifiedSourceBudget?: SourceBudgetEntry[];
  /** Plan ID linking this draft to a Stage 1 plan. */
  planId?: string;
}

export interface LongFormCodeBlock {
  /** Programming language (e.g. "javascript", "python", "bash") or "text"/"diagram" for ASCII. */
  language: string;
  /** Human-readable caption explaining what the snippet does. */
  caption?: string;
  /** Raw code content. */
  code: string;
}

export interface LongFormSection {
  heading: string;
  /** Markdown content. May include inline links, code fences, ASCII diagrams. */
  content: string;
  wordCount: number;
  /** Optional standalone code/diagram exhibits attached to this section. */
  codeBlocks?: LongFormCodeBlock[];
}

export interface LongFormReference {
  title: string;
  url: string;
  /** 1-2 sentence note on why this source matters / what it supports. */
  note?: string;
}

export interface LongFormOutput {
  title: string;
  subtitle?: string;
  sections: LongFormSection[];
  totalWordCount: number;
  /** External sources cited or linked from the article. */
  references?: LongFormReference[];
  metadata: {
    tone: string;
    structure: string;
    depth?: LongFormDepth;
    webResearch?: boolean;
    generatedAt: string;
  };
}

const TONE_INSTRUCTIONS: Record<LongFormParams['tone'], string> = {
  professional: `
    Authoritative, polished, precise. Use industry-standard terminology and stay objective.
    No filler, no hedging. Avoid contractions and casual asides.
    Lead with insight, not throat-clearing.
  `,
  casual: `
    Conversational, direct, human. Use contractions and address the reader as "you".
    Vary sentence length for rhythm. A small dose of personality is welcome.
    Still substantive — casual is not the same as fluffy.
  `,
  technical: `
    Technically rigorous and specific. Use exact terminology, version numbers, and API names where relevant.
    Show, don't tell — prefer code examples, command output, and concrete benchmarks over abstractions.
    Never speculate on technical mechanics; if uncertain, say so explicitly.
  `,
  storytelling: `
    Narrative-first, with a strong hook and emotional throughline.
    Use scenes, characters, and concrete detail to ground abstract ideas.
    Build tension and pay it off in the conclusion.
  `,
};

const STRUCTURE_INSTRUCTIONS: Record<LongFormParams['structure'], string> = {
  narrative: `
    Flowing prose with a clear arc:
    - Hook -> rising context -> central thesis -> evidence -> conclusion.
    - Smooth transitions, no bullet-point dumps as the primary mechanism.
    - The piece should feel inevitable in retrospect.
  `,
  listicle: `
    Numbered list of substantive items:
    - 100-150 word intro framing the list and stakes.
    - Each item: clear heading, 150-300 words of explanation, ideally one example or actionable takeaway.
    - Items should be ordered by importance or logical sequence, not alphabetically.
  `,
  'how-to': `
    Instructional guide:
    - State the outcome the reader will achieve.
    - List prerequisites (tools, accounts, prior knowledge).
    - Numbered, sequential steps. Each step is testable / verifiable.
    - Include common pitfalls and how to recover.
    - Close with verification + next steps.
  `,
  opinion: `
    Persuasive op-ed:
    - Lead with a sharp, specific thesis.
    - Steelman the opposing view before dismantling it.
    - Build the case with evidence + reasoning + concrete examples.
    - End with a call to action or pointed conclusion.
  `,
  analysis: `
    Deep analytical piece:
    - Establish why this matters now.
    - State your analytical framework.
    - Examine multiple facets / perspectives with data and primary sources.
    - Identify patterns and second-order implications.
    - Conclude with predictions or open questions.
  `,
};

const DEPTH_INSTRUCTIONS: Record<LongFormDepth, string> = {
  beginner: `
    Reader is new to this topic.
    - Define every non-obvious term the first time it appears.
    - Use analogies that connect to everyday experience.
    - Prefer simple, complete examples over partial advanced ones.
    - Avoid assumed prior knowledge of frameworks, jargon, or insider context.
  `,
  intermediate: `
    Reader has working familiarity with the broader domain but not this specific topic.
    - Skip 101-level definitions; reference standard concepts by name.
    - Focus on patterns, trade-offs, and practical decision frameworks.
    - Code examples should be runnable and idiomatic, not toy snippets.
  `,
  advanced: `
    Reader is a practitioner or specialist.
    - Assume fluency with core concepts, vocabulary, and tooling.
    - Engage with edge cases, performance characteristics, internals, and second-order effects.
    - Cite specifications, RFCs, source code, or primary research where relevant.
    - Avoid restating common knowledge; go where shallow articles refuse to.
  `,
};

/**
 * Format a research bundle into a compact, model-friendly block.
 * We intentionally cap each snippet so a 6-source bundle fits comfortably
 * even with a long user context.
 */
function formatResearchBlock(research: WebResearchBundle): string {
  if (!research.sources?.length) return '';

  const queries = research.queries.length
    ? `Queries used: ${research.queries.map((q) => `"${q}"`).join(', ')}`
    : '';

  const sourceLines = research.sources.slice(0, 8).map((s, i) => {
    const snippet = (s.text || '').replace(/\s+/g, ' ').trim().slice(0, 1200);
    const date = s.publishedAt ? ` (${s.publishedAt.slice(0, 10)})` : '';
    return `[S${i + 1}] ${s.title}${date}\nURL: ${s.url}\nExcerpt: ${snippet}`;
  });

  return `
## Live Web Research (use as ground truth)
${queries}

You have been given the following CURRENT sources gathered from the live web.
Treat these as primary evidence — quote, cite, and link them naturally inside the article.
When you reference a fact, statistic, claim, or quote that came from these sources,
you MUST link to it inline using markdown: [anchor text](URL).
Every source you actually use should also appear in the "references" array of the output.

${sourceLines.join('\n\n')}
`.trim();
}

const QUALITY_BAR = `
## Quality Bar (non-negotiable)

You are writing for a discerning reader who will close the tab the moment the writing feels generic.
Hit every one of these:

1. SPECIFICITY OVER GENERALITY. Every paragraph must contain at least one concrete artifact:
   a real product, version number, statistic, quote, command, file path, person, year, or example.
   Sentences like "many companies struggle with X" are banned unless followed by a specific case.

2. INLINE LINKS. When you cite a study, product, doc, blog post, RFC, or news item, link it
   inline using markdown: [anchor text](https://...). The link target must be a real URL —
   prefer URLs from the Live Web Research block when available. Do NOT invent URLs.

3. CODE & COMMANDS (technical or how-to content). Use fenced code blocks with explicit language tags:
   \`\`\`javascript ... \`\`\`, \`\`\`python ... \`\`\`, \`\`\`bash ... \`\`\`, \`\`\`tsx ... \`\`\`, \`\`\`sql ... \`\`\`.
   Code must be runnable, idiomatic, and minimally complete — no "// ... rest of code" cop-outs.
   Each non-trivial snippet gets a one-sentence lead-in explaining what it does.

4. ASCII / LINE DIAGRAMS for systems, flows, and architecture. Use a fenced block with language
   "diagram" or "text", and standard box-and-arrow conventions:

   \`\`\`diagram
   ┌──────────────┐      ┌──────────────┐      ┌──────────────┐
   │   Client     │ ───▶ │   API        │ ───▶ │   Database   │
   └──────────────┘      └──────────────┘      └──────────────┘
                                │
                                ▼
                          ┌──────────────┐
                          │   Cache      │
                          └──────────────┘
   \`\`\`

   Use them whenever you describe a flow, an architecture, a data structure, or a sequence.
   Diagrams must be ASCII-aligned in monospace; do NOT use HTML/SVG.

5. STRUCTURE WITH MARKDOWN INSIDE CONTENT. Each section's "content" field is markdown:
   - Use **bold** for emphasis on key terms (sparingly).
   - Use \`inline code\` for identifiers, commands, file names.
   - Use lists when the content is genuinely list-shaped.
   - Use blockquotes (> ...) for direct quotes from sources.

6. NO STALE CLICHÉS. Banned phrases (and their cousins): "in today's fast-paced world",
   "in the digital age", "game-changer", "revolutionize", "leverage synergies",
   "unlock the power of", "in conclusion". Replace with specific, fresh framing.

7. EARN THE WORD COUNT. The reader's attention is the budget. If a paragraph isn't paying it back
   in insight, cut it. Length should serve depth, never the other way around.
`.trim();

const REFERENCES_INSTRUCTION = `
## References Output

After writing the article, populate the "references" array with every external URL you actually
linked to in the body. Each entry: { "title": "...", "url": "...", "note": "1-2 sentence reason this source matters" }.
Order them in the rough order they first appear in the article.
If no external sources were used, return references as an empty array.
`.trim();

/** Stage 3 constraints injected when a verified source budget is available. */
function buildStage3Constraints(budget: SourceBudgetEntry[]): string {
  const budgetLines = budget
    .filter((e) => e.status === 'resolved' || e.status === 'redirected')
    .map(
      (e) =>
        `  { "url": "${e.url}", "status": "${e.status}", "supports_claims": ${JSON.stringify(e.supports_claims)} }`
    )
    .join(',\n');

  return `
## Stage 3 Citation Constraints (enforced — do not override)

You are writing from a verified source budget. The following rules are absolute:

1. CITATION CLOSURE. You may ONLY cite URLs present in the verified source budget below.
   If a claim cannot be supported by a budget source, write it as an unsourced opinion in
   the author's voice or omit it. Do NOT invent URLs, authors, or institutions.

2. AUTHORITY APPEAL BAN. Do not refer to named individuals as authorities
   ("the work of X", "according to Y", "as Z explains") unless that individual's name or
   website appears explicitly in the source budget. Generic appeals ("industry analysts",
   "security researchers") are acceptable.

3. CODE-BLOCK DISCIPLINE. Any code block must be either:
   (a) A verbatim copy from a source in the budget, or
   (b) Authored by you — preceded by a \`<!-- AUTHORED -->\` comment on the line before the fence.
   For authored code: do NOT include cryptographic hashes, HMAC signatures, JWT tokens, or
   any value that requires computation. Use the literal placeholder \`<COMPUTED_AT_VALIDATION>\`
   instead. These will be reviewed and replaced before publication.

4. VERIFIED SOURCE BUDGET (inject inline citations only from this list):

[
${budgetLines}
]
`.trim();
}

export function buildLongFormPrompt({
  context,
  personaVoice,
  tone,
  targetLength,
  structure,
  additionalInstructions,
  research,
  depth = 'intermediate',
  verifiedSourceBudget,
}: LongFormParams): string {
  const toneInstructions = TONE_INSTRUCTIONS[tone];
  const structureInstructions = STRUCTURE_INSTRUCTIONS[structure];
  const depthInstructions = DEPTH_INSTRUCTIONS[depth];
  const researchBlock = research ? formatResearchBlock(research) : '';
  const stage3Block = verifiedSourceBudget?.length
    ? buildStage3Constraints(verifiedSourceBudget)
    : '';

  const personaSection = personaVoice
    ? `## Voice / Persona\nWrite in the voice of: ${personaVoice.substring(0, 400)}\nMatch their cadence and characteristic phrasing without parodying them.`
    : '';

  const sectionTarget = Math.max(3, Math.min(9, Math.round(targetLength / 350)));

  return `# LONG-FORM ARTICLE GENERATION

You are an elite long-form writer producing a publication-grade article (~${targetLength} words).
Your output will be parsed as JSON and rendered with full markdown support, including code
blocks with syntax highlighting and ASCII diagrams in monospace. Plan accordingly.

## Source Context (the writer's brief)
${context}

${researchBlock}

${stage3Block}

${personaSection}

## Tone: ${tone}
${toneInstructions}

## Structure: ${structure}
${structureInstructions}

## Depth: ${depth}
${depthInstructions}

${QUALITY_BAR}

${ANTI_AI_RULES_LONGFORM}

${REFERENCES_INSTRUCTION}

## Section Plan

Aim for roughly ${sectionTarget} sections of substantive length (~${Math.round(targetLength / sectionTarget)} words each).
Section headings should be specific and descriptive — never generic ("Introduction", "Conclusion",
"Background" alone). A reader skimming the headings should be able to summarize the article.

${additionalInstructions ? `## Additional Requirements\n${additionalInstructions}` : ''}

## Output Format

Return a SINGLE valid JSON object — no prose before or after, no markdown fences around the JSON.
Schema:

\`\`\`json
{
  "title": "string — sharp, specific, scannable. No clickbait, no colons-overloaded patterns.",
  "subtitle": "string — one-line dek that makes the promise concrete.",
  "sections": [
    {
      "heading": "string — specific H2",
      "content": "string — markdown body for this section. May contain inline [links](url), \`inline code\`, **bold**, lists, blockquotes, fenced code blocks (\\\`\\\`\\\`lang ... \\\`\\\`\\\`), and ASCII diagrams (\\\`\\\`\\\`diagram ... \\\`\\\`\\\`). Newlines are preserved.",
      "wordCount": 0
    }
  ],
  "references": [
    { "title": "string", "url": "https://...", "note": "string" }
  ],
  "totalWordCount": 0
}
\`\`\`

Critical rules:
- Output JSON only. No surrounding commentary.
- Inside string values, escape newlines as \\n and double quotes as \\".
- Do NOT wrap the entire response in a markdown code fence.
- Total length should land within ±15% of ${targetLength} words.
- Every URL in "references" must also appear as an inline link inside at least one section's content.

Begin.`.trim();
}

/**
 * Parse the LLM response into structured long-form output
 */
export function parseLongFormResponse(response: string): LongFormOutput | null {
  try {
    let jsonStr = response.trim();

    // Remove markdown code blocks if present
    const codeBlockMatch = jsonStr.match(/^```(?:json)?\s*([\s\S]*?)```\s*$/);
    if (codeBlockMatch) {
      jsonStr = codeBlockMatch[1].trim();
    }

    // Find the first complete JSON object
    const firstBrace = jsonStr.indexOf('{');
    if (firstBrace === -1) {
      console.error('[LongForm] No JSON object found in response');
      return null;
    }

    // Find matching closing brace, respecting strings + escapes
    let braceCount = 0;
    let lastBrace = -1;
    let inString = false;
    let escaped = false;
    for (let i = firstBrace; i < jsonStr.length; i++) {
      const ch = jsonStr[i];
      if (escaped) { escaped = false; continue; }
      if (ch === '\\' && inString) { escaped = true; continue; }
      if (ch === '"') { inString = !inString; continue; }
      if (inString) continue;
      if (ch === '{') braceCount++;
      else if (ch === '}') {
        braceCount--;
        if (braceCount === 0) {
          lastBrace = i;
          break;
        }
      }
    }

    if (lastBrace === -1) {
      console.error('[LongForm] Incomplete JSON object - missing closing brace');
      return null;
    }

    jsonStr = jsonStr.substring(firstBrace, lastBrace + 1);

    // Clean up trailing commas
    jsonStr = jsonStr.replace(/,(\s*[}\]])/g, '$1');

    const parsed = JSON.parse(jsonStr);

    if (!parsed.title || !Array.isArray(parsed.sections)) {
      console.error('[LongForm] Invalid response structure - missing title or sections');
      return null;
    }

    const sections: LongFormSection[] = parsed.sections.map((s: any) => {
      const content = String(s.content || '');
      return {
        heading: String(s.heading || ''),
        content,
        wordCount:
          typeof s.wordCount === 'number'
            ? s.wordCount
            : content.split(/\s+/).filter(Boolean).length,
        codeBlocks: Array.isArray(s.codeBlocks)
          ? s.codeBlocks
              .filter((cb: any) => cb && typeof cb.code === 'string')
              .map((cb: any) => ({
                language: String(cb.language || 'text'),
                caption: cb.caption ? String(cb.caption) : undefined,
                code: String(cb.code),
              }))
          : undefined,
      };
    });

    const references: LongFormReference[] = Array.isArray(parsed.references)
      ? parsed.references
          .filter(
            (r: any) =>
              r &&
              typeof r.url === 'string' &&
              /^https?:\/\//i.test(r.url) &&
              typeof r.title === 'string' &&
              r.title.trim().length > 0
          )
          .map((r: any) => ({
            title: String(r.title).trim(),
            url: String(r.url).trim(),
            note: r.note ? String(r.note).trim() : undefined,
          }))
      : [];

    return {
      title: String(parsed.title),
      subtitle: parsed.subtitle ? String(parsed.subtitle) : undefined,
      sections,
      totalWordCount:
        typeof parsed.totalWordCount === 'number'
          ? parsed.totalWordCount
          : sections.reduce((sum, s) => sum + (s.wordCount || 0), 0),
      references: references.length > 0 ? references : undefined,
      metadata: {
        tone: parsed.metadata?.tone || 'unknown',
        structure: parsed.metadata?.structure || 'unknown',
        depth: parsed.metadata?.depth,
        webResearch: parsed.metadata?.webResearch,
        generatedAt: new Date().toISOString(),
      },
    };
  } catch (error) {
    console.error('[LongForm] Failed to parse response:', error);
    return null;
  }
}

/**
 * Extract candidate research queries from the user's context.
 * Used as a fallback when we want to do web research but don't want to
 * burn an extra LLM call. Pulls a few high-signal noun phrases.
 */
export function extractFallbackQueries(context: string, max = 3): string[] {
  const cleaned = context.replace(/\s+/g, ' ').trim();
  if (!cleaned) return [];

  // Take the first sentence as the primary query (most important context).
  const firstSentence = cleaned.split(/(?<=[.!?])\s+/)[0]?.slice(0, 180) ?? '';
  const queries = new Set<string>();
  if (firstSentence.length > 12) queries.add(firstSentence);

  // Pull capitalized phrases (likely product/proper nouns).
  const properNounMatches = cleaned.match(/\b([A-Z][a-zA-Z0-9.+]+(?:\s+[A-Z][a-zA-Z0-9.+]+){0,3})\b/g);
  if (properNounMatches) {
    for (const m of properNounMatches) {
      if (queries.size >= max) break;
      if (m.length > 4 && m.length < 80) queries.add(m);
    }
  }

  // If we still have room, add a longer chunk for breadth.
  if (queries.size < max) {
    queries.add(cleaned.slice(0, 220));
  }

  return Array.from(queries).slice(0, max);
}
