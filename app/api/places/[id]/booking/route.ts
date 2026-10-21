import { getPlace } from '@/lib/data';
import { supabaseServer } from '@/lib/supabase/server';
import { bookingFailure, bookingJson, noBookingQuery } from '@/lib/booking/http';
import { BookingError, getBookingCatalog } from '@/lib/booking/server';

export const dynamic = 'force-dynamic';
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    noBookingQuery(request);
    const { id } = await params;
    if (!getPlace(id)) throw new BookingError(404, 'PLACE_NOT_FOUND');
    return bookingJson(await getBookingCatalog(await supabaseServer(), id));
  } catch (error) { return bookingFailure(error); }
}
