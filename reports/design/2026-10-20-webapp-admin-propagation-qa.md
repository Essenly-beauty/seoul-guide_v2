# QA report — MYSEOULDROP 웹앱 + 파트너 관리자 연동 (report-only, 4차)

- Date: 2026-10-20 KST 19:30–21:40 · Branch `codex/service-quality-release-20261018` · HEAD `812d9e6` + 미커밋 작업 트리. 식별: `tree-fingerprint.txt`(status 261건) + **`tree-content-hashes.txt`(변경·미추적 파일 319개의 내용 sha256; 헤더 1줄 제외)**. 이 해시는 ‘그때의 파일이 지금과 같은가’만 답하고 과거 소스를 복원하지 못한다. 점검 뒤 Claude가 같은 트리에 기능 변경(비회원 ♥ 미보관·사진 헤더·스켈레톤 등)을 넣었으므로, 이 보고서의 관찰은 그 변경 **이전** 상태이며 변경 후 동작은 별도 회귀 기록(`screenshots/impl/`, 아래 §7)으로만 다룬다.
- Caller: /qa-only (report-only; 제품 코드·테스트 수정 없음) · Mode: Full · Scope: 사용자 요청 3건
- Target: http://127.0.0.1:3113 (Next.js dev, 로컬 Supabase 54381, 테스트 매장 `myseouldrop-booking-studio`, 파트너·고객 테스트 계정 `$TMPDIR/myseouldrop-booking-local-access.json`)
- Tooling: Playwright headless Chromium(저장소 `node_modules`), PC 1440·모바일 390(터치). 실행 스크립트 18개는 `scripts/`에, 원본 관찰 JSON·스크린샷은 `screenshots/{guest,fav,propagation,booking,round2}/`에 있다(아래 각 판정에 파일명을 적음). gstack 증거 레저 도구는 쓰지 않았다.
- 판정 표기: **[실측]** 브라우저·API로 직접 관찰 · **[코드]** 소스 정적 확인 · **[추정]** 관찰과 코드로 추론 · **[미검증]** 하지 못함.
- Isolation: 관리자 변경은 로컬 테스트 매장에만, 각 프로브 뒤 원복(§5에 원복 증거). 비회원 프로브는 새 컨텍스트.
- 개발 서버 주의: 프로브를 겹쳐 돌리면 첫 컴파일·저장이 10~30초 걸려 타임아웃이 난다(`/settings` goto 30초 초과, profile API 12.6초, 검수 요청 저장 15초). 순차 실행에서는 정상. “로딩 중” 관찰은 이 영향을 받는다.

## 1. 요약

| 요청 | 결론 | 근거 |
| --- | --- | --- |
| (1) 관리자 값 → 웹앱 | **상세·예약 화면에는 반영되고, 지도·검색·저장 목록에는 반영되지 않는다.** 즉시 항목(전화·영어 응대·임시 안내)·메뉴 가격/공개·검수 항목(승인 전 미노출)은 공개 API와 상세 Info/Services에서 [실측]; 담당자 직함·날짜 휴무는 공개 API에서 [실측]하고 예약 화면이 그 API를 읽는 것은 [코드]로만 확인. 그러나 상세 머리의 영업시간(F1)과 지도 선택 요약의 ‘English OK’(F7)는 정적 장소 데이터를 읽어 관리자 값을 무시한다 [실측+코드]. 고객 예약 ↔ 관리자 확정·취소 왕복은 동작 [실측]. | §3.1 반영표, §3.2 |
| (2) 웹앱 기본 동작 | **화면 진입은 정상**: 최초 스윕 40회 중 200이 39회(모바일 `/settings` 1회는 개발 서버 goto 30초 타임아웃), 콘솔 오류 1회(모바일 `/ranking` hydration 경고, 재실행 2회 미재현), HTTP 4xx/5xx 응답 0, 가로 넘침 0 [실측]. 행동 검증은 일부만: 지도 카테고리 필터·언어 변경 유지·저장/해제·공유 유도·예약 4단계·고객 취소 버튼 노출은 확인 [실측], 검색 입력→결과(선택자 오류), 지도 항목 선택, 고객 메시지·고객 취소 실행·관리자 시간 변경 반영은 [미검증]. | §3.3 |
| (3) 비회원 ♥ | **점검 당시(19:30~21:10) 구현은 비회원 저장을 허용**했다: 기기(localStorage) 저장 + 가입 유도 시트, 로그인 시 계정 병합 [실측+코드]. **21:20 제품 소유자 결정: 가입 전에는 보관하지 않는다(B).** 그에 따른 변경은 이 점검 범위 밖이며 §7의 별도 회귀 기록만 있다. | §3.4, §7 |

