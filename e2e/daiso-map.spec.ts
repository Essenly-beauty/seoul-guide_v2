import { expect, test } from "@playwright/test";
import { PLACES } from "../lib/data";
import { DAISO_PLACES } from "../lib/generated/daiso-places";

test.use({ viewport: { width: 390, height: 844 } });

test("a selected Daiso store exposes the chain-wide ranking preview", async ({ page }) => {
  // The map shows the published catalogue name (lib/data.ts applies
  // scripts/lib/en-name-overrides.json), not the generated romanization.
  const store = PLACES.find((place) => place.id === DAISO_PLACES[0].id)!;
  await page.goto(`/map?place=${encodeURIComponent(store.id)}`);
  await expect(page.locator(".selected-place-summary.half")).toContainText(store.name);
  await page.locator(".mapsheet-handle").click();
  await expect(page.locator(".mapsheet.full")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Daiso Ranking" })).toBeVisible();
  await expect(page.getByText("Daiso Mall ranking — chain-wide chart, stock varies by branch.")).toBeVisible();
  await expect(page.locator('a[href^="/shop/daiso%3A"]')).toHaveCount(4);
  await expect(page.getByRole("link", { name: /full Daiso ranking/i })).toHaveAttribute("href", "/ranking?retailer=daiso");
});

test("co-located Daiso branches can be selected individually", async ({ page }) => {
  const firstBranch = PLACES.find((place) => place.type === "daiso" && place.nameKr === "강남고속버스터미널2호점");
  const secondBranch = PLACES.find((place) => place.type === "daiso" && place.nameKr === "강남고속버스터미널점");
  expect(firstBranch).toBeDefined();
  expect(secondBranch).toBeDefined();

  // Start with the camera on the shared official coordinate, then clear the
  // deep-linked selection by choosing the Daiso category.
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(`/map?place=${encodeURIComponent(firstBranch!.id)}`);
  await expect(page.locator(".selected-place-summary.half")).toContainText(firstBranch!.name);
  await page.getByRole("button", { name: "Daiso", exact: true }).click();

  const groupMarker = page.getByRole("button", { name: /^2 places at this pin:/ });
  await expect(groupMarker).toBeVisible({ timeout: 20_000 });
  const groupLabel = await groupMarker.getAttribute("aria-label");
  expect(groupLabel).toContain(firstBranch!.name);
  expect(groupLabel).toContain(firstBranch!.nameKr);
  expect(groupLabel).toContain(secondBranch!.name);
  expect(groupLabel).toContain(secondBranch!.nameKr);
  await groupMarker.click();

  const sheet = page.locator(".mapsheet");
  // Chooser rows are English-only; the Korean name shows once a branch is
  // selected. The two names differ only by the trailing "2": match exactly.
  const choices = sheet.locator(".maprow-coordinate-choice");
  await expect(choices).toHaveCount(2);
  await expect(choices.getByText(firstBranch!.name, { exact: true })).toBeVisible();
  await expect(choices.getByText(secondBranch!.name, { exact: true })).toBeVisible();

  const secondBranchRow = choices.filter({
    has: page.getByText(secondBranch!.name, { exact: true }),
  });
  await secondBranchRow.click();

  await expect(sheet.locator(".selected-place-summary.half"))
    .toContainText("강남고속버스터미널점");
  await expect(page.locator('.leaflet-marker-icon[aria-pressed="true"]')).toHaveCount(1);
});

test("a grouped Daiso pin opened from subway browsing switches to the map chooser", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/map?mode=subway&station=express_bus");

  await expect(page.locator(".subway-controller")).toBeVisible();
  const groupMarker = page.getByRole("button", {
    name: /^2 places at this pin:.*강남고속버스터미널2호점/,
  });
  await expect(groupMarker).toBeVisible({ timeout: 20_000 });
  await groupMarker.click();

  await expect(page.locator(".map-screen:not(.subway-mode)")).toBeVisible();
  await expect(page.locator(".subway-controller")).toHaveCount(0);
  const sheet = page.locator(".mapsheet");
  await expect(sheet).toContainText("2 places at this pin");
  const choices = sheet.locator(".maprow-coordinate-choice");
  for (const nameKr of ["강남고속버스터미널2호점", "강남고속버스터미널점"]) {
    const branch = PLACES.find((place) => place.type === "daiso" && place.nameKr === nameKr)!;
    await expect(choices.getByText(branch.name, { exact: true })).toBeVisible();
  }
});

