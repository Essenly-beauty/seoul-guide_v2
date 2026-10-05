import { expect, test } from "@playwright/test";

const id = "ct-soonsoo-celebrity-hair-makeup-salon-in-cheongdam";

test.beforeEach(async ({ page }) => {
  await page.route("**/rest/v1/**", (route) => route.fulfill({ json: [] }));
});

test("guests can open places but stars and review writing require sign-in", async ({ page }) => {
  await page.goto(`/place/${id}`);
  await expect(page.locator("#d-reviews")).toBeVisible();
  await page.getByRole("button", { name: "Rate 4 stars", exact: true }).click();
  await expect(page.getByText("Sign in to rate and review", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Your review", { exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem("essenly.myrating"))).toBeNull();
  await page.getByRole("button", { name: "Keep exploring" }).click();
  await page.getByRole("button", { name: "Write a review", exact: true }).click();
  await expect(page.getByText("Sign in to rate and review", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Sign in", exact: true })).toHaveAttribute("href", `/login?next=${encodeURIComponent(`/place/${id}`)}`);
});

test("guest direct editor URL cannot expose a composer, even with legacy device reviews", async ({ page }) => {
  await page.addInitScript(({ id }) => {
    localStorage.setItem("essenly.myrating", JSON.stringify({ [id]: { rating: 4, body: "Legacy private note", isPublic: true } }));
  }, { id });
  await page.goto(`/mypage/reviews/${id}/edit`);
  await expect(page.getByRole("button", { name: "Sign in to rate and review" })).toBeVisible();
  await expect(page.getByLabel("Your review", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Legacy private note", { exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem("essenly.myrating"))).toContain("Legacy private note");
});

test("My reviews asks guests to sign in and still offers map exploration", async ({ page }) => {
  await page.goto("/mypage/reviews");
  await expect(page.getByRole("button", { name: "Sign in to rate and review" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Browse the map" })).toHaveAttribute("href", "/map");
});
