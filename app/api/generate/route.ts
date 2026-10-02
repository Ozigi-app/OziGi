// Vercel Hobby tier caps function runtime at 60s.
// Files are fetched here and inlined as base64 rather than handed to Vertex as
// crawlable URLs — see buildFileParts for why.
export const maxDuration = 60;

import { NextResponse } from 'next/server';
import { buildGenerationPrompt, containsPromptInjection } from '../../../lib/prompts';
import { loadPersonaVoice, buildVoiceBlock, hasVoiceMaterial } from '@/lib/prompts/voice';
import {
  validateCampaign,
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
import { resolveUrlContext } from '@/lib/sourceContext';


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
 * Build file parts for Gemini. We fetch the bytes here and inline them as base64
 * rather than passing HTTPS URLs via fileData.fileUri: Vertex fetches such URLs
 * itself, as a crawler that honours robots.txt under the Google-Extended agent,
 * and Cloudflare's managed robots.txt disallows Google-Extended on our CDN — so
 * every request carrying a file failed with URL_ROBOTED-ROBOTED_DENIED. Inlining
 * removes the dependency on an external crawl policy entirely, and matches what
 * app/api/qstash/generate already does.
 *
 * Cap at 5 files, and cap total inlined bytes: uploads allow 10 MB each, which
 * would overshoot Vertex's request ceiling once base64 adds its ~33%.
 */
async function buildFileParts(assetUrls: string[]): Promise<any[]> {
  const MAX_FILES = 5;
  const MAX_TOTAL_BYTES = 15 * 1024 * 1024;

  const urls = assetUrls.slice(0, MAX_FILES);
  if (assetUrls.length > MAX_FILES) {
    console.warn(`[generate] Capped asset count: ${assetUrls.length} → ${MAX_FILES}`);
  }

  // Fetched in parallel — these are CDN edge reads, and the whole route shares a 60s budget.
  const assets = await Promise.all(
    urls.map(async (url) => {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        // R2 serves octet-stream when the upload did not carry a usable type;
        // the extension is a better guess than a type Gemini will reject.
        const headerType = res.headers.get('content-type')?.split(';')[0].trim();
        const mimeType =
          headerType && headerType !== 'application/octet-stream'
            ? headerType
            : guessMimeType(url);
        return { url, buffer: Buffer.from(await res.arrayBuffer()), mimeType };
      } catch (err) {
        // One unreachable asset should not sink the whole generation.
        console.error(`[generate] Failed to fetch asset ${url}:`, err);
        return null;
      }
    }),
  );

  const parts: any[] = [];
  let usedBytes = 0;
  for (const asset of assets) {
    if (!asset) continue;
    if (usedBytes + asset.buffer.byteLength > MAX_TOTAL_BYTES) {
      console.warn(
        `[generate] Skipped ${asset.url}: ${asset.buffer.byteLength} bytes exceeds the remaining inline budget`,
      );
      continue;
    }
    usedBytes += asset.buffer.byteLength;
    parts.push({
      inlineData: { data: asset.buffer.toString('base64'), mimeType: asset.mimeType },
    });
  }

  return parts;
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

async function generateWithLexiconGuard(
  parts: any[],
): Promise<{ responseText: string; report: ValidationReport; retried: boolean }> {
  const initial = await generateFromParts(parts);

  let parsed: CampaignShape | null = null;
  try {
    parsed = JSON.parse(initial);
  } catch {
    console.warn('[lexicon] could not parse initial response, skipping validation');
    return { responseText: initial, report: { violations: [], slopScore: 0, clean: true }, retried: false };
  }

  const report = validateCampaign(parsed!);
  return { responseText: initial, report, retried: false };
}

export async function POST(req: Request) {
  const startTime = Date.now();
  const posthog = new PostHog(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
    host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
  });

  // Populated as soon as the user is resolved so the catch block can always
  // attach identity to error events — even if the error fires deep in generation.
  let posthogUser: { id: string; email?: string | null } | null = null;
  // Populated when assetUrls is parsed (both demo and auth paths) so the catch
  // block knows whether a file upload was in flight when the error occurred.
  let posthogAssetCount: number | null = null;

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
      posthogAssetCount = assetUrls.length;

      const effectiveUrlContext = urlContext ? await resolveUrlContext(urlContext) : urlContext;

      const tweetFormat = campaignDirectives?.tweetFormat || 'single';
      const personaVoice = campaignDirectives?.personaVoice || 'Expert Content Strategist';
      const finalContext = campaignDirectives?.additionalContext
        ? `${textContext}\n\nAdditional Directives: ${campaignDirectives.additionalContext}`
        : textContext;

      if (containsPromptInjection(finalContext) || containsPromptInjection(effectiveUrlContext)) {
        return NextResponse.json(
          { error: 'Security Policy Violation: Invalid context structure detected.' },
          { status: 400 },
        );
      }

      const textPrompt = buildGenerationPrompt({ tweetFormat, personaVoice, textContext: finalContext, urlContext: effectiveUrlContext });
      const parts: any[] = [{ text: textPrompt }, ...(await buildFileParts(assetUrls))];

      const { responseText, report: lexiconReport, retried } =
        await generateWithLexiconGuard(parts);
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

    // Snapshot identity for the catch block — set here so any error thrown
    // after this point (Vertex, lexicon, plan check, etc.) is attributable.
    posthogUser = { id: user.id, email: user.email };

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
    posthogAssetCount = assetUrls.length;

    const effectiveUrlContext = urlContext ? await resolveUrlContext(urlContext) : urlContext;

    const enhancedText = textContext + githubContext;
    const tweetFormat = campaignDirectives?.tweetFormat || 'single';
    const personaVoice = campaignDirectives?.personaVoice || 'Expert Content Strategist';
    const finalContext = campaignDirectives?.additionalContext
      ? `${enhancedText}\n\nAdditional Directives: ${campaignDirectives.additionalContext}`
      : enhancedText;

    if (containsPromptInjection(finalContext) || containsPromptInjection(effectiveUrlContext)) {
      return NextResponse.json(
        { error: 'Security Policy Violation: Invalid context structure detected.' },
        { status: 400 },
      );
    }

    // Load the saved persona by id so its writing samples and style guide come
    // along. Service role because a bearer-token request has no cookie session
    // for RLS; loadPersonaVoice scopes the read to this user.
    const persona = await loadPersonaVoice(
      createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!),
      user.id,
      campaignDirectives?.personaId,
    );

    const textPrompt = buildGenerationPrompt({
      tweetFormat,
      personaVoice,
      textContext: finalContext,
      urlContext: effectiveUrlContext,
      voiceBlock: persona ? buildVoiceBlock(persona) : undefined,
      hasVoiceMaterial: persona ? hasVoiceMaterial(persona) : false,
    });
    const parts: any[] = [{ text: textPrompt }, ...(await buildFileParts(assetUrls))];

    const { responseText, report: lexiconReport, retried } =
      await generateWithLexiconGuard(parts);
    const lexiconWarnings = summarizeForClient(lexiconReport);

    await incrementCampaignGeneration(user.id);

    posthog.capture({
      distinctId: user.id,
      event: 'vertex_generation_completed',
      properties: { email: user.email, durationMs: Date.now() - startTime, personaVoice, personaVoiceMaterial: persona ? hasVoiceMaterial(persona) : false, hasFile: assetUrls.length > 0, assetCount: assetUrls.length, status: 'success', lexiconViolations: lexiconReport.violations.length, lexiconSlopScore: lexiconReport.slopScore, lexiconRetried: retried },
    });
    await posthog.shutdown();

    return NextResponse.json({ output: responseText, lexiconWarnings });
  } catch (error: any) {
    posthog.capture({
      distinctId: posthogUser?.id ?? req.headers.get('x-forwarded-for') ?? '127.0.0.1',
      event: 'vertex_generation_failed',
      properties: {
        durationMs: Date.now() - startTime,
        errorMessage: error.message,
        status: 'error',
        ...(posthogUser?.email ? { email: posthogUser.email } : {}),
        ...(posthogAssetCount !== null ? { hasFile: posthogAssetCount > 0, assetCount: posthogAssetCount } : {}),
      },
    });
    await posthog.shutdown();
    console.error('Vertex AI Generate Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
