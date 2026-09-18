// Daiso Seoul supplement: stores the official daisomall.co.kr store finder lists
// but the approved daiso.co.kr snapshot (2026-09-03, 251 stores) does not.
//
// Owner request 2026-09-18: publish every Seoul store in the owner's list
// (data/sources/daiso_seoul-owner-list-2026-09-18.csv, 284 rows). The list was
// cross-checked against the store finder API (data/sources/daisomall-seoul-
// 2026-09-18.json, 285 rows incl. one Gyeonggi store). The 33 stores missing
// from the approved snapshot are shop-in-shop counters inside marts; the API
// returns no coordinates for them, so their pins are geocoded from the official
// address. A store that geocodes to a house number gets an address-level pin;
// a road-only match keeps the road coordinate and a complete miss falls back to
// the centroid of the district's existing Daiso stores; both are published as
// provisional area pins, which the UI discloses.
//
//   npm run build:daiso-supplement
//
// The Nominatim results are cached in scripts/.daiso-supplement-geocode-cache.json
// (committed), so a rebuild is offline and deterministic.

import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { mkdir, rename, unlink, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { zoneForAddress, type DaisoPlace } from "../lib/daiso-import";
import { englishizeDaisoName } from "../lib/english-place-name";
import { DAISO_PLACES } from "../lib/generated/daiso-places";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const DAISOMALL_SNAPSHOT_PATH = resolve(ROOT, "data/sources/daisomall-seoul-2026-09-18.json");
export const OWNER_LIST_PATH = resolve(ROOT, "data/sources/daiso_seoul-owner-list-2026-09-18.csv");
export const GEOCODE_CACHE_PATH = resolve(ROOT, "scripts/.daiso-supplement-geocode-cache.json");
export const DAISO_SUPPLEMENT_GENERATED_PATH = resolve(ROOT, "lib/generated/daiso-supplement-places.ts");
export const DAISOMALL_STORE_FINDER_URL = "https://www.daisomall.co.kr/ms/msg/SCR_MSG_0019";

export const APPROVED_DAISOMALL_SNAPSHOT_SHA256 = "1c3dccad9d0d5c2e0575b93c40baa458c347ea13be4f188b09394fdeb3345ead";
export const APPROVED_OWNER_LIST_SHA256 = "595345c204516dfe3d77c8cbe81f83e538ab0485853261aee43900bd4816a0ec";
export const EXPECTED_SUPPLEMENT_COUNT = 33;

const SEOUL_BOUNDS = { latMin: 37.42, latMax: 37.72, lngMin: 126.75, lngMax: 127.2 };

export type DaisomallStore = {
  strCd: string;
  strNm: string;
  strAddr: string;
  opngTime: string | null;
  clsngTime: string | null;
  strLttd: number;
  strLitd: number;
  directYn: string | null;
  [flag: string]: string | number | null;
};

export type DaisomallSnapshot = {
  schemaVersion: 1;
  retrievedAt: string;
  totalCnt: number;
  stores: DaisomallStore[];
};

export type OwnerListRow = { id: string; store_name: string; address: string; district: string };

export type GeocodeHit = {
  lat: number;
  lng: number;
  precision: "house" | "road";
  road: string | null;
  houseNumber: string | null;
  variant: string;
  displayName: string;
};

export function normalizeStoreName(value: string): string {
  return value.normalize("NFKC").replace(/\s+/g, "").toLocaleLowerCase("ko-KR");
}

export function normalizeAddress(value: string): string {
  return value.normalize("NFKC").replace(/ /g, " ").replace(/\s+/g, " ").replace(/^서울특별시/, "서울").trim();
}

/** "서울 강남구 논현로10길 29 (개포동)" → ["논현로10길", "29"]; null when the address has no road number. */
export function roadKey(address: string): [string, string] | null {
  // Work on the spaced form so the road token cannot swallow the district
  // ("서울강남구논현로10길"); Nominatim reports the bare road ("논현로10길").
  const spaced = normalizeAddress(address);
  const match = /(?:^|\s)([가-힣A-Za-z0-9]+(?:로|길)\d*(?:\s*\d+가?길)?)\s*(?:지하\s*)?(\d+(?:-\d+)?)/.exec(spaced);
  return match ? [match[1].replace(/\s+/g, ""), match[2]] : null;
}

export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') { field += '"'; index += 1; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") { row.push(field); field = ""; }
    else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[index + 1] === "\n") index += 1;
      row.push(field); field = "";
      if (row.some((value) => value !== "")) rows.push(row);
      row = [];
    } else field += char;
  }
  if (field !== "" || row.length) { row.push(field); if (row.some((value) => value !== "")) rows.push(row); }
  const [header, ...body] = rows;
  return body.map((values) => Object.fromEntries(header.map((key, index) => [key, values[index] ?? ""])));
}

