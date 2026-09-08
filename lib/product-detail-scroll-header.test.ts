import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { headerProgress } from "@/components/product/product-detail-scroll-header";

const sourceUrl = new URL("../components/product/product-detail-scroll-header.tsx", import.meta.url);
const source = existsSync(sourceUrl) ? readFileSync(sourceUrl, "utf8") : "";
const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

describe("progressive product detail header", () => {
  it("maps the action row crossing the safe top to a stable progress", () => {
    expect(headerProgress({ top: 0, height: 44, safeTop: 0 })).toBe(0);
    expect(headerProgress({ top: -22, height: 44, safeTop: 0 })).toBeCloseTo(0.5);
    expect(headerProgress({ top: -44, height: 44, safeTop: 0 })).toBe(1);
    expect(headerProgress({ top: -80, height: 44, safeTop: 0 })).toBe(1);
    expect(headerProgress({ top: 20, height: 44, safeTop: 0 })).toBe(0);
  });

  it("renders initial back/share and compact back/title/share/overflow controls", () => {
    expect(source).toContain("BackButtonBordered");
    expect(source).toContain('variant="overlay"');
    expect(source).toContain("ProductShareButton");
    expect(source).toContain('name="more"');
    expect(source).toContain('className="product-detail-compact-title"');
    expect(source).toContain("requestAnimationFrame");
    expect(source).toContain('closest<HTMLElement>(".app-scroll")');
    expect(source).toContain("(progress - 0.5) * 2");
    expect(source).toContain("prefersReducedMotion ? (progress >= 0.5 ? 1 : 0) : revealProgress");
    expect(source).toContain("inert={!compactVisible ? true : undefined}");
    expect(source).toContain("inert={compactVisible ? true : undefined}");
    expect(css).toContain("grid-template-columns: 88px minmax(0, 1fr) 88px");
  });

  it("supports keyboard menu navigation and restores trigger focus", () => {
    expect(source).toContain("menuTriggerRef");
    expect(source).toContain("menuItemRefs.current[0]?.focus()");
    expect(source).toContain('event.key === "ArrowDown"');
    expect(source).toContain('event.key === "ArrowUp"');
    expect(source).toContain('event.key === "Home"');
    expect(source).toContain('event.key === "End"');
    expect(source).toContain("menuTriggerRef.current?.focus()");
  });

  it("keeps the title ellipsized and disables the fade for reduced motion", () => {
    expect(css).toMatch(/\.product-detail-compact-title\s*\{[^}]*text-overflow:\s*ellipsis[^}]*white-space:\s*nowrap/);
    expect(css).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.product-detail-progress-bar/);
  });
});
