import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { PartnerContext } from './server';
import { saveStaffCommand } from './staff-server';
import type { StaffCommand } from './staff-contracts';

const merchantId = '11111111-1111-1111-1111-111111111111';
const staffId = '22222222-2222-2222-2222-222222222222';
const menuId = '33333333-3333-3333-3333-333333333333';
const userId = '44444444-4444-4444-4444-444444444444';
const stamp = '2026-10-18T01:02:03.123456+00:00';
const merchant = { id: merchantId, displayName: 'Shop', contactEmail: '', contactPhone: '', address: '', businessTypes: ['hair'] as ['hair'], status: 'active' as const, bookingEnabled: false, updatedAt: stamp };
const merchantRow = { id: merchantId, display_name: 'Shop', contact_email: '', contact_phone: '', address: '', business_types: ['hair'], status: 'active', booking_enabled: false, updated_at: stamp };
const context: PartnerContext = { userId, merchant, readOnly: false };
const profile: StaffCommand = { kind: 'staff', mode: 'create', id: staffId, values: { name: '민지', title: '디자이너', introduction: '', visibility: 'visible', sortOrder: 2 } };
const calendar: StaffCommand = { kind: 'staffSchedule', mode: 'create', staffId, values: { hours: [{ weekday: 1, startMinute: 540, endMinute: 1080 }], breaks: [], blocks: [], overrides: [{ date: '2026-11-05', hours: [], breaks: [] }] } };
type Result = { data: unknown; error: unknown };
type Query = { table: string; steps: [string, unknown[]][] };
const result = (data: unknown, error: unknown = null): Result => ({ data, error });

function boundary(write: Result, options: { membership?: unknown; merchant?: unknown; authUser?: unknown } = {}) {
  const calls: Query[] = [];
  const client = {
    auth: { getUser: vi.fn(async () => ({ data: { user: options.authUser === undefined ? { id: userId } : options.authUser }, error: null })) },
    from: vi.fn((table: string) => {
      const call: Query = { table, steps: [] };
      calls.push(call);
      const builder: Record<string, unknown> = {};
      for (const method of ['select', 'eq', 'is', 'insert', 'update', 'delete']) builder[method] = (...args: unknown[]) => { call.steps.push([method, args]); return builder; };
      builder.maybeSingle = async () => table === 'merchant_memberships'
        ? result(options.membership === undefined ? { merchant_id: merchantId, user_id: userId, revoked_at: null } : options.membership)
        : table === 'merchants' ? result(options.merchant === undefined ? merchantRow : options.merchant) : write;
      return builder;
    }),
  };
  return { client: client as unknown as SupabaseClient, calls };
}

