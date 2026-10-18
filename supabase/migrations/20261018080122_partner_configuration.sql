set local check_function_bodies = off;

create schema "private";

create table "public"."merchant_audit_events" (
  "id"             uuid                     not null default gen_random_uuid(),
  "merchant_id"    uuid                     not null,
  "entity_table"   text                     not null,
  "entity_id"      uuid                     not null,
  "action"         text                     not null,
  "changed_fields" text[]                   not null,
  "actor_user_id"  uuid,
  "created_at"     timestamp with time zone not null default now(),
  constraint "merchant_audit_events_action_check" check ((action = ANY (ARRAY['INSERT'::text, 'UPDATE'::text, 'DELETE'::text]))),
  constraint "merchant_audit_events_pkey" primary key (id)
);

alter table "public"."merchant_audit_events"
  enable row level security;

create table "public"."merchant_categories" (
  "id"          uuid                     not null default gen_random_uuid(),
  "merchant_id" uuid                     not null,
  "name_ko"     text                     not null default ''::text,
  "name_en"     text                     not null default ''::text,
  "visibility"  text                     not null default 'draft'::text,
  "sort_order"  bigint                   not null default 0,
  "created_at"  timestamp with time zone not null default now(),
  "updated_at"  timestamp with time zone not null default now(),
  constraint "merchant_categories_merchant_id_id_key" unique (merchant_id, id),
  constraint "merchant_categories_name_en_check" check ((length(name_en) <= 120)),
  constraint "merchant_categories_name_ko_check" check ((length(name_ko) <= 120)),
  constraint "merchant_categories_pkey" primary key (id),
  constraint "merchant_categories_sort_order_check" check (((sort_order >= 0) AND (sort_order <= '9007199254740991'::bigint))),
  constraint "merchant_categories_visibility_check" check ((visibility = ANY (ARRAY['draft'::text, 'visible'::text, 'hidden'::text, 'archived'::text])))
);

alter table "public"."merchant_categories"
  enable row level security;

create table "public"."merchant_memberships" (
  "merchant_id" uuid                     not null,
  "user_id"     uuid                     not null,
  "revoked_at"  timestamp with time zone,
  "created_at"  timestamp with time zone not null default now(),
  "updated_at"  timestamp with time zone not null default now(),
  constraint "merchant_memberships_pkey" primary key (merchant_id),
  constraint "merchant_memberships_user_id_key" unique (user_id)
);

alter table "public"."merchant_memberships"
  enable row level security;

create table "public"."merchant_schedules" (
  "merchant_id" uuid                     not null,
  "hours"       jsonb                    not null default '[]'::jsonb,
  "breaks"      jsonb                    not null default '[]'::jsonb,
  "blocks"      jsonb                    not null default '[]'::jsonb,
  "created_at"  timestamp with time zone not null default now(),
  "updated_at"  timestamp with time zone not null default now(),
  constraint "merchant_schedules_pkey" primary key (merchant_id)
);

alter table "public"."merchant_schedules"
  enable row level security;

