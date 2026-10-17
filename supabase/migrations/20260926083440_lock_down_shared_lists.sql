-- Shared links now require a signed-in recipient and an exact UUID through
-- /api/shared-lists/[id]. Direct browser SELECT is owner-only for link
-- management. Existing rows/IDs, insert, and delete policies are preserved.

alter table public.shared_lists enable row level security;

revoke all on table public.shared_lists from anon, authenticated;
grant select, insert, delete on table public.shared_lists to authenticated;

drop policy if exists "shared_lists_select_any" on public.shared_lists;
drop policy if exists "shared_lists_select_own" on public.shared_lists;
create policy "shared_lists_select_own"
  on public.shared_lists for select
  to authenticated
  using ((select auth.uid()) = owner);
