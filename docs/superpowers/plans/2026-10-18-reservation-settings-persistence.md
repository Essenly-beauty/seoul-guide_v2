# Reservation Settings and Special Dates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let each verified merchant save reservation mode, shared capacity, date range, lead/grid policy, and special-date opening/closure through the real admin API and database.

**Architecture:** Extend the existing tenant-scoped Supabase schema and `/api/partner` command channel. Preserve existing weekly schedule commands; store date overrides on the same versioned schedule row, with a separate narrow command. A separate nullable rules row requires explicit merchant input; no business defaults are published. Use reviewed pure `ReservationRules` and `ReservationSchedule` as the validation source. A merchant's configuration is not a live reservation or customer slot endpoint.

**Tech Stack:** Existing Next.js 15, TypeScript, React, Supabase/Postgres with RLS, Vitest, pgTAP. No package or provider change.

---

## Scope and constraints

Approved source: `docs/superpowers/specs/2026-10-18-partner-reservation-operations-design.md`. R1 shared pure contracts are reviewed at `9f285ef`; platform-owned profile is reviewed at `40547a9`. This plan is the second persisted operations slice. Staff records, staff schedules/menu assignments, customer availability, reservation writes and payment are later units. In particular, booking activation remains checked false in the database. Staff mode may be configured before staff records exist; the customer cannot book until staff integration and operator gates pass.

Work only in `/Users/hanmyeong-gwan/mobile_design/.worktrees/service-quality-20261018`, branch `codex/service-quality-release-20261018`; preserve unrelated untracked release report. No production DB change, real merchant provisioning, remote push or deployment. Existing A3 UI quality/navigation/accessibility checks remain open.

Only write the guarded disposable local QA project `/private/tmp/partner-app-20261018-Io8Zlv` (API 54381, DB 54382). Assert both from privately parsed `SUPABASE_TELEMETRY_DISABLED=1 supabase status --workdir ... -o json` before applying SQL. Do not print keys or connection string, reset/delete QA data, or use `--linked`. SQL tests roll back. CLI `db query --file` rejects multi-statement prepared queries in installed v2.115.0, so apply this migration to the exact QA container with `docker exec -i supabase_db_partner-app-20261018-Io8Zlv psql -U postgres -d postgres -v ON_ERROR_STOP=1 -1` reading the exact file on stdin, after status and container-name preflight; no other container/port. If `docker exec` is unavailable, stop and report rather than applying to a guessed database.

## Execution record — 2026-10-18

Tasks 1–3 and the first handoff check below are complete on this local branch; the next staff unit is not. Schema/test `8732b57`, API `a49793d` plus correction `4bd2ce4`, UI `e15c28d` plus corrections `9b17709` and `b002407` passed independent task-level and whole-unit review. The shared-row draft rebase only advances the version when that form's own persisted values remain unchanged; otherwise the 409 conflict remains.

Fresh root verification: 133 Vitest files / 1,723 tests, TypeScript, lint, 58-route production build using the guarded local Supabase URL/key, five pgTAP files / 268 tests, desktop and narrow browser form/validation/accessible-name QA. A new isolated `.test` local Auth merchant exercised real API rules and special-date create/update/reload, stale 409 responses, cross-tenant read isolation, legacy weekly update preserving special dates, and category/menu create/reload. The fixture and its audit history remain only in the disposable QA database; existing QA owner content was not written. No production DB, real merchant, payment, push or deploy was changed.

Production gate: preflight existing `merchant_schedules` rows for the new combined 256 KiB CHECK and plan the table-lock window; apply this migration before the new API or partner GET can return 503. Keep `booking_enabled=false` until DB-atomic collision protection also covers legacy weekly writes and direct authenticated Data API writes. The wider predeploy `audit:data:check` currently fails because tracked place-audit reports are stale; this unrelated content-quality gate remains open and was not hidden by regenerating reports in this reservation slice.

## File map

- `supabase/migrations/20261018121926_merchant_reservation_rules_and_overrides.sql`: CLI-created empty file; append rules table/RLS/ACL/audit and schedule overrides validation. Do not edit historical migrations.
- `supabase/tests/reservation_settings.test.sql`: tenant, bounds, grants, date override, audit and regression checks, fixed fixture IDs and transaction rollback.
- `lib/partner/reservation-commands.ts` and `.test.ts`: separate strict runtime command parser for rules and override arrays, built on R1 validators; does not add a circular import into `contracts.ts`.
- `lib/partner/reservation-store.ts` and `.test.ts`: explicit Supabase mapping/owned reads and narrow stamped writes, no service role.
- `lib/partner/contracts.ts`, `server.ts`, `mutations.ts`, and existing tests: add nullable validated rules and override list to `PartnerSnapshot` while retaining legacy schedule command shape and behavior. `mutations.ts` category/menu/schedule writes remain unchanged.
- `app/api/partner/route.ts`, `lib/partner/api.test.ts`: dispatch old or new parsed command through the same verified context and same-origin/private response rules.
- `components/partner/partner-provider.tsx`, `partner-availability.tsx`, `partner.module.css`, `lib/partner/form-values.ts`, markup/form tests: editable reservation policy and special-date sections with draft/conflict recovery using existing form infrastructure. Avoid a second standalone admin shell.

