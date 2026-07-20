import type { SupabaseClient } from "@supabase/supabase-js";

// Twice-a-week evergreen broadcast to ALL users about what Ozigi can do.
// No discounts, no lapsed-user framing — safe to loop indefinitely.
//
// Cadence: the daily promo cron (/api/cron/promotional) sends the single
// earliest due pending row, so dating campaigns on two weekdays yields two
// sends/week. Broadcast rows are tagged template='broadcast' so the auto-loop
// refill can find them without touching one-off announcements/surveys/drips.

const APP_URL = process.env.APP_URL || "https://ozigi.app";

// 0=Sun … 1=Mon, 4=Thu. Mon & Thu so a Monday start lands on a send day.
export const SEND_DAYS = [1, 4];
export const SEND_HOUR_UTC = 10;

// Keep at least this many future sends staged; when fewer remain, top up to TARGET.
export const REFILL_THRESHOLD = 4;
export const REFILL_TARGET = 8;

export const BROADCAST_TEMPLATE = "broadcast";

const dashboardUrl = `${APP_URL}/dashboard`;

export interface BroadcastCampaign {
  subject: string;
  headline: string;
  body_content: string;
  cta_text: string;
  cta_url: string;
}

export const BROADCAST_CAMPAIGNS: BroadcastCampaign[] = [
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
 * Returns the next `count` send slots (SEND_DAYS at SEND_HOUR_UTC).
 * When `includeFromDay` is true and `from` falls on a send day, the first slot
 * is that day at SEND_HOUR_UTC even if the hour has already passed — so a
 * same-day start is possible (the row is due immediately and goes out on the
 * next cron fire).
 */
export function nextSendSlots(from: Date, count: number, includeFromDay = false): string[] {
  const slots: string[] = [];
  const cursor = new Date(from);
  cursor.setUTCHours(SEND_HOUR_UTC, 0, 0, 0);

  if (!includeFromDay && cursor <= from) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    cursor.setUTCHours(SEND_HOUR_UTC, 0, 0, 0);
  }

  while (slots.length < count) {
    if (SEND_DAYS.includes(cursor.getUTCDay())) {
      slots.push(new Date(cursor).toISOString());
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    cursor.setUTCHours(SEND_HOUR_UTC, 0, 0, 0);
  }
  return slots;
}

export interface BroadcastRow extends BroadcastCampaign {
  scheduled_for: string;
  status: "pending";
  template: string;
}

/**
 * Builds `count` queue rows starting at `from`, cycling through the evergreen
 * campaigns (offset by `rotationOffset` so a refill continues the loop rather
 * than restarting at the first email).
 */
export function buildBroadcastRows(
  from: Date,
  count: number,
  rotationOffset = 0,
  includeFromDay = false
): BroadcastRow[] {
  const slots = nextSendSlots(from, count, includeFromDay);
  return slots.map((scheduled_for, i) => {
    const c = BROADCAST_CAMPAIGNS[(rotationOffset + i) % BROADCAST_CAMPAIGNS.length];
    return { ...c, scheduled_for, status: "pending", template: BROADCAST_TEMPLATE };
  });
}

/**
 * Keeps the broadcast queue topped up so it never runs dry. If fewer than
 * REFILL_THRESHOLD future broadcast rows remain pending, appends enough to
 * reach REFILL_TARGET, continuing the cadence from the latest staged date and
 * the rotation from however many broadcast rows have existed so far.
 *
 * Safe to call on every cron fire — it's a no-op when the queue is healthy.
 * Returns the number of rows inserted.
 */
export async function refillBroadcastIfLow(supabase: SupabaseClient): Promise<number> {
  const nowIso = new Date().toISOString();

  // Future pending broadcast rows — the runway that still has to send.
  const { data: future, error: futureErr } = await supabase
    .from("promo_queue")
    .select("scheduled_for")
    .eq("template", BROADCAST_TEMPLATE)
    .eq("status", "pending")
    .gt("scheduled_for", nowIso)
    .order("scheduled_for", { ascending: false });

  if (futureErr) {
    console.error("[promo-refill] Failed to read broadcast runway:", futureErr.message);
    return 0;
  }

  if ((future?.length ?? 0) >= REFILL_THRESHOLD) return 0;

  // Rotation offset: total broadcast rows ever created, so content keeps moving.
  const { count: totalBroadcast } = await supabase
    .from("promo_queue")
    .select("id", { count: "exact", head: true })
    .eq("template", BROADCAST_TEMPLATE);

  // Continue dating from the latest staged slot (or now if the queue is empty).
  const latest = future && future.length > 0 ? new Date(future[0].scheduled_for) : new Date();
  const toAdd = REFILL_TARGET - (future?.length ?? 0);

  const rows = buildBroadcastRows(latest, toAdd, totalBroadcast ?? 0, false);

  const { error: insErr } = await supabase.from("promo_queue").insert(rows);
  if (insErr) {
    console.error("[promo-refill] Insert failed:", insErr.message);
    return 0;
  }

  console.log(`[promo-refill] Topped up broadcast queue with ${rows.length} rows`);
  return rows.length;
}
