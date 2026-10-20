import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/account/export/route";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  from: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: () => ({ auth: { getUser: mocks.getUser }, from: mocks.from, rpc: mocks.rpc }),
}));

type QueryResult = { data: unknown; error: { message: string } | null };

const ok = (data: unknown): QueryResult => ({ data, error: null });
const failure = (message: string): QueryResult => ({ data: null, error: { message } });
const booking = {
  id: '11111111-1111-4111-8111-111111111111', placeId: 'sample-place', merchantName: 'Salon', serviceName: 'Cut', staffName: null,
  startAt: '2026-11-01T01:00:00Z', serviceEndAt: '2026-11-01T02:00:00Z', totalKrw: 60000,
  status: 'requested', paymentMode: 'pay_at_venue', customerName: 'Owner', phone: '+82 10 1234 5678', notes: 'My booking note',
  createdAt: '2026-10-20T01:00:00Z', updatedAt: '2026-10-20T01:00:00Z', cancelledBy: null,
};

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
    bookings: ok([booking]),
    communications: ok({ messages: [], customerNotes: [] }),
  };
  mocks.from.mockImplementation((table: string) => ({
    select: () => ({
      order: () => Promise.resolve(results[table]),
      maybeSingle: () => Promise.resolve(results[table]),
    }),
  }));
  mocks.rpc.mockImplementation((name: string) => Promise.resolve(name === 'booking_list' ? results.bookings : results.communications));
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
    expect(body.bookings).toEqual([booking]);
    expect(body.bookingMessages).toEqual([]);
    expect(body.customerNotes).toEqual([]);
    expect(mocks.rpc).toHaveBeenCalledWith("booking_list", { p_partner: false });
    expect(mocks.rpc).toHaveBeenCalledWith("booking_communications_export");
  });

  it.each(["favorites", "ratings", "profiles", "bookings", "communications"])("does not download a partial export when %s fails", async (table) => {
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

  it.each([null, [{}], [{ ...booking, customer_id: 'another-user' }], [{ ...booking, totalKrw: -1 }]])("fails closed on malformed booking data without exporting private fields", async (data) => {
    results.bookings = ok(data);
    const response = await GET();
    expect(response.status).toBe(503);
    expect(response.headers.get("content-disposition")).toBeNull();
    expect(await response.text()).not.toContain('another-user');
  });

  it("never exports merchant-wide customer bookings for a partner account", async () => {
    const partnerCustomerBooking = { ...booking, customerName: 'Another customer' };
    mocks.rpc.mockImplementation((name: string, args?: { p_partner: boolean }) => Promise.resolve(name === 'booking_communications_export' ? results.communications : ok(args?.p_partner ? [partnerCustomerBooking] : [booking])));
    const response = await GET();
    expect(response.status).toBe(200);
    expect((await response.json()).bookings).toEqual([booking]);
    expect(mocks.rpc).toHaveBeenCalledWith("booking_list", { p_partner: false });
  });

  it("does not download a partial export when the booking RPC throws", async () => {
    mocks.rpc.mockRejectedValueOnce(new Error('private RPC network detail'));
    const response = await GET();
    expect(response.status).toBe(503);
    expect(response.headers.get("content-disposition")).toBeNull();
    expect(await response.text()).not.toContain('private RPC');
  });

  it("does not read personal tables when session verification fails", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: { message: "private auth detail" } });
    const response = await GET();
    expect(response.status).toBe(503);
    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(await response.text()).not.toContain("private auth detail");
  });

  it("does not query personal data for a guest", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
    const response = await GET();
    expect(response.status).toBe(401);
    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("treats Supabase's missing-session error as a signed-out guest", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: null },
      error: { name: "AuthSessionMissingError", message: "Auth session missing!" },
    });
    const response = await GET();
    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
