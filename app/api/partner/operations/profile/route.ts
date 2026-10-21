import { supabaseServer } from '@/lib/supabase/server';
import { bookingFailure, bookingJson, bookingRequestBody, noBookingQuery } from '@/lib/booking/http';
import { BookingError } from '@/lib/booking/server';
import { storeProfileMutation } from '@/lib/partner/profile-contracts';
import { getPartnerStoreProfile } from '@/lib/partner/profile-server';

export const dynamic = 'force-dynamic';
export async function GET(request: Request): Promise<Response> {
  try { noBookingQuery(request); return bookingJson(await getPartnerStoreProfile(await supabaseServer())); }
  catch (error) { return bookingFailure(error); }
}
export async function PATCH(request: Request): Promise<Response> {
  try {
    const input = await bookingRequestBody(request);
    if (!storeProfileMutation(input)) throw new BookingError(400, 'INVALID_REQUEST');
    return bookingJson(await getPartnerStoreProfile(await supabaseServer(), input));
  } catch (error) { return bookingFailure(error); }
}
