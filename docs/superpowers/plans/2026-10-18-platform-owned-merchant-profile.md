# Platform-Owned Merchant Profile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make general merchant information genuinely platform-owned while preserving merchant access to reservation menus and schedules.

**Architecture:** Remove the old profile command from the authenticated partner API, revoke both table and column UPDATE privileges and its UPDATE policy, and replace the settings form with a semantic read-only view linking to existing support. Keep existing authenticated, tenant-filtered reads and reservation configuration writes unchanged. This is the first vertical slice of persisted merchant operations, not staff persistence or a completed booking system.

**Tech Stack:** Existing Next.js/React, TypeScript/Vitest, Supabase/PostgreSQL/pgTAP; no dependencies or integrations added.

---

## Scope and safety

Approved source: `docs/superpowers/specs/2026-10-18-partner-reservation-operations-design.md`, section 3. General profile/photos/content belong to the platform; merchant menu descriptions still belong to the merchant. No new operator CMS or support ticket submission is promised. `/support` is the existing request path.

Only work in `/Users/hanmyeong-gwan/mobile_design/.worktrees/service-quality-20261018`. Preserve unrelated release report and other changes. No push/deploy, real partner provisioning, production database change, payment activation, dependency update or existing environment reset.

The only writable database for this slice is the existing disposable QA project `/private/tmp/partner-app-20261018-Io8Zlv`: API `http://127.0.0.1:54381`, database port `54382`. Parse `supabase status --workdir ... -o json` privately and assert both before SQL. Do not print credentials. Never use `--linked`, reset or delete QA records. Tests run in rolled-back transactions with fixture-scoped writes. Prefix CLI commands with `SUPABASE_TELEMETRY_DISABLED=1` and discover flags with `--help`.

CLI has already created the empty migration `supabase/migrations/20261018120627_partner_profile_platform_owned.sql`. Preserve the historical A2 migration. Explicit privilege revocation is intentional because the prior schema-diff tooling omitted absent ACL entries.

## File responsibilities

- `lib/partner/contracts.ts`: rename read-only profile DTO/validator to `MerchantProfile`/`merchantProfile`; remove settings from command union/parser.
- `lib/partner/server.ts`: retain validated profile projection using renamed validator, not a write command.
- `lib/partner/mutations.ts`: category/menu/schedule allowlist only; reject unknown runtime kinds before querying, never default to merchant updates.
- `lib/partner/form-values.ts`: remove unused profile form converter; leave menu/category/schedule converters intact.
- `components/partner/partner-settings.tsx`: `PartnerSettingsView({snapshot})`, static information and existing support route, no draft/form/inputs/save controls; provider wrapper remains.
- `lib/partner/contracts.test.ts`, `server.test.ts`, `api.test.ts`, `admin-render.test.tsx`: reject legacy writes, retain read validation and actual markup coverage. Update form tests only if their imports require it.
- `supabase/migrations/20261018120627_partner_profile_platform_owned.sql`: narrow revocation and policy removal only.
- `supabase/tests/partner_storage.test.sql`: new ownership semantics and fixture-scoped privileged updates/audit counts; maintain existing tenant/menu/schedule/security checks.
- `supabase/tests/partner_profile.test.sql`: focused privilege regression tests, independent of the populated QA dataset.

## Task 1: Enforce the ownership boundary end to end

**Completed and independently reviewed:** `40547a9`. Vitest RED 6/201 failing, GREEN 195 focused and 1,659 full tests. SQL RED 12/135 failing, GREEN 135 focused and 191 across all four SQL files on the guarded populated local QA DB. The same restrictive migration statements were applied twice with identical passing results; CLI `db query --file` rejected multiple prepared statements, so its three statements were executed individually. Existing 17 advisor warnings remain, no new findings. Spec, quality and final whole-slice review passed with no critical/important findings. Browser desktop/narrow and real local owner GET 200, legacy POST 400, direct Data API UPDATE denied, unchanged profile, plus production build 58 pages passed. Known minor: the `/support` link reaches the existing general feedback channel without merchant-specific routing or a reply promise.

- [x] Add failing API/parser regression tests for the old well-formed command, unknown kinds and each protected general field. The HTTP test must prove no insert/update was called and private response headers remain. Add a direct mutation test for an unsupported runtime kind, deliberately cast only in the test to simulate a stale caller.

```ts
const legacy = { kind: 'settings', expectedUpdatedAt: stamp, values: {
  displayName: 'Changed', contactEmail: '', contactPhone: '', address: '', businessTypes: ['hair'],
} };
expect(parsePartnerCommand(legacy).ok).toBe(false);
const response = await POST(request(JSON.stringify(legacy)));
expect(response.status).toBe(400);
expect(mock.calls.some(call => ['insert', 'update'].includes(call.method))).toBe(false);
```

- [x] Add markup tests against `PartnerSettingsView`: actual supplied name/address/contact/industry values, empty values labelled `미등록`, operation-owned explanation, `/support` link, existing status/deposit guidance; no `form`, `input`, `select`, `textarea`, save or discard controls. Verify HTML escaping and mobile-safe existing tokens. Category field tests remain independent. Tests of valid profile Unicode/duplicate industry values move to the read validator or real snapshot decoder instead of being deleted.

