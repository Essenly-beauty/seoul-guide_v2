import { beforeEach, describe, expect, it, vi } from 'vitest';
const db = vi.hoisted(() => ({ maybeSingle: vi.fn(), eq: vi.fn(), select: vi.fn(), from: vi.fn(), client: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({ supabaseServer: db.client }));
vi.mock('@/lib/data', () => ({ getPlace: (id: string) => id === 'known' ? { id } : undefined }));
import { GET } from '@/app/api/places/[id]/catalog/route';
const request = (id = 'known') => GET(new Request(`https://example.test/api/places/${id}/catalog`), { params: Promise.resolve({ id }) });
beforeEach(() => {
  vi.resetAllMocks();
  db.client.mockReturnValue({ from: db.from }); db.from.mockReturnValue({ select: db.select }); db.select.mockReturnValue({ eq: db.eq }); db.eq.mockReturnValue({ maybeSingle: db.maybeSingle });
  db.maybeSingle.mockResolvedValue({ data: null, error: null });
});
describe('public menu endpoint', () => {
  it('rejects unknown places before accessing storage', async () => {
    const response = await request('unknown'); expect(response.status).toBe(404); expect(db.client).not.toHaveBeenCalled();
  });
  it('reads only the safe projection for the exact place and disables caching', async () => {
    const response = await request();
    expect(response.status).toBe(200); expect(await response.json()).toEqual({ status: 'unpublished', services: [] });
    expect(response.headers.get('Cache-Control')).toContain('no-store');
    expect(db.from).toHaveBeenCalledWith('published_merchant_catalogs'); expect(db.select).toHaveBeenCalledWith('place_id,services'); expect(db.eq).toHaveBeenCalledWith('place_id', 'known');
  });
  it('does not present storage failure as an empty menu or leak database details', async () => {
    db.maybeSingle.mockResolvedValue({ data: null, error: { message: 'private database error' } });
    const response = await request(); expect(response.status).toBe(503); expect(await response.text()).not.toContain('private');
  });
  it('rejects malformed or cross-place results', async () => {
    db.maybeSingle.mockResolvedValue({ data: { place_id: 'different', services: [] }, error: null });
    expect((await request()).status).toBe(503);
  });
  it('handles missing configuration without exposing environment details', async () => {
    db.client.mockImplementation(() => { throw new Error('secret config'); });
    const response = await request(); expect(response.status).toBe(503); expect(await response.text()).not.toContain('secret');
  });
});
