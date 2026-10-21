import { describe, expect, it } from 'vitest';
import { decodePublicCatalog } from './public-catalog';

const menu = { id: '11111111-1111-4111-8111-111111111111', category: 'Hair', name: 'Signature cut', description: 'Consultation, wash and styling.', priceKrw: 60000, durationMinutes: 60 };
describe('public service catalog boundary', () => {
  it('distinguishes unpublished from a published, empty menu', () => {
    expect(decodePublicCatalog(null, 'salon')).toEqual({ status: 'unpublished', services: [] });
    expect(decodePublicCatalog({ place_id: 'salon', services: [] }, 'salon')).toEqual({ status: 'published', services: [] });
  });
  it('returns only allowlisted English menu fields, never private fields or payment promises', () => {
    expect(decodePublicCatalog({ place_id: 'salon', merchant_id: 'private', contact_email: 'private', services: [{ ...menu, depositKrw: 10000, internalNotes: 'secret' }] }, 'salon')).toEqual({ status: 'published', services: [menu] });
  });
  it('rejects the wrong place instead of showing another merchant’s menu', () => {
    expect(() => decodePublicCatalog({ place_id: 'other', services: [menu] }, 'salon')).toThrow();
  });
  it.each([null, '60000', 0, -1, 0.5, Number.MAX_SAFE_INTEGER + 1, NaN])('rejects invalid prices: %s', priceKrw => {
    expect(() => decodePublicCatalog({ place_id: 'salon', services: [{ ...menu, priceKrw }] }, 'salon')).toThrow();
  });
  it.each([{ name: ' ' }, { category: '' }, { description: '' }, { durationMinutes: null }, { durationMinutes: 1.5 }, { id: 'bad' }])('rejects incomplete server data: %s', patch => {
    expect(() => decodePublicCatalog({ place_id: 'salon', services: [{ ...menu, ...patch }] }, 'salon')).toThrow();
  });
  it('rejects duplicate IDs and malformed collections, never silently discards a row', () => {
    for (const services of [[menu, menu], {}, null]) expect(() => decodePublicCatalog({ place_id: 'salon', services }, 'salon')).toThrow();
  });
});
