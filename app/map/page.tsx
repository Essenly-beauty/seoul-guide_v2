import Link from "next/link";
import { Icon } from "@/components/icon";
import { routes } from "@/lib/routes";
import { PLACES, TYPE_LABEL, zoneShort } from "@/lib/data";

const nearby = [...PLACES].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0)).slice(0, 8);

export default function MapPage() {
  return (
    <>
      <div className="topbar" style={{ gap: 8 }}>
        <Link className="row" href={routes.spot} style={{ flex: 1, gap: 8, background: "var(--surface-hover)", borderRadius: 999, padding: "10px 14px" }}>
          <Icon name="pin" size="sm" style={{ color: "var(--muted)" }} />
          <span className="small muted">Search studios, salons, clinics nearby</span>
        </Link>
        <Link className="iconbtn" href={routes.home} aria-label="Close"><Icon name="x" size="sm" /></Link>
      </div>

      <div className="app-scroll pad stack">
        <div className="chiprow">
          {["Filter", "Location", "Open now", "Top rated"].map((c) => (
            <span key={c} className="chip soft">{c}</span>
          ))}
        </div>

        <div className="hero-img" style={{ aspectRatio: "1 / 1", position: "relative", borderRadius: "var(--r-lg)" }}>
          <Icon name="pin" style={{ width: 44, height: 44, color: "var(--accent)" }} />
          <span className="caption dim" style={{ position: "absolute", bottom: 12 }}>Showing beauty spots around central Seoul.</span>
        </div>

        <div className="label">Nearby</div>
        {nearby.map((p) => (
          <Link className="placecard" key={p.id} href={routes.place(p.id)}>
            <div className="thumb hero-img" style={{ display: "grid", placeItems: "center" }}><Icon name="pin" style={{ color: "var(--accent)" }} /></div>
            <div style={{ flex: 1 }}>
              <span className="label">{TYPE_LABEL[p.type]} · {zoneShort(p.zone)}</span>
              <h3 style={{ fontSize: 16, margin: "2px 0" }}>{p.name}</h3>
              <div className="caption"><span className="stars">★ {p.rating}</span> · <span className="mono">{p.priceRange}</span></div>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
