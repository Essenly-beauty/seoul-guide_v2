import { describe, expect, it, vi } from 'vitest';
import { AuthApiError, AuthSessionMissingError, type SupabaseClient } from '@supabase/supabase-js';
import { getPartnerContext, getPartnerSnapshot } from './server';
import { savePartnerCommand } from './mutations';
import { parsePartnerCommand } from './contracts';

const merchantId = '11111111-1111-1111-1111-111111111111';
const id = '22222222-2222-2222-2222-222222222222';
const other = '33333333-3333-3333-3333-333333333333';
const stamp = '2026-10-18T01:02:03.123456+00:00';
const merchant = { id: merchantId, display_name: 'Shop', contact_email: '', contact_phone: '', address: '', business_types: ['hair'], status: 'active', booking_enabled: false, updated_at: stamp };
const category = { id, merchant_id: merchantId, name_ko: '', name_en: 'Hair', visibility: 'draft', sort_order: 0, updated_at: stamp };
const menu = { id, merchant_id: merchantId, category_id: id, name_ko: '', name_en: '', description_ko: '', description_en: '', price_krw: 1000, deposit_krw: 500, duration_minutes: null, cleanup_minutes: 0, visibility: 'draft', sort_order: 0, updated_at: stamp };
type Result = { data: unknown; error: unknown; rejection?: Error };
function boundary(results: Result[] = [], user: unknown = { id: other }, authError: unknown = null) {
  const calls: { table: string; steps: [string, unknown[]][] }[] = [];
  const client = {
    auth: { getUser: vi.fn(async () => ({ data: { user }, error: authError })) },
    from: vi.fn((table: string) => {
      const call = { table, steps: [] as [string, unknown[]][] };
      calls.push(call);
      const builder: Record<string, unknown> = {};
      for (const method of ['select', 'eq', 'is', 'order', 'range', 'insert', 'update', 'limit']) builder[method] = (...args: unknown[]) => { call.steps.push([method, args]); return builder; };
      const resolve = () => {
        const next = results.shift() ?? { data: null, error: null };
        return next.rejection ? Promise.reject(next.rejection) : Promise.resolve(next);
      };
      builder.maybeSingle = resolve;
      builder.then = (success: (value: Result) => unknown, failure?: (error: unknown) => unknown) => resolve().then(success, failure);
      return builder;
    }),
  };
  return { client: client as unknown as SupabaseClient, calls, auth: client.auth, pending: results };
}
const result = (data: unknown, error: unknown = null) => ({ data, error });
async function context(extra: Result[] = [], shop = merchant) {
  const mock = boundary([result({ merchant_id: merchantId, user_id: other, revoked_at: null }), result(shop), ...extra]);
  return { ...mock, context: await getPartnerContext(mock.client) };
}
const command = (input: unknown) => {
  const parsed = parsePartnerCommand(input);
  if (!parsed.ok) throw new Error('bad test fixture');
  return parsed.command;
};
const createCategory = command({ kind: 'category', mode: 'create', id, values: { nameKo: '', nameEn: 'Hair', visibility: 'draft', sortOrder: 0 } });
const updateMenu = command({ kind: 'menu', mode: 'update', id, expectedUpdatedAt: stamp, values: { categoryId: id, nameKo: '', nameEn: '', descriptionKo: '', descriptionEn: '', priceKrw: 1000, durationMinutes: null, cleanupMinutes: 0, visibility: 'draft', sortOrder: 0 } });

