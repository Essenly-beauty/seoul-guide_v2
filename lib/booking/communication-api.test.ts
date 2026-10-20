import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({ server: vi.fn(), rpc: vi.fn(), getUser: vi.fn(), from: vi.fn(), select: vi.fn(), eq: vi.fn(), is: vi.fn(), maybeSingle: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({ supabaseServer: db.server }));
import { GET, POST, PATCH } from '@/app/api/bookings/[id]/messages/route';
import { POST as partnerPOST, GET as partnerGET } from '@/app/api/partner/operations/bookings/[id]/messages/route';
import { GET as noteGET, PATCH as notePATCH } from '@/app/api/partner/operations/customers/[id]/route';
import { GET as threadsGET } from '@/app/api/partner/operations/messages/route';
import { bookingMessageSnapshot } from './communication-contracts';

const id = '11111111-1111-4111-8111-111111111111';
const userId = '22222222-2222-4222-8222-222222222222';
const merchantId = '33333333-3333-4333-8333-333333333333';
const serviceId = '44444444-4444-4444-8444-444444444444';
const customerId = '55555555-5555-4555-8555-555555555555';
const updatedAt = '2026-10-20T10:00:00.123456+00:00';
const startAt = '2026-10-21T10:00:00+09:00';
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


const message = { id: customerId, bookingId: id, body: 'Is parking available?', sender: 'customer', createdAt: updatedAt };
const snapshot = { availability: 'available', messages: [message], readState: { customerReadAt: null, merchantReadAt: null } };

describe('booking communication boundaries', () => {
  it('uses the customer participant scope and exposes no auth IDs', async () => {
    result(snapshot); const response = await GET(get(), route()); expect(response.status).toBe(200);
    expect(await response.json()).toEqual(snapshot);
    expect(db.rpc).toHaveBeenCalledWith('booking_messages', { p_id: id, p_partner: false, p_body: null, p_request_id: null, p_read_at: null });
    expect(db.from).not.toHaveBeenCalled();
    expect(bookingMessageSnapshot({ ...snapshot, messages: [{ ...message, senderId: userId }] })).toBe(false);
  });
  it('uses merchant membership for the partner thread', async () => {
    membership(); result(snapshot); expect((await partnerGET(get(), route())).status).toBe(200);
    expect(db.rpc).toHaveBeenCalledWith('booking_messages', expect.objectContaining({ p_partner: true }));
  });
  it('sends trimmed text with a stable request UUID and rejects sender spoofing', async () => {
    result(snapshot); expect((await POST(write({ requestId: serviceId, body: ' Parking? ' }), route())).status).toBe(201);
    expect(db.rpc).toHaveBeenCalledWith('booking_messages', expect.objectContaining({ p_body: 'Parking?', p_request_id: serviceId, p_partner: false }));
    const invalid = [{ requestId: serviceId, body: ' ', sender: 'merchant' }, { requestId: 'constant', body: 'hello' }, { requestId: serviceId, body: 'a'.repeat(2001) }];
    for (const input of invalid) expect((await POST(write(input), route())).status).toBe(400);
  });
  it('rejects cross-origin sends and unauthenticated reads', async () => {
    expect((await POST(write({ requestId: serviceId, body: 'hello' }, '', 'https://attacker.test'), route())).status).toBe(403);
    expect(db.rpc).not.toHaveBeenCalled();
    db.getUser.mockResolvedValue({ data: { user: null }, error: null }); expect((await GET(get(), route())).status).toBe(401);
  });
  it('marks only the caller read timestamp and rejects foreign-party fields', async () => {
    result(snapshot); expect((await PATCH(write({ readAt: updatedAt }), route())).status).toBe(200);
    expect(db.rpc).toHaveBeenCalledWith('booking_messages', expect.objectContaining({ p_read_at: updatedAt, p_body: null, p_partner: false }));
    expect((await PATCH(write({ readAt: updatedAt, merchantReadAt: updatedAt }), route())).status).toBe(400);
  });
  it('fails closed when a thread response contains another booking', async () => {
    result({ ...snapshot, messages: [{ ...message, bookingId: serviceId }] });
    const response = await GET(get(), route()); expect(response.status).toBe(503); expect(await response.text()).not.toContain(message.body);
  });
  it('reports offline unavailability and blocks suspended merchant sends', async () => {
    membership(); result(null, { code: 'P0001', message: 'BOOKING_MESSAGES_UNAVAILABLE' });
    const response = await partnerPOST(write({ requestId: serviceId, body: 'hello' }), route()); expect(response.status).toBe(409); expect((await response.json()).code).toBe('BOOKING_MESSAGES_UNAVAILABLE');
    db.rpc.mockClear(); membership('suspended'); expect((await partnerPOST(write({ requestId: serviceId, body: 'hello' }), route())).status).toBe(403); expect(db.rpc).not.toHaveBeenCalled();
  });
  it('version-checks customer notes and refuses private tenant selectors', async () => {
    membership(); result({ id: customerId, notes: 'Sensitive scalp', updatedAt });
    expect((await notePATCH(write({ notes: 'Sensitive scalp', expectedUpdatedAt: updatedAt }), route(customerId))).status).toBe(200);
    expect(db.rpc).toHaveBeenCalledWith('partner_customer_note', { p_id: customerId, p_notes: 'Sensitive scalp', p_expected_updated_at: updatedAt });
    expect((await notePATCH(write({ notes: 'x'.repeat(2001), expectedUpdatedAt: updatedAt }), route(customerId))).status).toBe(400);
    expect((await noteGET(get('?merchantId=' + merchantId), route(customerId))).status).toBe(400);
  });
  it('returns thread previews with unread counts without exposing sender credentials', async () => {
    membership(); const threads = [{ bookingId: id, lastMessage: message, unreadCount: 1, readState: snapshot.readState }]; result(threads);
    const response = await threadsGET(get()); expect(response.status).toBe(200); expect(await response.json()).toEqual({ threads });
    membership(); result([{ ...threads[0], lastMessage: { ...message, sender_id: userId } }]); expect((await threadsGET(get())).status).toBe(503);
  });
});
