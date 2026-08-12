import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { adminClient, loadEnv } from "./helpers";

// The self-hosted error tracker: a real browser error must land in the
// write-only client_errors table; the public API must not read it back.

test.describe("client error tracking", () => {
  test.skip(() => !adminClient(), "needs SUPABASE_SERVICE_ROLE_KEY (.env.local)");

  test("an unhandled rejection reaches client_errors (write-only)", async ({ page }) => {
    const admin = adminClient()!;
    const marker = `e2e-error-${Date.now()}`;
    await page.goto("/menu");
    await page.evaluate((m) => {
      // fire-and-forget rejected promise -> unhandledrejection listener
      void Promise.reject(new Error(m));
    }, marker);

    await expect
      .poll(async () => {
        const { data } = await admin.from("client_errors").select("id, kind, page").eq("message", marker);
        return data?.[0] ?? null;
      }, { timeout: 15_000 })
      .toMatchObject({ kind: "unhandledrejection", page: "/menu" });

    // the anon key must not read errors back (write-only table)
    const env = loadEnv();
    const anon = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, { auth: { persistSession: false } });
    const { data: anonRows } = await anon.from("client_errors").select("id").eq("message", marker);
    expect(anonRows ?? []).toHaveLength(0);

    const { data: rows } = await admin.from("client_errors").select("id").eq("message", marker);
    for (const r of rows ?? []) await admin.from("client_errors").delete().eq("id", r.id);
  });
});
