import { supabaseServer } from '@/lib/supabase/server';
import { bookingFailure, bookingJson, noBookingQuery } from '@/lib/booking/http';
import { listBookings } from '@/lib/booking/server';

export const dynamic = 'force-dynamic';
export async function GET(request: Request): Promise<Response> {
  try {
    noBookingQuery(request);
    return bookingJson({ bookings: await listBookings(await supabaseServer(), true) });
  } catch (error) { return bookingFailure(error); }
}
