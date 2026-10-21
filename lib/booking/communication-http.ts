import { supabaseServer } from '@/lib/supabase/server';
import { uuid } from '@/lib/partner/contracts';
import { bookingFailure, bookingJson, bookingRequestBody, noBookingQuery } from './http';
import { BookingError } from './server';
import { bookingMessageInput, bookingMessageReadInput } from './communication-contracts';
import { getBookingMessages } from './communication-server';

type Context = { params: Promise<{ id: string }> };
export function bookingMessageHandlers(partner: boolean) {
  return {
    async GET(request: Request, { params }: Context): Promise<Response> {
      try {
        noBookingQuery(request);
        const { id } = await params;
        if (!uuid(id)) throw new BookingError(400, 'INVALID_REQUEST');
        return bookingJson(await getBookingMessages(await supabaseServer(), id, partner));
      } catch (error) { return bookingFailure(error); }
    },
    async POST(request: Request, { params }: Context): Promise<Response> {
      try {
        const input = await bookingRequestBody(request);
        const { id } = await params;
        if (!uuid(id) || !bookingMessageInput(input)) throw new BookingError(400, 'INVALID_REQUEST');
        return bookingJson(await getBookingMessages(await supabaseServer(), id, partner, input), 201);
      } catch (error) { return bookingFailure(error); }
    },
    async PATCH(request: Request, { params }: Context): Promise<Response> {
      try {
        const input = await bookingRequestBody(request);
        const { id } = await params;
        if (!uuid(id) || !bookingMessageReadInput(input)) throw new BookingError(400, 'INVALID_REQUEST');
        return bookingJson(await getBookingMessages(await supabaseServer(), id, partner, input));
      } catch (error) { return bookingFailure(error); }
    },
  };
}