결함: 중 3건(F1 영업시간 표시, F4 출근표, F7 지도 English OK), 낮 1건(F6 문서·주석 불일치). 개선 제안(결함 아님): F3 API 오류 코드 구분. 관찰(기준 없음): F5 개발 서버 로딩 문구. 1차 보고서의 F2(검수 배지)는 **후속 관찰에서 정상 확인, 최초 불일치 원인 미확정**(§3.1). 지난 화면 점검(`reports/design/2026-10-20-partner-admin-implementation-screen-check.md`)의 A~N은 이번에 재검증하지 않았다.

## 2. Charters

| # | Contract | Risk | Entrypoint | Isolation | Exit |
| --- | --- | --- | --- | --- | --- |
| C1 | 즉시 항목(전화·영어 응대·임시 안내) 저장 → 고객 화면·`/api/places/:id/profile` 즉시 반영 | 캐시 지연, 화면별 누락 | `/partner/settings` → 상세·지도·저장 목록 | 설정 후 원복 | 화면별 반영표 |
| C2 | 메뉴 가격·공개 상태 → 고객 메뉴·`/catalog` | 공개 조건 불일치 | `/partner/services` | 71,000·숨김 후 원복 | 가격·노출 변화 |
| C3 | 담당자 직함 → 공개 예약 API·담당자 선택 | 캐시 | `/partner/staff` | 원복 | 문구 변화 |
| C4 | 특정 날짜 휴무 → 가용시간 | 예외 미반영 | `/partner/availability` | 10/23 추가 후 삭제 | 슬롯 0 → 18 |
| C5 | 검수 항목은 요청으로만 저장, 공개값 불변, 관리자에 대기 표시 | 승인 전 노출 | `/partner/settings` | 요청 후 취소 | 공개 불변 + 대기 표시 |
| C6 | 고객 요청 → 관리자 표시 → 확정/취소 → 고객 상태 | 전파 지연 | `/place/…/book` ↔ `/partner/bookings` | 생성 후 취소 | 양쪽 일치 |
| C7 | 비회원 기본 화면·행동 | 오류·넘침·막힘 | 라우트·행동 목록 | 새 컨텍스트 | 전부 통과 |
| C8 | 비회원 ♥ 동작·정책 | 유도 누락·동기화 | 상세·목록·저장 탭 | 비회원 컨텍스트 | 동작 기록 |

## 3. 결과와 증거

### 3.1 관리자 값 → 고객 화면 반영표 (C1~C5)

