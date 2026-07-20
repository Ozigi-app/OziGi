import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { buildBroadcastRows, REFILL_TARGET } from "@/lib/promo-broadcast";

const ADMIN_SECRET = process.env.ADMIN_SECRET || process.env.CRON_SECRET;

/**
 * POST /api/admin/seed-promo-broadcast
 *
 * Seeds the evergreen twice-weekly broadcast into promo_queue. Body (optional):
 *   { startDate?: string, startToday?: boolean, count?: number, dryRun?: boolean }
 *
 * - startToday (default true): allow the first send to be today if today is a
 *   send day, even if the send hour has passed (it goes out on the next cron).
 * - count: how many campaigns to stage (default REFILL_TARGET).
 * - dryRun: return the computed schedule without inserting.
 *
 * After the initial seed the queue tops itself up automatically (see
 * refillBroadcastIfLow in the promotional cron), so this only needs running once.
 */
export async function POST(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (!ADMIN_SECRET || authHeader !== `Bearer ${ADMIN_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({} as any));
  const startDate = body.startDate ? new Date(body.startDate) : new Date();
  const startToday = body.startToday !== false; // default true
  const count = Number.isFinite(body.count) ? Math.max(1, Math.min(52, body.count)) : REFILL_TARGET;
  const dryRun = body.dryRun === true;

  const rows = buildBroadcastRows(startDate, count, 0, startToday);

  if (dryRun) {
    return NextResponse.json({
      dryRun: true,
      count: rows.length,
      schedule: rows.map((r) => ({ subject: r.subject, scheduled_for: r.scheduled_for })),
    });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await supabase
    .from("promo_queue")
    .insert(rows)
    .select("id, subject, scheduled_for");

  if (error) {
    console.error("[seed-promo-broadcast] Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  console.log(`[seed-promo-broadcast] Inserted ${data.length} campaigns`);
  return NextResponse.json({ success: true, inserted: data });
}
