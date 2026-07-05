import Link from "next/link";
import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/icon";

/** Free-kit call-to-action banner (links to the kit survey by default). */
export function KitCta({
  href,
  title,
  subtitle,
  trailing,
}: {
  href: string;
  title: ReactNode;
  subtitle?: ReactNode;
  /** Right-side element; defaults to a chevron arrow. */
  trailing?: ReactNode;
}) {
  return (
    <Link className="kitcta" href={href}>
      <span className="ic"><Icon name="gift" size="sm" /></span>
      <span>
        <b style={{ color: "var(--accent)" }}>{title}</b>
        {subtitle && <div className="caption muted">{subtitle}</div>}
      </span>
      {trailing ?? <Icon name="chev" size="sm" className="arrow" />}
    </Link>
  );
}

/** Category picker card (icon + title + description). */
export function CatCard({ href, icon, title, desc }: { href: string; icon: IconName; title: string; desc: string }) {
  return (
    <Link className="catcard" href={href}>
      <span className="ic"><Icon name={icon} /></span>
      <div>
        <h3>{title}</h3>
        <div className="caption muted">{desc}</div>
      </div>
    </Link>
  );
}

/** Place list card with an icon thumbnail. */
export function PlaceCard({
  href,
  icon,
  label,
  name,
  nameKr,
  meta,
}: {
  href: string;
  icon: IconName;
  label: string;
  name: string;
  nameKr: string;
  meta?: ReactNode;
}) {
  return (
    <Link className="placecard" href={href}>
      <div className="thumb hero-img" style={{ display: "grid", placeItems: "center" }}>
        <Icon name={icon} style={{ color: "var(--accent)" }} />
      </div>
      <div style={{ flex: 1 }}>
        <span className="label">{label}</span>
        <h3 style={{ fontSize: 17, margin: "2px 0" }}>{name}</h3>
        <div className="name-kr">{nameKr}</div>
        {meta && <div className="meta">{meta}</div>}
      </div>
    </Link>
  );
}

/** Product routine row with a numbered step label + chevron. */
export function ProductRow({ href, step, name, nameKr }: { href: string; step: string; name: string; nameKr: string }) {
  return (
    <Link className="prodcard" href={href}>
      <div className="thumb hero-img" />
      <div style={{ flex: 1 }}>
        <span className="label">{step}</span>
        <b style={{ display: "block" }}>{name}</b>
        <div className="name-kr">{nameKr}</div>
      </div>
      <Icon name="chev" size="sm" style={{ color: "var(--dim)", alignSelf: "center" }} />
    </Link>
  );
}