create table "public"."merchant_services" (
  "id"               uuid                     not null default gen_random_uuid(),
  "merchant_id"      uuid                     not null,
  "category_id"      uuid                     not null,
  "name_ko"          text                     not null default ''::text,
  "name_en"          text                     not null default ''::text,
  "description_ko"   text                     not null default ''::text,
  "description_en"   text                     not null default ''::text,
  "price_krw"        bigint,
  "deposit_krw"      bigint,
  "duration_minutes" bigint,
  "cleanup_minutes"  bigint                   not null default 0,
  "sort_order"       bigint                   not null default 0,
  "visibility"       text                     not null default 'draft'::text,
  "created_at"       timestamp with time zone not null default now(),
  "updated_at"       timestamp with time zone not null default now(),
  constraint "merchant_services_check" check ((deposit_krw <= price_krw)),
  constraint "merchant_services_cleanup_minutes_check" check (((cleanup_minutes >= 0) AND (cleanup_minutes <= '9007199254740991'::bigint))),
  constraint "merchant_services_deposit_krw_check" check (((deposit_krw >= 1) AND (deposit_krw <= '9007199254740991'::bigint))),
  constraint "merchant_services_description_en_check" check ((length(description_en) <= 4000)),
  constraint "merchant_services_description_ko_check" check ((length(description_ko) <= 4000)),
  constraint "merchant_services_duration_minutes_check" check (((duration_minutes >= 1) AND (duration_minutes <= '9007199254740991'::bigint))),
  constraint "merchant_services_name_en_check" check ((length(name_en) <= 120)),
  constraint "merchant_services_name_ko_check" check ((length(name_ko) <= 120)),
  constraint "merchant_services_pkey" primary key (id),
  constraint "merchant_services_price_krw_check" check (((price_krw >= 1) AND (price_krw <= '9007199254740991'::bigint))),
  constraint "merchant_services_sort_order_check" check (((sort_order >= 0) AND (sort_order <= '9007199254740991'::bigint))),
  constraint "merchant_services_visibility_check" check ((visibility = ANY (ARRAY['draft'::text, 'visible'::text, 'hidden'::text, 'archived'::text])))
);

alter table "public"."merchant_services"
  enable row level security;

create table "public"."merchants" (
  "id"              uuid                     not null default gen_random_uuid(),
  "display_name"    text                     not null default ''::text,
  "contact_email"   text                     not null default ''::text,
  "contact_phone"   text                     not null default ''::text,
  "address"         text                     not null default ''::text,
  "business_types"  text[]                   not null default '{}'::text[],
  "status"          text                     not null default 'onboarding'::text,
  "booking_enabled" boolean                  not null default false,
  "created_at"      timestamp with time zone not null default now(),
  "updated_at"      timestamp with time zone not null default now(),
  constraint "merchants_address_check" check ((length(address) <= 500)),
  constraint "merchants_booking_enabled_check" check ((booking_enabled = false)),
  constraint "merchants_business_types_check"
    check (((business_types <@ ARRAY['hair'::text, 'nail'::text, 'head_spa'::text]) AND (array_position(business_types, NULL::text) IS NULL))),
  constraint "merchants_contact_email_check" check ((length(contact_email) <= 320)),
  constraint "merchants_contact_phone_check" check ((length(contact_phone) <= 80)),
  constraint "merchants_display_name_check" check ((length(display_name) <= 120)),
  constraint "merchants_pkey" primary key (id),
  constraint "merchants_status_check" check ((status = ANY (ARRAY['onboarding'::text, 'active'::text, 'suspended'::text, 'closed'::text])))
);

alter table "public"."merchants"
  enable row level security;

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
 entity:=coalesce(row_value->>'id',row_value->>'merchant_id')::uuid;
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

create or replace function private.partner_can_write (
  tenant uuid
)
  returns boolean
  language sql
  stable
  set search_path to ''
  AS $function$
 select exists(select 1 from public.merchant_memberships m join public.merchants s on s.id=m.merchant_id where m.merchant_id=tenant and m.user_id=(select auth.uid()) and m.revoked_at is null and s.status in ('onboarding','active'))
$function$;

create or replace function private.partner_schedule_valid (
  hours  jsonb,
  breaks jsonb,
  blocks jsonb
)
  returns boolean
  language plpgsql
  immutable
  set search_path to ''
  AS $function$
