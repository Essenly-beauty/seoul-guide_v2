import { getPlace } from '@/lib/data';
import { supabaseServer } from '@/lib/supabase/server';
import { getPublicStoreProfile } from '@/lib/partner/profile-server';
import { resolveBookingLocation } from '@/lib/booking/location';
import { bookingFailure, bookingJson, noBookingQuery } from '@/lib/booking/http';
import { BookingError } from '@/lib/booking/server';

export const dynamic = 'force-dynamic';
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    noBookingQuery(request);
    const { id } = await params;
    if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,199}$/.test(id)) throw new BookingError(400, 'INVALID_REQUEST');
    const profile = await getPublicStoreProfile(await supabaseServer(), id);
    const location = resolveBookingLocation(id, getPlace(id), profile);
    if (!location) throw new BookingError(404, 'PLACE_NOT_FOUND');
    return bookingJson(location);
  } catch (error) { return bookingFailure(error); }
}
