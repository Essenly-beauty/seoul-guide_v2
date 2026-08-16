import { expect, test } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { adminClient, ensureUser } from "./helpers";

// Core launch E2E — formalizes what was previously verified with ad-hoc CDP
// scripts: discovery smoke, direct auth, account sync, and the shared-device
// purge contracts from the launch audit.

const EMAIL = "e2e-playwright@myseouldrop.app";
const PASS = "PwLaunch!x7q2";

let admin: SupabaseClient | null = null;
let uid: string | null = null;

test.beforeAll(async ({ request, baseURL }) => {
  admin = adminClient();
  if (admin) uid = await ensureUser(admin, EMAIL, PASS);
  // warm the dev server's on-demand compiler so expect timeouts measure the
  // app, not the toolchain
  for (const p of ["/login", "/map", "/menu", "/favorites", "/settings", "/place/juno-hair-gangnam"]) {
    await request.get(`${baseURL}${p}`).catch(() => {});
  }
});

test.afterAll(async () => {
  if (admin && uid) await admin.auth.admin.deleteUser(uid);
});

async function login(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.locator(".auth-field").first().fill(EMAIL);
  await page.locator(".auth-field").nth(1).fill(PASS);
  await page.locator(".auth-cta").click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 20_000 });
}

test.describe("discovery smoke (no auth needed)", () => {
  test("map shell renders with the brand and no demo menu rows", async ({ page }) => {
    await page.goto("/menu");
    await expect(page.getByText("Saved", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Reservations")).toHaveCount(0);
    await expect(page.getByText("Beauty Kit")).toHaveCount(0);
  });

  test("place page shows real data and no fabricated trust signals", async ({ page }) => {
    await page.goto("/place/juno-hair-gangnam");
    await expect(page.getByRole("heading", { name: "Juno Hair Gangnam" })).toBeVisible();
    await expect(page.getByText("Been here? Rate your visit")).toBeVisible();
    for (const fake of ["Card OK", "✓ Verified", "MYSEOULDROP10", "02-555-0134"]) {
      await expect(page.getByText(fake)).toHaveCount(0);
    }
  });

  test("no gateway: root lands everyone on the map; My tab pitches the account", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/map/);
    await page.goto("/menu");
    // guest join sheet: Google + email signup + dismiss
    await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("link", { name: "Sign up with email" })).toBeVisible();
    await page.getByRole("button", { name: "Continue as guest" }).click();
    await expect(page.getByText("Saved", { exact: true }).first()).toBeVisible();
  });

  test("prototype routes stay closed (redirects)", async ({ page }) => {
    await page.goto("/bookings");
    await expect(page).toHaveURL(/\/menu/);
    await page.goto("/trip");
    await expect(page).toHaveURL(/\/menu/);
    await page.goto("/mypage/reviews/new");
    await expect(page).toHaveURL(/\/mypage\/reviews$/);
  });

  test("hangul place ids resolve", async ({ page }) => {
    await page.goto(`/place/${encodeURIComponent("oy-학동중앙점")}`);
    await expect(page.getByRole("heading", { name: /학동중앙점/ })).toBeVisible();
    await expect(page.getByText(/wandered off/)).toHaveCount(0); // not the 404 page
  });

  test("broken shared-list link falls back to the normal map", async ({ page }) => {
    await page.goto("/map?list=not-a-real-id");
    await expect(page.getByText("That shared list link isn't available")).toBeVisible({ timeout: 20_000 });
    await expect(page).toHaveURL(/\/map$/);
    await expect(page.locator(".leaflet-marker-icon").first()).toBeVisible({ timeout: 20_000 });
  });
});

