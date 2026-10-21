import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({ server: vi.fn(), rpc: vi.fn(), getUser: vi.fn(), from: vi.fn(), select: vi.fn(), eq: vi.fn(), is: vi.fn(), maybeSingle: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({ supabaseServer: db.server }));
import { GET, POST } from '@/app/api/partner/operations/bookings/route';
import { GET as detailGET, PATCH } from '@/app/api/partner/operations/bookings/[id]/route';
import { GET as availabilityGET } from '@/app/api/partner/operations/bookings/[id]/availability/route';
import { partnerBooking, partnerBookingMutation } from './partner-contracts';
import { booking } from './contracts';

const id = '11111111-1111-4111-8111-111111111111';
const userId = '22222222-2222-4222-8222-222222222222';
const merchantId = '33333333-3333-4333-8333-333333333333';
const serviceId = '44444444-4444-4444-8444-444444444444';
const customerId = '55555555-5555-4555-8555-555555555555';
const updatedAt = '2026-10-20T10:00:00.123456+00:00';
const startAt = '2026-10-21T10:00:00+09:00';
const saved = { id, placeId: 'known', merchantName: 'Salon', serviceName: 'Cut', staffName: null, startAt,
  serviceEndAt: '2026-10-21T11:00:00+09:00', occupiedUntil: '2026-10-21T11:15:00+09:00', totalKrw: 30000,
  status: 'confirmed', paymentMode: 'pay_at_venue', customerName: 'Customer', phone: '+82 10 1234 5678', notes: '',
  createdAt: updatedAt, updatedAt, cancelledBy: null, source: 'phone', cancelReason: '', serviceId, staffId: null, customerId };
const input = { placeId: 'known', serviceId, staffId: null, startAt, quoteVersion: 'quote', requestId: id, customerName: ' Customer ', phone: '+82 10 1234 5678', notes: '', source: 'phone' };
const route = (value = id) => ({ params: Promise.resolve({ id: value }) });
const get = (suffix = '') => new Request(`https://example.test/api/partner/operations/bookings${suffix}`);
const write = (body: unknown, suffix = '', origin = 'https://example.test') => new Request(`https://example.test/api/partner/operations/bookings${suffix}`, {
  method: suffix ? 'PATCH' : 'POST', headers: { Origin: origin, Host: 'example.test', 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});
const result = (data: unknown, error: unknown = null) => db.rpc.mockResolvedValue({ data, error });
function membership(status = 'active') {
  db.maybeSingle.mockResolvedValueOnce({ data: { merchant_id: merchantId, user_id: userId, revoked_at: null }, error: null });
  db.maybeSingle.mockResolvedValueOnce({ data: { id: merchantId, display_name: 'Salon', contact_email: '', contact_phone: '', address: '', business_types: ['hair'], status, booking_enabled: true, updated_at: updatedAt }, error: null });
}
beforeEach(() => {
  vi.resetAllMocks();
  db.server.mockReturnValue({ auth: { getUser: db.getUser }, rpc: db.rpc, from: db.from });
  db.from.mockReturnValue({ select: db.select }); db.select.mockReturnValue({ eq: db.eq });
  db.eq.mockReturnValue({ is: db.is, maybeSingle: db.maybeSingle }); db.is.mockReturnValue({ maybeSingle: db.maybeSingle });
  db.getUser.mockResolvedValue({ data: { user: { id: userId } }, error: null });
});

describe('partner operations boundary', () => {
  it('returns the enriched scoped snapshot with a place even before any booking', async () => {
    membership(); result({ bookings: [], placeId: 'known' });
    const response = await GET(get()); expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ bookings: [], placeId: 'known' });
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(db.rpc).toHaveBeenCalledWith('partner_booking_list');
  });
  it('keeps the strict customer DTO unchanged and rejects internal fields in partner responses', async () => {
    expect(partnerBooking(saved)).toBe(true); expect(booking(saved)).toBe(false);
    for (const bad of [{ ...saved, authCustomerId: userId }, { ...saved, merchant_id: merchantId }, { ...saved, occupiedUntil: startAt }]) {
      expect(partnerBooking(bad)).toBe(false); membership(); result({ bookings: [bad], placeId: 'known' });
      expect((await GET(get())).status).toBe(503);
    }
  });
  it('rejects an unauthenticated or unassigned caller before RPC access', async () => {
    db.getUser.mockResolvedValueOnce({ data: { user: null }, error: null }); expect((await GET(get())).status).toBe(401);
    db.maybeSingle.mockResolvedValueOnce({ data: null, error: null }); expect((await GET(get())).status).toBe(403);
    expect(db.rpc).not.toHaveBeenCalled();
  });
  it('fails closed on cross-origin, invalid input and tenant query selectors', async () => {
    expect((await POST(write(input, '', 'https://attacker.test'))).status).toBe(403);
    expect((await POST(write({ ...input, customerId: userId }))).status).toBe(400);
    expect((await GET(get('?merchantId=' + merchantId))).status).toBe(400);
    expect(db.server).not.toHaveBeenCalled();
  });
  it('creates offline bookings only with an explicit source and UUID idempotency key', async () => {
    membership(); result(saved);
    const response = await POST(write(input)); expect(response.status).toBe(201);
    expect((await response.json()).booking.source).toBe('phone');
    expect(db.rpc).toHaveBeenCalledWith('partner_booking_create', expect.objectContaining({ p_request_id: id, p_source: 'phone', p_customer_name: 'Customer' }));
    expect((await POST(write({ ...input, source: 'app' }))).status).toBe(400);
    expect((await POST(write({ ...input, requestId: 'constant' }))).status).toBe(400);
  });
  it('blocks writes by a suspended merchant while allowing read access', async () => {
    membership('suspended'); result(saved); expect((await POST(write(input))).status).toBe(403);
    expect(db.rpc).not.toHaveBeenCalled();
    membership('suspended'); result(saved); expect((await detailGET(get('/' + id), route())).status).toBe(200);
  });
  it('preserves full optimistic timestamps and persists cancellation reasons', async () => {
    membership(); result({ ...saved, status: 'cancelled', cancelledBy: 'merchant', cancelReason: 'Customer asked' });
    const response = await PATCH(write({ action: 'cancel', expectedUpdatedAt: updatedAt, cancelReason: ' Customer asked ' }, '/' + id), route());
    expect(response.status).toBe(200);
    expect(db.rpc).toHaveBeenCalledWith('partner_booking_mutate', { p_id: id, p_action: 'cancel', p_expected_updated_at: updatedAt, p_cancel_reason: 'Customer asked', p_start_at: null, p_staff_id: null });
  });
  it('restricts rescheduling to time/staff rather than accepting caller-supplied price or duration', async () => {
    const move = { action: 'reschedule', expectedUpdatedAt: updatedAt, startAt, staffId: null };
    expect(partnerBookingMutation(move)).toBe(true);
    expect(partnerBookingMutation({ ...move, totalKrw: 1 })).toBe(false);
    expect(partnerBookingMutation({ ...move, serviceId })).toBe(false);
    membership(); result(saved); expect((await PATCH(write(move, '/' + id), route())).status).toBe(200);
    expect(db.rpc).toHaveBeenCalledWith('partner_booking_mutate', expect.objectContaining({ p_action: 'reschedule', p_start_at: startAt, p_staff_id: null }));
  });
  it('maps conflicts without leaking database internals', async () => {
    membership(); result(null, { code: 'P0001', message: 'BOOKING_CONFLICT' });
    const response = await PATCH(write({ action: 'confirm', expectedUpdatedAt: updatedAt }, '/' + id), route());
    expect(response.status).toBe(409); expect((await response.json()).code).toBe('BOOKING_CONFLICT');
    membership(); result(null, { code: 'XX000', message: 'private contact data' });
    const failure = await GET(get()); expect(failure.status).toBe(503); expect(await failure.text()).not.toContain('private contact');
  });
  it('returns snapshot availability and rejects wrong-day or wrong-staff RPC results', async () => {
    const slot = { startAt, serviceEndAt: saved.serviceEndAt, occupiedUntil: saved.occupiedUntil, staffId: null };
    membership(); result({ slots: [slot], quoteVersion: 'snapshot' });
    expect((await availabilityGET(get(`/${id}/availability?date=2026-10-21`), route())).status).toBe(200);
    expect(db.rpc).toHaveBeenCalledWith('partner_booking_availability', { p_id: id, p_date: '2026-10-21', p_staff_id: null });
    membership(); result({ slots: [{ ...slot, staffId: serviceId }], quoteVersion: 'snapshot' });
    expect((await availabilityGET(get(`/${id}/availability?date=2026-10-21`), route())).status).toBe(503);
    expect((await availabilityGET(get(`/${id}/availability?date=2026-02-30`), route())).status).toBe(400);
  });
});
