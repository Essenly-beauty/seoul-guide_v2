import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getPublishedPlace, readPublicPlaceProfile, readPublicPlaceMedia } from './place-profile-server';
const mocks = vi.hoisted(() => ({ getPlace: vi.fn(), getPublicStoreProfile: vi.fn(), getPublicMerchantMedia: vi.fn(), supabaseServer: vi.fn(), client: {} }));
vi.mock('./data', () => ({ getPlace: mocks.getPlace }));
vi.mock('./supabase/server', () => ({ supabaseServer: mocks.supabaseServer }));
vi.mock('./partner/media-server', () => ({ getPublicMerchantMedia: mocks.getPublicMerchantMedia }));
vi.mock('./partner/profile-server', () => ({ getPublicStoreProfile: mocks.getPublicStoreProfile }));
const place = { id: 'actual-salon', name: 'Directory name', nameKr: '기존 이름', address: 'Address', lat: 37.5, lng: 127.1, type: 'hair_salon', zone: 'seongsu', tags: [] };
const published = { status: 'published', placeId: place.id, profile: { nameKo: '승인 이름', nameEn: 'Approved name', address: place.address, introductionKo: '', introductionEn: 'Approved intro', contactPhone: '', contactEmail: '', englishOk: false, notice: '', updatedAt: '2026-10-20T01:00:00Z' } };
beforeEach(() => { vi.resetAllMocks(); mocks.supabaseServer.mockResolvedValue(mocks.client); mocks.getPlace.mockReturnValue(place); mocks.getPublicStoreProfile.mockResolvedValue(published); mocks.getPublicMerchantMedia.mockResolvedValue([]); });
describe('server public profile integration', () => {
  it('reads through the request server client and public RPC helper without a loopback request', async () => {
    expect(await getPublishedPlace(place.id)).toMatchObject({ name: 'Approved name', about: 'Approved intro' });
    expect(mocks.getPublicStoreProfile).toHaveBeenCalledWith(mocks.client, place.id);
  });
  it('falls back to directory data on a failed or unpublished public profile', async () => {
    mocks.getPublicStoreProfile.mockRejectedValueOnce(new Error('Unavailable'));
    expect(await getPublishedPlace(place.id)).toBe(place);
    mocks.getPublicStoreProfile.mockResolvedValueOnce({ status: 'unpublished', placeId: place.id });
    expect(await getPublishedPlace(place.id)).toBe(place);
  });
  it('does not leak a foreign or pending snapshot to a public page', async () => {
    mocks.getPublicStoreProfile.mockResolvedValueOnce({ ...published, pendingReview: { fields: { nameEn: 'Secret request' } } });
    expect(await readPublicPlaceProfile(place.id)).toEqual({ status: 'unpublished', placeId: place.id });
    mocks.getPublicStoreProfile.mockResolvedValueOnce({ ...published, placeId: 'foreign' });
    expect(await readPublicPlaceProfile(place.id)).toEqual({ status: 'unpublished', placeId: place.id });
  });
  it('reads active media through the request client and uses only approved store photos', async () => {
    const id = '12345678-1234-4123-8123-123456789012';
    const media = { id, targetKind: 'store', targetId: null, status: 'active', url: `/api/places/${place.id}/media/${id}`, width: 80, height: 120, createdAt: '2026-10-20T01:00:00Z', updatedAt: '2026-10-20T01:00:00Z' };
    mocks.getPublicMerchantMedia.mockResolvedValueOnce([media]);
    expect(await getPublishedPlace(place.id)).toMatchObject({ name: 'Approved name', photos: [media.url], publishedMedia: [media] });
    expect(mocks.getPublicMerchantMedia).toHaveBeenCalledWith(mocks.client, place.id);
    mocks.getPublicMerchantMedia.mockResolvedValueOnce([{ ...media, status: 'pending' }]);
    expect(await readPublicPlaceMedia(place.id)).toEqual([]);
  });
  it('keeps approved text usable when image storage is unavailable', async () => {
    mocks.getPublicMerchantMedia.mockRejectedValueOnce(new Error('Storage unavailable'));
    expect(await getPublishedPlace(place.id)).toMatchObject({ name: 'Approved name', about: 'Approved intro' });
  });
  it('preserves the existing directory not-found behavior', async () => {
    mocks.getPlace.mockReturnValueOnce(undefined);
    expect(await getPublishedPlace('missing')).toBeUndefined();
    expect(mocks.getPublicStoreProfile).not.toHaveBeenCalled();
  });
});
