export const PLACE_PHOTO_TARGET_MIN = 3;
export const PLACE_PHOTO_TARGET_MAX = 5;

export function mergeFillOnlyPhotos(
  existing: readonly string[] | undefined,
  candidates: readonly string[] | undefined,
  maximum = PLACE_PHOTO_TARGET_MAX,
): string[] {
  const merged = [...(existing ?? [])];
  const seen = new Set(merged);
  for (const candidate of candidates ?? []) {
    if (!candidate || seen.has(candidate) || merged.length >= maximum) continue;
    merged.push(candidate);
    seen.add(candidate);
  }
  return merged;
}

export function fillEmptyValue<T>(existing: T | null | undefined, candidate: T): T {
  if (existing === null || existing === undefined || existing === "") return candidate;
  return existing;
}
