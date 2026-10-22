-- Read-only: full definitions, owner and ACL of the three functions the migration replaces (ro-sql.cjs).
-- C2 keeps the production copy; after any rollback, `check-results.cjs same <C2 copy> <new copy> defs` must pass.

-- @defs
select p.oid::regprocedure::text as fn, pg_get_userbyid(p.proowner)::text as owner,
       array(select a::text from unnest(p.proacl) a order by a::text collate "C") as acl,
       pg_get_functiondef(p.oid) as def
from pg_proc p
where p.oid = any ('{"private.store_profile_json(public.merchants,public.merchant_store_profiles)","private.partner_store_profile(text,timestamptz,jsonb,uuid)","private.booking_quote(public.merchant_services,public.merchant_categories,public.merchants,public.merchant_booking_settings)"}'::regprocedure[])
order by 1
