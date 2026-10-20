import { supabaseServer } from '@/lib/supabase/server';
import { uuid } from '@/lib/partner/contracts';
import { bookingFailure, bookingJson } from '@/lib/booking/http';
import { BookingError } from '@/lib/booking/server';
import { parsePartnerBookingAvailabilityQuery } from '@/lib/booking/partner-contracts';
import { getPartnerBookingAvailability } from '@/lib/booking/partner-server';

export const dynamic = 'force-dynamic';
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    const { id } = await params;
    const input = parsePartnerBookingAvailabilityQuery(new URL(request.url).searchParams);
    if (!uuid(id) || !input) throw new BookingError(400, 'INVALID_REQUEST');
    return bookingJson(await getPartnerBookingAvailability(await supabaseServer(), id, input));
  } catch (error) { return bookingFailure(error); }
}
