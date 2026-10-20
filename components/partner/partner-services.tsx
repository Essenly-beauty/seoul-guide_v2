'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuthUser } from '@/lib/auth/use-auth';
import { menuReadiness, type Visibility } from '@/lib/partner/catalog';
import type { Category, Menu, PartnerSnapshot } from '@/lib/partner/contracts';
import { categoryDraft, categoryFormValues, menuDraft, menuFormValues, type CategoryDraft, type MenuDraft } from '@/lib/partner/form-values';
import { usePartner, type PartnerEditor } from './partner-provider';
import { DraftRecoveryNotice, Field, FormActions, usePartnerDraft } from './partner-form';
import styles from './partner.module.css';
import editorStyles from './partner-editors.module.css';
import { usePartnerStaffDirectory } from './use-partner-staff-directory';
import { PartnerMediaManager } from './partner-media-manager';

export const visibilityLabels: Record<Visibility, string> = { draft: '초안', visible: '공개', hidden: '숨김', archived: '보관' };
function VisibilityField({ value, onChange }: { value: Visibility; onChange: (value: Visibility) => void }) {
  return <Field label="표시 상태"><select name="visibility" value={value} onChange={(event) => onChange(event.target.value as Visibility)}>{Object.entries(visibilityLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></Field>;
}
export function CategoryFields({ value, onChange, disabled }: { value: CategoryDraft; onChange: (value: CategoryDraft) => void; disabled: boolean }) {
  return <fieldset className={styles.fields} disabled={disabled}><legend>카테고리 정보</legend>
    <div className={styles.twoColumns}>
      <Field label="카테고리명 (한국어)"><input name="nameKo" maxLength={120} value={value.nameKo} onChange={(event) => onChange({ ...value, nameKo: event.target.value })} /></Field>
      <Field label="카테고리명 (영어)"><input name="nameEn" lang="en" maxLength={120} value={value.nameEn} onChange={(event) => onChange({ ...value, nameEn: event.target.value })} /></Field>
    </div>
    <div className={styles.twoColumns}><VisibilityField value={value.visibility} onChange={(visibility) => onChange({ ...value, visibility })} /><Field label="표시 순서" hint="0 이상의 정수. 작은 숫자가 먼저 표시됩니다."><input name="sortOrder" inputMode="numeric" value={value.sortOrder} onChange={(event) => onChange({ ...value, sortOrder: event.target.value })} /></Field></div>
    <p className={styles.hint}>초안은 이름을 비워 두고 저장할 수 있습니다. 공개 준비에는 한국어·영어 이름이 필요합니다. 사용하지 않는 카테고리는 숨김 또는 보관으로 변경해 주세요.</p>
  </fieldset>;
}
export function MenuPublicationBadge({ menu, categories, paymentMode }: { menu: Menu; categories: Category[]; paymentMode?: 'pay_at_venue' }) {
  const needsPreparation = menuReadiness(menu, categories, { paymentMode }).length > 0;
  return <Badge tone={needsPreparation ? 'warning' : 'success'}>{!paymentMode && menu.depositKrw === null ? '운영자 승인 대기' : needsPreparation ? '공개 조건 확인 필요' : paymentMode === 'pay_at_venue' ? '공개 조건 충족 · 현장 결제' : '공개 조건 충족'}</Badge>;
}
export function MenuFields({ value, onChange, categories, depositKrw, disabled, paymentMode }: { value: MenuDraft; onChange: (value: MenuDraft) => void; categories: Category[]; depositKrw: number | null; disabled: boolean; paymentMode?: 'pay_at_venue' }) {
  return <fieldset className={styles.fields} disabled={disabled}><legend>메뉴 정보</legend>
    <Field label="카테고리"><select name="categoryId" value={value.categoryId} onChange={(event) => onChange({ ...value, categoryId: event.target.value })}><option value="">카테고리 선택</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.nameKo || category.nameEn || '이름 없는 카테고리'} · {visibilityLabels[category.visibility]}</option>)}</select></Field>
    <div className={styles.twoColumns}><Field label="메뉴명 (한국어)"><input name="nameKo" maxLength={120} value={value.nameKo} onChange={(event) => onChange({ ...value, nameKo: event.target.value })} /></Field><Field label="메뉴명 (영어)"><input name="nameEn" lang="en" maxLength={120} value={value.nameEn} onChange={(event) => onChange({ ...value, nameEn: event.target.value })} /></Field></div>
    <Field label="메뉴 설명 (한국어)"><textarea name="descriptionKo" maxLength={4000} value={value.descriptionKo} onChange={(event) => onChange({ ...value, descriptionKo: event.target.value })} /></Field>
    <Field label="메뉴 설명 (영어)"><textarea name="descriptionEn" lang="en" maxLength={4000} value={value.descriptionEn} onChange={(event) => onChange({ ...value, descriptionEn: event.target.value })} /></Field>
    <Field label="총 금액 (원)" hint={paymentMode === 'pay_at_venue' ? 'KRW · 고객이 매장에서 결제할 전체 금액입니다. 미설정은 빈칸으로 두세요.' : 'KRW · 승인된 예약금을 포함한 전체 금액입니다. 미설정은 빈칸으로 두세요.'}><input name="priceKrw" inputMode="numeric" value={value.priceKrw} onChange={(event) => onChange({ ...value, priceKrw: event.target.value })} /></Field>
    {paymentMode === 'pay_at_venue' ? <dl className={styles.readonlyValue}><dt>결제 방식</dt><dd>현장 결제 · 고객은 총 금액을 방문 시 결제합니다.</dd></dl> : <dl className={styles.readonlyValue}><dt>승인된 예약금 · 읽기 전용</dt><dd>{depositKrw === null ? '운영자 승인 대기' : `${depositKrw.toLocaleString('ko-KR')}원`}</dd></dl>}
    <div className={styles.twoColumns}><Field label="시술 시간 (분)" hint="1 이상의 정수. 미설정은 빈칸으로 두세요."><input name="durationMinutes" inputMode="numeric" value={value.durationMinutes} onChange={(event) => onChange({ ...value, durationMinutes: event.target.value })} /></Field><Field label="정리 시간 (분)" hint="0 이상의 정수. 시술 뒤 정리할 시간입니다."><input name="cleanupMinutes" inputMode="numeric" value={value.cleanupMinutes} onChange={(event) => onChange({ ...value, cleanupMinutes: event.target.value })} /></Field></div>
    <p className={styles.hint}>시술 시간과 정리 시간을 합한 구간이 매장의 공통 운영시간을 차지합니다. 메뉴별 동시 수용 인원 설정은 아닙니다.</p>
    <div className={styles.twoColumns}><VisibilityField value={value.visibility} onChange={(visibility) => onChange({ ...value, visibility })} /><Field label="표시 순서" hint="0 이상의 정수. 작은 숫자가 먼저 표시됩니다."><input name="sortOrder" inputMode="numeric" value={value.sortOrder} onChange={(event) => onChange({ ...value, sortOrder: event.target.value })} /></Field></div>
    <p className={styles.hint}>초안은 이름, 설명, 금액과 시술 시간을 비워 둘 수 있습니다. 공개에는 한국어·영어 이름과 설명, 총 금액, 시술 시간, {paymentMode === 'pay_at_venue' ? '' : '승인된 예약금과 '}공개 상태의 카테고리가 필요합니다. 영어 내용은 직접 입력해 주세요.</p>
  </fieldset>;
}

