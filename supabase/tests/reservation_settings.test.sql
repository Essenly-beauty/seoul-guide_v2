begin;
select no_plan();

select has_table('public', 'merchant_reservation_rules', 'reservation rules persist separately from platform profile');
select has_column('public', 'merchant_schedules', 'overrides', 'shop schedule stores special dates');
select ok((select relrowsecurity from pg_class where oid = 'public.merchant_reservation_rules'::regclass), 'rules have RLS');
select ok(not has_table_privilege('anon', 'public.merchant_reservation_rules', 'select'), 'anon cannot read rules');
select ok(not has_table_privilege('anon', 'public.merchant_reservation_rules', 'insert'), 'anon cannot create rules');
select ok(not has_table_privilege('authenticated', 'public.merchant_reservation_rules', 'delete'), 'owner cannot delete rules');
select ok(not has_column_privilege('authenticated', 'public.merchant_reservation_rules', 'merchant_id', 'update'), 'owner cannot transfer rules to another tenant');
select ok(not has_column_privilege('authenticated', 'public.merchant_reservation_rules', 'updated_at', 'update'), 'owner cannot forge rules version');
select ok(not has_column_privilege('authenticated', 'public.merchant_schedules', 'merchant_id', 'update'), 'owner cannot transfer special dates');
select ok(has_column_privilege('authenticated', 'public.merchant_schedules', 'overrides', 'update'), 'owner may update special dates');
select ok(has_column_privilege('authenticated', 'public.merchant_schedules', 'overrides', 'insert'), 'owner may create a schedule with special dates');
select ok(has_table_privilege('service_role', 'public.merchant_reservation_rules', 'update'), 'trusted operator retains rules access');
select ok(not exists (
  select 1 from pg_attribute a where a.attrelid = 'public.merchant_reservation_rules'::regclass
    and a.attname = any(array['mode','capacity','start_date','end_date','minimum_lead_minutes','slot_interval_minutes'])
    and (not a.attnotnull or a.atthasdef)
), 'all six booking policy fields are required without defaults');
select ok(not has_function_privilege('anon', 'private.partner_overrides_valid(jsonb,jsonb,jsonb,jsonb)', 'execute'), 'anon cannot invoke override validator');
select ok(not exists (
  select 1 from pg_constraint c
  where c.contype = 'f' and c.conrelid = 'public.merchant_reservation_rules'::regclass
    and not exists (select 1 from pg_index i where i.indrelid = c.conrelid and (i.indkey::smallint[])[0:cardinality(c.conkey)-1] @> c.conkey)
), 'rules foreign key uses leading primary index');

