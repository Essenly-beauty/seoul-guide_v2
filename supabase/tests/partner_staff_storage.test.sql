begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

-- This contract intentionally runs before the staff migration (RED), and every
-- fixture write below is confined to this transaction.
select has_table('public', 'merchant_staff', 'staff profiles have durable storage');
select has_table('public', 'merchant_staff_menus', 'staff-to-menu assignments have durable storage');
select has_table('public', 'merchant_staff_schedules', 'staff schedules have durable storage');
select ok(bool_and(relrowsecurity), 'all staff tables enforce RLS')
from pg_class where oid in (
  'public.merchant_staff'::regclass,
  'public.merchant_staff_menus'::regclass,
  'public.merchant_staff_schedules'::regclass
);
select ok(not has_table_privilege('anon', 'public.' || t, 'select'), t || ' denies anonymous reads')
from unnest(array['merchant_staff','merchant_staff_menus','merchant_staff_schedules']) t;
select ok(not has_table_privilege('authenticated', 'public.' || t, 'delete'), t || ' cannot be hard-deleted by an owner')
from unnest(array['merchant_staff','merchant_staff_schedules']) t;
select ok(not has_column_privilege('authenticated', 'public.merchant_staff', c, 'update'), 'owner cannot change staff ' || c)
from unnest(array['id','merchant_id','created_at','updated_at']) c;
select ok(not has_column_privilege('authenticated', 'public.merchant_staff_schedules', c, 'update'), 'owner cannot change schedule ' || c)
from unnest(array['merchant_id','staff_id','created_at','updated_at']) c;
select ok(not exists (
  select 1 from pg_constraint
  where conrelid = 'public.merchant_staff'::regclass
    and contype = 'f' and confrelid = 'auth.users'::regclass
), 'booking staff profiles are not auth users');
select ok(exists (
  select 1 from pg_constraint c
  where c.conrelid = 'public.merchant_staff_menus'::regclass and c.contype = 'f'
    and c.confrelid = 'public.merchant_staff'::regclass
    and cardinality(c.conkey) = 2
), 'menu assignments reference staff with tenant identity');
select ok(exists (
  select 1 from pg_constraint c
  where c.conrelid = 'public.merchant_staff_menus'::regclass and c.contype = 'f'
    and c.confrelid = 'public.merchant_services'::regclass
    and cardinality(c.conkey) = 2
), 'menu assignments reference services with tenant identity');
select ok(exists (
  select 1 from pg_constraint c
  where c.conrelid = 'public.merchant_staff_schedules'::regclass and c.contype = 'f'
    and c.confrelid = 'public.merchant_staff'::regclass
    and cardinality(c.conkey) = 2
), 'staff schedules reference staff with tenant identity');

insert into auth.users(id,email) values
  ('f4000000-0000-0000-0000-000000000001','staff-owner-a@example.test'),
  ('f4000000-0000-0000-0000-000000000011','staff-owner-b@example.test'),
  ('f4000000-0000-0000-0000-000000000021','staff-unassigned@example.test');
insert into public.merchants(id,display_name,status) values
  ('f4000000-0000-0000-0000-000000000002','Staff Fixture A','active'),
  ('f4000000-0000-0000-0000-000000000012','Staff Fixture B','active');
insert into public.merchant_memberships(merchant_id,user_id) values
  ('f4000000-0000-0000-0000-000000000002','f4000000-0000-0000-0000-000000000001'),
  ('f4000000-0000-0000-0000-000000000012','f4000000-0000-0000-0000-000000000011');
insert into public.merchant_categories(id,merchant_id,name_ko) values
  ('f4000000-0000-0000-0000-000000000003','f4000000-0000-0000-0000-000000000002','A category'),
  ('f4000000-0000-0000-0000-000000000013','f4000000-0000-0000-0000-000000000012','B category');
insert into public.merchant_services(id,merchant_id,category_id,name_ko) values
  ('f4000000-0000-0000-0000-000000000004','f4000000-0000-0000-0000-000000000002','f4000000-0000-0000-0000-000000000003','A service'),
  ('f4000000-0000-0000-0000-000000000014','f4000000-0000-0000-0000-000000000012','f4000000-0000-0000-0000-000000000013','B service');

