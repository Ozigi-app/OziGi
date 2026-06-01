import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { verifyUnsubscribeToken } from '@/lib/gtm/unsubscribe-token'

const page = (title: string, body: string) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
           display: flex; align-items: center; justify-content: center;
           min-height: 100vh; margin: 0; background: #f9fafb; color: #111; }
    .card { background: white; border: 1px solid #e5e7eb; border-radius: 12px;
            padding: 2.5rem 3rem; max-width: 440px; text-align: center;
            box-shadow: 0 1px 3px rgba(0,0,0,.06); }
    h1 { font-size: 1.3rem; margin: 0 0 0.75rem; }
    p  { color: #6b7280; font-size: 0.95rem; line-height: 1.6; margin: 0; }
  </style>
</head>
<body><div class="card">${body}</div></body>
</html>`

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const token = searchParams.get('token')

  if (!token) {
    return new Response(
      page('Invalid link', '<h1>Invalid link</h1><p>This unsubscribe link is missing a token.</p>'),
      { status: 400, headers: { 'Content-Type': 'text/html' } }
    )
  }

  const ids = verifyUnsubscribeToken(token)
  if (!ids) {
    return new Response(
      page('Invalid link', '<h1>Invalid link</h1><p>This unsubscribe link is invalid or has expired.</p>'),
      { status: 400, headers: { 'Content-Type': 'text/html' } }
    )
  }

  const { leadId, campaignId } = ids

  // Check if already opted out
  const { data: lead } = await supabaseAdmin
    .from('leads')
    .select('status, name')
    .eq('id', leadId)
    .eq('campaign_id', campaignId)
    .single()

  if (lead?.status === 'opted_out') {
    return new Response(
      page('Already unsubscribed', `<h1>Already unsubscribed</h1><p>You've already been removed from this mailing list.</p>`),
      { status: 200, headers: { 'Content-Type': 'text/html' } }
    )
  }

  // Mark opted_out
  await supabaseAdmin
    .from('leads')
    .update({ status: 'opted_out', updated_at: new Date().toISOString() })
    .eq('id', leadId)
    .eq('campaign_id', campaignId)

  return new Response(
    page('Unsubscribed', `
      <h1>You've been unsubscribed</h1>
      <p>You won't receive any more emails from this campaign.<br/>We're sorry to see you go.</p>
    `),
    { status: 200, headers: { 'Content-Type': 'text/html' } }
  )
}
