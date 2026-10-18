# Partner Admin Application Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect four Korean merchant administration screens to the real A2 tenant-scoped configuration store, without enabling customer bookings or touching production.

**Architecture:** Reuse the existing Supabase cookie session and RLS. A strict JSON command boundary and a session-only server repository serve `/api/partner`; a scoped responsive client shell displays actual persisted data, clear failure states, and conservative edits with optimistic concurrency. A separate disposable local Supabase project provides real Auth/PostgREST/browser verification.

**Tech Stack:** Existing Next.js 15, React 19, Supabase SSR/client, Vitest and Playwright; no new dependencies.

---

## Scope and fixed decisions

- Work only in `.worktrees/service-quality-20261018`; preserve the unrelated untracked release report. No push, deployment, production migration, real owner provisioning, new provider, or customer booking/payment activation.
- Source of truth: approved `docs/superpowers/specs/2026-10-18-partner-admin-booking-design.md`, A1 contracts and A2 migration. No schema changes in this plan.
- Merchant UI is Korean. Retain existing orange brand/tokens (the mint description in `.impeccable.md` is stale). Customer app width and navigation remain unchanged.
- `depositKrw`, merchant status/booking gate, membership, IDs and timestamps are never client-editable. A missing deposit is not free. Business hours are not bookable slots.
- No synthetic reservations, revenue, customer data, photos, public booking links, or automatic translations.
- All mutation inputs reject extra keys. No service-role client in ordinary partner requests. Server obtains merchant ID from verified session membership.
- Explicit request/response DTOs use camelCase; database column translation stays server-only. Snapshot lists paginate to avoid PostgREST's row limit; fail explicitly beyond a documented 10,000-row administrative bound rather than returning incomplete counts.
- Mutation concurrency uses the exact opaque `updated_at` string previously read. Zero updated rows is a 409 conflict; never report success on a silent RLS/no-row update.

## File responsibilities

1. `lib/partner/contracts.ts`: DTOs, strict unknown-input validation, public client/server types.
2. `lib/partner/server.ts`: verified session context and explicit snapshot reads.
3. `lib/partner/mutations.ts`: allowlisted tenant-scoped inserts/updates and conflict handling.
4. `app/api/partner/route.ts`: private no-store responses, same-origin writes, bounded JSON decoding, error mapping.
5. `lib/partner/contracts.test.ts`, `lib/partner/server.test.ts`, `lib/partner/api.test.ts`: boundary, ownership, persistence-query and HTTP behaviors.
6. `components/partner/partner-provider.tsx`: snapshot lifecycle, save/reload results, stale response suppression and permission loss.
7. `components/partner/partner-shell.tsx`, `partner.module.css`: Korean responsive navigation, scope-limited wide layout, load/access/error states.
8. `components/partner/partner-dashboard.tsx`: truthful setup checklist and booking-not-connected explanation.
9. `components/partner/partner-services.tsx`: category and menu listing/editing, archive/hide/order, approved deposit display.
10. `components/partner/partner-availability.tsx`: weekly periods, breaks and date blocks; Asia/Seoul copy.
11. `components/partner/partner-settings.tsx`: profile/industry editing and read-only operational policy.
12. `components/partner/partner-form.tsx`, `lib/partner/form-values.ts`: shared save status/dirty-draft guard and numeric/time form conversion.
13. `app/partner/{layout,page}.tsx`, `app/partner/{services,availability,settings}/page.tsx`: noindex route entry points.
14. `lib/partner/admin-render.test.tsx`, `lib/partner/form-values.test.ts`: real UI projection and conversion regression tests.
15. `components/settings/account-data-controls.tsx`, existing/added account UI tests: support link after owner deletion is refused.
16. `scripts/partner-local-e2e.mjs`, `playwright.partner.config.ts`, `e2e/partner-admin.spec.ts`: guarded local-only real-stack QA; no production bypass routes.

## Task 1: Strict authenticated configuration API

**Completed:** `b9ed315`, `dbe4ca1`, `dd8ab2c`. Independent spec and quality reviews approved, no open findings. Parent verified 185 focused tests, typecheck, a local-env production build, and real isolated Auth/PostgREST persistence/tenant-isolation checks. GET's concrete envelope is `{ok:true,snapshot}`. The Next 15 loopback-normalization issue discovered by real integration testing is covered by actual `NextRequest` regression tests and a narrow Origin/Host check.

- [x] Write failing boundary tests with valid category/menu/settings/schedule commands, then reject null/array primitives, unknown keys, caller tenant IDs, deposits even null, status/booking edits, invalid UUIDs, nonfinite/unsafe/fractional numbers, overlength Unicode strings, invalid dates/times, overlapping periods, uncovered breaks and storage size bounds.

