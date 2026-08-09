# 지도 IA v2 — 장소 탐색 · 상세 기획서 (1차)

> 작성: 2026-07-18 · 브랜치 `feature/map-first-ia`
> 근거: Figma 와이어프레임(node 15-714) + 확정 와이어프레임 보드(Artifact `eaa9ef30`) + 네이버 지도 풀 상세 캡쳐 역분석
> 상태: **설계 배경 보존** — 현재 제품 상태는 `service-overview.md`와 `feature-status.md`, 지하철 동작은 `subway-bottom-controller-design.md`를 우선한다.

---

## 1. 개요 · 목표

외국인 방문객 대상 K-뷰티 장소 탐색 앱의 지도 중심(IA map-first) 개편.
지도에서 핀을 고르거나 검색으로 장소를 찾아, 반전개 바텀시트 → 풀 상세 페이지로 이어지는
네이버 지도 검증 패턴을 우리 도메인(Olive Young/클리닉/살롱/네일/퍼스널컬러/헤드스파)에 맞게 이식한다.

핵심 차별점:
- 핀에 **카테고리 아이콘 + 평점**을 바로 노출 (네이버/구글 대비 스캔 속도)
- **LIVE**(지금 영업중) 지표를 핀과 시트에 상시 노출
- 외부 지도(구글/카카오/네이버)로 **내 위치 → 장소** 경로 딥링크

## 2. 화면 플로우

```
지도 홈 M-1 ──핀 탭──────────────▶ 바텀시트 반전개 B-1 ──위로 드래그──▶ 풀 상세 D-1/D-2
   │                                   ▲      │
   └─검색바 탭─▶ 검색 홈 S-1 ─입력─▶ 결과 리스트 S-2 ─선택─┘      └─아래 드래그/✕─▶ M-1 복귀
```

- **B-1이 허브**: 핀 탭과 검색 결과 선택이 같은 반전개 시트로 수렴. 검색에서 진입 시
  지도는 해당 핀 중심으로 이동(fly)하고 선택 핀을 강조한다.
- D-1에서 뒤로가기 → B-1(반전개) 복귀. B-1 닫기 → M-1.

## 3. 디자인 토큰

### 3.1 카테고리 컬러 · 아이콘 (칩 + 핀 + 검색 행 공용)

| PlaceType | 라벨 | 아이콘(`TYPE_ICON`) | 컬러 토큰 | HEX |
|---|---|---|---|---|
| `olive_young` | Olive Young | `bag` | `--c-oy` | `#3F9D4E` |
| `skin_clinic` | Skin Clinic | `cross` | `--c-sc` | `#4A7DDC` |
| `hair_salon` | Hair Salon | `scissors` | `--c-hs` | `#8E5BD8` |
| `nail_lash` | Nail & Lash | `spa` | `--c-nl` | `#E0559B` |
| `personal_color` | Personal Color | `mark` | `--c-pc` | `#DD9422` |
| `head_spa` | Head Spa | `spa` | `--c-spa` | `#2BA6A0` |
| `etc` | Etc | `pin` | `--c-etc` | `#8B9098` |

- 코드: `lib/data.ts`에 `TYPE_COLOR: Record<PlaceType, string>` 추가. CSS 변수도 `globals.css` `:root`에 등록.
- 아이콘 사각형: 라운드 사각(칩 16pt / 핀 17pt, radius 5), 흰색 글리프.

### 3.2 상태 컬러

| 용도 | 값 | 비고 |
|---|---|---|
| LIVE (영업중) | `--live: #2F9E44` | 7pt 점 + `LIVE` 11pt/800 |
| 현위치 마커 | `--me: #E03131` | **빨간색 확정** (13pt 원 + 흰 테두리 2.5 + 붉은 halo 12%) |
| 혼합 클러스터 | `--ink` (중립 다크) | 정원 28pt, 숫자 flex 정중앙 |

- 선택 핀과 현위치의 혼동 방지: 선택 핀은 **다크 뱃지 스타일**로 구분 (§5.1).

## 4. 프레임별 레이아웃 스펙 (기준 폭 375pt)

### 4.1 M-1 · 지도 홈

위→아래:
1. **상단 바** (수평 패딩 16, 요소 gap 8): 아바타 34pt 원 · 검색 필 (flex 1, border 1.4pt ink,
   radius full, 패딩 9×14, ⌕ 아이콘 19pt + placeholder "Search places, areas") · 우측 아이콘 버튼 38pt.
