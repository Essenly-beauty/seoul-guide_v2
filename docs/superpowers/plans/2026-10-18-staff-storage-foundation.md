# Staff Storage Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist a merchant's bookable staff, explicit menu assignments and per-staff work calendar without enabling customer reservations.

**Architecture:** Three tenant-bound tables store staff profiles, staff-to-menu links and staff schedules. Composite foreign keys make cross-merchant links impossible; RLS and narrow grants allow only the verified merchant owner to edit. The existing pure `ReservationStaff` and `ReservationSchedule` validators remain the shared application contract, while a database trigger bounds direct Data API assignment writes. This plan stops at the database seam; the next plan connects strict commands, the admin screen and eventually the customer availability reader.

**Tech Stack:** Supabase/PostgreSQL 17, pgTAP, existing Next.js/TypeScript contract tests. No new package or provider.

---

## Scope and safety

Approved spec: `docs/superpowers/specs/2026-10-18-partner-reservation-operations-design.md`, especially §§4.2, 4.3, 5 and 8. The existing R1 pure contracts are in `lib/partner/reservation-config.ts` and `reservation-calendar.ts`; R2 schema is `supabase/migrations/20261018121926_merchant_reservation_rules_and_overrides.sql`. Staff means a reservation target, **not** a new login account. Shop-mode merchants need not create staff. No staff photo, employee permissions, reservation record, payment, activation flag, or permanent staff deletion is added here. `merchants.booking_enabled=false` remains enforced.

Work only in `/Users/hanmyeong-gwan/mobile_design/.worktrees/service-quality-20261018`; preserve unrelated `reports/operations/service-quality-release-2026-10-18.md`. Use only the disposable QA project `/private/tmp/partner-app-20261018-Io8Zlv`, after privately asserting API port 54381 and DB port 54382 from `SUPABASE_TELEMETRY_DISABLED=1 supabase status --workdir ... -o json`. Never reset any DB, use `--linked`, print keys, apply to production, grant a real merchant, push, or deploy. pgTAP fixtures use a fresh `f4...` UUID namespace inside `BEGIN`/`ROLLBACK` and may not delete existing QA rows. New DDL is applied to the exact guarded QA container in one `psql -1 -v ON_ERROR_STOP=1` transaction only after RED and review.

## File map

- Create `supabase/migrations/20261018133400_partner_staff_storage.sql`: three tables, constraints, RLS/ACL, assignment-cap trigger, audit and touch hooks. Do not edit old migrations.
- Create `supabase/tests/partner_staff_storage.test.sql`: pgTAP ownership, bounds, same-tenant composite FK, disabled booking, no hard delete, exact ACL and audit assertions.
- Update `reports/operations/partner-booking-progress-2026-10-18.md` only after final independent review: measured results and remaining API/UI/customer gates.

## Task 1: Red database contract

- [x] Add a pgTAP file in `supabase/tests/partner_staff_storage.test.sql` beginning with `begin; select no_plan();` and ending with `select * from finish(); rollback;`. Assert the three tables, RLS flags, absence of anon read, absence of authenticated staff DELETE and identity/version UPDATE, and no staff login/account relation. The first run must fail because the tables do not exist, not because the guarded database is unavailable.

```sql
select has_table('public','merchant_staff','staff profiles persist');
select has_table('public','merchant_staff_menus','explicit staff-menu links persist');
select has_table('public','merchant_staff_schedules','staff work calendars persist');
select ok(not has_table_privilege('authenticated','public.merchant_staff','delete'),'staff is archived, not deleted');
select ok(not has_column_privilege('authenticated','public.merchant_staff','merchant_id','update'),'staff tenant is immutable');
```

- [x] Add two active fixture merchants with distinct owners and two categories/menus, then owner-A staff. Under `set local role authenticated` plus `set local request.jwt.claim.sub`, test A can read/write only A, B sees zero A rows, unassigned/revoked/suspended owners cannot write, and `anon` cannot read. Test cross-merchant staff-menu and staff-schedule insert failures even if the caller supplies both IDs. Use `throws_ok` for SQLSTATE `23503`/`42501`, and `is_empty` for invisible rows; always scope audit counts to the fixture merchant.

- [x] Test profile bounds: name 120, title 120, introduction 1000 PostgreSQL characters, safe `sort_order`, exact visibility enum, visible staff requires nonblank name. Test schedule validation with 128 weekly hours/breaks, 512 date blocks, 366 special dates, 256 KiB combined JSON, real calendar dates (never year 0000), exact interval object keys, no overlapping periods, breaks inside work openings. Test explicit links: same-merchant service only, duplicate link rejected, maximum 1000 links per staff even via direct authenticated Data API, no permanent staff deletion, archived staff/link/schedule remain readable. Test that audit logs entity/changed field names, never names or work hours.

- [x] Run the new pgTAP file against the guarded QA DB and record the expected RED. Do not apply migration before this observation.

## Task 2: Tenant-scoped schema

