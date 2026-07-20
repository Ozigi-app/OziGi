import { NextResponse } from "next/server";

// Same-origin proxy so the browser can download R2-hosted images without CORS
// issues. Only allows URLs on our own storage domain to prevent SSRF.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get("url");
  const filename = (searchParams.get("filename") || "ozigi-image.jpg")
    // strip characters that could break the Content-Disposition header
    .replace(/[^\w.\- ]/g, "");

  if (!url) {
    return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
  }

  const allowedHosts = [
    process.env.NEXT_PUBLIC_R2_DOMAIN,
    process.env.R2_ENDPOINT,
  ]
    .filter((d): d is string => !!d)
    .map((d) => {
      try { return new URL(d).host; } catch { return d; }
    });

  let target: URL;
  try {
    target = new URL(url);
  } catch {
    return NextResponse.json({ error: "Invalid url" }, { status: 400 });
  }

  if (target.protocol !== "https:" || !allowedHosts.includes(target.host)) {
    return NextResponse.json({ error: "URL not allowed" }, { status: 403 });
  }

  const upstream = await fetch(target.toString());
  if (!upstream.ok || !upstream.body) {
    return NextResponse.json(
      { error: `Failed to fetch image (${upstream.status})` },
      { status: 502 }
    );
  }

  return new Response(upstream.body, {
    headers: {
      "Content-Type": upstream.headers.get("content-type") || "image/jpeg",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, max-age=0",
    },
  });
}