function CategoryEditor({ id, snapshot }: { id: string; snapshot: PartnerSnapshot }) {
  const from = (current: PartnerSnapshot) => { const item = current.categories.find((category) => category.id === id); return { values: categoryDraft(item), updatedAt: item?.updatedAt ?? null }; };
  const form = usePartnerDraft(`category:${id}`, from(snapshot));
  const disabled = snapshot.readOnly || form.locked;
  return <form className={styles.editor} onSubmit={(event) => {
    event.preventDefault();
    const parsed = categoryFormValues(form.draft.values);
    if (!parsed.ok) { form.invalid(parsed.error); return; }
    const version = form.draft.updatedAt ? { mode: 'update' as const, expectedUpdatedAt: form.draft.updatedAt } : { mode: 'create' as const };
    void form.submit({ kind: 'category', id, ...version, values: parsed.values }, from);
  }}>
    <h2 tabIndex={-1}>{form.draft.updatedAt ? '카테고리 편집' : '카테고리 추가'}</h2>
    <DraftRecoveryNotice restored={form.restored} />
    <CategoryFields value={form.draft.values} onChange={(values) => form.setDraft({ ...form.draft, values })} disabled={disabled} />
    <FormActions state={form.state} disabled={disabled} dirty={form.dirty || !form.draft.updatedAt} onReload={() => void form.reload(from)} />
  </form>;
}
function MenuEditor({ id, snapshot }: { id: string; snapshot: PartnerSnapshot }) {
  const { user } = useAuthUser();
  const { stale } = usePartner();
  const from = (current: PartnerSnapshot) => { const item = current.menus.find((menu) => menu.id === id); return { values: menuDraft(item), updatedAt: item?.updatedAt ?? null }; };
  const form = usePartnerDraft(`menu:${id}`, from(snapshot));
  const depositKrw = snapshot.menus.find((menu) => menu.id === id)?.depositKrw ?? null;
  const disabled = snapshot.readOnly || form.locked;
  return <form className={styles.editor} onSubmit={(event) => {
    event.preventDefault();
    const parsed = menuFormValues(form.draft.values, snapshot.merchant.id, snapshot.categories, depositKrw);
    if (!parsed.ok) { form.invalid(parsed.error); return; }
    const version = form.draft.updatedAt ? { mode: 'update' as const, expectedUpdatedAt: form.draft.updatedAt } : { mode: 'create' as const };
    void form.submit({ kind: 'menu', id, ...version, values: parsed.values }, from);
  }}>
    <h2 tabIndex={-1}>{form.draft.updatedAt ? '메뉴 편집' : '메뉴 추가'}</h2>
    <DraftRecoveryNotice restored={form.restored} />
    <MenuFields value={form.draft.values} onChange={(values) => form.setDraft({ ...form.draft, values })} categories={snapshot.categories} depositKrw={depositKrw} disabled={disabled} paymentMode={snapshot.merchant.bookingEnabled ? 'pay_at_venue' : undefined} />
    <PartnerMediaManager targetKind="menu" targetId={snapshot.menus.some(menu => menu.id === id) ? id : null} scope={user ? `${user.id}:${snapshot.merchant.id}` : ''} disabled={disabled || stale || !user} />
    <FormActions state={form.state} disabled={disabled} dirty={form.dirty || !form.draft.updatedAt} onReload={() => void form.reload(from)} />
  </form>;
}
export function filterPartnerMenus(menus: readonly Menu[], query: string, categoryId: string, visibility: Visibility | 'all' = 'all'): Menu[] {
  const needle = query.trim().toLocaleLowerCase();
  return menus.filter((menu) => (!categoryId || menu.categoryId === categoryId) &&
    (visibility === 'all' || menu.visibility === visibility) &&
    (!needle || `${menu.nameKo} ${menu.nameEn}`.toLocaleLowerCase().includes(needle)))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
}

