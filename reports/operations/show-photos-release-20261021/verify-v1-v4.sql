-- Post-commit verification on a NEW connection (ro-sql.cjs; read-only; touches no rows).
-- V3.attrs is the same query as preflight 4.attrs: `check-results.cjs same <C1 golden> <this output> 4.attrs=V3.attrs`.
-- After a disconnect, V1.column n and V4.ledger n say whether the migration committed (both 1) or not (both 0).

-- @V1.column
select count(*)::int as n, min(a.attnum)::int as attnum,
       bool_and(format_type(a.atttypid, a.atttypmod) = 'boolean' and a.attnotnull and pg_get_expr(d.adbin, d.adrelid) = 'true') as definition_ok,
       (count(*) = 1 and coalesce(bool_and(format_type(a.atttypid, a.atttypmod) = 'boolean' and a.attnotnull
                                          and pg_get_expr(d.adbin, d.adrelid) = 'true'), false)) as ok
from pg_attribute a left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
where a.attrelid = 'public.merchant_store_profiles'::regclass and a.attname = 'show_photos' and not a.attisdropped

-- @V1.info-schema
select count(*)::int as n, max(is_nullable::text) as is_nullable, max(column_default::text) as column_default, max(data_type::text) as data_type,
       (count(*) = 1 and max(is_nullable::text) = 'NO' and max(column_default::text) = 'true' and max(data_type::text) = 'boolean') as ok
from information_schema.columns
where table_schema = 'public' and table_name = 'merchant_store_profiles' and column_name = 'show_photos'

-- @V2.bodies
select proname, src_md5, markers_ok,
       (markers_ok and src_md5 = case proname
          when 'booking_quote' then 'bea475352d419bb440854ecd2b02f277'
          when 'partner_store_profile' then '8fafbb7d56196ec7aeba628b95feda83'
          when 'store_profile_json' then '289c62d7632528f242c8100f1934c5a0' end) as ok
from (select p.proname::text as proname, md5(p.prosrc) as src_md5,
             case p.proname
               when 'store_profile_json' then strpos(p.prosrc, '''showPhotos'',coalesce(p.show_photos,true)') > 0
               when 'partner_store_profile' then strpos(p.prosrc, 'jsonb_object_keys(p_values - ''showPhotos''))<>4') > 0
                 and strpos(p.prosrc, 'show_photos=excluded.show_photos') > 0
                 and strpos(p.prosrc, 'if m.contact_phone is distinct from p_values->>''contactPhone''') > 0
                 and strpos(p.prosrc, 'jsonb_object_keys(p_values))<>4') = 0
               when 'booking_quote' then strpos(p.prosrc, 'select profile.name_en from public.merchant_store_profiles') > 0
                 and strpos(p.prosrc, 'select profile.updated_at from public.merchant_store_profiles') = 0
             end as markers_ok
      from pg_proc p
      where p.oid = any ('{"private.store_profile_json(public.merchants,public.merchant_store_profiles)","private.partner_store_profile(text,timestamptz,jsonb,uuid)","private.booking_quote(public.merchant_services,public.merchant_categories,public.merchants,public.merchant_booking_settings)"}'::regprocedure[])) s
order by proname

-- @V3.attrs
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

-- @V3.exec
select jsonb_agg(jsonb_build_object('fn', fn, 'anon', anon, 'authenticated', authenticated) order by fn) as functions,
       (count(*) = 6 and bool_and(case fn
          when 'private.booking_quote' then not anon and not authenticated
          when 'private.partner_store_profile' then not anon and authenticated
          when 'private.public_store_profile' then anon and authenticated
          when 'private.store_profile_json' then not anon and not authenticated
          when 'public.partner_store_profile' then not anon and authenticated
          when 'public.public_store_profile' then anon and authenticated
          else false end)) as ok
from (select format('%s.%s', n.nspname, p.proname) as fn,
             has_function_privilege('anon', p.oid, 'EXECUTE') as anon,
             has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where (n.nspname::text, p.proname::text) in (('public', 'partner_store_profile'), ('public', 'public_store_profile'),
            ('private', 'partner_store_profile'), ('private', 'public_store_profile'), ('private', 'store_profile_json'), ('private', 'booking_quote'))) s

-- @info.V3.grants
select p.proname::text as proname, case when a.grantee = 0 then 'PUBLIC' else a.grantee::regrole::text end as grantee, a.privilege_type
from pg_proc p cross join lateral aclexplode(p.proacl) a
where p.oid = any ('{"private.store_profile_json(public.merchants,public.merchant_store_profiles)","private.partner_store_profile(text,timestamptz,jsonb,uuid)","private.booking_quote(public.merchant_services,public.merchant_categories,public.merchants,public.merchant_booking_settings)"}'::regprocedure[])
order by 1, 2

-- @V4.ledger
select count(*)::int as n, min(name) as name, min(array_length(statements, 1)) as n_statements,
       bool_and(encode(sha256(convert_to(statements[1], 'UTF8')), 'hex') = '22e132c52d2b67e941d0e1d9fd69cb6cb4de44b34f125603c71236356f4433a5') as matches_file,
       (count(*) = 1 and min(name) = 'store_profile_show_photos' and min(array_length(statements, 1)) = 1
        and coalesce(bool_and(encode(sha256(convert_to(statements[1], 'UTF8')), 'hex') = '22e132c52d2b67e941d0e1d9fd69cb6cb4de44b34f125603c71236356f4433a5'), false)) as ok
from supabase_migrations.schema_migrations where version = '20261020123000'

-- @V4.counts
select count(*)::int as n, max(version) as head, (count(*) filter (where version = '20260926083440'))::int as withheld,
       (count(*) = 24 and max(version) = '20261020123000' and count(*) filter (where version = '20260926083440') = 0) as ok
from supabase_migrations.schema_migrations
