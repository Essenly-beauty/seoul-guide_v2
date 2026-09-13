import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { buildProvisionalPhotoPlaces } from "./ados-photo-provisional";
import { CATALOGUE_PLACES } from "./data";
import { ADOS_PHOTO_PROVISIONAL_PLACES } from "./generated/ados-photo-provisional-places";

describe("provisional owner-photo places", () => {
  it("keeps existing and aliased identities out while making a transparent approximate record", () => {
    const places = buildProvisionalPhotoPlaces({
      sourceRows: [
        {
          id: "001",
          slug: "already-here",
          category: "뷰티",
          entryType: "장소",
          type: "헤어",
          region: "성수",
          nameEn: "Already Here",
          nameKr: "기존 장소",
          address: "서울 성동구 연무장길 1",
          naverMap: "https://map.naver.com/p/search/example",
          verified: true,
        },
        {
          id: "002",
          slug: "former-name",
          category: "뷰티",
          entryType: "장소",
          type: "스파",
          region: "명동",
          nameEn: "Former Name",
          nameKr: "이전 상호",
          address: "서울 중구 명동길 2",
          naverMap: "https://map.naver.com/p/search/former",
          verified: true,
        },
        {
          id: "003",
          slug: "new-place",
          category: "뷰티",
          entryType: "장소",
          type: "퍼스널컬러",
          region: "홍대",
          nameEn: "New Place",
          nameKr: "새 장소",
          address: "서울 마포구 홍익로 3",
          naverMap: "https://map.naver.com/p/search/new",
          verified: true,
        },
      ],
      sourcePlaceIds: ["ados-already-here", "ados-former-name", "ados-new-place"],
      existingPlaceIds: new Set(["ados-already-here", "canonical-place"]),
      aliases: new Map([["ados-former-name", "canonical-place"]]),
    });

    expect(places).toEqual([
      expect.objectContaining({
        id: "ados-new-place",
        name: "New Place",
        nameKr: "새 장소",
        type: "personal_color",
        zone: "hongdae",
        address: "서울 마포구 홍익로 3",
        geoSource: "area",
        locationVerification: "provisional",
        nameVerification: "provisional",
        url: "https://map.naver.com/p/search/new",
      }),
    ]);
    expect(places[0].rating).toBeUndefined();
    expect(places[0].ratingCount).toBeUndefined();
    expect(places[0].priceRange).toBeUndefined();
    expect(places[0].hours).toBeUndefined();
  });

  it("omits a source URL when all optional links are null", () => {
    const [place] = buildProvisionalPhotoPlaces({
      sourceRows: [{
        id: "004",
        slug: "no-source-link",
        category: "뷰티",
        entryType: "장소",
        type: "헤어",
        region: "성수",
        nameEn: "No Source Link",
        nameKr: "출처 링크 없음",
        address: "서울 성동구 성수이로 4",
        naverMap: null,
        googleMaps: null,
        website: null,
        verified: true,
      }],
      sourcePlaceIds: ["ados-no-source-link"],
      existingPlaceIds: new Set(),
      aliases: new Map(),
    });

    expect(place.url).toBeUndefined();
    expect(JSON.stringify(place)).not.toContain('"url":null');
  });

  it("covers every one of the 160 owner-photo source folders without duplicate map places", () => {
    const inventory = JSON.parse(readFileSync("data/place-photo-source-inventory.json", "utf8")) as {
      schemaVersion: number;
      sources: { sourcePlaceId: string; photos: number }[];
    };
    const aliasManifest = JSON.parse(readFileSync("data/place-photo-aliases.json", "utf8")) as {
      aliases: { sourcePlaceId: string; targetPlaceId: string }[];
    };
    const provisionalIds = new Set(ADOS_PHOTO_PROVISIONAL_PLACES.map((place) => place.id));
    const baseIds = new Set(
      CATALOGUE_PLACES
        .map((place) => place.id)
        .filter((id) => !provisionalIds.has(id)),
    );
    const aliases = new Map(
      aliasManifest.aliases.map((alias) => [alias.sourcePlaceId, alias.targetPlaceId]),
    );

    expect(inventory.schemaVersion).toBe(1);
    expect(inventory.sources).toHaveLength(160);
    expect(inventory.sources.reduce((total, source) => total + source.photos, 0)).toBe(613);
    expect(ADOS_PHOTO_PROVISIONAL_PLACES).toHaveLength(96);

    const uncovered = inventory.sources.filter(({ sourcePlaceId }) =>
      !baseIds.has(sourcePlaceId) && !aliases.has(sourcePlaceId) && !provisionalIds.has(sourcePlaceId));
    expect(uncovered).toEqual([]);

    const canonicalIds = inventory.sources.map(({ sourcePlaceId }) =>
      aliases.get(sourcePlaceId) ?? sourcePlaceId);
    expect(new Set(canonicalIds)).toHaveLength(159);
  });
});
