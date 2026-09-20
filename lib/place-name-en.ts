// Verified English display names for places whose generated name is an
// unusable machine transliteration.
//
// scripts/lib/hangul-romanize.mjs transliterates Korean syllable by syllable
// and re-joins the runs with no separator, which produces names like
// "Daiso Hanaromateudongseoulnonghyeopjangan" — unreadable, sometimes
// misspelled against the official romanization (청량리 is Cheongnyangni, not
// "Cheongryangri"), and, worst for the visitor, indistinguishable from the
// next branch once a list row truncates it.
//
// Corrections live in a JSON file keyed by place id rather than in the
// generated modules, so a pipeline rerun re-applies them instead of quietly
// restoring the bad name — the same pattern as scripts/lib/kr-name-overrides
// .json. Each entry records the Korean name it was verified against, so a
// rebuild that moves that name fails a test rather than shipping a stale
// English name.

import overrides from "../scripts/lib/en-name-overrides.json";

export type EnNameOverride = {
  nameEn: string;
  /** The nameKr this English name was checked against. */
  nameKrAtVerification: string;
  /** Where the English came from: station-vocabulary, chain-vocabulary, … */
  basis?: string;
  note?: string;
};

export const EN_NAME_OVERRIDES = overrides as unknown as Record<string, EnNameOverride>;

/** Replaces the display name where a verified English name exists AND the
    Korean name still matches the one it was verified against. */
export function applyEnglishNameOverrides<T extends { id: string; name: string; nameKr: string }>(places: T[]): T[] {
  return places.map((place) => {
    const entry = EN_NAME_OVERRIDES[place.id];
    if (!entry || entry.nameKrAtVerification !== place.nameKr) return place;
    return { ...place, name: entry.nameEn };
  });
}

/** Places whose names cannot be told apart once a list row truncates them. */
export function truncationCollisions<T extends { name: string; nameKr: string; id: string }>(
  places: readonly T[],
  cut: number,
): { groups: string[][]; places: number } {
  const byPrefix = new Map<string, Map<string, T>>();
  for (const place of places) {
    const key = place.name.slice(0, cut).toLowerCase().trim();
    if (!byPrefix.has(key)) byPrefix.set(key, new Map());
    // keyed by the Korean name: the same branch listed twice is not a collision
    byPrefix.get(key)!.set(place.nameKr || place.id, place);
  }
  const groups: string[][] = [];
  let count = 0;
  for (const [, members] of byPrefix) {
    if (members.size < 2) continue;
    groups.push([...members.keys()]);
    count += members.size;
  }
  return { groups, places: count };
}
