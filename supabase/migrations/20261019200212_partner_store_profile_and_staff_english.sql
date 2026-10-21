create table public.merchant_store_profiles (
 merchant_id uuid primary key references public.merchants(id) on delete restrict,
 name_en text not null default '' check (length(name_en)<=120),
 introduction_ko text not null default '' check (length(introduction_ko)<=4000),
 introduction_en text not null default '' check (length(introduction_en)<=4000),
 english_ok boolean not null default false,
 notice text not null default '' check (length(notice)<=60),
 updated_at timestamptz not null default now()
);
create table public.merchant_profile_reviews (
 id uuid primary key default gen_random_uuid(),
 merchant_id uuid not null references public.merchants(id) on delete restrict,
 fields jsonb not null check (jsonb_typeof(fields)='object'),
 status text not null default 'pending' check (status in ('pending','cancelled','approved','rejected')),
 actor_id uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default clock_timestamp(),
 updated_at timestamptz not null default clock_timestamp()
);
create unique index merchant_profile_reviews_pending_idx on public.merchant_profile_reviews(merchant_id) where status='pending';
create index merchant_profile_reviews_actor_idx on public.merchant_profile_reviews(actor_id);
alter table public.merchant_store_profiles enable row level security;
alter table public.merchant_profile_reviews enable row level security;
revoke all on public.merchant_store_profiles,public.merchant_profile_reviews from public,anon,authenticated;
grant all on public.merchant_store_profiles,public.merchant_profile_reviews to service_role;
create trigger partner_touch before update on public.merchant_store_profiles for each row execute function private.partner_touch();
create trigger partner_touch before update on public.merchant_profile_reviews for each row execute function private.partner_touch();
create trigger a_booking_lock before insert or update or delete on public.merchant_store_profiles for each row execute function private.booking_config_lock();
create trigger partner_audit after insert or update or delete on public.merchant_store_profiles for each row execute function private.partner_audit();
create trigger partner_audit after insert or update or delete on public.merchant_profile_reviews for each row execute function private.partner_audit();

create function private.store_profile_json(m public.merchants,p public.merchant_store_profiles) returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('contactPhone',m.contact_phone,'contactEmail',m.contact_email,'nameKo',m.display_name,'address',m.address,
  'nameEn',coalesce(p.name_en,''),'introductionKo',coalesce(p.introduction_ko,''),'introductionEn',coalesce(p.introduction_en,''),
  'englishOk',coalesce(p.english_ok,false),'notice',coalesce(p.notice,''),'updatedAt',greatest(m.updated_at,p.updated_at))
