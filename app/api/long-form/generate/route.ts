// Vercel Hobby caps at 60s. Long-form + web research routinely runs 30-55s
// on its own, which means the lexicon repair retry will rarely fire on Hobby
// — we ship the original with `lexiconWarnings` instead of timing out.
// Upgrade to Pro to raise this to 300s and let retries run reliably.
export const maxDuration = 60;

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { getPlanStatus, incrementLongFormUsed } from '@/lib/plan';
import { getVertexAIClient } from '@/lib/genai-client';
import {
  buildLongFormPrompt,
  parseLongFormResponse,
  extractFallbackQueries,
  type LongFormParams,
  type LongFormDepth,
  type WebResearchBundle,
  type WebSourceSnippet,
} from '@/lib/prompts/long-form';
import { containsPromptInjection } from '@/lib/prompts';
import {
  validateLongForm,
  buildRepairDirective,
  summarizeForClient,
} from '@/lib/prompts/lexicon-validator';
import { searchWebWithExa } from '@/lib/exa';
import { searchWeb as searchTavily } from '@/lib/search';
import { fetchPageContent } from '@/lib/firecrawl';
import { runFastAudit } from '@/lib/longform/audit';
import type { SourceBudgetEntry } from '@/lib/types/longform';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// Rate limits: 5/day for Org, unlimited for Enterprise
const orgRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, '24 h'),
  prefix: 'longform:org',
});

// ---------------------------------------------------------------------------
// Web research helpers
// ---------------------------------------------------------------------------

const RESEARCH_TIMEOUT_MS = 12_000;
const FIRECRAWL_PER_URL_TIMEOUT_MS = 15_000;
const MAX_SOURCES = 8;
const MAX_FIRECRAWL_URLS = 3;
const MAX_QUERIES_PER_PROVIDER = 2;

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      console.warn(`[LongForm][research] ${label} timed out after ${ms}ms`);
      resolve(null);
    }, ms);
    p.then((value) => {
      clearTimeout(timer);
      resolve(value);
    }).catch((err) => {
      clearTimeout(timer);
      console.warn(`[LongForm][research] ${label} failed:`, err?.message || err);
      resolve(null);
    });
  });
}

/**
 * Use Vertex AI to derive 2-3 high-signal search queries from the user's context.
 * Falls back to a heuristic extractor if the model call fails.
 */
async function deriveResearchQueries(context: string): Promise<string[]> {
  try {
    const client = await getVertexAIClient();
    const response = await client.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `From the following article brief, output 2 to 3 specific web search queries
(no longer than 12 words each) that would surface the most useful CURRENT sources for the writer.
Return a JSON array of strings only, no commentary.

Brief:
"""
${context.slice(0, 4000)}
"""

JSON array only. Example: ["query one", "query two", "query three"]`,
            },
          ],
        },
      ],
      config: { temperature: 0.2, maxOutputTokens: 256 },
    });

    let text = '';
    if ((response as any).text) {
      const t = (response as any).text;
      text = typeof t === 'function' ? t() : t;
    } else if (response.candidates?.[0]?.content?.parts?.[0]?.text) {
      text = response.candidates[0].content.parts[0].text;
    }

    const arrMatch = text.match(/\[[\s\S]*\]/);
    if (arrMatch) {
      const parsed = JSON.parse(arrMatch[0]);
      if (Array.isArray(parsed)) {
        const cleaned = parsed
          .map((q) => String(q).trim())
          .filter((q) => q.length > 4 && q.length < 200)
          .slice(0, 3);
        if (cleaned.length > 0) return cleaned;
      }
    }
  } catch (err: any) {
    console.warn('[LongForm][research] query derivation failed, using heuristic:', err?.message || err);
  }
  return extractFallbackQueries(context, 3);
}

/**
 * Run Exa + Tavily searches in parallel for each query, dedupe, and return top sources.
 */
