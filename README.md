# Essenly — Seoul Beauty Guide

Mobile-webview prototype for foreign visitors to Seoul: discover beauty places in English, explore them by current location or subway station, browse K-beauty products, and hand navigation off to KakaoMap / Naver Map / Google Maps. The current product uses a map-first IA with a 5-tab footer (Map · Stories · Ranking · Saved · My).

> Baseline: commit `563950d` (2026-07-26). This repository currently validates the client UX and navigation logic. It is not yet connected to production authentication, venue data, booking, payment, reviews, or store inventory.

## Stack

- Next.js 14 (App Router) · TypeScript · Tailwind + CSS-variable design tokens
- Leaflet + react-leaflet (English CARTO tiles) for the map screen
- Vitest for the pure-logic layer (`lib/geo`, `lib/search`, `lib/subway`)

## Getting started

```bash
npm install
npm run dev   # http://localhost:3000
```

| Command | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm test` | Vitest unit tests |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run build:subway-data` | Rebuild `lib/subway-data.json` from public sources (see Data sources below) |
| `npm run build:subway-svg` | Rebuild the processed metro SVG (`components/subway/seoul-metro.svg` + `metro-svg.ts`) from the Wikimedia base map (see Data sources below) |

## Documentation

- [`docs/README.md`](docs/README.md) — documentation index and source-of-truth order
- [`docs/service-overview.md`](docs/service-overview.md) — audience, product scope, IA, and core journeys
- [`docs/feature-status.md`](docs/feature-status.md) — implemented/prototype/missing status by feature
- [`docs/data-and-integrations.md`](docs/data-and-integrations.md) — data coverage, storage, and external integrations
- [`docs/launch-readiness.md`](docs/launch-readiness.md) — P0/P1/P2 work required before launch
- [`docs/design-system.md`](docs/design-system.md) — UI tokens, components, states, and contribution rules

## Highlights

- **Login shell → Map home** — Google, Apple, Kakao, and guest actions currently link directly to `/map`. Authentication, sessions, and one-time onboarding gating are not implemented.
- `/map` — full-screen map home: GPS with Gangnam Station fallback, rating bubble markers, All plus 8 place categories (Olive Young · Skin Clinic · Hair Salon · Nail & Lash · Personal Color · Head Spa · Mall & Gifts · Etc), rating / English OK / Bookable / price / service-tag filters, a draggable distance-ranked bottom sheet, and a search pill that hands off to `/search?cat=<active category>`.
- **Subway route explorer** — station search and Departure / Via / Arrival planning live in the bottom controller. Moving the active station recenters the geographic map and refreshes nearby places within 500m / 1km / 2km. Subway lines are not drawn on the geographic map.
- **Place detail** (`/place/[id]`) — overview, services, reviews, nearby places, Korean-name/address copy, local favorite/rating state, and keyless directions links. Booking channels and several venue details remain demo data.
- `/ranking` — Olive-Young-style product rankings (Sales Best / Review Best / Brands) with brand search.
- `/blog` — beauty articles and guides (formerly "Journal").
- `/favorites` — saved places/products/blog posts across Map, Products, and Blog tabs with a category rail.
- `/menu` — account hub: profile, bookings, reviews, notifications, settings, support, legal.
- `/search` — unified English + 한글 search across places, products and blog articles; pre-query state shows a "Top picks" list and quick links back to Map / Ranking / Blog. The map currently passes `?cat=`, but search does not yet apply it as a result filter.
- **5-tab bottom nav** — Map · Stories · Ranking · Saved · My (`components/ui/bottom-nav.tsx`).
- `/legal/terms`, `/legal/privacy` — draft legal pages (require counsel review before launch)

> Prototype status: venue, product, article, booking, and review content is an in-memory sample layer (`lib/data.ts` and page-local arrays). Favorites, profile answers, recent searches/stations, ratings, and feedback use browser-local state. The subway network is a committed public-data artifact, but it has no live arrivals or service alerts. Legacy route keys remain as aliases in `lib/routes.ts` for old deep links.

## Data sources

Two committed artifacts are built once at dev time from public sources; the app never calls a live subway API.

- `lib/subway-data.json` — the full Seoul metropolitan subway network (stations, lines, travel-time edges) consumed by the routing logic in `lib/subway.ts`. Rebuild with `npm run build:subway-data` (fetches into `scripts/.cache/`, gitignored, then merges). Re-running is idempotent — the committed file is byte-identical output of the pinned source snapshots.
- `components/subway/seoul-metro.svg` / `metro-svg.ts` — the full-network map SVG rendered by the Kakao-Metro-style map screen: native English station labels tagged (`data-label-for`) to dataset station ids, plus a transparent per-station hit target synthesized at each station. Rebuild with `npm run build:subway-svg`.

Sources:

- **Wikimedia Commons — "Seoul_subway_linemap_en.svg"** (file IRTC1015, PD-self / public domain, uploaded by the map's own author) — the base full-network subway map SVG that `npm run build:subway-svg` processes into `components/subway/seoul-metro.svg`: an official-style octilinear map with native English `<text>` station labels. Public domain — no attribution or share-alike required, but a source comment is kept at the top of `scripts/build-subway-svg.mjs` and `scripts/fetch-subway-sources.mjs` for provenance. Not affiliated with, and not represented as, Seoul Metro/Kakao/Naver official map data — it's an independent redraw (IRTC1015).
- **KRIC (한국철도공단) 전국도시철도역사정보표준데이터** — station names (Korean/English), lines, transfer info, and coordinates. Public data under Korea's [공공누리 (KOGL) open license](https://www.data.go.kr/ugs/selectPortalPolicyView.do); dataset listing at [data.go.kr/data/15013205](https://www.data.go.kr/data/15013205/standard.do), served from [data.kric.go.kr](https://data.kric.go.kr/rips/M_01_01/detail.do?id=32).
- **[vuski/seoulsubway](https://github.com/vuski/seoulsubway)** (MIT license) — which lines/stations are currently operating, station adjacency, inter-station travel time, and line colors. Per the repo's own attribution requirement: "이 데이터를 사용하실 경우, 코드에 다음의 주석을 반드시 남겨주시기 바랍니다 — source: https://github.com/vuski/seoulsubway" (see the credit comment at the top of `scripts/build-subway-data.mjs`).

`dart-bird/korea-subway-stations` was evaluated as a secondary source for verifying per-line station ordering, but wasn't needed in the end — vuski's own station sequencing plus KRIC's coordinates were sufficient to build and verify the merged dataset.

**Previous base map (superseded):** [Sinseiki/opensource-seoul-subway-map](https://github.com/Sinseiki/opensource-seoul-subway-map) (MIT license) supplied the original schematic base SVG (`mapimage.svg`) before the Wikimedia swap. The fetch script still downloads it for provenance/comparison (`scripts/fetch-subway-sources.mjs`, optional — not required for a fresh clone), but `build-subway-svg.mjs` no longer reads it.
