"use client";

import { IconButton } from "@/components/ui/icon-button";
import { useToast } from "@/components/ui/toast";
import type { Product } from "@/lib/data";

type ProductShareButtonProps = {
  product: Pick<Product, "id" | "brand" | "name">;
  variant?: "plain" | "soft" | "overlay";
  className?: string;
  "aria-label"?: string;
};

export function ProductShareButton({
  product,
  variant = "plain",
  className,
  "aria-label": ariaLabel = "Share product",
}: ProductShareButtonProps) {
  const { share } = useToast();

  return (
    <IconButton
      name="share"
      label={ariaLabel}
      variant={variant}
      className={className}
      onClick={() => {
        const url = new URL(
          `/shop/${encodeURIComponent(product.id)}`,
          window.location.origin,
        ).toString();

        share({
          title: product.name,
          text: `Discover ${product.name} by ${product.brand} on Essenly.`,
          url: url,
        });
      }}
    />
  );
}
