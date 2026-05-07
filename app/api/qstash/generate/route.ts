// QStash worker for async campaign generation.
// On Vercel Hobby this is still capped at 60s — point GENERATION_WORKER_URL
// at a Cloud Run endpoint to remove the limit entirely (no other changes needed).
export const maxDuration = 60;

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { buildGenerationPrompt } from '@/lib/prompts';
import {
  validateCampaign,
  buildRepairDirective,
  summarizeForClient,
  type CampaignShape,
  type ValidationReport,
} from '@/lib/prompts/lexicon-validator';
import { PostHog } from 'posthog-node';
import { getPlanStatus, incrementCampaignGeneration } from '@/lib/plan';
import { getVertexAIClient } from '@/lib/genai-client';
import { getGitHubEnrichedContext } from '@/lib/composio';
import { extractYouTubeId, getYouTubeTranscript } from '@/lib/youtube';
import { verifyQStashRequest } from '@/lib/qstash';

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
    console.error('[worker] Unexpected response format:', JSON.stringify(response, null, 2));
    throw new Error('Unexpected response format from Vertex AI');
  }

  return responseText;
}

const GENERATION_BUDGET_MS = 55_000;
const RETRY_MIN_REMAINING_MS = 25_000;

async function generateWithLexiconGuard(
  parts: any[],
  basePrompt: string,
  startTime: number,
  hasImages: boolean = false,
): Promise<{ responseText: string; report: ValidationReport; retried: boolean }> {
  const initial = await generateFromParts(parts);

  let parsed: CampaignShape | null = null;
  try {
    parsed = JSON.parse(initial);
  } catch {
    console.warn('[worker][lexicon] could not parse initial response, skipping validation');
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

  if (hasImages) {
    console.warn('[worker][lexicon] skipping repair retry: images in payload');
    return { responseText: initial, report, retried: false };
  }

  const elapsed = Date.now() - startTime;
  const remaining = GENERATION_BUDGET_MS - elapsed;
  if (remaining < RETRY_MIN_REMAINING_MS) {
    console.warn(
      `[worker][lexicon] skipping repair retry: only ${remaining}ms budget left. ` +
      `Returning original with ${report.violations.length} violation(s).`
    );
    return { responseText: initial, report, retried: false };
  }

  console.log(
    `[worker][lexicon] ${report.violations.length} violation(s) (slop=${report.slopScore}); ` +
    `retrying with repair directive (${remaining}ms remaining)`
  );

  const repairDirective = buildRepairDirective(report);
  const repairParts: any[] = [
    { text: `${basePrompt}\n\n${repairDirective}\n\n## Rejected output (for reference only — do NOT paraphrase, rewrite from source)\n${initial.slice(0, 4000)}` },
    ...parts.slice(1),
  ];

  let retried: string;
  try {
    retried = await generateFromParts(repairParts);
  } catch (err) {
    console.error('[worker][lexicon] retry failed, returning original:', err);
    return { responseText: initial, report, retried: true };
  }

  let retriedParsed: CampaignShape | null = null;
  try {
    retriedParsed = JSON.parse(retried);
  } catch {
    console.warn('[worker][lexicon] retried response unparseable, returning original');
    return { responseText: initial, report, retried: true };
  }

  const retriedReport = validateCampaign(retriedParsed);
  console.log(
    `[worker][lexicon] retry produced ${retriedReport.violations.length} violation(s) (slop=${retriedReport.slopScore})`
  );

  if (retriedReport.slopScore < report.slopScore) {
    return { responseText: retried, report: retriedReport, retried: true };
  }
  return { responseText: initial, report, retried: true };
}

export async function POST(req: Request) {
  const startTime = Date.now();
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // --- VERIFY QSTASH SIGNATURE ---
  const signature = req.headers.get('upstash-signature');
  const rawBody = await req.text();

  if (signature) {
    const isValid = await verifyQStashRequest(signature, rawBody);
    if (!isValid) {
      console.error('[worker] Invalid QStash signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }
  } else if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Missing signature' }, { status: 401 });
  }

  const { jobId } = JSON.parse(rawBody);
  if (!jobId) {
    return NextResponse.json({ error: 'Missing jobId' }, { status: 400 });
  }

  // --- FETCH JOB ---
  const { data: job, error: fetchError } = await supabaseAdmin
    .from('generation_jobs')
    .select('*')
    .eq('id', jobId)
    .single();

  if (fetchError || !job) {
    console.error(`[worker] Job ${jobId} not found:`, fetchError);
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  if (job.status !== 'pending') {
    console.log(`[worker] Job ${jobId} already processed (status: ${job.status})`);
    return NextResponse.json({ success: true, skipped: true });
  }

  await supabaseAdmin
    .from('generation_jobs')
    .update({ status: 'processing', updated_at: new Date().toISOString() })
    .eq('id', jobId);

  const posthog = new PostHog(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
    host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
  });

  const markError = async (message: string) => {
    await supabaseAdmin
      .from('generation_jobs')
      .update({ status: 'error', error_message: message, updated_at: new Date().toISOString() })
      .eq('id', jobId);
  };

  try {
    const { sourceMaterial, campaignDirectives, isDemo, userId } = job.payload;

    let urlContext = sourceMaterial?.url || '';
    const textContext = sourceMaterial?.rawText || '';
    const assetUrls: string[] = sourceMaterial?.assetUrls || [];

    // --- YouTube transcript ---
    let effectiveUrlContext = urlContext;
    if (urlContext) {
      const videoId = extractYouTubeId(urlContext);
      if (videoId) {
        const transcript = await getYouTubeTranscript(videoId);
        if (transcript) effectiveUrlContext = `YouTube transcript: ${transcript}`;
      }
    }

    // --- GitHub context (authenticated users only) ---
    let githubContext = '';
    if (!isDemo && userId) {
      const { data: githubConn } = await supabaseAdmin
        .from('user_composio_connections')
        .select('connection_id')
        .eq('user_id', userId)
        .eq('app', 'github')
        .maybeSingle();

      if (githubConn) {
        try {
          githubContext = await getGitHubEnrichedContext(githubConn.connection_id);
        } catch (err) {
          console.error('[worker] Failed to fetch GitHub context:', err);
        }
      }
    }

    const enhancedText = textContext + githubContext;
    const tweetFormat = campaignDirectives?.tweetFormat || 'single';
    const personaVoice = campaignDirectives?.personaVoice || 'Expert Content Strategist';
    const finalContext = campaignDirectives?.additionalContext
      ? `${enhancedText}\n\nAdditional Directives: ${campaignDirectives.additionalContext}`
      : enhancedText;

    const textPrompt = buildGenerationPrompt({
      tweetFormat,
      personaVoice,
      textContext: finalContext,
      urlContext: effectiveUrlContext,
    });

    const parts: any[] = [{ text: textPrompt }];

    if (assetUrls.length) {
      for (const assetUrl of assetUrls) {
        try {
          const fileRes = await fetch(assetUrl);
          if (!fileRes.ok) throw new Error(`HTTP ${fileRes.status}`);
          const mimeType = fileRes.headers.get('content-type') || 'application/octet-stream';
          const arrayBuffer = await fileRes.arrayBuffer();
          const base64Data = Buffer.from(arrayBuffer).toString('base64');
          parts.push({ inlineData: { data: base64Data, mimeType } });
        } catch (err) {
          console.error(`[worker] Failed to fetch asset ${assetUrl}:`, err);
        }
      }
    }

    const { responseText, report: lexiconReport, retried } =
      await generateWithLexiconGuard(parts, textPrompt, startTime, assetUrls.length > 0);
    const lexiconWarnings = summarizeForClient(lexiconReport);

    // --- WRITE RESULT ---
    await supabaseAdmin
      .from('generation_jobs')
      .update({
        status: 'done',
        result: { output: responseText, lexiconWarnings },
        updated_at: new Date().toISOString(),
      })
      .eq('id', jobId);

    // --- POST-GEN SIDE-EFFECTS (authenticated only) ---
    if (!isDemo && userId) {
      await incrementCampaignGeneration(userId);
    }

    const durationMs = Date.now() - startTime;
    posthog.capture({
      distinctId: userId || 'demo',
      event: isDemo ? 'vertex_generation_completed_demo' : 'vertex_generation_completed',
      properties: {
        durationMs,
        personaVoice,
        hasFile: assetUrls.length > 0,
        assetCount: assetUrls.length,
        status: 'success',
        lexiconViolations: lexiconReport.violations.length,
        lexiconSlopScore: lexiconReport.slopScore,
        lexiconRetried: retried,
        async: true,
      },
    });
    await posthog.shutdown();

    console.log(`[worker] Job ${jobId} completed in ${durationMs}ms`);
    return NextResponse.json({ success: true, jobId });
  } catch (error: any) {
    const durationMs = Date.now() - startTime;
    console.error(`[worker] Job ${jobId} failed after ${durationMs}ms:`, error);
    await markError(error.message || 'Internal error');

    posthog.capture({
      distinctId: job.payload?.userId || 'unknown',
      event: 'vertex_generation_failed',
      properties: { durationMs, errorMessage: error.message, async: true },
    });
    await posthog.shutdown();

    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
