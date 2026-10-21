-- Monitoring (ro-sql.cjs, read-only). Always pass --set release=<first 12 hex chars of M> --set since=<ISO time of the B1 push>:
-- client_errors.release holds only the first 12 characters of the commit SHA.
-- Rows from our own headless checks carry "myseouldrop-release-check" in user_agent (synthetic). They count: they ran M's code.

-- @M.errors-by-release
select release, kind, count(*)::int as n,
       (count(*) filter (where user_agent like '%myseouldrop-release-check%'))::int as synthetic, max(created_at) as last_seen
from public.client_errors where created_at > now() - interval '24 hours'
group by 1, 2 order by n desc limit 20

-- @M.errors-recent
select created_at, kind, left(message, 160) as message, page, release,
       coalesce(user_agent like '%myseouldrop-release-check%', false) as synthetic
from public.client_errors where created_at > now() - interval '2 hours'
order by created_at desc limit 30

-- @M.release-trigger
select current_setting('myseouldrop.release', true) as release, count(*)::int as n,
       count(distinct message)::int as messages, count(distinct page)::int as pages,
       (count(*) >= 3 or count(distinct page) >= 2) as trigger,
       (coalesce(current_setting('myseouldrop.release', true), '') ~ '^[0-9a-f]{12}$'
        and not (count(*) >= 3 or count(distinct page) >= 2)) as ok
from public.client_errors
where release = current_setting('myseouldrop.release', true)
  and created_at >= coalesce(nullif(current_setting('myseouldrop.since', true), '')::timestamptz, now() - interval '24 hours')

-- @M.freeze
select merchants, active_memberships, published, store_profiles, open_bookings,
       (merchants = 0 and active_memberships = 0 and published = 0 and store_profiles = 0 and open_bookings = 0) as ok
from (select (select count(*)::int from public.merchants) as merchants,
             (select count(*)::int from public.merchant_memberships where revoked_at is null) as active_memberships,
             (select count(*)::int from public.merchant_publications where published) as published,
             (select count(*)::int from public.merchant_store_profiles) as store_profiles,
             (select count(*)::int from public.customer_bookings where status in ('requested', 'confirmed')) as open_bookings) s
