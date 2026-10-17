begin;
select plan(12);

insert into auth.users (id, email)
values
  ('11111111-1111-1111-1111-111111111111', 'shared-list-owner@example.test'),
  ('22222222-2222-2222-2222-222222222222', 'shared-list-recipient@example.test');

insert into public.shared_lists (id, owner, title, place_ids)
values (
  '33333333-3333-4333-8333-333333333333',
  '11111111-1111-1111-1111-111111111111',
  'Owner list',
  array['namdaemun-market']
);

select ok((select relrowsecurity from pg_class where oid = 'public.shared_lists'::regclass), 'shared_lists has RLS enabled');
select ok(not has_table_privilege('anon', 'public.shared_lists', 'select'), 'anon has no direct read grant');
select ok(has_table_privilege('authenticated', 'public.shared_lists', 'select,insert,delete'), 'members retain owner management grants');

set local role anon;
select throws_ok($$select id from public.shared_lists$$, '42501', null, 'guest direct read is denied');
select throws_ok(
  $$insert into public.shared_lists (owner, title, place_ids)
    values ('11111111-1111-1111-1111-111111111111', 'Guest attempt', array['namdaemun-market'])$$,
  '42501', null, 'guest cannot create a link'
);

set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select results_eq(
  $$select title from public.shared_lists order by title$$,
  array['Owner list'],
  'owner sees their only list'
);
select results_eq(
  $$insert into public.shared_lists (id, owner, title, place_ids)
    values ('44444444-4444-4444-8444-444444444444',
      '11111111-1111-1111-1111-111111111111', 'New link', array['ssamziegil'])
    returning id::text$$,
  array['44444444-4444-4444-8444-444444444444'],
  'owner insert returning id still works'
);

set local request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select is_empty($$select id from public.shared_lists$$, 'recipient cannot enumerate owner rows directly');
select is_empty(
  $$delete from public.shared_lists where id = '33333333-3333-4333-8333-333333333333' returning id$$,
  'recipient cannot revoke an owner link'
);

set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select results_eq(
  $$select title from public.shared_lists where id = '33333333-3333-4333-8333-333333333333'$$,
  array['Owner list'],
  'failed recipient revoke leaves owner row intact'
);
select results_eq(
  $$delete from public.shared_lists where id = '33333333-3333-4333-8333-333333333333' returning id::text$$,
  array['33333333-3333-4333-8333-333333333333'],
  'owner can revoke own link'
);
select is_empty(
  $$select id from public.shared_lists where id = '33333333-3333-4333-8333-333333333333'$$,
  'revoked link is no longer directly visible'
);

select * from finish();
rollback;
