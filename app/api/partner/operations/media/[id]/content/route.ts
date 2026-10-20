import { supabaseServer } from '@/lib/supabase/server';
import { uuid } from '@/lib/partner/contracts';
import { bookingFailure, noBookingQuery } from '@/lib/booking/http';
import { BookingError } from '@/lib/booking/server';
import { getMerchantMediaContent } from '@/lib/partner/media-server';

export const dynamic = 'force-dynamic';
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    noBookingQuery(request); const { id } = await params;
    if (!uuid(id)) throw new BookingError(400, 'INVALID_REQUEST');
    return await getMerchantMediaContent(await supabaseServer(), id);
  } catch (error) { return bookingFailure(error); }
}
