import type { Place } from "./data";

export type SubwayPlaceCategory =
  | "all"
  | "beauty"
  | "olive_young"
  | "personal_color"
  | "mall"
  | "daiso";

export function filterSubwayPlaces(
  places: readonly Place[],
  category: SubwayPlaceCategory,
): Place[] {
  if (category === "all") return [...places];
  if (category === "daiso") return places.filter((place) => place.type === "daiso");
  if (category === "olive_young") return places.filter((place) => place.type === "olive_young");
  if (category === "personal_color") return places.filter((place) => place.type === "personal_color");
  if (category === "mall") return places.filter((place) => place.type === "mall");

  return places.filter((place) =>
    place.type !== "olive_young"
    && place.type !== "daiso"
    && place.type !== "etc"
    && place.type !== "mall"
  );
}
