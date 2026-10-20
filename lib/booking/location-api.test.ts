import { beforeEach, describe, expect, it, vi } from 'vitest';
const db = vi.hoisted(() => ({ client: vi.fn(), rpc: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({ supabaseServer: db.client }));
vi.mock('@/lib/data', () => ({ getPlace: (id: string) => id === 'salon' ? { id, name: 'Salon', nameKr: '매장', address: 'Seoul', lat: 37.5, lng: 127 } : undefined }));
import { GET } from '@/app/api/places/[id]/location/route';
const get = (id = 'salon', query = '') => GET(new Request(`https://example.test/api/places/${encodeURIComponent(id)}/location${query}`), { params: Promise.resolve({ id }) });
beforeEach(() => {
  vi.resetAllMocks(); db.client.mockReturnValue({ rpc: db.rpc });
  db.rpc.mockResolvedValue({ data: { status: 'unpublished', placeId: 'salon' }, error: null });
});
describe('public booking location endpoint', () => {
  it('returns only venue identity, address and coordinates without caching', async () => {
    const response = await get();
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toContain('no-store');
    expect(await response.json()).toEqual({ placeId: 'salon', name: 'Salon', nameKr: '매장', address: 'Seoul', coordinates: { lat: 37.5, lng: 127 } });
    expect(db.rpc).toHaveBeenCalledWith('public_store_profile', { p_place_id: 'salon' });
  });
  it('fails closed when an approved address cannot be checked', async () => {
    db.rpc.mockResolvedValue({ data: null, error: { message: 'private database failure' } });
    const response = await get();
    expect(response.status).toBe(503);
    expect(await response.text()).not.toMatch(/private|37\.5|Seoul/);
    db.rpc.mockResolvedValue({ data: { status: 'unpublished', placeId: 'different' }, error: null });
    expect((await get()).status).toBe(503);
  });
  it('rejects unexpected queries and malformed identifiers before database access', async () => {
    expect((await get('salon', '?customerId=secret')).status).toBe(400);
    expect((await get('../salon')).status).toBe(400);
    expect(db.client).not.toHaveBeenCalled();
  });
  it('returns not found for venues absent from both approved profile and directory', async () => {
    db.rpc.mockResolvedValue({ data: { status: 'unpublished', placeId: 'missing' }, error: null });
    expect((await get('missing')).status).toBe(404);
  });
});
