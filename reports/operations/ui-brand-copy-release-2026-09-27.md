# Retailer UI and Daiso detail-route release — 2026-09-27

**Status:** Route regression fixed and locally verified; combined preview and production checks pending.

**Branch:** `release/ui-brand-route-20260927` (rebased on `origin/main` at `9168756`).

**Earlier UI-only preview:** [map](https://seoul-guide-v2-115ee0ihd-admin-28156576s-projects.vercel.app/map) · [Olive Young ranking](https://seoul-guide-v2-115ee0ihd-admin-28156576s-projects.vercel.app/ranking?retailer=olive_young). This deployment does not include the route fix.
**Combined preview:** To be recorded after the new branch deploys.

## UI scope and evidence

- Daiso list thumbnail uses the supplied square logo in both `All` and Daiso-filtered map lists. The redundant `DAISO · district` line and uniform `₩` are removed. Exact `serviceTags` add `Tax refund` and/or `SIM card`; English/Korean names, status, and distance remain. The unique preview displayed Gangnam Stn. 2 with the logo, `LIVE 160m`, and both service badges. Other place categories retained their row structure.
- Photo-less Olive Young list rows use the supplied 200×200 JPEG O mark. The unique preview's `All` list showed it for Olive Young Seochodaero. A real `photoThumbnail`, `photos[0]`, or `photoUrl` still takes precedence.
- The supplied 870×480 AVIF is used only as a labeled `Brand image` fallback in large Olive Young summary/detail hero slots when there is no real photo. The actual store-photo gallery remains separate and does not count the brand image as a place photo. The local image viewer could not decode this AVIF and direct local-file browser inspection was blocked; no visual claim about the AVIF is made. The owner should visually approve that image in the preview.
- The Olive Young `Sales` section reads `What's trending` with `Curated beauty picks — not a live sales chart.` The preview showed both strings and retained `Sales`, `Review Best`, and `Brands` tabs. This is copy, not new ranking data.
- After rebase to `main` at `9168756`, `npm test` passed 96 files/908 tests, including two route regression tests. `npm run typecheck`, `npm run lint`, and `npm run build` passed. The isolated worktree's build used a temporary link to the existing local `.env.local`, which was then removed. The release diff contains no member, shared-list, Supabase migration, or ranking-data changes.

## Independently verified incident

- Production `https://myseouldrop.app/place/<official Daiso ID>` showed `This page wandered off` for a percent-encoded Korean official ID (Garaksijang Stn.). All 251 official Daiso IDs in `lib/generated/daiso-places.ts` contain `%` escapes. Production `getPlace()` compares only the literal ID and the once-decoded incoming route parameter; it cannot match the stored percent-encoded ID after Next.js has decoded the parameter. This branch now fixes only that lookup and adds two tests covering all 251 IDs. The tests failed on the old code and passed after the fix. Stored IDs are unchanged.
- Count correction: 65 official Daiso branches have `tax-refund`, 116 have `sim-card`, and **137 distinct branches have either**. The report's 218 is not supported by the generated official dataset.
- The Olive Young COEX Mall name fix is on `main` (`ebe70e4`). Production detail rendered `Olive Young COEX Mall`; `lib/place-name-loanwords.test.ts` passed in the clean UI branch. This confirms that example, not a fresh live audit of all 17 corrections.

## Production gate

The owner chose to include the Daiso lookup fix before the UI release. Do not promote the separate member/shared-list preview or uncommitted ranking-data files. Verify the combined unique preview, then merge only this branch to the then-current `main` and confirm the production Daiso detail route plus the UI changes. Rebase or merge any newly advanced `main` and rerun checks before pushing production.
