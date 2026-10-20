import { supabaseServer } from '@/lib/supabase/server';
import { exactKeys, record, uuid } from '@/lib/partner/contracts';
import { bookingTimestamp } from '@/lib/booking/contracts';
import { bookingFailure, bookingJson, bookingRequestBody } from '@/lib/booking/http';
import { BookingError } from '@/lib/booking/server';
import { deleteMerchantMedia } from '@/lib/partner/media-server';

export const dynamic = 'force-dynamic';
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    const input = await bookingRequestBody(request); const { id } = await params;
    if (!uuid(id) || !record(input) || !exactKeys(input, ['expectedUpdatedAt']) || !bookingTimestamp(input.expectedUpdatedAt)) throw new BookingError(400, 'INVALID_REQUEST');
    await deleteMerchantMedia(await supabaseServer(), id, input.expectedUpdatedAt);
    return bookingJson({ deleted: true });
  } catch (error) { return bookingFailure(error); }
}
