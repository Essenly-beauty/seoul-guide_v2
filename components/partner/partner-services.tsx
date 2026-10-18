'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Notice } from '@/components/ui/notice';
import { menuReadiness, type Visibility } from '@/lib/partner/catalog';
import type { Category, PartnerSnapshot } from '@/lib/partner/contracts';
import { categoryDraft, categoryFormValues, menuDraft, menuFormValues, type CategoryDraft, type MenuDraft } from '@/lib/partner/form-values';
import { usePartner, type PartnerEditor } from './partner-provider';
import { DraftRecoveryNotice, Field, FormActions, usePartnerDraft } from './partner-form';
import styles from './partner.module.css';

export const visibilityLabels: Record<Visibility, string> = { draft: '초안', visible: '공개 준비 (예약 연결 후 적용)', hidden: '숨김', archived: '보관' };
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
export function MenuFields({ value, onChange, categories, depositKrw, disabled }: { value: MenuDraft; onChange: (value: MenuDraft) => void; categories: Category[]; depositKrw: number | null; disabled: boolean }) {
  return <fieldset className={styles.fields} disabled={disabled}><legend>메뉴 정보</legend>
    <Field label="카테고리"><select name="categoryId" value={value.categoryId} onChange={(event) => onChange({ ...value, categoryId: event.target.value })}><option value="">카테고리 선택</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.nameKo || category.nameEn || '이름 없는 카테고리'} · {visibilityLabels[category.visibility]}</option>)}</select></Field>
    <div className={styles.twoColumns}><Field label="메뉴명 (한국어)"><input name="nameKo" maxLength={120} value={value.nameKo} onChange={(event) => onChange({ ...value, nameKo: event.target.value })} /></Field><Field label="메뉴명 (영어)"><input name="nameEn" lang="en" maxLength={120} value={value.nameEn} onChange={(event) => onChange({ ...value, nameEn: event.target.value })} /></Field></div>
    <Field label="메뉴 설명 (한국어)"><textarea name="descriptionKo" maxLength={4000} value={value.descriptionKo} onChange={(event) => onChange({ ...value, descriptionKo: event.target.value })} /></Field>
    <Field label="메뉴 설명 (영어)"><textarea name="descriptionEn" lang="en" maxLength={4000} value={value.descriptionEn} onChange={(event) => onChange({ ...value, descriptionEn: event.target.value })} /></Field>
    <Field label="총 금액 (원)" hint="KRW · 승인된 예약금을 포함한 전체 금액입니다. 미설정은 빈칸으로 두세요."><input name="priceKrw" inputMode="numeric" value={value.priceKrw} onChange={(event) => onChange({ ...value, priceKrw: event.target.value })} /></Field>
    <dl className={styles.readonlyValue}><dt>승인된 예약금 · 읽기 전용</dt><dd>{depositKrw === null ? '운영자 승인 대기' : `${depositKrw.toLocaleString('ko-KR')}원`}</dd></dl>
    <div className={styles.twoColumns}><Field label="시술 시간 (분)" hint="1 이상의 정수. 미설정은 빈칸으로 두세요."><input name="durationMinutes" inputMode="numeric" value={value.durationMinutes} onChange={(event) => onChange({ ...value, durationMinutes: event.target.value })} /></Field><Field label="정리 시간 (분)" hint="0 이상의 정수. 시술 뒤 정리할 시간입니다."><input name="cleanupMinutes" inputMode="numeric" value={value.cleanupMinutes} onChange={(event) => onChange({ ...value, cleanupMinutes: event.target.value })} /></Field></div>
    <p className={styles.hint}>시술 시간과 정리 시간을 합한 구간이 매장의 공통 운영시간을 차지합니다. 메뉴별 동시 수용 인원 설정은 아닙니다.</p>
    <div className={styles.twoColumns}><VisibilityField value={value.visibility} onChange={(visibility) => onChange({ ...value, visibility })} /><Field label="표시 순서" hint="0 이상의 정수. 작은 숫자가 먼저 표시됩니다."><input name="sortOrder" inputMode="numeric" value={value.sortOrder} onChange={(event) => onChange({ ...value, sortOrder: event.target.value })} /></Field></div>
    <p className={styles.hint}>초안은 이름, 설명, 금액과 시술 시간을 비워 둘 수 있습니다. 공개 준비에는 한국어·영어 이름과 설명, 총 금액, 시술 시간, 승인된 예약금과 공개 준비 상태의 카테고리가 필요합니다. 영어 내용은 직접 입력해 주세요.</p>
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
    <MenuFields value={form.draft.values} onChange={(values) => form.setDraft({ ...form.draft, values })} categories={snapshot.categories} depositKrw={depositKrw} disabled={disabled} />
    <FormActions state={form.state} disabled={disabled} dirty={form.dirty || !form.draft.updatedAt} onReload={() => void form.reload(from)} />
  </form>;
}
export function PartnerServices() {
  const { snapshot, confirmLeave, drafts } = usePartner();
  const [editor, setEditorState] = useState(() => drafts.getEditor());
  const setEditor = (value: PartnerEditor | null) => { drafts.setEditor(value); setEditorState(value); };
  const editorRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    editorRef.current?.querySelector<HTMLElement>('h2')?.focus();
    editorRef.current?.scrollIntoView({ block: 'start' });
  }, [editor?.id, editor?.kind]);
  if (!snapshot) return null;
  const open = (kind: 'category' | 'menu', id?: string) => {
    if ((snapshot.readOnly && !id) || (editor?.kind === kind && editor.id === id) || !confirmLeave()) return;
    setEditor({ kind, id: id ?? crypto.randomUUID() });
  };
  const categories = [...snapshot.categories].sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
  const menus = [...snapshot.menus].sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
  return <>
    <header className={styles.pageHeader}><p className={styles.eyebrow}>SERVICE CATALOG</p><h1>카테고리·메뉴</h1><p className={styles.muted}>우리 매장에 맞게 서비스를 나누고, 고객에게 전할 정보를 준비하세요.</p></header>
    <Notice tone="info">공개 준비로 저장해도 고객에게 즉시 공개되지 않습니다. 예약·결제 연결 후 승인된 설정이 적용됩니다.</Notice>
    {editor && <div ref={editorRef}><div className={styles.actions}><Button variant="secondary" onClick={() => { if (confirmLeave()) { drafts.discard(`${editor.kind}:${editor.id}`); setEditor(null); } }}>편집 닫기</Button></div>{editor.kind === 'category' ? <CategoryEditor key={`category-${editor.id}`} id={editor.id} snapshot={snapshot} /> : <MenuEditor key={`menu-${editor.id}`} id={editor.id} snapshot={snapshot} />}</div>}
    <section className={styles.section} aria-labelledby="categories-title"><div className={styles.sectionHeading}><div><p className={styles.eyebrow}>01 / ORGANIZE</p><h2 id="categories-title">카테고리 <span className={styles.muted}>{categories.length}개</span></h2></div><Button variant="secondary" disabled={snapshot.readOnly} onClick={() => open('category')}>카테고리 추가</Button></div>
      {categories.length ? <ul className={styles.list}>{categories.map((category) => <li key={category.id} className={styles.listItem}><div><h3>{category.nameKo || category.nameEn || '이름 없는 카테고리'}</h3>{category.nameEn && <p lang="en">{category.nameEn}</p>}<p>표시 순서 {category.sortOrder} · {visibilityLabels[category.visibility]}</p></div><Button variant="secondary" aria-label={`${category.nameKo || '카테고리'} ${snapshot.readOnly ? '보기' : '편집'}`} onClick={() => open('category', category.id)}>{snapshot.readOnly ? '보기' : '편집'}</Button></li>)}</ul> : <p className={styles.empty}>아직 카테고리가 없습니다. 메뉴를 묶을 카테고리부터 추가해 주세요.</p>}
    </section>
    <section className={styles.section} aria-labelledby="menus-title"><div className={styles.sectionHeading}><div><p className={styles.eyebrow}>02 / DESCRIBE</p><h2 id="menus-title">메뉴 <span className={styles.muted}>{menus.length}개</span></h2></div><Button variant="secondary" disabled={snapshot.readOnly || !categories.length} onClick={() => open('menu')}>메뉴 추가</Button></div>
      {!categories.length && <p className={styles.hint}>카테고리를 먼저 저장하면 메뉴를 추가할 수 있습니다.</p>}
      {menus.length ? <ul className={styles.list}>{menus.map((menu) => <li key={menu.id} className={styles.listItem}><div><h3>{menu.nameKo || menu.nameEn || '이름 없는 메뉴'}</h3><p>{categories.find((category) => category.id === menu.categoryId)?.nameKo || '카테고리 이름 미설정'} · {visibilityLabels[menu.visibility]}</p><p>{menu.priceKrw === null ? '총 금액 미설정' : `${menu.priceKrw.toLocaleString('ko-KR')}원`} · {menu.durationMinutes === null ? '시술 시간 미설정' : `시술 ${menu.durationMinutes}분`} · 정리 {menu.cleanupMinutes}분</p><Badge tone={menuReadiness(menu, categories).length ? 'warning' : 'success'}>{menu.depositKrw === null ? '운영자 승인 대기' : menuReadiness(menu, categories).length ? '공개 조건 확인 필요' : '공개 조건 충족'}</Badge></div><Button variant="secondary" aria-label={`${menu.nameKo || '메뉴'} ${snapshot.readOnly ? '보기' : '편집'}`} onClick={() => open('menu', menu.id)}>{snapshot.readOnly ? '보기' : '편집'}</Button></li>)}</ul> : <p className={styles.empty}>아직 메뉴가 없습니다. 메뉴명, 금액과 시간을 초안으로 저장할 수 있습니다.</p>}
    </section>
  </>;
}
