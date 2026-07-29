import { NextRequest, NextResponse } from "next/server";

// The canonical home for this content is now ozigi.app/blog/* (see
// next.config.ts rewrites in the main app, which proxy ozigi.app/blog/* to
// this deployment). Anyone still hitting blog.ozigi.app directly — old
// backlinks, bookmarks, search results not yet re-crawled — gets permanently
// redirected to the ozigi.app equivalent so link authority consolidates
// there instead of splitting across two domains.
//
// Requests arriving via the ozigi.app rewrite must NOT be redirected again
// (that would loop). We originally tried detecting this via the
// `x-forwarded-host` header, but that isn't reliably set by Vercel for
// rewrites to an external domain and caused an actual redirect loop in
// production. Instead, the rewrite's destination URL appends
// `__ozigi_proxy=1` (see next.config.ts) — a marker fully under our
// control — and we check for that instead.
const CANONICAL_HOST = "ozigi.app";
const PROXY_MARKER = "__ozigi_proxy";

export function middleware(request: NextRequest) {
  const { pathname, search, searchParams } = request.nextUrl;

  if (searchParams.get(PROXY_MARKER) === "1") {
    return NextResponse.next();
  }

  const destination =
    pathname === "/"
      ? `https://${CANONICAL_HOST}/blog`
      : `https://${CANONICAL_HOST}${pathname}${search}`;

  return NextResponse.redirect(destination, 308);
}

export const config = {
  matcher: [
    "/((?!api|_next|favicon.ico|robots.txt|sitemap.xml|feed.xml|opengraph-image|.*\\.\\w+$).*)",
  ],
};