declare arr jsonb; item jsonb; kind integer; s numeric; e numeric; w numeric; d text; yr integer; mo integer; dy integer; maxday integer;
begin
 if hours is null or breaks is null or blocks is null then return false; end if;
 if jsonb_typeof(hours)<>'array' or jsonb_typeof(breaks)<>'array' or jsonb_typeof(blocks)<>'array' then return false; end if;
 -- Bound client-controlled validation work and ignored extra-field payloads.
 if jsonb_array_length(hours)>128 or jsonb_array_length(breaks)>128 or jsonb_array_length(blocks)>512
   or octet_length(hours::text)+octet_length(breaks::text)+octet_length(blocks::text)>262144 then return false; end if;
 for kind in 1..3 loop
  arr := case kind when 1 then hours when 2 then breaks else blocks end;
  for item in select value from jsonb_array_elements(arr) loop
   if jsonb_typeof(item)<>'object' or jsonb_typeof(item->'startMinute') is distinct from 'number' or jsonb_typeof(item->'endMinute') is distinct from 'number' then return false; end if;
   s:=(item->>'startMinute')::numeric; e:=(item->>'endMinute')::numeric;
   if s<>trunc(s) or e<>trunc(e) or s<0 or s>=e or e>1440 then return false; end if;
   if kind<3 then
    if jsonb_typeof(item->'weekday') is distinct from 'number' then return false; end if;
    w:=(item->>'weekday')::numeric;
    if w<>trunc(w) or w<0 or w>6 then return false; end if;
   else
    if jsonb_typeof(item->'date') is distinct from 'string' then return false; end if;
    d:=item->>'date';
    if d !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then return false; end if;
    yr:=substring(d,1,4)::integer; mo:=substring(d,6,2)::integer; dy:=substring(d,9,2)::integer;
    if mo<1 or mo>12 then return false; end if;
    maxday:=case when mo=2 then case when yr%400=0 or (yr%4=0 and yr%100<>0) then 29 else 28 end when mo in (4,6,9,11) then 30 else 31 end;
    if dy<1 or dy>maxday then return false; end if;
   end if;
  end loop;
  if exists(select 1 from jsonb_array_elements(arr) with ordinality a(v,n) join jsonb_array_elements(arr) with ordinality b(v,n) on a.n<b.n
    where (case when kind<3 then (a.v->>'weekday')::numeric=(b.v->>'weekday')::numeric else a.v->>'date'=b.v->>'date' end)
    and (a.v->>'startMinute')::numeric<(b.v->>'endMinute')::numeric and (b.v->>'startMinute')::numeric<(a.v->>'endMinute')::numeric) then return false; end if;
 end loop;
 if exists(select 1 from jsonb_array_elements(breaks) b where not exists(select 1 from jsonb_array_elements(hours) h where (h->>'weekday')::numeric=(b->>'weekday')::numeric and (h->>'startMinute')::numeric<=(b->>'startMinute')::numeric and (b->>'endMinute')::numeric<=(h->>'endMinute')::numeric)) then return false; end if;
 return true;
end $function$;

create or replace function private.partner_touch()
  returns trigger
  language plpgsql
  set search_path to ''
  AS $function$
begin new.updated_at:=now(); return new; end $function$;

alter table "public"."merchant_audit_events"
  add constraint "merchant_audit_events_actor_user_id_fkey" foreign key (actor_user_id) references auth.users(id) on delete set null;

alter table "public"."merchant_memberships"
  add constraint "merchant_memberships_user_id_fkey" foreign key (user_id) references auth.users(id) on delete restrict;

alter table "public"."merchant_services"
  add constraint "merchant_services_merchant_id_category_id_fkey" foreign key (merchant_id, category_id) references public.merchant_categories(merchant_id, id) on delete restrict;

alter table "public"."merchant_audit_events"
  add constraint "merchant_audit_events_merchant_id_fkey" foreign key (merchant_id) references public.merchants(id) on delete restrict;

alter table "public"."merchant_categories"
  add constraint "merchant_categories_merchant_id_fkey" foreign key (merchant_id) references public.merchants(id) on delete restrict;

alter table "public"."merchant_memberships"
  add constraint "merchant_memberships_merchant_id_fkey" foreign key (merchant_id) references public.merchants(id) on delete restrict;

alter table "public"."merchant_schedules"
  add constraint "merchant_schedules_merchant_id_fkey" foreign key (merchant_id) references public.merchants(id) on delete restrict;

