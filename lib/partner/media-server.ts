import type { SupabaseClient } from '@supabase/supabase-js';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { exactKeys, record, uuid } from './contracts';
import { getPartnerContext, PartnerError } from './server';
import { BookingError } from '@/lib/booking/server';
import { merchantMedia, MERCHANT_MEDIA_MAX_BYTES, type MerchantMedia, type MerchantMediaQuery, type MerchantMediaTarget } from './media-contracts';

const bucket = 'merchant-images';
const errorCodes: Record<string, number> = {
  AUTH_REQUIRED: 401, PARTNER_FORBIDDEN: 403, PARTNER_READ_ONLY: 403, INVALID_REQUEST: 400,
  MEDIA_NOT_FOUND: 404, BOOKING_CONFLICT: 409, MEDIA_LIMIT_EXCEEDED: 409, MEDIA_UPLOAD_INCOMPLETE: 409,
};
type RawMedia = Omit<MerchantMedia, 'url' | 'status'> & { objectPath: string; status: 'uploading' | 'pending' | 'active' | 'archived' | 'deleted' };
function unavailable(): never { throw new BookingError(503, 'BOOKING_SERVICE_UNAVAILABLE'); }
function rpcData(result: unknown): unknown {
  if (!record(result) || !Object.hasOwn(result, 'data') || !Object.hasOwn(result, 'error')) return unavailable();
  if (result.error !== null) {
    if (record(result.error) && result.error.code === 'P0001' && typeof result.error.message === 'string' && Object.hasOwn(errorCodes, result.error.message)) throw new BookingError(errorCodes[result.error.message], result.error.message);
    return unavailable();
  }
  return result.data;
}
function rawMedia(value: unknown): RawMedia {
  if (!record(value)) return unavailable();
  const { objectPath, status, ...fields } = value;
  if (typeof objectPath !== 'string' || !/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.webp$/.test(objectPath) ||
    !uuid(objectPath.split('/')[0]) || !uuid(fields.id) || objectPath.split('/')[1] !== `${fields.id}.webp` ||
    !['uploading', 'pending', 'active', 'archived', 'deleted'].includes(String(status)) ||
    !merchantMedia({ ...fields, status: status === 'pending' ? 'pending' : 'active', url: `/api/partner/operations/media/${fields.id}/content` })) return unavailable();
  return value as RawMedia;
}
function project(raw: RawMedia, placeId?: string): MerchantMedia {
  if (raw.status !== 'pending' && raw.status !== 'active') return unavailable();
  const { objectPath: _path, status, ...fields } = raw;
  return { ...fields, status, url: placeId ? `/api/places/${placeId}/media/${raw.id}` : `/api/partner/operations/media/${raw.id}/content` };
}
async function operation<T>(client: SupabaseClient, write: boolean, run: () => Promise<T>): Promise<T> {
  try {
    const context = await getPartnerContext(client);
    if (write && context.readOnly) throw new BookingError(403, 'PARTNER_READ_ONLY');
    return await run();
  } catch (error) {
    if (error instanceof BookingError) throw error;
    if (error instanceof PartnerError) {
      if (error.code === 'UNAUTHENTICATED') throw new BookingError(401, 'AUTH_REQUIRED');
      if (['PARTNER_UNASSIGNED', 'PARTNER_FORBIDDEN'].includes(error.code)) throw new BookingError(403, 'PARTNER_FORBIDDEN');
    }
    return unavailable();
  }
}
function list(raw: unknown): RawMedia[] {
  if (!Array.isArray(raw) || raw.length > 10000) return unavailable();
  const items: RawMedia[] = [];
  for (let index = 0; index < raw.length; index += 1) {
    if (!Object.hasOwn(raw, index)) return unavailable();
    items.push(rawMedia(raw[index]));
  }
  if (new Set(items.map((item) => item.id)).size !== items.length) return unavailable();
  return items;
}
export async function listMerchantMedia(client: SupabaseClient, query: MerchantMediaQuery): Promise<MerchantMedia[]> {
  return operation(client, false, async () => list(rpcData(await client.rpc('partner_media_list', { p_target_kind: query.targetKind ?? null, p_target_id: query.targetId ?? null }))).map((item) => project(item)));
}
export async function getPublicMerchantMedia(client: SupabaseClient, placeId: string): Promise<MerchantMedia[]> {
  try { return list(rpcData(await client.rpc('public_merchant_media', { p_place_id: placeId, p_id: null }))).map((item) => {
    if (item.status !== 'active') return unavailable();
    return project(item, placeId);
  }); } catch (error) { if (error instanceof BookingError) throw error; return unavailable(); }
}
async function readUpload(request: Request): Promise<{ targetKind: MerchantMediaTarget; targetId: string | null; requestId: string; bytes: Buffer }> {
  const maximum = MERCHANT_MEDIA_MAX_BYTES + 32 * 1024;
  const declared = request.headers.get('content-length');
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > maximum)) throw new BookingError(413, 'MEDIA_TOO_LARGE');
  const reader = request.body?.getReader(); if (!reader) throw new BookingError(400, 'MEDIA_INVALID');
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    for (;;) {
      const next = await reader.read(); if (next.done) break;
      size += next.value.byteLength;
      if (size > maximum) { await reader.cancel(); throw new BookingError(413, 'MEDIA_TOO_LARGE'); }
      chunks.push(next.value);
    }
  } catch (error) { if (error instanceof BookingError) throw error; throw new BookingError(400, 'MEDIA_INVALID'); }
  let form: FormData;
  try { form = await new Response(Buffer.concat(chunks), { headers: { 'Content-Type': request.headers.get('content-type') ?? '' } }).formData(); }
  catch { throw new BookingError(400, 'MEDIA_INVALID'); }
  const keys = [...form.keys()];
  if (keys.length !== 4 || !exactKeys(Object.fromEntries(form.entries()), ['targetKind', 'targetId', 'requestId', 'file'])) throw new BookingError(400, 'MEDIA_INVALID');
  const targetKind = form.get('targetKind'); const targetId = form.get('targetId'); const requestId = form.get('requestId'); const file = form.get('file');
  if (!['store', 'menu', 'staff'].includes(String(targetKind)) || (targetKind === 'store' ? targetId !== '' : !uuid(targetId)) ||
    !uuid(requestId) || !(file instanceof File) || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size === 0) throw new BookingError(400, 'MEDIA_INVALID');
  if (file.size > MERCHANT_MEDIA_MAX_BYTES) throw new BookingError(413, 'MEDIA_TOO_LARGE');
  const bytes = Buffer.from(await file.arrayBuffer());
  return { targetKind: targetKind as MerchantMediaTarget, targetId: targetId === '' ? null : String(targetId).toLowerCase(), requestId: requestId.toLowerCase(), bytes };
}
export async function uploadMerchantMedia(client: SupabaseClient, request: Request): Promise<MerchantMedia> {
  return operation(client, true, async () => {
    const input = await readUpload(request);
    let processed: { data: Buffer; info: sharp.OutputInfo };
    try {
      const image = sharp(input.bytes, { limitInputPixels: 40_000_000, animated: false });
      const metadata = await image.metadata();
      if (!['jpeg', 'png', 'webp'].includes(metadata.format ?? '') || (metadata.pages ?? 1) > 1) throw new Error('Unsupported image');
      processed = await image.rotate().resize(2048, 2048, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 85 }).toBuffer({ resolveWithObject: true });
    } catch { throw new BookingError(400, 'MEDIA_INVALID'); }
    if (processed.data.byteLength > MERCHANT_MEDIA_MAX_BYTES) throw new BookingError(413, 'MEDIA_TOO_LARGE');
    const prepared = rawMedia(rpcData(await client.rpc('partner_media_prepare', {
      p_request_id: input.requestId, p_target_kind: input.targetKind, p_target_id: input.targetId,
      p_fingerprint: createHash('sha256').update(input.bytes).digest('hex'),
      p_width: processed.info.width, p_height: processed.info.height, p_byte_size: processed.data.byteLength,
    })));
    if (prepared.status === 'pending' || prepared.status === 'active') return project(prepared);
    if (prepared.status !== 'uploading') return unavailable();
    const upload = await client.storage.from(bucket).upload(prepared.objectPath, processed.data, { contentType: 'image/webp', upsert: false, cacheControl: '60' });
    if (upload.error && !['409', 'Duplicate'].includes(String((upload.error as { statusCode?: string }).statusCode)) && !/already exists|duplicate/i.test(upload.error.message)) return unavailable();
    return project(rawMedia(rpcData(await client.rpc('partner_media_finalize', { p_id: prepared.id }))));
  });
}
export async function deleteMerchantMedia(client: SupabaseClient, id: string, expectedUpdatedAt: string): Promise<void> {
  return operation(client, true, async () => {
    const removed = rawMedia(rpcData(await client.rpc('partner_media_delete', { p_id: id.toLowerCase(), p_expected_updated_at: expectedUpdatedAt })));
    if (removed.id.toLowerCase() !== id.toLowerCase() || removed.status !== 'deleted') return unavailable();
    const result = await client.storage.from(bucket).remove([removed.objectPath]);
    if (result.error) return unavailable();
  });
}
async function download(client: SupabaseClient, raw: RawMedia, privateImage: boolean): Promise<Response> {
  const result = await client.storage.from(bucket).download(raw.objectPath);
  if (result.error || !result.data) return unavailable();
  return new Response(result.data, { headers: { 'Content-Type': 'image/webp', 'X-Content-Type-Options': 'nosniff',
    'Cache-Control': privateImage ? 'private, no-store' : 'public, max-age=60', ...(privateImage ? { Vary: 'Cookie' } : {}) } });
}
export async function getMerchantMediaContent(client: SupabaseClient, id: string): Promise<Response> {
  return operation(client, false, async () => {
    const media = rawMedia(rpcData(await client.rpc('partner_media_get', { p_id: id.toLowerCase() })));
    if (media.id.toLowerCase() !== id.toLowerCase()) return unavailable();
    return download(client, media, true);
  });
}
export async function getPublicMerchantMediaContent(client: SupabaseClient, placeId: string, id: string): Promise<Response> {
  const media = list(rpcData(await client.rpc('public_merchant_media', { p_place_id: placeId, p_id: id.toLowerCase() })));
  if (media.length === 0) throw new BookingError(404, 'MEDIA_NOT_FOUND');
  if (media.length !== 1 || media[0].id.toLowerCase() !== id.toLowerCase() || media[0].status !== 'active') return unavailable();
  return download(client, media[0], false);
}
