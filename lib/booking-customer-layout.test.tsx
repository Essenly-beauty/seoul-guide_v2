import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { load } from 'cheerio';
import { BookingFlow } from '@/components/booking/booking-flow';
import { BookingDatePicker } from '@/components/booking/booking-ui';
import { BookingReview } from '@/components/booking/booking-summary';
import { bookingCalendarLabel, bookingDateWindow, bookingTimeGroups, shiftBookingDate, type BookingSlot } from '@/components/booking/customer-booking-state';
import { translate } from '@/lib/i18n/core';

const { catalog } = vi.hoisted(() => ({ catalog: {
  status: 'available', placeId: 'real-salon', merchantName: 'Actual venue', mode: 'request', paymentMode: 'pay_at_venue', startDate: '2099-01-01', endDate: '2099-02-02', selectionMode: 'staff',
  services: [{ id: 'cut', name: 'Actual service', category: 'Hair', description: 'Description supplied by the venue', priceKrw: 60000, durationMinutes: 60, quoteVersion: 'v1' }],
  staff: [{ id: 'stylist', name: 'Actual specialist', title: 'Stylist', introduction: 'Venue-authored introduction', serviceIds: ['cut'] }],
} }));
vi.mock('@/lib/auth/use-auth', () => ({ useAuthUser: () => ({ user: { id: 'customer' }, loading: false }) }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));
vi.mock('@/components/booking/use-booking-resource', () => ({ useBookingResource: (url: string | null) => ({ data: url?.endsWith('/booking') ? catalog : null, error: '', loading: false, refresh: vi.fn() }) }));

function slot(startAt: string): BookingSlot { return { startAt, serviceEndAt: startAt, occupiedUntil: startAt, staffId: 'stylist' }; }

describe('booking date navigation', () => {
  it('uses date-only arithmetic across months, years and leap days', () => {
    expect(shiftBookingDate('2026-12-31', 1)).toBe('2027-01-01');
    expect(shiftBookingDate('2028-02-28', 1)).toBe('2028-02-29');
    expect(shiftBookingDate('2028-03-01', -1)).toBe('2028-02-29');
  });
  it('keeps every visible day inside the actual window, including windows shorter than five days', () => {
    expect(bookingDateWindow('2026-10-22', '2026-10-24', '2026-10-01')).toEqual(['2026-10-22', '2026-10-23', '2026-10-24']);
    expect(bookingDateWindow('2026-10-22', '2026-11-02', '2026-11-02')).toEqual(['2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02']);
    expect(bookingDateWindow('2026-10-22', '2026-10-21', '2026-10-22')).toEqual([]);
  });
  it('exposes calendar bounds and only real date choices without invented closed days', () => {
    const $ = load(renderToStaticMarkup(<BookingDatePicker first="2026-10-22" last="2026-10-24" date="2026-10-23" onChange={() => {}} />));
    expect($('input[type="date"]').attr('min')).toBe('2026-10-22');
    expect($('input[type="date"]').attr('max')).toBe('2026-10-24');
    expect($('[role="group"] button')).toHaveLength(3);
    expect($('[aria-pressed="true"]')).toHaveLength(1);
    expect($('button[aria-label="Earlier dates"]').is('[disabled]')).toBe(true);
    expect($('button[aria-label="Later dates"]').is('[disabled]')).toBe(true);
    expect($.text()).not.toContain('Closed');
    expect(bookingCalendarLabel('2026-10-23', 'en', { day: 'numeric' })).toBe('23');
  });
  it('groups and sorts available slots using Seoul noon rather than the UTC/device hour', () => {
    const afternoon = slot('2026-10-22T03:00:00Z');
    const morning = slot('2026-10-22T02:30:00Z');
    const evening = slot('2026-10-22T09:00:00Z');
    const input = [evening, afternoon, morning];
    expect(bookingTimeGroups(input)).toEqual([{ label: 'Morning', slots: [morning] }, { label: 'Afternoon', slots: [afternoon, evening] }]);
    expect(input).toEqual([evening, afternoon, morning]);
    expect(bookingTimeGroups([])).toEqual([]);
  });
});

describe('customer booking screen structure', () => {
  it('keeps the selected service total and next action outside the scrolling form content', () => {
    const $ = load(renderToStaticMarkup(<BookingFlow placeId="real-salon" initialService="cut" />));
    const footer = $('form > footer');
    expect(footer).toHaveLength(1);
    expect($('form > main')).toHaveLength(1);
    expect($('main footer')).toHaveLength(0);
    expect(footer.text()).toContain('Actual service');
    expect(footer.text()).toContain('60,000');
    expect(footer.text()).toContain('Choose your staff');
    expect(footer.find('button').attr('type')).toBe('button');
    expect(footer.find('button').is('[disabled]')).toBe(false);
    expect($('img')).toHaveLength(0);
    expect($.text()).not.toMatch(/Seoul Studio|English available|deposit/i);
  });
  it('requires an actual service selection and only displays supplied venue imagery', () => {
    const $ = load(renderToStaticMarkup(<BookingFlow placeId="real-salon" initialService="unknown-service" venue={{ photoUrl: '/verified-venue.webp', address: 'Actual address' }} />));
    expect($('form > footer button').is('[disabled]')).toBe(true);
    expect($('img').attr('src')).toBe('/verified-venue.webp');
    expect($.text()).toContain('Actual address');
  });
  it('offers edits for editable summary rows and retains the actual payment and request policy', () => {
    const props = { merchantName: catalog.merchantName, service: catalog.services[0], staff: catalog.staff[0], slot: { ...slot('2026-10-22T01:00:00Z'), serviceEndAt: '2026-10-22T02:00:00Z' }, mode: 'request' as const, paymentMode: 'pay_at_venue' as const, onEdit: () => {} };
    const $ = load(renderToStaticMarkup(<BookingReview {...props} />));
    expect($('button[aria-label="Edit Service"]')).toHaveLength(1);
    expect($('button[aria-label="Edit Staff"]')).toHaveLength(1);
    expect($('button[aria-label="Edit Date & time"]')).toHaveLength(1);
    expect($.text()).toContain('10:00–11:00');
    expect($.text()).toContain('No payment is collected online.');
    expect($.text()).toContain('The venue will confirm your request.');
    expect($.text()).not.toMatch(/deposit|English|Korean/i);
    const shop = load(renderToStaticMarkup(<BookingReview {...props} staff={undefined} needsStaff={false} />));
    expect(shop('button[aria-label="Edit Staff"]')).toHaveLength(0);
    expect(shop.text()).toContain('Venue team');
  });
  it('localizes the new booking controls in all supported translated locales', () => {
    for (const locale of ['ja', 'zh-CN', 'es', 'fr'] as const) for (const text of ['Close booking', 'Step {number} of {total}', 'Prices in KRW', 'Calendar', 'Choose a date', 'Earlier dates', 'Later dates', 'Morning', 'Afternoon', 'Your contact details', 'Edit {field}']) expect(translate(locale, text)).not.toBe(text);
  });
});
