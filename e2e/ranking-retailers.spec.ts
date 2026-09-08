import { expect, test, type Page } from "@playwright/test";
import top20Manifest from "../data/fixtures/daiso-ranking-top20-manifest.json";
import {
  categoriesForDaisoRank,
  selectDaisoRanking,
  type DaisoRankKey,
} from "../lib/daiso-ranking";
import { RANKING_RETURN_ROUTE_KEY } from "../lib/ranking-return-route";

test.use({ viewport: { width: 390, height: 844 } });

const RANKS: readonly DaisoRankKey[] = ["rising", "daily", "weekly"];
const RANK_LABELS: Readonly<Record<DaisoRankKey, string>> = {
  rising: "Rising",
  daily: "Daily",
  weekly: "Weekly",
};

function daisoRows(page: Page) {
  return page.getByTestId("daiso-ranking-row");
}

async function expectDaisoTop20(page: Page, rankKey: DaisoRankKey) {
  const label = RANK_LABELS[rankKey];
  const expectedRows = top20Manifest.lists[rankKey].map(({ productNo, rank }) => ({
    productNo,
    sourceRank: rank,
  }));
  const tab = page.getByRole("tab", { name: label, exact: true });
  await expect(tab).toHaveAttribute("aria-selected", "true");
  await expect(daisoRows(page)).toHaveCount(20);
  await expect(daisoRows(page).first()).toHaveAttribute("data-source-rank", "1");
  await expect(daisoRows(page).last()).toHaveAttribute("data-source-rank", "20");

  const renderedRows = await daisoRows(page).evaluateAll((rows) =>
    rows.map((row) => ({
      productNo: row.getAttribute("data-product-no"),
      sourceRank: Number(row.getAttribute("data-source-rank")),
    })),
  );
  expect(renderedRows).toEqual(expectedRows);
  await expect(page.locator('a[href^="/shop/daiso%3A"]')).toHaveCount(20);

  const expectedCategories = categoriesForDaisoRank(rankKey).map(({ label: categoryLabel }) => categoryLabel);
  const categoryLabels = await page
    .getByRole("group", { name: "Daiso product category" })
    .getByRole("button")
    .allTextContents();
  expect(categoryLabels).toEqual(expectedCategories);
}

function contrastRatio(foreground: string, background: string) {
  const parse = (value: string) => {
    const channels = value.match(/rgba?\(([^)]+)\)/)?.[1].split(",").map(Number);
    if (!channels || channels.length < 3) throw new Error(`Unsupported color: ${value}`);
    return channels.slice(0, 3).map((channel) => channel / 255);
  };
  const luminance = (value: string) => parse(value).map((channel) =>
    channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  ).reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
  const foregroundLuminance = luminance(foreground);
  const backgroundLuminance = luminance(background);
  return (Math.max(foregroundLuminance, backgroundLuminance) + 0.05) /
    (Math.min(foregroundLuminance, backgroundLuminance) + 0.05);
}

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
});