set local role anon;
select throws_ok($$select id from public.merchant_staff$$, '42501', null, 'anonymous staff read denied');
select throws_ok($$select staff_id from public.merchant_staff_menus$$, '42501', null, 'anonymous assignments read denied');
select throws_ok($$select staff_id from public.merchant_staff_schedules$$, '42501', null, 'anonymous staff schedule read denied');

set local role authenticated;
set local request.jwt.claim.sub = 'f4000000-0000-0000-0000-000000000001';
select results_eq($$insert into public.merchant_staff(id,merchant_id,name,title,introduction,sort_order,visibility)
  values ('f4000000-0000-0000-0000-000000000005','f4000000-0000-0000-0000-000000000002','STAFF_PRIVATE_MARKER','Designer','Booking profile',0,'draft')
  returning id::text$$, array['f4000000-0000-0000-0000-000000000005'], 'owner creates a booking staff profile');
select results_eq($$select name from public.merchant_staff where id='f4000000-0000-0000-0000-000000000005'$$,
  array['STAFF_PRIVATE_MARKER'], 'owner reads own staff profile');
select results_eq($$update public.merchant_staff set title='Senior designer',visibility='visible'
  where id='f4000000-0000-0000-0000-000000000005' returning visibility$$,
  array['visible'], 'owner updates own visible staff profile');
select results_eq($$insert into public.merchant_staff_menus(merchant_id,staff_id,service_id)
  values ('f4000000-0000-0000-0000-000000000002','f4000000-0000-0000-0000-000000000005','f4000000-0000-0000-0000-000000000004')
  returning service_id::text$$, array['f4000000-0000-0000-0000-000000000004'], 'owner assigns own service to own staff');
select results_eq($$select service_id::text from public.merchant_staff_menus$$,
  array['f4000000-0000-0000-0000-000000000004'], 'owner reads own assignments');
select results_eq($$insert into public.merchant_staff_schedules(merchant_id,staff_id,hours,breaks,blocks,overrides)
  values ('f4000000-0000-0000-0000-000000000002','f4000000-0000-0000-0000-000000000005',
    '[{"weekday":1,"startMinute":540,"endMinute":1080}]',
    '[{"weekday":1,"startMinute":720,"endMinute":780}]',
    '[{"date":"2026-11-01","startMinute":600,"endMinute":660}]',
    '[{"date":"2026-11-02","hours":[],"breaks":[]}]')
  returning staff_id::text$$, array['f4000000-0000-0000-0000-000000000005'], 'owner creates own staff schedule');
select results_eq($$update public.merchant_staff_schedules
  set hours='[{"weekday":1,"startMinute":541,"endMinute":1081}]',breaks='[]'
  where staff_id='f4000000-0000-0000-0000-000000000005' returning jsonb_array_length(hours)$$,
  array[1], 'owner updates own staff schedule');
select results_eq($$select jsonb_array_length(overrides) from public.merchant_staff_schedules$$,
  array[1], 'owner reads own special dates');

select throws_ok($$delete from public.merchant_staff where id='f4000000-0000-0000-0000-000000000005'$$,
  '42501', null, 'owner cannot hard-delete staff');
select throws_ok($$delete from public.merchant_staff_schedules where staff_id='f4000000-0000-0000-0000-000000000005'$$,
  '42501', null, 'owner cannot hard-delete staff schedule');
select throws_ok($$update public.merchant_staff set merchant_id='f4000000-0000-0000-0000-000000000012'$$,
  '42501', null, 'owner cannot transfer staff tenant identity');
select throws_ok($$update public.merchant_staff set updated_at=now()$$,
  '42501', null, 'owner cannot forge staff version');
select throws_ok($$update public.merchant_staff_schedules set staff_id='f4000000-0000-0000-0000-000000000015'$$,
  '42501', null, 'owner cannot transfer schedule staff identity');
select throws_ok($$update public.merchant_staff_schedules set updated_at=now()$$,
  '42501', null, 'owner cannot forge schedule version');

select lives_ok($$update public.merchant_staff set name=repeat('가',120),title=repeat('가',120),introduction=repeat('가',1000),sort_order=9007199254740991$$,
  'PostgreSQL codepoint limits and safe sort maximum are accepted');
