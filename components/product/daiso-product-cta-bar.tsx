"use client";

import { ProductShareButton } from "@/components/product/product-share-button";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/icon";
import type { DaisoRankingProduct } from "@/lib/daiso-ranking";
import { routes } from "@/lib/routes";

export function DaisoProductCtaBar({ product }: { product: DaisoRankingProduct }) {
  const shareProduct = { id: product.id, brand: product.brand, name: product.nameKr };

  return (
    <nav className="bookbar product-cta-bar" aria-label="Daiso product actions">
      <ProductShareButton variant="soft" product={shareProduct} />
      <Button
        variant="secondary"
        icon="pin"
        className="product-cta-find"
        href={`${routes.map}?cat=daiso`}
      >
        Find nearby Daiso
      </Button>
      <Button className="product-cta-buy" href={product.productUrl} external>
        Buy on Daiso Mall
        <Icon name="ext" size="xs" />
      </Button>
    </nav>
  );
}
