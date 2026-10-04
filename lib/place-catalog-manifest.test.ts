import { describe, expect, it } from "vitest";
import { buildPlaceCatalogManifest } from "./place-catalog-manifest";
import type { Place } from "./data";

const base: Place = {
  id: "oy-test", name: "Olive Young Test", nameKr: "올리브영 테스트점",
  type: "olive_young", zone: "gangnam_station", address: "서울 강남구 테스트로 1",
  lat: 37.5, lng: 127.0, tags: [], source: "olive_young",
};

describe("place catalog manifest", () => {
  it("preserves the published ID and all presentation fields", () => {
    const source = { ...base };
    const published = { ...base, name: "Verified Test", photos: ["/places/oy-test/1.webp"] };
    const result = buildPlaceCatalogManifest([source], [published]);
    expect(result.sourceRows[0].payload).toEqual(source);
    expect(result.publishedRows[0].payload).toEqual(published);
    expect(result.publishedRows[0].id).toBe("oy-test");
    expect(result.publishedRows[0].sha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it("is insensitive to object key order and never mutates input", () => {
    const first = { ...base, tags: ["tax-free"], photos: ["/a.webp"] };
    const copy = structuredClone(first);
    const reordered = Object.fromEntries(Object.entries(first).reverse()) as Place;
    expect(buildPlaceCatalogManifest([first], [first]).publishedRows[0].sha256)
      .toBe(buildPlaceCatalogManifest([reordered], [reordered]).publishedRows[0].sha256);
    expect(first).toEqual(copy);
  });

  it("rejects duplicate IDs and a published row without a source", () => {
    expect(() => buildPlaceCatalogManifest([base, base], [base])).toThrow(/duplicate source id/);
    expect(() => buildPlaceCatalogManifest([], [base])).toThrow(/missing source id/);
  });

  it("retains incomplete source rows but rejects incomplete publication", () => {
    expect(buildPlaceCatalogManifest([{ ...base, address: " " }], []).sourceRows).toHaveLength(1);
    expect(() => buildPlaceCatalogManifest([base], [{ ...base, address: " " }])).toThrow(/address/);
    expect(() => buildPlaceCatalogManifest([base], [{ ...base, lat: Number.NaN }])).toThrow(/coordinates/);
  });
});
