-- V6 (ro-sql.cjs, read-only): authenticated still reaches the private function and stops at AUTH_REQUIRED.
-- Pass: check-results.cjs ok <out> --expect-error V6.partner-profile=P0001:AUTH_REQUIRED
-- Reading a 42501 by its message:
--   "permission denied to set role"        -> this verification path does not work here (not caused by the migration)
--   "permission denied for function"       -> EXECUTE regression on partner_store_profile
--   "permission denied for table users"    -> the SECURITY DEFINER owner cannot read auth.users (pre-existing if the C1 baseline shows it)

-- @V6.claim
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000000', true) is not null as ok

-- @V6.set-role
set local role authenticated

-- @V6.partner-profile
select public.partner_store_profile()
