# Subway screen: station-first redesign

Date: 2026-08-22
Status: proposed — phases 1–2 pending owner decisions in §7

## Why

Owner report (2026-08-22), verbatim:

- "여기 화면 사용성이 너무 떨어지는 것 같습니다"
- "단순하게 강남역만 검색하고싶은 사용자도 있을것 같습니다"
- "검색 이후에도 여기 하단에 보여지는 정보가 너무 많아서 사용하기 매우 불편합니다"
- "뒤에있는 샵 리스트가 거의 안보이는 장면이 나옵니다"

## Measured facts (production, 390×844)

1. Subway entry renders a panel occupying **767 of 844px (91%)**. `globals.css:3428`
   sets `height: 100%` while editing and `:3433` hides `.map-top`. The map is gone.
2. Entry is a **route planner**: departure + arrival both required. The sticky CTA
   stays disabled with nagging copy until both are filled.
3. Departure-only shows a **3-item teaser** ("Near Gangnam · 36") sitting below
   ~510px of route chrome — and the teaser is gated on *draft* values, so it
   **disappears the moment an arrival is typed**, before the route is even applied.
4. With a route: summary (~120) + stepper (~60) + radius row (56) + category row
   (48) = **~284px of chrome before the first shop row**.
5. **Global search returns zero stations.** `searchStations()` exists in
   `lib/subway.ts:107` and is unit-tested, but `app/search/page.tsx` never calls it.
   There is no station-first entry point anywhere in the app.
6. Contrast: the normal map place sheet keeps the map at ~50% and shows content
   immediately. Subway mode is the outlier.

### Two findings that reframe the work

- **The station-browse state was designed and never wired.** `globals.css:3425–3427`
  says the map returns "once a route is shown **or a station browse begins**". No code
  path sets `editing = false` while `route === null` — the editor's Cancel button only
  renders when a route already exists. The data pipeline already works: radius
  filtering, distance sort, radius circle, and pin filtering all run for a routeless
  active station. Only the UI gating is wrong.
- **One visible row was the explicit design target.** `globals.css:4903–4905`: "Half is
  sized so the 'Near {station}' header AND one full list row fit without scrolling."
  The owner's complaint is that this target was wrong, not that it was missed.

### Incidental defects found

- Station-disc tap presets departure and enters the editor (`map-screen.tsx:379–387`),
  covering the map the user just tapped.
- `editing` is controller-local, not a prop, so the parent's `setSubwayEditing(true)`
  is overwritten on mount when a route happens to be valid.
- `snap === "compact"` suppresses the header, removing **both** close and Edit — a
  state with no exit except the grip.
- `clearRoute()` is unreachable: its only caller is the embedded `RouteStrip`, which
  suppresses the clear button when `embedded`.
- The route summary shows a **"Live"** badge. There is no arrivals feed in v1.

## Recommendation — Station Sheet

**A station is a noun you look at, not a form you fill.** Tapping Subway shows the
map; picking a station shows shops. Route planning becomes an opt-in second level.

### Screen A — subway entry

No bottom panel. Two floating overlays on a full map.

| y | Height | Content |
|---|---|---|
| 12–56 | 44 | Search pill, "Search a station" + back out of subway mode |
| 64–108 | 44 | Station chip rail: recents (max 3) then `POPULAR_STATION_IDS` |
| 108–750 | **642** | Untouched map — line geometry, discs, halos |
| 750–794 | 44 | One-time hint, dismissed after first station pick |

**Unobstructed map 642px = 76%** (today: 77px = 9%).

Entry must force zoom ≥ 16 (or lower `STATION_LABEL_ZOOM` for subway mode only):
`INITIAL_ZOOM = 15` but `STATION_LABEL_ZOOM = 16`, so at entry zoom the discs are
**unlabelled circles**. "Tap a station" is only true once they carry names.

### Screen B — station search overlay

Full-screen list over the map, keyboard up. Uses `searchStations()` verbatim. 56px
rows: line badges + name + "N nearby". Note: there is no romanization field —
the English name *is* the romanization ("gangnam" matches, "kangnam" does not).
Do not promise fuzzy romanization.

