-- Statements the runner (apply-show-photos.cjs) executes INSIDE the migration transaction, in this order:
--   set application_name = 'myseouldrop-show-photos-apply';   -- before begin, so the pooler cannot hide the session
--   begin; set local lock_timeout='3s'; set local statement_timeout='60s'; set local idle_in_transaction_session_timeout='30s';
--   select pg_advisory_xact_lock(hashtext('myseouldrop-release-migrations'));
--   ledger-exists check: if the version is already there, [LEDGER_GUARD] [POST_GUARD], rollback, report skip (nothing written)
--   [PRE_GUARD: ledger and freeze-table locks, then the checks]  [SNAPSHOT -> before]
--   <20261020123000_store_profile_show_photos.sql verbatim, sha256 22e132c52d2b67e941d0e1d9fd69cb6cb4de44b34f125603c71236356f4433a5>
--   [POST_GUARD] [SNAPSHOT -> after; runner asserts deepEqual(before, after)]
--   insert into supabase_migrations.schema_migrations(version,name,statements) values($1,$2,$3)
--       -- $1='20261020123000', $2='store_profile_show_photos', $3=[file text]
--   [LEDGER_GUARD]
--   notify pgrst, 'reload schema';   -- queued in the transaction; PostgreSQL delivers it only when COMMIT succeeds
--   commit;
-- The runner pins this file's sha256. Any edit needs a new review, a new pin in the runner and A0, and a new C4 rehearsal.
-- CREATE OR REPLACE keeps only owner and ACL; every other attribute comes from the statement, so SNAPSHOT covers them all.
-- Lock order everywhere (apply and rollback): advisory lock, ledger, then public tables. LOCK ... SHARE ROW EXCLUSIVE on the
-- ledger needs UPDATE, DELETE or TRUNCATE on it (C1 2.privileges checks DELETE).

-- ===== PRE_GUARD =====
-- The advisory lock only stops our own runners. The ledger lock also stops the Supabase CLI or anyone else from adding a
-- row until COMMIT; the SHARE locks stop inserts and updates on the five freeze tables until COMMIT, so every check below
-- still holds when the transaction commits. Readers are not blocked. The ALTER in the migration then upgrades
-- merchant_store_profiles to ACCESS EXCLUSIVE inside this same transaction.
lock table supabase_migrations.schema_migrations in share row exclusive mode;
lock table public.merchants, public.merchant_memberships, public.merchant_publications, public.merchant_store_profiles,
           public.customer_bookings in share mode;
do $pre$
declare fns regprocedure[] := '{"private.store_profile_json(public.merchants,public.merchant_store_profiles)","private.partner_store_profile(text,timestamptz,jsonb,uuid)","private.booking_quote(public.merchant_services,public.merchant_categories,public.merchants,public.merchant_booking_settings)"}';
  gate int[];
begin
  if (select count(*) from supabase_migrations.schema_migrations) <> 23
     or (select max(version) from supabase_migrations.schema_migrations) <> '20261019200901'
     or exists (select 1 from supabase_migrations.schema_migrations where version in ('20260926083440', '20261020123000')) then
    raise exception 'PRE_GUARD: unexpected migration ledger';
  end if;
  if exists (select 1 from pg_attribute where attrelid = 'public.merchant_store_profiles'::regclass and attname = 'show_photos' and not attisdropped) then
    raise exception 'PRE_GUARD: show_photos already exists (manual application?)';
  end if;
  if (select string_agg(p.proname || '=' || md5(p.prosrc), ',' order by p.proname) from pg_proc p where p.oid = any (fns))
     is distinct from 'booking_quote=c4b538c9f97e676a005dc82323de62e2,partner_store_profile=fad8cf13c2c00209bd5b2672a1796ed5,store_profile_json=11a705af62d2d67eb054feb684c110e1' then
    raise exception 'PRE_GUARD: live bodies differ from 20261019200212';
  end if;
  if current_setting('check_function_bodies') <> 'on' then
    raise exception 'PRE_GUARD: check_function_bodies is off';
  end if;
  -- Onboarding freeze, enforced at apply time with the same five counts as preflight 5.gate (C1, D0): no store, no active
  -- partner member, no published store, no store profile and no open booking may exist yet.
  gate := array[(select count(*)::int from public.merchants),
                (select count(*)::int from public.merchant_memberships where revoked_at is null),
                (select count(*)::int from public.merchant_publications where published),
                (select count(*)::int from public.merchant_store_profiles),
                (select count(*)::int from public.customer_bookings where status in ('requested', 'confirmed'))];
  if gate <> array[0, 0, 0, 0, 0] then
    raise exception 'PRE_GUARD: the onboarding freeze was broken (merchants, active memberships, published, store profiles, open bookings = %)', gate;
  end if;