select results_eq($$select length(name),length(title),length(introduction) from public.merchant_staff
  where id='f4000000-0000-0000-0000-000000000005'$$,
  $$values (120,120,1000)$$, 'profile lengths count Unicode codepoints');
select throws_ok($$update public.merchant_staff set name=repeat('가',121)$$, '23514', null, 'staff name above 120 codepoints rejected');
select throws_ok($$update public.merchant_staff set title=repeat('가',121)$$, '23514', null, 'staff title above 120 codepoints rejected');
select throws_ok($$update public.merchant_staff set introduction=repeat('가',1001)$$, '23514', null, 'staff introduction above 1000 codepoints rejected');
select throws_ok($$update public.merchant_staff set sort_order=-1$$, '23514', null, 'negative staff order rejected');
select throws_ok($$update public.merchant_staff set sort_order=9007199254740992$$, '23514', null, 'unsafe staff order rejected');
select throws_ok($$update public.merchant_staff set visibility='published'$$, '23514', null, 'unknown visibility rejected');
select throws_ok($$update public.merchant_staff set name='  '$$, '23514', null, 'visible staff requires a nonblank name');
select lives_ok($$update public.merchant_staff set visibility='draft',name=''$$, 'an incomplete draft may have no name');
select lives_ok($$update public.merchant_staff set visibility='hidden'$$, 'hidden staff remains a valid profile state');
select lives_ok($$update public.merchant_staff set name='STAFF_PRIVATE_MARKER',visibility='visible'$$, 'owner can restore visible staff');

select throws_ok($$insert into public.merchant_staff_menus(merchant_id,staff_id,service_id)
  values ('f4000000-0000-0000-0000-000000000002','f4000000-0000-0000-0000-000000000005','f4000000-0000-0000-0000-000000000004')$$,
  '23505', null, 'duplicate staff-menu assignment rejected');
select results_eq($$delete from public.merchant_staff_menus
  where staff_id='f4000000-0000-0000-0000-000000000005'
  returning service_id::text$$, array['f4000000-0000-0000-0000-000000000004'],
  'owner removes a staff-menu assignment');
select lives_ok($$insert into public.merchant_staff_menus(merchant_id,staff_id,service_id)
  values ('f4000000-0000-0000-0000-000000000002','f4000000-0000-0000-0000-000000000005','f4000000-0000-0000-0000-000000000004')$$,
  'owner restores an assignment');
select throws_ok($$insert into public.merchant_staff_schedules(merchant_id,staff_id)
  values ('f4000000-0000-0000-0000-000000000002','f4000000-0000-0000-0000-000000000005')$$,
  '23505', null, 'staff has one schedule aggregate');

