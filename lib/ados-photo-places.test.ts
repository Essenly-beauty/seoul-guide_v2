import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { ADOS_PHOTO_PLACES } from "./generated/ados-photo-places";

const EXPECTED_IDS = [
  "ados-dakyo-nail-seongsu",
  "ados-eql-grove-seongsu",
  "ados-nailkimlee",
  "ados-nampyeonghwa-sangga",
  "ados-o-hui-whoo-spa-massage",
  "ados-riverside-spa-land",
  "ados-roa-makeup",
  "ados-seoul-sky",
  "ados-spa-1978-red-ginseng-ritual",
  "ados-stylenanda-pink-hotel-flagship-store",
  "ados-supsok-hanbang-land",
  "ados-the-boutique-hauve-dosan",
  "ados-the-foret-spa-seoul-forest",
  "ados-triomphe-esthetic",
  "ados-yoning",
].sort();

describe("photo-backed ADOS place approvals", () => {
  it("pins the immutable 209-row source snapshot", () => {
    const source = readFileSync("data/sources/adropofseoul_places-2026-09-08.json");
    expect(JSON.parse(source.toString())).toHaveLength(209);
    expect(createHash("sha256").update(source).digest("hex"))
      .toBe("935ac0f02f016e252dd22fd02723fec882b87726b210a185f5a7c60518a804ff");
  });

  it("contains only the independently evidenced exact-coordinate approvals", () => {
    expect(ADOS_PHOTO_PLACES.map((place) => place.id).sort()).toEqual(EXPECTED_IDS);
    expect(new Set(ADOS_PHOTO_PLACES.map((place) => place.id)).size).toBe(ADOS_PHOTO_PLACES.length);

    for (const place of ADOS_PHOTO_PLACES) {
      expect(place.address, `${place.id} address`).toMatch(/^서울 /);
      expect(place.lat, `${place.id} latitude`).toBeGreaterThanOrEqual(37.42);
      expect(place.lat, `${place.id} latitude`).toBeLessThanOrEqual(37.7);
      expect(place.lng, `${place.id} longitude`).toBeGreaterThanOrEqual(126.76);
      expect(place.lng, `${place.id} longitude`).toBeLessThanOrEqual(127.19);
      expect(place.geoSource, `${place.id} pin provenance`).toBe("address");
      expect(place.url, `${place.id} direct evidence`).toMatch(/^https:\/\/(?!.*\/search)/);
      expect(place.rating, `${place.id} rating`).toBeUndefined();
      expect(place.ratingCount, `${place.id} review count`).toBeUndefined();
      expect(place.priceRange, `${place.id} price range`).toBeUndefined();
    }
  });
});
