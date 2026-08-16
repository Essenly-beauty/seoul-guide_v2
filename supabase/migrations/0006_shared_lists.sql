-- Shared favorite lists (user request 2026-08-16): a member snapshots
-- their saved places into a link anyone can open on the map — the
-- Kakao/Naver "shared folder" pattern. Snapshot, not live view: the
-- recipient sees what was shared, later edits to the sharer's hearts
-- stay private.

create table if not exists public.shared_lists (
  id         uuid        primary key default gen_random_uuid(),
  owner      uuid        not null references auth.users (id) on delete cascade,
  title      text        not null check (char_length(title) between 1 and 80),
  place_ids  text[]      not null check (array_length(place_ids, 1) between 1 and 300),
  created_at timestamptz not null default now()
);

alter table public.shared_lists enable row level security;

-- The link IS the capability: ids are unguessable uuids, so public
-- select-by-id is the sharing mechanism (like an unlisted URL).
drop policy if exists "shared_lists_select_any" on public.shared_lists;
create policy "shared_lists_select_any"
  on public.shared_lists for select
  to anon, authenticated
  using (true);

drop policy if exists "shared_lists_insert_own" on public.shared_lists;
create policy "shared_lists_insert_own"
  on public.shared_lists for insert
  to authenticated
  with check (owner = auth.uid());

drop policy if exists "shared_lists_delete_own" on public.shared_lists;
create policy "shared_lists_delete_own"
  on public.shared_lists for delete
  to authenticated
  using (owner = auth.uid());

-- snapshots are immutable — no update policy
