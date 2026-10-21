-- One persistent booking ledger for the customer app and merchant administration.
-- Nothing is enabled by this migration: a verified publication, active merchant,
-- booking_enabled and an explicitly provisioned payment/confirmation policy are required.
alter table public.merchants drop constraint merchants_booking_enabled_check;
-- Version tokens must change even for multiple saves inside one transaction.
create or replace function private.partner_touch() returns trigger language plpgsql set search_path='' as $$
begin new.updated_at:=greatest(clock_timestamp(),old.updated_at+interval '1 microsecond'); return new; end $$;
create table public.merchant_booking_settings (
  merchant_id uuid primary key references public.merchants(id) on delete restrict,
  confirmation_mode text not null check (confirmation_mode in ('request','instant')),
  payment_mode text not null check (payment_mode = 'pay_at_venue'),
  updated_at timestamptz not null default now()
);
alter table public.merchant_booking_settings enable row level security;
revoke all on public.merchant_booking_settings from public, anon, authenticated;
grant select on public.merchant_booking_settings to authenticated;
grant all on public.merchant_booking_settings to service_role;
create policy partner_read on public.merchant_booking_settings for select to authenticated using (private.partner_can_write(merchant_id));
create trigger partner_touch before update on public.merchant_booking_settings for each row execute function private.partner_touch();
create trigger partner_audit after insert or update or delete on public.merchant_booking_settings for each row execute function private.partner_audit();

