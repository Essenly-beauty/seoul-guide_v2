import { supabaseServer } from '@/lib/supabase/server';
import { bookingFailure, bookingJson, bookingRequestBody, noBookingQuery } from '@/lib/booking/http';
import { BookingError } from '@/lib/booking/server';
import { partnerBookingCreateInput } from '@/lib/booking/partner-contracts';
import { createPartnerBooking, listPartnerBookings } from '@/lib/booking/partner-server';

export const dynamic = 'force-dynamic';
export async function GET(request: Request): Promise<Response> {
  try {
    noBookingQuery(request);
    return bookingJson(await listPartnerBookings(await supabaseServer()));
  } catch (error) { return bookingFailure(error); }
}
export async function POST(request: Request): Promise<Response> {
  try {
    const input = await bookingRequestBody(request);
    if (!partnerBookingCreateInput(input)) throw new BookingError(400, 'INVALID_REQUEST');
    return bookingJson({ booking: await createPartnerBooking(await supabaseServer(), input) }, 201);
  } catch (error) { return bookingFailure(error); }
}
