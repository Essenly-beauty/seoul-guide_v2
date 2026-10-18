# Reservation Rules and Staff Availability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the shared, tested rules for shop-specific booking settings, eligible staff and dated availability used by both merchant management and the customer booking flow.

**Architecture:** Extend the existing pure `lib/partner` domain modules without changing the currently deployed API or database contract. Strict runtime validators define the persistence contract; the slot calculator consumes verified configuration and a complete occupancy snapshot and is not an authorization or atomic reservation endpoint. Store-wide capacity and individual staff capacity apply simultaneously.

**Tech Stack:** Existing TypeScript, Vitest, Next.js 15 repository; no new packages or external services.

---

## Boundaries and next integration units

Approved source: `docs/superpowers/specs/2026-10-18-partner-reservation-operations-design.md`.

The approved feature is decomposed into independently verifiable units:

1. **This plan:** shared configuration, staff eligibility, date overrides and slot calculations.
2. **Persisted merchant operations:** a separate plan after these contracts pass review will extend the existing Supabase tables/RLS, exact-version API and merchant forms; remove merchant edits to platform-owned general information; connect categories/menus, staff/work hours and booking settings. It must include the outstanding A3 UI review and fixture-isolated SQL regression. No new provider is needed: the existing Supabase project is retained.
3. **Actual customer reservations:** separately reviewed storage-atomic occupancy, operator-verified place mapping, public reads, actual reservation/payment/management flow. Provider discovery/provisioning, partner and cancellation/deposit policy approval remain prerequisites. No fake payment or booking success is permitted. The current database booking-enabled check remains false until this unit is verified.

These units are implementation boundaries, not separate products. Completing this plan is not completing the user-facing feature. No production DB, real merchant information, existing bookings, push or deployment changes are authorized by it.

Work only in `/Users/hanmyeong-gwan/mobile_design/.worktrees/service-quality-20261018`, branch `codex/service-quality-release-20261018`. Preserve unrelated untracked `reports/operations/service-quality-release-2026-10-18.md`. Baseline: 127 test files / 1,354 tests pass at `678f954`; Node emits an existing experimental type-stripping warning.

## File map

- Create `lib/partner/reservation-config.ts` and `.test.ts`: strict booking settings and staff contracts, validation, eligible staff listing. Reuse existing ID/string/integer validation from `contracts.ts`; do not expand `PartnerSnapshot` yet.
- Create `lib/partner/reservation-calendar.ts` and `.test.ts`: strict weekly-plus-date-override schedules, effective intervals. Reuse existing business-hours subtraction without changing its existing behavior.
- Create `lib/partner/reservation-slots.ts` and `.test.ts`: pure available-start calculation from validated configuration plus a complete occupancy list; explicit UTC output and injected clock.

## Task 1: Shared booking settings and staff configuration

**Completed and independently reviewed:** `721cda6` + `635226e` + `6add064` + `3e5fb2f`. RED observed before implementation and each regression fix; final 162 focused tests, typecheck and diff checks pass. Spec and quality reviewers approved `3e5fb2f`. New validators reject exceptional runtime inspections and consistently validate indexed arrays with captured, noncoerced lengths.

- [x] Write failing tests in `lib/partner/reservation-config.test.ts` for the contracts below. Use canonical UUID fixture IDs for two tenants and two menus. Verify null/nonobjects/unknown keys/invalid UTF-16/NUL/unsafe numbers/unknown mode are rejected, not coerced.

```ts
export type ReservationRules = {
  merchantId: string;
  mode: 'shop' | 'staff';
  capacity: number;
  startDate: string;
  endDate: string;
  minimumLeadMinutes: number;
  slotIntervalMinutes: number;
};
export type ReservationStaff = {
  id: string;
  merchantId: string;
  name: string;
  title: string;
  introduction: string;
  visibility: 'draft' | 'visible' | 'hidden' | 'archived';
  sortOrder: number;
  menuIds: string[];
};
export function reservationRules(value: unknown): value is ReservationRules;
export function reservationStaff(value: unknown): value is ReservationStaff;
export function eligibleStaff(
  staff: readonly ReservationStaff[], merchantId: string, menuId: string
): ReservationStaff[];
```

