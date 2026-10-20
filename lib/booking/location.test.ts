import { describe, expect, it } from 'vitest';
import type { Place } from '@/lib/data';
import { bookingLocation, resolveBookingLocation } from './location';

const place: Place = { id: 'salon', name: 'Salon', nameKr: '매장', address: 'Seoul 123', lat: 37.5, lng: 127, type: 'hair_salon', zone: 'gangnam_station', tags: [] };
const unpublished = { status: 'unpublished', placeId: place.id };
const profile = { nameKo: '승인된 매장', nameEn: 'Approved salon', address: place.address, introductionKo: '', introductionEn: '', contactPhone: '', contactEmail: '', englishOk: false, notice: '', updatedAt: '2026-10-20T01:00:00Z' };
const published = { status: 'published', placeId: place.id, profile };

describe('booking venue coordinates', () => {
  it('uses only the exact requested venue and approved public copy', () => {
    const result = resolveBookingLocation(place.id, place, published);
    expect(result).toEqual({ placeId: place.id, name: profile.nameEn, nameKr: profile.nameKo, address: place.address, coordinates: { lat: place.lat, lng: place.lng } });
    expect(bookingLocation(result)).toBe(true);
    expect(resolveBookingLocation('other', place, published)).toBeNull();
    expect(resolveBookingLocation(place.id, undefined, unpublished)).toBeNull();
  });
  it('keeps the original pin only while the approved address matches it', () => {
    expect(resolveBookingLocation(place.id, place, { ...published, profile: { ...profile, address: 'New approved address' } })?.coordinates).toBeNull();
    expect(resolveBookingLocation(place.id, place, { ...published, profile: { ...profile, address: ` ${place.address} ` } })?.coordinates).toEqual({ lat: 37.5, lng: 127 });
    expect(resolveBookingLocation(place.id, undefined, published)?.coordinates).toBeNull();
  });
  it('never presents an area centre, provisional or invalid coordinate as a storefront', () => {
    for (const change of [{ geoSource: 'area' }, { locationVerification: 'provisional' }, { lat: NaN }, { lng: Infinity }, { lat: 91 }, { lng: 181 }]) {
      expect(resolveBookingLocation(place.id, { ...place, ...change } as Place, unpublished)?.coordinates).toBeNull();
    }
  });
  it('rejects extra private fields and invalid coordinates at the response boundary', () => {
    const location = resolveBookingLocation(place.id, place, unpublished)!;
    expect(bookingLocation({ ...location, pendingReview: {} })).toBe(false);
    expect(bookingLocation({ ...location, coordinates: { lat: 37, lng: 127, customerId: 'private' } })).toBe(false);
    expect(bookingLocation({ ...location, coordinates: { lat: NaN, lng: 127 } })).toBe(false);
    expect(bookingLocation({ ...location, placeId: '../other' })).toBe(false);
    expect(bookingLocation({ ...location, coordinates: null })).toBe(true);
  });
});