select lives_ok($$update public.merchant_staff_schedules set hours=(
  select jsonb_agg(jsonb_build_object('weekday',1,'startMinute',n*2,'endMinute',n*2+1)) from generate_series(0,127) n
),breaks='[]'$$, '128 weekly opening intervals accepted');
select throws_ok($$update public.merchant_staff_schedules set hours=(
  select jsonb_agg(jsonb_build_object('weekday',1,'startMinute',n*2,'endMinute',n*2+1)) from generate_series(0,128) n
)$$, '23514', null, '129 weekly opening intervals rejected');
select lives_ok($$update public.merchant_staff_schedules set hours='[{"weekday":1,"startMinute":0,"endMinute":1440}]',breaks=(
  select jsonb_agg(jsonb_build_object('weekday',1,'startMinute',n*2,'endMinute',n*2+1)) from generate_series(0,127) n
)$$, '128 contained weekly breaks accepted');
select throws_ok($$update public.merchant_staff_schedules set breaks=(
  select jsonb_agg(jsonb_build_object('weekday',1,'startMinute',n*2,'endMinute',n*2+1)) from generate_series(0,128) n
)$$, '23514', null, '129 weekly breaks rejected');
select lives_ok($$update public.merchant_staff_schedules set blocks=(
  select jsonb_agg(jsonb_build_object('date','2026-11-03','startMinute',n*2,'endMinute',n*2+1)) from generate_series(0,511) n
)$$, '512 date blocks accepted');
select throws_ok($$update public.merchant_staff_schedules set blocks=(
  select jsonb_agg(jsonb_build_object('date','2026-11-03','startMinute',n*2,'endMinute',n*2+1)) from generate_series(0,512) n
)$$, '23514', null, '513 date blocks rejected');
select lives_ok($$update public.merchant_staff_schedules set overrides=(
  select jsonb_agg(jsonb_build_object('date',to_char(date '2026-01-01'+n,'YYYY-MM-DD'),'hours','[]'::jsonb,'breaks','[]'::jsonb))
  from generate_series(0,365) n
)$$, '366 special dates accepted');
select throws_ok($$update public.merchant_staff_schedules set overrides=(
  select jsonb_agg(jsonb_build_object('date',to_char(date '2026-01-01'+n,'YYYY-MM-DD'),'hours','[]'::jsonb,'breaks','[]'::jsonb))
  from generate_series(0,366) n
)$$, '23514', null, '367 special dates rejected');
select throws_ok($$update public.merchant_staff_schedules set overrides=(
  select jsonb_agg(jsonb_build_object('date',to_char(date '2026-01-01'+d,'YYYY-MM-DD'),
    'hours',(select jsonb_agg(jsonb_build_object('startMinute',n*2,'endMinute',n*2+1)) from generate_series(0,127) n),
    'breaks','[]'::jsonb)) from generate_series(0,99) d
)$$, '23514', null, 'combined schedule payload above 256 KiB rejected');
select throws_ok($$update public.merchant_staff_schedules set hours='[{"weekday":1,"startMinute":0,"endMinute":60,"extra":true}]',breaks='[]'$$,
  '23514', null, 'weekly hours require exact interval keys');
select throws_ok($$update public.merchant_staff_schedules set breaks='[{"weekday":1,"startMinute":0,"endMinute":1,"extra":true}]'$$,
  '23514', null, 'weekly breaks require exact interval keys');
select throws_ok($$update public.merchant_staff_schedules set blocks='[{"date":"2026-11-03","startMinute":0,"endMinute":1,"extra":true}]'$$,
  '23514', null, 'date blocks require exact interval keys');
select throws_ok($$update public.merchant_staff_schedules set overrides='[{"date":"2026-11-03","hours":[{"startMinute":0,"endMinute":1,"extra":true}],"breaks":[]}]'$$,
  '23514', null, 'special-date intervals require exact keys');
select throws_ok($$update public.merchant_staff_schedules set blocks='[{"date":"0000-01-01","startMinute":0,"endMinute":1}]'$$,
  '23514', null, 'year zero is not a reservable date');
select throws_ok($$update public.merchant_staff_schedules set overrides='[{"date":"2026-02-29","hours":[],"breaks":[]}]'$$,
  '23514', null, 'impossible special date rejected');
select throws_ok($$update public.merchant_staff_schedules set overrides='[{"date":"0000-01-01","hours":[],"breaks":[]}]'$$,
  '23514', null, 'year zero special date rejected');
select throws_ok($$update public.merchant_staff_schedules set overrides='[{"date":"2026-11-03","hours":[{"startMinute":0,"endMinute":60},{"startMinute":30,"endMinute":90}],"breaks":[]}]'$$,
  '23514', null, 'overlapping special-date openings rejected');
select throws_ok($$update public.merchant_staff_schedules set overrides='[{"date":"2026-11-03","hours":[{"startMinute":0,"endMinute":60}],"breaks":[{"startMinute":30,"endMinute":90}]}]'$$,
  '23514', null, 'special-date break must fit its opening');
select throws_ok($$update public.merchant_staff_schedules set hours='[{"weekday":1,"startMinute":0,"endMinute":60},{"weekday":1,"startMinute":30,"endMinute":90}]',breaks='[]'$$,
  '23514', null, 'overlapping staff hours rejected');
select lives_ok($$update public.merchant_staff_schedules set hours='[{"weekday":1,"startMinute":0,"endMinute":60}]',breaks='[]'$$,
  'restore one opening for break containment check');
