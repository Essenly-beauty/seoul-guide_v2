# Partner Persistence (A2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist merchant configuration with tenant isolation, database-enforced rules, minimal audit records, and owner account-deletion protection.

**Architecture:** Reuse Supabase Auth and the A1 catalog/schedule contract. Six RLS-protected tables hold private merchant configuration; the schedule is an atomic JSON aggregate with fixed fields, not a custom form builder. A private trigger writes append-only metadata audit records. This stage exposes no public booking or payment API.

**Tech Stack:** PostgreSQL 17, Supabase CLI 2.115, pgTAP, Next.js 15, TypeScript, Vitest.

---

## Boundaries and file map

- Worktree: `/Users/hanmyeong-gwan/mobile_design/.worktrees/service-quality-20261018`.
- Only mutable DB: isolated `/private/tmp/partner-db-20261018-GtGZtZ`, DB port 54342, shadow 54340. Baseline migrations have been applied. Never reset, stop, or migrate `supabase_db_mobile_design` (54322).
- Prefix Supabase commands with `SUPABASE_TELEMETRY_DISABLED=1`. Never use `--linked` or load remote credentials.
- Create `supabase/tests/partner_storage.test.sql`: grants, RLS, ownership, FK and audit behavior.
- Create `supabase/tests/partner_schedule.test.sql`: persistent schedule validation.
- Create generated `supabase/migrations/<CLI timestamp>_partner_configuration.sql`: authoritative deployable DDL, including private functions, grants and triggers. The exact timestamp is selected by CLI, never fabricated.
- Temporary authoring SQL belongs in the isolated directory, not a second committed schema source.
- Modify `app/api/account/delete/route.ts`; create `lib/partner/account-delete.test.ts`: actual route behavior with only external auth/database calls replaced in tests.
- Update `reports/operations/partner-booking-progress-2026-10-18.md` with exact verification and remaining gates.
- Preserve unrelated untracked `reports/operations/service-quality-release-2026-10-18.md`.
- No new packages, real merchant seed, payment mock, UI, public grants, remote push, deployment or production mutation.

## Task 1: Database storage and authorization

### Acceptance contract

The six public tables are `merchants`, `merchant_memberships`, `merchant_categories`, `merchant_services`, `merchant_schedules`, `merchant_audit_events`. All have RLS enabled and explicit grants. No table is readable by anon. Authenticated users may select their own membership even when revoked, so account deletion remains protected; only nonrevoked owners may read other merchant data. Suspended/closed merchants remain readable to their owner but cannot be edited. An unassigned authenticated user sees no merchant data. Authorization never uses editable user metadata.

Operator provisioning is a trusted server/SQL procedure, not a new public RPC or merchant self-service endpoint. One owner per merchant and one merchant per user for this version. Ownership FK to auth.users uses RESTRICT, not CASCADE; revoked ownership still blocks deletion until an explicit operator cleanup/transfer. Merchants may edit contact/name/address/industry, categories, services except approved deposit, and schedules. IDs, ownership, timestamps, operating status, booking flag and approved deposit are not client-editable. No client DELETE grants. Hide/archive instead.

Reservations do not exist at A2. `booking_enabled` defaults false and CHECK enforces false until the separately reviewed B migration. Deposit remains null until trusted operator approval; owners cannot insert or change it. A nonnull deposit is positive, safe integer KRW and never greater than a nonnull total. All other A1 fields retain their snake_case equivalents, empty draft text, positive nullable money/duration and nonnegative cleanup/sort values. Cross-merchant category references fail at DB level.

- [ ] **Step 1: Write a failing schema test before authoring DDL.**

```sql
begin;
select plan(6);
select has_table('public', 'merchants', 'merchant storage exists');
select has_table('public', 'merchant_memberships', 'ownership exists');
select has_table('public', 'merchant_categories', 'categories exist');
select has_table('public', 'merchant_services', 'services exist');
select has_table('public', 'merchant_schedules', 'schedules exist');
select has_table('public', 'merchant_audit_events', 'audit exists');
select * from finish();
rollback;
```

- [ ] **Step 2: Run RED against the isolated baseline.**

```bash
SUPABASE_TELEMETRY_DISABLED=1 supabase test db /Users/hanmyeong-gwan/mobile_design/.worktrees/service-quality-20261018/supabase/tests/partner_storage.test.sql --local --workdir /private/tmp/partner-db-20261018-GtGZtZ
```

Expected: six missing-table assertion failures, not a connection/tool error.

