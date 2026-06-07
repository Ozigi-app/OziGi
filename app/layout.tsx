import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import "./globals.css";
import Script from "next/script";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Toaster } from "sonner";
import ErrorBoundary from "@/components/ErrorBoundary";
import { ThemeProvider } from "@/components/ThemeProvider";
import { GTAG_ID } from "@/lib/gtag";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Ozigi — Find Leads, Run Outreach, Publish Content",
    template: "%s | Ozigi",
  },
  description: "Ozigi helps small teams find leads, run email and LinkedIn outreach, and publish content that sounds human — all without a sales team.",
  keywords: [
    "lead sourcing for small businesses",
    "LinkedIn outreach for small teams",
    "email outreach automation",
    "content marketing for small teams",
    "AI content generator",
    "lead generation tool free",
    "founder-led sales tools",
    "cold email automation",
    "LinkedIn lead generation",
    "small business marketing tools",
    "AI email campaigns",
    "outreach automation free",
    "content marketing for startups",
    "AI LinkedIn posts",
    "reach more people online",
    "sales outreach for indie founders",
    "AI writing tool for marketers",
    "human-sounding AI content",
  ],
  openGraph: {
    title: "Ozigi — Find Leads, Run Outreach & Publish Content",
    description: "Find your next customers, reach out without sounding like a robot, and publish content that keeps you top of mind. Free for small teams.",
    url: "https://ozigi.app",
    siteName: "Ozigi",
    type: "website",
    images: [
      {
        url: "https://ozigi.app/og-image.png",
        width: 1200,
        height: 630,
        alt: "Ozigi — Find Leads, Run Outreach & Publish Content",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Ozigi — Find Leads, Run Outreach & Publish Content",
    description: "Find leads, run outreach, and publish content that sounds like you — free for small teams with no sales floor.",
    images: ["https://ozigi.app/og-image.png"],
    creator: "@DumebiTheWriter",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
  alternates: {
    canonical: "https://ozigi.app",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
            <head>
        {/* Favicon links */}
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        <link rel="manifest" href="/site.webmanifest" />
        <link rel="shortcut icon" href="/favicon.ico" />
        <meta property="og:image" content="https://ozigi.app/og-image.png" />
        <link rel="me" href="https://mastodon.social/@Dumebi" />
        <script src="https://analytics.ahrefs.com/analytics.js" data-key="MhdBfYlV5PLcSxQWguZYSQ" async></script>

        {/* Organization structured data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              name: "Ozigi",
              url: "https://ozigi.app",
              logo: "https://ozigi.app/og-image.png",
              description:
                "Ozigi helps small teams find leads, run email and LinkedIn outreach, and publish content that sounds human — all in one place.",
              sameAs: [
                "https://twitter.com/DumebiTheWriter",
                "https://mastodon.social/@Dumebi",
                "https://peerlist.io/dumebi",
              ],
              contactPoint: {
                "@type": "ContactPoint",
                contactType: "customer support",
                url: "https://ozigi.app/docs",
              },
            }),
          }}
        />

        {/* SoftwareApplication structured data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "SoftwareApplication",
              name: "Ozigi",
              applicationCategory: "BusinessApplication",
              operatingSystem: "Web",
              url: "https://ozigi.app",
              offers: {
                "@type": "Offer",
                price: "0",
                priceCurrency: "USD",
                description: "Free to start — no credit card required.",
              },
              description:
                "Free for small teams: find leads, run LinkedIn and email outreach, and publish content that sounds human — all in one place.",
            }),
          }}
        />
      </head>

      <body
        className={`${geistMono.variable} ${geistMono.className} antialiased`}
      >
        <ThemeProvider>
          <ErrorBoundary>
            <Toaster position="bottom-right" theme="system" />
            {children}
          </ErrorBoundary>
        </ThemeProvider>
        <Analytics />
        <SpeedInsights />

        {/* Ghostly analytics */}
        <Script
          src="https://ghostlyx.com/js/script.min.js"
          data-domain="ozigi.app"
          data-site-id="gx_BhB0iLgv5UUc"
          strategy="afterInteractive"
        />

        {/* Google Ads tag — loads on every page */}
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${GTAG_ID}`}
          strategy="afterInteractive"
        />
        <Script id="gtag-init" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GTAG_ID}');
          `}
        </Script>
      </body>
    </html>
  );
}
