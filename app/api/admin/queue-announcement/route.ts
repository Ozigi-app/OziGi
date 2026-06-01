import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { ANNOUNCEMENT_EMAIL_SUBJECT } from "@/lib/email-templates";

const ADMIN_SECRET = process.env.ADMIN_SECRET || process.env.CRON_SECRET;

/**
 * POST /api/admin/queue-announcement
 *
 * Inserts the GTM launch announcement into promo_queue with
 * scheduled_for = now so the next cron run picks it up immediately.
 *
 * The cron will route it to buildGTMLaunchAnnouncementEmail because
 * template = 'founders_thoughts'.
 *
 * Auth: Bearer ADMIN_SECRET header required.
 * Idempotent: refuses to insert if an announcement row is already pending/sent.
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

  // Guard: don't insert if one already exists (pending or sent)
  const { data: existing } = await supabase
    .from("promo_queue")
    .select("id, status")
    .eq("template", "founders_thoughts")
    .in("status", ["pending", "processing", "sent"])
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      { error: "Announcement already queued or sent.", existing },
      { status: 409 }
    );
  }

  const { data, error } = await supabase
    .from("promo_queue")
    .insert({
      subject:        ANNOUNCEMENT_EMAIL_SUBJECT,
      headline:       ANNOUNCEMENT_EMAIL_SUBJECT,
      body_content:   "",
      cta_text:       null,
      cta_url:        null,
      template:       "founders_thoughts",
      scheduled_for:  new Date().toISOString(),
      status:         "pending",
    })
    .select("id, subject, scheduled_for, template")
    .single();

  if (error) {
    console.error("[queue-announcement] Insert error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  console.log("[queue-announcement] Announcement queued:", data);
  return NextResponse.json({ success: true, queued: data });
}
