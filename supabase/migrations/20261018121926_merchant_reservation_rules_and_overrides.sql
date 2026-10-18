-- Booking policy is explicit merchant input. It does not activate customer booking.
create table public.merchant_reservation_rules (
  merchant_id uuid primary key references public.merchants(id) on delete restrict,
  mode text not null check (mode in ('shop', 'staff')),
  capacity bigint not null check (capacity between 1 and 9007199254740991),
  start_date date not null,
  end_date date not null,
  minimum_lead_minutes integer not null check (minimum_lead_minutes between 0 and 525600),
  slot_interval_minutes integer not null check (slot_interval_minutes between 1 and 1440),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint merchant_reservation_rules_start_date_check check (start_date between date '0001-01-01' and date '9999-12-31'),
  constraint merchant_reservation_rules_end_date_check check (end_date between date '0001-01-01' and date '9999-12-31'),
  constraint merchant_reservation_rules_date_order_check check (start_date <= end_date)
);

alter table public.merchant_reservation_rules enable row level security;

create policy partner_read on public.merchant_reservation_rules
  for select to authenticated
  using (exists (
    select 1 from public.merchant_memberships m
    where m.merchant_id = merchant_reservation_rules.merchant_id
      and m.user_id = (select auth.uid())
      and m.revoked_at is null
  ));

create policy partner_insert on public.merchant_reservation_rules
  for insert to authenticated
  with check (private.partner_can_write(merchant_id));

create policy partner_update on public.merchant_reservation_rules
  for update to authenticated
  using (private.partner_can_write(merchant_id))
  with check (private.partner_can_write(merchant_id));

create trigger partner_touch
  before update on public.merchant_reservation_rules
  for each row execute function private.partner_touch();

create trigger partner_audit
  after insert or delete or update on public.merchant_reservation_rules
  for each row execute function private.partner_audit();

revoke all on table public.merchant_reservation_rules from public, anon, authenticated;
grant select on table public.merchant_reservation_rules to authenticated;
grant insert (merchant_id, mode, capacity, start_date, end_date, minimum_lead_minutes, slot_interval_minutes)
  on table public.merchant_reservation_rules to authenticated;
grant update (mode, capacity, start_date, end_date, minimum_lead_minutes, slot_interval_minutes)
  on table public.merchant_reservation_rules to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update
  on table public.merchant_reservation_rules to postgres, service_role;

-- Each special date replaces weekly openings/breaks; date blocks remain separate.
create or replace function private.partner_overrides_valid(
  hours jsonb, breaks jsonb, blocks jsonb, overrides jsonb
) returns boolean language plpgsql immutable set search_path = '' as $body$
declare
  item jsonb;
  period jsonb;
  dates text[] := array[]::text[];
  day_key text;
  yr integer;
  mo integer;
  dy integer;
  max_day integer;
  special_hours jsonb;
  special_breaks jsonb;
begin
  if jsonb_typeof(overrides) is distinct from 'array' then return false; end if;
  if jsonb_array_length(overrides) > 366 or
     octet_length(jsonb_build_object('hours', hours, 'breaks', breaks, 'blocks', blocks, 'overrides', overrides)::text) > 262144
  then return false; end if;

  for item in select value from jsonb_array_elements(overrides) loop
    if jsonb_typeof(item) is distinct from 'object' or
       (select count(*) from jsonb_object_keys(item)) <> 3 or
       not (item ?& array['date', 'hours', 'breaks']) or
       jsonb_typeof(item->'date') is distinct from 'string' or
       jsonb_typeof(item->'hours') is distinct from 'array' or
       jsonb_typeof(item->'breaks') is distinct from 'array'
    then return false; end if;

    day_key := item->>'date';
    if day_key !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' or day_key = any(dates) then return false; end if;
    yr := substring(day_key, 1, 4)::integer;
    mo := substring(day_key, 6, 2)::integer;
    dy := substring(day_key, 9, 2)::integer;
    if yr < 1 or mo < 1 or mo > 12 then return false; end if;
    max_day := case when mo = 2 then
        case when yr % 400 = 0 or (yr % 4 = 0 and yr % 100 <> 0) then 29 else 28 end
      when mo in (4, 6, 9, 11) then 30 else 31 end;
    if dy < 1 or dy > max_day then return false; end if;
    dates := array_append(dates, day_key);

    if jsonb_array_length(item->'hours') > 128 or jsonb_array_length(item->'breaks') > 128
    then return false; end if;
    for period in
      select value from jsonb_array_elements(item->'hours')
      union all
      select value from jsonb_array_elements(item->'breaks')
    loop
      if jsonb_typeof(period) is distinct from 'object' or
         (select count(*) from jsonb_object_keys(period)) <> 2 or
         not (period ?& array['startMinute', 'endMinute'])
      then return false; end if;
    end loop;

    select coalesce(jsonb_agg(value || jsonb_build_object('weekday', 0)), '[]'::jsonb)
      into special_hours from jsonb_array_elements(item->'hours');
    select coalesce(jsonb_agg(value || jsonb_build_object('weekday', 0)), '[]'::jsonb)
      into special_breaks from jsonb_array_elements(item->'breaks');
    if not coalesce(private.partner_schedule_valid(special_hours, special_breaks, '[]'::jsonb), false)
    then return false; end if;
  end loop;
  return true;
exception when others then return false;
end $body$;

revoke all on function private.partner_overrides_valid(jsonb, jsonb, jsonb, jsonb)
  from public, anon, authenticated, service_role;
grant execute on function private.partner_overrides_valid(jsonb, jsonb, jsonb, jsonb)
  to authenticated, postgres, service_role;

alter table public.merchant_schedules
  add column overrides jsonb not null default '[]'::jsonb;
alter table public.merchant_schedules
  add constraint merchant_schedules_overrides_check
  check (private.partner_overrides_valid(hours, breaks, blocks, overrides));
revoke all (overrides) on table public.merchant_schedules from public, anon, authenticated;
grant insert (overrides), update (overrides) on table public.merchant_schedules to authenticated;
