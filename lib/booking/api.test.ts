import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({ server: vi.fn(), rpc: vi.fn(), getUser: vi.fn(), from: vi.fn(), select: vi.fn(), eq: vi.fn(), is: vi.fn(), maybeSingle: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({ supabaseServer: db.server }));
vi.mock('@/lib/data', () => ({ getPlace: (id: string) => id === 'known' ? { id } : undefined }));

import { GET as catalogGET, dynamic as catalogDynamic } from '@/app/api/places/[id]/booking/route';
import { GET as slotsGET, dynamic as slotsDynamic } from '@/app/api/places/[id]/availability/route';
import { GET as listGET, POST, dynamic as listDynamic } from '@/app/api/bookings/route';
import { GET as detailGET, PATCH as customerPATCH, dynamic as detailDynamic } from '@/app/api/bookings/[id]/route';
import { GET as partnerGET, dynamic as partnerDynamic } from '@/app/api/partner/bookings/route';
import { PATCH as partnerPATCH, dynamic as partnerDetailDynamic } from '@/app/api/partner/bookings/[id]/route';

const id = '11111111-1111-4111-8111-111111111111';
const userId = '22222222-2222-4222-8222-222222222222';
const merchantId = '33333333-3333-4333-8333-333333333333';
const serviceId = '44444444-4444-4444-8444-444444444444';
const requestId = '55555555-5555-4555-8555-555555555555';
const startAt = '2026-10-21T10:00:00+09:00';
const updatedAt = '2026-10-20T10:00:00.123456+00:00';
const saved = { id, placeId: 'known', merchantName: 'Salon', serviceName: 'Cut', staffName: null, startAt, serviceEndAt: '2026-10-21T11:00:00+09:00', totalKrw: 30000, status: 'requested', paymentMode: 'pay_at_venue', customerName: 'Customer', phone: '+82 10 1234 5678', notes: '', createdAt: updatedAt, updatedAt, cancelledBy: null };
const input = { placeId: 'known', serviceId, staffId: null, startAt, quoteVersion: 'quote', requestId, customerName: '  Customer  ', phone: '+82 10 1234 5678', notes: '' };
const route = (value = id) => ({ params: Promise.resolve({ id: value }) });
const get = (path: string) => new Request(`https://example.test${path}`);
const write = (path: string, body: unknown, headers: Record<string, string> = {}, method = 'POST') => new Request(`https://example.test${path}`, { method, headers: { Origin: 'https://example.test', Host: 'example.test', 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
const auth = (user: unknown, error: unknown = null) => db.getUser.mockResolvedValue({ data: { user }, error });
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
  auth({ id: userId }); result(saved);
});

describe('public booking reads', () => {
  it('looks up the exact known place through its safe RPC without requiring auth', async () => {
    const catalog = { status: 'unavailable', placeId: 'known' }; result(catalog);
    const response = await catalogGET(get('/api/places/known/booking'), route('known'));
    expect(response.status).toBe(200); expect(await response.json()).toEqual(catalog);
    expect(db.rpc).toHaveBeenCalledWith('booking_catalog', { p_place_id: 'known' });
    expect(db.getUser).not.toHaveBeenCalled(); expect(db.from).not.toHaveBeenCalled();
    expect(response.headers.get('Cache-Control')).toBe('private, no-store'); expect(response.headers.get('Vary')).toBe('Cookie');
  });
  it('rejects unknown places and extra query parameters without storage access', async () => {
    expect((await catalogGET(get('/api/places/missing/booking'), route('missing'))).status).toBe(404);
    expect((await catalogGET(get('/api/places/known/booking?merchantId=another'), route('known'))).status).toBe(400);
    expect(db.server).not.toHaveBeenCalled();
  });
  it('fails closed on cross-place and extra private fields in the catalog', async () => {
    for (const data of [{ status: 'unavailable', placeId: 'another' }, { status: 'unavailable', placeId: 'known', private: 'secret' }]) {
      result(data); const response = await catalogGET(get('/api/places/known/booking'), route('known'));
      expect(response.status).toBe(503); expect(await response.text()).not.toContain('secret');
    }
  });
  it('retrieves fresh slots using only the allowed place, service, staff and date', async () => {
    const available = { slots: [{ startAt, serviceEndAt: saved.serviceEndAt, occupiedUntil: saved.serviceEndAt, staffId: null }], quoteVersion: 'quote' }; result(available);
    const response = await slotsGET(get(`/api/places/known/availability?serviceId=${serviceId}&date=2026-10-21`), route('known'));
    expect(response.status).toBe(200); expect(await response.json()).toEqual(available);
    expect(db.rpc).toHaveBeenCalledWith('booking_availability', { p_place_id: 'known', p_service_id: serviceId, p_staff_id: null, p_date: '2026-10-21' });
    expect(response.headers.get('Cache-Control')).toContain('no-store');
  });
  it('rejects invalid or repeated dates and tenant selectors before RPC access', async () => {
    for (const extra of ['date=2026-02-30', 'date=2026-10-21&date=2026-10-22', `date=2026-10-21&merchantId=${merchantId}`]) {
      expect((await slotsGET(get(`/api/places/known/availability?serviceId=${serviceId}&${extra}`), route('known'))).status).toBe(400);
    }
    expect(db.rpc).not.toHaveBeenCalled();
  });
  it('does not return slots for another local date or staff member', async () => {
    for (const slot of [{ startAt: '2026-10-22T10:00:00+09:00', serviceEndAt: '2026-10-22T11:00:00+09:00', occupiedUntil: '2026-10-22T11:00:00+09:00', staffId: null }, { startAt, serviceEndAt: saved.serviceEndAt, occupiedUntil: saved.serviceEndAt, staffId: id }]) {
      result({ slots: [slot], quoteVersion: 'quote' });
      expect((await slotsGET(get(`/api/places/known/availability?serviceId=${serviceId}&date=2026-10-21`), route('known'))).status).toBe(503);
    }
  });
});

describe('customer booking authentication and isolation', () => {
  it('rejects unauthenticated private reads and writes before any reservation RPC', async () => {
    auth(null);
    const responses = await Promise.all([
      listGET(get('/api/bookings')), detailGET(get(`/api/bookings/${id}`), route()),
      POST(write('/api/bookings', input)), customerPATCH(write(`/api/bookings/${id}`, { action: 'cancel' }, {}, 'PATCH'), route()),
      partnerGET(get('/api/partner/bookings')), partnerPATCH(write(`/api/partner/bookings/${id}`, { action: 'confirm', expectedUpdatedAt: updatedAt }, {}, 'PATCH'), route()),
    ]);
    expect(responses.map((response) => response.status)).toEqual([401, 401, 401, 401, 401, 401]);
    expect(db.rpc).not.toHaveBeenCalled(); expect(db.from).not.toHaveBeenCalled();
  });
  it.each([{ name: 'AuthSessionMissingError' }, { status: 401 }, { code: 'bad_jwt' }])('maps expired auth to 401: %j', async (error) => {
    auth(null, error); expect((await listGET(get('/api/bookings'))).status).toBe(401); expect(db.rpc).not.toHaveBeenCalled();
  });
  it('keeps an auth outage distinct from a signed-out user', async () => {
    auth(null, { status: 500, message: 'secret auth endpoint' });
    const response = await listGET(get('/api/bookings')); expect(response.status).toBe(503); expect(await response.text()).not.toContain('secret');
  });
  it('creates from the verified cookie user without accepting identity or price parameters', async () => {
    const response = await POST(write('/api/bookings', input));
    expect(response.status).toBe(201); expect(await response.json()).toEqual({ booking: saved });
    expect(db.getUser).toHaveBeenCalledOnce();
    expect(db.rpc).toHaveBeenCalledWith('booking_create', { p_place_id: 'known', p_service_id: serviceId, p_staff_id: null, p_start_at: startAt, p_quote_version: 'quote', p_request_id: requestId, p_customer_name: 'Customer', p_phone: input.phone, p_notes: '' });
    expect(db.getUser.mock.invocationCallOrder[0]).toBeLessThan(db.rpc.mock.invocationCallOrder[0]);
  });
  it.each([{ userId }, { merchantId }, { totalKrw: 1 }, { partner: true }, { status: 'confirmed' }, { startAt: 'invalid' }, { phone: '123' }])('rejects spoofed or malformed creation fields %j', async (extra) => {
    expect((await POST(write('/api/bookings', { ...input, ...extra }))).status).toBe(400); expect(db.rpc).not.toHaveBeenCalled();
  });
  it('keeps list ownership in the database auth context and rejects tenant query overrides', async () => {
    result([saved]); const response = await listGET(get('/api/bookings'));
    expect(response.status).toBe(200); expect(await response.json()).toEqual({ bookings: [saved] });
    expect(db.rpc).toHaveBeenCalledWith('booking_list', { p_partner: false });
    db.rpc.mockClear(); expect((await listGET(get(`/api/bookings?userId=${userId}`))).status).toBe(400); expect(db.rpc).not.toHaveBeenCalled();
  });
  it('returns 404 for inaccessible IDs and fails closed on a mismatched returned ID', async () => {
    result(null); expect((await detailGET(get(`/api/bookings/${id}`), route())).status).toBe(404);
    expect(db.rpc).toHaveBeenCalledWith('booking_get', { p_id: id, p_partner: false });
    result({ ...saved, id: merchantId }); expect((await detailGET(get(`/api/bookings/${id}`), route())).status).toBe(503);
  });
  it('allows customer cancellation only and passes no partner authority', async () => {
    result({ ...saved, status: 'cancelled', cancelledBy: 'customer' });
    expect((await customerPATCH(write(`/api/bookings/${id}`, { action: 'cancel' }, {}, 'PATCH'), route())).status).toBe(200);
    expect(db.rpc).toHaveBeenCalledWith('booking_transition', { p_id: id, p_action: 'cancel', p_partner: false, p_expected_updated_at: null });
    db.rpc.mockClear();
    expect((await customerPATCH(write(`/api/bookings/${id}`, { action: 'confirm' }, {}, 'PATCH'), route())).status).toBe(400);
    expect(db.rpc).not.toHaveBeenCalled();
  });
});

describe('booking write boundary', () => {
  it.each<Record<string, string>>([{ Origin: 'https://evil.test' }, { Origin: 'null' }, { Origin: '' }, { Origin: 'https://example.test/' }, { Host: 'evil.test' }, { Origin: 'https://evil.test', 'X-Forwarded-Host': 'evil.test' }])('rejects mismatched or missing origins %j before storage access', async (headers) => {
    expect((await POST(write('/api/bookings', input, headers))).status).toBe(403); expect(db.server).not.toHaveBeenCalled();
  });
  it('applies the same origin boundary to customer and partner transitions', async () => {
    expect((await customerPATCH(write(`/api/bookings/${id}`, { action: 'cancel' }, { Origin: 'https://evil.test' }, 'PATCH'), route())).status).toBe(403);
    expect((await partnerPATCH(write(`/api/partner/bookings/${id}`, { action: 'confirm', expectedUpdatedAt: updatedAt }, { Origin: 'https://evil.test' }, 'PATCH'), route())).status).toBe(403);
    expect(db.server).not.toHaveBeenCalled();
  });
  it('rejects other media types, malformed JSON and oversized streamed bodies', async () => {
    expect((await POST(write('/api/bookings', input, { 'Content-Type': 'text/plain' }))).status).toBe(415);
    const make = (body: string) => new Request('https://example.test/api/bookings', { method: 'POST', headers: { Origin: 'https://example.test', 'Content-Type': 'application/json' }, body });
    expect((await POST(make('{broken'))).status).toBe(400);
    expect((await POST(make(JSON.stringify({ notes: 'x'.repeat(301 * 1024) })))).status).toBe(413);
    expect(db.server).not.toHaveBeenCalled();
  });
});

describe('partner booking authority', () => {
  it('verifies active membership before listing and does not accept a merchant selector', async () => {
    membership(); result([saved]);
    const response = await partnerGET(get('/api/partner/bookings'));
    expect(response.status).toBe(200); expect(await response.json()).toEqual({ bookings: [saved] });
    expect(db.eq).toHaveBeenCalledWith('user_id', userId); expect(db.is).toHaveBeenCalledWith('revoked_at', null);
    expect(db.eq).toHaveBeenCalledWith('id', merchantId); expect(db.rpc).toHaveBeenCalledWith('booking_list', { p_partner: true });
    db.rpc.mockClear(); expect((await partnerGET(get(`/api/partner/bookings?merchantId=${id}`))).status).toBe(400); expect(db.rpc).not.toHaveBeenCalled();
  });
  it('rejects users without active membership and forged cross-user membership rows', async () => {
    db.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    expect((await partnerGET(get('/api/partner/bookings'))).status).toBe(403);
    db.maybeSingle.mockResolvedValueOnce({ data: { merchant_id: merchantId, user_id: id, revoked_at: null }, error: null });
    expect((await partnerGET(get('/api/partner/bookings'))).status).toBe(503); expect(db.rpc).not.toHaveBeenCalled();
  });
  it('blocks suspended merchant writes before calling the booking RPC', async () => {
    membership('suspended');
    const response = await partnerPATCH(write(`/api/partner/bookings/${id}`, { action: 'confirm', expectedUpdatedAt: updatedAt }, {}, 'PATCH'), route());
    expect(response.status).toBe(403); expect((await response.json()).code).toBe('PARTNER_READ_ONLY'); expect(db.rpc).not.toHaveBeenCalled();
  });
  it('passes the exact concurrency version and maps database cross-tenant rejection', async () => {
    membership(); result(null, { code: 'P0001', message: 'PARTNER_FORBIDDEN', details: 'other merchant secret' });
    const response = await partnerPATCH(write(`/api/partner/bookings/${id}`, { action: 'confirm', expectedUpdatedAt: updatedAt }, {}, 'PATCH'), route());
    expect(response.status).toBe(403); expect(await response.text()).not.toContain('secret');
    expect(db.rpc).toHaveBeenCalledWith('booking_transition', { p_id: id, p_action: 'confirm', p_partner: true, p_expected_updated_at: updatedAt });
  });
  it('requires concurrency version and disallows arbitrary status assignments', async () => {
    expect((await partnerPATCH(write(`/api/partner/bookings/${id}`, { action: 'confirm' }, {}, 'PATCH'), route())).status).toBe(400);
    expect((await partnerPATCH(write(`/api/partner/bookings/${id}`, { action: 'confirm', expectedUpdatedAt: updatedAt, merchantId }, {}, 'PATCH'), route())).status).toBe(400);
    expect(db.server).not.toHaveBeenCalled();
  });
});

describe('safe booking failures and freshness', () => {
  it.each([['STALE_SELECTION', 409], ['SLOT_UNAVAILABLE', 409], ['BOOKING_CONFLICT', 409], ['BOOKING_UNAVAILABLE', 409], ['BOOKING_NOT_FOUND', 404], ['AUTH_REQUIRED', 401], ['INVALID_REQUEST', 400]])('maps allowlisted database failure %s to %i', async (message, status) => {
    result(null, { code: 'P0001', message, details: 'secret SQL internals' });
    const response = await POST(write('/api/bookings', input)); expect(response.status).toBe(status); expect(await response.json()).toMatchObject({ code: message });
  });
  it.each([{ code: 'P0001', message: 'secret SQL internals' }, { code: '42P01', message: 'private table name' }, { code: 'XX000', message: 'AUTH_REQUIRED' }])('does not trust nonallowlisted database errors %j', async (error) => {
    result(null, error); const response = await POST(write('/api/bookings', input));
    expect(response.status).toBe(503); expect(await response.json()).toEqual({ code: 'BOOKING_SERVICE_UNAVAILABLE', error: '예약 정보를 처리할 수 없습니다. 잠시 후 다시 시도해 주세요.' });
  });
  it.each(['23514', '23505'])('maps database constraint race %s to a safe conflict', async (code) => {
    result(null, { code, message: 'private constraint name' });
    const response = await POST(write('/api/bookings', input)); expect(response.status).toBe(409); expect((await response.json()).code).toBe('BOOKING_CONFLICT');
  });
  it('does not cache any route and requests the underlying RPC anew on each read', async () => {
    expect([catalogDynamic, slotsDynamic, listDynamic, detailDynamic, partnerDynamic, partnerDetailDynamic]).toEqual(Array(6).fill('force-dynamic'));
    db.rpc.mockResolvedValueOnce({ data: [saved], error: null }).mockResolvedValueOnce({ data: [], error: null });
    expect(await (await listGET(get('/api/bookings'))).json()).toEqual({ bookings: [saved] });
    const next = await listGET(get('/api/bookings')); expect(await next.json()).toEqual({ bookings: [] });
    expect(db.rpc).toHaveBeenCalledTimes(2); expect(next.headers.get('Cache-Control')).toBe('private, no-store'); expect(next.headers.get('Vary')).toBe('Cookie');
  });
  it('sanitizes thrown client configuration and network exceptions', async () => {
    db.server.mockImplementation(() => { throw new Error('service key and private URL'); });
    const response = await listGET(get('/api/bookings')); expect(response.status).toBe(503); expect(await response.text()).not.toContain('private');
  });
});
