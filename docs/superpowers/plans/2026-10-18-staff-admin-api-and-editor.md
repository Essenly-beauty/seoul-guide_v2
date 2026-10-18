# Staff Admin API and Editor Implementation Plan

> **For agentic workers:** Use `superpowers:subagent-driven-development` task by task. Obtain a spec review, then a quality review after each task. Do not start the next task with unresolved important findings.

**Goal:** Let a verified merchant owner add and edit optional booking staff, explicit menu assignments and staff working dates from `/partner/staff`, backed by the R3 tables. This does not make customer booking live.

**Architecture:** A separate cookie-session `/api/partner/staff` endpoint reads and writes only the merchant resolved by `getPartnerContext`. A route handler matches the existing private partner API and the planned web/mobile shared service; all responses are dynamic and no-store. The list response contains profile summaries; an ID-scoped detail response composes one profile, its actual linked menu IDs and its calendar. Narrow commands provide profile create/update/archive, one-link add/remove and calendar create/update. The editor uses the existing partner shell, category/menu snapshot and account-scoped in-memory drafts; it never stores arbitrary columns or staff login accounts.

**Tech Stack:** Next.js App Router, React/TypeScript, Supabase/PostgREST, Vitest, existing partner styles/components. No new package or provider.

## Scope, safety and dependencies

The user-approved source is `docs/superpowers/specs/2026-10-18-partner-reservation-operations-design.md` §§3–8. R1 types and calculations are in `lib/partner/reservation-config.ts` and `reservation-calendar.ts`; R3 DB migration is `supabase/migrations/20261018133400_partner_staff_storage.sql`. The migration is applied only to the guarded disposable QA DB `/private/tmp/partner-app-20261018-Io8Zlv` (API 54381, DB 54382), not production. Its ledger lacks an entry because QA used a manual transaction. Never reset a DB, use `--linked`, print secrets, modify an existing QA merchant, push or deploy. Preserve `reports/operations/service-quality-release-2026-10-18.md` (unrelated user-owned untracked file). Use `gksaudrhks12-sys <gksaudrhks12@gmail.com>` for new commits.

The existing `/api/partner` snapshot and reservation settings stay intact. General shop information/photos remain platform-owned. Shop-mode merchants may have zero staff. No staff image upload, employee login/permissions, booking activation, payment, customer booking, fabricated dashboard metrics, or hard deletion of staff/schedules is in this unit. `merchants.booking_enabled=false` stays enforced.

## File map

- Create `lib/partner/staff-contracts.ts` and `lib/partner/staff-contracts.test.ts`: exact DTO and command validation.
- Create `lib/partner/staff-server.ts` and `lib/partner/staff-server.test.ts`: tenant-scoped list/detail projections and narrow writes.
- Create `app/api/partner/staff/route.ts` and `lib/partner/staff-api.test.ts`: private HTTP boundary, auth, Origin/body-size checks and error mapping. Factor reusable HTTP helpers from `app/api/partner/route.ts` into `lib/partner/http.ts` only if the existing behavior and tests stay unchanged.
- Create `app/partner/staff/page.tsx`, `components/partner/partner-staff.tsx`, `lib/partner/staff-form-values.ts`, relevant tests; update `components/partner/partner-shell.tsx` navigation and `components/partner/partner.module.css` without unrelated redesign.
- Update `reports/operations/partner-booking-progress-2026-10-18.md` after reviews with exact evidence and residual customer-booking gates.

## Task 1: Exact staff contracts (RED then GREEN)

- [ ] In `staff-contracts.test.ts`, assert exact top-level keys, own properties only, canonical lowercase UUIDs, safe integers, title/introduction/name code-point bounds, JavaScript-trimmed visible name, known visibility values, immutable merchant identity, invalid/prototype/cyclic inputs, JSON size, and calendar entries including special-date closure. The `staffMenu` command must carry exactly one menu ID, never an unbounded replacement list. Run focused test and observe RED before implementation.
- [ ] Implement these command shapes; derive validation from R1 and existing contract helpers, not a second permissive schema:

```ts
type StaffCommand =
  | { kind: 'staff'; mode: 'create'; id: string; values: StaffProfileValues }
  | { kind: 'staff'; mode: 'update'; id: string; expectedUpdatedAt: string; values: StaffProfileValues }
  | { kind: 'staffMenu'; mode: 'add' | 'remove'; staffId: string; menuId: string }
  | { kind: 'staffSchedule'; mode: 'create'; staffId: string; values: StaffScheduleValues }
  | { kind: 'staffSchedule'; mode: 'update'; staffId: string; expectedUpdatedAt: string; values: StaffScheduleValues };
```

