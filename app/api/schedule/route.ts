import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { schedulePostWithQStash } from "@/lib/qstash";
import { phCapture } from "@/lib/posthog";

export async function POST(req: Request) {
  try {
    const { posts, scheduledFor, campaignId } = await req.json();
    const authHeader = req.headers.get("Authorization");

    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: authHeader } } }
    );

    // Get user from auth
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    const userEmail = user?.email; // may be null
    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Reminder email configured in Settings takes priority over the login email
    const { data: profile } = await supabase
      .from("profiles")
      .select("email")
      .eq("id", user.id)
      .single();
    const reminderEmail = profile?.email || userEmail;

    // Insert scheduled posts
    const scheduledPosts = posts.map((post: any) => ({
      user_id: user.id,
      user_email: post.email || reminderEmail, // explicit email > Settings email > login email
      campaign_id: campaignId,
      platform: post.platform,
      content: post.content,
      media_url: post.imageUrl,
      scheduled_for: scheduledFor,
      status: 'pending',
      delivery_mode: post.deliveryMode === 'reminder' ? 'reminder' : 'auto',
    }));

    let { data, error } = await supabase
      .from("scheduled_posts")
      .insert(scheduledPosts)
      .select();

    // Graceful fallback if the delivery_mode migration hasn't been applied yet
    if (error && /delivery_mode/.test(error.message)) {
      ({ data, error } = await supabase
        .from("scheduled_posts")
        .insert(scheduledPosts.map(({ delivery_mode, ...rest }: any) => rest))
        .select());
    }

    if (error) throw error;

    // Schedule QStash jobs for each post for precise timing
    const qstashResults = [];
    for (const post of data || []) {
      try {
        const messageId = await schedulePostWithQStash(post.id, scheduledFor);
        // Store the QStash message ID so we can cancel if needed
        await supabase
          .from("scheduled_posts")
          .update({ qstash_message_id: messageId })
          .eq("id", post.id);
        qstashResults.push({ postId: post.id, messageId, success: true });
      } catch (qstashError: any) {
        console.error(`Failed to schedule QStash for post ${post.id}:`, qstashError);
        qstashResults.push({ postId: post.id, success: false, error: qstashError.message });
      }
    }

    const platforms = [...new Set(posts.map((p: any) => p.platform))]
    phCapture(user.id, 'content_scheduled', {
      email: user.email,
      postCount: posts.length,
      platforms,
      scheduledFor,
      hasCampaign: !!campaignId,
    }).catch(() => {})

    return NextResponse.json({ success: true, data, qstash: qstashResults });
  } catch (error: any) {
    console.error("Schedule error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
