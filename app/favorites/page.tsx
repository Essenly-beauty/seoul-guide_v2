import Link from "next/link";
import { TopBar } from "@/components/ui/top-bar";
import { BottomNav } from "@/components/ui/bottom-nav";
import { HamburgerMenu } from "@/components/ui/hamburger-menu";
import { ActionButton } from "@/components/ui/action-button";
import { FavoriteButton } from "@/components/ui/favorite-button";
import { Tabs } from "@/components/ui/tabs";
import { Icon } from "@/components/icon";
import { KitCta } from "@/components/cards";
import { routes } from "@/lib/routes";
import { PRODUCTS, PLACES, TYPE_LABEL, TYPE_ICON, zoneShort } from "@/lib/data";

const favProducts = PRODUCTS.slice(0, 3);
const favPlaces = PLACES.filter((p) => p.type === "salon" || p.type === "spa").slice(0, 2);

function ProductsPanel() {
  return (
    <>
      {favProducts.map((prod) => (
        <div className="prodcard" key={prod.id}>
          <Link href={routes.shopItem(prod.id)} className="row" style={{ gap: 12, flex: 1 }}>
            <div className="thumb hero-img" />
            <div style={{ flex: 1 }}>
              <b>{prod.name}</b>
              <div className="name-kr">{prod.nameKr}</div>
              <div className="caption muted" style={{ marginTop: 3 }}>{prod.brand} · {prod.priceRange}</div>
            </div>
          </Link>
          <FavoriteButton initial />
        </div>
      ))}
    </>
  );
}

function PlacesPanel() {
  return (
    <>
      {favPlaces.map((p) => (
        <div className="placecard" key={p.id} style={{ position: "relative" }}>
          <Link href={routes.place(p.id)} className="row" style={{ gap: 12, flex: 1, alignItems: "flex-start" }}>
            <div className="thumb hero-img" style={{ display: "grid", placeItems: "center" }}>
              <Icon name={TYPE_ICON[p.type]} style={{ color: "var(--accent)" }} />
            </div>
            <div style={{ flex: 1 }}>
              <span className="label">{TYPE_LABEL[p.type]} · {zoneShort(p.zone)}</span>
              <h3 style={{ fontSize: 17, margin: "2px 0" }}>{p.name}</h3>
              <div className="name-kr">{p.nameKr}</div>
              <div className="meta"><span className="chip mono" style={{ padding: "3px 8px" }}>{p.priceRange}</span></div>
            </div>
          </Link>
          <div style={{ position: "absolute", top: 10, right: 10 }}><FavoriteButton initial /></div>
        </div>
      ))}
    </>
  );
}

export default function FavoritesPage() {
  return (
    <>
      <TopBar
        left={<HamburgerMenu />}
        title="Favorites"
        right={
          <ActionButton className="iconbtn" aria-label="Share" share="My K-Beauty list from Essenly">
            <Icon name="share" size="sm" />
          </ActionButton>
        }
      />
      <div className="app-scroll pad stack">
        <div>
          <div className="label">Saved</div>
          <div className="h1">Your <span style={{ fontStyle: "italic", color: "var(--accent)" }}>K-beauty list.</span></div>
        </div>
        <Tabs
          panels={[
            { key: "products", label: `Products (${favProducts.length})`, content: <ProductsPanel /> },
            { key: "places", label: `Places (${favPlaces.length})`, content: <PlacesPanel /> },
          ]}
        />
        <KitCta href={routes.kitSurvey} title="You have favorites! Get a free kit to match." subtitle="Personalized to your hair profile and shipped to your Seoul stay." />
      </div>
      <BottomNav active="my" />
    </>
  );
}
