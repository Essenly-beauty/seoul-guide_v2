begin;
select no_plan();

select ok(not has_table_privilege('authenticated', 'public.merchants', 'update'), 'authenticated has no merchant table update grant');
select ok(not has_column_privilege('authenticated', 'public.merchants', column_name, 'update'), column_name || ' is platform owned')
from unnest(array['display_name','contact_email','contact_phone','address','business_types']) column_name;

set local request.jwt.claim.sub='';
insert into auth.users(id,email) values
 ('f1000000-0000-0000-0000-000000000001','profile-owner-a@example.test'),
 ('f2000000-0000-0000-0000-000000000001','profile-owner-b@example.test');
insert into public.merchants(id,display_name,status) values
 ('f1000000-0000-0000-0000-000000000002','Profile A','active'),
 ('f2000000-0000-0000-0000-000000000002','Profile B','active');
insert into public.merchant_memberships(merchant_id,user_id) values
 ('f1000000-0000-0000-0000-000000000002','f1000000-0000-0000-0000-000000000001'),
 ('f2000000-0000-0000-0000-000000000002','f2000000-0000-0000-0000-000000000001');

set local role authenticated;
set local request.jwt.claim.sub='f1000000-0000-0000-0000-000000000001';
select results_eq($$select display_name from public.merchants order by id$$, array['Profile A'], 'owner reads only own platform managed profile');
select throws_ok($$update public.merchants set display_name='Owner change' where id='f1000000-0000-0000-0000-000000000002'$$, '42501', null, 'active owner cannot update own profile');
select throws_ok($$update public.merchants set booking_enabled=true where id='f1000000-0000-0000-0000-000000000002'$$, '42501', null, 'owner cannot approve booking connection');
select results_eq($$insert into public.merchant_categories(id,merchant_id) values ('f1000000-0000-0000-0000-000000000003','f1000000-0000-0000-0000-000000000002') returning id::text$$, array['f1000000-0000-0000-0000-000000000003'], 'owner can still create categories');
select results_eq($$update public.merchant_categories set name_ko='예약 메뉴' where id='f1000000-0000-0000-0000-000000000003' returning name_ko$$, array['예약 메뉴'], 'owner can still update categories');
select results_eq($$insert into public.merchant_services(id,merchant_id,category_id) values ('f1000000-0000-0000-0000-000000000004','f1000000-0000-0000-0000-000000000002','f1000000-0000-0000-0000-000000000003') returning id::text$$, array['f1000000-0000-0000-0000-000000000004'], 'owner can still create menus');
select results_eq($$update public.merchant_services set name_ko='헤어 상담' where id='f1000000-0000-0000-0000-000000000004' returning name_ko$$, array['헤어 상담'], 'owner can still update menus');
select results_eq($$insert into public.merchant_schedules(merchant_id) values ('f1000000-0000-0000-0000-000000000002') returning merchant_id::text$$, array['f1000000-0000-0000-0000-000000000002'], 'owner can still create a schedule');
select results_eq($$update public.merchant_schedules set hours='[{"weekday":1,"startMinute":540,"endMinute":1080}]' where merchant_id='f1000000-0000-0000-0000-000000000002' returning jsonb_array_length(hours)$$, array[1], 'owner can still update a schedule');

set local role service_role;
set local request.jwt.claim.sub='';
select results_eq($$update public.merchants set display_name='Platform A',contact_email='platform-profile@example.test',contact_phone='02-1234-5678',address='서울',business_types=array['hair','nail'] where id='f1000000-0000-0000-0000-000000000002' returning display_name$$, array['Platform A'], 'trusted service role can update fixture profile with null actor');
select results_eq($$select changed_fields::text from public.merchant_audit_events where merchant_id='f1000000-0000-0000-0000-000000000002' and entity_table='merchants' and action='UPDATE'$$, array['{address,business_types,contact_email,contact_phone,display_name}'], 'platform profile audit contains sorted changed keys');
select is((select count(*) from public.merchant_audit_events where merchant_id='f1000000-0000-0000-0000-000000000002' and entity_table='merchants' and action='UPDATE' and actor_user_id is null), 1::bigint, 'platform profile audit has null actor');
select ok(not exists(select 1 from public.merchant_audit_events e where merchant_id='f1000000-0000-0000-0000-000000000002' and row_to_json(e)::text like '%platform-profile%'), 'profile values stay absent from audit');
select throws_ok($$update public.merchants set booking_enabled=true where id='f1000000-0000-0000-0000-000000000002'$$, '23514', null, 'booking remains disconnected even for platform');

select * from finish();
rollback;
