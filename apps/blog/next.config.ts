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
},
};

const withMDX = createMDX({});
export default withMDX(nextConfig);