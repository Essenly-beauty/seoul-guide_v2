import type { Place } from "./data";

export function daisoRowServices(place: Pick<Place, "type" | "serviceTags">): string[] {
  if (place.type !== "daiso") return [];
  const tags = place.serviceTags ?? [];
  return [
    ...(tags.includes("tax-refund") ? ["Tax refund"] : []),
    ...(tags.includes("sim-card") ? ["SIM card"] : []),
  ];
}
