// Thin enqueue-only route. Inserts a job row, fires the worker in the
// background via Next.js after() (no QStash needed for Vercel), then returns
// {jobId} in <1s. The frontend polls /api/generate/status to pick up the result.
// If GENERATION_WORKER_URL is set (Cloud Run), QStash is used instead so the
// 60s Vercel limit is bypassed entirely.
export const maxDuration = 60;

import { NextResponse, after } from 'next/server';
import { createHash } from 'crypto';
import { containsPromptInjection } from '../../../lib/prompts';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { getPlanStatus } from '@/lib/plan';
import { enqueueGenerationJob } from '@/lib/qstash';

/** Derive a stable internal secret from the service-role key (no new env var). */
function internalSecret(): string {
  return createHash('sha256')
    .update((process.env.SUPABASE_SERVICE_ROLE_KEY ?? '') + ':ozigi-worker')
    .digest('hex');
}

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

    // --- DISPATCH WORKER ---
    // Derive the app URL from the request so it works even if APP_URL is wrong.
    const reqUrl = new URL(req.url);
    const appUrl =
      process.env.APP_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      `${reqUrl.protocol}//${reqUrl.host}`;

    if (process.env.GENERATION_WORKER_URL) {
      // Cloud Run path: use QStash to dispatch to the long-running worker.
      // This bypasses Vercel's 60s limit entirely.
      try {
        await enqueueGenerationJob(job.id, appUrl);
      } catch (qErr: any) {
        await supabaseAdmin.from('generation_jobs').delete().eq('id', job.id);
        console.error('[generate] QStash enqueue failed:', qErr.message);
        return NextResponse.json({ error: qErr.message }, { status: 500 });
      }
    } else {
      // Vercel path: call the worker endpoint directly in the background via
      // after() so we return {jobId} in <1s while generation runs for up to 60s.
      const workerUrl = `${appUrl}/api/qstash/generate`;
      const secret = internalSecret();
      const jobId = job.id;
      console.log(`[generate] Dispatching worker via after() for job ${jobId}`);
      after(async () => {
        try {
          const res = await fetch(workerUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-internal-secret': secret,
            },
            body: JSON.stringify({ jobId }),
          });
          if (!res.ok) {
            const txt = await res.text().catch(() => '');
            console.error(`[generate] Worker returned ${res.status}:`, txt);
          }
        } catch (err) {
          console.error('[generate] Background worker call failed:', err);
        }
      });
    }

    return NextResponse.json({ jobId: job.id });
  } catch (error: any) {
    console.error('[generate] Unexpected error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
