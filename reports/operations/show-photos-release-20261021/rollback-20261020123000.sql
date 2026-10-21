-- EMERGENCY ROLLBACK of 20261020123000_store_profile_show_photos (⚠ production write; explicit owner approval only).
-- Restores the 20261019200212 bodies verbatim (from git blob e608426), drops show_photos, removes the ledger row.
-- Runbook policy is fix-forward (docs/runbook.md:58-61).
-- Every check that decides whether to proceed runs inside this one transaction, after the table locks and before COMMIT:
--   * the ledger is locked SHARE ROW EXCLUSIVE right after the advisory lock (same order as the apply runner), so neither the
--     Supabase CLI nor anyone else can add a ledger row between the head check and COMMIT;
--   * merchant_store_profiles is locked ACCESS EXCLUSIVE before the show_photos=false check, so no partner save can commit in between;
--   * 20261020123000 must be the ledger head: 24 rows, nothing applied after it, the withheld 20260926083440 absent;
--   * owner, security definer, volatility, config and ACL must equal the C1 golden values before the rollback, and every
--     attribute CREATE OR REPLACE can reset (also strict, parallel, cost, language, arguments, result) must be unchanged after it;
--   * the ledger must be back at 23 rows / head 20261019200901 before COMMIT.
begin;
set local lock_timeout = '3s';
set local statement_timeout = '60s';
set local idle_in_transaction_session_timeout = '30s';
select pg_advisory_xact_lock(hashtext('myseouldrop-release-migrations'));
lock table supabase_migrations.schema_migrations in share row exclusive mode;
lock table public.merchant_store_profiles in access exclusive mode;
do $guard$
declare
  fns regprocedure[] := '{"private.store_profile_json(public.merchants,public.merchant_store_profiles)","private.partner_store_profile(text,timestamptz,jsonb,uuid)","private.booking_quote(public.merchant_services,public.merchant_categories,public.merchants,public.merchant_booking_settings)"}';
  attrs jsonb;
begin
  if (select count(*) from supabase_migrations.schema_migrations) <> 24
     or (select max(version) from supabase_migrations.schema_migrations) <> '20261020123000'
     or exists (select 1 from supabase_migrations.schema_migrations where version = '20260926083440') then
    raise exception 'ROLLBACK_GUARD: 20261020123000 is not the ledger head (expect 24 rows, head 20261020123000, withheld migration absent)';
  end if;
  if (select string_agg(p.proname||'='||md5(p.prosrc),',' order by p.proname) from pg_proc p where p.oid = any (fns))
     is distinct from 'booking_quote=bea475352d419bb440854ecd2b02f277,partner_store_profile=8fafbb7d56196ec7aeba628b95feda83,store_profile_json=289c62d7632528f242c8100f1934c5a0' then
    raise exception 'ROLLBACK_GUARD: live bodies are not the 20261020123000 bodies: %',
      (select string_agg(p.proname||'='||md5(p.prosrc),',' order by p.proname) from pg_proc p where p.oid = any (fns));
  end if;
  if exists (select 1 from public.merchant_store_profiles where show_photos is false) then
    raise exception 'ROLLBACK_GUARD: stores with show_photos=false would lose that setting; fix forward instead';
  end if;
  select jsonb_agg(jsonb_build_object('fn', p.proname::text, 'owner', pg_get_userbyid(p.proowner)::text, 'secdef', p.prosecdef,
           'volatile', p.provolatile::text, 'config', to_jsonb(p.proconfig),
           'acl', (select jsonb_agg(a::text order by a::text collate "C") from unnest(p.proacl) a),
           'strict', p.proisstrict, 'parallel', p.proparallel::text, 'cost', p.procost,
           'lang', (select l.lanname::text from pg_language l where l.oid = p.prolang),
           'args', pg_get_function_arguments(p.oid), 'result', pg_get_function_result(p.oid)) order by p.proname)
    into attrs from pg_proc p where p.oid = any (fns);
  if (select jsonb_agg(v - array['strict', 'parallel', 'cost', 'lang', 'args', 'result'] order by v->>'fn') from jsonb_array_elements(attrs) as e(v))
     is distinct from '[{"fn": "booking_quote", "owner": "postgres", "secdef": false, "volatile": "s", "config": ["search_path=\"\""], "acl": ["postgres=X/postgres", "service_role=X/postgres"]},
                        {"fn": "partner_store_profile", "owner": "postgres", "secdef": true, "volatile": "v", "config": ["search_path=\"\""], "acl": ["authenticated=X/postgres", "postgres=X/postgres", "service_role=X/postgres"]},
                        {"fn": "store_profile_json", "owner": "postgres", "secdef": false, "volatile": "s", "config": ["search_path=\"\""], "acl": ["postgres=X/postgres", "service_role=X/postgres"]}]'::jsonb then
    raise exception 'ROLLBACK_GUARD: function owner/security definer/volatility/config/ACL differ from the C1 golden values: %', attrs;
  end if;
  perform set_config('myseouldrop.rollback_attrs', attrs::text, true);
