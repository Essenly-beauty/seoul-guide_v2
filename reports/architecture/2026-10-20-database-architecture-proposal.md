# MYSEOULDROP 데이터베이스 구조 — 현재와 바꿀 방향 (2026-10-20, 2판)

작성 배경: 10/20 QA에서 “관리자에서 바꾼 값이 지도·검색·저장 목록에는 안 보인다”(영업시간 표시·English OK, 결함 F1·F7)는 구조적 문제가 나왔고, 사용자가 DB 구조를 어떻게 바꿀지 고민해 달라고 했다. 1판은 결제·번역·보상·운영 큐까지 한 번에 묶어 Codex 검토에서 “범위 과다, 권한·갱신 계약 누락”으로 5/10을 받았다. 2판은 **범위를 ‘공개 장소 읽기 계약’ 하나(P0)로 좁히고**, 현재 상태 서술을 코드·마이그레이션 기준으로 바로잡았다. 결제·번역·보상·운영 큐는 §6에 ‘별도 제안이 필요한 이유’만 남겼다.

## 1. 지금 구조 (2026-10-20 작업 트리, 미커밋 포함)

수치: 마이그레이션 파일 25개, `create table` 29개(이후 변경·삭제 포함이라 현재 테이블 수와 다를 수 있음), 함수 생성·재정의문 87개, `create policy` 50개(일부는 이후 대체됨). 아래는 도메인별 핵심만.

| 도메인 | 테이블·코드 | 비고 |
| --- | --- | --- |
| 장소 디렉터리 | **원본 테이블 없음.** `lib/generated/*-places.ts`·`place-photos.ts`를 `lib/data.ts`가 합쳐 `PLACES`를 만든다. 그 과정에서 영문 이름 규칙·검증 패치(`VERIFIED_PLACE_PATCHES`)·비공개 ID(`HIDDEN_PLACE_IDS`)·미검증 큐레이션 제외·부산/경기 제외·주소 없는 행 제외를 적용한다 | 정적 번들. 영업시간·englishOk·좌표·사진이 빌드 시 고정 |
| 업체↔장소 공개 | `merchant_publications(merchant_id, place_id, published)`, `published_merchant_catalogs(place_id, services jsonb)`(공개 범위를 **place_id·services로 제한**), `merchant_store_profiles`(name_en·introduction·english_ok·notice·**show_photos**), `merchant_profile_reviews`(검수 대기 필드), `merchant_media`(state) | 공개 RPC `public_store_profile`·`booking_catalog`·미디어 조회가 “업체 활성·게시·대상 가시성”을 검사한 값만 내보냄 |
| 병합 지점(코드) | `lib/place-profile.ts` `mergePublicPlaceProfile`: 이름·주소·소개·englishOk·연락처·안내·사진 표시 설정을 정적 장소에 덮어씀(**영업시간은 병합하지 않음**; 주소가 바뀌면 좌표 신뢰도를 `area`로 낮춤). 사진은 `lib/place-profile-server.ts`·`lib/place-media.ts`의 별도 경로. 상세(`app/place/[id]`)와 예약(`app/place/[id]/book`)만 병합 | 지도·검색·저장 목록 등은 병합하지 않음 |
| 업체 설정 | `merchants`, `merchant_memberships`, `merchant_categories`, `merchant_services`, `merchant_schedules`(hours/breaks/blocks/overrides jsonb), `merchant_staff`(+name_en·introduction_en), `merchant_staff_menus`, `merchant_staff_schedules`, `merchant_reservation_rules`, `merchant_booking_settings`(confirmation_mode, payment_mode) | 검증·잠금은 plpgsql RPC. 설정 변경에 `a_booking_lock`·`booking_guard`가 걸려 기존 예약과 충돌하면 거절 |
| 예약 | `customer_bookings`(당시값 스냅샷, `(customer_id, request_id)` 멱등 + fingerprint 비교, status 5종, cancelled_by), `customer_booking_events`, `merchant_booking_customers`(업체별 식별자 id, `auth_customer_id` 실제 계정 연결, `phone_key` 정규화 전화 평문, notes), `booking_messages` | 잠금: 고객 요청 702021, 업체 702020, 예약 행 `for update`, 카탈로그 갱신 617923. `payment_mode='pay_at_venue'` 체크는 `customer_bookings`와 `merchant_booking_settings` 양쪽 |
| 고객 | `favorites`, `profiles`(jsonb), `ratings`→`published_reviews`(is_public ∧ ¬hidden ∧ 본문 있음), `review_reports`, `shared_lists(place_ids text[])`, `feedback` | item_id·place_id는 정적 장소 id(text) |
| 운영·관측 | `merchant_audit_events`, `client_errors`, `web_vitals` | 같은 스키마 |

