/**
 * Standalone Cloud Run worker for async campaign generation.
 * QStash calls this instead of the Vercel route when GENERATION_WORKER_URL is set.
 * No Vercel timeout applies here — Cloud Run allows up to 60 minutes.
 *
 * Run locally:  npx tsx worker/server.ts
 * Deploy:       see Dockerfile.worker
 */
import http from 'http';
import { createClient } from '@supabase/supabase-js';
import { Receiver } from '@upstash/qstash';
import { PostHog } from 'posthog-node';
import { buildGenerationPrompt } from '@/lib/prompts';
import {
  validateCampaign,
  buildRepairDirective,
  summarizeForClient,
  type CampaignShape,
  type ValidationReport,
} from '@/lib/prompts/lexicon-validator';
import { getVertexAIClient } from '@/lib/genai-client';
import { getGitHubEnrichedContext } from '@/lib/composio';
import { extractYouTubeId, getYouTubeTranscript } from '@/lib/youtube';
import { incrementCampaignGeneration } from '@/lib/plan';

const PORT = process.env.PORT || 8080;

const receiver = new Receiver({
  currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY!,
  nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY!,
});

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

// ---------------------------------------------------------------------------
// Generation logic (mirrors /api/qstash/generate but without the 60s cap)
// ---------------------------------------------------------------------------

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

  const text =
    response.text ??
    response.candidates?.[0]?.content?.parts?.[0]?.text ??
    '';

  if (!text) throw new Error('Empty response from Vertex AI');
  return text;
}

// No budget cap here — we're on Cloud Run with a 60-minute timeout.
async function generateWithLexiconGuard(
  parts: any[],
  basePrompt: string,
  hasImages: boolean,
): Promise<{ responseText: string; report: ValidationReport; retried: boolean }> {
  const initial = await generateFromParts(parts);

  let parsed: CampaignShape | null = null;
  try { parsed = JSON.parse(initial); } catch {
    return { responseText: initial, report: { violations: [], slopScore: 0, clean: true }, retried: false };
  }

  const report = validateCampaign(parsed);
  const retryWorthy =
    report.slopScore >= 3 ||
    report.violations.some(
      (v) => v.kind === 'banned-structure' || v.kind === 'banned-contrast' || v.kind === 'banned-closer'
    );

  if (!retryWorthy) return { responseText: initial, report, retried: false };

  // On Cloud Run we can always retry — no time budget concern.
  // Skip only if images are present (they make the request large; one good
  // pass is usually enough and the retry would cost extra Gemini tokens).
  if (hasImages) {
    console.warn('[worker] skipping repair retry: images in payload');
    return { responseText: initial, report, retried: false };
  }

  console.log(`[worker] ${report.violations.length} violation(s) (slop=${report.slopScore}); retrying`);

  const repairParts: any[] = [
    { text: `${basePrompt}\n\n${buildRepairDirective(report)}\n\n## Rejected output (for reference only)\n${initial.slice(0, 4000)}` },
    ...parts.slice(1),
  ];

  let retried: string;
  try { retried = await generateFromParts(repairParts); }
  catch (err) {
    console.error('[worker] retry failed, returning original:', err);
    return { responseText: initial, report, retried: true };
  }

  let retriedParsed: CampaignShape | null = null;
  try { retriedParsed = JSON.parse(retried); } catch {
    return { responseText: initial, report, retried: true };
  }

  const retriedReport = validateCampaign(retriedParsed);
  console.log(`[worker] retry: ${retriedReport.violations.length} violation(s) (slop=${retriedReport.slopScore})`);

  return retriedReport.slopScore < report.slopScore
    ? { responseText: retried, report: retriedReport, retried: true }
    : { responseText: initial, report, retried: true };
}

