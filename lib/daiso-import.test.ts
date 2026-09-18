import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  DAISO_OFFICIAL_SOURCE_URL,
  collectDaisoSeoul,
  makeDaisoSourceId,
  parseDaisoRegionValues,
  parseDaisoSnapshot,
  parseDaisoStoreCards,
  type DaisoSnapshotStore,
  type DaisoFetch,
} from "./daiso-import";
import { runDaisoCollector } from "../scripts/collect-daiso-seoul";
import { runDaisoBuild } from "../scripts/build-daiso-places";

describe("Daiso official-source import", () => {
  it("reads unique nonblank region values from the official JSON responses", () => {
    expect(parseDaisoRegionValues('[{"value":"강남구"},{"value":"강남구"},{"value":"종로구"},{"value":""}]')).toEqual([
      "강남구",
      "종로구",
    ]);
  });

  it("parses only official store cards and normalizes their displayed facts", () => {
    const html = `
      <div class="hero"><h3>강남구청역점</h3><p>서울특별시 성동구 성적정길 106</p></div>
      <div class="bx-store" data-lat="37.501234" data-lng="127.031234">
        <h3 class="store-name">다이소 강남역점</h3>
        <dl>
          <dt>주소</dt><dd class="address">서울특별시 강남구 강남대로 396 <span class="jibun">지번 서울 강남구 역삼동 1</span></dd>
          <dt>영업시간</dt><dd class="hours">오전 10:00 ~ 오후 10:30</dd>
        </dl>
        <ul class="store-options">
          <li>주차 가능</li><li>엘리베이터 없음</li><li>택스리펀드 가능</li><li>매장픽업 가능</li>
        </ul>
      </div>
      <footer><div class="sample-store"><h3>가짜점</h3></div></footer>`;

    expect(parseDaisoStoreCards(html, { district: "강남구", neighborhood: "역삼동", requestUrl: officialStoreRequestUrl("강남구", "역삼동") })).toEqual([
      expect.objectContaining({
        nameKr: "다이소 강남역점",
        nameEn: null,
        address: "서울특별시 강남구 강남대로 396",
        lat: 37.501234,
        lng: 127.031234,
        hours: { open: "10:00", close: "22:30" },
        facilities: ["parking"],
        serviceTags: ["tax-refund", "store-pickup"],
        naver: null,
        provenance: [{ district: "강남구", neighborhood: "역삼동", requestUrl: officialStoreRequestUrl("강남구", "역삼동") }],
      }),
    ]);
  });

  it("rejects a period-qualified hour outside the 12-hour clock", () => {
    expect(() => parseDaisoStoreCards(`
      <div class="bx-store" data-lat="37.501234" data-lng="127.031234">
        <h3>다이소 테스트점</h3><div class="address">서울 강남구 테스트로 1</div>
        <div class="hours">오전 13:00 ~ 오후 10:00</div>
      </div>
    `, { district: "강남구", neighborhood: "역삼동", requestUrl: officialStoreRequestUrl("강남구", "역삼동") })).toThrow(
      /Invalid Daiso time: 13:00/,
    );
  });

  it("applies a single Korean period marker to both times in a range", () => {
    const [store] = parseDaisoStoreCards(`
      <div class="bx-store" data-lat="37.501234" data-lng="127.031234">
        <h3>다이소 테스트점</h3><div class="address">서울 강남구 테스트로 1</div>
        <div class="hours">오후 10:00 ~ 10:30</div>
      </div>
    `, { district: "강남구", neighborhood: "역삼동", requestUrl: officialStoreRequestUrl("강남구", "역삼동") });

    expect(store.hours).toEqual({ open: "22:00", close: "22:30" });
  });

  it("ignores blank coordinate attributes and uses embedded fallback coordinates", () => {
    const [store] = parseDaisoStoreCards(`
      <div class="bx-store" data-lat="" data-lng="   " data-map-point="37.511111,127.022222">
        <h3>다이소 테스트점</h3><div class="address">서울 강남구 테스트로 1</div>
        <div class="hours">10:00 ~ 22:00</div>
      </div>
    `, { district: "강남구", neighborhood: "역삼동", requestUrl: officialStoreRequestUrl("강남구", "역삼동") });

    expect({ lat: store.lat, lng: store.lng }).toEqual({ lat: 37.511111, lng: 127.022222 });
  });

  it("reads hours from data-start/data-end when the card carries no hours text (official markup since 2026-09)", () => {
    const html = `
      <div class="bx-store" data-start="1000" data-end="2200" data-lat="37.4840224010593" data-lng="127.084459720088" data-opnday="20220714">
        <a href="#"><h4 class="place">일원역점</h4><em class="phone">T.1522-4400</em>
        <p class="addr">서울특별시 강남구 일원로 115(일원동)B1층</p>
        <ul class="opts"><li><span>주차</span></li><li><span>현금없는매장</span></li><li><span>매장픽업</span></li></ul></a>
      </div>`;

    const [store] = parseDaisoStoreCards(html, { district: "강남구", neighborhood: "일원동", requestUrl: officialStoreRequestUrl("강남구", "일원동") });
    expect(store.nameKr).toBe("일원역점");
    expect(store.address).toBe("서울특별시 강남구 일원로 115(일원동)B1층");
    expect(store.hours).toEqual({ open: "10:00", close: "22:00" });
    expect(store.facilities).toEqual(["parking"]);
    expect(store.serviceTags).toEqual(["cashless-store", "store-pickup"]);
  });

  it("rejects blank coordinate attributes when no fallback coordinates exist", () => {
    expect(() => parseDaisoStoreCards(`
      <div class="bx-store" data-lat="" data-lng="   ">
        <h3>다이소 테스트점</h3><div class="address">서울 강남구 테스트로 1</div>
        <div class="hours">10:00 ~ 22:00</div>
      </div>
    `, { district: "강남구", neighborhood: "역삼동", requestUrl: officialStoreRequestUrl("강남구", "역삼동") })).toThrow(
      /Incomplete Daiso store card/,
    );
  });

  it("withholds staging rows and publishes only rows matching all four Naver checks", () => {
    const base: DaisoSnapshotStore = {
      sourceId: "",
      nameKr: "다이소 강남역점",
      nameEn: null,
      address: "서울특별시 강남구 강남대로 396",
      lat: 37.501234,
      lng: 127.031234,
      hours: { open: "10:00", close: "22:30" },
      facilities: ["parking"],
      serviceTags: ["tax-refund"],
      officialUrl: DAISO_OFFICIAL_SOURCE_URL,
      provenance: [{ district: "강남구", neighborhood: "역삼동", requestUrl: "https://www.daiso.co.kr/cs/ajax/shop_search?name_address=&sido=서울&gugun=강남구&dong=역삼동" }],
      naver: null,
    };
    base.sourceId = makeDaisoSourceId(base);

    const staging = parseDaisoSnapshot({
      schemaVersion: 1,
      sourceUrl: DAISO_OFFICIAL_SOURCE_URL,
      retrievedAt: "2026-09-01T00:00:00.000Z",
      region: "서울",
      stores: [base],
    });
    expect(staging.published).toEqual([]);
    expect(staging.withheld[0]?.reasons).toEqual([
      "english_name_missing",
      "naver_korean_unverified",
      "naver_english_unverified",
      "address_unverified",
      "pin_unverified",
    ]);

    const verified = structuredClone(base);
    verified.nameEn = "Daiso Gangnam Station";
    verified.naver = {
      koreanIdentityMatch: true,
      englishNameMatch: true,
      addressMatch: true,
      pinMatch: true,
      evidenceUrl: "https://map.naver.com/p/search/Daiso%20Gangnam%20Station",
      reviewedAt: "2026-09-01",
    };
    const result = parseDaisoSnapshot({
      schemaVersion: 1,
      sourceUrl: DAISO_OFFICIAL_SOURCE_URL,
      retrievedAt: "2026-09-01T00:00:00.000Z",
      region: "서울",
      stores: [verified],
    });
    expect(result.withheld).toEqual([]);
    expect(result.published).toEqual([
      expect.objectContaining({
        type: "daiso",
        name: "Daiso Gangnam Station",
        priceRange: "₩",
        geoSource: "address",
        url: DAISO_OFFICIAL_SOURCE_URL,
        facilities: ["parking"],
        serviceTags: ["tax-refund"],
      }),
    ]);
    expect(result.published[0]).not.toHaveProperty("rating");
    expect(result.published[0]).not.toHaveProperty("ratingCount");
    expect(result.published[0]).not.toHaveProperty("nameVerification");

    expect(parseDaisoSnapshot(fixtureSnapshot([verified]), { mode: "strictVerified" })).toEqual(result);
  });

  it("publishes an unreviewed official row with a generated provisional English name", () => {
    const result = parseDaisoSnapshot(fixtureSnapshot([fixtureStore()]), { mode: "officialProvisional" });

    expect(result.withheld).toEqual([]);
    expect(result.published).toEqual([
      expect.objectContaining({
        name: "Daiso Gangnam Stn.",
        nameVerification: "provisional",
      }),
    ]);
    expect(result.published[0]).not.toHaveProperty("englishOk");
    expect(result.published[0]).not.toHaveProperty("rating");
    expect(result.published[0]).not.toHaveProperty("ratingCount");
  });

  it.each([
    ["Korean identity", "koreanIdentityMatch", "korean_identity_unverified"],
    ["address", "addressMatch", "address_mismatch"],
    ["pin", "pinMatch", "pin_mismatch"],
  ] as const)("withholds an official provisional row with an explicit false %s review", (_label, field, reason) => {
    const store = verifiedFixtureStore();
    store.naver![field] = false;

    const result = parseDaisoSnapshot(fixtureSnapshot([store]), { mode: "officialProvisional" });

    expect(result.published).toEqual([]);
    expect(result.withheld).toEqual([{ sourceId: store.sourceId, reasons: [reason] }]);
  });

  it("uses an English name only when Naver explicitly verifies it", () => {
    const verified = verifiedFixtureStore();
    const provisional = verifiedFixtureStore();
    provisional.nameKr = "다이소 명동본점";
    provisional.nameEn = "Unverified Official Name";
    provisional.address = "서울특별시 중구 명동길 1";
    provisional.lat = 37.563;
    provisional.lng = 126.985;
    provisional.naver!.englishNameMatch = false;
    provisional.sourceId = makeDaisoSourceId(provisional);

    const result = parseDaisoSnapshot(fixtureSnapshot([verified, provisional]), { mode: "officialProvisional" });

    expect(result.withheld).toEqual([]);
    expect(result.published.map(({ name, nameVerification }) => ({ name, nameVerification }))).toEqual([
      { name: "Daiso Gangnam Station", nameVerification: "verified" },
      { name: "Daiso Myeongdong", nameVerification: "provisional" },
    ]);
    expect(result.published.every((place) => !("englishOk" in place))).toBe(true);
  });

  it("preserves official rows sharing exact coordinates in provisional mode", () => {
    const first = fixtureStore();
    const second = fixtureStore();
    second.nameKr = "다이소 강남대로점";
    second.address = "서울특별시 강남구 강남대로 398";
    second.sourceId = makeDaisoSourceId(second);

    const result = parseDaisoSnapshot(fixtureSnapshot([first, second]), { mode: "officialProvisional" });

    expect(result.withheld).toEqual([]);
    expect(result.published.map((place) => place.id)).toEqual([first.sourceId, second.sourceId]);
  });

  it("rejects malformed partial Naver reviews", () => {
    const store = parseDaisoStoreCards(`
      <div class="bx-store" data-lat="37.50" data-lng="127.03"><h3>다이소 테스트점</h3>
      <div class="address">서울 강남구 테스트로 1</div><div class="hours">10:00 ~ 22:00</div></div>
    `, { district: "강남구", neighborhood: "역삼동", requestUrl: "https://www.daiso.co.kr/cs/ajax/shop_search?name_address=&sido=서울&gugun=강남구&dong=역삼동" })[0];
    expect(() => parseDaisoSnapshot({
      schemaVersion: 1,
      sourceUrl: DAISO_OFFICIAL_SOURCE_URL,
      retrievedAt: "2026-09-01T00:00:00.000Z",
      region: "서울",
      stores: [{ ...store, naver: { koreanIdentityMatch: true } }],
    })).toThrow(/naver/i);
  });

  it("rejects impossible calendar dates in retrieval and review timestamps", () => {
    expect(() => parseDaisoSnapshot({
      ...fixtureSnapshot([fixtureStore()]),
      retrievedAt: "2026-02-30T00:00:00.000Z",
    })).toThrow(/retrievedAt/);

    const reviewed = verifiedFixtureStore();
    reviewed.naver!.reviewedAt = "2026-02-30";
    expect(() => parseDaisoSnapshot(fixtureSnapshot([reviewed]))).toThrow(/reviewedAt/);
  });

  it("rejects duplicate source IDs", () => {
    const store = fixtureStore();

    expect(() => parseDaisoSnapshot(fixtureSnapshot([store, structuredClone(store)]))).toThrow(
      `Duplicate Daiso sourceId: ${store.sourceId}`,
    );
  });

  it("withholds every otherwise verified store sharing exact coordinates", () => {
    const first = verifiedFixtureStore();
    const second = verifiedFixtureStore();
    second.nameKr = "다이소 강남대로점";
    second.nameEn = "Daiso Gangnam-daero";
    second.address = "서울특별시 강남구 강남대로 398";
    second.sourceId = makeDaisoSourceId(second);

    const result = parseDaisoSnapshot(fixtureSnapshot([first, second]));

    expect(result.published).toEqual([]);
    expect(result.withheld).toEqual([
      { sourceId: first.sourceId, reasons: ["duplicate_coordinates"] },
      { sourceId: second.sourceId, reasons: ["duplicate_coordinates"] },
    ]);
  });

  it.each([
    ["a non-Seoul address", { address: "경기도 성남시 분당구 판교역로 1" }, /address must be in Seoul/],
    ["latitude outside Seoul", { lat: 37.8 }, /lat is outside Seoul bounds/],
    ["longitude outside Seoul", { lng: 127.3 }, /lng is outside Seoul bounds/],
  ])("rejects %s", (_label, override, expectedError) => {
    expect(() => parseDaisoSnapshot(fixtureSnapshot([{ ...fixtureStore(), ...override }]))).toThrow(expectedError);
  });

  it.each([
    ["a non-HTTPS URL", "http://www.daiso.co.kr/cs/ajax/shop_search?name_address=&sido=서울&gugun=강남구&dong=역삼동"],
    ["a different origin", "https://daiso.co.kr/cs/ajax/shop_search?name_address=&sido=서울&gugun=강남구&dong=역삼동"],
    ["a different path", "https://www.daiso.co.kr/cs/ajax/other?name_address=&sido=서울&gugun=강남구&dong=역삼동"],
    ["missing name_address", "https://www.daiso.co.kr/cs/ajax/shop_search?sido=서울&gugun=강남구&dong=역삼동"],
    ["a nonempty name_address", "https://www.daiso.co.kr/cs/ajax/shop_search?name_address=강남&sido=서울&gugun=강남구&dong=역삼동"],
    ["missing sido", "https://www.daiso.co.kr/cs/ajax/shop_search?name_address=&gugun=강남구&dong=역삼동"],
    ["a non-Seoul sido", "https://www.daiso.co.kr/cs/ajax/shop_search?name_address=&sido=부산&gugun=강남구&dong=역삼동"],
    ["a mismatched gugun", "https://www.daiso.co.kr/cs/ajax/shop_search?name_address=&sido=서울&gugun=종로구&dong=역삼동"],
    ["a mismatched dong", "https://www.daiso.co.kr/cs/ajax/shop_search?name_address=&sido=서울&gugun=강남구&dong=삼성동"],
    ["an extra query key", "https://www.daiso.co.kr/cs/ajax/shop_search?name_address=&sido=서울&gugun=강남구&dong=역삼동&extra=1"],
  ])("rejects provenance with %s", (_label, requestUrl) => {
    const store = fixtureStore();
    store.provenance[0].requestUrl = requestUrl;

    expect(() => parseDaisoSnapshot(fixtureSnapshot([store]))).toThrow(/provenance\.requestUrl/);
  });

  it("collects every official neighborhood and deduplicates boundary stores with provenance", async () => {
    const requested: string[] = [];
    const card = `<div class="bx-store" data-lat="37.501234" data-lng="127.031234">
      <h3>다이소 강남역점</h3><div class="address">서울 강남구 강남대로 396</div>
      <div class="hours">10:00 ~ 22:30</div></div>`;
    const fetchImpl = async (input: string | URL) => {
      const url = String(input);
      requested.push(url);
      if (url.includes("/sido_search")) return response('[{"value":"종로구"},{"value":"강남구"}]');
      if (url.includes("/gugun_search")) {
        return new URL(url).searchParams.get("gugun") === "강남구"
          ? response('[{"value":"역삼1동"},{"value":"역삼2동"}]')
          : response('[{"value":"청운동"},{"value":"사직동"}]');
      }
      if (url.includes("/shop_search")) return response(card);
      return response("not found", false, 404);
    };

    const snapshot = await collectDaisoSeoul({ fetchImpl, retrievedAt: "2026-09-01T00:00:00.000Z" });
    const storeRequests = requested.filter((url) => url.includes("/shop_search")).map((url) => {
      const params = new URL(url).searchParams;
      return `${params.get("gugun")}/${params.get("dong")}`;
    });
    expect(storeRequests).toEqual(["강남구/역삼1동", "강남구/역삼2동", "종로구/사직동", "종로구/청운동"]);
    expect(snapshot.stores).toHaveLength(1);
    expect(snapshot.stores[0].provenance.map((item) => `${item.district}/${item.neighborhood}`)).toEqual(storeRequests);
    expect(snapshot.stores[0].nameEn).toBeNull();
    expect(snapshot.stores[0].naver).toBeNull();
  });

  it("aborts and rejects a request that exceeds the configured timeout", async () => {
    let signal: AbortSignal | undefined;
    const fetchImpl: DaisoFetch = (_input, init) => {
      signal = init?.signal;
      return new Promise(() => undefined);
    };

    await expect(collectDaisoSeoul({ fetchImpl, timeoutMs: 5 })).rejects.toThrow(/timed out after 5ms/);
    expect(signal?.aborted).toBe(true);
  });

  it("aborts and rejects when reading a successful response body exceeds the timeout", async () => {
    let signal: AbortSignal | undefined;
    const fetchImpl: DaisoFetch = async (_input, init) => {
      signal = init?.signal;
      return {
        ok: true,
        status: 200,
        text: () => new Promise<string>(() => undefined),
      };
    };

    await expect(collectDaisoSeoul({ fetchImpl, timeoutMs: 5 })).rejects.toThrow(/timed out after 5ms/);
    expect(signal?.aborted).toBe(true);
  }, 200);

  it.each(["district", "neighborhood", "store"] as const)(
    "keeps the last-good snapshot when the %s request fails",
    async (failurePoint) => {
      const directory = await mkdtemp(join(tmpdir(), "daiso-collector-test-"));
      const outputPath = join(directory, "daiso-seoul.json");
      const lastGood = '{"lastGood":true}\n';
      await writeFile(outputPath, lastGood, "utf8");
      const fetchImpl = async (input: string | URL) => {
        const url = String(input);
        if (url.includes("/sido_search")) {
          return failurePoint === "district" ? response("unavailable", false, 503) : response('[{"value":"강남구"}]');
        }
        if (url.includes("/gugun_search")) {
          return failurePoint === "neighborhood" ? response("unavailable", false, 503) : response('[{"value":"역삼동"}]');
        }
        if (url.includes("/shop_search")) {
          return failurePoint === "store" ? response("unavailable", false, 503) : response(officialStoreCard());
        }
        return response("not found", false, 404);
      };

      try {
        await expect(runDaisoCollector({ fetchImpl, outputPath })).rejects.toThrow(
          /Daiso request failed \(503\)/,
        );
        expect(await readFile(outputPath, "utf8")).toBe(lastGood);
      } finally {
        await rm(directory, { recursive: true, force: true });
      }
    },
  );

  it("keeps the last-good snapshot when a complete traversal finds no store cards", async () => {
    const directory = await mkdtemp(join(tmpdir(), "daiso-collector-test-"));
    const outputPath = join(directory, "daiso-seoul.json");
    const lastGood = '{"lastGood":true}\n';
    await writeFile(outputPath, lastGood, "utf8");
    const fetchImpl = async (input: string | URL) => {
      const url = String(input);
      if (url.includes("/sido_search")) return response('[{"value":"강남구"}]');
      if (url.includes("/gugun_search")) return response('[{"value":"역삼동"}]');
      if (url.includes("/shop_search")) return response("<main>No matching stores</main>");
      return response("not found", false, 404);
    };

    try {
      await expect(runDaisoCollector({ fetchImpl, outputPath })).rejects.toThrow(
        /no unique Seoul stores/i,
      );
      expect(await readFile(outputPath, "utf8")).toBe(lastGood);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("keeps the last-good candidate and approved source when collection returns a valid partial result", async () => {
    const directory = await mkdtemp(join(tmpdir(), "daiso-collector-test-"));
    const outputPath = join(directory, "daiso-seoul.json");
    const lastGood = '{"lastGood":true}\n';
    const approvedSourceUrl = new URL("../data/sources/daiso-seoul-2026-09-03.json", import.meta.url);
    const approvedSource = await readFile(approvedSourceUrl, "utf8");
    await writeFile(outputPath, lastGood, "utf8");
    const fetchImpl = async (input: string | URL) => {
      const url = String(input);
      if (url.includes("/sido_search")) return response('[{"value":"강남구"}]');
      if (url.includes("/gugun_search")) return response('[{"value":"역삼동"}]');
      if (url.includes("/shop_search")) return response(officialStoreCard());
      return response("not found", false, 404);
    };

    try {
      await expect(runDaisoCollector({ fetchImpl, outputPath })).rejects.toThrow(
        "Expected exactly 251 collected Daiso stores, received 1",
      );
      expect(await readFile(outputPath, "utf8")).toBe(lastGood);
      expect(await readFile(approvedSourceUrl, "utf8")).toBe(approvedSource);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it.each([
    ["blank coordinate capture", "", "   ", /Incomplete Daiso store card/],
    ["coordinates fail strict validation", 35, 129, /outside Seoul bounds/],
  ])("keeps the last-good snapshot when collected %s", async (_label, lat, lng, expectedError) => {
    const directory = await mkdtemp(join(tmpdir(), "daiso-collector-test-"));
    const outputPath = join(directory, "daiso-seoul.json");
    const lastGood = '{"lastGood":true}\n';
    await writeFile(outputPath, lastGood, "utf8");
    const fetchImpl = async (input: string | URL) => {
      const url = String(input);
      if (url.includes("/sido_search")) return response('[{"value":"강남구"}]');
      if (url.includes("/gugun_search")) return response('[{"value":"역삼동"}]');
      if (url.includes("/shop_search")) return response(officialStoreCard(lat, lng));
      return response("not found", false, 404);
    };

    try {
      await expect(runDaisoCollector({ fetchImpl, outputPath })).rejects.toThrow(expectedError);
      expect(await readFile(outputPath, "utf8")).toBe(lastGood);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("does not create generated output when the source snapshot is missing", async () => {
    const directory = await mkdtemp(join(tmpdir(), "daiso-build-test-"));
    const inputPath = join(directory, "missing-snapshot.json");
    const outputPath = join(directory, "generated.ts");

    try {
      await expect(runDaisoBuild({ inputPath, outputPath })).rejects.toThrow(
        `Missing approved Daiso source snapshot: ${inputPath}. Run npm run collect:daiso-data to create ` +
        "data/candidates/daiso-seoul-candidate.json, then review, approve, and explicitly stage that candidate at " +
        "data/sources/daiso-seoul-2026-09-03.json.",
      );
      await expect(readFile(outputPath, "utf8")).rejects.toMatchObject({ code: "ENOENT" });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("keeps the last-good generated output unless exactly 251 official stores publish", async () => {
    const directory = await mkdtemp(join(tmpdir(), "daiso-build-test-"));
    const inputPath = join(directory, "snapshot.json");
    const outputPath = join(directory, "generated.ts");
    const lastGood = "// last-good generated Daiso places\n";
    const publishedStore = verifiedFixtureStore();
    const withheldStore = fixtureStore();
    withheldStore.nameKr = "다이소 종로점";
    withheldStore.address = "서울특별시 종로구 종로 1";
    withheldStore.lat = 37.570377;
    withheldStore.lng = 126.981641;
    withheldStore.sourceId = makeDaisoSourceId(withheldStore);
    const snapshot = fixtureSnapshot([publishedStore, withheldStore]);
    snapshot.retrievedAt = "2026-09-03T11:33:15.554Z";
    await writeFile(inputPath, JSON.stringify(snapshot), "utf8");
    await writeFile(outputPath, lastGood, "utf8");

    try {
      await expect(runDaisoBuild({ inputPath, outputPath })).rejects.toThrow(
        "Expected exactly 251 published Daiso stores, received 2",
      );
      expect(await readFile(outputPath, "utf8")).toBe(lastGood);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("rejects a valid 251-store snapshot whose approved bytes were modified", async () => {
    const directory = await mkdtemp(join(tmpdir(), "daiso-build-test-"));
    const inputPath = join(directory, "modified-snapshot.json");
    const outputPath = join(directory, "generated.ts");
    const lastGood = "// last-good generated Daiso places\n";
    const snapshot = JSON.parse(
      await readFile(new URL("../data/sources/daiso-seoul-2026-09-03.json", import.meta.url), "utf8"),
    ) as { stores: Array<{ hours: { open: string } }> };
    snapshot.stores[0].hours.open = "09:59";
    await writeFile(inputPath, JSON.stringify(snapshot), "utf8");
    await writeFile(outputPath, lastGood, "utf8");

    try {
      await expect(runDaisoBuild({ inputPath, outputPath })).rejects.toThrow(
        /approved SHA-256 76fc704197fb2d3496fac76bfa073c353595c9eab12ef4079e3e46a989a7660f/,
      );
      expect(await readFile(outputPath, "utf8")).toBe(lastGood);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("rejects a 251-store snapshot with an unapproved retrieval timestamp", async () => {
    const directory = await mkdtemp(join(tmpdir(), "daiso-build-test-"));
    const inputPath = join(directory, "wrong-timestamp-snapshot.json");
    const outputPath = join(directory, "generated.ts");
    const snapshot = JSON.parse(
      await readFile(new URL("../data/sources/daiso-seoul-2026-09-03.json", import.meta.url), "utf8"),
    ) as { retrievedAt: string };
    snapshot.retrievedAt = "2026-09-03T11:33:15.555Z";
    await writeFile(inputPath, JSON.stringify(snapshot), "utf8");

    try {
      await expect(runDaisoBuild({ inputPath, outputPath })).rejects.toThrow(
        "Daiso source snapshot retrievedAt must be 2026-09-03T11:33:15.554Z; received 2026-09-03T11:33:15.555Z",
      );
      await expect(readFile(outputPath, "utf8")).rejects.toMatchObject({ code: "ENOENT" });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});

function response(body: string, ok = true, status = 200) {
  return { ok, status, text: async () => body };
}

function officialStoreCard(lat: number | string = 37.501234, lng: number | string = 127.031234) {
  return `<div class="bx-store" data-lat="${lat}" data-lng="${lng}">
    <h3>다이소 강남역점</h3><div class="address">서울 강남구 강남대로 396</div>
    <div class="hours">10:00 ~ 22:30</div></div>`;
}

function fixtureStore(): DaisoSnapshotStore {
  const store: DaisoSnapshotStore = {
    sourceId: "",
    nameKr: "다이소 강남역점",
    nameEn: null,
    address: "서울특별시 강남구 강남대로 396",
    lat: 37.501234,
    lng: 127.031234,
    hours: { open: "10:00", close: "22:30" },
    facilities: ["parking"],
    serviceTags: ["tax-refund"],
    officialUrl: DAISO_OFFICIAL_SOURCE_URL,
    provenance: [{ district: "강남구", neighborhood: "역삼동", requestUrl: officialStoreRequestUrl("강남구", "역삼동") }],
    naver: null,
  };
  store.sourceId = makeDaisoSourceId(store);
  return store;
}

function verifiedFixtureStore(): DaisoSnapshotStore {
  const store = fixtureStore();
  store.nameEn = "Daiso Gangnam Station";
  store.naver = {
    koreanIdentityMatch: true,
    englishNameMatch: true,
    addressMatch: true,
    pinMatch: true,
    evidenceUrl: "https://map.naver.com/p/search/Daiso%20Gangnam%20Station",
    reviewedAt: "2026-09-01",
  };
  return store;
}

function fixtureSnapshot(stores: DaisoSnapshotStore[]) {
  return {
    schemaVersion: 1,
    sourceUrl: DAISO_OFFICIAL_SOURCE_URL,
    retrievedAt: "2026-09-01T00:00:00.000Z",
    region: "서울",
    stores,
  };
}

function officialStoreRequestUrl(district: string, neighborhood: string): string {
  const url = new URL("https://www.daiso.co.kr/cs/ajax/shop_search");
  url.searchParams.set("name_address", "");
  url.searchParams.set("sido", "서울");
  url.searchParams.set("gugun", district);
  url.searchParams.set("dong", neighborhood);
  return url.toString();
}
