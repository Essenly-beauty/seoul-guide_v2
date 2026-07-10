import Link from "next/link";
import { notFound } from "next/navigation";
import { TopBar } from "@/components/ui/top-bar";
import { BottomNav } from "@/components/ui/bottom-nav";
import { BackButton } from "@/components/ui/back-button";
import { Icon } from "@/components/icon";
import { routes } from "@/lib/routes";
import { PRODUCTS } from "@/lib/data";

const slugify = (s: string) => s.toLowerCase().replace(/\s+/g, "-");

export default function BrandPage({ params }: { params: { id: string } }) {
  const products = PRODUCTS.filter((p) => slugify(p.brand) === params.id);
  if (products.length === 0) notFound();
  const brandName = products[0].brand;

  return (
    <>
      <TopBar center left={<BackButton fallback={routes.shop} />} title="Brand" />
      <div className="app-scroll pad stack">
        <div>
          <div className="label">Brand</div>
          <h1 className="h1" style={{ textTransform: "capitalize" }}>{brandName}</h1>
          <p className="muted" style={{ marginTop: 6 }}>{products.length} product{products.length === 1 ? "" : "s"} on Essenly.</p>
        </div>

        {products.map((p) => (
          <Link className="prodcard" key={p.id} href={routes.shopItem(p.id)}>
            <div className="thumb hero-img" />
            <div style={{ flex: 1 }}>
              <b style={{ display: "block" }}>{p.name}</b>
              <div className="name-kr">{p.nameKr}</div>
              <div className="caption muted" style={{ marginTop: 3 }}>{p.priceRange ?? ""}</div>
            </div>
            <Icon name="chev" size="sm" style={{ color: "var(--dim)", alignSelf: "center" }} />
          </Link>
        ))}
      </div>
      <BottomNav active="ranking" />
    </>
  );
}
