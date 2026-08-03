import type { Metadata } from "next";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import NewsletterPopup from "@/components/NewsletterPopup";

export const metadata: Metadata = {
  title: "Ozigi Blog — How to Make AI Content Sound Human",
  description: "Insights, tutorials, and deep dives from the Ozigi team on making AI content sound human, building technical voice, and shipping authentic content at scale.",
  openGraph: {
    title: "Ozigi Blog — How to Make AI Content Sound Human",
    description: "Insights, tutorials, and deep dives on making AI content sound human, building technical voice, and shipping authentic content at scale.",
    url: "https://ozigi.app/blog",
    siteName: "Ozigi Blog",
    images: [
      {
        url: "https://blog.ozigi.app/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Ozigi Blog",
      },
    ],
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Ozigi Blog — How to Make AI Content Sound Human",
    description: "Insights and deep dives on making AI content sound human, building technical voice, and shipping authentic content at scale.",
    images: ["https://blog.ozigi.app/opengraph-image"],
    creator: "@ozigi_app",
    site: "@ozigi_app",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  alternates: {
    canonical: "https://ozigi.app/blog",
    types: {
      "application/rss+xml": [
        {
          url: "https://ozigi.app/blog/feed.xml",
          title: "Ozigi Blog RSS Feed",
        },
      ],
    },
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="alternate" type="application/rss+xml" href="https://ozigi.app/blog/feed.xml" title="Ozigi Blog RSS Feed" />
        <link rel="alternate" type="application/atom+xml" href="https://ozigi.app/blog/feed.xml" title="Ozigi Blog Atom Feed" />
        <link rel="me" href="https://mastodon.social/@Dumebi" />
      </head>
      <body className="bg-[#fafafa] font-sans text-slate-900 min-h-screen flex flex-col">
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
        <NewsletterPopup />
      </body>
    </html>
  );
}
