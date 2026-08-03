import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { userIdFromExtensionToken, extensionCors } from '@/lib/gtm/extensionAuth'

// The extension polls this for the next batch of LinkedIn actions to perform in
// the user's own logged-in tab. Returns queued items that are due now, with the
// lead's profile URL and the pre-composed message text.

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
    .select('id, lead_id, action, message, sequence_step, scheduled_at')
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
    .select('id, name, linkedin_url, linkedin_profile_id')
    .in('id', leadIds)
  const leadById = new Map((leads ?? []).map(l => [l.id, l]))

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
