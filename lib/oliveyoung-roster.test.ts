import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PLACES } from "./data";

// The Olive Young list was built from a Kakao Map public search capture, which
// returns what it indexes and caps what it hands back. It held 249 rows where
// Olive Young's own store finder holds 366, so the app was missing 138 Seoul
// stores — every Hongdae branch, both Gangnam Towns, Garosu-gil, COEX Mall and
// both Gimpo Airport stores. docs/research/store-data-accuracy-2026-09-23.md
const SNAPSHOT = join(import.meta.dirname, "..", "data", "sources", "oliveyoung-seoul-2026-09-23.json");

describe("Olive Young roster", () => {
  const official = (JSON.parse(readFileSync(SNAPSHOT, "utf8")).stores as { name: string; addr: string; code: string }[])
    .filter((s) => s.addr.startsWith("서울"));
  const ours = PLACES.filter((p) => p.type === "olive_young");
  const norm = (s: string) => s.replace(/올리브영|올리브베러/g, "").replace(/[^가-힣a-z0-9]/gi, "").replace(/점$/, "");
  const ourNames = new Set(ours.map((p) => norm(p.nameKr)));

  it("carries every store on the retailer's own roster", () => {
    // Six flagships live in the curated list in lib/data.ts under their own
    // ids, so the generated file drops those twins.
    const CURATED = ["올리브영 강남타운점", "올리브영 강남역점", "올리브영 명동타운점", "올리브영 홍대중앙점", "올리브영 성수역점", "올리브영 이태원점"].map(norm);
    const missing = official.filter((s) => !ourNames.has(norm(s.name)) && !CURATED.includes(norm(s.name)));
    expect(missing.length, missing.slice(0, 8).map((s) => `${s.name} (${s.addr})`).join(" | ")).toBeLessThanOrEqual(6);
  });

  it("publishes no store the retailer no longer lists", () => {
    // Eight were left over from the Kakao capture — mostly shop-in-shop
    // counters whose host closed. Each returned nothing from Olive Young's own
    // search, under its full name and under a loose keyword.
    const officialNames = new Set(official.map((s) => norm(s.name)));
    const CURATED_IDS = ["oy-gangnam-town", "oy-gangnam-stn", "oy-myeongdong", "oy-hongdae", "oy-seongsu", "oy-itaewon"];
    const ghosts = ours.filter((p) => !officialNames.has(norm(p.nameKr)) && !CURATED_IDS.includes(p.id));
    expect(ghosts.length, ghosts.map((p) => p.nameKr).join(" | ")).toBe(0);
  });

  it("has the stores a visitor actually travels to", () => {
    for (const q of ["홍대", "코엑스", "가로수길", "김포공항", "서울대입구", "신림"]) {
      expect(ours.some((p) => p.nameKr.includes(q)), `no Olive Young matching ${q}`).toBe(true);
    }
  });

  it("keeps the ids Supabase already stores", () => {
    // favorites, ratings and shared_lists all key on place_id. An id that
    // changes silently drops a saved place, so a rebuild must carry ids over
    // rather than re-derive them.
    for (const id of ["oy-학동중앙점", "oy-포이사거리점", "oy-숭실대입구역점", "oy-광장마켓점", "oy-우장산역점", "oy-신설동역점"]) {
      expect(ours.some((p) => p.id === id), `lost id ${id}`).toBe(true);
    }
  });

  it("gives every store a Seoul coordinate", () => {
    const off = ours.filter((p) => !(p.lat > 37.42 && p.lat < 37.72 && p.lng > 126.75 && p.lng < 127.2));
    expect(off.map((p) => p.nameKr)).toEqual([]);
  });
});
