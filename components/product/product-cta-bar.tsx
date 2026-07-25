"use client";

import { ProductShareButton } from "@/components/product/product-share-button";
import { Button } from "@/components/ui/button";
import { FavoriteButton } from "@/components/ui/favorite-button";
import { Icon } from "@/components/icon";
import type { Product } from "@/lib/data";
import { routes } from "@/lib/routes";

export function ProductCtaBar({ product }: { product: Product }) {
  const storeCategory = product.channel === "olive_young" ? "olive_young" : "mall";
  const verifiedOnlineUrl =
    product.onlineUrl && product.onlineUrlVerifiedAt ? product.onlineUrl : null;

  return (
    <nav className="bookbar product-cta-bar" aria-label="Product actions">
      <ProductShareButton
        className="iconbtn soft product-cta-share"
        aria-label="Share product"
        product={product}
      />
      <FavoriteButton kind="product" id={product.id} variant="soft" />
      <Button
        variant="secondary"
        icon="pin"
        className="product-cta-find"
        href={`${routes.map}?cat=${storeCategory}`}
      >
        Find nearby
      </Button>
      {verifiedOnlineUrl ? (
        <Button
          className="product-cta-buy"
          href={verifiedOnlineUrl}
          external
        >
          Buy online
          <Icon name="ext" size="xs" />
        </Button>
      ) : (
        <span
          className="btn product-cta-buy product-cta-unavailable"
          role="status"
          aria-label="Online purchase unavailable because no retailer link is verified"
        >
          Online unavailable
        </span>
      )}
    </nav>
  );
}