select ok(private.partner_overrides_valid('[]','[]','[]','[]'), 'empty special dates are valid');
select ok(private.partner_overrides_valid('[]','[]','[]','[{"date":"2026-11-01","hours":[],"breaks":[]}]'), 'empty special opening closes a day');
select ok(private.partner_overrides_valid('[]','[]','[]','[{"date":"2026-11-01","hours":[{"startMinute":540,"endMinute":1020}],"breaks":[{"startMinute":720,"endMinute":780}]}]'), 'special opening with contained break is valid');
select ok(private.partner_overrides_valid('[]','[]','[]','[{"date":"0001-01-01","hours":[],"breaks":[]},{"date":"9999-12-31","hours":[],"breaks":[]}]'), 'calendar endpoints are valid');
select ok(private.partner_overrides_valid('[]','[]','[]','[{"date":"2000-02-29","hours":[],"breaks":[]}]'), '400-year leap date is valid');
select ok(not private.partner_overrides_valid('[]','[]','[]','[{"date":"0000-01-01","hours":[],"breaks":[]}]'), 'year zero is not a real reservable date');
select ok(not private.partner_overrides_valid('[]','[]','[]','[{"date":"2026-02-29","hours":[],"breaks":[]}]'), 'nonleap February 29 rejected');
select ok(not private.partner_overrides_valid('[]','[]','[]','[{"date":"2026-04-31","hours":[],"breaks":[]}]'), 'invalid month day rejected');
select ok(not private.partner_overrides_valid('[]','[]','[]','[{"date":"2026-11-01","hours":[],"breaks":[]},{"date":"2026-11-01","hours":[],"breaks":[]}]'), 'duplicate special date rejected');
select ok(not private.partner_overrides_valid('[]','[]','[]','[{"date":"2026-11-01","hours":[],"breaks":[],"ignored":true}]'), 'unknown override key rejected');
select ok(not private.partner_overrides_valid('[]','[]','[]','[{"date":"2026-11-01","hours":[]}]'), 'missing override key rejected');
select ok(not private.partner_overrides_valid('[]','[]','[]','[{"date":"2026-11-01","hours":"closed","breaks":[]}]'), 'nonarray opening rejected');
select ok(not private.partner_overrides_valid('[]','[]','[]','[{"date":"2026-11-01","hours":[{"startMinute":0,"endMinute":60,"ignored":true}],"breaks":[]}]'), 'unknown daily interval key rejected');
select ok(not private.partner_overrides_valid('[]','[]','[]','[{"date":"2026-11-01","hours":[{"startMinute":0}],"breaks":[]}]'), 'missing daily interval key rejected');
select ok(not private.partner_overrides_valid('[]','[]','[]','[{"date":"2026-11-01","hours":[{"startMinute":0,"endMinute":90},{"startMinute":60,"endMinute":120}],"breaks":[]}]'), 'overlapping special openings rejected');
select ok(not private.partner_overrides_valid('[]','[]','[]','[{"date":"2026-11-01","hours":[{"startMinute":0,"endMinute":60}],"breaks":[{"startMinute":30,"endMinute":90}]}]'), 'break outside special opening rejected');
select ok(not private.partner_overrides_valid('[]','[]','[]',
  (select jsonb_agg(jsonb_build_object('date', to_char(date '2026-01-01' + n, 'YYYY-MM-DD'), 'hours', '[]'::jsonb, 'breaks', '[]'::jsonb)) from generate_series(0,366) n)), '367 special dates rejected');
select ok(not private.partner_overrides_valid('[]','[]','[]',
  jsonb_build_array(jsonb_build_object('date','2026-11-01','hours',
    (select jsonb_agg(jsonb_build_object('startMinute',n*2,'endMinute',n*2+1)) from generate_series(0,128) n), 'breaks','[]'::jsonb))), '129 daily openings rejected');
select ok(not private.partner_overrides_valid('[]','[]','[]',
  jsonb_build_array(jsonb_build_object('date','2026-11-01','hours',jsonb_build_array(jsonb_build_object('startMinute',0,'endMinute',1440)), 'breaks',
    (select jsonb_agg(jsonb_build_object('startMinute',n*2,'endMinute',n*2+1)) from generate_series(0,128) n)))), '129 daily breaks rejected');
select ok(not private.partner_overrides_valid(jsonb_build_array(jsonb_build_object('weekday',0,'startMinute',0,'endMinute',60,'ignored',repeat('x',245000))), '[]','[]',
  (select jsonb_agg(jsonb_build_object('date', to_char(date '2026-01-01' + n, 'YYYY-MM-DD'), 'hours', '[]'::jsonb, 'breaks', '[]'::jsonb)) from generate_series(0,365) n)), 'combined weekly and special-date JSON is bounded');

insert into auth.users(id,email) values
 ('f3000000-0000-0000-0000-000000000001','rules-owner-a@example.test'),
 ('f3000000-0000-0000-0000-000000000003','rules-owner-b@example.test'),
 ('f3000000-0000-0000-0000-000000000005','rules-unassigned@example.test');
insert into public.merchants(id,display_name,status) values
 ('f3000000-0000-0000-0000-000000000002','Rules A','active'),
 ('f3000000-0000-0000-0000-000000000004','Rules B','active');
insert into public.merchant_memberships(merchant_id,user_id) values
 ('f3000000-0000-0000-0000-000000000002','f3000000-0000-0000-0000-000000000001'),
 ('f3000000-0000-0000-0000-000000000004','f3000000-0000-0000-0000-000000000003');
insert into public.merchant_schedules(merchant_id,blocks) values
 ('f3000000-0000-0000-0000-000000000002','[{"date":"2026-11-01","startMinute":600,"endMinute":660}]'),
 ('f3000000-0000-0000-0000-000000000004','[]');

