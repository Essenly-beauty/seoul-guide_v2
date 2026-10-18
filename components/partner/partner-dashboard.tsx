'use client';

import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Notice } from '@/components/ui/notice';
import { menuReadiness } from '@/lib/partner/catalog';
import type { Merchant, PartnerSnapshot } from '@/lib/partner/contracts';
import { usePartner } from './partner-provider';
import styles from './partner.module.css';

export const merchantStatus: Record<Merchant['status'], string> = { onboarding: '입점 준비 중', active: '운영 승인됨', suspended: '운영 일시 중지', closed: '운영 종료' };
export function PartnerDashboard() {
  const { snapshot } = usePartner();
  return snapshot && <PartnerDashboardView snapshot={snapshot} />;
}
export function PartnerDashboardView({ snapshot }: { snapshot: PartnerSnapshot }) {
  const { merchant, categories, menus, schedule } = snapshot;
  const profileReady = !!(merchant.displayName.trim() && merchant.contactEmail.trim() && merchant.contactPhone.trim() && merchant.address.trim() && merchant.businessTypes.length);
  const readyMenus = menus.filter((menu) => !menuReadiness(menu, categories).length).length;
  const steps = [
    { name: '매장 기본 정보', description: '상호명, 연락처, 주소와 업종을 확인해 주세요.', ready: profileReady, href: '/partner/settings' },
    { name: '서비스 카테고리', description: `등록된 카테고리 ${categories.length}개 · 고객이 메뉴를 찾는 기준입니다.`, ready: categories.some((category) => category.visibility === 'visible' && category.nameKo.trim() && category.nameEn.trim()), href: '/partner/services' },
    { name: '메뉴와 운영자 승인', description: `등록된 메뉴 ${menus.length}개 · 공개 조건 충족 ${readyMenus}개`, ready: readyMenus > 0, href: '/partner/services' },
    { name: '영업 일정', description: schedule?.hours.length ? `주간 영업시간 ${schedule.hours.length}개 구간 설정` : '영업시간, 휴게시간과 날짜별 휴무를 설정해 주세요.', ready: !!schedule?.hours.length, href: '/partner/availability' },
  ];
  return <>
    <header className={styles.pageHeader}><p className={styles.eyebrow}>YOUR WORKSPACE</p><h1>{merchant.displayName || '우리 매장'}<span className={styles.titleSub}>운영 준비를 한곳에서</span></h1><Badge tone="dim">{merchantStatus[merchant.status]}</Badge></header>
    <Notice tone="info"><strong>예약 기능 연결 전</strong><p>이곳에서 저장한 정보는 매장 운영 준비에 사용됩니다. 고객 예약과 결제는 아직 활성화되지 않았으며 별도 승인과 연결이 필요합니다.</p></Notice>
    <section className={styles.section} aria-labelledby="setup-title"><div className={styles.sectionHeading}><div><p className={styles.eyebrow}>SETUP CHECKLIST</p><h2 id="setup-title">매장을 소개할 준비</h2></div><span className={styles.muted}>{steps.filter((step) => step.ready).length} / 4 설정</span></div>
      <ol className={styles.checklist}>{steps.map((step, index) => <li key={step.name}><span className={styles.stepNumber}>{String(index + 1).padStart(2, '0')}</span><div><Link href={step.href}>{step.name}</Link><p>{step.description}</p></div><Badge tone={step.ready ? 'success' : 'warning'}>{step.ready ? '설정됨' : '확인 필요'}</Badge></li>)}</ol>
    </section>
    <section className={styles.section}><h2>예약금은 운영자가 승인합니다</h2><p className={styles.muted}>예약금이 미설정된 메뉴는 운영자 승인 대기 상태입니다. 총 금액과 시술 시간, 한국어·영어 소개를 먼저 준비해 주세요.</p><Link className={styles.textLink} href="/partner/services">메뉴 설정으로 이동 →</Link></section>
  </>;
}
