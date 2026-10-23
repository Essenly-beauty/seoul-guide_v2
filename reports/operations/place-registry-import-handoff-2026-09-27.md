# Central place registry import handoff — My Seoul Drop

Use the Google Drive folder **장소통합정본** as the cross-service source:

- Folder: https://drive.google.com/drive/folders/1s5QAEJVrh7IDvcLfeFX1JqoYUXZRS36M
- My Seoul Drop adapter (`place_id` keyed): https://drive.google.com/file/d/1EDSVnmKZeUzGjSLcrCau7sOqrf7qdNLp/view
- Photo manifest: https://drive.google.com/file/d/1nl3dMHJmTPfbQ8A8LZiRtadYoAApsQoX/view
- Full identity registry: https://drive.google.com/file/d/11scVN8uo-_iL3V7O0CMEZ3S98E9QFwSs/view
- Shared fill-only contract: https://drive.google.com/file/d/1laIFFOhNNp55S2Ppt6Zw5d0Ty-TIwzzU/view
- Official chain source snapshot: https://drive.google.com/file/d/11JPWZV5pJjujFVeNrC1c0yysIO0Ylai-/view

## Which file drives the import

`my-seoul-drop-map.json` is the only service adapter that should drive a My Seoul Drop import. Match its `place_id` to the existing My Seoul Drop `Place.id`. Do not replace that ID with `common_id`; store or retain `common_id` only as the cross-service foreign key.

Use `registry.json` for identity investigation and duplicate resolution, not for a wholesale service overwrite. Use `official-chain-sources.snapshot.json` only to fill a missing official-chain field after the `place_id` match is established.

## Field merge order

1. Load the existing My Seoul Drop place as the authoritative base.
2. Attach the mapped `common_id`.
3. Keep every non-empty existing value.
4. Fill only empty values from the adapter or approved official source.
5. Leave `source_removed_tombstone`, `hold_identity_review`, and other hold records unpublished.

## Photo merge order

1. `service_existing_photos` describes files already present in My Seoul Drop. Do not download, replace, rename, reorder, or count them as new work.
2. `reviewed_photos` contains approved Drive additions in filename order. Only entries that came from `upload_verified=true` are projected into this array.
3. Compare each candidate with the existing gallery before copying. Skip duplicates.
4. Append candidates after the existing gallery until the place has at least 3 photos; never add past 5. If the existing gallery already exceeds 5, preserve it unchanged.
5. Download an approved candidate using its Drive file `id`, optimize it into `public/places/<place_id>/<next-index>.webp`, and generate the matching thumbnail when the place has no thumbnail.
6. Run `node scripts/build-place-photos.mjs`, then the targeted place/photo tests.

`drive_folders` without `reviewed_photos` means that a folder exists but its contents are not yet approved for import. Retailer logos and the Olive Young brand hero are UI fallbacks and must not enter a place gallery.

## Current verified counts

- My Seoul Drop adapter rows: 1,122
- Current publish-eligible rows: 1,008
- Existing Olive Young place-photo coverage: 225 places / 227 full images, with 0 missing repository files
- Reviewed common-ID Drive photos: 266 across 77 places
- Daiso composition: 251 approved-base stores + 33 supplement stores = 284

The importer must fail closed if service IDs collide, a `common_id` does not resolve, or a proposed operation would replace a non-empty field or an existing photo.
