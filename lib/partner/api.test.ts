import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET, POST } from '@/app/api/partner/route';

const mocks = vi.hoisted(() => ({ server: vi.fn(), privileged: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({ supabaseServer: mocks.server }));
vi.mock('@supabase/supabase-js', () => ({ createClient: mocks.privileged }));
const merchantId = '11111111-1111-1111-1111-111111111111';
const userId = '22222222-2222-2222-2222-222222222222';
const stamp = '2026-10-18T00:00:00.123456+00:00';
const merchant = { id: merchantId, display_name: 'Shop', contact_email: '', contact_phone: '', address: '', business_types: [], status: 'active', booking_enabled: false, updated_at: stamp };
const validCommand = { kind: 'category', mode: 'create', id: userId, values: { nameKo: '', nameEn: 'Hair', visibility: 'draft', sortOrder: 0 } };
type Result = { data: unknown; error: unknown };
const result = (data: unknown, error: unknown = null): Result => ({ data, error });
function session(options: { user?: unknown; authError?: unknown; results?: Result[]; shop?: typeof merchant } = {}) {
  const results = options.results ?? [result({ merchant_id: merchantId, user_id: userId, revoked_at: null }), result(options.shop ?? merchant), result([]), result([]), result(null)];
  const calls: { table: string; method: string; args: unknown[] }[] = [];
  const client = {
    auth: { getUser: vi.fn(async () => ({ data: { user: options.user === undefined ? { id: userId, user_metadata: { merchant_id: 'forged' } } : options.user }, error: options.authError ?? null })) },
    from: (table: string) => {
      const builder: Record<string, unknown> = {};
      for (const method of ['select', 'eq', 'is', 'order', 'range', 'insert', 'update']) builder[method] = (...args: unknown[]) => { calls.push({ table, method, args }); return builder; };
      const resolve = () => Promise.resolve(results.shift() ?? result(null));
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
  it('uses only the existing cookie-session client and returns a private owned snapshot', async () => {
    const mock = session();
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, snapshot: { merchant: { id: merchantId }, schedule: null, categories: [], menus: [], readOnly: false } });
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
});

describe('partner HTTP command boundary', () => {
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
