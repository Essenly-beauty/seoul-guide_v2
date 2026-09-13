export type PhotoSourcePlace = {
  id: string;
  slug: string;
  nameEn: string;
  nameKr: string;
  verified: boolean;
};

export type DrivePhotoFolder = {
  id: string;
  title: string;
  url: string;
};

export type PlacePhotoImportReady = DrivePhotoFolder & {
  numericId: string;
  label: string;
  placeId: string;
};

export type PlacePhotoImportReview = DrivePhotoFolder & {
  numericId: string;
  label: string;
  reason: "invalid_folder_name" | "unknown_place_id" | "place_unverified" | "name_mismatch";
};

function normalizeName(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("en")
    .replace(/[^a-z0-9가-힣]+/g, "");
}

function labelMatchesPlace(label: string, place: PhotoSourcePlace): boolean {
  const candidate = normalizeName(label);
  if (!candidate) return false;

  return [place.nameEn, place.nameKr]
    .map(normalizeName)
    .some((canonical) => canonical === candidate || canonical.startsWith(candidate));
}

export function buildPlacePhotoImportPlan(
  places: readonly PhotoSourcePlace[],
  folders: readonly DrivePhotoFolder[],
): { ready: PlacePhotoImportReady[]; review: PlacePhotoImportReview[] } {
  const placesById = new Map(places.map((place) => [place.id, place]));
  const ready: PlacePhotoImportReady[] = [];
  const review: PlacePhotoImportReview[] = [];

  for (const folder of folders) {
    const match = /^(\d{3})_(.+)$/.exec(folder.title.trim());
    const numericId = match?.[1] ?? "";
    const label = match?.[2]?.trim() ?? folder.title.trim();
    const place = placesById.get(numericId);

    if (!match) {
      review.push({ ...folder, numericId, label, reason: "invalid_folder_name" });
    } else if (!place) {
      review.push({ ...folder, numericId, label, reason: "unknown_place_id" });
    } else if (!place.verified) {
      review.push({ ...folder, numericId, label, reason: "place_unverified" });
    } else if (!labelMatchesPlace(label, place)) {
      review.push({ ...folder, numericId, label, reason: "name_mismatch" });
    } else {
      ready.push({ ...folder, numericId, label, placeId: `ados-${place.slug}` });
    }
  }

  const byNumericId = (a: { numericId: string }, b: { numericId: string }) =>
    a.numericId.localeCompare(b.numericId, "en", { numeric: true });

  return { ready: ready.sort(byNumericId), review: review.sort(byNumericId) };
}
