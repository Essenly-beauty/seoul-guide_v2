import { load } from "cheerio";
import type { Place, ZoneKey } from "./data";
import { englishizeDaisoName } from "./english-place-name";

export const DAISO_OFFICIAL_SOURCE_URL = "https://www.daiso.co.kr/cs/shop" as const;
export const DAISO_OFFICIAL_ORIGIN = "https://www.daiso.co.kr" as const;
export const DAISO_REGION = "서울" as const;

export type DaisoProvenance = {
  district: string;
  neighborhood: string;
  requestUrl: string;
};

export type DaisoNaverVerification = {
  koreanIdentityMatch: boolean;
  englishNameMatch: boolean;
  addressMatch: boolean;
  pinMatch: boolean;
  evidenceUrl: string;
  reviewedAt: string;
};

export type DaisoSnapshotStore = {
  sourceId: string;
  nameKr: string;
  nameEn: string | null;
  address: string;
  lat: number;
  lng: number;
  hours: { open: string; close: string };
  facilities: string[];
  serviceTags: string[];
  officialUrl: typeof DAISO_OFFICIAL_SOURCE_URL;
  provenance: DaisoProvenance[];
  naver: DaisoNaverVerification | null;
};

export type DaisoSnapshot = {
  schemaVersion: 1;
  sourceUrl: typeof DAISO_OFFICIAL_SOURCE_URL;
  retrievedAt: string;
  region: typeof DAISO_REGION;
  stores: DaisoSnapshotStore[];
};

export type DaisoWithheldReason =
  | "english_name_missing"
  | "naver_korean_unverified"
  | "naver_english_unverified"
  | "address_unverified"
  | "pin_unverified"
  | "duplicate_coordinates"
  | "korean_identity_unverified"
  | "address_mismatch"
  | "pin_mismatch";

export type DaisoPublicationMode = "strictVerified" | "officialProvisional";

export type DaisoPlace = Place & {
  facilities: string[];
};

export type DaisoImportResult = {
  published: DaisoPlace[];
  withheld: { sourceId: string; reasons: DaisoWithheldReason[] }[];
};

export type DaisoFetch = (input: string | URL, init?: { signal?: AbortSignal }) => Promise<{
  ok: boolean;
  status: number;
  text(): Promise<string>;
}>;

const FACILITY_LABELS = new Map([
  ["주차", "parking"],
  ["출입구 경사로", "entrance-ramp"],
  ["엘리베이터", "elevator"],
]);

const SERVICE_LABELS = new Map([
  ["현금없는매장", "cashless-store"],
  ["포토 스티커", "photo-sticker"],
  ["네임 스티커", "name-sticker"],
  ["심카드", "sim-card"],
  ["택스리펀드", "tax-refund"],
  ["단체주문", "group-order"],
  ["매장픽업", "store-pickup"],
]);

