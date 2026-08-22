"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Icon } from "@/components/icon";
import { ProductShareButton } from "@/components/product/product-share-button";
import { AnchorTabs } from "@/components/ui/anchor-tabs";
import { BackButton } from "@/components/ui/back-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { FavoriteButton } from "@/components/ui/favorite-button";
import { ImgPh } from "@/components/ui/img-ph";
import { Notice } from "@/components/ui/notice";
import { SectionDivider } from "@/components/ui/section-divider";
import { SectionHeader } from "@/components/ui/section-header";
import { useDialogFocus } from "@/components/ui/use-dialog-focus";
import { routes } from "@/lib/routes";
import {
  CHANNEL_LABEL,
  STEP_LABEL,
  brandSlug,
  zoneShort,
  type Product,
} from "@/lib/data";

const SECTIONS = [
  { id: "p-overview", label: "Overview" },
  { id: "p-details", label: "Details" },
  { id: "p-buy", label: "Buy" },
  { id: "p-routine", label: "Routine" },
];
const STICKY_OFFSET = 96;

const cap = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

function ProductTitleBlock({ product }: { product: Product }) {
  return (
    <div className="product-detail-title-block">
      <span className="caption muted product-detail-eyebrow">{product.nameKr}</span>
      <div
        className="row product-detail-title-row"
        style={{ gap: 8, alignItems: "baseline", flexWrap: "wrap" }}
      >
        <h1
          className="h1 product-detail-title"
          style={{ fontFamily: "var(--sans)", fontSize: 21, fontWeight: 700 }}
        >
          {product.name}
        </h1>
        <span className="small muted product-detail-category">{cap(product.category)}</span>
      </div>
      <div
        className="row small muted product-detail-meta"
        style={{ gap: 8, marginTop: 8, flexWrap: "wrap" }}
      >
        <Link
          href={routes.brand(brandSlug(product.brand))}
          style={{ color: "var(--text)", fontWeight: 700 }}
        >
          {product.brand}
        </Link>
        <span aria-hidden="true">·</span>
        <span>{CHANNEL_LABEL[product.channel]}</span>
        {product.priceRange && (
          <>
            <span aria-hidden="true">·</span>
            <b className="mono" style={{ color: "var(--text)" }}>{product.priceRange}</b>
          </>
        )}
      </div>
      <div className="chipwrap product-detail-badges" style={{ marginTop: 10 }}>
        {product.isEditorsPick && (
          <Badge tone="accent">
            <Icon name="check" size="xs" />
            Editor&apos;s Pick
          </Badge>
        )}
        {product.isTrending && <Badge tone="warning">Trending</Badge>}
        {product.stepCategory && (
          <Badge tone="info">{STEP_LABEL[product.stepCategory]}</Badge>
        )}
      </div>
    </div>
  );
}

function StoreStaffCard({ product }: { product: Product }) {
  const [open, setOpen] = useState(false);
  const [host, setHost] = useState<Element | null>(null);
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useDialogFocus<HTMLDivElement>(open, () => setOpen(false), closeRef);

  useEffect(() => {
    setHost(document.querySelector(".app-shell"));
  }, []);

  return (
    <>
      <button
        type="button"
        className="inforow product-detail-copy-row"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? titleId : undefined}
        onClick={() => setOpen(true)}
      >
        <Icon name="bag" size="xs" />
        <span className="product-detail-copy-text" style={{ minWidth: 0 }}>
          <b>{product.nameKr}</b>
          <span className="caption muted">Show this product to store staff.</span>
        </span>
        <span className="small chev product-detail-copy">Show</span>
      </button>

      {open && host && createPortal(
        <div className="modal" onClick={(event) => event.target === event.currentTarget && setOpen(false)}>
          <div
            ref={dialogRef}
            className="box product-staff-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
          >
            <div className="product-staff-modal-visual">
              {product.imageUrl ? (
                // URLs are data-driven and may be local or externally verified, so the
                // browser image path is intentionally used instead of Next image optimization.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={product.imageUrl} alt={`${product.brand} ${product.name}`} />
              ) : (
                <div
                  className="product-staff-modal-placeholder"
                  role="img"
                  aria-label={`${product.brand} ${product.name} image not available`}
                >
                  <Icon name="bag" style={{ width: 48, height: 48 }} aria-hidden="true" />
                  <span className="label">{product.brand}</span>
                  <span className="caption muted">Product image coming soon</span>
                </div>
              )}
            </div>
            <div className="product-staff-modal-copy-block">
              <div className="product-staff-modal-kicker">직원에게 이 화면을 보여주세요</div>
              <div className="caption muted">Show this screen to store staff</div>
              <h2 id={titleId} className="product-staff-modal-question">
                {product.nameKr} 위치를 안내해 주세요.
              </h2>
              <p className="product-staff-modal-meta">{product.brand} · {product.name}</p>
            </div>
            <Button buttonRef={closeRef} full onClick={() => setOpen(false)}>Close</Button>
          </div>
        </div>,
        host,
      )}
    </>
  );
}

