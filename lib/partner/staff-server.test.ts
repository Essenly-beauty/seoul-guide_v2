import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getPartnerContext, type PartnerContext } from './server';
import { getStaffDetail, getStaffList } from './staff-server';

const merchantId = '11111111-1111-1111-1111-111111111111';
const staffId = '22222222-2222-2222-2222-222222222222';
const menuId = '33333333-3333-3333-3333-333333333333';
const otherId = '44444444-4444-4444-4444-444444444444';
const userId = '55555555-5555-5555-5555-555555555555';
const stamp = '2026-10-18T01:02:03.123456+00:00';
const profile = { id: staffId, merchant_id: merchantId, name: '민지', title: '디자이너', introduction: '', visibility: 'visible', sort_order: 2, updated_at: stamp };
const link = { merchant_id: merchantId, staff_id: staffId, service_id: menuId };
const schedule = { merchant_id: merchantId, staff_id: staffId, hours: [{ weekday: 1, startMinute: 540, endMinute: 1080 }], breaks: [], blocks: [], overrides: [{ date: '2026-11-05', hours: [], breaks: [] }], updated_at: stamp };
const merchant = { id: merchantId, displayName: 'Shop', contactEmail: '', contactPhone: '', address: '', businessTypes: ['hair'] as ['hair'], status: 'active' as const, bookingEnabled: false, updatedAt: stamp };
const merchantRow = { id: merchantId, display_name: 'Shop', contact_email: '', contact_phone: '', address: '', business_types: ['hair'], status: 'active', booking_enabled: false, updated_at: stamp };
const context: PartnerContext = { userId, merchant, readOnly: false };
type Result = { data: unknown; error: unknown; rejection?: Error };
type QueryCall = { table: string; steps: [string, unknown[]][] };
type Answer = Result | ((call: QueryCall) => Result);
const result = (data: unknown, error: unknown = null): Result => ({ data, error });

function boundary(results: Answer[], authUser: unknown = { id: userId }) {
  const calls: QueryCall[] = [];
  const client = {
    auth: { getUser: vi.fn(async () => ({ data: { user: authUser }, error: null })) },
    from: vi.fn((table: string) => {
      const call = { table, steps: [] as [string, unknown[]][] };
      calls.push(call);
      const builder: Record<string, unknown> = {};
      for (const method of ['select', 'eq', 'gt', 'order', 'range', 'limit', 'in', 'is']) {
        builder[method] = (...args: unknown[]) => { call.steps.push([method, args]); return builder; };
      }
      const resolve = () => {
        const fallback = table === 'merchant_staff' ? result([]) :
          table === 'merchant_memberships' ? result({ merchant_id: merchantId, user_id: userId, revoked_at: null }) :
          table === 'merchants' ? result(merchantRow) : result(null);
        const answer = results.shift() ?? fallback;
        const next = typeof answer === 'function' ? answer(call) : answer;
        return next.rejection ? Promise.reject(next.rejection) : Promise.resolve(next);
      };
      builder.maybeSingle = resolve;
      builder.then = (success: (value: Result) => unknown, failure?: (error: unknown) => unknown) => resolve().then(success, failure);
      return builder;
    }),
  };
  return { client: client as unknown as SupabaseClient, calls };
}

function detailResults(links: unknown = [link], calendar: unknown = schedule, services: unknown = [{ id: menuId, merchant_id: merchantId }]) {
  const needsLinkEnd = Array.isArray(links) && links.length > 0 && links.length <= 1000;
  return [result(profile), result(links), ...(needsLinkEnd ? [result([])] : []), result(calendar),
    ...(Array.isArray(links) && links.length ? [result(services)] : [])];
}

