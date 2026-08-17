# MYSEOULDROP — Seoul K-Beauty Map

Production web app for foreign visitors to Seoul (formerly “Essenly”): a map-first guide to ~600 verified beauty places — Olive Young, skin clinics, hair salons, nail & lash, personal color — in English, with subway-based exploration and honest handoff to KakaoMap / Naver Map / Google Maps for navigation. Live at https://seoul-guide-v2.vercel.app.

> Scope honesty (launch decision 2026-08): this is a **discovery map**. Bookings/payments stay with the venue's own channels; we don't fabricate reviews, photos, or contact data we don't have. Traveler reviews are consent-first (posted publicly only when the author opts in) with report-based moderation.

## What's real today

- **Accounts** — Supabase auth: email+password and Google OAuth (Kakao provider configured server-side; Apple pending enrollment). Guest mode covers the whole app; hearts/ratings/profile merge into the account on sign-up.
- **Map home (`/`→`/map`)** — GPS with Gangnam fallback, 8 categories + detail filters, viewport-culled markers, Kakao-style subway layer with 20/20 real line geometries, station-radius browsing, saved-places layer.
- **Place detail** — real source ratings only, services labeled as category examples where scraped data has none, taxi big-text modal (Korean name/address), in-app map focus + external map links.
- **Accountized data** — favorites, beauty profile, ratings & reviews sync to Supabase (RLS row-scoped) with hardened guest→member merge and shared-device purge.
- **Shared lists** — snapshot your saved places into a link (`/map?list=…`) friends open on the map; OG preview card included.
- **Public reviews** — consent checkbox at save, first-name-only masked view, per-user reports, auto-hide at 3 distinct reporters.
- **Ops** — self-hosted client error tracking (incl. CSP violations), uptime cron, GitHub Actions CI, 15 Playwright E2E specs, enforced CSP + security headers, Lighthouse mobile 81.

## Stack

- Next.js 15 (App Router) + React 19 · TypeScript · CSS-variable design tokens (light default / dark opt-in)
- Supabase (auth, Postgres + RLS) via `@supabase/ssr` cookie sessions
- Leaflet + react-leaflet 5 (English CARTO tiles)
- Vitest (225 unit) + Playwright (15 E2E)

## Getting started

```bash
npm install
npm run dev   # http://localhost:3000  (owner setup: start-essenly.command)
```

| Command | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Production build (⚠️ shares `.next` with a running dev server — restart it after) |
| `npm test` | Vitest unit tests |
| `npm run e2e` | Playwright E2E (needs `.env.local` service key for auth specs; they self-skip without it) |
| `npm run typecheck` / `npm run lint` | `tsc --noEmit` / ESLint |
| `npm run build:subway-data` / `build:subway-svg` | Rebuild committed subway artifacts (see Data sources) |

## Documentation

- [`docs/HANDOFF.md`](docs/HANDOFF.md) — **current state source of truth**: what shipped, decisions, traps, backlog
- [`docs/launch-checklist.md`](docs/launch-checklist.md) — pre-open gates, owner/AI task split
- [`docs/auth-setup.md`](docs/auth-setup.md) — Supabase/OAuth/SMS provider setup + incident notes
- [`docs/runbook.md`](docs/runbook.md) — error tracking, uptime, rollback
- [`docs/README.md`](docs/README.md) — full documentation index
- [`docs/design-system.md`](docs/design-system.md) — UI tokens, components, contribution rules
- [`docs/feature-status.md`](docs/feature-status.md) — ⚠️ 2026-07-26 prototype snapshot, superseded by HANDOFF (kept for history)

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
