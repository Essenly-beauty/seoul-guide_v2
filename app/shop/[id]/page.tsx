import { notFound } from "next/navigation";
import { BackButtonBordered } from "@/components/ui/back-button";
import { FavoriteButton } from "@/components/ui/favorite-button";
import { ProductDetailBody } from "@/components/product/product-detail-body";
import { ProductCtaBar } from "@/components/product/product-cta-bar";
import { ProductShareButton } from "@/components/product/product-share-button";
import { routes } from "@/lib/routes";
import { getProduct } from "@/lib/data";

export default function ProductDetailPage({ params }: { params: { id: string } }) {
  const product = getProduct(params.id);
  if (!product) notFound();

  return (
    <>
      <div className="statusbar-photo" />
      <div className="app-scroll">
        <ProductDetailBody
          product={product}
          heroOverlay={
            <div
              className="row between product-detail-hero-actions"
              style={{ position: "absolute", left: 14, right: 14 }}
            >
              <BackButtonBordered fallback={routes.ranking} />
              <span className="row" style={{ gap: 8 }}>
                <ProductShareButton
                  variant="overlay"
                  aria-label="Share"
                  product={product}
                />
                <FavoriteButton kind="product" id={product.id} variant="bordered" />
              </span>
            </div>
          }
        />
      </div>
      <ProductCtaBar product={product} />
    </>
  );
}
