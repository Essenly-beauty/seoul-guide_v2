#!/usr/bin/env node
// The English `name` on 239 Olive Young rows still carried its Korean branch
// suffix ("Olive Young 학동중앙점"). The app is English-first for visitors, so a
// half-Korean title is unreadable to its audience; the Korean belongs in
// nameKr, which already holds it (owner decision 2026-08-23).
//
//   node scripts/englishize-titles.mjs
//
// Idempotent: a name with no Hangul left is untouched.

import { readGeneratedPlaces, writeGeneratedPlaces } from "./lib/generated-places.mjs";
import { englishizeName } from "./lib/hangul-romanize.mjs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FILES = ["oliveyoung-places.ts", "creatrip-places.ts", "ados-places.ts"];

let changed = 0;
for (const file of FILES) {
  const path = join(ROOT, "lib", "generated", file);
  const { header, places } = readGeneratedPlaces(path);
  let n = 0;
  for (const place of places) {
    if (!/[가-힣]/.test(place.name)) continue;
    const next = englishizeName(place.name);
    if (!next || next === place.name || /[가-힣]/.test(next)) continue;
    // the Korean name must survive somewhere — it is what a taxi driver reads
    if (!/[가-힣]/.test(place.nameKr ?? "")) place.nameKr = place.name;
    place.name = next;
    n++;
  }
  if (n > 0) writeGeneratedPlaces(path, header, places);
  console.log(`${file}: ${n} titles englishized`);
  changed += n;
}
console.log(`\ntotal: ${changed}`);