create table public.customer_bookings (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete restrict,
  customer_id uuid references auth.users(id) on delete set null,
  request_id uuid not null,
  request_fingerprint text not null,
  place_id text not null,
  service_id uuid not null,
  staff_id uuid,
  merchant_name text not null,
  service_name text not null,
  staff_name text,
  start_at timestamptz not null,
  service_end_at timestamptz not null,
  occupied_until timestamptz not null,
  total_krw bigint not null check (total_krw between 1 and 9007199254740991),
  payment_mode text not null check (payment_mode='pay_at_venue'),
  status text not null check (status in ('requested','confirmed','cancelled','completed','no_show')),
  customer_name text not null check (length(customer_name) between 1 and 120),
  phone text not null check (length(phone)<=80),
  notes text not null default '' check (length(notes)<=2000),
  cancelled_by text check (cancelled_by in ('customer','merchant')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (customer_id,request_id),
  foreign key (merchant_id,service_id) references public.merchant_services(merchant_id,id) on delete restrict,
  foreign key (merchant_id,staff_id) references public.merchant_staff(merchant_id,id) on delete restrict,
  check (start_at<service_end_at and service_end_at<=occupied_until),
  check ((status='cancelled')=(cancelled_by is not null))
);
create index customer_bookings_customer_idx on public.customer_bookings(customer_id,start_at desc);
create index customer_bookings_merchant_idx on public.customer_bookings(merchant_id,start_at desc);
create index customer_bookings_occupancy_idx on public.customer_bookings(merchant_id,start_at,occupied_until) where status in ('requested','confirmed');
alter table public.customer_bookings enable row level security;
revoke all on public.customer_bookings from public,anon,authenticated;
grant all on public.customer_bookings to service_role;
-- Access only through tightly scoped RPCs, including reads. No customer identifiers
-- or internal payment/audit fields are returned by the public projection.
create table public.customer_booking_events (
 id bigint generated always as identity primary key,
 booking_id uuid not null references public.customer_bookings(id) on delete restrict,
 actor_id uuid references auth.users(id) on delete set null,
 action text not null,
 previous_status text,
 next_status text not null,
 created_at timestamptz not null default now()
);
alter table public.customer_booking_events enable row level security;
revoke all on public.customer_booking_events from public,anon,authenticated;
grant all on public.customer_booking_events to service_role;
grant usage,select on sequence public.customer_booking_events_id_seq to service_role;

create function private.booking_json(b public.customer_bookings) returns jsonb
language sql stable set search_path='' as $$
 select jsonb_build_object('id',b.id,'placeId',b.place_id,'merchantName',b.merchant_name,
 'serviceName',b.service_name,'staffName',b.staff_name,'startAt',b.start_at,
 'serviceEndAt',b.service_end_at,'totalKrw',b.total_krw,'status',b.status,
 'paymentMode',b.payment_mode,'customerName',b.customer_name,'phone',b.phone,
 'notes',b.notes,'createdAt',b.created_at,'updatedAt',b.updated_at,'cancelledBy',b.cancelled_by)
$$;

-- Interval arithmetic is shared by availability, atomic creation and admin edits.
-- Overrides replace weekly hours/breaks; date blocks are always subtracted.
create function private.booking_calendar_fit(calendar jsonb, day date, first_min integer, last_min integer)
returns boolean language plpgsql stable set search_path='' as $$
declare special jsonb; openings int4multirange; exclusions int4multirange; pauses jsonb; hours jsonb;
begin
 if calendar is null or first_min<0 or last_min>1440 or first_min>=last_min then return false; end if;
 select v into special from jsonb_array_elements(calendar->'overrides') v where v->>'date'=day::text;
 hours:=case when special is null then calendar->'hours' else special->'hours' end;
 pauses:=case when special is null then calendar->'breaks' else special->'breaks' end;
 select coalesce(range_agg(int4range((v->>'startMinute')::integer,(v->>'endMinute')::integer,'[)')),'{}'::int4multirange)
 into openings from jsonb_array_elements(hours) v where special is not null or (v->>'weekday')::integer=extract(dow from day)::integer;
 select coalesce(range_agg(int4range((v->>'startMinute')::integer,(v->>'endMinute')::integer,'[)')),'{}'::int4multirange)
 into exclusions from (
   select v from jsonb_array_elements(pauses) v where special is not null or (v->>'weekday')::integer=extract(dow from day)::integer
   union all select v from jsonb_array_elements(calendar->'blocks') v where v->>'date'=day::text
 ) periods;
 return (openings-exclusions) @> int4range(first_min,last_min,'[)');
end $$;

create function private.booking_quote(s public.merchant_services, c public.merchant_categories, m public.merchants, p public.merchant_booking_settings)
returns text language sql stable set search_path='' as $$
 select md5(jsonb_build_array(s.id,s.updated_at,s.price_krw,s.duration_minutes,s.cleanup_minutes,s.name_en,s.description_en,c.name_en,c.updated_at,m.updated_at,p.confirmation_mode,p.payment_mode,p.updated_at,
 (select coalesce(jsonb_agg(jsonb_build_array(st.id,st.updated_at) order by st.id),'[]'::jsonb)
  from public.merchant_staff st join public.merchant_staff_menus sm on sm.merchant_id=st.merchant_id and sm.staff_id=st.id
  where sm.merchant_id=s.merchant_id and sm.service_id=s.id and st.visibility='visible'))::text)
$$;

create function private.booking_catalog(p_place_id text) returns jsonb
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
 select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'name',s.name,'title',s.title,'introduction',s.introduction,
 'serviceIds',(select coalesce(jsonb_agg(sm.service_id order by sm.service_id),'[]'::jsonb) from public.merchant_staff_menus sm
 where sm.merchant_id=merchant.id and sm.staff_id=s.id and exists(select 1 from jsonb_array_elements(services) v where v->>'id'=sm.service_id::text))) order by s.sort_order,s.id),'[]'::jsonb)
 into staff from public.merchant_staff s where s.merchant_id=merchant.id and s.visibility='visible';
 return jsonb_build_object('status','available','placeId',p_place_id,'merchantName',merchant.display_name,
 'mode',policy.confirmation_mode,'paymentMode',policy.payment_mode,'selectionMode',rules.mode,
 'startDate',rules.start_date,'endDate',rules.end_date,'services',services,'staff',staff);
end $$;

create function private.booking_capacity(tenant uuid, selected_staff uuid, first_at timestamptz, last_at timestamptz, maximum bigint, exclude_id uuid default null)
returns boolean language sql stable set search_path='' as $$
 select maximum>0 and not exists (
   select 1 from public.customer_bookings b where b.merchant_id=tenant and b.status in ('requested','confirmed')
   and b.id is distinct from exclude_id and b.start_at<last_at and b.occupied_until>first_at
   and selected_staff is not null and b.staff_id=selected_staff
 ) and not exists (
   select 1 from (
     select first_at as at union select b.start_at from public.customer_bookings b where b.merchant_id=tenant
     and b.status in ('requested','confirmed') and b.id is distinct from exclude_id and b.start_at>=first_at and b.start_at<last_at
   ) points where (select count(*) from public.customer_bookings b where b.merchant_id=tenant
     and b.status in ('requested','confirmed') and b.id is distinct from exclude_id and b.start_at<=points.at and b.occupied_until>points.at)>=maximum
 )
$$;