function OverviewSection({ product }: { product: Product }) {
  const matchBits = [
    product.skinTypes[0] && `${product.skinTypes[0].toLowerCase()} skin`,
    product.concerns[0]?.toLowerCase(),
  ].filter(Boolean);

  return (
    <section id="p-overview" className="d-sec stack sm product-detail-section">
      <SectionHeader title="Overview" />
      {matchBits.length > 0 && (
        <Notice tone="info" icon="check">
          Matches your {matchBits.join(" + ")} concerns.
        </Notice>
      )}
      <StoreStaffCard product={product} />
      <div className="inforow">
        <Icon name="bag" size="xs" />
        <span>{CHANNEL_LABEL[product.channel]}</span>
        <span className="caption muted chev">
          {product.priceRange ? `${product.priceRange} price range` : "Check store price"}
        </span>
      </div>
    </section>
  );
}

function DetailsSection({ product }: { product: Product }) {
  const facts = [
    {
      label: "Brand",
      value: (
        <Link href={routes.brand(brandSlug(product.brand))} style={{ color: "var(--accent)" }}>
          {product.brand} ›
        </Link>
      ),
    },
    {
      label: "Category",
      value: `${cap(product.category)}${product.stepCategory ? ` · ${STEP_LABEL[product.stepCategory]}` : ""}`,
    },
    { label: "Channel", value: CHANNEL_LABEL[product.channel] },
    ...(product.priceRange ? [{ label: "Price", value: product.priceRange }] : []),
  ];

  return (
    <section id="p-details" className="d-sec stack sm product-detail-section">
      <SectionHeader title="Details" />
      <dl className="product-detail-facts">
        {facts.map((fact) => (
          <div key={fact.label} className="inforow product-detail-fact">
            <dt className="muted" style={{ flex: 1 }}>{fact.label}</dt>
            <dd style={{ margin: 0, textAlign: "right", fontWeight: 600 }}>{fact.value}</dd>
          </div>
        ))}
      </dl>
      {product.skinTypes.length > 0 && (
        <div className="product-detail-chip-group">
          <div className="label">Best for</div>
          <div className="chipwrap" style={{ marginTop: 6 }}>
            {product.skinTypes.map((skinType) => (
              <Chip key={skinType}>{skinType}</Chip>
            ))}
          </div>
        </div>
      )}
      {product.concerns.length > 0 && (
        <div className="product-detail-chip-group">
          <div className="label">Targets</div>
          <div className="chipwrap" style={{ marginTop: 6 }}>
            {product.concerns.map((concern) => (
              <Chip key={concern}>{concern}</Chip>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function BuySection({ product }: { product: Product }) {
  const storeCategory = product.channel === "olive_young" ? "olive_young" : "mall";
  const verifiedOnlineUrl =
    product.onlineUrl && product.onlineUrlVerifiedAt ? product.onlineUrl : null;

  return (
    <section id="p-buy" className="d-sec stack sm product-detail-section">
      <SectionHeader title="Where to buy in Seoul" />
      {product.zoneAvailability && product.zoneAvailability.length > 0 ? (
        <div className="product-detail-zones">
          <div className="label">Areas to check</div>
          <div className="chipwrap" style={{ marginTop: 6 }}>
            {product.zoneAvailability.map((zone) => (
              <Chip key={zone}>{zoneShort(zone)}</Chip>
            ))}
          </div>
          <p className="caption muted product-detail-availability-note">
            Area coverage is a shopping guide, not live store inventory.
          </p>
        </div>
      ) : (
        <p className="caption muted">Availability varies by store. Check before visiting.</p>
      )}

      {verifiedOnlineUrl ? (
        <a
          className="inforow product-detail-buy-online"
          href={verifiedOnlineUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          <Icon name="ext" size="xs" />
          <span className="product-detail-purchase-copy">
            <b>Buy online</b>
            <span className="caption muted">
              Retailer link verified {product.onlineUrlVerifiedAt}
            </span>
          </span>
          <Icon name="chev" size="xs" className="chev" />
        </a>
      ) : (
        <Notice tone="warning" icon="bag" className="product-stock-status">
          <b>Stock not verified</b>
          <span className="caption">
            No verified online seller or branch inventory is available yet.
          </span>
        </Notice>
      )}

      <Link
        className="inforow product-detail-store-search"
        href={`${routes.map}?cat=${storeCategory}`}
      >
        <Icon name="pin" size="xs" />
        <span>Search nearby stores</span>
        <span className="caption muted chev">
          {CHANNEL_LABEL[product.channel]}
        </span>
        <Icon name="chev" size="xs" />
      </Link>
    </section>
  );
}

function RoutineSection({ product }: { product: Product }) {
  const step = product.stepCategory ? STEP_LABEL[product.stepCategory] : cap(product.category);
  return (
    <section id="p-routine" className="d-sec stack sm product-detail-section">
      <SectionHeader title="Routine" />
      <Link className="listrow product-detail-routine-link" href={routes.routine}>
        <span className="ic"><Icon name="check" size="sm" /></span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <b style={{ display: "block" }}>See it in your routine</b>
          <span className="caption muted">{step} · Curated K-beauty steps for you</span>
        </span>
        <Icon name="chev" size="xs" className="chev" />
      </Link>
    </section>
  );
}

export function ProductDetailBody({ product, heroOverlay }: {
  product: Product;
  heroOverlay?: ReactNode;
}) {
  const heroRef = useRef<HTMLDivElement>(null);
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    const hero = heroRef.current;
    if (!hero) return;
    const observer = new IntersectionObserver(
      ([entry]) => setCompact(!entry.isIntersecting),
      { threshold: 0 },
    );
    observer.observe(hero);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="detail-scroll product-detail-scroll">
      <div className={"detail-compactwrap" + (compact ? " on" : "")}>
        <div className="detail-compactbar product-detail-compactbar">
          <BackButton fallback={routes.ranking} />
          <b>{product.name}</b>
          <ProductShareButton
            aria-label="Share product"
            product={product}
          />
          <FavoriteButton kind="product" id={product.id} />
        </div>
      </div>

      <div
        ref={heroRef}
        className="product-detail-hero"
      >
        <div
          className="product-detail-gallery"
          role="img"
          aria-label={`${product.name} product gallery`}
        >
          <ImgPh className="product-detail-gallery-main">
            <Icon name="bag" style={{ width: 44, height: 44, color: "var(--dim)" }} />
            <span className="caption muted">Product photo coming soon</span>
          </ImgPh>
          <ImgPh><span className="label">{product.brand}</span></ImgPh>
          <ImgPh>
            <span className="label">
              {product.stepCategory ? STEP_LABEL[product.stepCategory] : cap(product.category)}
            </span>
          </ImgPh>
        </div>
        {heroOverlay}
      </div>

      <div className="pad" style={{ paddingTop: 8, paddingBottom: 12 }}>
        <ProductTitleBlock product={product} />
      </div>

      <AnchorTabs sections={SECTIONS} offset={STICKY_OFFSET} />

      <div className="pad stack product-detail-content">
        <OverviewSection product={product} />
        <SectionDivider />
        <DetailsSection product={product} />
        <SectionDivider />
        <BuySection product={product} />
        <SectionDivider />
        <RoutineSection product={product} />
      </div>
    </div>
  );
}
