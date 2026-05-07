import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const jobId = searchParams.get('jobId');

  if (!jobId) {
    return NextResponse.json({ error: 'Missing jobId' }, { status: 400 });
  }

  // Auth — accept cookie or bearer token (same pattern as /api/generate)
  let userId: string | null = null;
  let isDemo = false;

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
  if (userFromCookie) userId = userFromCookie.id;

  if (!userId) {
    const authHeader = req.headers.get('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const supabaseFromToken = createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      );
      const { data: { user: userFromToken } } = await supabaseFromToken.auth.getUser(token);
      if (userFromToken) userId = userFromToken.id;
    }
  }

  // Demo jobs have a placeholder user_id — allow polling without auth
  const supabaseAdmin = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data: job, error } = await supabaseAdmin
    .from('generation_jobs')
    .select('id, user_id, status, result, error_message, payload')
    .eq('id', jobId)
    .single();

  if (error || !job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  // Only the job owner or a demo job may be polled
  isDemo = job.payload?.isDemo === true;
  if (!isDemo && job.user_id !== userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  // If a job has been stuck in pending/processing for more than 5 minutes,
  // treat it as a timeout so the frontend shows an error instead of spinning.
  const STALE_THRESHOLD_MS = 5 * 60 * 1000;
  if (job.status === 'pending' || job.status === 'processing') {
    const age = Date.now() - new Date(job.updated_at).getTime();
    if (age > STALE_THRESHOLD_MS) {
      console.warn(`[status] Job ${jobId} stale (status=${job.status}, age=${Math.round(age / 1000)}s)`);
      return NextResponse.json({
        status: 'error',
        error: 'Generation timed out. Please try again.',
        result: null,
      });
    }
  }

  return NextResponse.json({
    status: job.status,
    result: job.status === 'done' ? job.result : null,
    error: job.status === 'error' ? (job.error_message || 'Generation failed') : null,
  });
}