async function processJob(jobId: string): Promise<void> {
  const startTime = Date.now();
  const supabase = getSupabaseAdmin();

  const { data: job, error: fetchErr } = await supabase
    .from('generation_jobs')
    .select('*')
    .eq('id', jobId)
    .single();

  if (fetchErr || !job) throw new Error(`Job ${jobId} not found`);

  if (job.status !== 'pending') {
    console.log(`[worker] job ${jobId} already processed (${job.status})`);
    return;
  }

  await supabase
    .from('generation_jobs')
    .update({ status: 'processing', updated_at: new Date().toISOString() })
    .eq('id', jobId);

  const { sourceMaterial, campaignDirectives, isDemo, userId } = job.payload;

  try {
    let urlContext = sourceMaterial?.url || '';
    const textContext = sourceMaterial?.rawText || '';
    const assetUrls: string[] = sourceMaterial?.assetUrls || [];

    // YouTube transcript
    let effectiveUrlContext = urlContext;
    if (urlContext) {
      const videoId = extractYouTubeId(urlContext);
      if (videoId) {
        const transcript = await getYouTubeTranscript(videoId);
        if (transcript) effectiveUrlContext = `YouTube transcript: ${transcript}`;
      }
    }

    // GitHub context
    let githubContext = '';
    if (!isDemo && userId) {
      const { data: githubConn } = await supabase
        .from('user_composio_connections')
        .select('connection_id')
        .eq('user_id', userId)
        .eq('app', 'github')
        .maybeSingle();

      if (githubConn) {
        try { githubContext = await getGitHubEnrichedContext(githubConn.connection_id); }
        catch (err) { console.error('[worker] GitHub context failed:', err); }
      }
    }

    const enhancedText = textContext + githubContext;
    const tweetFormat = campaignDirectives?.tweetFormat || 'single';
    const personaVoice = campaignDirectives?.personaVoice || 'Expert Content Strategist';
    const finalContext = campaignDirectives?.additionalContext
      ? `${enhancedText}\n\nAdditional Directives: ${campaignDirectives.additionalContext}`
      : enhancedText;

    const textPrompt = buildGenerationPrompt({ tweetFormat, personaVoice, textContext: finalContext, urlContext: effectiveUrlContext });
    const parts: any[] = [{ text: textPrompt }];

    for (const assetUrl of assetUrls) {
      try {
        const fileRes = await fetch(assetUrl);
        if (!fileRes.ok) throw new Error(`HTTP ${fileRes.status}`);
        const mimeType = fileRes.headers.get('content-type') || 'application/octet-stream';
        const base64Data = Buffer.from(await fileRes.arrayBuffer()).toString('base64');
        parts.push({ inlineData: { data: base64Data, mimeType } });
      } catch (err) {
        console.error(`[worker] Failed to fetch asset ${assetUrl}:`, err);
      }
    }

    const { responseText, report: lexiconReport, retried } =
      await generateWithLexiconGuard(parts, textPrompt, assetUrls.length > 0);
    const lexiconWarnings = summarizeForClient(lexiconReport);

    await supabase
      .from('generation_jobs')
      .update({ status: 'done', result: { output: responseText, lexiconWarnings }, updated_at: new Date().toISOString() })
      .eq('id', jobId);

    if (!isDemo && userId) await incrementCampaignGeneration(userId);

    const durationMs = Date.now() - startTime;
    const posthog = new PostHog(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
      host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
    });
    posthog.capture({
      distinctId: userId || 'demo',
      event: isDemo ? 'vertex_generation_completed_demo' : 'vertex_generation_completed',
      properties: { durationMs, personaVoice, hasFile: assetUrls.length > 0, assetCount: assetUrls.length, status: 'success', lexiconViolations: lexiconReport.violations.length, lexiconSlopScore: lexiconReport.slopScore, lexiconRetried: retried, async: true, runtime: 'cloud-run' },
    });
    await posthog.shutdown();

    console.log(`[worker] job ${jobId} done in ${durationMs}ms`);
  } catch (err: any) {
    console.error(`[worker] job ${jobId} failed:`, err);
    await supabase
      .from('generation_jobs')
      .update({ status: 'error', error_message: err.message || 'Internal error', updated_at: new Date().toISOString() })
      .eq('id', jobId);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// HTTP server
// ---------------------------------------------------------------------------

const server = http.createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  if (req.method !== 'POST') {
    res.writeHead(405);
    res.end();
    return;
  }

  // Read body
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const rawBody = Buffer.concat(chunks).toString();

  // Verify QStash signature
  const signature = req.headers['upstash-signature'] as string | undefined;
  if (signature) {
    try {
      const isValid = await receiver.verify({ signature, body: rawBody });
      if (!isValid) {
        res.writeHead(401);
        res.end(JSON.stringify({ error: 'Invalid signature' }));
        return;
      }
    } catch {
      res.writeHead(401);
      res.end(JSON.stringify({ error: 'Signature verification failed' }));
      return;
    }
  } else if (process.env.NODE_ENV === 'production') {
    res.writeHead(401);
    res.end(JSON.stringify({ error: 'Missing signature' }));
    return;
  }

  let jobId: string;
  try {
    ({ jobId } = JSON.parse(rawBody));
    if (!jobId) throw new Error('Missing jobId');
  } catch {
    res.writeHead(400);
    res.end(JSON.stringify({ error: 'Invalid body' }));
    return;
  }

  try {
    await processJob(jobId);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, jobId }));
  } catch (err: any) {
    // Return 200 anyway — job status is already written to Supabase as 'error'.
    // A non-2xx here would cause QStash to retry, but the job is already marked
    // failed so retries would just no-op (status !== 'pending' guard).
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, jobId, error: err.message }));
  }
});

server.listen(PORT, () => {
  console.log(`[worker] listening on port ${PORT}`);
});
