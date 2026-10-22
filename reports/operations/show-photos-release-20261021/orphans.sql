-- After a disconnect, a timeout or 55P03 (ro-sql.cjs, read-only): is a session of ours still alive, and who holds the locks
-- the apply/rollback needs. The runners set application_name both at startup and with SET, so the pooler cannot hide it.
-- Decide nothing (no V1/V4 reading, no retry) until O.sessions is ok.

-- @O.sessions
select count(*)::int as n,
       coalesce(jsonb_agg(jsonb_build_object('pid', pid, 'app', application_name, 'state', state, 'xid', backend_xid::text,
         'xact_age_s', round(extract(epoch from now() - xact_start)), 'state_age_s', round(extract(epoch from now() - state_change)),
         'wait', wait_event_type || ':' || wait_event, 'query', left(query, 80)) order by pid), '[]'::jsonb) as detail,
       count(*) = 0 as ok
from pg_stat_activity
where pid <> pg_backend_pid() and application_name in ('myseouldrop-show-photos-apply', 'myseouldrop-show-photos-rollback')

-- @O.idle-in-transaction
select count(*)::int as n,
       coalesce(jsonb_agg(jsonb_build_object('pid', pid, 'app', application_name, 'state', state,
         'xact_age_s', round(extract(epoch from now() - xact_start)), 'query', left(query, 80)) order by pid), '[]'::jsonb) as detail
from pg_stat_activity
where pid <> pg_backend_pid() and usename = current_user and datname = current_database() and state like 'idle in transaction%'

-- @O.locks
select count(*)::int as n,
       coalesce(jsonb_agg(jsonb_build_object('pid', l.pid, 'app', a.application_name, 'locktype', l.locktype,
         'rel', case when l.locktype = 'relation' then l.relation::regclass::text end, 'mode', l.mode, 'granted', l.granted,
         'xact_age_s', round(extract(epoch from now() - a.xact_start)), 'query', left(a.query, 80)) order by l.pid), '[]'::jsonb) as detail,
       count(*) = 0 as ok
from pg_locks l left join pg_stat_activity a on a.pid = l.pid
where l.pid <> pg_backend_pid()
  and (a.application_name in ('myseouldrop-show-photos-apply', 'myseouldrop-show-photos-rollback')
    or (l.locktype = 'relation' and l.database = (select oid from pg_database where datname = current_database())
        and l.relation in ('public.merchant_store_profiles'::regclass, 'supabase_migrations.schema_migrations'::regclass)))