async function gatherSearchResults(queries: string[]): Promise<WebSourceSnippet[]> {
  const limited = queries.slice(0, MAX_QUERIES_PER_PROVIDER);

  const exaPromises = limited.map((q) =>
    withTimeout(searchWebWithExa(q), RESEARCH_TIMEOUT_MS, `exa(${q})`)
  );

  const tavilyPromises = limited.map((q) =>
    withTimeout(searchTavily(q), RESEARCH_TIMEOUT_MS, `tavily(${q})`)
  );

  const [exaResults, tavilyResults] = await Promise.all([
    Promise.all(exaPromises),
    Promise.all(tavilyPromises),
  ]);

  const dedup = new Map<string, WebSourceSnippet>();

  // Exa results
  for (const batch of exaResults) {
    if (!batch) continue;
    for (const r of batch) {
      if (!r?.url) continue;
      const url = r.url.trim();
      if (dedup.has(url)) continue;
      dedup.set(url, {
        title: r.title || url,
        url,
        text: r.text || '',
      });
    }
  }

  // Tavily results
  for (const batch of tavilyResults) {
    if (!batch || typeof batch !== 'object') continue;
    const items: any[] = Array.isArray(batch.results) ? batch.results : [];
    for (const r of items) {
      if (!r?.url) continue;
      const url = String(r.url).trim();
      if (dedup.has(url)) continue;
      dedup.set(url, {
        title: r.title || url,
        url,
        text: r.content || r.snippet || '',
        publishedAt: r.published_date || undefined,
      });
    }
  }

  return Array.from(dedup.values()).slice(0, MAX_SOURCES);
}

/**
 * Enrich the top sources with Firecrawl-scraped page content for richer grounding.
 */
async function enrichWithFirecrawl(
  sources: WebSourceSnippet[]
): Promise<WebSourceSnippet[]> {
  if (sources.length === 0) return sources;

  const topN = Math.min(MAX_FIRECRAWL_URLS, sources.length);
  const enriched = [...sources];

  const tasks = sources.slice(0, topN).map(async (source, idx) => {
    const md = await withTimeout(
      fetchPageContent(source.url),
      FIRECRAWL_PER_URL_TIMEOUT_MS,
      `firecrawl(${source.url})`
    );
    if (md && md.length > 0) {
      // Replace text with scraped content (capped) — much richer than search snippet
      enriched[idx] = {
        ...source,
        text: md.slice(0, 4000),
      };
    }
  });

  await Promise.all(tasks);
  return enriched;
}

