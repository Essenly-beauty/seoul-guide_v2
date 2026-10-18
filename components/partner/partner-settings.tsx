'use client';

import Link from 'next/link';
import { Notice } from '@/components/ui/notice';
import type { BusinessType, PartnerSnapshot } from '@/lib/partner/contracts';
import { usePartner } from './partner-provider';
import { merchantStatus } from './partner-dashboard';
import styles from './partner.module.css';

const businessLabels: Record<BusinessType, string> = { hair: '헤어', nail: '네일', head_spa: '헤드스파' };
const registeredValue = (value: string) => value.trim() ? value : '미등록';
export function PartnerSettings() {
  const { snapshot } = usePartner();
  return snapshot && <PartnerSettingsView snapshot={snapshot} />;
}
export function PartnerSettingsView({ snapshot }: { snapshot: PartnerSnapshot }) {
  const { merchant } = snapshot;
  return <>
    <header className={styles.pageHeader}><p className={styles.eyebrow}>YOUR BUSINESS</p><h1>매장 정보</h1><p className={styles.muted}>고객과 운영자가 매장을 확인하고 연락할 수 있는 정보입니다.</p></header>
    <section className={styles.section} aria-labelledby="merchant-profile-heading">
      <h2 id="merchant-profile-heading">매장 기본 정보</h2>
      <dl className={styles.readonlyValue}>
        <dt>상호명</dt><dd>{registeredValue(merchant.displayName)}</dd>
        <dt>이메일</dt><dd>{registeredValue(merchant.contactEmail)}</dd>
        <dt>전화번호</dt><dd>{registeredValue(merchant.contactPhone)}</dd>
        <dt>매장 주소</dt><dd>{registeredValue(merchant.address)}</dd>
        <dt>업종</dt><dd>{[...new Set(merchant.businessTypes)].map((type) => businessLabels[type]).join(' · ') || '미등록'}</dd>
      </dl>
      <Notice tone="info">매장 정보와 사진은 운영자가 등록하고 관리합니다. 사장님은 예약 메뉴와 일정을 관리할 수 있습니다.</Notice>
      <Link className={styles.textLink} href="/support">매장 정보 수정 요청 →</Link>
    </section>
    <section className={styles.section}><p className={styles.eyebrow}>MANAGED BY OPERATIONS</p><h2>승인 및 예약 연결</h2><dl className={styles.readonlyValue}><dt>매장 상태</dt><dd>{merchantStatus[snapshot.merchant.status]}</dd><dt>예약 연결 승인</dt><dd>{snapshot.merchant.bookingEnabled ? '운영자 승인됨 · 고객 예약·결제 연결은 별도 확인 필요' : '예약 기능 연결 전'}</dd><dt>예약금 정책</dt><dd>메뉴별 예약금은 운영자가 승인합니다. 미설정 메뉴는 운영자 승인 대기 상태입니다.</dd></dl><Notice tone="info">매장 상태, 예약 연결과 예약금은 직접 변경할 수 없습니다. 변경 또는 계정 삭제가 필요하면 운영자에게 문의해 주세요.</Notice><Link className={styles.textLink} href="/support">승인 및 계정 관리 문의 →</Link></section>
  </>;
}
