import { supabaseServer } from '@/lib/supabase/server';
import { bookingFailure, bookingJson, noBookingQuery } from '@/lib/booking/http';
import { BookingError } from '@/lib/booking/server';
import { getPublicStoreProfile } from '@/lib/partner/profile-server';

export const dynamic = 'force-dynamic';
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    noBookingQuery(request);
    const { id } = await params;
    if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,199}$/.test(id)) throw new BookingError(400, 'INVALID_REQUEST');
    return bookingJson(await getPublicStoreProfile(await supabaseServer(), id));
  } catch (error) { return bookingFailure(error); }
}