| 관리자에서 바꾼 값 | 공개 API | 상세 머리(제목 아래) | 상세 Info/Services | 예약 흐름 | 지도 선택 요약 `/map?place=` | 저장 목록 행 | 판정 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 전화 `02-555-0101` | profile `contactPhone` ✅ | – | “Phone number 02-555-0101” ✅ | – | 표시 항목 아님 | 표시 항목 아님 | ✅ [실측] |
| 임시 안내 | profile `notice` ✅ | ✅(본문에 표시) | ✅ | – | 표시 안 함 | 표시 안 함 | ✅ [실측] |
| 영어 응대 ON/OFF | profile `englishOk` ✅ | – | ON “Staff can assist in English” / OFF “Translation app recommended” ✅ | – | **OFF여도 “English OK” 표시** ❌ | 표시 안 함 | F7 |
| 메뉴 가격 70,000→71,000 | catalog ✅ | – | “Scalp care ₩71,000” ✅ | 서비스 단계는 `/api/places/:id/booking` 사용 [코드] — 변경 중 고객 UI 직접 관찰은 없음 | – | – | ✅ API+상세 [실측], 예약 UI [코드] |
| 메뉴 숨김 | catalog에서 제외 ✅ | – | 목록에서 제거 ✅ | – | – | – | ✅ [실측] |
| 담당자 직함 `Stylist (QA)` | `/booking` staff `Jiyoon/Stylist (QA)` ✅ [실측] | – | – | 담당자 단계가 같은 API를 읽음 [코드]; 변경 상태의 고객 UI 캡처는 없음(C6의 “Jiyoon Stylist”는 원복 후) | – | – | ✅ API [실측] + UI 연결 [코드] |
| 10/23 하루 휴무 | availability 10/23 `slots=0`, 10/22 `18` ✅ [실측] | **변화 없음(“Hours unknown”)** | 변화 없음 | 날짜 버튼은 남고 **그 날짜의 시간 목록만 비어 있음** [코드 `availableSlots` 필터]; 변경 상태의 고객 UI 캡처는 없음 | 변화 없음 | 변화 없음 | ✅ API [실측] + UI [코드] / 표시는 F1 |
| 영업시간(매주 반복 10:00–20:00) | profile에 없음 | **“Hours unknown”** ❌ | Hours 섹션 없음 ❌ | 슬롯 계산에만 반영 ✅ | “Hours unknown” ❌ | “Hours unknown” ❌ | F1 |
| 매장 영문 이름(검수) | 요청 중 `nameEn:""` 유지 ✅ | 불변 ✅ | 불변 ✅ | – | 승인 후에도 정적 이름 [코드] | 승인 후에도 정적 이름 [코드] | ✅ (승인 후 지도·목록은 F7과 같은 구조적 한계) |

증거: `screenshots/propagation/propagation.json`(C1~C4 1차), `propagation2.json`(C4 원복·C5·출근표), `screenshots/round2/round2-matrix.json`(반영표, 원복), `matrix-1-detail.png`, `matrix-2-map-selected.png`(ON), `matrix-4-map-selected-off.png`(OFF), `matrix-3-favorites.png`, `round2-f2b.json`(검수 대기 상태·취소).

구조 [코드]: 상세는 `lib/place-profile.ts` `mergePublicPlaceProfile`로 공개 프로필(이름·주소·소개·englishOk·연락처·안내)을 정적 장소에 덮어쓴다. 영업시간은 병합 대상이 아니다. 지도(`components/map/map-screen.tsx` `applyFilters(PLACES…)`, `selected-place-summary.tsx:110`의 `place.englishOk`), 검색, 저장 목록(`app/favorites/page.tsx` `PLACES.filter`)은 정적 `PLACES`만 읽는다.

**F1 [중] 영업시간 표시가 관리자 안내(“설정에서 바로 반영”)와 달리 고객 화면에 반영되지 않는다 — 예약 가능 시간 계산에는 반영되지만, 영업시간을 보여주는 자리(상세 머리·Info·지도 요약·목록)는 정적값이다 [실측+코드].** 관리자 매장 정보 › 자동 반영 항목은 “영업시간 월–일 10:00–20:00 — 예약 설정에서 바꾸면 고객 화면에도 반영돼요”라 쓰고 관리자 안 휴대폰 미리보기도 “Today's hours 10:00–20:00”이지만, 고객 상세·지도·저장 목록은 모두 “Hours unknown”(`place.hours` 정적값). 임시 휴무도 예약 시간 목록에서만 사라진다. 제안: 연결된 매장이 있으면 상세·지도 요약·목록의 영업시간을 매장 공통 일정(+날짜 예외)으로 덮어쓰거나, 관리자 문구를 “예약 가능 시간에 반영”으로 고친다.

