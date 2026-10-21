import type { CSSProperties } from "react";
import { ImageThumbnail } from "@/components/ui/image-thumbnail";

/** No catalogue photo is implied when the source has not supplied one. Product
    shots stay uncropped: cover would clip the package name. */
export function ProductThumbnail({ product, size, className, style, loading, decorative = true }: {
  product: { name?: string; nameKr?: string; imageUrl?: string };
  size?: number;
  className?: string;
  style?: CSSProperties;
  loading?: "eager" | "lazy";
  /** Rows (the default) are named by their own text; the detail hero is not. */
  decorative?: boolean;
}) {
  const name = product.name ?? product.nameKr ?? "Product";
  const src = product.imageUrl?.trim();
  return <ImageThumbnail key={`${name}:${src ?? ""}`} sources={src ? [{ src, alt: `${name} product photo`, kind: "photo" }] : []} fallbackIcon="bag" fallbackLabel={`${name} · photo unavailable`} size={size} className={className} style={style} loading={loading} fit="contain" decorative={decorative} />;
}