test("all Daiso stores stay responsive through map pan and All-Daiso-All filtering", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/map");

  const map = page.locator(".leaflet-container");
  await expect(map).toBeVisible({ timeout: 20_000 });
  const mapBox = await map.boundingBox();
  if (!mapBox) throw new Error("Map did not expose a draggable viewport");

  // Exercise Leaflet's real drag path. The resulting action chip proves the
  // React shell received dragend and stayed interactive with the full layer.
  const startX = mapBox.x + mapBox.width * 0.2;
  const startY = mapBox.y + mapBox.height * 0.32;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + 110, startY + 30, { steps: 8 });
  await page.mouse.up();
  await expect(page.getByRole("button", { name: "Search this area", exact: true })).toBeVisible();

  const allFilter = page.getByRole("button", { name: "All", exact: true });
  const daisoFilter = page.getByRole("button", { name: "Daiso", exact: true });
  const sheet = page.locator(".mapsheet");
  const handle = sheet.locator(".mapsheet-handle");
  await expect(allFilter).toHaveAttribute("aria-pressed", "true");
  await expect(handle).toHaveAttribute("aria-label", new RegExp(`\\b${PLACES.length} places\\b`));

  await daisoFilter.click();
  await expect(daisoFilter).toHaveAttribute("aria-pressed", "true");
  await expect(allFilter).toHaveAttribute("aria-pressed", "false");
  // Published Daiso rows = the 251 standalone stores + the shop-in-shop
  // counters (build:daiso-supplement), so count what the catalogue publishes.
  const publishedDaiso = PLACES.filter((place) => place.type === "daiso").length;
  await expect(handle).toHaveAttribute("aria-label", new RegExp(`\\b${publishedDaiso} places\\b`));

  const rows = sheet.locator(".mapsheet-body > .maprow");
  await expect(rows).toHaveCount(publishedDaiso);
  // Daiso rows carry no category label (the logo and name already say Daiso).
  await expect(rows.first().locator(".place-name-primary")).toContainText("Daiso");
  await expect(rows.last().locator(".place-name-primary")).toContainText("Daiso");

  // Expand the flex-contained sheet, reach the final Daiso row through its
  // own scrollport, and prove it ends above (not behind) the normal-flow nav.
  await handle.click();
  await expect(sheet).toHaveClass(/\bfull\b/);
  const lastRow = rows.last();
  await lastRow.scrollIntoViewIfNeeded();
  await expect(lastRow).toBeVisible();
  const lastRowBox = await lastRow.boundingBox();
  const listBox = await sheet.locator(".mapsheet-body").boundingBox();
  const navBox = await page.getByRole("navigation", { name: "Main" }).boundingBox();
  if (!lastRowBox || !listBox || !navBox) throw new Error("Map list or bottom navigation was not measurable");
  const lastRowBottom = lastRowBox.y + lastRowBox.height;
  expect(lastRowBottom).toBeLessThanOrEqual(listBox.y + listBox.height + 2);
  expect(lastRowBottom).toBeLessThanOrEqual(navBox.y + 2);

  await handle.click();
  await expect(sheet).toHaveClass(/\bpeek\b/);
  await allFilter.click();
  await expect(allFilter).toHaveAttribute("aria-pressed", "true");
  await expect(daisoFilter).toHaveAttribute("aria-pressed", "false");
  await expect(handle).toHaveAttribute("aria-label", new RegExp(`\\b${PLACES.length} places\\b`));
  await expect(rows).toHaveCount(PLACES.length);
});