end $pre$;

-- ===== SNAPSHOT (run before and after the migration SQL; must be identical) =====
select p.oid::regprocedure::text as fn, p.proowner::regrole::text as owner, p.prosecdef, p.provolatile, p.proconfig, p.proacl::text as acl,
       p.proisstrict, p.proparallel, p.procost, l.lanname::text as lang,
       pg_get_function_arguments(p.oid) as args, pg_get_function_result(p.oid) as result
from pg_proc p join pg_language l on l.oid = p.prolang
where p.oid = any ('{"private.store_profile_json(public.merchants,public.merchant_store_profiles)","private.partner_store_profile(text,timestamptz,jsonb,uuid)","private.booking_quote(public.merchant_services,public.merchant_categories,public.merchants,public.merchant_booking_settings)"}'::regprocedure[])
order by 1;

-- ===== POST_GUARD =====
do $post$
declare fns regprocedure[] := '{"private.store_profile_json(public.merchants,public.merchant_store_profiles)","private.partner_store_profile(text,timestamptz,jsonb,uuid)","private.booking_quote(public.merchant_services,public.merchant_categories,public.merchants,public.merchant_booking_settings)"}';
begin
  if not exists (select 1 from pg_attribute a join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
                 where a.attrelid = 'public.merchant_store_profiles'::regclass and a.attname = 'show_photos' and not a.attisdropped
                   and a.atttypid = 'boolean'::regtype and a.attnotnull and pg_get_expr(d.adbin, d.adrelid) = 'true') then
    raise exception 'POST_GUARD: show_photos definition mismatch';
  end if;
  if (select string_agg(p.proname || '=' || md5(p.prosrc), ',' order by p.proname) from pg_proc p where p.oid = any (fns))
     is distinct from 'booking_quote=bea475352d419bb440854ecd2b02f277,partner_store_profile=8fafbb7d56196ec7aeba628b95feda83,store_profile_json=289c62d7632528f242c8100f1934c5a0' then
    raise exception 'POST_GUARD: bodies differ from 20261020123000';
  end if;
  if (select count(*) from pg_proc where pronamespace = 'private'::regnamespace
      and proname in ('store_profile_json', 'partner_store_profile', 'booking_quote')) <> 3 then
    raise exception 'POST_GUARD: unexpected overloads';
  end if;
  if (private.store_profile_json(null::public.merchants, null::public.merchant_store_profiles) -> 'showPhotos') is distinct from 'true'::jsonb then
    raise exception 'POST_GUARD: store_profile_json smoke failed';
  end if;
  if private.booking_quote(null::public.merchant_services, null::public.merchant_categories, null::public.merchants, null::public.merchant_booking_settings) !~ '^[0-9a-f]{32}$' then
    raise exception 'POST_GUARD: booking_quote smoke failed';
  end if;
end $post$;

-- ===== LEDGER_GUARD (after the ledger insert, before COMMIT; and on the skip path) =====
do $ledger$
begin
  if (select count(*) from supabase_migrations.schema_migrations) <> 24
     or (select max(version) from supabase_migrations.schema_migrations) <> '20261020123000'
     or exists (select 1 from supabase_migrations.schema_migrations where version = '20260926083440') then
    raise exception 'LEDGER_GUARD: the ledger is not 24 rows with head 20261020123000 and the withheld migration absent';
  end if;
  if not exists (select 1 from supabase_migrations.schema_migrations
                 where version = '20261020123000' and name = 'store_profile_show_photos' and array_length(statements, 1) = 1
                   and encode(sha256(convert_to(statements[1], 'UTF8')), 'hex') = '22e132c52d2b67e941d0e1d9fd69cb6cb4de44b34f125603c71236356f4433a5') then
    raise exception 'LEDGER_GUARD: the 20261020123000 ledger row does not hold the reviewed file';
  end if;
end $ledger$;
