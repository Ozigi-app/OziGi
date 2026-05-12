import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Script from "next/script";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Toaster } from "sonner";
import ErrorBoundary from "@/components/ErrorBoundary";
import { ThemeProvider } from "@/components/ThemeProvider";
import { GTAG_ID } from "@/lib/gtag";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Ozigi — AI Content That Sounds Human, Not Like ChatGPT",
  description: "Generate blog posts, email newsletters, LinkedIn posts, X threads, and technical briefs that sound like you wrote them — not AI. No robotic fluff. No endless editing. Human-sounding content in seconds.",
  keywords: [
    // Core value props
    "AI content that doesn't sound like AI",
    "AI content generator that sounds human",
    "content that doesn't sound like ChatGPT",
    "AI writing that needs no editing",
    "human-sounding AI content",
    // Blog posts
    "AI blog post generator",
    "generate blog posts that sound human",
    "blog writing AI tool",
    // Email newsletters
    "AI email newsletter generator",
    "newsletter content generator",
    "email marketing AI tool",
    "generate email newsletters",
    // LinkedIn
    "LinkedIn post generator AI",
    "AI LinkedIn content creator",
    "generate LinkedIn posts",
    "LinkedIn thought leadership AI",
    // X / Twitter
    "X thread generator",
    "Twitter thread AI",
    "AI tweets that sound human",
    "X content generator",
    // Technical content
    "technical brief generator",
    "AI for technical writing",
    "developer content generator",
    "technical documentation AI",
    // General
    "best AI content generator for creators",
    "content automation without AI voice",
    "AI writing tool for marketers",
  ],
  openGraph: {
    title: "Ozigi — AI Content That Sounds Human, Not Like ChatGPT",
    description: "Generate blog posts, email newsletters, LinkedIn posts, X threads, and technical briefs in your voice. No AI fluff. No editing needed.",
    url: "https://ozigi.app",
    siteName: "Ozigi",
    type: "website",
    images: [
      {
        url: "https://ozigi.app/og-image.png",
        width: 1200,
        height: 630,
        alt: "Ozigi — AI content that sounds like you wrote it",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Ozigi — AI Content That Sounds Human",
    description: "Blog posts, newsletters, LinkedIn, X threads, technical briefs — all in your voice, not AI's. No editing needed.",
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
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider>
          <ErrorBoundary>
            <Toaster position="bottom-right" theme="system" />
            {children}
          </ErrorBoundary>
        </ThemeProvider>
        <Analytics />
        <SpeedInsights />

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
