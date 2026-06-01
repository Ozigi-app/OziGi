import { getVertexAIClient } from '@/lib/genai-client'
import { createUnsubscribeToken } from '@/lib/gtm/unsubscribe-token'
import type { Campaign, Lead, SequenceStep } from '@/lib/types/gtm'

const MODEL = 'gemini-3-flash-preview'

export interface ComposedEmail {
  subject: string
  body: string  // HTML
}

function unsubscribeFooter(leadId: string, campaignId: string, appUrl: string): string {
  const token = createUnsubscribeToken(leadId, campaignId)
  const url   = `${appUrl}/api/gtm/unsubscribe?token=${token}`
  return `
<div style="margin-top:40px;padding-top:16px;border-top:1px solid #e5e7eb;text-align:center;font-size:11px;color:#9ca3af;font-family:sans-serif;">
  You're receiving this because you match the profile we look for.<br/>
  <a href="${url}" style="color:#9ca3af;">Unsubscribe</a>
</div>`
}

export async function composeEmail(
  lead: Lead,
  campaign: Campaign,
  step: SequenceStep,
  appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
): Promise<ComposedEmail> {
  const ai = await getVertexAIClient()

  const icpSummary = [
    campaign.icp_config.job_titles?.length ? `Job titles: ${campaign.icp_config.job_titles.join(', ')}` : '',
    campaign.icp_config.industries?.length ? `Industries: ${campaign.icp_config.industries.join(', ')}` : '',
    campaign.icp_config.keywords?.length ? `Keywords: ${campaign.icp_config.keywords.join(', ')}` : '',
  ].filter(Boolean).join('\n')

  const leadContext = [
    lead.name ? `Name: ${lead.name}` : '',
    lead.bio ? `Bio: ${lead.bio}` : '',
    lead.company ? `Company: ${lead.company}` : '',
    lead.github_username ? `GitHub: github.com/${lead.github_username}` : '',
    lead.tags?.length ? `Tags/Topics: ${lead.tags.join(', ')}` : '',
    lead.location ? `Location: ${lead.location}` : '',
  ].filter(Boolean).join('\n')

  const sender      = campaign.sender_name        || 'the sender'
  const title       = campaign.sender_title       || ''
  const product     = campaign.product_name       || 'our product'
  const pitch       = campaign.product_description|| ''
  const cta         = campaign.cta_url            || ''
  const signoff     = title ? `${sender}, ${title}` : sender
  const ctaLine     = cta ? `visit ${cta} or reply to learn more` : 'reply to learn more'
  const voiceLine   = campaign.persona_voice
    ? `\nWRITING VOICE / PERSONA:\n${campaign.persona_voice}\nAdapt your tone to match this persona.`
    : ''

  const stepPrompts: Record<number, string> = {
    1: `You are writing a cold outreach email on behalf of ${sender}${title ? ` (${title})` : ''}.

PRODUCT:
${product}${pitch ? ` — ${pitch}` : ''}
${voiceLine}
CAMPAIGN ICP:
${icpSummary}

LEAD PROFILE:
${leadContext}

Write a cold intro email (step 1 of 3). Rules:
- Subject: short, curiosity-driven, no spam words, max 8 words
- Body: 3-4 short paragraphs, plain conversational tone, NO corporate fluff
- Reference something specific from their profile (bio, GitHub work, topics)
- One clear CTA: ${ctaLine}
- Sign off as "${signoff}"
- Output ONLY valid HTML for the email body (no <html>/<head>/<body> wrapper tags, just content tags)

Return JSON: {"subject": "...", "body": "..."}`,

    2: `You are writing a follow-up email (step 2 of 3) for ${product}.
The recipient did not reply to the first email.
${voiceLine}
LEAD PROFILE:
${leadContext}

Rules:
- New angle: don't repeat step 1. Focus on a specific pain point relevant to ${product}.
- Subject: different from step 1, short, direct
- Body: 2-3 paragraphs max. Acknowledge they're busy. Lead with value.
- CTA: ${ctaLine}
- Sign off as "${signoff}"
- Output ONLY valid HTML for the email body (no wrapper tags)

Return JSON: {"subject": "...", "body": "..."}`,

    3: `You are writing a final breakup email (step 3 of 3) for ${product}.
The recipient did not reply to two previous emails.
${voiceLine}
LEAD PROFILE:
${leadContext}

Rules:
- This is the last email. Keep it very short (2 paragraphs max).
- Light, non-pushy tone — "closing the loop"
- Leave the door open for the future
- No hard sell
- Sign off as "${signoff}"
- Output ONLY valid HTML for the email body (no wrapper tags)

Return JSON: {"subject": "...", "body": "..."}`,
  }

  const prompt = stepPrompts[step.step] ?? stepPrompts[1]

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    config: {
      responseMimeType: 'application/json',
      temperature: 0.7,
    },
  })

  const raw = response.text ?? ''
  const parsed = JSON.parse(raw) as { subject: string; body: string }

  if (!parsed.subject || !parsed.body) {
    throw new Error(`Composer returned incomplete response for lead ${lead.id}`)
  }

  // Append unsubscribe footer to every outbound email
  const body = parsed.body + unsubscribeFooter(lead.id, campaign.id, appUrl)

  return { subject: parsed.subject, body }
}

