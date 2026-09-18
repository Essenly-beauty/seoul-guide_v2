import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  APPROVED_DAISOMALL_SNAPSHOT_SHA256,
  APPROVED_OWNER_LIST_SHA256,
  EXPECTED_SUPPLEMENT_COUNT,
  addressVariants,
  evaluateHit,
  parseCsv,
  roadKey,
  selectSupplementStores,
  storeHours,
  type DaisomallSnapshot,
  type OwnerListRow,
} from "../scripts/build-daiso-supplement-places";
import { CATALOGUE_PLACES, PLACES } from "./data";
import { DAISO_PLACES } from "./generated/daiso-places";
import { DAISO_SUPPLEMENT_PLACES } from "./generated/daiso-supplement-places";

const snapshotText = readFileSync("data/sources/daisomall-seoul-2026-09-18.json", "utf8");
const ownerText = readFileSync("data/sources/daiso_seoul-owner-list-2026-09-18.csv");
const snapshot = JSON.parse(snapshotText) as DaisomallSnapshot;
const ownerRows = parseCsv(ownerText.toString("utf8")) as OwnerListRow[];
const normalize = (value: string) => value.normalize("NFKC").replace(/\s+/g, "");

describe("Daiso Seoul supplement (owner list 2026-09-18)", () => {
  it("pins the immutable store-finder snapshot and the owner's list", () => {
    expect(createHash("sha256").update(snapshotText).digest("hex")).toBe(APPROVED_DAISOMALL_SNAPSHOT_SHA256);
    expect(createHash("sha256").update(ownerText).digest("hex")).toBe(APPROVED_OWNER_LIST_SHA256);
    expect(snapshot.stores).toHaveLength(285);
    expect(ownerRows).toHaveLength(284);
    expect(ownerRows.every((row) => /^kr-daiso-[0-9a-f]{16}$/.test(row.id))).toBe(true);
  });

  it("publishes every store in the owner's list exactly once across the approved snapshot and the supplement", () => {
    const published = new Set([...DAISO_PLACES, ...DAISO_SUPPLEMENT_PLACES].map((place) => normalize(place.nameKr)));
    const uncovered = ownerRows.filter((row) => !published.has(normalize(row.store_name)));
    expect(uncovered.map((row) => row.store_name)).toEqual([]);
    expect(DAISO_PLACES.length + DAISO_SUPPLEMENT_PLACES.length).toBe(ownerRows.length);

    const overlap = DAISO_SUPPLEMENT_PLACES.filter((place) => DAISO_PLACES.some((approved) => normalize(approved.nameKr) === normalize(place.nameKr)));
    expect(overlap).toEqual([]);
    expect(DAISO_SUPPLEMENT_PLACES).toHaveLength(EXPECTED_SUPPLEMENT_COUNT);
  });

  it("derives the supplement from the snapshot deterministically and refuses silent renames", () => {
    const { supplement, nonSeoul, alreadyPublished } = selectSupplementStores(snapshot, ownerRows, DAISO_PLACES);
    expect(supplement.map((store) => `daisomall-official:${store.strCd}`)).toEqual(DAISO_SUPPLEMENT_PLACES.map((place) => place.id));
    expect(nonSeoul.map((store) => store.strNm)).toEqual(["롯데마트시흥배곧점"]);
    expect(alreadyPublished).toBe(DAISO_PLACES.length);
    expect(supplement.every((store) => store.directYn === "N" && store.strLttd === 0 && store.strLitd === 0)).toBe(true);

    const renamed = { ...snapshot, stores: snapshot.stores.map((store) => store.strNm === "고객사랑마트포이점" ? { ...store, strNm: "포이마트점", strAddr: DAISO_PLACES[0].address } : store) };
    const renamedOwner = ownerRows.map((row) => row.store_name === "고객사랑마트포이점" ? { ...row, store_name: "포이마트점" } : row);
    expect(() => selectSupplementStores(renamed, renamedOwner, DAISO_PLACES)).toThrow(/shares a road address/);
    expect(() => selectSupplementStores(snapshot, ownerRows.slice(1), DAISO_PLACES)).toThrow(/absent from the owner list/);
  });

  it("publishes honest Daiso records: English primary name, provisional flags, Seoul pins, valid hours", () => {
    for (const place of DAISO_SUPPLEMENT_PLACES) {
      expect(place.id, place.nameKr).toMatch(/^daisomall-official:\d{5}$/);
      expect(place.type, place.id).toBe("daiso");
      expect(place.name, place.id).toMatch(/^Daiso\b/);
      expect(place.name, place.id).not.toMatch(/[가-힣]/);
      expect(place.nameKr, place.id).toMatch(/[가-힣]/);
      expect(place.nameVerification, place.id).toBe("provisional");
      expect(place, place.id).not.toHaveProperty("rating");
      expect(place, place.id).not.toHaveProperty("ratingCount");
      expect(place, place.id).not.toHaveProperty("englishOk");
      expect(place.address, place.id).toMatch(/^서울/);
      expect(place.lat, place.id).toBeGreaterThanOrEqual(37.42);
      expect(place.lat, place.id).toBeLessThanOrEqual(37.72);
      expect(place.lng, place.id).toBeGreaterThanOrEqual(126.75);
      expect(place.lng, place.id).toBeLessThanOrEqual(127.2);
      expect(place.url, place.id).toBe("https://www.daisomall.co.kr/ms/msg/SCR_MSG_0019");
      if (place.geoSource === "area") expect(place.locationVerification, place.id).toBe("provisional");
      else expect(place.locationVerification, place.id).toBeUndefined();
      if (place.hours && "open" in place.hours) {
        expect(place.hours.open, place.id).toMatch(/^([01]\d|2[0-3]):[0-5]\d$/);
        expect(place.hours.close, place.id).toMatch(/^([01]\d|2[0-4]):[0-5]\d$/);
        expect(place.hours.open === "00:00" && place.hours.close === "24:00", place.id).toBe(false);
      }
    }
    expect(new Set(DAISO_SUPPLEMENT_PLACES.map((place) => place.id)).size).toBe(DAISO_SUPPLEMENT_PLACES.length);
  });

  it("reaches the public catalogue as Daiso with the approved stores", () => {
    const ids = new Set(DAISO_SUPPLEMENT_PLACES.map((place) => place.id));
    expect(CATALOGUE_PLACES.filter((place) => ids.has(place.id))).toHaveLength(ids.size);
    const publicSupplement = PLACES.filter((place) => ids.has(place.id));
    expect(publicSupplement).toHaveLength(ids.size);
    expect(publicSupplement.every((place) => place.source === "daiso")).toBe(true);
  });

  it("records repository-relative provenance in the generated file", () => {
    const generated = readFileSync(new URL("./generated/daiso-supplement-places.ts", import.meta.url), "utf8");
    expect(generated).toContain("// Source: data/sources/daisomall-seoul-2026-09-18.json");
    expect(generated).toContain("data/sources/daiso_seoul-owner-list-2026-09-18.csv");
    expect(generated).not.toContain("/Users/");
  });

  it("maps the store finder's hour conventions and geocoder answers conservatively", () => {
    expect(storeHours({ opngTime: "10:00", clsngTime: "22:00" } as never)).toEqual({ open: "10:00", close: "22:00" });
    expect(storeHours({ opngTime: "10:00", clsngTime: "00:00" } as never)).toEqual({ open: "10:00", close: "24:00" });
    expect(storeHours({ opngTime: "00:00", clsngTime: "00:00" } as never)).toBeUndefined();

    expect(roadKey("서울특별시 강남구 논현로10길 29 (개포동)")).toEqual(["논현로10길", "29"]);
    expect(roadKey("서울 동작구 동작대로39길 22 지하1층")).toEqual(["동작대로39길", "22"]);
    expect(addressVariants("서울특별시 송파구 동남로 189 (가락동) 140 쌍용아파트 상가")[0]).toBe("서울특별시 송파구 동남로 189");

    const query = "서울특별시 강남구 논현로10길 29";
    const exact = { lat: "37.48", lon: "127.05", display_name: "29, 논현로10길, 개포동, 강남구, 서울", address: { road: "논현로10길", house_number: "29" } };
    expect(evaluateHit(query, exact)?.precision).toBe("house");
    expect(evaluateHit(query, { ...exact, address: { road: "논현로10길" } })?.precision).toBe("road");
    expect(evaluateHit(query, { ...exact, address: { road: "논현로", house_number: "29" } })).toBeNull();
    expect(evaluateHit(query, { ...exact, lat: "35.1", lon: "129.0" })).toBeNull();
    expect(evaluateHit(query, null)).toBeNull();
  });
});
