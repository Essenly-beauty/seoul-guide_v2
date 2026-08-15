import { notFound } from "next/navigation";
import { BackButtonBordered } from "@/components/ui/back-button";
import { ProductDetailBody } from "@/components/product/product-detail-body";
import { ProductCtaBar } from "@/components/product/product-cta-bar";
import { routes } from "@/lib/routes";
import { getProduct } from "@/lib/data";

export default async function ProductDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const product = getProduct(params.id);
  if (!product) notFound();

  return (
    <>
      <div className="statusbar-photo" />
      <div className="app-scroll">
        <ProductDetailBody
          product={product}
          heroOverlay={
            /* Back only — share/save live in the sticky CTA bar, mirroring the
               place-detail decision (2026-07-26); the duplicated top heart also
               painted over the back button. */
            <div
              className="row product-detail-hero-actions"
              style={{ position: "absolute", left: 14 }}
            >
              <BackButtonBordered fallback={routes.ranking} />
            </div>
          }
        />
      </div>
      <ProductCtaBar product={product} />
    </>
  );
}
