import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET, POST } from '@/app/api/partner/route';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({ server: vi.fn(), privileged: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({ supabaseServer: mocks.server }));
vi.mock('@supabase/supabase-js', () => ({ createClient: mocks.privileged }));
const merchantId = '11111111-1111-1111-1111-111111111111';
const userId = '22222222-2222-2222-2222-222222222222';
const stamp = '2026-10-18T00:00:00.123456+00:00';
const merchant = { id: merchantId, display_name: 'Shop', contact_email: '', contact_phone: '', address: '', business_types: [], status: 'active', booking_enabled: false, updated_at: stamp };
const validCommand = { kind: 'category', mode: 'create', id: userId, values: { nameKo: '', nameEn: 'Hair', visibility: 'draft', sortOrder: 0 } };
const reservationCommand = { kind: 'reservationRules', mode: 'create', values: { mode: 'shop', capacity: 2, startDate: '2026-11-01', endDate: '2026-12-31', minimumLeadMinutes: 60, slotIntervalMinutes: 30 } };
const specialCommand = { kind: 'dateOverrides', mode: 'create', values: { overrides: [{ date: '2026-11-05', hours: [], breaks: [] }] } };
type Result = { data: unknown; error: unknown; rejection?: Error };
const result = (data: unknown, error: unknown = null): Result => ({ data, error });
function session(options: { user?: unknown; authError?: unknown; results?: Result[]; shop?: typeof merchant } = {}) {
  const results = options.results ?? [result({ merchant_id: merchantId, user_id: userId, revoked_at: null }), result(options.shop ?? merchant), result([]), result([]), result(null), result(null)];
  const calls: { table: string; method: string; args: unknown[] }[] = [];
  const client = {
    auth: { getUser: vi.fn(async () => ({ data: { user: options.user === undefined ? { id: userId, user_metadata: { merchant_id: 'forged' } } : options.user }, error: options.authError ?? null })) },
    from: (table: string) => {
      const builder: Record<string, unknown> = {};
      for (const method of ['select', 'eq', 'is', 'order', 'range', 'insert', 'update']) builder[method] = (...args: unknown[]) => { calls.push({ table, method, args }); return builder; };
      const resolve = () => {
        const next = results.shift() ?? result(null);
        return next.rejection ? Promise.reject(next.rejection) : Promise.resolve(next);
      };
      builder.maybeSingle = resolve;
      builder.then = (success: (value: Result) => unknown, failure?: (error: unknown) => unknown) => resolve().then(success, failure);
      return builder;
    },
  };
  mocks.server.mockReturnValue(client);
  return { client, calls };
}
function request(body: string | ReadableStream<Uint8Array> = JSON.stringify(validCommand), headers: Record<string, string> = {}) {
  return new Request('https://myseouldrop.app/api/partner?merchantId=forged', {
    method: 'POST', headers: { origin: 'https://myseouldrop.app', 'content-type': 'application/json', ...headers }, body,
    ...(typeof body === 'string' ? {} : { duplex: 'half' }),
  } as RequestInit);
}
function privateHeaders(response: Response) {
  expect(response.headers.get('cache-control')).toBe('private, no-store');
  expect(response.headers.get('vary')).toBe('Cookie');
}
beforeEach(() => { vi.resetAllMocks(); session(); });

describe('partner HTTP authentication and snapshots', () => {
  it('returns persisted booking rules and special dates only from the owned merchant', async () => {
    const override = { date: '2026-11-05', hours: [], breaks: [] };
    const mock = session({ results: [result({ merchant_id: merchantId, user_id: userId, revoked_at: null }), result(merchant), result([]), result([]), result({ merchant_id: merchantId, hours: [], breaks: [], blocks: [], overrides: [override], updated_at: stamp }), result({ merchant_id: merchantId, mode: 'shop', capacity: 2, start_date: '2026-11-01', end_date: '2026-12-31', minimum_lead_minutes: 60, slot_interval_minutes: 30, updated_at: stamp })] });
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, snapshot: { dateOverrides: [override], reservationRules: { merchantId, capacity: 2, updatedAt: stamp } } });
    expect(mock.calls).toContainEqual({ table: 'merchant_reservation_rules', method: 'eq', args: ['merchant_id', merchantId] });
    privateHeaders(response);
  });
  it('fails closed if the owned rules query fails', async () => {
    session({ results: [result({ merchant_id: merchantId, user_id: userId, revoked_at: null }), result(merchant), result([]), result([]), result(null), result(null, { message: 'private SQL' })] });
    const response = await GET();
    expect(response.status).toBe(503);
    expect(JSON.stringify(await response.json())).not.toContain('private SQL');
    privateHeaders(response);
  });
  it('uses only the existing cookie-session client and returns a private owned snapshot', async () => {
    const mock = session();
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, snapshot: { merchant: { id: merchantId }, schedule: null, reservationRules: null, dateOverrides: [], categories: [], menus: [], readOnly: false } });
    privateHeaders(response);
    expect(mocks.privileged).not.toHaveBeenCalled();
    expect(mock.calls).toContainEqual({ table: 'merchant_memberships', method: 'eq', args: ['user_id', userId] });
  });
  it.each([
    { setup: () => session({ user: null }), status: 401, code: 'UNAUTHENTICATED' },
    { setup: () => session({ results: [result(null)] }), status: 403, code: 'PARTNER_UNASSIGNED' },
    { setup: () => session({ results: [result({ merchant_id: merchantId, user_id: userId, revoked_at: stamp })] }), status: 403, code: 'PARTNER_UNASSIGNED' },
    { setup: () => session({ authError: { status: 500, message: 'sensitive auth detail' } }), status: 503, code: 'PARTNER_UNAVAILABLE' },
    { setup: () => session({ results: [result(null, { message: 'sensitive SQL detail' })] }), status: 503, code: 'PARTNER_UNAVAILABLE' },
  ])('returns safe $status $code without a mutation', async ({ setup, status, code }) => {
    const mock = setup();
    const response = await POST(request());
    expect(response.status).toBe(status);
    const body = await response.json();
    expect(body).toMatchObject({ ok: false, code, error: expect.any(String) });
    expect(JSON.stringify(body)).not.toContain('sensitive');
    expect(mock.calls.some((call) => ['insert', 'update'].includes(call.method))).toBe(false);
    privateHeaders(response);
  });
  it('allows read-only GET but denies POST for closed merchant', async () => {
    session({ shop: { ...merchant, status: 'closed' } });
    const read = await GET();
    expect(await read.json()).toMatchObject({ ok: true, snapshot: { readOnly: true } });
    const mock = session({ shop: { ...merchant, status: 'closed' } });
    const write = await POST(request());
    expect(write.status).toBe(403);
    expect(mock.calls.some((call) => call.method === 'insert')).toBe(false);
  });
  it('returns generic private error when session client construction throws', async () => {
    mocks.server.mockImplementation(() => { throw new Error('secret environment'); });
    const response = await GET();
    expect(response.status).toBe(503);
    expect(JSON.stringify(await response.json())).not.toContain('secret');
    privateHeaders(response);
  });
  it.each([undefined, null, [], {}, { error: null }, { data: {}, error: null }, { data: null, error: null }, { data: { user: [] }, error: null }, { data: { user: { id: 'invalid' } }, error: null }])('returns safe private 503 without writes for malformed auth envelope %#', async (auth) => {
    for (const method of ['GET', 'POST']) {
      const mock = session();
      mock.client.auth.getUser.mockResolvedValueOnce(auth as never);
      const response = method === 'GET' ? await GET() : await POST(request());
      expect(response.status).toBe(503);
      expect(await response.json()).toMatchObject({ ok: false, code: 'PARTNER_UNAVAILABLE', error: expect.any(String) });
      expect(mock.calls).toEqual([]);
      privateHeaders(response);
    }
  });
  it('returns safe private 503 without writes when getUser rejects', async () => {
    for (const method of ['GET', 'POST']) {
      const mock = session();
      mock.client.auth.getUser.mockRejectedValueOnce(new Error('secret provider exception'));
      const response = method === 'GET' ? await GET() : await POST(request());
      expect(response.status).toBe(503);
      expect(JSON.stringify(await response.json())).not.toContain('secret');
      expect(mock.calls).toEqual([]);
      privateHeaders(response);
    }
  });
  it('returns safe private 503 without writes when membership query rejects', async () => {
    for (const method of ['GET', 'POST']) {
      const mock = session({ results: [{ data: null, error: null, rejection: new Error('secret query exception') }] });
      const response = method === 'GET' ? await GET() : await POST(request());
      expect(response.status).toBe(503);
      expect(JSON.stringify(await response.json())).not.toContain('secret');
      expect(mock.calls.some((call) => ['insert', 'update'].includes(call.method))).toBe(false);
      privateHeaders(response);
    }
  });
});

