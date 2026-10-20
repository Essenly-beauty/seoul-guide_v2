import { exactKeys, integer, record, uuid } from './contracts';
import { bookingTimestamp } from '@/lib/booking/contracts';

export type MerchantMediaTarget = 'store' | 'menu' | 'staff';
export type MerchantMedia = {
  id: string; targetKind: MerchantMediaTarget; targetId: string | null; status: 'pending' | 'active';
  url: string; width: number; height: number; createdAt: string; updatedAt: string;
};
export type MerchantMediaQuery = { targetKind?: MerchantMediaTarget; targetId?: string | null };
export const MERCHANT_MEDIA_MAX_BYTES = 5 * 1024 * 1024;
export function merchantMedia(value: unknown): value is MerchantMedia {
  return record(value) && exactKeys(value, ['id', 'targetKind', 'targetId', 'status', 'url', 'width', 'height', 'createdAt', 'updatedAt']) &&
    uuid(value.id) && ['store', 'menu', 'staff'].includes(String(value.targetKind)) &&
    (value.targetKind === 'store' ? value.targetId === null : uuid(value.targetId)) &&
    ['pending', 'active'].includes(String(value.status)) && typeof value.url === 'string' &&
    /^\/api\/(?:partner\/operations\/media\/[0-9a-f-]{36}\/content|places\/[a-zA-Z0-9_-]{1,200}\/media\/[0-9a-f-]{36})$/.test(value.url) &&
    integer(value.width, 1) && value.width <= 2048 && integer(value.height, 1) && value.height <= 2048 &&
    bookingTimestamp(value.createdAt) && bookingTimestamp(value.updatedAt);
}
export function merchantMediaList(value: unknown): value is MerchantMedia[] {
  if (!Array.isArray(value) || value.length > 10000) return false;
  for (let index = 0; index < value.length; index += 1) if (!Object.hasOwn(value, index) || !merchantMedia(value[index])) return false;
  return new Set(value.map((item) => item.id)).size === value.length;
}
export function parseMerchantMediaQuery(params: URLSearchParams): MerchantMediaQuery | null {
  if (params.size === 0) return {};
  const targetKind = params.get('targetKind'); const targetId = params.get('targetId');
  if (targetKind === 'store' && params.size === 1) return { targetKind, targetId: null };
  if ((targetKind === 'menu' || targetKind === 'staff') && params.size === 2 && uuid(targetId)) return { targetKind, targetId: targetId.toLowerCase() };
  return null;
}