- [x] Create `supabase/migrations/20261018133400_partner_staff_storage.sql`. Use the exact core shape below. `id` is caller-supplied for create retry; no server-issued employee account. The composite UNIQUE constraints exist for same-tenant foreign keys even though IDs are already globally unique. The service table's new `(merchant_id,id)` unique index has a production lock/preflight gate, not a silent live rollout.

```sql
alter table public.merchant_services add constraint merchant_services_merchant_id_id_key unique (merchant_id,id);

create table public.merchant_staff (
  id uuid primary key,
  merchant_id uuid not null references public.merchants(id) on delete restrict,
  name text not null default '' check (length(name) <= 120),
  title text not null default '' check (length(title) <= 120),
  introduction text not null default '' check (length(introduction) <= 1000),
  visibility text not null default 'draft' check (visibility in ('draft','visible','hidden','archived')),
  sort_order bigint not null default 0 check (sort_order between 0 and 9007199254740991),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (merchant_id,id),
  check (visibility <> 'visible' or length(btrim(name,
    U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF')) > 0)
);

create table public.merchant_staff_menus (
  merchant_id uuid not null,
  staff_id uuid not null,
  service_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (merchant_id,staff_id,service_id),
  foreign key (merchant_id,staff_id) references public.merchant_staff(merchant_id,id) on delete restrict,
  foreign key (merchant_id,service_id) references public.merchant_services(merchant_id,id) on delete restrict
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
  primary key (merchant_id,staff_id),
  foreign key (merchant_id,staff_id) references public.merchant_staff(merchant_id,id) on delete restrict,
  check (private.partner_staff_calendar_valid(hours,breaks,blocks,overrides))
);
```

- [x] Before creating the staff schedule table, define `private.partner_staff_calendar_valid(jsonb,jsonb,jsonb,jsonb)` as `IMMUTABLE`, `search_path=''`: call both existing validators, then require each weekly hours/breaks object to have exactly `weekday,startMinute,endMinute`, each block exactly `date,startMinute,endMinute`, and reject block dates starting `0000-`. Return false on any conversion error. This is stricter than the legacy shop schedule because no historical staff data needs the old year-0000 accommodation. Revoke public/anon execute; grant authenticated/postgres/service_role execute for CHECK evaluation. A direct authenticated write containing ignored JSON keys or year 0000 must fail at the DB rather than making future API snapshots return 503.

```sql
create function private.partner_staff_calendar_valid(
  hours jsonb, breaks jsonb, blocks jsonb, overrides jsonb
) returns boolean language plpgsql immutable set search_path='' as $body$
declare row_value jsonb; kind text; required text[]; source jsonb;
begin
  if not coalesce(private.partner_schedule_valid(hours,breaks,blocks),false) or
     not coalesce(private.partner_overrides_valid(hours,breaks,blocks,overrides),false)
  then return false; end if;
  for kind in select unnest(array['hours','breaks','blocks']) loop
    source := case kind when 'hours' then hours when 'breaks' then breaks else blocks end;
    required := case when kind='blocks' then array['date','startMinute','endMinute']
      else array['weekday','startMinute','endMinute'] end;
    for row_value in select value from jsonb_array_elements(source) loop
      if jsonb_typeof(row_value) is distinct from 'object' or
         (select count(*) from jsonb_object_keys(row_value)) <> 3 or
         not (row_value ?& required) or
         (kind='blocks' and left(row_value->>'date',5)='0000-')
      then return false; end if;
    end loop;
  end loop;
  return true;
exception when others then return false;
end $body$;
```

- [x] Enable RLS on all three tables. SELECT must require an unrevoked membership for `merchant_id`; staff/profile and schedule INSERT/UPDATE must use `private.partner_can_write(merchant_id)` both in `USING` and `WITH CHECK`; link INSERT/DELETE must use it. There is **no client DELETE** policy or grant on staff/profile or schedule. Revoke defaults from public/anon/authenticated, then grant authenticated SELECT and only: staff INSERT `(id,merchant_id,name,title,introduction,visibility,sort_order)`, staff UPDATE `(name,title,introduction,visibility,sort_order)`, schedule INSERT `(merchant_id,staff_id,hours,breaks,blocks,overrides)`, schedule UPDATE `(hours,breaks,blocks,overrides)`, link INSERT `(merchant_id,staff_id,service_id)` and link DELETE. Grant full table privileges to postgres/service_role as in R2; do not grant merchant ID, staff ID, created/updated timestamps for UPDATE. Add existing `partner_touch` to staff/schedule and `partner_audit` to all three.

- [x] Implement `private.partner_staff_menu_limit()` as a `SECURITY DEFINER` `BEFORE INSERT` trigger with `search_path=''`. Require `private.partner_can_write(NEW.merchant_id)` and a matching staff row locked `FOR UPDATE`; reject when that staff already has 1000 links before inserting the next one. RLS/FKs still enforce owner and same-merchant service. Revoke function EXECUTE from public/anon/authenticated; grant only postgres/service_role as required for trigger execution. This prevents concurrent direct Data API inserts from creating a snapshot that R1 `ReservationStaff.menuIds` would reject. The trigger must not grant an actor the ability to mutate another merchant via security definer.

