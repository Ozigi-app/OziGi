import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          background: "#0A1628",
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          padding: "64px 72px",
          fontFamily: "sans-serif",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Subtle grid pattern via repeating borders */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />

        {/* Red accent line */}
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 320,
            height: 2,
            background: "#EB320A",
            opacity: 0.6,
          }}
        />

        {/* Corner brackets — top right */}
        <div
          style={{
            position: "absolute",
            top: 48,
            right: 64,
            width: 48,
            height: 48,
            borderTop: "2px solid rgba(255,255,255,0.15)",
            borderRight: "2px solid rgba(255,255,255,0.15)",
          }}
        />
        {/* Corner brackets — bottom left */}
        <div
          style={{
            position: "absolute",
            bottom: 48,
            left: 64,
            width: 48,
            height: 48,
            borderBottom: "2px solid rgba(255,255,255,0.15)",
            borderLeft: "2px solid rgba(255,255,255,0.15)",
          }}
        />

        {/* Red dots */}
        <div
          style={{
            display: "flex",
            gap: 8,
            marginBottom: 20,
          }}
        >
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              style={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: "#EB320A",
              }}
            />
          ))}
        </div>

        {/* Main title */}
        <div
          style={{
            fontSize: 100,
            fontWeight: 900,
            color: "#ffffff",
            letterSpacing: "-4px",
            lineHeight: 1,
            textTransform: "uppercase",
            marginBottom: 24,
          }}
        >
          OZIGI BLOG
        </div>

        {/* Tagline */}
        <div
          style={{
            fontSize: 22,
            color: "rgba(255,255,255,0.65)",
            fontWeight: 400,
            letterSpacing: "0.02em",
            lineHeight: 1.4,
            maxWidth: 680,
          }}
        >
          Insights, tutorials, and deep dives on making AI content sound human
        </div>

        {/* Domain badge */}
        <div
          style={{
            position: "absolute",
            top: 56,
            left: 72,
            fontSize: 18,
            color: "rgba(255,255,255,0.35)",
            letterSpacing: "0.05em",
          }}
        >
          ozigi.app/blog
        </div>
      </div>
    ),
    { ...size }
  );
}
