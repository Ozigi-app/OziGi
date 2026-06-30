export const maxDuration = 30;

import { NextResponse } from 'next/server'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { getVertexAIClient } from '@/lib/genai-client'
import { phCapture } from '@/lib/posthog'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

const demoLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(1, '24 h'),
  prefix: 'demo:newsletter',
})

export async function POST(req: Request) {
  const start = Date.now()
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? '127.0.0.1'
  const distinctId = `demo_${ip}`

  const { success } = await demoLimit.limit(ip)
  if (!success) {
    return NextResponse.json({ error: 'demo_limit_reached' }, { status: 403 })
  }

  const { topic, keyPoints, tone = 'conversational', authorName } = await req.json()

  if (!topic || typeof topic !== 'string' || topic.trim().length < 10) {
    return NextResponse.json({ error: 'topic must be at least 10 characters' }, { status: 400 })
  }

  const prompt = `You are writing a high-quality founder/creator email newsletter issue.

TOPIC: ${topic}
${keyPoints ? `KEY POINTS TO COVER:\n${keyPoints}` : ''}
TONE: ${tone}
${authorName ? `AUTHOR: ${authorName}` : ''}

Write a complete newsletter issue. Rules:
- Subject line: compelling, honest, 8-10 words max, no clickbait
- Opening: hook the reader in the first sentence — a sharp observation, surprising stat, or bold claim
- Body: 400-600 words, broken into 3-4 sections with clear headers
- Write like a smart human talking to another smart human — opinionated, direct, specific
- No corporate speak, no filler phrases, no "In today's fast-paced world..."
- End with ONE specific, actionable takeaway the reader can use this week
- Sign-off: brief, personal, in character with the tone
- Output ONLY valid HTML body content (no <html>/<head>/<body> wrappers — use <h2>, <p>, <ul>, <strong> etc.)

Return ONLY valid JSON: {"subject": "...", "body": "..."}`

  try {
    const client = await getVertexAIClient()
    const response = await client.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: { temperature: 0.8, maxOutputTokens: 4096, responseMimeType: 'application/json' },
    })

    const text: string =
      (response as any).text?.() ??
      (response as any).text ??
      response.candidates?.[0]?.content?.parts?.[0]?.text ??
      ''

    const clean = text.replace(/```json/gi, '').replace(/```/g, '').trim()
    const result = JSON.parse(clean)

    phCapture(distinctId, 'demo_newsletter_generated', {
      tone, durationMs: Date.now() - start,
    }).catch(() => {})

    return NextResponse.json(result)
  } catch (err: any) {
    phCapture(distinctId, 'demo_newsletter_error', { error: err?.message }).catch(() => {})
    return NextResponse.json({ error: 'Generation failed. Please try again.' }, { status: 500 })
  }
}