## Task 1: Persistent schema and database policy

- [x] Write `reservation_settings.test.sql` and run it against guarded QA DB to observe RED before migration. Test: `merchant_reservation_rules` absent, `merchant_schedules.overrides` absent; explicit rules fields required (positive safe capacity, valid inclusive dates 0001–9999, bounded lead/grid); owner A can read/write own row, owner B cannot; suspended/revoked cannot write; anon has no table access; authenticated cannot update merchant ID or operational approval fields; service role remains available; audit stores changed keys/actor but no values. Override payload requires ≤366 unique real dates, exactly `date/hours/breaks`, each ≤128 disjoint intervals, breaks inside its special opening, total schedule JSON ≤256 KiB. Empty override means closure, and existing date blocks remain separate. Test SQL fixture rows in `BEGIN`/`ROLLBACK` with unique `f3...` IDs; do not delete/alter existing QA rows.

```sql
select ok(not has_table_privilege('anon','public.merchant_reservation_rules','select'), 'anon cannot read rules');
select ok(not has_column_privilege('authenticated','public.merchant_reservation_rules','merchant_id','update'), 'tenant identity immutable');
select throws_ok($$update public.merchant_schedules set overrides='[{"date":"2026-02-30","hours":[],"breaks":[]}]' where merchant_id='f3000000-0000-0000-0000-000000000002'$$,'23514',null,'invalid override date rejected');
```

- [x] Implement migration in the existing CLI-created file. `merchant_reservation_rules` has PK/FK `merchant_id`, `mode text check in ('shop','staff')`, `capacity bigint check 1..9007199254740991`, `start_date date`, `end_date date` with inclusive order and 0001..9999 bounds, `minimum_lead_minutes integer check 0..525600`, `slot_interval_minutes integer check 1..1440`, created/updated timestamps. No defaults for booking policy values. Add `overrides jsonb not null default '[]'` to `merchant_schedules`, plus CHECK using an immutable `private.partner_overrides_valid(hours,breaks,blocks,overrides)` function. Validate JSON shape/length first, catch malformed numeric/date conversions by returning false. Count exactly three object keys, check date format/year/leap/month/day and uniqueness, bound hours/breaks to 128 and exact two interval keys, synthesize weekday 0 and call existing `private.partner_schedule_valid` to reuse overlap/break containment. Check combined validated JSON UTF-8 bytes against 262144. Existing weekly schedule validation remains intact. Function lives in unexposed `private` schema with `search_path=''`; revoke public/anon execution, grant only authenticated/postgres/service_role as required by CHECK evaluation.

```sql
alter table public.merchant_schedules add column overrides jsonb not null default '[]'::jsonb;
alter table public.merchant_schedules add constraint merchant_schedules_overrides_check
  check (private.partner_overrides_valid(hours,breaks,blocks,overrides));
create table public.merchant_reservation_rules (
  merchant_id uuid primary key references public.merchants(id) on delete restrict,
  mode text not null check (mode in ('shop','staff')),
  capacity bigint not null check (capacity between 1 and 9007199254740991),
  start_date date not null, end_date date not null,
  minimum_lead_minutes integer not null check (minimum_lead_minutes between 0 and 525600),
  slot_interval_minutes integer not null check (slot_interval_minutes between 1 and 1440),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check (start_date between date '0001-01-01' and date '9999-12-31'),
  check (end_date between date '0001-01-01' and date '9999-12-31'),
  check (start_date <= end_date)
);
alter table public.merchant_reservation_rules enable row level security;
```

Use this function body for the override CHECK; its exception handler converts malformed JSON conversion errors into a failed constraint, never a permissive result. The existing base schedule CHECK validates weekly hours/breaks/blocks separately.

