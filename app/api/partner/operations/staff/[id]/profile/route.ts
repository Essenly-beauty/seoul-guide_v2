import { supabaseServer } from '@/lib/supabase/server';
import { uuid } from '@/lib/partner/contracts';
import { bookingFailure, bookingJson, bookingRequestBody, noBookingQuery } from '@/lib/booking/http';
import { BookingError } from '@/lib/booking/server';
import { staffProfileUpdate, staffProfileValues } from '@/lib/partner/staff-profile-contracts';
import { getPartnerStaffProfile } from '@/lib/partner/profile-server';

export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, { params }: Context): Promise<Response> {
  try {
    noBookingQuery(request);
    const { id } = await params;
    if (!uuid(id)) throw new BookingError(400, 'INVALID_REQUEST');
    return bookingJson({ staff: await getPartnerStaffProfile(await supabaseServer(), id) });
  } catch (error) { return bookingFailure(error); }
}
export async function POST(request: Request, { params }: Context): Promise<Response> {
  try {
    const input = await bookingRequestBody(request); const { id } = await params;
    if (!uuid(id) || !staffProfileValues(input)) throw new BookingError(400, 'INVALID_REQUEST');
    return bookingJson({ staff: await getPartnerStaffProfile(await supabaseServer(), id, input) }, 201);
  } catch (error) { return bookingFailure(error); }
}
export async function PATCH(request: Request, { params }: Context): Promise<Response> {
  try {
    const input = await bookingRequestBody(request); const { id } = await params;
    if (!uuid(id) || !staffProfileUpdate(input)) throw new BookingError(400, 'INVALID_REQUEST');
    return bookingJson({ staff: await getPartnerStaffProfile(await supabaseServer(), id, input) });
  } catch (error) { return bookingFailure(error); }
}
