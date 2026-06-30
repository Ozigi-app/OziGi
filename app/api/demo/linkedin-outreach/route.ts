export const maxDuration = 20;

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
  prefix: 'demo:linkedin',
})

export async function POST(req: Request) {
  const start = Date.now()
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? '127.0.0.1'
  const distinctId = `demo_${ip}`

  const { success } = await demoLimit.limit(ip)
  if (!success) {
    return NextResponse.json({ error: 'demo_limit_reached' }, { status: 403 })
  }

  const { senderName, productName, productDescription, targetDescription, messageType = 'connect' } = await req.json()

  if (!senderName || !productName || !targetDescription) {
    return NextResponse.json({ error: 'senderName, productName, and targetDescription are required' }, { status: 400 })
  }

  const connectPrompt = `Write a short LinkedIn connection request note from ${senderName}.

TARGET PROSPECT: ${targetDescription}

Rules:
- HARD limit: 300 characters total including the sign-off
- Do NOT pitch or mention a product — this is a connection request, not a sales message
- One sentence: reference something specific from their description to show you looked
- One sentence: briefly say who you are and why you want to connect
- End with "— ${senderName}"
- Plain text only — no HTML, no markdown, no emojis
- NEVER use placeholder brackets. Write real content or omit the reference.

Return ONLY the note text, nothing else.`

  const messagePrompt = `Write a LinkedIn direct message from ${senderName} about ${productName}${productDescription ? ` — ${productDescription}` : ''}.

TARGET PROSPECT: ${targetDescription}

Rules:
- 2-3 short sentences. Get to the point fast.
- Reference something from their description to show you looked.
- Make one specific claim about ${productName} — not a generic pitch.
- One soft CTA: "happy to chat if useful"
- Sign off as "${senderName}"
- Plain text only — no HTML, no markdown, no bullet points
- NEVER use placeholder brackets. Write real content or omit the reference.

Return ONLY the message text, nothing else.`

  try {
    const client = await getVertexAIClient()
    const response = await client.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [{ role: 'user', parts: [{ text: messageType === 'connect' ? connectPrompt : messagePrompt }] }],
      config: { temperature: 0.7, maxOutputTokens: 512 },
    })

    const message: string =
      (response as any).text?.() ??
      (response as any).text ??
      response.candidates?.[0]?.content?.parts?.[0]?.text ??
      ''

    phCapture(distinctId, 'demo_linkedin_outreach_generated', {
      messageType, durationMs: Date.now() - start,
    }).catch(() => {})

    return NextResponse.json({ message: message.trim() })
  } catch (err: any) {
    phCapture(distinctId, 'demo_linkedin_outreach_error', { error: err?.message }).catch(() => {})
    return NextResponse.json({ error: 'Generation failed. Please try again.' }, { status: 500 })
  }
}
