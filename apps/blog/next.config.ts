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
  // The canonical home for this content is ozigi.app/blog/* (see the rewrites in
  // the root next.config.ts, which proxy ozigi.app/blog/* to this deployment).
  // Anyone still hitting blog.ozigi.app directly — old backlinks, bookmarks,
  // search results not yet re-crawled — is permanently redirected to the
  // ozigi.app equivalent so link authority consolidates there.
  //
  // This used to live in middleware.ts. Every page here is statically generated
  // with ISR, so that middleware was the *only* compute running on an otherwise
  // fully cached request — and it ran on all of them. As `redirects()` the same
  // rules are evaluated in the routing layer, and a cached blog page now costs
  // no function invocation at all.
  //
  // Requests arriving via the ozigi.app rewrite must NOT be redirected again
  // (that would loop). We originally tried detecting this via the
  // `x-forwarded-host` header, but that isn't reliably set by Vercel for
  // rewrites to an external domain and caused an actual redirect loop in
  // production. Instead the rewrite's destination URL appends `__ozigi_proxy=1`
  // — a marker fully under our control — and `missing` skips the redirect
  // whenever that key is present.
  async redirects() {
    return [
      // Must come first: the catch-all below also matches "/", but the root of
      // this deployment maps to /blog on the canonical host, not to /.
      {
        source: "/",
        destination: "https://ozigi.app/blog",
        permanent: true,
        missing: [{ type: "query", key: "__ozigi_proxy" }],
      },
      // Everything else keeps its path. The lookaheads reproduce the old
      // middleware matcher's exclusions: /api and /_next are infrastructure,
      // opengraph-image is generated per route, and anything with a file
      // extension is an asset. Assets matter especially here — `assetPrefix`
      // points browsers at blog.ozigi.app for /_next/static/*, and those
      // requests carry no proxy marker, so redirecting them would break every
      // proxied page's CSS and JS.
      {
        source: "/:path((?!api/|_next/|opengraph-image)(?!.*\\.\\w+$).*)",
        destination: "https://ozigi.app/:path",
        permanent: true,
        missing: [{ type: "query", key: "__ozigi_proxy" }],
      },
    ];
  },
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