권한 패턴(유지해야 함): public 스키마의 invoker 래퍼 → private `security definer` 함수, 빈 `search_path`, 함수별 `execute` 권한, 함수 안에서 인증·업체 권한 검사. 테이블 직접 조회는 RLS로 막고 공개 데이터는 **투영 테이블의 지정 컬럼만** 노출한다(`published_merchant_catalogs`가 그 예).

`PLACES`/`getPlace()`를 직접 읽는 코드(테스트 제외, 25파일): `lib/data.ts`, `lib/search.ts`, `lib/shared-lists.ts`, `lib/place-profile-server.ts`, `components/map/{map-screen,map-sheet,map-view,filter-sheet}.tsx`, `components/place/place-detail-body.tsx`(주변 장소), `components/ui/favorite-button.tsx`, `app/search/page.tsx`, `app/favorites/page.tsx`, `app/places/[category]/page.tsx`, `app/menu/page.tsx`, `app/mypage/reviews/**`(3), `app/place/[id]/{book/page,opengraph-image}.tsx`, `app/sitemap.ts`, `app/api/bookings/route.ts`, `app/api/places/[id]/{availability,booking,catalog,location}/route.ts`. 예약 API들은 `getPlace()`로 장소 존재를 검사하므로, 장소 공급원을 바꾸면 **예약 API의 존재 검사도 같은 공급원**을 봐야 한다.

## 2. 고칠 문제 (이번 범위)

1. **두 개의 진실.** 영어 응대는 정적 `englishOk`와 `merchant_store_profiles.english_ok`에, 이름·주소도 정적값과 승인값에 따로 있다. 상세·예약은 병합하지만 지도·검색·저장 목록·공유 목록·카테고리·사이트맵·OG 이미지는 정적값만 읽는다(F7).
2. **영업시간 표시.** 관리자 일정은 예약 가능 시간 계산에만 쓰이고, 고객이 보는 “Hours”는 정적 `hours`다. 관리자 화면은 “고객 화면에도 반영”이라고 안내한다(F1). 단, **관리자 일정 = 고객에게 보여줄 영업시간인지**는 아직 정의되지 않았다(§5 결정 1). `lib/places.ts`의 영업 상태 계산은 방문자 로컬 시간 기준이고 예약은 `Asia/Seoul` 기준이라, 공급원을 바꿔도 이 시간대 차이는 따로 맞춰야 한다.

F4(출근표 ‘조회 필요’)는 관리자 입력 검증 경로의 버그이며 읽기 투영과 무관하다. 이 제안으로 해결되지 않는다.

## 3. 제안: 공개 장소 스냅샷 (P0)

핵심: **고객이 보는 모든 화면과 예약 API의 존재 검사는 하나의 공개 장소 스냅샷을 읽는다.** 정적 디렉터리는 그대로 두고(코드 번들), DB에는 “업체가 덮어쓴 공개 필드”만 투영한다. 디렉터리 전체를 DB로 옮기는 일은 이번 범위에서 뺀다(정적 번들 필터 규칙·검증 패치를 그대로 옮겨야 하고, 이득이 작다).

```
public.published_place_overrides           -- 업체 연결 장소의 공개 덮어쓰기 값 (한 장소당 한 행)
  place_id text primary key,               -- 정적 디렉터리 id (merchant_publications.place_id)
  name text, name_kr text, address text, english_ok boolean,
  contact_phone text, notice text, show_photos boolean,
  hours jsonb null,                        -- {weekday: [{open,close}], exceptions: [{date, open?, close?, closed}]} 다음 60일
  hours_source text,                       -- 'merchant_schedule' (현재 유일)
  booking_enabled boolean, booking_mode text,
  photos jsonb,                            -- [{url,width,height}] 공개 조건 통과분만, show_photos=false면 빈 배열
  review_count int, review_avg numeric,    -- published_reviews 기준 집계 캐시
  geo_hint text,                           -- 'verified' | 'area' (주소 변경 시 'area')
  updated_at timestamptz, version bigint
```

