-- Real-user Core Web Vitals (field data, judged at p75 per web.dev) — the
-- Lighthouse lab score said nothing about roaming travellers on iOS Safari.
-- Browsers beacon to /api/vitals, which validates (lib/web-vitals-payload.ts)
-- and inserts with the anon key; nobody reads through the public API — the
-- team queries with the service role (see docs/runbook.md).

create table if not exists public.web_vitals (
  id              bigint generated always as identity primary key,
  name            text             not null check (name in ('LCP', 'INP', 'CLS', 'FCP', 'TTFB')),
  value           double precision not null check (value >= 0 and value <= 600000),
  rating          text             not null check (rating in ('good', 'needs-improvement', 'poor')),
  metric_id       text             not null check (char_length(metric_id) <= 64),
  navigation_type text             check (navigation_type is null or char_length(navigation_type) <= 32),
  page            text             not null check (char_length(page) <= 300),
  target          text             check (target is null or char_length(target) <= 200),
  user_agent      text             check (user_agent is null or char_length(user_agent) <= 300),
  release         text             check (release is null or char_length(release) <= 64),
  created_at      timestamptz      not null default now()
);

alter table public.web_vitals enable row level security;

drop policy if exists "web_vitals_insert_any" on public.web_vitals;
create policy "web_vitals_insert_any"
  on public.web_vitals for insert
  to anon, authenticated
  with check (true);

-- no select/update/delete policies: write-only via the public API

create index if not exists web_vitals_created_idx on public.web_vitals (created_at desc);
create index if not exists web_vitals_name_page_idx on public.web_vitals (name, page, created_at desc);
