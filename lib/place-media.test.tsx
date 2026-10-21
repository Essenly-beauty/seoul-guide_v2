import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { load } from 'cheerio';
import { BookingThumbnail } from '@/components/booking/booking-ui';
import { mergePublicPlaceMedia, publicPlaceMedia, publicPlaceMediaResponse } from './place-media';
import type { MerchantMedia } from './partner/media-contracts';
import type { PublishedPlace } from './place-profile';
const id = '12345678-1234-4123-8123-123456789012';
const menuId = '22345678-1234-4123-8123-123456789012';
const place = { id: 'actual-salon', name: 'Venue', nameKr: '매장', type: 'hair_salon', zone: 'seongsu', address: 'Address', lat: 37, lng: 127, tags: [], photos: ['/real-directory-photo.jpg'] } as PublishedPlace;
const media: MerchantMedia = { id, targetKind: 'store', targetId: null, status: 'active', url: `/api/places/${place.id}/media/${id}`, width: 80, height: 120, createdAt: '2026-10-20T01:00:00Z', updatedAt: '2026-10-20T01:00:00Z' };
describe('public merchant photo integration', () => {
  it('rejects pending, private, foreign-place and malformed images at the public boundary', () => {
    expect(publicPlaceMedia([media], place.id)).toBe(true);
    expect(publicPlaceMediaResponse({ media: [media] }, place.id)).toBe(true);
    for (const invalid of [{ ...media, status: 'pending' }, { ...media, url: `/api/partner/operations/media/${id}/content` }, { ...media, url: `/api/places/foreign/media/${id}` }, { ...media, width: 0 }]) {
      expect(publicPlaceMedia([invalid], place.id)).toBe(false);
      expect(mergePublicPlaceMedia(place, [invalid])).toBe(place);
    }
  });
  it('publishes approved store gallery photos and preserves validated dimensions', () => {
    expect(mergePublicPlaceMedia(place, [media])).toMatchObject({ photos: [media.url], photoUrl: media.url, publishedMedia: [{ width: 80, height: 120 }] });
  });
  it('keeps menu/staff photos associated with actual target IDs and out of the store gallery', () => {
    const menu = { ...media, targetKind: 'menu' as const, targetId: menuId };
    const result = mergePublicPlaceMedia(place, [menu]);
    expect(result.photos).toEqual(place.photos); expect(result.publishedMedia?.[0].targetId).toBe(menuId);
    expect(mergePublicPlaceMedia(place, [])).toBe(place);
  });
  it('renders actual image dimensions with decorative alt text beside the existing service name', () => {
    const html = load(renderToStaticMarkup(<BookingThumbnail media={{ ...media, targetKind: 'menu', targetId: menuId }} name="Real menu" />));
    expect(html('img').attr('src')).toBe(media.url); expect(html('img').attr('width')).toBe('80'); expect(html('img').attr('height')).toBe('120'); expect(html('img').attr('alt')).toBe('');
  });
  it('retains staff initials and no fake service photograph when no image is registered', () => {
    const staff = load(renderToStaticMarkup(<BookingThumbnail name="Mina" staff />));
    expect(staff.text()).toBe('M'); expect(staff('img').length).toBe(0);
    expect(renderToStaticMarkup(<BookingThumbnail name="Real menu" />)).toBe('');
  });
});
