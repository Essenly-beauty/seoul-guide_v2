-- Merchant-only customer notes and participant-only in-app booking messages.
-- No email, SMS, push or external dispatch is performed by these operations.
alter table public.merchant_booking_customers
 add column notes text not null default '' check (length(notes)<=2000),
 add column updated_at timestamptz not null default now();
create trigger partner_touch before update on public.merchant_booking_customers for each row execute function private.partner_touch();
alter table public.customer_bookings add column customer_read_at timestamptz, add column merchant_read_at timestamptz;

create table public.booking_messages (
 id uuid primary key default gen_random_uuid(),
 booking_id uuid not null references public.customer_bookings(id) on delete restrict,
 sender_id uuid references auth.users(id) on delete set null,
 sender text not null check (sender in ('customer','merchant')),
 request_id uuid not null,
 body text not null check (length(btrim(body)) between 1 and 2000),
 created_at timestamptz not null default clock_timestamp(),
 unique(booking_id,sender_id,request_id)
);
create index booking_messages_thread_idx on public.booking_messages(booking_id,created_at,id);
create index booking_messages_sender_idx on public.booking_messages(sender_id);
alter table public.booking_messages enable row level security;
revoke all on public.booking_messages from public,anon,authenticated;
grant all on public.booking_messages to service_role;

create function private.partner_customer_note(p_id uuid,p_notes text default null,p_expected_updated_at timestamptz default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare tenant uuid:=private.partner_booking_merchant(p_notes is not null); c public.merchant_booking_customers;
begin
 if (p_notes is null)<>(p_expected_updated_at is null) or length(p_notes)>2000 or
  (p_expected_updated_at is not null and not isfinite(p_expected_updated_at)) then raise exception 'INVALID_REQUEST'; end if;
 select * into c from public.merchant_booking_customers where id=p_id and merchant_id=tenant;
 if not found then raise exception 'CUSTOMER_NOT_FOUND'; end if;
 if p_notes is not null then
  perform pg_advisory_xact_lock(hashtextextended(tenant::text,702020));
  if private.partner_booking_merchant(true)<>tenant then raise exception 'PARTNER_FORBIDDEN'; end if;
  select * into c from public.merchant_booking_customers where id=p_id and merchant_id=tenant for update;
  if not found then raise exception 'CUSTOMER_NOT_FOUND'; end if;
  if c.updated_at<>p_expected_updated_at then raise exception 'BOOKING_CONFLICT'; end if;
  update public.merchant_booking_customers set notes=p_notes where id=p_id returning * into c;
 end if;
 return jsonb_build_object('id',c.id,'notes',c.notes,'updatedAt',c.updated_at);
end $$;

create function private.booking_message_access(p_id uuid,p_partner boolean,p_write boolean default false) returns public.customer_bookings
language plpgsql security definer set search_path='' as $$
declare b public.customer_bookings; tenant uuid;
begin
 if auth.uid() is null or not exists(select 1 from auth.users where id=auth.uid() and not coalesce(is_anonymous,false)) then raise exception 'AUTH_REQUIRED'; end if;
 if p_partner is null or p_write is null then raise exception 'INVALID_REQUEST'; end if;
 if p_partner then
  tenant:=private.partner_booking_merchant(p_write);
  select * into b from public.customer_bookings where id=p_id and merchant_id=tenant;
 else
  select * into b from public.customer_bookings where id=p_id and customer_id=auth.uid();
 end if;
 if b.id is null then raise exception 'BOOKING_NOT_FOUND'; end if;
 if p_write and (b.source<>'app' or b.customer_id is null or not exists(select 1 from public.merchants where id=b.merchant_id and status in ('active','onboarding'))) then
  raise exception 'BOOKING_MESSAGES_UNAVAILABLE';
 end if;
 return b;
end $$;
create function private.booking_message_json(m public.booking_messages) returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('id',m.id,'bookingId',m.booking_id,'body',m.body,'sender',m.sender,'createdAt',m.created_at)
$$;
create function private.booking_messages(p_id uuid,p_partner boolean default false,p_body text default null,p_request_id uuid default null,p_read_at timestamptz default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare b public.customer_bookings; existing public.booking_messages; result jsonb; tenant uuid;
begin
 if (p_body is null)<>(p_request_id is null) or (p_body is not null and (length(btrim(p_body)) not between 1 and 2000 or p_read_at is not null))
 or (p_read_at is not null and not isfinite(p_read_at)) then raise exception 'INVALID_REQUEST'; end if;
 b:=private.booking_message_access(p_id,p_partner,p_body is not null);
 if p_body is not null or p_read_at is not null then
  perform pg_advisory_xact_lock(hashtextextended(b.merchant_id::text,702020));
  b:=private.booking_message_access(p_id,p_partner,p_body is not null);
  if p_body is not null then
   select * into existing from public.booking_messages where booking_id=p_id and sender_id=auth.uid() and request_id=p_request_id;
   if found then
    if existing.body<>btrim(p_body) then raise exception 'BOOKING_CONFLICT'; end if;
   else
    insert into public.booking_messages(booking_id,sender_id,sender,request_id,body)
    values(p_id,auth.uid(),case when p_partner then 'merchant' else 'customer' end,p_request_id,btrim(p_body));
   end if;
  else
   -- Monotonic caller-only receipts. A future timestamp cannot hide new messages.
   if p_partner then
    update public.customer_bookings set merchant_read_at=greatest(merchant_read_at,least(p_read_at,clock_timestamp())) where id=p_id returning * into b;
   else
    update public.customer_bookings set customer_read_at=greatest(customer_read_at,least(p_read_at,clock_timestamp())) where id=p_id returning * into b;
   end if;
  end if;
 end if;
 select coalesce(jsonb_agg(private.booking_message_json(m) order by m.created_at,m.id),'[]'::jsonb) into result
 from public.booking_messages m where m.booking_id=p_id;
 return jsonb_build_object('availability',case when b.source='app' and b.customer_id is not null and exists(select 1 from public.merchants where id=b.merchant_id and status in ('active','onboarding')) then 'available' else 'unavailable' end,
  'messages',result,'readState',jsonb_build_object('customerReadAt',b.customer_read_at,'merchantReadAt',b.merchant_read_at));
end $$;

create function private.partner_message_threads() returns jsonb
language plpgsql security definer set search_path='' as $$
declare tenant uuid:=private.partner_booking_merchant(); result jsonb;
begin
 select coalesce(jsonb_agg(jsonb_build_object('bookingId',b.id,'lastMessage',private.booking_message_json(last_message),
  'unreadCount',(select count(*) from public.booking_messages m where m.booking_id=b.id and m.sender='customer' and (b.merchant_read_at is null or m.created_at>b.merchant_read_at)),
  'readState',jsonb_build_object('customerReadAt',b.customer_read_at,'merchantReadAt',b.merchant_read_at)) order by last_message.created_at desc,b.id),'[]'::jsonb)
 into result from public.customer_bookings b cross join lateral (
  select m.* from public.booking_messages m where m.booking_id=b.id order by m.created_at desc,m.id desc limit 1
 ) last_message where b.merchant_id=tenant;
 return result;
end $$;

create function private.booking_communications_export() returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); messages jsonb; notes jsonb;
begin
 if actor is null or not exists(select 1 from auth.users where id=actor and not coalesce(is_anonymous,false)) then raise exception 'AUTH_REQUIRED'; end if;
 select coalesce(jsonb_agg(private.booking_message_json(m) order by m.created_at,m.id),'[]'::jsonb) into messages
 from public.booking_messages m join public.customer_bookings b on b.id=m.booking_id where b.customer_id=actor or m.sender_id=actor;
 select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'merchantName',m.display_name,'notes',c.notes,'updatedAt',c.updated_at) order by c.id),'[]'::jsonb) into notes
 from public.merchant_booking_customers c join public.merchants m on m.id=c.merchant_id where c.auth_customer_id=actor;
 return jsonb_build_object('messages',messages,'customerNotes',notes);
