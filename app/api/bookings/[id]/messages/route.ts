import { bookingMessageHandlers } from '@/lib/booking/communication-http';

export const dynamic = 'force-dynamic';
export const { GET, POST, PATCH } = bookingMessageHandlers(false);
