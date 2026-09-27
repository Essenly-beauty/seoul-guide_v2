import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/account/export/route";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  from: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: () => ({ auth: { getUser: mocks.getUser }, from: mocks.from }),
}));

type QueryResult = { data: unknown; error: { message: string } | null };

const ok = (data: unknown): QueryResult => ({ data, error: null });
const failure = (message: string): QueryResult => ({ data: null, error: { message } });

let results: Record<string, QueryResult>;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getUser.mockResolvedValue({
    data: { user: {
      id: "owner-user",
      email: "owner@example.test",
      user_metadata: { full_name: "Owner" },
      created_at: "2026-09-01T00:00:00Z",
    } },
    error: null,
  });
  results = {
    favorites: ok([{ kind: "place", item_id: "sample-place", created_at: "2026-09-02" }]),
    ratings: ok([{ place_id: "sample-place", rating: 5, body: "Useful", created_at: "2026-09-03", updated_at: "2026-09-03" }]),
    profiles: ok({ data: { interests: ["hair"] }, updated_at: "2026-09-04" }),
  };
  mocks.from.mockImplementation((table: string) => ({
    select: () => ({
      order: () => Promise.resolve(results[table]),
      maybeSingle: () => Promise.resolve(results[table]),
    }),
  }));
});

describe("GET /api/account/export", () => {
  it("downloads the complete current export only when every source succeeds", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("content-disposition")).toContain("attachment");
    const body = await response.json();
    expect(body.account.id).toBe("owner-user");
    expect(body.beautyProfile).toEqual({ interests: ["hair"] });
    expect(body.favorites).toHaveLength(1);
    expect(body.ratings).toHaveLength(1);
  });

  it.each(["favorites", "ratings", "profiles"])("does not download a partial export when %s fails", async (table) => {
    results[table] = failure("private database detail");
    const response = await GET();
    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("content-disposition")).toBeNull();
    const body = await response.text();
    expect(body).not.toContain("sample-place");
    expect(body).not.toContain("private database detail");
  });

  it("does not download a partial export when a source throws", async () => {
    mocks.from.mockImplementationOnce(() => ({
      select: () => ({ order: () => Promise.reject(new Error("private network detail")) }),
    }));
    const response = await GET();
    expect(response.status).toBe(503);
    expect(response.headers.get("content-disposition")).toBeNull();
    expect(await response.text()).not.toContain("private network detail");
  });

  it("does not treat an unexpected null collection as an empty one", async () => {
    results.favorites = ok(null);
    const response = await GET();
    expect(response.status).toBe(503);
    expect(response.headers.get("content-disposition")).toBeNull();
  });

  it("does not read personal tables when session verification fails", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: { message: "private auth detail" } });
    const response = await GET();
    expect(response.status).toBe(503);
    expect(mocks.from).not.toHaveBeenCalled();
    expect(await response.text()).not.toContain("private auth detail");
  });

  it("does not query personal data for a guest", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
    const response = await GET();
    expect(response.status).toBe(401);
    expect(mocks.from).not.toHaveBeenCalled();
  });
});