$$;
create function private.partner_store_profile(p_action text default null,p_expected_updated_at timestamptz default null,p_values jsonb default null,p_review_id uuid default null) returns jsonb
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
create function private.public_store_profile(p_place_id text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare m public.merchants; p public.merchant_store_profiles;
begin
 select s.* into m from public.merchants s join public.merchant_publications b on b.merchant_id=s.id
 where b.place_id=p_place_id and b.published and s.status='active';
 if not found then return jsonb_build_object('status','unpublished','placeId',p_place_id); end if;
 select * into p from public.merchant_store_profiles where merchant_id=m.id;
 return jsonb_build_object('status','published','placeId',p_place_id,'profile',private.store_profile_json(m,p));
end $$;

alter table public.merchant_staff add column name_en text not null default '' check (length(name_en)<=120),
 add column introduction_en text not null default '' check (length(introduction_en)<=1000);
create function private.partner_staff_profile(p_id uuid,p_values jsonb default null,p_expected_updated_at timestamptz default null,p_create boolean default false) returns jsonb
language plpgsql security definer set search_path='' as $$
declare tenant uuid:=private.partner_booking_merchant(p_values is not null); s public.merchant_staff;
begin
 if p_id is null or p_create is null then raise exception 'INVALID_REQUEST'; end if;
 if p_values is not null then
  if jsonb_typeof(p_values)<>'object' or (select count(*) from jsonb_object_keys(p_values))<>7 or
   not (p_values ?& array['name','title','introduction','visibility','sortOrder','nameEn','introductionEn']) or
   jsonb_typeof(p_values->'name')<>'string' or length(p_values->>'name')>120 or jsonb_typeof(p_values->'title')<>'string' or length(p_values->>'title')>120 or
   jsonb_typeof(p_values->'introduction')<>'string' or length(p_values->>'introduction')>1000 or
   jsonb_typeof(p_values->'nameEn')<>'string' or length(p_values->>'nameEn')>120 or
   jsonb_typeof(p_values->'introductionEn')<>'string' or length(p_values->>'introductionEn')>1000 or
   (p_values->>'visibility') not in ('draft','visible','hidden','archived') or
   ((p_values->>'visibility')='visible' and private.catalog_text(p_values->>'name')='') or
   jsonb_typeof(p_values->'sortOrder')<>'number' or (p_values->>'sortOrder')::numeric not between 0 and 9007199254740991 or
   trunc((p_values->>'sortOrder')::numeric)<>(p_values->>'sortOrder')::numeric or
   (p_create and p_expected_updated_at is not null) or (not p_create and (p_expected_updated_at is null or not isfinite(p_expected_updated_at))) then raise exception 'INVALID_REQUEST'; end if;
  perform pg_advisory_xact_lock(hashtextextended(tenant::text,702020));
  if private.partner_booking_merchant(true)<>tenant then raise exception 'PARTNER_FORBIDDEN'; end if;
  select * into s from public.merchant_staff where id=p_id and merchant_id=tenant for update;
  if p_create then
   if exists(select 1 from public.merchant_staff where id=p_id) then raise exception 'BOOKING_CONFLICT'; end if;
   insert into public.merchant_staff(id,merchant_id,name,title,introduction,visibility,sort_order,name_en,introduction_en)
   values(p_id,tenant,p_values->>'name',p_values->>'title',p_values->>'introduction',p_values->>'visibility',(p_values->>'sortOrder')::bigint,p_values->>'nameEn',p_values->>'introductionEn') returning * into s;
  else
   if s.id is null then raise exception 'STAFF_NOT_FOUND'; end if;
   if s.updated_at<>p_expected_updated_at then raise exception 'BOOKING_CONFLICT'; end if;
   update public.merchant_staff set name=p_values->>'name',title=p_values->>'title',introduction=p_values->>'introduction',visibility=p_values->>'visibility',
    sort_order=(p_values->>'sortOrder')::bigint,name_en=p_values->>'nameEn',introduction_en=p_values->>'introductionEn' where id=p_id returning * into s;
  end if;
 else
  if p_create or p_expected_updated_at is not null then raise exception 'INVALID_REQUEST'; end if;
  select * into s from public.merchant_staff where id=p_id and merchant_id=tenant;
  if s.id is null then raise exception 'STAFF_NOT_FOUND'; end if;
 end if;
 return jsonb_build_object('id',s.id,'name',s.name,'title',s.title,'introduction',s.introduction,'visibility',s.visibility,'sortOrder',s.sort_order,
  'nameEn',s.name_en,'introductionEn',s.introduction_en,'updatedAt',s.updated_at);
end $$;

create function public.partner_store_profile(p_action text default null,p_expected_updated_at timestamptz default null,p_values jsonb default null,p_review_id uuid default null) returns jsonb
 language sql set search_path='' as $$select private.partner_store_profile(p_action,p_expected_updated_at,p_values,p_review_id)$$;
create function public.public_store_profile(p_place_id text) returns jsonb language sql set search_path='' as $$select private.public_store_profile(p_place_id)$$;
create function public.partner_staff_profile(p_id uuid,p_values jsonb default null,p_expected_updated_at timestamptz default null,p_create boolean default false) returns jsonb
 language sql set search_path='' as $$select private.partner_staff_profile(p_id,p_values,p_expected_updated_at,p_create)$$;

do $$ declare f record; begin
 for f in select p.oid::regprocedure as signature,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname in ('public','private') and p.proname in ('store_profile_json','partner_store_profile','public_store_profile','partner_staff_profile') loop
  execute format('revoke all on function %s from public,anon,authenticated,service_role',f.signature);
  execute format('grant execute on function %s to service_role',f.signature);
  if f.proname in ('partner_store_profile','public_store_profile','partner_staff_profile') then execute format('grant execute on function %s to authenticated',f.signature); end if;
  if f.proname='public_store_profile' then execute format('grant execute on function %s to anon',f.signature); end if;
 end loop;
end $$;
notify pgrst,'reload schema';

-- Preserve the exact customer catalog shape while preferring saved English copy.
create or replace function private.booking_catalog(p_place_id text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare merchant public.merchants; policy public.merchant_booking_settings; rules public.merchant_reservation_rules; services jsonb; staff jsonb;
begin
 select m.* into merchant from public.merchants m join public.merchant_publications p on p.merchant_id=m.id
 where p.place_id=p_place_id and p.published and m.status='active' and m.booking_enabled;
 if not found then return jsonb_build_object('status','unavailable','placeId',p_place_id); end if;
 select * into policy from public.merchant_booking_settings where merchant_id=merchant.id;
 if not found then return jsonb_build_object('status','unavailable','placeId',p_place_id); end if;
 select * into rules from public.merchant_reservation_rules where merchant_id=merchant.id;
 if not found or not exists(select 1 from public.merchant_schedules where merchant_id=merchant.id) then
 return jsonb_build_object('status','unavailable','placeId',p_place_id); end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'category',c.name_en,'name',s.name_en,'description',s.description_en,
 'priceKrw',s.price_krw,'durationMinutes',s.duration_minutes,'quoteVersion',private.booking_quote(s,c,merchant,policy)) order by c.sort_order,s.sort_order,s.id),'[]'::jsonb)
 into services from public.merchant_services s join public.merchant_categories c on c.merchant_id=s.merchant_id and c.id=s.category_id
 where s.merchant_id=merchant.id and s.visibility='visible' and c.visibility='visible'
 and private.catalog_text(s.name_en)<>'' and private.catalog_text(s.description_en)<>'' and private.catalog_text(c.name_en)<>''
 and s.price_krw is not null and s.duration_minutes is not null and s.duration_minutes+s.cleanup_minutes<=1440;
 select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'name',coalesce(nullif(private.catalog_text(s.name_en),''),s.name),'title',s.title,'introduction',coalesce(nullif(private.catalog_text(s.introduction_en),''),s.introduction),
 'serviceIds',(select coalesce(jsonb_agg(sm.service_id order by sm.service_id),'[]'::jsonb) from public.merchant_staff_menus sm
 where sm.merchant_id=merchant.id and sm.staff_id=s.id and exists(select 1 from jsonb_array_elements(services) v where v->>'id'=sm.service_id::text))) order by s.sort_order,s.id),'[]'::jsonb)
 into staff from public.merchant_staff s where s.merchant_id=merchant.id and s.visibility='visible';
 return jsonb_build_object('status','available','placeId',p_place_id,'merchantName',coalesce((select nullif(private.catalog_text(p.name_en),'') from public.merchant_store_profiles p where p.merchant_id=merchant.id),merchant.display_name),
 'mode',policy.confirmation_mode,'paymentMode',policy.payment_mode,'selectionMode',rules.mode,
 'startDate',rules.start_date,'endDate',rules.end_date,'services',services,'staff',staff);
