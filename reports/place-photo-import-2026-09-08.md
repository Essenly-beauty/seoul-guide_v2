# Place photo import audit — 2026-09-08

## Scope

- Drive folder: `My Seoul Drop 장소 대표사진`
- Catalogue: `adropofseoul_places.json`
- Matching key: the existing three-digit catalogue `id`
- Publication target: `public/places/ados-<slug>/`

## Result

| Status | Places | Images |
| --- | ---: | ---: |
| Ready after ID, verification, and conservative name matching | 160 | 613 |
| Held for review | 15 | — |
| Catalogue places without a Drive folder | 34 | — |

All 160 ready folders contain images. No non-image files were found. The ready
set totals 91,709,709 bytes before optimization; 19 files exceed the existing
600 KB mobile-photo guideline.

## Import and optimization result

- The user confirmed publication rights for this Drive collection on
  2026-09-08.
- All 613 source files downloaded successfully; byte total exactly matched the
  Drive inventory (91,709,709 bytes).
- Every image was decoded, EXIF-oriented, metadata-stripped, bounded to a
  1,080px longest edge, and encoded as WebP at quality 80.
- Optimized total: 41,859,606 bytes, 54% smaller than the source set.
- Invalid images: 0. Images over 1,080px: 0. Images over 600KB: 0.

The application now represents all 160 source folders and all 613 optimized
photos on the public map. Twenty-two source IDs are explicitly mapped to
existing canonical records in `data/place-photo-aliases.json`; the SPA 1899 and
SPA 1978 folders resolve to the same current venue, so the manifest contains
159 unique photo-bearing places rather than 160 duplicate pins. Fifteen new
venues have independently reviewed address-level coordinates. The remaining
96 newly generated records, plus three pre-existing canonical records whose
exact storefront pins still need confirmation, are published with
`locationVerification: provisional` and `geoSource: area`.

Provisional records use neighborhood-level pins and show `Approximate pin` in
the map sheet plus a `Provisional location` warning in the detail view. They do
not invent ratings, review counts, price tiers, opening hours, or English
service claims. The map-service buttons remain the hand-off for confirming the
storefront before visiting. Exact Korean/English listing and branch validation
remains a follow-up data-quality task; publication here does not claim that the
99 provisional pins have passed Naver or Google verification.

## Held for review

### Name or branch mismatch

- `043_온야드 압구정로데오점` — catalogue: `온야드 (압구정로데오)` / `ONYAD Hair`.
  The Drive label is more branch-specific than the catalogue identity, so it is
  not auto-published.
- `128_제이올리 공덕점` — catalogue: `제이올리 네일아트 합정점` /
  `J.Olly Nail Art (Hapjeong)`. Branches conflict; do not import.

### Catalogue row is not verified

- `036_Mércdi Hair Salon`
- `048_보보리스 (청담)`
- `063_Shop Vivian`
- `131_에즈블랑 롯데호텔 서울점`
- `185_달콤한 게으름`
- `188_2s 압구정`
- `190_스톤 하우스 헤드 스파`
- `196_Asuca`
- `198_뱀부테라피`
- `207_자미원 Hokutosichisei`
- `208_오투`
- `209_Eco Jardin`
- `210_황족마사지`

## Catalogue IDs without a Drive folder

The following verified catalogue rows have no image folder yet:

`035`, `037`, `060`, `070`–`094`, `123`, `125`–`127`, `137`.

`061` also has no Drive folder and remains unverified.

## Publication guardrail

The ready set was imported only after the user confirmed publication rights.
Future additions still require original photography, venue permission, or an
applicable commercial license. Images copied from Google Search or Google Maps
remain reference-only unless separately licensed.