describe('verified partner context', () => {
  it('requires verified authentication before any data lookup', async () => {
    const mock = boundary([], null);
    await expect(getPartnerContext(mock.client)).rejects.toMatchObject({ status: 401, code: 'UNAUTHENTICATED' });
    expect(mock.calls).toEqual([]);
  });
  it.each([result(null), result({ merchant_id: merchantId, user_id: other, revoked_at: stamp })])('rejects absent/revoked membership %#', async (membership) => {
    await expect(getPartnerContext(boundary([membership]).client)).rejects.toMatchObject({ status: 403 });
  });
  it('uses only verified user and non-revoked membership to select a merchant', async () => {
    const mock = await context();
    expect(mock.context.merchant).toMatchObject({ id: merchantId, displayName: 'Shop', updatedAt: stamp });
    expect(mock.calls[0].steps).toContainEqual(['eq', ['user_id', other]]);
    expect(mock.calls[0].steps).toContainEqual(['is', ['revoked_at', null]]);
    expect(mock.calls[1].steps).toContainEqual(['eq', ['id', merchantId]]);
    expect(mock.calls.every((call) => !call.steps.some(([name, args]) => name === 'select' && args[0] === '*'))).toBe(true);
  });
  it.each([
    () => boundary([], { id: other }, { status: 500, message: 'provider details' }),
    () => boundary([result(null, { message: 'SQL details' })]),
    () => boundary([result({ merchant_id: 'bad', user_id: other, revoked_at: null })]),
    () => boundary([result({ merchant_id: merchantId, user_id: other, revoked_at: null }), result({ ...merchant, booking_enabled: 'false' })]),
    () => boundary([result({ merchant_id: merchantId, user_id: other, revoked_at: null }), result({ ...merchant, id: id })]),
  ])('fails closed for provider/query/malformed data %#', async (mock) => {
    await expect(getPartnerContext(mock().client)).rejects.toMatchObject({ status: 503, code: 'PARTNER_UNAVAILABLE' });
  });
  it('classifies missing-session auth errors as unauthenticated', async () => {
    await expect(getPartnerContext(boundary([], null, { name: 'AuthSessionMissingError' }).client)).rejects.toMatchObject({ status: 401 });
  });
  it.each([new AuthSessionMissingError(), new AuthApiError('expired token', 401, 'bad_jwt')])('handles real SDK authentication error subclasses %#', async (error) => {
    await expect(getPartnerContext(boundary([], null, error).client)).rejects.toMatchObject({ status: 401 });
  });
  it.each([undefined, null, [], {}, { error: null }, { data: {}, error: null }, { data: null, error: null }, { data: { user: [] }, error: null }, { data: { user: { id: 'invalid' } }, error: null }])('fails closed before lookup on malformed auth response %#', async (auth) => {
    const mock = boundary();
    mock.auth.getUser.mockResolvedValueOnce(auth as never);
    await expect(getPartnerContext(mock.client)).rejects.toMatchObject({ status: 503, code: 'PARTNER_UNAVAILABLE' });
    expect(mock.calls).toEqual([]);
  });
  it('fails closed before lookup when getUser rejects', async () => {
    const mock = boundary();
    mock.auth.getUser.mockRejectedValueOnce(new Error('private provider failure'));
    await expect(getPartnerContext(mock.client)).rejects.toMatchObject({ status: 503, code: 'PARTNER_UNAVAILABLE' });
    expect(mock.calls).toEqual([]);
  });
  it('fails closed when the membership query promise rejects', async () => {
    const mock = boundary([{ data: null, error: null, rejection: new Error('private query failure') }]);
    await expect(getPartnerContext(mock.client)).rejects.toMatchObject({ status: 503, code: 'PARTNER_UNAVAILABLE' });
    expect(mock.calls).toHaveLength(1);
  });
});

