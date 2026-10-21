import { describe, expect, it } from "vitest";
import { stationSearchGroups } from "./subway-station-search";

describe("dedicated station search results", () => {
  it("matches English, Korean and tourist aliases", () => {
    for (const query of ["Gangnam", "강남역"]) {
      expect(stationSearchGroups(query, null, [])[0].stations[0].id).toBe("gangnam");
    }
    expect(stationSearchGroups("Hongdae", null, [])[0].stations[0].id).toBe("hongik_univ");
  });

  it("shows the full matching list rather than the former eight-item dropdown", () => {
    const matches = stationSearchGroups("univ", null, [])[0].stations;
    expect(matches.length).toBeGreaterThan(8);
    expect(new Set(matches.map((station) => station.id)).size).toBe(matches.length);
  });

  it("deduplicates nearby, recent and popular stations and ignores stale IDs", () => {
    const groups = stationSearchGroups("", "gangnam", ["gangnam", "seoul", "seoul", "removed-station"]);
    expect(groups.map((group) => group.label)).toEqual(["Near you", "Recent stations", "Popular stations"]);
    expect(groups[0].stations.map((station) => station.id)).toEqual(["gangnam"]);
    expect(groups[1].stations.map((station) => station.id)).toEqual(["seoul"]);
    const ids = groups.flatMap((group) => group.stations.map((station) => station.id));
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).not.toContain("removed-station");
  });

  it("keeps no-match results empty without substituting popular stations", () => {
    expect(stationSearchGroups("not-a-real-station-xyz", null, ["gangnam"])).toEqual([]);
  });

  it("offers popular stations without location permission or recent history", () => {
    const groups = stationSearchGroups("  ", null, []);
    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBe("Popular stations");
    expect(groups[0].stations.length).toBeGreaterThan(0);
  });
});
