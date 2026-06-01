import { createClient } from '@supabase/supabase-js';

export type Plan = "free" | "starter" | "growth" | "pro" | "enterprise";

export interface PlanStatus {
  plan: Plan;

  // Content engine
  canGenerate: boolean;
  generationsUsed: number;
  generationsLimit: number;        // -1 = unlimited
  imageGenUsed: number;
  imageGenLimit: number;           // -1 = unlimited; 0 = no access
  emailSendsUsed: number;
  emailSendsLimit: number;         // -1 = unlimited; 0 = no access
  hasCopilot: boolean;
  hasLongForm: boolean;            // true when limit not yet reached this month
  longFormUsed: number;
  longFormLimit: number;           // 1 on free/starter/growth; -1 on pro/enterprise
  hasScheduling: boolean;
  newsletterSendingEnabled: boolean;

  // GTM / outbound
  hasGtm: boolean;                 // false on starter — blocks all GTM UI
  canRunCampaigns: boolean;
  activeCampaignsUsed: number;
  activeCampaignsLimit: number;    // -1 = unlimited
  creditsUsed: number;
  creditsLimit: number;            // -1 = unlimited; 0 = no GTM
  creditsBalance: number;          // Infinity when unlimited
  sequenceSendsUsed: number;
  sequenceSendsLimit: number;      // -1 = unlimited
  hasLinkedInOutreach: boolean;
  hasCrmSync: boolean;
  hasMultiInbox: boolean;
  hasReplyDetection: boolean;

  isEnterprise: boolean;
}

// ─── Limit tables ─────────────────────────────────────────────────────────────

const GENERATION_LIMITS: Record<Plan, number> = {
  free: 3,
  starter: 30,
  growth: 10,
  pro: -1,
  enterprise: -1,
};

const LONG_FORM_LIMITS: Record<Plan, number> = {
  free: 1,
  starter: 1,
  growth: 1,
  pro: -1,
  enterprise: -1,
};

const IMAGE_GEN_LIMITS: Record<Plan, number> = {
  free: 0,
  starter: 2,
  growth: 0,
  pro: -1,
  enterprise: -1,
};

const EMAIL_SEND_LIMITS: Record<Plan, number> = {
  free: 0,
  starter: 500,
  growth: 0,
  pro: -1,
  enterprise: -1,
};

const HAS_SCHEDULING: Record<Plan, boolean> = {
  free: false,
  starter: true,
  growth: true,
  pro: true,
  enterprise: true,
};

const HAS_COPILOT: Record<Plan, boolean> = {
  free: false,
  starter: false,
  growth: false,
  pro: true,
  enterprise: true,
};

const HAS_GTM: Record<Plan, boolean> = {
  free: true,
  starter: false,
  growth: true,
  pro: true,
  enterprise: true,
};

const CREDITS_LIMITS: Record<Plan, number> = {
  free: 50,
  starter: 0,
  growth: 1000,
  pro: -1,
  enterprise: -1,
};

const ACTIVE_CAMPAIGNS_LIMITS: Record<Plan, number> = {
  free: 1,
  starter: 0,
  growth: -1,
  pro: -1,
  enterprise: -1,
};

const SEQUENCE_SENDS_LIMITS: Record<Plan, number> = {
  free: 30,
  starter: 0,
  growth: -1,
  pro: -1,
  enterprise: -1,
};

const HAS_LINKEDIN_OUTREACH: Record<Plan, boolean> = {
  free: false,
  starter: false,
  growth: true,
  pro: true,
  enterprise: true,
};

const HAS_CRM_SYNC: Record<Plan, boolean> = {
  free: false,
  starter: false,
  growth: true,
  pro: true,
  enterprise: true,
};

const HAS_MULTI_INBOX: Record<Plan, boolean> = {
  free: false,
  starter: false,
  growth: false,
  pro: true,
  enterprise: true,
};

const HAS_REPLY_DETECTION: Record<Plan, boolean> = {
  free: true,
  starter: false,
  growth: true,
  pro: true,
  enterprise: true,
};

