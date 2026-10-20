import type { CSSProperties } from "react";
import { ImageThumbnail } from "@/components/ui/image-thumbnail";

/** No catalogue photo is implied when the source has not supplied one. */
export function ProductThumbnail({ product, size, className, style, loading }: {
  product: { name?: string; nameKr?: string; imageUrl?: string };
  size?: number;
  className?: string;
  style?: CSSProperties;
  loading?: "eager" | "lazy";
}) {
  const name = product.name ?? product.nameKr ?? "Product";
  const src = product.imageUrl?.trim();
  return <ImageThumbnail key={`${name}:${src ?? ""}`} sources={src ? [{ src, alt: `${name} product photo`, kind: "photo" }] : []} fallbackIcon="bag" fallbackLabel={`${name} · photo unavailable`} size={size} className={className} style={style} loading={loading} />;
}
