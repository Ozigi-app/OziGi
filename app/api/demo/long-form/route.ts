export const maxDuration = 60;

import { NextResponse } from 'next/server'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { getVertexAIClient } from '@/lib/genai-client'
import { buildLongFormPrompt, parseLongFormResponse } from '@/lib/prompts/long-form'
import { containsPromptInjection } from '@/lib/prompts'
import { phCapture } from '@/lib/posthog'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

const demoLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(1, '24 h'),
  prefix: 'demo:longform',
})

export async function POST(req: Request) {
  const start = Date.now()
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? '127.0.0.1'
  const distinctId = `demo_${ip}`

  const { success } = await demoLimit.limit(ip)
  if (!success) {
    return NextResponse.json({ error: 'demo_limit_reached' }, { status: 403 })
  }

  const {
    context,
    tone = 'professional',
    structure = 'narrative',
    depth = 'intermediate',
    targetLength = 1500,
  } = await req.json()

  if (!context || typeof context !== 'string' || context.trim().length < 30) {
    return NextResponse.json({ error: 'context must be at least 30 characters' }, { status: 400 })
  }
  if (containsPromptInjection(context)) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
  }

  try {
    const prompt = buildLongFormPrompt({
      context: context.trim(),
      tone,
      targetLength: Math.min(targetLength, 2500),
      structure,
      depth,
    })

    const client = await getVertexAIClient()
    const response = await client.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: { temperature: 0.75, maxOutputTokens: 16384 },
    })

    const text: string =
      (response as any).text?.() ??
      (response as any).text ??
      response.candidates?.[0]?.content?.parts?.[0]?.text ??
      ''

    const article = parseLongFormResponse(text)

    phCapture(distinctId, 'demo_longform_generated', {
      tone, structure, depth, targetLength,
      durationMs: Date.now() - start,
    }).catch(() => {})

    return NextResponse.json({ article })
  } catch (err: any) {
    phCapture(distinctId, 'demo_longform_error', { error: err?.message }).catch(() => {})
    return NextResponse.json({ error: 'Generation failed. Please try again.' }, { status: 500 })
  }
}
