import { notFound } from "next/navigation";
import { ProductDetailBody } from "@/components/product/product-detail-body";
import { ProductCtaBar } from "@/components/product/product-cta-bar";
import { DaisoProductDetailBody } from "@/components/product/daiso-product-detail-body";
import { DaisoProductCtaBar } from "@/components/product/daiso-product-cta-bar";
import { getProduct } from "@/lib/data";
import { getDaisoProduct, parseDaisoProductRouteId } from "@/lib/daiso-product-detail";

export default async function ProductDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const product = getProduct(params.id);
  if (product) {
    return (
      <>
        <div className="statusbar-photo" />
        <div className="app-scroll">
          <ProductDetailBody product={product} />
        </div>
        <ProductCtaBar product={product} />
      </>
    );
  }

  const daisoProductNo = parseDaisoProductRouteId(params.id);
  const daisoProduct = daisoProductNo ? getDaisoProduct(daisoProductNo) : null;
  if (!daisoProduct) notFound();

  return (
    <>
      <div className="statusbar-photo" />
      <div className="app-scroll">
        <DaisoProductDetailBody product={daisoProduct} />
      </div>
      <DaisoProductCtaBar product={daisoProduct} />
    </>
  );
}
