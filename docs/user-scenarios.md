# 외국인 방문객 사용 시나리오 (전수)

> 작성: 2026-07-26 · 모든 시나리오는 현재 구현된 기능에 매핑됨 (괄호 = 화면/기능)

## 페르소나

| | P1 · Mia (미국, 27) | P2 · Yuki (일본, 34) | P3 · Sarah (거주 외국인, 30) |
|---|---|---|---|
| 상황 | 첫 서울 여행 5일, K-뷰티 입문 | 재방문, 시술(피부과·헤드스파) 목적 | 서울 거주 1년차, 정기 관리 |
| 프로필(T1) | tourist · 관심사 skincare/쇼핑 | tourist · 관심사 clinic/spa | resident · 관심사 hair/nail |

---

## A. 시작 — 가입과 개인화 (여행 전~도착 직후)

**A1. 무마찰 가입** — Mia가 호텔 와이파이에서 Google로 로그인. 추가 입력 없이 바로 시작(T0).
**A2. 2화면 온보딩** — ①국적 US + "Traveling now" ②관심사 Skincare·Mall 선택, 나이/성별은 skip (`/onboarding/basics`→`interests`, 전부 탭·건너뛰기 가능). 답하는 즉시 지도 추천·세금환급 힌트가 미국 기준으로 세팅.
**A3. 점진 프로파일링** — 이후 마이페이지 완성도 카드가 한 번에 1개씩 질문("Why we ask" 명시), 9개 완성 시 웰컴 딜 언락(글로시 카드) (`/menu` ProfileCard).
**A4. 컨텍스트 질문** — Yuki가 피부과 상세를 열람하자 다음 방문 때 "피부 타입?" 질문이 우선 노출 (컨텍스트 트리거).

## B. 탐색 — 지도에서 발견 (도착 후 첫 사용)

**B1. 내 주변 훑기** — 위치 허용 → 현위치(빨간 마커) 중심 z15 동네 스케일. 핀이 카테고리색+평점 뱃지라 지도만 봐도 "★4.8 스킨클리닉" 식별 (`/map`).
**B2. 위치 거부 시** — "Location is off — showing Gangnam Station" 배너와 함께 강남역 폴백. Retry로 재요청.
**B3. 카테고리 좁히기** — Mia가 Olive Young 칩 탭 → 핀·리스트가 즉시 필터. 상세 필터(★4.0+/English OK/Bookable/가격대/시술 태그)로 더 좁힘 (칩 레일 + FilterSheet).
**B4. 다른 동네 탐색** — 지도를 홍대로 드래그 → "Search this area"로 재검색. 시트를 원하는 높이로 드래그해 지도/리스트 비율 조절(자유 스냅).
**B5. 핀 → 미리보기** — 핀 탭 → 줌 유지된 채 콜아웃(이름·★·역 도보·English OK·Directions/View details)이 보이는 지도 영역 중앙에 표시. 시트는 올려둔 높이 그대로.

## C. 검색 — 목적지가 있을 때

**C1. 이름 검색** — Yuki가 "dragon" 입력 → 정확도순(완전>접두>부분·태그) 결과, 일치 구간 볼드, 거리·★·주소 표시 (`/search`).
**C2. 비슷한 곳 발견** — 직접 일치 아래 "Similar nearby"로 같은 카테고리 대안 제시.
**C3. 빈 검색 활용** — 최근 검색(로컬 저장·개별 삭제), 현위치 존 기준 Trending, 카테고리/지역 바로가기 → 탭하면 지도에 필터/이동 적용.
**C4. 결과 → 지도 복귀** — 결과 선택 시 `/map?place=`로 돌아와 해당 핀 중심+콜아웃 오픈.

## D. 이동 — 지하철로 (관광객 핵심 동선)

**D1. 경로 계획** — Mia가 Subway 모드에서 Gangnam→Hongik 검색(영문 자동완성, 노선 뱃지). "Est. 29 min · 2 transfers · 8 stops" + 노선색 스텝 카드 (`SubwayRouteController`).
**D2. 실시간은 구글에** — 요약 줄의 `↗ Live` 필로 구글맵 transit 딥링크(모든 스냅에서 상시 노출).
**D3. 중간에 들르기** — 스트립에서 신논현 탭 → "Add as via"로 경유역 추가, 경로·시간 재계산 (최대 2개, Edit에서도 관리).
**D4. 역 주변 쇼핑** — 각 역에서 500m/1km/2km 반경 × All/Beauty/Olive Young/Personal Color/**Mall & Gifts**/Daiso 탭으로 주변 탐색. Daiso는 데이터 없이 공식 지도 딥링크로 정직하게 연결.
**D5. 패널 크기 조절** — compact(요약만)/half/full 3단 스냅으로 지도 확인과 목록 탐색 전환.

## E. 방문 판단 — 상세 페이지