alter table "public"."merchant_services"
  add constraint "merchant_services_merchant_id_fkey" foreign key (merchant_id) references public.merchants(id) on delete restrict;

create index merchant_audit_events_actor_idx on public.merchant_audit_events using btree (actor_user_id);

create index merchant_audit_events_merchant_created_idx on public.merchant_audit_events using btree (merchant_id, created_at desc);

create index merchant_services_category_idx on public.merchant_services using btree (merchant_id, category_id);

create trigger partner_audit
  after insert or delete or update on public.merchant_categories
  for each row
  execute function private.partner_audit();

create trigger partner_touch
  before update on public.merchant_categories
  for each row
  execute function private.partner_touch();

create trigger partner_audit
  after insert or delete or update on public.merchant_memberships
  for each row
  execute function private.partner_audit();

create trigger partner_touch
  before update on public.merchant_memberships
  for each row
  execute function private.partner_touch();

create trigger partner_audit
  after insert or delete or update on public.merchant_schedules
  for each row
  execute function private.partner_audit();

create trigger partner_touch
  before update on public.merchant_schedules
  for each row
  execute function private.partner_touch();

create trigger partner_audit
  after insert or delete or update on public.merchant_services
  for each row
  execute function private.partner_audit();

create trigger partner_touch
  before update on public.merchant_services
  for each row
  execute function private.partner_touch();

create trigger partner_audit
  after insert or delete or update on public.merchants
  for each row
  execute function private.partner_audit();

create trigger partner_touch
  before update on public.merchants
  for each row
  execute function private.partner_touch();

create policy "partner_read" on "public"."merchant_audit_events"
  for select
  to "authenticated"
  using ((exists ( select 1
   from public.merchant_memberships m
  where ((m.merchant_id = merchant_audit_events.merchant_id) AND (m.user_id = ( select auth.uid() as uid)) AND (m.revoked_at is null)))));

create policy "partner_insert" on "public"."merchant_categories"
  for insert
  to "authenticated"
  with check (private.partner_can_write(merchant_id));

create policy "partner_read" on "public"."merchant_categories"
  for select
  to "authenticated"
  using ((exists ( select 1
   from public.merchant_memberships m
  where ((m.merchant_id = merchant_categories.merchant_id) AND (m.user_id = ( select auth.uid() as uid)) AND (m.revoked_at is null)))));

create policy "partner_update" on "public"."merchant_categories"
  for update
  to "authenticated"
  using (private.partner_can_write(merchant_id))
  with check (private.partner_can_write(merchant_id));

create policy "partner_read" on "public"."merchant_memberships"
  for select
  to "authenticated"
  using ((user_id = ( select auth.uid() as uid)));

create policy "partner_insert" on "public"."merchant_schedules"
  for insert
  to "authenticated"
  with check (private.partner_can_write(merchant_id));

create policy "partner_read" on "public"."merchant_schedules"
  for select
  to "authenticated"
  using ((exists ( select 1
   from public.merchant_memberships m
  where ((m.merchant_id = merchant_schedules.merchant_id) AND (m.user_id = ( select auth.uid() as uid)) AND (m.revoked_at is null)))));

create policy "partner_update" on "public"."merchant_schedules"
  for update
  to "authenticated"
  using (private.partner_can_write(merchant_id))
  with check (private.partner_can_write(merchant_id));

create policy "partner_insert" on "public"."merchant_services"
  for insert
  to "authenticated"
  with check (private.partner_can_write(merchant_id));

create policy "partner_read" on "public"."merchant_services"
  for select
  to "authenticated"
  using ((exists ( select 1
   from public.merchant_memberships m
  where ((m.merchant_id = merchant_services.merchant_id) AND (m.user_id = ( select auth.uid() as uid)) AND (m.revoked_at is null)))));

create policy "partner_update" on "public"."merchant_services"
  for update
  to "authenticated"
  using (private.partner_can_write(merchant_id))
  with check (private.partner_can_write(merchant_id));

