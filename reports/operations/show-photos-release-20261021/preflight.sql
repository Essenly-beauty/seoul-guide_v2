-- Read-only preflight for 20261020123000_store_profile_show_photos. Run it only through ro-sql.cjs:
-- one statement per `-- @<id>` line, one read-only repeatable-read transaction, search_path = ''.
-- `ok` columns compare against the expected values in SQL; `check-results.cjs ok` requires every ok = true.
-- The C1 output is the golden file. D0, after-rollback and rehearsal runs are compared to it with `check-results.cjs same`.
-- Ids starting with 6. or info. are point-in-time or informational and are never golden-compared.

-- @1.target
select current_database() as db, current_user as usr, current_setting('server_version_num') as server_version_num,
       current_setting('check_function_bodies') as check_function_bodies,
       (current_user = 'postgres' and current_setting('server_version_num') = '170006'
        and current_setting('check_function_bodies') = 'on') as ok

-- @2.ledger
select count(*)::int as n, max(version) as head,
       (count(*) filter (where version = '20260926083440'))::int as withheld,
       (count(*) filter (where version = '20261020123000'))::int as target,
       (count(*) = 23 and max(version) = '20261019200901'
        and count(*) filter (where version in ('20260926083440', '20261020123000')) = 0) as ok
from supabase_migrations.schema_migrations

-- @2.statements
select jsonb_agg(jsonb_build_object('version', version, 'name', name, 'n_statements', array_length(statements, 1),
         'sha256', encode(sha256(convert_to(statements[1], 'UTF8')), 'hex')) order by version) as rows,
       (count(*) = 2 and bool_and(array_length(statements, 1) = 1 and encode(sha256(convert_to(statements[1], 'UTF8')), 'hex') = case version
          when '20261019200212' then '3c06f5d8999997ff73adde5164a323bfe4c6e0c18ec26061317c44d20b96a4d7'
          when '20261019200901' then '6c1872e6dffc80d39569d67428d988acbab43f081f3f38af0e0a3327036a56c1' end)) as ok
from supabase_migrations.schema_migrations where version in ('20261019200212', '20261019200901')

-- @2.ledger-columns
select column_name::text as column_name, data_type::text as data_type, is_nullable::text as is_nullable, column_default::text as column_default,
       case column_name::text
         when 'version' then data_type::text = 'text' and is_nullable::text = 'NO'
         when 'statements' then data_type::text = 'ARRAY'
         when 'name' then data_type::text = 'text'
         else is_nullable::text = 'YES' or column_default is not null
       end as ok
from information_schema.columns
where table_schema = 'supabase_migrations' and table_name = 'schema_migrations' order by ordinal_position

-- @2.privileges
select has_schema_privilege(current_user, 'supabase_migrations', 'USAGE') as ledger_usage,
       has_table_privilege(current_user, 'supabase_migrations.schema_migrations', 'INSERT') as ledger_insert,
       has_table_privilege(current_user, 'supabase_migrations.schema_migrations', 'DELETE') as ledger_delete,
       pg_has_role(current_user, 'anon', 'MEMBER') as anon_member,
       pg_has_role(current_user, 'anon', 'SET') as anon_set,
       pg_has_role(current_user, 'authenticated', 'MEMBER') as authenticated_member,
       pg_has_role(current_user, 'authenticated', 'SET') as authenticated_set,
       (has_schema_privilege(current_user, 'supabase_migrations', 'USAGE')
        and has_table_privilege(current_user, 'supabase_migrations.schema_migrations', 'INSERT')
        and has_table_privilege(current_user, 'supabase_migrations.schema_migrations', 'DELETE')
        and pg_has_role(current_user, 'anon', 'MEMBER') and pg_has_role(current_user, 'anon', 'SET')
        and pg_has_role(current_user, 'authenticated', 'MEMBER') and pg_has_role(current_user, 'authenticated', 'SET')) as ok

-- @info.auth-users
select has_table_privilege(current_user, 'auth.users', 'SELECT') as owner_reads_auth_users

-- @3.columns
select string_agg(attname || ' ' || format_type(atttypid, atttypmod), ', ' order by attnum) as columns,
       string_agg(attname || ' ' || format_type(atttypid, atttypmod), ', ' order by attnum)
         = 'merchant_id uuid, name_en text, introduction_ko text, introduction_en text, english_ok boolean, notice text, updated_at timestamp with time zone' as ok
from pg_attribute where attrelid = 'public.merchant_store_profiles'::regclass and attnum > 0 and not attisdropped

-- @3.owner
select pg_has_role(current_user, relowner, 'MEMBER') as can_alter, pg_has_role(current_user, relowner, 'MEMBER') as ok
from pg_class where oid = 'public.merchant_store_profiles'::regclass

-- @4.bodies
select p.proname, md5(p.prosrc) as src_md5,
       md5(p.prosrc) = case p.proname
         when 'booking_quote' then 'c4b538c9f97e676a005dc82323de62e2'
         when 'partner_store_profile' then 'fad8cf13c2c00209bd5b2672a1796ed5'
         when 'store_profile_json' then '11a705af62d2d67eb054feb684c110e1' end as ok
from pg_proc p
where p.oid = any ('{"private.store_profile_json(public.merchants,public.merchant_store_profiles)","private.partner_store_profile(text,timestamptz,jsonb,uuid)","private.booking_quote(public.merchant_services,public.merchant_categories,public.merchants,public.merchant_booking_settings)"}'::regprocedure[])
order by p.proname