describe('partner HTTP command boundary', () => {
  it.each([reservationCommand, specialCommand])('routes verified reservation command %# to only its narrow table', async (command) => {
    const mock = session({ results: [result({ merchant_id: merchantId, user_id: userId, revoked_at: null }), result(merchant), result({ merchant_id: merchantId })] });
    const response = await POST(request(JSON.stringify(command)));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    const table = command.kind === 'reservationRules' ? 'merchant_reservation_rules' : 'merchant_schedules';
    expect(mock.calls.find((call) => call.method === 'insert')).toMatchObject({ table, args: [expect.objectContaining({ merchant_id: merchantId })] });
    expect(mocks.privileged).not.toHaveBeenCalled();
    privateHeaders(response);
  });
  it('rejects a forged reservation tenant before mutation', async () => {
    const mock = session();
    const response = await POST(request(JSON.stringify({ ...reservationCommand, merchantId: userId })));
    expect(response.status).toBe(400);
    expect(mock.calls.some((call) => ['insert', 'update'].includes(call.method))).toBe(false);
  });
  it('returns 400 before a write when compact overrides would exceed the JSONB database limit', async () => {
    const periods = Array.from({ length: 128 }, (_, startMinute) => ({ startMinute, endMinute: startMinute + 1 }));
    const overrides = Array.from({ length: 53 }, (_, index) => ({ date: new Date(Date.UTC(2026, 0, index + 1)).toISOString().slice(0, 10), hours: periods, breaks: [] }));
    const mock = session();
    const response = await POST(request(JSON.stringify({ kind: 'dateOverrides', mode: 'create', values: { overrides } })));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ ok: false, code: 'INVALID_COMMAND' });
    expect(mock.calls.some((call) => ['insert', 'update'].includes(call.method))).toBe(false);
  });
  it('refuses reservation settings writes after booking activation without a write', async () => {
    const mock = session({ shop: { ...merchant, booking_enabled: true } });
    const response = await POST(request(JSON.stringify(reservationCommand)));
    expect(response.status).toBe(409);
    expect(mock.calls.some((call) => ['insert', 'update'].includes(call.method))).toBe(false);
  });
  it('rejects a valid legacy profile settings command privately without mutation', async () => {
    const mock = session({ results: [result({ merchant_id: merchantId, user_id: userId, revoked_at: null }), result(merchant), result({ id: merchantId })] });
    const response = await POST(request(JSON.stringify({ kind: 'settings', expectedUpdatedAt: stamp, values: { displayName: 'Changed', contactEmail: '', contactPhone: '', address: '', businessTypes: ['hair'] } })));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ ok: false, code: 'INVALID_COMMAND' });
    expect(mock.calls.some((call) => ['insert', 'update'].includes(call.method))).toBe(false);
    privateHeaders(response);
  });
  it('acknowledges only an accepted write and ignores request tenant selectors', async () => {
    const mock = session({ results: [result({ merchant_id: merchantId, user_id: userId, revoked_at: null }), result(merchant), result({ id: userId })] });
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(mock.calls.find((call) => call.method === 'insert')?.args[0]).toMatchObject({ merchant_id: merchantId });
    privateHeaders(response);
  });
  it.each(['https://evil.example', 'null', '', 'https://myseouldrop.app.evil.example', 'http://myseouldrop.app', 'https://myseouldrop.app/'])('denies non-exact Origin %s before data access', async (origin) => {
    const response = await POST(request(undefined, { origin }));
    expect(response.status).toBe(403);
    expect(mocks.server).not.toHaveBeenCalled();
    privateHeaders(response);
  });
  it('denies a missing Origin', async () => {
    const req = request(); req.headers.delete('origin');
    expect((await POST(req)).status).toBe(403);
  });
  it('denies an otherwise matching production URL Origin with contradictory Host', async () => {
    const response = await POST(request(undefined, { host: 'evil.example', 'x-forwarded-host': 'myseouldrop.app' }));
    expect(response.status).toBe(403);
    expect(mocks.server).not.toHaveBeenCalled();
    privateHeaders(response);
  });
  it.each(['127.0.0.1', '[::1]'])('accepts exact browser Origin/Host after actual NextRequest normalizes loopback %s', async (hostname) => {
    session({ results: [result({ merchant_id: merchantId, user_id: userId, revoked_at: null }), result(merchant), result({ id: userId })] });
    const req = new NextRequest(`http://${hostname}:3018/api/partner`, { method: 'POST', headers: { origin: `http://${hostname}:3018`, host: `${hostname}:3018`, 'content-type': 'application/json' }, body: JSON.stringify(validCommand) });
    expect(new URL(req.url).host).toBe('localhost:3018');
    expect((await POST(req)).status).toBe(200);
  });
  it.each([
    { origin: 'http://localhost:3018', host: '127.0.0.1:3018' },
    { origin: 'http://127.0.0.1:3018', host: 'localhost:3018' },
    { origin: 'http://127.0.0.1:3019', host: '127.0.0.1:3018' },
    { origin: 'https://127.0.0.1:3018', host: '127.0.0.1:3018' },
    { origin: 'https://evil.example', host: 'evil.example' },
    { origin: 'https://evil.example', host: '127.0.0.1:3018', 'x-forwarded-host': 'evil.example', 'x-forwarded-proto': 'https' },
    { origin: 'http://127.0.0.1:3018', host: 'evil.example', 'x-forwarded-host': '127.0.0.1:3018' },
  ])('denies loopback alias/scheme/port mismatches and forged forwarded headers %#', async (headers) => {
    const nextHeaders = new Headers({ 'content-type': 'application/json' });
    for (const [name, value] of Object.entries(headers)) if (value !== undefined) nextHeaders.set(name, value);
    const req = new NextRequest('http://127.0.0.1:3018/api/partner', { method: 'POST', headers: nextHeaders, body: JSON.stringify(validCommand) });
    const response = await POST(req);
    expect(response.status).toBe(403);
    expect(mocks.server).not.toHaveBeenCalled();
    privateHeaders(response);
  });
  it('requires actual Host agreement for the loopback normalization exception', async () => {
    const req = new NextRequest('http://127.0.0.1:3018/api/partner', { method: 'POST', headers: { origin: 'http://127.0.0.1:3018', 'x-forwarded-host': '127.0.0.1:3018', 'content-type': 'application/json' }, body: JSON.stringify(validCommand) });
    expect((await POST(req)).status).toBe(403);
    expect(mocks.server).not.toHaveBeenCalled();
  });
  it.each(['text/plain', 'application/jsonp', 'application/x-www-form-urlencoded'])('rejects content type %s', async (type) => {
    expect((await POST(request('{}', { 'content-type': type }))).status).toBe(415);
  });
  it('accepts application/json with charset', async () => {
    session({ results: [result({ merchant_id: merchantId, user_id: userId, revoked_at: null }), result(merchant), result({ id: userId })] });
    expect((await POST(request(undefined, { 'content-type': 'application/json; charset=utf-8' }))).status).toBe(200);
  });
  it.each(['{', '', 'null', '[]', '4', JSON.stringify({ ...validCommand, merchantId }), JSON.stringify({ ...validCommand, values: { ...validCommand.values, depositKrw: null } })])('rejects invalid JSON/command %# without mutation', async (body) => {
    const mock = session();
    const response = await POST(request(body));
    expect(response.status).toBe(400);
    expect(mock.calls.some((call) => ['insert', 'update'].includes(call.method))).toBe(false);
    privateHeaders(response);
  });
  it('bounds actual UTF-8 streamed bytes even with a lying Content-Length', async () => {
    const stream = new ReadableStream<Uint8Array>({ start(controller) { for (let i = 0; i < 4; i++) controller.enqueue(new Uint8Array(100 * 1024).fill(32)); controller.close(); } });
    const response = await POST(request(stream, { 'content-length': '1' }));
    expect(response.status).toBe(413);
    expect(await response.json()).toMatchObject({ ok: false, code: 'BODY_TOO_LARGE' });
    privateHeaders(response);
  });
  it('returns a safe body-read error when streaming fails', async () => {
    const stream = new ReadableStream<Uint8Array>({ start(controller) { controller.error(new Error('secret stream details')); } });
    const response = await POST(request(stream));
    expect(response.status).toBe(400);
    expect(JSON.stringify(await response.json())).not.toContain('secret');
  });
  it.each([result(null), result(null, { code: '23505', message: 'SQL detail' })])('does not acknowledge stale or duplicate writes %#', async (write) => {
    session({ results: [result({ merchant_id: merchantId, user_id: userId, revoked_at: null }), result(merchant), write] });
    const response = await POST(request());
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ ok: false, code: 'PARTNER_CONFLICT' });
    privateHeaders(response);
  });
});