- [ ] **Step 3: Author minimal tables in temporary SQL and apply with local `db query`.**

This is the concrete table contract. Put the script in one `DO $ddl$ BEGIN ... END $ddl$` statement for CLI prepared-statement compatibility. Functions inside it require distinct dollar tags. Check constraints must reject invalid values rather than relying on UI validation.

```sql
create schema if not exists private;
create table public.merchants (
 id uuid primary key default gen_random_uuid(),
 display_name text not null default '' check (length(display_name) <= 120),
 contact_email text not null default '' check (length(contact_email) <= 320),
 contact_phone text not null default '' check (length(contact_phone) <= 80),
 address text not null default '' check (length(address) <= 500),
 business_types text[] not null default '{}' check (business_types <@ array['hair','nail','head_spa']::text[]),
 status text not null default 'onboarding' check (status in ('onboarding','active','suspended','closed')),
 booking_enabled boolean not null default false check (booking_enabled = false),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.merchant_memberships (
 merchant_id uuid primary key references public.merchants(id) on delete restrict,
 user_id uuid not null unique references auth.users(id) on delete restrict,
 revoked_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.merchant_categories (
 id uuid primary key default gen_random_uuid(),
 merchant_id uuid not null references public.merchants(id) on delete restrict,
 name_ko text not null default '' check (length(name_ko) <= 120),
 name_en text not null default '' check (length(name_en) <= 120),
 visibility text not null default 'draft' check (visibility in ('draft','visible','hidden','archived')),
 sort_order bigint not null default 0 check (sort_order between 0 and 9007199254740991),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique (merchant_id, id)
);
create table public.merchant_services (
 id uuid primary key default gen_random_uuid(),
 merchant_id uuid not null references public.merchants(id) on delete restrict,
 category_id uuid not null,
 name_ko text not null default '' check (length(name_ko) <= 120),
 name_en text not null default '' check (length(name_en) <= 120),
 description_ko text not null default '' check (length(description_ko) <= 4000),
 description_en text not null default '' check (length(description_en) <= 4000),
 price_krw bigint check (price_krw between 1 and 9007199254740991),
 deposit_krw bigint check (deposit_krw between 1 and 9007199254740991),
 duration_minutes bigint check (duration_minutes between 1 and 9007199254740991),
 cleanup_minutes bigint not null default 0 check (cleanup_minutes between 0 and 9007199254740991),
 visibility text not null default 'draft' check (visibility in ('draft','visible','hidden','archived')),
 sort_order bigint not null default 0 check (sort_order between 0 and 9007199254740991),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 foreign key (merchant_id,category_id) references public.merchant_categories(merchant_id,id) on delete restrict,
 check (deposit_krw is null or price_krw is null or deposit_krw <= price_krw)
);
create index merchant_services_category_idx on public.merchant_services(merchant_id,category_id);
create table public.merchant_schedules (
 merchant_id uuid primary key references public.merchants(id) on delete restrict,
 hours jsonb not null default '[]', breaks jsonb not null default '[]', blocks jsonb not null default '[]',
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.merchant_audit_events (
 id uuid primary key default gen_random_uuid(),
 merchant_id uuid not null references public.merchants(id) on delete restrict,
 entity_table text not null, entity_id uuid not null,
 action text not null check (action in ('INSERT','UPDATE','DELETE')),
 changed_fields text[] not null,
 actor_user_id uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now()
);
create index merchant_audit_events_merchant_time_idx on public.merchant_audit_events(merchant_id,created_at desc);
create index merchant_audit_events_actor_idx on public.merchant_audit_events(actor_user_id);
```

- [ ] **Step 4: Add failing tenant/grant tests, then the policies and grants.**

Seed two auth users, two merchants and two memberships inside a rolled-back pgTAP transaction, using UUIDs ending 1/2 for users, 11/12 for merchants, 21/22 for categories. Provision as postgres with no JWT claim. Exercise `set local role authenticated` and `set local request.jwt.claim.sub` for each owner. Execute actual INSERT/UPDATE RETURNING, not just policy-name assertions. Core test patterns:

```sql
select ok(not has_table_privilege('anon','public.merchants','select'), 'no guest disclosure');
select results_eq($$select display_name from public.merchants$$, array['Merchant A'], 'owner reads own merchant');
select is_empty($$update public.merchants set display_name='stolen' where id='00000000-0000-0000-0000-000000000012' returning id$$, 'cross-tenant edit does nothing');
select throws_ok($$update public.merchants set booking_enabled=true$$, '42501', null, 'owner cannot enable booking');
select throws_ok($$insert into public.merchant_memberships(merchant_id,user_id) values ('00000000-0000-0000-0000-000000000012','00000000-0000-0000-0000-000000000001')$$, '42501', null, 'no self grant');
select throws_ok($$update public.merchant_services set deposit_krw=1$$, '42501', null, 'deposit approval reserved');
```

Use this concrete predicate on merchant SELECT, and on category/service/schedule/audit SELECT with their `merchant_id` substituted for `merchants.id`:

```sql
exists (select 1 from public.merchant_memberships mm
 where mm.merchant_id = merchants.id and mm.user_id = (select auth.uid()) and mm.revoked_at is null)
```

Membership SELECT policy is `user_id = (select auth.uid())`, deliberately without a revoked filter. For merchant UPDATE use the owner predicate **and** `status in ('onboarding','active')` in both USING and WITH CHECK. For category/service/schedule INSERT and UPDATE use the following private **SECURITY INVOKER** helper; SELECT still uses the direct ownership predicate. It relies on the already tenant-filtered merchant SELECT policy and therefore has no recursive policy cycle.

```sql
create function private.partner_can_write(target uuid) returns boolean language sql stable
security invoker set search_path = '' as $fn$
 select exists(select 1 from public.merchant_memberships mm join public.merchants m on m.id=mm.merchant_id
 where mm.merchant_id=target and mm.user_id=(select auth.uid()) and mm.revoked_at is null
 and m.status in ('onboarding','active'));
$fn$;
revoke all on function private.partner_can_write(uuid) from public, anon;
grant usage on schema private to authenticated, service_role;
grant execute on function private.partner_can_write(uuid) to authenticated;
```

Revoke all table privileges from PUBLIC/anon/authenticated first (including defaults), then grant authenticated SELECT on all six tables. Grant UPDATE only these columns: merchants `(display_name,contact_email,contact_phone,address,business_types)`; categories `(name_ko,name_en,visibility,sort_order)`; services `(category_id,name_ko,name_en,description_ko,description_en,price_krw,duration_minutes,cleanup_minutes,visibility,sort_order)`; schedules `(hours,breaks,blocks)`. INSERT only categories `(id,merchant_id,name_ko,name_en,visibility,sort_order)`, services `(id,merchant_id,category_id,name_ko,name_en,description_ko,description_en,price_krw,duration_minutes,cleanup_minutes,visibility,sort_order)`, schedules `(merchant_id,hours,breaks,blocks)`. Grant service_role all six tables for explicitly trusted server operations. No DELETE, membership write or audit write grant to ordinary users.

- [ ] **Step 5: Add failing schedule tests, then the immutable schedule validator.**

Contract: arrays only; objects with numeric integer `startMinute`/`endMinute`, 0 <= start < end <=1440; weekly items weekday integer0..6; date blocks use exact real `YYYY-MM-DD`; same-kind same-day intervals must not overlap; adjacent intervals allowed; every break contained in one opening interval. Empty arrays valid draft. Reject wrong JSON types and invalid dates with check violation, not uncontrolled casts. Fixed field JSON is stored in one row, so a whole edit is atomic. Calendar logic must agree with A1, including leap years; business hours are not bookable availability. Bound work before overlap loops: at most 128 opening periods, 128 breaks, 512 date blocks, and 256 KiB total JSON text. These storage limits must be tested and surfaced by the A3 request parser/UI; A1 remains a pure calculation contract.