`StaffProfileValues` is `{name,title,introduction,visibility,sortOrder}`. `StaffScheduleValues` is `{hours,breaks,blocks,overrides}`. `parseStaffCommand(input: unknown)` returns the existing `{ok,command}`/`{ok:false,errors:['command.invalid']}` pattern. For calendar validation, inject a fixed canonical merchant UUID into `reservationSchedule` and enforce `reservationJsonbBytes(...) <= 256 * 1024` exactly as R2 does. Do not accept a request merchant ID. Commit after focused tests, typecheck and independent reviews.

## Task 2: Verified tenant-scoped projections (RED then GREEN)

- [ ] Test `getStaffList(client,context)` and `getStaffDetail(client,context,id)` with mock clients, then with the guarded local Auth/API/DB using a new isolated `.test` merchant fixture only. Invalid row shapes, foreign `merchant_id`, duplicate links, more than 1,000 links, missing linked service, calendar mismatch, query errors and pagination ambiguity must produce safe 503/limit errors, not an empty or fabricated result. Revoked/unassigned sessions must not read. Read-only suspended owners may read. Read back persisted values from a fresh session.
- [ ] List only the selected profile columns `id,merchant_id,name,title,introduction,visibility,sort_order,updated_at` in deterministic ID pages of at most 200, with a 10,000-row fail-closed ceiling matching existing partner lists. List DTOs do **not** claim `menuIds: []`; menu IDs are unknown until detail. For one owned ID, query the profile, `merchant_staff_menus` (ordered by `service_id`, at most 1,001 to detect overflow), and `merchant_staff_schedules` (maybeSingle). Validate the composed detail with `reservationStaff` and `reservationSchedule` and verify linked menu IDs against the merchant's service records. Return `{merchantId, staff, schedule, readOnly, loadedAt}`. No raw database error text or other merchant data reaches the browser.
- [ ] Keep the API response private/no-store. The list can be refreshed independently of detail. A nonexistent/foreign ID must not reveal which case it is. Commit with tests, typecheck and independent reviews.

## Task 3: Narrow writes and HTTP boundary (RED then GREEN)

- [ ] Test direct request parsing and HTTP semantics first: cookie user from Supabase Auth only, exact Origin/Host agreement, bounded 300 KiB UTF-8 JSON, no client tenant selector, null/invalid body 400, unauthenticated 401, unassigned/foreign 403, suspended/closed writes 403, malformed backend 503 without leaked details, stale version/duplicate 409, no 200 unless the exact owned write is acknowledged. A `booking_enabled=true` context is a 409 gate because booking collision protection does not exist yet.
- [ ] Implement `saveStaffCommand(client,context,command)` using only the session client. Profile create/update filter `merchant_id,id` and update `updated_at=expectedUpdatedAt`; archive is profile `visibility='archived'`, never DELETE. Schedule create/update filter `merchant_id,staff_id` with version check on update. Menu add uses exact composite IDs and DB 1,000-link trigger; remove filters all three IDs and checks one returned row. Map SQLSTATE `23505`/`23503`/`23514` to conflict, `42501` to forbidden, all other errors to safe unavailable. Never use service-role credentials in the request path.
- [ ] Add `GET /api/partner/staff` (list) and `GET /api/partner/staff?id=<canonical uuid>` (detail), plus `POST` for the four command families. Export `dynamic = 'force-dynamic'`; use the default Node.js runtime and private no-store response headers. Unsupported query keys and noncanonical IDs are 400; no ID enumeration. Reuse `/api/partner`'s proven private response/Origin/body rules without changing that endpoint's semantics. Commit after focused/full app tests, typecheck, lint, guarded QA integration, then spec and quality reviews.

## Task 4: Optional-staff operations editor (RED then GREEN)

