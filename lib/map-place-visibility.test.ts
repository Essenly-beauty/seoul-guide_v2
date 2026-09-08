import { describe, expect, it } from "vitest";
import type { Place } from "./data";
import { includeSelectedPlace } from "./map-place-visibility";

const place = (id: string): Place => ({
  id,
  name: id,
  nameKr: id,
  type: "etc",
  zone: "gangnam_station",
  lat: 37.5,
  lng: 127,
  address: "Seoul",
  priceRange: "₩",
  englishOk: false,
  tags: [],
});

describe("map place visibility", () => {
  const visible = [place("visible")];
  const selected = place("selected");

  it("adds a selected catalog place when active filters excluded it", () => {
    expect(includeSelectedPlace(visible, selected.id, () => selected).map((item) => item.id))
      .toEqual(["visible", "selected"]);
  });

  it("does not duplicate an already-visible selected place", () => {
    expect(includeSelectedPlace([...visible, selected], selected.id, () => selected).map((item) => item.id))
      .toEqual(["visible", "selected"]);
  });

  it("keeps the original filtered list for no or unknown selection", () => {
    expect(includeSelectedPlace(visible, null, () => selected)).toBe(visible);
    expect(includeSelectedPlace(visible, "missing", () => undefined)).toBe(visible);
  });
});
