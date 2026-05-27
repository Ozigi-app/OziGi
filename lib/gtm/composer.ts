import { getVertexAIClient } from '@/lib/genai-client'
import type { Campaign, Lead, SequenceStep } from '@/lib/types/gtm'

const MODEL = 'gemini-2.0-flash'

export interface ComposedEmail {
  subject: string
  body: string  // HTML
}

export async function composeEmail(
  lead: Lead,
  campaign: Campaign,
  step: SequenceStep
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

  const stepPrompts: Record<number, string> = {
    1: `You are writing a cold outreach email for a B2B SaaS product called Ozigi (ozigi.app).
Ozigi is an AI-powered content creation platform that helps developers and technical founders create professional marketing content (blog posts, LinkedIn posts, newsletters) 10x faster.

CAMPAIGN ICP:
${icpSummary}

LEAD PROFILE:
${leadContext}

Write a cold intro email (step 1 of 3). Rules:
- Subject: short, curiosity-driven, no spam words, max 8 words
- Body: 3-4 short paragraphs, plain conversational tone, NO corporate fluff
- Reference something specific from their profile (bio, GitHub work, topics)
- One clear CTA: visit ozigi.app or reply to learn more
- Sign off as "Dumebi, Founder @ Ozigi"
- Output ONLY valid HTML for the email body (no <html>/<head>/<body> wrapper tags, just content tags)

Return JSON: {"subject": "...", "body": "..."}`,

    2: `You are writing a follow-up email (step 2 of 3) for Ozigi, an AI content platform for developers.
The recipient did not reply to the first email.

LEAD PROFILE:
${leadContext}

Rules:
- New angle: don't repeat step 1. Focus on a specific pain point (time spent writing docs, blog posts, LinkedIn vs. shipping)
- Subject: different from step 1, short, direct
- Body: 2-3 paragraphs max. Acknowledge they're busy. Lead with value.
- Same sign off: "Dumebi, Founder @ Ozigi"
- Output ONLY valid HTML for the email body (no wrapper tags)

Return JSON: {"subject": "...", "body": "..."}`,

    3: `You are writing a final breakup email (step 3 of 3) for Ozigi.
The recipient did not reply to two previous emails.

LEAD PROFILE:
${leadContext}

Rules:
- This is the last email. Keep it very short (2 paragraphs max).
- Light, non-pushy tone — "closing the loop"
- Leave the door open for the future
- No hard sell
- Sign off: "Dumebi, Founder @ Ozigi"
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

  return { subject: parsed.subject, body: parsed.body }
}

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
