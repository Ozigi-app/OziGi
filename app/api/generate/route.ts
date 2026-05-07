// Vercel Hobby tier caps function runtime at 60s. We set maxDuration to 60
// explicitly and rely on the budget guard to skip lexicon repair retries when
// time is tight. Images and other files are passed as fileData URIs (not
// base64-inlined) so Vertex AI fetches them directly — no encoding overhead.
export const maxDuration = 60;

import { NextResponse } from 'next/server';
import { buildGenerationPrompt, containsPromptInjection } from '../../../lib/prompts';
import {
  validateCampaign,
  buildRepairDirective,
  summarizeForClient,
  type CampaignShape,
  type ValidationReport,
} from '@/lib/prompts/lexicon-validator';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { PostHog } from 'posthog-node';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { getPlanStatus, incrementCampaignGeneration } from '@/lib/plan';
import { getVertexAIClient } from '@/lib/genai-client';
import { getGitHubEnrichedContext } from '@/lib/composio';
import { extractYouTubeId, getYouTubeTranscript } from '@/lib/youtube';


const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const ratelimit = new Ratelimit({
  redis: redis,
  limiter: Ratelimit.slidingWindow(30, '1 h'),
  analytics: true,
});

const distributionSchema = {
  type: 'OBJECT',
  properties: {
    campaign: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          day: { type: 'INTEGER' },
          x: { type: 'STRING' },
          linkedin: { type: 'STRING' },
          discord: { type: 'STRING' },
          slack: { type: 'STRING' },
        },
        required: ['day', 'x', 'linkedin', 'discord', 'slack'],
      },
    },
    email: { type: 'STRING' },
  },
  required: ['campaign'],
};

/** Guess MIME type from file URL extension. */
function guessMimeType(url: string): string {
  const ext = url.split('?')[0].split('.').pop()?.toLowerCase() ?? '';
  const map: Record<string, string> = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
    gif: 'image/gif', webp: 'image/webp', heic: 'image/heic',
    mp4: 'video/mp4', mov: 'video/mov', avi: 'video/avi',
    mp3: 'audio/mp3', m4a: 'audio/m4a', wav: 'audio/wav',
    pdf: 'application/pdf',
  };
  return map[ext] || 'image/jpeg';
}

/**
 * Build file parts for Gemini. We pass HTTPS URLs directly via fileData.fileUri
 * so Vertex AI fetches them itself — no base64 encoding, no fetch overhead,
 * no extra bytes in the request body. Cap at 5 files to stay well within budget.
 */
function buildFileParts(assetUrls: string[]): any[] {
  const MAX_FILES = 5;
  const urls = assetUrls.slice(0, MAX_FILES);
  if (assetUrls.length > MAX_FILES) {
    console.warn(`[generate] Capped asset count: ${assetUrls.length} → ${MAX_FILES}`);
  }
  return urls.map((url) => ({
    fileData: {
      mimeType: guessMimeType(url),
      fileUri: url,
    },
  }));
}

async function generateFromParts(parts: any[]): Promise<string> {
  const client = await getVertexAIClient();
  const response = await client.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: [{ role: 'user', parts }],
    config: {
      responseMimeType: 'application/json',
      responseSchema: distributionSchema,
    },
  });

  const responseText =
    response.text ??
    response.candidates?.[0]?.content?.parts?.[0]?.text ??
    '';

  if (!responseText) {
    console.error('Unexpected response format:', JSON.stringify(response, null, 2));
    throw new Error('Unexpected response format from Vertex AI');
  }

  return responseText;
}

// Hard budget for the entire generation slot, sized for Hobby (60s cap).
const GENERATION_BUDGET_MS = 55_000;
// Minimum headroom required before we'll start a repair retry.
const RETRY_MIN_REMAINING_MS = 25_000;

