import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { buildBroadcastRows, refillBroadcastIfLow, BROADCAST_TEMPLATE, REFILL_TARGET } from "@/lib/promo-broadcast";

function adminEmails(): string[] {
  return process.env.ADMIN_EMAILS
    ? process.env.ADMIN_EMAILS.split(",").map((e) => e.trim()).filter(Boolean)
    : [];
}

/** Resolve the logged-in user and confirm they're an admin. */
async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return { ok: false as const, status: 401, error: "Unauthorized" };
  if (!adminEmails().includes(user.email)) return { ok: false as const, status: 403, error: "Forbidden" };
  return { ok: true as const, user };
}

/** GET — list promo_queue rows (newest scheduled first) for the admin view. */
export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { data, error } = await supabaseAdmin
    .from("promo_queue")
    .select("id, subject, template, scheduled_for, status, sent_at, sent_count, failed_count, created_at")
    .order("scheduled_for", { ascending: false })
    .limit(200);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Count active recipients so the admin knows the audience size at a glance.
  const { count: audience } = await supabaseAdmin
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .or("promo_unsubscribed.eq.false,promo_unsubscribed.is.null");

  return NextResponse.json({ campaigns: data ?? [], audience: audience ?? 0 });
}

/**
 * POST — admin actions from the queue UI. Body: { action }.
 *   - "seed": stage the broadcast. Initial seed (no future broadcast rows)
 *     starts today; otherwise tops the queue up to REFILL_TARGET.
 *   - "send-now": fire the promotional cron immediately (sends the next due
 *     campaign to all subscribed users). Used to start today after the daily
 *     10:00 UTC fire has passed.
 */
export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { action } = await req.json().catch(() => ({}));

  if (action === "seed") {
    // How many broadcast sends are still scheduled ahead?
    const { data: future } = await supabaseAdmin
      .from("promo_queue")
      .select("id")
      .eq("template", BROADCAST_TEMPLATE)
      .eq("status", "pending")
      .gt("scheduled_for", new Date().toISOString());

    if ((future?.length ?? 0) > 0) {
      // Already running — just top it up.
      const added = await refillBroadcastIfLow(supabaseAdmin);
      return NextResponse.json({ success: true, mode: "topup", added });
    }

    // First seed — start today (startToday=true).
    const rows = buildBroadcastRows(new Date(), REFILL_TARGET, 0, true);
    const { data, error } = await supabaseAdmin
      .from("promo_queue")
      .insert(rows)
      .select("id, subject, scheduled_for");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, mode: "seed", inserted: data });
  }

  if (action === "send-now") {
    // Reuse the exact cron logic via a server-to-server call with the shared secret.
    const appUrl = process.env.APP_URL || "https://ozigi.app";
    const secret = process.env.CRON_SECRET;
    if (!secret) return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });

    const res = await fetch(`${appUrl}/api/cron/promotional`, {
      method: "GET",
      headers: { Authorization: `Bearer ${secret}` },
    });
    const result = await res.json().catch(() => ({}));
    if (!res.ok) return NextResponse.json({ error: result.error ?? "Send failed" }, { status: 502 });
    return NextResponse.json({ success: true, result });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

/** PATCH — cancel a pending campaign so it never sends. Body: { id }. */
export async function PATCH(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await req.json().catch(() => ({}));
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const { error } = await supabaseAdmin
    .from("promo_queue")
    .update({ status: "cancelled" })
    .eq("id", id)
    .eq("status", "pending"); // only cancel not-yet-sent rows

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