-- @4.attrs
select proname, owner, prosecdef, provolatile, proconfig, acl, proisstrict, proparallel, procost, lang, args, result, can_replace,
       (owner = 'postgres' and can_replace and proconfig = array['search_path=""'] and not proisstrict and proparallel = 'u'
        and case proname
              when 'booking_quote' then not prosecdef and provolatile = 's' and lang = 'sql'
                and acl = array['postgres=X/postgres', 'service_role=X/postgres']
              when 'partner_store_profile' then prosecdef and provolatile = 'v' and lang = 'plpgsql'
                and acl = array['authenticated=X/postgres', 'postgres=X/postgres', 'service_role=X/postgres']
              when 'store_profile_json' then not prosecdef and provolatile = 's' and lang = 'sql'
                and acl = array['postgres=X/postgres', 'service_role=X/postgres']
              else false end) as ok
from (select p.proname::text as proname, pg_get_userbyid(p.proowner)::text as owner, p.prosecdef, p.provolatile::text as provolatile, p.proconfig,
             array(select a::text from unnest(p.proacl) a order by a::text collate "C") as acl,
             p.proisstrict, p.proparallel::text as proparallel, p.procost, l.lanname::text as lang,
             pg_get_function_arguments(p.oid) as args, pg_get_function_result(p.oid) as result,
             pg_has_role(current_user, p.proowner, 'MEMBER') as can_replace
      from pg_proc p join pg_language l on l.oid = p.prolang
      where p.oid = any ('{"private.store_profile_json(public.merchants,public.merchant_store_profiles)","private.partner_store_profile(text,timestamptz,jsonb,uuid)","private.booking_quote(public.merchant_services,public.merchant_categories,public.merchants,public.merchant_booking_settings)"}'::regprocedure[])) s
order by proname

-- @4.defs
select p.proname, md5(pg_get_functiondef(p.oid)) as def_md5
from pg_proc p
where p.oid = any ('{"private.store_profile_json(public.merchants,public.merchant_store_profiles)","private.partner_store_profile(text,timestamptz,jsonb,uuid)","private.booking_quote(public.merchant_services,public.merchant_categories,public.merchants,public.merchant_booking_settings)"}'::regprocedure[])
order by p.proname

-- @4.overloads
select proname::text as proname, count(*)::int as n, count(*) = 1 as ok from pg_proc
where pronamespace = 'private'::regnamespace and proname in ('store_profile_json', 'partner_store_profile', 'booking_quote')
group by 1 order by 1

-- @5.gate
select merchants, active_memberships, published, store_profiles, open_bookings,
       (merchants = 0 and active_memberships = 0 and published = 0 and store_profiles = 0 and open_bookings = 0) as ok
from (select (select count(*)::int from public.merchants) as merchants,
             (select count(*)::int from public.merchant_memberships where revoked_at is null) as active_memberships,
             (select count(*)::int from public.merchant_publications where published) as published,
             (select count(*)::int from public.merchant_store_profiles) as store_profiles,
             (select count(*)::int from public.customer_bookings where status in ('requested', 'confirmed')) as open_bookings) s

-- @6.locks
select count(*)::int as n,
       coalesce(jsonb_agg(jsonb_build_object('pid', l.pid, 'rel', l.relation::regclass::text, 'mode', l.mode, 'granted', l.granted,
         'app', a.application_name, 'state', a.state, 'xact_age_s', round(extract(epoch from now() - a.xact_start)),
         'query', left(a.query, 80)) order by l.pid), '[]'::jsonb) as detail,
       count(*) = 0 as ok
from pg_locks l
join pg_class c on c.oid = l.relation
left join pg_stat_activity a on a.pid = l.pid
where l.locktype = 'relation' and l.pid <> pg_backend_pid()
  and l.database = (select oid from pg_database where datname = current_database())
  and (((l.mode = 'AccessExclusiveLock' or not l.granted)
        and c.relnamespace in ('public'::regnamespace, 'private'::regnamespace, 'supabase_migrations'::regnamespace))
    or (l.relation = any ('{public.merchant_store_profiles,public.merchants,public.merchant_profile_reviews,public.merchant_services,public.merchant_categories,public.merchant_booking_settings,public.merchant_staff,public.merchant_staff_menus,supabase_migrations.schema_migrations}'::regclass[])
        and a.xact_start < now() - interval '5 seconds'))

-- @6.waiting
select count(*)::int as waiting_locks, count(*) = 0 as ok
from pg_locks
where not granted and (database is null or database = (select oid from pg_database where datname = current_database()))

-- @6.long-xacts
select count(*)::int as n,
       coalesce(jsonb_agg(jsonb_build_object('pid', pid, 'user', usename, 'app', application_name, 'state', state,
         'xact_age_s', round(extract(epoch from now() - xact_start)), 'query', left(query, 80)) order by pid), '[]'::jsonb) as detail,
       count(*) = 0 as ok
from pg_stat_activity
where backend_type = 'client backend' and pid <> pg_backend_pid() and datname = current_database()
  and xact_start < now() - interval '30 seconds'

-- @7.views
select count(*)::int as views, count(*) = 0 as ok
from pg_depend
where classid = 'pg_rewrite'::regclass
  and ((refclassid = 'pg_class'::regclass and refobjid = 'public.merchant_store_profiles'::regclass)
    or (refclassid = 'pg_type'::regclass and refobjid = 'public.merchant_store_profiles'::regtype))

-- @info.dependents
select classid::regclass::text as catalog, pg_describe_object(classid, objid, objsubid) as object, deptype::text as deptype
from pg_depend
where (refclassid = 'pg_class'::regclass and refobjid = 'public.merchant_store_profiles'::regclass)
   or (refclassid = 'pg_type'::regclass and refobjid = 'public.merchant_store_profiles'::regtype)
order by 1, 2

-- @info.event-triggers
select evtname::text as evtname, evtevent::text as evtevent, evtenabled::text as evtenabled from pg_event_trigger order by 1
