-- Public traveler reviews (backlog: 리뷰 공개 전환) — consent-first.
-- Terms already promised "visible only to you … with your consent", so
-- nothing existing flips public: is_public defaults false and only the
-- composer's explicit "Post publicly" choice sets it. Moderation is
-- post-hoc: per-user reports, auto-hide at 3 distinct reporters, team
-- review via the service role.

alter table public.ratings
  add column if not exists id uuid not null default gen_random_uuid();

do $$ begin
  alter table public.ratings add constraint ratings_id_key unique (id);
exception when duplicate_table or duplicate_object then null; end $$;

alter table public.ratings
  add column if not exists is_public boolean not null default false;

alter table public.ratings
  add column if not exists hidden boolean not null default false;

create index if not exists ratings_public_place_idx
  on public.ratings (place_id, created_at desc)
  where is_public and not hidden;

-- ── Reports (write-only through the API) ─────────────────────
create table if not exists public.review_reports (
  id         uuid        primary key default gen_random_uuid(),
  rating_id  uuid        not null references public.ratings (id) on delete cascade,
  reporter   uuid        not null references auth.users (id) on delete cascade,
  reason     text        not null check (reason in ('spam', 'offensive', 'off_topic', 'other')),
  created_at timestamptz not null default now(),
  unique (rating_id, reporter)
);

alter table public.review_reports enable row level security;

drop policy if exists "review_reports_insert_own" on public.review_reports;
create policy "review_reports_insert_own"
  on public.review_reports for insert
  to authenticated
  with check (reporter = auth.uid());
-- no select/update/delete: the team triages with the service role

-- Auto-hide after 3 distinct reporters — abuse response shouldn't wait
-- for a human. Definer so the update crosses the reporter's RLS.
create or replace function public.auto_hide_reported_review()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select count(distinct reporter) from public.review_reports where rating_id = new.rating_id) >= 3 then
    update public.ratings set hidden = true where id = new.rating_id;
  end if;
  return new;
end $$;

drop trigger if exists review_reports_auto_hide on public.review_reports;
create trigger review_reports_auto_hide
  after insert on public.review_reports
  for each row execute function public.auto_hide_reported_review();

-- ── Masked public read model ─────────────────────────────────
-- Owner-rights view (intentionally crosses RLS) exposing ONLY safe fields:
-- no user ids, first name only. `mine` lets the client skip the Report
-- action on the viewer's own rows.
create or replace view public.public_reviews as
  select
    r.id,
    r.place_id,
    r.rating,
    r.body,
    r.updated_at,
    coalesce(nullif(split_part(u.raw_user_meta_data ->> 'full_name', ' ', 1), ''), 'Member') as display_name,
    coalesce(r.user_id = auth.uid(), false) as mine
  from public.ratings r
  join auth.users u on u.id = r.user_id
  where r.is_public
    and not r.hidden
    and r.body is not null
    and btrim(r.body) <> '';

revoke all on public.public_reviews from public;
grant select on public.public_reviews to anon, authenticated;