const VALID_PLANS = new Set<string>(['free', 'starter', 'growth', 'pro', 'enterprise']);

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function getPlanStatus(userId: string): Promise<PlanStatus> {
  const ADMIN_EMAILS = process.env.ADMIN_EMAILS
    ? process.env.ADMIN_EMAILS.split(',').map(e => e.trim())
    : [];

  const supabaseAdmin = adminClient();

  // 1. Fetch user email for admin check
  let userEmail: string | undefined;
  try {
    const { data: userData } = await supabaseAdmin.auth.admin.getUserById(userId);
    userEmail = userData.user.email;
  } catch {}

  // 2. Admin override — unlimited on everything, plan shown as "pro"
  if (userEmail && ADMIN_EMAILS.includes(userEmail)) {
    return {
      plan: 'pro',
      canGenerate: true,
      generationsUsed: 0,
      generationsLimit: -1,
      imageGenUsed: 0,
      imageGenLimit: -1,
      emailSendsUsed: 0,
      emailSendsLimit: -1,
      hasCopilot: true,
      hasLongForm: true,
      longFormUsed: 0,
      longFormLimit: -1,
      hasScheduling: true,
      newsletterSendingEnabled: true,
      hasGtm: true,
      canRunCampaigns: true,
      activeCampaignsUsed: 0,
      activeCampaignsLimit: -1,
      creditsUsed: 0,
      creditsLimit: -1,
      creditsBalance: Infinity,
      sequenceSendsUsed: 0,
      sequenceSendsLimit: -1,
      hasLinkedInOutreach: true,
      hasCrmSync: true,
      hasMultiInbox: true,
      hasReplyDetection: true,
      isEnterprise: false,
    };
  }

  const now = new Date();

  // 3. Fetch or create profile — new users default to "free", no trial
  let { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('plan')
    .eq('id', userId)
    .maybeSingle();

  if (!profile) {
    await supabaseAdmin.from('profiles').insert({ id: userId, plan: 'free' });
    profile = { plan: 'free' };
  }

  const plan: Plan = VALID_PLANS.has(profile.plan) ? (profile.plan as Plan) : 'free';

  // 4. Fetch usage stats, auto-create row if missing
  const { data: existingStats } = await supabaseAdmin
    .from('user_stats')
    .select(
      'campaigns_generated, image_generations_this_month, email_sends_this_month, ' +
      'leads_scraped_this_month, sequence_sends_this_month, long_form_used_this_month, ' +
      'addon_credits_balance, generation_reset_at'
    )
    .eq('user_id', userId)
    .maybeSingle();

  let stats = {
    campaigns_generated: 0,
    image_generations_this_month: 0,
    email_sends_this_month: 0,
    leads_scraped_this_month: 0,
    sequence_sends_this_month: 0,
    long_form_used_this_month: 0,
    addon_credits_balance: 0,
  };

  if (!existingStats) {
    const nextReset = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    await supabaseAdmin.from('user_stats').insert({
      user_id: userId,
      ...stats,
      generation_reset_at: nextReset.toISOString(),
    });
  } else {
    const resetAt = existingStats.generation_reset_at
      ? new Date(existingStats.generation_reset_at)
      : null;

    if (resetAt && now >= resetAt) {
      // Monthly reset — do NOT reset addon_credits_balance
      const nextReset = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      await supabaseAdmin
        .from('user_stats')
        .update({
          campaigns_generated: 0,
          image_generations_this_month: 0,
          email_sends_this_month: 0,
          leads_scraped_this_month: 0,
          sequence_sends_this_month: 0,
          long_form_used_this_month: 0,
          generation_reset_at: nextReset.toISOString(),
          updated_at: now.toISOString(),
        })
        .eq('user_id', userId);
      stats.addon_credits_balance = existingStats.addon_credits_balance ?? 0;
    } else {
      stats = {
        campaigns_generated: existingStats.campaigns_generated ?? 0,
        image_generations_this_month: existingStats.image_generations_this_month ?? 0,
        email_sends_this_month: existingStats.email_sends_this_month ?? 0,
        leads_scraped_this_month: existingStats.leads_scraped_this_month ?? 0,
        sequence_sends_this_month: existingStats.sequence_sends_this_month ?? 0,
        long_form_used_this_month: existingStats.long_form_used_this_month ?? 0,
        addon_credits_balance: existingStats.addon_credits_balance ?? 0,
      };
    }
  }

  // 5. Count active campaigns from the campaigns table
  let activeCampaignsUsed = 0;
  try {
    const { count } = await supabaseAdmin
      .from('campaigns')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'active');
    activeCampaignsUsed = count ?? 0;
  } catch {}

  // 6. Compute derived values
  const creditsLimit = CREDITS_LIMITS[plan];
  const creditsUsed = stats.leads_scraped_this_month;
  const addonCredits = stats.addon_credits_balance;
  const creditsBalance =
    creditsLimit === -1 ? Infinity : creditsLimit - creditsUsed + addonCredits;

  const activeCampaignsLimit = ACTIVE_CAMPAIGNS_LIMITS[plan];
  const hasGtm = HAS_GTM[plan];
  const canRunCampaigns =
    hasGtm && (activeCampaignsLimit === -1 || activeCampaignsUsed < activeCampaignsLimit);

  const generationsLimit = GENERATION_LIMITS[plan];
  const longFormLimit = LONG_FORM_LIMITS[plan];
  const emailSendsLimit = EMAIL_SEND_LIMITS[plan];

  return {
    plan,
    canGenerate: generationsLimit === -1 || stats.campaigns_generated < generationsLimit,
    generationsUsed: stats.campaigns_generated,
    generationsLimit,
    imageGenUsed: stats.image_generations_this_month,
    imageGenLimit: IMAGE_GEN_LIMITS[plan],
    emailSendsUsed: stats.email_sends_this_month,
    emailSendsLimit,
    hasCopilot: HAS_COPILOT[plan],
    hasLongForm: longFormLimit === -1 || stats.long_form_used_this_month < longFormLimit,
    longFormUsed: stats.long_form_used_this_month,
    longFormLimit,
    hasScheduling: HAS_SCHEDULING[plan],
    newsletterSendingEnabled: emailSendsLimit !== 0,
    hasGtm,
    canRunCampaigns,
    activeCampaignsUsed,
    activeCampaignsLimit,
    creditsUsed,
    creditsLimit,
    creditsBalance,
    sequenceSendsUsed: stats.sequence_sends_this_month,
    sequenceSendsLimit: SEQUENCE_SENDS_LIMITS[plan],
    hasLinkedInOutreach: HAS_LINKEDIN_OUTREACH[plan],
    hasCrmSync: HAS_CRM_SYNC[plan],
    hasMultiInbox: HAS_MULTI_INBOX[plan],
    hasReplyDetection: HAS_REPLY_DETECTION[plan],
    isEnterprise: plan === 'enterprise',
  };
}

