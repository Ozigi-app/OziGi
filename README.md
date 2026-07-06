# ⚡ Ozigi — AI GTM Suite for Technical Teams

**Source leads, run outreach, and publish content that sounds like you — not like a chatbot. One tool, one voice, one pipeline.**

→ **[Try it live at ozigi.app](https://ozigi.app)**

![Ozigi Hero](https://ozigi.app/og-image.png)

---

## What is Ozigi?

Ozigi is a go-to-market engine for founders, DevRel teams, and small technical teams. It handles the four jobs that fill pipeline: finding the right people, qualifying them against your ICP, reaching them with outreach that sounds human, and publishing the content that warms the market before the ask lands.

The two engines share one brain. The same persona voice that writes your LinkedIn sequence also writes your blog post. The same Banned Lexicon that keeps your cold email off the spam filter keeps your newsletter from sounding like it was generated. You define your voice once; it applies everywhere.

---

## The Two Engines

### GTM Engine

**Lead sourcing**
Source leads directly from GitHub, Dev.to, and LinkedIn based on an ICP you define once. For GitHub, the engine runs a bio-keyword + language + location query against the GitHub user search API and extracts matching profiles. When a profile hides its email, the engine recovers a real address from the user's public commit history. For Dev.to, it pulls authors by tag. For LinkedIn, it searches against your own session.

**ICP scoring**
Every sourced lead is scored by Gemini against your ICP on a 0.0–1.0 scale. Only leads above your threshold enter the sequence. This keeps your sending lists clean and your reply rates high without manual filtering.

**Email + LinkedIn sequences**
Campaigns run multi-step sequences from your own accounts with delays you control. Per-channel daily limits protect your domain reputation and LinkedIn standing. Reply detection pauses a sequence the moment someone responds on either channel. CRM sync (HubSpot, Zoho via Composio OAuth; Swipe One via API key) pushes leads on first contact.

### Content Engine

Drop in a URL, paste raw notes, or upload a PDF or image. Ozigi extracts the core narrative and returns polished, platform-specific drafts for X (Twitter), LinkedIn, Discord, Slack, and email newsletters — all in your voice, with the Banned Lexicon applied.

Generate full blog posts, tutorials, and technical documentation in MDX-ready format from the long-form module. Write, schedule, and send email newsletters directly from the dashboard. Manage your subscriber list and track delivery.

---

## Core Systems

### The Banned Lexicon
The single most important reason Ozigi doesn't sound like AI. A hard-coded blocklist enforced at the API route level — not filtered after generation, blocked *during* it. No "delve", no "robust", no "seamlessly", no "tapestry", no "game-changing". The model is penalised for AI-speak vocabulary, which forces every sentence to be constructed from your actual content. Applied identically to cold email, blog posts, LinkedIn posts, and newsletter copy.

### System Personas
Define who is writing — role, tone, beliefs, things they would never say — and save it once. Every campaign generation, every outreach step, and every content piece applies that persona automatically. One setup, consistent voice forever, across both engines.

### Gemini 3.1 Flash Image Generation
Generate platform-aware graphics directly inside the engine. Blank field = abstract background matched to the post topic. Add a graphic title = rendered text graphic with clean typography. Generated images upload server-side to Cloudflare R2 storage and return a public CDN URL — no browser CORS issues, no extra pipeline.

### Human-in-the-Loop (HITL)
Ozigi handles the 90% — extraction, structure, constraints, platform formatting. You own the 10% — the specific detail, the insider context, the judgment call only a human can make. Every generated campaign includes an Edit step before it goes anywhere.

### Ozigi Copilot
A context-aware AI assistant built into the dashboard. Copilot has access to your current campaign context, your personas, and optionally the web. It handles ideation, draft refinement, outreach critique, and persona development.

---

## Pricing

| Plan | Price | What it covers |
|---|---|---|
| **Free** | $0, no card | 50 lead credits/mo · 1 campaign · 30 email sends · 3 content pieces · 1 persona |
| **Starter** | $19/mo | Full content engine · 30 campaigns · image gen · newsletter sending · scheduling |
| **Growth** | $29/mo | GTM only · 1,000 credits/mo · unlimited sends · LinkedIn · CRM sync |
| **Pro** | $49/mo | Both engines, no limits · Copilot · long-form · analytics |
| **Enterprise** | Custom | Custom volume · SLA · white-label · dedicated onboarding |

**Credit bundles** (for Starter users who need outbound without upgrading): 200 credits for $5 · 500 for $10 · 1,500 for $25. Credits stack and never expire.

Payments are processed by **Dodo Payments**. Subscriptions and bundles both go through the Dodo checkout API. The dashboard fires a Google Ads conversion event on successful subscription (`?checkout=success`) and credit bundle (`?checkout=credits`) returns.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js (App Router), React, Tailwind CSS |
| Backend | Next.js Route Handlers, Vercel Serverless |
| AI — Text | Google Cloud Vertex AI (Gemini 3.1 Flash) |
| AI — Image | Gemini 3.1 Flash Image via Vertex AI |
| Database & Auth | Supabase (PostgreSQL + Auth) |
| Object Storage | Cloudflare R2 |
| Rate Limiting & Scheduling | Upstash Redis + QStash |
| Payments | Dodo Payments |
| CRM Integration | Composio (HubSpot · Zoho) · Swipe One (API key) |
| Analytics | Vercel Analytics · Google Ads (AW tag) · Ahrefs · Ghostly |
| Email | ZeptoMail |
| Testing | Playwright |

---

## Local Development

Requires Node.js v18+ and `pnpm`.

```bash
# Clone the repo
git clone https://github.com/Ozigi-app/OziGi.git
cd OziGi

# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env.local
# Fill in credentials (see below)

# Start the main app
pnpm dev

# Start the blog (separate Next.js app)
cd apps/blog && pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) for the main app, [http://localhost:3001](http://localhost:3001) for the blog.

### Required Environment Variables

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Google Cloud / Vertex AI (text + image generation)
GOOGLE_CLOUD_PROJECT_ID=
GOOGLE_CLOUD_CLIENT_EMAIL=
GOOGLE_CLOUD_PRIVATE_KEY=

# Cloudflare R2 (image storage)
R2_ENDPOINT=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=
NEXT_PUBLIC_R2_DOMAIN=

# Upstash — rate limiting (Redis) + scheduled posts (QStash)
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
QSTASH_TOKEN=
QSTASH_CURRENT_SIGNING_KEY=
QSTASH_NEXT_SIGNING_KEY=

# Dodo Payments
DODO_API_KEY=

# Composio — CRM + GitHub OAuth
COMPOSIO_API_KEY=
COMPOSIO_GITHUB_AUTH_CONFIG_ID=

# App URL (used in checkout return URLs)
NEXT_PUBLIC_APP_URL=

# Google Ads
NEXT_PUBLIC_GTAG_ID=
```

---

## Architecture

The architecture page at [ozigi.app/architecture](https://ozigi.app/architecture) covers the four live decisions that shaped the engine: LLM selection and why Gemini Flash beats Claude for this pipeline, JSON schema enforcement, the GTM sourcing and scoring architecture, and how the image generation pipeline routes through R2.

---

## Contributing

Open an issue or submit a PR. The roadmap is public. Vibe-coded contributions are explicitly welcome — bring your instincts, run the tests, and ship the fix. See [CONTRIBUTING.md](./CONTRIBUTING.md) for the full guidelines.

---

## Built by

**Dumebi Okolo** — Founder and CEO of Ozigi  
[X / Twitter](https://x.com/DumebiTheWriter) · [LinkedIn](https://linkedin.com/in/dumebi-okolo) · [DEV.to](https://dev.to/dumebii)