create function private.booking_availability(p_place_id text,p_service_id uuid,p_staff_id uuid,p_date date) returns jsonb
language plpgsql security definer set search_path='' as $$
declare catalog jsonb; chosen jsonb; merchant uuid; rules public.merchant_reservation_rules; menu public.merchant_services;
 shop jsonb; staff_calendar jsonb; slots jsonb; midnight timestamptz;
begin
 if p_date is null or p_date<date '0001-01-01' or p_date>date '9999-12-30' then raise exception 'INVALID_REQUEST'; end if;
 catalog:=private.booking_catalog(p_place_id);
 select v into chosen from jsonb_array_elements(catalog->'services') v where v->>'id'=p_service_id::text;
 if catalog->>'status'<>'available' or chosen is null then raise exception 'BOOKING_UNAVAILABLE'; end if;
 select merchant_id into merchant from public.merchant_publications where place_id=p_place_id and published;
 select * into rules from public.merchant_reservation_rules where merchant_id=merchant;
 select * into menu from public.merchant_services where merchant_id=merchant and id=p_service_id;
 select to_jsonb(s) into shop from public.merchant_schedules s where s.merchant_id=merchant;
 if (rules.mode='shop' and p_staff_id is not null) or (rules.mode='staff' and (p_staff_id is null or not exists(
   select 1 from public.merchant_staff s join public.merchant_staff_menus sm on sm.merchant_id=s.merchant_id and sm.staff_id=s.id
   where s.merchant_id=merchant and s.id=p_staff_id and s.visibility='visible' and sm.service_id=p_service_id))) then raise exception 'BOOKING_UNAVAILABLE'; end if;
 if rules.mode='staff' then select to_jsonb(s) into staff_calendar from public.merchant_staff_schedules s where s.merchant_id=merchant and s.staff_id=p_staff_id; end if;
 midnight:=p_date::timestamp at time zone 'Asia/Seoul';
 select coalesce(jsonb_agg(jsonb_build_object('startAt',midnight+minute*interval '1 minute',
 'serviceEndAt',midnight+(minute+menu.duration_minutes)*interval '1 minute',
 'occupiedUntil',midnight+((minute+menu.duration_minutes+menu.cleanup_minutes)::integer)*interval '1 minute','staffId',p_staff_id) order by minute),'[]'::jsonb)
 into slots from generate_series(0,1439,rules.slot_interval_minutes) minute
 where p_date between rules.start_date and rules.end_date
 and midnight+minute*interval '1 minute'>=statement_timestamp()+rules.minimum_lead_minutes*interval '1 minute'
 and private.booking_calendar_fit(shop,p_date,minute,(minute+menu.duration_minutes+menu.cleanup_minutes)::integer)
 and (rules.mode='shop' or private.booking_calendar_fit(staff_calendar,p_date,minute,(minute+menu.duration_minutes+menu.cleanup_minutes)::integer))
 and private.booking_capacity(merchant,p_staff_id,midnight+minute*interval '1 minute',midnight+((minute+menu.duration_minutes+menu.cleanup_minutes)::integer)*interval '1 minute',rules.capacity);
 return jsonb_build_object('slots',slots,'quoteVersion',chosen->>'quoteVersion');
end $$;

create function private.booking_create(p_place_id text,p_service_id uuid,p_staff_id uuid,p_start_at timestamptz,p_quote_version text,
 p_request_id uuid,p_customer_name text,p_phone text,p_notes text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); merchant uuid; fingerprint text; existing public.customer_bookings;
 available jsonb; slot jsonb; catalog jsonb; service jsonb; specialist jsonb; created public.customer_bookings;