create policy "partner_read" on "public"."merchants"
  for select
  to "authenticated"
  using ((exists ( select 1
   from public.merchant_memberships m
  where ((m.merchant_id = merchants.id) AND (m.user_id = ( select auth.uid() as uid)) AND (m.revoked_at is null)))));

create policy "partner_update" on "public"."merchants"
  for update
  to "authenticated"
  using (((status = ANY (ARRAY['onboarding'::text, 'active'::text])) AND (exists ( select 1
   from public.merchant_memberships m
  where ((m.merchant_id = merchants.id) AND (m.user_id = ( select auth.uid() as uid)) AND (m.revoked_at is null))))))
  with check (((status = ANY (ARRAY['onboarding'::text, 'active'::text])) AND (EXISTS ( SELECT 1
   FROM public.merchant_memberships m
  WHERE ((m.merchant_id = merchants.id) AND (m.user_id = ( SELECT auth.uid() AS uid)) AND (m.revoked_at IS NULL))))));

-- pg-delta omits absent ACL entries. Explicit revocation also protects replay
-- on projects retaining legacy default table/function privileges.
revoke all on schema private from public, anon;
do $acl$
declare t text;
begin
  foreach t in array array['merchants','merchant_memberships','merchant_categories','merchant_services','merchant_schedules','merchant_audit_events'] loop
    execute format('revoke all on table public.%I from public, anon, authenticated', t);
  end loop;
end $acl$;
revoke all on function private.partner_audit(), private.partner_touch(), private.partner_can_write(uuid), private.partner_schedule_valid(jsonb,jsonb,jsonb) from public, anon, authenticated, service_role;

revoke all on function "private"."partner_audit"() from public;

grant execute on function "private"."partner_audit"() to "postgres";

revoke all on function "private"."partner_can_write"(uuid) from public;

grant execute on function "private"."partner_can_write"(uuid) to "authenticated", "postgres", "service_role";

revoke all on function "private"."partner_schedule_valid"(jsonb, jsonb, jsonb) from public;

grant execute on function "private"."partner_schedule_valid"(jsonb, jsonb, jsonb) to "authenticated", "postgres", "service_role";

revoke all on function "private"."partner_touch"() from public;

grant execute on function "private"."partner_touch"() to "postgres";

grant usage on schema "private" to "authenticated";

grant create, usage on schema "private" to "postgres";

grant usage on schema "private" to "service_role";

grant select on table "public"."merchant_audit_events" to "authenticated";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."merchant_audit_events" to "postgres", "service_role";

revoke all ("id") on table "public"."merchant_categories" from "authenticated";

grant insert ("id") on table "public"."merchant_categories" to "authenticated";

revoke all ("merchant_id") on table "public"."merchant_categories" from "authenticated";

grant insert ("merchant_id") on table "public"."merchant_categories" to "authenticated";

revoke all ("name_en") on table "public"."merchant_categories" from "authenticated";

grant insert ("name_en"), update ("name_en") on table "public"."merchant_categories" to "authenticated";

revoke all ("name_ko") on table "public"."merchant_categories" from "authenticated";

grant insert ("name_ko"), update ("name_ko") on table "public"."merchant_categories" to "authenticated";

revoke all ("sort_order") on table "public"."merchant_categories" from "authenticated";

grant insert ("sort_order"), update ("sort_order") on table "public"."merchant_categories" to "authenticated";

revoke all ("visibility") on table "public"."merchant_categories" from "authenticated";

grant insert ("visibility"), update ("visibility") on table "public"."merchant_categories" to "authenticated";

grant select on table "public"."merchant_categories" to "authenticated";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."merchant_categories" to "postgres", "service_role";

grant select on table "public"."merchant_memberships" to "authenticated";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."merchant_memberships" to "postgres", "service_role";

revoke all ("blocks") on table "public"."merchant_schedules" from "authenticated";

