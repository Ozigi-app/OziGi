import type { NextConfig } from "next";
import createMDX from "@next/mdx";

const nextConfig: NextConfig = {
  pageExtensions: ["js", "jsx", "ts", "tsx", "md", "mdx"],
  // Pages render both natively at blog.ozigi.app and proxied at ozigi.app/blog/*.
  // Next.js's built JS/CSS bundles are referenced by root-relative /_next/static/*
  // paths, which resolve against whichever host the browser is actually on — so
  // when proxied, they'd 404 against ozigi.app instead of loading from here.
  // assetPrefix forces them to always load from this origin regardless.
  assetPrefix: "https://blog.ozigi.app",
images: {
  dangerouslyAllowSVG: true,
  contentDispositionType: 'attachment',
  // coverImage/authorImage are absolute blog.ozigi.app URLs (see lib/blog.ts) so
  // they resolve correctly when pages are viewed via the ozigi.app/blog proxy.
  // The /_next/image optimization endpoint doesn't pick up assetPrefix the way
  // /_next/static does, so it stays root-relative and 404s under the proxy.
  // Skipping optimization sidesteps that endpoint entirely — <Image> just
  // renders the (already-correct, already-absolute) src directly.
  unoptimized: true,
},
};

const withMDX = createMDX({});
export default withMDX(nextConfig);