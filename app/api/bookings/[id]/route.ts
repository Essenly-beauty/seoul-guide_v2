import { supabaseServer } from '@/lib/supabase/server';
import { uuid } from '@/lib/partner/contracts';
import { bookingCustomerTransition } from '@/lib/booking/contracts';
import { bookingFailure, bookingJson, bookingRequestBody, noBookingQuery } from '@/lib/booking/http';
import { BookingError, getBooking, transitionBooking } from '@/lib/booking/server';

export const dynamic = 'force-dynamic';
type RouteContext = { params: Promise<{ id: string }> };
export async function GET(request: Request, { params }: RouteContext): Promise<Response> {
  try {
    noBookingQuery(request);
    const { id } = await params;
    if (!uuid(id)) throw new BookingError(400, 'INVALID_REQUEST');
    return bookingJson({ booking: await getBooking(await supabaseServer(), id) });
  } catch (error) { return bookingFailure(error); }
}
export async function PATCH(request: Request, { params }: RouteContext): Promise<Response> {
  try {
    const input = await bookingRequestBody(request);
    const { id } = await params;
    if (!uuid(id) || !bookingCustomerTransition(input)) throw new BookingError(400, 'INVALID_REQUEST');
    return bookingJson({ booking: await transitionBooking(await supabaseServer(), id) });
  } catch (error) { return bookingFailure(error); }
}
