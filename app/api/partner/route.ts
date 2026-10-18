import { supabaseServer } from '@/lib/supabase/server';
import { parsePartnerCommand } from '@/lib/partner/contracts';
import { getPartnerContext, getPartnerSnapshot, PartnerError } from '@/lib/partner/server';
import { savePartnerCommand } from '@/lib/partner/mutations';
import { parseReservationCommand } from '@/lib/partner/reservation-commands';
import { saveReservationCommand } from '@/lib/partner/reservation-store';

export const dynamic = 'force-dynamic';

const messages: Record<string, string> = {
  UNAUTHENTICATED: '로그인이 필요합니다.',
  PARTNER_UNASSIGNED: '연결된 파트너 매장이 없습니다. 관리자에게 문의해 주세요.',
  PARTNER_READ_ONLY: '현재 매장 상태에서는 정보를 변경할 수 없습니다.',
  PARTNER_FORBIDDEN: '이 정보를 변경할 권한이 없습니다.',
  INVALID_COMMAND: '입력한 정보를 확인해 주세요.',
  PARTNER_CONFLICT: '정보가 변경되었거나 이미 존재합니다. 새로고침 후 다시 시도해 주세요.',
  PARTNER_UNAVAILABLE: '매장 정보를 처리할 수 없습니다. 잠시 후 다시 시도해 주세요.',
  PARTNER_LIMIT_EXCEEDED: '관리 가능한 정보 수를 초과했습니다. 관리자에게 문의해 주세요.',
  INVALID_ORIGIN: '요청 출처를 확인할 수 없습니다.',
  UNSUPPORTED_MEDIA_TYPE: 'JSON 형식으로 요청해 주세요.',
  INVALID_JSON: '요청 내용을 확인해 주세요.',
  BODY_TOO_LARGE: '요청 크기가 너무 큽니다.',
  BODY_READ_FAILED: '요청을 읽을 수 없습니다. 다시 시도해 주세요.',
};
function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie' } });
}
function failure(error: unknown): Response {
  const known = error instanceof PartnerError && Object.hasOwn(messages, error.code) ? error : new PartnerError(503, 'PARTNER_UNAVAILABLE');
  return json({ ok: false, code: known.code, error: messages[known.code] }, known.status);
}
function sameOrigin(request: Request): boolean {
  try {
    const header = request.headers.get('origin');
    if (!header) return false;
    const origin = new URL(header);
    if (header !== origin.origin) return false;
    const target = new URL(request.url);
    const host = request.headers.get('host');
    if (host !== null && host !== origin.host) return false;
    if (header === target.origin) return true;
    // Next 15 NextURL rewrites loopback IPs to localhost. Recover only that
    // normalization using exact browser Origin/Host agreement, never forwarded headers.
    return host === origin.host && target.hostname === 'localhost' &&
      ['127.0.0.1', '[::1]'].includes(origin.hostname) && origin.protocol === target.protocol && origin.port === target.port;
  } catch { return false; }
}
async function readJson(request: Request): Promise<unknown> {
  if (!request.body) throw new PartnerError(400, 'INVALID_JSON');
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > 300 * 1024) {
        // Cancellation is best effort; it must not mask the bounded-body error.
        void reader.cancel().catch(() => {});
        throw new PartnerError(413, 'BODY_TOO_LARGE');
      }
      chunks.push(value);
    }
  } catch (error) {
    if (error instanceof PartnerError) throw error;
    throw new PartnerError(400, 'BODY_READ_FAILED');
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) as unknown; }
  catch { throw new PartnerError(400, 'INVALID_JSON'); }
}

export async function GET(): Promise<Response> {
  try {
    const client = supabaseServer();
    const context = await getPartnerContext(client);
    return json({ ok: true, snapshot: await getPartnerSnapshot(client, context) });
  } catch (error) { return failure(error); }
}

export async function POST(request: Request): Promise<Response> {
  try {
    if (!sameOrigin(request)) throw new PartnerError(403, 'INVALID_ORIGIN');
    if (request.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase() !== 'application/json') throw new PartnerError(415, 'UNSUPPORTED_MEDIA_TYPE');
    const client = supabaseServer();
    const context = await getPartnerContext(client);
    const body = await readJson(request);
    const parsed = parsePartnerCommand(body);
    if (parsed.ok) await savePartnerCommand(client, context, parsed.command);
    else {
      const reservation = parseReservationCommand(body);
      if (!reservation.ok) throw new PartnerError(400, 'INVALID_COMMAND');
      await saveReservationCommand(client, context, reservation.command);
    }
    return json({ ok: true });
  } catch (error) { return failure(error); }
}
