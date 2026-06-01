-- GTM outreach pipeline schema
-- Tables: campaigns, leads, sequence_sends, email_accounts, linkedin_sessions, linkedin_queue

-- ─── campaigns ───────────────────────────────────────────────────────────────
create table if not exists public.campaigns (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  name                text not null,
  icp_description     text not null,                 -- raw natural-language input
  icp_config          jsonb not null default '{}',   -- Gemini-extracted: job_titles[], industries[], company_sizes[], keywords[]
  sources             text[] not null default '{}',  -- ['github','devto','linkedin']
  daily_email_limit   int not null default 40,
  daily_linkedin_limit int not null default 20,
  -- sequence_steps: [{step: 1, channel: 'email', delay_days: 0}, {step: 2, channel: 'email', delay_days: 3}, ...]
  sequence_steps      jsonb not null default '[]',
  status              text not null default 'active' check (status in ('active','paused','completed','draft')),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- ─── leads ───────────────────────────────────────────────────────────────────
create table if not exists public.leads (
  id                  uuid primary key default gen_random_uuid(),
  campaign_id         uuid not null references public.campaigns(id) on delete cascade,
  user_id             uuid not null references auth.users(id) on delete cascade,
  source              text not null check (source in ('github','devto','linkedin','manual')),
  source_id           text not null,                 -- their ID on the source platform
  name                text,
  email               text,
  github_username     text,
  linkedin_url        text,
  linkedin_profile_id text,
  twitter_handle      text,
  bio                 text,
  company             text,
  location            text,
  tags                text[] default '{}',
  icp_match_score     float check (icp_match_score between 0 and 1),
  status              text not null default 'pending'
    check (status in ('pending','contacted','replied','bounced','opted_out','not_qualified')),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (campaign_id, source, source_id)            -- deduplication
);

-- ─── sequence_sends ──────────────────────────────────────────────────────────
create table if not exists public.sequence_sends (
  id          uuid primary key default gen_random_uuid(),
  lead_id     uuid not null references public.leads(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  step        int not null,
  channel     text not null check (channel in ('email','linkedin')),
  subject     text,                                  -- email only
  body        text,
  status      text not null default 'queued'
    check (status in ('queued','sent','failed','opened','clicked','replied')),
  sent_at     timestamptz,
  opened_at   timestamptz,
  replied_at  timestamptz,
  error       text,
  created_at  timestamptz not null default now(),
  -- one send per lead per step per channel
  unique (lead_id, step, channel)
);

-- ─── email_accounts ──────────────────────────────────────────────────────────
create table if not exists public.email_accounts (
  id                      uuid primary key default gen_random_uuid(),
  user_id                 uuid not null references auth.users(id) on delete cascade,
  provider                text not null check (provider in ('gmail','smtp','zoho')),
  email_address           text not null,
  display_name            text,
  -- SMTP fields (provider = 'smtp' or 'zoho')
  smtp_host               text,
  smtp_port               int,
  smtp_username           text,
  smtp_password_enc       text,                      -- AES-256 encrypted at app layer
  -- OAuth fields (provider = 'gmail')
  oauth_refresh_token_enc text,
  oauth_access_token_enc  text,
  oauth_token_expires_at  timestamptz,
  is_active               bool not null default true,
  daily_send_count        int not null default 0,
  last_send_date          date,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  unique (user_id, email_address)
);

-- ─── linkedin_sessions ───────────────────────────────────────────────────────
-- Stores Playwright cookie state for the persistent LinkedIn worker
create table if not exists public.linkedin_sessions (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  linkedin_email   text not null,
  session_cookies  text,                             -- encrypted JSON (Playwright cookie array)
  status           text not null default 'needs_login'
    check (status in ('active','expired','needs_login')),
  last_used_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (user_id, linkedin_email)
);

-- ─── linkedin_queue ──────────────────────────────────────────────────────────
-- Vercel Cron enqueues actions here; the persistent worker polls and executes them
create table if not exists public.linkedin_queue (
  id           uuid primary key default gen_random_uuid(),
  lead_id      uuid not null references public.leads(id) on delete cascade,
  campaign_id  uuid not null references public.campaigns(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  action       text not null check (action in ('connect','message','follow_up')),
  message      text,
  status       text not null default 'queued'
    check (status in ('queued','in_progress','done','failed','skipped')),
  attempts     int not null default 0,
  scheduled_at timestamptz not null default now(),
  processed_at timestamptz,
  error        text,
  created_at   timestamptz not null default now()
);

-- ─── indexes ─────────────────────────────────────────────────────────────────
create index if not exists idx_campaigns_user on public.campaigns(user_id);
create index if not exists idx_leads_campaign on public.leads(campaign_id);
create index if not exists idx_leads_status on public.leads(status);
create index if not exists idx_leads_email on public.leads(email) where email is not null;
create index if not exists idx_sequence_sends_lead on public.sequence_sends(lead_id);
create index if not exists idx_sequence_sends_campaign on public.sequence_sends(campaign_id);
create index if not exists idx_sequence_sends_status on public.sequence_sends(status);
create index if not exists idx_linkedin_queue_status on public.linkedin_queue(status, scheduled_at);
create index if not exists idx_linkedin_queue_user on public.linkedin_queue(user_id);

-- ─── updated_at triggers ─────────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_campaigns_updated_at
  before update on public.campaigns
  for each row execute function public.set_updated_at();

create trigger trg_leads_updated_at
  before update on public.leads
  for each row execute function public.set_updated_at();

create trigger trg_email_accounts_updated_at
  before update on public.email_accounts
  for each row execute function public.set_updated_at();

create trigger trg_linkedin_sessions_updated_at
  before update on public.linkedin_sessions
  for each row execute function public.set_updated_at();

-- ─── Row-Level Security ───────────────────────────────────────────────────────
alter table public.campaigns enable row level security;
alter table public.leads enable row level security;
alter table public.sequence_sends enable row level security;
alter table public.email_accounts enable row level security;
alter table public.linkedin_sessions enable row level security;
alter table public.linkedin_queue enable row level security;

-- campaigns: users see only their own
create policy "campaigns: owner access"
  on public.campaigns for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- leads: scoped to campaign owner
create policy "leads: owner access"
  on public.leads for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- sequence_sends: scoped to owner
create policy "sequence_sends: owner access"
  on public.sequence_sends for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- email_accounts: owner only
create policy "email_accounts: owner access"
  on public.email_accounts for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- linkedin_sessions: owner only
create policy "linkedin_sessions: owner access"
  on public.linkedin_sessions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- linkedin_queue: owner only (worker uses service role, bypasses RLS)
create policy "linkedin_queue: owner access"
  on public.linkedin_queue for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