```sql
create or replace function private.partner_overrides_valid(
  hours jsonb, breaks jsonb, blocks jsonb, overrides jsonb
) returns boolean language plpgsql immutable set search_path='' as $body$
declare
  item jsonb; period jsonb; dates text[] := array[]::text[];
  day_key text; yr integer; mo integer; dy integer; max_day integer;
  special_hours jsonb; special_breaks jsonb;
begin
  if jsonb_typeof(overrides) is distinct from 'array' then return false; end if;
  if jsonb_array_length(overrides)>366 or
     octet_length(jsonb_build_object('hours',hours,'breaks',breaks,'blocks',blocks,'overrides',overrides)::text)>262144
  then return false; end if;
  for item in select value from jsonb_array_elements(overrides) loop
    if jsonb_typeof(item) is distinct from 'object' or
       (select count(*) from jsonb_object_keys(item))<>3 or
       not (item ?& array['date','hours','breaks']) or
       jsonb_typeof(item->'date') is distinct from 'string' or
       jsonb_typeof(item->'hours') is distinct from 'array' or
       jsonb_typeof(item->'breaks') is distinct from 'array'
    then return false; end if;
    day_key := item->>'date';
    if day_key !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' or day_key = any(dates) then return false; end if;
    yr := substring(day_key,1,4)::integer;
    mo := substring(day_key,6,2)::integer;
    dy := substring(day_key,9,2)::integer;
    if yr<1 or mo<1 or mo>12 then return false; end if;
    max_day := case when mo=2 then case when yr%400=0 or (yr%4=0 and yr%100<>0) then 29 else 28 end
               when mo in (4,6,9,11) then 30 else 31 end;
    if dy<1 or dy>max_day then return false; end if;
    dates := array_append(dates,day_key);
    if jsonb_array_length(item->'hours')>128 or jsonb_array_length(item->'breaks')>128 then return false; end if;
    for period in select value from jsonb_array_elements(item->'hours')
      union all select value from jsonb_array_elements(item->'breaks') loop
      if jsonb_typeof(period) is distinct from 'object' or
         (select count(*) from jsonb_object_keys(period))<>2 or
         not (period ?& array['startMinute','endMinute'])
      then return false; end if;
    end loop;
    select coalesce(jsonb_agg(value || jsonb_build_object('weekday',0)),'[]'::jsonb)
      into special_hours from jsonb_array_elements(item->'hours');
    select coalesce(jsonb_agg(value || jsonb_build_object('weekday',0)),'[]'::jsonb)
      into special_breaks from jsonb_array_elements(item->'breaks');
    if not coalesce(private.partner_schedule_valid(special_hours,special_breaks,'[]'::jsonb),false)
    then return false; end if;
  end loop;
  return true;
exception when others then return false;
end $body$;
```

- [x] Add `partner_read/insert/update` policies to rules with verified nonrevoked membership and `private.partner_can_write`, both `USING` and `WITH CHECK`. Revoke all table privileges from public/anon/authenticated before explicit authenticated SELECT, INSERT for immutable tenant ID plus six policy columns, and UPDATE only policy columns (never merchant ID/updated_at). Grant service_role/postgres required full privileges. Add existing `partner_touch`/`partner_audit` triggers; audit row entity is merchant ID, no values. For schedule `overrides`, grant only INSERT/UPDATE column to authenticated; existing schedule tenant RLS protects it. Add no client DELETE. Confirm roles with `has_table_privilege` and `has_column_privilege`; avoid `SELECT *` in API.

- [x] Apply one single-transaction migration only to guarded QA DB and run `reservation_settings.test.sql`, then all SQL tests. Run `SUPABASE_TELEMETRY_DISABLED=1 supabase db advisors --local --workdir ...` and compare findings with existing 17. Verify inserted rules and overrides remain readable through a fresh, tenant-scoped database session; API exposure is Task 2. Commit exact migration+SQL test. Independent spec review then code quality review before Task 2.

## Task 2: Verified API snapshots and narrow commands

- [x] Write failing tests for strict command shapes and real mappings. New discriminants are `reservationRules` and `dateOverrides` with `{kind,mode:'create'|'update',expectedUpdatedAt? ,values}`. The `rules` values are exact `mode,capacity,startDate,endDate,minimumLeadMinutes,slotIntervalMinutes`, no client merchant ID; `dateOverrides` values are exact `{overrides: DateOverride[]}`. Update stamp required only for update; validate with existing exact `timestamp`. Reject unknown fields, fake tenant/deposit/bookingEnabled, invalid dates/intervals, duplicate override dates and >256KiB payload. Use `reservationRules({...values, merchantId:placeholder})` and `reservationSchedule({merchantId:placeholder,hours:[],breaks:[],blocks:[],overrides})` for pure contract checks in the separate new parser module. Return invalid rather than throwing on hostile getters/proxies.

```ts
const parsed = parseReservationCommand({kind:'reservationRules',mode:'create',values:{
  mode:'shop',capacity:1,startDate:'2026-11-01',endDate:'2026-12-31',
  minimumLeadMinutes:60,slotIntervalMinutes:30,
}});
expect(parsed.ok).toBe(true);
expect(parseReservationCommand({...valid,merchantId:otherMerchant}).ok).toBe(false);
```

