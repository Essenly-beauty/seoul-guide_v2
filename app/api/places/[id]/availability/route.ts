import { getPlace } from '@/lib/data';
import { supabaseServer } from '@/lib/supabase/server';
import { parseBookingAvailabilityQuery } from '@/lib/booking/contracts';
import { bookingFailure, bookingJson } from '@/lib/booking/http';
import { BookingError, getBookingAvailability } from '@/lib/booking/server';

export const dynamic = 'force-dynamic';
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    const { id } = await params;
    if (!getPlace(id)) throw new BookingError(404, 'PLACE_NOT_FOUND');
    const selection = parseBookingAvailabilityQuery(new URL(request.url).searchParams);
    if (!selection) throw new BookingError(400, 'INVALID_REQUEST');
    return bookingJson(await getBookingAvailability(await supabaseServer(), id, selection));
  } catch (error) { return bookingFailure(error); }
}
