import type { Place } from "./data";

export type PlaceCoordinateGroup = {
  key: string;
  lat: number;
  lng: number;
  ids: string[];
};

/** Map identity is intentionally fixed to six decimals (roughly 11 cm).
 * The displayed pin keeps the first official coordinate unchanged. */
export function coordinateKey(place: Pick<Place, "lat" | "lng">): string {
  return `${place.lat.toFixed(6)}:${place.lng.toFixed(6)}`;
}

/** Preserve the catalogue's first-seen group and member order. */
export function groupPlacesByCoordinate(places: readonly Place[]): PlaceCoordinateGroup[] {
  const groups: PlaceCoordinateGroup[] = [];
  const byKey = new Map<string, PlaceCoordinateGroup>();

  for (const place of places) {
    const key = coordinateKey(place);
    const existing = byKey.get(key);
    if (existing) {
      existing.ids.push(place.id);
      continue;
    }
    const group = { key, lat: place.lat, lng: place.lng, ids: [place.id] };
    byKey.set(key, group);
    groups.push(group);
  }

  return groups;
}