```tsx
const $ = render(<PartnerSettingsView snapshot={snapshot} />);
expect($('form,input,select,textarea').length).toBe(0);
expect($('a[href="/support"]').length).toBeGreaterThan(0);
expect($.text()).toContain('운영팀');
expect($.text()).toContain(snapshot.merchant.displayName);
```

- [x] Add pgTAP tests before migration: every general profile column denies authenticated UPDATE even for active own tenant, SELECT stays tenant-scoped, service role can update a fixture with null actor and audited keys, category/menu/schedule writes remain allowed, booking activation remains forbidden. Check `has_table_privilege` and `has_column_privilege`, not only RLS masking. Read/write all fixture IDs explicitly. Run focused Vitest/SQL tests and record the expected RED.

```sql
select ok(not has_table_privilege('authenticated','public.merchants','UPDATE'), 'no table update');
select ok(not has_column_privilege('authenticated','public.merchants',c,'UPDATE'), c || ' platform owned')
from unnest(array['display_name','contact_email','contact_phone','address','business_types']) c;
```

- [x] Implement the command allowlist and read-only view. Keep `merchantProfile` shape/length/code-point/database compatibility unchanged, but outside `PartnerCommand`. In `savePartnerCommand`, retain explicit category/menu/schedule branches and end with `throw new PartnerError(400, 'INVALID_COMMAND')`; there is no generic merchant fallback. Simplify the write filter to `.eq('merchant_id', merchantId)` without changing exact timestamp matching. Remove settings draft/form imports and converter. Reuse `pageHeader`, `section`, `readonlyValue`, `Notice`, and `textLink` from existing styles; no global style/theme overhaul or disabled edit controls masquerading as a view.

```tsx
<dl className={styles.readonlyValue}>
  <dt>상호명</dt><dd>{merchant.displayName.trim() ? merchant.displayName : '미등록'}</dd>
  <dt>주소</dt><dd>{merchant.address.trim() ? merchant.address : '미등록'}</dd>
</dl>
<Notice tone="info">매장 기본 정보와 사진은 운영팀에서 관리합니다. 수정이 필요하면 문의해 주세요.</Notice>
<Link className={styles.textLink} href="/support">매장 정보 수정 요청 →</Link>
```

- [x] Fill the CLI-created migration with explicit privilege changes. Apply only to the guarded QA database with `supabase db query --local` statements and explicit `--workdir`, not `apply_migration`, without resets. Preserve service role privileges, SELECT policy, data and child-table permissions.

```sql
revoke update on table public.merchants from public, anon, authenticated;
revoke update (display_name, contact_email, contact_phone, address, business_types)
  on table public.merchants from public, anon, authenticated;
drop policy if exists partner_update on public.merchants;
```

- [x] Update old storage tests to expect profile write denial. Preserve audit key/actor checks by making the profile update as a trusted operator on the exact fixture, then restoring the authenticated role; expected actor is null for that update. Exercise profile CHECK constraints as the trusted operator with exact fixture predicates. Change suspended/closed/cross-tenant profile write checks to privilege denial. Scope the known null-actor membership count to fixture merchant `a0000000-0000-0000-0000-000000000002`; scope every previously broad privileged mutation in the touched SQL test rather than deleting other QA records. No security assertion may be removed merely to make tests pass.

- [x] Run focused tests, full app tests, typecheck, lint, all SQL tests on populated guarded QA DB, and security/performance advisors; compare new findings to existing warnings. Reapply the small idempotent SQL file and rerun the focused permission test. Record counts, not assumed passes. Inspect the exact diff and commit only listed implementation/test files with existing Git author.

```sh
npx vitest run lib/partner/contracts.test.ts lib/partner/server.test.ts lib/partner/api.test.ts lib/partner/admin-render.test.tsx lib/partner/form-values.test.ts
npm test -- --reporter=dot
npm run typecheck
npm run lint
git diff --check
SUPABASE_TELEMETRY_DISABLED=1 supabase test db --local --workdir /private/tmp/partner-app-20261018-Io8Zlv /Users/hanmyeong-gwan/mobile_design/.worktrees/service-quality-20261018/supabase/tests
```

- [x] Independent spec review, then quality review and final integration review. Fix/review loop for concrete findings before completion.

## Parent integration and handoff

- [x] Fresh full gates and local-env production build; no remote environment pull or fake Supabase values.
- [x] Existing real local owner: GET still reads correct profile; legacy POST returns 400 without update; direct Data API profile UPDATE denied; reservation configuration unchanged. Do not rerun old smoke code that expects profile edit success. Use the existing fixture without creating real accounts or provisioning partners.
- [x] Browser inspect settings in desktop and narrow width, semantic read-only values/support link, no stale save/discard controls. Broader A3 navigation/accessibility checks remain open.
- [x] Update progress report with this narrow slice and remaining staff/rules/date override persistence and customer booking integration. The migration is applied only locally and must precede production UI/API rollout after approval. No live booking or production readiness claim.