```sql
create function private.partner_schedule_valid(h jsonb,b jsonb,d jsonb) returns boolean
language plpgsql immutable security invoker set search_path='' as $fn$
declare arr jsonb; item jsonb; other jsonb; kind integer; pos integer; other_pos integer;
 s numeric; e numeric; weekday numeric; yy integer; mm integer; dd integer; days integer;
begin
 if h is null or b is null or d is null then return false; end if;
 if jsonb_typeof(h)<>'array' or jsonb_typeof(b)<>'array' or jsonb_typeof(d)<>'array' then return false; end if;
 if jsonb_array_length(h)>128 or jsonb_array_length(b)>128 or jsonb_array_length(d)>512
  or octet_length(h::text)+octet_length(b::text)+octet_length(d::text)>262144 then return false; end if;
 for kind in 1..3 loop
  arr := case kind when 1 then h when 2 then b else d end;
  if jsonb_typeof(arr) <> 'array' then return false; end if;
  for item in select value from jsonb_array_elements(arr) loop
   if jsonb_typeof(item) <> 'object' or jsonb_typeof(item->'startMinute') is distinct from 'number'
    or jsonb_typeof(item->'endMinute') is distinct from 'number' then return false; end if;
   s := (item->>'startMinute')::numeric; e := (item->>'endMinute')::numeric;
   if s <> trunc(s) or e <> trunc(e) or s < 0 or s >= e or e > 1440 then return false; end if;
   if kind < 3 then
    if jsonb_typeof(item->'weekday') is distinct from 'number' then return false; end if;
    weekday := (item->>'weekday')::numeric;
    if weekday <> trunc(weekday) or weekday < 0 or weekday > 6 then return false; end if;
   else
    if jsonb_typeof(item->'date') is distinct from 'string' or (item->>'date') !~ '^\d{4}-\d{2}-\d{2}$' then return false; end if;
    yy := substring(item->>'date',1,4)::integer; mm := substring(item->>'date',6,2)::integer; dd := substring(item->>'date',9,2)::integer;
    if mm < 1 or mm > 12 then return false; end if;
    days := case when mm in (4,6,9,11) then 30 when mm=2 then
      case when yy%400=0 or (yy%4=0 and yy%100<>0) then 29 else 28 end else 31 end;
    if dd < 1 or dd > days then return false; end if;
   end if;
  end loop;
  for item,pos in select value,ordinality::integer from jsonb_array_elements(arr) with ordinality loop
   for other,other_pos in select value,ordinality::integer from jsonb_array_elements(arr) with ordinality loop
    if other_pos > pos and (case when kind<3 then item->'weekday'=other->'weekday' else item->'date'=other->'date' end)
     and (item->>'startMinute')::numeric < (other->>'endMinute')::numeric
     and (other->>'startMinute')::numeric < (item->>'endMinute')::numeric then return false; end if;
   end loop;
  end loop;
 end loop;
 for item in select value from jsonb_array_elements(b) loop
  if not exists(select 1 from jsonb_array_elements(h) o where o->'weekday'=item->'weekday'
   and (o->>'startMinute')::numeric <= (item->>'startMinute')::numeric
   and (item->>'endMinute')::numeric <= (o->>'endMinute')::numeric) then return false; end if;
 end loop;
 return true;
end;
$fn$;
revoke all on function private.partner_schedule_valid(jsonb,jsonb,jsonb) from public, anon;
grant execute on function private.partner_schedule_valid(jsonb,jsonb,jsonb) to authenticated, service_role;
alter table public.merchant_schedules add constraint merchant_schedules_valid
 check(private.partner_schedule_valid(hours,breaks,blocks));
```

Actual persisted test example (after owner fixture):

```sql
select throws_ok($$insert into public.merchant_schedules(merchant_id,hours) values
 ('00000000-0000-0000-0000-000000000011','[{"weekday":1,"startMinute":600,"endMinute":600}]')$$,
 '23514',null,'zero-length opening rejected');
select lives_ok($$insert into public.merchant_schedules(merchant_id,hours,breaks) values
 ('00000000-0000-0000-0000-000000000011','[{"weekday":1,"startMinute":540,"endMinute":1080}]',
 '[{"weekday":1,"startMinute":720,"endMinute":780}]')$$,'valid schedule persisted');
```

- [ ] **Step 6: Add failing audit tests, then private trigger functions.**

Every successful merchant/membership/category/service/schedule INSERT, meaningful UPDATE and DELETE emits an audit event in the same transaction. Keep only changed field names, table/id, actor and timestamp: no raw old/new JSON, contact details, customer data or secrets. Null actor denotes trusted operator SQL/service-role work. Reject null-UID ordinary caller. Private SECURITY DEFINER is narrowly justified for inserting into a table clients cannot append to. Fixed empty search_path, fully qualified relations, revoked direct execution, explicit auth.uid check. No elevated authorization helper.