```ts
expect(parsePartnerCommand({ kind: 'category', mode: 'create', id: categoryId,
  values: { nameKo: '커트', nameEn: 'Cut', visibility: 'draft', sortOrder: 0 }
}).ok).toBe(true);
expect(parsePartnerCommand({ kind: 'settings', expectedUpdatedAt: stamp,
  values: { displayName: 'Salon', contactEmail: '', contactPhone: '', address: '',
    businessTypes: ['hair'], bookingEnabled: true }
}).ok).toBe(false);
```

Commands: category/menu `{kind,mode:'create'|'update',id,expectedUpdatedAt? ,values}` (stamp required only for update); schedule `{kind:'schedule',mode,expectedUpdatedAt?,values:{hours,breaks,blocks}}`; settings `{kind:'settings',expectedUpdatedAt,values:{displayName,contactEmail,contactPhone,address,businessTypes}}`. Menu values contain all A1 fields except id, merchantId and depositKrw. Category values contain names, visibility and sortOrder. UUIDs use standard canonical hex format. Timestamps must be nonempty ISO-formatted strings and remain byte-for-byte unchanged for DB equality.

- [x] Run `npx vitest run lib/partner/contracts.test.ts`; observe the missing validator/failed assertions before implementation.
- [x] Implement discriminated DTOs and `parsePartnerCommand(input: unknown)` returning `{ok:true,command}` or `{ok:false,errors:string[]}`. Reuse `validateMenu`/`validateSchedule` only after runtime type checks. Do not coerce JSON numbers/strings/nulls. Use Unicode codepoint length and A2 caps (128 hours, 128 breaks, 512 blocks, schedule JSON 256 KiB). Draft strings/null fields remain allowed under A1 rules.
- [x] Write failing server/HTTP tests for logged-out 401; missing/revoked membership 403; auth/query faults 503; suspended/closed read-only; own snapshot; full pagination; generic failures; no client-supplied ownership; cross-tenant category/update rejection; stale timestamps; duplicate create conflict; no mutation on failed authorization; private no-store headers; malformed/oversized/cross-origin writes.

```ts
const response = await POST(new Request('https://app.test/api/partner', {
  method: 'POST', headers: { origin: 'https://attacker.test', 'content-type': 'application/json' },
  body: JSON.stringify(validCategoryCommand),
}));
expect(response.status).toBe(403);
expect(await response.json()).not.toHaveProperty('details');
```

- [x] Run `npx vitest run lib/partner/server.test.ts lib/partner/api.test.ts` and record RED before implementation.
- [x] Implement `getPartnerContext(client)` with `auth.getUser()`, membership by verified user and `revoked_at IS NULL`, merchant by membership. Return actual status/readOnly. No metadata roles. Select explicit columns only. Query errors/malformed results fail closed, not empty success. GET returns `{merchant,categories,menus,schedule,readOnly,loadedAt}`; merchant and each stored row include `updatedAt`; schedule may be null. No membership/actor/contact data for other tenants.
- [x] Read category/menu lists using stable ID ordering and 200-row pages, detecting the documented bound. Sort projected lists by sortOrder then ID for display. Translate A2 snake_case fields to DTOs explicitly.
- [x] Implement `savePartnerCommand(client,context,command)` with narrow SQL column allowlists. Include server-owned merchant_id on inserts only. Menu validation resolves category through the same tenant and uses existing stored deposit on updates. DB constraints still protect concurrent operator deposit changes. Updates filter entity ID, merchant ID and exact timestamp, select result and return 409 on no row; duplicate IDs return 409. No DELETE/upsert. Schedule uses separate insert/update; no client deposit column even on insertion.

```ts
const result = await client.from('merchant_categories')
  .update({ name_ko: values.nameKo, name_en: values.nameEn,
    visibility: values.visibility, sort_order: values.sortOrder })
  .eq('id', command.id).eq('merchant_id', context.merchant.id)
  .eq('updated_at', command.expectedUpdatedAt).select('id').maybeSingle();
```

- [x] Implement GET/POST with existing `supabaseServer()`. Every response private/no-store and `Vary: Cookie`. POST requires exact same-origin Origin, application/json, and an actually bounded 300 KiB stream (not just content-length), catches malformed JSON/stream faults, then verifies auth and validates input. Responses are safe Korean messages and stable codes; no raw SQL/provider errors. Success `{ok:true}` means DB accepted the change, not that a subsequent reload succeeded.
- [x] Run focused tests, `npm run typecheck`, `npm run lint`; fix regressions, self-review, commit exact task files with configured author. Independent spec review then quality review must pass before Task 2.

