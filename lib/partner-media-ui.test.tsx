import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { load } from 'cheerio';
import { PartnerMediaManager } from '@/components/partner/partner-media-manager';
import { mediaUploadAttempt, mediaUploadBody, mediaUploadScope, partnerMediaUrl, pendingMediaUpload, requestPartnerMedia, retainMediaUpload, targetMediaList, targetMediaUpload, validateMediaFile } from '@/components/partner/partner-media-state';
import type { MerchantMedia } from './partner/media-contracts';

const id = '12345678-1234-4123-8123-123456789012';
const targetId = '22345678-1234-4123-8123-123456789012';
const requestId = '32345678-1234-4123-8123-123456789012';
const target = { targetKind: 'menu' as const, targetId };
const fixture: MerchantMedia = { id, ...target, status: 'active', url: `/api/partner/operations/media/${id}/content`, width: 80, height: 120, createdAt: '2026-10-20T01:00:00Z', updatedAt: '2026-10-20T01:00:00Z' };
const file = () => new File(['local test bytes; actual decoder runs on the server'], 'local-test.webp', { type: 'image/webp' });
afterEach(() => vi.useRealTimers());

describe('actual merchant photo UI requests', () => {
  it('uses store null and explicit real menu/staff IDs without a fabricated target', () => {
    expect(partnerMediaUrl({ targetKind: 'store', targetId: null })).toBe('/api/partner/operations/media?targetKind=store');
    expect(partnerMediaUrl(target)).toBe(`/api/partner/operations/media?targetKind=menu&targetId=${targetId}`);
    expect(() => partnerMediaUrl({ targetKind: 'staff', targetId: null })).toThrow('MEDIA_INVALID');
    expect(() => partnerMediaUrl({ targetKind: 'store', targetId })).toThrow('MEDIA_INVALID');
  });
  it('rejects a valid media payload for a foreign target or an unvalidated external URL', () => {
    expect(targetMediaList({ media: [fixture] }, target)).toBe(true);
    expect(targetMediaUpload({ media: fixture }, target)).toBe(true);
    expect(targetMediaUpload({ media: { ...fixture, targetId: id } }, target)).toBe(false);
    expect(targetMediaList({ media: [{ ...fixture, targetKind: 'staff' }] }, target)).toBe(false);
    expect(targetMediaList({ media: [{ ...fixture, url: 'https://foreign.example/photo.jpg' }] }, target)).toBe(false);
  });
  it('rejects unsupported, empty and oversized input before allocating an upload key', () => {
    expect(validateMediaFile(new File(['<svg/>'], 'test.svg', { type: 'image/svg+xml' }))).toBe('MEDIA_INVALID');
    expect(validateMediaFile(new File([], 'test.png', { type: 'image/png' }))).toBe('MEDIA_INVALID');
    expect(validateMediaFile(new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'big.png', { type: 'image/png' }))).toBe('MEDIA_TOO_LARGE');
    const createId = vi.fn(() => requestId);
    expect(() => mediaUploadAttempt(target, null, null, createId)).toThrow('MEDIA_INVALID');
    expect(createId).not.toHaveBeenCalled();
  });
  it('retries a lost upload response with the original File, target and request ID', async () => {
    const createId = vi.fn(() => requestId);
    const original = mediaUploadAttempt(target, file(), null, createId);
    const retry = mediaUploadAttempt(target, new File(['different'], 'different.png', { type: 'image/png' }), original, createId);
    expect(retry).toBe(original); expect(createId).toHaveBeenCalledTimes(1);
    const transport = vi.fn().mockRejectedValueOnce(new TypeError('Network failed')).mockResolvedValueOnce(Response.json({ media: fixture }, { status: 201 }));
    await expect(requestPartnerMedia('/api/partner/operations/media', { method: 'POST', body: mediaUploadBody(original) }, transport)).rejects.toThrow('Network failed');
    await expect(requestPartnerMedia('/api/partner/operations/media', { method: 'POST', body: mediaUploadBody(retry) }, transport)).resolves.toEqual({ media: fixture });
    for (const [, init] of transport.mock.calls) {
      expect(init.body.get('requestId')).toBe(requestId);
      expect(init.body.get('file')).toBe(original.file);
      expect(init.headers).toBeUndefined(); // Browser supplies the multipart boundary.
    }
  });
  it('retains an uncertain file across editor remounts without exposing it to another account or target', () => {
    const key = mediaUploadScope('customer-a:merchant-a', target);
    const attempt = mediaUploadAttempt(target, file(), null, () => requestId);
    retainMediaUpload(key, attempt);
    expect(pendingMediaUpload(mediaUploadScope('customer-a:merchant-a', target))).toBe(attempt);
    expect(pendingMediaUpload(mediaUploadScope('customer-b:merchant-a', target))).toBeNull();
    expect(pendingMediaUpload(mediaUploadScope('customer-a:merchant-a', { ...target, targetId: id }))).toBeNull();
    expect(() => mediaUploadAttempt({ ...target, targetId: id }, null, attempt, () => requestId)).toThrow('MEDIA_INVALID');
    retainMediaUpload(key, null); expect(pendingMediaUpload(key)).toBeNull();
  });
  it('encodes store uploads with an empty target ID and preserves the deletion timestamp', async () => {
    const body = mediaUploadBody(mediaUploadAttempt({ targetKind: 'store', targetId: null }, file(), null, () => requestId));
    expect(body.get('targetId')).toBe(''); expect([...body.keys()].sort()).toEqual(['file', 'requestId', 'targetId', 'targetKind']);
    const transport = vi.fn<typeof fetch>(async () => Response.json({ deleted: true }));
    await requestPartnerMedia(`/api/partner/operations/media/${id}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ expectedUpdatedAt: fixture.updatedAt }) }, transport);
    expect(JSON.parse(transport.mock.calls[0][1]?.body as string)).toEqual({ expectedUpdatedAt: fixture.updatedAt });
  });
  it('uses API error codes, so a version conflict is not mistaken for a retryable unknown result', async () => {
    const transport = vi.fn(async () => Response.json({ code: 'BOOKING_CONFLICT', error: '사진 정보가 변경되었습니다.' }, { status: 409 }));
    await expect(requestPartnerMedia('/api/partner/operations/media', undefined, transport)).rejects.toThrow('BOOKING_CONFLICT');
  });
  it('bounds a hung upload without automatically resubmitting it', async () => {
    vi.useFakeTimers();
    const transport = vi.fn((_url, init) => new Promise<Response>((_resolve, reject) => init?.signal?.addEventListener('abort', () => reject(new Error('aborted')), { once: true }))) as typeof fetch;
    const pending = requestPartnerMedia('/api/partner/operations/media', { method: 'POST', body: mediaUploadBody(mediaUploadAttempt(target, file(), null, () => requestId)) }, transport);
    const rejected = expect(pending).rejects.toThrow('aborted');
    await vi.advanceTimersByTimeAsync(45000); await rejected;
    expect(transport).toHaveBeenCalledTimes(1);
  });
  it('does not show fake previews or enable uploads for an unsaved target', () => {
    const html = load(renderToStaticMarkup(<PartnerMediaManager scope="user:merchant" targetKind="staff" targetId={null} />));
    expect(html('img').length).toBe(0); expect(html('input[type=file]').length).toBe(0);
    expect(html.text()).toContain('먼저 정보를 저장');
  });
  it('can mount inside an editor form and keeps read-only uploads disabled', () => {
    const onItemsChange = vi.fn();
    const html = load(renderToStaticMarkup(<PartnerMediaManager scope="user:merchant" targetKind="store" targetId={null} disabled onItemsChange={onItemsChange} />));
    expect(html('form').length).toBe(0); expect(html('input[type=file]').attr('disabled')).toBeDefined();
    expect(html('input[type=file]').attr('accept')).toBe('image/jpeg,image/png,image/webp');
    expect(html.text()).toContain('검토 중인 사진은 고객에게 보이지 않습니다.');
    expect(onItemsChange).not.toHaveBeenCalled();
  });
});