set local role anon;
select throws_ok($$select merchant_id from public.merchant_reservation_rules$$,'42501',null,'anon direct read denied');
set local role authenticated;
set local request.jwt.claim.sub='f3000000-0000-0000-0000-000000000001';
select results_eq($$insert into public.merchant_reservation_rules(merchant_id,mode,capacity,start_date,end_date,minimum_lead_minutes,slot_interval_minutes)
  values ('f3000000-0000-0000-0000-000000000002','shop',1,date '0001-01-01',date '9999-12-31',0,1440)
  returning merchant_id::text$$, array['f3000000-0000-0000-0000-000000000002'], 'owner explicitly creates own policy');
select results_eq($$select start_date::text, end_date::text from public.merchant_reservation_rules$$,
  $$values ('0001-01-01','9999-12-31')$$, 'calendar boundary dates round-trip');
select throws_ok($$insert into public.merchant_reservation_rules(merchant_id,mode,start_date,end_date,minimum_lead_minutes,slot_interval_minutes)
  values ('f3000000-0000-0000-0000-000000000002','shop',date '2026-11-01',date '2026-12-01',0,30)$$,'23502',null,'capacity has no business default');
select throws_ok($$insert into public.merchant_reservation_rules(merchant_id,mode,capacity,start_date,end_date,minimum_lead_minutes,slot_interval_minutes)
  values ('f3000000-0000-0000-0000-000000000004','shop',1,date '2026-11-01',date '2026-12-01',0,30)$$,'42501',null,'owner cannot create foreign policy');
select is_empty($$select merchant_id from public.merchant_reservation_rules where merchant_id='f3000000-0000-0000-0000-000000000004'$$,'owner cannot read foreign policy');
select is_empty($$update public.merchant_reservation_rules set capacity=2 where merchant_id='f3000000-0000-0000-0000-000000000004' returning merchant_id$$,'owner cannot update foreign policy');
select throws_ok($$update public.merchant_reservation_rules set merchant_id='f3000000-0000-0000-0000-000000000004'$$,'42501',null,'tenant identity cannot be changed');
select throws_ok($$update public.merchant_reservation_rules set updated_at=now()$$,'42501',null,'rule timestamp cannot be forged');
select throws_ok($$delete from public.merchant_reservation_rules$$,'42501',null,'rules cannot be deleted by clients');
select throws_ok($$update public.merchant_reservation_rules set mode='unknown'$$,'23514',null,'mode restricted');
select throws_ok($$update public.merchant_reservation_rules set capacity=0$$,'23514',null,'zero capacity rejected');
select throws_ok($$update public.merchant_reservation_rules set capacity=9007199254740992$$,'23514',null,'unsafe capacity rejected');
select throws_ok($$update public.merchant_reservation_rules set start_date=date '2026-12-01',end_date=date '2026-11-01'$$,'23514',null,'end date cannot precede start');
select throws_ok($$update public.merchant_reservation_rules set start_date=date '0001-01-01 BC'$$,'23514',null,'BC date rejected');
select throws_ok($$update public.merchant_reservation_rules set end_date=date '10000-01-01'$$,'23514',null,'post-9999 date rejected');
select throws_ok($$update public.merchant_reservation_rules set minimum_lead_minutes=-1$$,'23514',null,'negative lead rejected');
select throws_ok($$update public.merchant_reservation_rules set minimum_lead_minutes=525601$$,'23514',null,'lead above 365 days rejected');
select throws_ok($$update public.merchant_reservation_rules set slot_interval_minutes=0$$,'23514',null,'zero grid rejected');
select throws_ok($$update public.merchant_reservation_rules set slot_interval_minutes=1441$$,'23514',null,'grid over a day rejected');
select results_eq($$update public.merchant_reservation_rules set mode='staff',capacity=3,start_date=date '2026-11-01',end_date=date '2026-12-31',minimum_lead_minutes=60,slot_interval_minutes=30 returning mode,capacity$$,
  $$values ('staff'::text,3::bigint)$$, 'owner updates only booking policy');