## Task 2: Responsive merchant admin and safe forms

**Navigation implementation boundary:** Installed Next 15 App Router handles `popstate` internally and does not expose a supported cancellable Back/Forward guard. Do not patch global history or expand the root authentication store. Keep confirmation for rendered navigation links/editor switching and native page unload; add session-memory draft recovery (values, exact baseline version, stable new IDs and save state) across history traversal within `/partner`, with a visible restoration notice. Clear that memory on identity/access loss or partner unmount. Same-document Back leaving the entire partner scope cannot be universally intercepted; document this limitation instead of claiming universal navigation protection. No browser storage of merchant drafts.

**Early browser evidence:** Real local owner login, category/menu creation and DB row verification, profile/industry save, schedule validation and valid save, background refresh preserving a dirty draft, and stale-version 409 preserving that draft passed. Desktop screenshot exposed inherited full-width buttons crowding the merchant name; scoped fix is required. Mobile input text is 16px and fields approximately 48px high. Existing browser zoom is 90%, so the first viewport override of 390px yielded a 433px CSS viewport; do not label that capture a verified 390px viewport. Browser dialog transport interrupted the discard/reload check; that check is not yet passed.

**Implementation checkpoint:** UI commits `58c25a5` and `f9842d6`; implementer reports 127 files / 1,354 tests, typecheck and lint passing. Independent UI reviews remain pending. Parent confirmed real same-document Back/Forward draft restoration after `f9842d6`; a traversal across a prior document reload is outside the memory-only scope. Real suspended/read-only and revoked/access-cleared browser states passed, and the local fixture was restored. A 351px browser override at the pre-existing 90% zoom produced an actual 390px CSS viewport with document width 390px. Initial build produced 58 routes successfully before the final recovery patch; final build remains pending.

**New design request (2026-10-18):** User supplied the Naver Dashboard Behance reference (`https://www.behance.net/gallery/194113213/Naver-Dashboard`) and screenshot. Functional work is preserved; do not yet treat current editorial styling as the final visual design. Proposed reference adaptation is top header, left navigation, pale workspace and white task panels, with list/detail organization where useful. No real chat, fake statistics, fake people or new booking activation are implied. Confirm the revised visual direction before implementation, then review the final combined UI.

- [ ] Add failing real render/conversion tests. Verify no fake booking counts or revenue; missing deposit says approval pending, not zero; suspended read-only; invalid time/number conversion; labels/required supporting copy.

```ts
expect(parseMinute('24:00', true)).toBe(1440);
expect(parseMinute('24:00', false)).toBeNull();
expect(parseOptionalInteger('')).toBeNull();
expect(parseOptionalInteger('1.5')).toBeUndefined();
```

- [ ] Run `npx vitest run lib/partner/admin-render.test.tsx lib/partner/form-values.test.ts` and observe RED.
- [ ] Implement the provider with GET no-store on entry, navigation and focus/visibility return; explicit refresh control; abort/request generation prevents late response overwrite. A failed refresh is not empty data. Clear private data immediately on 401/403. Saving reports pending, validation/conflict/error, or committed separately from reload success. Disable duplicate submit. Persist editor state across refresh, and require explicit discard/reload after conflict rather than replacing a dirty draft. Avoid stale successful mutation responses overwriting an auth-loss state.
- [ ] Build the Korean `lang="ko"` shell with noindex layout and four routes: 대시보드, 메뉴 관리, 영업시간, 업체 설정. Sidebar desktop, simple four-link navigation mobile. Scope `.app-shell` widening using `:has()` with partner root class in the CSS module; no global customer layout regression. One scrolling content area, accessible labels/focus, >=44px targets, >=16px inputs, dark theme token support and reduced-motion support. Reuse existing Button/Notice/Badge components; do not add raw legacy btn/icon-btn/chip classes.
- [ ] Dashboard shows actual merchant name/status, category/menu/hours setup tasks and actual menu counts only. Explain “예약 기능 연결 전” and that customer bookings/payment are not active. No graphs or faux zero-reservation metrics.
- [ ] Category/menu editors use stable UUID per new draft, exact snapshot updatedAt for updates, display order integer, draft/visible/hidden/archived selector with visible described as “공개 준비 (예약 연결 후 적용)”. Menu KO/EN names/descriptions, category, total KRW, duration, cleanup. Deposit is readonly stored amount or “운영자 승인 대기”; explain it is not free and price must cover an approved deposit. Explain total visit occupancy duration+cleanup. Empty states have real add actions. No photo placeholders, delete or drag builder.
- [ ] Schedule editor provides weekday opening periods, breaks and date blocks as visible labelled rows with add/remove controls and text HH:mm inputs (end may be 24:00); validate with A1 before submit. Blank dates/numbers must not coerce to valid zero. Show Asia/Seoul and shared merchant capacity explanation; do not imply these are customer-bookable slots. No default saved schedule or generated reservations.
- [ ] Settings edits display name, contact email/phone, address, hair/nail/head_spa checkboxes. Status and booking gate are readonly with support link. Unassigned/revoked state gives support; logged-out login preserves current safe partner path; initial/refresh/save failures have distinct persistent messages and retry.
- [ ] Dirty forms warn before unload and in-app partner navigation, do not silently discard changes on refresh; save/discard have clearly separate controls. Client messages are actionable, server remains authoritative.
- [ ] Add persistent `/support` link when existing account deletion returns `MERCHANT_ACCOUNT_REQUIRES_SUPPORT`; do not change deletion policy or log out on refusal.
- [ ] Run focused tests, full `npm test -- --run`, typecheck/lint; self-review and commit exact files. Independent spec then quality review before Task 3.