end $guard$;

create or replace function private.store_profile_json(m public.merchants,p public.merchant_store_profiles) returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('contactPhone',m.contact_phone,'contactEmail',m.contact_email,'nameKo',m.display_name,'address',m.address,
  'nameEn',coalesce(p.name_en,''),'introductionKo',coalesce(p.introduction_ko,''),'introductionEn',coalesce(p.introduction_en,''),
  'englishOk',coalesce(p.english_ok,false),'notice',coalesce(p.notice,''),'updatedAt',greatest(m.updated_at,p.updated_at))
$$;
create or replace function private.partner_store_profile(p_action text default null,p_expected_updated_at timestamptz default null,p_values jsonb default null,p_review_id uuid default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare tenant uuid:=private.partner_booking_merchant(p_action is not null); m public.merchants; p public.merchant_store_profiles;
 r public.merchant_profile_reviews; current_profile jsonb; changes jsonb; place text;
begin
 select * into m from public.merchants where id=tenant;
 select * into p from public.merchant_store_profiles where merchant_id=tenant;
 if p_action is not null then
  if p_action not in ('update','request_review','cancel_review') or p_expected_updated_at is null or not isfinite(p_expected_updated_at) then raise exception 'INVALID_REQUEST'; end if;
  perform pg_advisory_xact_lock(hashtextextended(tenant::text,702020));
  if private.partner_booking_merchant(true)<>tenant then raise exception 'PARTNER_FORBIDDEN'; end if;
  select * into m from public.merchants where id=tenant for update;
  select * into p from public.merchant_store_profiles where merchant_id=tenant for update;
  if greatest(m.updated_at,p.updated_at)<>p_expected_updated_at then raise exception 'BOOKING_CONFLICT'; end if;
  current_profile:=private.store_profile_json(m,p);
  if p_action='update' then
   if p_review_id is not null or p_values is null or jsonb_typeof(p_values)<>'object' or
    (select count(*) from jsonb_object_keys(p_values))<>4 or not (p_values ?& array['contactPhone','contactEmail','englishOk','notice']) or
    jsonb_typeof(p_values->'contactPhone')<>'string' or length(p_values->>'contactPhone')>80 or
    ((p_values->>'contactPhone')<>'' and (p_values->>'contactPhone')!~ '^[0-9+(). -]+$') or
    jsonb_typeof(p_values->'contactEmail')<>'string' or length(p_values->>'contactEmail')>254 or
    ((p_values->>'contactEmail')<>'' and (p_values->>'contactEmail')!~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') or
    jsonb_typeof(p_values->'englishOk')<>'boolean' or jsonb_typeof(p_values->'notice')<>'string' or length(p_values->>'notice')>60 then raise exception 'INVALID_REQUEST'; end if;
   update public.merchants set contact_phone=p_values->>'contactPhone',contact_email=p_values->>'contactEmail' where id=tenant returning * into m;
   insert into public.merchant_store_profiles(merchant_id,english_ok,notice) values(tenant,(p_values->>'englishOk')::boolean,p_values->>'notice')
   on conflict(merchant_id) do update set english_ok=excluded.english_ok,notice=excluded.notice returning * into p;
  elsif p_action='request_review' then
   if p_review_id is not null or p_values is null or jsonb_typeof(p_values)<>'object' or
    (select count(*) from jsonb_object_keys(p_values))<>5 or not (p_values ?& array['nameKo','nameEn','address','introductionKo','introductionEn']) or
    jsonb_typeof(p_values->'nameKo')<>'string' or length(private.catalog_text(p_values->>'nameKo')) not between 1 and 120 or
    jsonb_typeof(p_values->'nameEn')<>'string' or length(p_values->>'nameEn')>120 or
    jsonb_typeof(p_values->'address')<>'string' or length(p_values->>'address')>500 or
    jsonb_typeof(p_values->'introductionKo')<>'string' or length(p_values->>'introductionKo')>4000 or
    jsonb_typeof(p_values->'introductionEn')<>'string' or length(p_values->>'introductionEn')>4000 then raise exception 'INVALID_REQUEST'; end if;
   select coalesce(jsonb_object_agg(key,value),'{}'::jsonb) into changes from jsonb_each(p_values) where value is distinct from current_profile->key;
   if changes='{}'::jsonb then raise exception 'INVALID_REQUEST'; end if;
   update public.merchant_profile_reviews set status='cancelled' where merchant_id=tenant and status='pending';
   insert into public.merchant_profile_reviews(merchant_id,fields,actor_id) values(tenant,changes,auth.uid());
   insert into public.merchant_store_profiles(merchant_id) values(tenant) on conflict(merchant_id) do update set updated_at=clock_timestamp() returning * into p;
  else
   if p_values is not null or p_review_id is null then raise exception 'INVALID_REQUEST'; end if;
   update public.merchant_profile_reviews set status='cancelled' where id=p_review_id and merchant_id=tenant and status='pending';
   if not found then raise exception 'PROFILE_REVIEW_NOT_FOUND'; end if;
   update public.merchant_store_profiles set updated_at=clock_timestamp() where merchant_id=tenant returning * into p;
  end if;
 elsif p_expected_updated_at is not null or p_values is not null or p_review_id is not null then raise exception 'INVALID_REQUEST';
 end if;
 select * into r from public.merchant_profile_reviews where merchant_id=tenant and status='pending';
 select place_id into place from public.merchant_publications where merchant_id=tenant and published;
 return jsonb_build_object('profile',private.store_profile_json(m,p),'placeId',place,
  'pendingReview',case when r.id is null then null else jsonb_build_object('id',r.id,'fields',r.fields,'createdAt',r.created_at,'updatedAt',r.updated_at) end);
end $$;

create or replace function private.booking_quote(s public.merchant_services, c public.merchant_categories, m public.merchants, p public.merchant_booking_settings)
returns text language sql stable set search_path='' as $$
 select md5(jsonb_build_array(s.id,s.updated_at,s.price_krw,s.duration_minutes,s.cleanup_minutes,s.name_en,s.description_en,c.name_en,c.updated_at,m.updated_at,p.confirmation_mode,p.payment_mode,p.updated_at,(select profile.updated_at from public.merchant_store_profiles profile where profile.merchant_id=m.id),
 (select coalesce(jsonb_agg(jsonb_build_array(st.id,st.updated_at) order by st.id),'[]'::jsonb)
  from public.merchant_staff st join public.merchant_staff_menus sm on sm.merchant_id=st.merchant_id and sm.staff_id=st.id
  where sm.merchant_id=s.merchant_id and sm.service_id=s.id and st.visibility='visible'))::text)
$$;

alter table public.merchant_store_profiles drop column show_photos;
delete from supabase_migrations.schema_migrations where version = '20261020123000';

do $verify$
declare
  fns regprocedure[] := '{"private.store_profile_json(public.merchants,public.merchant_store_profiles)","private.partner_store_profile(text,timestamptz,jsonb,uuid)","private.booking_quote(public.merchant_services,public.merchant_categories,public.merchants,public.merchant_booking_settings)"}';
  attrs jsonb;
begin
  if (select string_agg(p.proname||'='||md5(p.prosrc),',' order by p.proname) from pg_proc p where p.oid = any (fns))
     is distinct from 'booking_quote=c4b538c9f97e676a005dc82323de62e2,partner_store_profile=fad8cf13c2c00209bd5b2672a1796ed5,store_profile_json=11a705af62d2d67eb054feb684c110e1' then
    raise exception 'ROLLBACK_VERIFY: bodies are not the 20261019200212 bodies: %',
      (select string_agg(p.proname||'='||md5(p.prosrc),',' order by p.proname) from pg_proc p where p.oid = any (fns));
  end if;
  if exists (select 1 from pg_attribute where attrelid = 'public.merchant_store_profiles'::regclass and attname = 'show_photos' and not attisdropped) then
    raise exception 'ROLLBACK_VERIFY: show_photos still present';
  end if;
  select jsonb_agg(jsonb_build_object('fn', p.proname::text, 'owner', pg_get_userbyid(p.proowner)::text, 'secdef', p.prosecdef,
           'volatile', p.provolatile::text, 'config', to_jsonb(p.proconfig),
           'acl', (select jsonb_agg(a::text order by a::text collate "C") from unnest(p.proacl) a),
           'strict', p.proisstrict, 'parallel', p.proparallel::text, 'cost', p.procost,
           'lang', (select l.lanname::text from pg_language l where l.oid = p.prolang),
           'args', pg_get_function_arguments(p.oid), 'result', pg_get_function_result(p.oid)) order by p.proname)
    into attrs from pg_proc p where p.oid = any (fns);
  if attrs is distinct from current_setting('myseouldrop.rollback_attrs')::jsonb then
    raise exception 'ROLLBACK_VERIFY: function attributes changed: % (before: %)', attrs, current_setting('myseouldrop.rollback_attrs');
  end if;
  if (select count(*) from supabase_migrations.schema_migrations) <> 23
     or (select max(version) from supabase_migrations.schema_migrations) <> '20261019200901'
     or exists (select 1 from supabase_migrations.schema_migrations where version in ('20261020123000', '20260926083440')) then
    raise exception 'ROLLBACK_VERIFY: ledger is not back at 23 rows / head 20261019200901';
  end if;
end $verify$;
notify pgrst, 'reload schema';
commit;