### Screen C — station sheet

Snaps are **ratios of the map area**, never pixel constants (an SE is 667px tall):
`peek 0.83 / half 0.50 / full 0.14`.

Composition at **half** (the landing snap):

| Region | Height | Content |
|---|---|---|
| 0–20 | 20 | Grab handle |
| 20–76 | 56 | Station header — the **whole row is a button that reopens station search**. Line 1: name + line badges. Line 2: "36 places · within 1 km · straight-line from the station centre". Right: 44px close |
| 76–120 | 44 | **One** chip row: `[1 km ▾] [All] [Olive Young] [Beauty] [Personal Color] [Mall & Gifts]` — replaces the stacked 56px radius control + 48px category tabs |
| 121 → | scroll | Shop rows, 88px each |

**Chrome before the first shop row: 121px** (today 284 with a route, ~510 without).
Header collapses to 44px after 40px of scroll → 101px.

Rows fully visible: **3.0 at half** (3.3 collapsed), **6.7 at full**, header-only at
peek with 700px of map. Three rows is a 3× improvement, not abundance — see §7 Q3.

All chips and tap targets are 44px minimum; `lib/mobile-ux-contracts.test.ts:31`
enforces this, so the 32/36px chips proposed during design are illegal here.

### Replacing what routing gave a tourist

- End of list, 44px: "Also try nearby stations — Sinnonhyeon (1 stop) · Yeoksam
  (1 stop)", from a thin `stopsBetween()` over the existing graph. Adjacency was the
  real value, and it costs 44px below the fold instead of 284px above it.
- **"Get here by subway"** row in the *place* sheet, opening the route screen with
  **arrival** prefilled via the existing `nearestStation()`. This matches the
  tourist's actual question — "I found a shop, how do I get there" — instead of the
  planner's question.

## Removed / demoted

**Deleted, no replacement** (all pure harm removal):

- The disabled "Show route" CTA and both nag strings. No disabled primary button
  remains in subway mode.
- The **"Live"** badge — there is no arrivals feed; printing it to a tourist on a
  platform is a lie. Non-negotiable.