select throws_ok($$update public.merchant_staff_schedules set breaks='[{"weekday":1,"startMinute":1400,"endMinute":1440}]'$$,
  '23514', null, 'staff break must fit one opening');
select throws_ok($$update public.merchant_staff_schedules set blocks='[{"date":"2026-11-03","startMinute":0,"endMinute":60},{"date":"2026-11-03","startMinute":30,"endMinute":90}]'$$,
  '23514', null, 'overlapping staff date blocks rejected');

-- Cross-tenant foreign keys must reject IDs supplied to an otherwise valid
-- tenant write. RLS by itself cannot prove this relationship.
set local role service_role;
set local request.jwt.claim.sub = '';
insert into public.merchant_staff(id,merchant_id,name,visibility) values
  ('f4000000-0000-0000-0000-000000000015','f4000000-0000-0000-0000-000000000012','B staff','visible');
set local role authenticated;
set local request.jwt.claim.sub = 'f4000000-0000-0000-0000-000000000001';
select throws_ok($$insert into public.merchant_staff_menus(merchant_id,staff_id,service_id)
  values ('f4000000-0000-0000-0000-000000000002','f4000000-0000-0000-0000-000000000015','f4000000-0000-0000-0000-000000000004')$$,
  '23503', null, 'A assignment cannot point at B staff');
select throws_ok($$insert into public.merchant_staff_menus(merchant_id,staff_id,service_id)
  values ('f4000000-0000-0000-0000-000000000002','f4000000-0000-0000-0000-000000000005','f4000000-0000-0000-0000-000000000014')$$,
  '23503', null, 'A assignment cannot point at B service');
set local role service_role;
set local request.jwt.claim.sub = '';
select throws_ok($$insert into public.merchant_staff_schedules(merchant_id,staff_id)
  values ('f4000000-0000-0000-0000-000000000012','f4000000-0000-0000-0000-000000000005')$$,
  '23503', null, 'B schedule cannot point at A staff');

set local role authenticated;
set local request.jwt.claim.sub = 'f4000000-0000-0000-0000-000000000011';
select is_empty($$select id from public.merchant_staff where merchant_id='f4000000-0000-0000-0000-000000000002'$$,
  'B owner cannot read A staff');
select is_empty($$select staff_id from public.merchant_staff_menus where merchant_id='f4000000-0000-0000-0000-000000000002'$$,
  'B owner cannot read A assignments');
select is_empty($$select staff_id from public.merchant_staff_schedules where merchant_id='f4000000-0000-0000-0000-000000000002'$$,
  'B owner cannot read A staff schedule');
select is_empty($$update public.merchant_staff set title='foreign edit' where id='f4000000-0000-0000-0000-000000000005' returning id$$,
  'B owner cannot update A staff');
select is_empty($$update public.merchant_staff_schedules set hours='[]' where staff_id='f4000000-0000-0000-0000-000000000005' returning staff_id$$,
  'B owner cannot update A schedule');
select throws_ok($$insert into public.merchant_staff(id,merchant_id,name)
  values ('f4000000-0000-0000-0000-000000000016','f4000000-0000-0000-0000-000000000002','foreign insert')$$,
  '42501', null, 'B owner cannot create A staff');
select throws_ok($$insert into public.merchant_staff_menus(merchant_id,staff_id,service_id)
  values ('f4000000-0000-0000-0000-000000000002','f4000000-0000-0000-0000-000000000005','f4000000-0000-0000-0000-000000000004')$$,
  '42501', null, 'B owner cannot write A assignment');
select throws_ok($$insert into public.merchant_staff_schedules(merchant_id,staff_id)
  values ('f4000000-0000-0000-0000-000000000002','f4000000-0000-0000-0000-000000000005')$$,
  '42501', null, 'B owner cannot create A schedule');

set local request.jwt.claim.sub = 'f4000000-0000-0000-0000-000000000001';
select lives_ok($$insert into public.merchant_staff(id,merchant_id,name)
  values ('f4000000-0000-0000-0000-000000000006','f4000000-0000-0000-0000-000000000002','Second A staff')$$,
  'owner creates a second staff profile for isolated write denials');
