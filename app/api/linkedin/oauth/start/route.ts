import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { buildAuthUrl } from "@/lib/linkedin-oauth";

const APP_URL = process.env.APP_URL || "http://localhost:3000";

/**
 * GET /api/linkedin/oauth/start
 *
 * Begins the custom LinkedIn OAuth flow. Session-gated, sets a CSRF state
 * cookie, and redirects the browser to LinkedIn's consent screen.
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/dashboard?li=signin", APP_URL));
  }

  if (!process.env.LINKEDIN_CLIENT_ID || !process.env.LINKEDIN_CLIENT_SECRET) {
    return NextResponse.redirect(new URL("/dashboard?li=misconfigured", APP_URL));
  }

  const state = randomUUID();
  const res = NextResponse.redirect(buildAuthUrl(state));
  res.cookies.set("li_oauth_state", state, {
    httpOnly: true,
    secure: APP_URL.startsWith("https"),
    sameSite: "lax", // must survive the round-trip back from LinkedIn
    maxAge: 600,
    path: "/",
  });
  return res;
}
