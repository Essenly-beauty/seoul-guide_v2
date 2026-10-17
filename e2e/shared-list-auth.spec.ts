import { expect, test } from "@playwright/test";

const id = "2f9c1a34-9c1d-4e7a-b1f2-3d4e5f607182";

test("guest shared link asks for sign-in while ordinary map remains open", async ({ page }) => {
  let privateReads = 0;
  await page.route("**/api/shared-lists/*", async (route) => {
    privateReads += 1;
    await route.fulfill({ status: 500, body: "guest must not request this" });
  });

  await page.goto(`/map?list=${id}`);
  const banner = page.locator(".map-banner").filter({ hasText: "Sign in to open this shared list" });
  await expect(banner).toBeVisible();
  const signIn = banner.getByRole("link", { name: "Sign in" });
  await expect(signIn).toHaveAttribute("href", `/login?next=%2Fmap%3Flist%3D${id}`);
  await expect(banner.getByRole("link", { name: "Create account" })).toBeVisible();
  expect(privateReads).toBe(0);

  await page.goto("/map");
  await expect(page.locator(".map-banner").filter({ hasText: "Sign in to open this shared list" })).toHaveCount(0);
});
