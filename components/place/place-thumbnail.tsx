import type { CSSProperties } from "react";
import { ImageThumbnail } from "@/components/ui/image-thumbnail";
import { TYPE_ICON, TYPE_LABEL, type Place } from "@/lib/data";
import { placeImageSources } from "@/lib/place-images";

/** Row media: decorative by default — every caller sits inside a row link or
    button that the place name already labels. */
export function PlaceThumbnail({ place, size, className, style, decorative = true }: {
  place: Place;
  size?: number;
  className?: string;
  style?: CSSProperties;
  decorative?: boolean;
}) {
  return <ImageThumbnail key={place.id} sources={placeImageSources(place)} fallbackIcon={TYPE_ICON[place.type]} fallbackLabel={`${TYPE_LABEL[place.type]} · photo unavailable`} size={size} className={className} style={style} decorative={decorative} />;
}
