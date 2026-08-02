import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name) {
          return request.cookies.get(name)?.value
        },
        set(name, value, options) {
          response.cookies.set({ name, value, ...options })
        },
        remove(name, options) {
          response.cookies.set({ name, value: '', ...options })
        },
      },
    }
  )

  // Refresh the session if it has expired, writing the rotated tokens back as
  // cookies on the response so the browser picks them up.
  await supabase.auth.getSession()

  return response
}

/*
 * This middleware exists only to refresh the Supabase auth cookie. It used to
 * run on essentially every request (the old matcher excluded little more than
 * static assets), which made it the single largest consumer of Vercel Fluid
 * Active CPU — 56% of the team's total, and it doubled when ozigi.app/blog
 * started proxying blog.ozigi.app, because every (anonymous, largely crawler)
 * blog request paid for a session refresh it could never use.
 *
 * Every page in this app that reads auth is a client component using the
 * browser Supabase SDK, which refreshes its own token, so nothing rendered on
 * the server depends on this running. The matcher below is therefore scoped to
 * the surface where a fresh session cookie can still matter: the signed-in app
 * pages and the API routes that authenticate from the cookie.
 *
 * Deliberately NOT matched:
 * - /blog/*      proxied to the blog deployment; anonymous traffic
 * - /email/*     public "view this newsletter in your browser" links; no auth
 * - marketing/legal pages (/, /pricing, /docs, /terms, …) — all client-side auth
 * - static assets and _next/*
 */
export const config = {
  matcher: [
    // Signed-in app surface.
    '/dashboard/:path*',
    '/write/:path*',
    '/content-engine/:path*',
    '/long-form/:path*',
    '/newsletter/:path*',
    '/email-outreach/:path*',
    '/linkedin-outreach/:path*',
    '/from-youtube/:path*',
    '/appsumo/:path*',
    '/reset-password/:path*',
    // API routes that authenticate from the session cookie. Machine-to-machine
    // endpoints (cron, QStash, webhooks) authenticate with a bearer secret and
    // public endpoints need no session at all, so both are excluded.
    '/api/((?!cron|qstash|gtm/cron|dodo-webhook|unsubscribe|waitlist|subscribers|demo|stats|post-discord).*)',
  ],
}