**F7 [중] 지도 선택 요약의 ‘English OK’가 관리자 토글을 따르지 않는다 [실측+코드].** 관리자에서 영어 응대 OFF 저장(profile `englishOk:false`) 후에도 `/map?place=myseouldrop-booking-studio` 요약에 “English OK”가 남고, 같은 시각 상세 Info는 “Translation app recommended”로 바뀐다. 원인: 요약·‘English’ 필터(`lib/places.ts:119`)가 정적 `PLACES`의 `englishOk`를 읽는다. 승인된 영문 이름·주소도 같은 이유로 지도·검색·저장 목록에는 반영되지 않는다 [코드]. 제안: 지도·목록이 쓰는 장소 레코드에도 공개 프로필을 병합(서버에서 PLACES + published profiles를 합친 스냅샷 제공).

**F2 정정 — 검수 요청 배지는 후속 관찰에서 정상이었다 [실측]; 최초 불일치의 원인은 미확정.** 저장된 요청 상태에서 상단 배지 “검수 대기 1항목”, 검수 패널 “검수 대기 중 · 1항목 · 매장 이름 (영어) 미등록 → Booking Studio QA · 승인 전까지 고객에게는 기존 정보가 보여요”, ‘요청 취소’ 버튼, ‘검수 요청’ 비활성, 새로고침 후에도 입력값 유지. 요청 취소는 `PATCH /api/partner/operations/profile {action:"cancel_review"}` 200 → “검수 대기 없음”, 공개 `nameEn` 내내 빈 값(`round2-f2b.json`). 1차 보고서의 “배지 ‘없음’ + 취소 버튼 있음” 관찰은 코드상 같은 `pendingReview` 상태로 렌더링되므로 같은 시점의 상태일 수 없다(`partner-store-profile.tsx:48`); 캡처 시점 차이로 추정되나 입증하지 못했다 [추정]. `round2-f2.json`은 요청 저장을 15초 이상 기다리다 끝나 증거가 되지 못한다. 참고(결함 아님): 홈 ‘할 일’에는 검수 대기 항목이 뜨지 않는다 — 시안에는 있었던 연동.

**F3 [개선 제안 · 결함 아님] 가용시간 API 오류 코드 구분 [코드+실측].** 담당자 선택형 매장에서 `staffId` 없이 호출하면 409 `BOOKING_UNAVAILABLE`(“현재 이 매장은 예약을 받을 수 없습니다”). 파서는 `staffId` 생략을 허용하고(`lib/booking/contracts.ts:107`), 고객 UI는 담당자 선택 전에는 요청을 보내지 않으므로(`components/booking/booking-flow.tsx:61`) **고객 장애는 아니고 API 계약 개선 사항**이다. 외부 연동이 오해하지 않도록 400 `STAFF_REQUIRED` 분리를 제안.

**F4 [중] 출근표가 모든 날짜를 ‘—(조회 필요)’로 보인다 — 원인 확인 [실측+코드].** 9초 뒤에도 칸 접근성 이름이 “매장 2026-10-22 조회 필요 일정 편집”, 실패 요청 없음(`propagation2.json`). 원인: `RosterTable`(`components/partner/partner-staff.tsx` 325행 부근)이 `{ ...snapshot.schedule, overrides }`를 `rosterDayState`에 넘기는데, `snapshot.schedule`에는 `updatedAt`이 포함되고(`lib/partner/contracts.ts:14` `Schedule = PartnerSchedule & { updatedAt }`), `reservationIntervals` → `scheduleSnapshot`의 `exactRecord(value, ['merchantId','hours','breaks','blocks','overrides'])`가 여분 키 때문에 실패해 `schedule.invalid`를 던지고, `rosterDayState`의 catch가 `'unknown'`(라벨 ‘조회 필요’)을 돌려준다. 담당자 행도 같은 경로. 제안: 넘기기 전에 `updatedAt`을 제거하거나 스냅샷 검증을 느슨하게. 기존 출근표 테스트 `lib/partner/editors-parity.test.tsx:49`는 검증된 형태의 일정만 쓰므로 API 형태(updatedAt 포함) 케이스를 추가해야 한다 [코드].

### 3.2 고객 예약 ↔ 관리자 왕복 (C6) — ✅ [실측]

