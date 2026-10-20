import { getPlace } from '@/lib/data';
import { supabaseServer } from '@/lib/supabase/server';
import { bookingCreateInput } from '@/lib/booking/contracts';
import { bookingFailure, bookingJson, bookingRequestBody, noBookingQuery } from '@/lib/booking/http';
import { BookingError, createBooking, listBookings } from '@/lib/booking/server';

export const dynamic = 'force-dynamic';
export async function GET(request: Request): Promise<Response> {
  try {
    noBookingQuery(request);
    return bookingJson({ bookings: await listBookings(await supabaseServer()) });
  } catch (error) { return bookingFailure(error); }
}
export async function POST(request: Request): Promise<Response> {
  try {
    const input = await bookingRequestBody(request);
    if (!bookingCreateInput(input)) throw new BookingError(400, 'INVALID_REQUEST');
    if (!getPlace(input.placeId)) throw new BookingError(404, 'PLACE_NOT_FOUND');
    return bookingJson({ booking: await createBooking(await supabaseServer(), input) }, 201);
  } catch (error) { return bookingFailure(error); }
}
