import { supabaseServer } from '@/lib/supabase/server';
import { uuid } from '@/lib/partner/contracts';
import { bookingPartnerTransition } from '@/lib/booking/contracts';
import { bookingFailure, bookingJson, bookingRequestBody } from '@/lib/booking/http';
import { BookingError, transitionBooking } from '@/lib/booking/server';

export const dynamic = 'force-dynamic';
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    const input = await bookingRequestBody(request);
    const { id } = await params;
    if (!uuid(id) || !bookingPartnerTransition(input)) throw new BookingError(400, 'INVALID_REQUEST');
    return bookingJson({ booking: await transitionBooking(await supabaseServer(), id, input) });
  } catch (error) { return bookingFailure(error); }
}
