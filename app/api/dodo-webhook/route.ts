import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { buildUpgradeWelcomeEmail, buildPaymentReceiptEmail } from '@/lib/email-templates';
import { SendMailClient } from 'zeptomail';

const ZEPTOMAIL_BASE_URL = "https://api.zeptomail.com/v1.1/email";
const ZEPTOMAIL_RAW_TOKEN = process.env.ZEPTOMAIL_API_KEY!;
const mailClient = new SendMailClient({
  url: ZEPTOMAIL_BASE_URL,
  token: `Zoho-enczapikey ${ZEPTOMAIL_RAW_TOKEN}`,
});

const EMAIL_FROM_ADDRESS = process.env.EMAIL_FROM_ADDRESS || 'hello@ozigi.app';
const EMAIL_FROM_NAME = process.env.EMAIL_FROM_NAME || 'Ozigi';

export async function POST(req: Request) {
  try {
    const signature = req.headers.get('x-dodo-signature');
    const rawBody = await req.text();
    const expectedSignature = crypto
      .createHmac('sha256', process.env.DODO_WEBHOOK_SECRET!)
      .update(rawBody)
      .digest('hex');

    const signaturesMatch =
      signature !== null &&
      crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      );
    if (!signaturesMatch) {
      console.error('[Dodo Webhook] Invalid signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const event = JSON.parse(rawBody);
    console.log('[Dodo Webhook] Received event:', event.type, JSON.stringify(event.data?.metadata || {}));

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Map Dodo product IDs to our plan names
    const productToPlan: Record<string, string> = {
      // Legacy product IDs (kept for in-flight subscriptions)
      'pdt_0Nb2mk6p1FU3JGdzuNUzt': 'growth',  // was team monthly
      'pdt_0Nb2varb5A2JQeOENmlfH': 'growth',  // was team yearly
      'pdt_0Nb2wrZKVoi4PDNwOMbbw': 'pro',     // was org monthly
      'pdt_0Nb2ydRec1WCRdZdQS6QW': 'pro',     // was org yearly
      // Current plan product IDs
      'pdt_0Ng3KxpDctsmZzkvR9RmM': 'starter', // starter monthly
      'pdt_0Ng3KxsMWqBgU9U9etp27': 'starter', // starter yearly
      'pdt_0Ng3KxvdmDWWdclDsMBm8': 'growth',  // growth monthly
      'pdt_0Ng3KxzWmRd0k0mq5tlJa': 'growth',  // growth yearly
      'pdt_0Ng3Ky3xlkd5RlLJV9jI9': 'pro',     // pro monthly
      'pdt_0Ng3Ky77RmHesXIqWB800': 'pro',     // pro yearly
    };

    // Map bundle product IDs to credit amounts
    const bundleProductToCredits: Record<string, number> = {
      'pdt_0Ng3KyAEqRIz72yefBDim': 200,   // small bundle, $5
      'pdt_0Ng3KyDWoEN3GN1nCWUFV': 500,   // medium bundle, $10
      'pdt_0Ng3KyGkEPswQk0mFt6xc': 1500,  // large bundle, $25
    };

    // Helper to send upgrade welcome email
    async function sendUpgradeEmail(userId: string, plan: 'starter' | 'growth' | 'pro' | 'enterprise') {
      try {
        // Get user profile
        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('email, display_name, welcome_email_sent, welcome_email_plan')
          .eq('id', userId)
          .single();

        if (!profile?.email) {
          console.warn('[Dodo Webhook] No email found for user', userId);
          return;
        }

        // Idempotency check - don't send duplicate emails for same plan upgrade
        if (profile.welcome_email_sent && profile.welcome_email_plan === plan) {
          console.log('[Dodo Webhook] Welcome email already sent for', plan, 'to', userId);
          return;
        }

        const htmlBody = buildUpgradeWelcomeEmail({
          userName: profile.display_name || profile.email?.split('@')[0],
          plan,
        });

        const subject =
          plan === 'starter'
            ? "Welcome to Starter - Your content engine is live!"
            : plan === 'growth'
            ? "Welcome to Growth - Your outbound pipeline is live!"
            : plan === 'pro'
            ? "Welcome to Pro - Both engines, no limits!"
            : "Welcome to Enterprise - Let's build something amazing!";

        await mailClient.sendMail({
          from: { address: EMAIL_FROM_ADDRESS, name: EMAIL_FROM_NAME },
          to: [{ email_address: { address: profile.email, name: profile.display_name || '' } }],
          subject,
          htmlbody: htmlBody,
        });

        // Mark email as sent (idempotency)
        await supabaseAdmin
          .from('profiles')
          .update({
            welcome_email_sent: true,
            welcome_email_plan: plan,
            welcome_email_sent_at: new Date().toISOString(),
          })
          .eq('id', userId);

        console.log('[Dodo Webhook] Upgrade welcome email sent to', profile.email, 'for plan:', plan);
      } catch (emailError) {
        console.error('[Dodo Webhook] Failed to send upgrade email:', emailError);
        // Don't throw - email failure shouldn't block the upgrade
      }
    }

    // Map product IDs to billing periods
    const productToBillingPeriod: Record<string, 'monthly' | 'yearly'> = {
      'pdt_0Nb2mk6p1FU3JGdzuNUzt': 'monthly',     // team monthly
      'pdt_0Nb2varb5A2JQeOENmlfH': 'yearly',      // team yearly
      'pdt_0Nb2wrZKVoi4PDNwOMbbw': 'monthly',     // org monthly
      'pdt_0Nb2ydRec1WCRdZdQS6QW': 'yearly',      // org yearly
    };

    // Helper to record payment and send receipt
    async function recordPaymentAndSendReceipt(
      userId: string,
      paymentData: {
        paymentId: string;
        subscriptionId?: string;
        plan: string;
        amount: number;
        currency: string;
        productId?: string;
      }
    ) {
      try {
        const billingPeriod = paymentData.productId 
          ? productToBillingPeriod[paymentData.productId] || 'monthly'
          : 'monthly';

        // Calculate next billing date
        const paymentDate = new Date();
        const nextBillingDate = new Date(paymentDate);
        if (billingPeriod === 'yearly') {
          nextBillingDate.setFullYear(nextBillingDate.getFullYear() + 1);
        } else {
          nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);
        }

        // Record payment in payment_history table
        const { error: insertError } = await supabaseAdmin
          .from('payment_history')
          .upsert({
            user_id: userId,
            payment_id: paymentData.paymentId,
            subscription_id: paymentData.subscriptionId,
            plan: paymentData.plan,
            amount: paymentData.amount,
            currency: paymentData.currency || 'usd',
            billing_period: billingPeriod,
            status: 'succeeded',
            payment_date: paymentDate.toISOString(),
            next_billing_date: nextBillingDate.toISOString(),
            receipt_email_sent: false,
          }, {
            onConflict: 'payment_id',
          });

        if (insertError) {
          console.error('[Dodo Webhook] Failed to record payment:', insertError);
          return;
        }

        console.log('[Dodo Webhook] Payment recorded:', paymentData.paymentId);

        // Get user profile for receipt email
        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('email, display_name')
          .eq('id', userId)
          .single();

        if (!profile?.email) {
          console.warn('[Dodo Webhook] No email for receipt:', userId);
          return;
        }

        // Send receipt email
        const receiptHtml = buildPaymentReceiptEmail({
          userName: profile.display_name || profile.email?.split('@')[0],
          plan: paymentData.plan,
          amount: paymentData.amount,
          currency: paymentData.currency || 'usd',
          paymentId: paymentData.paymentId,
          paymentDate,
          billingPeriod,
          nextBillingDate,
        });

        const subject = `Your Ozigi Receipt - ${new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: (paymentData.currency || 'usd').toUpperCase(),
        }).format(paymentData.amount / 100)}`;

        await mailClient.sendMail({
          from: { address: EMAIL_FROM_ADDRESS, name: EMAIL_FROM_NAME },
          to: [{ email_address: { address: profile.email, name: profile.display_name || '' } }],
          subject,
          htmlbody: receiptHtml,
        });

        // Mark receipt as sent
        await supabaseAdmin
          .from('payment_history')
          .update({ receipt_email_sent: true })
          .eq('payment_id', paymentData.paymentId);

        console.log('[Dodo Webhook] Receipt sent to', profile.email);
      } catch (error) {
        console.error('[Dodo Webhook] Failed to record/send receipt:', error);
      }
    }

    // Helper to upgrade user plan
    async function upgradePlan(userId: string, plan: string) {
      console.log('[Dodo Webhook] Upgrading user', userId, 'to plan:', plan);
      
      const { error } = await supabaseAdmin
        .from('profiles')
        .update({
          plan,
          trial_ends_at: null,      // Clear trial since they're now paid
          trial_started_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);

      if (error) {
        console.error('[Dodo Webhook] Update failed:', error);
        return false;
      }
      
      console.log('[Dodo Webhook] Successfully upgraded user', userId, 'to', plan);
      
      // Send upgrade welcome email
      if (plan === 'starter' || plan === 'growth' || plan === 'pro' || plan === 'enterprise') {
        await sendUpgradeEmail(userId, plan as 'starter' | 'growth' | 'pro' | 'enterprise');
      }
      
      return true;
    }

    // Handle payment success (instant upgrade + receipt, or bundle credit top-up)
    if (event.type === 'payment.succeeded' || event.type === 'payment.completed') {
      const metadata = event.data?.metadata;
      const userId = metadata?.user_id;
      const paymentId = event.data?.payment_id || event.data?.id || `pay_${Date.now()}`;
      const subscriptionId = event.data?.subscription_id;
      const amount = event.data?.amount || event.data?.total_amount || 0;
      const currency = event.data?.currency || 'usd';
      const productId = event.data?.product_id || metadata?.product_id;

      // Credit bundle purchase
      if (metadata?.type === 'credit_bundle' && userId && productId) {
        const credits = bundleProductToCredits[productId];
        if (credits) {
          console.log('[Dodo Webhook] Adding', credits, 'credits to user', userId);
          const { error } = await supabaseAdmin.rpc('add_addon_credits', {
            user_id_param: userId,
            credits_param: credits,
          });
          if (error) {
            console.error('[Dodo Webhook] Failed to add addon credits:', error);
          }
        } else {
          console.warn('[Dodo Webhook] Unknown bundle product ID:', productId);
        }
        return NextResponse.json({ received: true });
      }

      // Regular plan upgrade
      const planFromMetadata = metadata?.plan;
      if (userId && planFromMetadata) {
        await upgradePlan(userId, planFromMetadata);
        await recordPaymentAndSendReceipt(userId, {
          paymentId,
          subscriptionId,
          plan: planFromMetadata,
          amount,
          currency,
          productId,
        });
      } else {
        console.warn('[Dodo Webhook] Payment succeeded but missing user_id or plan in metadata:', metadata);
      }
    }

    // Handle subscription events
    if (event.type === 'subscription.created' || event.type === 'subscription.updated' || event.type === 'subscription.active') {
      const metadata = event.data?.metadata;
      const userId = metadata?.user_id;
      const subscriptionItems = event.data?.subscription_items || event.data?.items || [];
      const productId = subscriptionItems?.[0]?.product_id;
      
      // Prefer metadata plan, fall back to product ID lookup
      const plan = metadata?.plan || productToPlan[productId];

      if (userId && plan) {
        await upgradePlan(userId, plan);
      } else {
        console.warn('[Dodo Webhook] Subscription event but missing data:', { userId, plan, productId, metadata });
      }
    }

    // Handle subscription cancellation / expiry / failure → downgrade to free
    if (
      event.type === 'subscription.canceled'  ||
      event.type === 'subscription.cancelled' ||
      event.type === 'subscription.expired'   ||
      event.type === 'subscription.failed'
    ) {
      const userId = event.data?.metadata?.user_id;
      if (userId) {
        console.log(`[Dodo Webhook] Downgrading user ${userId} to free (${event.type})`);
        await supabaseAdmin
          .from('profiles')
          .update({ plan: 'free', updated_at: new Date().toISOString() })
          .eq('id', userId);
      }
    }

    // Handle plan change (e.g. user upgrades starter → pro via Dodo portal)
    if (event.type === 'subscription.plan_changed') {
      const metadata = event.data?.metadata;
      const userId = metadata?.user_id;
      const subscriptionItems = event.data?.subscription_items || event.data?.items || [];
      const productId = subscriptionItems?.[0]?.product_id;

      // Prefer metadata plan, fall back to product ID lookup
      const plan = metadata?.plan || productToPlan[productId];

      if (userId && plan) {
        console.log(`[Dodo Webhook] Plan changed for user ${userId} → ${plan}`);
        await upgradePlan(userId, plan);
      } else {
        console.warn('[Dodo Webhook] subscription.plan_changed but could not resolve plan:', { userId, productId, metadata });
      }
    }

    // subscription.on_hold — payment is failing but Dodo is retrying.
    // Log it but don't downgrade yet; let subscription.failed or .cancelled handle the final state.
    if (event.type === 'subscription.on_hold') {
      const userId = event.data?.metadata?.user_id;
      console.warn(`[Dodo Webhook] Subscription on hold for user ${userId} — awaiting retry outcome`);
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error('[Dodo Webhook] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
