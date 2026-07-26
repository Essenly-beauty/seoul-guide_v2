import { describe, it, expect } from "vitest";
import {
  findRoute,
  findRouteVia,
  moveRouteWaypoint,
  routeSegmentStartIndices,
} from "./subway";

describe("findRouteVia", () => {
  it("chains dep…via…arr with no duplicated junction station", () => {
    const leg1 = findRoute("gangnam", "sadang")!;
    const leg2 = findRoute("sadang", "hongik_univ")!;
    const via = findRouteVia("gangnam", ["sadang"], "hongik_univ")!;

    expect(via.stations[0]).toBe("gangnam");
    expect(via.stations.at(-1)).toBe("hongik_univ");
    expect(via.stations).toEqual([...leg1.stations, ...leg2.stations.slice(1)]);
    expect(via.stations.filter((id) => id === "sadang")).toHaveLength(1);
    expect(via.stations.some((id, index) => via.stations[index + 1] === id)).toBe(false);
  });

  it("adds a transfer penalty when consecutive via legs change lines", () => {
    const firstLeg = findRoute("gangnam", "sadang")!;
    const secondLeg = findRoute("sadang", "myeongdong")!;
    expect(firstLeg.segments.at(-1)!.line).not.toBe(secondLeg.segments[0].line);

    const via = findRouteVia("gangnam", ["sadang"], "myeongdong")!;
    expect(via.totalSeconds).toBe(firstLeg.totalSeconds + secondLeg.totalSeconds + 180);
  });

  it("does not add a transfer penalty when consecutive via legs stay on one line", () => {
    const firstLeg = findRoute("gangnam", "yeoksam")!;
    const secondLeg = findRoute("yeoksam", "seolleung")!;
    const via = findRouteVia("gangnam", ["yeoksam"], "seolleung")!;

    expect(firstLeg.segments.at(-1)!.line).toBe(secondLeg.segments[0].line);
    expect(via.totalSeconds).toBe(firstLeg.totalSeconds + secondLeg.totalSeconds);
  });

  it("keeps up to two vias in leg order", () => {
    const via = findRouteVia("gangnam", ["sadang", "hongik_univ"], "seoul")!;
    const sadangAt = via.stations.indexOf("sadang");
    const hongikAt = via.stations.indexOf("hongik_univ");

    expect(sadangAt).toBeGreaterThan(0);
    expect(hongikAt).toBeGreaterThan(sadangAt);
    expect(via.stations.at(-1)).toBe("seoul");
  });

  it("merges same-line legs across the junction so the transfer count stays honest", () => {
    // Gangnam → Yeoksam → Seolleung are consecutive line-2 stations.
    const via = findRouteVia("gangnam", ["yeoksam"], "seolleung")!;
    expect(via.segments).toHaveLength(1);
    expect(via.segments[0].line).toBe("2");
    expect(via.segments[0].stations).toEqual(via.stations);
  });

  it("returns null for repeated waypoints or an invalid via", () => {
    expect(findRouteVia("gangnam", ["gangnam"], "hongik_univ")).toBeNull();
    expect(findRouteVia("gangnam", ["hongik_univ"], "hongik_univ")).toBeNull();
    expect(findRouteVia("gangnam", ["sadang", "sadang"], "hongik_univ")).toBeNull();
    expect(findRouteVia("gangnam", ["nope"], "hongik_univ")).toBeNull();
  });

  it("matches findRoute when the via list is empty", () => {
    expect(findRouteVia("gangnam", [], "hongik_univ")).toEqual(findRoute("gangnam", "hongik_univ"));
  });

  it("assigns every rendered station occurrence a distinct absolute route index", () => {
    const route = findRouteVia("gangnam", ["myeongdong"], "jamsil_songpa_gu_office")!;
    const starts = routeSegmentStartIndices(route);
    const rendered = route.segments.flatMap((segment, segmentIndex) =>
      segment.stations.flatMap((id, stationIndex) =>
        segmentIndex > 0 && stationIndex === 0
          ? []
          : [{ id, index: starts[segmentIndex] + stationIndex }],
      ),
    );

    expect(rendered.map(({ id }) => id)).toEqual(route.stations);
    expect(rendered.map(({ index }) => index)).toEqual(
      route.stations.map((_, index) => index),
    );
    const repeatedId = route.stations.find((id, index) => route.stations.indexOf(id) !== index);
    expect(repeatedId).toBeDefined();
    expect(rendered.filter(({ id }) => id === repeatedId).map(({ index }) => index).length).toBeGreaterThan(1);
  });
});

describe("moveRouteWaypoint", () => {
  it("lets a via become the departure or arrival by moving one position", () => {
    const waypoints = ["gangnam", "sadang", "myeongdong"];

    expect(moveRouteWaypoint(waypoints, 1, -1)).toEqual([
      "sadang",
      "gangnam",
      "myeongdong",
    ]);
    expect(moveRouteWaypoint(waypoints, 1, 1)).toEqual([
      "gangnam",
      "myeongdong",
      "sadang",
    ]);
  });

  it("moves vias relative to each other without mutating the current order", () => {
    const waypoints = ["gangnam", "sadang", "hongik_univ", "myeongdong"];

    expect(moveRouteWaypoint(waypoints, 2, -1)).toEqual([
      "gangnam",
      "hongik_univ",
      "sadang",
      "myeongdong",
    ]);
    expect(waypoints).toEqual(["gangnam", "sadang", "hongik_univ", "myeongdong"]);
  });

  it("ignores moves outside the route bounds", () => {
    const waypoints = ["gangnam", "sadang", "myeongdong"];

    expect(moveRouteWaypoint(waypoints, 0, -1)).toEqual(waypoints);
    expect(moveRouteWaypoint(waypoints, 2, 1)).toEqual(waypoints);
  });
});

describe("stationExits (synthesized)", () => {
  it("is deterministic and bounded", async () => {
    const { stationExits, STATIONS } = await import("./subway");
    const a = stationExits("gangnam");
    const b = stationExits("gangnam");
    expect(a).toEqual(b);
    expect(a.length).toBeGreaterThanOrEqual(3);
    expect(a.length).toBeLessThanOrEqual(8);
    const st = STATIONS["gangnam"];
    for (const e of a) {
      const dm = Math.hypot((e.lat - st.lat) * 111320, (e.lng - st.lng) * 88000);
      expect(dm).toBeLessThan(120);
      expect(dm).toBeGreaterThan(30);
    }
    expect(stationExits("nope")).toEqual([]);
  });
});
