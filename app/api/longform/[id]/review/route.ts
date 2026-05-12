/**
 * GET /api/longform/[id]/review
 * Returns the post, its associated plan, and its audit report for the review UI.
 */

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

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

    // Load audit
    const { data: audit } = await supabaseAdmin
      .from('longform_audits')
      .select('*')
      .eq('post_id', postId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

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
      audit: audit ?? null,
    });
  } catch (error: any) {
    console.error('[Review] Error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