Rules: all keys mandatory; both dates real `YYYY-MM-DD`, year 0001–9999, `startDate <= endDate` inclusive. Positive safe-integer capacity (no automatic default); lead time integer 0–525600 minutes (a technical one-year bound, not an auto-selected shop policy); interval integer 1–1440 minutes. Names max 120 Unicode code points, title 120, introduction 1000, no NUL/lone surrogate; drafts may have blank names, but visible staff need a trimmed nonempty name. `sortOrder` nonnegative safe integer. `menuIds` at most 1000 unique canonical UUID strings; explicit assignment only. A staff object does not contain authentication IDs, pictures or permissions. Cross-tenant menu existence is checked when persisting, not fabricated by this pure validator. Both `unknown` type guards return false on malformed runtime objects, including throwing getters/proxies; the eligibility query is intentionally a throwing operation instead.

```ts
expect(reservationRules({ ...rules, capacity: 0 })).toBe(false);
expect(reservationRules({ ...rules, startDate: '2026-02-30' })).toBe(false);
expect(reservationStaff({ ...staff, menuIds: [menuId, menuId] })).toBe(false);
expect(eligibleStaff([foreignStaff, hiddenStaff, staff], merchantId, menuId))
  .toEqual([staff]);
```

- [x] Run `npx vitest run lib/partner/reservation-config.test.ts`, record RED from missing behavior, not a typo.
- [x] Implement the exact types and validators above in `reservation-config.ts`. `eligibleStaff` fails on malformed records/invalid query IDs, filters by merchant/menu/visible status, sorts by sortOrder then ID without changing inputs. Different canonical-UUID letter case must not permit duplicate assignments or tenant mismatch: require lowercase UUIDs for new contracts or compare normalized IDs consistently; use lowercase-only new contracts for this plan.
- [x] Run the focused tests, `npm run typecheck`, `git diff --check`; self-review. Commit only these two files. Independent spec review then quality review must pass before Task 2.

## Task 2: Special-date opening hours and staff work schedules

**Completed and independently reviewed:** `aaa2c08`; RED 52 failed / 65 passed, GREEN 117 calendar tests. Parent reran the required combined suites: 296 tests pass. Typecheck and diff checks pass. Spec and quality reviewers approved; spec reviewer additionally compared 500 schedules to a minute-by-minute oracle. No API, UI or DB changes in this unit.

- [x] Write failing tests in `lib/partner/reservation-calendar.test.ts` for this interface:

```ts
import type { MinuteInterval, PartnerSchedule } from './availability';
export type DateOverride = {
  date: string;
  hours: MinuteInterval[];
  breaks: MinuteInterval[];
};
export type ReservationSchedule = PartnerSchedule & { overrides: DateOverride[] };
export function reservationSchedule(value: unknown): value is ReservationSchedule;
export function reservationIntervals(
  schedule: ReservationSchedule, merchantId: string, date: string
): MinuteInterval[];
```

`overrides` is mandatory, at most 366 unique dates. Existing weekly hours/breaks/blocks limits remain (128/128/512). Each override has exact keys; hours/breaks max 128 each; valid integer intervals within 0..1440; no overlaps within a list; every break fits one opening. Empty override hours/breaks mean closed for that date. An override replaces weekly hours and weekly breaks, not date blocks. Without an override use existing weekly schedule. Existing date blocks always subtract. The entire schedule JSON is bounded at 256 KiB using UTF-8. `merchantId` is canonical lowercase UUID. Validation returns false instead of throwing on arbitrary input. Interval calculation rejects invalid input/tenant mismatch and returns sorted independent arrays. A staff schedule has the same shape but is bound to its staff record by the later persistence layer; this module does not invent employee schedules.

