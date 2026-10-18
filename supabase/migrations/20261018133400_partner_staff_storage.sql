-- Staff are merchant-owned reservation targets, not login accounts. Customer
-- booking remains disabled by the existing merchants constraint.
-- Adding this UNIQUE constraint takes a lock on merchant_services; production
-- rollout requires the separate lock/preflight gate in the implementation plan.
alter table public.merchant_services
  add constraint merchant_services_merchant_id_id_key unique (merchant_id, id);

-- The shop calendar validator supplies numeric bounds, overlap/containment,
-- date validity, entry counts, and the combined 256 KiB payload limit. Staff
-- calendars additionally reject ignored keys and year-zero date blocks.
create function private.partner_staff_calendar_valid(
  hours jsonb, breaks jsonb, blocks jsonb, overrides jsonb
) returns boolean language plpgsql immutable set search_path = '' as $body$
declare
  row_value jsonb;
  kind text;
  required text[];
  source jsonb;
begin
  if not coalesce(private.partner_schedule_valid(hours, breaks, blocks), false) or
     not coalesce(private.partner_overrides_valid(hours, breaks, blocks, overrides), false)
  then return false; end if;

  for kind in select unnest(array['hours', 'breaks', 'blocks']) loop
    source := case kind when 'hours' then hours when 'breaks' then breaks else blocks end;
    required := case when kind = 'blocks' then array['date', 'startMinute', 'endMinute']
      else array['weekday', 'startMinute', 'endMinute'] end;
    for row_value in select value from jsonb_array_elements(source) loop
      if jsonb_typeof(row_value) is distinct from 'object' or
         (select count(*) from jsonb_object_keys(row_value)) <> 3 or
         not (row_value ?& required) or
         (kind = 'blocks' and left(row_value->>'date', 5) = '0000-')
      then return false; end if;
    end loop;
  end loop;

  return true;
exception when others then return false;
end $body$;

revoke all on function private.partner_staff_calendar_valid(jsonb, jsonb, jsonb, jsonb)
  from public, anon, authenticated, service_role;
grant execute on function private.partner_staff_calendar_valid(jsonb, jsonb, jsonb, jsonb)
  to authenticated, postgres, service_role;

create table public.merchant_staff (
  id uuid primary key,
  merchant_id uuid not null references public.merchants(id) on delete restrict,
  name text not null default '' check (length(name) <= 120),
  title text not null default '' check (length(title) <= 120),
  introduction text not null default '' check (length(introduction) <= 1000),
  visibility text not null default 'draft' check (visibility in ('draft', 'visible', 'hidden', 'archived')),
  sort_order bigint not null default 0 check (sort_order between 0 and 9007199254740991),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (merchant_id, id),
  check (visibility <> 'visible' or length(btrim(name)) > 0)
);

create table public.merchant_staff_menus (
  merchant_id uuid not null,
  staff_id uuid not null,
  service_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (merchant_id, staff_id, service_id),
  foreign key (merchant_id, staff_id) references public.merchant_staff(merchant_id, id) on delete restrict,
  foreign key (merchant_id, service_id) references public.merchant_services(merchant_id, id) on delete restrict
);

create table public.merchant_staff_schedules (
  merchant_id uuid not null,
  staff_id uuid not null,
  hours jsonb not null default '[]'::jsonb,
  breaks jsonb not null default '[]'::jsonb,
  blocks jsonb not null default '[]'::jsonb,
  overrides jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (merchant_id, staff_id),
  foreign key (merchant_id, staff_id) references public.merchant_staff(merchant_id, id) on delete restrict,
  check (private.partner_staff_calendar_valid(hours, breaks, blocks, overrides))
);

create index merchant_staff_merchant_sort_idx
  on public.merchant_staff using btree (merchant_id, sort_order, id);
create index merchant_staff_menus_service_idx
  on public.merchant_staff_menus using btree (merchant_id, service_id, staff_id);

alter table public.merchant_staff enable row level security;
alter table public.merchant_staff_menus enable row level security;
alter table public.merchant_staff_schedules enable row level security;

create policy partner_read on public.merchant_staff
  for select to authenticated
  using (exists (
    select 1 from public.merchant_memberships m
    where m.merchant_id = merchant_staff.merchant_id
      and m.user_id = (select auth.uid())
      and m.revoked_at is null
  ));
create policy partner_insert on public.merchant_staff
  for insert to authenticated
  with check (private.partner_can_write(merchant_id));
create policy partner_update on public.merchant_staff
  for update to authenticated
  using (private.partner_can_write(merchant_id))
  with check (private.partner_can_write(merchant_id));

create policy partner_read on public.merchant_staff_menus
  for select to authenticated
  using (exists (
    select 1 from public.merchant_memberships m
    where m.merchant_id = merchant_staff_menus.merchant_id
      and m.user_id = (select auth.uid())
      and m.revoked_at is null
  ));
create policy partner_insert on public.merchant_staff_menus
  for insert to authenticated
  with check (private.partner_can_write(merchant_id));
create policy partner_delete on public.merchant_staff_menus
  for delete to authenticated
  using (private.partner_can_write(merchant_id));

