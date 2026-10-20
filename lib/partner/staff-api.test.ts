import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST } from '@/app/api/partner/staff/route';

const mocks = vi.hoisted(() => ({ server: vi.fn(), privileged: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({ supabaseServer: mocks.server }));
vi.mock('@supabase/supabase-js', () => ({ createClient: mocks.privileged }));

const merchantId = '11111111-1111-1111-1111-111111111111';
const staffId = '22222222-2222-2222-2222-222222222222';
const userId = '33333333-3333-3333-3333-333333333333';
const stamp = '2026-10-18T01:02:03.123456+00:00';
const merchant = { id: merchantId, display_name: 'Shop', contact_email: '', contact_phone: '', address: '', business_types: ['hair'], status: 'active', booking_enabled: false, updated_at: stamp };
const profile = { id: staffId, merchant_id: merchantId, name: '민지', title: '', introduction: '', visibility: 'visible', sort_order: 0, updated_at: stamp };
const command = { kind: 'staff', mode: 'create', id: staffId, values: { name: '민지', title: '', introduction: '', visibility: 'visible', sortOrder: 0 } };
type Query = { table: string; steps: [string, unknown[]][] };
type Result = { data: unknown; error: unknown };
const result = (data: unknown, error: unknown = null): Result => ({ data, error });

function session(options: { user?: unknown; membership?: unknown; shop?: typeof merchant; write?: Result; profile?: Result; list?: Result } = {}) {
  const calls: Query[] = [];
  let listPage = 0;
  const client = {
    auth: { getUser: vi.fn(async () => ({ data: { user: options.user === undefined ? { id: userId, user_metadata: { merchant_id: 'forged' } } : options.user }, error: null })) },
    from: vi.fn((table: string) => {
      const call: Query = { table, steps: [] };
      calls.push(call);
      const builder: Record<string, unknown> = {};
      for (const method of ['select', 'eq', 'is', 'gt', 'order', 'range', 'limit', 'in', 'insert', 'update', 'delete']) builder[method] = (...args: unknown[]) => { call.steps.push([method, args]); return builder; };
      const resolve = () => {
        if (table === 'merchant_memberships') return result(options.membership === undefined ? { merchant_id: merchantId, user_id: userId, revoked_at: null } : options.membership);
        if (table === 'merchants') return result(options.shop ?? merchant);
        if (call.steps.some(([method]) => ['insert', 'update', 'delete'].includes(method))) return options.write ?? result({ merchant_id: merchantId, id: staffId });
        if (table === 'merchant_staff') return call.steps.some(([method, args]) => method === 'eq' && args[0] === 'id') ? options.profile ?? result(profile) : listPage++ === 0 ? options.list ?? result([]) : result([]);
        if (table === 'merchant_staff_menus') return result([]);
        if (table === 'merchant_staff_schedules') return result(null);
        return result(null);
      };
      builder.maybeSingle = async () => resolve();
      builder.then = (success: (value: Result) => unknown) => Promise.resolve(resolve()).then(success);
      return builder;
    }),
  };
  mocks.server.mockReturnValue(client);
  return { calls, client };
}

function get(path = '/api/partner/staff') { return new Request(`https://myseouldrop.app${path}`); }
function post(body: string | ReadableStream<Uint8Array> = JSON.stringify(command), headers: Record<string, string> = {}, path = '/api/partner/staff') {
  return new Request(`https://myseouldrop.app${path}`, {
    method: 'POST', headers: { origin: 'https://myseouldrop.app', 'content-type': 'application/json', ...headers }, body,
    ...(typeof body === 'string' ? {} : { duplex: 'half' }),
  } as RequestInit);
}
function privateResponse(response: Response) {
  expect(response.headers.get('cache-control')).toBe('private, no-store');
  expect(response.headers.get('vary')).toBe('Cookie');
}

beforeEach(() => { vi.resetAllMocks(); session(); });

describe('staff HTTP boundary', () => {
  it('lists only the authenticated merchant and keeps the response private', async () => {
    const mock = session({ list: result([profile]) });
    const response = await GET(get());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, snapshot: { merchantId, staff: [{ id: staffId, name: '민지' }] } });
    expect(mock.calls.filter(({ table }) => table === 'merchant_staff').every(({ steps }) => steps.some(([method, args]) => method === 'eq' && args[0] === 'merchant_id' && args[1] === merchantId))).toBe(true);
    expect(mocks.privileged).not.toHaveBeenCalled();
    privateResponse(response);
  });

  it('returns one exact owned detail by canonical UUID', async () => {
    const response = await GET(get(`/api/partner/staff?id=${staffId}`));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, snapshot: { merchantId, staff: { id: staffId, menuIds: [] }, schedule: null } });
    privateResponse(response);
  });

  it.each(['/api/partner/staff?merchantId=forged', '/api/partner/staff?id=bad', '/api/partner/staff?id=AAAAAAAA-AAAA-AAAA-AAAA-AAAAAAAAAAAA', `/api/partner/staff?id=${staffId}&id=${staffId}`, `/api/partner/staff?id=${staffId}&x=1`, '/api/partner/staff?id='])('rejects unsupported or invalid query %s before reading auth', async (path) => {
    const response = await GET(get(path));
    expect(response.status).toBe(400);
    expect(mocks.server).not.toHaveBeenCalled();
    privateResponse(response);
  });

  it('does not reveal whether an ID is missing or belongs to another merchant', async () => {
    session({ profile: result(null) });
    const response = await GET(get(`/api/partner/staff?id=${staffId}`));
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ ok: false, code: 'STAFF_NOT_FOUND' });
    privateResponse(response);
  });

  it('uses the cookie user and acknowledges an exact scoped write', async () => {
    const mock = session();
    const response = await POST(post());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(mock.client.auth.getUser).toHaveBeenCalled();
    expect(mock.calls.some(({ table, steps }) => table === 'merchant_staff' && steps.some(([method, args]) => method === 'insert' && (args[0] as { merchant_id: string }).merchant_id === merchantId))).toBe(true);
    expect(mocks.privileged).not.toHaveBeenCalled();
    privateResponse(response);
  });

  it('accepts staff writes for an active booking-enabled merchant', async () => {
    session({ shop: { ...merchant, booking_enabled: true } });
    const response = await POST(post());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
  });

  it.each([
    [{ user: null }, 401, 'UNAUTHENTICATED'],
    [{ membership: null }, 403, 'PARTNER_UNASSIGNED'],
    [{ shop: { ...merchant, status: 'suspended' } }, 403, 'PARTNER_READ_ONLY'],
    [{ shop: { ...merchant, status: 'closed' } }, 403, 'PARTNER_READ_ONLY'],
    [{ write: result(null) }, 409, 'PARTNER_CONFLICT'],
    [{ write: result(null, { code: '23505', message: 'private SQL detail' }) }, 409, 'PARTNER_CONFLICT'],
    [{ write: result(null, { code: 'PGRST999', message: 'private SQL detail' }) }, 503, 'PARTNER_UNAVAILABLE'],
    [{ write: result({ merchant_id: merchantId, id: userId }) }, 503, 'PARTNER_UNAVAILABLE'],
  ] as const)('returns safe failure %j', async (options, status, code) => {
    const mock = session(options);
    const response = await POST(post());
    expect(response.status).toBe(status);
    expect(await response.json()).toMatchObject({ ok: false, code });
    if (status === 401 || code === 'PARTNER_UNASSIGNED' || code === 'PARTNER_READ_ONLY') expect(mock.calls.some(({ table }) => table === 'merchant_staff')).toBe(false);
    privateResponse(response);
  });

  it('allows read-only GET for a suspended owner', async () => {
    session({ shop: { ...merchant, status: 'suspended' } });
    const response = await GET(get());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, snapshot: { readOnly: true } });
  });

  it.each(['null', '[]', '{}', '{', JSON.stringify({ ...command, merchantId }), JSON.stringify({ ...command, values: { ...command.values, owner: userId } })])('rejects invalid JSON or command %#', async (body) => {
    const mock = session();
    const response = await POST(post(body));
    expect(response.status).toBe(400);
    expect(mock.calls.some(({ table }) => table === 'merchant_staff')).toBe(false);
    privateResponse(response);
  });

  it('requires exact Origin/Host agreement and the JSON content type', async () => {
    expect((await POST(post(undefined, { origin: 'https://evil.example', host: 'myseouldrop.app' }))).status).toBe(403);
    expect((await POST(post(undefined, { origin: 'https://myseouldrop.app', host: 'evil.example' }))).status).toBe(403);
    expect((await POST(post(undefined, { 'content-type': 'text/plain' }))).status).toBe(415);
    expect(mocks.server).not.toHaveBeenCalled();
  });

  it('does not trust forwarded host for loopback origin normalization', async () => {
    const request = new NextRequest('http://127.0.0.1:3018/api/partner/staff', { method: 'POST', headers: { origin: 'http://127.0.0.1:3018', 'x-forwarded-host': '127.0.0.1:3018', 'content-type': 'application/json' }, body: JSON.stringify(command) });
    expect((await POST(request)).status).toBe(403);
    expect(mocks.server).not.toHaveBeenCalled();
  });

  it('bounds actual streamed UTF-8 bytes and hides body-read errors', async () => {
    const stream = new ReadableStream<Uint8Array>({ start(controller) { for (let i = 0; i < 4; i++) controller.enqueue(new Uint8Array(100 * 1024)); controller.close(); } });
    const large = await POST(post(stream, { 'content-length': '1' }));
    expect(large.status).toBe(413);
    expect(await large.json()).toMatchObject({ code: 'BODY_TOO_LARGE' });
    const broken = new ReadableStream<Uint8Array>({ start(controller) { controller.error(new Error('secret stream detail')); } });
    const failed = await POST(post(broken));
    expect(failed.status).toBe(400);
    expect(JSON.stringify(await failed.json())).not.toContain('secret');
  });

  it('rejects POST query selectors and malformed backend rows', async () => {
    expect((await POST(post(undefined, {}, '/api/partner/staff?merchantId=forged'))).status).toBe(400);
    session({ profile: result({ ...profile, merchant_id: userId }) });
    const malformed = await GET(get(`/api/partner/staff?id=${staffId}`));
    expect(malformed.status).toBe(503);
    expect(await malformed.json()).toMatchObject({ code: 'PARTNER_UNAVAILABLE' });
  });
});
