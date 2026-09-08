import type { Place } from "./data";

/**
 * Keep the active place on the marker layer even when a category, saved-list,
 * shared-list, or searched-area filter excludes it. Selection is an explicit
 * navigation intent and must not resolve to a detail sheet without a pin.
 */
export function includeSelectedPlace(
  filtered: Place[],
  selectedId: string | null,
  resolvePlace: (id: string) => Place | undefined,
): Place[] {
  if (!selectedId || filtered.some((place) => place.id === selectedId)) return filtered;
  const selected = resolvePlace(selectedId);
  return selected ? [...filtered, selected] : filtered;
}
