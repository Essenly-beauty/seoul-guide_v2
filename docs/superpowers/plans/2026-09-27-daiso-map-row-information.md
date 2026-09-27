# Daiso Map Row Information Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. This owner request is executed inline; do not delegate.

**Goal:** Remove duplicate Daiso row labels and show only the store-specific tax-refund/SIM-card facts already in the catalog.

**Architecture:** A small pure selector maps existing `Place.serviceTags` to display labels. The map sheet uses that selector in one shared Daiso service-line component for both nearby and same-coordinate rows. Other place types, the logo/photo choice, and data remain unchanged.

**Tech Stack:** Next.js 15, React, TypeScript, Vitest, CSS.

---

### Task 1: Select only confirmed Daiso services

**Files:** Create `lib/daiso-row-services.ts` and `lib/daiso-row-services.test.ts`.

- [ ] Write failing tests for a Daiso with both tags, only one tag, no tags, and a non-Daiso carrying those tags:

```ts
import { describe, expect, it } from "vitest";
import { daisoRowServices } from "./daiso-row-services";

describe("daisoRowServices", () => {
  it("shows only confirmed Daiso services in a stable order", () => {
    expect(daisoRowServices({ type: "daiso", serviceTags: ["sim-card", "tax-refund"] })).toEqual(["Tax refund", "SIM card"]);
    expect(daisoRowServices({ type: "daiso", serviceTags: ["sim-card"] })).toEqual(["SIM card"]);
    expect(daisoRowServices({ type: "daiso" })).toEqual([]);
    expect(daisoRowServices({ type: "olive_young", serviceTags: ["tax-refund"] })).toEqual([]);
  });
});
```

- [ ] Run `npm test -- lib/daiso-row-services.test.ts`; expect module-not-found failure.
- [ ] Add the minimal selector:

```ts
import type { Place } from "./data";

export function daisoRowServices(place: Pick<Place, "type" | "serviceTags">): string[] {
  if (place.type !== "daiso") return [];
  const tags = place.serviceTags ?? [];
  return [
    ...(tags.includes("tax-refund") ? ["Tax refund"] : []),
    ...(tags.includes("sim-card") ? ["SIM card"] : []),
  ];
}
```

- [ ] Run the focused test; expect all cases to pass.

### Task 2: Render the approved row in both map-list variants

**Files:** Modify `components/map/map-sheet.tsx`, `app/globals.css`, and `lib/map-selection-wiring.test.ts`.

- [ ] First add a failing source contract in `lib/map-selection-wiring.test.ts` that requires both row variants to use `DaisoRowServices`, conditionally omit the category/area eyebrow for Daiso, and conditionally omit `priceRange` for Daiso. Run `npm test -- lib/map-selection-wiring.test.ts` and confirm the expected failure.
- [ ] Import `daisoRowServices` in the map sheet. In both row variants render the existing eyebrow only for `place.type !== "daiso"` or `p.type !== "daiso"`. In the ordinary row, render the price token only for `p.type !== "daiso"`. After each metadata row add `<DaisoRowServices place={place} />` or `<DaisoRowServices place={p} />`.
- [ ] Add this shared component below `MapRowThumb`; it renders nothing for an empty selector result and otherwise renders a `caption muted maprow-daiso-services` line with one `maprow-daiso-service` span per label:

```tsx
function DaisoRowServices({ place }: { place: Place }) {
  const services = daisoRowServices(place);
  if (services.length === 0) return null;
  return <div className="caption muted maprow-daiso-services">
    {services.map((label) => <span className="maprow-daiso-service" key={label}>{label}</span>)}
  </div>;
}
```

- [ ] Style the line with existing surface/text/radius tokens and no hard-coded color, keeping the thumb 84 px square and the text readable at mobile width.
- [ ] Run `npm test -- lib/map-selection-wiring.test.ts lib/daiso-row-services.test.ts`; expect both files to pass.

### Task 3: Verify and preview

**Files:** Update `reports/operations/improvement-history.md` in the original workspace after verifying the isolated release.

- [ ] Run `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, and `git diff --check` in the release checkout. Record exact results.
- [ ] Inspect the isolated Vercel preview at `/map` for the Daiso Gangnam Stn. 2 row: English/Korean names, `Live`, distance, `Tax refund`, `SIM card`, supplied logo; no `DAISO · GANGNAM` or `₩`. Confirm an adjacent non-Daiso row is unchanged.
- [ ] Mirror the same scoped code/tests into the owner's dirty workspace without overwriting unrelated work. Commit and push only the isolated release branch. Do not promote production while the separate Supabase access/migration gate is unresolved.