export function selectSupplementStores(
  snapshot: DaisomallSnapshot,
  ownerRows: OwnerListRow[],
  existing: readonly { nameKr: string; address: string }[],
): { supplement: DaisomallStore[]; nonSeoul: DaisomallStore[]; alreadyPublished: number } {
  const seoul = snapshot.stores.filter((store) => /^\s*서울/.test(store.strAddr));
  const nonSeoul = snapshot.stores.filter((store) => !/^\s*서울/.test(store.strAddr));
  const apiNames = new Map(seoul.map((store) => [normalizeStoreName(store.strNm), store]));
  if (apiNames.size !== seoul.length) throw new Error("Duplicate store names in the daisomall snapshot");

  const ownerNames = new Set(ownerRows.map((row) => normalizeStoreName(row.store_name)));
  const missingFromApi = ownerRows.filter((row) => !apiNames.has(normalizeStoreName(row.store_name)));
  if (missingFromApi.length) {
    throw new Error(`Owner list stores absent from the store finder snapshot: ${missingFromApi.map((row) => row.store_name).join(", ")}`);
  }
  const missingFromOwner = seoul.filter((store) => !ownerNames.has(normalizeStoreName(store.strNm)));
  if (missingFromOwner.length) {
    throw new Error(`Store finder Seoul stores absent from the owner list: ${missingFromOwner.map((store) => store.strNm).join(", ")}`);
  }

  const existingNames = new Set(existing.map((place) => normalizeStoreName(place.nameKr)));
  const existingRoads = new Set(existing.map((place) => roadKey(place.address)?.join("|")).filter(Boolean));
  const supplement: DaisomallStore[] = [];
  let alreadyPublished = 0;
  for (const store of seoul) {
    if (existingNames.has(normalizeStoreName(store.strNm))) { alreadyPublished += 1; continue; }
    const road = roadKey(store.strAddr)?.join("|");
    if (road && existingRoads.has(road)) {
      throw new Error(`${store.strNm} shares a road address with an approved store under another name; review before publishing`);
    }
    supplement.push(store);
  }
  supplement.sort((a, b) => a.strCd.localeCompare(b.strCd, "en"));
  return { supplement, nonSeoul, alreadyPublished };
}

export function storeHours(store: DaisomallStore): { open: string; close: string } | undefined {
  const open = store.opngTime?.trim();
  const close = store.clsngTime?.trim();
  if (!open || !close || !/^\d{2}:\d{2}$/.test(open) || !/^\d{2}:\d{2}$/.test(close)) return undefined;
  if (open === "00:00" && close === "00:00") return undefined; // the finder's "unknown"
  return { open, close: close === "00:00" ? "24:00" : close };
}

const SERVICE_FLAGS: [string, string][] = [
  ["usimYn", "sim-card"], ["ovrseaUsimYn", "sim-card"], ["hbrdUsimYn", "sim-card"],
  ["taxfYn", "tax-refund"], ["pkupYn", "store-pickup"], ["nocashYn", "cashless-store"],
  ["phstkYn", "photo-sticker"], ["nmtkYn", "name-sticker"],
];
const FACILITY_FLAGS: [string, string][] = [["parkYn", "parking"], ["elvtYn", "elevator"], ["entrRampYn", "entrance-ramp"]];

function flagged(store: DaisomallStore, flags: [string, string][]): string[] {
  return [...new Set(flags.filter(([key]) => store[key] === "Y").map(([, tag]) => tag))].sort();
}