- **공개 범위**: 이 테이블만 `anon`/`authenticated`에 `select` 허용(컬럼 전부 공개 전제; `merchant_id`는 넣지 않는다 — 현재 `published_merchant_catalogs`와 같은 원칙). 쓰기는 `private.refresh_place_override(place_id)`(security definer, invoker 노출 없음)만 한다.
- **갱신 규칙**(어느 변경이 어느 장소를 다시 계산하나):
  - `merchant_publications` insert/update/delete → **이전 place_id와 새 place_id 모두** 재계산(게시 해제·연결 변경 시 이전 행 삭제).
  - `merchants`(status·booking_enabled·display_name·contact·address), `merchant_store_profiles`, `merchant_profile_reviews`(승인 반영 시), `merchant_schedules`, `merchant_booking_settings`, `merchant_reservation_rules`, `merchant_media`(state·대상 가시성), `merchant_services`/`merchant_categories`/`merchant_staff`(가시성 — 사진 공개 조건에 영향) → 해당 업체의 게시 place_id 재계산.
  - `ratings`(is_public·hidden·body 변경) → place_id 재계산(집계만).
  - 날짜 경과(휴무 60일 창) → 하루 1회 전체 재계산 작업(크론).
  - 트리거는 **행 단위 AFTER 트리거에서 큐 테이블 `private.place_refresh_queue(place_id)`에 넣고**, 같은 트랜잭션 끝(deferred constraint trigger)에서 한 번 계산한다. 예약 RPC의 잠금(702020/702021/617923) 안에서 추가 잠금을 잡지 않도록 재계산 함수는 **잠금을 잡지 않고** 현재 커밋된 값을 읽어 upsert만 한다(마지막 쓰기 승리 + `version` 증가).
  - 백필: `select private.refresh_all_place_overrides()`로 전체 생성. 누락 검출: `merchant_publications.published=true`인데 행이 없는 place_id를 찾는 점검 쿼리.
- **읽기 계약**:
  - 서버: `getPublishedPlace(id)` = 정적 `getPlace(id)` + `published_place_overrides` 한 행 병합(현재 `mergePublicPlaceProfile`의 규칙 유지: 이름·주소·소개·englishOk·연락처·안내·사진 표시; 주소 변경 시 좌표 신뢰도 하향). 영업시간은 §5 결정 1 뒤에 병합.
  - 목록(지도·검색·저장·카테고리·공유): 요청마다 1,000행을 읽지 않도록 **스냅샷 JSON**(`/api/places/overrides.json`, Cache-Control s-maxage 300 + `version` 기반 ETag)을 한 번 받아 정적 `PLACES`에 합친다. 1,000곳·덮어쓴 행 수십 개면 수 KB다. 긴급 비공개는 스냅샷 TTL(5분) 안에 반영된다 — 허용치는 §5 결정 2.
  - 예약 API의 존재 검사(`getPlace`)는 그대로 정적 디렉터리를 쓴다(장소 id의 공급원은 변하지 않으므로).
- **코드 전환 순서**(점진): ① 테이블·함수·백필 → ② `/api/places/[id]/profile` 응답을 투영에서 생성해 **기존 응답과 비교**(동일해야 함) → ③ 상세·예약 페이지를 투영 기반 `getPublishedPlace`로 전환 → ④ 지도·검색·저장·카테고리·공유·사이트맵·OG를 스냅샷 JSON 병합으로 전환 → ⑤ 구 경로(`public_store_profile` 직접 호출) 제거. 각 단계 뒤 `scripts/test-partner-profile-http.cjs`·`test-integrated-booking-http.cjs`와 Playwright 화면 점검을 돌린다.
- **롤백**: 트리거는 `alter table … disable trigger`로 끄고, 코드는 단계별로 되돌린다. 투영 테이블은 읽기 전용 캐시라 삭제해도 원본은 영향이 없다.
- **개인정보**: 투영에는 고객 데이터가 없다. 계정 삭제 흐름(예약 연락처·메모·식별자·메시지 삭제)은 손대지 않는다. 리뷰 집계는 `published_reviews`와 같은 정의를 쓴다.

