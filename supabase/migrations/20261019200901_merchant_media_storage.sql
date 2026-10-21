-- Private immutable image objects. Only published active attachments are public;
-- store photographs remain pending until a trusted operator actually reviews them.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('merchant-images','merchant-images',false,5242880,array['image/webp']) on conflict(id) do nothing;
do $$ begin
 if exists(select 1 from storage.buckets where id='merchant-images' and (public or file_size_limit is distinct from 5242880::bigint or allowed_mime_types is distinct from array['image/webp'])) then
  raise exception 'merchant-images bucket configuration mismatch';
 end if;
end $$;

create table public.merchant_media (
 id uuid primary key default gen_random_uuid(),
 merchant_id uuid not null references public.merchants(id) on delete restrict,
 request_id uuid not null,
 request_fingerprint text not null,
 target_kind text not null check (target_kind in ('store','menu','staff')),
 target_id uuid,
 state text not null default 'uploading' check (state in ('uploading','pending','active','archived','deleted')),
 object_path text not null unique,
 width integer not null check (width between 1 and 2048),
 height integer not null check (height between 1 and 2048),
 byte_size integer not null check (byte_size between 1 and 5242880),
 created_at timestamptz not null default clock_timestamp(),
 updated_at timestamptz not null default clock_timestamp(),
 unique(merchant_id,request_id),
 check ((target_kind='store')=(target_id is null)),
 check (object_path=merchant_id::text||'/'||id::text||'.webp')
);
create index merchant_media_target_idx on public.merchant_media(merchant_id,target_kind,target_id,state);
alter table public.merchant_media enable row level security;
revoke all on public.merchant_media from public,anon,authenticated;
grant all on public.merchant_media to service_role;
create trigger partner_touch before update on public.merchant_media for each row execute function private.partner_touch();
create trigger partner_audit after insert or update or delete on public.merchant_media for each row execute function private.partner_audit();

create function private.merchant_media_public(p_path text) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.merchant_media a join public.merchants m on m.id=a.merchant_id
 join public.merchant_publications p on p.merchant_id=m.id where a.object_path=p_path and a.state='active' and m.status='active' and p.published
 and (a.target_kind='store' or (a.target_kind='staff' and exists(select 1 from public.merchant_staff s where s.merchant_id=m.id and s.id=a.target_id and s.visibility='visible'))
 or (a.target_kind='menu' and exists(select 1 from public.merchant_services s join public.merchant_categories c on c.merchant_id=s.merchant_id and c.id=s.category_id
 where s.merchant_id=m.id and s.id=a.target_id and s.visibility='visible' and c.visibility='visible'))))
$$;
create function private.merchant_media_owned(p_path text,p_action text) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.merchant_media a join public.merchant_memberships mm on mm.merchant_id=a.merchant_id
 join public.merchants m on m.id=a.merchant_id join auth.users u on u.id=mm.user_id
 where a.object_path=p_path and mm.user_id=auth.uid() and mm.revoked_at is null and not coalesce(u.is_anonymous,false)
 and (p_action='read' or (m.status in ('active','onboarding') and
 ((p_action='upload' and a.state='uploading') or (p_action='delete' and a.state in ('uploading','deleted'))))))
$$;
create policy merchant_images_insert on storage.objects for insert to authenticated
 with check (bucket_id='merchant-images' and private.merchant_media_owned(name,'upload'));
create policy merchant_images_read on storage.objects for select to authenticated
 using (bucket_id='merchant-images' and private.merchant_media_owned(name,'read'));
create policy merchant_images_public_read on storage.objects for select to anon,authenticated
 using (bucket_id='merchant-images' and private.merchant_media_public(name));
create policy merchant_images_delete on storage.objects for delete to authenticated
 using (bucket_id='merchant-images' and private.merchant_media_owned(name,'delete'));

create function private.merchant_media_json(a public.merchant_media) returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('id',a.id,'targetKind',a.target_kind,'targetId',a.target_id,'status',a.state,'objectPath',a.object_path,
  'width',a.width,'height',a.height,'createdAt',a.created_at,'updatedAt',a.updated_at)