describe('partner snapshot', () => {
  it('returns only owned mapped configuration and a null uncreated schedule', async () => {
    const mock = await context([result([category]), result([menu]), result(null)]);
    const snapshot = await getPartnerSnapshot(mock.client, mock.context);
    expect(snapshot).toMatchObject({ merchant: { id: merchantId }, categories: [{ id, merchantId, updatedAt: stamp }], menus: [{ id, depositKrw: 500, updatedAt: stamp }], schedule: null, readOnly: false });
    expect(snapshot).not.toHaveProperty('membership');
    for (const call of mock.calls.slice(2)) expect(call.steps).toContainEqual(['eq', ['merchant_id', merchantId]]);
  });
  it('paginates complete 200-row ID-ordered pages and sorts returned rows by sort order and ID', async () => {
    const page = Array.from({ length: 200 }, (_, index) => ({ ...category, id: `00000000-0000-0000-0000-${String(index).padStart(12, '0')}`, sort_order: index === 0 ? 5 : 1 }));
    const mock = await context([result(page), result([{ ...category, sort_order: 0 }]), result([]), result(null)]);
    const snapshot = await getPartnerSnapshot(mock.client, mock.context);
    expect(snapshot.categories).toHaveLength(201);
    expect(snapshot.categories[0].id).toBe(id);
    expect(snapshot.categories.at(-1)?.id).toBe(page[0].id);
    expect(mock.calls[2].steps).toContainEqual(['range', [0, 199]]);
    expect(mock.calls[3].steps).toContainEqual(['range', [200, 399]]);
    expect(mock.calls[2].steps).toContainEqual(['order', ['id', { ascending: true }]]);
  });
  it('rejects snapshots beyond the explicit admin row bound', async () => {
    const pages = Array.from({ length: 50 }, (_, page) => result(Array.from({ length: 200 }, (_, index) => ({ ...category, id: `00000000-0000-0000-0000-${String(page * 200 + index).padStart(12, '0')}` }))));
    const mock = await context([...pages, result([{ ...category, id: other }])]);
    await expect(getPartnerSnapshot(mock.client, mock.context)).rejects.toMatchObject({ status: 503, code: 'PARTNER_LIMIT_EXCEEDED' });
  });
  it.each([result(null, { message: 'secret SQL' }), result(null), result([null]), result([{ ...category, merchant_id: other }]), result([{ ...category, sort_order: '100' }]), result([{ ...category, updated_at: '' }])])('fails closed for invalid category results %#', async (data) => {
    const mock = await context([data]);
    await expect(getPartnerSnapshot(mock.client, mock.context)).rejects.toMatchObject({ status: 503 });
  });
  it('returns read-only suspended shops but refuses all writes', async () => {
    const mock = await context([result([]), result([]), result(null)], { ...merchant, status: 'suspended' });
    expect((await getPartnerSnapshot(mock.client, mock.context)).readOnly).toBe(true);
    await expect(savePartnerCommand(mock.client, mock.context, createCategory)).rejects.toMatchObject({ status: 403, code: 'PARTNER_READ_ONLY' });
    expect(mock.calls).toHaveLength(5);
  });
  it.each([
    [result([]), result([menu])],
    [result([category]), result([{ ...menu, deposit_krw: Number.MAX_SAFE_INTEGER + 1 }])],
    [result([category]), result([{ ...menu, merchant_id: other }])],
    [result([category]), result([{ ...menu, price_krw: 1 }])],
    [result([category]), result(null, { message: 'provider query failed' })],
    [result([]), result([]), result({ merchant_id: other, hours: [], breaks: [], blocks: [], updated_at: stamp })],
    [result([]), result([]), result({ merchant_id: merchantId, hours: [null], breaks: [], blocks: [], updated_at: stamp })],
    [result([]), result([]), result(null, { message: 'provider schedule failed' })],
  ])('rejects malformed/foreign/incomplete menu or schedule results %#', async (...rows) => {
    const mock = await context(rows);
    await expect(getPartnerSnapshot(mock.client, mock.context)).rejects.toMatchObject({ status: 503 });
  });
  it('returns validated schedule timestamps and preserves meaningful empty arrays', async () => {
    const mock = await context([result([]), result([]), result({ merchant_id: merchantId, hours: [], breaks: [], blocks: [], updated_at: stamp })]);
    expect((await getPartnerSnapshot(mock.client, mock.context)).schedule).toEqual({ merchantId, hours: [], breaks: [], blocks: [], updatedAt: stamp });
  });
  it('reads repeated allowed business types from valid existing database rows', async () => {
    const mock = await context([result([]), result([]), result(null)], { ...merchant, business_types: ['hair', 'hair', 'nail', 'hair'] });
    expect((await getPartnerSnapshot(mock.client, mock.context)).merchant.businessTypes).toEqual(['hair', 'hair', 'nail', 'hair']);
  });
  it('fails closed when snapshot query promises reject', async () => {
    const mock = await context([{ data: null, error: null, rejection: new Error('private snapshot failure') }]);
    await expect(getPartnerSnapshot(mock.client, mock.context)).rejects.toMatchObject({ status: 503, code: 'PARTNER_UNAVAILABLE' });
  });
});

