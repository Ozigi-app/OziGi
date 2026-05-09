import { NextResponse } from "next/server";
import { createPromoSchedule, deletePromoSchedule, listSchedules } from "@/lib/qstash";

const ADMIN_SECRET = process.env.ADMIN_SECRET;

function isAuthorized(req: Request) {
  return ADMIN_SECRET && req.headers.get("authorization") === `Bearer ${ADMIN_SECRET}`;
}

/** GET — list all QStash schedules so you can find the promo schedule ID. */
export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const schedules = await listSchedules();
  return NextResponse.json({ schedules });
}

/** POST — create the daily promo cron schedule (runs at 10am UTC). */
export async function POST(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const scheduleId = await createPromoSchedule();
  return NextResponse.json({ success: true, scheduleId });
}

/** DELETE — remove a schedule. Pass { scheduleId } in the body. */
export async function DELETE(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { scheduleId } = await req.json();
  if (!scheduleId) {
    return NextResponse.json({ error: "scheduleId is required" }, { status: 400 });
  }

  await deletePromoSchedule(scheduleId);
  return NextResponse.json({ success: true });
}
