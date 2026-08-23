// Read/write helpers for the lib/generated/*-places.ts files.
//
// Every one of those files is written by its builder as
//
//   <header comment + import + export const X: Place[] = > JSON.stringify(places, null, 2)
//     .replace(/"([a-zA-Z][a-zA-Z0-9]*)":/g, "$1:") + ";\n"
//
// so the array body is JSON with the simple keys unquoted. Round-tripping it
// through JSON (rather than regex-patching individual fields, which is what
// scripts/backfill-kr-names.mjs did) means a backfill writes exactly the bytes
// a full pipeline rerun would write — the two can never drift.
//
// JSON.stringify escapes newlines inside strings, so every line break in the
// body is structural: a line of `<indent><word>:` can only ever be a key, which
// is what makes the re-quote below safe.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const BODY_RE = /^([\s\S]*?export const [A-Z_]+: Place\[\] = )([\s\S]*);\n?$/;

/** Parse a generated places file into { header, places }. */
export function parseGeneratedPlaces(src) {
  const m = src.match(BODY_RE);
  if (!m) throw new Error("not a generated places file (no `export const …: Place[] = `)");
  const json = m[2].replace(/^(\s*)([A-Za-z][A-Za-z0-9]*):/gm, '$1"$2":');
  return { header: m[1], places: JSON.parse(json) };
}

/** Serialize back, byte-for-byte the way the builders do. */
export function serializeGeneratedPlaces(header, places) {
  return header + JSON.stringify(places, null, 2).replace(/"([a-zA-Z][a-zA-Z0-9]*)":/g, "$1:") + ";\n";
}

export function readGeneratedPlaces(path) {
  return parseGeneratedPlaces(readFileSync(path, "utf8"));
}

export function writeGeneratedPlaces(path, header, places) {
  writeFileSync(path, serializeGeneratedPlaces(header, places));
}

/** Set `key` on `obj` keeping field order stable: right after `afterKey` when
    the field is new, in place when it already exists. Field order only matters
    so that a backfill and a rebuild produce identical files. */
export function setOrdered(obj, afterKey, key, value) {
  if (key in obj) return { ...obj, [key]: value };
  const out = {};
  let inserted = false;
  for (const [k, v] of Object.entries(obj)) {
    out[k] = v;
    if (k === afterKey) {
      out[key] = value;
      inserted = true;
    }
  }
  if (!inserted) out[key] = value;
  return out;
}

/** Where `hours` sits in a Place literal. Shared by the backfill and by every
    builder that re-applies scripts/lib/hours-overrides.json, so both agree. */
export const HOURS_AFTER_KEY = "lng";

const HOURS_OVERRIDES_PATH = fileURLToPath(new URL("./hours-overrides.json", import.meta.url));

/** scripts/lib/hours-overrides.json, or {} when it hasn't been generated yet. */
export function loadHoursOverrides() {
  if (!existsSync(HOURS_OVERRIDES_PATH)) return {};
  return JSON.parse(readFileSync(HOURS_OVERRIDES_PATH, "utf8"));
}

/** Re-apply scripts/lib/hours-overrides.json to a list of places (mutating the
    array in place, replacing entries). Returns the number applied.
    Builders MUST call this so a pipeline rerun can't regress the hours —
    same contract as kr-name-overrides.json. */
export function applyHoursOverrides(places, overrides = loadHoursOverrides()) {
  let applied = 0;
  for (let i = 0; i < places.length; i++) {
    const fix = overrides[places[i].id];
    if (!fix?.open || !fix?.close) continue;
    places[i] = setOrdered(places[i], HOURS_AFTER_KEY, "hours", { open: fix.open, close: fix.close });
    applied += 1;
  }
  return applied;
}
