import type { Metadata } from 'next';
import { MyBookings } from '@/components/booking/my-bookings';
export const metadata: Metadata = { title: 'My bookings | MYSEOULDROP', robots: { index: false, follow: false } };
export default function BookingsPage() { return <MyBookings />; }