test("defaults to Olive Young and preserves its ranking and brands flow", async ({ page }) => {
  await page.goto("/ranking");

  await expect(page).toHaveURL(/\/ranking$/);
  await expect(page.getByRole("tab", { name: "Sales", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("button", { name: "Olive Young", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "Olive Young", exact: true })).not.toContainText("Selected");
  await expect(page.getByRole("navigation", { name: "Ranking retailer" }).getByRole("button")).toHaveCount(3);
  await expect(page.getByTestId("olive-young-ranking-row")).toHaveCount(10);

  await page.getByRole("button", { name: "More ›", exact: true }).click();
  await expect(page.getByTestId("olive-young-ranking-row")).toHaveCount(14);

  await page.getByRole("tab", { name: "Review Best", exact: true }).click();
  await expect(page.getByRole("heading", { name: /Highest-rated by reviews/ })).toBeVisible();
  await page.getByRole("tab", { name: "Brands", exact: true }).click();
  await expect(page.getByRole("searchbox", { name: "Search brands" })).toBeVisible();
  await expect(page.locator('a[href^="/brand/"]')).not.toHaveCount(0);
  await expect(page.locator('a[href*="daisomall.co.kr"]')).toHaveCount(0);
});

test("restores Daiso directly and canonicalizes invalid retailers", async ({ page }) => {
  await page.goto("/ranking?retailer=daiso");
  await expect(page).toHaveURL(/\/ranking\?retailer=daiso$/);
  await expect(page.getByRole("button", { name: "Daiso", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "Daiso", exact: true })).not.toContainText("Selected");
  await expectDaisoTop20(page, "daily");

  await page.goto("/ranking?retailer=not-a-retailer");
  await expect(page).toHaveURL(/\/ranking\?retailer=olive_young$/);
  await expect(page.getByRole("button", { name: "Olive Young", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("tab", { name: "Sales", exact: true })).toHaveAttribute("aria-selected", "true");
});

test("retailer switches replace history and Back returns to the prior page", async ({ page }) => {
  await page.goto("/blog");
  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Ranking", exact: true }).click();
  await expect(page).toHaveURL(/\/ranking$/);
  expect(await page.evaluate((key) => sessionStorage.getItem(key), RANKING_RETURN_ROUTE_KEY)).toBeNull();
  const historyLength = await page.evaluate(() => window.history.length);

  await page.getByRole("button", { name: "Daiso", exact: true }).click();
  await expect(page).toHaveURL(/retailer=daiso/);
  await page.getByRole("button", { name: "Olive Young", exact: true }).click();
  await expect(page).toHaveURL(/retailer=olive_young/);
  expect(await page.evaluate(() => window.history.length)).toBe(historyLength);
  expect(await page.evaluate((key) => sessionStorage.getItem(key), RANKING_RETURN_ROUTE_KEY)).toBeNull();

  const footer = page.getByRole("navigation", { name: "Ranking retailer" });
  await footer.getByRole("button", { name: "Back", exact: true }).focus();
  await page.keyboard.press("Tab");
  await expect(footer.getByRole("button", { name: "Olive Young", exact: true })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(footer.getByRole("button", { name: "Daiso", exact: true })).toBeFocused();

  await footer.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page).toHaveURL(/\/blog$/);
  expect(await page.evaluate((key) => sessionStorage.getItem(key), RANKING_RETURN_ROUTE_KEY)).toBeNull();
});

test("direct-entry Back uses the map fallback instead of leaving the app", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  try {
    await page.goto(`${baseURL}/blog`);
    await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Ranking", exact: true }).click();
    await expect(page).toHaveURL(/\/ranking$/);
    expect(await page.evaluate((key) => sessionStorage.getItem(key), RANKING_RETURN_ROUTE_KEY)).toBeNull();
    await page.goBack();
    await expect(page).toHaveURL(/\/blog$/);

    // Leaving via browser Back must not leave /blog in session storage for a
    // later direct Ranking entry. about:blank removes same-origin Back proof.
    await page.goto("about:blank");
    await page.goto(`${baseURL}/ranking?retailer=daiso`);
    await page.getByRole("button", { name: "Back", exact: true }).click();
    await expect(page).toHaveURL(/\/map$/);
  } finally {
    await context.close();
  }
});

test("renders each official Daiso TOP20 and only that tab's categories", async ({ page }) => {
  await page.goto("/ranking?retailer=daiso");

  for (const rankKey of RANKS) {
    await page.getByRole("tab", { name: RANK_LABELS[rankKey], exact: true }).click();
    await expectDaisoTop20(page, rankKey);
  }
});

test("keeps Daiso category pills compact, readable, focusable, and horizontally scrollable", async ({ page }) => {
  await page.goto("/ranking?retailer=daiso");
  const rail = page.getByRole("group", { name: "Daiso product category" });
  const selected = rail.getByRole("button", { name: "All", exact: true });
  const visual = selected.locator(".daiso-category-chip-visual");

  const geometry = await selected.evaluate((button) => {
    const inner = button.querySelector<HTMLElement>(".daiso-category-chip-visual");
    if (!inner) throw new Error("Daiso category visual is missing");
    return {
      outerHeight: button.getBoundingClientRect().height,
      innerHeight: inner.getBoundingClientRect().height,
      outerBackground: getComputedStyle(button).backgroundColor,
      innerBackground: getComputedStyle(inner).backgroundColor,
    };
  });
  expect(geometry.outerHeight).toBeGreaterThanOrEqual(44);
  expect(geometry.innerHeight).toBe(36);
  expect(geometry.outerBackground).toBe("rgba(0, 0, 0, 0)");
  expect(geometry.innerBackground).not.toBe("rgba(0, 0, 0, 0)");

  for (const theme of ["light", "dark"] as const) {
    await page.evaluate((nextTheme) => document.documentElement.setAttribute("data-theme", nextTheme), theme);
    await selected.focus();
    const colors = await visual.evaluate((node) => {
      const styles = getComputedStyle(node);
      const surface = getComputedStyle(document.documentElement).getPropertyValue("--surface").trim();
      const background = styles.backgroundColor.match(/rgba?\(([^)]+)\)/)?.[1].split(",").map(Number);
      const base = surface.match(/#([0-9a-f]{6})/i)?.[1];
      if (!background || background.length < 4 || !base) throw new Error("Unable to resolve Daiso chip colors");
      const baseRgb = base.match(/../g)?.map((channel) => parseInt(channel, 16));
      if (!baseRgb) throw new Error("Unable to resolve surface color");
      const alpha = background[3];
      const blended = background.slice(0, 3).map((channel, index) => Math.round(channel * alpha + baseRgb[index] * (1 - alpha)));
      const ring = styles.boxShadow.match(/rgb[a]?\(([^)]+)\)/)?.[1];
      if (!ring) throw new Error("Unable to resolve Daiso focus ring color");
      return {
        text: styles.color,
        background: `rgb(${blended.join(", ")})`,
        ring: `rgb(${ring})`,
      };
    });
    expect(contrastRatio(colors.text, colors.background)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(colors.ring, colors.background)).toBeGreaterThanOrEqual(3);
  }

  await selected.focus();
  await expect(selected).toBeFocused();
  await expect.poll(async () => visual.evaluate((node) => getComputedStyle(node).boxShadow)).toContain("inset");

  const before = await rail.evaluate((node) => ({ scrollWidth: node.scrollWidth, clientWidth: node.clientWidth, scrollLeft: node.scrollLeft }));
  expect(before.scrollWidth).toBeGreaterThan(before.clientWidth);
  await rail.evaluate((node) => { node.scrollLeft = node.scrollWidth; });
  const after = await rail.evaluate((node) => node.scrollLeft);
  expect(after).toBeGreaterThan(before.scrollLeft);
});

test("keeps filtered source-rank gaps and resets incompatible retailer state", async ({ page }) => {
  await page.goto("/ranking");
  await page.getByRole("tab", { name: "Review Best", exact: true }).click();
  await page.getByRole("group", { name: "Product category" }).getByRole("button", { name: "Haircare", exact: true }).click();

  await page.getByRole("button", { name: "Daiso", exact: true }).click();
  await expect(page.getByRole("tab", { name: "Daily", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("group", { name: "Daiso product category" }).getByRole("button", { name: "All", exact: true })).toHaveAttribute("aria-pressed", "true");

  await page.getByRole("tab", { name: "Weekly", exact: true }).click();
  await page.getByRole("group", { name: "Daiso product category" }).getByRole("button", { name: "Makeup", exact: true }).click();

  const weeklyMakeup = selectDaisoRanking("weekly", "메이크업");
  expect(weeklyMakeup[0]?.rank).toBe(12);
  await expect(daisoRows(page)).toHaveCount(weeklyMakeup.length);
  await expect(daisoRows(page).first()).toHaveAttribute("data-source-rank", "12");

  await page.getByRole("tab", { name: "Daily", exact: true }).click();
  const categories = page.getByRole("group", { name: "Daiso product category" });
  await expect(categories.getByRole("button", { name: "Makeup", exact: true })).toHaveCount(0);
  await expect(categories.getByRole("button", { name: "All", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expectDaisoTop20(page, "daily");

  await page.getByRole("tab", { name: "Rising", exact: true }).click();
  await categories.getByRole("button", { name: "Makeup", exact: true }).click();
  await page.getByRole("button", { name: "Olive Young", exact: true }).click();
  await expect(page.getByRole("tab", { name: "Sales", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("group", { name: "Product category" }).getByRole("button", { name: "All", exact: true })).toHaveAttribute("aria-pressed", "true");

  await page.getByRole("button", { name: "Daiso", exact: true }).click();
  await expect(page.getByRole("tab", { name: "Daily", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("group", { name: "Daiso product category" }).getByRole("button", { name: "All", exact: true })).toHaveAttribute("aria-pressed", "true");
});

test("uses internal product links, concise metadata, placeholders, and keeps the final row above the flex footer", async ({ page }) => {
  await page.goto("/ranking?retailer=daiso");
  const rows = daisoRows(page);
  const first = rows.first();
  const expectedFirst = selectDaisoRanking("daily")[0].product;

  await expect(first).toHaveAttribute("href", `/shop/daiso%3A${expectedFirst.productNo}`);
  await expect(first).not.toHaveAttribute("target", "_blank");
  await expect(first).not.toHaveAttribute("rel", "noopener noreferrer");
  await expect(first).toHaveAttribute("data-product-no", expectedFirst.productNo);
  await expect(first).not.toContainText("Source");
  await expect(first).not.toContainText("Parcel");
  await expect(first).not.toContainText("★");
  await expect(first).not.toContainText("₩");
  await expect(first).not.toContainText(/reviews/i);
  await expect(first.getByLabel(/Rating .* out of 5/)).toHaveCount(0);
  await expect(rows.locator(".imgph.thumb56")).toHaveCount(20);

  const last = rows.last();
  await last.scrollIntoViewIfNeeded();
  await expect(last).toBeVisible();
  const [lastBox, scrollBox, footerBox, footerPadding, buttonHeights] = await Promise.all([
    last.boundingBox(),
    page.getByTestId("ranking-scroll").boundingBox(),
    page.getByTestId("ranking-footer").boundingBox(),
    page.getByTestId("ranking-footer").evaluate((node) => parseFloat(getComputedStyle(node).paddingBottom)),
    page.getByTestId("ranking-footer").getByRole("button").evaluateAll((buttons) =>
      buttons.map((button) => button.getBoundingClientRect().height),
    ),
  ]);
  if (!lastBox || !scrollBox || !footerBox) throw new Error("Ranking scroll/footer was not measurable");
  expect(lastBox.y + lastBox.height).toBeLessThanOrEqual(scrollBox.y + scrollBox.height + 2);
  expect(lastBox.y + lastBox.height).toBeLessThanOrEqual(footerBox.y + 2);
  expect(footerPadding).toBeGreaterThanOrEqual(20);
  expect(buttonHeights.every((height) => height >= 48)).toBe(true);
});

test("opens a Daiso row in the internal detail and progressively reveals shared header actions", async ({ page }) => {
  const expected = selectDaisoRanking("daily")[0].product;
  await page.goto("/ranking?retailer=daiso");
  await daisoRows(page).first().click();

  await expect(page).toHaveURL(new RegExp(`/shop/daiso(?:%3A|:)${expected.productNo}$`, "i"));
  await expect(page.getByRole("heading", { name: expected.nameKr, exact: true })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Daiso product actions" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Find nearby Daiso", exact: true })).toHaveAttribute("href", "/map?cat=daiso");
  await expect(page.getByRole("link", { name: /Buy on Daiso Mall/ })).toHaveAttribute("target", "_blank");

  const scroller = page.locator(".app-scroll");
  const compact = page.locator(".product-detail-progress-bar");
  await expect(page.locator(".product-detail-hero-actions").getByRole("button", { name: "Share product" })).toBeVisible();
  await expect(compact).toHaveCSS("opacity", "0");
  await scroller.evaluate((node) => { node.scrollTop = 80; });
  await expect.poll(async () => Number(await compact.evaluate((node) => getComputedStyle(node).opacity))).toBeGreaterThan(0);
  await expect(compact.getByText(expected.nameKr, { exact: true })).toBeVisible();
  await expect(compact.getByRole("button", { name: "Share product" })).toBeVisible();
  await expect(compact.getByRole("button", { name: "More product actions" })).toBeVisible();
});

test("test-only injected Daiso states never fall back and Clear filters keeps Daily", async ({ page }) => {
  test.skip(process.env.E2E_EXTERNAL_ONLY === "1", "The guarded QA harness is unavailable on deployed builds");

  await page.goto("/ranking/qa?fixture=empty");
  await expect(page.getByText("Daiso ranking data is currently unavailable.", { exact: true })).toBeVisible();
  await expect(page.locator('a[href^="/shop/"]')).toHaveCount(0);
  await expect(page.locator('a[href*="daisomall.co.kr"]')).toHaveCount(0);

  await page.goto("/ranking/qa?fixture=no-results");
  await expect(page.getByText(/No Daiso products match Daily/)).toBeVisible();
  await page.getByRole("button", { name: "Clear filters", exact: true }).click();
  await expect(page.getByRole("tab", { name: "Daily", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("group", { name: "Daiso product category" }).getByRole("button", { name: "All", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(daisoRows(page)).toHaveCount(20);
});
