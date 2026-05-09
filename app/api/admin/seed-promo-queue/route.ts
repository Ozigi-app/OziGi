import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const ADMIN_SECRET = process.env.ADMIN_SECRET;
const APP_URL = process.env.APP_URL || "https://ozigi.app";

// 7-email re-engagement drip sequence, spaced ~3 days apart.
// body_content is raw HTML injected into the buildPromotionalEmail template body div.
function buildCampaigns(startDate: Date) {
  const day = (n: number) => {
    const d = new Date(startDate);
    d.setDate(d.getDate() + n);
    d.setHours(10, 0, 0, 0); // 10am UTC
    return d.toISOString();
  };

  const pricingUrl = `${APP_URL}/pricing`;
  const dashboardUrl = `${APP_URL}/dashboard`;
  const discountUrl = `${APP_URL}/pricing?promo=REACTIVATE20`;

  return [
    // ─── 1. Re-engagement opener ───────────────────────────────────────────
    {
      subject: "Your AI content studio is waiting for you",
      headline: "You signed up — now let's actually use it",
      body_content: `
        <p style="margin:0 0 16px 0;">You created an Ozigi account a little while ago, but we haven't seen you inside yet. No pressure — but we'd love to show you what's possible.</p>
        <p style="margin:0 0 16px 0;">Here's a quick reminder of what you have access to right now:</p>
        <table style="width:100%;border-collapse:collapse;margin:0 0 24px 0;">
          <tr>
            <td style="padding:12px 0;border-bottom:1px solid #e2e8f0;vertical-align:top;width:32px;font-size:20px;">🚀</td>
            <td style="padding:12px 0 12px 12px;border-bottom:1px solid #e2e8f0;">
              <strong style="color:#0f172a;display:block;margin-bottom:2px;">AI Campaign Generator</strong>
              <span style="color:#64748b;font-size:14px;">Turn a URL, PDF, or rough notes into ready-to-post content for X, LinkedIn, Discord, and Slack — in seconds.</span>
            </td>
          </tr>
          <tr>
            <td style="padding:12px 0;border-bottom:1px solid #e2e8f0;vertical-align:top;font-size:20px;">📅</td>
            <td style="padding:12px 0 12px 12px;border-bottom:1px solid #e2e8f0;">
              <strong style="color:#0f172a;display:block;margin-bottom:2px;">Multi-Platform Scheduling</strong>
              <span style="color:#64748b;font-size:14px;">Schedule posts across every platform from one dashboard. Set the time, hit publish, done.</span>
            </td>
          </tr>
          <tr>
            <td style="padding:12px 0;border-bottom:1px solid #e2e8f0;vertical-align:top;font-size:20px;">✉️</td>
            <td style="padding:12px 0 12px 12px;border-bottom:1px solid #e2e8f0;">
              <strong style="color:#0f172a;display:block;margin-bottom:2px;">Email Newsletters</strong>
              <span style="color:#64748b;font-size:14px;">Generate and send beautiful newsletters to your audience. No separate tool needed.</span>
            </td>
          </tr>
          <tr>
            <td style="padding:12px 0;vertical-align:top;font-size:20px;">🎨</td>
            <td style="padding:12px 0 12px 12px;">
              <strong style="color:#0f172a;display:block;margin-bottom:2px;">AI Image Generation</strong>
              <span style="color:#64748b;font-size:14px;">Describe the visual you want and get a polished image to go with your post.</span>
            </td>
          </tr>
        </table>
        <p style="margin:0;color:#64748b;font-size:14px;">It takes less than 2 minutes to generate your first campaign. Give it a try — your first 5 are on us.</p>
      `,
      cta_text: "Generate my first campaign",
      cta_url: dashboardUrl,
      scheduled_for: day(0),
    },

    // ─── 2. Feature deep-dive: generation flow ─────────────────────────────
    {
      subject: "From a URL to ready-to-post content in 60 seconds",
      headline: "Paste a link. Get a full campaign.",
      body_content: `
        <p style="margin:0 0 16px 0;">Most content creation tools ask you to start from scratch. Ozigi works the other way around — you give it something that already exists, and it does the rest.</p>
        <p style="margin:0 0 8px 0;font-weight:600;color:#0f172a;">Here's how it works in 3 steps:</p>
        <div style="background:#f8fafc;border-radius:12px;padding:20px 24px;margin:0 0 24px 0;">
          <p style="margin:0 0 12px 0;font-size:14px;"><span style="background:#0f172a;color:#fff;border-radius:50%;width:22px;height:22px;display:inline-flex;align-items:center;justify-content:center;font-weight:700;font-size:12px;margin-right:8px;">1</span><strong>Paste your source</strong> — a blog post URL, YouTube link, PDF, image, or just raw notes.</p>
          <p style="margin:0 0 12px 0;font-size:14px;"><span style="background:#0f172a;color:#fff;border-radius:50%;width:22px;height:22px;display:inline-flex;align-items:center;justify-content:center;font-weight:700;font-size:12px;margin-right:8px;">2</span><strong>Pick your platforms</strong> — X, LinkedIn, Discord, Slack, email. Mix and match.</p>
          <p style="margin:0;font-size:14px;"><span style="background:#0f172a;color:#fff;border-radius:50%;width:22px;height:22px;display:inline-flex;align-items:center;justify-content:center;font-weight:700;font-size:12px;margin-right:8px;">3</span><strong>Review & publish</strong> — edit anything you want, then schedule or post immediately.</p>
        </div>
        <p style="margin:0 0 16px 0;">The AI is trained to write content that sounds like a real person wrote it — no filler, no AI buzzwords, no "dive deep" or "it's important to note." Just clean, on-brand copy.</p>
        <p style="margin:0;color:#64748b;font-size:14px;">Your free plan includes 5 campaigns/month. No credit card required.</p>
      `,
      cta_text: "Try it with your content",
      cta_url: dashboardUrl,
      scheduled_for: day(3),
    },

    // ─── 3. Multi-platform angle ───────────────────────────────────────────
    {
      subject: "Post everywhere — without copying and pasting",
      headline: "One campaign. Every platform. Zero effort.",
      body_content: `
        <p style="margin:0 0 16px 0;">If you're manually adapting the same content for X, LinkedIn, and Discord, you're spending time you don't need to.</p>
        <p style="margin:0 0 16px 0;">Ozigi writes a version of your content that's natively formatted for each platform — a punchy thread for X, a longer professional take for LinkedIn, a casual drop for Discord — all from the same source material.</p>
        <div style="border-left:4px solid #1d4ed8;padding:12px 20px;margin:0 0 24px 0;background:#eff6ff;border-radius:0 8px 8px 0;">
          <p style="margin:0;font-size:14px;color:#1e40af;font-style:italic;">"I used to spend 45 minutes reformatting every blog post for social. Now it takes me 2 minutes and the output is actually better."</p>
        </div>
        <p style="margin:0 0 16px 0;">You can also schedule posts directly from Ozigi — pick the date and time, and we'll handle the publishing. For X posts, you'll get an email reminder with a one-click post link.</p>
        <p style="margin:0;color:#64748b;font-size:14px;">Supports: X (Twitter) · LinkedIn · Discord · Slack · Email Newsletter</p>
      `,
      cta_text: "Create a multi-platform campaign",
      cta_url: dashboardUrl,
      scheduled_for: day(6),
    },

    // ─── 4. Success story / social proof ──────────────────────────────────
    {
      subject: "What Ozigi users are building",
      headline: "Real results from the Ozigi community",
      body_content: `
        <p style="margin:0 0 24px 0;">Here's a look at how people are actually using Ozigi to grow their audience and save time:</p>
        <div style="border:1px solid #e2e8f0;border-radius:12px;padding:20px 24px;margin:0 0 16px 0;">
          <p style="margin:0 0 8px 0;font-weight:700;color:#0f172a;">The indie founder</p>
          <p style="margin:0;color:#475569;font-size:14px;line-height:1.6;">Uses Ozigi to turn weekly product updates into a LinkedIn post, an X thread, and a newsletter — all in one go. Grew their audience from 300 to 2,400 followers in 3 months without hiring a marketer.</p>
        </div>
        <div style="border:1px solid #e2e8f0;border-radius:12px;padding:20px 24px;margin:0 0 16px 0;">
          <p style="margin:0 0 8px 0;font-weight:700;color:#0f172a;">The content creator</p>
          <p style="margin:0;color:#475569;font-size:14px;line-height:1.6;">Pastes YouTube video links into Ozigi after every upload to get a full set of promotional posts ready in under 5 minutes. No more staring at a blank text box.</p>
        </div>
        <div style="border:1px solid #e2e8f0;border-radius:12px;padding:20px 24px;margin:0 0 24px 0;">
          <p style="margin:0 0 8px 0;font-weight:700;color:#0f172a;">The small agency</p>
          <p style="margin:0;color:#475569;font-size:14px;line-height:1.6;">Creates custom AI personas for each client so every piece of output matches the client's voice. Delivers content faster than any in-house writer at a fraction of the cost.</p>
        </div>
        <p style="margin:0;color:#64748b;font-size:14px;">You're one campaign away from seeing results like these. Log in and try it.</p>
      `,
      cta_text: "Start creating",
      cta_url: dashboardUrl,
      scheduled_for: day(9),
    },

    // ─── 5. Discount — first push ──────────────────────────────────────────
    {
      subject: "A special offer just for you — 20% off Ozigi Team",
      headline: "Unlock the full power of Ozigi at 20% off",
      body_content: `
        <p style="margin:0 0 16px 0;">Because you've been with us since the early days, we want to make it easier to upgrade.</p>
        <div style="background:linear-gradient(135deg,#1e40af 0%,#3b82f6 100%);border-radius:12px;padding:24px;margin:0 0 24px 0;text-align:center;">
          <p style="color:#bfdbfe;margin:0 0 4px 0;font-size:14px;text-transform:uppercase;letter-spacing:0.05em;">Your exclusive discount</p>
          <p style="color:#ffffff;margin:0;font-size:36px;font-weight:800;">20% OFF</p>
          <p style="color:#bfdbfe;margin:8px 0 16px 0;font-size:14px;">Ozigi Team plan — first 3 months</p>
          <div style="background:rgba(255,255,255,0.15);border-radius:8px;padding:8px 20px;display:inline-block;">
            <code style="color:#ffffff;font-size:16px;font-weight:700;letter-spacing:0.1em;">REACTIVATE20</code>
          </div>
        </div>
        <p style="margin:0 0 8px 0;font-weight:600;color:#0f172a;">What you unlock on Team:</p>
        <ul style="margin:0 0 24px 0;padding-left:20px;color:#475569;font-size:14px;line-height:2;">
          <li>30 AI campaigns per month</li>
          <li>Unlimited personas (save and switch voices)</li>
          <li>AI image generation (2 per campaign)</li>
          <li>Email newsletter generation &amp; sending</li>
          <li>Post scheduling + X email reminders</li>
          <li>Slack integration</li>
        </ul>
        <p style="margin:0;color:#64748b;font-size:14px;">Use code <strong>REACTIVATE20</strong> at checkout. Offer expires in 7 days.</p>
      `,
      cta_text: "Claim 20% off",
      cta_url: discountUrl,
      scheduled_for: day(12),
    },

    // ─── 6. Feature deep-dive: personas + newsletters ──────────────────────
    {
      subject: "The feature that changes everything about your content",
      headline: "Your brand's voice — consistently, every time",
      body_content: `
        <p style="margin:0 0 16px 0;">The biggest problem with AI-generated content is that it all sounds the same. That's why we built <strong>System Personas</strong>.</p>
        <p style="margin:0 0 16px 0;">A Persona is a saved voice profile — your tone, your style, your way of putting sentences together. You describe it once, and every campaign you generate from that point on sounds unmistakably like you.</p>
        <div style="background:#f8fafc;border-radius:12px;padding:20px 24px;margin:0 0 24px 0;">
          <p style="margin:0 0 8px 0;font-weight:600;color:#0f172a;font-size:14px;">Example personas:</p>
          <p style="margin:0 0 6px 0;font-size:14px;color:#475569;">🎙️ <strong>"Direct &amp; punchy"</strong> — short sentences, no fluff, straight to the value</p>
          <p style="margin:0 0 6px 0;font-size:14px;color:#475569;">📚 <strong>"Thoughtful educator"</strong> — explains concepts clearly, uses analogies, builds trust</p>
          <p style="margin:0;font-size:14px;color:#475569;">⚡ <strong>"Hype builder"</strong> — energetic, product-led, drives urgency</p>
        </div>
        <p style="margin:0 0 16px 0;">Pair this with our <strong>Email Newsletter</strong> feature — generate a full newsletter from your campaign and send it directly to your subscriber list, all from the same dashboard.</p>
        <p style="margin:0;color:#64748b;font-size:14px;">Set up your persona in under 3 minutes. Your next campaign will feel completely different.</p>
      `,
      cta_text: "Set up my persona",
      cta_url: `${dashboardUrl}?tab=personas`,
      scheduled_for: day(15),
    },

    // ─── 7. Final discount urgency ─────────────────────────────────────────
    {
      subject: "Your 20% discount expires in 48 hours",
      headline: "Last chance — your offer expires soon",
      body_content: `
        <p style="margin:0 0 16px 0;">This is your last reminder: the <strong>REACTIVATE20</strong> discount code for 20% off Ozigi Team expires in 48 hours.</p>
        <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:12px;padding:20px 24px;margin:0 0 24px 0;text-align:center;">
          <p style="margin:0 0 8px 0;font-size:14px;color:#dc2626;font-weight:600;">⏰ Offer expires in 48 hours</p>
          <p style="margin:0 0 12px 0;font-size:28px;font-weight:800;color:#0f172a;">20% OFF</p>
          <div style="background:#f1f5f9;border-radius:8px;padding:8px 20px;display:inline-block;">
            <code style="color:#0f172a;font-size:16px;font-weight:700;letter-spacing:0.1em;">REACTIVATE20</code>
          </div>
        </div>
        <p style="margin:0 0 16px 0;">Team plan gives you 30 campaigns/month, unlimited personas, email newsletters, AI image generation, and multi-platform scheduling — everything you need to ship consistent content without burning out.</p>
        <p style="margin:0 0 24px 0;">After this offer expires, we won't be able to extend it. Now's the time.</p>
        <p style="margin:0;color:#64748b;font-size:13px;">Not ready to upgrade? No worries — your free plan stays active. You'll always have a home on Ozigi.</p>
      `,
      cta_text: "Upgrade before it expires",
      cta_url: discountUrl,
      scheduled_for: day(18),
    },
  ];
}

export async function POST(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (!ADMIN_SECRET || authHeader !== `Bearer ${ADMIN_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Optional: allow caller to override start date
  let startDate = new Date();
  try {
    const body = await req.json().catch(() => ({}));
    if (body.startDate) startDate = new Date(body.startDate);
  } catch {
    // use default
  }

  const campaigns = buildCampaigns(startDate);

  const { data, error } = await supabase
    .from("promo_queue")
    .insert(campaigns.map((c) => ({ ...c, status: "pending" })))
    .select("id, subject, scheduled_for");

  if (error) {
    console.error("[seed-promo-queue] Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  console.log(`[seed-promo-queue] Inserted ${data.length} campaigns`);
  return NextResponse.json({ success: true, inserted: data });
}