```sql
if not private.partner_can_write(new.merchant_id) then
  raise exception 'staff menu owner denied' using errcode='42501';
end if;
perform 1 from public.merchant_staff s
  where s.merchant_id=new.merchant_id and s.id=new.staff_id for update;
if not found then raise exception 'staff not found' using errcode='23503'; end if;
if (select count(*) from public.merchant_staff_menus l
    where l.merchant_id=new.merchant_id and l.staff_id=new.staff_id) >= 1000 then
  raise exception 'staff menu limit' using errcode='23514';
end if;
return new;
```

- [x] Preserve existing audit behavior but make new staff schedule/link audit entity IDs useful: change only the `entity :=` expression inside `private.partner_audit()` to `coalesce(row_value->>'id',row_value->>'staff_id',row_value->>'merchant_id')::uuid`. Existing tables keep their prior entity ID; new staff child records use staff ID. Test that no values enter audit rows. Add btree indexes on `(merchant_id,sort_order,id)` staff, `(merchant_id,service_id,staff_id)` links, and `(merchant_id,staff_id)` schedule PK suffices. Do not enable booking or add a permissive policy fallback.

## Task 3: Green tests and guarded local integration

- [x] Before applying SQL, privately assert QA API 54381/DB 54382 and the exact Docker container `supabase_db_partner-app-20261018-Io8Zlv`. Apply only the new migration in a single `psql -1 -v ON_ERROR_STOP=1` transaction to that container. If any check fails, stop; do not guess a replacement DB.

```bash
node <<'NODE'
const cp = require('node:child_process');
const fs = require('node:fs');
const name = 'supabase_db_partner-app-20261018-Io8Zlv';
const env = { ...process.env, SUPABASE_TELEMETRY_DISABLED: '1' };
const status = JSON.parse(cp.execFileSync('supabase',
  ['status','--workdir','/private/tmp/partner-app-20261018-Io8Zlv','-o','json'],
  { env, encoding: 'utf8', stdio: ['ignore','pipe','ignore'] }));
if (new URL(status.API_URL).port !== '54381' || new URL(status.DB_URL).port !== '54382') throw Error('wrong QA ports');
const containers = cp.execFileSync('docker',['ps','--format','{{.Names}}'],{encoding:'utf8'}).trim().split('\n');
if (!containers.includes(name)) throw Error('guarded QA container missing');
const sql = fs.readFileSync('supabase/migrations/20261018133400_partner_staff_storage.sql');
const result = cp.spawnSync('docker',['exec','-i',name,'psql','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-1'],
  { input: sql, encoding: 'utf8' });
process.stdout.write(result.stdout || '');
process.stderr.write(result.stderr || '');
if (result.status !== 0) process.exitCode = result.status || 1;
NODE
```

The status JSON contains secrets: this script parses without printing it and runs SQL **only after** both endpoint and exact-container checks. Never substitute another container or `--linked`.

- [x] Run focused `partner_staff_storage.test.sql`, all current worktree `supabase/tests` through `supabase test db --local --workdir /private/tmp/partner-app-20261018-Io8Zlv /Users/hanmyeong-gwan/mobile_design/.worktrees/service-quality-20261018/supabase/tests`, and `supabase db advisors --local` with telemetry disabled. Compare advisor findings with the existing 17 rather than claiming all warnings new. Fresh sessions proved owner persistence and cross-owner denial. **Deviation:** the durable `f4...a5` staff/link/schedule fixture was added under an *existing* disposable QA merchant, not an isolated new merchant. It remains in QA with three audit events; no cleanup was attempted. Do not treat this as a clean fixture-isolation pass.

- [x] Run `npm test`, `npm run typecheck`, `npm run lint`, and `git diff --check`. Commit only the migration and new SQL test under `gksaudrhks12-sys <gksaudrhks12@gmail.com>`. Obtain independent spec review, then code-quality review, and fix/re-review all important findings before marking this plan complete. Record exact counts and production preflight gates in the progress report as a separate commit. No production migration, remote push or deploy.

Execution evidence: Task 1 RED on three missing tables (guarded QA, no fixture persistence); Task 2 at `d0c0772` and whitespace alignment at `95e7282`; Task 3 focused pgTAP 284/284, six current SQL files 552/552, app 1,723/1,723, typecheck/lint/diff checks pass, advisor warnings unchanged at 17. Task 3 static spec and quality reviews passed with the fixture-isolation caveat above. QA DDL was applied directly in one transaction, so that disposable project's Supabase migration ledger has no row for this migration. Do not infer deployment readiness from this local-only result. The 1,000-link test is serial; add a two-session race regression before relying on it long term. Production needs a `merchant_services` unique-constraint lock/preflight and R2 calendar CHECK compatibility check before migrations. `booking_enabled=false` remains in force.

## Handoff

- [ ] In the next vertical plan, add narrow `staff`, `staffMenu` and `staffSchedule` API commands and verified snapshot projections, then a `/partner/staff` editor. Staff/menu/calendar data must use the same merchant IDs and R1 types on both sides. Only after that, create customer availability reads. Do not activate booking without DB-atomic collision protection covering staff/menu/schedule and the existing shop settings, plus payment/contract/operator gates.
