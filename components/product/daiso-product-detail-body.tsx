import { Icon } from "@/components/icon";
import { ProductDetailScrollHeader } from "@/components/product/product-detail-scroll-header";
import { AnchorTabs } from "@/components/ui/anchor-tabs";
import { ImgPh } from "@/components/ui/img-ph";
import { SectionDivider } from "@/components/ui/section-divider";
import { SectionHeader } from "@/components/ui/section-header";
import { optionalDaisoDeliveryTags, type DaisoRankingProduct } from "@/lib/daiso-ranking";
import { routes } from "@/lib/routes";

const WON = new Intl.NumberFormat("ko-KR");
const SECTIONS = [
  { id: "p-overview", label: "Overview" },
  { id: "p-details", label: "Details" },
  { id: "p-buy", label: "Buy" },
];

export function DaisoProductDetailBody({
  product,
}: {
  product: DaisoRankingProduct;
}) {
  const deliveryTags = optionalDaisoDeliveryTags(product.delivery);

  return (
    <div className="detail-scroll product-detail-scroll daiso-product-detail">
      <ProductDetailScrollHeader
        title={product.nameKr}
        product={{ id: product.id, brand: product.brand, name: product.nameKr }}
        fallback={routes.rankingRetailer("daiso")}
        rankingHref={routes.rankingRetailer("daiso")}
      >
        <div
          className="product-detail-gallery"
          role="img"
          aria-label={`${product.nameKr} product gallery`}
        >
          <ImgPh className="product-detail-gallery-main">
            <Icon name="bag" style={{ width: 44, height: 44, color: "var(--dim)" }} />
            <span className="caption muted">Product photo coming soon</span>
          </ImgPh>
          <ImgPh><span className="label">{product.brand}</span></ImgPh>
          <ImgPh><span className="label">{product.categoryKr}</span></ImgPh>
        </div>
      </ProductDetailScrollHeader>

      <div className="pad product-detail-title-block" style={{ paddingTop: 8, paddingBottom: 12 }}>
        <span className="caption muted">Daiso Mall ranking product</span>
        <h1 className="h1 product-detail-title daiso-product-title">{product.nameKr}</h1>
        <div className="row small muted product-detail-meta" style={{ gap: 8, marginTop: 8, flexWrap: "wrap" }}>
          <b style={{ color: "var(--text)" }}>{product.brand}</b>
          <span aria-hidden="true">·</span>
          <span>{product.subcategoryKr}</span>
          <span aria-hidden="true">·</span>
          <b className="mono" style={{ color: "var(--text)" }}>₩{WON.format(product.priceWon)}</b>
        </div>
      </div>

      <AnchorTabs sections={SECTIONS} offset={96} />

      <div className="pad stack product-detail-content">
        <section id="p-overview" className="d-sec stack sm product-detail-section">
          <SectionHeader title="Overview" />
          {(product.rating !== null || product.reviewCountText !== null) && (
            <div className="inforow product-detail-fact">
              <span className="muted">Daiso Mall rating</span>
              <b style={{ marginLeft: "auto" }}>
                {product.rating?.toFixed(1)}
                {product.rating !== null && product.reviewCountText !== null ? " · " : ""}
                {product.reviewCountText !== null ? `${product.reviewCountText} reviews` : ""}
              </b>
            </div>
          )}
          {deliveryTags.length > 0 && (
            <div className="daiso-ranking-tags" aria-label="Available fulfillment options">
              {deliveryTags.map((tag) => <span key={tag}>{tag}</span>)}
            </div>
          )}
          <p className="caption muted">Ranking and fulfillment options are chain-wide. Branch availability may vary.</p>
        </section>
        <SectionDivider />
        <section id="p-details" className="d-sec stack sm product-detail-section">
          <SectionHeader title="Details" />
          <dl className="product-detail-facts">
            {[
              ["Brand", product.brand],
              ["Category", product.categoryKr],
              ["Subcategory", product.subcategoryKr],
              ["Price", `₩${WON.format(product.priceWon)}`],
            ].map(([label, value]) => (
              <div key={label} className="inforow product-detail-fact">
                <dt className="muted" style={{ flex: 1 }}>{label}</dt>
                <dd style={{ margin: 0, textAlign: "right", fontWeight: 600 }}>{value}</dd>
              </div>
            ))}
          </dl>
        </section>
        <SectionDivider />
        <section id="p-buy" className="d-sec stack sm product-detail-section">
          <SectionHeader title="Where to buy" />
          <p className="caption muted">Check a nearby Daiso branch or the verified Daiso Mall product page. In-store inventory is not live.</p>
        </section>
      </div>
    </div>
  );
}
