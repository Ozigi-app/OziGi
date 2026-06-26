import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { USER_SURVEY_SUBJECT } from "@/lib/email-templates";

const ADMIN_SECRET = process.env.ADMIN_SECRET || process.env.CRON_SECRET;

/**
 * POST /api/admin/queue-survey
 *
 * Inserts the "why aren't you using Ozigi?" user survey into promo_queue with
 * scheduled_for = now so the next promotional cron run sends it to all users.
 *
 * The cron routes it to buildUserSurveyEmail because template = 'user_survey'.
 *
 * Auth: Bearer ADMIN_SECRET header required.
 * Idempotent: refuses to insert if a survey row is already pending/sent.
 */
export async function POST(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (!ADMIN_SECRET || authHeader !== `Bearer ${ADMIN_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Guard: don't insert if one already exists (pending, processing, or sent)
  const { data: existing } = await supabase
    .from("promo_queue")
    .select("id, status")
    .eq("template", "user_survey")
    .in("status", ["pending", "processing", "sent"])
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      { error: "Survey already queued or sent.", existing },
      { status: 409 }
    );
  }

  const { data, error } = await supabase
    .from("promo_queue")
    .insert({
      subject:       USER_SURVEY_SUBJECT,
      headline:      USER_SURVEY_SUBJECT,
      body_content:  "",
      cta_text:      "",
      cta_url:       "",
      template:      "user_survey",
      scheduled_for: new Date().toISOString(),
      status:        "pending",
    })
    .select("id, subject, scheduled_for, template")
    .single();

  if (error) {
    console.error("[queue-survey] Insert error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  console.log("[queue-survey] Survey queued:", data);
  return NextResponse.json({ success: true, queued: data });
}
