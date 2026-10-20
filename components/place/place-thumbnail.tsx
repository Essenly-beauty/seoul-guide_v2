import type { CSSProperties } from "react";
import { ImageThumbnail } from "@/components/ui/image-thumbnail";
import { TYPE_ICON, TYPE_LABEL, type Place } from "@/lib/data";
import { placeImageSources } from "@/lib/place-images";

export function PlaceThumbnail({ place, size, className, style }: {
  place: Place;
  size?: number;
  className?: string;
  style?: CSSProperties;
}) {
  return <ImageThumbnail key={place.id} sources={placeImageSources(place)} fallbackIcon={TYPE_ICON[place.type]} fallbackLabel={`${TYPE_LABEL[place.type]} · photo unavailable`} size={size} className={className} style={style} />;
}
