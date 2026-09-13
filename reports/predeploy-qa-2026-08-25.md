# MYSEOULDROP pre-deploy QA — 2026-08-25

## Outcome

- UPDATED 2026-09-12: all 613 owner-provided photos from 160 source folders are
  published across 159 canonical map places. SPA 1899/1978 are one current
  venue, so no duplicate pin was created.
- UPDATED 2026-09-12: the public map contains 845 places from an internal
  catalogue of 962. Ninety-nine public places have explicitly provisional,
  neighborhood-level pins and visible disclosure; unverified ratings, review
  counts, prices, hours, and English-service claims remain unset.
- UPDATED 2026-09-12: current place audit reports `total=962`,
  `approximatePins=138`, `missingHours=305`, `cachedKakao=364`,
  `naverEnglishUnchecked=945`, and `uncheckedIdentity=944`.
- PASS 2026-09-12: `npm run verify:predeploy` completed end to end: typecheck,
  ESLint, 69 Vitest files with 712/712 tests, current place-audit reports, and
  the Next.js production build with 44/44 static pages generated.
- PASS 2026-09-07: `npm run verify:predeploy` completed end to end.
- PASS 2026-09-07: TypeScript typecheck and ESLint, with no warnings or errors.
- PASS 2026-09-07: full Vitest reported 65 files and 688/688 tests passed.
- PASS 2026-09-07: focused title/filter/map contract suite, 71/71 tests in 3
  files (`personal-ux-flows`, `ranking-retailer-contract`, and
  `map-selection-wiring`).
- PASS 2026-09-07: place audit report freshness check, with `total=851`,
  `approximatePins=42`,
  `missingHours=194`, `cachedKakao=364`, `naverEnglishUnchecked=834`, and
  `uncheckedIdentity=833`.
- PASS 2026-09-07: Next.js production build, 44/44 static pages generated;
  `/ranking` and `/ranking/qa` are server-rendered and the build did not read the
  external Downloads CSV.
- DISCOVERY ONLY 2026-09-07: `npx playwright test
  e2e/ranking-retailers.spec.ts --list` discovered 10 Chromium tests in 1 file
  without configuration or TypeScript errors. This is not executed browser
  coverage.
- VERIFIED 2026-09-07: Ranking uses the retailer-derived top title
  `OLIVE YOUNG Ranking` or `DAISO Ranking`. Daiso secondary category controls
  retain a 44px outer target with a compact 36px visual pill, plus scoped
  light/dark label and focus-ring contrast.
- VERIFIED 2026-09-07: both normal map rows and coordinate-choice map rows wrap
  their text in `maprow-copy`; its `flex: 1`/`min-width: 0` contract and the
  map-list viewport's `overflow-x: hidden` prevent long bilingual content from
  creating horizontal sheet overflow.
- FIXED: an explicit place selection now remains on the marker layer even when
  category, saved-list, shared-list, or searched-area filters exclude it.
- FIXED 2026-08-30: 44 unverified curated prototypes plus 2 manually resolved
  duplicate/ambiguous rows no longer reach public map, search, category, detail,
  or sitemap surfaces. The 600-row source catalogue remains available to the
  non-destructive audit, while 6 verified listings receive public name/address/pin
  corrections outside generated files.
- FIXED 2026-08-30: 16 non-Seoul rows plus blank-address and area-centroid rows
  are paused at the same public boundary. Conditions overlap; 125 source rows are
  held internally and 475 evidence-bearing Seoul rows remain publicly discoverable.
- NOT RUN: interactive browser and device QA. On 2026-09-07 the focused
  Daiso internal-detail scenario again failed before launch because the
  strict QA server could not bind `127.0.0.1:3001` (`listen EPERM`). The earlier
  Playwright web server (`0.0.0.0:3000`) and the final strict, non-reused QA server
  (`127.0.0.1:3001`) failed with `listen EPERM`. No WebKit binary is installed in
  this runner. The deployed Vercel hostname
  also failed DNS resolution in this sandbox. These are runner limitations,
  not browser pass results.

## Retailer ranking verification — 2026-09-07

The current browser scenarios cover:

1. `/ranking` defaults to Olive Young, displays `OLIVE YOUNG Ranking`, and retains
   Sales, More, Review Best, and Brands. Direct Daiso entry displays
   `DAISO Ranking`.
2. Direct Daiso restoration and invalid-retailer canonical redirection.
3. `replace`-based retailer switching without history growth, meaningful Back,
   map fallback, footer keyboard order, logo+text state, and `aria-pressed`.
   The shared five-item navigation records a sanitized same-origin return route;
   Ranking consumes it into component memory on mount and clears session storage,
   so browser-Back departure cannot poison a later direct entry. It rejects
   Ranking/external destinations and covers Safari's no-Navigation-API/no-referrer
   behavior plus the stale direct-entry sequence.
4. Exact ordered product-number/source-rank pairs for all 20 rows in Rising,
   Daily, and Weekly, plus per-tab categories. The expected pairs are explicit in
   an independent manifest pinned to SHA-256 `e67de59d3a737203d6e13227d4219583e49ebf591a97b72228a5e38289fc575e`,
   rather than being derived through the runtime selector under test. Regeneration
   from the approved 3,046-row CSV matched all 60 pairs and source SHA-256
   `29b8d65c64db6fe95d0ca9ce2f6a2428732185121608b8d314c8d15a32b32bcc`.
   The same manifest independently pins SHA-256
   `64ff5d399d41c2b0fd9a4984d207ab70b516101294ab221ce729cb2439d8d975`
   over an explicit canonical projection of every user-visible field for all 38
   union products (names, brand/category, price, rating/reviews, delivery, URL,
   collection date, identifiers, and all tab ranks).
