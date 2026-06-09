import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'Ozigi — A full pipeline. Without hiring anyone.';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          display: 'flex',
          flexDirection: 'column',
          background: '#070E1C',
          position: 'relative',
          overflow: 'hidden',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        {/* Subtle grid */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
            display: 'flex',
          }}
        />

        {/* Red radial glow — top right */}
        <div
          style={{
            position: 'absolute',
            top: -120,
            right: -120,
            width: 600,
            height: 600,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(232,50,10,0.18) 0%, transparent 65%)',
            display: 'flex',
          }}
        />

        {/* Blue radial glow — bottom left */}
        <div
          style={{
            position: 'absolute',
            bottom: -80,
            left: -80,
            width: 480,
            height: 480,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(30,74,138,0.22) 0%, transparent 65%)',
            display: 'flex',
          }}
        />

        {/* Red left accent bar */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: 6,
            height: '100%',
            background: '#E8320A',
            display: 'flex',
          }}
        />

        {/* Top bar: logo + url */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '48px 72px 0 80px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://ozigi.app/logo.png"
              width={40}
              height={40}
              alt=""
              style={{ borderRadius: 8 }}
            />
            <span
              style={{
                color: '#ffffff',
                fontSize: 26,
                fontWeight: 900,
                letterSpacing: '-1px',
                textTransform: 'uppercase',
              }}
            >
              Ozigi
            </span>
          </div>

          <span
            style={{
              color: 'rgba(255,255,255,0.3)',
              fontSize: 15,
              fontWeight: 600,
              letterSpacing: '0.06em',
            }}
          >
            ozigi.app
          </span>
        </div>

        {/* Main content */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            padding: '0 80px',
          }}
        >
          {/* Eyebrow */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              marginBottom: 28,
            }}
          >
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: '#E8320A',
              }}
            />
            <span
              style={{
                color: '#E8320A',
                fontSize: 14,
                fontWeight: 900,
                letterSpacing: '0.22em',
                textTransform: 'uppercase',
              }}
            >
              Outbound · Content · Pipeline
            </span>
          </div>

          {/* Headline line 1 */}
          <div
            style={{
              fontSize: 92,
              fontWeight: 900,
              color: '#ffffff',
              letterSpacing: '-3.5px',
              lineHeight: 0.95,
              textTransform: 'uppercase',
              display: 'flex',
            }}
          >
            A full pipeline.
          </div>

          {/* Headline line 2 — on red slab */}
          <div
            style={{
              display: 'flex',
              marginTop: 8,
              lineHeight: 0.95,
            }}
          >
            <div
              style={{
                background: '#E8320A',
                padding: '6px 28px 12px 0',
                display: 'flex',
                alignItems: 'baseline',
              }}
            >
              <span
                style={{
                  fontSize: 92,
                  fontWeight: 900,
                  color: '#ffffff',
                  letterSpacing: '-3.5px',
                  textTransform: 'uppercase',
                }}
              >
                Without hiring
              </span>
            </div>
            <span
              style={{
                fontSize: 92,
                fontWeight: 900,
                color: '#E8320A',
                letterSpacing: '-3.5px',
                textTransform: 'uppercase',
                marginLeft: 16,
              }}
            >
              anyone.
            </span>
          </div>

          {/* Subtext */}
          <div
            style={{
              marginTop: 32,
              fontSize: 20,
              fontWeight: 400,
              color: 'rgba(255,255,255,0.55)',
              lineHeight: 1.5,
              maxWidth: 700,
              display: 'flex',
            }}
          >
            Ozigi puts you in front of your ideal buyer, starts the conversation,
            and keeps you visible until they're ready to say yes.
          </div>
        </div>

        {/* Bottom strip */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '20px 80px',
            borderTop: '1px solid rgba(255,255,255,0.07)',
          }}
        >
          {/* Channel pills */}
          <div style={{ display: 'flex', gap: 8 }}>
            {['LinkedIn', 'Cold Email', 'Content', 'Follow-up'].map((p) => (
              <div
                key={p}
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 100,
                  padding: '7px 16px',
                  color: 'rgba(255,255,255,0.6)',
                  fontSize: 13,
                  fontWeight: 600,
                  display: 'flex',
                }}
              >
                {p}
              </div>
            ))}
          </div>

          {/* CTA badge */}
          <div
            style={{
              background: '#E8320A',
              borderRadius: 100,
              padding: '10px 24px',
              color: '#ffffff',
              fontSize: 13,
              fontWeight: 900,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              display: 'flex',
            }}
          >
            Fill my pipeline →
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
