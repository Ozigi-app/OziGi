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
    default: "Ozigi — Free GTM Suite",
    template: "%s | Ozigi",
  },
  description: "Ozigi is a free go-to-market suite for founders. Run LinkedIn outreach, email campaigns, and AI content generation — all in one place. No sales team required.",
  keywords: [
    "free GTM suite",
    "go-to-market tools for founders",
    "LinkedIn outreach automation",
    "email outreach for startups",
    "AI content generator",
    "GTM platform free",
    "founder-led sales tools",
    "cold email automation",
    "LinkedIn lead generation",
    "startup marketing tools",
    "AI email campaigns",
    "outreach automation free",
    "content marketing for startups",
    "AI LinkedIn posts",
    "GTM strategy tools",
    "sales outreach for indie founders",
    "AI writing tool for marketers",
    "human-sounding AI content",
  ],
  openGraph: {
    title: "Ozigi — Free GTM Suite for Founders",
    description: "LinkedIn outreach, email campaigns, and AI content generation — free. Built for founders who do their own GTM.",
    url: "https://ozigi.app",
    siteName: "Ozigi",
    type: "website",
    images: [
      {
        url: "https://ozigi.app/og-image.png",
        width: 1200,
        height: 630,
        alt: "Ozigi — Free GTM Suite for Founders",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Ozigi — Free GTM Suite for Founders",
    description: "LinkedIn outreach, email campaigns, AI content — free. Do your own GTM without a sales team.",
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
