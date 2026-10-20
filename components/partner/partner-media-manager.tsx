'use client';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ImagePlus, RotateCw, Trash2, Upload } from 'lucide-react';
import type { MerchantMedia, MerchantMediaTarget } from '@/lib/partner/media-contracts';
import { useDialogFocus } from '@/components/ui/use-dialog-focus';
import { useVisibleBookingRefresh } from '@/components/booking/use-booking-resource';
import { mediaErrorMessage, mediaUploadScope, pendingMediaUpload, retainMediaUpload, mediaUploadAttempt, mediaUploadBody, partnerMediaUrl, requestPartnerMedia, targetMediaList, targetMediaUpload, validMediaTarget, validateMediaFile, type MediaUploadAttempt } from './partner-media-state';
import styles from './partner-media-manager.module.css';

export type PartnerMediaManagerProps = { targetKind: MerchantMediaTarget; targetId: string | null; scope: string; disabled?: boolean; onItemsChange?: (media: MerchantMedia[]) => void };
export function PartnerMediaManager(props: PartnerMediaManagerProps) {
  return <MediaManagerContent key={`${props.scope}:${props.targetKind}:${props.targetId ?? ''}`} {...props} />;
}
function MediaManagerContent({ targetKind, targetId, scope, disabled = false, onItemsChange }: PartnerMediaManagerProps) {
  const target = { targetKind, targetId };
  const eligible = !!scope && validMediaTarget(target);
  const url = eligible ? partnerMediaUrl(target) : null;
  const draftScope = mediaUploadScope(scope, target);
  const inputId = useId();
  const dialogTitle = useId();
  const [media, setMedia] = useState<MerchantMedia[]>([]);
  const [confirmed, setConfirmed] = useState(false);
  const onItemsChangeRef = useRef(onItemsChange);
  useEffect(() => { onItemsChangeRef.current = onItemsChange; }, [onItemsChange]);
  useEffect(() => { if (confirmed) onItemsChangeRef.current?.(media); }, [media, confirmed]);
  const [loading, setLoading] = useState(eligible);
  const [loadError, setLoadError] = useState('');
  const [file, setFile] = useState<File | null>(() => pendingMediaUpload(draftScope)?.file ?? null);
  const [pending, setPending] = useState<MediaUploadAttempt | null>(() => pendingMediaUpload(draftScope));
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [deleting, setDeleting] = useState<MerchantMedia | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const alive = useRef(true);
  const busy = useRef(false);
  const listRequest = useRef<AbortController | null>(null);
  const mutationRequest = useRef<AbortController | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const keepButton = useRef<HTMLButtonElement>(null);
  const closeDelete = () => { if (!deleteBusy) { setDeleting(null); setDeleteError(''); } };
  const dialog = useDialogFocus<HTMLDivElement>(!!deleting, closeDelete, keepButton);
  useEffect(() => { alive.current = true; return () => { alive.current = false; listRequest.current?.abort(); mutationRequest.current?.abort(); }; }, []);
  const refresh = useCallback(async () => {
    if (!url || busy.current) return;
    listRequest.current?.abort();
    const controller = new AbortController(); listRequest.current = controller;
    setLoading(true);
    try {
      const data = await requestPartnerMedia(url, { signal: controller.signal });
      if (!targetMediaList(data, { targetKind, targetId })) throw new Error('NETWORK_ERROR');
      if (!alive.current || listRequest.current !== controller) return;
      setMedia(data.media); setConfirmed(true); setLoadError('');
    } catch (reason) {
      if (alive.current && listRequest.current === controller && !controller.signal.aborted) setLoadError(reason instanceof Error ? reason.message : 'NETWORK_ERROR');
    } finally { if (alive.current && listRequest.current === controller) setLoading(false); }
  }, [targetId, targetKind, url]);
  useEffect(() => { void refresh(); }, [refresh]);
  useVisibleBookingRefresh(refresh, !!url);

  async function upload() {
    if (disabled || !eligible || busy.current || loadError) return;
    let attempt: MediaUploadAttempt;
    try { attempt = mediaUploadAttempt(target, file, pending, () => crypto.randomUUID()); }
    catch (reason) { setUploadError(reason instanceof Error ? reason.message : 'MEDIA_INVALID'); return; }
    busy.current = true; listRequest.current?.abort(); listRequest.current = null;
    const controller = new AbortController(); mutationRequest.current = controller;
    retainMediaUpload(draftScope, attempt); setPending(attempt); setUploading(true); setUploadError(''); setFeedback(''); setLoading(false);
    try {
      const data = await requestPartnerMedia('/api/partner/operations/media', { method: 'POST', body: mediaUploadBody(attempt), signal: controller.signal });
      if (!targetMediaUpload(data, target)) throw new Error('NETWORK_ERROR');
      if (!alive.current) return;
      setMedia(current => [...current.filter(item => item.id !== data.media.id), data.media]);
      retainMediaUpload(draftScope, null); setConfirmed(true); setPending(null); setFile(null); if (input.current) input.current.value = '';
      setFeedback(data.media.status === 'pending' ? '사진을 접수했습니다. 검토가 끝나면 고객에게 공개됩니다.' : '사진을 저장했습니다. 고객 화면에 반영됩니다.');
    } catch (reason) {
      if (!alive.current) return;
      const code = reason instanceof Error ? reason.message : 'NETWORK_ERROR'; setUploadError(code);
      if (['MEDIA_INVALID', 'MEDIA_TOO_LARGE', 'MEDIA_LIMIT_EXCEEDED', 'MEDIA_NOT_FOUND'].includes(code)) { retainMediaUpload(draftScope, null); setPending(null); }
    } finally { if (alive.current) { busy.current = false; setUploading(false); void refresh(); } }
  }
  async function remove() {
    if (!deleting || disabled || busy.current) return;
    busy.current = true; listRequest.current?.abort(); listRequest.current = null;
    const controller = new AbortController(); mutationRequest.current = controller;
    setDeleteBusy(true); setDeleteError(''); setLoading(false); setFeedback('');
    try {
      const data = await requestPartnerMedia(`/api/partner/operations/media/${encodeURIComponent(deleting.id)}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ expectedUpdatedAt: deleting.updatedAt }), signal: controller.signal });
      if (!data || typeof data !== 'object' || !('deleted' in data) || data.deleted !== true) throw new Error('NETWORK_ERROR');
      if (!alive.current) return;
      setMedia(current => current.filter(item => item.id !== deleting.id)); setDeleting(null); setFeedback('사진을 삭제했습니다.');
    } catch (reason) { if (alive.current) setDeleteError(reason instanceof Error ? reason.message : 'NETWORK_ERROR'); }
    finally { if (alive.current) { busy.current = false; setDeleteBusy(false); void refresh(); } }
  }
  return <section className={styles.manager} lang="ko" aria-label="사진 관리">
    <div className={styles.heading}><h3><ImagePlus aria-hidden="true" />사진</h3>{eligible && <button type="button" className={styles.refresh} disabled={loading || uploading || deleteBusy} onClick={() => void refresh()} aria-label="사진 새로고침"><RotateCw aria-hidden="true" /></button>}</div>
    <p className={styles.help}>{targetKind === 'store' ? '매장 사진은 검토 후 공개됩니다. 검토 중인 사진은 고객에게 보이지 않습니다.' : '저장한 사진은 공개 중인 메뉴·담당자에 바로 반영됩니다.'}</p>
    {!eligible ? <p className={styles.notice}>먼저 정보를 저장한 뒤 사진을 추가해 주세요.</p> : <>
      {loading && !media.length && <p className={styles.notice} role="status">사진을 불러오는 중…</p>}
      {loadError && <div className={styles.error} role="alert"><span>사진을 불러오지 못했습니다. {mediaErrorMessage(loadError)}</span><button type="button" onClick={() => void refresh()}>새로고침</button></div>}
      {!!media.length && <ul className={styles.grid}>{media.map(item => <li key={item.id} className={styles.card}>
        <MediaImage media={item} />
        <div className={styles.caption}><span className={styles.badge} data-pending={item.status === 'pending'}>{item.status === 'pending' ? '검토 대기 · 고객 비공개' : '공개'}</span><button type="button" className={styles.remove} disabled={disabled || uploading || deleteBusy || !!loadError || !!pending} aria-label="이 사진 삭제" onClick={() => { setDeleteError(''); setDeleting(item); }}><Trash2 aria-hidden="true" /></button></div>
      </li>)}</ul>}
      {!loading && !loadError && !media.length && <p className={styles.empty}>등록한 사진이 없습니다.</p>}
      <div className={styles.upload}>
        <label htmlFor={inputId}>사진 추가 <span>JPEG · PNG · WebP, 최대 5MB</span></label>
        <input ref={input} id={inputId} type="file" accept="image/jpeg,image/png,image/webp" disabled={disabled || uploading || !!pending || !!loadError || deleteBusy} onChange={event => { const next = event.target.files?.[0] ?? null; setFile(next); setUploadError(next ? validateMediaFile(next) ?? '' : ''); setFeedback(''); }} />
        {pending && <p className={styles.notice}>{pending.file.name}</p>}
        {pending && !uploading && <p className={styles.notice}>전송한 파일과 요청을 유지하고 있습니다. 다시 시도하면 중복 업로드 없이 결과를 확인합니다.</p>}
        <button type="button" className={styles.primary} disabled={disabled || uploading || deleteBusy || !!loadError || (!pending && (!file || !!validateMediaFile(file)))} onClick={() => void upload()}><Upload aria-hidden="true" />{uploading ? '사진 저장 중…' : pending ? '같은 사진 다시 시도' : '사진 저장'}</button>
        {disabled && <p className={styles.notice}>현재는 사진을 확인할 수만 있습니다.</p>}
        {uploadError && <p className={styles.error} role="alert">{mediaErrorMessage(uploadError)}</p>}
        {feedback && <p className={styles.notice} role="status">{feedback}</p>}
      </div>
    </>}
    {deleting && createPortal(<div className={styles.backdrop}><div ref={dialog} className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby={dialogTitle} tabIndex={-1}>
      <h3 id={dialogTitle}>이 사진을 삭제할까요?</h3><p>{deleting.status === 'pending' ? '검토 요청에서도 사진이 삭제됩니다.' : '고객 화면에서도 사진이 삭제됩니다.'}</p><MediaImage media={deleting} />
      {deleteError && <p className={styles.error} role="alert">{mediaErrorMessage(deleteError)}</p>}
      <div className={styles.dialogActions}><button ref={keepButton} type="button" disabled={deleteBusy} onClick={closeDelete}>유지하기</button><button type="button" disabled={disabled || deleteBusy || deleteError === 'BOOKING_CONFLICT' || deleteError === 'MEDIA_NOT_FOUND'} onClick={() => void remove()}>{deleteBusy ? '삭제 중…' : '사진 삭제'}</button></div>
    </div></div>, document.body)}
  </section>;
}
function MediaImage({ media }: { media: MerchantMedia }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <div className={styles.imageFallback}>사진을 표시할 수 없습니다.</div>;
  // The server decodes and re-encodes uploads before issuing this same-origin URL.
  // eslint-disable-next-line @next/next/no-img-element
  return <img className={styles.image} src={media.url} width={media.width} height={media.height} alt={media.targetKind === 'staff' ? '등록한 담당자 사진' : media.targetKind === 'menu' ? '등록한 메뉴 사진' : '등록한 매장 사진'} onError={() => setFailed(true)} />;
}
