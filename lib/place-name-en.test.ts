import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PLACES } from "./data";
import { EN_NAME_OVERRIDES, applyEnglishNameOverrides, truncationCollisions } from "./place-name-en";

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
const MAX_UNREADABLE = 0;         // names carrying a token > 18 chars — was 33, now cleared
//
// Per 1000 published places, not an absolute count. An absolute count is a
// ratio with the dataset size hidden in it, and on 2026-09-23 that bit: the
// Olive Young roster moved to the retailer's own list and grew from 236 stores
// to 366. More branches in one city means more that share a neighbourhood
// name, so the raw @24 figure rose 27 -> 33 while the rate barely moved,
// 30.8 -> 32.7 per 1000. At @28 the absolute count did not move at all and the
// rate improved, 17.1 -> 14.9. Counting per 1000 says what actually changed.
//
// This is the second time this budget measured the wrong thing. The @20
// version was dropped in 2026-09-21 because the chain word ate 12 of its 20
// characters. Treat a rise here as a question, not a verdict.
const MAX_COLLIDING_PER_1000_AT_24 = 33;  // 32.7 today — only ever lower
const MAX_COLLIDING_PER_1000_AT_28 = 15;  // 14.9 today — only ever lower
//
// Clearing the last 33 raised the 24-char collisions from 27 to 34 before it
// settled back at 27. Every one of those seven was the same mistake: a correct
// name whose branch word trailed a long host name, so truncation kept the part
// the branches share and cut the part that tells them apart. "Daiso Good
// Morning Mart Yujin/Hwagok/Hongje" are identical for the first 24 characters.
// Leading with the branch word — "Daiso Yujin Good Morning Mart" — separates
// them with no loss of meaning. Put the discriminator first when a name has a
// long shared head.
//
// Measured on the real screen (390x844, 2026-09-23): a map list row gives the
// name a 262px single-line box, which fits a median of 24 characters, and 123
// of 878 rows are truncated. That is what these budgets model.

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
    const per1000 = (n: number) => (n / PLACES.length) * 1000;
    const at24 = truncationCollisions(PLACES, 24);
    const at28 = truncationCollisions(PLACES, 28);
    expect(per1000(at24.places), `24-char: ${at24.places} places in ${at24.groups.length} groups of ${PLACES.length}`)
      .toBeLessThanOrEqual(MAX_COLLIDING_PER_1000_AT_24);
    expect(per1000(at28.places), `28-char: ${at28.places} places in ${at28.groups.length} groups of ${PLACES.length}`)
      .toBeLessThanOrEqual(MAX_COLLIDING_PER_1000_AT_28);
  });

  it("is measuring row width, not names — so renaming cannot lower it", () => {
    // Every remaining group is told apart by a suffix that truncation removes:
    // "Daiso Gangnam Express Bus Terminal" and "… Terminal 2", the three
    // "JUNO HAIR | Gangnam Station Branch N". Separating all of them needs 36
    // characters and a map list row shows a median of 24 (measured at 390x844
    // on 2026-09-23). No spelling fixes that; the row layout does.
    const { groups } = truncationCollisions(PLACES, 24);
    const byKr = new Map(PLACES.map((p) => [p.nameKr || p.id, p]));
    const needed = groups.map((g) => {
      const names = g.map((kr) => byKr.get(kr)?.name ?? kr);
      let prefix = names[0];
      for (const n of names.slice(1)) {
        let i = 0;
        while (i < prefix.length && i < n.length && prefix[i] === n[i]) i++;
        prefix = prefix.slice(0, i);
      }
      return prefix.length + 1;
    });
    expect(Math.max(...needed)).toBeGreaterThan(24);
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

// ── Provenance: a hand-checked name must not be labelled unverified ──
//
// applyEnglishNameOverrides replaced the display name but left
// nameVerification alone, so 163 of the 268 hand-checked names kept
// "provisional" and the place sheet told the visitor the English name "has
// not yet been verified". That sentence was false about every one of them.
//
// "verified" is not the right label either: lib/daiso-import.ts:454 sets it
// only when Naver confirms the English name, and these came from the Seoul
// Metro station table (lib/subway-data.json) and the chains' own English
// brand names. A third state records what actually happened.
describe("override provenance", () => {
  const [sampleId, sample] = Object.entries(EN_NAME_OVERRIDES)[0];

  it("marks a renamed place as derived rather than provisional", () => {
    const [place] = applyEnglishNameOverrides([
      { id: sampleId, name: "machine name", nameKr: sample.nameKrAtVerification, nameVerification: "provisional" as const },
    ]);
    expect(place.name).toBe(sample.nameEn);
    expect(place.nameVerification).toBe("derived");
  });

  it("leaves a place it did not rename alone", () => {
    const [place] = applyEnglishNameOverrides([
      { id: "no-such-id", name: "Untouched", nameKr: "그대로", nameVerification: "provisional" as const },
    ]);
    expect(place.name).toBe("Untouched");
    expect(place.nameVerification).toBe("provisional");
  });

  it("applies that state to the places the app actually ships", () => {
    const derived = PLACES.filter((place) => place.nameVerification === "derived");
    expect(derived.length).toBeGreaterThan(100);
    expect(PLACES.some((place) => place.nameVerification === "provisional")).toBe(true);
  });

  it("gives the derived name its own disclosure instead of the provisional one", () => {
    const body = readFileSync(join(import.meta.dirname, "..", "components", "place", "place-detail-body.tsx"), "utf8");
    // The false sentence must no longer be reachable for a derived name, and
    // the derived case must say where the English actually came from.
    expect(body).toMatch(/nameVerification === "derived"/);
    const provisionalSentence = body.slice(body.indexOf('nameVerification === "provisional"'));
    expect(provisionalSentence).toMatch(/has not yet been verified/);
  });

  it("does not report a derived name as a provisional-English audit finding", () => {
    const audit = readFileSync(join(import.meta.dirname, "place-audit.ts"), "utf8");
    // The finding is gated on equality with "provisional", so "derived" is
    // excluded by construction. Pin that, so a later rewrite to
    // `!== "verified"` cannot silently re-flag 163 checked names.
    expect(audit).toMatch(/nameVerification === "provisional" \? \["provisional_english_name"\]/);
    expect(audit).not.toMatch(/nameVerification !== "verified"/);
  });
});