select results_eq($$update public.merchant_schedules set overrides='[{"date":"2026-11-01","hours":[{"startMinute":540,"endMinute":1020}],"breaks":[{"startMinute":720,"endMinute":780}]},{"date":"2026-11-02","hours":[],"breaks":[]}]' returning jsonb_array_length(overrides)$$,
  array[2], 'owner saves special opening and closure');
select is((select jsonb_array_length(blocks) from public.merchant_schedules),1,'special dates preserve existing date blocks');
select throws_ok($$update public.merchant_schedules set overrides='[{"date":"2026-02-30","hours":[],"breaks":[]}]'$$,'23514',null,'invalid override date rejected by stored CHECK');
select is((select jsonb_array_length(overrides) from public.merchant_schedules),2,'invalid override does not change stored days');
select results_eq($$select changed_fields::text from public.merchant_audit_events where entity_table='merchant_reservation_rules' and action='UPDATE'$$,
  array['{capacity,end_date,minimum_lead_minutes,mode,slot_interval_minutes,start_date}'], 'rules audit stores changed keys only');
select is((select actor_user_id from public.merchant_audit_events where entity_table='merchant_reservation_rules' and action='UPDATE'),
  'f3000000-0000-0000-0000-000000000001'::uuid, 'rules audit records verified owner');
select ok(not exists(select 1 from public.merchant_audit_events where row_to_json(merchant_audit_events)::text like '%2026-12-31%'), 'rules audit excludes policy values');

set local request.jwt.claim.sub='f3000000-0000-0000-0000-000000000005';
select is_empty($$select merchant_id from public.merchant_reservation_rules$$,'unassigned user cannot read rules');
select throws_ok($$insert into public.merchant_reservation_rules(merchant_id,mode,capacity,start_date,end_date,minimum_lead_minutes,slot_interval_minutes)
  values ('f3000000-0000-0000-0000-000000000004','shop',1,date '2026-11-01',date '2026-12-01',0,30)$$,'42501',null,'unassigned user cannot forge owner role');
set local request.jwt.claim.sub='f3000000-0000-0000-0000-000000000003';
select is_empty($$select merchant_id from public.merchant_reservation_rules$$,'other owner sees no A policy');
select is_empty($$select merchant_id from public.merchant_schedules where merchant_id='f3000000-0000-0000-0000-000000000002'$$,'other owner sees no A special dates');

set local role service_role;
set local request.jwt.claim.sub='';
select results_eq($$insert into public.merchant_reservation_rules(merchant_id,mode,capacity,start_date,end_date,minimum_lead_minutes,slot_interval_minutes)
  values ('f3000000-0000-0000-0000-000000000004','shop',1,date '2026-11-01',date '2026-12-01',0,30) returning merchant_id::text$$,
  array['f3000000-0000-0000-0000-000000000004'], 'service role can provision rules without client privileges');
select lives_ok($$update public.merchants set status='suspended' where id='f3000000-0000-0000-0000-000000000002'$$,'operator suspends fixture merchant');
set local role authenticated;
set local request.jwt.claim.sub='f3000000-0000-0000-0000-000000000001';
select results_eq($$select capacity from public.merchant_reservation_rules$$,array[3::bigint],'suspended owner can read rules');
select is_empty($$update public.merchant_reservation_rules set capacity=4 returning merchant_id$$,'suspended owner cannot update rules');
select is_empty($$update public.merchant_schedules set overrides='[]' returning merchant_id$$,'suspended owner cannot update special dates');

set local role service_role;
set local request.jwt.claim.sub='';
select lives_ok($$update public.merchant_memberships set revoked_at=now() where merchant_id='f3000000-0000-0000-0000-000000000002'$$,'operator revokes fixture membership');
set local role authenticated;
set local request.jwt.claim.sub='f3000000-0000-0000-0000-000000000001';
select is_empty($$select merchant_id from public.merchant_reservation_rules$$,'revoked owner cannot read rules');
select is_empty($$select merchant_id from public.merchant_schedules$$,'revoked owner cannot read special dates');
select is_empty($$update public.merchant_reservation_rules set capacity=5 returning merchant_id$$,'revoked owner cannot update rules');
select is_empty($$update public.merchant_schedules set overrides='[]' returning merchant_id$$,'revoked owner cannot update special dates');

select * from finish();
rollback;
