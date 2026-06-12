export const maxDuration = 60;

import { NextResponse } from 'next/server';
import { getVertexAIClient } from '@/lib/genai-client';

export async function POST(req: Request) {
  try {
    const { postText } = await req.json();

    if (!postText?.trim()) {
      return NextResponse.json({ error: 'No post text provided' }, { status: 400 });
    }

    const client = await getVertexAIClient();

    const prompt = `You are extracting key insights from a LinkedIn post to create a slide carousel.

Extract 5–8 distinct, punchy takeaways. Each slide needs:
- title: 4–8 words maximum, no filler ("The key is…", "Here's why…"). Make it declarative or provocative.
- body: 1–2 sentences that expand on the title. Leave empty string if the title is self-contained.

Return ONLY valid JSON — an array of objects with "title" and "body" string fields. No markdown, no commentary.

Post:
${postText.trim()}`;

    const response = await client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        temperature: 0.4,
      },
    });

    const raw = response.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

    let slides: { title: string; body: string }[];
    try {
      slides = JSON.parse(raw);
    } catch {
      // Strip any accidental markdown fences
      const cleaned = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
      slides = JSON.parse(cleaned);
    }

    if (!Array.isArray(slides) || slides.length === 0) {
      throw new Error('Model returned unexpected format');
    }

    // Normalise and cap
    const normalized = slides.slice(0, 8).map((s) => ({
      title: String(s.title ?? '').trim(),
      body: String(s.body ?? '').trim(),
    }));

    return NextResponse.json({ slides: normalized });
  } catch (error: any) {
    console.error('Carousel slide generation error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