1. 고객 계정 `/place/myseouldrop-booking-studio/book`: Signature cut → “Choose your staff” → Min → “Choose a date & time” → `Thu, Oct 22, 2026` → 10:00~18:30 30분 간격 → “Review booking”(서비스·담당자·일시·매장 위치·₩60,000 ‘Pay at the venue’) → Full name·Phone number(필수)·Notes → “Send booking request” → `/bookings/<id>`. `/bookings`: “Awaiting confirmation … Thu, Oct 22, 2026 · 15:00 · View booking · Cancel booking” (`booking/booking-loop2.json`).
2. 관리자: 예약 목록(이번 주/전체) “10월 22일 (목) 15:00–16:00 QA Guest 010-0000-0003 Signature cut Min 앱 60,000원 현장 결제 확인 대기”, 캘린더 10/22 블록, 홈 할 일 “확인을 기다리는 예약 1건”, 최근 예약 변경 (`booking-admin2.json`). 기본 기간이 ‘오늘’이라 다른 날짜 요청은 기간을 바꿔야 목록에 보인다.
3. 관리자 ‘예약 확정’ → 모달 ‘예약 확정할까요?’ → 확정 → `PATCH /api/partner/operations/bookings/<id> {"action":"confirm","expectedUpdatedAt":…}` 200 `status:"confirmed"`, 패널 ‘예약 확정’ (`confirm-diag3.json`).
4. 고객 `/bookings` “Confirmed … 15:00”, 상세 “Your appointment is confirmed.” + ‘Cancel booking’·Messages (`confirm-diag4.json`, `diag4-2-customer-detail-confirmed.png`).
5. 관리자 ‘예약 취소’(사유 기타) → `PATCH {"action":"cancel","cancelReason":"기타"}` 200 → 고객 “Cancelled … 15:00”. 11:00·14:00 요청도 같은 방식으로 취소, 고객 상세 “The venue cancelled this booking.”

자동화 메모: 첫 시도에서 `getByRole('button',{name:'예약 확정'})`이 상태 탭 ‘예약 확정 0’을 눌러 미반영으로 오판했다(exact 매칭 누락, 제품 문제 아님).

### 3.3 비회원 웹앱 기본 동작 (C7)

진입 [실측] (`screenshots/guest/guest-basics.json`, 원본 그대로): 20개 경로 × 모바일·PC = 40회 중 HTTP 200 39회(모바일 `/settings` 1회는 개발 서버 goto 30초 타임아웃으로 상태 미기록), 가로 넘침 0, 4xx/5xx 응답 0(`favicon`·`_next/static` 제외, `requestfailed`는 수집하지 않음), 콘솔 오류 1회(모바일 `/ranking` hydration 경고; 단독 재실행 2회 미재현). `/places/hair-salon`은 200이지만 ‘This page wandered off’ 오류 페이지(잘못된 슬러그). 리디렉션 `/`·`/home`→`/map`, `/journal`→`/blog`, `/shop`→`/ranking`. 보호 화면: `/bookings` → “Sign in to view and manage your appointments”; `/place/…/book` → 서비스 목록 + “Sign in to book”; `/mypage/reviews` → 빈 내 평점(평점 작성 시 유도). 언어 설정은 영·일·중·스·프(한국어 없음, 관광객 앱 설계).

행동 [실측] (`screenshots/round2/round2-flows.json`):
- 지도 카테고리 칩 ‘Daiso’ → “1009 places near you” → “284 places near you” ✅.
- 언어 → 日本語: 화면 즉시 일본어(“言語を変更しました”), `/favorites`도 일본어, 새로고침 후 유지 ✅, English 복귀 ✅.
- 상세 ♥ 저장 → 해제: `aria-pressed` true→false, localStorage 비움, 해제 시 시트 없음 ✅; 재저장 시 시트 다시 표시 ✅(매번).
- 저장 목록 ‘Share this list’(비회원) → “Share your list with a link” 가입 유도 시트 ✅.
- [미검증] 검색창 입력→결과: 결과 행은 `<button>`이며 `/map?place=…`로 이동한다(`app/search/page.tsx:118`); 스크립트가 `/place/` 링크를 찾아 실패한 것이므로 선택자 오류다. 지도 목록 항목 선택→요약→뒤로, 외부 지도 링크 목적지도 미검증. 
- 참고(결함 아님): `/search?q=`는 지원하지 않는 딥링크. `/places/hair-salon`은 잘못된 슬러그(올바른 `/places/hair`는 200). 개발 모드 Next.js ‘N’ 배지가 모바일 하단 탭을 가림.

