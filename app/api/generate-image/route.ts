import { NextResponse } from 'next/server';
import { getVertexAIClient } from '@/lib/genai-client';
import { Modality } from '@google/genai';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const s3 = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

export async function POST(req: Request) {
  try {
    const { text, platform, graphicTitle } = await req.json();

    if (!text) {
      return NextResponse.json({ error: 'No text provided' }, { status: 400 });
    }

    let prompt = '';
    let negativePrompt = '';

    if (graphicTitle?.trim()) {
      prompt = `A beautiful, eye-catching social media graphic for ${platform}. The design features the headline "${graphicTitle.trim()}" as the focal point, displayed in clean, modern, highly readable typography. The background complements the message with subtle gradients, soft colors, and minimal abstract elements. Professional, polished, and suitable for business or personal branding. High quality, sharp text.`;
      negativePrompt = 'spelling mistakes, typos, blurry text, messy fonts, cluttered design, ugly colors';
    } else {
      const cleanText = text.replace(/[\u{1F600}-\u{1F6FF}]/gu, '').substring(0, 200);
      prompt = `Create a visually appealing, abstract background image for a ${platform} post about: "${cleanText}". The image should be modern, professional, and evoke the mood of the content. Use soft gradients, subtle patterns, or abstract shapes. No text or words in the image. Clean, minimal, aesthetic. Suitable for professional social media.`;
      negativePrompt = 'text, words, letters, writing, watermark, ugly, cluttered, busy, low quality';
    }

    const client = await getVertexAIClient();
    const response = await client.models.generateContent({
      model: 'gemini-3.1-flash-image',
      contents: `${prompt}\n\nNegative instructions: ${negativePrompt}`,
      config: {
        responseModalities: [Modality.IMAGE],
      },
    });

    const imagePart = response.candidates?.[0]?.content?.parts?.find(part => part.inlineData);
    if (!imagePart?.inlineData) {
      throw new Error('No image generated');
    }

    const base64 = imagePart.inlineData.data!;
    const mimeType = imagePart.inlineData.mimeType || 'image/jpeg';
    const ext = mimeType.split('/')[1] ?? 'jpg';
    const key = `assets/generated/${Date.now()}.${ext}`;

    // Upload directly from the server — avoids browser CORS restrictions on R2
    const buffer = Buffer.from(base64, 'base64');
    await s3.send(new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: mimeType,
    }));

    const publicDomain = process.env.NEXT_PUBLIC_R2_DOMAIN || process.env.R2_ENDPOINT;
    const imageUrl = `${publicDomain}/${key}`;

    return NextResponse.json({ imageUrl });
  } catch (error: any) {
    console.error('Vertex AI Image Generation Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