grant insert ("blocks"), update ("blocks") on table "public"."merchant_schedules" to "authenticated";

revoke all ("breaks") on table "public"."merchant_schedules" from "authenticated";

grant insert ("breaks"), update ("breaks") on table "public"."merchant_schedules" to "authenticated";

revoke all ("hours") on table "public"."merchant_schedules" from "authenticated";

grant insert ("hours"), update ("hours") on table "public"."merchant_schedules" to "authenticated";

revoke all ("merchant_id") on table "public"."merchant_schedules" from "authenticated";

grant insert ("merchant_id") on table "public"."merchant_schedules" to "authenticated";

grant select on table "public"."merchant_schedules" to "authenticated";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."merchant_schedules" to "postgres", "service_role";

revoke all ("category_id") on table "public"."merchant_services" from "authenticated";

grant insert ("category_id"), update ("category_id") on table "public"."merchant_services" to "authenticated";

revoke all ("cleanup_minutes") on table "public"."merchant_services" from "authenticated";

grant insert ("cleanup_minutes"), update ("cleanup_minutes") on table "public"."merchant_services" to "authenticated";

revoke all ("description_en") on table "public"."merchant_services" from "authenticated";

grant insert ("description_en"), update ("description_en") on table "public"."merchant_services" to "authenticated";

revoke all ("description_ko") on table "public"."merchant_services" from "authenticated";

grant insert ("description_ko"), update ("description_ko") on table "public"."merchant_services" to "authenticated";

revoke all ("duration_minutes") on table "public"."merchant_services" from "authenticated";

grant insert ("duration_minutes"), update ("duration_minutes") on table "public"."merchant_services" to "authenticated";

revoke all ("id") on table "public"."merchant_services" from "authenticated";

grant insert ("id") on table "public"."merchant_services" to "authenticated";

revoke all ("merchant_id") on table "public"."merchant_services" from "authenticated";

grant insert ("merchant_id") on table "public"."merchant_services" to "authenticated";

revoke all ("name_en") on table "public"."merchant_services" from "authenticated";

grant insert ("name_en"), update ("name_en") on table "public"."merchant_services" to "authenticated";

revoke all ("name_ko") on table "public"."merchant_services" from "authenticated";

grant insert ("name_ko"), update ("name_ko") on table "public"."merchant_services" to "authenticated";

revoke all ("price_krw") on table "public"."merchant_services" from "authenticated";

grant insert ("price_krw"), update ("price_krw") on table "public"."merchant_services" to "authenticated";

revoke all ("sort_order") on table "public"."merchant_services" from "authenticated";

grant insert ("sort_order"), update ("sort_order") on table "public"."merchant_services" to "authenticated";

revoke all ("visibility") on table "public"."merchant_services" from "authenticated";

grant insert ("visibility"), update ("visibility") on table "public"."merchant_services" to "authenticated";

grant select on table "public"."merchant_services" to "authenticated";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."merchant_services" to "postgres", "service_role";

revoke all ("address") on table "public"."merchants" from "authenticated";

grant update ("address") on table "public"."merchants" to "authenticated";

revoke all ("business_types") on table "public"."merchants" from "authenticated";

grant update ("business_types") on table "public"."merchants" to "authenticated";

revoke all ("contact_email") on table "public"."merchants" from "authenticated";

grant update ("contact_email") on table "public"."merchants" to "authenticated";

revoke all ("contact_phone") on table "public"."merchants" from "authenticated";

grant update ("contact_phone") on table "public"."merchants" to "authenticated";

revoke all ("display_name") on table "public"."merchants" from "authenticated";

grant update ("display_name") on table "public"."merchants" to "authenticated";

grant select on table "public"."merchants" to "authenticated";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."merchants" to "postgres", "service_role";

alter table "public"."merchant_schedules"
  add constraint "merchant_schedules_check" check (private.partner_schedule_valid(hours, breaks, blocks));
