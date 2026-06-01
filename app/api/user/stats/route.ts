import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { NextResponse } from "next/server";
import { getPlanStatus } from "@/lib/plan";

export async function GET(req: Request) {
  let user = null;

  // Try cookie auth
  const supabase = await createClient();
  const { data: { user: userFromCookie } } = await supabase.auth.getUser();
  if (userFromCookie) {
    user = userFromCookie;
  } else {
    const authHeader = req.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];
      const supabaseToken = createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
      const { data: { user: userFromToken } } = await supabaseToken.auth.getUser(token);
      user = userFromToken;
    }
  }

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const planStatus = await getPlanStatus(user.id);

  const [statsResult, personaResult, scheduledResult] = await Promise.all([
    supabase
      .from("user_stats")
      .select("campaigns_generated, posts_published, personas_saved")
      .eq("user_id", user.id)
      .single(),
    supabase
      .from("personas")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id),
    supabase
      .from("scheduled_posts")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("status", "pending"),
  ]);

  return NextResponse.json({
    // Plan info
    plan: planStatus.plan,
    canGenerate: planStatus.canGenerate,
    generationsUsed: planStatus.generationsUsed,
    generationsLimit: planStatus.generationsLimit,
    imageGenUsed: planStatus.imageGenUsed,
    imageGenLimit: planStatus.imageGenLimit,
    emailSendsUsed: planStatus.emailSendsUsed,
    emailSendsLimit: planStatus.emailSendsLimit,
    hasCopilot: planStatus.hasCopilot,
    hasLongForm: planStatus.hasLongForm,
    longFormUsed: planStatus.longFormUsed,
    longFormLimit: planStatus.longFormLimit,
    hasScheduling: planStatus.hasScheduling,
    newsletterSendingEnabled: planStatus.newsletterSendingEnabled,
    // GTM info
    hasGtm: planStatus.hasGtm,
    canRunCampaigns: planStatus.canRunCampaigns,
    activeCampaignsUsed: planStatus.activeCampaignsUsed,
    activeCampaignsLimit: planStatus.activeCampaignsLimit,
    creditsUsed: planStatus.creditsUsed,
    creditsLimit: planStatus.creditsLimit,
    creditsBalance: Number.isFinite(planStatus.creditsBalance) ? planStatus.creditsBalance : -1,
    sequenceSendsUsed: planStatus.sequenceSendsUsed,
    sequenceSendsLimit: planStatus.sequenceSendsLimit,
    hasLinkedInOutreach: planStatus.hasLinkedInOutreach,
    hasCrmSync: planStatus.hasCrmSync,
    hasMultiInbox: planStatus.hasMultiInbox,
    hasReplyDetection: planStatus.hasReplyDetection,
    isEnterprise: planStatus.isEnterprise,
    // Usage stats
    campaignsGenerated: statsResult.data?.campaigns_generated || 0,
    postsPublished: statsResult.data?.posts_published || 0,
    personasSaved: personaResult.count || 0,
    scheduledCount: scheduledResult.count || 0,
  });
}
