import {Avatar} from '@/components/ui/avatar';
import Link from 'next/link';
import { Clock3, MapPin, Phone } from 'lucide-react';
import type { BookingCatalog } from '@/lib/booking/contracts';
import type { PartnerSnapshot } from '@/lib/partner/contracts';
import type { PartnerStoreProfileSnapshot } from '@/lib/partner/profile-contracts';
import type { MerchantMedia } from '@/lib/partner/media-contracts';
import { reservationIntervals } from '@/lib/partner/reservation-calendar';
import { kstDate, money } from '@/lib/partner/dashboard';
import styles from './partner-editors.module.css';

export const storeWeekdays = ['일', '월', '화', '수', '목', '금', '토'];
const formatMinute = (minute: number) => `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;

export function storeHoursSummary(snapshot: Pick<PartnerSnapshot, 'schedule'>): string {
  if (!snapshot.schedule) return '운영시간 미설정';
  const groups: { days: number[]; hours: string }[] = [];
  for (const weekday of [1, 2, 3, 4, 5, 6, 0]) {
    const hours = snapshot.schedule.hours.filter(day => day.weekday === weekday).sort((a, b) => a.startMinute - b.startMinute).map(day => `${formatMinute(day.startMinute)}–${formatMinute(day.endMinute)}`).join(', ') || '휴무';
    const last = groups.at(-1);
    if (last?.hours === hours) last.days.push(weekday);
    else groups.push({ days: [weekday], hours });
  }
  return groups.map(group => `${group.days.length > 2 ? `${storeWeekdays[group.days[0]]}–${storeWeekdays[group.days.at(-1)!]}` : group.days.map(day => storeWeekdays[day]).join('·')} ${group.hours}`).join(' · ');
}

/** The phone shows saved, approved values. Pending text and photos remain private. */
export function StorePhonePreview({ data, snapshot, catalog, catalogLoading, catalogError, photos }: {
  data: PartnerStoreProfileSnapshot; snapshot: PartnerSnapshot; catalog: BookingCatalog | null;
  catalogLoading: boolean; catalogError: boolean; photos: MerchantMedia[] | null;
}) {
  const profile = data.profile;
  const intervals = snapshot.schedule ? reservationIntervals({ merchantId: snapshot.merchant.id, hours: snapshot.schedule.hours, breaks: snapshot.schedule.breaks, blocks: snapshot.schedule.blocks, overrides: snapshot.dateOverrides }, snapshot.merchant.id, kstDate()) : null;
  const available = catalog?.status === 'available' ? catalog : null;
  const activePhotos = photos?.filter(photo => photo.status === 'active');
  const mark = (field: keyof typeof profile) => data.pendingReview && Object.hasOwn(data.pendingReview.fields, field) ? <i className="pv-pend">변경 검수 중</i> : null;
  return <><div className="phone"><div className="pv" aria-label="고객 앱 상세페이지 미리보기">
    {profile.showPhotos === false ? null : activePhotos?.length ? <div className={`pv-photos ${styles.previewPhotos}`}>{activePhotos.slice(0, 3).map((photo, index) =>
      // The backend validates and re-encodes these same-origin images.
      // eslint-disable-next-line @next/next/no-img-element
      <img key={photo.id} src={photo.url} alt={`공개된 매장 사진 ${index + 1}`} width={photo.width} height={photo.height} />)}</div> : <div className="pv-photos pv-photos-empty">{photos === null ? '매장 사진 조회 중…' : '공개된 매장 사진 없음'}</div>}
    <div className="pv-body"><div className="pv-cap">{snapshot.merchant.businessTypes.map(type => ({ hair: 'Hair salon', nail: 'Nail salon', head_spa: 'Head spa' })[type]).join(' · ') || 'Store'}</div>
      <h3>{profile.nameEn || profile.nameKo}{mark(profile.nameEn ? 'nameEn' : 'nameKo')}</h3>{profile.nameEn && <div className="kr" lang="ko">{profile.nameKo}{mark('nameKo')}</div>}
      {profile.englishOk && <div className="pv-meta"><span>English OK</span></div>}
      <div className="pv-row"><Clock3 aria-hidden="true" /><div><span className={`pv-live ${!intervals?.length ? 'off' : ''}`}>{intervals === null ? 'Hours not set' : intervals.length ? 'Today’s hours' : 'Closed today'}</span><div className="sub">{intervals?.map(interval => `${formatMinute(interval.startMinute)}–${formatMinute(interval.endMinute)}`).join(', ') || (intervals === null ? '운영시간을 설정해 주세요' : '오늘은 예약을 받지 않습니다')}</div></div></div>
      {profile.notice && <div className="pv-notice">{profile.notice}</div>}
      <div className="pv-row"><MapPin aria-hidden="true" /><div>{profile.address || '주소 미등록'}{mark('address')}</div></div>
      <div className="pv-row"><Phone aria-hidden="true" /><div>{profile.contactPhone || '전화번호 미등록'}</div></div>
      <div className="pv-sec"><b>About{mark('introductionKo')}{mark('introductionEn')}</b><p className={styles.previewText}>{profile.introductionEn || profile.introductionKo || '소개를 등록해 주세요.'}</p>{!profile.introductionEn && profile.introductionKo && <div className="hint">영문 소개가 없어 한국어 소개가 보여요.</div>}</div>
      <div className="pv-sec"><b>Menu{available ? ` · ${available.services.length}` : ''}</b>{available ? available.services.slice(0, 3).map(menu => <div className="pv-menu" key={menu.id}><span>{menu.name}</span><span>{menu.durationMinutes}min · {money(menu.priceKrw)}</span></div>) : <p className="hint">{catalogLoading ? '예약 메뉴 조회 중…' : catalogError ? '예약 메뉴를 다시 조회해 주세요.' : '예약 메뉴 공개 준비 중'}</p>}</div>
      {available?.selectionMode === 'staff' && <div className="pv-sec"><b>Staff · {available.staff.length}</b><div className="pv-av">{available.staff.map(person => <span key={person.id} className={styles.previewStaff}><Avatar name={person.name} size={24} aria-hidden={true}/>{person.name}</span>)}</div></div>}
      {data.placeId && available ? <Link className="pv-cta" href={`/place/${data.placeId}`}>Book now<small>Pay at venue · 현장 결제</small></Link> : <span className="pv-cta off">{catalogError ? 'Booking information unavailable' : 'Booking opens soon'}</span>}
    </div>
  </div></div><p className="pv-foot">현재 저장된 정보를 보여요. 검수 중인 항목은 승인 전까지 기존 정보가 표시됩니다.</p></>;
}
