import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getVertexAIClient } from '@/lib/genai-client'

export const maxDuration = 60

/**
 * Strips HTML tags and collapses whitespace.
 * Removes <script>, <style>, <nav>, <footer>, <header> blocks entirely
 * so Gemini gets the meaningful page content only.
 */
function extractText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
    .replace(/<footer[\s\S]*?<\/footer>/gi, ' ')
    .replace(/<header[\s\S]*?<\/header>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 10_000)   // keep the first ~10k chars — headline + hero content is enough
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { url } = await req.json() as { url?: string }
  if (!url) return NextResponse.json({ error: 'url is required' }, { status: 400 })

  // Normalise URL
  let targetUrl = url.trim()
  if (!/^https?:\/\//i.test(targetUrl)) targetUrl = `https://${targetUrl}`

  // Fetch the page server-side (avoids CORS, user-agent can be set)
  let pageText: string
  try {
    const res = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; OzigiBot/1.0)',
        Accept: 'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) return NextResponse.json({ error: `Could not fetch URL (${res.status})` }, { status: 400 })
    const html = await res.text()
    pageText = extractText(html)
    if (!pageText) return NextResponse.json({ error: 'Page returned no readable content' }, { status: 400 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: `Failed to fetch URL: ${msg}` }, { status: 400 })
  }

  // Pass page content to Gemini for structured extraction
  const ai = await getVertexAIClient()

  const prompt = `You are analysing a product website to set up an outbound sales campaign.

WEBSITE URL: ${targetUrl}

WEBSITE CONTENT (first 10,000 characters):
${pageText}

Extract the following and return as JSON:

{
  "product_name": "Short name of the product or company (2-4 words max)",
  "product_description": "1-2 sentence pitch: what it does and who it helps. Be specific, not generic.",
  "product_context": "A rich 3-5 paragraph brief that an AI sales rep would use to write compelling outreach messages. Cover: (1) The core problem this product solves and why it matters, (2) How the product works and its key features, (3) Concrete outcomes / results users get — be specific with numbers or comparisons if the page mentions them, (4) What makes it different from alternatives, (5) Any social proof, pricing signals, notable customers, or other credibility details from the page. Write in plain prose, no bullet points, no headers. This will be injected directly into AI prompts so make it dense with useful facts.",
  "company_name": "The company or founder name to use as the email sender",
  "cta_url": "The best URL for a call-to-action (the homepage URL if no better link is obvious)",
  "icp_description": "2-4 sentence description of the ideal customer. Who would get the most value from this product? Include: role/title, industry, company size, pain points, signals that indicate they're a good fit.",
  "campaign_name": "Suggested campaign name in the format 'Product – ICP segment – Month Year' (e.g. 'Ozigi – Dev Tool Founders – Jun 2026')"
}

Rules:
- Be specific. Generic descriptions like "helps businesses grow" are not useful.
- Infer the ICP from the product's value proposition even if it's not explicitly stated.
- If the website is behind a login or has very little content, do your best with what's there.
- Return ONLY valid JSON, no markdown fences.`

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    config: { responseMimeType: 'application/json', temperature: 0.2 },
  })

  const raw = response.text ?? '{}'
  try {
    const extracted = JSON.parse(raw) as {
      product_name: string
      product_description: string
      product_context: string
      company_name: string
      cta_url: string
      icp_description: string
      campaign_name: string
    }
    return NextResponse.json({ ok: true, extracted })
  } catch {
    return NextResponse.json({ error: 'Gemini returned malformed JSON', raw }, { status: 500 })
  }
}
