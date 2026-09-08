import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { DAISO_PLACES } from "./generated/daiso-places";

describe("generated Daiso places", () => {
  it("contains exactly the 251 official Seoul stores", () => {
    expect(DAISO_PLACES).toHaveLength(251);
  });

  it("keeps one unique identity for every official store", () => {
    expect(new Set(DAISO_PLACES.map((place) => place.id)).size).toBe(251);
  });

  it("publishes every generated record as Daiso without unsupported ratings or English-service claims", () => {
    for (const place of DAISO_PLACES) {
      expect(place.type, place.id).toBe("daiso");
      expect(place, place.id).not.toHaveProperty("rating");
      expect(place, place.id).not.toHaveProperty("ratingCount");
      expect(place, place.id).not.toHaveProperty("englishOk");
    }
  });

  it("uses an English primary name and preserves the official Korean secondary name", () => {
    for (const place of DAISO_PLACES) {
      expect(place.name, `${place.id} primary name`).toMatch(/^Daiso\b/);
      expect(place.name, `${place.id} primary name`).not.toMatch(/[가-힣]/);
      expect(place.nameKr, `${place.id} Korean name`).toMatch(/[가-힣]/);
      expect(place.name).not.toBe(place.nameKr);
    }
  });

  it("preserves both Express Bus Terminal stores that share one official pin", () => {
    const terminalStores = DAISO_PLACES.filter((place) =>
      ["강남고속버스터미널점", "강남고속버스터미널2호점"].includes(place.nameKr),
    );

    expect(terminalStores.map((place) => place.nameKr).sort()).toEqual([
      "강남고속버스터미널2호점",
      "강남고속버스터미널점",
    ]);
    expect(new Set(terminalStores.map((place) => `${place.lat},${place.lng}`)).size).toBe(1);
  });

  it("records deterministic repository-relative source provenance", () => {
    const generated = readFileSync(
      new URL("./generated/daiso-places.ts", import.meta.url),
      "utf8",
    );

    expect(generated).toContain(
      "// Source: data/sources/daiso-seoul-2026-09-03.json (251 published; 0 withheld by verification gate).",
    );
    expect(generated).not.toContain("/Users/");
  });
});
