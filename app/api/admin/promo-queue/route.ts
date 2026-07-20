import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

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
