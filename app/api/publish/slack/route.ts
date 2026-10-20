import { NextResponse } from "next/server";
import { reportFailure } from "@/lib/monitor";

export async function POST(req: Request) {
  try {
    const { content, webhookUrl, imageUrl } = await req.json();

    if (!webhookUrl) {
      return NextResponse.json({ error: "No webhook URL provided" }, { status: 400 });
    }

    // Validate webhook URL
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(webhookUrl);
    } catch {
      return NextResponse.json({ error: "Malformed webhook URL." }, { status: 400 });
    }

    if (parsedUrl.hostname !== "hooks.slack.com") {
      return NextResponse.json(
        { error: "Invalid Slack webhook URL. Must be https://hooks.slack.com/services/..." },
        { status: 403 }
      );
    }

    const payload: any = { text: content };
    if (imageUrl) {
      payload.blocks = [
        {
          type: "section",
          text: { type: "mrkdwn", text: content },
        },
        {
          type: "image",
          image_url: imageUrl,
          alt_text: "Generated image",
        },
      ];
      delete payload.text; // Slack ignores top-level text if blocks are present
    }

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Slack responded with ${response.status}: ${errorText}`);
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    await reportFailure("publish.slack", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}