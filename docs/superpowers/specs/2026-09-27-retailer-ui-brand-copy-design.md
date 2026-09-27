# Retailer UI brand and copy design

**Date:** 2026-09-27

**Owner approval:** Use a UI-only release for the Daiso card and ranking copy, plus the supplied Olive Young image assets.

**Base:** The latest remote `main`, excluding the separate member/shared-list and ranking-data worktrees.

## Purpose and scope

MYSEOULDROP is a mobile-first Seoul beauty and place-finding guide for visitors. The map list must identify familiar retailers at a glance without inventing store-specific facts. This UI slice changes presentation only; it does not publish new ranking data, alter account or database behavior, or change place IDs. The combined release separately includes the owner-approved Daiso detail-route lookup fix.

## Ranking copy

- On the Olive Young `Sales` tab, replace the current section title with **What's trending**. The same title supersedes the older preview's `Today's sales ranking` and the current production title `Popular at Olive Young`.
- Directly under this title, say **Curated beauty picks — not a live sales chart.** This makes clear that the current 14 editorial sample products are not an official same-day chart.
- Keep `Sales`, `Review Best`, `Brands`, and Daiso's `Rising`/`Daily`/`Weekly` tabs unchanged. Do not imply that review or Daiso rankings have been updated by this copy-only change.

## Map list retailer thumbnails

- Both the complete `All` map list and retailer-filtered lists use the same `MapRowThumb` component. When a Daiso place has no verified photo, show the owner-supplied square Daiso logo. Keep a real verified place photo ahead of any logo.
- Daiso rows omit the redundant `DAISO · DISTRICT` eyebrow and uniform `₩`, while retaining English and Korean names, status, and distance. Show `Tax refund` and `SIM card` only when that exact place has the corresponding official `serviceTags`. The same applies to exact-coordinate choice rows where those fields exist.
- When an Olive Young place has no verified photo, its small list thumbnail uses the owner's supplied 200×200 Olive Young O logo. Keep a real place photo ahead of the logo. Other place types are unchanged.

## Olive Young large-image fallback

- Copy the supplied AVIF to a same-origin `public/brands` asset and show it only in the larger selected-place summary and detail-page hero when an Olive Young place has no real photo. It is a **brand image**, not a photograph of the named branch: give it the accessible description `Olive Young brand image, not a photo of this store` and a visible `Brand image` caption.
- Do not add the brand image to the store's photo gallery or count it as a store photo. Preserve `Photos coming soon` in the gallery and preserve real photos when available.
- A failed or unavailable AVIF should leave the existing no-photo placeholder rather than a broken-image icon. No new network image host is required.

## Validation and release gates

- Tests cover: shared map-row fallback in `All` and filtered modes; Daiso labels/services; Olive Young small and large fallback precedence; ranking text and its non-live qualifier; no change to other place types.
- Verify tests, typecheck, lint, production build, and a mobile viewport in an isolated preview before production promotion.
- The supplied AVIF could not be visually inspected with the available local viewer, and the browser disallowed direct local-file navigation. Verify the file type, static asset path, render branches, and image-error fallback through code/tests without using a preview as an indirect way to inspect that file. Hand off final visual approval of the large image to the owner.
- The owner subsequently approved including the independently reported Daiso detail-route lookup fix before the UI release. Its test and deployment evidence are in the [release record](../../../reports/operations/ui-brand-copy-release-2026-09-27.md).
