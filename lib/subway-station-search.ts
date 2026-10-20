import { searchStations, STATIONS, type SubwayStation } from "./subway";

const POPULAR_STATIONS = ["gangnam", "myeongdong", "hongik_univ", "seoul", "seongsu", "apgujeong_rodeo"];
export type StationSearchGroup = { label: string; stations: SubwayStation[] };

/** Full-page results share the route engine's English/Korean/alias matching. */
export function stationSearchGroups(query: string, nearbyId: string | null, recentIds: readonly string[]): StationSearchGroup[] {
  if (query.trim()) {
    const stations = searchStations(query, Object.keys(STATIONS).length);
    return stations.length ? [{ label: "Search results", stations }] : [];
  }
  const seen = new Set<string>();
  const group = (label: string, ids: readonly string[]): StationSearchGroup => ({
    label,
    stations: ids.filter((id) => {
      if (!STATIONS[id] || seen.has(id)) return false;
      seen.add(id);
      return true;
    }).map((id) => STATIONS[id]),
  });
  return [
    group("Near you", nearbyId ? [nearbyId] : []),
    group("Recent stations", recentIds),
    group("Popular stations", POPULAR_STATIONS),
  ].filter((item) => item.stations.length > 0);
}