- **Exit numbers and walk-minutes in shop rows.** `lib/subway.ts:378` `stationExits()`
  synthesizes exits on a hash-derived 55–85m ring. Rows say "230 m from the station";
  the header says "straight-line from the station centre". Residual risk: at sprawling
  interchanges (Gangnam's exits span ~600m) a "230 m" shop can be a 900m walk. Honest
  labelling is the only mitigation until real exit coordinates exist.
- Station-disc tap presetting departure.

**Compressed:**

- 230px "Recent and popular" block → 44px map chip rail + a Stations section in
  global search (it gets *more* room, not less).
- 56px radius + 48px categories → one 44px chip row. Cost: 500m/2km sit behind a tap.
  Mitigation: when a station returns <5 places at 1km, auto-expand to 2km and say so.
- 120px route summary + 60px stepper → the existing `components/subway/route-strip.tsx`
  (113 lines; already handles the scroller, auto-centring with reduced-motion, and
  transfer boundaries). Repositioning, not a new component.

**Demoted, not deleted — route planning.** The graph, `findRouteVia`,
`moveRouteWaypoint`, 20/20 line geometries and `lib/subway-via.test.ts` all work. The
complaint is that routing is the *toll gate*, not that it is worthless, and pre-beta is
the wrong moment to switch off a working feature. It moves behind "Plan a route" in the
station header plus the new place-sheet row, and it keeps an explicit compute action —
auto-computing on the second valid field means a mistyped destination fires a camera
fly with no chance to correct.

Honest cost: route usage will drop and will look like a regression. Do not re-add an
entry-state form when it does. Anyone writing launch copy that promises subway route
planning needs to know before this ships.

## Phased implementation

### Phase 1 — half a day, 3 files, no new components, no map-screen state changes

Smallest change that fixes the worst complaint; safe to ship same-day.

1. **Stations in global search.** Add a `stations` group to `lib/search.ts` calling
   `searchStations()`, render a `Stations · N` section above `Places · N` reusing the
   existing section markup in `app/search/page.tsx`. Cap 3. Rows deep-link to
   `/map?mode=subway&station=<id>`. This alone closes the "no station entry point" gap.
2. **Station-disc tap stops presetting departure** — delete `setDeparture(id)` at
   `map-screen.tsx:383`.
3. **Station-first ordering inside the existing controller.** With `activeStationId`
   set and no route: render `[station header] → [Near {station} list]`, and collapse
   the departure/arrival rail, recent/popular block, and "Add via station" behind a
   single 44px "Plan a route" row. The sticky CTA renders only while expanded.

Phase 1 **collapses rather than deletes**, so the ~48 source-string assertions in
`lib/subway-search-layout.test.ts` (which `readFileSync`s the controller and would
throw at module load if it vanished) stay green. ~400px of relief, near-zero
regression surface.

### Phase 2 — 2–3 days: the real station sheet

New `components/subway/station-sheet.tsx`.

**Do not extract a shell from `map-sheet.tsx`.** That file is 320 lines of pointer
capture, 1:1 drag, snap resolution and click suppression tangled with place ranking,
focus restoration and `promoteDetailToFull` — on the app's highest-traffic surface,
whose blank-tap dismissal was only just fixed (4dfd2c2). Instead lift the ~20-line grip
drag already in `subway-route-controller.tsx:481–500` (its own comment says "Grip drag
mirrors MapSheet") and share only the pure vocabulary in `lib/map-sheet-state.ts`
(19 lines). **This is a fork, stated as a fork.** Unifying the two sheets is a
post-beta refactor to be scheduled after the place sheet's behaviour is locked by
tests.

Also: move `SubwaySnap` / `SubwayPlaceCategory` into `lib/subway-view.ts` so
`map-screen.tsx:19` stops importing from a file we intend to delete; add the chip rail;
force zoom ≥ 16 on entry; add `station` to the URL. **Keep `snap` in local state, not
the URL** — writing it on every drag churns `router.replace` and pollutes the back stack.

### Phase 3 — 1–2 days, after phase 2 survives a beta cycle

Route moves to `/map/route` reusing `route-strip.tsx` and the existing
`findRoute`/`findRouteVia`. Add "Get here by subway" to the place sheet. Add the
nearby-stations strip.

### Phase 4 — post-beta

Delete `subway-route-controller.tsx`. Retarget `lib/subway-search-layout.test.ts` from
source-string assertions to a **layout budget test**: chrome above the first shop row
≤ 125px at half, ≥ 3 fully visible rows at 844px, sheet ≤ 50% at the landing snap.
Clean the dead assertions in `lib/mobile-ux-contracts.test.ts` (`.subway-live-pill`,
the `aria-describedby` route-help contract). Then unify the sheets. Deleting tests that
encode shipped behaviour is legitimate here but must be a stated deliverable, not a
surprise in a diff.

## Owner decisions required

1. **Does in-app A→B routing survive v1?** Recommendation: demote to `/map/route`
   (phase 3), do not delete. Phases 1–2 do not depend on the answer.
2. **Fabricated exit numbers on the map.** Commit 086a4b0 shipped exit markers driven
   by the same hash generator. Shop rows no longer show them. Pull the map markers too,
   or accept the fiction until a real exit dataset exists?
3. **Keep the category chip row?** Costs ~half a shop row at half snap (3.0 vs 3.5).
   Olive Young is the anchor brand and single-brand intent is common. Lean keep.
4. **Radius as a chip with a <5-results auto-expand, or a first-class control?**
5. **Subway as a mode button or a map layer chip?** Layer is architecturally cleaner
   but collides with `MapSheet`, which is always mounted in map mode at `peek`
   (`h − 62`), so "zero panel" isn't achievable without touching the normal map.
   Kept as a mode; revisit post-beta.
6. **Is any of this in the beta cut?** Phase 1 is safe for any timeline. Phase 2 is a
   2–3 day change with a fork best not resolved under launch pressure. Recommendation:
   ship phase 1 now, phase 2 immediately after the cut.
