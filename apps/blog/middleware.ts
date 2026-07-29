import { NextRequest, NextResponse } from "next/server";

// The canonical home for this content is now ozigi.app/blog/* (see
// next.config.ts rewrites in the main app, which proxy ozigi.app/blog/* to
// this deployment). Anyone still hitting blog.ozigi.app directly — old
// backlinks, bookmarks, search results not yet re-crawled — gets permanently
// redirected to the ozigi.app equivalent so link authority consolidates
// there instead of splitting across two domains.
//
// Requests arriving via the ozigi.app rewrite must NOT be redirected again
// (that would loop), so we skip the redirect when `x-forwarded-host` shows
// the request came in through ozigi.app. Vercel/Next.js set this header to
// the original inbound host when proxying a rewrite to an external
// destination — verify this against a staging deploy before relying on it
// in production, since it wasn't tested against live infra here.
const CANONICAL_HOST = "ozigi.app";

export function middleware(request: NextRequest) {
  const forwardedHost = request.headers.get("x-forwarded-host");
  if (forwardedHost === CANONICAL_HOST) {
    return NextResponse.next();
  }

  const { pathname, search } = request.nextUrl;
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