describe('staff list projection', () => {
  it('returns only profile summaries with no asserted menu assignments', async () => {
    const mock = boundary([result([profile])]);
    const list = await getStaffList(mock.client, context);
    expect(list).toMatchObject({ merchantId, staff: [{ id: staffId, merchantId, name: '민지', updatedAt: stamp }], readOnly: false });
    expect(list.staff[0]).not.toHaveProperty('menuIds');
    expect(list.loadedAt).toMatch(/^\d{4}-\d\d-\d\dT/);
    expect(mock.calls[0]).toEqual({ table: 'merchant_staff', steps: [
      ['select', ['id,merchant_id,name,title,introduction,visibility,sort_order,updated_at']],
      ['eq', ['merchant_id', merchantId]], ['order', ['id', { ascending: true }]], ['range', [0, 199]],
    ] });
    expect(mock.calls.map((call) => call.table)).toEqual(['merchant_staff', 'merchant_staff', 'merchant_memberships', 'merchants']);
  });

  it('pages 200 at a time in strictly increasing ID order', async () => {
    const page = Array.from({ length: 200 }, (_, index) => ({ ...profile, id: `00000000-0000-0000-0000-${String(index).padStart(12, '0')}` }));
    const mock = boundary([result(page), result([profile])]);
    expect((await getStaffList(mock.client, context)).staff).toHaveLength(201);
    expect(mock.calls[1].steps).toContainEqual(['gt', ['id', page[199].id]]);
    expect(mock.calls[1].steps).toContainEqual(['range', [0, 199]]);
  });

  it('does not skip the next ID when an earlier row is deleted between pages', async () => {
    const ids = Array.from({ length: 201 }, (_, index) => `00000000-0000-0000-0000-${String(index).padStart(12, '0')}`);
    let rows = ids.map((id) => ({ ...profile, id }));
    const queriedPage = (call: QueryCall): Result => {
      const cursor = call.steps.find(([method]) => method === 'gt')?.[1][1] as string | undefined;
      const [start, end] = call.steps.find(([method]) => method === 'range')![1] as [number, number];
      const page = rows.filter((row) => !cursor || row.id > cursor).slice(start, end + 1);
      rows = rows.filter((row) => row.id !== ids[0]);
      return result(page);
    };
    const mock = boundary([queriedPage, queriedPage]);
    const list = await getStaffList(mock.client, context);
    expect(list.staff.map((member) => member.id)).toContain(ids[200]);
    expect(mock.calls[1].steps).toContainEqual(['gt', ['id', ids[199]]]);
  });

  it('continues after a short nonempty page until a verified empty page', async () => {
    const later = { ...profile, id: otherId };
    const mock = boundary([result([profile]), result([later]), result([]),
      result({ merchant_id: merchantId, user_id: userId, revoked_at: null }), result(merchantRow)]);
    expect((await getStaffList(mock.client, context)).staff.map((member) => member.id)).toEqual([staffId, otherId]);
    expect(mock.calls[1].steps).toContainEqual(['gt', ['id', staffId]]);
    expect(mock.calls[2].steps).toContainEqual(['gt', ['id', otherId]]);
  });

  it('rejects a 10,001st row with a bounded extra page', async () => {
    const pages = Array.from({ length: 50 }, (_, page) => result(Array.from({ length: 200 }, (_, index) => ({ ...profile, id: `00000000-0000-0000-0000-${String(page * 200 + index).padStart(12, '0')}` }))));
    const mock = boundary([...pages, result([profile])]);
    await expect(getStaffList(mock.client, context)).rejects.toMatchObject({ status: 503, code: 'PARTNER_LIMIT_EXCEEDED' });
    expect(mock.calls).toHaveLength(51);
    expect(mock.calls[50].steps).toContainEqual(['gt', ['id', '00000000-0000-0000-0000-000000009999']]);
    expect(mock.calls[50].steps).toContainEqual(['range', [0, 0]]);
  });

  it('accepts exactly 10,000 profiles only after an empty sentinel query', async () => {
    const pages = Array.from({ length: 50 }, (_, page) => result(Array.from({ length: 200 }, (_, index) => ({ ...profile, id: `00000000-0000-0000-0000-${String(page * 200 + index).padStart(12, '0')}` }))));
    const mock = boundary([...pages, result([])]);
    expect((await getStaffList(mock.client, context)).staff).toHaveLength(10000);
    expect(mock.calls).toHaveLength(53);
    expect(mock.calls[50].steps).toContainEqual(['range', [0, 0]]);
  });

  it('rejects an out-of-order ID across page boundaries', async () => {
    const page = Array.from({ length: 200 }, (_, index) => ({ ...profile, id: `00000000-0000-0000-0000-${String(index).padStart(12, '0')}` }));
    await expect(getStaffList(boundary([result(page), result([page[199]])]).client, context))
      .rejects.toMatchObject({ status: 503, code: 'PARTNER_UNAVAILABLE' });
  });

  it.each([
    result(null), result([null]), result([{ ...profile, merchant_id: otherId }]),
    result([{ ...profile, name: '   ' }]), result([{ ...profile, sort_order: '2' }]),
    result([{ ...profile, updated_at: 'invalid' }]), result([profile, profile]),
    result(null, { message: 'private SQL details' }),
    { data: null, error: null, rejection: new Error('private transport details') },
  ])('fails closed for malformed, foreign, duplicate, or failed pages %#', async (page) => {
    await expect(getStaffList(boundary([page]).client, context)).rejects.toMatchObject({ status: 503, code: 'PARTNER_UNAVAILABLE' });
  });

  it('allows a verified suspended owner to read and propagates readOnly', async () => {
    const suspended = { ...context, merchant: { ...merchant, status: 'suspended' as const }, readOnly: true };
    const mock = boundary([result([]), result({ merchant_id: merchantId, user_id: userId, revoked_at: null }), result({ ...merchantRow, status: 'suspended' })]);
    expect(await getStaffList(mock.client, suspended)).toMatchObject({ staff: [], readOnly: true });
  });

  it('does not return an empty list after membership is revoked between reads', async () => {
    const mock = boundary([result([]), result(null)]);
    await expect(getStaffList(mock.client, context)).rejects.toMatchObject({ status: 403, code: 'PARTNER_UNASSIGNED' });
    expect(mock.calls.map((call) => call.table)).toEqual(['merchant_staff', 'merchant_memberships']);
  });

  it('does not return a prior merchant list after the same user is reassigned', async () => {
    const mock = boundary([result([profile]), result([]),
      result({ merchant_id: otherId, user_id: userId, revoked_at: null }), result({ ...merchantRow, id: otherId })]);
    await expect(getStaffList(mock.client, context)).rejects.toMatchObject({ status: 403, code: 'PARTNER_UNASSIGNED' });
  });

  it.each([result(null), result({ merchant_id: merchantId, user_id: userId, revoked_at: stamp })])('does not query staff after unassigned or revoked membership %#', async (membership) => {
    const mock = boundary([membership]);
    await expect(getPartnerContext(mock.client)).rejects.toMatchObject({ status: 403, code: 'PARTNER_UNASSIGNED' });
    expect(mock.calls.map((call) => call.table)).toEqual(['merchant_memberships']);
  });
});

