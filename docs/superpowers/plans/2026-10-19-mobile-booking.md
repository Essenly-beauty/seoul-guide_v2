# English mobile booking + public service catalog

> Execution: inline, following executing-plans. User authorized continuous work and requested English mobile / Uber-like simplicity.

**Goal:** Make the customer booking journey reviewable on a phone and connect approved English merchant menus to the real place detail page, without opening unimplemented payment/availability.
**Architecture:** Standalone interactive design in docs/designs; existing Next.js place detail gets a read-only public catalog. Platform-owned merchant→place publication mapping, RLS-protected safe projection maintained by private triggers. No private merchant endpoint or service key exposed.
**Tech stack:** Existing Next.js 15 / React 19 / Supabase, TypeScript / Vitest, local PostgreSQL-compatible validation.
**Spec:** reports/design/2026-10-19-beautynow-booking-and-webapp-review.md plus user instructions: mobile first, English, Uber-inspired, retain map and orange.

## Global constraints
- Work only in existing isolated service-quality-20261018 worktree; preserve admin v3.4 and audit archive.
- English interface, white/black foundation and orange accent, map + bottom panel; large readable type, 44px touch targets, safe-area, reduced motion.
- Preview must identify itself as a prototype. Prices/policy examples do not decide commercial terms. No real booking, temporary hold, payment or message submission.
- Do not expose private contact details, staff schedules, membership or audit data through public catalog. Publication requires platform mapping and active merchant. Keep booking_enabled=false.
- Do not apply production migrations, provision a payment provider or deploy without resolved policy/verification. Existing user-authorized local changes proceed.

## Task 1 — Reviewable English mobile journey
Files: docs/designs/customer-booking-mobile-20261019/{index.html,styles.css,app.js,README.md}, .impeccable.md.
Interfaces: self-contained sample state; assets copied from existing licensed project assets, no competitor assets. Query-free navigation via hashes. Service choice resets incompatible staff/time; review includes staff, Seoul time, total/deposit/balance; result + booking + cancellation examples.
Steps: implement map/services/staff/time/review/result/bookings screens; include empty/no-slot and expired selection recovery; validate all local asset references and JS syntax. Serve locally if environment allows. Browser screenshots only if browser runtime is available; report limitation otherwise.
Review focus: no stale selection, no real transaction, mobile hierarchy and English copy, preview clearly separated.

## Task 2 — Public merchant menu connection
Files: lib/booking/public-catalog.ts and tests, components/place/public-service-menu.tsx + CSS, app/api/places/[id]/catalog/route.ts, components/place/place-detail-body.tsx, one CLI-created Supabase migration, scripts/test-public-catalog-db.cjs.
Interfaces: GET returns {status: published|unpublished, services: PublicService[]}; failures are 503, not unpublished. Safe projection includes id/category/name/description/price/duration only. No deposit/policy promised before launch. Public menu writes forbidden; platform-only publication links real place IDs explicitly. No fuzzy name matching.
Steps: RED decoder/route tests → implement strict allowlist → GREEN. RED DB authorization/projection test → create migration → GREEN. Integrate fetch/error/retry/fallback UI, scoped styles. Preserve source listing and current booking unavailability notices.
Review focus: anonymous privacy and RLS, immediate withdrawal of hidden/inactive rows, cross-merchant isolation, unknown place and malformed server output, cache no-store.

## Task 3 — Verification and handoff
Run targeted tests, full npm test, typecheck, lint and build when available. Run local DB tests. One fresh reviewer per executing-plans, fix important findings. Record actual checks and remaining production requirements in report and prototype README. No claims of real payment, actual hold exclusivity, mobile device verification or screenshot capture without evidence.

## User steering during implementation
2026-10-19: user liked map price pins, requested better primary/elevation usage and an audit of the existing map, and confirmed this must apply to the current web app. Extend Task 1 to apply safe visual refinements to app/globals.css (existing search, sheet, selected marker, map CTA), preserving Leaflet/CARTO, category markers, coordinate groups, zoom thresholds and collision handling. Numeric price pins remain in the static study until real publication mappings are available; do not derive KRW prices from the static catalogue's priceRange labels.

## Task 4 — Customer-wide theme (user requested during review)
User preferred the new spacious layout across the existing app, rejected large dark-orange primary areas, and requested a more natural staff row. Implement black/white primary actions and neutral filter/nav states, orange small selection/status accents, shared sans headings and larger page/row spacing. New app/customer-theme.css imports after globals.css; mark PartnerShell so admin theme is excluded. Update the existing /design showcase and design context. Preserve routing, data, map interactions and authentication. Verify tests/typecheck/lint, CSS parsing and served CSS order; no new low-impact snapshot tests. Run actual app locally with isolated QA environment, report browser/font limitations. One fresh final reviewer for this expanded theme task.

## Task 5 — Screenshot feedback and dedicated station search
User requested lighter filters, smaller informational tags, coherent text hierarchy, compact left-aligned headers with redundant main-tab titles removed, and corrections to facilities overflow/detail/correction forms. User then requested Kakao-like dedicated departure/arrival search screens with vertical station lists. Implemented in actual app, with independent query state until selection, existing routing preserved and keyboard focus handling. New functional search and focus regression tests; existing obsolete layout contracts updated for the user-approved behavior. Fresh review identified and fixed a Tab-trap defect. Completed local verification:145 files/1,944 tests, typecheck/lint, CSS parsing, served routes/styles. Browser/mobile rendering remains unverified. Final record: reports/design/2026-10-20-customer-ui-refinement.md.