/** Address variants to try, most specific first: road + number, then the address without the parenthetical. */
export function addressVariants(address: string): string[] {
  const normalized = normalizeAddress(address);
  const district = /서울\s*([가-힣]+구)/.exec(normalized)?.[1];
  const road = /([가-힣A-Za-z0-9]+(?:로|길)\d*(?:\s*\d+길)?)\s*(?:지하\s*)?(\d+(?:-\d+)?)/.exec(normalized);
  const variants = new Set<string>();
  if (district && road) variants.add(`서울특별시 ${district} ${road[1].replace(/\s+/g, "")} ${road[2]}`);
  variants.add(normalized.replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").trim());
  return [...variants];
}

type NominatimResult = { lat: string; lon: string; display_name: string; address?: { road?: string; house_number?: string } };

async function nominatim(query: string, lastRequestAt: { at: number }): Promise<NominatimResult | null> {
  const wait = lastRequestAt.at + 1150 - Date.now();
  if (wait > 0) await new Promise((done) => setTimeout(done, wait));
  lastRequestAt.at = Date.now();
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=kr&addressdetails=1&q=${encodeURIComponent(query)}`;
  const response = await fetch(url, { headers: { "User-Agent": "myseouldrop-data-import/0.1 (place pins)" } });
  if (!response.ok) throw new Error(`nominatim ${response.status} for ${query}`);
  const data = (await response.json()) as NominatimResult[];
  return data[0] ?? null;
}

export function evaluateHit(query: string, hit: NominatimResult | null): GeocodeHit | null {
  if (!hit) return null;
  const lat = Number(hit.lat);
  const lng = Number(hit.lon);
  if (!(lat >= SEOUL_BOUNDS.latMin && lat <= SEOUL_BOUNDS.latMax && lng >= SEOUL_BOUNDS.lngMin && lng <= SEOUL_BOUNDS.lngMax)) return null;
  const queryRoad = roadKey(query);
  const road = hit.address?.road?.replace(/\s+/g, "") ?? null;
  // A shop node may carry "29, 지상1층 108호"; only the leading number identifies the building.
  const houseNumber = /^\d+(?:-\d+)?/.exec(hit.address?.house_number?.trim() ?? "")?.[0] ?? null;
  if (!queryRoad || !road || road !== queryRoad[0]) return null;
  return {
    lat, lng,
    precision: houseNumber && houseNumber === queryRoad[1] ? "house" : "road",
    road, houseNumber, variant: query, displayName: hit.display_name,
  };
}

async function geocode(address: string, cache: Record<string, GeocodeHit | null>, lastRequestAt: { at: number }): Promise<GeocodeHit | null> {
  if (address in cache) return cache[address];
  let best: GeocodeHit | null = null;
  for (const variant of addressVariants(address)) {
    const evaluated = evaluateHit(variant, await nominatim(variant, lastRequestAt));
    if (evaluated && (!best || (evaluated.precision === "house" && best.precision !== "house"))) best = evaluated;
    if (best?.precision === "house") break;
  }
  cache[address] = best;
  writeFileSync(GEOCODE_CACHE_PATH, `${JSON.stringify(cache, null, 1)}\n`);
  return best;
}

function districtOf(address: string): string | null {
  return /서울(?:특별시)?\s*([가-힣]+구)/.exec(address)?.[1] ?? null;
}

export function districtCentroid(address: string, existing: readonly { address: string; lat: number; lng: number }[]): { lat: number; lng: number } | null {
  const district = districtOf(address);
  if (!district) return null;
  const peers = existing.filter((place) => districtOf(place.address) === district);
  if (!peers.length) return null;
  return {
    lat: peers.reduce((total, place) => total + place.lat, 0) / peers.length,
    lng: peers.reduce((total, place) => total + place.lng, 0) / peers.length,
  };
}

export function buildSupplementPlace(
  store: DaisomallStore,
  geo: { lat: number; lng: number; geoSource: "address" | "area" },
): DaisoPlace {
  const address = store.strAddr.normalize("NFKC").replace(/\s+/g, " ").trim();
  const serviceTags = flagged(store, SERVICE_FLAGS);
  const hours = storeHours(store);
  return {
    id: `daisomall-official:${store.strCd}`,
    name: englishizeDaisoName(store.strNm),
    nameKr: store.strNm.normalize("NFKC").trim(),
    type: "daiso",
    zone: zoneForAddress(address),
    priceRange: "₩",
    tags: [...serviceTags],
    address,
    lat: geo.lat,
    lng: geo.lng,
    ...(hours ? { hours } : {}),
    serviceTags,
    geoSource: geo.geoSource,
    url: DAISOMALL_STORE_FINDER_URL,
    facilities: flagged(store, FACILITY_FLAGS),
    nameVerification: "provisional",
    ...(geo.geoSource === "area" ? { locationVerification: "provisional" as const } : {}),
  };
}

async function writeTextAtomically(path: string, value: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temporaryPath = `${path}.${process.pid}.tmp`;
  try {
    await writeFile(temporaryPath, value, "utf8");
    await rename(temporaryPath, path);
  } catch (error) {
    await unlink(temporaryPath).catch(() => undefined);
    throw error;
  }
}

export async function runDaisoSupplementBuild(options: { outputPath?: string } = {}): Promise<{ published: number; addressPins: number; areaPins: number }> {
  const snapshotText = readFileSync(DAISOMALL_SNAPSHOT_PATH, "utf8");
  const ownerText = readFileSync(OWNER_LIST_PATH);
  const snapshotSha = createHash("sha256").update(snapshotText).digest("hex");
  const ownerSha = createHash("sha256").update(ownerText).digest("hex");
  if (snapshotSha !== APPROVED_DAISOMALL_SNAPSHOT_SHA256) throw new Error(`daisomall snapshot must match approved SHA-256; received ${snapshotSha}`);
  if (ownerSha !== APPROVED_OWNER_LIST_SHA256) throw new Error(`owner list must match approved SHA-256; received ${ownerSha}`);

  const snapshot = JSON.parse(snapshotText) as DaisomallSnapshot;
  const ownerRows = parseCsv(ownerText.toString("utf8")) as OwnerListRow[];
  const { supplement, nonSeoul, alreadyPublished } = selectSupplementStores(snapshot, ownerRows, DAISO_PLACES);
  if (supplement.length !== EXPECTED_SUPPLEMENT_COUNT) {
    throw new Error(`Expected ${EXPECTED_SUPPLEMENT_COUNT} supplement stores, found ${supplement.length}`);
  }

  const cache: Record<string, GeocodeHit | null> = existsSync(GEOCODE_CACHE_PATH) ? JSON.parse(readFileSync(GEOCODE_CACHE_PATH, "utf8")) : {};
  const lastRequestAt = { at: 0 };
  const places: DaisoPlace[] = [];
  let addressPins = 0;
  let roadPins = 0;
  let districtPins = 0;
  for (const store of supplement) {
    const hit = await geocode(store.strAddr, cache, lastRequestAt);
    if (hit && hit.precision === "house") {
      addressPins += 1;
      places.push(buildSupplementPlace(store, { lat: hit.lat, lng: hit.lng, geoSource: "address" }));
      continue;
    }
    if (hit) {
      // The road matched but not the building: closer than a district centroid,
      // still approximate, so it ships as a disclosed provisional area pin.
      roadPins += 1;
      places.push(buildSupplementPlace(store, { lat: hit.lat, lng: hit.lng, geoSource: "area" }));
      continue;
    }
    const centroid = districtCentroid(store.strAddr, DAISO_PLACES);
    if (!centroid) throw new Error(`No district centroid available for ${store.strNm} (${store.strAddr})`);
    districtPins += 1;
    places.push(buildSupplementPlace(store, { ...centroid, geoSource: "area" }));
  }
  const areaPins = roadPins + districtPins;

  const source =
    `// AUTO-GENERATED by scripts/build-daiso-supplement-places.ts — do not edit by hand.\n` +
    `// Source: ${relative(ROOT, DAISOMALL_SNAPSHOT_PATH)} (${snapshot.stores.length} store-finder rows, ${nonSeoul.length} outside Seoul)\n` +
    `// cross-checked with ${relative(ROOT, OWNER_LIST_PATH)} (${ownerRows.length} owner rows; ${alreadyPublished} already in the approved snapshot).\n` +
    `// ${places.length} supplement stores: ${addressPins} address-geocoded, ${roadPins} road-level and ${districtPins} district-level provisional area pins.\n\n` +
    `import type { DaisoPlace } from "../daiso-import";\n\n` +
    `export const DAISO_SUPPLEMENT_PLACES: DaisoPlace[] = ${JSON.stringify(places, null, 2)};\n`;
  await writeTextAtomically(options.outputPath ?? DAISO_SUPPLEMENT_GENERATED_PATH, source);
  return { published: places.length, addressPins, areaPins };
}

const modulePath = fileURLToPath(import.meta.url);
const isMain = process.argv.slice(1).some((argument) => resolve(argument) === modulePath);
if (isMain) {
  runDaisoSupplementBuild()
    .then(({ published, addressPins, areaPins }) =>
      console.log(`Wrote ${DAISO_SUPPLEMENT_GENERATED_PATH}: ${published} stores (${addressPins} address pins, ${areaPins} provisional area pins)`))
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    });
}
