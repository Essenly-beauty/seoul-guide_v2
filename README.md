# Essenly — Seoul Beauty Guide

Mobile-webview app for foreign visitors to Seoul: discover salons, spas, head spas and skin clinics in English, shop K-beauty, and hand off navigation to KakaoMap / Naver Map / Google Maps.

## Stack

- Next.js 14 (App Router) · TypeScript · Tailwind + CSS-variable design tokens
- Leaflet + react-leaflet (English CARTO tiles) for the map screen
- Vitest for the pure-logic layer (`lib/geo`, `lib/search`)

## Getting started

```bash
npm install
npm run dev -- -p 3003   # http://localhost:3003
```

| Command | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm test` | Vitest unit tests |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |

## Highlights

- `/map` — full-screen map: GPS with Myeongdong fallback, rating bubble markers, category filter chips, draggable distance-ranked bottom sheet, "Search this area"
- `/search` — unified English + 한글 search across places, products and journal
- **Get Directions** — keyless deep links to KakaoMap / Naver Map / Google Maps, plus a "show to your taxi driver" card with the Korean name and address
- `/legal/terms`, `/legal/privacy` — draft legal pages (require counsel review before launch)

> Prototype status: all data is an in-memory sample layer (`lib/data.ts`); bookings, favorites and reviews are client-state only.
