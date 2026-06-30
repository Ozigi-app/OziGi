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
  prefix: 'demo:email',
})

export async function POST(req: Request) {
  const start = Date.now()
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? '127.0.0.1'
  const distinctId = `demo_${ip}`

  const { success } = await demoLimit.limit(ip)
  if (!success) {
    return NextResponse.json({ error: 'demo_limit_reached' }, { status: 403 })
  }

  const { senderName, productName, productDescription, targetDescription } = await req.json()

  if (!senderName || !productName || !productDescription || !targetDescription) {
    return NextResponse.json({ error: 'All fields are required' }, { status: 400 })
  }

  const prompt = `You are writing a cold outreach email on behalf of ${senderName}.

PRODUCT: ${productName} — ${productDescription}

TARGET PROSPECT: ${targetDescription}

Write a cold intro email. Rules:
- Subject: short, curiosity-driven, no spam words, max 8 words
- Body: 3-4 short paragraphs, plain conversational tone, NO corporate fluff
- Reference something specific implied by the target description to show you've done your research
- One clear CTA: "reply to learn more" or "happy to jump on a quick call"
- Sign off as "${senderName}"
- Output ONLY valid HTML for the email body (no <html>/<head>/<body> wrapper tags, just content tags like <p>, <br>, etc.)
- NEVER use placeholder brackets like [company], [name], [role]. Write real content or omit the reference.

Return ONLY valid JSON: {"subject": "...", "body": "..."}`

  try {
    const client = await getVertexAIClient()
    const response = await client.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: { temperature: 0.7, maxOutputTokens: 2048, responseMimeType: 'application/json' },
    })

    const text: string =
      (response as any).text?.() ??
      (response as any).text ??
      response.candidates?.[0]?.content?.parts?.[0]?.text ??
      ''

    const clean = text.replace(/```json/gi, '').replace(/```/g, '').trim()
    const result = JSON.parse(clean)

    phCapture(distinctId, 'demo_email_outreach_generated', {
      durationMs: Date.now() - start,
    }).catch(() => {})

    return NextResponse.json(result)
  } catch (err: any) {
    phCapture(distinctId, 'demo_email_outreach_error', { error: err?.message }).catch(() => {})
    return NextResponse.json({ error: 'Generation failed. Please try again.' }, { status: 500 })
  }
}