set local request.jwt.claim.sub = 'f4000000-0000-0000-0000-000000000021';
select throws_ok($$insert into public.merchant_staff(id,merchant_id,name)
  values ('f4000000-0000-0000-0000-000000000017','f4000000-0000-0000-0000-000000000002','unassigned')$$,
  '42501', null, 'unassigned user cannot create staff');
select is_empty($$update public.merchant_staff set title='unassigned edit' returning id$$,
  'unassigned user cannot update staff');
select is_empty($$update public.merchant_staff_schedules set hours='[]' returning staff_id$$,
  'unassigned user cannot update staff schedule');
select throws_ok($$insert into public.merchant_staff_menus(merchant_id,staff_id,service_id)
  values ('f4000000-0000-0000-0000-000000000002','f4000000-0000-0000-0000-000000000006','f4000000-0000-0000-0000-000000000004')$$,
  '42501', null, 'unassigned user cannot assign a menu');
select throws_ok($$insert into public.merchant_staff_schedules(merchant_id,staff_id)
  values ('f4000000-0000-0000-0000-000000000002','f4000000-0000-0000-0000-000000000006')$$,
  '42501', null, 'unassigned user cannot create a schedule');

set local request.jwt.claim.sub = 'f4000000-0000-0000-0000-000000000001';
select throws_ok($$insert into public.merchant_staff_menus(merchant_id,staff_id,service_id)
  values ('f4000000-0000-0000-0000-000000000002','f4000000-0000-0000-0000-000000000005','f4000000-0000-0000-0000-000000000014')$$,
  '23503', null, 'owner cannot assign a foreign service');
-- Create 999 more valid services and link them through the authenticated role.
-- The initial link makes exactly 1,000; the next direct insert must fail.
with created as (
  insert into public.merchant_services(id,merchant_id,category_id)
  select ('f4000000-0000-0000-0000-' || lpad(to_hex(n),12,'0'))::uuid,
    'f4000000-0000-0000-0000-000000000002'::uuid,
    'f4000000-0000-0000-0000-000000000003'::uuid
  from generate_series(100,1098) n
  returning id
)
insert into public.merchant_staff_menus(merchant_id,staff_id,service_id)
select 'f4000000-0000-0000-0000-000000000002', 'f4000000-0000-0000-0000-000000000005', id from created;
select is((select count(*) from public.merchant_staff_menus where staff_id='f4000000-0000-0000-0000-000000000005'),
  1000::bigint, '1,000 direct authenticated menu assignments are accepted');
insert into public.merchant_services(id,merchant_id,category_id) values
  ('f4000000-0000-0000-0000-000000000050','f4000000-0000-0000-0000-000000000002','f4000000-0000-0000-0000-000000000003');
select throws_ok($$insert into public.merchant_staff_menus(merchant_id,staff_id,service_id)
  values ('f4000000-0000-0000-0000-000000000002','f4000000-0000-0000-0000-000000000005','f4000000-0000-0000-0000-000000000050')$$,
  '23514', null, '1,001st direct authenticated assignment rejected');
select is((select count(*) from public.merchant_staff_menus where staff_id='f4000000-0000-0000-0000-000000000005'),
  1000::bigint, 'rejected extra assignment leaves links unchanged');
select results_eq($$update public.merchant_staff set visibility='archived' where id='f4000000-0000-0000-0000-000000000005' returning visibility$$,
  array['archived'], 'owner archives staff without hard deletion');
select results_eq($$select name from public.merchant_staff where id='f4000000-0000-0000-0000-000000000005'$$,
  array['STAFF_PRIVATE_MARKER'], 'archived staff profile remains readable');
select results_eq($$select count(*) from public.merchant_staff_menus where staff_id='f4000000-0000-0000-0000-000000000005'$$,
  array[1000::bigint], 'archived staff menu history remains readable');
select results_eq($$select count(*) from public.merchant_staff_schedules where staff_id='f4000000-0000-0000-0000-000000000005'$$,
  array[1::bigint], 'archived staff schedule remains readable');

select ok(exists(select 1 from public.merchant_audit_events
  where merchant_id='f4000000-0000-0000-0000-000000000002'
    and entity_table='merchant_staff' and action='UPDATE'
    and changed_fields @> array['visibility']::text[]), 'staff audit records changed field names');
