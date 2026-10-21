-- Partner switch for the customer page photo header (owner request 2026-10-20):
-- a venue can hide the photo area without deleting its photos. Instant field,
-- same path as english_ok/notice. The update RPC also accepts the 4-key request
-- without showPhotos so admin builds and databases can roll out in either order.
alter table public.merchant_store_profiles add column show_photos boolean not null default true;

create or replace function private.store_profile_json(m public.merchants,p public.merchant_store_profiles) returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('contactPhone',m.contact_phone,'contactEmail',m.contact_email,'nameKo',m.display_name,'address',m.address,
  'nameEn',coalesce(p.name_en,''),'introductionKo',coalesce(p.introduction_ko,''),'introductionEn',coalesce(p.introduction_en,''),
  'englishOk',coalesce(p.english_ok,false),'notice',coalesce(p.notice,''),'showPhotos',coalesce(p.show_photos,true),'updatedAt',greatest(m.updated_at,p.updated_at))
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
    (select count(*) from jsonb_object_keys(p_values - 'showPhotos'))<>4 or not (p_values ?& array['contactPhone','contactEmail','englishOk','notice']) or
    jsonb_typeof(p_values->'contactPhone')<>'string' or length(p_values->>'contactPhone')>80 or
    ((p_values->>'contactPhone')<>'' and (p_values->>'contactPhone')!~ '^[0-9+(). -]+$') or
    jsonb_typeof(p_values->'contactEmail')<>'string' or length(p_values->>'contactEmail')>254 or
    ((p_values->>'contactEmail')<>'' and (p_values->>'contactEmail')!~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') or
    jsonb_typeof(p_values->'englishOk')<>'boolean' or (p_values ? 'showPhotos' and jsonb_typeof(p_values->'showPhotos')<>'boolean') or
    jsonb_typeof(p_values->'notice')<>'string' or length(p_values->>'notice')>60 then raise exception 'INVALID_REQUEST'; end if;
   -- Touch merchants only when the contact really changed: merchants.updated_at feeds every open booking
   -- quote, and a photo-switch, notice or English OK save must not send customers back to step 0 (rpc-2).
   if m.contact_phone is distinct from p_values->>'contactPhone' or m.contact_email is distinct from p_values->>'contactEmail' then
    update public.merchants set contact_phone=p_values->>'contactPhone',contact_email=p_values->>'contactEmail' where id=tenant returning * into m;
   end if;
   -- Rollout compatibility: a request without showPhotos (an admin build older than this column) keeps the stored switch.
   insert into public.merchant_store_profiles(merchant_id,english_ok,notice,show_photos) values(tenant,(p_values->>'englishOk')::boolean,p_values->>'notice',coalesce((p_values->>'showPhotos')::boolean,p.show_photos,true))
   on conflict(merchant_id) do update set english_ok=excluded.english_ok,notice=excluded.notice,show_photos=excluded.show_photos returning * into p;
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

-- Quotes follow what the booking catalog shows from the store profile (its English name), not every save
-- of the profile row: instant fields (photo switch, notice, English OK) leave open quotes valid (rpc-2).
create or replace function private.booking_quote(s public.merchant_services, c public.merchant_categories, m public.merchants, p public.merchant_booking_settings)
returns text language sql stable set search_path='' as $$
 select md5(jsonb_build_array(s.id,s.updated_at,s.price_krw,s.duration_minutes,s.cleanup_minutes,s.name_en,s.description_en,c.name_en,c.updated_at,m.updated_at,p.confirmation_mode,p.payment_mode,p.updated_at,(select profile.name_en from public.merchant_store_profiles profile where profile.merchant_id=m.id),
 (select coalesce(jsonb_agg(jsonb_build_array(st.id,st.updated_at) order by st.id),'[]'::jsonb)
  from public.merchant_staff st join public.merchant_staff_menus sm on sm.merchant_id=st.merchant_id and sm.staff_id=st.id
  where sm.merchant_id=s.merchant_id and sm.service_id=s.id and st.visibility='visible'))::text)
$$;