export function PartnerServices() {
  const { snapshot, confirmLeave, drafts } = usePartner();
  const staffDirectory = usePartnerStaffDirectory(true);
  const [editor, setEditorState] = useState(() => drafts.getEditor());
  const [query, setQuery] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [visibility, setVisibility] = useState<Visibility | 'all'>('all');
  const [categoryQuery, setCategoryQuery] = useState('');
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const setEditor = (value: PartnerEditor | null) => { drafts.setEditor(value); setEditorState(value); };
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!editor || !dialog) return;
    if (!dialog.open) dialog.showModal();
    dialog.querySelector<HTMLElement>('#partner-editor-title')?.focus();
    return () => { dialog.close(); if (triggerRef.current?.isConnected) triggerRef.current.focus(); };
  }, [editor]);
  if (!snapshot) return null;
  const close = () => {
    if (!editor || !confirmLeave()) return;
    drafts.discard(`${editor.kind}:${editor.id}`);
    setEditor(null);
  };
  const open = (kind: 'category' | 'menu', id?: string) => {
    if ((snapshot.readOnly && !id) || (editor?.kind === kind && editor.id === id) || !confirmLeave()) return;
    triggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setEditor({ kind, id: id ?? crypto.randomUUID() });
  };
  const categories = [...snapshot.categories].sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
  const menus = filterPartnerMenus(snapshot.menus, query, categoryId, visibility);
  const visibleCategories = categories.filter((category) => `${category.nameKo} ${category.nameEn}`.toLocaleLowerCase().includes(categoryQuery.trim().toLocaleLowerCase()));
  const filtered = !!query.trim() || !!categoryId || visibility !== 'all';
  return <div className={editorStyles.scope}>
    <header className={editorStyles.pageHead}><div><h1>메뉴·패키지</h1><p>가격, 시술 시간, 공개 상태를 한곳에서 관리해요.</p></div><Button disabled={snapshot.readOnly || !categories.length} onClick={() => open('menu')}>+ 메뉴 추가</Button></header>
    <section className={editorStyles.panel} aria-label="메뉴 목록">
      <div className={editorStyles.toolbar}>
        <input type="search" aria-label="메뉴 이름 검색" placeholder="메뉴 이름 검색" value={query} onChange={(event) => setQuery(event.target.value)} />
        <select aria-label="카테고리 필터" value={categoryId} onChange={(event) => setCategoryId(event.target.value)}><option value="">전체 카테고리</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.nameKo || category.nameEn || '이름 없는 카테고리'}</option>)}</select>
        <select aria-label="메뉴 공개 상태 필터" value={visibility} onChange={(event) => setVisibility(event.target.value as Visibility | 'all')}><option value="all">전체 상태</option>{Object.entries(visibilityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        <span role="status">메뉴 {menus.length}개</span>
      </div>
      <table className={editorStyles.table}><thead><tr><th scope="col">메뉴 / 카테고리</th><th scope="col">총 가격</th><th scope="col">소요 시간</th><th scope="col">제공 담당자</th><th scope="col">공개 상태</th><th scope="col">관리</th></tr></thead><tbody>
        {menus.map((menu) => <tr key={menu.id}><td><div className={editorStyles.menuTitle}><span className={editorStyles.menuThumb} aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M9 8h6M9 12h6M9 16h3" /></svg></span><div><strong>{menu.nameKo || menu.nameEn || '이름 없는 메뉴'}</strong>{menu.nameEn && <small lang="en">{menu.nameEn}</small>}<small>{categories.find((category) => category.id === menu.categoryId)?.nameKo || '카테고리 이름 미설정'}</small></div></div></td>
          <td>{menu.priceKrw === null ? '금액 미설정' : `${menu.priceKrw.toLocaleString('ko-KR')}원`}</td><td>{menu.durationMinutes === null ? '시간 미설정' : `${menu.durationMinutes}분`}<small>+ 정리 {menu.cleanupMinutes}분</small></td>
          <td>{staffDirectory.directory ? <>{Object.values(staffDirectory.directory.details).filter((person) => person.menuIds.includes(menu.id)).map((person) => <Link key={person.id} className={editorStyles.textButton} href={`/partner/staff?staff=${encodeURIComponent(person.id)}`}>{person.name || '이름 미입력'}</Link>)}{!Object.values(staffDirectory.directory.details).some((person) => person.menuIds.includes(menu.id)) && <Link className={editorStyles.textButton} href="/partner/staff">담당자 연결</Link>}</> : <span className={styles.hint}>{staffDirectory.loading ? '조회 중…' : '조회 필요'}</span>}</td><td><span className={editorStyles.status} data-visible={menu.visibility === 'visible'}>{visibilityLabels[menu.visibility]}</span><small><MenuPublicationBadge menu={menu} categories={categories} paymentMode={snapshot.merchant.bookingEnabled ? 'pay_at_venue' : undefined} /></small></td>
          <td><button type="button" className={editorStyles.textButton} aria-label={`${menu.nameKo || '메뉴'} ${snapshot.readOnly ? '보기' : '편집'}`} onClick={() => open('menu', menu.id)}>{snapshot.readOnly ? '보기' : '편집'}</button></td></tr>)}
        {!menus.length && <tr><td colSpan={6}><div className={editorStyles.empty}>{filtered ? '검색 결과가 없어요. 이름이나 필터를 바꿔 보세요.' : categories.length ? '아직 메뉴가 없어요. 첫 메뉴를 등록해 주세요.' : '카테고리를 먼저 추가하면 메뉴를 등록할 수 있어요.'}{filtered && <button type="button" className={editorStyles.textButton} onClick={() => { setQuery(''); setCategoryId(''); setVisibility('all'); }}>필터 초기화</button>}</div></td></tr>}
      </tbody></table>
      {staffDirectory.failed && <p className={editorStyles.summary} role="status">제공 담당자를 조회하지 못했어요. <button type="button" className={editorStyles.textButton} onClick={() => void staffDirectory.refresh()}>다시 조회</button></p>}
      <p className={editorStyles.summary}>공개 조건을 충족한 메뉴는 운영 승인과 예약 연결이 완료된 매장의 고객 화면에 표시돼요. 변경 전 예약의 메뉴명과 금액은 유지돼요.</p>
    </section>
    <details className={`${editorStyles.panel} ${editorStyles.categories}`} open={!categories.length}>
      <summary>카테고리 관리 · {categories.length}개</summary>
      <div className={editorStyles.toolbar}><input type="search" aria-label="카테고리 이름 검색" placeholder="카테고리 이름 검색" value={categoryQuery} onChange={(event) => setCategoryQuery(event.target.value)} /><Button variant="secondary" disabled={snapshot.readOnly} onClick={() => open('category')}>+ 카테고리 추가</Button></div>
      <ul className={styles.list}>{visibleCategories.map((category) => <li className={`${styles.listItem} ${editorStyles.panelBody}`} key={category.id}><div><h3>{category.nameKo || category.nameEn || '이름 없는 카테고리'}</h3>{category.nameEn && <p lang="en">{category.nameEn}</p>}<p>표시 순서 {category.sortOrder} · {visibilityLabels[category.visibility]}</p></div><button type="button" className={editorStyles.textButton} aria-label={`${category.nameKo || '카테고리'} ${snapshot.readOnly ? '보기' : '편집'}`} onClick={() => open('category', category.id)}>{snapshot.readOnly ? '보기' : '편집'}</button></li>)}</ul>
      {!visibleCategories.length && <p className={editorStyles.empty}>{categoryQuery.trim() ? '검색한 카테고리가 없어요.' : '메뉴를 묶을 카테고리부터 추가해 주세요.'}</p>}
    </details>
    {editor && <dialog ref={dialogRef} className={editorStyles.dialog} aria-labelledby="partner-editor-title" onCancel={(event) => { event.preventDefault(); close(); }} onClick={(event) => { if (event.target === event.currentTarget) { const rect = event.currentTarget.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) close(); } }}>
      <div className={editorStyles.dialogHead}><h2 id="partner-editor-title" tabIndex={-1}>{editor.kind === 'category' ? '카테고리' : '메뉴'} {snapshot.readOnly ? '정보' : '편집'}</h2><button type="button" className={editorStyles.close} onClick={close} aria-label="편집 닫기">×</button></div>
      {editor.kind === 'category' ? <CategoryEditor key={`category-${editor.id}`} id={editor.id} snapshot={snapshot} /> : <MenuEditor key={`menu-${editor.id}`} id={editor.id} snapshot={snapshot} />}
    </dialog>}
  </div>;
}
