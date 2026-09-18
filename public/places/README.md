# Place photos

Drop licensed real photos into the staging directory, optimize them, and build
the application manifest:

```bash
node scripts/optimize-place-photos.mjs --known-only true
node scripts/build-place-photos.mjs
```

```
scripts/.cache/place-photo-downloads/
  glow-skin-clinic/     ← the place id, exactly as it appears in the data
    1.jpg               ← order follows the filename; 1 shows first
    2.jpg
    3.jpg

public/places/
  glow-skin-clinic/
    1.webp              ← generated 1,080px detail/gallery output
    1.thumb.webp        ← generated 320px map-list output
```

- **Optimization**: the optimizer applies EXIF orientation and strips metadata.
  It writes a quality-80 WebP bounded to 1,080px for detail/gallery views plus
  a quality-72 WebP bounded to 320px for map-list rows. Map rows prefer the
  `.thumb.webp` file and lazy-load it; selected-place and detail galleries keep
  the larger file.
- **Formats**: source files may be jpg / png / webp / avif. Only generated WebP
  files should be shipped.
- **Ids**: a folder whose name is not a real place id is reported as an
  error rather than skipped, because a typo'd id is the likeliest mistake.
- **Duplicate identities**: when a Drive/source folder is a proven duplicate
  of an existing catalogue record, record the one-to-one mapping, reason, and
  direct evidence in `data/place-photo-aliases.json`. The optimizer then writes
  the images under the canonical place id; do not create a duplicate map pin.
  If multiple source folders resolve to the same canonical id, their photos are
  appended in source order instead of overwriting the canonical photo sequence.
- **Provisional locations**: owner-approved photo folders may be represented
  before exact storefront verification only with `locationVerification:
  provisional` and `geoSource: area`. The UI must disclose the approximate pin,
  omit unverified ratings/prices/hours, and direct visitors to a map service for
  confirmation. Replace the area pin with address-level coordinates after the
  Korean/English listing and branch are verified.
- **Olive Young official store photos**: the owner compiled one
  representative image per Seoul store from the Olive Young store finder
  (Drive folder + spreadsheet, 2026-09-18) and confirmed on 2026-09-18 that
  publishing them is permitted. The reviewed store → place mapping
  is `data/oliveyoung-store-photos.json`; event posters, Olive Better stores,
  places that already carry owner photos and places that are not published
  yet are listed under `excluded` with a reason, and
  the 127 stores missing from the catalogue under `notInCatalogue`. Re-import:

  ```bash
  node scripts/stage-oliveyoung-photos.mjs --photos <extracted-zip>/photos
  node scripts/optimize-place-photos.mjs \
    --input scripts/.cache/oliveyoung-photo-downloads \
    --report scripts/.cache/oliveyoung-photo-optimization.json --known-only true
  node scripts/build-place-photos.mjs
  ```
- **Rights**: only use photos we are allowed to publish — our own shots, or
  ones the venue has given us permission for. Do not copy images from
  Creatrip, Naver, Instagram, or Google listings; the copyright sits with
  the photographer or the platform.
- **No filler**: a place with no photo renders an honest empty state. Never
  add a stock or generic image to make a card look fuller.

Photos are served same-origin, so no Content-Security-Policy change is
needed. A third-party photo source (e.g. Google Places) would need its host
added to `img-src` in `next.config.mjs`.
