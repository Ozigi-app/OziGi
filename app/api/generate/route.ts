// Thin enqueue-only route. All heavy Gemini work happens in the QStash
// worker (/api/qstash/generate) so this function returns in <1s and never
// approaches Vercel Hobby's 60s timeout.
import { NextResponse } from 'next/server';
import { containsPromptInjection } from '../../../lib/prompts';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { getPlanStatus } from '@/lib/plan';
import { enqueueGenerationJob } from '@/lib/qstash';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const ratelimit = new Ratelimit({
  redis: redis,
  limiter: Ratelimit.slidingWindow(30, '1 h'),
  analytics: true,
});

export async function POST(req: Request) {
  try {
    const ip = req.headers.get('x-forwarded-for') ?? '127.0.0.1';
    const { success } = await ratelimit.limit(`ratelimit_${ip}`);

    if (!success) {
      return NextResponse.json(
        { error: 'Too many generation requests. Please try again later.' },
        { status: 429 },
      );
    }

    // --- DEMO MODE ---
    const isDemo = req.headers.get('x-demo-mode') === 'true';
    if (isDemo) {
      const demoKey = `demo_${ip}`;
      const used = await redis.get(demoKey);
      if (used) {
        return NextResponse.json(
          { error: 'demo_limit_reached', message: 'You have already used the demo. Sign up to continue.' },
          { status: 403 },
        );
      }
      await redis.set(demoKey, '1', { ex: 86400 });
    }

    // --- AUTH ---
    let user = null;

    if (!isDemo) {
      const cookieStore = await cookies();
      const supabaseFromCookie = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            getAll() { return cookieStore.getAll(); },
            setAll() { /* no-op */ },
          },
        },
      );
      const { data: { user: userFromCookie } } = await supabaseFromCookie.auth.getUser();
      if (userFromCookie) user = userFromCookie;

      if (!user) {
        const authHeader = req.headers.get('Authorization');
        if (authHeader?.startsWith('Bearer ')) {
          const token = authHeader.split(' ')[1];
          const supabaseFromToken = createSupabaseClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          );
          const { data: { user: userFromToken } } = await supabaseFromToken.auth.getUser(token);
          if (userFromToken) user = userFromToken;
        }
      }

      if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      // --- PLAN CHECK ---
      const planStatus = await getPlanStatus(user.id);
      if (!planStatus.canGenerate) {
        return NextResponse.json(
          {
            error: 'generation_limit_reached',
            plan: planStatus.plan,
            generationsUsed: planStatus.generationsUsed,
            generationsLimit: planStatus.generationsLimit,
          },
          { status: 403 },
        );
      }
    }

    // --- PAYLOAD VALIDATION ---
    const payload = await req.json();
    const { sourceMaterial, campaignDirectives } = payload;

    const textContext = sourceMaterial?.rawText || '';
    const additionalContext = campaignDirectives?.additionalContext || '';

    if (containsPromptInjection(textContext) || containsPromptInjection(additionalContext)) {
      console.warn(`[SECURITY] Prompt injection attempt from IP: ${ip}`);
      return NextResponse.json(
        { error: 'Security Policy Violation: Invalid context structure detected.' },
        { status: 400 },
      );
    }

    // --- INSERT JOB ---
    const supabaseAdmin = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    const jobPayload = {
      sourceMaterial,
      campaignDirectives,
      isDemo,
      userId: user?.id ?? null,
    };

    const { data: job, error: insertError } = await supabaseAdmin
      .from('generation_jobs')
      .insert({
        user_id: user?.id ?? null,
        payload: jobPayload,
        status: 'pending',
      })
      .select('id')
      .single();

    if (insertError || !job) {
      console.error('[generate] Failed to insert job:', insertError);
      return NextResponse.json({ error: 'Failed to start generation' }, { status: 500 });
    }

    // --- ENQUEUE ---
    // Derive the app URL from the request so it works even if APP_URL is wrong.
    const reqUrl = new URL(req.url);
    const appUrl =
      process.env.APP_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      `${reqUrl.protocol}//${reqUrl.host}`;

    try {
      await enqueueGenerationJob(job.id, appUrl);
    } catch (qErr: any) {
      // Clean up the orphaned job row before returning the error
      await supabaseAdmin.from('generation_jobs').delete().eq('id', job.id);
      console.error('[generate] QStash enqueue failed:', qErr.message);
      return NextResponse.json({ error: qErr.message }, { status: 500 });
    }

    return NextResponse.json({ jobId: job.id });
  } catch (error: any) {
    console.error('[generate] Unexpected error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
