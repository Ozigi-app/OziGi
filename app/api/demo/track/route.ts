import { NextResponse } from 'next/server'
import { phCapture } from '@/lib/posthog'

export async function POST(req: Request) {
  try {
    const { event, properties } = await req.json()
    if (!event || typeof event !== 'string') {
      return NextResponse.json({ error: 'event required' }, { status: 400 })
    }
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? '127.0.0.1'
    const distinctId = `demo_${ip}`
    await phCapture(distinctId, event, { ...properties, source: 'demo_page', ip })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false })
  }
}
