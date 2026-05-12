import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { verifyQStashRequest } from "@/lib/qstash";
import { SendMailClient } from "zeptomail";
import { buildXReminderEmail, buildNewsletterEmail } from "@/lib/email-templates";

const APP_URL = process.env.APP_URL || "http://localhost:3000";

// ZeptoMail configuration
const ZEPTOMAIL_BASE_URL = "https://api.zeptomail.com/v1.1/email";
const ZEPTOMAIL_RAW_TOKEN = process.env.ZEPTOMAIL_API_KEY!;
const mailClient = new SendMailClient({
  url: ZEPTOMAIL_BASE_URL,
  token: `Zoho-enczapikey ${ZEPTOMAIL_RAW_TOKEN}`,
});

const EMAIL_FROM_ADDRESS = process.env.EMAIL_FROM_ADDRESS || "hello@ozigi.app";
const EMAIL_FROM_NAME = process.env.EMAIL_FROM_NAME || "Ozigi";
const NEWSLETTER_FROM_ADDRESS = process.env.NEWSLETTER_FROM_ADDRESS || "hello@ozigi.app";
const NEWSLETTER_FROM_NAME = process.env.NEWSLETTER_FROM_NAME || "Ozigi";

export async function POST(req: Request) {
  try {
    // Verify request is from QStash
    const signature = req.headers.get("upstash-signature");
    const body = await req.text();
    
    if (signature) {
      const isValid = await verifyQStashRequest(signature, body);
      if (!isValid) {
        console.error("[QStash] Invalid signature");
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
      }
    } else if (process.env.NODE_ENV === "production") {
      // In production, require signature
      return NextResponse.json({ error: "Missing signature" }, { status: 401 });
    }

    const { postId } = JSON.parse(body);
    
    if (!postId) {
      return NextResponse.json({ error: "Missing postId" }, { status: 400 });
    }

    console.log(`[QStash] Processing post ${postId}`);

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Fetch the post
    const { data: post, error: fetchError } = await supabase
      .from("scheduled_posts")
      .select("*")
      .eq("id", postId)
      .single();

    if (fetchError || !post) {
      console.error(`[QStash] Post ${postId} not found:`, fetchError);
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    // Skip if already processed
    if (post.status !== "pending") {
      console.log(`[QStash] Post ${postId} already processed (status: ${post.status})`);
      return NextResponse.json({ success: true, skipped: true });
    }

    // Mark as processing
    await supabase
      .from("scheduled_posts")
      .update({ status: "processing" })
      .eq("id", postId);

    let publishSuccess = false;
    let publishError: string | null = null;
    const now = new Date().toISOString();

    // ---------- EMAIL PLATFORM ----------
    if (post.platform === "email") {
      const { data: profile } = await supabase
        .from("profiles")
        .select("email, email_sender_name, reply_to_email")
        .eq("id", post.user_id)
        .single();

      const senderName = profile?.email_sender_name?.trim() || NEWSLETTER_FROM_NAME;
      const fromAddress = NEWSLETTER_FROM_ADDRESS;

      const { data: subscribers, error: subsError } = await supabase
        .from("subscribers")
        .select("email, token")
        .eq("user_id", post.user_id)
        .eq("status", "active");

      if (subsError || !subscribers || subscribers.length === 0) {
        publishSuccess = true;
      } else {
        const emailContent = post.content || "";

        // Extract subject
        let subject = "Your Ozigi Newsletter";
        let emailBody = emailContent;
        const subjectMatch = emailContent.match(/^\s*Subject:\s*(.+)$/im);
        if (subjectMatch) {
          subject = subjectMatch[1].trim();
          emailBody = emailContent.replace(subjectMatch[0], "").replace(/^\n+/, "").trim();
        } else {
          const htmlSubjectMatch = emailContent.match(/<[^>]*>\s*Subject:\s*(.+?)\s*<\/[^>]*>/i);
          if (htmlSubjectMatch) {
            subject = htmlSubjectMatch[1].trim();
            emailBody = emailContent.replace(htmlSubjectMatch[0], "");
          }
        }

        // Format body
        const isHtml = /<[a-z][\s\S]*>/i.test(emailBody);
        let finalBody = emailBody;
        if (!isHtml) {
          finalBody = emailBody.replace(/\n/g, "<br/>");
        } else {
          finalBody = finalBody.replace(/<img\s([^>]*?)>/gi, (match: string, attrs: string) => {
            if (/style=/i.test(attrs)) {
              attrs = attrs.replace(/style="([^"]*)"/i, (_: string, styles: string) => {
                return `style="${styles}; max-width:100%; height:auto;"`;
              });
            } else {
              attrs += ` style="max-width:100%; height:auto;"`;
            }
            return `<img ${attrs}>`;
          });
        }

        const unsubscribeUrlBase = `${APP_URL}/api/unsubscribe?token=`;

        for (const subscriber of subscribers) {
          const unsubscribeLink = unsubscribeUrlBase + subscriber.token;
          const replyToInfo = profile?.reply_to_email || profile?.email;
          const htmlBody = buildNewsletterEmail(finalBody, unsubscribeLink, replyToInfo, senderName, false, `${APP_URL}/email/${post.id}`);

          try {
            await mailClient.sendMail({
              from: { address: fromAddress, name: senderName },
              to: [{ email_address: { address: subscriber.email, name: "" } }],
              subject,
              htmlbody: htmlBody,
            });
            console.log(`[QStash] Sent email to ${subscriber.email}`);
          } catch (err: any) {
            console.error(`[QStash] Failed to send email to ${subscriber.email}:`, err);
          }
        }
        publishSuccess = true;
      }
    }

    // ---------- X PLATFORM ----------
    else if (post.platform === "x") {
      if (post.user_email && !post.reminder_sent) {
        const intentUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(post.content)}`;
        const dashboardUrl = `${APP_URL}/dashboard`;
        const htmlBody = buildXReminderEmail(post.content, intentUrl, dashboardUrl);

        try {
          await mailClient.sendMail({
            from: { address: EMAIL_FROM_ADDRESS, name: EMAIL_FROM_NAME },
            to: [{ email_address: { address: post.user_email, name: "" } }],
            subject: "Your scheduled X post is ready",
            htmlbody: htmlBody,
          });

          await supabase
            .from("scheduled_posts")
            .update({ reminder_sent: true, status: "pending" })
            .eq("id", post.id);
          publishSuccess = true;
          console.log(`[QStash] Sent X reminder to ${post.user_email}`);
        } catch (emailError: any) {
          console.error(`[QStash] Failed to send X reminder:`, emailError);
          publishSuccess = false;
          publishError = emailError.message;
        }
      } else {
        publishSuccess = true;
      }
    }

    // ---------- LINKEDIN PLATFORM ----------
    else if (post.platform === "linkedin") {
      const res = await fetch(`${APP_URL}/api/publish/linkedin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: post.content,
          userId: post.user_id,
          imageUrl: post.media_url,
        }),
      });
      const data = await res.json();
      publishSuccess = res.ok;
      publishError = data.error || null;
      console.log(`[QStash] LinkedIn publish result:`, data);
    }

    // ---------- DISCORD PLATFORM ----------
    else if (post.platform === "discord") {
      const { data: profile } = await supabase
        .from("profiles")
        .select("discord_webhook, display_name, avatar_url")
        .eq("id", post.user_id)
        .single();

      if (profile?.discord_webhook) {
        const res = await fetch(`${APP_URL}/api/post-discord`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: post.content,
            webhookUrl: profile.discord_webhook,
            userId: post.user_id,
            username: profile.display_name || "Powered by Ozigi",
            avatar_url: profile.avatar_url || "https://ozigi.app/logo.png",
          }),
        });
        const data = await res.json();
        publishSuccess = res.ok;
        publishError = data.error || null;
      } else {
        publishSuccess = false;
        publishError = "No Discord webhook configured";
      }
    }

    // ---------- SLACK PLATFORM ----------
    else if (post.platform === "slack") {
      const { data: profile } = await supabase
        .from("profiles")
        .select("slack_webhook, display_name, avatar_url")
        .eq("id", post.user_id)
        .single();

      if (profile?.slack_webhook) {
        const res = await fetch(`${APP_URL}/api/publish/slack`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: post.content,
            webhookUrl: profile.slack_webhook,
            username: profile.display_name || "Powered by Ozigi",
            icon_url: profile.avatar_url || "https://ozigi.app/logo.png",
          }),
        });
        const data = await res.json();
        publishSuccess = res.ok;
        publishError = data.error || null;
      } else {
        publishSuccess = false;
        publishError = "No Slack webhook configured";
      }
    }

    // Update post status (except X which stays pending after reminder)
    if (post.platform !== "x" || !publishSuccess) {
      await supabase
        .from("scheduled_posts")
        .update({
          status: publishSuccess ? "published" : "failed",
          published_at: publishSuccess ? now : null,
          error_message: publishError,
        })
        .eq("id", post.id);
    }

    console.log(`[QStash] Post ${postId} processed: ${publishSuccess ? "success" : "failed"}`);

    return NextResponse.json({
      success: true,
      postId,
      publishSuccess,
      publishError,
    });
  } catch (error: any) {
    console.error("[QStash] Error processing post:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