async function generateWithLexiconGuard(
  parts: any[],
  basePrompt: string,
  startTime: number,
  hasFiles: boolean = false,
): Promise<{ responseText: string; report: ValidationReport; retried: boolean }> {
  const initial = await generateFromParts(parts);

  let parsed: CampaignShape | null = null;
  try {
    parsed = JSON.parse(initial);
  } catch {
    console.warn('[lexicon] could not parse initial response, skipping validation');
    return { responseText: initial, report: { violations: [], slopScore: 0, clean: true }, retried: false };
  }

  const report = validateCampaign(parsed);
  const retryWorthy =
    report.slopScore >= 3 ||
    report.violations.some(
      (v) =>
        v.kind === 'banned-structure' ||
        v.kind === 'banned-contrast' ||
        v.kind === 'banned-closer'
    );

  if (!retryWorthy) {
    return { responseText: initial, report, retried: false };
  }

  // Skip retry when files are present — they add time and the first call
  // already consumed most of the budget.
  if (hasFiles) {
    console.warn('[lexicon] skipping repair retry: files in payload');
    return { responseText: initial, report, retried: false };
  }

  const elapsed = Date.now() - startTime;
  const remaining = GENERATION_BUDGET_MS - elapsed;
  if (remaining < RETRY_MIN_REMAINING_MS) {
    console.warn(
      `[lexicon] skipping repair retry: only ${remaining}ms budget left. Returning original with ${report.violations.length} violation(s).`
    );
    return { responseText: initial, report, retried: false };
  }

  console.log(
    `[lexicon] ${report.violations.length} violation(s) (slop=${report.slopScore}); retrying (${remaining}ms remaining)`
  );

  const repairDirective = buildRepairDirective(report);
  const repairParts: any[] = [
    { text: `${basePrompt}\n\n${repairDirective}\n\n## Rejected output (for reference only)\n${initial.slice(0, 4000)}` },
    ...parts.slice(1),
  ];

  let retried: string;
  try {
    retried = await generateFromParts(repairParts);
  } catch (err) {
    console.error('[lexicon] retry failed, returning original:', err);
    return { responseText: initial, report, retried: true };
  }

  let retriedParsed: CampaignShape | null = null;
  try {
    retriedParsed = JSON.parse(retried);
  } catch {
    console.warn('[lexicon] retried response unparseable, returning original');
    return { responseText: initial, report, retried: true };
  }

  const retriedReport = validateCampaign(retriedParsed);
  console.log(`[lexicon] retry produced ${retriedReport.violations.length} violation(s) (slop=${retriedReport.slopScore})`);

  if (retriedReport.slopScore < report.slopScore) {
    return { responseText: retried, report: retriedReport, retried: true };
  }
  return { responseText: initial, report, retried: true };
}

