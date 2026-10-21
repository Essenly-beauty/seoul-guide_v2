-- V5 smoke (ro-sql.cjs, read-only). Run with --set phase=pre (C1 and D0 baseline) or --set phase=post (C4 and E1).
-- Kept apart from V1-V4 so that a failed SET ROLE cannot cost the catalog checks; ro-sql stops at the first error
-- and never runs the anon call as postgres.

-- @V5.null-json
select (j -> 'showPhotos') as show_photos, (select count(*)::int from jsonb_object_keys(j)) as n_keys,
       case current_setting('myseouldrop.phase', true)
         when 'pre' then not (j ? 'showPhotos') and (select count(*) from jsonb_object_keys(j)) = 10
         when 'post' then (j -> 'showPhotos') = 'true'::jsonb and (select count(*) from jsonb_object_keys(j)) = 11
       end as ok
from (select private.store_profile_json(null::public.merchants, null::public.merchant_store_profiles) as j) s

-- @V5.null-quote
select q ~ '^[0-9a-f]{32}$' as ok
from (select private.booking_quote(null::public.merchant_services, null::public.merchant_categories, null::public.merchants,
                                    null::public.merchant_booking_settings) as q) s

-- @V5.set-role
set local role anon

-- @V5.anon-public-profile
select v, v = '{"status": "unpublished", "placeId": "ct-more-on-hair-seongsu-branch"}'::jsonb as ok
from (select public.public_store_profile('ct-more-on-hair-seongsu-branch') as v) s

-- @V5.reset-role
reset role
