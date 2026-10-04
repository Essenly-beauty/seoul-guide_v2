begin;
select plan(9);

select ok((select relrowsecurity from pg_class where oid = 'public.places'::regclass), 'public places has RLS');
select ok(has_table_privilege('anon', 'public.places', 'select'), 'guest has read grant');
select ok(not has_table_privilege('anon', 'public.places', 'insert'), 'guest cannot write');
select ok(not has_schema_privilege('anon', 'internal', 'usage'), 'guest cannot use internal schema');

insert into public.places
  (id, type, zone, name, name_kr, address, lat, lng, publication_state, payload, payload_sha256)
values
  ('catalog-test-live', 'daiso', 'gangnam_station', 'Live', '공개', '서울 강남구 1', 37.5, 127.0,
   'published', '{"id":"catalog-test-live"}'::jsonb, repeat('a', 64)),
  ('catalog-test-draft', 'daiso', 'gangnam_station', 'Draft', '초안', '서울 강남구 2', 37.5, 127.0,
   'draft', '{"id":"catalog-test-draft"}'::jsonb, repeat('b', 64));

set local role anon;
select results_eq($$select id from public.places where id like 'catalog-test-%' order by id$$,
  array['catalog-test-live'], 'guest sees only published row');
select throws_ok($$insert into public.places
  (id, type, zone, name, name_kr, address, lat, lng, payload, payload_sha256)
  values ('catalog-test-guest', 'daiso', 'gangnam_station', 'Guest', '게스트', '서울 강남구 3',
    37.5, 127.0, '{"id":"catalog-test-guest"}'::jsonb, repeat('c', 64))$$,
  '42501', null, 'guest insert denied');
select throws_ok($$select * from internal.place_source_records$$,
  '42501', null, 'guest cannot read source records');

set local role authenticated;
select results_eq($$select id from public.places where id like 'catalog-test-%' order by id$$,
  array['catalog-test-live'], 'member sees only published row');
select ok(not has_table_privilege('authenticated', 'public.places', 'update'), 'member cannot edit');

select * from finish();
rollback;
