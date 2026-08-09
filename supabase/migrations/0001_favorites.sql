-- Per-user favorites (places / products / articles).
-- RLS: every operation is scoped to the signed-in user; the anon key can
-- touch nothing without a session.

create table if not exists public.favorites (
  user_id    uuid        not null references auth.users (id) on delete cascade,
  kind       text        not null check (kind in ('place', 'product', 'article')),
  item_id    text        not null check (char_length(item_id) between 1 and 128),
  created_at timestamptz not null default now(),
  primary key (user_id, kind, item_id)
);

alter table public.favorites enable row level security;

drop policy if exists "favorites_select_own" on public.favorites;
create policy "favorites_select_own"
  on public.favorites for select
  using (auth.uid() = user_id);

drop policy if exists "favorites_insert_own" on public.favorites;
create policy "favorites_insert_own"
  on public.favorites for insert
  with check (auth.uid() = user_id);

drop policy if exists "favorites_delete_own" on public.favorites;
create policy "favorites_delete_own"
  on public.favorites for delete
  using (auth.uid() = user_id);

create index if not exists favorites_user_kind_idx
  on public.favorites (user_id, kind);