// ─── Increment helpers ────────────────────────────────────────────────────────

export async function incrementCampaignGeneration(userId: string): Promise<void> {
  const { error } = await adminClient().rpc('increment_campaigns_generated', { user_id_param: userId });
  if (error) console.error('increment_campaigns_generated error:', error);
}

export async function incrementNewsletterGeneration(userId: string): Promise<void> {
  const { error } = await adminClient().rpc('increment_newsletters_generated', { user_id_param: userId });
  if (error) console.error('increment_newsletters_generated error:', error);
}

export async function incrementImageGeneration(userId: string): Promise<void> {
  const { error } = await adminClient().rpc('increment_image_generations', { user_id_param: userId });
  if (error) console.error('increment_image_generations error:', error);
}

export async function incrementEmailSend(userId: string): Promise<void> {
  const { error } = await adminClient().rpc('increment_email_sends', { user_id_param: userId });
  if (error) console.error('increment_email_sends error:', error);
}

export async function incrementLeadsScraped(userId: string, count = 1): Promise<void> {
  const { error } = await adminClient().rpc('increment_leads_scraped', {
    user_id_param: userId,
    count_param: count,
  });
  if (error) console.error('increment_leads_scraped error:', error);
}

export async function incrementSequenceSend(userId: string): Promise<void> {
  const { error } = await adminClient().rpc('increment_sequence_sends', { user_id_param: userId });
  if (error) console.error('increment_sequence_sends error:', error);
}

export async function incrementLongFormUsed(userId: string): Promise<void> {
  const { error } = await adminClient().rpc('increment_long_form_used', { user_id_param: userId });
  if (error) console.error('increment_long_form_used error:', error);
}

export async function addAddonCredits(userId: string, credits: number): Promise<void> {
  const { error } = await adminClient().rpc('add_addon_credits', {
    user_id_param: userId,
    credits_param: credits,
  });
  if (error) console.error('add_addon_credits error:', error);
}

export async function deductAddonCredits(userId: string, count = 1): Promise<void> {
  const { error } = await adminClient().rpc('deduct_addon_credits', {
    user_id_param: userId,
    count_param: count,
  });
  if (error) console.error('deduct_addon_credits error:', error);
}