```ts
expect(reservationIntervals({ ...schedule, overrides: [
  { date: '2026-10-18', hours: [], breaks: [] },
] }, merchantId, '2026-10-18')).toEqual([]);
expect(reservationSchedule({ ...schedule, overrides: [override, override] })).toBe(false);
```

- [x] Run `npx vitest run lib/partner/reservation-calendar.test.ts`, observe RED.
- [x] Implement `reservationSchedule` and `reservationIntervals` in `reservation-calendar.ts`. Use `scheduleValues` for the old schedule shape; validate each override as a synthetic weekday schedule and validate real dates explicitly. For a matching override substitute its hours/breaks with the target weekday, keep date blocks, then call `businessIntervals`. Preserve old exports/tests unchanged. Cover special opening on a normally closed weekday, full-day closure, custom breaks replacing weekly ones, blocks clipping special hours, invalid/duplicate dates and mutation safety.
- [x] Run both new test files plus `lib/partner/availability.test.ts`, typecheck and diff checks; commit exact two files. Independent spec then quality review before Task 3.

## Task 3: Shared slot calculation with store and staff capacity

**Completed and independently reviewed:** `9f285ef`; initial RED 19 failed / 1 passed plus two independently failing precision regressions; GREEN 22 slot tests. Spec and quality reviewers approved. Quality independently checked 2,000 randomized microsecond occupancy cases. Whole-unit reviewer approved all six files, 414 dependency-inclusive tests and 48 additional integration probes. Parent full suite: 130 files / 1,655 tests, typecheck and lint pass; all 301 new tests also pass with `TZ=America/Los_Angeles`. Production build succeeds with 58 pages using guarded real local Supabase API 54381 configuration; the initial build without those environment values failed and was not treated as a code failure or masked with fake values.

- [x] Write failing tests in `lib/partner/reservation-slots.test.ts` for the interface below. Fixtures are clearly synthetic domain test data, never inserted as production content.

```ts
import type { PartnerCategory, PartnerMenu } from './catalog';
import type { ReservationRules, ReservationStaff } from './reservation-config';
import type { ReservationSchedule } from './reservation-calendar';
export type ReservationOccupancy = {
  id: string; merchantId: string; staffId: string | null;
  startAt: string; endAt: string;
  status: 'confirmed' | 'hold'; expiresAt: string | null;
};
export type ReservationSlot = {
  startAt: string; serviceEndAt: string; occupiedUntil: string;
  staffId: string | null;
};
export type ReservationSlotInput = {
  merchantId: string; merchantStatus: 'onboarding' | 'active' | 'suspended' | 'closed';
  bookingEnabled: boolean; date: string; now: Date;
  rules: ReservationRules; schedule: ReservationSchedule;
  menu: PartnerMenu; categories: readonly PartnerCategory[];
  staff: ReservationStaff | null; staffSchedule: ReservationSchedule | null;
  occupancies: readonly ReservationOccupancy[];
};
export function reservationSlots(input: ReservationSlotInput): ReservationSlot[];
```

Contract and algorithm:

1. Validate input before calculating. Invalid settings/schedules/clock/date, merchant mismatch, malformed or duplicate occupancy IDs, extra/invalid occupancy fields and mixed-tenant occupancy lists throw explicit errors. Never drop malformed/foreign occupied intervals as though free. Canonical lowercase IDs, ISO timestamps using existing `timestamp` helper, `startAt < endAt`; confirmed rows require `expiresAt: null`, holds require a valid expiry. Inputs are complete trusted-server projections, not accepted directly as an HTTP body. A failed/partial occupancy query must not call this function with `[]`.
2. Return no slots for disabled booking, non-active merchant, out-of-range date, unreadied/nonvisible menu/category. `publicMenu` supplies readiness/price rules; no missing-deposit-as-free fallback.
3. Shop mode requires null staff and null staffSchedule, and all menus share the same capacity. Staff mode requires a visible eligible staff member belonging to the same merchant and a validated same-merchant schedule explicitly bound by the caller; unavailable/unassigned/missing staff yields no slots. Reject a supplied foreign staff or schedule. No automatic staff choice.
4. Get merchant effective intervals and (in staff mode) staff effective intervals; intersect. Merge adjacent effective intervals before fitting duration so an artificial adjacent split does not create a false gap. Both service duration and cleanup must fit; their safe-integer sum cannot exceed 1440 minutes. A single-visit package uses the same menu price/duration fields, not a special resource algorithm.
5. Start-time grid is anchored to local midnight, at `slotIntervalMinutes` multiples; round up interval starts. Require `startAt >= now + minimumLeadMinutes`, with exact milliseconds. Seoul date midnight converts using explicit `+09:00`, not host timezone. Output UTC ISO strings; end exactly at local 24:00 is valid, spilling beyond that date is not.
6. Consider only confirmed rows or holds with `expiresAt > now`. Occupancy ranges are half-open `[startAt,endAt)` and include cleanup. Ignore expired holds, not invalid rows. Count concurrent store occupancy with a sweep-line/event maximum within each candidate interval, not the total number of rows touching the candidate. Adjacent existing reservations do not count as simultaneous; end events precede start events at equal timestamps. Preserve PostgreSQL's accepted six-digit fractional timestamp precision internally (for example epoch microseconds as bigint), so truncation cannot expire a hold early or rounding manufacture overlap at an adjacent microsecond boundary. A candidate is allowed only if peak existing occupancy is strictly less than capacity. Any overlapping active occupancy for the selected staff blocks that candidate across all menus, regardless of store capacity. Include other staff and staff-less occupied rows when checking shared store capacity. Do not mutate inputs.
7. Document explicitly: this computes candidates from a snapshot and does NOT lock resources, create holds, prove authorization or guarantee a later confirmation. The persistence transaction must recheck both capacity dimensions atomically. No routes, booking activation, mock payment or successful reservation creation in this plan.

```ts
expect(reservationSlots({ ...input, bookingEnabled: false })).toEqual([]);
expect(() => reservationSlots({ ...input, occupancies: [foreignOccupancy] }))
  .toThrow('merchant.mismatch');
```

Required behavior tests: staff enabled/disabled; assigned/hidden/foreign/missing staff; weekly and special-date intersection; duration+cleanup; min-lead and start/end date boundaries; Seoul UTC rollover; same staff different-menu collision; different staff blocked by full store; capacity 2 with two sequential occupancies still allowing a candidate; truly simultaneous occupancies blocking; end/start adjacency; expired versus valid holds at exact expiry; nonvisible/draft menu and missing deposit; malformed/duplicate occupancy fails closed; no input mutation. Add invalid runtime configuration tests where practical; no unsafe casting to claim a failed read is empty.

- [x] Run `npx vitest run lib/partner/reservation-slots.test.ts`, record RED.
- [x] Implement the described validator, interval intersection/merging and event-sweep calculation in `reservation-slots.ts`. Keep helpers private to this unit; split only if review demonstrates a clear independent responsibility.
- [x] Run all three new files, existing catalog/availability tests, `npm run typecheck`, `npm run lint`, full `npm test`, `git diff --check`; commit exact files. Independent spec then quality review, followed by whole-unit review. Record actual counts and any unexecuted integration checks.

## Self-review and handoff checklist

- [x] All three tasks pass both reviews; new contracts are independent of unchanged A3 API, so current admin still functions while integration is built.
- [x] Explain that staff/settings persistence and user-facing screens are not yet added by this unit. Do not label shared slots as an available live booking flow.
- [x] Carry pending A3 SQL fixture test isolation, final build, independent UI reviews and navigation/discard browser checks into the persisted-operations plan. First persisted slice: `2026-10-18-platform-owned-merchant-profile.md`; broader A3 checks remain outstanding.
- [x] Keep general content/photo/CMS editing out of scope; package is one visit; staff is not an admin login; deposit and publish gates unchanged.