// ─── LinkedIn message composer ───────────────────────────────────────────────

export async function composeLinkedInMessage(
  lead: Lead,
  campaign: Campaign,
  step: SequenceStep,
  action: 'connect' | 'message' | 'follow_up'
): Promise<string> {
  const ai = await getVertexAIClient()

  const leadContext = [
    lead.name ? `Name: ${lead.name}` : '',
    lead.bio ? `Bio: ${lead.bio}` : '',
    lead.company ? `Company: ${lead.company}` : '',
    lead.github_username ? `GitHub: github.com/${lead.github_username}` : '',
    lead.tags?.length ? `Topics: ${lead.tags.join(', ')}` : '',
  ].filter(Boolean).join('\n')

  const sender  = campaign.sender_name        || 'the sender'
  const title   = campaign.sender_title       || ''
  const product = campaign.product_name       || 'our product'
  const pitch   = campaign.product_description|| ''
  const cta     = campaign.cta_url            || ''
  const signoff = title ? `${sender}, ${title}` : sender
  const ctaLine = cta ? `check out ${cta} or reply to chat` : 'reply to chat'

  const prompts: Record<typeof action, string> = {
    connect: `Write a short LinkedIn connection request note from ${sender}${title ? `, ${title}` : ''}.

LEAD PROFILE:
${leadContext}

Rules:
- HARD limit: 300 characters total including the sign-off
- Do NOT pitch or mention a product — this is a connection request, not a sales message
- One sentence: reference something genuinely specific from their profile (work, topics, bio) to show you looked
- One sentence: briefly say who you are and why you want to connect (shared interest, industry, etc.)
- End with "— ${sender}" (no title, keep it personal)
- Plain text only — no HTML, no markdown, no emojis

Bad example: "Hi, I build tools for developers and wanted to connect."
Good example: "Your work on open-source TypeScript tooling caught my eye — I'm also building in that space and would love to stay in touch. — ${sender}"

Return ONLY the note text, nothing else.`,

    message: `Write a LinkedIn direct message (step ${step.step}) from ${sender} about ${product}${pitch ? ` — ${pitch}` : ''}.

LEAD PROFILE:
${leadContext}

Rules:
- 2-3 short sentences. Get to the point fast.
- Reference something from their profile to show you looked.
- One soft CTA: ${ctaLine}
- Sign off as "${signoff}"
- Plain text only — no HTML, no markdown, no bullet points

Return ONLY the message text, nothing else.`,

    follow_up: `Write a LinkedIn follow-up message from ${sender} about ${product}. They haven't replied to your previous message.

LEAD PROFILE:
${leadContext}

Rules:
- Very short: 2 sentences max
- Different angle from the first message
- Light touch, not pushy
- Sign off as "${signoff}"
- Plain text only — no HTML, no markdown

Return ONLY the message text, nothing else.`,
  }

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: [{ role: 'user', parts: [{ text: prompts[action] }] }],
    config: { temperature: 0.7 },
  })

  const text = (response.text ?? '').trim()
  if (!text) throw new Error(`LinkedIn composer returned empty message for lead ${lead.id}`)
  return text
}

// ─── ICP parser ──────────────────────────────────────────────────────────────

// Parses a natural-language ICP description into structured config
export async function parseIcpDescription(description: string): Promise<Campaign['icp_config']> {
  const ai = await getVertexAIClient()

  const prompt = `Extract structured ICP (Ideal Customer Profile) data from this description:

"${description}"

Return JSON with these fields (arrays of strings):
{
  "job_titles": [],        // e.g. ["Software Engineer", "CTO", "Indie Developer"]
  "industries": [],        // e.g. ["SaaS", "Developer Tools", "FinTech"]
  "company_sizes": [],     // e.g. ["1-10", "11-50"] — use these exact ranges: 1-10, 11-50, 51-200, 201-1000, 1000+
  "keywords": [],          // skills/topics that signal a match, e.g. ["open source", "TypeScript", "side project"]
  "seniority_levels": [],  // e.g. ["senior", "lead", "founder"] — optional
  "locations": []          // e.g. ["United States", "Europe"] — optional, empty if global
}`

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    config: { responseMimeType: 'application/json', temperature: 0.2 },
  })

  return JSON.parse(response.text ?? '{}') as Campaign['icp_config']
}