begin
 if actor is null then raise exception 'AUTH_REQUIRED'; end if;
 if p_request_id is null or p_service_id is null or p_start_at is null or not isfinite(p_start_at)
 or p_quote_version is null or length(p_quote_version)>256 or p_place_id is null or length(p_place_id)>200
 or p_customer_name is null or length(private.catalog_text(p_customer_name)) not between 1 and 120
 or p_phone is null or length(p_phone)>80 or p_phone !~ '^[0-9+(). -]+$'
 or length(regexp_replace(p_phone,'[^0-9]','','g'))<7 or p_notes is null or length(p_notes)>2000 then raise exception 'INVALID_REQUEST'; end if;
 fingerprint:=md5(jsonb_build_array(p_place_id,p_service_id,p_staff_id,p_start_at,p_quote_version,private.catalog_text(p_customer_name),btrim(p_phone),p_notes)::text);
 -- Idempotency is customer-scoped and serialized even across different merchants.
 perform pg_advisory_xact_lock(hashtextextended(actor::text||':'||p_request_id::text,702021));
 select * into existing from public.customer_bookings where customer_id=actor and request_id=p_request_id;
 if found then
  if existing.request_fingerprint<>fingerprint then raise exception 'BOOKING_CONFLICT'; end if;
  return private.booking_json(existing);
 end if;
 select merchant_id into merchant from public.merchant_publications where place_id=p_place_id and published;
 if merchant is null then raise exception 'BOOKING_UNAVAILABLE'; end if;
 -- Same lock is acquired by ALL configuration mutations and booking transitions.
 perform pg_advisory_xact_lock(hashtextextended(merchant::text,702020));
 catalog:=private.booking_catalog(p_place_id);
 select v into service from jsonb_array_elements(catalog->'services') v where v->>'id'=p_service_id::text;
 if service is null then raise exception 'BOOKING_UNAVAILABLE'; end if;
 if service->>'quoteVersion' is distinct from p_quote_version then raise exception 'STALE_SELECTION'; end if;
 available:=private.booking_availability(p_place_id,p_service_id,p_staff_id,(p_start_at at time zone 'Asia/Seoul')::date);
 select v into slot from jsonb_array_elements(available->'slots') v where (v->>'startAt')::timestamptz=p_start_at;
 if slot is null then raise exception 'SLOT_UNAVAILABLE'; end if;
 select v into specialist from jsonb_array_elements(catalog->'staff') v where v->>'id'=p_staff_id::text;
 insert into public.customer_bookings(merchant_id,customer_id,request_id,request_fingerprint,place_id,service_id,staff_id,
 merchant_name,service_name,staff_name,start_at,service_end_at,occupied_until,total_krw,payment_mode,status,customer_name,phone,notes)
 values(merchant,actor,p_request_id,fingerprint,p_place_id,p_service_id,p_staff_id,catalog->>'merchantName',service->>'name',specialist->>'name',
 p_start_at,(slot->>'serviceEndAt')::timestamptz,(slot->>'occupiedUntil')::timestamptz,(service->>'priceKrw')::bigint,catalog->>'paymentMode',
 case when catalog->>'mode'='instant' then 'confirmed' else 'requested' end,private.catalog_text(p_customer_name),btrim(p_phone),p_notes)
 returning * into created;
 insert into public.customer_booking_events(booking_id,actor_id,action,next_status) values(created.id,actor,'create',created.status);
 return private.booking_json(created);
end $$;

create function private.booking_list(p_partner boolean default false) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); result jsonb;
begin
 if actor is null then raise exception 'AUTH_REQUIRED'; end if;
 if p_partner is null then raise exception 'INVALID_REQUEST'; end if;
 if p_partner and not exists(select 1 from public.merchant_memberships where user_id=actor and revoked_at is null) then raise exception 'PARTNER_FORBIDDEN'; end if;
 select coalesce(jsonb_agg(private.booking_json(b) order by b.start_at desc,b.id),'[]'::jsonb) into result
 from public.customer_bookings b where case when p_partner then exists(select 1 from public.merchant_memberships m
 where m.merchant_id=b.merchant_id and m.user_id=actor and m.revoked_at is null) else b.customer_id=actor end;
 return result;
end $$;

create function private.booking_get(p_id uuid,p_partner boolean default false) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); b public.customer_bookings;
begin
 if actor is null then raise exception 'AUTH_REQUIRED'; end if;
 if p_partner is null then raise exception 'INVALID_REQUEST'; end if;
 select * into b from public.customer_bookings where id=p_id and case when p_partner then exists(select 1 from public.merchant_memberships m
 where m.merchant_id=customer_bookings.merchant_id and m.user_id=actor and m.revoked_at is null) else customer_id=actor end;
 if not found then raise exception 'BOOKING_NOT_FOUND'; end if;
 return private.booking_json(b);
end $$;

