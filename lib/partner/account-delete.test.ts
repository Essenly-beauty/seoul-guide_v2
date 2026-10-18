import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/account/delete/route";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(), signOut: vi.fn(), from: vi.fn(),
  select: vi.fn(), eq: vi.fn(), limit: vi.fn(),
  createClient: vi.fn(), deleteUser: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: () => ({
    auth: { getUser: mocks.getUser, signOut: mocks.signOut }, from: mocks.from,
  }),
}));
vi.mock("@supabase/supabase-js", () => ({ createClient: mocks.createClient }));

const verifiedUser = {
  id: "verified-user", aud: "authenticated", app_metadata: {}, user_metadata: {},
  created_at: "2026-10-18T00:00:00Z",
};

function request(options: { origin?: string; claimedUser?: string } = {}) {
  return POST(new Request(
    `https://myseouldrop.app/api/account/delete?user_id=${options.claimedUser ?? "imposter"}`,
    {
      method: "POST",
      headers: { origin: options.origin ?? "https://myseouldrop.app", host: "myseouldrop.app" },
      body: JSON.stringify({ user_id: options.claimedUser ?? "imposter" }),
    },
  ));
}

function lookup(data: unknown, error: unknown = null) {
  mocks.limit.mockResolvedValue({ data, error, count: null, status: error ? 500 : 200, statusText: error ? "Internal Server Error" : "OK" });
}

function expectNoDeletion() {
  expect(mocks.createClient).not.toHaveBeenCalled();
  expect(mocks.deleteUser).not.toHaveBeenCalled();
  expect(mocks.signOut).not.toHaveBeenCalled();
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-service-key");
  vi.stubEnv("SUPABASE_URL", "https://db.example.test");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://public-db.example.test");
  mocks.getUser.mockResolvedValue({ data: { user: verifiedUser }, error: null });
  mocks.signOut.mockResolvedValue({ error: null });
  const builder = { select: mocks.select, eq: mocks.eq, limit: mocks.limit };
  mocks.from.mockReturnValue(builder);
  mocks.select.mockReturnValue(builder);
  mocks.eq.mockReturnValue(builder);
  lookup([]);
  mocks.createClient.mockReturnValue({ auth: { admin: { deleteUser: mocks.deleteUser } } });
  mocks.deleteUser.mockResolvedValue({ data: { user: verifiedUser }, error: null });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetAllMocks();
});

describe("POST /api/account/delete merchant ownership protection", () => {
  it("blocks a merchant owner with a support destination before privileged deletion", async () => {
    lookup([{ merchant_id: "merchant-1" }]);
    const response = await request();
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      code: "MERCHANT_ACCOUNT_REQUIRES_SUPPORT",
      error: "Please contact support to close or transfer your merchant before deleting your account.",
      supportPath: "/support",
    });
    expectNoDeletion();
  });

  it("keeps revoked owners protected by querying ownership without a revocation filter", async () => {
    // The database SELECT policy includes revoked memberships; only merchant_id is selected.
    lookup([{ merchant_id: "revoked-owner-merchant" }]);
    const response = await request();
    expect(response.status).toBe(409);
    expect(mocks.select).toHaveBeenCalledExactlyOnceWith("merchant_id");
    expect(mocks.eq).toHaveBeenCalledExactlyOnceWith("user_id", "verified-user");
    expect(mocks.limit).toHaveBeenCalledExactlyOnceWith(1);
    expectNoDeletion();
  });

  it("deletes only the verified ordinary user after an empty ownership lookup, then signs out", async () => {
    const response = await request({ claimedUser: "another-user" });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(mocks.from).toHaveBeenCalledExactlyOnceWith("merchant_memberships");
    expect(mocks.select).toHaveBeenCalledExactlyOnceWith("merchant_id");
    expect(mocks.eq).toHaveBeenCalledExactlyOnceWith("user_id", "verified-user");
    expect(mocks.limit).toHaveBeenCalledExactlyOnceWith(1);
    expect(mocks.createClient).toHaveBeenCalledExactlyOnceWith("https://db.example.test", "test-service-key", { auth: { persistSession: false } });
    expect(mocks.deleteUser).toHaveBeenCalledExactlyOnceWith("verified-user");
    expect(mocks.signOut).toHaveBeenCalledOnce();
    expect(mocks.getUser.mock.invocationCallOrder[0]).toBeLessThan(mocks.from.mock.invocationCallOrder[0]);
    expect(mocks.limit.mock.invocationCallOrder[0]).toBeLessThan(mocks.createClient.mock.invocationCallOrder[0]);
    expect(mocks.deleteUser.mock.invocationCallOrder[0]).toBeLessThan(mocks.signOut.mock.invocationCallOrder[0]);
  });

  it.each([
    ["database error", [], { code: "42P01", message: "private database detail", details: "private SQL", hint: "private hint" }],
    ["null data", null, null],
    ["object data", { merchant_id: "merchant-1" }, null],
    ["undefined data", undefined, null],
    ["string data", "[]", null],
  ])("fails closed for %s without exposing private details", async (_label, data, error) => {
    lookup(data, error);
    const response = await request();
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      code: "MERCHANT_OWNERSHIP_CHECK_FAILED", error: "Deletion is temporarily unavailable.",
    });
    expectNoDeletion();
  });

  it("fails closed when the ownership query rejects", async () => {
    mocks.limit.mockRejectedValue(new Error("private transport detail"));
    const response = await request();
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      code: "MERCHANT_OWNERSHIP_CHECK_FAILED", error: "Deletion is temporarily unavailable.",
    });
    expectNoDeletion();
  });

  it("requires authentication before querying ownership", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
    const response = await request();
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Sign in first." });
    expect(mocks.from).not.toHaveBeenCalled();
    expectNoDeletion();
  });

  it("rejects a cross-origin request before authentication or querying ownership", async () => {
    const response = await request({ origin: "https://attacker.example" });
    expect(response.status).toBe(403);
    expect(mocks.getUser).not.toHaveBeenCalled();
    expect(mocks.from).not.toHaveBeenCalled();
    expectNoDeletion();
  });

  it("checks ownership before returning unavailable for a missing service key", async () => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    const response = await request();
    expect(response.status).toBe(503);
    expect(mocks.limit).toHaveBeenCalledExactlyOnceWith(1);
    expectNoDeletion();
  });

  it.each([
    ["admin failure", { message: "private auth failure" }],
    ["ownership created after the precheck (foreign key conflict)", { code: "23503", message: "private FK constraint" }],
  ])("returns the existing deletion error for %s without signing out", async (_label, error) => {
    mocks.deleteUser.mockResolvedValue({ data: { user: null }, error });
    const response = await request();
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Could not delete the account — try again." });
    expect(mocks.deleteUser).toHaveBeenCalledExactlyOnceWith("verified-user");
    expect(mocks.signOut).not.toHaveBeenCalled();
  });
});