- [x] Extend `PartnerSnapshot` with `reservationRules: (ReservationRules & {updatedAt:string}) | null` and `dateOverrides: DateOverride[]`. Keep existing `schedule: Schedule | null` shape/command for weekly hours/breaks/blocks, but add `overrides` to the explicit SQL projection from `merchant_schedules` and validate the combined `ReservationSchedule` before splitting schedule and overrides. A missing schedule gives `schedule:null,dateOverrides:[]`; a missing rules row gives `reservationRules:null`, never a fabricated default. Select only owned rows and explicit columns; foreign/malformed/query errors fail 503. Rules `DATE` values must decode exactly as YYYY-MM-DD and pass R1 `reservationRules`, with exact `updated_at` timestamp preserved. An existing schedule update must not overwrite overrides; only dateOverrides command writes that column. `dateOverrides` create inserts same schedule row with default weekly arrays; category/menu/schedule paths remain intact.

- [x] Add `saveReservationCommand` dispatch in `reservation-store.ts`. Require non-readOnly onboarding/active context and `bookingEnabled === false`; when live reservations are later enabled, settings changes need collision checks and this endpoint must refuse them until that transaction exists. Bind every write to verified context merchant ID. Use explicit columns, no upsert/DELETE/service role. Create by INSERT; update by `.eq('merchant_id', merchantId).eq('updated_at', expectedUpdatedAt)`; after `.select('merchant_id').maybeSingle()`, classify zero rows/23505 as conflict, 42501 forbidden, constraints/FK as conflict, other DB errors or malformed result as 503. No client flags, provider, or payment mutations.

```ts
if (context.merchant.bookingEnabled) throw new PartnerError(409,'PARTNER_CONFLICT');
const accepted = command.mode === 'create'
  ? client.from(table).insert({merchant_id:merchantId,...values})
  : client.from(table).update(values).eq('merchant_id',merchantId).eq('updated_at',command.expectedUpdatedAt);
```

- [x] In `/api/partner`, after same-origin/body/auth checks parse old command first then new command; if neither accepts, return 400 before any mutation. Keep private no-store/vary headers and verified `getUser`→membership→tenant context. Add new `PartnerProvider.save` command union. Update existing mock response queues to include exactly one rules lookup in GET; test GET read/error/tenant/response shape, POST authorization/conflict/extra fields, no service-role use and no unauthorized writes. Run focused and full Vitest, typecheck, lint, diff check. Commit exact API+tests. Independent spec then quality review before Task 3.

## Task 3: Merchant forms for booking rules and special dates

- [x] Write failing conversion/markup tests. Rules form starts blank if no row: `capacity`, date range, lead and slot interval are required user inputs, not 1/30/60 day auto defaults. `mode:'shop'` may be initial UI selection but no row is saved until confirmed. Convert exact safe integers and real dates through `reservationRules`; show accessible labels and errors. Date overrides let user add date, special opening(s), special break(s), full-day closure with `hours:[],breaks:[]`; these replace weekly opening/break rules while existing date blocks still subtract. The row uses same 00:00–24:00 input convention; lists capped 366 dates, 128 periods each and validated via R1 `reservationSchedule`. Visible empty state explains no special date is configured, not no reservations. No fake booking counts or customer slots.

- [x] Implement separate `usePartnerDraft('reservationRules', ...)` and `usePartnerDraft('dateOverrides', ...)` sections on `/partner/availability`, reusing `Field`, `FormActions`, `DraftRecoveryNotice`, `Button`, existing layout/tokens and conflict recovery. Rule create/update stamp comes from snapshot rules row. Override create/update stamp comes from snapshot schedule row (the shared row version), even though weekly schedule draft has its own form. After a save, provider refreshes snapshot. On 409 keep draft; reload asks before discarding. Do not make one form nested inside another. Explain `Asia/Seoul`, shared store capacity, staff choice meaning, and inactive customer connection clearly. Use controls ≥44px, labels and no horizontal overflow at narrow width.

- [x] Run markup/conversion tests, full Vitest/typecheck/lint/build with real guarded local Supabase URL+anon key in process (never log keys), actual local Auth/API/DB create/update/reload/isolation/conflict checks with test-only fixture merchant, and desktop/narrow browser QA. Do not alter existing real QA partner profile/content, create real merchant accounts, or enable booking. Independently review spec then quality, then whole-unit integration. Record outcomes/limits in progress report; no production deploy.

## Handoff

- [x] Confirm rules and overrides survive a fresh owner session and are rejected across tenants; verify existing weekly menu/schedule editing still works. Do not claim customer booking or staff management is connected yet.
- [ ] Next unit persists optional staff, explicit menu assignments and staff work schedules, then both screens share availability. Only after that implement atomic holds/payment-backed confirmation and booking dashboards; retain all operator and deployment gates.