end $$;
create function private.booking_forget_communications() returns trigger language plpgsql security definer set search_path='' as $$
declare tenant uuid;
begin
 for tenant in select distinct b.merchant_id from public.customer_bookings b
 where b.customer_id=old.id or exists(select 1 from public.booking_messages m where m.booking_id=b.id and m.sender_id=old.id) order by b.merchant_id loop
  perform pg_advisory_xact_lock(hashtextextended(tenant::text,702020));
 end loop;
 delete from public.booking_messages m where m.sender_id=old.id or exists(select 1 from public.customer_bookings b where b.id=m.booking_id and b.customer_id=old.id);
 update public.customer_bookings set customer_read_at=null,merchant_read_at=null where customer_id=old.id;
 -- Customer note/identity rows are removed by auth_customer_id ON DELETE CASCADE.
 return old;
end $$;
create trigger a_booking_forget_communications before delete on auth.users for each row execute function private.booking_forget_communications();

create function public.partner_customer_note(p_id uuid,p_notes text default null,p_expected_updated_at timestamptz default null) returns jsonb
 language sql set search_path='' as $$select private.partner_customer_note(p_id,p_notes,p_expected_updated_at)$$;
create function public.booking_messages(p_id uuid,p_partner boolean default false,p_body text default null,p_request_id uuid default null,p_read_at timestamptz default null) returns jsonb
 language sql set search_path='' as $$select private.booking_messages(p_id,p_partner,p_body,p_request_id,p_read_at)$$;
create function public.partner_message_threads() returns jsonb language sql set search_path='' as $$select private.partner_message_threads()$$;
create function public.booking_communications_export() returns jsonb language sql set search_path='' as $$select private.booking_communications_export()$$;

do $$ declare f record; begin
 for f in select p.oid::regprocedure as signature,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname in ('public','private') and p.proname in ('partner_customer_note','booking_message_access','booking_message_json','booking_messages','partner_message_threads','booking_communications_export','booking_forget_communications') loop
  execute format('revoke all on function %s from public,anon,authenticated,service_role',f.signature);
  execute format('grant execute on function %s to service_role',f.signature);
  if f.proname in ('partner_customer_note','booking_messages','partner_message_threads','booking_communications_export') then
   execute format('grant execute on function %s to authenticated',f.signature);
  end if;
 end loop;
end $$;
notify pgrst,'reload schema';
