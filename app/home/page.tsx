import Link from "next/link";
import { BottomNav } from "@/components/ui/bottom-nav";
import { HamburgerMenu } from "@/components/ui/hamburger-menu";
import { Icon, BrandMark, type IconName } from "@/components/icon";
import { routes } from "@/lib/routes";
import { PRODUCTS, PLACES, TYPE_LABEL, zoneShort } from "@/lib/data";

const HUBS: { icon: IconName; title: string; desc: string; href: string }[] = [
  { icon: "bag", title: "Shop", desc: `${PRODUCTS.length}+ items · ranked for you`, href: routes.shop },
  { icon: "pin", title: "Spot", desc: "Districts · Hair · Spa · Clinic · Nail", href: routes.spot },
  { icon: "book", title: "Journal", desc: "Tips, guides, and stories", href: routes.journal },
];

const editorsPicks = PRODUCTS.filter((p) => p.isEditorsPick || p.isTrending).slice(0, 6);
const featured = [...PLACES].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0)).slice(0, 5);

export default function HomePage() {
  return (
    <>
      <div className="topbar">
        <HamburgerMenu />
        <span className="row" style={{ flex: 1, gap: 8, justifyContent: "center" }}>
          <BrandMark size={22} />
          <span className="title" style={{ flex: "none" }}>Essenly Seoul Guide</span>
        </span>
        <Link className="iconbtn" href={routes.search} aria-label="Search">
          <Icon name="search" />
        </Link>
        <Link className="iconbtn" href={routes.map} aria-label="Map">
          <Icon name="pin" />
        </Link>
      </div>

      <div className="app-scroll pad stack">
        <div style={{ padding: "6px 0 2px" }}>
          <div className="hero">
            Find your
            <br />
            <span style={{ fontStyle: "italic", color: "var(--accent)" }}>K-beauty match.</span>
          </div>
          <p className="muted" style={{ marginTop: 8 }}>Curated for Dry · Straight · Hydration + Brightening</p>
        </div>

        <div className="label" style={{ marginTop: 4 }}>Browse</div>
        <h2 className="h2" style={{ marginTop: -6 }}>Where to start</h2>
        {HUBS.map((h) => (
          <Link key={h.title} className="hubcard" href={h.href}>
            <span className="ic"><Icon name={h.icon} /></span>
            <div>
              <h3>{h.title}</h3>
              <div className="caption muted">{h.desc}</div>
            </div>
            <Icon name="chev" size="sm" className="chev" />
          </Link>
        ))}

        <div className="section-head" style={{ marginTop: 8 }}>
          <div>
            <div className="label">Editor&apos;s Pick</div>
            <h2 className="h2">For your skin</h2>
          </div>
          <Link className="seeall" href={routes.shop}>see all <Icon name="chev" size="xs" /></Link>
        </div>
        <div className="rail">
          {editorsPicks.map((p) => (
            <Link key={p.id} className="railcard" href={routes.shopItem(p.id)}>
              <div className="cover hero-img">
                {p.isEditorsPick && <span className="pill">Editor</span>}
              </div>
              <div className="body">
                <div className="rc-eyebrow">{p.brand}</div>
                <div className="rc-name">{p.name}</div>
                <div className="rc-sub muted">{p.priceRange ?? "K-beauty pick"} · {p.skinTypes[0] ?? "All"}</div>
              </div>
            </Link>
          ))}
        </div>

        <div className="section-head" style={{ marginTop: 4 }}>
          <div>
            <div className="label">Featured</div>
            <h2 className="h2">Featured tonight</h2>
          </div>
          <Link className="seeall" href={routes.spot}>see all <Icon name="chev" size="xs" /></Link>
        </div>
        <div className="rail">
          {featured.map((pl, i) => (
            <Link key={pl.id} className="railcard" href={routes.place(pl.id)}>
              <div className="cover hero-img">
                {i === 0 && <span className="pill">Featured</span>}
              </div>
              <div className="body">
                <div className="rc-name rc-1">{pl.name}</div>
                <div className="rc-meta">{TYPE_LABEL[pl.type]} · {zoneShort(pl.zone)}</div>
                <div className="rc-sub"><span className="stars">★ {pl.rating}</span> <span className="dim">({pl.ratingCount})</span></div>
              </div>
            </Link>
          ))}
        </div>
      </div>
      <BottomNav active="map" />
    </>
  );
}