test.describe("direct auth + account sync", () => {
  test.skip(() => !adminClient(), "needs SUPABASE_SERVICE_ROLE_KEY (.env.local)");

  test("returning member: login page redirects straight into the app", async ({ page }) => {
    await login(page);
    await page.goto("/login");
    await expect(page).toHaveURL(/\/map/);
  });

  test("wrong password shows an inline error and stays on /login", async ({ page }) => {
    await page.goto("/login");
    await page.locator(".auth-field").first().fill(EMAIL);
    await page.locator(".auth-field").nth(1).fill("Wrong-1!");
    await page.locator(".auth-cta").click();
    await expect(page.locator(".auth-error, [role=alert]").first()).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test("login -> rate a place -> rating lands on the server and survives reload", async ({ page }) => {
    await login(page);
    await page.goto("/place/juno-hair-gangnam");
    await page.getByRole("button", { name: "Rate 4 stars" }).click();
    await expect(page.getByText(/You rated 4 stars/)).toBeVisible();
    await expect
      .poll(async () => {
        const { data } = await admin!.from("ratings").select("rating").eq("user_id", uid!).eq("place_id", "juno-hair-gangnam").maybeSingle();
        return data?.rating ?? null;
      }, { timeout: 15_000 })
      .toBe(4);
    await page.reload();
    await expect(page.getByText(/You rated 4 stars/)).toBeVisible();
  });

  test("sign-out purges every account mirror from the device", async ({ page }) => {
    await login(page);
    await page.goto("/place/juno-hair-gangnam");
    await page.getByRole("button", { name: "Add to favorites" }).first().click();
    await page.goto("/settings");
    await page.getByRole("button", { name: "Sign Out" }).first().click();
    await page.locator(".modal").getByRole("button", { name: "Sign Out" }).click();
    await page.waitForURL((u) => u.pathname === "/", { timeout: 20_000 });
    const mirrors = await page.evaluate(() => ({
      favs: localStorage.getItem("essenly.favorites"),
      profile: localStorage.getItem("essenly.profile"),
      ratings: localStorage.getItem("essenly.myrating"),
      merged: localStorage.getItem("essenly.favorites.mergedFor"),
    }));
    expect(mirrors).toEqual({ favs: null, profile: null, ratings: null, merged: null });
  });

  test("shared list round-trip: member shares, guest opens it on the map", async ({ page, browser, baseURL }) => {
    await login(page);
    // heart two places through the UI so the Saved tab has a list to share
    // (ids no other spec touches — the account may already carry hearts from
    // earlier specs in this suite, so all assertions below stay count-agnostic)
    for (const id of ["glow-skin-clinic", "chahong-apgujeong"]) {
      await page.goto(`/place/${id}`);
      const save = page.getByRole("button", { name: "Add to favorites" });
      await save.waitFor({ timeout: 20_000 });
      await save.click();
      await expect(page.getByRole("button", { name: "Remove from favorites" })).toBeVisible();
    }
    await page.goto("/favorites");
    await page.getByRole("button", { name: "Share this list" }).click();
    // navigator.share may or may not exist headless — the durable effect
    // either way is the snapshot row, so assert on that
    await expect
      .poll(async () => {
        const { data } = await admin!.from("shared_lists").select("id").eq("owner", uid!);
        return data?.length ?? 0;
      }, { timeout: 15_000 })
      .toBe(1);
    const { data: lists } = await admin!.from("shared_lists").select("id, title, place_ids").eq("owner", uid!);
    expect(lists![0].place_ids).toEqual(expect.arrayContaining(["glow-skin-clinic", "chahong-apgujeong"]));
    const count = lists![0].place_ids.length;

    // a guest (fresh context) opens the link: banner + Save all + join sheet
    const guestCtx = await browser.newContext();
    const guest = await guestCtx.newPage();
    try {
      await guest.goto(`${baseURL}/map?list=${lists![0].id}`);
      await expect(guest.locator(".map-banner")).toContainText(`${lists![0].title} · ${count} places`, { timeout: 20_000 });
      await guest.getByRole("button", { name: "Save all" }).click();
      await expect(guest.getByText(`Saved ${count} place${count === 1 ? "" : "s"} to your list`)).toBeVisible();
      await expect(guest.getByText("Save it to your account")).toBeVisible(); // guest funnel
    } finally {
      await guestCtx.close();
      await admin!.from("shared_lists").delete().eq("owner", uid!);
    }
  });

  test("shared device: next account never inherits the previous mirror", async ({ page }) => {
    // simulate account A's dead session leaving a mirror behind
    await page.goto("/menu");
    await page.evaluate(() => {
      localStorage.setItem("essenly.favorites", JSON.stringify({ place: ["colorlab-gangnam"], product: [], article: [] }));
      localStorage.setItem("essenly.favorites.mergedFor", "00000000-0000-0000-0000-00000000000a");
    });
    await login(page); // B signs in
    await page.goto("/favorites");
    // the planted item from A's dead session must appear neither in B's UI…
    await expect(page.getByRole("heading", { name: /^Places/ })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/Colorlab/)).toHaveCount(0);
    // …nor in B's account rows (the purge must beat the one-time merge)
    await expect
      .poll(async () => {
        const { data } = await admin!.from("favorites").select("item_id").eq("user_id", uid!);
        return (data ?? []).map((r) => r.item_id);
      }, { timeout: 10_000 })
      .not.toContain("colorlab-gangnam");
  });
});
