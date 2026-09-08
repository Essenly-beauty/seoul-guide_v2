import { describe, expect, it } from "vitest";
import type { Place } from "./data";
import { DAISO_PLACES } from "./generated/daiso-places";
import { coordinateKey, groupPlacesByCoordinate } from "./place-coordinate-groups";

const place = (id: string, lat: number, lng: number): Place => ({
  id,
  name: id,
  nameKr: id,
  type: "daiso",
  zone: "seoul_etc",
  priceRange: "₩",
  tags: [],
  address: "Seoul",
  lat,
  lng,
});

describe("place coordinate groups", () => {
  it("groups fixed-six coordinate matches without moving the original pin", () => {
    const first = place("first", 37.504_123_41, 127.004_567_41);
    const second = place("second", 37.504_123_49, 127.004_567_49);
    const third = place("third", 37.51, 127.01);

    const groups = groupPlacesByCoordinate([first, second, third]);

    expect(groups[0]).toEqual({
      key: "37.504123:127.004567",
      lat: first.lat,
      lng: first.lng,
      ids: [first.id, second.id],
    });
    expect(groups[1].ids).toEqual([third.id]);
  });

  it("preserves first-seen group and member order", () => {
    const first = place("first", 37.5, 127);
    const singleton = place("singleton", 37.6, 127.1);
    const second = place("second", 37.5, 127);

    expect(groupPlacesByCoordinate([first, singleton, second]).map((group) => group.ids))
      .toEqual([["first", "second"], ["singleton"]]);
  });

  it("uses fixed-six identity at the rounding boundary", () => {
    expect(coordinateKey(place("a", 37.500_000_4, 127.000_000_4)))
      .toBe("37.500000:127.000000");
    expect(coordinateKey(place("b", 37.500_000_6, 127.000_000_6)))
      .toBe("37.500001:127.000001");
  });

  it("keeps singleton groups explicit for normal marker rendering", () => {
    const only = place("only", 37.5, 127);

    expect(groupPlacesByCoordinate([only])).toEqual([{
      key: "37.500000:127.000000",
      lat: only.lat,
      lng: only.lng,
      ids: [only.id],
    }]);
  });

  it("keeps both official Express Bus Terminal branches in one reachable group", () => {
    const group = groupPlacesByCoordinate(DAISO_PLACES).find((candidate) =>
      candidate.ids.some((id) => decodeURIComponent(id).includes("강남고속버스터미널2호점")),
    );

    expect(group?.ids).toHaveLength(2);
    expect(group?.ids.map(decodeURIComponent)).toEqual([
      expect.stringContaining("강남고속버스터미널2호점"),
      expect.stringContaining("강남고속버스터미널점"),
    ]);
  });
});