end $$;


-- Quote snapshots include the approved profile version.
create or replace function private.booking_quote(s public.merchant_services, c public.merchant_categories, m public.merchants, p public.merchant_booking_settings)
returns text language sql stable set search_path='' as $$
 select md5(jsonb_build_array(s.id,s.updated_at,s.price_krw,s.duration_minutes,s.cleanup_minutes,s.name_en,s.description_en,c.name_en,c.updated_at,m.updated_at,p.confirmation_mode,p.payment_mode,p.updated_at,(select profile.updated_at from public.merchant_store_profiles profile where profile.merchant_id=m.id),
 (select coalesce(jsonb_agg(jsonb_build_array(st.id,st.updated_at) order by st.id),'[]'::jsonb)
  from public.merchant_staff st join public.merchant_staff_menus sm on sm.merchant_id=st.merchant_id and sm.staff_id=st.id
  where sm.merchant_id=s.merchant_id and sm.service_id=s.id and st.visibility='visible'))::text)
$$;


-- A rescheduled appointment uses the same customer-facing specialist name.
create or replace function private.partner_booking_mutate(p_id uuid,p_action text,p_expected_updated_at timestamptz,p_cancel_reason text default '',
 p_start_at timestamptz default null,p_staff_id uuid default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare tenant uuid:=private.partner_booking_merchant(true); b public.customer_bookings; previous public.customer_bookings;
 available jsonb; slot jsonb; new_status text; new_staff_name text;
begin
 if p_action is null or p_action not in ('confirm','cancel','complete','no_show','reschedule') or p_expected_updated_at is null
 or not isfinite(p_expected_updated_at) or p_cancel_reason is null or length(p_cancel_reason)>1000
 or (p_action<>'cancel' and p_cancel_reason<>'') or (p_action<>'reschedule' and (p_start_at is not null or p_staff_id is not null))
 or (p_action='reschedule' and (p_start_at is null or not isfinite(p_start_at))) then raise exception 'INVALID_REQUEST'; end if;
 perform private.partner_booking_get(p_id);
 perform pg_advisory_xact_lock(hashtextextended(tenant::text,702020));
 if private.partner_booking_merchant(true)<>tenant then raise exception 'PARTNER_FORBIDDEN'; end if;
 select * into b from public.customer_bookings where id=p_id and merchant_id=tenant for update;
 if not found then raise exception 'BOOKING_NOT_FOUND'; end if;
 if b.updated_at<>p_expected_updated_at then raise exception 'BOOKING_CONFLICT'; end if;
 previous:=b;
 if p_action='reschedule' then
  if b.status not in ('requested','confirmed') or b.start_at<=clock_timestamp() then raise exception 'BOOKING_CONFLICT'; end if;
  available:=private.partner_booking_availability(p_id,p_staff_id,(p_start_at at time zone 'Asia/Seoul')::date);
  select v into slot from jsonb_array_elements(available->'slots') v where (v->>'startAt')::timestamptz=p_start_at;
  if slot is null then raise exception 'SLOT_UNAVAILABLE'; end if;
  select coalesce(nullif(private.catalog_text(name_en),''),name) into new_staff_name from public.merchant_staff where merchant_id=tenant and id=p_staff_id;
  update public.customer_bookings set start_at=p_start_at,service_end_at=(slot->>'serviceEndAt')::timestamptz,
   occupied_until=(slot->>'occupiedUntil')::timestamptz,staff_id=p_staff_id,staff_name=new_staff_name,
   updated_at=greatest(clock_timestamp(),updated_at+interval '1 microsecond') where id=p_id returning * into b;
  insert into public.customer_booking_events(booking_id,actor_id,action,previous_status,next_status,details)
  values(b.id,auth.uid(),p_action,previous.status,b.status,jsonb_build_object('previousStartAt',previous.start_at,'startAt',b.start_at,
   'previousStaffId',previous.staff_id,'staffId',b.staff_id));
 else
  -- Reuse established transition policy and event creation; reason is persisted
  -- in this same locked transaction and is absent from the customer projection.
  perform private.booking_transition(p_id,p_action,true,p_expected_updated_at);
  if p_action='cancel' then update public.customer_bookings set cancel_reason=btrim(p_cancel_reason) where id=p_id; end if;
  select * into b from public.customer_bookings where id=p_id and merchant_id=tenant;
 end if;
 return private.partner_booking_json(b);
end $$;
