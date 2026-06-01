import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { incrementCampaignGeneration, incrementNewsletterGeneration } from '@/lib/plan'

/**
 * POST /api/stats/increment
 * Body: { type: 'newsletter' | 'social' }
 *
 * Called client-side after a successful generation to bump the right counter.
 */
export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { type } = await req.json()

  if (type === 'newsletter') {
    await incrementNewsletterGeneration(user.id)
  } else {
    await incrementCampaignGeneration(user.id)
  }

  return NextResponse.json({ ok: true })
}
