import type { LatLng } from "./geo";
import { STATIONS } from "./subway";

type NamedStation = LatLng & { name: string };

const duplicateStationNames = new Set<string>();
const seenStationNames = new Set<string>();
for (const { name } of Object.values(STATIONS)) {
  const key = name.trim().toLowerCase();
  if (seenStationNames.has(key)) duplicateStationNames.add(key);
  seenStationNames.add(key);
}

/** Named station routes always carry both ends. The generic place handoff
 * intentionally lets Google choose the visitor's current location instead.
 * Duplicate catalogue names use exact coordinates to preserve the selected
 * station's identity until verified Google place IDs are available. */
export function googleStationDirectionsUrl(
  departure: NamedStation,
  arrival: NamedStation,
  via?: LatLng[],
): string {
  const stationQuery = ({ name, lat, lng }: NamedStation) => {
    const station = name.trim();
    if (duplicateStationNames.has(station.toLowerCase())) return `${lat},${lng}`;
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
