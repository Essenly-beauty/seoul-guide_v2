import type { Place } from '@/lib/data';

/** Local integration fixture only; never published in a production build. */
export const BOOKING_PREVIEW_PLACE_ID = 'myseouldrop-booking-studio';
export function localBookingPreviewPlaces(): Place[] {
  if (process.env.NODE_ENV !== 'development' || process.env.NEXT_PUBLIC_BOOKING_PREVIEW !== '1') return [];
  return [{
    id: BOOKING_PREVIEW_PLACE_ID, name: 'MYSEOULDROP Booking Studio · Test', nameKr: '예약 연동 테스트 매장',
    type: 'hair_salon', zone: 'seongsu', tags: ['Booking test'], address: 'Local integration test · no physical venue',
    lat: 37.5445, lng: 127.0558, geoSource: 'area', locationVerification: 'provisional', englishOk: true, source: 'curated',
    badge: { cls: 'info', text: 'Test venue' },
    about: 'Test the complete booking flow inside MYSEOULDROP. Bookings are saved in the local test database and appear in the partner dashboard. This is a test venue; no real appointment or payment is made.',
  }];
}
