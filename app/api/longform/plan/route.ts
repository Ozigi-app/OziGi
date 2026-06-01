/**
 * Stage 1: PLAN
 * Takes a client brief and returns a structured plan:
 *   - outline (section headers + one-sentence summaries)
 *   - claim_ledger (every factual claim, typed by support_type)
 *   - source_budget (every URL the article intends to cite, with justification)
 *
 * Uses Gemini structured output mode (responseMimeType: application/json).
 * Stored in longform_plans against a plan_id so later stages can load it.
 */

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { getPlanStatus } from '@/lib/plan';
import { getVertexAIClient } from '@/lib/genai-client';
import { containsPromptInjection } from '@/lib/prompts';
import type { OutlineSection, ClaimEntry, SourceBudgetEntry, LongformPlan } from '@/lib/types/longform';

export const maxDuration = 60;

const PLAN_SCHEMA = {
  type: 'OBJECT',
  properties: {
    outline: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          heading: { type: 'STRING' },
          summary: { type: 'STRING' },
        },
        required: ['heading', 'summary'],
      },
    },
    claim_ledger: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          id: { type: 'STRING' },
          claim: { type: 'STRING' },
          section: { type: 'STRING' },
          support_type: {
            type: 'STRING',
            enum: ['brief_supplied', 'needs_source', 'general_knowledge', 'opinion'],
          },
          proposed_source: { type: 'STRING', nullable: true },
        },
        required: ['id', 'claim', 'section', 'support_type'],
      },
    },
    source_budget: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          url: { type: 'STRING' },
          justification: { type: 'STRING' },
          from_brief: { type: 'BOOLEAN' },
          supports_claims: { type: 'ARRAY', items: { type: 'STRING' } },
        },
        required: ['url', 'justification', 'from_brief', 'supports_claims'],
      },
    },
  },
  required: ['outline', 'claim_ledger', 'source_budget'],
};

function buildPlanPrompt(brief: string): string {
  return `You are a research editor preparing a longform article. Given the brief below, produce a structured plan with three components.

RULES:
- claim_ledger: every factual claim the article will make. Mark support_type as:
  * "brief_supplied" if the brief explicitly names a URL or stat supporting it
  * "needs_source" if the claim needs a source but none is supplied in the brief — you may propose one in proposed_source
  * "general_knowledge" if the claim is common knowledge that needs no citation
  * "opinion" if it is editorial or analytical
- source_budget: EVERY URL the article will cite. Each entry must state what claims it supports.
  * Only include URLs that are real and likely to resolve — do NOT invent domains or personal websites.
  * For any URL from the brief, mark from_brief: true.
- You cannot cite a URL that is not in the source_budget.
- Any claim marked "needs_source" without a proposed_source will block the article.

BRIEF:
"""
${brief.slice(0, 8000)}
"""

Return a JSON object matching the schema exactly. No prose before or after.`;
}

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: (cs) => cs.forEach(({ name, value, options }) => cookieStore.set(name, value, options)),
        },
      }
    );
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const planStatus = await getPlanStatus(user.id);
    if (!planStatus.hasLongForm) {
      return NextResponse.json(
        { error: 'You have used your long-form article for this month. Upgrade to Pro for unlimited.' },
        { status: 403 }
      );
    }

    const { brief } = await req.json();
    if (!brief || typeof brief !== 'string' || brief.trim().length < 50) {
      return NextResponse.json({ error: 'Brief must be at least 50 characters' }, { status: 400 });
    }
    if (containsPromptInjection(brief)) {
      return NextResponse.json({ error: 'Invalid input detected' }, { status: 400 });
    }

    const client = await getVertexAIClient();
    const response = await client.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [{ role: 'user', parts: [{ text: buildPlanPrompt(brief.trim()) }] }],
      config: {
        temperature: 0.2,
        maxOutputTokens: 8192,
        responseMimeType: 'application/json',
        responseSchema: PLAN_SCHEMA as any,
      },
    });

    let text = '';
    if ((response as any).text) {
      const t = (response as any).text;
      text = typeof t === 'function' ? t() : String(t);
    } else if (response.candidates?.[0]?.content?.parts?.[0]?.text) {
      text = response.candidates[0].content.parts[0].text;
    }

    if (!text) {
      return NextResponse.json({ error: 'Model returned empty response' }, { status: 500 });
    }

    let planData: { outline: OutlineSection[]; claim_ledger: ClaimEntry[]; source_budget: SourceBudgetEntry[] };
    try {
      const raw = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
      planData = JSON.parse(raw);
    } catch {
      return NextResponse.json({ error: 'Failed to parse plan from model response' }, { status: 500 });
    }

    // Persist to longform_plans
    const { data: savedPlan, error: saveError } = await supabaseAdmin
      .from('longform_plans')
      .insert({
        user_id: user.id,
        post_id: null,
        outline: planData.outline,
        claim_ledger: planData.claim_ledger,
        source_budget: planData.source_budget,
      })
      .select('id')
      .single();

    if (saveError) {
      console.error('[Plan] Failed to save plan:', saveError);
      // Still return the plan even if DB save fails
      return NextResponse.json({
        plan_id: null,
        outline: planData.outline,
        claim_ledger: planData.claim_ledger,
        source_budget: planData.source_budget,
        warning: 'Plan generated but could not be saved to database',
      });
    }

    return NextResponse.json({
      plan_id: savedPlan.id,
      outline: planData.outline,
      claim_ledger: planData.claim_ledger,
      source_budget: planData.source_budget,
    });
  } catch (error: any) {
    console.error('[Plan] Error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