describe('partner configuration writes', () => {
  it('inserts only permitted category columns and server-owned merchant ID', async () => {
    const mock = await context([result({ id })]);
    await savePartnerCommand(mock.client, mock.context, createCategory);
    expect(mock.calls[2].steps).toContainEqual(['insert', [{ id, merchant_id: merchantId, name_ko: '', name_en: 'Hair', visibility: 'draft', sort_order: 0 }]]);
  });
  it('accepts canonical hexadecimal UUIDs when Postgres returns lowercase', async () => {
    const mock = await context([result({ id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' })]);
    await expect(savePartnerCommand(mock.client, mock.context, command({ ...createCategory, id: 'AAAAAAAA-AAAA-AAAA-AAAA-AAAAAAAAAAAA' }))).resolves.toBeUndefined();
  });
  it('checks menu category ownership and keeps the approved deposit out of update payload', async () => {
    const mock = await context([result(category), result(menu), result({ id })]);
    await savePartnerCommand(mock.client, mock.context, updateMenu);
    const mutation = mock.calls.at(-1)!;
    expect(mock.calls[2].steps).toContainEqual(['eq', ['merchant_id', merchantId]]);
    expect(mutation.steps).toContainEqual(['eq', ['id', id]]);
    expect(mutation.steps).toContainEqual(['eq', ['merchant_id', merchantId]]);
    expect(mutation.steps).toContainEqual(['eq', ['updated_at', stamp]]);
    const payload = mutation.steps.find(([name]) => name === 'update')![1][0];
    expect(payload).not.toHaveProperty('deposit_krw');
    expect(payload).not.toHaveProperty('merchant_id');
  });
  it('omits deposit entirely when creating a draft menu', async () => {
    const mock = await context([result(category), result({ id })]);
    await savePartnerCommand(mock.client, mock.context, command({ kind: 'menu', mode: 'create', id, values: updateMenu.values }));
    expect(mock.calls.at(-1)!.steps.find(([name]) => name === 'insert')![1][0]).not.toHaveProperty('deposit_krw');
  });
  it.each([result(null), result({ ...category, merchant_id: other })])('blocks foreign menu category %#', async (row) => {
    const mock = await context([row]);
    await expect(savePartnerCommand(mock.client, mock.context, updateMenu)).rejects.toMatchObject({ status: 403 });
    expect(mock.calls).toHaveLength(3);
  });
  it('blocks a price lower than an existing approved deposit', async () => {
    const mock = await context([result(category), result({ ...menu, deposit_krw: 2000, price_krw: 3000 })]);
    await expect(savePartnerCommand(mock.client, mock.context, updateMenu)).rejects.toMatchObject({ status: 400, code: 'INVALID_COMMAND' });
    expect(mock.calls).toHaveLength(4);
  });
  it('returns conflict for a stale/foreign update without an accepted write', async () => {
    const mock = await context([result(null)]);
    await expect(savePartnerCommand(mock.client, mock.context, command({ ...createCategory, mode: 'update', expectedUpdatedAt: stamp }))).rejects.toMatchObject({ status: 409, code: 'PARTNER_CONFLICT' });
  });
  it('returns conflict for duplicate ID without an upsert', async () => {
    const mock = await context([result(null, { code: '23505', message: 'secret SQL' })]);
    await expect(savePartnerCommand(mock.client, mock.context, createCategory)).rejects.toMatchObject({ status: 409 });
  });
  it('separates schedule insertion and stamped update', async () => {
    for (const mode of ['create', 'update'] as const) {
      const mock = await context([result({ merchant_id: merchantId })]);
      await savePartnerCommand(mock.client, mock.context, command({ kind: 'schedule', mode, ...(mode === 'update' ? { expectedUpdatedAt: stamp } : {}), values: { hours: [], breaks: [], blocks: [] } }));
      expect(mock.calls[2].steps[0]).toEqual([mode === 'create' ? 'insert' : 'update', [mode === 'create' ? { merchant_id: merchantId, hours: [], breaks: [], blocks: [] } : { hours: [], breaks: [], blocks: [] }]]);
      if (mode === 'update') expect(mock.calls[2].steps).toContainEqual(['eq', ['updated_at', stamp]]);
    }
  });
  it('updates only operator-independent merchant settings', async () => {
    const mock = await context([result({ id: merchantId })]);
    await savePartnerCommand(mock.client, mock.context, command({ kind: 'settings', expectedUpdatedAt: stamp, values: { displayName: 'Updated', contactEmail: '', contactPhone: '', address: '', businessTypes: ['nail'] } }));
    expect(mock.calls[2].steps).toContainEqual(['update', [{ display_name: 'Updated', contact_email: '', contact_phone: '', address: '', business_types: ['nail'] }]]);
    expect(mock.calls[2].steps).toContainEqual(['eq', ['id', merchantId]]);
  });
  it.each([
    { row: result(null, { code: '23514', message: 'operator deposit race' }), status: 409 },
    { row: result(null, { code: '23503', message: 'category changed' }), status: 409 },
    { row: result(null, { code: '42501', message: 'RLS denied' }), status: 403 },
    { row: result(null, { code: 'XX000', message: 'secret DB internals' }), status: 503 },
    { row: result({ id: other }), status: 503 },
  ])('fails closed for rejected or malformed write results $status', async ({ row, status }) => {
    const mock = await context([row]);
    await expect(savePartnerCommand(mock.client, mock.context, createCategory)).rejects.toMatchObject({ status });
  });
  it('does not acknowledge a rejected mutation query promise', async () => {
    const mock = await context([{ data: null, error: null, rejection: new Error('private mutation failure') }]);
    await expect(savePartnerCommand(mock.client, mock.context, createCategory)).rejects.toMatchObject({ status: 503, code: 'PARTNER_UNAVAILABLE' });
  });
});
