import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { exchangeCodeForTokens } from "@/lib/linkedin-oauth";

const APP_URL = process.env.APP_URL || "http://localhost:3000";

function back(status: string) {
  // Land the user back in Settings with a status flag the modal can toast.
  return NextResponse.redirect(new URL(`/dashboard?openSettings=true&li=${status}`, APP_URL));
}

/**
 * GET /api/linkedin/oauth/callback
 *
 * Completes the custom LinkedIn OAuth flow: verifies CSRF state, exchanges the
 * code for access + refresh tokens, and stores them under provider
 * 'linkedin_oidc' (where the publish route already looks). A stored refresh
 * token lets the publish route auto-renew the ~60-day access token.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const error = searchParams.get("error");
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  // LinkedIn returned an error (e.g. user declined, or a scope the app lacks).
  if (error) {
    console.error("[LinkedIn OAuth] authorize error:", error, searchParams.get("error_description"));
    return back("denied");
  }

  const cookieState = req.cookies.get("li_oauth_state")?.value;
  if (!code || !state || !cookieState || state !== cookieState) {
    return back("state");
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return back("signin");

  try {
    const tokens = await exchangeCodeForTokens(code);

    const { error: upsertError } = await supabaseAdmin.from("user_tokens").upsert(
      {
        user_id: user.id,
        provider: "linkedin_oidc",
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id, provider" }
    );
    if (upsertError) throw upsertError;

    const res = back(tokens.refresh_token ? "connected" : "connected_norefresh");
    res.cookies.delete("li_oauth_state");
    return res;
  } catch (e: any) {
    console.error("[LinkedIn OAuth] callback failed:", e.message);
    return back("failed");
  }
}
