-- Client-side error inbox — self-hosted error tracking (no external vendor).
-- Browsers insert, nobody reads through the public API; the team queries
-- with the service role (see docs/runbook.md).

create table if not exists public.client_errors (
  id         uuid        primary key default gen_random_uuid(),
  kind       text        not null check (kind in ('error', 'unhandledrejection', 'boundary')),
  message    text        not null check (char_length(message) between 1 and 500),
  stack      text        check (stack is null or char_length(stack) <= 4000),
  page       text        not null check (char_length(page) <= 300),
  user_agent text        check (user_agent is null or char_length(user_agent) <= 300),
  release    text        check (release is null or char_length(release) <= 64),
  user_id    uuid        references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.client_errors enable row level security;

drop policy if exists "client_errors_insert_any" on public.client_errors;
create policy "client_errors_insert_any"
  on public.client_errors for insert
  to anon, authenticated
  with check (user_id is null or user_id = auth.uid());

-- no select/update/delete policies: write-only via the public API

create index if not exists client_errors_created_idx on public.client_errors (created_at desc);
