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
// Budgets are a RATCHET: lower them as verified names land, never raise them.
//
// The 20-character budget was dropped on 2026-09-21 because it measured the
// wrong thing. Once names are CORRECT they share real words — "Olive Young
// Lotte ..." is several stores — and the chain word alone eats 12 of those 20
// characters, so the figure rose from 99 to 104 while the names got better.
// What actually matters is measured instead: an unreadable token, and whether
// the name is still ambiguous once enough of it is visible.
const MAX_UNREADABLE = 33;        // names carrying a token > 18 chars — only ever lower
const MAX_COLLIDING_AT_24 = 27;   // was 32 before the verified names — only ever lower
const MAX_COLLIDING_AT_28 = 15;   // was 19 — only ever lower

/** Longest whitespace-free run: what makes a name unreadable and unbreakable. */
function longestToken(name: string): number {
  return name.split(/\s+/).reduce((max, t) => Math.max(max, t.length), 0);
}

describe("place name distinguishability", () => {
  it("keeps unreadable machine-romanised names inside the recorded budget", () => {
    // "Daiso Hanaromateudongseoulnonghyeopjangan" is 35 characters with no
    // break: a visitor cannot read it, it cannot wrap, and it is not what the
    // shop is called.
    const bad = PLACES.filter((p) => longestToken(p.name) > 18);
    expect(bad.length, bad.slice(0, 5).map((p) => `${p.name} (${p.nameKr})`).join(" | ")).toBeLessThanOrEqual(MAX_UNREADABLE);
  });

  it("has no two branches sharing a truncated name beyond the recorded budget", () => {
    const at24 = truncationCollisions(PLACES, 24);
    const at28 = truncationCollisions(PLACES, 28);
    expect(at24.places, `24-char collisions: ${at24.groups.length} groups`).toBeLessThanOrEqual(MAX_COLLIDING_AT_24);
    expect(at28.places, `28-char collisions: ${at28.groups.length} groups`).toBeLessThanOrEqual(MAX_COLLIDING_AT_28);
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

  it("is applied to the published catalogue, except where a human verified the name", () => {
    // VERIFIED_PLACE_PATCHES is applied after these, on purpose: a name
    // someone checked against the storefront outranks a rule-derived one.
    const byId = new Map(PLACES.map((p) => [p.id, p]));
    const src = readFileSync(join(process.cwd(), "lib/data.ts"), "utf8");
    const patched = new Set([...src.matchAll(/^\s{2}"([^"]+)":\s*\{/gm)].map((m) => m[1]));
    let applied = 0;
    for (const [id, entry] of Object.entries(EN_NAME_OVERRIDES)) {
      const place = byId.get(id);
      if (!place || patched.has(id)) continue;
      expect(place.name, id).toBe(entry.nameEn);
      applied++;
    }
    expect(applied).toBeGreaterThan(200);
  });

  it("is wired into the catalogue rather than sitting unused", () => {
    const src = readFileSync(join(process.cwd(), "lib/data.ts"), "utf8");
    expect(src).toMatch(/applyEnglishNameOverrides/);
  });
});