**E1. 3초 판단** — 콜라주 사진 → 이름(한/영) → ★4.5(96) · **LIVE until 19:00**(영업시간 기반) → 주소+Copy. 지금 가도 되는지 즉시 판단 (`/place/[id]`).
**E2. 액션 스트립** — Call(전화)·Save(찜)·Share·Website 4분할 — 카카오맵 문법이라 학습 불필요.
**E3. 가격 확인** — Services 가로 레일에 시술·시간·가격 + "Prices confirmed N days ago" 신뢰 라벨.
**E4. 리뷰 검증** — 분포 바+키워드 칩(English OK 9)으로 훑고, Latest/Highest/With photos 정렬·필터, ✓ Verified, Helpful 투표.
**E5. 언어 불안 해소** — English OK 표시 + **택시 카드**(한글 상호+주소, 탭=복사 "Show to taxi driver").
**E6. 길찾기** — 하단 Google/Kakao/Naver 필: 내 위치→장소 경로 딥링크(권한 없으면 도착지 단독 폴백).
**E7. 닫힌 경우** — "Closed · opens 10:00"으로 명확히, LIVE는 미표시.

## F. 예약 — 시술 (P2 중심)

**F1. 채널 예약** — Yuki가 헤드스파에서 Naver/Kakao/Instagram 채널로 예약 (BookingSheet/ChannelSheet).
**F2. 의료 시술 가드** — 피부과는 "시술은 상담 필수" 고지 후 상담 예약 플로우.
**F3. 예약 관리** — `/bookings`에서 Confirmed/Reschedule pending/D-day 상태칩, 상세에서 주소 복사·재조정·취소.

## G. 쇼핑·선물 (P1 핵심)

**G1. 선물 명소** — Mall & Gifts 필터로 더현대·롯데본점·남대문시장·쌈지길 등 10곳 + Tax-free/Open late 뱃지, 역 도보 정보.
**G2. 뭘 살지** — `/ranking` Sales/Review Best/브랜드, Trending 레일 → 상품 상세에서 "Matches your dry skin"(프로필 연동), 한글명 Copy("Show this name to store staff").
**G3. 어디서 사지** — 상품 CTA "Find nearby"로 취급 지점 지도 연결. 온라인 링크 없으면 "Online unavailable" 정직 표기.

## H. 방문 후 — 기록과 재사용

**H1. 별점** — 상세의 "Been here? Rate your visit" 1탭, 장소별 저장·수정.
**H2. 찜 동기화** — 어디서 하트를 눌러도 `/favorites`에 즉시 반영(장소/상품/스토리 3섹션), 카테고리 필터로 재탐색.
**H3. 리뷰 작성** — `/mypage/reviews`에서 방문 건 작성 유도 → 별점+키워드+본문.
**H4. 콘텐츠 소비** — Stories에서 "7-Step K-Beauty Routine" 등 가이드 → 본문 내 장소/상품 연결.

## I. 지속 관계

**I1. Beauty Kit** — 설문 기반 무료 키트 신청, 배송 상태 추적 (`/kit`).
**I2. 피드백 창구** — 마이/설정/Support 3곳에서 Bug/Idea/Wrong place info 제보(페이지 경로 자동 첨부) — 장소 정보 신선도 유지 루프.
**I3. 알림 선택** — 예약/딜/스토리 알림 토글 (`/mypage/notifications`).

## 엣지 시나리오

| 상황 | 서비스 동작 |
|---|---|
| 위치 권한 거부 | 강남역 폴백 + 배너 + Retry / Trending은 "in Seoul" |
| 영업 종료 시간 | LIVE 숨김, "Closed · opens HH:MM" |
| 사진 없는 장소 | 플레이스홀더(추후 지도 스냅샷 폴백) |
| 검색 0건 | 짧은 단어/한글명 제안 + Browse all places |
| 찜 0개 | "Nothing saved yet — tap ♥" EmptyState |
| 앱 미설치(카카오/네이버) | 웹 URL 폴백 |
| 지하철 반경 내 0곳 | 카운트 0 + 반경 확대 유도 |

---

## 동선 검토 결과 (2026-07-26, 실기 브라우저 자동 주행)

**P1 Mia (미국 관광객) — 13/13 통과**: 온보딩 2스텝(국적·체류·관심사 저장 확인) → `?cat=mall` 필터(10곳) → 더현대 콜아웃 → 상세(택시카드·웰컴딜·구글 경로 링크) → 액션 스트립 Save → Saved 탭 실시간 반영 → 상품(한글명 스태프용 복사·Find nearby)

**P2 Yuki (일본, 시술) — 6/6 통과**: "skin clinic" 검색(5건) → 클리닉 상세(가격 신뢰 라벨·의료 상담 고지·예약 진입·전화 tel: 링크) → 지하철 플래너 진입

**P3 Sarah (거주 외국인) — 6/6 통과**: 완성도 카드 첫 질문 → 1탭 응답 시 다음 질문 전환 → Saved에서 하트 해제 시 행 즉시 제거(9→8) → 리뷰 작성 진입 → 피드백 시트 제출·저장(category=idea) 확인

**검토 중 개선 반영**: 콜아웃 포커스 상태에서 지도 빈 곳 탭 → 선택 해제(표준 지도 UX, `4dfd2c2`)

**메모**: 장시간 dev 서버의 `.next` 캐시 손상으로 전 동선이 일시 실패하는 현상 관찰 — 실배포와 무관한 로컬 개발 이슈이며, 캐시 삭제 후 클린 기동으로 해소.
