import { existsSync, readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import { describe, expect, it, vi } from "vitest";
import { RoutineContent } from "@/components/shop/routine-content";
import { ProductDetailBody } from "@/components/product/product-detail-body";
import { ToastProvider } from "@/components/ui/toast";
import { PRODUCTS, STEP_MAP } from "./data";
import { routes } from "./routes";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ back() {}, push() {} }),
  usePathname: () => "/shop/routine-filter",
}));

describe("routine product photography", () => {
  it.each([3, 5, 7] as const)("has a local WebP photo for every product in the %i-step routine", (count) => {
    for (const step of STEP_MAP[count]) {
      const product = PRODUCTS.find((item) => item.stepCategory === step);
      expect(product?.imageUrl).toMatch(/^\/products\/.+\.webp$/);
      const file = new URL(`../public${product!.imageUrl}`, import.meta.url);
      expect(existsSync(file)).toBe(true);
      const data = readFileSync(file);
      expect(data.subarray(0, 4).toString()).toBe("RIFF");
      expect(data.subarray(8, 12).toString()).toBe("WEBP");
      expect(data.length).toBeLessThan(100_000);
    }
  });

  it("shows three linked product photos with concise English copy on first load", () => {
    const $ = load(renderToStaticMarkup(<RoutineContent />));
    expect($("ol > li")).toHaveLength(3);
    expect($('[role="group"] button[aria-pressed="true"]').text()).toBe("3 steps");
    STEP_MAP[3].forEach((step, index) => {
      const product = PRODUCTS.find((item) => item.stepCategory === step)!;
      const row = $("ol > li").eq(index);
      expect(row.find("a").attr("href")).toBe(routes.shopItem(product.id));
      expect(row.find("img").attr("src")).toBe(product.imageUrl);
      expect(row.find("img").attr("style")).toContain("object-fit:contain");
      expect(row.text()).toContain(product.name);
      expect(row.text()).toContain(product.brand);
      expect(row.text()).not.toContain(product.nameKr);
      expect(row.text()).not.toContain("₩");
    });
    expect($.text()).not.toContain("Dry skin");
    expect($.text()).not.toContain("Add to Favorites");
  });

  it("uses the same photo in the detail hero and falls back accessibly without an image", () => {
    const product = PRODUCTS.find((item) => item.id === "cosrx-snail-mucin")!;
    const $ = load(renderToStaticMarkup(<ToastProvider><ProductDetailBody product={product} /></ToastProvider>));
    const hero = $(".product-detail-gallery");
    expect(hero.find("img")).toHaveLength(1);
    expect(hero.find("img").attr("src")).toBe(product.imageUrl);
    expect(hero.find("img").attr("loading")).toBe("eager");
    expect(hero.find("img").attr("style")).toContain("object-fit:contain");
    const empty = load(renderToStaticMarkup(<ToastProvider><ProductDetailBody product={{ ...product, imageUrl: undefined }} /></ToastProvider>));
    expect(empty(".product-detail-gallery img")).toHaveLength(0);
    expect(empty('.product-detail-gallery [role="img"]').attr("aria-label")).toContain("photo unavailable");
  });
});