create function private.booking_transition(p_id uuid,p_action text,p_partner boolean default false,p_expected_updated_at timestamptz default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); b public.customer_bookings; new_status text; old_status text;
begin
 if actor is null then raise exception 'AUTH_REQUIRED'; end if;
 perform private.booking_get(p_id,p_partner);
 select * into b from public.customer_bookings where id=p_id;
 perform pg_advisory_xact_lock(hashtextextended(b.merchant_id::text,702020));
 -- Recheck ownership after waiting for the lock and read the latest row version.
 perform private.booking_get(p_id,p_partner);
 select * into b from public.customer_bookings where id=p_id for update;
 if p_action is null or (p_partner and p_action not in ('confirm','cancel','complete','no_show')) or (not p_partner and p_action<>'cancel') then raise exception 'INVALID_REQUEST'; end if;
 if p_partner then
  if not exists(select 1 from public.merchants where id=b.merchant_id and status in ('active','onboarding')) then raise exception 'PARTNER_READ_ONLY'; end if;
  if p_expected_updated_at is null or p_expected_updated_at<>b.updated_at then raise exception 'BOOKING_CONFLICT'; end if;
 end if;
 -- Customer cancellation is free before the visit; there has been no online charge.
 -- The booking policy is shown at review. Late cancellation is handled by the venue.
 if not p_partner and b.status='cancelled' and b.cancelled_by='customer' then return private.booking_json(b); end if;
 if p_action='cancel' and b.status in ('requested','confirmed') and (p_partner or b.start_at>clock_timestamp()) then new_status:='cancelled';
 elsif p_action='confirm' and p_partner and b.status='requested' and b.start_at>clock_timestamp() then new_status:='confirmed';
 elsif p_action='complete' and p_partner and b.status='confirmed' and b.start_at<=clock_timestamp() then new_status:='completed';
 elsif p_action='no_show' and p_partner and b.status='confirmed' and b.start_at<=clock_timestamp() then new_status:='no_show';
 else raise exception 'BOOKING_CONFLICT'; end if;
 old_status:=b.status;
 update public.customer_bookings set status=new_status,updated_at=greatest(clock_timestamp(),updated_at+interval '1 microsecond'),
 cancelled_by=case when new_status='cancelled' then case when p_partner then 'merchant' else 'customer' end else null end
 where id=p_id returning * into b;
 insert into public.customer_booking_events(booking_id,actor_id,action,previous_status,next_status) values(b.id,actor,p_action,old_status,new_status);
 return private.booking_json(b);
end $$;

-- Configuration edits share the reservation lock. Existing reservations retain
-- their price/name/duration snapshots; availability immediately uses new values.
create function private.booking_config_lock() returns trigger language plpgsql security definer set search_path='' as $$
declare row_value jsonb; tenant uuid;
begin
 row_value:=case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end;
 tenant:=(case when tg_table_name='merchants' then row_value->>'id' else row_value->>'merchant_id' end)::uuid;
 if tg_op='UPDATE' and (case when tg_table_name='merchants' then to_jsonb(old)->>'id' else to_jsonb(old)->>'merchant_id' end)::uuid<>tenant then
 raise exception 'BOOKING_CONFLICT' using errcode='23514'; end if;
 perform pg_advisory_xact_lock(hashtextextended(tenant::text,702020));
 return case when tg_op='DELETE' then old else new end;
end $$;

create function private.booking_config_guard() returns trigger language plpgsql security definer set search_path='' as $$
declare row_value jsonb; tenant uuid; rules public.merchant_reservation_rules; shop jsonb; staff_calendar jsonb;
 b public.customer_bookings; first_min integer; last_min integer; local_day date; target_staff uuid;
begin
 row_value:=case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end;
 tenant:=(row_value->>'merchant_id')::uuid;
 target_staff:=case when tg_table_name='merchant_staff_schedules' then (row_value->>'staff_id')::uuid else null end;
 select * into rules from public.merchant_reservation_rules where merchant_id=tenant;
 select to_jsonb(s) into shop from public.merchant_schedules s where s.merchant_id=tenant;
 for b in select * from public.customer_bookings where merchant_id=tenant and status in ('requested','confirmed') and occupied_until>clock_timestamp()
 and (target_staff is null or staff_id=target_staff) loop
  local_day:=(b.start_at at time zone 'Asia/Seoul')::date;
  first_min:=extract(epoch from ((b.start_at at time zone 'Asia/Seoul')-local_day::timestamp))::integer/60;
  last_min:=extract(epoch from ((b.occupied_until at time zone 'Asia/Seoul')-local_day::timestamp))::integer/60;
  if rules.merchant_id is null or (rules.mode='staff')<>(b.staff_id is not null)
  or not private.booking_calendar_fit(shop,local_day,first_min,last_min)
  or not private.booking_capacity(tenant,b.staff_id,b.start_at,b.occupied_until,rules.capacity,b.id) then
   raise exception 'Existing bookings conflict with this configuration' using errcode='23514';
  end if;
  if b.staff_id is not null then
   select to_jsonb(s) into staff_calendar from public.merchant_staff_schedules s where s.merchant_id=tenant and s.staff_id=b.staff_id;
   if not private.booking_calendar_fit(staff_calendar,local_day,first_min,last_min) then
    raise exception 'Existing bookings conflict with this staff calendar' using errcode='23514';
   end if;
  end if;
 end loop;
 return null;