2. **카테고리 칩 레일** (상단 바 아래 10pt): 칩 = [아이콘 사각 16pt] + 라벨 12.5pt, 패딩 4×11,
   radius full. 순서 고정 `All → Olive Young → Skin Clinic → Hair Salon → Nail & Lash → Personal Color → Head Spa → Etc`.
   **칩은 절대 축소되지 않음**(`flex:none`) — 가로 스크롤 + 우측 34pt 페이드로 잘림 처리.
   단일 선택, 선택 칩은 ink 배경 반전.
3. **지도 영역** (남은 높이 전체): 핀 규칙은 §5.1. 우하단 현위치 FAB 36pt.
4. **하단 탭** (5개, 아이콘 22pt + 라벨 10.5pt): `Map · Stories · Ranking · Saved · My`.
   - 와이어프레임 '전체' → **My(기존 마이페이지)** 확정. '이야기' → Stories(=blog).
   - 이 앱은 지도가 곧 홈(`routes.home = /map`)이므로 별도 홈 탭 없음.

### 4.2 줌 레벨 핀 규칙 (§5.1 상세)

| 줌 | 표시 | 비고 |
|---|---|---|
| Z ≤ 13 | 카테고리색 **dot** 10pt (흰 테두리 1.5) | 그리드 셀 내 5개 이상 → **클러스터**(중립 다크 정원 28pt + 카운트). 클러스터 탭 = 줌 인 |
| Z 14–15 | 기본 dot, **★4.5 이상만 뱃지 승격** | 충돌 시 평점 높은 쪽 우선 |
| Z ≥ 16 | 전체 **평점 뱃지** | 기존 badge collision 해소 로직 재사용 |
| 선택 핀 | **모든 줌에서 항상 뱃지** | 다크 반전 + 확대 + 영업중이면 `LIVE` 병기 |

뱃지 구조: 흰 카드(radius 8, shadow) 안에 [카테고리 아이콘 사각 17pt][평점 12.5pt/700].

### 4.3 S-1 · 검색 홈 (검색바 활성화 시)

1. 상단 바: ‹ 뒤로 + 검색 인풋(자동 포커스).
2. **Recent** 섹션: 최근 검색어 행(시계 아이콘 + 텍스트 + 개별 ✕), 최대 10개 로컬 저장(localStorage),
   헤더에 `Clear` 전체 삭제. 행 탭 = 즉시 검색 실행.
3. **Trending near you · {존}**: 현위치 존(`ZoneKey`) 기준 평점×리뷰수 상위 3. 위치 권한 없으면 "Seoul 전체 인기" 폴백.
4. **Browse by category**: 카테고리 칩(아이콘 포함) — 탭 시 지도 복귀 + 해당 필터 적용.
5. **Popular areas**: `ZONES` 칩 — 탭 시 해당 존으로 지도 이동.

### 4.4 S-2 · 검색 결과 (정확도순)

- 입력 디바운스 150ms 유지.
- 행 레이아웃: [카테고리 아이콘 사각 17pt] [이름(일치 구간 **볼드**) · 카테고리 라벨 /
  ★평점 (리뷰수) · 거리 · 주소 12px muted] [↗ 자동완성 채움 버튼].
- **랭킹 규칙**: ① 이름 완전 일치 → ② 접두 일치 → ③ 부분/태그 일치(카테고리·태그·지역·한글명)
  → 동순위는 거리 → 평점 순. `lib/search.ts` 확장(`rankPlaces(query, origin)`).
- 직접 일치 아래 **Similar nearby**: 최상위 결과와 같은 `Place.type`의 주변 장소 이어서 노출.
- **행 선택 → `/map?place={id}`**: 지도 복귀 + 해당 핀 중심 fly + B-1 반전개 오픈.

### 4.5 B-1 · 바텀시트 (반전개, 높이 ≈ 화면 50%)

핸들(36×4 grip) 아래:
1. 한글명 12px muted → **영문명 19pt/700** + 카테고리 라벨 + 우상단 ✕ 30pt.
2. `★ 4.4 (320)` + `● LIVE` + **`until 23:00` 볼드** — LIVE는 `placeStatus(hours)==="open"`일 때만, 닫힘 시 `Closed · opens 09:00`.
3. 거리 · 주소 (탭 시 확장 ⌄).
4. 사진 3장 (1:1, gap 5) — 사진 없으면 지도 스냅샷 + 카테고리 아이콘 폴백.
5. 액션 행: [공유 38pt][북마크 38pt] ··· [Google][Kakao][Naver] 버튼(§6 딥링크).
- 위로 드래그 → D-1. 아래로 드래그/✕ → 지도 홈.

