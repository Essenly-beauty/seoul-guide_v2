import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { load } from 'cheerio';
import type { Place } from './data';
import type { PublicStoreProfile } from './partner/profile-contracts';
import { mergePublicPlaceProfile } from './place-profile';
import { PublicStoreContact, PublicStoreNotice } from '@/components/place/public-store-profile';

const place: Place = { id: 'actual-salon', name: 'Directory name', nameKr: '기존 이름', address: 'Original address', about: 'Directory intro', aboutKr: '기존 소개', englishOk: true, type: 'hair_salon', zone: 'seongsu', lat: 37.5, lng: 127.1, tags: [], photos: ['/actual-store.webp'], geoSource: 'address', stationWalk: { station: 'Seongsu', minutes: 5 } };
const profile: Extract<PublicStoreProfile, { status: 'published' }> = { status: 'published', placeId: place.id, profile: { nameKo: '승인 이름', nameEn: 'Approved name', address: 'Approved address', introductionKo: '승인 소개', introductionEn: 'Approved introduction', contactPhone: '+82 (2) 1234-5678', contactEmail: 'visit@example.com', englishOk: false, notice: 'Please arrive five minutes early.', updatedAt: '2026-10-20T01:00:00Z' } };

describe('public store profile merge', () => {
  it('reflects approved text and immediate contact/English/notice values without changing source photos', () => {
    const merged = mergePublicPlaceProfile(place, profile);
    expect(merged.name).toBe('Approved name');
    expect(merged.nameKr).toBe('승인 이름');
    expect(merged.address).toBe('Approved address');
    expect(merged.about).toBe('Approved introduction');
    expect(merged.englishOk).toBe(false);
    expect(merged.publishedContact?.notice).toBe(profile.profile.notice);
    expect(merged.photos).toBe(place.photos);
    expect(place.name).toBe('Directory name');
  });
  it('preserves directory fallback for unpublished, malformed, foreign and pending-review payloads', () => {
    for (const value of [null, { status: 'unpublished', placeId: place.id }, { ...profile, placeId: 'foreign-salon' }, { ...profile, pendingReview: { fields: { nameEn: 'Unapproved name' } } }, { ...profile, profile: { ...profile.profile, contactPhone: 'javascript:alert(1)' } }]) expect(mergePublicPlaceProfile(place, value)).toBe(place);
  });
  it('uses approved Korean when English is empty and respects explicitly cleared introductions and contacts', () => {
    const merged = mergePublicPlaceProfile(place, { ...profile, profile: { ...profile.profile, nameEn: '', introductionEn: '', introductionKo: '', contactPhone: '', contactEmail: '', notice: '' } });
    expect(merged.name).toBe('승인 이름');
    expect(merged.about).toBeUndefined();
    expect(merged.aboutKr).toBeUndefined();
    expect(merged.publishedContact).toEqual({ contactPhone: '', contactEmail: '', notice: '' });
  });
  it('does not treat old coordinates as a verified location for a changed address', () => {
    const changed = mergePublicPlaceProfile(place, profile);
    expect(changed.geoSource).toBe('area');
    expect(changed.stationWalk).toBeUndefined();
    expect(changed.lat).toBe(place.lat);
    expect(changed.lng).toBe(place.lng);
    const same = mergePublicPlaceProfile(place, { ...profile, profile: { ...profile.profile, address: place.address } });
    expect(same.geoSource).toBe('address');
    expect(same.stationWalk).toBe(place.stationWalk);
  });
  it('renders only real supplied contact links and treats notices as text', () => {
    const merged = mergePublicPlaceProfile(place, profile);
    const $ = load(renderToStaticMarkup(<><PublicStoreContact contact={merged.publishedContact} /><PublicStoreNotice contact={{ ...merged.publishedContact!, notice: '<script>example</script>' }} /></>));
    expect($('a[href="tel:+82212345678"]')).toHaveLength(1);
    expect($('a[href="mailto:visit@example.com"]')).toHaveLength(1);
    expect($('script')).toHaveLength(0);
    expect($.text()).toContain('<script>example</script>');
    expect(renderToStaticMarkup(<><PublicStoreContact /><PublicStoreNotice /></>)).toBe('');
  });
});
