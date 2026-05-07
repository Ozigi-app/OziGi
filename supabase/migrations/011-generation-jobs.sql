-- Async generation jobs table.
-- /api/generate inserts a row and returns the id immediately.
-- The QStash worker (/api/qstash/generate) does the heavy Gemini work and
-- writes the result back here. The frontend polls /api/generate/status to
-- pick up the result without blocking a Vercel function for 60s.
--
-- user_id is nullable to support unauthenticated demo requests.
-- Authenticated jobs reference auth.users; demo jobs have user_id = null.

create table if not exists public.generation_jobs (
  id            uuid        primary key default gen_random_uuid(),
  user_id       uuid        references auth.users(id) on delete cascade,
  status        text        not null default 'pending'
                            check (status in ('pending', 'processing', 'done', 'error')),
  payload       jsonb       not null,
  result        jsonb,
  error_message text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Authenticated users may read/insert their own jobs.
-- Demo jobs (user_id IS NULL) are accessible only via the service role key.
alter table public.generation_jobs enable row level security;

create policy "users can read own generation jobs"
  on public.generation_jobs for select
  using (auth.uid() = user_id);

create policy "users can insert own generation jobs"
  on public.generation_jobs for insert
  with check (auth.uid() = user_id);

-- Fast lookup for status polling and cleanup
create index if not exists generation_jobs_user_status
  on public.generation_jobs (user_id, status);

create index if not exists generation_jobs_created_at
  on public.generation_jobs (created_at);
