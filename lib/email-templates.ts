export function buildXReminderEmail(postContent: string, intentUrl: string, dashboardUrl: string) {
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; background-color: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0;">
      <style>
        img { max-width: 100%; height: auto; }
      </style>
      <div style="text-align: center; margin-bottom: 20px;">
        <img src="https://ozigi.app/logo.png" alt="Ozigi" style="height: 40px;">
      </div>
      <h2 style="color: #0f172a; margin-top: 0; font-size: 1.5rem;">Your scheduled X post is ready 🚀</h2>
      <div style="background-color: #f8fafc; padding: 16px; border-radius: 8px; margin: 16px 0; border-left: 4px solid #1d4ed8;">
        <p style="margin: 0; white-space: pre-wrap; color: #334155;">${escapeHtml(postContent)}</p>
      </div>
      <div style="text-align: center; margin: 24px 0;">
        <a href="${intentUrl}" target="_blank" style="background-color: #0f172a; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block;">Post to X</a>
      </div>
      <p style="color: #475569; font-size: 0.875rem; text-align: center;">
        Or <a href="${dashboardUrl}" style="color: #1d4ed8;">log in to your Ozigi dashboard</a> to manage all scheduled posts.
      </p>
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0 16px;">
      <p style="color: #94a3b8; font-size: 0.75rem; text-align: center;">
        You're receiving this because you scheduled a post on Ozigi.
      </p>
    </div>
  `;
}

export function buildNewsletterEmail(
  body: string,
  unsubscribeLink: string,
  replyTo?: string,
  senderName?: string,
  isWebView = false,
  viewInBrowserUrl?: string
) {
  const senderDisplay = senderName || 'Newsletter';

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden;">
      <div style="padding: 32px; font-size: 16px; line-height: 1.5;">
        ${body}
      </div>
      <div style="background: #f8fafc; padding: 16px 32px; text-align: center; border-top: 1px solid #e2e8f0; font-size: 0.75rem; color: #64748b;">
        <p style="margin: 0 0 6px 0;">
          You're receiving this because you subscribed to ${senderDisplay}.
          ${replyTo ? ` &bull; Reply to: <a href="mailto:${replyTo}" style="color: #64748b;">${replyTo}</a>` : ''}
        </p>
        ${!isWebView && unsubscribeLink ? `<p style="margin: 0 0 6px 0;"><a href="${unsubscribeLink}" style="color: #ef4444; text-decoration: none;">Unsubscribe</a></p>` : ''}
        <p style="margin: 0; color: #94a3b8; font-size: 0.65rem;">
          ${!isWebView && viewInBrowserUrl ? `<a href="${viewInBrowserUrl}" style="color: #94a3b8; text-decoration: underline;">View in browser</a> &nbsp;&middot;&nbsp; ` : ''}Powered by <a href="https://ozigi.app" style="color: #94a3b8; text-decoration: none;">Ozigi</a>
        </p>
      </div>
    </div>
  `;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function buildFoundersThoughtsWelcomeEmail() {
  const appUrl = process.env.APP_URL || 'https://ozigi.app';
  const blogUrl = 'https://blog.ozigi.app';
  const unsubscribeUrl = `${appUrl}/api/newsletter/unsubscribe`;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; background-color: #0f172a;">
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <div style="background: #1e293b; border-radius: 16px; overflow: hidden;">

          <!-- Red accent bar -->
          <div style="height: 3px; background: linear-gradient(to right, #E8320A, #c52000);"></div>

          <!-- Header -->
          <div style="padding: 36px 40px 0;">
            <p style="margin: 0 0 28px 0; font-size: 10px; font-weight: 900; letter-spacing: 0.22em; text-transform: uppercase; color: #E8320A;">
              Founder&rsquo;s Thoughts
            </p>
            <h1 style="margin: 0 0 8px 0; font-size: 30px; font-weight: 900; font-style: italic; text-transform: uppercase; letter-spacing: -0.03em; line-height: 1; color: #f8fafc;">
              You&rsquo;re in.
            </h1>
          </div>

          <!-- Body -->
          <div style="padding: 28px 40px 36px;">
            <p style="font-size: 16px; color: #cbd5e1; line-height: 1.7; margin: 0 0 20px 0;">
              Hey &mdash; thanks for subscribing.
            </p>
            <p style="font-size: 16px; color: #cbd5e1; line-height: 1.7; margin: 0 0 20px 0;">
              I&rsquo;m Dumebi, founder of Ozigi. Once or twice a week I send a short note about what we&rsquo;re building, how we&rsquo;re thinking about content and AI, and the occasional personal observation from running a product company.
            </p>
            <p style="font-size: 16px; color: #cbd5e1; line-height: 1.7; margin: 0 0 20px 0;">
              No summaries of AI news you&rsquo;ve already seen. No growth-hacking tactics. Just honest writing about what&rsquo;s actually happening inside a team building in this space.
            </p>
            <p style="font-size: 16px; color: #cbd5e1; line-height: 1.7; margin: 0 0 32px 0;">
              If you ever want to reply and tell me what you think, what you&rsquo;re working on, or what you&rsquo;d like me to write about &mdash; go ahead. I read every reply.
            </p>

            <!-- CTA -->
            <div style="margin: 0 0 32px 0;">
              <a href="${blogUrl}" style="display: inline-block; background: linear-gradient(135deg, #E8320A 0%, #c52000 100%); color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 10px; font-size: 12px; font-weight: 900; letter-spacing: 0.1em; text-transform: uppercase;">
                Read the Blog &rarr;
              </a>
            </div>

            <p style="font-size: 15px; color: #94a3b8; line-height: 1.6; margin: 0;">
              Talk soon,<br>
              <strong style="color: #f1f5f9;">Dumebi</strong><br>
              <span style="font-size: 13px;">Founder, Ozigi</span>
            </p>
          </div>

          <!-- Footer -->
          <div style="background: #0f172a; padding: 20px 40px; border-top: 1px solid rgba(255,255,255,0.06);">
            <p style="color: #475569; font-size: 11px; margin: 0; line-height: 1.6;">
              You&rsquo;re receiving this because you subscribed to Founder&rsquo;s Thoughts on ozigi.app.<br>
              &copy; ${new Date().getFullYear()} Ozigi &nbsp;&middot;&nbsp;
              <a href="${unsubscribeUrl}" style="color: #475569; text-decoration: underline;">Unsubscribe</a>
            </p>
          </div>

        </div>
      </div>
    </body>
    </html>
  `;
}

export function buildWelcomeEmail(userName?: string) {
  const displayName = userName || 'there';
  const appUrl = process.env.APP_URL || 'https://ozigi.app';
  const dashboardUrl = `${appUrl}/dashboard`;
  const pricingUrl = `${appUrl}/pricing`;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; background-color: #f4f4f5;">
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <div style="background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 40px 32px; text-align: center;">
            <img src="https://ozigi.app/logo.png" alt="Ozigi" style="height: 48px; margin-bottom: 16px;">
            <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">Welcome to Ozigi!</h1>
            <p style="color: #94a3b8; margin: 12px 0 0 0; font-size: 16px;">Your AI-powered marketing companion</p>
          </div>
          
          <!-- Content -->
          <div style="padding: 40px 32px;">
            <p style="font-size: 18px; color: #0f172a; margin: 0 0 24px 0;">
              Hey ${escapeHtml(displayName)},
            </p>
            <p style="font-size: 16px; color: #475569; line-height: 1.6; margin: 0 0 24px 0;">
              Thanks for joining Ozigi! You now have access to a powerful suite of AI marketing tools that will help you create, schedule, and distribute content across multiple platforms - all from one place.
            </p>
            
            <!-- Trial Banner -->
            <div style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); border-radius: 12px; padding: 20px 24px; margin: 24px 0; text-align: center;">
              <p style="color: #ffffff; margin: 0; font-size: 16px; font-weight: 600;">
                You have 7 days of full access to all features
              </p>
              <p style="color: #bfdbfe; margin: 8px 0 0 0; font-size: 14px;">
                30 AI generations, unlimited scheduling, email newsletters & more
              </p>
            </div>
            
            <!-- Feature Cards -->
            <h3 style="color: #0f172a; margin: 32px 0 20px 0; font-size: 18px; font-weight: 600;">What you can do with Ozigi:</h3>
            
            <!-- Feature 1 -->
            <div style="display: flex; align-items: flex-start; margin-bottom: 20px;">
              <div style="background: #f0fdf4; border-radius: 10px; padding: 12px; margin-right: 16px; flex-shrink: 0;">
                <span style="font-size: 24px;">&#x1F680;</span>
              </div>
              <div>
                <h4 style="color: #0f172a; margin: 0 0 4px 0; font-size: 15px; font-weight: 600;">AI Campaign Generator</h4>
                <p style="color: #64748b; margin: 0; font-size: 14px; line-height: 1.5;">Generate complete marketing campaigns with AI - including social posts, email copy, and images - in seconds.</p>
              </div>
            </div>
            
            <!-- Feature 2 -->
            <div style="display: flex; align-items: flex-start; margin-bottom: 20px;">
              <div style="background: #eff6ff; border-radius: 10px; padding: 12px; margin-right: 16px; flex-shrink: 0;">
                <span style="font-size: 24px;">&#x1F4C5;</span>
              </div>
              <div>
                <h4 style="color: #0f172a; margin: 0 0 4px 0; font-size: 15px; font-weight: 600;">Multi-Platform Scheduling</h4>
                <p style="color: #64748b; margin: 0; font-size: 14px; line-height: 1.5;">Schedule posts to X (Twitter), LinkedIn, Discord, and Slack. Set it and forget it - we handle the rest.</p>
              </div>
            </div>
            
            <!-- Feature 3 -->
            <div style="display: flex; align-items: flex-start; margin-bottom: 20px;">
              <div style="background: #fef3c7; border-radius: 10px; padding: 12px; margin-right: 16px; flex-shrink: 0;">
                <span style="font-size: 24px;">&#x2709;&#xFE0F;</span>
              </div>
              <div>
                <h4 style="color: #0f172a; margin: 0 0 4px 0; font-size: 15px; font-weight: 600;">Email Newsletters</h4>
                <p style="color: #64748b; margin: 0; font-size: 14px; line-height: 1.5;">Build and send beautiful email newsletters to your subscribers. Import lists, track opens, and grow your audience.</p>
              </div>
            </div>
            
            <!-- Feature 4 -->
            <div style="display: flex; align-items: flex-start; margin-bottom: 20px;">
              <div style="background: #fce7f3; border-radius: 10px; padding: 12px; margin-right: 16px; flex-shrink: 0;">
                <span style="font-size: 24px;">&#x1F3A8;</span>
              </div>
              <div>
                <h4 style="color: #0f172a; margin: 0 0 4px 0; font-size: 15px; font-weight: 600;">AI Image Generation</h4>
                <p style="color: #64748b; margin: 0; font-size: 14px; line-height: 1.5;">Create stunning visuals for your posts with AI. No design skills needed - just describe what you want.</p>
              </div>
            </div>
            
            <!-- CTA -->
            <div style="text-align: center; margin: 36px 0 24px;">
              <a href="${dashboardUrl}" style="background: #0f172a; color: #ffffff; padding: 16px 40px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; display: inline-block;">
                Start Creating
              </a>
            </div>
            
            <!-- Quick Links -->
            <div style="background: #f8fafc; border-radius: 12px; padding: 20px 24px; margin: 24px 0;">
              <p style="color: #0f172a; margin: 0 0 12px 0; font-size: 14px; font-weight: 600;">Quick Links:</p>
              <p style="margin: 0; font-size: 14px; line-height: 2;">
                <a href="${dashboardUrl}" style="color: #1d4ed8; text-decoration: none;">Dashboard</a> &bull;
                <a href="${pricingUrl}" style="color: #1d4ed8; text-decoration: none;">Pricing & Plans</a> &bull;
                <a href="mailto:hello@ozigi.app" style="color: #1d4ed8; text-decoration: none;">Contact Support</a>
              </p>
            </div>
            
            <p style="font-size: 14px; color: #64748b; line-height: 1.6; margin: 24px 0 0 0;">
              Questions? Just reply to this email - we read and respond to every message.
            </p>
            
            <p style="font-size: 14px; color: #475569; line-height: 1.6; margin: 16px 0 0 0;">
              Happy marketing!<br>
              <strong>The Ozigi Team</strong>
            </p>
          </div>
          
          <!-- Footer -->
          <div style="background: #f8fafc; padding: 24px 32px; text-align: center; border-top: 1px solid #e2e8f0;">
            <p style="color: #64748b; font-size: 12px; margin: 0;">
              You received this email because you signed up for Ozigi.<br>
              &copy; ${new Date().getFullYear()} Ozigi. Made with care.
            </p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
}

// ==========================================
// PLAN UPGRADE WELCOME EMAILS
// ==========================================

function escapeHtmlSafe(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

interface UpgradeEmailConfig {
  userName: string;
  plan: 'starter' | 'growth' | 'pro' | 'enterprise';
}

export function buildUpgradeWelcomeEmail({ userName, plan }: UpgradeEmailConfig): string {
  const appUrl = process.env.APP_URL || 'https://ozigi.app';
  const dashboardUrl = `${appUrl}/dashboard`;
  const displayName = userName || 'there';

  const planConfigs = {
    starter: {
      title: "Welcome to Starter!",
      subtitle: "Your content engine is live",
      color: "#1d4ed8",
      features: [
        { icon: "&#x1F680;", title: "30 campaigns/month", desc: "Create and distribute more content than ever" },
        { icon: "&#x1F465;", title: "Unlimited personas", desc: "Save and switch between multiple voice profiles" },
        { icon: "&#x1F3A8;", title: "Image generation (2/campaign)", desc: "AI-generated visuals for your posts" },
        { icon: "&#x2709;&#xFE0F;", title: "Newsletter generation + 500 sends/mo", desc: "Turn your content into beautiful newsletters" },
        { icon: "&#x1F4C5;", title: "Scheduling + X email reminder", desc: "Set it and forget it with smart reminders" },
        { icon: "&#x1F4AC;", title: "Slack integration", desc: "Publish directly to your Slack channels" },
      ],
    },
    growth: {
      title: "Welcome to Growth!",
      subtitle: "Your outbound pipeline is live",
      color: "#059669",
      features: [
        { icon: "&#x1F3AF;", title: "1,000 credits/mo", desc: "Scrape and score leads with Gemini AI" },
        { icon: "&#x221E;", title: "Unlimited campaigns + sends", desc: "No caps on outbound sequences" },
        { icon: "&#x1F517;", title: "Email + LinkedIn outreach", desc: "Reach leads on every channel" },
        { icon: "&#x1F4CB;", title: "CRM sync (HubSpot, Zoho, Salesforce)", desc: "Keep your CRM updated automatically" },
        { icon: "&#x1F4CA;", title: "Reply detection", desc: "Know the moment a lead responds" },
        { icon: "&#x1F4DD;", title: "10 content campaigns/mo", desc: "Stay visible while the pipeline runs" },
      ],
    },
    pro: {
      title: "Welcome to Pro!",
      subtitle: "Both engines, no limits",
      color: "#7c3aed",
      features: [
        { icon: "&#x221E;", title: "Unlimited GTM credits", desc: "Scrape and score as many leads as you need" },
        { icon: "&#x1F3A8;", title: "Unlimited content + image generation", desc: "No caps on campaigns or visuals" },
        { icon: "&#x2709;&#xFE0F;", title: "Unlimited newsletter sending", desc: "Grow your audience without restrictions" },
        { icon: "&#x1F916;", title: "Ozigi Copilot (full context)", desc: "AI assistant with complete conversation memory" },
        { icon: "&#x1F4CA;", title: "Campaign analytics", desc: "Track performance across all platforms" },
        { icon: "&#x26A1;", title: "Priority model access + early access features", desc: "Always on the latest and fastest" },
      ],
    },
    enterprise: {
      title: "Welcome to Enterprise!",
      subtitle: "Your dedicated marketing powerhouse",
      color: "#0f172a",
      features: [
        { icon: "&#x1F3E2;", title: "Custom campaign volume", desc: "Limits tailored to your organization" },
        { icon: "&#x1F465;", title: "Team workspace + roles", desc: "Collaborate with your entire team" },
        { icon: "&#x1F6E1;&#xFE0F;", title: "SLA + uptime guarantee", desc: "Enterprise-grade reliability" },
        { icon: "&#x1F3A8;", title: "White-label option", desc: "Brand Ozigi as your own" },
        { icon: "&#x1F4DE;", title: "Dedicated Slack support", desc: "Direct line to our team" },
        { icon: "&#x1F91D;", title: "Dedicated onboarding", desc: "We'll get you up and running personally" },
      ],
    },
  };

  const config = planConfigs[plan];

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; background-color: #f4f4f5;">
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <div style="background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <div style="background: linear-gradient(135deg, ${config.color} 0%, ${config.color}dd 100%); padding: 40px 32px; text-align: center;">
            <img src="https://ozigi.app/logo.png" alt="Ozigi" style="height: 48px; margin-bottom: 16px;">
            <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">${config.title}</h1>
            <p style="color: rgba(255,255,255,0.9); margin: 12px 0 0 0; font-size: 16px;">${config.subtitle}</p>
          </div>
          
          <!-- Content -->
          <div style="padding: 40px 32px;">
            <p style="font-size: 18px; color: #0f172a; margin: 0 0 24px 0;">
              Hey ${escapeHtmlSafe(displayName)},
            </p>
            <p style="font-size: 16px; color: #475569; line-height: 1.6; margin: 0 0 24px 0;">
              Thanks for upgrading! Your ${plan.charAt(0).toUpperCase() + plan.slice(1)} plan is now active. Here's what you've unlocked:
            </p>
            
            <!-- Features -->
            <h3 style="color: #0f172a; margin: 32px 0 20px 0; font-size: 18px; font-weight: 600;">Your new superpowers:</h3>
            
            ${config.features.map(f => `
            <div style="display: flex; align-items: flex-start; margin-bottom: 20px;">
              <div style="background: ${config.color}15; border-radius: 10px; padding: 12px; margin-right: 16px; flex-shrink: 0;">
                <span style="font-size: 24px;">${f.icon}</span>
              </div>
              <div>
                <h4 style="color: #0f172a; margin: 0 0 4px 0; font-size: 15px; font-weight: 600;">${f.title}</h4>
                <p style="color: #64748b; margin: 0; font-size: 14px; line-height: 1.5;">${f.desc}</p>
              </div>
            </div>
            `).join('')}
            
            <!-- CTA -->
            <div style="text-align: center; margin: 36px 0 24px;">
              <a href="${dashboardUrl}" style="background: ${config.color}; color: #ffffff; padding: 16px 40px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; display: inline-block;">
                Go to Dashboard
              </a>
            </div>
            
            <p style="font-size: 14px; color: #64748b; line-height: 1.6; margin: 24px 0 0 0;">
              Questions about your new features? Just reply to this email - we're here to help.
            </p>
            
            <p style="font-size: 14px; color: #475569; line-height: 1.6; margin: 16px 0 0 0;">
              Happy marketing!<br>
              <strong>The Ozigi Team</strong>
            </p>
          </div>
          
          <!-- Footer -->
          <div style="background: #f8fafc; padding: 24px 32px; text-align: center; border-top: 1px solid #e2e8f0;">
            <p style="color: #64748b; font-size: 12px; margin: 0;">
              You received this email because you upgraded your Ozigi plan.<br>
              &copy; ${new Date().getFullYear()} Ozigi. Made with care.
            </p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
}

// ==========================================
// PAYMENT RECEIPT EMAIL
// ==========================================

interface ReceiptEmailConfig {
  userName: string;
  plan: string;
  amount: number;
  currency: string;
  paymentId: string;
  paymentDate: Date;
  billingPeriod: 'monthly' | 'yearly';
  nextBillingDate?: Date;
}

export function buildPaymentReceiptEmail(config: ReceiptEmailConfig): string {
  const appUrl = process.env.APP_URL || 'https://ozigi.app';
  const {
    userName,
    plan,
    amount,
    currency,
    paymentId,
    paymentDate,
    billingPeriod,
    nextBillingDate,
  } = config;

  const displayName = userName || 'there';
  const formattedAmount = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(amount / 100); // Assuming amount is in cents

  const formattedDate = paymentDate.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const formattedNextDate = nextBillingDate
    ? nextBillingDate.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; background-color: #f4f4f5;">
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <div style="background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <div style="background: #0f172a; padding: 32px; text-align: center;">
            <img src="https://ozigi.app/logo.png" alt="Ozigi" style="height: 40px; margin-bottom: 16px;">
            <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700;">Payment Receipt</h1>
          </div>
          
          <!-- Content -->
          <div style="padding: 40px 32px;">
            <p style="font-size: 16px; color: #0f172a; margin: 0 0 24px 0;">
              Hi ${escapeHtmlSafe(displayName)},
            </p>
            <p style="font-size: 16px; color: #475569; line-height: 1.6; margin: 0 0 32px 0;">
              Thank you for your payment. Here&apos;s your receipt for your records.
            </p>
            
            <!-- Receipt Box -->
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; margin-bottom: 32px;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0;">
                    <span style="color: #64748b; font-size: 14px;">Plan</span>
                  </td>
                  <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0; text-align: right;">
                    <span style="color: #0f172a; font-size: 14px; font-weight: 600;">${plan.charAt(0).toUpperCase() + plan.slice(1)} (${billingPeriod})</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0;">
                    <span style="color: #64748b; font-size: 14px;">Amount</span>
                  </td>
                  <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0; text-align: right;">
                    <span style="color: #0f172a; font-size: 14px; font-weight: 600;">${formattedAmount}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0;">
                    <span style="color: #64748b; font-size: 14px;">Payment Date</span>
                  </td>
                  <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0; text-align: right;">
                    <span style="color: #0f172a; font-size: 14px; font-weight: 600;">${formattedDate}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0;">
                    <span style="color: #64748b; font-size: 14px;">Payment ID</span>
                  </td>
                  <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0; text-align: right;">
                    <span style="color: #0f172a; font-size: 12px; font-family: monospace;">${paymentId}</span>
                  </td>
                </tr>
                ${formattedNextDate ? `
                <tr>
                  <td style="padding: 12px 0;">
                    <span style="color: #64748b; font-size: 14px;">Next Billing Date</span>
                  </td>
                  <td style="padding: 12px 0; text-align: right;">
                    <span style="color: #0f172a; font-size: 14px; font-weight: 600;">${formattedNextDate}</span>
                  </td>
                </tr>
                ` : ''}
              </table>
            </div>
            
            <!-- CTA -->
            <div style="text-align: center; margin: 24px 0;">
              <a href="${appUrl}/dashboard/billing" style="background: #0f172a; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px; display: inline-block;">
                View Payment History
              </a>
            </div>
            
            <p style="font-size: 14px; color: #64748b; line-height: 1.6; margin: 24px 0 0 0; text-align: center;">
              Questions about your billing? Reply to this email or contact us at <a href="mailto:support@ozigi.app" style="color: #0f172a;">support@ozigi.app</a>
            </p>
          </div>
          
          <!-- Footer -->
          <div style="background: #f8fafc; padding: 24px 32px; text-align: center; border-top: 1px solid #e2e8f0;">
            <p style="color: #64748b; font-size: 12px; margin: 0;">
              This receipt is for your records. Please save it for your accounting purposes.<br>
              &copy; ${new Date().getFullYear()} Ozigi. Made with care.
            </p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
}

export function buildPromotionalEmail(
  subject: string,
  headline: string,
  body: string,
  ctaText?: string,
  ctaUrl?: string,
  unsubscribeUrl?: string
) {
  const appUrl = process.env.APP_URL || 'https://ozigi.app';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; background-color: #f4f4f5;">
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <div style="background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <div style="padding: 32px 32px 0; text-align: center;">
            <img src="https://ozigi.app/logo.png" alt="Ozigi" style="height: 40px;">
          </div>
          
          <!-- Content -->
          <div style="padding: 32px;">
            <h1 style="color: #0f172a; margin: 0 0 24px 0; font-size: 24px; font-weight: 700; text-align: center;">
              ${escapeHtml(headline)}
            </h1>
            <div style="font-size: 16px; color: #475569; line-height: 1.6;">
              ${body}
            </div>
            
            ${ctaText && ctaUrl ? `
            <div style="text-align: center; margin: 32px 0 16px;">
              <a href="${ctaUrl}" style="background: #0f172a; color: #ffffff; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; display: inline-block;">
                ${escapeHtml(ctaText)}
              </a>
            </div>
            ` : ''}
          </div>
          
          <!-- Footer -->
          <div style="background: #f8fafc; padding: 24px 32px; text-align: center; border-top: 1px solid #e2e8f0;">
            <p style="color: #64748b; font-size: 12px; margin: 0 0 8px 0;">
              You&apos;re receiving this because you have an account on Ozigi.
            </p>
            ${unsubscribeUrl ? `
            <p style="margin: 0;">
              <a href="${unsubscribeUrl}" style="color: #ef4444; font-size: 12px; text-decoration: none;">Unsubscribe from promotional emails</a>
            </p>
            ` : ''}
            <p style="color: #94a3b8; font-size: 11px; margin: 12px 0 0 0;">
              Ozigi - AI-Powered Marketing
            </p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
}
