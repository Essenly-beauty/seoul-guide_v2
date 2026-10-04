import { createHash } from "node:crypto";
import type { Place } from "./data";

type Row = { id: string; source: string; payload: Place; sha256: string };
export type PlaceCatalogManifest = { schemaVersion: 1; sourceRows: Row[]; publishedRows: Row[] };

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.entries(value)
      .filter(([, part]) => part !== undefined)
      .sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
      .map(([key, part]) => [key, canonical(part)]));
  }
  return value;
}

export function canonicalPlaceJson(place: Place): string {
  return JSON.stringify(canonical(place));
}

function row(place: Place, published: boolean): Row {
  if (!place.id.trim()) throw new Error("missing place id");
  if (published && (!place.name.trim() || !place.nameKr.trim() || !place.address.trim())) {
    throw new Error(`missing published identity/address: ${place.id}`);
  }
  if (published && (!Number.isFinite(place.lat) || !Number.isFinite(place.lng)
    || place.lat < -90 || place.lat > 90 || place.lng < -180 || place.lng > 180)) {
    throw new Error(`invalid coordinates: ${place.id}`);
  }
  if (!place.source) throw new Error(`missing source: ${place.id}`);
  const json = canonicalPlaceJson(place);
  const payload = JSON.parse(json) as Place;
  return {
    id: place.id, source: place.source, payload,
    sha256: createHash("sha256").update(json).digest("hex"),
  };
}

function unique(places: readonly Place[], label: "source" | "published"): Row[] {
  const seen = new Set<string>();
  return places.map((place) => {
    if (seen.has(place.id)) throw new Error(`duplicate ${label} id: ${place.id}`);
    seen.add(place.id);
    return row(place, label === "published");
  }).sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

export function buildPlaceCatalogManifest(
  source: readonly Place[], published: readonly Place[],
): PlaceCatalogManifest {
  const sourceRows = unique(source, "source");
  const publishedRows = unique(published, "published");
  const sourceIds = new Set(sourceRows.map((item) => item.id));
  for (const item of publishedRows) {
    if (!sourceIds.has(item.id)) throw new Error(`missing source id: ${item.id}`);
  }
  return { schemaVersion: 1, sourceRows, publishedRows };
}
