import { expect, test } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { adminClient, ensureUser } from "./helpers";

// Data & privacy lifecycle: export returns everything, deletion is real and
// leaves nothing behind (auth user, RLS rows, local mirrors, session).
// Uses its own throwaway user so launch.spec.ts state is untouched.

const EMAIL = "e2e-lifecycle@myseouldrop.app";
const PASS = "PwLifecycle!k3m9";

let admin: SupabaseClient | null = null;
let uid: string | null = null;

test.beforeAll(async () => {
  admin = adminClient();
  if (admin) uid = await ensureUser(admin, EMAIL, PASS);
});

test.afterAll(async () => {
  if (!admin || !uid) return;
  // in case the delete spec failed midway
  const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (data?.users?.some((u) => u.id === uid)) await admin.auth.admin.deleteUser(uid);
});

test.describe("account data lifecycle", () => {
  test.skip(() => !adminClient(), "needs SUPABASE_SERVICE_ROLE_KEY (.env.local)");

  test("export then delete: data out, account gone, device clean", async ({ page }) => {
    // sign in and leave some data
    await page.goto("/login");
    await page.locator(".auth-field").first().fill(EMAIL);
    await page.locator(".auth-field").nth(1).fill(PASS);
    await page.locator(".auth-cta").click();
    await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30_000 });

    await page.goto("/place/juno-hair-gangnam");
    await page.getByRole("button", { name: "Add to favorites" }).first().click();
    await page.getByRole("button", { name: "Rate 5 stars" }).click();
    await expect
      .poll(async () => {
        const { data } = await admin!.from("ratings").select("rating").eq("user_id", uid!).maybeSingle();
        return data?.rating ?? null;
      }, { timeout: 15_000 })
      .toBe(5);

    // export carries the account, the favorite, and the rating
    const res = await page.request.get("/api/account/export");
    expect(res.status()).toBe(200);
    expect(res.headers()["content-disposition"]).toContain("myseouldrop-data.json");
    const body = await res.json();
    expect(body.account.email).toBe(EMAIL);
    expect(body.favorites.map((f: { item_id: string }) => f.item_id)).toContain("juno-hair-gangnam");
    expect(body.ratings[0]).toMatchObject({ place_id: "juno-hair-gangnam", rating: 5 });

    // delete through the real UI
    await page.goto("/settings/privacy");
    await page.getByRole("button", { name: "Delete account" }).click();
    await page.getByRole("button", { name: "Delete forever" }).click();
    await page.waitForURL((u) => u.pathname === "/", { timeout: 30_000 });

    // auth user gone
    await expect
      .poll(async () => {
        const { data } = await admin!.auth.admin.listUsers({ perPage: 1000 });
        return data?.users?.some((u) => u.id === uid) ?? true;
      }, { timeout: 15_000 })
      .toBe(false);
    // rows cascaded
    const favs = await admin!.from("favorites").select("item_id").eq("user_id", uid!);
    const rates = await admin!.from("ratings").select("place_id").eq("user_id", uid!);
    expect(favs.data ?? []).toHaveLength(0);
    expect(rates.data ?? []).toHaveLength(0);
    // device clean: mirrors purged and the session is really gone
    const mirrors = await page.evaluate(() => ({
      favs: localStorage.getItem("essenly.favorites"),
      ratings: localStorage.getItem("essenly.myrating"),
      profile: localStorage.getItem("essenly.profile"),
    }));
    expect(mirrors).toEqual({ favs: null, ratings: null, profile: null });
    const after = await page.request.get("/api/account/export");
    expect(after.status()).toBe(401);
  });
});
