# SDD ledger — plan: docs/superpowers/plans/2026-10-19-mobile-booking.md

Base: c66c5db; worktree codex/service-quality-release-20261018.
Pre-flight: Task 1 uses sample state only; Task 2 exposes approved read-only services; no shared transaction state.
Ruling: existing continuous user authorization covers implementation; no repeat approval gate. All payment policy and production enablement remain undecided.
Ruling: use repository report ledger instead of helper-managed git metadata; workspace permissions restrict .git. No automatic commits/push.
Ruling: competitor captures are Korean desktop/narrow screenshots; English mobile redesign is our proposal, not a verified BeautyNow English mobile audit. Browser tools have no connected instance in this VSCode session.

Task 1: in progress.
Task 2: pending.
Task 3: pending.

## Execution result

Task 1: complete — English mobile sample flow, separate control rail, service/staff/time/review/result/bookings/cancel, empty/expired states, keyboard focus preservation. User subsequently approved price-pin direction and requested more primary/elevation. Prototype revised; actual app map styling also updated. No real transaction introduced.
Task 2: complete (code + local verification) — safe publication projection, read-only API, strict decoder, menu UI with fallback/error/retry. Production migration/mapping not applied.
Task 3: verification and handoff recorded — 143 files / 1,940 Vitest tests green; typecheck/lint green; isolated PostgreSQL rollback checks35 green; prototype Node VM checks15 green; CSS parsing, JS syntax, diff checks green. Preview HTTP200 on3112. Deployment build blocked by existing next/font DNS ENOTFOUND for fonts.googleapis.com; browser/mobile-device/rendered screenshots unverified.

Ruling: Supabase CLI telemetry disabled using documented SUPABASE_TELEMETRY_DISABLED=1, avoiding disallowed home writes. Migration created by CLI.
Ruling: attempted temporary PGlite install failed DNS; used the already-running isolated local PostgreSQL QA DB at54362 instead. Every migration/test mutation rolled back; no production DB change.
Ruling: public service prices can be informational before deposit policy is final. New public projection deliberately omits deposit, cleanup time, merchant identity/contact and booking eligibility.
Ruling: user asked whether work applies to the existing web app. Confirmed actual map/menu code changes; explicitly identified3112 as a standalone booking preview. Price pins are still sample-only; never invent actual KRW amounts from priceRange.
Ruling: no GitHub push/deployment or production activation; changes remain concrete and reviewable in the isolated worktree.

Final review: one fresh reviewer per executing-plans. Fixed P2 focus loss and cancelled confirmation access, verified15 VM checks; reviewer confirmed. Follow-up review found light-mode CSS specificity conflict; corrected selector and verified parsing/specific override. No privacy/RLS/API defect found by review. Concurrent DB stress test and visual browser QA were not performed.

Handoff: reports/design/2026-10-19-mobile-booking-handoff.md.

Task 4: complete (common customer theme + local verification). User requested black primary, limited orange checks/status and spacious whole-app design. Staff rows revised. New customer-theme.css integrated through root layout, admin excluded by server-rendered data-partner-shell; neutral stats/showcase/list spacing updated. Actual worktree app served on3113 with existing isolated local QA Supabase; static booking study remains3112. Full1940 tests, typecheck/lint, VM15, CSS parse and diff checks green. Seven real app routes HTTP200 and emitted stylesheet order verified. New final reviewer found nested Daiso chip contrast issue; explicitly restyled its inner visual to action/on-action. No production deployment or new booking/payment enablement.
Ruling: preserve original brand orange for small accents, use separate neutral action tokens; the earlier deep-orange fill is superseded by user correction.
Ruling: use documented Next typegen to repair generated type artifacts after dev startup/build failure, without editing generated files or bypassing type checking. QA environment variables only in process memory. Font fallback and absence of browser-rendered checks remain stated limits.


Task 5: complete (implementation + local verification, 2026-10-20). Lighter selected filters, compact/removed repeated headers, concise map rows, detail/facility/correction-form hierarchy, smaller informational tags. Dedicated station search for departure/arrival/via with unchanged route engine and query-only edits until selection. Functional search tests and a Tab-trap regression test. Fresh reviewer found the tabindex=-1 trapping bug; fixed and verified. Full145files/1,944tests, typecheck/lint, CSS parsing and served route/style checks pass. New browser rendering/screenshots not available; no production deployment. Record: reports/design/2026-10-20-customer-ui-refinement.md.