describe('narrow staff writes', () => {
  it('inserts only allowed profile columns for the freshly verified merchant and acknowledges the exact row', async () => {
    const mock = boundary(result({ merchant_id: merchantId, id: staffId }));
    await saveStaffCommand(mock.client, context, profile);
    expect(mock.calls.map(({ table }) => table)).toEqual(['merchant_memberships', 'merchants', 'merchant_staff']);
    expect(mock.calls[2].steps).toEqual([
      ['insert', [{ merchant_id: merchantId, id: staffId, name: '민지', title: '디자이너', introduction: '', visibility: 'visible', sort_order: 2 }]],
      ['select', ['merchant_id,id']],
    ]);
  });

  it('archives through a versioned update with merchant and ID filters', async () => {
    const mock = boundary(result({ merchant_id: merchantId, id: staffId }));
    await saveStaffCommand(mock.client, context, { ...profile, mode: 'update', expectedUpdatedAt: stamp, values: { ...profile.values, visibility: 'archived' } });
    expect(mock.calls[2].steps).toEqual([
      ['update', [{ name: '민지', title: '디자이너', introduction: '', visibility: 'archived', sort_order: 2 }]],
      ['eq', ['merchant_id', merchantId]], ['eq', ['id', staffId]], ['eq', ['updated_at', stamp]],
      ['select', ['merchant_id,id']],
    ]);
    expect(mock.calls[2].steps.some(([method]) => method === 'delete')).toBe(false);
  });

  it('adds one exact composite menu link and removes it using all three identifiers', async () => {
    const add = boundary(result({ merchant_id: merchantId, staff_id: staffId, service_id: menuId }));
    await saveStaffCommand(add.client, context, { kind: 'staffMenu', mode: 'add', staffId, menuId });
    expect(add.calls[2].table).toBe('merchant_staff_menus');
    expect(add.calls[2].steps).toEqual([
      ['insert', [{ merchant_id: merchantId, staff_id: staffId, service_id: menuId }]],
      ['select', ['merchant_id,staff_id,service_id']],
    ]);
    const remove = boundary(result({ merchant_id: merchantId, staff_id: staffId, service_id: menuId }));
    await saveStaffCommand(remove.client, context, { kind: 'staffMenu', mode: 'remove', staffId, menuId });
    expect(remove.calls[2].steps).toEqual([
      ['delete', []], ['eq', ['merchant_id', merchantId]], ['eq', ['staff_id', staffId]], ['eq', ['service_id', menuId]],
      ['select', ['merchant_id,staff_id,service_id']],
    ]);
  });

  it('creates and version-updates only calendar fields under the composite key', async () => {
    const create = boundary(result({ merchant_id: merchantId, staff_id: staffId }));
    await saveStaffCommand(create.client, context, calendar);
    expect(create.calls[2].steps).toEqual([
      ['insert', [{ merchant_id: merchantId, staff_id: staffId, ...calendar.values }]],
      ['select', ['merchant_id,staff_id']],
    ]);
    const update = boundary(result({ merchant_id: merchantId, staff_id: staffId }));
    await saveStaffCommand(update.client, context, { ...calendar, mode: 'update', expectedUpdatedAt: stamp });
    expect(update.calls[2].steps).toEqual([
      ['update', [calendar.values]], ['eq', ['merchant_id', merchantId]], ['eq', ['staff_id', staffId]], ['eq', ['updated_at', stamp]],
      ['select', ['merchant_id,staff_id']],
    ]);
  });

  it.each([null, {}, { merchant_id: merchantId }, { merchant_id: merchantId, id: menuId }, { merchant_id: menuId, id: staffId }])('never acknowledges malformed, missing or foreign profile result %#', async (data) => {
    const mock = boundary(result(data));
    await expect(saveStaffCommand(mock.client, context, profile)).rejects.toMatchObject(data === null ? { status: 409, code: 'PARTNER_CONFLICT' } : { status: 503, code: 'PARTNER_UNAVAILABLE' });
  });

  it.each(['23505', '23503', '23514', '42501', 'PGRST999'])('maps database error %s safely', async (code) => {
    const mock = boundary(result(null, { code, message: 'private database detail' }));
    await expect(saveStaffCommand(mock.client, context, profile)).rejects.toMatchObject(
      code === '42501' ? { status: 403, code: 'PARTNER_FORBIDDEN' } :
        ['23505', '23503', '23514'].includes(code) ? { status: 409, code: 'PARTNER_CONFLICT' } :
          { status: 503, code: 'PARTNER_UNAVAILABLE' },
    );
  });

  it('rejects read-only, newly suspended, revoked and reassigned sessions before touching staff rows', async () => {
    const cases = [
      { current: { ...context, readOnly: true }, options: {}, expected: 403 },
      { current: context, options: { merchant: { ...merchantRow, status: 'suspended' } }, expected: 403 },
      { current: context, options: { membership: null }, expected: 403 },
      { current: context, options: { membership: { merchant_id: menuId, user_id: userId, revoked_at: null }, merchant: { ...merchantRow, id: menuId } }, expected: 403 },
    ];
    for (const { current, options, expected } of cases) {
      const mock = boundary(result({ merchant_id: merchantId, id: staffId }), options);
      await expect(saveStaffCommand(mock.client, current, profile)).rejects.toMatchObject({ status: expected });
      expect(mock.calls.some(({ table }) => table.startsWith('merchant_staff'))).toBe(false);
    }
  });

  it('blocks booking-enabled merchants before touching staff rows', async () => {
    const mock = boundary(result({ merchant_id: merchantId, id: staffId }), { merchant: { ...merchantRow, booking_enabled: true } });
    await expect(saveStaffCommand(mock.client, context, profile)).rejects.toMatchObject({ status: 409, code: 'PARTNER_CONFLICT' });
    expect(mock.calls.some(({ table }) => table.startsWith('merchant_staff'))).toBe(false);
  });

  it('does not clear an earlier booking gate if a later context read differs', async () => {
    const mock = boundary(result({ merchant_id: merchantId, id: staffId }));
    await expect(saveStaffCommand(mock.client, { ...context, merchant: { ...merchant, bookingEnabled: true } }, profile))
      .rejects.toMatchObject({ status: 409, code: 'PARTNER_CONFLICT' });
    expect(mock.calls.some(({ table }) => table.startsWith('merchant_staff'))).toBe(false);
  });
});
