import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { load } from 'cheerio';
import { BookingLocationView } from '@/components/booking/booking-location';
import { translate } from '@/lib/i18n/core';
vi.mock('next/dynamic', () => ({ default: () => () => <div data-map-preview="true"/> }));
const location = { placeId: 'salon', name: 'Actual venue', nameKr: '실제 매장', address: 'Seoul 123', coordinates: { lat: 37.5, lng: 127 } };
describe('booking location display', () => {
  it('shows a compact map and links that keep the booking form open', () => {
    const $ = load(renderToStaticMarkup(<BookingLocationView location={location}/>));
    expect($('[data-map-preview]')).toHaveLength(1);
    expect($('[aria-label="Map showing Actual venue"]')).toHaveLength(1);
    expect($.text()).toContain(location.address);
    expect($('a').first().attr('href')).toBe('/map?place=salon');
    expect($('a').last().attr('href')).toContain('https://www.google.com/maps/dir/');
    $('a').each((_, link) => { expect($(link).attr('target')).toBe('_blank'); expect($(link).attr('rel')).toBe('noopener noreferrer'); });
  });
  it('does not show a misleading map or directions for an unverified address', () => {
    const $ = load(renderToStaticMarkup(<BookingLocationView location={{ ...location, coordinates: null }}/>));
    expect($('[data-map-preview]')).toHaveLength(0);
    expect($.text()).toContain('Map location has not been verified yet.');
    expect($.text()).not.toContain('Get directions');
    expect($('a')).toHaveLength(1);
    expect(new URL($('a').attr('href')!).searchParams.get('query')).toBe('실제 매장 Seoul 123');
  });
  it('translates the location controls across all supported secondary locales', () => {
    for (const locale of ['ja', 'zh-CN', 'es', 'fr'] as const) for (const text of ['Venue location', 'Open map', 'Get directions', 'Map showing {venue}', 'Map location has not been verified yet.']) expect(translate(locale, text)).not.toBe(text);
  });
});
