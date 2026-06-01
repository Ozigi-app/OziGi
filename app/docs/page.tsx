import Link from "next/link";
import Footer from "../../components/Footer";

export const metadata = {
  title: "Ozigi Docs — GTM Content Suite",
  description: "Learn how to use Ozigi's GTM suite: outbound email and LinkedIn sequences, lead scraping, content engine (social posts, newsletters, blog), and CRM integrations.",
  alternates: { canonical: "https://ozigi.app/docs" },
};

export default function DocsPage() {
  return (
    <div className="bg-[#fafafa] text-slate-900 min-h-screen flex flex-col scroll-smooth">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-200 px-4 py-4">
        <div className="max-w-6xl mx-auto flex justify-between items-center px-4 md:px-8">
          <Link href="/" className="flex items-center gap-2">
            <span className="font-black italic uppercase tracking-tighter text-xl text-slate-900">Ozigi Docs</span>
          </Link>
          <Link href="/dashboard"
            className="text-xs font-black uppercase tracking-widest text-slate-500 hover:text-slate-900 transition-colors bg-white border border-slate-200 px-4 py-2 rounded-full shadow-sm">
            Go to Dashboard →
          </Link>
        </div>
      </header>

      <div className="flex-1 max-w-6xl mx-auto w-full px-6 py-16 flex flex-col lg:flex-row gap-12 relative">
        {/* Sidebar TOC */}
        <aside className="hidden lg:block w-64 shrink-0">
          <div className="sticky top-28">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4">On this page</h3>
            <nav>
              <ul className="space-y-3 text-sm font-medium text-slate-500">
                <li>
                  <a href="#quick-start" className="hover:text-slate-900 transition-colors flex items-center gap-2">
                    <span className="bg-brand-red text-white text-[10px] font-black uppercase px-1.5 py-0.5 rounded">Start here</span>
                    Quick Start
                  </a>
                </li>
                <li><a href="#platform-overview"   className="hover:text-slate-900 transition-colors block">1. Platform Overview</a></li>
                <li><a href="#content-engine"       className="hover:text-slate-900 transition-colors block">2. Content Engine</a></li>
                <li><a href="#outbound-growth"      className="hover:text-slate-900 transition-colors block">3. Outbound Growth</a></li>
                <li><a href="#personas"             className="hover:text-slate-900 transition-colors block">4. Personas</a></li>
                <li><a href="#email-setup"          className="hover:text-slate-900 transition-colors block">5. Email Setup (Gmail / SMTP)</a></li>
                <li><a href="#crm"                  className="hover:text-slate-900 transition-colors block">6. CRM Integrations</a></li>
                <li><a href="#linkedin-setup"       className="hover:text-slate-900 transition-colors block">7. LinkedIn Setup</a></li>
                <li><a href="#subscribers"          className="hover:text-slate-900 transition-colors block">8. Newsletter Subscribers</a></li>
                <li><a href="#publishing"           className="hover:text-slate-900 transition-colors block">9. Social Publishing</a></li>
                <li><a href="#blog"                 className="hover:text-slate-900 transition-colors block">10. Blog Post Generation</a></li>
                <li><a href="#troubleshooting"      className="hover:text-slate-900 transition-colors block">11. Troubleshooting</a></li>
              </ul>
            </nav>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 max-w-3xl">
          <div className="mb-16">
            <h1 className="text-4xl md:text-5xl font-black italic uppercase tracking-tighter mb-4">
              Platform Documentation
            </h1>
            <p className="text-lg text-slate-600 font-medium leading-relaxed">
              Ozigi is a GTM content suite for founders and small teams. Two engines work together: an <strong>Outbound Growth</strong> engine that finds leads and runs personalised email + LinkedIn sequences, and a <strong>Content Engine</strong> that publishes newsletters, social posts, and blog articles in your voice.
            </p>
          </div>

          <div className="space-y-20">

            {/* ── Quick Start ─────────────────────────────────────────── */}
            <section id="quick-start" className="scroll-mt-28">
              <div className="bg-gradient-to-br from-brand-red to-red-700 rounded-3xl p-8 text-white mb-8 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-32 translate-x-32" />
                <div className="relative">
                  <span className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm text-white text-xs font-black uppercase px-3 py-1 rounded-full mb-4">
                    <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
                    Quick Start Guide
                  </span>
                  <h2 className="text-3xl md:text-4xl font-black italic uppercase tracking-tighter mb-4">
                    Running your first GTM campaign
                  </h2>
                  <p className="text-white/80 text-lg max-w-xl">
                    Get outbound running and your first content piece live in under 10 minutes.
                  </p>
                </div>
              </div>

              <div className="grid gap-4">
                {[
                  { n: 1, t: "Create your account", time: "~30 sec",
                    body: "Sign up with email. You get a 7-day full-access trial — no credit card required." },
                  { n: 2, t: "Set up your sending email", time: "~2 min",
                    body: "Go to Outreach Settings → Gmail or SMTP. Connect the inbox you'll send outbound emails from. This is required before launching any campaign." },
                  { n: 3, t: "Create a persona", time: "~3 min",
                    body: "Go to Personas and create a voice profile for yourself. This shapes every email, social post, and newsletter Ozigi writes — be specific about your tone and what you'd never say." },
                  { n: 4, t: "Launch your first outbound campaign", time: "~3 min",
                    body: "Go to Email Outreach → New Campaign. Paste your product URL to auto-fill, describe your ICP, and set your email sequence steps. Ozigi scrapes leads and writes personalised emails for each." },
                  { n: 5, t: "Generate your first social post", time: "~1 min",
                    body: "Go to Social Posts. Paste a URL or any context, pick your platforms and persona, and hit Generate. Posts for LinkedIn, X, Discord, and email — all at once." },
                ].map(s => (
                  <div key={s.n} className="flex gap-4 items-start bg-white border-2 border-slate-200 rounded-2xl p-5 hover:border-brand-red/30 transition-colors group">
                    <div className="w-10 h-10 bg-brand-red text-white rounded-full flex items-center justify-center font-black text-lg shrink-0 group-hover:scale-110 transition-transform">{s.n}</div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="font-bold text-slate-900">{s.t}</h3>
                        <span className="text-xs text-slate-400 font-medium">{s.time}</span>
                      </div>
                      <p className="text-sm text-slate-600">{s.body}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-8 flex flex-col sm:flex-row gap-4 items-center">
                <Link href="/dashboard"
                  className="inline-flex items-center gap-2 bg-brand-red text-white px-6 py-3 rounded-full font-black uppercase tracking-widest text-sm hover:bg-red-700 transition-colors shadow-lg">
                  Open Dashboard →
                </Link>
                <span className="text-sm text-slate-500">No credit card required for trial</span>
              </div>
            </section>

            {/* ── 1. Platform Overview ────────────────────────────────── */}
            <section id="platform-overview" className="scroll-mt-28">
              <h2 className="text-2xl font-black italic uppercase tracking-tighter text-slate-900 border-b-2 border-slate-100 pb-2 mb-6">
                1. Platform Overview
              </h2>
              <p className="text-slate-600 font-medium leading-relaxed mb-6">
                Ozigi has two main engines. They work independently but share the same persona system and source material.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="bg-slate-900 text-white p-6 rounded-2xl">
                  <p className="text-brand-red font-black text-xs uppercase tracking-widest mb-3">Outbound Growth</p>
                  <h3 className="text-lg font-black italic uppercase tracking-tighter mb-3">Find leads. Run sequences.</h3>
                  <ul className="text-sm text-slate-300 space-y-1.5">
                    <li>→ Scrape GitHub, Dev.to, LinkedIn for ICP-matched leads</li>
                    <li>→ Gemini scores each lead against your ICP</li>
                    <li>→ Personalised email sequences (cold intro → follow-ups)</li>
                    <li>→ LinkedIn connection requests + DMs (automated)</li>
                    <li>→ Reply detection, open tracking, bounce handling</li>
                    <li>→ CRM sync (HubSpot, Zoho, Salesforce)</li>
                  </ul>
                </div>
                <div className="bg-white border-2 border-slate-200 p-6 rounded-2xl">
                  <p className="text-brand-red font-black text-xs uppercase tracking-widest mb-3">Content Engine</p>
                  <h3 className="text-lg font-black italic uppercase tracking-tighter mb-3">Publish content. Sound human.</h3>
                  <ul className="text-sm text-slate-600 space-y-1.5">
                    <li>→ Social posts: LinkedIn, X, Discord, Email</li>
                    <li>→ Email newsletters to your subscriber list</li>
                    <li>→ Blog posts and long-form articles</li>
                    <li>→ Banned lexicon strips AI buzzwords automatically</li>
                    <li>→ Persona system shapes every piece of content</li>
                    <li>→ Schedule and publish directly from the dashboard</li>
                  </ul>
                </div>
              </div>
            </section>

            {/* ── 2. Content Engine ───────────────────────────────────── */}
            <section id="content-engine" className="scroll-mt-28">
              <h2 className="text-2xl font-black italic uppercase tracking-tighter text-slate-900 border-b-2 border-slate-100 pb-2 mb-6">
                2. Content Engine
              </h2>
              <p className="text-slate-600 font-medium leading-relaxed mb-6">
                The content engine generates social posts, newsletters, and blog articles from any source material — URLs, notes, PDFs, images, or audio.
              </p>

              <div className="space-y-5">
                <div className="bg-white border border-slate-200 p-6 rounded-2xl">
                  <h3 className="font-bold text-slate-900 mb-3">Social Posts</h3>
                  <p className="text-sm text-slate-600 mb-3">Go to <strong>Social Posts</strong> in the sidebar. Paste a URL, notes, or upload a file. Select which platforms to generate for (LinkedIn, X, Discord, Email) and pick a persona. Click Generate — all platforms are created simultaneously.</p>
                  <div className="bg-slate-50 p-4 rounded-xl text-sm text-slate-600">
                    <p className="font-semibold mb-1">Input options:</p>
                    <ul className="list-disc pl-5 space-y-1">
                      <li>Any public URL (blog post, changelog, Dev.to article)</li>
                      <li>Raw meeting notes or brain dump (messy is fine)</li>
                      <li>PDF, image, audio, or video file (up to 100MB)</li>
                    </ul>
                  </div>
                </div>

                <div className="bg-white border border-slate-200 p-6 rounded-2xl">
                  <h3 className="font-bold text-slate-900 mb-3">Newsletter</h3>
                  <p className="text-sm text-slate-600 mb-3">Go to <strong>Newsletter</strong> in the sidebar. Same input flow as social posts — the email platform is pre-selected and social platforms are locked. The generated newsletter can be sent directly to your subscriber list via the Schedule button.</p>
                  <p className="text-sm text-slate-500 italic">Requires at least one subscriber and a configured sender name in Settings.</p>
                </div>

                <div className="bg-white border border-slate-200 p-6 rounded-2xl">
                  <h3 className="font-bold text-slate-900 mb-3">Generation History</h3>
                  <p className="text-sm text-slate-600">Every social post campaign and newsletter you generate is saved automatically. Access it via the Generation History sub-link under Social Posts in the sidebar. Social posts and newsletters are in separate tabs — click any entry to restore it.</p>
                </div>

                <div className="bg-slate-900 text-white p-5 rounded-2xl text-sm">
                  <h3 className="font-black uppercase tracking-widest text-xs mb-3">The Banned Lexicon</h3>
                  <p className="text-slate-300 mb-3">Ozigi enforces a hard block on AI buzzwords at the prompt level. Words like "delve", "tapestry", "robust", "seamlessly", and "unlock" are banned before the model responds. The result is copy that sounds like a real person wrote it.</p>
                  <div className="flex flex-wrap gap-2">
                    {["delve", "tapestry", "crucial", "unlock", "supercharge", "robust", "seamlessly", "vibrant"].map(w => (
                      <span key={w} className="px-2 py-0.5 bg-white/10 rounded text-xs font-mono line-through decoration-brand-red">{w}</span>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            {/* ── 3. Outbound Growth ──────────────────────────────────── */}
            <section id="outbound-growth" className="scroll-mt-28">
              <h2 className="text-2xl font-black italic uppercase tracking-tighter text-slate-900 border-b-2 border-slate-100 pb-2 mb-6">
                3. Outbound Growth
              </h2>
              <p className="text-slate-600 font-medium leading-relaxed mb-6">
                The outbound engine scrapes leads from GitHub, Dev.to, and LinkedIn, scores them against your ICP, writes personalised emails and LinkedIn messages for each, and sends them on a schedule.
              </p>

              <div className="space-y-5">
                <div className="bg-white border border-slate-200 p-6 rounded-2xl">
                  <h3 className="font-bold text-slate-900 mb-3">Creating a Campaign</h3>
                  <ol className="space-y-2 text-sm text-slate-600 list-decimal pl-5">
                    <li>Go to <strong>Email Outreach</strong> and click <strong>New Campaign</strong></li>
                    <li>Paste your product URL — Gemini reads the page and auto-fills sender info, product description, and ICP</li>
                    <li>Review and edit the auto-filled fields, then describe your target audience in plain English</li>
                    <li>Configure your sequence steps (email + LinkedIn, with delays between each)</li>
                    <li>Optionally pick a persona for the email writing voice</li>
                    <li>Set daily send limits and click <strong>Create Campaign</strong></li>
                  </ol>
                </div>

                <div className="bg-white border border-slate-200 p-6 rounded-2xl">
                  <h3 className="font-bold text-slate-900 mb-3">Running the Campaign</h3>
                  <p className="text-sm text-slate-600 mb-3">From the campaign detail page:</p>
                  <ul className="text-sm text-slate-600 list-disc pl-5 space-y-1.5">
                    <li><strong>Run Scrape</strong> — finds leads from GitHub, Dev.to, and LinkedIn matching your ICP description</li>
                    <li><strong>Preview Emails</strong> — generates 3 sample emails so you can review personalisation before sending</li>
                    <li><strong>Run Send</strong> — sends the current sequence step to all due leads up to your daily limit</li>
                    <li><strong>Pause / Resume</strong> — pauses the campaign at any time without losing progress</li>
                  </ul>
                </div>

                <div className="bg-white border border-slate-200 p-6 rounded-2xl">
                  <h3 className="font-bold text-slate-900 mb-3">Sequence Steps</h3>
                  <p className="text-sm text-slate-600 mb-3">Email and LinkedIn steps run in parallel on the same leads. Each step has a delay (in days) from the previous step of the same channel. Step 1 and the first LinkedIn step both fire on day 0.</p>
                  <div className="bg-slate-50 p-4 rounded-xl text-sm">
                    <p className="font-mono text-xs text-slate-500">Email channel: Cold intro → +3 days → Follow-up → +4 days → Breakup</p>
                    <p className="font-mono text-xs text-slate-500 mt-1">LinkedIn channel: Connect request → +0 days → Direct message</p>
                  </div>
                </div>

                <div className="bg-indigo-50 border border-indigo-200 p-5 rounded-2xl">
                  <h4 className="font-black text-slate-900 mb-2">Reply Detection</h4>
                  <p className="text-sm text-slate-700">Ozigi monitors your connected Gmail inbox for replies. When a lead replies, the sequence pauses for that lead automatically and the status updates to "replied" in your campaign dashboard. Requires Gmail connected with <code className="bg-white px-1 rounded text-xs">gmail.readonly</code> permission.</p>
                </div>
              </div>
            </section>

            {/* ── 4. Personas ─────────────────────────────────────────── */}
            <section id="personas" className="scroll-mt-28">
              <h2 className="text-2xl font-black italic uppercase tracking-tighter text-slate-900 border-b-2 border-slate-100 pb-2 mb-6">
                4. Personas
              </h2>
              <p className="text-slate-600 font-medium leading-relaxed mb-6">
                Personas are voice profiles. They're applied to social posts, newsletters, and outbound emails — define once, reuse everywhere. The more specific, the better.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div className="bg-red-50 p-6 rounded-2xl border border-red-100">
                  <span className="text-red-700 font-black uppercase tracking-widest text-xs mb-2 block">❌ Weak</span>
                  <p className="font-mono text-sm text-slate-700 leading-relaxed">"You are a helpful assistant. Write engaging posts about my product updates."</p>
                  <p className="text-xs text-slate-500 mt-2">Tells the AI <em>what</em> to write, not <em>who</em> to be. Produces generic output.</p>
                </div>
                <div className="bg-slate-900 p-6 rounded-2xl">
                  <span className="text-green-400 font-black uppercase tracking-widest text-xs mb-2 block">✅ Strong</span>
                  <p className="font-mono text-sm text-slate-300 leading-relaxed">"Pragmatic technical founder. Direct, occasionally dry. Never uses 'leverage' or 'ecosystem'. Always leads with a specific number or outcome."</p>
                  <p className="text-xs text-slate-400 mt-2">Defines a character. The AI has a voice to adopt consistently.</p>
                </div>
              </div>
              <p className="text-sm text-slate-600">Create personas under <strong>Personas</strong> in the sidebar. Browse the <strong>Persona Marketplace</strong> for pre-built profiles from industry experts — customize any of them to match your voice.</p>
            </section>

            {/* ── 5. Email Setup ──────────────────────────────────────── */}
            <section id="email-setup" className="scroll-mt-28">
              <h2 className="text-2xl font-black italic uppercase tracking-tighter text-slate-900 border-b-2 border-slate-100 pb-2 mb-6">
                5. Email Setup (Gmail / SMTP)
              </h2>
              <p className="text-slate-600 font-medium leading-relaxed mb-5">
                You must connect a sending account before launching any outbound campaign. Go to <strong>Outreach Settings</strong> in the sidebar.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="bg-white border border-slate-200 p-5 rounded-2xl">
                  <h3 className="font-bold text-slate-900 mb-3">Gmail</h3>
                  <ol className="text-sm text-slate-600 list-decimal pl-5 space-y-1.5">
                    <li>Click <strong>Connect Gmail</strong></li>
                    <li>Authorise Ozigi via Google OAuth — grant both send and readonly permissions</li>
                    <li>Your inbox appears in the connected accounts list</li>
                  </ol>
                  <p className="text-xs text-slate-400 mt-3 italic">The readonly permission enables reply detection. If you connected before this was added, disconnect and reconnect to enable it.</p>
                </div>
                <div className="bg-white border border-slate-200 p-5 rounded-2xl">
                  <h3 className="font-bold text-slate-900 mb-3">SMTP (Outlook, Yahoo, custom)</h3>
                  <ol className="text-sm text-slate-600 list-decimal pl-5 space-y-1.5">
                    <li>Click <strong>Connect SMTP</strong></li>
                    <li>Select a preset (Outlook, Yahoo, Zoho Mail, etc.) or enter custom host + port</li>
                    <li>Enter your email, password / app password, and display name</li>
                    <li>Click Connect — Ozigi tests the connection before saving</li>
                  </ol>
                </div>
              </div>
            </section>

            {/* ── 6. CRM Integrations ─────────────────────────────────── */}
            <section id="crm" className="scroll-mt-28">
              <h2 className="text-2xl font-black italic uppercase tracking-tighter text-slate-900 border-b-2 border-slate-100 pb-2 mb-6">
                6. CRM Integrations
              </h2>
              <p className="text-slate-600 font-medium leading-relaxed mb-5">
                Connect your CRM via OAuth — no API keys needed. Leads are synced automatically when first contacted by Ozigi. Go to <strong>Outreach Settings → CRM</strong>.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
                {[
                  { name: "HubSpot",    color: "#ff7a59", note: "OAuth ready — click Connect HubSpot" },
                  { name: "Zoho CRM",   color: "#e42527", note: "Create auth config in Composio dashboard first" },
                  { name: "Salesforce", color: "#00a1e0", note: "Create auth config in Composio dashboard first" },
                ].map(c => (
                  <div key={c.name} className="bg-white border border-slate-200 p-5 rounded-2xl">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="w-3 h-3 rounded-full shrink-0" style={{ background: c.color }} />
                      <h3 className="font-bold text-slate-900">{c.name}</h3>
                    </div>
                    <p className="text-xs text-slate-500">{c.note}</p>
                  </div>
                ))}
              </div>
              <p className="text-sm text-slate-600">CRM sync happens on first contact — when Ozigi sends the first email or LinkedIn message to a lead, the lead is pushed to your connected CRM as a new contact.</p>
            </section>

            {/* ── 7. LinkedIn Setup ───────────────────────────────────── */}
            <section id="linkedin-setup" className="scroll-mt-28">
              <h2 className="text-2xl font-black italic uppercase tracking-tighter text-slate-900 border-b-2 border-slate-100 pb-2 mb-6">
                7. LinkedIn Setup
              </h2>
              <p className="text-slate-600 font-medium leading-relaxed mb-5">
                Ozigi automates LinkedIn outreach by logging into your account and performing actions via a browser worker. Go to <strong>Outreach Settings → LinkedIn</strong>.
              </p>
              <div className="bg-white border border-slate-200 p-6 rounded-2xl mb-4">
                <h3 className="font-bold text-slate-900 mb-3">Connecting LinkedIn</h3>
                <ol className="text-sm text-slate-600 list-decimal pl-5 space-y-2">
                  <li>Enter your LinkedIn email and password and click <strong>Connect LinkedIn</strong></li>
                  <li>The worker logs in on your behalf — this may take up to a minute</li>
                  <li>If LinkedIn sends a verification code, enter it in the 2FA prompt that appears on the page</li>
                  <li>If LinkedIn sends a push notification to your phone, approve it in the LinkedIn app</li>
                  <li>Once connected, the status shows <strong>Active</strong></li>
                </ol>
              </div>
              <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl text-sm text-amber-800">
                <strong>Note:</strong> Your credentials are encrypted at rest and never shared. LinkedIn sessions can expire — reconnect from Outreach Settings if the status shows Expired.
              </div>
            </section>

            {/* ── 8. Newsletter Subscribers ───────────────────────────── */}
            <section id="subscribers" className="scroll-mt-28">
              <h2 className="text-2xl font-black italic uppercase tracking-tighter text-slate-900 border-b-2 border-slate-100 pb-2 mb-6">
                8. Newsletter Subscribers
              </h2>
              <p className="text-slate-600 font-medium leading-relaxed mb-5">
                Manage your newsletter list from <strong>Subscribers</strong> in the sidebar.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="bg-white border border-slate-200 p-5 rounded-2xl">
                  <h3 className="font-bold text-slate-900 mb-2">Adding Subscribers</h3>
                  <ul className="text-sm text-slate-600 space-y-1.5">
                    <li>• <strong>Manual:</strong> Paste emails (one per line)</li>
                    <li>• <strong>CSV upload:</strong> One email per row</li>
                    <li>• <strong>Public form:</strong> Share your subscriber link</li>
                  </ul>
                </div>
                <div className="bg-white border border-slate-200 p-5 rounded-2xl">
                  <h3 className="font-bold text-slate-900 mb-2">Sending</h3>
                  <ul className="text-sm text-slate-600 space-y-1.5">
                    <li>• Generate a newsletter in the Newsletter view</li>
                    <li>• Click Schedule and pick a send time</li>
                    <li>• Sends to all active subscribers</li>
                    <li>• Unsubscribe link included automatically</li>
                  </ul>
                </div>
              </div>
            </section>

            {/* ── 9. Social Publishing ────────────────────────────────── */}
            <section id="publishing" className="scroll-mt-28">
              <h2 className="text-2xl font-black italic uppercase tracking-tighter text-slate-900 border-b-2 border-slate-100 pb-2 mb-6">
                9. Social Publishing
              </h2>
              <p className="text-slate-600 font-medium leading-relaxed mb-5">
                Every platform uses a different publishing method. Connect integrations in <strong>Settings & Integrations</strong>.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { platform: "X (Twitter)",  method: "Web Intent — opens pre-filled compose window in a new tab. You review and post." },
                  { platform: "LinkedIn",     method: "Direct OAuth — authorise once, posts go directly from Ozigi." },
                  { platform: "Discord",      method: "Webhook — paste your server webhook URL in Settings." },
                  { platform: "Slack",        method: "Webhook — paste your incoming webhook URL in Settings." },
                ].map(p => (
                  <div key={p.platform} className="bg-white border border-slate-200 p-4 rounded-2xl">
                    <h3 className="font-bold text-slate-900 text-sm mb-1">{p.platform}</h3>
                    <p className="text-xs text-slate-500">{p.method}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* ── 10. Blog Post ───────────────────────────────────────── */}
            <section id="blog" className="scroll-mt-28">
              <h2 className="text-2xl font-black italic uppercase tracking-tighter text-slate-900 border-b-2 border-slate-100 pb-2 mb-6">
                10. Blog Post Generation
              </h2>
              <p className="text-slate-600 font-medium leading-relaxed mb-5">
                Available on Organization and Enterprise plans. Generates long-form articles (500–8,000 words) from any source material.
              </p>
              <div className="bg-slate-900 text-white p-5 rounded-2xl mb-5">
                <ul className="text-sm text-slate-300 space-y-1.5">
                  <li>• Choose length, tone (professional / casual / technical), and structure (narrative / listicle / how-to)</li>
                  <li>• Powered by Claude Opus — deeper reasoning for long-form</li>
                  <li>• Each section is independently editable and copyable</li>
                  <li>• Organization plan: 5 articles per 24 hours · Enterprise: unlimited</li>
                </ul>
              </div>
              <p className="text-sm text-slate-500">Access via <strong>Blog Post</strong> in the sidebar. If you're on the Free or Team plan, the sidebar item prompts you to upgrade.</p>
            </section>

            {/* ── 11. Troubleshooting ─────────────────────────────────── */}
            <section id="troubleshooting" className="scroll-mt-28">
              <h2 className="text-2xl font-black italic uppercase tracking-tighter text-slate-900 border-b-2 border-slate-100 pb-2 mb-6">
                11. Troubleshooting
              </h2>
              <div className="space-y-4">
                {[
                  {
                    q: "Campaign creation fails when analysing URL",
                    a: "The URL must be publicly accessible — no login walls or paywalls. If analysis fails, fill in the fields manually and skip the auto-fill step."
                  },
                  {
                    q: "Emails aren't sending",
                    a: "Check Outreach Settings — your sending account must be connected and active. If the daily send count is at your limit, sends resume the following day."
                  },
                  {
                    q: "LinkedIn status shows 'Expired'",
                    a: "Sessions expire periodically. Go to Outreach Settings → LinkedIn, disconnect, and reconnect. The login flow will re-establish the session."
                  },
                  {
                    q: "Reply detection isn't working",
                    a: "This requires Gmail connected with the gmail.readonly permission. If you connected Gmail before reply detection was added, disconnect and reconnect from Outreach Settings."
                  },
                  {
                    q: "Generated content sounds generic",
                    a: "This is almost always a persona issue. A vague persona produces vague output. Edit your persona to be more specific — define your voice, what you'd never say, and what you always lead with."
                  },
                  {
                    q: "CRM OAuth flow fails",
                    a: "HubSpot works out of the box. For Zoho CRM and Salesforce, you must create an OAuth 2.0 auth config in your Composio dashboard (app.composio.dev) before the flow will work."
                  },
                  {
                    q: "Discord / Slack posts aren't appearing",
                    a: "Verify the webhook URL in Settings → Integrations is correct and active. Check your Discord server's Integrations → Webhooks or your Slack app settings to confirm it hasn't been revoked."
                  },
                ].map(({ q, a }) => (
                  <div key={q} className="bg-white border border-slate-200 p-5 rounded-2xl">
                    <h3 className="font-bold text-slate-900 mb-2 text-sm">{q}</h3>
                    <p className="text-sm text-slate-600">{a}</p>
                  </div>
                ))}
              </div>

              <div className="mt-8 bg-slate-900 rounded-2xl p-6 text-center">
                <p className="text-white font-medium mb-2">Still stuck?</p>
                <p className="text-slate-400 text-sm mb-4">Email us with your account email and a description of the issue.</p>
                <a href="mailto:hello@ozigi.app"
                  className="inline-flex items-center gap-2 bg-brand-red text-white px-5 py-2.5 rounded-full text-sm font-black uppercase tracking-widest hover:bg-red-700 transition-colors">
                  hello@ozigi.app →
                </a>
              </div>
            </section>

          </div>
        </main>
      </div>

      <Footer />
    </div>
  );
}
