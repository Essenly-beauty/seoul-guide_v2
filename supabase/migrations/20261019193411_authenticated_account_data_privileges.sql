-- Early account tables relied on environment-specific default ACLs. Explicitly
-- grant only operations covered by their existing auth.uid() ownership policies.
-- This makes fresh local/deployed databases support profile, saved items and the
-- account export (which now also contains the customer's bookings).
revoke all on public.favorites, public.profiles from public, anon, authenticated;
grant select, insert, delete on public.favorites to authenticated;
grant select, insert, update on public.profiles to authenticated;
