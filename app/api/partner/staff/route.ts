import { supabaseServer } from '@/lib/supabase/server';
import { uuid } from '@/lib/partner/contracts';
import { parseStaffCommand } from '@/lib/partner/staff-contracts';
import { getPartnerContext, PartnerError } from '@/lib/partner/server';
import { getStaffDetail, getStaffList, saveStaffCommand } from '@/lib/partner/staff-server';
import { partnerFailure, partnerJson, readJson, sameOrigin } from '@/lib/partner/http';

export const dynamic = 'force-dynamic';

function staffIdFromQuery(request: Request): string | null {
  const params = new URL(request.url).searchParams;
  if (params.size === 0) return null;
  if (params.size !== 1 || !params.has('id')) throw new PartnerError(400, 'INVALID_STAFF_ID');
  const id = params.get('id');
  if (!uuid(id) || id !== id.toLowerCase()) throw new PartnerError(400, 'INVALID_STAFF_ID');
  return id;
}

export async function GET(request: Request): Promise<Response> {
  try {
    const id = staffIdFromQuery(request);
    const client = await supabaseServer();
    const context = await getPartnerContext(client);
    const snapshot = id === null ? await getStaffList(client, context) : await getStaffDetail(client, context, id);
    return partnerJson({ ok: true, snapshot });
  } catch (error) { return partnerFailure(error); }
}

export async function POST(request: Request): Promise<Response> {
  try {
    if (new URL(request.url).searchParams.size !== 0) throw new PartnerError(400, 'INVALID_COMMAND');
    if (!sameOrigin(request)) throw new PartnerError(403, 'INVALID_ORIGIN');
    if (request.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase() !== 'application/json') throw new PartnerError(415, 'UNSUPPORTED_MEDIA_TYPE');
    const client = await supabaseServer();
    const context = await getPartnerContext(client);
    const parsed = parseStaffCommand(await readJson(request));
    if (!parsed.ok) throw new PartnerError(400, 'INVALID_COMMAND');
    await saveStaffCommand(client, context, parsed.command);
    return partnerJson({ ok: true });
  } catch (error) { return partnerFailure(error); }
}
