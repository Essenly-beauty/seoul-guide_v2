import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { parseReservationCommand } from './reservation-commands';
import { saveReservationCommand } from './reservation-store';
import type { PartnerContext } from './server';

const merchantId = '11111111-1111-1111-1111-111111111111';
const stamp = '2026-10-18T01:02:03.123456+00:00';
const rules = { kind: 'reservationRules', mode: 'create', values: {
  mode: 'shop', capacity: 2, startDate: '2026-11-01', endDate: '2026-12-31', minimumLeadMinutes: 60, slotIntervalMinutes: 30,
} };
const overrides = { kind: 'dateOverrides', mode: 'create', values: { overrides: [{ date: '2026-11-05', hours: [{ startMinute: 540, endMinute: 1020 }], breaks: [] }] } };
const context: PartnerContext = { userId: '22222222-2222-2222-2222-222222222222', merchant: {
  id: merchantId, displayName: 'Shop', contactEmail: '', contactPhone: '', address: '', businessTypes: [], status: 'active', bookingEnabled: false, updatedAt: stamp,
}, readOnly: false };
function command(input: unknown) {
  const parsed = parseReservationCommand(input);
  if (!parsed.ok) throw new Error('invalid fixture');
  return parsed.command;
}
function boundary(result: unknown = { data: { merchant_id: merchantId }, error: null }) {
  const calls: { table: string; steps: [string, unknown[]][] }[] = [];
  const client = { from: vi.fn((table: string) => {
    const call = { table, steps: [] as [string, unknown[]][] }; calls.push(call);
    const builder: Record<string, unknown> = {};
    for (const method of ['select', 'insert', 'update', 'eq']) builder[method] = (...args: unknown[]) => { call.steps.push([method, args]); return builder; };
    builder.maybeSingle = () => Promise.resolve(result);
    return builder;
  }) };
  return { client: client as unknown as SupabaseClient, calls };
}

describe('narrow reservation settings writes', () => {
  it('inserts rules with only server-bound tenant and explicit policy fields', async () => {
    const mock = boundary();
    await saveReservationCommand(mock.client, context, command(rules));
    expect(mock.calls).toHaveLength(1);
    expect(mock.calls[0].table).toBe('merchant_reservation_rules');
    expect(mock.calls[0].steps).toContainEqual(['insert', [{ merchant_id: merchantId, mode: 'shop', capacity: 2, start_date: '2026-11-01', end_date: '2026-12-31', minimum_lead_minutes: 60, slot_interval_minutes: 30 }]]);
    expect(mock.calls[0].steps).toContainEqual(['select', ['merchant_id']]);
  });
  it('updates only rules policy columns with exact row version', async () => {
    const mock = boundary();
    await saveReservationCommand(mock.client, context, command({ ...rules, mode: 'update', expectedUpdatedAt: stamp }));
    expect(mock.calls[0].steps).toContainEqual(['eq', ['merchant_id', merchantId]]);
    expect(mock.calls[0].steps).toContainEqual(['eq', ['updated_at', stamp]]);
    const payload = mock.calls[0].steps.find(([method]) => method === 'update')![1][0];
    expect(payload).not.toHaveProperty('merchant_id');
    expect(payload).not.toHaveProperty('booking_enabled');
  });
  it('creates date overrides with empty weekly arrays but updates only overrides', async () => {
    const create = boundary();
    await saveReservationCommand(create.client, context, command(overrides));
    expect(create.calls[0].table).toBe('merchant_schedules');
    expect(create.calls[0].steps).toContainEqual(['insert', [{ merchant_id: merchantId, hours: [], breaks: [], blocks: [], overrides: overrides.values.overrides }]]);
    const update = boundary();
    await saveReservationCommand(update.client, context, command({ ...overrides, mode: 'update', expectedUpdatedAt: stamp }));
    expect(update.calls[0].steps).toContainEqual(['update', [{ overrides: overrides.values.overrides }]]);
    expect(update.calls[0].steps).toContainEqual(['eq', ['updated_at', stamp]]);
  });
  it('rejects a runtime-forged command kind before reaching any table', async () => {
    const mock = boundary();
    await expect(saveReservationCommand(mock.client, context, { ...rules, kind: 'deleteReservation' } as never)).rejects.toMatchObject({ status: 400, code: 'INVALID_COMMAND' });
    expect(mock.calls).toEqual([]);
  });
  it('rejects a runtime-forged mode before reaching any table', async () => {
    const mock = boundary();
    await expect(saveReservationCommand(mock.client, context, { ...rules, mode: 'delete' } as never)).rejects.toMatchObject({ status: 400, code: 'INVALID_COMMAND' });
    expect(mock.calls).toEqual([]);
  });
  it.each([{ ...context, readOnly: true }, { ...context, merchant: { ...context.merchant, status: 'suspended' as const } }, { ...context, merchant: { ...context.merchant, bookingEnabled: true } }])('rejects non-writable or live-booking context before any query %#', async (denied) => {
    const mock = boundary();
    await expect(saveReservationCommand(mock.client, denied, command(rules))).rejects.toMatchObject({ status: denied.merchant.bookingEnabled ? 409 : 403 });
    expect(mock.calls).toEqual([]);
  });
  it.each([
    [{ data: null, error: null }, 409],
    [{ data: null, error: { code: '23505' } }, 409],
    [{ data: null, error: { code: '23514' } }, 409],
    [{ data: null, error: { code: '23503' } }, 409],
    [{ data: null, error: { code: '42501' } }, 403],
    [{ data: null, error: { code: 'PGRST000' } }, 503],
    [{ data: { merchant_id: '33333333-3333-3333-3333-333333333333' }, error: null }, 503],
  ] as const)('classifies rejected or foreign write result %#', async (result, status) => {
    const mock = boundary(result);
    await expect(saveReservationCommand(mock.client, context, command(rules))).rejects.toMatchObject({ status });
  });
});
