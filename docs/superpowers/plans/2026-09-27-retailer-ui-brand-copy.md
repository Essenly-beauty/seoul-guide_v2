# Retailer UI brand and copy implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the approved Daiso and Olive Young map imagery plus honest `What's trending` copy without the unrelated member/DB or ranking-data work.

**Architecture:** Start from `origin/main` in `release/ui-brand-copy-20260927`. Reuse the already tested Daiso map-row commits, add owner-supplied Olive Young assets as same-origin fallbacks, and change only the Olive Young editorial section heading/qualifier. Preview the isolated branch; do not promote to production before the separate Daiso route-404 release-order decision.

**Tech Stack:** Next.js App Router, React, TypeScript, CSS tokens, Vitest, Vercel Git preview.

---

### Task 1: Reuse the approved Daiso row change

**Files:** `components/map/map-sheet.tsx`, `app/globals.css`, `lib/daiso-row-services.ts`, `lib/daiso-row-services.test.ts`, `lib/map-selection-wiring.test.ts`, `public/brands/daiso-logo.jpeg`.

- [ ] **Step 1: Apply the already red-green-tested UI commits only.**

```bash
git cherry-pick 6e09247 91b7ac0
```

- [ ] **Step 2: Verify the two shared map-row paths and service tags.**

```bash
npx vitest run lib/map-selection-wiring.test.ts lib/daiso-row-services.test.ts
```

Expected: both test files pass; no member, shared-list, Supabase, or ranking-data files enter the diff.

### Task 2: Add Olive Young small and large brand fallbacks

**Files:** `public/brands/olive-young-logo.jpeg`, `public/brands/olive-young-hero.avif`, `lib/data.ts`, `components/map/selected-place-summary.tsx`, `components/place/place-detail-body.tsx`, `components/place/olive-young-brand-hero.tsx`, `app/globals.css`, `lib/brand-assets.test.ts`, `lib/map-selection-wiring.test.ts`.

- [ ] **Step 1: Write failing contracts for image precedence and honesty.** Extend `lib/brand-assets.test.ts` to require two real assets, the JPEG mark in `BRAND_MARK_SRC.olive_young`, and the large brand component's `Brand image`/not-store-photo label. Extend `lib/map-selection-wiring.test.ts` to require `MapRowThumb` in both row paths and the big fallback only for Olive Young with zero real photos.

```ts
expect(BRAND_MARK_SRC.olive_young).toBe("/brands/olive-young-logo.jpeg");
expect(readFileSync(heroPath).subarray(4, 12).toString()).toContain("ftypavif");
expect(summarySource).toContain("<OliveYoungBrandHero");
expect(detailSource).toContain("<OliveYoungBrandHero");
```

- [ ] **Step 2: Run the focused tests and confirm a feature-missing failure.**

```bash
npx vitest run lib/brand-assets.test.ts lib/map-selection-wiring.test.ts
```

Expected: the new image-path assertions fail before assets or UI changes.

- [ ] **Step 3: Copy the supplied binary assets and make the smallest implementation.** Copy the 200×200 JPEG and supplied AVIF to `public/brands`. Point `BRAND_MARK_SRC.olive_young` to the JPEG. Add `OliveYoungBrandHero`, which shows the AVIF with a visible `Brand image` caption and `alt="Olive Young brand image, not a photo of this store"`; on image failure it renders the passed existing empty-state fallback. In the half summary and detail hero, render it only when `place.type === "olive_young"` and real photos are empty. Do not alter the actual Photos gallery.

```tsx
{place.type === "olive_young" && photos.length === 0
  ? <OliveYoungBrandHero fallback={existingEmptyState} />
  : existingPhotoOrEmptyState}
```

- [ ] **Step 4: Run focused tests and typecheck.**

```bash
npx vitest run lib/brand-assets.test.ts lib/map-selection-wiring.test.ts
npm run typecheck
```

Expected: zero failures and no TypeScript errors.

### Task 3: Change Olive Young editorial ranking copy

**Files:** `components/ranking/ranking-page-client.tsx`, `lib/ranking-retailer-contract.test.ts`.

- [ ] **Step 1: Write a failing copy contract.**

```ts
expect(clientSource).toContain("What's trending");
expect(clientSource).toContain("Curated beauty picks — not a live sales chart.");
expect(clientSource).not.toContain("Today's sales ranking");
```

- [ ] **Step 2: Run it red.**

```bash
npx vitest run lib/ranking-retailer-contract.test.ts
```

Expected: the new title/qualifier assertion fails against the current `Popular at Olive Young` title.

- [ ] **Step 3: Add `description?: string` to `RankSection` and render it immediately under `SectionHeader`; pass the two approved strings to the Olive Young sales branch only.** Keep tabs and Daiso chart labels unchanged.

```tsx
<RankSection
  title={tab === "sales" ? "What's trending" : "Highest-rated by reviews"}
  description={tab === "sales" ? "Curated beauty picks — not a live sales chart." : undefined}
  products={ranked}
  emptyMessage={config.emptyMessage}
/>
```

- [ ] **Step 4: Run focused tests green.**

```bash
npx vitest run lib/ranking-retailer-contract.test.ts
```

Expected: all focused tests pass.

### Task 4: Release verification and handoff

**Files:** `reports/operations/improvement-history.md` if present in the target worktree, otherwise a new focused release note under `reports/operations/`.

- [ ] **Step 1: Run full checks.**

```bash
npm test
npm run typecheck
npm run lint
npm run build
git diff --check
```

Expected: all commands exit 0; note any warnings separately.

- [ ] **Step 2: Push only `release/ui-brand-copy-20260927` and validate its unique Vercel preview at mobile width.** Check an `All` list Daiso row, a Daiso-filtered row, an Olive Young row lacking a place photo, and the ranking heading/qualifier. Check the large-image branches through tests rather than visually loading the AVIF through the browser; the browser blocked direct inspection of that local file. Ask the owner to approve its final visual appearance.

- [ ] **Step 3: Record the preview URL, commit, test counts, AVIF inspection limitation, and the separately confirmed Daiso 404 in the release note.**

- [ ] **Step 4: Production gate.** Follow the owner's explicit choice on whether to land the independently reported Daiso ID lookup fix before this UI release. Do not promote the member/shared-list preview or any uncommitted ranking-data files as a substitute.
