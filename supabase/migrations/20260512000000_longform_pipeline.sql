-- Longform pipeline tables (Stage 1-4 storage)
-- Run in Supabase SQL editor or via supabase db push

-- Stage 1: PLAN
create table if not exists public.longform_plans (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  post_id      uuid references public.scheduled_posts(id) on delete set null,
  outline      jsonb not null default '[]',
  claim_ledger jsonb not null default '[]',
  source_budget jsonb not null default '[]',
  created_at   timestamptz not null default now()
);

create index if not exists longform_plans_user_id_idx on public.longform_plans(user_id);
create index if not exists longform_plans_post_id_idx on public.longform_plans(post_id);

-- Stage 4: AUDIT
create table if not exists public.longform_audits (
  id                     uuid primary key default gen_random_uuid(),
  post_id                uuid not null references public.scheduled_posts(id) on delete cascade,
  plan_id                uuid references public.longform_plans(id) on delete set null,
  flags                  jsonb not null default '[]',
  dead_link_rate         numeric(5,3) not null default 0,
  link_audit_passed      boolean not null default true,
  citation_audit_passed  boolean not null default true,
  code_audit_passed      boolean not null default true,
  prose_audit_score      jsonb not null default '{}',
  authority_audit_passed boolean not null default true,
  created_at             timestamptz not null default now()
);

create unique index if not exists longform_audits_post_id_idx on public.longform_audits(post_id);

-- RLS: users can only read their own plans and audits (via post ownership)
alter table public.longform_plans enable row level security;
alter table public.longform_audits enable row level security;

create policy "Users can view own plans"
  on public.longform_plans for select
  using (auth.uid() = user_id);

create policy "Service role manages plans"
  on public.longform_plans for all
  using (true)
  with check (true);

create policy "Users can view own audits"
  on public.longform_audits for select
  using (
    exists (
      select 1 from public.scheduled_posts sp
      where sp.id = post_id and sp.user_id = auth.uid()
    )
  );

create policy "Service role manages audits"
  on public.longform_audits for all
  using (true)
  with check (true);