describe('staff detail projection', () => {
  it('returns validated owned links and calendar with exact scoped queries', async () => {
    const mock = boundary(detailResults());
    const detail = await getStaffDetail(mock.client, context, staffId);
    expect(detail).toMatchObject({ merchantId, staff: { id: staffId, merchantId, menuIds: [menuId], updatedAt: stamp }, schedule: { merchantId, staffId, updatedAt: stamp, overrides: schedule.overrides }, readOnly: false });
    expect(mock.calls.map((call) => call.table)).toEqual(['merchant_staff', 'merchant_staff_menus', 'merchant_staff_menus', 'merchant_staff_schedules', 'merchant_services', 'merchant_memberships', 'merchants']);
    for (const call of mock.calls.slice(0, 5)) expect(call.steps).toContainEqual(['eq', ['merchant_id', merchantId]]);
    expect(mock.calls[0].steps).toContainEqual(['eq', ['id', staffId]]);
    expect(mock.calls[1].steps).toContainEqual(['eq', ['staff_id', staffId]]);
    expect(mock.calls[1].steps).toContainEqual(['order', ['service_id', { ascending: true }]]);
    expect(mock.calls[1].steps).toContainEqual(['limit', [1001]]);
    expect(mock.calls[2].steps).toContainEqual(['gt', ['service_id', menuId]]);
    expect(mock.calls[3].steps).toContainEqual(['eq', ['staff_id', staffId]]);
    expect(mock.calls[4].steps).toContainEqual(['in', ['id', [menuId]]]);
  });

  it('returns null schedule and no menu IDs only after successful empty detail queries', async () => {
    const mock = boundary([result(profile), result([]), result(null)]);
    expect(await getStaffDetail(mock.client, context, staffId)).toMatchObject({ staff: { menuIds: [] }, schedule: null });
    expect(mock.calls).toHaveLength(5);
  });

  it('continues short link pages until an empty ordered page confirms all assignments', async () => {
    const secondLink = { ...link, service_id: otherId };
    const mock = boundary([result(profile), result([link]), result([secondLink]), result([]), result(null),
      result([{ id: menuId, merchant_id: merchantId }, { id: otherId, merchant_id: merchantId }])]);
    expect((await getStaffDetail(mock.client, context, staffId)).staff.menuIds).toEqual([menuId, otherId]);
    expect(mock.calls[2].steps).toContainEqual(['gt', ['service_id', menuId]]);
    expect(mock.calls[3].steps).toContainEqual(['gt', ['service_id', otherId]]);
  });

  it('uses refreshed readOnly status when the merchant is suspended during a detail read', async () => {
    const mock = boundary([result(profile), result([]), result(null),
      result({ merchant_id: merchantId, user_id: userId, revoked_at: null }), result({ ...merchantRow, status: 'suspended' })]);
    expect((await getStaffDetail(mock.client, context, staffId)).readOnly).toBe(true);
  });

  it('does not return empty links and calendar after membership is revoked between detail queries', async () => {
    const mock = boundary([result(profile), result([]), result(null), result(null)]);
    await expect(getStaffDetail(mock.client, context, staffId)).rejects.toMatchObject({ status: 403, code: 'PARTNER_UNASSIGNED' });
    expect(mock.calls.map((call) => call.table)).toEqual(['merchant_staff', 'merchant_staff_menus', 'merchant_staff_schedules', 'merchant_memberships']);
  });

  it('rejects a changed session identity before returning detail', async () => {
    const mock = boundary([result(profile), result([]), result(null),
      result({ merchant_id: merchantId, user_id: otherId, revoked_at: null }), result(merchantRow)], { id: otherId });
    await expect(getStaffDetail(mock.client, context, staffId)).rejects.toMatchObject({ status: 403, code: 'PARTNER_UNASSIGNED' });
  });

  it('does not reveal whether an absent profile ID belongs to another merchant', async () => {
    const mock = boundary([result(null)]);
    await expect(getStaffDetail(mock.client, context, staffId)).rejects.toMatchObject({ status: 404, code: 'STAFF_NOT_FOUND' });
    expect(mock.calls).toHaveLength(3);
    expect(mock.calls[0].steps).toContainEqual(['eq', ['merchant_id', merchantId]]);
  });

  it('reports revoked access before not-found when a profile query becomes RLS-empty', async () => {
    await expect(getStaffDetail(boundary([result(null), result(null)]).client, context, staffId))
      .rejects.toMatchObject({ status: 403, code: 'PARTNER_UNASSIGNED' });
  });

  it.each([result({ ...profile, merchant_id: otherId }), result({ ...profile, id: otherId }), result({ ...profile, name: '' }), result(null, { message: 'private SQL details' })])('rejects malformed or foreign profile results %#', async (row) => {
    await expect(getStaffDetail(boundary([row]).client, context, staffId)).rejects.toMatchObject({ status: 503, code: 'PARTNER_UNAVAILABLE' });
  });

  it.each([
    [link, link], [{ ...link, merchant_id: otherId }], [{ ...link, staff_id: otherId }],
    [{ ...link, service_id: 'bad' }], null,
  ])('rejects malformed or duplicate link pages %#', async (links) => {
    await expect(getStaffDetail(boundary([result(profile), result(links)]).client, context, staffId)).rejects.toMatchObject({ status: 503, code: 'PARTNER_UNAVAILABLE' });
  });

  it('rejects more than 1,000 links before loading a calendar', async () => {
    const links = Array.from({ length: 1001 }, (_, index) => ({ ...link, service_id: `00000000-0000-0000-0000-${String(index).padStart(12, '0')}` }));
    const mock = boundary([result(profile), result(links)]);
    await expect(getStaffDetail(mock.client, context, staffId)).rejects.toMatchObject({ status: 503, code: 'PARTNER_LIMIT_EXCEEDED' });
    expect(mock.calls).toHaveLength(2);
  });

  it('probes past a full 1,000-link response because the API caps rows at 1,000', async () => {
    const links = Array.from({ length: 1000 }, (_, index) => ({ ...link, service_id: `00000000-0000-0000-0000-${String(index).padStart(12, '0')}` }));
    const overflow = { ...link, service_id: 'ffffffff-ffff-ffff-ffff-ffffffffffff' };
    const mock = boundary([result(profile), result(links), result([overflow])]);
    await expect(getStaffDetail(mock.client, context, staffId)).rejects.toMatchObject({ status: 503, code: 'PARTNER_LIMIT_EXCEEDED' });
    expect(mock.calls).toHaveLength(3);
    expect(mock.calls[2].steps).toContainEqual(['gt', ['service_id', links[999].service_id]]);
    expect(mock.calls[2].steps).toContainEqual(['limit', [1]]);
  });

  it.each([null, { ...schedule, merchant_id: otherId }, { ...schedule, staff_id: otherId }, { ...schedule, overrides: [{ date: '2026-02-30', hours: [], breaks: [] }] }, { ...schedule, updated_at: 'bad' }])('requires an owned, valid calendar if one is returned %#', async (calendar) => {
    if (calendar === null) return;
    await expect(getStaffDetail(boundary([result(profile), result([link]), result([]), result(calendar)]).client, context, staffId)).rejects.toMatchObject({ status: 503, code: 'PARTNER_UNAVAILABLE' });
  });

  it.each([[], [{ id: menuId, merchant_id: otherId }], [{ id: menuId, merchant_id: merchantId }, { id: menuId, merchant_id: merchantId }], null])('rejects missing, foreign, duplicate, or malformed services %#', async (services) => {
    await expect(getStaffDetail(boundary(detailResults([link], null, services)).client, context, staffId)).rejects.toMatchObject({ status: 503, code: 'PARTNER_UNAVAILABLE' });
  });

  it('checks service ownership in batches of at most 100 IDs', async () => {
    const links = Array.from({ length: 101 }, (_, index) => ({ ...link, service_id: `00000000-0000-0000-0000-${String(index).padStart(12, '0')}` }));
    const services = links.map(({ service_id }) => ({ id: service_id, merchant_id: merchantId }));
    const mock = boundary([result(profile), result(links), result([]), result(null), result(services.slice(0, 100)), result(services.slice(100))]);
    expect((await getStaffDetail(mock.client, context, staffId)).staff.menuIds).toHaveLength(101);
    expect(mock.calls.filter((call) => call.table === 'merchant_services').map((call) => call.steps.find(([name]) => name === 'in')?.[1][1])).toEqual([links.slice(0, 100).map((item) => item.service_id), [links[100].service_id]]);
  });

  it.each([1, 2, 3, 4, 5])('maps each query failure to a safe unavailable error, query %i', async (position) => {
    const rows = detailResults();
    rows[position - 1] = { data: null, error: { message: 'private database details' } };
    await expect(getStaffDetail(boundary(rows).client, context, staffId)).rejects.toMatchObject({ status: 503, code: 'PARTNER_UNAVAILABLE' });
  });
});
