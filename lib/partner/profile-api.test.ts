import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({ server: vi.fn(), rpc: vi.fn(), getUser: vi.fn(), from: vi.fn(), select: vi.fn(), eq: vi.fn(), is: vi.fn(), maybeSingle: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({ supabaseServer: db.server }));
import { GET, PATCH } from '@/app/api/partner/operations/profile/route';
import { GET as publicGET } from '@/app/api/places/[id]/profile/route';
import { PATCH as staffPATCH } from '@/app/api/partner/operations/staff/[id]/profile/route';
import { publicStoreProfile } from '@/lib/partner/profile-contracts';

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


const profile = { contactPhone: '02-1234-5678', contactEmail: 'salon@example.test', englishOk: false, notice: '', nameKo: 'Salon', nameEn: '', address: 'Seoul', introductionKo: '', introductionEn: '', updatedAt };
const instant = { contactPhone: profile.contactPhone, contactEmail: profile.contactEmail, englishOk: true, notice: 'Open today' };
const review = { nameKo: 'New name', nameEn: 'New English name', address: 'New address', introductionKo: '', introductionEn: 'New description' };
const snapshot = { profile, pendingReview: null, placeId: 'known' };
describe('merchant profile publishing boundary', () => {
  it('loads the merchant snapshot using the authenticated scope', async () => {
    membership(); result(snapshot); const response = await GET(get()); expect(response.status).toBe(200); expect(await response.json()).toEqual(snapshot);
    expect(db.rpc).toHaveBeenCalledWith('partner_store_profile', { p_action: null, p_values: null, p_review_id: null, p_expected_updated_at: null });
  });
  it('sends only instant fields with a version token', async () => {
    membership(); result({ ...snapshot, profile: { ...profile, ...instant } });
    expect((await PATCH(write({ action: 'update', expectedUpdatedAt: updatedAt, values: instant }))).status).toBe(200);
    expect(db.rpc).toHaveBeenCalledWith('partner_store_profile', expect.objectContaining({ p_action: 'update', p_values: instant, p_expected_updated_at: updatedAt }));
    expect((await PATCH(write({ action: 'update', expectedUpdatedAt: updatedAt, values: { ...instant, address: 'Unreviewed' } }))).status).toBe(400);
  });
  it('persists review requests without publishing requested names or addresses', async () => {
    membership(); result({ ...snapshot, pendingReview: { id, fields: review, createdAt: updatedAt, updatedAt } });
    const response = await PATCH(write({ action: 'request_review', expectedUpdatedAt: updatedAt, values: review })); expect(response.status).toBe(200);
    const data=await response.json(); expect(data.profile.address).toBe('Seoul'); expect(data.pendingReview.fields.address).toBe('New address');
  });
  it('serves only the published public projection without requiring authentication', async () => {
    result({ status: 'published', placeId: 'known', profile });
    const response=await publicGET(get(), route('known')); expect(response.status).toBe(200); expect(db.getUser).not.toHaveBeenCalled();
    expect(publicStoreProfile({ status: 'published', placeId: 'known', profile, pendingReview: { fields: review } })).toBe(false);
    result({ status: 'published', placeId: 'other-place', profile }); expect((await publicGET(get(), route('known'))).status).toBe(503);
  });
  it('rejects cross-origin edits and suspended-merchant changes', async () => {
    expect((await PATCH(write({ action: 'update', expectedUpdatedAt: updatedAt, values: instant }, '', 'https://attacker.test'))).status).toBe(403);
    membership('suspended'); expect((await PATCH(write({ action: 'update', expectedUpdatedAt: updatedAt, values: instant }))).status).toBe(403);
    expect(db.rpc).not.toHaveBeenCalled();
  });
  it('atomically updates base staff copy and English fields through the new endpoint', async () => {
    const values={name:'Min',title:'Designer',introduction:'소개',visibility:'visible',sortOrder:0,nameEn:'Min English',introductionEn:'English introduction'};
    membership(); result({ ...values, id, updatedAt }); expect((await staffPATCH(write({ ...values, expectedUpdatedAt: updatedAt }), route())).status).toBe(200);
    expect(db.rpc).toHaveBeenCalledWith('partner_staff_profile', {p_id:id,p_values:values,p_expected_updated_at:updatedAt,p_create:false});
    expect((await staffPATCH(write({ ...values, expectedUpdatedAt: updatedAt, merchantId }), route())).status).toBe(400);
  });
});
