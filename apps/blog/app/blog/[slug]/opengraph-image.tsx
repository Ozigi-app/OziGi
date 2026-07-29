import { ImageResponse } from "next/og";
import { getPostBySlug } from "@/lib/blog";

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function PostOgImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);

  const title = post?.title || "Ozigi Blog";
  const section = post?.section || "Blog";
  const author = post?.author || "";

  // Truncate title for the image canvas
  const displayTitle = title.length > 72 ? title.slice(0, 72).trimEnd() + "…" : title;

  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          background: "#0A1628",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px 72px",
          fontFamily: "sans-serif",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Grid pattern */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />

        {/* Red diagonal accent */}
        <div
          style={{
            position: "absolute",
            top: -60,
            right: -60,
            width: 420,
            height: 420,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(232,50,10,0.18) 0%, transparent 70%)",
          }}
        />

        {/* Top bar: domain + section pill */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span
            style={{
              fontSize: 18,
              color: "rgba(255,255,255,0.35)",
              letterSpacing: "0.05em",
            }}
          >
            ozigi.app/blog
          </span>
          {section && (
            <span
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: "#E8320A",
                letterSpacing: "0.15em",
                textTransform: "uppercase",
                background: "rgba(232,50,10,0.12)",
                border: "1px solid rgba(232,50,10,0.3)",
                borderRadius: 6,
                padding: "6px 14px",
              }}
            >
              {section}
            </span>
          )}
        </div>

        {/* Title */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 20,
            flex: 1,
            justifyContent: "center",
          }}
        >
          {/* Red accent bar */}
          <div
            style={{
              width: 48,
              height: 4,
              background: "#E8320A",
              borderRadius: 2,
            }}
          />
          <div
            style={{
              fontSize: title.length > 55 ? 46 : 56,
              fontWeight: 900,
              color: "#ffffff",
              letterSpacing: "-1.5px",
              lineHeight: 1.1,
              textTransform: "uppercase",
            }}
          >
            {displayTitle}
          </div>
        </div>

        {/* Bottom bar: author + Ozigi brand */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderTop: "1px solid rgba(255,255,255,0.08)",
            paddingTop: 24,
          }}
        >
          {author ? (
            <span style={{ fontSize: 16, color: "rgba(255,255,255,0.55)", fontWeight: 500 }}>
              By {author}
            </span>
          ) : (
            <span />
          )}
          <span
            style={{
              fontSize: 18,
              fontWeight: 900,
              color: "rgba(255,255,255,0.9)",
              letterSpacing: "-0.5px",
              textTransform: "uppercase",
            }}
          >
            Ozigi
          </span>
        </div>
      </div>
    ),
    { ...size }
  );
}
