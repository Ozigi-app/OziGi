import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { triggerImmediateScrape, triggerImmediateSend } from '@/lib/gtm/scheduler'
import { getPlanStatus } from '@/lib/plan'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { action } = await req.json() as { action: 'scrape' | 'send' }

  // Verify ownership
  const { data: campaign } = await supabaseAdmin
    .from('campaigns')
    .select('id, user_id')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!campaign) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Plan gates
  const planStatus = await getPlanStatus(user.id)
  if (!planStatus.hasGtm) {
    return NextResponse.json(
      { error: 'GTM features are available on Growth and Pro plans.' },
      { status: 403 }
    )
  }
  if (action === 'scrape' && planStatus.creditsBalance < 1) {
    return NextResponse.json(
      { error: 'No credits remaining. Purchase a credit bundle or upgrade your plan.', creditsBalance: planStatus.creditsBalance, creditsUsed: planStatus.creditsUsed, creditsLimit: planStatus.creditsLimit },
      { status: 403 }
    )
  }
  if (action === 'send' && planStatus.sequenceSendsLimit !== -1 && planStatus.sequenceSendsUsed >= planStatus.sequenceSendsLimit) {
    return NextResponse.json(
      { error: 'Monthly sequence send limit reached. Upgrade to Growth or Pro for unlimited sends.', sequenceSendsUsed: planStatus.sequenceSendsUsed, sequenceSendsLimit: planStatus.sequenceSendsLimit },
      { status: 403 }
    )
  }

  const origin = new URL(req.url).origin

  if (origin.includes('localhost')) {
    // In dev: fire-and-forget so the trigger doesn't time out waiting for Gemini
    fetch(`${origin}/api/gtm/cron/${action}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.CRON_SECRET}`,
      },
      body: JSON.stringify({ campaignId: id }),
    }).catch(e => console.error(`[trigger] cron/${action} failed:`, e))

    return NextResponse.json({ ok: true, message: `${action} started` })
  }

  // In production: enqueue via QStash
  if (action === 'scrape') {
    await triggerImmediateScrape(id)
  } else if (action === 'send') {
    await triggerImmediateSend(id)
  } else {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  }

  return NextResponse.json({ ok: true, queued: action })
}
