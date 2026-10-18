'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { authLinkWithNext } from '@/lib/auth-return';
import { routes } from '@/lib/routes';
import { usePartner } from './partner-provider';
import styles from './partner.module.css';

const navigation = [['/partner', '운영 현황'], ['/partner/services', '카테고리·메뉴'], ['/partner/availability', '영업 일정'], ['/partner/settings', '매장 정보']] as const;
export function PartnerShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { snapshot, access, stale, refreshing, refresh } = usePartner();
  return <div className={styles.shell} lang="ko">
    <a href="#partner-main" className={styles.skip}>본문으로 이동</a>
    <aside className={styles.sidebar}>
      <div className={styles.brand}>MYSEOULDROP<span>파트너 운영실</span></div>
      <nav aria-label="가맹점 관리" className={styles.nav}>
        {navigation.map(([href, label]) => <Link key={href} href={href} aria-current={pathname === href ? 'page' : undefined}>{label}</Link>)}
      </nav>
      <Link href="/support" className={styles.support}>운영자에게 문의</Link>
    </aside>
    <main id="partner-main" className={styles.main}>
      {snapshot && <div className={styles.toolbar}><span className={styles.muted}>{snapshot.merchant.displayName || '상호명 미설정'}</span><Button variant="secondary" disabled={refreshing} onClick={() => void refresh()}>{refreshing ? '불러오는 중…' : '최신 정보 조회'}</Button></div>}
      {stale && snapshot && <Notice tone="warning" role="status">최신 정보를 불러오지 못했습니다. 마지막으로 조회한 정보를 표시합니다. 편집 중인 내용은 유지됩니다.</Notice>}
      {snapshot?.readOnly && <Notice tone="warning">현재 매장은 읽기 전용입니다. 매장 상태나 운영 권한 확인이 필요합니다. <Link href="/support">운영자에게 문의</Link></Notice>}
      {snapshot ? <div key={snapshot.merchant.id}>{children}</div> : <section className={styles.gate}>
        {access === 'loading' && <><p className={styles.eyebrow}>PARTNER WORKSPACE</p><h1>매장 정보를 불러오고 있습니다</h1><p role="status">접근 권한과 최신 설정을 확인하고 있습니다.</p></>}
        {access === 'signed-out' && <><p className={styles.eyebrow}>PARTNER WORKSPACE</p><h1>가맹점 계정으로 로그인해 주세요</h1><p>매장에 연결된 계정으로 카테고리, 메뉴와 영업 일정을 관리할 수 있습니다.</p><Button href={authLinkWithNext(routes.signIn, pathname)}>로그인</Button></>}
        {access === 'unassigned' && <><p className={styles.eyebrow}>ACCESS</p><h1>관리할 수 있는 매장이 없습니다</h1><p>매장 연결이 아직 완료되지 않았거나 접근 권한이 변경되었습니다. 운영자에게 계정과 매장 연결을 확인해 주세요.</p><Button href="/support">매장 연결 문의</Button></>}
        {access === 'unavailable' && <><p className={styles.eyebrow}>CONNECTION</p><h1>매장 정보를 불러오지 못했습니다</h1><p role="alert">일시적인 연결 문제입니다. 다시 시도해 주세요.</p><Button disabled={refreshing} onClick={() => void refresh()}>{refreshing ? '다시 확인 중…' : '다시 시도'}</Button></>}
      </section>}
    </main>
  </div>;
}
