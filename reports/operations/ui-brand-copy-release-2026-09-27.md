# Retailer UI-only release — 2026-09-27

**Status:** Preview verified; production promotion pending the Daiso detail-route decision.  
**Branch:** `release/ui-brand-copy-20260927` (based on `origin/main` at `8134d05`).  
**Preview:** [map](https://seoul-guide-v2-115ee0ihd-admin-28156576s-projects.vercel.app/map) · [Olive Young ranking](https://seoul-guide-v2-115ee0ihd-admin-28156576s-projects.vercel.app/ranking?retailer=olive_young)  
**Vercel deployment:** `8H8DkkLYxEPfdwJhhJqpiquifc12`, status Ready for commit `3afa065`.

## UI scope and evidence

- Daiso list thumbnail uses the supplied square logo in both `All` and Daiso-filtered map lists. The redundant `DAISO · district` line and uniform `₩` are removed. Exact `serviceTags` add `Tax refund` and/or `SIM card`; English/Korean names, status, and distance remain. The unique preview displayed Gangnam Stn. 2 with the logo, `LIVE 160m`, and both service badges. Other place categories retained their row structure.
- Photo-less Olive Young list rows use the supplied 200×200 JPEG O mark. The unique preview's `All` list showed it for Olive Young Seochodaero. A real `photoThumbnail`, `photos[0]`, or `photoUrl` still takes precedence.
- The supplied 870×480 AVIF is used only as a labeled `Brand image` fallback in large Olive Young summary/detail hero slots when there is no real photo. The actual store-photo gallery remains separate and does not count the brand image as a place photo. The local image viewer could not decode this AVIF and direct local-file browser inspection was blocked; no visual claim about the AVIF is made. The owner should visually approve that image in the preview.
- The Olive Young `Sales` section reads `What's trending` with `Curated beauty picks — not a live sales chart.` The preview showed both strings and retained `Sales`, `Review Best`, and `Brands` tabs. This is copy, not new ranking data.
- After rebase to latest `main`, `npm test` passed 96 files/897 tests. `npm run typecheck`, `npm run lint`, and `npm run build` passed. The first local build failed only because this isolated worktree lacked `.env.local`; a second build passed with a temporary link to the existing local environment file, which was then removed. The release diff contains no member, shared-list, Supabase migration, or ranking-data changes.

## Independently verified incident

- Production `https://myseouldrop.app/place/<official Daiso ID>` showed `This page wandered off` for a percent-encoded Korean official ID (Garaksijang Stn.). All 251 official Daiso IDs in `lib/generated/daiso-places.ts` contain `%` escapes. Production `getPlace()` compares only the literal ID and the once-decoded incoming route parameter; it cannot match the stored percent-encoded ID after Next.js has decoded the parameter. An isolated fix and all-251 regression test exist in the owner's **uncommitted** root worktree; this UI branch did not take either change.
- Count correction: 65 official Daiso branches have `tax-refund`, 116 have `sim-card`, and **137 distinct branches have either**. The report's 218 is not supported by the generated official dataset.
- The Olive Young COEX Mall name fix is on `main` (`ebe70e4`). Production detail rendered `Olive Young COEX Mall`; `lib/place-name-loanwords.test.ts` passed in the clean UI branch. This confirms that example, not a fresh live audit of all 17 corrections.

## Production gate

Do not promote the separate member/shared-list preview. Decide whether this UI-only branch should ship before or together with the independently prepared Daiso lookup fix. If the lookup fix is to join this release, cherry-pick only that hunk plus its regression test into the isolated branch and re-run the full release checks. If it ships separately, record the known detail 404 as still open at the time of UI promotion.

`origin/main` advanced to `6665375` (Seoul cafe editorial) after this preview build. Rebase and recheck the release branch against the then-current `main` before any production merge.
