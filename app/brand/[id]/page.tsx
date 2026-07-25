import Link from "next/link";
import { notFound } from "next/navigation";
import { TopBar } from "@/components/ui/top-bar";
import { BottomNav } from "@/components/ui/bottom-nav";
import { BackButton } from "@/components/ui/back-button";
import { Icon } from "@/components/icon";
import { ImgPh } from "@/components/ui/img-ph";
import { routes } from "@/lib/routes";
import { PRODUCTS, brandSlug } from "@/lib/data";

export default function BrandPage({ params }: { params: { id: string } }) {
  const products = PRODUCTS.filter((p) => brandSlug(p.brand) === params.id);
  if (products.length === 0) notFound();
  const brandName = products[0].brand;

  return (
    <>
      <TopBar center left={<BackButton fallback={routes.ranking} />} title="Brand" />
      <div className="app-scroll pad stack">
        <div>
          <div className="label">Brand</div>
          <h1 className="h1" style={{ textTransform: "capitalize" }}>{brandName}</h1>
          <p className="muted" style={{ marginTop: 6 }}>{products.length} product{products.length === 1 ? "" : "s"} on Essenly.</p>
        </div>

        {products.map((p) => (
          <Link className="listrow v2" key={p.id} href={routes.shopItem(p.id)}>
            <ImgPh className="thumb56" />
            <div style={{ flex: 1, minWidth: 0 }}>
              <b className="t-label-md" style={{ fontSize: 14, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</b>
              <div className="t-caption" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.nameKr}</div>
            </div>
            {p.priceRange && <span className="mono num t-label-md" style={{ fontWeight: 700, flex: "none" }}>{p.priceRange}</span>}
            <Icon name="chev" size="sm" style={{ color: "var(--dim)" }} />
          </Link>
        ))}
      </div>
      <BottomNav active="ranking" />
    </>
  );
}
