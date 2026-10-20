# Retailer logo assets

The active Olive Young and Daiso marks are the owner-provided retailer artwork already approved in [the retailer UI plan](../superpowers/plans/2026-09-27-retailer-ui-brand-copy.md). These local files identify the retailer; they do not represent a photo of an individual store or product.

- `public/brands/olive-young-logo.jpeg`: supplied 200 × 200 Olive Young olive mark on white. Used in category chips, map pins, list fallbacks and ranking navigation.
- `public/brands/daiso-logo.jpeg`: supplied 407 × 406 Daiso six-circle mark and wordmark on red. Used in the same retailer identity contexts.
- `public/brands/olive-young-hero.avif`: supplied Olive Young chain image. Its visible `Brand image` caption distinguishes it from a verified branch photo.

`BRAND_MARK_SRC` in `lib/data.ts` provides the shared compact image paths. Verified place photos take precedence over these retailer fallbacks. Render all artwork with `object-fit: contain` so the original image is not cropped.

The older `olive-young-mark.svg` and `daiso-mark.svg` are original, non-official navigation approximations. They are retained as historical assets and are no longer used in the active retailer UI. The earlier instruction describing all files in this folder as non-official navigation marks was incorrect for the owner-provided JPEG and AVIF assets.

This change reuses the approved local assets; it does not introduce downloaded artwork or assert new redistribution permissions.
