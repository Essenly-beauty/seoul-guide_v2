#!/usr/bin/env node
// Backfill Korean business names for scraped places whose nameKr is
// English-only (205 creatrip + 1 ados rows as of 2026-08-16). Uses the
// Kakao Local keyword search API — the login app's REST API key works
// for it (docs/auth-setup.md §3.1).
//
//   KAKAO_REST_API_KEY=... node scripts/backfill-kr-names.mjs
//
// Accuracy-first matching: a candidate is accepted only when it sits
// within tight distance of our geocoded point AND its Kakao category
// agrees with the place type (or it's practically on top of us). The
// result is written to scripts/lib/kr-name-overrides.json, which
// build-creatrip-places.mjs applies on rebuild — and this script also
// patches lib/generated/*.ts in place so no full pipeline rerun is
// needed.

import { readFileSync, writeFileSync } from "node:fs";

const KEY = process.env.KAKAO_REST_API_KEY;
if (!KEY) {
  console.error("KAKAO_REST_API_KEY missing (Kakao Developers console — REST API 키)");
  process.exit(1);
}

const FILES = ["lib/generated/creatrip-places.ts", "lib/generated/ados-places.ts"];
const OVERRIDES_PATH = "scripts/lib/kr-name-overrides.json";

/** Kakao category_name keywords that corroborate each of our place types. */
const CATEGORY_HINTS = {
  hair_salon: ["미용실", "헤어", "미용"],
  skin_clinic: ["피부과", "피부", "에스테틱", "클리닉", "의원"],
  nail: ["네일", "속눈썹", "왁싱", "뷰티"],
  personal_color: ["퍼스널컬러", "이미지컨설팅", "화장품", "뷰티"],
  makeup: ["메이크업", "뷰티", "화장"],
  olive_young: ["올리브영"],
  mall: ["쇼핑", "백화점", "몰"],
  etc: [],
};

const hasHangul = (s) => /[가-힣]/.test(s);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function parsePlaces(src) {
  // generated files are uniform: one object per block with these fields
  const out = [];
  const re = /id: "([^"]+)",\n    name: "([^"]+)",\n    nameKr: "([^"]+)",\n    type: "([^"]+)"[\s\S]*?lat: ([\d.]+),\n    lng: ([\d.]+)/g;
  for (const m of src.matchAll(re)) {
    out.push({ id: m[1], name: m[2], nameKr: m[3], type: m[4], lat: Number(m[5]), lng: Number(m[6]) });
  }
  return out;
}

async function searchKakao(query, lat, lng) {
  const url = new URL("https://dapi.kakao.com/v2/local/search/keyword.json");
  url.searchParams.set("query", query);
  url.searchParams.set("x", String(lng));
  url.searchParams.set("y", String(lat));
  url.searchParams.set("radius", "300");
  url.searchParams.set("sort", "distance");
  url.searchParams.set("size", "5");
  const res = await fetch(url, { headers: { Authorization: `KakaoAK ${KEY}` } });
  if (!res.ok) throw new Error(`kakao ${res.status}: ${await res.text()}`);
  return (await res.json()).documents ?? [];
}

function pick(docs, type) {
  const hints = CATEGORY_HINTS[type] ?? [];
  for (const d of docs) {
    if (!hasHangul(d.place_name)) continue; // we need a KOREAN name
    const dist = Number(d.distance);
    const categoryOk = hints.length === 0 || hints.some((h) => (d.category_name ?? "").includes(h));
    // ≤100m with agreeing category, or ≤30m regardless (same storefront)
    if ((dist <= 100 && categoryOk) || dist <= 30) return d;
  }
  return null;
}

const overrides = {};
let hit = 0;
let miss = 0;

for (const file of FILES) {
  const src = readFileSync(file, "utf8");
  const targets = parsePlaces(src).filter((p) => !hasHangul(p.nameKr));
  console.log(`${file}: ${targets.length} rows without Hangul`);
  for (const p of targets) {
    // branch suffixes ("... Branch | Hair Color Specialty Salon") hurt recall
    const base = p.name.split("|")[0].trim();
    const attempts = [base, base.split(/\s+/).slice(0, 3).join(" ")];
    let chosen = null;
    for (const q of [...new Set(attempts)]) {
      const docs = await searchKakao(q, p.lat, p.lng).catch((e) => {
        console.error(`  ! ${p.id}: ${e.message}`);
        return [];
      });
      chosen = pick(docs, p.type);
      await sleep(60);
      if (chosen) break;
    }
    if (chosen) {
      overrides[p.id] = chosen.place_name;
      hit += 1;
      console.log(`  ✓ ${p.id} → ${chosen.place_name} (${chosen.distance}m)`);
    } else {
      miss += 1;
    }
  }
}

writeFileSync(OVERRIDES_PATH, `${JSON.stringify(overrides, null, 2)}\n`);
console.log(`\noverrides written: ${OVERRIDES_PATH} — ${hit} matched, ${miss} left English (accuracy-first: no guesses)`);

// patch the generated files in place (no pipeline rerun needed)
for (const file of FILES) {
  let src = readFileSync(file, "utf8");
  let patched = 0;
  for (const [id, kr] of Object.entries(overrides)) {
    const re = new RegExp(`(id: "${id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}",\\n    name: "[^"]+",\\n    nameKr: ")[^"]+(")`);
    if (re.test(src)) {
      src = src.replace(re, `$1${kr}$2`);
      patched += 1;
    }
  }
  if (patched > 0) {
    writeFileSync(file, src);
    console.log(`${file}: ${patched} nameKr patched`);
  }
}