- [ ] Test the actual merchant-visible states: zero staff is a truthful empty state; shop mode does not demand staff; staff mode explains that no eligible public staff/menu link means no customer slots; booking stays unavailable. Render no example employee, appointment or revenue data. Name/title/intro/visibility/sort order can be edited; archive preserves history. Staff selection uses a stable list/detail layout on desktop and list-to-detail on mobile.
- [ ] Keep `app/partner/staff/page.tsx` a server-component wrapper and the interactive editor in `components/partner/partner-staff.tsx` with `'use client'`; pass no functions or class instances across the server/client boundary. Use the existing partner shell and `usePartner().snapshot` for merchant status and real menus. Fetch staff list/detail from `/api/partner/staff` with account-scoped abort and late-response guards. On focus/return and after save, refetch. Preserve unsaved form values on network error/conflict; use in-memory `PartnerDraftStore` and the existing leave/reload confirmation. If the staff API fails, show stale-vs-never-loaded and retry, never silently show zero staff.
- [ ] Provide explicit per-menu assignment controls. Add/remove one link at a time; on success reload detail, on ambiguous response show “저장 결과를 확인하지 못했습니다” and reload before retry. Archived or hidden staff may be reviewed; no hard delete. Provide weekly hours, breaks, date blocks and special-date overrides with labeled fields and validation; reuse existing availability form patterns rather than raw JSON. Validate `reservationSchedule` locally but trust the server/DB as authority.
- [ ] Add `담당자` to the navigation. Verify keyboard/labels, desktop and narrow viewport, shop/staff mode, read-only/revoked access, save/reload, conflict and session switch. Use the disposable QA merchant created for this task, not the previously contaminated existing QA merchant. Run full app tests/typecheck/lint/build and six SQL files; independent spec, quality and whole-unit browser review. No remote push/deploy.

## Handoff and deployment gates

- [ ] Record evidence in the progress report, including any persisted QA fixtures and exact test counts. Recheck `npm run audit:data:check` separately; it currently fails on stale tracked place-audit reports and must not be called a passing deploy gate.
- [ ] This unit ends at merchant staff administration. Customer-facing staff/date/time selection still requires a public verified projection and actual availability using the same R1 types. Do not activate booking until DB-atomic collision guarding covers menu, staff, both shop/staff calendars and direct Data API writes, and payment/contract/cancellation/operator gates are ready. Before production, preflight the `merchant_services` UNIQUE constraint lock, existing R2 schedule CHECK, migration order and rollback. Ask the user for final review before deployment.

## Execution record — 2026-10-19

- Tasks 1–3: contracts, tenant-scoped projections, narrow writes and private HTTP boundary are implemented and independently spec/quality reviewed. Real isolated Auth/API/DB smoke is recorded in `reports/operations/partner-booking-progress-2026-10-18.md`.
- Task 4 implementation is at `618f87e`, after review fixes from `56ca896` onward. Final spec and quality reviews pass within the explicitly accepted history compatibility boundary. `unconfirmed` POST results preserve/lock drafts; only acknowledged writes with failed readback use `committed-stale`. Recovered creates retain their UUID and become persisted selections. Menu uncertainty stays scoped to its staff; duplicate/blank menu names expose unique IDs.
- Cancelable same-document Navigation API traversals are confirmed before commit; rejected navigation uses `preventDefault` and accepted href+entry-key approval is consumed once at popstate. The older/noncancelable popstate fallback protects drafts but can alter Forward history. This is a documented compatibility limitation, not a claim of identical behavior in all browsers. Source: [HTML Standard navigate event](https://html.spec.whatwg.org/multipage/nav-history-apis.html#the-navigate-event).
- Direct final checks: 140 Vitest files / 1,895 tests, typecheck, lint, and six guarded local SQL files / 552 tests passed. Implementer also passed the 59-route production build with real isolated QA URL/key; the parent restarted that build for browser checks. `audit:data:check` separately fails because tracked place-audit reports are stale.
- Parent browser checks passed for A profile save/reload/restore, menu unlink/relink, stored calendar rendering, A/B account isolation, narrow list/detail layout with no horizontal overflow, mobile Back focus, B read-only disabled controls, revoked-access gate and state/permission restoration. Only A/B fixtures were changed; final counts are 2 merchants, 2 memberships, 2 staff, 1 menu link, 1 staff schedule and 22 audit events; both merchants remain booking-disabled. No production writes, push or deployment.
- Task 4 whole-browser gate remains open: the two credential-gated repeated Back/Forward rejection tests are listed but not executed. Browser engines abort in the shell sandbox; connected-Chrome navigation did not expose a rejectable dialog, so this path is not a browser PASS. Real-UI conflict/network failure/new-create recovery, calendar save and shop/staff mode scenarios also remain. The full unit is therefore implemented and statically reviewed, with partial browser verification, not deployment-ready.
