import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PLACES } from "./data";
import { EN_NAME_OVERRIDES, truncationCollisions } from "./place-name-en";

const HANGUL = /[ㄱ-ㆎ가-힣]/;

/** A list row truncates the place name, so two branches whose English names
 *  share a prefix are indistinguishable on screen — the owner reported
 *  exactly this on the Daiso list (2026-09-20). The English names come from
 *  a machine transliteration that joins Korean syllable runs with nothing,
 *  which both destroys the word boundaries and gets the spelling wrong
 *  (청량리 is officially Cheongnyangni, not "Cheongryangri").
 *
 *  These budgets are a RATCHET: lower them as verified names land, never
 *  raise them. Corrections go in scripts/lib/en-name-overrides.json, keyed by
 *  place id, so a pipeline rerun cannot quietly restore the bad name. */
const MAX_COLLIDING_AT_20 = 99; // 2026-09-20 baseline, 40 groups — only ever lower
const MAX_COLLIDING_AT_24 = 32; // 2026-09-20 baseline, 15 groups — only ever lower

describe("place name distinguishability", () => {
  it("has no two branches sharing a truncated name beyond the recorded budget", () => {
    const at20 = truncationCollisions(PLACES, 20);
    const at24 = truncationCollisions(PLACES, 24);
    expect(at20.places, `20-char collisions: ${at20.groups.length} groups`).toBeLessThanOrEqual(MAX_COLLIDING_AT_20);
    expect(at24.places, `24-char collisions: ${at24.groups.length} groups`).toBeLessThanOrEqual(MAX_COLLIDING_AT_24);
  });

  it("never lets two places share an identical full English name", () => {
    const byName = new Map<string, Set<string>>();
    for (const p of PLACES) {
      const k = p.name.trim().toLowerCase();
      if (!byName.has(k)) byName.set(k, new Set());
      byName.get(k)!.add(p.nameKr || p.id);
    }
    const clashes = [...byName.entries()].filter(([, v]) => v.size > 1);
    expect(clashes.map(([n]) => n)).toEqual([]);
  });
});

describe("English name overrides", () => {
  it("only names places that exist, so a stale entry cannot sit unnoticed", () => {
    const ids = new Set(PLACES.map((p) => p.id));
    for (const id of Object.keys(EN_NAME_OVERRIDES)) expect(ids.has(id), `unknown place id ${id}`).toBe(true);
  });

  it("is rejected when a rebuild moves the Korean name it was verified against", () => {
    const byId = new Map(PLACES.map((p) => [p.id, p]));
    for (const [id, entry] of Object.entries(EN_NAME_OVERRIDES)) {
      const place = byId.get(id);
      if (!place) continue;
      expect(entry.nameKrAtVerification, `${id} drifted: verified against "${entry.nameKrAtVerification}", data now says "${place.nameKr}"`).toBe(place.nameKr);
    }
  });

  it("carries no Korean in an English display name", () => {
    for (const [id, entry] of Object.entries(EN_NAME_OVERRIDES)) {
      expect(HANGUL.test(entry.nameEn), `${id}: ${entry.nameEn}`).toBe(false);
    }
  });

  it("is actually applied to the published catalogue", () => {
    const byId = new Map(PLACES.map((p) => [p.id, p]));
    for (const [id, entry] of Object.entries(EN_NAME_OVERRIDES)) {
      const place = byId.get(id);
      if (place) expect(place.name, id).toBe(entry.nameEn);
    }
  });

  it("is wired into the catalogue rather than sitting unused", () => {
    const src = readFileSync(join(process.cwd(), "lib/data.ts"), "utf8");
    expect(src).toMatch(/applyEnglishNameOverrides/);
  });
});