효과: F7(지도 English OK·승인된 영문 이름)은 ④에서, F1(영업시간 표시)은 §5 결정 1 뒤 `hours` 병합으로 해결된다. 관리자 화면의 “고객 화면에도 반영돼요” 문구는 그때까지 “예약 가능 시간에 반영”으로 고친다.

## 4. 작업 크기와 검증

| 단계 | 내용 | 검증 |
| --- | --- | --- |
| ① | 마이그레이션: 테이블·큐·재계산 함수·트리거·백필·권한 | 로컬 DB 적용, `scripts/test-partner-operations-db.cjs` 통과, 누락 검출 쿼리 0건 |
| ② | 프로필 API 이중 생성·비교 | 기존 응답과 diff 0 |
| ③ | 상세·예약 전환 | Playwright 상세·예약 흐름 재실행 |
| ④ | 목록 전환 + 스냅샷 JSON | 지도 요약 English OK 토글 검증(F7 회귀), 검색·저장 목록 이름 검증 |
| ⑤ | 구 경로 제거 | 전체 테스트·typecheck·lint |

일정은 각 단계의 검증이 끝나야 다음으로 가는 조건부이며, 사람 수·검토 시간에 따라 다르므로 날짜를 적지 않는다.

## 5. 먼저 정할 것

1. **영업시간의 의미**: `merchant_schedules`(예약 가능 시간)를 고객에게 ‘영업시간’으로 보여줄지, 아니면 별도의 ‘안내용 영업시간’ 필드를 둘지. 휴게시간·날짜별 단축/연장도 표시할지. 시간대는 `Asia/Seoul` 고정으로 통일할지.
2. **공개 반영 지연 허용치와 긴급 비공개 처리 시간**(스냅샷 TTL 5분 제안).
3. **필드 우선순위와 빈값 의미**: 업체 승인값 > 디렉터리값(제안). 업체가 빈 문자열로 저장하면 ‘디렉터리값으로 되돌림’인지 ‘빈값 표시’인지.
4. **장소 id·업체 연결의 수명주기**: 연결 해제·재연결·업체 정지 시 공개 값이 어떻게 사라지는지(제안: 연결 해제 즉시 투영 행 삭제 → 디렉터리값으로 복귀).

## 6. 이번 범위에서 뺀 것 (각각 별도 제안)

- **결제·정산**: 플랫폼 수납·예약금·환불·결제사·정산 주기가 결정되기 전에는 테이블 뼈대도 넣지 않는다. `payment_mode` 체크 제약이 두 테이블에 있고 생성 RPC가 `pay_at_venue`를 직접 기록하므로, 결정 뒤 상태 전이(결제 대기 점유·만료, 취소↔결제 성공 경합, 부분·중복 환불, 정산 확정 후 조정)와 웹훅 멱등 키 범위를 설계한다.
- **다국어**: `_en` 컬럼을 옮기려면 RPC의 행 타입·컬럼 참조·쓰기 권한을 함께 바꿔야 하고, 승인 번역 유지 + 새 초안 검수 모델이 필요하다. 운영팀 승인 주체·기계 번역 사용 여부부터 정한다.
- **리뷰 보상·쿠폰**: ‘첫 리뷰’가 사용자 기준인지 장소 기준인지, 중복 지급·삭제 후 재작성 악용·쿠폰 동시 사용 제한을 규칙으로 정한 뒤 설계한다. `reviews.booking_id`로 방문 인증을 하려면 작성자 소유·동일 장소·완료 상태를 서버에서 검증해야 한다.
- **운영 큐 통합**: 상태를 새 큐에 복제하면 승인 충돌이 생긴다. 먼저 기존 검수 원본(`merchant_profile_reviews`·`merchant_media`·`review_reports`)을 조회하는 **통합 읽기 모델**로 운영 화면을 만들고, 쓰기는 각 원본 RPC를 그대로 쓴다.
- **알림 아웃박스·텔레메트리 분리·shared_lists 정규화**: 각각 작은 변경이지만 이번 문제와 무관하므로 분리한다.
