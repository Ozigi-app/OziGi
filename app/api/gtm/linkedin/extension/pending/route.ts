import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { userIdFromExtensionToken, extensionCors } from '@/lib/gtm/extensionAuth'
import { composeLinkedInMessage } from '@/lib/gtm/composer'

// The extension polls this for the next LinkedIn action to perform in the user's
// own logged-in tab, with the lead's profile URL and the invitation note.
//
// Rows queued by /leads arrive without a note: writing 25 of them in the request
// that found the leads would mean 25 AI calls in one round trip. The note is
// written here instead, for the row being handed out, and saved so a retry
// doesn't pay for it twice.

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: extensionCors })
}

export async function GET(req: Request) {
  const userId = await userIdFromExtensionToken(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: extensionCors })

  const url = new URL(req.url)
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 3, 1), 10)

  const { data: items, error } = await supabaseAdmin
    .from('linkedin_queue')
    .select('id, lead_id, campaign_id, action, message, sequence_step, scheduled_at')
    .eq('user_id', userId)
    .eq('status', 'queued')
    // Connect only. The connection request and its note are the whole LinkedIn
    // channel — message/follow_up rows are historical and are never handed out.
    .eq('action', 'connect')
    .lte('scheduled_at', new Date().toISOString())
    .lt('attempts', 3)
    .order('scheduled_at', { ascending: true })
    .limit(limit)

  if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: extensionCors })
  if (!items?.length) return NextResponse.json({ actions: [] }, { headers: extensionCors })

  // Attach the lead's profile info so the content script can navigate + act.
  const leadIds = [...new Set(items.map(i => i.lead_id))]
  const { data: leads } = await supabaseAdmin
    .from('leads')
    .select('*')
    .in('id', leadIds)
  const leadById = new Map((leads ?? []).map(l => [l.id, l]))

  await Promise.all(items.map(i => ensureNote(i, leadById.get(i.lead_id))))

  const actions = items
    .map(i => {
      const lead = leadById.get(i.lead_id)
      if (!lead?.linkedin_url && !lead?.linkedin_profile_id) return null
      const profileId =
        lead?.linkedin_profile_id ??
        (lead?.linkedin_url?.match(/linkedin\.com\/in\/([^/?#]+)/)?.[1] ?? null)
      return {
        id: i.id,
        action: i.action,               // always 'connect'
        message: i.message ?? '',
        recipientName: lead?.name ?? null,
        profileId,
        profileUrl: profileId
          ? `https://www.linkedin.com/in/${profileId}/`
          : lead?.linkedin_url,
      }
    })
    .filter(Boolean)

  return NextResponse.json({ actions }, { headers: extensionCors })
}

// Writes the invitation note for a row that doesn't have one, and persists it.
// Mutates the row in place so the caller can read it back.
// Failing to write a note is not fatal: a bare invite still reaches the person,
// which beats stalling the queue behind a model outage.
async function ensureNote(
  item: { id: string; campaign_id: string; message: string | null; sequence_step: number },
  lead: Record<string, unknown> | undefined,
): Promise<void> {
  if (item.message?.trim() || !lead) return

  try {
    const { data: campaign } = await supabaseAdmin
      .from('campaigns')
      .select('*')
      .eq('id', item.campaign_id)
      .maybeSingle()
    if (!campaign) return

    const steps = Array.isArray(campaign.sequence_steps) ? campaign.sequence_steps : []
    const step = steps.find((s: { step: number }) => s?.step === item.sequence_step)
      ?? { step: item.sequence_step, channel: 'linkedin', delay_days: 0 }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const note = (await composeLinkedInMessage(lead as any, campaign as any, step as any, 'connect'))
      .slice(0, 300) // LinkedIn's hard limit on invitation notes

    if (!note.trim()) return
    item.message = note
    await supabaseAdmin.from('linkedin_queue').update({ message: note }).eq('id', item.id)
  } catch (e) {
    console.warn('[extension/pending] note composition failed, sending without one:', e)
  }
}
