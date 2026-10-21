# Mobile routine and product polish — 2026-10-20

## Published

- Commit: b26586bd65f894bf4eb54d0405add238b39d4c0d
- GitHub main → Vercel production: dpl_2ZEE7c1s3WdeyB5Et94e6bvxxAQb, READY.
- Primary domain: https://myseouldrop.app
- CI: https://github.com/Essenly-beauty/seoul-guide_v2/actions/runs/39372631963 — success.
- Release checkout: /private/tmp/myseouldrop-release-git-FG92a2
- The same 24 changed files were synchronized to the original worktree without resetting its other work.

## Changes

- Routine: flat numbered steps; actual product photos; brand and English product name; duplicate Korean name, price-tier symbols, oversized orange timeline, and outer card removed. The unimplemented save-routine toast was removed; individual product saving remains in product details.
- Kept 3/5/7-step selection; new step labels and selector text translated for English, Japanese, Chinese, Spanish and French.
- Seven verified product photos stored locally, WebP, 83,310 bytes total. Shared catalogue records feed routine, product guide, saved products, detail and show-to-staff displays. See docs/assets/routine-product-images.md for provenance.
- Product hero: one real photo instead of three placeholder tiles; contain fit, eager loading, accessible fallback. Existing list images retain lazy loading.
- Customer root/body and light browser/PWA theme color now white. Dark mode reads its own background token; partner styling remains scoped.
- Shared horizontal category chips keep overflow-x:auto, with scrollbar-width:none and a hidden WebKit scrollbar.

## Verification

- TypeScript and lint passed.
- GitHub CI: 175 test files, 2,246 tests passed; production build generated 69 pages.
- Local initial full suite had one stale source-shape expectation for image loading; corrected to allow the explicit eager override while testing the default lazy rendering. Affected 66 tests passed, then the full committed suite passed in CI.
- Public HTTP checks: routine, COSRX detail, support, favorites all 200, theme-color #ffffff.
- All seven public product images returned image/webp and byte-for-byte matched the committed local files.
- Served CSS confirmed horizontal scrolling remains enabled with its scrollbar hidden. PWA manifest theme/background are #ffffff.
- Browser visual/touch testing was not performed: the existing browser administration-policy block was not bypassed. Actual iPhone scrolling/theme-toggle behavior still needs device review.
- Evidence: reports/operations/2026-10-20-mobile-product-polish-public.json.
