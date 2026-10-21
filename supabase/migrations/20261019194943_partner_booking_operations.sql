-- Merchant operations use the same ledger and tenant advisory lock as customer
-- reservations. Customer JSON and legacy RPC signatures intentionally stay intact.
create table public.merchant_booking_customers (
 id uuid primary key default gen_random_uuid(),
 merchant_id uuid not null references public.merchants(id) on delete restrict,
 auth_customer_id uuid references auth.users(id) on delete cascade,
 phone_key text,
 created_at timestamptz not null default now(),
 unique (merchant_id,id),
 unique (merchant_id,auth_customer_id),
 unique (merchant_id,phone_key),
 check ((auth_customer_id is not null and phone_key is null) or
        (auth_customer_id is null and phone_key ~ '^[0-9]{7,80}$'))
);
alter table public.merchant_booking_customers enable row level security;
revoke all on public.merchant_booking_customers from public,anon,authenticated;
grant all on public.merchant_booking_customers to service_role;

alter table public.customer_bookings
 add column partner_customer_id uuid references public.merchant_booking_customers(id) on delete set null,
 add column source text not null default 'app' check (source in ('app','phone','walkin')),
 add column cancel_reason text not null default '' check (length(cancel_reason)<=1000),
 add constraint booking_source_identity check (source='app' or customer_id is null),
 add constraint booking_cancellation_reason check (status='cancelled' or cancel_reason='');
create unique index customer_bookings_offline_request_idx on public.customer_bookings(merchant_id,request_id) where source in ('phone','walkin');
create index customer_bookings_partner_customer_idx on public.customer_bookings(partner_customer_id,start_at desc);
alter table public.customer_booking_events add column details jsonb not null default '{}'::jsonb;

-- Authenticated customers receive a random merchant-scoped public identity.
-- Offline identity is separate: a matching phone never claims an app account.
insert into public.merchant_booking_customers(merchant_id,auth_customer_id)
select distinct merchant_id,customer_id from public.customer_bookings where customer_id is not null;
update public.customer_bookings b set partner_customer_id=c.id from public.merchant_booking_customers c
where c.merchant_id=b.merchant_id and c.auth_customer_id=b.customer_id;

create function private.partner_booking_phone(p_phone text) returns text language sql immutable set search_path='' as $$
 select case when digits like '0082%' then '0'||substr(digits,5)
             when digits like '82%' and left(btrim(p_phone),1)='+' then '0'||substr(digits,3)
             else digits end from (select regexp_replace(p_phone,'[^0-9]','','g') as digits) p
$$;
create function private.partner_booking_identity() returns trigger language plpgsql security definer set search_path='' as $$
declare identity_id uuid; phone_key_value text;
begin
 if new.customer_id is not null then
  insert into public.merchant_booking_customers(merchant_id,auth_customer_id) values(new.merchant_id,new.customer_id)
  on conflict(merchant_id,auth_customer_id) do nothing;
  select id into identity_id from public.merchant_booking_customers where merchant_id=new.merchant_id and auth_customer_id=new.customer_id;
 elsif new.source in ('phone','walkin') then
  phone_key_value:=private.partner_booking_phone(new.phone);
  insert into public.merchant_booking_customers(merchant_id,phone_key) values(new.merchant_id,phone_key_value)
  on conflict(merchant_id,phone_key) do nothing;
  select id into identity_id from public.merchant_booking_customers where merchant_id=new.merchant_id and phone_key=phone_key_value;
 end if;
 new.partner_customer_id:=identity_id;
 return new;
end $$;
create trigger partner_booking_identity before insert on public.customer_bookings for each row execute function private.partner_booking_identity();

create function private.partner_booking_merchant(p_write boolean default false) returns uuid
language plpgsql security definer set search_path='' as $$
declare tenant uuid; state text;
begin
 if auth.uid() is null or not exists(select 1 from auth.users where id=auth.uid() and not coalesce(is_anonymous,false)) then raise exception 'AUTH_REQUIRED'; end if;
 select m.merchant_id,s.status into tenant,state from public.merchant_memberships m join public.merchants s on s.id=m.merchant_id
 where m.user_id=auth.uid() and m.revoked_at is null;
 if tenant is null then raise exception 'PARTNER_FORBIDDEN'; end if;
 if p_write and state not in ('active','onboarding') then raise exception 'PARTNER_READ_ONLY'; end if;
 return tenant;
