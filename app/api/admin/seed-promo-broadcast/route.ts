import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const ADMIN_SECRET = process.env.ADMIN_SECRET || process.env.CRON_SECRET;
const APP_URL = process.env.APP_URL || "https://ozigi.app";

// Twice-a-week evergreen broadcast to ALL users about what Ozigi can do.
// Unlike seed-promo-queue (a finite re-engagement drip with discount pushes
// aimed at lapsed users), these are ongoing feature/use-case emails with no
// discounts — safe to re-seed on a loop.
//
// Cadence: the daily promo cron sends the single earliest due campaign, so
// dating each campaign on a Tuesday or Thursday at 10:00 UTC yields exactly
// two sends per week. Adjust SEND_DAYS / SEND_HOUR_UTC to change the schedule.
const SEND_DAYS = [2, 4]; // 0=Sun … 2=Tue, 4=Thu
const SEND_HOUR_UTC = 10;

/**
 * Returns the next `count` send slots (Tue & Thu at 10:00 UTC), starting from
 * the first qualifying day strictly after `from`.
 */
function nextSendSlots(from: Date, count: number): string[] {
  const slots: string[] = [];
  const cursor = new Date(from);
  cursor.setUTCHours(SEND_HOUR_UTC, 0, 0, 0);
  // Always start on a future slot
  if (cursor <= from) cursor.setUTCDate(cursor.getUTCDate() + 1);

  while (slots.length < count) {
    if (SEND_DAYS.includes(cursor.getUTCDay())) {
      slots.push(new Date(cursor).toISOString());
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    cursor.setUTCHours(SEND_HOUR_UTC, 0, 0, 0);
  }
  return slots;
}

const dashboardUrl = `${APP_URL}/dashboard`;

// Content only — scheduled_for is assigned from the computed slots below so the
// list order is the send order. body_content is raw HTML for the template body.
const CAMPAIGNS: {
  subject: string;
  headline: string;
  body_content: string;
  cta_text: string;
  cta_url: string;
}[] = [
  {
    subject: "Turn one link into a week of content",
    headline: "Paste a link. Walk away with a campaign.",
    body_content: `
      <p style="margin:0 0 16px 0;">Here's the fastest thing you can do in Ozigi today: drop in a URL — a blog post, a launch page, a YouTube video — and get a full set of ready-to-post content back in about a minute.</p>
      <p style="margin:0 0 16px 0;">You don't start from a blank page. Ozigi reads your source, pulls out what matters, and writes posts that sound like a person wrote them — no "dive deep," no "in today's fast-paced world."</p>
      <p style="margin:0;color:#64748b;font-size:14px;">Got a link handy? This is a 60-second win.</p>
    `,
    cta_text: "Generate from a link",
    cta_url: dashboardUrl,
  },
  {
    subject: "Write it once, post it everywhere",
    headline: "One source. Every platform. No copy-paste.",
    body_content: `
      <p style="margin:0 0 16px 0;">Reformatting the same update for X, LinkedIn, Discord, and Slack by hand is busywork. Ozigi writes a native version for each — a punchy thread for X, a professional take for LinkedIn, a casual drop for Discord — all from the same source.</p>
      <p style="margin:0 0 16px 0;">Pick the platforms you want, generate, edit anything you like, and publish or schedule. That's the whole loop.</p>
      <p style="margin:0;color:#64748b;font-size:14px;">Supports X · LinkedIn · Discord · Slack · Email newsletter.</p>
    `,
    cta_text: "Create a multi-platform campaign",
    cta_url: dashboardUrl,
  },
  {
    subject: "Never write a newsletter from scratch again",
    headline: "A newsletter your subscribers actually read",
    body_content: `
      <p style="margin:0 0 16px 0;">Ozigi turns your campaign into a standalone newsletter — not a recap of your posts, but a real piece written in your voice — and sends it to your subscriber list from the same dashboard.</p>
      <p style="margin:0 0 16px 0;">No second tool, no exporting, no wrestling with a separate email platform. Generate, review in the editor, and send.</p>
      <p style="margin:0;color:#64748b;font-size:14px;">You can manage your subscribers right inside Ozigi too.</p>
    `,
    cta_text: "Write a newsletter",
    cta_url: dashboardUrl,
  },
  {
    subject: "Your brand voice, saved once and reused forever",
    headline: "Stop sounding like generic AI",
    body_content: `
      <p style="margin:0 0 16px 0;">The reason most AI content feels flat is that it has no voice. Personas fix that. Describe your tone once — direct and punchy, thoughtful and educational, high-energy, whatever fits — and every campaign after that sounds unmistakably like you.</p>
      <p style="margin:0 0 16px 0;">Running content for clients? Save a separate persona for each one and switch between them in a click.</p>
      <p style="margin:0;color:#64748b;font-size:14px;">Browse the Persona Marketplace for ready-made voices, or build your own in a few minutes.</p>
    `,
    cta_text: "Set up a persona",
    cta_url: `${dashboardUrl}?tab=personas`,
  },
  {
    subject: "Schedule a week of posts in ten minutes",
    headline: "Batch it once. Publish all week.",
    body_content: `
      <p style="margin:0 0 16px 0;">You don't have to post in real time. Generate your content, set a date and time for each piece, and Ozigi handles the publishing.</p>
      <p style="margin:0 0 16px 0;">For platforms that need a human tap, you'll get an email reminder at the scheduled time with a one-click link that opens the composer pre-filled — so nothing slips.</p>
      <p style="margin:0;color:#64748b;font-size:14px;">Everything you've scheduled lives in one place under Scheduled Posts.</p>
    `,
    cta_text: "Schedule your posts",
    cta_url: dashboardUrl,
  },
  {
    subject: "Turn a rough idea into a full blog post",
    headline: "Long-form, without the blank-page dread",
    body_content: `
      <p style="margin:0 0 16px 0;">Beyond short social posts, Ozigi writes long-form articles — a structured blog post from a topic, an outline, or source material you already have.</p>
      <p style="margin:0 0 16px 0;">You get a real draft with sections and flow that you can edit in a proper editor, then repurpose into social posts and a newsletter without starting over.</p>
      <p style="margin:0;color:#64748b;font-size:14px;">One idea in, a week of content out.</p>
    `,
    cta_text: "Write a blog post",
    cta_url: `${APP_URL}/dashboard/long-form`,
  },
  {
    subject: "Fill your pipeline while your content runs",
    headline: "Cold outreach, built into the same tool",
    body_content: `
      <p style="margin:0 0 16px 0;">Ozigi isn't only content. It also finds leads that match your ideal customer, scores them, and runs personalised cold email and LinkedIn sequences written from each lead's real profile — not generic blasts.</p>
      <p style="margin:0 0 16px 0;">Connect your email, describe who you're targeting, and let the sequences run. Replies come back to your inbox; leads sync to your CRM automatically.</p>
      <p style="margin:0;color:#64748b;font-size:14px;">Content keeps you visible. Outreach starts the conversations.</p>
    `,
    cta_text: "Explore outreach",
    cta_url: `${APP_URL}/dashboard/gtm`,
  },
  {
    subject: "Add the visuals without opening a design tool",
    headline: "Images and a copilot, right where you write",
    body_content: `
      <p style="margin:0 0 16px 0;">Two things that make your posts land harder, both built in:</p>
      <p style="margin:0 0 16px 0;"><strong style="color:#0f172a;">AI images</strong> — describe the visual you want and get a polished graphic to attach to your post, no separate design app.</p>
      <p style="margin:0 0 16px 0;"><strong style="color:#0f172a;">The Copilot</strong> — stuck on an angle? Brainstorm with it, pull in live web context, and send the result straight into the generator.</p>
      <p style="margin:0;color:#64748b;font-size:14px;">Small features, big difference in how finished your content feels.</p>
    `,
    cta_text: "Try it now",
    cta_url: dashboardUrl,
  },
];

/**
 * POST /api/admin/seed-promo-broadcast
 *
 * Seeds the evergreen twice-weekly broadcast into promo_queue. Body (optional):
 *   { startDate?: string, dryRun?: boolean }
 *
 * dryRun returns the computed schedule without inserting anything — use it to
 * preview dates before committing.
 */
export async function POST(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (!ADMIN_SECRET || authHeader !== `Bearer ${ADMIN_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({} as any));
  const startDate = body.startDate ? new Date(body.startDate) : new Date();
  const dryRun = body.dryRun === true;

  const slots = nextSendSlots(startDate, CAMPAIGNS.length);
  const rows = CAMPAIGNS.map((c, i) => ({ ...c, scheduled_for: slots[i], status: "pending" }));

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