```sql
create function private.partner_touch() returns trigger language plpgsql security invoker set search_path='' as $fn$
begin new.updated_at := now(); return new; end;
$fn$;
revoke all on function private.partner_touch() from public,anon,authenticated;
create function private.partner_audit() returns trigger language plpgsql security definer set search_path='' as $fn$
declare before_row jsonb := '{}'::jsonb; after_row jsonb := '{}'::jsonb; row_data jsonb;
 tenant uuid; entity uuid; actor uuid := auth.uid(); fields text[];
begin
 if TG_OP <> 'INSERT' then before_row := to_jsonb(old); end if;
 if TG_OP <> 'DELETE' then after_row := to_jsonb(new); end if;
 row_data := case when TG_OP='DELETE' then before_row else after_row end;
 tenant := (case when TG_TABLE_NAME='merchants' then row_data->>'id' else row_data->>'merchant_id' end)::uuid;
 entity := coalesce(row_data->>'id',row_data->>'merchant_id')::uuid;
 if actor is null then
  if not (coalesce(current_setting('role',true),'none') in ('postgres','service_role')
   or (coalesce(current_setting('role',true),'none')='none' and session_user='postgres')) then
   raise exception 'Audit actor required' using errcode='42501';
  end if;
 elsif not exists(select 1 from public.merchant_memberships where merchant_id=tenant and user_id=actor and revoked_at is null) then
  raise exception 'Audit actor not authorized' using errcode='42501';
 end if;
 select coalesce(array_agg(k order by k),'{}'::text[]) into fields
 from (select jsonb_object_keys(before_row || after_row) k) keys
 where k not in ('created_at','updated_at') and before_row->k is distinct from after_row->k;
 if cardinality(fields)>0 then
  insert into public.merchant_audit_events(merchant_id,entity_table,entity_id,action,changed_fields,actor_user_id)
  values(tenant,TG_TABLE_NAME,entity,TG_OP,fields,actor);
 end if;
 return null;
end;
$fn$;
revoke all on function private.partner_audit() from public,anon,authenticated,service_role;
```

Attach `partner_touch` BEFORE UPDATE and `partner_audit` AFTER INSERT OR UPDATE OR DELETE FOR EACH ROW to the five configuration tables, not the audit table. Test own successful menu price update produces matching actor/changed_fields, failed cross-tenant update produces no audit, owner cannot forge/modify/delete audit, cross-tenant audit hidden, membership change is audited. Test trusted service_role provisioning separately from postgres. Test auth user deletion raises FK violation even for revoked owner, and ordinary nonowner user deletion still works. Test default false booking plus operator true attempt fails CHECK.

- [ ] **Step 7: Verify all security cases and run advisors.**

```bash
SUPABASE_TELEMETRY_DISABLED=1 supabase test db /Users/hanmyeong-gwan/mobile_design/.worktrees/service-quality-20261018/supabase/tests --local --workdir /private/tmp/partner-db-20261018-GtGZtZ
SUPABASE_TELEMETRY_DISABLED=1 supabase db advisors --local --type all --fail-on error --workdir /private/tmp/partner-db-20261018-GtGZtZ
```

Expected tests all PASS. Separate pre-existing baseline advisor notices from new issues; fix new security errors and FK-index gaps. Query pg_class/pg_policies/routine privileges to verify actual state, not only SQL text. Every UPDATE has both USING/WITH CHECK and SELECT support. Check no accidental anon/PUBLIC grants, private definer callable by ordinary users, default-privilege leakage, policy recursion or merchant transfer by updating IDs.

- [ ] **Step 8: Generate and replay the migration.**

```bash
SUPABASE_TELEMETRY_DISABLED=1 supabase db pull partner_configuration --local --yes --schema public,private --workdir /private/tmp/partner-db-20261018-GtGZtZ
SUPABASE_TELEMETRY_DISABLED=1 supabase migration list --local --workdir /private/tmp/partner-db-20261018-GtGZtZ
```

Inspect generated SQL: only six new tables and their functions/indexes/policies/grants/triggers, no unrelated baseline mutation. Include private schema creation and ACLs if diff engine omits them; verify those repairs with replay. Copy only the generated new migration to worktree. Create another empty isolated project with `mktemp -d`, unique project id and unused ports, seed disabled. Copy all repository migrations and start it, then rerun entire pgTAP directory against that project. This fresh replay proves the committed migration, not just scratch DB state. Never reset the existing mobile_design database.

- [ ] **Step 9: Self-review, commit exact SQL/test files, spec review, then quality review.**

```bash
git diff --check
git status --short
```

Commit subject: `feat: persist tenant-isolated partner configuration`. Stage exact generated path and the two tests. Reviewers independently inspect actual SQL, test behavior and new privilege boundary. Address findings and repeat the relevant review before Task 2.

## Task 2: Owner account-deletion protection

- [ ] **Step 1: Add failing route tests in `lib/partner/account-delete.test.ts`.**

