import { merchantMedia, merchantMediaList, MERCHANT_MEDIA_MAX_BYTES, type MerchantMedia, type MerchantMediaTarget } from '@/lib/partner/media-contracts';
import { uuid } from '@/lib/partner/contracts';

export type MediaTarget = { targetKind: MerchantMediaTarget; targetId: string | null };
export type MediaUploadAttempt = MediaTarget & { requestId: string; file: File };
export function validMediaTarget(target: MediaTarget): boolean {
  return target.targetKind === 'store' ? target.targetId === null : uuid(target.targetId);
}
export function partnerMediaUrl(target: MediaTarget): string {
  if (!validMediaTarget(target)) throw new Error('MEDIA_INVALID');
  const query = new URLSearchParams({ targetKind: target.targetKind });
  if (target.targetId) query.set('targetId', target.targetId);
  return `/api/partner/operations/media?${query}`;
}
export function mediaMatchesTarget(media: MerchantMedia, target: MediaTarget) {
  return media.targetKind === target.targetKind && media.targetId === target.targetId;
}
export function targetMediaList(value: unknown, target: MediaTarget): value is { media: MerchantMedia[] } {
  return !!value && typeof value === 'object' && 'media' in value && merchantMediaList(value.media) && value.media.every(media => mediaMatchesTarget(media, target));
}
export function targetMediaUpload(value: unknown, target: MediaTarget): value is { media: MerchantMedia } {
  return !!value && typeof value === 'object' && 'media' in value && merchantMedia(value.media) && mediaMatchesTarget(value.media, target);
}
export function validateMediaFile(file: File): string | null {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size === 0) return 'MEDIA_INVALID';
  return file.size > MERCHANT_MEDIA_MAX_BYTES ? 'MEDIA_TOO_LARGE' : null;
}
/** A lost response keeps the exact file, target and request ID for an explicit retry. */
export function mediaUploadAttempt(target: MediaTarget, file: File | null, pending: MediaUploadAttempt | null, createId: () => string): MediaUploadAttempt {
  if (pending) {
    if (pending.targetKind !== target.targetKind || pending.targetId !== target.targetId) throw new Error('MEDIA_INVALID');
    return pending;
  }
  if (!validMediaTarget(target) || !file) throw new Error('MEDIA_INVALID');
  const invalid = validateMediaFile(file);
  if (invalid) throw new Error(invalid);
  return { ...target, file, requestId: createId() };
}
export function mediaUploadBody(attempt: MediaUploadAttempt): FormData {
  const form = new FormData();
  form.set('targetKind', attempt.targetKind); form.set('targetId', attempt.targetId ?? '');
  form.set('requestId', attempt.requestId); form.set('file', attempt.file);
  return form;
}
export function mediaErrorMessage(code: string): string {
  if (code === 'MEDIA_INVALID') return 'JPEG, PNG, WebP 형식의 이미지 파일을 선택해 주세요.';
  if (code === 'MEDIA_TOO_LARGE') return '사진은 5MB 이하로 올려 주세요.';
  if (code === 'MEDIA_LIMIT_EXCEEDED') return '매장 사진은 검토 대기를 포함해 최대 30장까지 등록할 수 있습니다. 기존 사진을 삭제한 뒤 다시 시도해 주세요.';
  if (code === 'MEDIA_UPLOAD_INCOMPLETE') return '사진 저장이 끝나지 않았습니다. 같은 사진으로 다시 시도해 주세요.';
  if (code === 'MEDIA_NOT_FOUND') return '사진을 찾을 수 없습니다. 목록을 새로고침해 주세요.';
  if (code === 'BOOKING_CONFLICT') return '사진 정보가 변경되었습니다. 새로고침 후 다시 확인해 주세요.';
  if (code === 'AUTH_REQUIRED') return '사진을 관리하려면 다시 로그인해 주세요.';
  if (code === 'PARTNER_READ_ONLY' || code === 'PARTNER_FORBIDDEN') return '현재 계정에서는 사진을 변경할 수 없습니다.';
  return '처리 결과를 확인하지 못했습니다. 같은 요청으로 다시 시도해 주세요.';
}
export async function requestPartnerMedia(url: string, init?: RequestInit, transport: typeof fetch = fetch): Promise<unknown> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  init?.signal?.addEventListener('abort', abort, { once: true });
  if (init?.signal?.aborted) abort();
  const timeout = setTimeout(abort, 45000);
  try {
    const response = await transport(url, { ...init, signal: controller.signal, cache: 'no-store' });
    const data: unknown = await response.json();
    if (!response.ok) {
      const code = data && typeof data === 'object' && 'code' in data && typeof data.code === 'string' ? data.code : 'NETWORK_ERROR';
      throw new Error(code);
    }
    return data;
  } finally { clearTimeout(timeout); init?.signal?.removeEventListener('abort', abort); }
}

// File objects stay in memory, scoped to the signed-in account and exact target.
// Reopening an editor resumes the original uncertain upload without persisting private image bytes on disk.
const pendingUploads = new Map<string, MediaUploadAttempt>();
let unloadGuardInstalled = false;
const guardPendingUpload = (event: BeforeUnloadEvent) => {
  if (!pendingUploads.size) return;
  event.preventDefault(); event.returnValue = '';
};
export function mediaUploadScope(scope: string, target: MediaTarget): string {
  return JSON.stringify([scope, target.targetKind, target.targetId]);
}
export function pendingMediaUpload(key: string): MediaUploadAttempt | null { return pendingUploads.get(key) ?? null; }
export function retainMediaUpload(key: string, attempt: MediaUploadAttempt | null) {
  if (attempt) pendingUploads.set(key, attempt); else pendingUploads.delete(key);
  if (typeof window === 'undefined') return;
  if (pendingUploads.size && !unloadGuardInstalled) { window.addEventListener('beforeunload', guardPendingUpload); unloadGuardInstalled = true; }
  else if (!pendingUploads.size && unloadGuardInstalled) { window.removeEventListener('beforeunload', guardPendingUpload); unloadGuardInstalled = false; }
}