end $$;
create function private.partner_booking_json(b public.customer_bookings) returns jsonb
language sql stable set search_path='' as $$
 select private.booking_json(b)||jsonb_build_object('serviceId',b.service_id,'staffId',b.staff_id,
 'customerId',b.partner_customer_id,'occupiedUntil',b.occupied_until,'source',b.source,'cancelReason',b.cancel_reason)
$$;
create function private.partner_booking_list() returns jsonb
language plpgsql security definer set search_path='' as $$
declare tenant uuid:=private.partner_booking_merchant(); result jsonb; place text;
begin
 select coalesce(jsonb_agg(private.partner_booking_json(b) order by b.start_at desc,b.id),'[]'::jsonb) into result
 from public.customer_bookings b where b.merchant_id=tenant;
 select place_id into place from public.merchant_publications where merchant_id=tenant and published;
 return jsonb_build_object('bookings',result,'placeId',place);
end $$;
create function private.partner_booking_get(p_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare tenant uuid:=private.partner_booking_merchant(); b public.customer_bookings;
begin
 select * into b from public.customer_bookings where id=p_id and merchant_id=tenant;
 if not found then raise exception 'BOOKING_NOT_FOUND'; end if;
 return private.partner_booking_json(b);
end $$;

-- Slot calculation for an existing booking preserves its purchased service and
-- cleanup durations, validates current menu/staff eligibility, and excludes only
-- that authorized booking from occupancy. The write calls this under tenant lock.
create function private.partner_booking_availability(p_id uuid,p_staff_id uuid,p_date date) returns jsonb
language plpgsql security definer set search_path='' as $$
declare tenant uuid:=private.partner_booking_merchant(); b public.customer_bookings; rules public.merchant_reservation_rules;
 menu public.merchant_services; shop jsonb; staff_calendar jsonb; slots jsonb; midnight timestamptz;
 duration interval; occupied interval; duration_min integer; occupied_min integer; quote text;
begin
 if p_date is null or p_date<date '0001-01-01' or p_date>date '9999-12-30' then raise exception 'INVALID_REQUEST'; end if;
 select * into b from public.customer_bookings where id=p_id and merchant_id=tenant;
 if not found then raise exception 'BOOKING_NOT_FOUND'; end if;
 if b.status not in ('requested','confirmed') then raise exception 'BOOKING_CONFLICT'; end if;
 select * into rules from public.merchant_reservation_rules where merchant_id=tenant;
 select s.* into menu from public.merchant_services s join public.merchant_categories c on c.merchant_id=s.merchant_id and c.id=s.category_id
 where s.merchant_id=tenant and s.id=b.service_id and s.visibility='visible' and c.visibility='visible';
 select to_jsonb(s) into shop from public.merchant_schedules s where s.merchant_id=tenant;
 if rules.merchant_id is null or menu.id is null or shop is null then raise exception 'BOOKING_UNAVAILABLE'; end if;
 if (rules.mode='shop' and p_staff_id is not null) or (rules.mode='staff' and (p_staff_id is null or not exists(
  select 1 from public.merchant_staff s join public.merchant_staff_menus sm on sm.merchant_id=s.merchant_id and sm.staff_id=s.id
  where s.merchant_id=tenant and s.id=p_staff_id and s.visibility='visible' and sm.service_id=b.service_id))) then raise exception 'BOOKING_UNAVAILABLE'; end if;
 if rules.mode='staff' then select to_jsonb(s) into staff_calendar from public.merchant_staff_schedules s where s.merchant_id=tenant and s.staff_id=p_staff_id; end if;
 duration:=b.service_end_at-b.start_at; occupied:=b.occupied_until-b.start_at;
 duration_min:=ceil(extract(epoch from duration)/60)::integer; occupied_min:=ceil(extract(epoch from occupied)/60)::integer;
 midnight:=p_date::timestamp at time zone 'Asia/Seoul';
 select coalesce(jsonb_agg(jsonb_build_object('startAt',midnight+minute*interval '1 minute',
  'serviceEndAt',midnight+minute*interval '1 minute'+duration,
  'occupiedUntil',midnight+minute*interval '1 minute'+occupied,'staffId',p_staff_id) order by minute),'[]'::jsonb)
 into slots from generate_series(0,1439,rules.slot_interval_minutes) minute
 where p_date between rules.start_date and rules.end_date
 and midnight+minute*interval '1 minute'>=statement_timestamp()+rules.minimum_lead_minutes*interval '1 minute'
 and private.booking_calendar_fit(shop,p_date,minute,minute+occupied_min)
 and (rules.mode='shop' or private.booking_calendar_fit(staff_calendar,p_date,minute,minute+occupied_min))
 and private.booking_capacity(tenant,p_staff_id,midnight+minute*interval '1 minute',midnight+minute*interval '1 minute'+occupied,rules.capacity,b.id);
 quote:=md5(jsonb_build_array(b.id,b.updated_at,b.total_krw,duration,occupied,rules.updated_at,menu.updated_at)::text);
 return jsonb_build_object('slots',slots,'quoteVersion',quote);
end $$;

create function private.partner_booking_create(p_place_id text,p_service_id uuid,p_staff_id uuid,p_start_at timestamptz,p_quote_version text,
 p_request_id uuid,p_customer_name text,p_phone text,p_notes text,p_source text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare tenant uuid:=private.partner_booking_merchant(true); fingerprint text; existing public.customer_bookings;
 available jsonb; slot jsonb; catalog jsonb; service jsonb; specialist jsonb; created public.customer_bookings;
begin
 if p_request_id is null or p_service_id is null or p_start_at is null or not isfinite(p_start_at)
 or p_quote_version is null or length(p_quote_version) not between 1 and 256 or p_place_id is null or length(p_place_id) not between 1 and 200
 or p_customer_name is null or length(private.catalog_text(p_customer_name)) not between 1 and 120
 or p_phone is null or length(p_phone)>80 or p_phone !~ '^[0-9+(). -]+$'
 or length(regexp_replace(p_phone,'[^0-9]','','g'))<7 or p_notes is null or length(p_notes)>2000
 or p_source is null or p_source not in ('phone','walkin') then raise exception 'INVALID_REQUEST'; end if;
 fingerprint:=md5(jsonb_build_array(p_place_id,p_service_id,p_staff_id,p_start_at,p_quote_version,private.catalog_text(p_customer_name),btrim(p_phone),p_notes,p_source)::text);
 perform pg_advisory_xact_lock(hashtextextended(tenant::text,702020));
 if private.partner_booking_merchant(true)<>tenant then raise exception 'PARTNER_FORBIDDEN'; end if;
 select * into existing from public.customer_bookings where merchant_id=tenant and request_id=p_request_id and source in ('phone','walkin');
 if found then
  if existing.request_fingerprint<>fingerprint then raise exception 'BOOKING_CONFLICT'; end if;
  return private.partner_booking_json(existing);
 end if;
 if not exists(select 1 from public.merchant_publications where merchant_id=tenant and place_id=p_place_id and published) then raise exception 'BOOKING_UNAVAILABLE'; end if;
 catalog:=private.booking_catalog(p_place_id);
 select v into service from jsonb_array_elements(catalog->'services') v where v->>'id'=p_service_id::text;
 if service is null then raise exception 'BOOKING_UNAVAILABLE'; end if;
 if service->>'quoteVersion' is distinct from p_quote_version then raise exception 'STALE_SELECTION'; end if;
 available:=private.booking_availability(p_place_id,p_service_id,p_staff_id,(p_start_at at time zone 'Asia/Seoul')::date);
 select v into slot from jsonb_array_elements(available->'slots') v where (v->>'startAt')::timestamptz=p_start_at;
 if slot is null then raise exception 'SLOT_UNAVAILABLE'; end if;
 select v into specialist from jsonb_array_elements(catalog->'staff') v where v->>'id'=p_staff_id::text;
 insert into public.customer_bookings(merchant_id,customer_id,request_id,request_fingerprint,place_id,service_id,staff_id,
  merchant_name,service_name,staff_name,start_at,service_end_at,occupied_until,total_krw,payment_mode,status,customer_name,phone,notes,source)
 values(tenant,null,p_request_id,fingerprint,p_place_id,p_service_id,p_staff_id,catalog->>'merchantName',service->>'name',specialist->>'name',
  p_start_at,(slot->>'serviceEndAt')::timestamptz,(slot->>'occupiedUntil')::timestamptz,(service->>'priceKrw')::bigint,'pay_at_venue',
  'confirmed',private.catalog_text(p_customer_name),btrim(p_phone),p_notes,p_source) returning * into created;
 insert into public.customer_booking_events(booking_id,actor_id,action,next_status,details)
 values(created.id,auth.uid(),'create_offline',created.status,jsonb_build_object('source',p_source));
 return private.partner_booking_json(created);
end $$;

create function private.partner_booking_mutate(p_id uuid,p_action text,p_expected_updated_at timestamptz,p_cancel_reason text default '',
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
  select name into new_staff_name from public.merchant_staff where merchant_id=tenant and id=p_staff_id;
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

-- App account deletion erases contact data, reason text and opaque identity.
-- Cascade removal of identity rows clears every associated partner_customer_id.
create or replace function private.booking_forget_customer() returns trigger language plpgsql security definer set search_path='' as $$
declare tenant uuid;
begin
 for tenant in select distinct merchant_id from public.customer_bookings where customer_id=old.id order by merchant_id loop
  perform pg_advisory_xact_lock(hashtextextended(tenant::text,702020));
 end loop;
 insert into public.customer_booking_events(booking_id,actor_id,action,previous_status,next_status)
 select id,null,'account_deleted',status,case when status in ('requested','confirmed') then 'cancelled' else status end
 from public.customer_bookings where customer_id=old.id;
 update public.customer_bookings set customer_name='Deleted customer',phone='',notes='',request_fingerprint='',cancel_reason='',partner_customer_id=null,
 status=case when status in ('requested','confirmed') then 'cancelled' else status end,
 cancelled_by=case when status in ('requested','confirmed') then 'customer' else cancelled_by end,
 updated_at=greatest(clock_timestamp(),updated_at+interval '1 microsecond') where customer_id=old.id;
 return old;
end $$;

create function public.partner_booking_list() returns jsonb language sql set search_path='' as $$select private.partner_booking_list()$$;
create function public.partner_booking_get(p_id uuid) returns jsonb language sql set search_path='' as $$select private.partner_booking_get(p_id)$$;
create function public.partner_booking_availability(p_id uuid,p_staff_id uuid,p_date date) returns jsonb language sql set search_path='' as $$select private.partner_booking_availability(p_id,p_staff_id,p_date)$$;
create function public.partner_booking_create(p_place_id text,p_service_id uuid,p_staff_id uuid,p_start_at timestamptz,p_quote_version text,p_request_id uuid,p_customer_name text,p_phone text,p_notes text,p_source text)
 returns jsonb language sql set search_path='' as $$select private.partner_booking_create(p_place_id,p_service_id,p_staff_id,p_start_at,p_quote_version,p_request_id,p_customer_name,p_phone,p_notes,p_source)$$;
create function public.partner_booking_mutate(p_id uuid,p_action text,p_expected_updated_at timestamptz,p_cancel_reason text default '',p_start_at timestamptz default null,p_staff_id uuid default null)
 returns jsonb language sql set search_path='' as $$select private.partner_booking_mutate(p_id,p_action,p_expected_updated_at,p_cancel_reason,p_start_at,p_staff_id)$$;

do $$ declare f record; begin
 for f in select p.oid::regprocedure as signature,n.nspname,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname in ('public','private') and p.proname like 'partner_booking_%' loop
  execute format('revoke all on function %s from public,anon,authenticated,service_role',f.signature);
  execute format('grant execute on function %s to service_role',f.signature);
  if f.proname in ('partner_booking_list','partner_booking_get','partner_booking_availability','partner_booking_create','partner_booking_mutate') then
   execute format('grant execute on function %s to authenticated',f.signature);
  end if;
 end loop;
end $$;
notify pgrst,'reload schema';