로그인한 고객 기능 [미검증]: 고객 메시지 전송·관리자 답장, 관리자 시간 변경 → 고객 반영, 고객 ‘Cancel booking’ 실행. 자동화 시도 3회 기록은 `screenshots/round2/member-attempts.log`(시각·중단 단계). 가설: 예약 화면은 카탈로그 지문이 바뀌면 1단계로 되돌아가는데(`booking-flow.tsx` `previousFingerprint`), 같은 시간대에 관리자 값을 바꾸던 다른 프로브와 겹쳤다 [추정]. 단독으로 다시 돌려야 한다.

**F5 [관찰 · 결함 집계 제외] 로딩 문구 잔류 — 개발 서버, 성능 기준 없음 [실측].** 예약 검토 ‘Venue location — Loading location…’ 4초 이상 → 8초 뒤 “Map location has not been verified yet · Address not available”; 확정 예약 상세도 6초 시점 ‘Loading location…’·‘Loading messages…’. 운영 빌드에서 재측정 필요. 위치 미검증은 즉시 그 문구로 보여주는 편이 낫다.

### 3.4 비회원 ♥ (C8)

관찰 [실측] (`screenshots/fav/guest-fav.json`, `round2-flows.json`):
1. 새 기기 `/favorites`: “Saved on this device — sign in to keep your list on your account”, Places 0(샘플 주입 없음).
2. 상세 ‘Save’ → 즉시 `aria-pressed=true`, 토스트 “Saved to favorites”, 바텀시트 “Save it to your account”(Google / 이메일 가입 / Sign in · Keep exploring), localStorage `essenly.favorites` 기록.
3. ‘Keep exploring’ 뒤에도 ♥ 유지, 새로고침 유지, `/favorites`에 표시(“Share this list”).
4. 해제·재저장·공유: §3.3. 지도·랭킹 카드의 ♥, 인증 로딩 중 탭, 저장소 사용 불가(프라이빗 모드) 상황은 [미검증]. 로그인 시 계정 병합은 [코드]만, 실측하지 않음.

시점 정리: 점검(19:30~21:10) 당시 허용 → 21:20 제품 소유자 결정 “가입 전에는 보관하지 않는다”(B) → 21:30~22:00 변경 적용·별도 회귀(§7). 이 절의 관찰은 결정 이전 동작이다.

구현 사실(점검 당시) [코드]: `lib/favorites.ts`(비회원 localStorage, 회원 Supabase `favorites`, 로그인 시 합침), `components/ui/favorite-button.tsx`·`place-detail-body.tsx:179`(저장 뒤 `nudge("favorite")`), `signin-nudge.tsx:69-71`(인증 로딩 중·회원은 유도 생략, 비회원은 매번). 코드 주석의 “2026-08-16 사용자 결정”은 당시 설계 근거이지 현재 정책 승인이 아니며, 21:20 결정으로 대체됐다.

**F6 [낮] 문서·주석 불일치 [코드].** `docs/feature-status.md:71`은 `/favorites`를 “localStorage 전용, 최초 진입 샘플 즐겨찾기 주입, 계정 동기화 없음”으로 적었으나 현재는 샘플 주입이 없고 로그인 시 동기화된다. `place-detail-body.tsx:179` 주석 “once per device”와 `signin-nudge.tsx` “favorite: every time”이 다르고 실측은 ‘매번’.

정책 선택지(제품 소유자 결정): (A) 현행 유지 — 비회원 저장 허용 + 유도 시트, 로그인 시 합침. (B) 비회원 ♥ 차단 — 누르면 저장하지 않고 로그인 시트만. (C) 절충 — N개까지 허용. B·C로 바꾸려면 `FavoriteButton`·상세 Save·지도 액션바·`/favorites` 문구·`lib/favorites.ts`를 함께 바꿔야 한다.

