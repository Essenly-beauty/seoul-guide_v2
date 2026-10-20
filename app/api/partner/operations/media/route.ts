import { supabaseServer } from '@/lib/supabase/server';
import { sameOrigin } from '@/lib/partner/http';
import { bookingFailure, bookingJson, noBookingQuery } from '@/lib/booking/http';
import { BookingError } from '@/lib/booking/server';
import { parseMerchantMediaQuery } from '@/lib/partner/media-contracts';
import { listMerchantMedia, uploadMerchantMedia } from '@/lib/partner/media-server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export async function GET(request: Request): Promise<Response> {
  try {
    const query = parseMerchantMediaQuery(new URL(request.url).searchParams);
    if (!query) throw new BookingError(400, 'INVALID_REQUEST');
    return bookingJson({ media: await listMerchantMedia(await supabaseServer(), query) });
  } catch (error) { return bookingFailure(error); }
}
export async function POST(request: Request): Promise<Response> {
  try {
    noBookingQuery(request);
    if (!sameOrigin(request)) throw new BookingError(403, 'INVALID_ORIGIN');
    if (request.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase() !== 'multipart/form-data') throw new BookingError(400, 'MEDIA_INVALID');
    return bookingJson({ media: await uploadMerchantMedia(await supabaseServer(), request) }, 201);
  } catch (error) { return bookingFailure(error); }
}
