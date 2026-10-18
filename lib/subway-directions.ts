import type { LatLng } from "./geo";

type NamedStation = LatLng & { name: string };

/** Named station routes always carry both ends. The generic place handoff
 * intentionally lets Google choose the visitor's current location instead. */
export function googleStationDirectionsUrl(
  departure: NamedStation,
  arrival: NamedStation,
  via?: LatLng[],
): string {
  const stationQuery = ({ name }: NamedStation) => {
    const station = name.trim();
    return `${station}${/\bstation$/i.test(station) ? "" : " Station"}, Seoul, South Korea`;
  };
  const params = new URLSearchParams({
    api: "1",
    origin: stationQuery(departure),
    destination: stationQuery(arrival),
    travelmode: "transit",
  });
  if (via?.length) {
    params.set("waypoints", via.map(({ lat, lng }) => `${lat},${lng}`).join("|"));
  }
  return `https://www.google.com/maps/dir/?${params}`;
}
