import { expect, test } from "@playwright/test";

const placeId = "ct-juno-hair-gangnam-station-branch-1";

test("guest public request on place detail becomes a private note and asks for sign-in", async ({ page }) => {
  await page.goto(`/place/${placeId}`);
  await page.getByRole("button", { name: "Rate 4 stars" }).click();
  await page.getByRole("button", { name: "Keep exploring" }).click();
  await page.getByRole("button", { name: "Write a review" }).click();
  await page.getByRole("textbox", { name: "Your review" }).fill("A useful local-only guest note");
  await expect(page.getByRole("checkbox", { name: /Post publicly/ })).toBeChecked();
  await page.getByRole("button", { name: "Save review" }).click();

  await expect(page.getByText("Your review · private note")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Sign in to publish" })).toBeVisible();
  await expect(page.getByText("Review posted — travelers can now see it")).toHaveCount(0);
  await page.getByRole("button", { name: "Keep exploring" }).click();
  await page.reload();
  await expect(page.getByText("Your review · private note")).toBeVisible();
  await expect(page.getByText("A useful local-only guest note")).toBeVisible();
});

test("guest public request in My review editor stays editable and private", async ({ page }) => {
  await page.goto(`/place/${placeId}`);
  await page.getByRole("button", { name: "Rate 5 stars" }).click();
  await page.getByRole("button", { name: "Keep exploring" }).click();
  await page.goto(`/mypage/reviews/${placeId}/edit`);
  await page.getByRole("textbox", { name: "Your review" }).fill("Another guest-only note");
  await expect(page.getByRole("checkbox", { name: /Post publicly/ })).toBeChecked();
  await page.getByRole("button", { name: "Save review" }).click();

  await expect(page.getByRole("heading", { name: "Sign in to publish" })).toBeVisible();
  await expect(page).toHaveURL(/\/mypage\/reviews\/.*\/edit$/);
  await page.getByRole("button", { name: "Keep exploring" }).click();
  await page.reload();
  await expect(page.getByRole("textbox", { name: "Your review" })).toHaveValue("Another guest-only note");
  await expect(page.getByRole("checkbox", { name: /Post publicly/ })).not.toBeChecked();
});