end $$;

do $$ declare t text; begin
 foreach t in array array['merchants','merchant_publications','merchant_booking_settings','merchant_categories','merchant_services','merchant_schedules','merchant_reservation_rules','merchant_staff','merchant_staff_menus','merchant_staff_schedules'] loop
 execute format('create trigger a_booking_lock before insert or update or delete on public.%I for each row execute function private.booking_config_lock()',t);
 end loop;
 foreach t in array array['merchant_schedules','merchant_reservation_rules','merchant_staff_schedules'] loop
 execute format('create trigger booking_guard after insert or update or delete on public.%I for each row execute function private.booking_config_guard()',t);
 end loop;
end $$;

-- Public wrappers execute as invoker. The private implementations validate
-- auth.uid()/active merchant membership themselves and use an empty search_path.
create function public.booking_catalog(p_place_id text) returns jsonb language sql set search_path='' as $$select private.booking_catalog(p_place_id)$$;
create function public.booking_availability(p_place_id text,p_service_id uuid,p_staff_id uuid,p_date date) returns jsonb language sql set search_path='' as $$select private.booking_availability(p_place_id,p_service_id,p_staff_id,p_date)$$;
create function public.booking_create(p_place_id text,p_service_id uuid,p_staff_id uuid,p_start_at timestamptz,p_quote_version text,p_request_id uuid,p_customer_name text,p_phone text,p_notes text) returns jsonb language sql set search_path='' as $$select private.booking_create(p_place_id,p_service_id,p_staff_id,p_start_at,p_quote_version,p_request_id,p_customer_name,p_phone,p_notes)$$;
create function public.booking_list(p_partner boolean default false) returns jsonb language sql set search_path='' as $$select private.booking_list(p_partner)$$;
create function public.booking_get(p_id uuid,p_partner boolean default false) returns jsonb language sql set search_path='' as $$select private.booking_get(p_id,p_partner)$$;
create function public.booking_transition(p_id uuid,p_action text,p_partner boolean default false,p_expected_updated_at timestamptz default null) returns jsonb language sql set search_path='' as $$select private.booking_transition(p_id,p_action,p_partner,p_expected_updated_at)$$;

do $$ declare f record; begin
 for f in select p.oid::regprocedure as signature,n.nspname,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname in ('public','private') and p.proname like 'booking_%' loop
 execute format('revoke all on function %s from public,anon,authenticated,service_role',f.signature);
 execute format('grant execute on function %s to service_role',f.signature);
 if f.proname in ('booking_catalog','booking_availability') then
 execute format('grant execute on function %s to anon,authenticated',f.signature);
 elsif f.proname in ('booking_create','booking_list','booking_get','booking_transition') then
 execute format('grant execute on function %s to authenticated',f.signature);
 end if;
 end loop;
end $$;
grant usage on schema private to anon;
notify pgrst,'reload schema';

-- Account deletion erases booking contact details and releases future occupancy.
-- Venue-owned financial/service snapshots remain without a customer identity.
create function private.booking_forget_customer() returns trigger language plpgsql security definer set search_path='' as $$
declare tenant uuid;
begin
 for tenant in select distinct merchant_id from public.customer_bookings where customer_id=old.id order by merchant_id loop
  perform pg_advisory_xact_lock(hashtextextended(tenant::text,702020));
 end loop;
 insert into public.customer_booking_events(booking_id,actor_id,action,previous_status,next_status)
 select id,null,'account_deleted',status,case when status in ('requested','confirmed') then 'cancelled' else status end
 from public.customer_bookings where customer_id=old.id;
 update public.customer_bookings set customer_name='Deleted customer',phone='',notes='',request_fingerprint='',
 status=case when status in ('requested','confirmed') then 'cancelled' else status end,
 cancelled_by=case when status in ('requested','confirmed') then 'customer' else cancelled_by end,
 updated_at=greatest(clock_timestamp(),updated_at+interval '1 microsecond') where customer_id=old.id;
 return old;
end $$;
revoke all on function private.booking_forget_customer() from public,anon,authenticated,service_role;
create trigger booking_forget_customer before delete on auth.users for each row execute function private.booking_forget_customer();
