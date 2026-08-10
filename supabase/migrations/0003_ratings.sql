-- Per-user place ratings (the "Been here? Rate your visit" stars).
-- One row per (user, place); `body` is reserved for full text reviews so the
-- write-review feature can land later without another migration.

create table if not exists public.ratings (
  user_id    uuid        not null references auth.users (id) on delete cascade,
  place_id   text        not null check (char_length(place_id) between 1 and 128),
  rating     smallint    not null check (rating between 1 and 5),
  body       text        check (body is null or char_length(body) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, place_id)
);

alter table public.ratings enable row level security;

drop policy if exists "ratings_select_own" on public.ratings;
create policy "ratings_select_own"
  on public.ratings for select
  using (auth.uid() = user_id);

drop policy if exists "ratings_insert_own" on public.ratings;
create policy "ratings_insert_own"
  on public.ratings for insert
  with check (auth.uid() = user_id);

drop policy if exists "ratings_update_own" on public.ratings;
create policy "ratings_update_own"
  on public.ratings for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "ratings_delete_own" on public.ratings;
create policy "ratings_delete_own"
  on public.ratings for delete
  using (auth.uid() = user_id);

-- touch_updated_at() ships with 0002_profiles.sql
drop trigger if exists ratings_touch on public.ratings;
create trigger ratings_touch
  before update on public.ratings
  for each row execute function public.touch_updated_at();

create index if not exists ratings_user_idx on public.ratings (user_id);
