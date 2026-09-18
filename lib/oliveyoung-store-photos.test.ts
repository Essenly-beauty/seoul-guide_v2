import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { CATALOGUE_PLACES } from "./data";
import { PLACE_PHOTOS, PLACE_PHOTO_THUMBNAILS } from "./generated/place-photos";
import { planOliveYoungPhotoStaging } from "../scripts/stage-oliveyoung-photos.mjs";

type ManifestEntry = {
  storeCode: string;
  storeName: string;
  district: string;
  officialAddress: string;
  file: string;
  placeId?: string;
  catalogueAddress?: string;
  imageUrl?: string;
  reason?: string;
};

type Manifest = {
  schemaVersion: number;
  source: { driveFolder: string; confirmedOn: string; rights: string };
  photos: ManifestEntry[];
  excluded: ManifestEntry[];
  notInCatalogue: ManifestEntry[];
};

const manifest = JSON.parse(readFileSync("data/oliveyoung-store-photos.json", "utf8")) as Manifest;
const placesById = new Map(CATALOGUE_PLACES.map((place) => [place.id, place]));
const EXCLUSION_REASONS = new Set(["event_poster", "different_brand", "already_has_owner_photos", "place_not_public"]);

describe("Olive Young official store photos", () => {
  it("pins the reviewed 2026-09-18 store → place mapping", () => {
    expect(manifest.schemaVersion).toBe(1);
    expect(manifest.source.confirmedOn).toBe("2026-09-18");
    expect(manifest.source.rights).toMatch(/owner/);
    expect(manifest.photos).toHaveLength(224);
    expect(manifest.excluded).toHaveLength(17);
    expect(manifest.notInCatalogue).toHaveLength(127);
    expect(manifest.photos.length + manifest.excluded.length + manifest.notInCatalogue.length).toBe(368);
  });

  it("maps every photo to exactly one Olive Young catalogue place with a matching store name", () => {
    const codes = new Set<string>();
    const placeIds = new Set<string>();
    for (const entry of manifest.photos) {
      expect(entry.storeCode, entry.file).toMatch(/^[A-Z0-9]{4}$/);
      expect(entry.file, entry.storeCode).toBe(`${entry.storeCode}_${entry.storeName}.webp`);
      expect(codes.has(entry.storeCode), `duplicate store ${entry.storeCode}`).toBe(false);
      codes.add(entry.storeCode);
      expect(placeIds.has(entry.placeId ?? ""), `two stores on ${entry.placeId}`).toBe(false);
      placeIds.add(entry.placeId ?? "");

      const place = placesById.get(entry.placeId ?? "");
      expect(place, `${entry.storeCode} → ${entry.placeId}`).toBeDefined();
      expect(place?.type, entry.placeId).toBe("olive_young");
      const normalize = (value: string) => value.normalize("NFKC").replace(/올리브영|[\s\-·.()]/g, "");
      expect(normalize(place?.nameKr ?? ""), `${entry.storeCode} name`).toBe(normalize(entry.storeName));
      expect(entry.imageUrl).toMatch(/^https:\/\/image\.oliveyoung\.co\.kr\//);
    }
  });

  it("publishes each mapped store's single photo and nothing for the excluded images", () => {
    for (const entry of manifest.photos) {
      const id = entry.placeId ?? "";
      expect(PLACE_PHOTOS[id], id).toEqual([`/places/${id}/1.webp`]);
      expect(PLACE_PHOTO_THUMBNAILS[id], id).toBe(`/places/${id}/1.thumb.webp`);
    }
    for (const entry of manifest.excluded) {
      expect(EXCLUSION_REASONS.has(entry.reason ?? ""), `${entry.storeCode} reason`).toBe(true);
      if (entry.reason === "already_has_owner_photos") {
        expect(PLACE_PHOTOS[entry.placeId ?? ""]?.length ?? 0, entry.placeId).toBeGreaterThan(1);
      } else if (entry.placeId) {
        // The City Log event poster is the same artwork for ten stores, and a
        // place that is not published yet must not ship dead photo bytes —
        // either way the place keeps its honest empty state.
        expect(PLACE_PHOTOS[entry.placeId], `${entry.storeCode} poster leaked onto ${entry.placeId}`).toBeUndefined();
      }
    }
  });

  it("stages photos only for manifest entries the archive and catalogue both vouch for", () => {
    const files = manifest.photos.map((entry) => entry.file);
    const knownIds = new Set(CATALOGUE_PLACES.map((place) => place.id));

    const plan = planOliveYoungPhotoStaging(manifest, files, knownIds);
    expect(plan).toHaveLength(manifest.photos.length);
    expect(plan.every((step) => step.targetFile === "1.webp")).toBe(true);

    expect(() => planOliveYoungPhotoStaging(manifest, files.slice(1), knownIds))
      .toThrow(/missing from the archive/);
    expect(() =>
      planOliveYoungPhotoStaging(
        { ...manifest, photos: [{ ...manifest.photos[0], placeId: "oy-없는지점" }] },
        files,
        knownIds,
      ),
    ).toThrow(/Unknown catalogue place/);
    expect(() =>
      planOliveYoungPhotoStaging(
        { ...manifest, photos: [manifest.photos[0], { ...manifest.photos[1], placeId: manifest.photos[0].placeId }] },
        files,
        knownIds,
      ),
    ).toThrow(/Two stores map to/);
  });
});
