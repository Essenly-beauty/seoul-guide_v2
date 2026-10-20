import { supabaseServer } from '@/lib/supabase/server';
import { parsePartnerCommand } from '@/lib/partner/contracts';
import { getPartnerContext, getPartnerSnapshot, PartnerError } from '@/lib/partner/server';
import { savePartnerCommand } from '@/lib/partner/mutations';
import { parseReservationCommand } from '@/lib/partner/reservation-commands';
import { saveReservationCommand } from '@/lib/partner/reservation-store';
import { partnerFailure, partnerJson, readJson, sameOrigin } from '@/lib/partner/http';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  try {
    const client = await supabaseServer();
    const context = await getPartnerContext(client);
    return partnerJson({ ok: true, snapshot: await getPartnerSnapshot(client, context) });
  } catch (error) { return partnerFailure(error); }
}

export async function POST(request: Request): Promise<Response> {
  try {
    if (!sameOrigin(request)) throw new PartnerError(403, 'INVALID_ORIGIN');
    if (request.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase() !== 'application/json') throw new PartnerError(415, 'UNSUPPORTED_MEDIA_TYPE');
    const client = await supabaseServer();
    const context = await getPartnerContext(client);
    const body = await readJson(request);
    const parsed = parsePartnerCommand(body);
    if (parsed.ok) await savePartnerCommand(client, context, parsed.command);
    else {
      const reservation = parseReservationCommand(body);
      if (!reservation.ok) throw new PartnerError(400, 'INVALID_COMMAND');
      await saveReservationCommand(client, context, reservation.command);
    }
    return partnerJson({ ok: true });
  } catch (error) { return partnerFailure(error); }
}
