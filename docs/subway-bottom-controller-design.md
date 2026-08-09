# Subway Station Controller

> Status: current product interaction contract as of commit `563950d` (2026-07-26).

## Product contract

- Keep the geographic map visible. It renders nearby place pins only; subway station pins, route polylines, and route distance graphics never appear on the map.
- Subway planning lives in one bottom controller: search departure and arrival, calculate the route, then browse only the stations on that route.
- Selecting a station in the route rail moves the map camera to that station and refreshes the nearby place pins and list from the same station center.
- The default nearby radius is 1 km, with explicit 500 m, 1 km, and 2 km controls. Radius copy must not imply an exit-specific walking route.

## Search states

- Both departure and arrival use accessible comboboxes with English and Korean matching, keyboard navigation, clear actions, and line badges.
- Empty query shows useful popular stations; entered text shows ranked exact, prefix, and substring matches.
- No-result, unconfirmed-input, and same-station errors stay next to the search controls. Exact names commit on blur; other text must be selected from the results.
- Endpoint edits remain drafts until `Show route` or `Update route`, so canceling an edit never destroys the current route.
- Swapping endpoints preserves context and recalculates the route.

## Route states

- The active station is the visual focus, with its previous and next route station names and its current line color.
- A horizontally scrollable route rail shows every route station and transfer boundary. Arrow buttons provide an alternative to swiping.
- Place categories are `All`, `Beauty`, `Olive Young`, and `Daiso`. Daiso remains an honest empty state until verified place data exists.
- Nearby rows use straight-line distance from the station center. Store inventory is never claimed; Olive Young product discovery links to the existing product catalog and states that store-level stock is unavailable.

## State ownership

- `MapScreen` owns mode, endpoints, calculated route, active station, radius, nearby category, selected place, and map camera target.
- `SubwayRouteController` owns only transient combobox/scroll interaction.
- `lib/subway.ts` owns deterministic station search, routing, nearest-station lookup, and radius filtering.