$$;
create function private.partner_media_list(p_target_kind text default null,p_target_id uuid default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare tenant uuid:=private.partner_booking_merchant(); result jsonb;
begin
 if (p_target_kind is null and p_target_id is not null) or (p_target_kind is not null and (p_target_kind not in ('store','menu','staff') or (p_target_kind='store')<>(p_target_id is null))) then raise exception 'INVALID_REQUEST'; end if;
 select coalesce(jsonb_agg(private.merchant_media_json(a) order by a.created_at desc,a.id),'[]'::jsonb) into result
 from public.merchant_media a where a.merchant_id=tenant and a.state in ('pending','active')
 and (p_target_kind is null or (a.target_kind=p_target_kind and a.target_id is not distinct from p_target_id));
 return result;
end $$;
create function private.partner_media_get(p_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare tenant uuid:=private.partner_booking_merchant(); a public.merchant_media;
begin
 select * into a from public.merchant_media where id=p_id and merchant_id=tenant and state in ('pending','active');
 if not found then raise exception 'MEDIA_NOT_FOUND'; end if;
 return private.merchant_media_json(a);
end $$;
create function private.partner_media_prepare(p_request_id uuid,p_target_kind text,p_target_id uuid,p_fingerprint text,p_width integer,p_height integer,p_byte_size integer) returns jsonb
language plpgsql security definer set search_path='' as $$
declare tenant uuid:=private.partner_booking_merchant(true); a public.merchant_media; media_id uuid:=gen_random_uuid();
begin
 if p_request_id is null or p_target_kind is null or p_target_kind not in ('store','menu','staff') or (p_target_kind='store')<>(p_target_id is null)
 or p_fingerprint is null or p_fingerprint !~ '^[a-f0-9]{64}$' or p_width is null or p_width not between 1 and 2048
 or p_height is null or p_height not between 1 and 2048 or p_byte_size is null or p_byte_size not between 1 and 5242880 then raise exception 'INVALID_REQUEST'; end if;
 perform pg_advisory_xact_lock(hashtextextended(tenant::text,702020));
 if private.partner_booking_merchant(true)<>tenant then raise exception 'PARTNER_FORBIDDEN'; end if;
 select * into a from public.merchant_media where merchant_id=tenant and request_id=p_request_id;
 if found then
  if a.request_fingerprint<>p_fingerprint or a.target_kind<>p_target_kind or a.target_id is distinct from p_target_id or a.width<>p_width or a.height<>p_height or a.byte_size<>p_byte_size or a.state in ('deleted','archived') then raise exception 'BOOKING_CONFLICT'; end if;
  return private.merchant_media_json(a);
 end if;
 if (p_target_kind='menu' and not exists(select 1 from public.merchant_services where merchant_id=tenant and id=p_target_id))
 or (p_target_kind='staff' and not exists(select 1 from public.merchant_staff where merchant_id=tenant and id=p_target_id)) then raise exception 'MEDIA_NOT_FOUND'; end if;
 if p_target_kind='store' and (select count(*) from public.merchant_media where merchant_id=tenant and target_kind='store' and state in ('pending','active','uploading'))>=30 then raise exception 'MEDIA_LIMIT_EXCEEDED'; end if;
 insert into public.merchant_media(id,merchant_id,request_id,request_fingerprint,target_kind,target_id,object_path,width,height,byte_size)
 values(media_id,tenant,p_request_id,p_fingerprint,p_target_kind,p_target_id,tenant::text||'/'||media_id::text||'.webp',p_width,p_height,p_byte_size) returning * into a;
 return private.merchant_media_json(a);
end $$;
create function private.partner_media_finalize(p_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare tenant uuid:=private.partner_booking_merchant(true); a public.merchant_media;
begin
 perform pg_advisory_xact_lock(hashtextextended(tenant::text,702020));
 if private.partner_booking_merchant(true)<>tenant then raise exception 'PARTNER_FORBIDDEN'; end if;
 select * into a from public.merchant_media where id=p_id and merchant_id=tenant for update;
 if not found then raise exception 'MEDIA_NOT_FOUND'; end if;
 if a.state in ('pending','active') then return private.merchant_media_json(a); end if;
 if a.state<>'uploading' then raise exception 'BOOKING_CONFLICT'; end if;
 if not exists(select 1 from storage.objects where bucket_id='merchant-images' and name=a.object_path
  and metadata->>'mimetype'='image/webp' and (metadata->>'size')::bigint=a.byte_size) then raise exception 'MEDIA_UPLOAD_INCOMPLETE'; end if;
 if a.target_kind in ('menu','staff') then
  update public.merchant_media set state='archived' where merchant_id=tenant and target_kind=a.target_kind and target_id=a.target_id and state='active';
 end if;
 update public.merchant_media set state=case when target_kind='store' then 'pending' else 'active' end where id=p_id returning * into a;
 return private.merchant_media_json(a);
end $$;
create function private.partner_media_delete(p_id uuid,p_expected_updated_at timestamptz) returns jsonb language plpgsql security definer set search_path='' as $$
declare tenant uuid:=private.partner_booking_merchant(true); a public.merchant_media;
begin
 if p_expected_updated_at is null or not isfinite(p_expected_updated_at) then raise exception 'INVALID_REQUEST'; end if;
 perform pg_advisory_xact_lock(hashtextextended(tenant::text,702020));
 if private.partner_booking_merchant(true)<>tenant then raise exception 'PARTNER_FORBIDDEN'; end if;
 select * into a from public.merchant_media where id=p_id and merchant_id=tenant for update;
 if not found then raise exception 'MEDIA_NOT_FOUND'; end if;
 if a.state='deleted' then return private.merchant_media_json(a); end if;
 if a.updated_at<>p_expected_updated_at then raise exception 'BOOKING_CONFLICT'; end if;
 update public.merchant_media set state='deleted' where id=p_id returning * into a;
 return private.merchant_media_json(a);
end $$;
create function private.public_merchant_media(p_place_id text,p_id uuid default null) returns jsonb
language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(private.merchant_media_json(a) order by a.created_at desc,a.id),'[]'::jsonb)
 from public.merchant_media a join public.merchant_publications p on p.merchant_id=a.merchant_id
 where p.place_id=p_place_id and (p_id is null or a.id=p_id) and private.merchant_media_public(a.object_path)
$$;

create function public.partner_media_list(p_target_kind text default null,p_target_id uuid default null) returns jsonb language sql set search_path='' as $$select private.partner_media_list(p_target_kind,p_target_id)$$;
create function public.partner_media_get(p_id uuid) returns jsonb language sql set search_path='' as $$select private.partner_media_get(p_id)$$;
create function public.partner_media_prepare(p_request_id uuid,p_target_kind text,p_target_id uuid,p_fingerprint text,p_width integer,p_height integer,p_byte_size integer) returns jsonb language sql set search_path='' as $$select private.partner_media_prepare(p_request_id,p_target_kind,p_target_id,p_fingerprint,p_width,p_height,p_byte_size)$$;
create function public.partner_media_finalize(p_id uuid) returns jsonb language sql set search_path='' as $$select private.partner_media_finalize(p_id)$$;
create function public.partner_media_delete(p_id uuid,p_expected_updated_at timestamptz) returns jsonb language sql set search_path='' as $$select private.partner_media_delete(p_id,p_expected_updated_at)$$;
create function public.public_merchant_media(p_place_id text,p_id uuid default null) returns jsonb language sql set search_path='' as $$select private.public_merchant_media(p_place_id,p_id)$$;

do $$ declare f record; begin
 for f in select p.oid::regprocedure as signature,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname in ('public','private') and (p.proname like 'partner_media_%' or p.proname in ('merchant_media_public','merchant_media_owned','merchant_media_json','public_merchant_media')) loop
  execute format('revoke all on function %s from public,anon,authenticated,service_role',f.signature);
  execute format('grant execute on function %s to service_role',f.signature);
  if f.proname<>'merchant_media_json' then execute format('grant execute on function %s to authenticated',f.signature); end if;
  if f.proname in ('merchant_media_public','public_merchant_media') then execute format('grant execute on function %s to anon',f.signature); end if;
 end loop;
end $$;
notify pgrst,'reload schema';
