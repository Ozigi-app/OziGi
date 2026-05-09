import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { SendMailClient } from "zeptomail";
import { buildPromotionalEmail } from "@/lib/email-templates";
import { verifyQStashRequest } from "@/lib/qstash";

const CRON_SECRET = process.env.CRON_SECRET;
const APP_URL = process.env.APP_URL || "https://ozigi.app";

const ZEPTOMAIL_BASE_URL = "https://api.zeptomail.com/v1.1/email";
const mailClient = new SendMailClient({
  url: ZEPTOMAIL_BASE_URL,
  token: `Zoho-enczapikey ${process.env.ZEPTOMAIL_API_KEY!}`,
});

const PROMO_FROM_ADDRESS = process.env.EMAIL_FROM_ADDRESS || "hello@ozigi.app";
const PROMO_FROM_NAME = process.env.EMAIL_FROM_NAME || "Ozigi";

/**
 * GET /api/cron/promotional
 *
 * Called daily by QStash (schedule created via POST /api/admin/setup-promo-cron).
 * Reads the next due campaign from `promo_queue`, sends it to all subscribed
 * users, then marks it as sent. Campaigns with a future `scheduled_for` are
 * skipped until their send window arrives.
 *
 * Auth: accepts either a QStash upstash-signature header or a Bearer CRON_SECRET.
 */
export async function GET(req: Request) {
  // Accept either a QStash signature or the CRON_SECRET Bearer token
  const qstashSig = req.headers.get("upstash-signature");
  const authHeader = req.headers.get("authorization");

  if (qstashSig) {
    const rawBody = await req.text();
    const isValid = await verifyQStashRequest(qstashSig, rawBody);
    if (!isValid) {
      return NextResponse.json({ error: "Invalid QStash signature" }, { status: 401 });
    }
  } else if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    // ── 1. Get the next unsent campaign from the queue ──────────────────────
    const { data: campaign, error: campaignError } = await supabase
      .from("promo_queue")
      .select("*")
      .eq("status", "pending")
      .order("scheduled_for", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (campaignError) throw campaignError;

    if (!campaign) {
      console.log("[Promo Cron] No pending campaigns in queue.");
      return NextResponse.json({ success: true, message: "No pending campaigns." });
    }

    // Skip if the send window hasn't arrived yet
    if (new Date(campaign.scheduled_for) > new Date()) {
      console.log("[Promo Cron] Next campaign not due yet:", campaign.scheduled_for);
      return NextResponse.json({ success: true, message: "Campaign not due yet." });
    }

    // ── 2. Mark as processing to prevent duplicate sends ────────────────────
    await supabase
      .from("promo_queue")
      .update({ status: "processing", started_at: new Date().toISOString() })
      .eq("id", campaign.id);

    // ── 3. Fetch all subscribed users ───────────────────────────────────────
    const { data: users, error: usersError } = await supabase
      .from("profiles")
      .select("id, email, display_name, promo_unsubscribed")
      .eq("promo_unsubscribed", false);

    if (usersError) throw usersError;

    const results = { sent: 0, failed: 0, skipped: 0, errors: [] as string[] };

    // ── 4. Send to each user ────────────────────────────────────────────────
    for (const user of users ?? []) {
      if (!user.email) { results.skipped++; continue; }

      try {
        const unsubscribeUrl = `${APP_URL}/api/email/promo-unsubscribe?userId=${user.id}`;
        const html = buildPromotionalEmail(
          campaign.subject,
          campaign.headline,
          campaign.body_content,
          campaign.cta_text,
          campaign.cta_url,
          unsubscribeUrl
        );
        await sendEmail(user.email, campaign.subject, html);
        results.sent++;
        // Throttle: 10 sends/sec to stay within ZeptoMail limits
        await new Promise((r) => setTimeout(r, 100));
      } catch (err: any) {
        results.failed++;
        results.errors.push(`${user.email}: ${err.message}`);
      }
    }

    // ── 5. Mark campaign as sent ────────────────────────────────────────────
    await supabase
      .from("promo_queue")
      .update({
        status: "sent",
        sent_at: new Date().toISOString(),
        sent_count: results.sent,
        failed_count: results.failed,
      })
      .eq("id", campaign.id);

    console.log("[Promo Cron] Campaign sent:", results);
    return NextResponse.json({ success: true, campaignId: campaign.id, results });
  } catch (error: any) {
    console.error("[Promo Cron] Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function sendEmail(to: string, subject: string, htmlBody: string) {
  await mailClient.sendMail({
    from: { address: PROMO_FROM_ADDRESS, name: PROMO_FROM_NAME },
    to: [{ email_address: { address: to, name: "" } }],
    subject,
    htmlbody: htmlBody,
  });
}
