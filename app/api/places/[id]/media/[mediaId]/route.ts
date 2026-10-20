import { supabaseServer } from '@/lib/supabase/server';
import { uuid } from '@/lib/partner/contracts';
import { bookingFailure, noBookingQuery } from '@/lib/booking/http';
import { BookingError } from '@/lib/booking/server';
import { getPublicMerchantMediaContent } from '@/lib/partner/media-server';

export const dynamic = 'force-dynamic';
export async function GET(request: Request, { params }: { params: Promise<{ id: string; mediaId: string }> }): Promise<Response> {
  try {
    noBookingQuery(request); const { id, mediaId } = await params;
    if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,199}$/.test(id) || !uuid(mediaId)) throw new BookingError(400, 'INVALID_REQUEST');
    return await getPublicMerchantMediaContent(await supabaseServer(), id, mediaId);
  } catch (error) { return bookingFailure(error); }
}