export async function POST(req: Request) {
  const startTime = Date.now();
  const posthog = new PostHog(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
    host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
  });

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

      const payload = await req.json();
      const { sourceMaterial, campaignDirectives } = payload;

      let urlContext = sourceMaterial?.url || '';
      const textContext = sourceMaterial?.rawText || '';
      const assetUrls: string[] = sourceMaterial?.assetUrls || [];

      let effectiveUrlContext = urlContext;
      if (urlContext) {
        const videoId = extractYouTubeId(urlContext);
        if (videoId) {
          const transcript = await getYouTubeTranscript(videoId);
          if (transcript) effectiveUrlContext = `YouTube transcript: ${transcript}`;
        }
      }

      const tweetFormat = campaignDirectives?.tweetFormat || 'single';
      const personaVoice = campaignDirectives?.personaVoice || 'Expert Content Strategist';
      const finalContext = campaignDirectives?.additionalContext
        ? `${textContext}\n\nAdditional Directives: ${campaignDirectives.additionalContext}`
        : textContext;

      if (containsPromptInjection(finalContext)) {
        return NextResponse.json(
          { error: 'Security Policy Violation: Invalid context structure detected.' },
          { status: 400 },
        );
      }

      const textPrompt = buildGenerationPrompt({ tweetFormat, personaVoice, textContext: finalContext, urlContext: effectiveUrlContext });
      const parts: any[] = [{ text: textPrompt }, ...buildFileParts(assetUrls)];

      const { responseText, report: lexiconReport, retried } =
        await generateWithLexiconGuard(parts, textPrompt, startTime, assetUrls.length > 0);
      const lexiconWarnings = summarizeForClient(lexiconReport);

      posthog.capture({
        distinctId: ip,
        event: 'vertex_generation_completed_demo',
        properties: { durationMs: Date.now() - startTime, personaVoice, hasFile: assetUrls.length > 0, assetCount: assetUrls.length, status: 'success', lexiconViolations: lexiconReport.violations.length, lexiconSlopScore: lexiconReport.slopScore, lexiconRetried: retried },
      });
      await posthog.shutdown();

      return NextResponse.json({ output: responseText, lexiconWarnings });
    }

    // --- AUTHENTICATED FLOW ---
    let user = null;
    let authError = null;

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
    const { data: { user: userFromCookie }, error: cookieError } = await supabaseFromCookie.auth.getUser();
    if (userFromCookie) user = userFromCookie;

    if (!user) {
      const authHeader = req.headers.get('Authorization');
      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        const supabaseFromToken = createSupabaseClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        );
        const { data: { user: userFromToken }, error: tokenError } = await supabaseFromToken.auth.getUser(token);
        if (userFromToken) user = userFromToken;
        else authError = tokenError;
      }
    }

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized', details: authError?.message || 'No valid session' }, { status: 401 });
    }

    // --- GitHub context ---
    let githubContext = '';
    const { data: githubConn } = await supabaseFromCookie
      .from('user_composio_connections')
      .select('connection_id')
      .eq('user_id', user.id)
      .eq('app', 'github')
      .maybeSingle();

    if (githubConn) {
      try {
        githubContext = await getGitHubEnrichedContext(githubConn.connection_id);
      } catch (err) {
        console.error('Failed to fetch GitHub context:', err);
      }
    }

    const planStatus = await getPlanStatus(user.id);
    if (!planStatus.canGenerate) {
      return NextResponse.json(
        { error: 'generation_limit_reached', plan: planStatus.plan, generationsUsed: planStatus.generationsUsed, generationsLimit: planStatus.generationsLimit },
        { status: 403 },
      );
    }

    const payload = await req.json();
    const { sourceMaterial, campaignDirectives } = payload;

    let urlContext = sourceMaterial?.url || '';
    const textContext = sourceMaterial?.rawText || '';
    const assetUrls: string[] = sourceMaterial?.assetUrls || [];

    let effectiveUrlContext = urlContext;
    if (urlContext) {
      const videoId = extractYouTubeId(urlContext);
      if (videoId) {
        const transcript = await getYouTubeTranscript(videoId);
        if (transcript) effectiveUrlContext = `YouTube transcript: ${transcript}`;
      }
    }

    const enhancedText = textContext + githubContext;
    const tweetFormat = campaignDirectives?.tweetFormat || 'single';
    const personaVoice = campaignDirectives?.personaVoice || 'Expert Content Strategist';
    const finalContext = campaignDirectives?.additionalContext
      ? `${enhancedText}\n\nAdditional Directives: ${campaignDirectives.additionalContext}`
      : enhancedText;

    if (containsPromptInjection(finalContext)) {
      return NextResponse.json(
        { error: 'Security Policy Violation: Invalid context structure detected.' },
        { status: 400 },
      );
    }

    const textPrompt = buildGenerationPrompt({ tweetFormat, personaVoice, textContext: finalContext, urlContext: effectiveUrlContext });
    const parts: any[] = [{ text: textPrompt }, ...buildFileParts(assetUrls)];

    const { responseText, report: lexiconReport, retried } =
      await generateWithLexiconGuard(parts, textPrompt, startTime, assetUrls.length > 0);
    const lexiconWarnings = summarizeForClient(lexiconReport);

    await incrementCampaignGeneration(user.id);

    posthog.capture({
      distinctId: ip,
      event: 'vertex_generation_completed',
      properties: { durationMs: Date.now() - startTime, personaVoice, hasFile: assetUrls.length > 0, assetCount: assetUrls.length, status: 'success', lexiconViolations: lexiconReport.violations.length, lexiconSlopScore: lexiconReport.slopScore, lexiconRetried: retried },
    });
    await posthog.shutdown();

    return NextResponse.json({ output: responseText, lexiconWarnings });
  } catch (error: any) {
    posthog.capture({
      distinctId: req.headers.get('x-forwarded-for') ?? '127.0.0.1',
      event: 'vertex_generation_failed',
      properties: { durationMs: Date.now() - startTime, errorMessage: error.message, status: 'error' },
    });
    await posthog.shutdown();
    console.error('Vertex AI Generate Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