## Task 3: Real local Auth/API/browser verification

**Environment evidence:** Fresh project `/private/tmp/partner-app-20261018-Io8Zlv` is running on the specified ports, with only Auth/PostgREST/Kong/Postgres. Existing three DB containers were not changed. All 170 SQL assertions passed in the new project. Next dev runs on loopback port 3018 with local env overrides and `WATCHPACK_POLLING=1000` (native file watching exceeded the environment's file limit). Chrome CLI launch is blocked in this environment; use the product's authorized Chrome browser controls for interactive responsive checks, and keep HTTP/Auth integration checks independently runnable without a browser. Do not bypass the launch restriction or claim unexecuted Playwright browser tests passed.

**SQL rerun caveat:** After real local QA fixtures were created, a repeat run had 169/170 assertions pass: `partner_storage.test.sql` test 109 (`service role audit actor is null`) counted unrelated retained fixture audit rows (6 instead of 1). Investigate and scope that test to its own fixture before claiming a repeatable all-green SQL suite. Do not delete real-stack test fixtures, disable audit triggers or reset existing databases to hide the failure. The initial clean-project 170/170 result remains valid but is not the latest rerun result.

- [ ] Create a new disposable local Supabase CLI project under an explicit `/private/tmp/partner-app-20261018-*` directory; unique API 54381 / DB 54382 / shadow 54380, seed disabled. Reuse repository migrations. Do not reset/stop the original DB or either A2 test DB.
- [ ] Write guarded test runner/config: refuse non-loopback or unexpected ports/project prefix; read CLI status keys in-process without printing; launch Next with local Supabase env overrides and no remote keys. Use only existing CLI/packages. Real local test users/merchants are clearly QA fixtures, not production examples.

```js
const endpoint = new URL(status.API_URL);
if (endpoint.hostname !== '127.0.0.1' || endpoint.port !== '54381') {
  throw new Error('Partner QA requires the isolated local Supabase API');
}
```

- [ ] Write Playwright checks against real sign-in and real `/api/partner`: owner A persists all configuration and refreshes/relogs; B cannot access/modify A; unassigned/revoked and suspended states; immutable deposit/status edits refused; stale conflict preserves edit; save/query failure displays no success; account deletion owner support. Verify DB rows via local-only admin fixture client, not by intercepting successful app APIs.
- [ ] Add mobile 390px and desktop 1280px screenshots, keyboard and 200% zoom/no horizontal overflow, dark mode, console error check; inspect the actual images. Failure injection may intercept only a deliberate error response, never fake successful persistence. Keep login credentials out of reports/screenshots.
- [ ] Run `npm test -- --run`, `npm run typecheck`, `npm run lint`, `npm run build`, local SQL tests (170 existing assertions), scoped browser tests. Record actual results, distinguish any environment blockers, and repair failed code with regression tests.
- [ ] Update `reports/operations/partner-booking-progress-2026-10-18.md` with local-only evidence and remaining B gates. Final independent integration review, commit exact changes. Do not merge/push/deploy; preserve branch and preview if useful.

## Self-review

- Approved A requirements mapped: tenant auth/input boundaries Task 1; real editable configuration and honest dashboard Task 2; support deletion path Task 2; mobile/desktop and true persisted integration Task 3. A1 shared IDs/units remain unchanged; A2 schema is prerequisite before any eventual deployment.
- B booking/payment, actual partner onboarding and policy approval remain deliberately gated, not represented as implemented.
- Existing docs: [Supabase server clients](https://supabase.com/docs/guides/auth/server-side/creating-a-client), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security). Existing cookie helper stays compatible with installed Next 15; no global auth/provider migration.
