import { beforeEach, afterAll, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/shared-lists/[id]/route";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  createClient: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: () => ({ auth: { getUser: mocks.getUser } }),
}));
vi.mock("@supabase/supabase-js", () => ({ createClient: mocks.createClient }));

const listId = "2f9c1a34-9c1d-4e7a-b1f2-3d4e5f607182";
const originalServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const originalSupabaseUrl = process.env.SUPABASE_URL;

function request(id = listId) {
  return GET(new Request(`https://myseouldrop.app/api/shared-lists/${id}`), {
    params: Promise.resolve({ id }),
  });
}

function query(result: { data: unknown; error: unknown }) {
  const builder = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue(result),
  };
  builder.select.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  const from = vi.fn().mockReturnValue(builder);
  mocks.createClient.mockReturnValue({ from });
  return { builder, from };
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.SUPABASE_SERVICE_ROLE_KEY = "server-only-test-key";
  process.env.SUPABASE_URL = "https://db.example.test";
  mocks.getUser.mockResolvedValue({ data: { user: { id: "owner-user" } }, error: null });
});

afterAll(() => {
  if (originalServiceKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  else process.env.SUPABASE_SERVICE_ROLE_KEY = originalServiceKey;
  if (originalSupabaseUrl === undefined) delete process.env.SUPABASE_URL;
  else process.env.SUPABASE_URL = originalSupabaseUrl;
});

describe("GET /api/shared-lists/[id]", () => {
  it("denies a guest without opening the admin database", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
    const response = await request();
    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it("fails closed when authentication throws unexpectedly", async () => {
    mocks.getUser.mockRejectedValue(new Error("private auth detail"));
    const response = await request();
    expect(response.status).toBe(500);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(JSON.stringify(await response.json())).not.toContain("private auth detail");
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it("rejects a malformed id without opening the admin database", async () => {
    const response = await request("not-a-uuid");
    expect(response.status).toBe(400);
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it("returns only one exact-ID list's display fields", async () => {
    const { builder, from } = query({
      data: {
        id: listId,
        owner: "owner-user",
        title: "Seoul weekend",
        place_ids: ["juno-hair-gangnam"],
        created_at: "2026-09-26T00:00:00+00:00",
        private_note: "must not escape",
      },
      error: null,
    });
    const response = await request();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.json()).toEqual({
      id: listId,
      title: "Seoul weekend",
      place_ids: ["juno-hair-gangnam"],
      created_at: "2026-09-26T00:00:00+00:00",
    });
    expect(from).toHaveBeenCalledWith("shared_lists");
    expect(builder.select).toHaveBeenCalledWith("id, title, place_ids, created_at");
    expect(builder.eq).toHaveBeenCalledWith("id", listId);
    expect(builder.maybeSingle).toHaveBeenCalledOnce();
  });

  it("returns unavailable for a missing or revoked link", async () => {
    query({ data: null, error: null });
    expect((await request()).status).toBe(404);
  });

  it("distinguishes a failed lookup from a missing list", async () => {
    query({ data: null, error: { message: "database unavailable" } });
    const response = await request();
    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain("database unavailable");
  });

  it("returns a private retryable error when the admin lookup throws", async () => {
    const { builder } = query({ data: null, error: null });
    builder.maybeSingle.mockRejectedValue(new Error("private database detail"));
    const response = await request();
    expect(response.status).toBe(500);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(JSON.stringify(await response.json())).not.toContain("private database detail");
  });

  it("fails closed when the server key is absent", async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const response = await request();
    expect(response.status).toBe(503);
    expect(mocks.createClient).not.toHaveBeenCalled();
  });
});