Import real `POST` from `@/app/api/account/delete/route`; replace `supabaseServer` and `createClient` only because these are external session/network boundaries. Stub environment per test and restore it. Keep existing same-origin/auth behavior. The critical behavior assertion is:

```ts
const response = await POST(new Request('https://example.test/api/account/delete', {
  method: 'POST', headers: { origin: 'https://example.test', host: 'example.test' },
}));
expect(response.status).toBe(409);
expect(await response.json()).toMatchObject({
  code: 'MERCHANT_ACCOUNT_REQUIRES_SUPPORT', supportPath: '/support',
});
expect(deleteUser).not.toHaveBeenCalled();
expect(signOut).not.toHaveBeenCalled();
```

Fixtures cover authenticated owner (including revoked membership returned by DB), ordinary user with empty membership list (200 and deletion), ownership query error (503 and no privileged client/deletion), query transport rejection (503), no user (401, no ownership query), and cross-origin (403). Assert the owner query selects only merchant_id and filters the server-authenticated user id, not request input. DB pgTAP already validates the real RLS and FK, so do not fake tenant isolation in unit tests.

- [ ] **Step 2: Run RED.**

```bash
npx vitest run lib/partner/account-delete.test.ts
```

Expected owner/error tests fail because current route deletes user without ownership check.

- [ ] **Step 3: Insert fail-closed ownership check immediately after authenticated user lookup and before service-role creation.**

```ts
try {
  const { data: memberships, error: membershipError } = await supabase
    .from('merchant_memberships').select('merchant_id').eq('user_id', user.id).limit(1);
  if (membershipError || memberships === null) {
    return NextResponse.json({ code: 'MERCHANT_OWNERSHIP_CHECK_FAILED', error: 'Deletion is temporarily unavailable.' }, { status: 503 });
  }
  if (memberships.length > 0) {
    return NextResponse.json({ code: 'MERCHANT_ACCOUNT_REQUIRES_SUPPORT',
      error: 'Please contact support to close or transfer your merchant before deleting your account.',
      supportPath: '/support' }, { status: 409 });
  }
} catch {
  return NextResponse.json({ code: 'MERCHANT_OWNERSHIP_CHECK_FAILED', error: 'Deletion is temporarily unavailable.' }, { status: 503 });
}
```

Update route comment to distinguish normal account-owned cascades from restricted merchant ownership. Do not change auth provider/global SSR/session flow or use service role to read merchant data. DB FK catches the race if ownership is assigned after the read; no orphaning even when the route returns its existing generic deletion failure.

- [ ] **Step 4: Verify behavior and repository checks.**

```bash
npx vitest run lib/partner/account-delete.test.ts
npm test -- --run
npm run typecheck
npm run lint
git diff --check
```

Expected targeted tests pass, no existing regressions (baseline 118 files /1127 tests), type/lint exit0. Record existing tooling notices separately. Do not call a build/browser/live-account deletion tested unless actually performed.

- [ ] **Step 5: Commit, spec review, then quality review.**

```bash
git add app/api/account/delete/route.ts lib/partner/account-delete.test.ts
git commit -m "fix: protect merchant owners from account deletion"
```

## Verification handoff

- [ ] Main agent reruns new SQL tests against fresh-replay DB, full Vitest/type/lint, checks git diff and reviews final integration.
- [ ] Update progress report with exact tests, migration name, isolated DB details, local-only changes and no deployment.
- [ ] Document deployment ordering: approved migration must precede code containing ownership lookup; missing relation fails closed503. No temporary permissive fallback.
- [ ] A3 still needs authenticated server data paths and merchant UI; A4 needs UI/integration QA. B still needs separate approved booking/payment design, provider, partner and policies. A2 is not a live reservation system.

## Plan self-review

- A2 storage/rights/audit/account-delete requirements covered by Tasks1–2. UI/public projections/holds/payments correctly excluded.
- All relation/column names match the contract. Snake_case storage maps to existing A1 camelCase in A3, with request-shape validation there.
- Draft nullable fields remain nullable, while approved deposit and booking activation remain operator-controlled.
- `private` is not an exposed API schema; elevated function is restricted to audit-trigger purpose. Owners can read their own revoked membership only, not the merchant's other data.
- Local workflow follows [Supabase RLS guidance](https://supabase.com/docs/guides/database/postgres/row-level-security) and [database testing guidance](https://supabase.com/docs/guides/local-development/testing/overview). Existing Docker/DB data are preserved.