### 4.6 D-1 · 장소 상세 (풀 스크롤, 단일 페이지 + 앵커 탭)

섹션 사이 **8pt 두께 fill 구분선** (네이버 리듬). 위→아래:

고정 요소 (탭 앵커 대상 아님):

| 요소 | 레이아웃 |
|---|---|
| **포토 헤더** | 콜라주: 좌 큰 이미지(1.4fr, h170) + 우 2단(83+83, `+N` 오버레이). 패딩 8. 플로팅 ‹/공유 38pt 원형(흰 배경). 사진 없으면 지도 스냅샷 1장 + 카테고리 아이콘 |
| **타이틀 블록** | 한글명 12px muted → 영문명 21pt/-0.01em + 타입 라벨 → ★평점(리뷰수) + LIVE + **영업시간 볼드** → 거리·주소·복사 → 칩: 역 도보 · English OK |
| **앵커 탭** | `Home · Services · Photos · Reviews · Info` — 13.5pt, 활성 볼드 + 2pt 언더라인. 앵커 스크롤(화면 전환 아님). 각 앵커 구간에 `scroll-margin-top` ≈ sticky 높이 |
| **주변 랭킹** | Info 뒤 독립 섹션. `Top rated nearby · {타입}`: 같은 `Place.type` × 근접순 상위 4, 평점 정렬. 행: 순번 mono + 썸네일 44 + 이름/존·거리 + ★. 탭 = 해당 상세로 교체 진입 |
| **하단 CTA 바** | 고정: [공유][북마크] ··· [Google][Kakao][Naver] — §6 딥링크. 길찾기 단독 CTA 없음(확정) |

**탭별 앵커 구간 레이아웃** — Home과 Info의 역할 분리: Home은 "지금 방문 판단에 필요한 요약",
Info는 "모든 상세 정보"(네이버 홈/정보 탭 관계와 동일). 중복 없음.