## 4. 남은 흔적·원복 증거

- OFF 상태 지도 관찰 로그: `screenshots/round2/map-off.log`(콘솔 출력 보존).
- 원복 확인: `round2-matrix.json` `revert.profileApi` = 전화·안내 빈 값·englishOk false; `propagation.json` `c2.revert.catalog` = 70,000·공개; `c3.revert.staffApi` = `Jiyoon/Stylist`; `propagation2.json` `c4.revert.avail` = 10/23 `slots=18`, 특정 날짜 0; `round2-f2b.json` `afterCancelReload` = 검수 대기 없음, `publicNameEn` 빈 값.
- 남은 데이터(로컬 테스트 DB): 취소된 예약 — 전화 ‘화면점검 테스트’ 3건(10/21 11:00), 앱 ‘QA Guest’ 3건(10/22 11:00·14:00·15:00). 운영 DB에는 아무것도 쓰지 않았다.

## 5. 하지 못한 것

- 사진 업로드와 고객 노출, 고객↔업체 메시지, 관리자 시간 변경 반영, 고객 취소 실행, 검수 승인(운영팀 화면 없음), 실제 기기, 운영 빌드, 지도·카드 ♥, 저장소 불가 상황, 로그인 병합 실측, 검색 입력 결과.
- 1차 화면 점검 결함 A~N 재검증.

## 6. 제안 회귀 테스트 (제품 테스트는 만들지 않음)

- `public place hours follow merchant schedule` — Value: protects=연결 매장의 상세·지도·목록 영업시간이 매장 공통 일정을 따른다; fails_when=정적 `hours`를 그대로 읽는다; why_new=기존 테스트는 예약 가용시간만 본다; seam=none; no_claim=ISR 재검증(단위·fixture만)
- `map summary englishOk follows published profile` — Value: protects=지도 요약·English 필터가 공개 프로필을 반영; fails_when=`PLACES.englishOk`만 읽는다; why_new=지도 테스트에 프로필 병합 경로 없음(확인 필요); seam=none; no_claim=none beyond protects
- `roster accepts schedule snapshot with updatedAt` — Value: protects=API 형태 일정(updatedAt 포함)으로도 근무/휴무가 계산된다; fails_when=`exactRecord`가 여분 키로 실패해 ‘조회 필요’; why_new=기존 테스트는 검증된 형태만 사용(추정); seam=none; no_claim=실제 API 왕복(단위)
- `availability without staffId in staff-selection mode returns STAFF_REQUIRED` — Value: protects=파라미터 누락과 매장 비활성 구분; fails_when=409 BOOKING_UNAVAILABLE로 합쳐짐; why_new=해당 경로 테스트 없음(확인 필요); seam=none; no_claim=none beyond protects

## 7. 변경 후 회귀 기록 (점검 범위 밖 · 별도 실행)

21:30~22:00 Claude가 같은 트리에 넣은 변경(비회원 ♥ 미보관, 사진 헤더, 스켈레톤, 첫 리뷰 유도, 관리자 사진 영역 스위치)에 대한 브라우저 회귀는 `scripts/verify-impl.cjs`·`verify-impl2.cjs`, 결과 `screenshots/impl/`에 있다. 요지: 비회원 ♥ 탭 → 저장 없음·localStorage 없음·가입 시트 표시, 시트의 Sign in → 로그인 복귀 시 저장(토스트) [실측]; 나머지는 해당 변경 기록 참조. 이 절은 위 1~6절의 판정을 바꾸지 않는다.

## 8. 상태

STATUS: DONE_WITH_CONCERNS — 요청 3건에 답했고 결론을 [실측]/[코드]/[추정]/[미검증]으로 구분했다. 우려: F1·F7은 업체가 바꾼 값이 고객 첫 화면(지도·목록)에 보이지 않는 구조적 문제이며, F4는 관리자 화면 신뢰에 영향. 회원 기능 왕복(메시지·시간 변경·고객 취소)은 미검증.
