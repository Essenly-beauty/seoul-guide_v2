import { BRAND_MARK_SRC, TYPE_LABEL, type Place } from "./data";

export type ImageSource = { src: string; alt: string; kind: "photo" | "brand" };
type PlaceImageData = Pick<Place, "name" | "type" | "photoThumbnail" | "photos" | "photoUrl">;

/** Only data-layer photos and approved retailer assets are eligible. */
export function placeImageSources(place: PlaceImageData): ImageSource[] {
  const photos = [place.photoThumbnail, ...(place.photos ?? []), place.photoUrl]
    .map((src) => src?.trim())
    .filter((src): src is string => Boolean(src));
  const sources: ImageSource[] = [...new Set(photos)].map((src) => ({
    src, alt: `${place.name} photo`, kind: "photo",
  }));
  const brand = BRAND_MARK_SRC[place.type];
  if (brand) sources.push({ src: brand, alt: `${TYPE_LABEL[place.type]} logo`, kind: "brand" });
  return sources;
}

/** A failed thumbnail can use its full photo, then another verified photo. */
export function firstAvailableImage(sources: readonly ImageSource[], failed: readonly string[]): ImageSource | undefined {
  return sources.find(({ src }) => !failed.includes(src));
}