select ok(exists(select 1 from public.merchant_audit_events
  where merchant_id='f4000000-0000-0000-0000-000000000002'
    and entity_table='merchant_staff_menus' and action='INSERT'
    and changed_fields @> array['staff_id','service_id']::text[]), 'assignment audit records changed field names');
select ok(exists(select 1 from public.merchant_audit_events
  where merchant_id='f4000000-0000-0000-0000-000000000002'
    and entity_table='merchant_staff_schedules' and action='UPDATE'
    and changed_fields @> array['hours']::text[]), 'schedule audit records changed field names');
select ok(not exists(select 1 from public.merchant_audit_events
  where merchant_id='f4000000-0000-0000-0000-000000000002'
    and (row_to_json(merchant_audit_events)::text like '%STAFF_PRIVATE_MARKER%'
      or row_to_json(merchant_audit_events)::text like '%startMinute%')),
  'staff names and schedule values never enter audit rows');

set local role service_role;
set local request.jwt.claim.sub = '';
select lives_ok($$update public.merchants set status='suspended' where id='f4000000-0000-0000-0000-000000000002'$$,
  'operator suspends fixture merchant');
set local role authenticated;
set local request.jwt.claim.sub = 'f4000000-0000-0000-0000-000000000001';
select is_empty($$update public.merchant_staff set title='suspended edit' returning id$$,
  'suspended owner cannot update staff');
select is_empty($$update public.merchant_staff_schedules set hours='[]' returning staff_id$$,
  'suspended owner cannot update staff schedule');
select throws_ok($$insert into public.merchant_staff(id,merchant_id,name)
  values ('f4000000-0000-0000-0000-000000000018','f4000000-0000-0000-0000-000000000002','suspended insert')$$,
  '42501', null, 'suspended owner cannot create staff');
select throws_ok($$insert into public.merchant_staff_menus(merchant_id,staff_id,service_id)
  values ('f4000000-0000-0000-0000-000000000002','f4000000-0000-0000-0000-000000000006','f4000000-0000-0000-0000-000000000004')$$,
  '42501', null, 'suspended owner cannot assign a menu');
select throws_ok($$insert into public.merchant_staff_schedules(merchant_id,staff_id)
  values ('f4000000-0000-0000-0000-000000000002','f4000000-0000-0000-0000-000000000006')$$,
  '42501', null, 'suspended owner cannot create a schedule');

set local role service_role;
set local request.jwt.claim.sub = '';
select lives_ok($$update public.merchant_memberships set revoked_at=now()
  where merchant_id='f4000000-0000-0000-0000-000000000002'$$, 'operator revokes fixture owner');
set local role authenticated;
set local request.jwt.claim.sub = 'f4000000-0000-0000-0000-000000000001';
select is_empty($$select id from public.merchant_staff where merchant_id='f4000000-0000-0000-0000-000000000002'$$,
  'revoked owner cannot read staff');
select is_empty($$select staff_id from public.merchant_staff_menus where merchant_id='f4000000-0000-0000-0000-000000000002'$$,
  'revoked owner cannot read assignments');
select is_empty($$select staff_id from public.merchant_staff_schedules where merchant_id='f4000000-0000-0000-0000-000000000002'$$,
  'revoked owner cannot read staff schedules');
select is_empty($$update public.merchant_staff set title='revoked edit' returning id$$,
  'revoked owner cannot update staff');
select is_empty($$update public.merchant_staff_schedules set hours='[]' returning staff_id$$,
  'revoked owner cannot update staff schedule');
select throws_ok($$insert into public.merchant_staff_menus(merchant_id,staff_id,service_id)
  values ('f4000000-0000-0000-0000-000000000002','f4000000-0000-0000-0000-000000000006','f4000000-0000-0000-0000-000000000004')$$,
  '42501', null, 'revoked owner cannot assign a menu');
select throws_ok($$insert into public.merchant_staff_schedules(merchant_id,staff_id)
  values ('f4000000-0000-0000-0000-000000000002','f4000000-0000-0000-0000-000000000006')$$,
  '42501', null, 'revoked owner cannot create a schedule');

select * from finish();
rollback;
