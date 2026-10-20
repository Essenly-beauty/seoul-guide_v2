'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, type ReactNode } from 'react';
import { Icon, type IconName } from '@/components/icon';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { authLinkWithNext } from '@/lib/auth-return';
import { routes } from '@/lib/routes';
import { usePartner } from './partner-provider';
import styles from './partner.module.css';

type Destination = { href: string; label: string; icon: IconName; group: string };
export const partnerNavigation: Destination[] = [
  { href:'/partner',label:'홈',icon:'home',group:'운영' },
  { href:'/partner/calendar',label:'예약 캘린더',icon:'cal',group:'운영' },
  { href:'/partner/bookings',label:'예약 목록',icon:'book',group:'운영' },
  { href:'/partner/customers',label:'고객',icon:'user',group:'운영' },
  { href:'/partner/messages',label:'메시지',icon:'bell',group:'운영' },
  { href:'/partner/statistics',label:'통계',icon:'history',group:'운영' },
  { href:'/partner/services',label:'메뉴·패키지',icon:'scissors',group:'매장' },
  { href:'/partner/staff',label:'담당자',icon:'user',group:'매장' },
  { href:'/partner/availability',label:'기본 근무시간',icon:'cal',group:'매장' },
  { href:'/partner/roster',label:'출근표',icon:'check',group:'매장' },
  { href:'/partner/rules',label:'예약 설정',icon:'menu',group:'매장' },
  { href:'/partner/settlement',label:'정산',icon:'bag',group:'매장' },
  { href:'/partner/settings',label:'매장 정보',icon:'store',group:'매장' },
];
export function PartnerShell({ children }: { children: ReactNode }) {
  const pathname=usePathname();
  const { snapshot,access,stale,refreshing,refresh }=usePartner();
  const more=useRef<HTMLDialogElement>(null);
  useEffect(()=>{ more.current?.close(); },[pathname]);
  const current=partnerNavigation.find(item=>item.href===pathname);
  const navLink=(item:Destination)=><Link key={item.href} href={item.href} className="nav-btn" aria-current={pathname===item.href?'page':undefined}><Icon name={item.icon}/><span>{item.label}</span></Link>;
  return <div className={styles.shell} lang="ko" data-partner-shell>
    <a href="#partner-main" className={styles.skip}>본문으로 이동</a>
    <aside className="sidebar">
      <div className="brand">MYSEOULDROP<span>파트너 운영실</span></div>
      <div className="shop"><span className="shop-mark"><Icon name="store"/></span><div>{snapshot?.merchant.displayName||'우리 매장'}<small>{snapshot?.readOnly?'읽기 전용':'예약과 매장 운영'}</small></div></div>
      <nav aria-label="가맹점 관리">{['운영','매장'].map(group=><div className="navgroup" key={group}><p>{group}</p>{partnerNavigation.filter(item=>item.group===group).map(navLink)}</div>)}</nav>
      <div className="side-bottom">한국 표준시 · KST<Link href="/support">운영자에게 문의 ↗</Link></div>
    </aside>
    <div className="body"><header className="topbar"><div className="crumb">{current?.group||'매장'} <span aria-hidden="true">/</span> <b>{current?.label||'운영실'}</b></div><div className="top-actions">
      {snapshot&&<><span className={`status ${snapshot.merchant.bookingEnabled?'green':''}`}><span className="dot"/>{snapshot.merchant.bookingEnabled?'고객 예약 연결':'예약 접수 준비'}</span><Button variant="secondary" className="compact" disabled={refreshing} onClick={()=>void refresh()} aria-label="최신 매장 정보 조회"><Icon name="history"/>{refreshing?'조회 중…':'새로고침'}</Button></>}
      <Button variant="secondary" className="compact" href="/">고객 서비스 <Icon name="ext"/></Button>
    </div></header>
    <main id="partner-main" className="content">
      {stale&&snapshot&&<Notice tone="warning" role="status">최신 정보를 불러오지 못했습니다. 마지막으로 조회한 정보를 표시합니다. 편집 중인 내용은 유지됩니다.</Notice>}
      {snapshot?.readOnly&&<Notice tone="warning">현재 매장은 읽기 전용입니다. 매장 상태나 운영 권한 확인이 필요합니다. <Link href="/support">운영자에게 문의</Link></Notice>}
      {snapshot?<div key={snapshot.merchant.id}>{children}</div>:<section className={styles.gate}>
        {access==='loading'&&<><h1>매장 정보를 불러오고 있습니다</h1><p role="status">접근 권한과 최신 설정을 확인하고 있습니다.</p></>}
        {access==='signed-out'&&<><h1>가맹점 계정으로 로그인해 주세요</h1><p>매장에 연결된 계정으로 예약, 메뉴와 영업 일정을 관리할 수 있습니다.</p><Button href={authLinkWithNext(routes.signIn,pathname)}>로그인</Button></>}
        {access==='unassigned'&&<><h1>관리할 수 있는 매장이 없습니다</h1><p>매장 연결이 아직 완료되지 않았거나 접근 권한이 변경되었습니다.</p><Button href="/support">매장 연결 문의</Button></>}
        {access==='unavailable'&&<><h1>매장 정보를 불러오지 못했습니다</h1><p role="alert">일시적인 연결 문제입니다. 다시 시도해 주세요.</p><Button disabled={refreshing} onClick={()=>void refresh()}>다시 시도</Button></>}
      </section>}
    </main></div>
    <nav className="mobile-nav" aria-label="관리자 주요 메뉴">{[0,1,2,6].map(index=>navLink(partnerNavigation[index]))}<button className="nav-btn" onClick={()=>more.current?.showModal()} aria-haspopup="dialog"><Icon name="more"/><span>더보기</span></button></nav>
    <dialog ref={more} id="more-menu" aria-labelledby="partner-more-heading"><div className="row between"><h2 id="partner-more-heading">전체 메뉴</h2><button className="icon-btn" onClick={()=>more.current?.close()} aria-label="메뉴 닫기"><Icon name="x"/></button></div><nav aria-label="전체 관리 메뉴">{partnerNavigation.filter((_,index)=>![0,1,2,6].includes(index)).map(navLink)}</nav></dialog>
  </div>;
}
