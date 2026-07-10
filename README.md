# Essenly — Seoul Beauty Guide

Mobile-webview app for foreign visitors to Seoul: discover salons, spas, head spas and skin clinics in English, shop K-beauty, and hand off navigation to KakaoMap / Naver Map / Google Maps. Map-first IA: login drops straight into a full-screen map home, with subway-route exploration, tabbed place detail, and a 5-tab footer (Map · Ranking · Blog · Favorites · Menu).

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

## Highlights

- **Login → Map home** — sign-in flow drops straight into `/map` (no intermediate home/dashboard); onboarding (interests + beauty profile) runs once before first map view.
- `/map` — full-screen map home: GPS with Gangnam Station fallback, rating bubble markers, a 7-category filter row (Olive Young · Skin Clinic · Hair Salon · Nail & Lash · Personal Color · Head Spa · Etc) plus per-category detail filters (service tags, zones), draggable distance-ranked bottom sheet, and a search pill that hands off to `/search?cat=<active category>`.
- **Subway route explorer** — Kakao-Metro-style mode inside `/map`: pick two stations, see a route strip of intermediate stops, and filter places within walking radius of any station on the route (`lib/subway.ts`, `components/subway/*`).
- **Tabbed place detail** (`/place/[id]`) — Info / Menu / Reviews tabs, open-hours status computed from live hours data, and a Naver-first "Get Directions" CTA bar with per-category booking channels (Naver / Kakao / Instagram) plus keyless deep links to KakaoMap / Naver Map / Google Maps and a "show to your taxi driver" card.
- `/ranking` — Olive-Young-style product rankings (Sales Best / Review Best / Brands) with brand search.
- `/blog` — beauty articles and guides (formerly "Journal").
- `/favorites` — saved places/products/blog posts across Map, Products, and Blog tabs with a category rail.
- `/menu` — account hub: profile, bookings, reviews, notifications, settings, support, legal.
- `/search` — unified English + 한글 search across places, products and blog articles; pre-query state shows a "Top picks" ranked list scoped to the map's active category (via `?cat=`), plus quick links back to Map / Ranking / Blog.
- **5-tab bottom nav** — Map · Ranking · Blog · Favorites (Saved) · Menu (`components/ui/bottom-nav.tsx`).
- `/legal/terms`, `/legal/privacy` — draft legal pages (require counsel review before launch)

> Prototype status: all data is an in-memory sample layer (`lib/data.ts`); bookings, favorites and reviews are client-state only. Legacy route keys (`routes.home`, `routes.spot`, `routes.shop`, `routes.mypage`, `routes.journal`, `routes.journalArticle`) remain as aliases in `lib/routes.ts` for any old deep links, but all in-app code uses the canonical keys (`routes.map`, `routes.ranking`, `routes.blog`, `routes.menu`, `routes.blogArticle`).