create policy partner_read on public.merchant_staff_schedules
  for select to authenticated
  using (exists (
    select 1 from public.merchant_memberships m
    where m.merchant_id = merchant_staff_schedules.merchant_id
      and m.user_id = (select auth.uid())
      and m.revoked_at is null
  ));
create policy partner_insert on public.merchant_staff_schedules
  for insert to authenticated
  with check (private.partner_can_write(merchant_id));
create policy partner_update on public.merchant_staff_schedules
  for update to authenticated
  using (private.partner_can_write(merchant_id))
  with check (private.partner_can_write(merchant_id));

-- The row lock serializes competing direct Data API inserts for one staff
-- member. The owner check is inside SECURITY DEFINER so it cannot be bypassed
-- through the trigger's elevated table privileges.
create function private.partner_staff_menu_limit()
  returns trigger language plpgsql security definer set search_path = '' as $body$
begin
  if not private.partner_can_write(new.merchant_id) then
    raise exception 'staff menu owner denied' using errcode = '42501';
  end if;
  perform 1 from public.merchant_staff s
    where s.merchant_id = new.merchant_id and s.id = new.staff_id for update;
  if not found then
    raise exception 'staff not found' using errcode = '23503';
  end if;
  if (select count(*) from public.merchant_staff_menus l
      where l.merchant_id = new.merchant_id and l.staff_id = new.staff_id) >= 1000 then
    raise exception 'staff menu limit' using errcode = '23514';
  end if;
  return new;
end $body$;

revoke all on function private.partner_staff_menu_limit()
  from public, anon, authenticated, service_role;
grant execute on function private.partner_staff_menu_limit() to postgres, service_role;

create trigger partner_staff_menu_limit
  before insert on public.merchant_staff_menus
  for each row execute function private.partner_staff_menu_limit();

-- Keep the existing audit shape and actor checks. Child records identify
-- their staff member, while established tables continue to use id or merchant_id.
create or replace function private.partner_audit()
  returns trigger
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
declare before_row jsonb; after_row jsonb; row_value jsonb; tenant uuid; entity uuid; actor uuid; fields text[]; caller_role text;
begin
 before_row:=case when tg_op='INSERT' then '{}'::jsonb else to_jsonb(old) end;
 after_row:=case when tg_op='DELETE' then '{}'::jsonb else to_jsonb(new) end;
 row_value:=case when tg_op='DELETE' then before_row else after_row end;
 tenant:=(case when tg_table_name='merchants' then row_value->>'id' else row_value->>'merchant_id' end)::uuid;
 entity:=coalesce(row_value->>'id',row_value->>'staff_id',row_value->>'merchant_id')::uuid;
 actor:=auth.uid(); caller_role:=current_setting('role',true);
 if actor is not null then
  if not exists(select 1 from public.merchant_memberships m where m.merchant_id=tenant and m.user_id=actor and m.revoked_at is null) then raise exception 'partner audit actor unauthorized' using errcode='42501'; end if;
 elsif not (caller_role in ('postgres','service_role') or (caller_role='none' and session_user='postgres')) then
  raise exception 'partner audit requires an actor or trusted operator' using errcode='42501';
 end if;
 select coalesce(array_agg(k order by k),'{}'::text[]) into fields from (select jsonb_object_keys(before_row || after_row) k) keys
 where k not in ('created_at','updated_at') and (before_row->k) is distinct from (after_row->k);
 if cardinality(fields)=0 then return null; end if;
 insert into public.merchant_audit_events(merchant_id,entity_table,entity_id,action,changed_fields,actor_user_id) values(tenant,tg_table_name,entity,tg_op,fields,actor);
 return null;
end $function$;

create trigger partner_touch before update on public.merchant_staff
  for each row execute function private.partner_touch();
create trigger partner_audit after insert or delete or update on public.merchant_staff
  for each row execute function private.partner_audit();
create trigger partner_audit after insert or delete or update on public.merchant_staff_menus
  for each row execute function private.partner_audit();
create trigger partner_touch before update on public.merchant_staff_schedules
  for each row execute function private.partner_touch();
create trigger partner_audit after insert or delete or update on public.merchant_staff_schedules
  for each row execute function private.partner_audit();

revoke all on table public.merchant_staff, public.merchant_staff_menus, public.merchant_staff_schedules
  from public, anon, authenticated;
grant select on table public.merchant_staff, public.merchant_staff_menus, public.merchant_staff_schedules
  to authenticated;
grant insert (id, merchant_id, name, title, introduction, visibility, sort_order)
  on table public.merchant_staff to authenticated;
grant update (name, title, introduction, visibility, sort_order)
  on table public.merchant_staff to authenticated;
grant insert (merchant_id, staff_id, service_id)
  on table public.merchant_staff_menus to authenticated;
grant delete on table public.merchant_staff_menus to authenticated;
grant insert (merchant_id, staff_id, hours, breaks, blocks, overrides)
  on table public.merchant_staff_schedules to authenticated;
grant update (hours, breaks, blocks, overrides)
  on table public.merchant_staff_schedules to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update
  on table public.merchant_staff, public.merchant_staff_menus, public.merchant_staff_schedules
  to postgres, service_role;
