/**
 * GET /api/longform/[id]/review
 * Returns the post, its associated plan, and its audit report for the review UI.
 * Also runs/refreshes the full audit (including network link re-fetch) so the
 * review page always reflects the current state of all linked URLs.
 * This route gets its own 60s Vercel budget — the link re-fetch is safe here.
 */

export const maxDuration = 60;

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { runFullAudit } from '@/lib/longform/audit';
import type { SourceBudgetEntry } from '@/lib/types/longform';

export async function GET(req: Request, { params }: { params: { id: string } }) {
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

    const postId = params.id;

    // Load the post
    const { data: post, error: postError } = await supabaseAdmin
      .from('scheduled_posts')
      .select('id, subject, content, longform_sections, created_at')
      .eq('id', postId)
      .eq('user_id', user.id)
      .eq('is_longform', true)
      .single();

    if (postError || !post) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 });
    }

    // Parse sections
    const rawSections: any[] = Array.isArray(post.longform_sections) ? post.longform_sections : [];
    const metaSection = rawSections.find((s: any) => s.__meta) ?? {};
    const contentSections = rawSections.filter((s: any) => !s.__meta);

    // Load plan (linked via post_id or planId in meta)
    const planId = metaSection.planId;
    let plan = null;
    if (planId) {
      const { data: planRow } = await supabaseAdmin
        .from('longform_plans')
        .select('*')
        .eq('id', planId)
        .single();
      plan = planRow;
    } else {
      const { data: planRow } = await supabaseAdmin
        .from('longform_plans')
        .select('*')
        .eq('post_id', postId)
        .maybeSingle();
      plan = planRow;
    }

    // Run full audit (includes network link re-fetch — safe here, own 60s budget)
    const budget: SourceBudgetEntry[] = Array.isArray(plan?.source_budget)
      ? plan.source_budget
      : [];
    const freshAudit = await runFullAudit(postId, plan?.id ?? null, post.content, budget);

    // Upsert audit result
    await supabaseAdmin
      .from('longform_audits')
      .upsert(
        {
          post_id: postId,
          plan_id: plan?.id ?? null,
          flags: freshAudit.flags,
          dead_link_rate: freshAudit.dead_link_rate,
          link_audit_passed: freshAudit.link_audit_passed,
          citation_audit_passed: freshAudit.citation_audit_passed,
          code_audit_passed: freshAudit.code_audit_passed,
          prose_audit_score: freshAudit.prose_audit_score,
          authority_audit_passed: freshAudit.authority_audit_passed,
        },
        { onConflict: 'post_id' }
      );

    return NextResponse.json({
      post: {
        id: post.id,
        title: post.subject,
        content: post.content,
        sections: contentSections,
        references: metaSection.references ?? [],
        metadata: {
          subtitle: metaSection.subtitle,
          tone: metaSection.tone,
          structure: metaSection.structure,
          depth: metaSection.depth,
          webResearch: metaSection.webResearch,
          generatedAt: post.created_at,
        },
      },
      plan: plan ?? null,
      audit: freshAudit,
    });
  } catch (error: any) {
    console.error('[Review] Error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
