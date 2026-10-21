import { supabaseServer } from '@/lib/supabase/server';
import { bookingFailure, bookingJson, noBookingQuery } from '@/lib/booking/http';
import { listPartnerMessageThreads } from '@/lib/booking/communication-server';

export const dynamic = 'force-dynamic';
export async function GET(request: Request): Promise<Response> {
  try {
    noBookingQuery(request);
    return bookingJson({ threads: await listPartnerMessageThreads(await supabaseServer()) });
  } catch (error) { return bookingFailure(error); }
}