5. Weekly Makeup retaining source rank 12 and incompatible category reset.
6. Retailer changes resetting tab/category state and preventing data mixing.
   Daiso's secondary category rail keeps a 44px hit target around a 36px visual
   pill and verifies readable selected text and focus rings in light and dark
   themes, keyboard focus visibility, and horizontal scrolling.
7. Internal Daiso product links, ranking rows without price/rating/review summaries,
   optional Pickup/Same-day metadata, missing-image placeholders, 48px targets,
   safe-area padding, and the final row remaining above the normal-flow footer.
   The internal detail retains verified product facts and owns the verified HTTPS
   Daiso Mall target/rel/`pdNo` hand-off.
8. Guarded empty/no-results fixtures proving no Olive Young fallback and that
   Clear filters returns to All without leaving Daily.

The test-only `/ranking/qa` route is guarded by the server-only
`RANKING_E2E_HARNESS=1` variable supplied by Playwright's strict, dedicated
`127.0.0.1:3001` server (`reuseExistingServer: false`). A local 404 is a test
failure, so stale developer servers cannot silently suppress empty/no-result QA.
Normal local and deployed servers return 404 for this route. Explicit deployed
smoke runs set `E2E_EXTERNAL_ONLY=1`, so only then do the two guarded fixture
checks self-skip while all public-route scenarios still run.

WebKit/Safari-engine replay is available after installing its Playwright binary:

```bash
npx playwright install webkit
E2E_WEBKIT=1 npx playwright test e2e/ranking-retailers.spec.ts \
  --project=webkit-ranking
```

Run the repeatable automated gate with:

```bash
npm run verify:predeploy
```

## Required interactive regression paths

Run these against the exact deployment SHA before public launch:

1. Search result → map → selected marker → half sheet → full place detail.
2. Category list → place detail → map; confirm the same place name and pin.
3. Active category/detail/area filter → open a different place deep link;
   confirm its selected marker remains visible.
4. Saved-only map and shared-list map → select every visible row; confirm one
   selected marker, correct camera target, and matching detail.
5. Subway station results → place → map mode; confirm the selected pin and
   detail are both present.
6. Two places sharing an exact coordinate; confirm both remain discoverable
   from the list and the selected one becomes the active pin.
7. iPhone Safari and Android Chrome: allow/deny location, safe areas, keyboard,
   bottom-sheet drag, long English names, 320px width, light/dark theme.
8. `/ranking` → Daiso → Olive Young → Back; confirm retailer toggles do not trap
   browser history and the previous non-ranking page is restored.
9. On Daiso, verify Daily is the default, all three tabs have 20 rows, category
   chips change per tab, and Weekly Makeup begins at source rank 12.
10. Scroll Daily to rank 20 at 390×844; confirm it remains fully visible above
    the 3-column footer and the missing-image placeholder remains stable.
11. Verify a Daiso row opens `/shop/daiso:<상품번호>`, the internal detail shows only
    CSV-backed facts, and `Buy on Daiso Mall` opens the matching
    `www.daisomall.co.kr` `pdNo` in a new tab.
12. On both Olive Young and Daiso product details, confirm Back and Share are visible
    over the initial gallery; as that 44px action row crosses the safe top, confirm
    the compact Back/title/Share/More header fades in without covering the title.
13. Open a Daiso store detail from the map and confirm its four product rows are
    labeled as a chain-wide Daiso Mall ranking whose stock varies by branch.

## Data quality gates

The generated place audit currently reports (refreshed 2026-09-12):

- 962 total places, including 251 official Seoul Daiso stores, 15 newly
  admitted owner-photo venues with independently reviewed address-level pins,
  and 96 owner-photo venues with explicitly provisional neighborhood pins;
- 8 manually corroborated identity matches and 944 unchecked identities;
- 364 cached Kakao-hours records kept as supporting evidence only, not identity matches;
- 2 matched and 945 unchecked Naver English-name searches;
- 172 promotional/marketing-style English display names;
- 119 missing Korean listing names;
- 239 generated English romanizations needing review;
- 347 provisional English place names;
- 138 approximate pins and 38 places sharing an exact coordinate;
- 16 places outside the Seoul service area (one source row has a misclassified zone);
- 305 missing opening-hour records;
- 159 of 962 places with all 613 owner-provided photos whose publication rights were confirmed;
- 99 of the 845 public places carry an explicit provisional-location warning
  until Korean/English listing, branch, address, and storefront pin checks finish.

Use `reports/place-audit.md` as the review queue. `unchecked` is not invalid,
and the audit never deletes or hides a place automatically.

## External blockers

- Claude CLI requires a fresh `/login` before the requested Claude cross-check
  can be rerun.
- The owner chose direct Naver Map UI review instead of NAVER API HUB credentials.
  Continue the remaining 583 English-name and 582 identity checks manually, keeping
  screenshots/review text out of the repository and recording only listing links and
  field verdicts.
- The 2026-08-30 continuation could not reach the previously connected Chrome session:
  Browser, Chrome extension, and local screen-control surfaces all reported unavailable.
  Reopen Naver Map in the connected Chrome profile before resuming the four complete
  source batches; the merger rejects partial coverage.
- Interactive QA requires a runner that can bind localhost ports and reach the
  production deployment.
- Git metadata is read-only in this workspace, so these changes could not be
  committed from this session.