function normalizeText(value: string): string {
  return value.normalize("NFKC").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function normalizeIdentity(value: string): string {
  return normalizeText(value).toLocaleLowerCase("ko-KR");
}

export function makeDaisoSourceId(store: Pick<DaisoSnapshotStore, "nameKr" | "address" | "lat" | "lng">): string {
  const parts = [normalizeIdentity(store.nameKr), normalizeIdentity(store.address), store.lat.toFixed(6), store.lng.toFixed(6)];
  return `daiso-official:${parts.map(encodeURIComponent).join(":")}`;
}

export function parseDaisoRegionValues(body: string): string[] {
  const parsed: unknown = JSON.parse(body);
  if (!Array.isArray(parsed)) {
    throw new Error("Daiso region response must be an array");
  }

  const values = parsed.map((entry, index) => {
    if (typeof entry !== "object" || entry === null || typeof (entry as { value?: unknown }).value !== "string") {
      throw new Error(`Daiso region response item ${index} is missing value`);
    }
    return (entry as { value: string }).value.trim();
  });

  return [...new Set(values.filter(Boolean))];
}

function parseKoreanTime(raw: string, period: string | undefined): string {
  const [hoursText, minutesText] = raw.split(":");
  let hours = Number(hoursText);
  const minutes = Number(minutesText);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || minutes < 0 || minutes > 59) {
    throw new Error(`Invalid Daiso time: ${raw}`);
  }
  if (period && (hours < 1 || hours > 12)) throw new Error(`Invalid Daiso time: ${raw}`);
  if (period === "오후" && hours < 12) hours += 12;
  if (period === "오전" && hours === 12) hours = 0;
  if (hours < 0 || hours > 24 || (hours === 24 && minutes !== 0)) {
    throw new Error(`Invalid Daiso time: ${raw}`);
  }
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function parseHours(value: string): { open: string; close: string } {
  const match = normalizeText(value).match(/(?:(오전|오후)\s*)?(\d{1,2}:\d{2})\s*(?:~|–|—|-)\s*(?:(오전|오후)\s*)?(\d{1,2}:\d{2})/);
  if (!match) throw new Error(`Invalid Daiso hours: ${value}`);
  const openPeriod = match[1] ?? match[3];
  const closePeriod = match[3] ?? match[1];
  return { open: parseKoreanTime(match[2], openPeriod), close: parseKoreanTime(match[4], closePeriod) };
}

function availableLabels(text: string, labels: ReadonlyMap<string, string>, items: readonly string[] = []): string[] {
  const normalized = normalizeText(text);
  // Older cards spell out "주차 가능"; since 2026-09 the official card lists bare
  // labels ("<li><span>주차</span></li>") and simply omits what a store lacks.
  const bare = new Set(items.map(normalizeText));
  return [...labels]
    .filter(([label]) => bare.has(label) || new RegExp(`${label}\\s*(?:가능|제공|운영)`).test(normalized))
    .map(([, value]) => value);
}

function coordinateFromAttributes(
  attributes: Record<string, string | null | undefined>[],
  names: readonly string[],
): number | undefined {
  for (const attrs of attributes) {
    for (const name of names) {
      const raw = attrs[name];
      if (raw == null || !raw.trim()) continue;
      const candidate = Number(raw);
      if (Number.isFinite(candidate)) return candidate;
    }
  }
  return undefined;
}

export function parseDaisoStoreCards(html: string, provenance: DaisoProvenance): DaisoSnapshotStore[] {
  const $ = load(html);
  return $("div.bx-store").toArray().map((element, cardIndex) => {
    const card = $(element);
    const nameKr = normalizeText(card.find(".store-name, .name, h3, h4, strong").first().text());

    const addressNode = card.find(".address, .addr").first().clone();
    addressNode.find(".jibun, .addr-old, .old-address").remove();
    let address = normalizeText(addressNode.text());
    if (!address) {
      const label = card.find("dt, th, span, strong").filter((_, node) => normalizeText($(node).text()) === "주소").first();
      const value = label.is("dt, th") ? label.next() : label.parent().next();
      address = normalizeText(value.clone().find(".jibun, .addr-old, .old-address").remove().end().text());
    }
    address = normalizeText(address.replace(/\s*지번\s+서울(?:특별시)?\s.*$/, ""));

    let hoursText = normalizeText(card.find(".hours, .business-hours, .store-hours").first().text());
    if (!hoursText) {
      const label = card.find("dt, th, span, strong").filter((_, node) => normalizeText($(node).text()) === "영업시간").first();
      hoursText = normalizeText((label.is("dt, th") ? label.next() : label.parent().next()).text());
    }
    if (!hoursText) {
      // Since 2026-09 the official card carries hours only as data-start="1000" data-end="2200".
      const start = card.attr("data-start")?.trim();
      const end = card.attr("data-end")?.trim();
      if (start && end && /^\d{3,4}$/.test(start) && /^\d{3,4}$/.test(end)) {
        const clock = (value: string) => `${value.slice(0, -2).padStart(2, "0")}:${value.slice(-2)}`;
        hoursText = `${clock(start)} ~ ${clock(end)}`;
      }
    }

    const attributeSets = card.find("*").addBack().toArray().map((node) => "attribs" in node ? node.attribs : {});
    let lat = coordinateFromAttributes(attributeSets, ["data-lat", "data-latitude", "data-y", "lat", "latitude"]);
    let lng = coordinateFromAttributes(attributeSets, ["data-lng", "data-longitude", "data-x", "lng", "longitude"]);
    if (lat === undefined || lng === undefined) {
      const numeric = $.html(card).match(/(?:12[6-7]\.\d+|37\.\d+)/g)?.map(Number) ?? [];
      lat ??= numeric.find((value) => value >= 37 && value < 38);
      lng ??= numeric.find((value) => value >= 126 && value < 128);
    }
    if (!nameKr || !address || lat === undefined || lng === undefined || !hoursText) {
      throw new Error(`Incomplete Daiso store card ${cardIndex + 1}`);
    }

    const optionText = card.find(".store-options, .options, .facility, .facilities, .service, .services").text() || card.text();
    const optionItems = card.find(".opts li, .store-options li, .options li").toArray().map((node) => $(node).text());
    const store: DaisoSnapshotStore = {
      sourceId: "",
      nameKr,
      nameEn: null,
      address,
      lat,
      lng,
      hours: parseHours(hoursText),
      facilities: availableLabels(optionText, FACILITY_LABELS, optionItems),
      serviceTags: availableLabels(optionText, SERVICE_LABELS, optionItems),
      officialUrl: DAISO_OFFICIAL_SOURCE_URL,
      provenance: [provenance],
      naver: null,
    };
    store.sourceId = makeDaisoSourceId(store);
    return store;
  });
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error(`${label} must be an object`);
  return value as Record<string, unknown>;
}

function requiredString(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} must be a nonblank string`);
  return value.trim();
}

function stringList(value: unknown, label: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || !item.trim())) {
    throw new Error(`${label} must be an array of nonblank strings`);
  }
  return [...new Set(value.map((item) => (item as string).trim()))];
}

function validIso(value: string): boolean {
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const utcTimestamp = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value);
  if (!dateOnly && !utcTimestamp) return false;
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return false;
  const canonical = parsed.toISOString();
  if (dateOnly) return canonical.slice(0, 10) === value;
  return value.includes(".") ? canonical === value : canonical.replace(".000Z", "Z") === value;
}

function validClock(value: string, allow24: boolean): boolean {
  const match = value.match(/^(\d{2}):(\d{2})$/);
  if (!match) return false;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return minutes <= 59 && (hours <= 23 || (allow24 && hours === 24 && minutes === 0));
}

function validateProvenanceRequestUrl(requestUrl: string, district: string, neighborhood: string, label: string): void {
  let url: URL;
  try {
    url = new URL(requestUrl);
  } catch {
    throw new Error(`${label} must be an official Daiso store request URL`);
  }
  const expectedParams = new Map([
    ["name_address", ""],
    ["sido", DAISO_REGION],
    ["gugun", district],
    ["dong", neighborhood],
  ]);
  const hasExpectedParams = [...expectedParams].every(
    ([name, expected]) => url.searchParams.getAll(name).length === 1 && url.searchParams.get(name) === expected,
  );
  const hasExactlyExpectedParams = hasExpectedParams && [...url.searchParams].length === expectedParams.size;
  if (url.origin !== DAISO_OFFICIAL_ORIGIN || url.pathname !== "/cs/ajax/shop_search" || !hasExactlyExpectedParams) {
    throw new Error(`${label} must match its official Daiso district and neighborhood request`);
  }
}

export function zoneForAddress(address: string): ZoneKey {
  if (/강남구/.test(address)) {
    if (/압구정/.test(address)) return "apgujeong";
    if (/청담/.test(address)) return "cheongdam";
    if (/신사|논현/.test(address)) return "sinsa";
    if (/삼성|대치/.test(address)) return "samsung";
    return "gangnam_station";
  }
  if (/마포구/.test(address)) return "hongdae";
  if (/중구/.test(address)) return "myeongdong";
  if (/성동구/.test(address)) return "seongsu";
  if (/종로구/.test(address)) return "jongno";
  if (/용산구/.test(address)) {
    if (/한남/.test(address)) return "hannam";
    if (/이태원/.test(address)) return "itaewon";
  }
  if (/송파구/.test(address)) return "jamsil";
  if (/영등포구/.test(address)) return "yeongdeungpo";
  return "seoul_etc";
}

function parseNaver(value: unknown, sourceId: string): DaisoNaverVerification | null {
  if (value === null) return null;
  const input = record(value, `${sourceId}.naver`);
  for (const field of ["koreanIdentityMatch", "englishNameMatch", "addressMatch", "pinMatch"] as const) {
    if (typeof input[field] !== "boolean") throw new Error(`${sourceId}.naver.${field} must be boolean`);
  }
  const evidenceUrl = requiredString(input.evidenceUrl, `${sourceId}.naver.evidenceUrl`);
  let evidence: URL;
  try {
    evidence = new URL(evidenceUrl);
  } catch {
    throw new Error(`${sourceId}.naver.evidenceUrl must be a URL`);
  }
  if (evidence.protocol !== "https:" || !/(^|\.)naver\.com$|(^|\.)naver\.me$/.test(evidence.hostname)) {
    throw new Error(`${sourceId}.naver.evidenceUrl must be Naver evidence`);
  }
  const reviewedAt = requiredString(input.reviewedAt, `${sourceId}.naver.reviewedAt`);
  if (!validIso(reviewedAt)) throw new Error(`${sourceId}.naver.reviewedAt must be ISO date or datetime`);
  return {
    koreanIdentityMatch: input.koreanIdentityMatch as boolean,
    englishNameMatch: input.englishNameMatch as boolean,
    addressMatch: input.addressMatch as boolean,
    pinMatch: input.pinMatch as boolean,
    evidenceUrl,
    reviewedAt,
  };
}

function parseSnapshotStore(value: unknown, index: number): DaisoSnapshotStore {
  const input = record(value, `stores[${index}]`);
  const sourceId = requiredString(input.sourceId, `stores[${index}].sourceId`);
  const nameKr = requiredString(input.nameKr, `${sourceId}.nameKr`);
  const nameEn = input.nameEn === null ? null : requiredString(input.nameEn, `${sourceId}.nameEn`);
  const address = requiredString(input.address, `${sourceId}.address`);
  if (!/^서울(?:특별시)?\s/.test(address)) throw new Error(`${sourceId}.address must be in Seoul`);
  const lat = input.lat;
  const lng = input.lng;
  if (typeof lat !== "number" || !Number.isFinite(lat) || lat < 37.4 || lat > 37.72) throw new Error(`${sourceId}.lat is outside Seoul bounds`);
  if (typeof lng !== "number" || !Number.isFinite(lng) || lng < 126.76 || lng > 127.19) throw new Error(`${sourceId}.lng is outside Seoul bounds`);
  const hoursInput = record(input.hours, `${sourceId}.hours`);
  const open = requiredString(hoursInput.open, `${sourceId}.hours.open`);
  const close = requiredString(hoursInput.close, `${sourceId}.hours.close`);
  if (!validClock(open, false) || !validClock(close, true)) throw new Error(`${sourceId}.hours must use HH:MM`);
  if (input.officialUrl !== DAISO_OFFICIAL_SOURCE_URL) throw new Error(`${sourceId}.officialUrl must be ${DAISO_OFFICIAL_SOURCE_URL}`);
  if (!Array.isArray(input.provenance) || input.provenance.length === 0) throw new Error(`${sourceId}.provenance must not be empty`);
  const provenance = input.provenance.map((item, provenanceIndex) => {
    const entry = record(item, `${sourceId}.provenance[${provenanceIndex}]`);
    const district = requiredString(entry.district, `${sourceId}.provenance.district`);
    const neighborhood = requiredString(entry.neighborhood, `${sourceId}.provenance.neighborhood`);
    const requestUrlLabel = `${sourceId}.provenance.requestUrl`;
    const requestUrl = requiredString(entry.requestUrl, requestUrlLabel);
    validateProvenanceRequestUrl(requestUrl, district, neighborhood, requestUrlLabel);
    return { district, neighborhood, requestUrl };
  });
  const store: DaisoSnapshotStore = {
    sourceId,
    nameKr,
    nameEn,
    address,
    lat,
    lng,
    hours: { open, close },
    facilities: stringList(input.facilities, `${sourceId}.facilities`),
    serviceTags: stringList(input.serviceTags, `${sourceId}.serviceTags`),
    officialUrl: DAISO_OFFICIAL_SOURCE_URL,
    provenance,
    naver: parseNaver(input.naver, sourceId),
  };
  if (sourceId !== makeDaisoSourceId(store)) throw new Error(`${sourceId}.sourceId is not the normalized composite identity`);
  return store;
}

export function parseDaisoSnapshot(
  value: unknown,
  options: { mode?: DaisoPublicationMode } = {},
): DaisoImportResult {
  const mode = options.mode ?? "strictVerified";
  const input = record(value, "Daiso snapshot");
  if (input.schemaVersion !== 1) throw new Error("Daiso snapshot schemaVersion must be 1");
  if (input.sourceUrl !== DAISO_OFFICIAL_SOURCE_URL) throw new Error(`Daiso sourceUrl must be ${DAISO_OFFICIAL_SOURCE_URL}`);
  const retrievedAt = requiredString(input.retrievedAt, "Daiso retrievedAt");
  if (!/^\d{4}-\d{2}-\d{2}T/.test(retrievedAt) || !validIso(retrievedAt)) throw new Error("Daiso retrievedAt must be an ISO datetime");
  if (input.region !== DAISO_REGION) throw new Error(`Daiso region must be ${DAISO_REGION}`);
  if (!Array.isArray(input.stores)) throw new Error("Daiso stores must be an array");

  const stores = input.stores.map(parseSnapshotStore);
  const seen = new Set<string>();
  for (const store of stores) {
    if (seen.has(store.sourceId)) throw new Error(`Duplicate Daiso sourceId: ${store.sourceId}`);
    seen.add(store.sourceId);
  }
  const coordinateCounts = new Map<string, number>();
  for (const store of stores) {
    const key = `${store.lat},${store.lng}`;
    coordinateCounts.set(key, (coordinateCounts.get(key) ?? 0) + 1);
  }

  const result: DaisoImportResult = { published: [], withheld: [] };
  for (const store of stores) {
    const reasons: DaisoWithheldReason[] = [];
    if (mode === "officialProvisional") {
      if (store.naver?.koreanIdentityMatch === false) reasons.push("korean_identity_unverified");
      if (store.naver?.addressMatch === false) reasons.push("address_mismatch");
      if (store.naver?.pinMatch === false) reasons.push("pin_mismatch");
    } else {
      if ((coordinateCounts.get(`${store.lat},${store.lng}`) ?? 0) > 1) reasons.push("duplicate_coordinates");
      if (!store.nameEn) reasons.push("english_name_missing");
      if (!store.naver) {
        reasons.push("naver_korean_unverified", "naver_english_unverified", "address_unverified", "pin_unverified");
      } else {
        if (!store.naver.koreanIdentityMatch) reasons.push("korean_identity_unverified");
        if (!store.naver.englishNameMatch) reasons.push("naver_english_unverified");
        if (!store.naver.addressMatch) reasons.push("address_mismatch");
        if (!store.naver.pinMatch) reasons.push("pin_mismatch");
      }
    }
    if (reasons.length) {
      result.withheld.push({ sourceId: store.sourceId, reasons });
      continue;
    }
    const verifiedOfficialName = mode === "officialProvisional"
      && store.nameEn !== null
      && store.naver?.englishNameMatch === true;
    result.published.push({
      id: store.sourceId,
      name: mode === "officialProvisional"
        ? verifiedOfficialName ? store.nameEn! : englishizeDaisoName(store.nameKr)
        : store.nameEn!,
      nameKr: store.nameKr,
      type: "daiso",
      zone: zoneForAddress(store.address),
      priceRange: "₩",
      tags: [...store.serviceTags],
      address: store.address,
      lat: store.lat,
      lng: store.lng,
      hours: store.hours,
      serviceTags: [...store.serviceTags],
      geoSource: "address",
      url: DAISO_OFFICIAL_SOURCE_URL,
      facilities: [...store.facilities],
      ...(mode === "officialProvisional"
        ? { nameVerification: verifiedOfficialName ? "verified" as const : "provisional" as const }
        : {}),
    });
  }
  return result;
}

async function fetchText(fetchImpl: DaisoFetch, url: URL, timeoutMs: number): Promise<string> {
  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const timeoutFailure = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => {
      controller.abort();
      reject(new Error(`Daiso request timed out after ${timeoutMs}ms: ${url}`));
    }, timeoutMs);
  });
  try {
    const request = async () => {
      const response = await fetchImpl(url, { signal: controller.signal });
      if (!response.ok) throw new Error(`Daiso request failed (${response.status}): ${url}`);
      return response.text();
    };
    return await Promise.race([request(), timeoutFailure]);
  } finally {
    if (timeout !== undefined) clearTimeout(timeout);
  }
}

export async function collectDaisoSeoul(options: {
  fetchImpl: DaisoFetch;
  retrievedAt?: string;
  timeoutMs?: number;
}): Promise<DaisoSnapshot> {
  const retrievedAt = options.retrievedAt ?? new Date().toISOString();
  const timeoutMs = options.timeoutMs ?? 15_000;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new Error("timeoutMs must be positive");
  if (!/^\d{4}-\d{2}-\d{2}T/.test(retrievedAt) || !validIso(retrievedAt)) throw new Error("retrievedAt must be an ISO datetime");

  const districtUrl = new URL("/cs/ajax/sido_search", DAISO_OFFICIAL_ORIGIN);
  districtUrl.searchParams.set("sido", DAISO_REGION);
  const districts = parseDaisoRegionValues(await fetchText(options.fetchImpl, districtUrl, timeoutMs)).sort((a, b) => a.localeCompare(b, "ko"));
  if (!districts.length) throw new Error("Daiso returned no Seoul districts");

  const collected: DaisoSnapshotStore[] = [];
  for (const district of districts) {
    const neighborhoodUrl = new URL("/cs/ajax/gugun_search", DAISO_OFFICIAL_ORIGIN);
    neighborhoodUrl.searchParams.set("sido", DAISO_REGION);
    neighborhoodUrl.searchParams.set("gugun", district);
    const neighborhoods = parseDaisoRegionValues(await fetchText(options.fetchImpl, neighborhoodUrl, timeoutMs)).sort((a, b) => a.localeCompare(b, "ko"));
    if (!neighborhoods.length) throw new Error(`Daiso returned no neighborhoods for ${district}`);

    for (const neighborhood of neighborhoods) {
      const storeUrl = new URL("/cs/ajax/shop_search", DAISO_OFFICIAL_ORIGIN);
      storeUrl.searchParams.set("name_address", "");
      storeUrl.searchParams.set("sido", DAISO_REGION);
      storeUrl.searchParams.set("gugun", district);
      storeUrl.searchParams.set("dong", neighborhood);
      const html = await fetchText(options.fetchImpl, storeUrl, timeoutMs);
      collected.push(...parseDaisoStoreCards(html, { district, neighborhood, requestUrl: storeUrl.toString() }));
    }
  }

  const storesByIdentity = new Map<string, DaisoSnapshotStore>();
  for (const store of collected) {
    const previous = storesByIdentity.get(store.sourceId);
    if (!previous) {
      storesByIdentity.set(store.sourceId, store);
      continue;
    }
    if (previous.hours.open !== store.hours.open || previous.hours.close !== store.hours.close) {
      throw new Error(`Conflicting official hours for ${store.sourceId}`);
    }
    previous.facilities = [...new Set([...previous.facilities, ...store.facilities])].sort();
    previous.serviceTags = [...new Set([...previous.serviceTags, ...store.serviceTags])].sort();
    const provenanceKeys = new Set(previous.provenance.map((item) => item.requestUrl));
    previous.provenance.push(...store.provenance.filter((item) => !provenanceKeys.has(item.requestUrl)));
  }

  if (storesByIdentity.size === 0) {
    throw new Error("Daiso traversal returned no unique Seoul stores");
  }

  return {
    schemaVersion: 1,
    sourceUrl: DAISO_OFFICIAL_SOURCE_URL,
    retrievedAt,
    region: DAISO_REGION,
    stores: [...storesByIdentity.values()].sort((a, b) => a.sourceId.localeCompare(b.sourceId, "ko")),
  };
}
