"use client";

import { Icon } from "@/components/icon";
import { useToast } from "@/components/ui/toast";
import type { Product } from "@/lib/data";

type ProductShareButtonProps = {
  product: Pick<Product, "id" | "brand" | "name">;
  className?: string;
  "aria-label"?: string;
};

export function ProductShareButton({
  product,
  className,
  "aria-label": ariaLabel = "Share product",
}: ProductShareButtonProps) {
  const { share } = useToast();

  return (
    <button
      type="button"
      className={className}
      aria-label={ariaLabel}
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
    >
      <Icon name="share" size="sm" />
    </button>
  );
}