async function runWebResearch(context: string): Promise<WebResearchBundle | null> {
  try {
    const queries = await deriveResearchQueries(context);
    if (queries.length === 0) return null;

    console.log('[LongForm][research] queries:', queries);

    const initial = await gatherSearchResults(queries);
    console.log(`[LongForm][research] gathered ${initial.length} unique sources`);

    if (initial.length === 0) return null;

    const enriched = await enrichWithFirecrawl(initial);

    return {
      queries,
      sources: enriched,
    };
  } catch (err: any) {
    console.error('[LongForm][research] fatal error:', err?.message || err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

// Hard budget for the route, sized for Vercel Hobby's 60s function cap.
// Leaves ~5s for DB persist + JSON return.
const LONGFORM_BUDGET_MS = 55_000;
// Minimum runtime headroom before we'll START a repair retry. On Hobby
// long-form often consumes 30-55s on its own, so the retry will rarely
// fire — we ship the original with `lexiconWarnings` instead of timing out.
const LONGFORM_RETRY_MIN_REMAINING_MS = 30_000;

export async function POST(req: Request) {
  const routeStartTime = Date.now();
  try {
    const cookieStore = await cookies();

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: (cookies) =>
            cookies.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            ),
        },
      }
    );

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Plan check — all plans get long-form (1/mo on free/starter/growth, unlimited on pro/enterprise)
    const planStatus = await getPlanStatus(user.id);
    if (!planStatus.hasLongForm) {
      return NextResponse.json(
        {
          error: 'You have used your long-form article for this month. Upgrade to Pro for unlimited.',
          currentPlan: planStatus.plan,
          longFormUsed: planStatus.longFormUsed,
          longFormLimit: planStatus.longFormLimit,
        },
        { status: 403 }
      );
    }

    // Rate limit Pro users (daily cap to prevent abuse on unlimited tier)
    if (planStatus.plan === 'pro') {
      const { success, remaining } = await orgRatelimit.limit(user.id);
      if (!success) {
        return NextResponse.json(
          {
            error: 'Daily limit reached. You can generate 5 long-form articles per day.',
            remaining: 0,
          },
          { status: 429 }
        );
      }
      console.log(`[LongForm] Pro user ${user.id} has ${remaining} generations remaining today`);
    }

    const body = await req.json();
    const {
      context,
      personaVoice,
      tone = 'professional',
      targetLength = 1500,
      structure = 'narrative',
      additionalInstructions,
      enableWebResearch = false,
      depth = 'intermediate',
      planId,
      verifiedSourceBudget,
    } = body;

    if (!context || typeof context !== 'string' || context.trim().length < 50) {
      return NextResponse.json(
        { error: 'Context must be at least 50 characters' },
        { status: 400 }
      );
    }

    if (containsPromptInjection(context) || containsPromptInjection(additionalInstructions)) {
      return NextResponse.json({ error: 'Invalid input detected' }, { status: 400 });
    }

    const validTones = ['professional', 'casual', 'technical', 'storytelling'];
    const validStructures = ['narrative', 'listicle', 'how-to', 'opinion', 'analysis'];
    const validDepths: LongFormDepth[] = ['beginner', 'intermediate', 'advanced'];

    if (!validTones.includes(tone)) {
      return NextResponse.json(
        { error: `Invalid tone. Must be one of: ${validTones.join(', ')}` },
        { status: 400 }
      );
    }
    if (!validStructures.includes(structure)) {
      return NextResponse.json(
        { error: `Invalid structure. Must be one of: ${validStructures.join(', ')}` },
        { status: 400 }
      );
    }
    if (!validDepths.includes(depth)) {
      return NextResponse.json(
        { error: `Invalid depth. Must be one of: ${validDepths.join(', ')}` },
        { status: 400 }
      );
    }
    if (targetLength < 500 || targetLength > 8000) {
      return NextResponse.json(
        { error: 'Target length must be between 500 and 8,000 words' },
        { status: 400 }
      );
    }

    // ---------------------------------------------------------------------
    // Optional web research phase
    // ---------------------------------------------------------------------
    let research: WebResearchBundle | null = null;
    if (enableWebResearch) {
      console.log(`[LongForm] Starting web research for user ${user.id}`);
      const t0 = Date.now();
      research = await runWebResearch(context.trim());
      const dt = Date.now() - t0;
      console.log(
        `[LongForm] Web research finished in ${dt}ms — ${
          research?.sources?.length ?? 0
        } sources`
      );
    }

    // ---------------------------------------------------------------------
    // Build prompt
    // ---------------------------------------------------------------------
    const prompt = buildLongFormPrompt({
      context: context.trim(),
      personaVoice: personaVoice?.trim() || undefined,
      tone: tone as LongFormParams['tone'],
      targetLength,
      structure: structure as LongFormParams['structure'],
      additionalInstructions: additionalInstructions?.trim() || undefined,
      research: research ?? undefined,
      depth: depth as LongFormDepth,
      verifiedSourceBudget: Array.isArray(verifiedSourceBudget) ? verifiedSourceBudget as SourceBudgetEntry[] : undefined,
    });

    console.log(
      `[LongForm] Generating ${targetLength}-word ${structure} (${depth}, web=${!!research}) for user ${user.id}`
    );

    // ---------------------------------------------------------------------
    // Generate
    // ---------------------------------------------------------------------
    const client = await getVertexAIClient();
    const response = await client.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        temperature: 0.75,
        maxOutputTokens: 32768,
      },
    });

    let responseText = '';
    if ((response as any).text) {
      const t = (response as any).text;
      responseText = typeof t === 'function' ? t() : t;
    } else if (response.candidates?.[0]?.content?.parts?.[0]?.text) {
      responseText = response.candidates[0].content.parts[0].text;
    }

    if (!responseText) {
      console.error('[LongForm] Empty response from model');
      return NextResponse.json(
        { error: 'Failed to generate content. Please try again.' },
        { status: 500 }
      );
    }

    // Parse with recovery fallback
    let parsed = parseLongFormResponse(responseText);

    if (!parsed && responseText.length > 1000) {
      console.log('[LongForm] First parse failed, attempting JSON recovery...');
      let recovered = responseText.trim();
      recovered = recovered.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();

      let braceCount = 0;
      let bracketCount = 0;
      let inString = false;
      let escaped = false;
      for (const char of recovered) {
        if (escaped) { escaped = false; continue; }
        if (char === '\\' && inString) { escaped = true; continue; }
        if (char === '"') { inString = !inString; continue; }
        if (inString) continue;
        if (char === '{') braceCount++;
        else if (char === '}') braceCount--;
        else if (char === '[') bracketCount++;
        else if (char === ']') bracketCount--;
      }
      if (inString) recovered += '"';
      const trimmed = recovered.trimEnd();
      if (trimmed.endsWith(':') || trimmed.endsWith(',')) {
        recovered = trimmed.slice(0, -1);
      }
      while (bracketCount > 0) { recovered += ']'; bracketCount--; }
      while (braceCount > 0) { recovered += '}'; braceCount--; }

      parsed = parseLongFormResponse(recovered);
      if (parsed) console.log('[LongForm] JSON recovery successful!');
      else console.error('[LongForm] JSON recovery also failed');
    }

    if (!parsed) {
      console.error('[LongForm] Failed to parse response:', responseText.substring(0, 500));
      return NextResponse.json(
        {
          error:
            'Failed to parse generated content. The response may have been cut off. Try reducing the target length or simplifying the context.',
        },
        { status: 500 }
      );
    }

    // ---------------------------------------------------------------------
    // Reference reconciliation
    // ---------------------------------------------------------------------
    // If web research returned sources but the model didn't surface a references array,
    // backfill with research sources (they are real URLs we know are valid).
    if ((!parsed.references || parsed.references.length === 0) && research?.sources?.length) {
      const linkedUrls = new Set<string>();
      const linkRegex = /\]\((https?:\/\/[^)\s]+)\)/g;
      for (const section of parsed.sections) {
        let m: RegExpExecArray | null;
        while ((m = linkRegex.exec(section.content)) !== null) {
          linkedUrls.add(m[1]);
        }
      }
      const backfilled = research.sources
        .filter((s) => linkedUrls.has(s.url))
        .map((s) => ({ title: s.title, url: s.url, note: undefined }));
      if (backfilled.length > 0) parsed.references = backfilled;
    }

    parsed.metadata = {
      tone,
      structure,
      depth,
      webResearch: !!research,
      generatedAt: new Date().toISOString(),
    };

    console.log(
      `[LongForm] Generated ${parsed.totalWordCount}-word article: "${parsed.title}" (${
        parsed.references?.length ?? 0
      } refs)`
    );

    // ---------------------------------------------------------------------
    // Lexicon validation + single repair retry on slop
    // ---------------------------------------------------------------------
    let lexiconReport = validateLongForm(parsed);
    let lexiconRetried = false;
    const retryWorthy =
      lexiconReport.slopScore >= 4 ||
      lexiconReport.violations.some(
        (v) => v.kind === 'banned-structure' || v.kind === 'banned-contrast'
      );

    // Time-budget guard: don't start a retry that could push us past
    // `maxDuration`. Better to ship a flagged draft with warnings than
    // time out and ship nothing.
    const elapsed = Date.now() - routeStartTime;
    const remaining = LONGFORM_BUDGET_MS - elapsed;
    const haveBudget = remaining >= LONGFORM_RETRY_MIN_REMAINING_MS;

    if (retryWorthy && !haveBudget) {
      console.warn(
        `[LongForm][lexicon] skipping repair retry: only ${remaining}ms of budget left (need ${LONGFORM_RETRY_MIN_REMAINING_MS}ms). Returning original with ${lexiconReport.violations.length} violation(s).`
      );
    }

    if (retryWorthy && haveBudget) {
      console.log(
        `[LongForm][lexicon] initial article had ${lexiconReport.violations.length} violations (slop=${lexiconReport.slopScore}); retrying with repair directive (${remaining}ms budget remaining)`
      );
      try {
        const repairPrompt = `${prompt}\n\n${buildRepairDirective(lexiconReport)}\n\n## Rejected article (for reference only — rewrite from source, do NOT paraphrase)\n${responseText.slice(0, 6000)}`;
        const retryResp = await client.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: [{ role: 'user', parts: [{ text: repairPrompt }] }],
          config: { temperature: 0.7, maxOutputTokens: 32768 },
        });
        let retryText = '';
        if ((retryResp as any).text) {
          const t = (retryResp as any).text;
          retryText = typeof t === 'function' ? t() : t;
        } else if (retryResp.candidates?.[0]?.content?.parts?.[0]?.text) {
          retryText = retryResp.candidates[0].content.parts[0].text;
        }
        const retryParsed = retryText ? parseLongFormResponse(retryText) : null;
        if (retryParsed) {
          const retryReport = validateLongForm(retryParsed);
          console.log(
            `[LongForm][lexicon] retry produced ${retryReport.violations.length} violations (slop=${retryReport.slopScore})`
          );
          if (retryReport.slopScore < lexiconReport.slopScore) {
            // Adopt the cleaner article. Preserve metadata + reconciled refs.
            retryParsed.metadata = parsed.metadata;
            if (!retryParsed.references && parsed.references) {
              retryParsed.references = parsed.references;
            }
            parsed = retryParsed;
            lexiconReport = retryReport;
          }
          lexiconRetried = true;
        } else {
          console.warn('[LongForm][lexicon] retry response unparseable, keeping original');
        }
      } catch (err) {
        console.error('[LongForm][lexicon] retry failed, keeping original:', err);
      }
    }

    const lexiconWarnings = summarizeForClient(lexiconReport);

    // ---------------------------------------------------------------------
    // Persist to history + run audit
    // ---------------------------------------------------------------------
    let savedPostId: string | null = null;
    let auditReport = null;

    try {
      const fullContent = parsed.sections
        .map((s) => `## ${s.heading}\n\n${s.content}`)
        .join('\n\n');

      const sectionsWithMeta = [
        {
          __meta: true,
          subtitle: parsed.subtitle,
          totalWordCount: parsed.totalWordCount,
          tone,
          structure,
          depth,
          webResearch: !!research,
          references: parsed.references ?? [],
          researchQueries: research?.queries ?? [],
          planId: planId ?? null,
        },
        ...parsed.sections,
      ];

      const insertPayload: Record<string, any> = {
        user_id: user.id,
        platform: 'email',
        content: fullContent,
        subject: parsed.title,
        status: 'published',
        longform_sections: sectionsWithMeta,
        is_longform: true,
        scheduled_for: new Date().toISOString(),
      };

      const { data: savedRow, error: saveError } = await supabaseAdmin
        .from('scheduled_posts')
        .insert(insertPayload)
        .select('id')
        .single();

      if (saveError) {
        console.error('[LongForm] Failed to save to database:', JSON.stringify(saveError));
        return NextResponse.json({
          success: true,
          article: parsed,
          warning: `Article generated but could not be saved to history: ${saveError.message}`,
          lexiconWarnings,
          lexiconRetried,
        });
      }

      savedPostId = savedRow?.id ?? null;
      console.log('[LongForm] Saved to database, id:', savedPostId);

      // Link plan to this post if we have one
      if (planId && savedPostId) {
        await supabaseAdmin
          .from('longform_plans')
          .update({ post_id: savedPostId })
          .eq('id', planId)
          .eq('user_id', user.id);
      }

      // Run Stage 4 fast audit (pure-JS, <100ms — network link re-fetch happens in the review route)
      const budget = Array.isArray(verifiedSourceBudget)
        ? (verifiedSourceBudget as SourceBudgetEntry[])
        : [];
      auditReport = runFastAudit(savedPostId ?? 'unsaved', planId ?? null, fullContent, budget);

      // Persist audit
      if (savedPostId) {
        const { error: auditSaveError } = await supabaseAdmin
          .from('longform_audits')
          .insert({
            post_id: savedPostId,
            plan_id: planId ?? null,
            flags: auditReport.flags,
            dead_link_rate: auditReport.dead_link_rate,
            link_audit_passed: auditReport.link_audit_passed,
            citation_audit_passed: auditReport.citation_audit_passed,
            code_audit_passed: auditReport.code_audit_passed,
            prose_audit_score: auditReport.prose_audit_score,
            authority_audit_passed: auditReport.authority_audit_passed,
          });
        if (auditSaveError) {
          console.error('[LongForm] Failed to save audit:', JSON.stringify(auditSaveError));
        } else {
          console.log('[LongForm] Audit saved, flags:', auditReport.flags.length);
        }
      }
    } catch (saveErr) {
      console.error('[LongForm] Database save/audit error:', saveErr);
    }

    // Increment monthly usage counter (fire-and-forget; gate already checked above)
    incrementLongFormUsed(user.id).catch(() => {});

    return NextResponse.json({
      success: true,
      article: parsed,
      post_id: savedPostId,
      audit: auditReport
        ? {
            flags: auditReport.flags,
            prose_audit_score: auditReport.prose_audit_score,
            link_audit_passed: auditReport.link_audit_passed,
            citation_audit_passed: auditReport.citation_audit_passed,
            code_audit_passed: auditReport.code_audit_passed,
            authority_audit_passed: auditReport.authority_audit_passed,
          }
        : null,
      lexiconWarnings,
      lexiconRetried,
    });
  } catch (error: any) {
    console.error('[LongForm] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
