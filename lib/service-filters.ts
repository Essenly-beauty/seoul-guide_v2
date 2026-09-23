import { SERVICE_FILTERS, type Place, type PlaceType } from "./data";

export type ServiceFilter = { key: string; label: string };

/** The service filters worth showing for a category: the ones at least one
 *  published place can answer.
 *
 *  SERVICE_FILTERS is the catalogue of intent and stays complete — a tag the
 *  data cannot answer today should come back on its own the day it can, not
 *  need re-adding. What the sheet must never do is offer a filter that returns
 *  an empty list, because the visitor reads that as "this city has no such
 *  store" rather than "we have no such data". The sheet was offering 20 and
 *  only 2 could match, including six filters for skin_clinic, a category with
 *  no published places at all. */
export function liveServiceFilters(
  places: readonly Pick<Place, "type" | "serviceTags">[],
  type: PlaceType,
): ServiceFilter[] {
  const available = new Set<string>();
  for (const place of places) {
    if (place.type !== type) continue;
    for (const tag of place.serviceTags ?? []) available.add(tag);
  }
  return (SERVICE_FILTERS[type] ?? []).filter((tag) => available.has(tag.key));
}
