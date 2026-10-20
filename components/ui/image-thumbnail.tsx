"use client";

import { useState, type CSSProperties } from "react";
import { Icon, type IconName } from "@/components/icon";
import { firstAvailableImage, type ImageSource } from "@/lib/place-images";

type ImageThumbnailProps = {
  sources: readonly ImageSource[];
  fallbackIcon: IconName;
  fallbackLabel: string;
  size?: number;
  className?: string;
  style?: CSSProperties;
  loading?: "eager" | "lazy";
};

/** A compact, uncropped image with a quiet fallback after every source fails. */
export function ImageThumbnail({ sources, fallbackIcon, fallbackLabel, size = 56, className, style, loading = "lazy" }: ImageThumbnailProps) {
  const [failed, setFailed] = useState<string[]>([]);
  const image = firstAvailableImage(sources, failed);
  return (
    <span
      className={["image-thumbnail", className].filter(Boolean).join(" ")}
      data-image-kind={image?.kind ?? "fallback"}
      style={{ width: size, height: size, flex: "none", display: "inline-flex", alignItems: "center", justifyContent: "center", overflow: "hidden", borderRadius: 10, background: "var(--soft)", color: "var(--muted)", ...style }}
      role={image ? undefined : "img"}
      aria-label={image ? undefined : fallbackLabel}
    >
      {image ? (
        // Verified local assets or an explicitly supplied product photo URL.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={image.src}
          src={image.src}
          alt={image.alt}
          loading={loading}
          decoding="async"
          onError={() => setFailed((previous) => [...previous, image.src])}
          style={{ width: "100%", height: "100%", objectFit: "contain", display: "block", background: image.kind === "brand" ? "#fff" : undefined }}
        />
      ) : <Icon name={fallbackIcon} style={{ width: 22, height: 22, strokeWidth: 1.6, opacity: 0.7 }} />}
    </span>
  );
}
