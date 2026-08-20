import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const readSource = (url: URL) => existsSync(url) ? readFileSync(url, "utf8") : "";

const routeSource = readSource(new URL("../app/shop/[id]/page.tsx", import.meta.url));
const bodySource = readSource(new URL("../components/product/product-detail-body.tsx", import.meta.url));
const ctaSource = readSource(new URL("../components/product/product-cta-bar.tsx", import.meta.url));
const shareSource = readSource(new URL("../components/product/product-share-button.tsx", import.meta.url));
const toastSource = readSource(new URL("../components/ui/toast.tsx", import.meta.url));
const dataSource = readSource(new URL("./data.ts", import.meta.url));
const cssSource = readSource(new URL("../app/globals.css", import.meta.url));

describe("product detail information-page layout", () => {
  it("keeps the route as a detail shell without the global bottom navigation", () => {
    expect(routeSource).toContain("ProductDetailBody");
    expect(routeSource).toContain("ProductCtaBar");
    expect(routeSource).toContain('className="statusbar-photo"');
    expect(routeSource).toContain("heroOverlay=");
    expect(routeSource).not.toContain("BottomNav");
  });

  it("renders a collage with a back-only hero overlay (2026-07-26: share/save live in the CTA bar)", () => {
    expect(bodySource).toContain('className="product-detail-gallery"');
    expect(bodySource.match(/<ImgPh/g)?.length ?? 0).toBeGreaterThanOrEqual(3);
    expect(bodySource).toContain("{heroOverlay}");
    expect(routeSource).toContain("BackButtonBordered");
    // duplicated top share/heart removed — they painted over the back control
    expect(routeSource).not.toContain("ProductShareButton");
    expect(routeSource).not.toContain("FavoriteButton");
  });

  it("uses the information-page title and anchored section hierarchy", () => {
    expect(bodySource).toContain('fontFamily: "var(--sans)"');
    expect(bodySource).toContain("<AnchorTabs sections={SECTIONS}");
    for (const label of ["Overview", "Details", "Buy", "Routine"]) {
      expect(bodySource).toContain(`label: "${label}"`);
    }
    for (const id of ["p-overview", "p-details", "p-buy", "p-routine"]) {
      expect(bodySource).toContain(`id="${id}"`);
    }
    expect(bodySource).toContain('className="d-sec stack sm product-detail-section"');
    expect(bodySource).toContain("<SectionDivider />");
  });

  it("provides fixed share, save, nearby, and online purchase actions", () => {
    expect(ctaSource).toContain('className="bookbar product-cta-bar"');
    expect(ctaSource).toContain('aria-label="Share product"');
    expect(ctaSource).toContain('kind="product"');
    expect(ctaSource).toContain("Find nearby");
    // 2026-07-25 design-system migration: the raw <Link className="btn ghost">
    // became <Button href> (which renders a Next Link internally) — same intent:
    // "Find nearby" must be a real navigation link into the map.
    expect(ctaSource).toContain("<Button");
    expect(ctaSource).toContain("routes.map");
    expect(ctaSource).toContain("Buy online");
  });

  it("keeps an unavailable online action neutral and stable on hover", () => {
    expect(ctaSource).toContain("Not available online");
    expect(ctaSource).not.toContain("Online unavailable");
    expect(cssSource).toMatch(
      /\.btn\.primary\.product-cta-unavailable,\s*\.btn\.primary\.product-cta-unavailable:hover\s*\{[^}]*background:\s*var\(--bg-surface-sunken\)[^}]*color:\s*var\(--text-disabled\)/,
    );
  });

  it("keeps the product shell stable and scannable on a narrow mobile viewport", () => {
    expect(cssSource).toMatch(
      /\.product-detail-gallery\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1\.4fr\) minmax\(0,\s*1fr\);[^}]*grid-template-rows:\s*82px 82px;/,
    );
    expect(cssSource).toMatch(
      /\.product-detail-scroll \.anchortabs\s*\{[^}]*overflow-x:\s*auto;/,
    );
    expect(cssSource).toMatch(
      /\.product-cta-bar\s*\{[^}]*gap:\s*8px;/,
    );
    expect(cssSource).toContain(".product-detail-fact");
    expect(bodySource).not.toContain("gridTemplateColumns");
  });

  it("keeps hero controls below the safe area and outside the gallery tiles", () => {
    expect(routeSource).not.toContain("top: 14");
    expect(cssSource).toMatch(
      /\.product-detail-hero-actions\s*\{[^}]*safe-area-inset-top/,
    );
    expect(cssSource).toMatch(
      /\.product-detail-hero\s*\{[^}]*padding-top:[^;]*safe-area-inset-top/,
    );
  });

  it("allows a long Korean product name to wrap without hiding the staff action", () => {
    const koreanNameRule = cssSource.match(
      /\.product-detail-copy-text\s*>\s*b\s*\{[^}]*\}/,
    )?.[0] ?? "";
    expect(koreanNameRule).toContain("white-space: normal");
    expect(koreanNameRule).toContain("-webkit-line-clamp: 2");
    expect(koreanNameRule).toContain("overflow-wrap: anywhere");
    expect(cssSource).toMatch(/\.product-detail-copy\s*\{[^}]*flex:\s*none/);
  });

  it("opens an accessible show-to-staff card with a product visual and a sans-serif location request", () => {
    expect(dataSource).toContain("imageUrl?: string");
    expect(bodySource).toContain("function StoreStaffCard");
    expect(bodySource).toContain('aria-haspopup="dialog"');
    expect(bodySource).toContain('className="box product-staff-modal"');
    expect(bodySource).toContain('role="dialog"');
    expect(bodySource).toContain('aria-modal="true"');
    expect(bodySource).toContain('className="product-staff-modal-visual"');
    expect(bodySource).toContain("product.imageUrl");
    expect(bodySource).toContain('className="product-staff-modal-question"');
    expect(bodySource).toContain("위치를 안내해 주세요.");
    expect(bodySource).not.toContain('copy={product.nameKr}');
    expect(cssSource).toMatch(
      /\.product-staff-modal-question\s*\{[^}]*font-family:\s*var\(--sans\)/,
    );
  });

  it("shares a structured canonical product URL from every product share control", () => {
    // route hero no longer carries a share control (2026-07-26) — compact bar + CTA bar do
    expect(bodySource).toContain("ProductShareButton");
    expect(ctaSource).toContain("ProductShareButton");
    expect(shareSource).toContain("title:");
    expect(shareSource).toContain("text:");
    expect(shareSource).toContain("url:");
    expect(shareSource).toContain("window.location.origin");
    expect(toastSource).toContain("url?: string");
  });

  it("uses fallback-aware back navigation in the compact header", () => {
    expect(bodySource).toContain("<BackButton fallback={routes.ranking}");
    expect(bodySource).not.toContain("router.back()");
    expect(bodySource).not.toContain("useRouter");
  });

  it("does not claim an unverified purchase, store, or inventory success", () => {
    expect(dataSource).toContain("onlineUrl?: string");
    expect(dataSource).toContain("onlineUrlVerifiedAt?: string");
    expect(bodySource).toContain("Stock not verified");
    expect(bodySource).toContain("Search nearby stores");
    expect(bodySource).toContain("onlineUrlVerifiedAt");
    expect(bodySource).toContain('target="_blank"');
    expect(ctaSource).toContain("Not available online");
    expect(ctaSource).toContain("onlineUrlVerifiedAt");
    expect(ctaSource).not.toContain("Opening the online store");
    expect(bodySource).not.toContain("PARTNER_STORE");
    expect(bodySource).not.toContain("Olive Young Myeongdong");
    expect(bodySource).not.toContain("Opening Kakao Map");
    expect(bodySource).not.toContain("Opening Google Maps");
    expect(bodySource).not.toContain("Opening Naver Map");
  });

  it("keeps the fixed actions readable at 200 percent text size", () => {
    const ctaTextRule = cssSource.match(
      /\.product-cta-find,\s*\.product-cta-buy\s*\{[^}]*\}/,
    )?.[0] ?? "";
    expect(ctaTextRule).toContain("white-space: normal");
    expect(ctaTextRule).toContain("overflow-wrap: anywhere");
    expect(cssSource).toMatch(
      /@media\s*\(max-width:\s*360px\)[\s\S]*?\.product-cta-buy\s*\{[^}]*grid-column:\s*1\s*\/\s*-1/,
    );
  });
});