| 탭 (앵커 id) | 구성 | 상세 |
|---|---|---|
| **Home** (`d-home`) | 핵심 요약 + 액션 | ① 핵심 3행: 영업 상태(LIVE/Closed + 오늘 시간) / 주소 + `Copy` / 역·출구·도보 ② **택시 카드**(Show to taxi driver — 한글명+주소 복사) ③ 이벤트 배너: 테두리 없음, fill 배경 radius 12, 패딩 12×14, 🎟 + 제목/설명 + › |
| **Services** (`d-services`) | 시술·가격 | 헤더(`Services · N` + `See all ›`) + 캡션 `Prices confirmed N days ago` + **가로 레일**(HScroll): 카드 폭 128pt 고정·테두리 없음 — 이미지 96pt(radius 12)/이름 650/시간 muted/**가격 750**. `services` 없으면 walk-in 안내 |
| **Photos** (`d-photos`) | 사진 그리드 | 헤더(`Photos · N` + `See all ›`) + 그리드 3col: 큰 1장(2col×2row, h152) + 우측 소형 2장(마지막 `+N` 오버레이) |
| **Reviews** (`d-reviews`) | 평가 + 리뷰 | ① 평가 프롬프트: 중앙 "Been here? Rate your visit" + ☆×5(24pt, 자간 6) ② 요약: 좌 평점 30pt/800+별, 우 5→1 분포 바(h8) / 키워드 칩 `Clean facilities 41` 등(`English OK` 승격) ③ 정렬 행(`Latest·Highest·With photos` + `✎ Write`) ④ 리뷰 행: 아바타 28 + 이름 + ★ + **`✓ Verified` 인라인** + 날짜 / 본문 2줄 / 사진 56 + Helpful ⑤ `More reviews (N)` |
| **Info** (`d-info`) | 전체 상세 정보 | ① 요일별 영업시간(Collapse 펼침, 오늘 볼드) ② 연락·링크: 웹사이트 / 전화 / Instagram ③ 시설·결제: 주차 / 결제수단(Card·GLN) / English OK 상세 ④ 편의시설 칩 랩: `Card OK · Locker · Towel rental · English menu` ⑤ 가격대 `₩` 표기 |

섹션 사이는 `.sec-divider`(8pt fill) 로 구분.

### 4.7 D-2 · 스크롤 상태 (컴팩트 헤더)

- 포토 헤더가 밀려나는 시점에 전환: `⌄(접기) · 장소명 15pt/700 중앙 · 공유 · ⋮` 한 줄 +
  바로 아래 **앵커 탭이 붙어 한 덩어리로 sticky**.
- 탭은 현재 보이는 섹션 따라 활성화(**scroll-spy**, IntersectionObserver).
- `⌄` 탭 = B-1 반전개로 복귀.

## 5. 인터랙션 규칙 요약

- 시트 스냅: `peek / half / full` 3단 유지(기존 MapSheet), 선택 시 half 고정.
- 지도 이동 후 "Search this area" 칩 유지(기존 동작).
- reduced-motion 시 fly 애니메이션 → setView (기존 동작 유지).

## 6. 외부 지도 딥링크 (내 위치 → 장소)

| 버튼 | 경로 링크 (위치 권한 있음) | 폴백 (권한 없음/앱 미설치) |
|---|---|---|
| Google | `https://www.google.com/maps/dir/?api=1&origin={mylat},{mylng}&destination={lat},{lng}&travelmode=transit` | `…/dir/?api=1&destination={lat},{lng}` |
| Kakao | `kakaomap://route?sp={mylat},{mylng}&ep={lat},{lng}&by=PUBLICTRANSIT` | `https://map.kakao.com/link/to/{nameKr},{lat},{lng}` |
| Naver | `nmap://route/public?slat=&slng=&sname=My location&dlat=&dlng=&dname={nameKr}&appname={host}` | `https://map.naver.com/p/search/{nameKr}` |

- `lib/geo.ts`에 `googleDirectionsUrl / kakaoRouteUrl / naverRouteUrl (origin?: LatLng)` 추가.
- 웹 데모 특성상 앱 스킴은 카카오/네이버 웹 URL 우선 + origin 파라미터 지원 형태로 구현.

## 7. 데이터 매핑

| UI | 소스 |
|---|---|
| 카테고리 칩/핀 색·아이콘 | `MAP_CATEGORIES`, `TYPE_ICON`, 신규 `TYPE_COLOR` |
| LIVE / 영업 라벨 | `placeStatus(hours)`, `statusLabel(hours)` |
| 거리/도보 | `haversineKm`, `walkMinutes`, origin = `useLocation()` (폴백 강남역) |
| Services 카드 | `Place.services[]`, `priceConfirmedDaysAgo` |
| 주변 랭킹 | `PLACES.filter(type 동일) → 거리순 상위 4 → 평점 정렬` |
| 검색 랭킹 | 신규 `rankPlaces(query, origin)` — §4.4 규칙 |
| 최근 검색 | `localStorage("essenly.recentSearches")` 최대 10 |

## 8. 디자인 시스템 — 재사용 컴포넌트 계획

원칙: 화면 코드에는 레이아웃만 남기고, 반복 패턴은 `components/ui/`(범용)와
`components/category/`(도메인)로 승격. 기존 토큰·클래스(`globals.css`) 위에 쌓는다.

### 신규

| 컴포넌트 | 파일 | Props (요지) | 사용처 |
|---|---|---|---|
| `CategoryBadge` | `components/category/category-badge.tsx` | `type: PlaceType, size?: 16\|17\|20` | 칩, 핀, 검색 행, 랭킹 행 |
| `CategoryChips` | `components/category/category-chips.tsx` | `value, onChange, showAll?` — 아이콘+색 포함 단일선택 레일 | M-1, S-1 |
| `LiveBadge` | `components/ui/live-badge.tsx` | `hours?: Place["hours"]` — open일 때만 렌더, `until HH:MM` 볼드 포함 | B-1, D-1, 핀(문자열 버전) |
| `RatingLine` | `components/ui/rating-line.tsx` | `rating, count?` — `★ 4.4 (320)` | B-1, D-1, S-2, 랭킹 |
| `SectionHeader` | `components/ui/section-header.tsx` | `title, count?, actionLabel?, onAction/href` | D-1 §6·7·9·11 |
| `HScroll` | `components/ui/h-scroll.tsx` | children — 여백 상쇄 + `overflow-x` 레일 | Services, 리뷰 사진 |
| `RatingBars` | `components/ui/rating-bars.tsx` | `dist: number[5]` | D-1 리뷰 요약 |
| `AnchorTabs` | `components/ui/anchor-tabs.tsx` | `sections: {id,label}[]` — sticky + scroll-spy | D-1/D-2 |
| `MapLinkButtons` | `components/directions/map-link-buttons.tsx` | `place, origin?` — Google/Kakao/Naver 3버튼 | B-1, D-1 CTA |
| `ImgPh` | `components/ui/img-ph.tsx` | `w?/h?/label?` — 사진 플레이스홀더(X박스) | 전 화면 |

### 수정

| 대상 | 변경 |
|---|---|
| `lib/data.ts` | `TYPE_COLOR` 추가 |
| `lib/geo.ts` | 경로 딥링크 3종 (origin 옵션) |
| `lib/search.ts` | `rankPlaces()` — 정확도 랭킹 + 일치 구간 + similar nearby |
| `globals.css` | `--c-*` 카테고리 토큰, 핀 뱃지/dot/클러스터 클래스, 칩 아이콘, 페이드 레일 |
| `map-view.tsx` | 줌 규칙 렌더러 + 카테고리색 + 현위치 빨간색 + 클러스터 |
| `map-screen.tsx` | `CategoryChips` 교체 |
| `map-sheet.tsx` | 선택 카드 → B-1 스펙 |
| `app/search/page.tsx` | S-1/S-2 재구성, 선택 → `/map?place=` |
| `place-detail-body.tsx` + `app/place/[id]` | D-1/D-2 재구성 |
| `bottom-nav.tsx` | `Menu→My`, `Blog→Stories` 라벨 |
| `place-cta-bar.tsx` | `MapLinkButtons` 통합 |

## 9. 구현 계획 (병렬 트랙)

```
[Track 0 — 선행, 직렬]  lib(data/geo/search) + globals.css 토큰 + ui 컴포넌트 10종
[Track A — 병렬]        지도: map-view 줌 규칙 · map-screen 칩 · map-sheet B-1 · ?place= 진입
[Track B — 병렬]        상세: place-detail D-1/D-2 · AnchorTabs · CTA
[Track C — 병렬]        검색: S-1/S-2 · recent/trending · rankPlaces 연동 · bottom-nav
```

Track 0 완료 후 A/B/C 동시 진행 → 통합 검증(`tsc`, 테스트, 실행 확인).

## 10. 수용 기준 (AC)

1. 칩·핀·검색 행의 카테고리 아이콘/색이 §3.1 표와 일치하고, 칩이 어떤 폭에서도 찌그러지지 않는다.
2. 줌 13 이하에서 dot/클러스터, 16 이상에서 전체 뱃지, 선택 핀은 항상 뱃지 + (영업중일 때) LIVE.
3. 검색: 빈 화면에 Recent/Trending/Browse가 뜨고, 입력 시 정확도순 리스트 + Similar nearby,
   행 선택 시 지도 복귀 + 해당 시트 반전개.
4. 상세: 스크롤 시 컴팩트 헤더 + 탭 sticky 전환, 탭이 섹션 따라 활성화, Services 가로 스크롤.
5. Google/Kakao/Naver 버튼이 위치 권한 여부에 따라 §6 URL로 열린다.
6. `placeStatus`가 closed면 LIVE가 어디에도 보이지 않는다.
7. 기존 테스트 전체 통과 + 신규 로직(rankPlaces, TYPE_COLOR, 딥링크) 테스트 추가.

---

## 11. 지하철 라우트 컨트롤러 v2 (2026-07-19 추가 결정)

- **스냅 3단 리사이즈**: compact(~22%, 요약 한 줄 + Live 링크) / half(~48% 기본, 요약+역 내비게이터+반경·카테고리 필터+리스트 첫 행) / full(~85%, 스텝 카드·노선 스트립 포함 전체). 크기별로 내용을 큐레이션해서 표시(잘라내기 아님). 드래그 그립 + 탭 사이클, 지도 focus inset은 스냅을 따라감.
- **Live transit 상시 노출**: 스텝 카드 안에만 있던 "Check live transit"을 요약 행의 컴팩트 아이콘 링크로 승격 — 모든 스냅에서 보임. 구글맵 transit 딥링크(출발역→도착역).
- **경유역(Via)**: ① Edit 폼에 "+ Add via station" (최대 2개, 칩으로 제거 가능) ② 노선 스트립/내비게이터에서 역 포커스 시 "Add as via" 액션 → 올바른 구간 순서로 삽입, `findRouteVia(from, vias[], to)`로 다구간 경로 재계산. 제목·요약에 경유 반영.
- **반경 컨트롤 축소**: 500m/1km/2km 세그먼트를 높이 ~40pt·라벨 13pt로 축소.
- **폴리시**: 스텝 레일 우측 페이드, 현재 역 카드가 prev/next 바를 가리지 않게 폭 조정, half 스냅에서 Near {station} 헤더+첫 행이 접힘 없이 보이게.
