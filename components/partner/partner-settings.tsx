'use client';

import Link from 'next/link';
import { Notice } from '@/components/ui/notice';
import type { BusinessType, PartnerSnapshot, SettingsValues } from '@/lib/partner/contracts';
import { settingsFormValues } from '@/lib/partner/form-values';
import { usePartner } from './partner-provider';
import { Field, FormActions, usePartnerDraft } from './partner-form';
import { merchantStatus } from './partner-dashboard';
import styles from './partner.module.css';

const businessLabels: Record<BusinessType, string> = { hair: '헤어', nail: '네일', head_spa: '헤드스파' };
export function SettingsFields({ value, onChange, disabled }: { value: SettingsValues; onChange: (value: SettingsValues) => void; disabled: boolean }) {
  return <fieldset className={styles.fields} disabled={disabled}><legend>매장 기본 정보</legend>
    <Field label="상호명"><input name="displayName" maxLength={120} value={value.displayName} onChange={(event) => onChange({ ...value, displayName: event.target.value })} /></Field>
    <div className={styles.twoColumns}><Field label="이메일"><input name="contactEmail" type="email" autoComplete="email" maxLength={320} value={value.contactEmail} onChange={(event) => onChange({ ...value, contactEmail: event.target.value })} /></Field><Field label="전화번호"><input name="contactPhone" type="tel" autoComplete="tel" maxLength={80} value={value.contactPhone} onChange={(event) => onChange({ ...value, contactPhone: event.target.value })} /></Field></div>
    <Field label="매장 주소"><input name="address" autoComplete="street-address" maxLength={500} value={value.address} onChange={(event) => onChange({ ...value, address: event.target.value })} /></Field>
    <fieldset className={styles.checkboxes}><legend>업종 · 복수 선택 가능</legend>{(Object.keys(businessLabels) as BusinessType[]).map((type) => <label key={type}><input type="checkbox" name="businessTypes" value={type} checked={value.businessTypes.includes(type)} onChange={(event) => onChange({ ...value, businessTypes: event.target.checked ? [...value.businessTypes, type] : value.businessTypes.filter((item) => item !== type) })} />{businessLabels[type]}</label>)}</fieldset>
  </fieldset>;
}
export function PartnerSettings() {
  const { snapshot } = usePartner();
  return snapshot && <SettingsEditor snapshot={snapshot} />;
}
function SettingsEditor({ snapshot }: { snapshot: PartnerSnapshot }) {
  const from = (current: PartnerSnapshot) => { const { displayName, contactEmail, contactPhone, address, businessTypes, updatedAt } = current.merchant; return { values: { displayName, contactEmail, contactPhone, address, businessTypes }, updatedAt }; };
  const form = usePartnerDraft(from(snapshot));
  return <>
    <header className={styles.pageHeader}><p className={styles.eyebrow}>YOUR BUSINESS</p><h1>매장 정보</h1><p className={styles.muted}>고객과 운영자가 매장을 확인하고 연락할 수 있는 정보입니다.</p></header>
    <form onSubmit={(event) => { event.preventDefault(); const parsed = settingsFormValues(form.draft.values); if (!parsed.ok) { form.invalid(parsed.error); return; } void form.submit({ kind: 'settings', expectedUpdatedAt: form.draft.updatedAt, values: parsed.values }, from); }}>
      <SettingsFields value={form.draft.values} onChange={(values) => form.setDraft({ ...form.draft, values })} disabled={snapshot.readOnly || form.locked} />
      <FormActions state={form.state} disabled={snapshot.readOnly || form.locked} dirty={form.dirty} onReload={() => void form.reload(from)} />
    </form>
    <section className={styles.section}><p className={styles.eyebrow}>MANAGED BY OPERATIONS</p><h2>승인 및 예약 연결</h2><dl className={styles.readonlyValue}><dt>매장 상태</dt><dd>{merchantStatus[snapshot.merchant.status]}</dd><dt>예약 연결 승인</dt><dd>{snapshot.merchant.bookingEnabled ? '운영자 승인됨 · 고객 예약·결제 연결은 별도 확인 필요' : '예약 기능 연결 전'}</dd><dt>예약금 정책</dt><dd>메뉴별 예약금은 운영자가 승인합니다. 미설정 메뉴는 운영자 승인 대기 상태입니다.</dd></dl><Notice tone="info">매장 상태, 예약 연결과 예약금은 직접 변경할 수 없습니다. 변경 또는 계정 삭제가 필요하면 운영자에게 문의해 주세요.</Notice><Link className={styles.textLink} href="/support">승인 및 계정 관리 문의 →</Link></section>
  </>;
}
