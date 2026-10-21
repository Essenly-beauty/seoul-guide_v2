# MYSEOULDROP 데이터베이스 구조: 현재와 바꿀 방향 (2026-10-21, 3판)

작성 배경: 10/20 QA에서 "관리자에서 바꾼 값이 지도·검색·저장 목록에는 안 보인다"는 구조 문제가 나왔다(영업시간 표시는 F1, English OK는 F7).

- 1판(5/10)은 범위가 너무 넓었다.
- 2판(7/10)은 범위를 '공개 장소 읽기 계약'(P0)으로 좁혔다. 그러나 갱신 모델, 응답 재현, 사진, 신선도, 검증 부분이 틀리거나 비어 있었다.
- 3판은 2판의 범위와 단계 구성(①~⑤)을 그대로 둔다.
- 갱신은 **원 트랜잭션 안의 동기 갱신**으로 확정했다. 기존 카탈로그 투영과 같은 갱신 잠금(617923)을 쓰고, 트리거만 문장 단위로 단다.
- 투영 열은 **지금 공개 응답을 그대로 재현하는 원값**으로 다시 정했다.
- 장소 차단은 P0에 넣었고, 리뷰 집계는 P0에서 뺐다.

이 문서는 제안이다. 이번에는 코드와 DB를 바꾸지 않는다. 사실관계는 2026-10-21 작업 트리(미커밋 포함)를 기준으로 했다.

## 0. 2판 검토 지적 → 3판 반영

| 지적 | 3판 반영 | 위치 |
| --- | --- | --- |
| 1. 지연 트리거 안의 '잠금 없는 재계산'은 거짓이다. 원 트랜잭션 안에서 돌고, 큐 INSERT와 upsert가 잠금을 잡는다. 행 이벤트는 합쳐지지 않는다. 다른 원천을 바꾼 트랜잭션이 낡은 결과로 덮을 수 있고, version++로는 막지 못한다 | 지연 트리거, 큐, '잠금 없음'을 모두 뺐다. 갱신은 원 트랜잭션 안의 동기 갱신으로 확정했다. 트리거는 이벤트별 문장 단위 AFTER 트리거(transition table)라서, 한 문장이 바꾼 행을 업체당 한 번 uuid 순으로 갱신한다. 갱신 잠금(617923, 업체 키)을 먼저 잡고 읽는다. 잠금 불변식은 `[702021] → 702020 → 원천 행 → 617923 → 투영 행`이다. 617923을 잡은 뒤에는 원천 행을 잠그지 않으므로 투영에서 원천으로 가는 FK를 두지 않는다. 702020 없이 617923을 잡던 경로(운영자 사진 SQL, 수리, 백필)는 702020을 먼저 잡게 했다. 갱신 함수에는 lock_timeout을 뒀다. 실패하면 원 저장까지 롤백한다. 변경이 사라지지 않는 이유는 전제(TRUNCATE, 규칙 변경, 트리거 끄기, 쓰기 권한)와 함께 적었다. 큐+워커는 기각 이유와 전환 조건만 남겼다 | §4.3 |
| 2. 투영 열로 `/profile`을 재현할 수 없다. nameEn·소개·contactEmail이 없고, 파생 name으로는 nameEn을 복원할 수 없다. updatedAt과 재계산 시각도 섞여 있다 | 필드별 출처·검증 표를 기준으로 원값 열만 둔다. 원천 버전 `profile_updated_at`(= 응답 updatedAt)과 투영 시각 `built_at`을 나눴다. name·geo_hint 같은 파생값은 DB에 두지 않는다 | §3.1, §4.2 |
| 3. 사진 계약이 맞지 않는다. `{url,width,height}`로는 MerchantMedia를 대체할 수 없다. show_photos=false에서 []를 돌려주는 것도 의미가 다르다 | MerchantMedia 9개 키를 재현하는 `published_merchant_media`(store·menu·staff 모두)를 둔다. show_photos는 표시 플래그로만 투영한다. 헤더 숨김, 정적 사진 대체, 메뉴·담당자 사진은 표면별로 정의했다. 사진 바이트는 투영 행이 있을 때만 객체 경로를 주는 함수로 받으므로 Storage RLS를 그대로 거친다 | §3.2, §4.2, §4.4, §4.7 |
| 4. '5분 안 긴급 비공개'는 보장되지 않는다. 투영 행 삭제는 장소 비공개가 아니다 | 상태를 업체 연결 해제(디렉터리값으로 복귀), 게시됐지만 디렉터리 밖, 장소 차단으로 나눴다. 차단(`place_blocks`)은 P0에 넣었다. 차단은 서버 `getVisiblePlace`·사진 바이트·스냅샷으로 전달하고, 런북에서 CDN을 비운다. 표면별 최악 지연, 상세 30초 새로고침, 구독형 클라이언트 진입점, CDN·ETag 시험도 적었다 | §4.5, §4.6, §5.5 |
| 5. 행 version으로는 응답 전체의 ETag를 만들 수 없다. geo_hint는 정적 원본과 동기화해야 한다 | ETag는 정렬·정규화한 스냅샷 본문(배포 build 포함)의 해시로 한다. 삭제·재생성·배포가 모두 반영된다. geo_hint는 지금처럼 병합할 때 계산한다 | §4.6, §4.2 |
| 6. 리뷰 집계는 이 투영에 맞지 않는다 | P0에서 뺐다. 후속 설계와 함께, 증분 갱신이 여러 장소 행을 잠글 때의 교착 위험을 적었다 | §7 |
| 7. 검증, 권한, 롤백을 구체적으로 써야 한다 | 권한 DDL을 적었다(service_role도 SELECT만). 검증은 한 스냅샷에서 도는 양방향 일치 점검, 매시간 자동 점검, 역할×표 기대값, 동시성 시험 12종(요구된 4종과 역순 교착 시험 포함)이다. 롤백은 새 트리거만 이름으로 끄고, 변경 전 트리거 스냅샷과 비교해 확인한다 | §4.7, §5, §6.2 |
| 작은 오류: map-view는 주석에만 PLACES가 나온다. '직접 소비 25개'는 분류가 섞였다. 예약 존재 검사 서술이 서로 모순된다 | 공급자 1개, 직접 소비 23개(서버 10, 클라이언트 13), 간접 영향으로 나눴다. map-view는 PLACES를 읽지 않지만 마커를 만들 때 name·nameKr을 굳히므로 표시값의 직접 소비자로 옮겼다. 계약은 "존재는 디렉터리 ∧ 차단 아님, 표시값은 병합 결과, 예약 허용은 기존 RPC"로 정했다. 예약 뒤 위치와 파트너 도구는 따로 정했다 | §1.5, §3.5 |
| §1 서술이 코드와 다르다 | 바로잡은 내용: 설정 쓰기 대부분은 PostgREST 직접 쓰기다. `booking_guard`는 3개 표에만 있다. 617923은 카탈로그 갱신 잠금이다. 카탈로그 투영에도 merchant_id가 있다(권한만 없음). 지도 시트도 병합한다. `getPublishedPlace`는 이미 있다. 승인 함수와 스케줄러는 없다 | §1 |
| 3판 초안 검토에서 더 찾은 것 | `/location` 계약과 이름 규칙 다섯 곳, 공개 RPC 호출 6곳과 ⑤ 관문을 적었다. 사용자 소유 참조(내 리뷰·즐겨찾기), 'Bookable' 칩의 뜻, 표면별 실패 의미, OG 카드 캐시(1년 immutable), 운영자 잠금 키의 uuid 정규형도 다뤘다 | §3.3~§3.5, §4.5, §4.6, §6.1 |

## 1. 지금 구조

### 1.1 테이블과 쓰기 경로

마이그레이션은 25개이고 파일명 순서대로 적용된다. 테이블 29개는 모두 `public`에 있고, `private`에는 함수만 있다.

| 도메인 | 테이블·코드 | 비고 |
| --- | --- | --- |
| 장소 디렉터리 | 원본 테이블은 없다. `lib/data.ts`가 인라인 큐레이션과 생성 배열 7개를 `withSource`로 정규화한다(자리표시 주소를 ''로, `PLACE_PHOTOS` 부착, 큐레이션 평점 제거). 결과는 `CATALOGUE_PLACES`(1,122)다. 이어서 영문 이름 규칙과 `VERIFIED_PLACE_PATCHES`를 적용한다. 필터에서 미검증 큐레이션, 정적 제외 목록 `HIDDEN_PLACE_IDS`, 부산·경기, 빈 주소, provisional이 아닌 `area` 핀을 뺀다. 결과는 `PLACES`(1,008)다. 개발 모드에서만 예약 미리보기 장소를 붙인다 | 생성 파일은 오프라인 스크립트 산출물이다. 값이 바뀌어도 빌드·배포 뒤에만 보인다. 카탈로그는 클라이언트 청크 하나(약 761KB, gzip 약 136KB, 10/20 빌드)에 들어 있고 20개 경로가 받는다. 서비스 워커는 데이터를 캐시하지 않는다 |
| 업체↔장소 | `merchant_publications`(merchant_id PK, place_id는 unique이고 ASCII 정규식 ≤200자, published). `published_merchant_catalogs`(merchant_id PK이고 FK cascade로 merchants를 가리킨다. 열 권한으로 숨기고, 공개 열은 place_id·services다) | 정규식 때문에 올리브영 366곳과 다이소 284곳의 id는 업체에 연결될 수 없다. 연결·게시·해제는 service_role(운영자 SQL)만 하고, 감사 기록이 남지 않는다 |
| 업체 공개 원천 | `merchants`(display_name·contact_phone·contact_email·address·status), `merchant_store_profiles`(name_en·introduction_ko/en·english_ok·notice·show_photos), `merchant_media`(state), `merchant_profile_reviews`(검수 대기 필드, 공개 안 됨) | `show_photos`(20261020123000)는 로컬에만 적용됐다. 승인 함수가 없다. 매장 사진 pending→active와 검수 approved는 운영자가 SQL로 바꾼다 |
| 공개 읽기 | RPC `public_store_profile`, `public_merchant_media`, `booking_catalog`. 모두 anon이 실행할 수 있고, 요청마다 돌며 캐시가 없다 | `public_merchant_media` 원본에는 `objectPath`(`<merchant_id>/<id>.webp`)가 들어 있다. 사진 바이트 라우트는 이 경로로 내려받는다. 그래서 anon이 merchant_id를 볼 수 있다(앱은 목록 응답 전에 지운다) |
| 업체 설정 쓰기 | 카테고리·서비스·일정·예약 규칙·담당자·담당자 메뉴·담당자 일정은 PostgREST 직접 쓰기다(RLS + 열 권한, 요청당 한 문장). 매장 정보·담당자 영문 프로필·사진·예약·메모·메시지는 RPC로 쓴다 | 파트너는 `merchants`를 직접 쓰지 못하고 연락처만 RPC로 바꾼다. `merchant_publications`·`merchant_store_profiles`·`merchant_profile_reviews`·`merchant_media`·`merchant_booking_settings`는 service_role이나 definer RPC만 쓴다 |
| 예약 | `customer_bookings`(당시값 스냅샷, `(customer_id, request_id)` 멱등 + fingerprint, status 5종), `customer_booking_events`, `merchant_booking_customers`, `booking_messages` | 예약 RPC는 이 네 표만 쓰고 투영 원천은 건드리지 않는다 |
| 고객·리뷰 | `favorites`, `profiles`, `ratings`, `published_reviews`, `public_reviews`, `review_reports`, `shared_lists`, `feedback`. 세부는 표 아래 목록 | 앱은 공개 리뷰 집계를 읽지 않는다. 화면의 별점·개수는 모두 외부에서 가져온 정적값(`Place.rating/ratingCount`)이다. 약관과 `lib/reviews.ts`의 'first name' 문구는 실제 값('User')과 다르다(별도 수정) |
| 운영·관측 | `merchant_audit_events`, `client_errors`, `web_vitals` | |

고객·리뷰 표 세부:

- `ratings`: 사용자×장소당 1행이다. place_id는 FK 없는 텍스트(≤1024자)다. 사용자는 place_id·rating·body·is_public을 바꿀 수 있지만 hidden은 바꿀 수 없다.
- `published_reviews`: 투영 테이블이다. 트리거 `review_internal.sync_published_review`가 한 행씩 유지하고, 사용자 id가 없으며, anon이 SELECT할 수 있다.
- `public_reviews`: 뷰다. security_invoker이고 display_name은 상수 'User'다.
- `review_reports`: insert 전용이다. 신고자가 3명이 되면 hidden이 된다.

### 1.2 잠금과 트리거

| 잠금(모두 `pg_advisory_xact_lock`) | 키 | 잡는 곳 |
| --- | --- | --- |
| 702021 | 고객 uuid + request_id | `booking_create`의 멱등 처리. 업체가 달라도 직렬화된다 |
| 702020 | 업체 uuid(`tenant::text`) | `a_booking_lock`(BEFORE ROW, 11개 표: merchants, merchant_publications, merchant_booking_settings, merchant_categories, merchant_services, merchant_schedules, merchant_reservation_rules, merchant_staff, merchant_staff_menus, merchant_staff_schedules, merchant_store_profiles), 파트너·예약 RPC의 첫 단계, 계정 삭제 트리거 2개 |
| 617923 | 업체 uuid | 카탈로그 갱신 `private.refresh_merchant_catalog`. AFTER 트리거 `public_catalog_sync` 안에서만 잡는다. 예약 RPC의 잠금이 아니다 |

- 잠금 순서는 `[702021] → 702020 → 원천 행 잠금(FOR UPDATE) → 617923 → 투영 행`이다.
  - 617923은 `a_booking_lock`이 있는 표의 AFTER 트리거에서만 잡힌다. 그래서 지금은 항상 같은 업체의 702020 안에 들어간다.
  - 여러 업체를 uuid 순으로 잡는 곳은 계정 삭제 트리거 2개뿐이다.
  - 행 트리거(`a_booking_lock`, `public_catalog_sync`)는 한 행의 OLD·NEW만 정렬한다. 그래서 여러 업체에 걸친 한 문장은 키를 행 처리 순서대로 잡는다. `test-public-catalog-db.cjs`의 픽스처도 4444…를 1111…보다 먼저 잡는다.
  - 풀러가 transaction 모드라서 세션 잠금은 쓰지 않는다.
- `a_booking_lock`이 없는 표는 `merchant_media`, `merchant_profile_reviews`, `merchant_memberships`다. 파트너 RPC는 702020을 직접 잡지만, 운영자 SQL은 아무 잠금도 잡지 않는다.
- `booking_guard`(기존 예약 재검사)는 `merchant_schedules`, `merchant_reservation_rules`, `merchant_staff_schedules` 3개 표에만 있다. 나머지 설정 표는 잠금만 잡는다.
- `partner_touch`(BEFORE UPDATE)는 updated_at을 `greatest(clock_timestamp(), old + 1µs)`로 올린다. 이 값을 낙관적 잠금 토큰으로 쓴다.
- `partner_audit`(AFTER, 13개 표)은 `merchant_publications`에 없다. 그래서 게시, 해제, 재연결은 감사되지 않는다. 행위자 조건이 맞지 않으면 42501을 낸다.
- 같은 이벤트의 트리거는 이름의 바이트 순서로 돈다.
  - BEFORE: `a_booking_lock` → `partner_staff_menu_limit` → `partner_touch`
  - AFTER: FK의 `RI_ConstraintTrigger_*` → `booking_guard` → `partner_audit` → `public_catalog_sync`
- 지연(deferred) 트리거, 제약 트리거, 문장 단위 트리거, 큐 테이블, `pg_cron`은 없다. 예약된 작업은 GitHub Actions(uptime 30분, 공개 smoke 6시간)뿐이고, DB를 점검하는 작업은 없다.
- 이 제안과 무관한 기존 위험이 하나 있다.
  - 직접 UPDATE/DELETE는 행 잠금을 먼저 잡고, BEFORE 트리거에서 702020을 잡는다. RPC는 702020 → FOR UPDATE 순서다.
  - 이 역순 때문에 `merchant_staff`, `merchants`, `merchant_store_profiles`에서 40P01이 날 수 있다.
  - 이 경우를 다루는 시험은 없다(§9).

### 1.3 권한 패턴 (새 객체도 따른다)

- public invoker 래퍼가 private SECURITY DEFINER 구현을 부른다. 구현에는 래퍼와 같은 역할에만 EXECUTE를 준다. 모든 definer 함수는 빈 `search_path`와 스키마를 붙인 이름을 쓴다.
- anon과 authenticated 모두 `private` 스키마 USAGE가 있다(authenticated는 20261018080122:405, anon은 20261019191959:354).
  - 따라서 스키마 이름은 경계가 아니다.
  - 실제 경계는 객체마다 거는 `revoke all`이다.
  - 새 표와 함수에는 Supabase 기본 권한으로 anon·authenticated·service_role에 ALL이 붙는다(20261018080122의 revoke 주석). 그래서 revoke 대상에 service_role도 넣어야 한다.
  - `review_internal`에는 API 역할의 USAGE가 없다.
- 트리거 전용 definer 함수는 어떤 API 역할에도 EXECUTE를 주지 않는다. 트리거는 발동시킨 역할의 EXECUTE나 USAGE를 요구하지 않는다.
- 새 공개 투영 표의 규칙:
  - RLS를 켜고 `revoke all ... from public, anon, authenticated, service_role`을 건다.
  - anon·authenticated에는 열 단위 SELECT만 준다. service_role에도 SELECT만 준다. service_role은 BYPASSRLS라서 쓰기를 주면 '투영은 갱신 함수만 쓴다'는 전제가 깨진다. 기존 카탈로그 투영은 service_role에 all을 주지만, 새 표는 그 방식을 따르지 않는다.
  - 정책은 `for select to anon, authenticated using (true)` 하나뿐이다. 쓰기 권한과 쓰기 정책은 없다.
  - `partner_touch`, `partner_audit`, `a_booking_lock`을 달지 않는다.
- 투영을 발동시키는 세션은 세 종류다: 파트너 직접 쓰기(authenticated, RLS), 파트너 RPC, 운영자(postgres·service_role).
  - 운영자 세션에는 JWT가 없다. 그래서 갱신 함수는 definer여야 하고 `auth.uid()`에 기대면 안 된다.
  - 계정 삭제는 이 투영의 원천을 건드리지 않는다. 업체 멤버십이 있는 계정은 삭제 전에 지원 절차를 거치고, `merchant_memberships`는 ON DELETE RESTRICT다.

### 1.4 병합 지점과 신선도

| 표면 | 공개값 병합 | 다시 읽는 때 |
| --- | --- | --- |
| `/place/[id]` 본문·metadata·JSON-LD | 서버의 `getPublishedPlace`(이미 있음)가 `getPlace`, `public_store_profile`, `public_merchant_media`를 합친다. 프로필이 게시 상태일 때만 업체 사진을 붙인다. 요청 단위 React cache를 쓴다 | 요청마다 동적으로 렌더한다(쿠키 클라이언트라 ISR·CDN이 없다). 열린 화면은 프로필·사진을 다시 읽지 않는다. 메뉴(`/catalog`)와 예약 가능 여부(`/booking`)는 보이는 동안 30초마다, 그리고 focus·visibilitychange 때 다시 읽는다 |
| 지도 시트의 선택 장소(half 요약·상세·CTA·액션바) | 클라이언트 `usePublishedPlace`가 `/profile`과 `/media`를 병렬로 읽는다(no-store) | 선택 중에는 60초마다 다시 읽는다. 실패하면 20초부터 두 배씩, 최대 5분 간격으로 늘린다. 탭이 숨으면 멈췄다가 보이면 다시 읽는다. 올리브영·다이소 id는 조회하지 않는다(`canHavePublishedProfile`). compact 요약은 정적값을 쓴다 |
| 예약 `/place/[id]/book` | 헤더는 서버에서 프로필만 병합한다. 사진은 서버의 initialMedia와 `BookingFlow`의 `/media` 재조회로 처리한다. 검토 단계의 위치 카드는 `/location`이 프로필에서 이름·주소를 만든다 | 헤더의 이름·안내·소개는 로드 때만 읽는다. 사진과 위치 카드는 보이는 동안 30초마다, 그리고 복귀 때 다시 읽는다. 헤더 이름은 trim 규칙이고, 위치 카드 이름은 trim 없는 규칙이다 |
| 예약 뒤 `/bookings/[id]` | 위치 카드가 `/location`을 읽는다 | 30초마다와 복귀 때 |
| 파트너 예약 편집·매장 정보 화면 | 공개 `/booking`·`/availability`를 그대로 쓴다 | 화면 동작 때 |
| 핀, 근처·같은 좌표 목록, English only 필터, 'Bookable' 필터(정적 외부 예약 채널), 검색, 즐겨찾기, 메뉴, 내 리뷰, 공유 목록, 카테고리, OG 이미지 | 병합하지 않는다(정적) | 배포 때. 이미 받은 OG 카드는 예외다(§4.6) |
| 사이트맵 | id만 쓰므로 병합이 필요 없다 | 빌드 때 |

실패했을 때의 동작(지금):

| 표면 | 실패 때 |
| --- | --- |
| 서버 상세·예약 페이지 | 프로필 RPC 오류나 무효 응답을 '미게시'로 보고 디렉터리값을 쓴다. 상세는 이때 업체 사진도 붙이지 않는다. 사진 RPC 오류는 []로 본다 |
| 지도 시트 프로필 | 전송 실패나 non-2xx는 '모름'으로 보고 직전 값을 유지한다(없으면 정적값) |
| 지도 시트 사진 | 전송 실패나 non-2xx는 직전 사진을 유지한다. 200인데 `media` 배열이 없으면 '업체 사진 없음'으로 저장한다. 그러면 직전 사진이 지워지고 정적 사진이 보인다 |
| 예약 사진(`BookingFlow`) | 30초 재조회를 포함해 오류가 나면 매번 []로 본다. 헤더는 정적 사진으로 돌아가고, 메뉴·담당자 썸네일은 다음 성공까지 사라진다 |
| 위치 카드 | 오류가 나면 'Location unavailable'과 함께 다시 시도·View venue 버튼을 보인다 |

- `/api/places/*`의 캐시 상태:
  - 모두 force-dynamic이고 쿠키 클라이언트를 쓴다.
  - 헤더는 `private, no-store`와 `Vary: Cookie`다(catalog는 `no-store`).
  - 사진 바이트는 `public, max-age=60`(s-maxage 없음)이다. 요청마다 RPC와 Storage RLS로 공개 여부를 다시 확인한다.
  - 코드 어디에도 s-maxage, ETag, `revalidateTag`가 없다.
  - 미들웨어는 `/api/*`를 포함한 거의 모든 경로에서 `getUser()`를 부르고 쿠키를 쓸 수 있다.
- '즉시 반영'이 계약으로 굳어 있다.
  - 관리자 저장 바 문구: "저장하면 고객 화면에 바로 반영돼요".
  - HTTP QA가 확인하는 것: no-store 헤더, PATCH 직후 notice 변경, 검수 대기값 비공개, pending 매장 사진 URL 404, 삭제 직후 404.

### 1.5 장소 데이터를 쓰는 파일 (테스트 제외)

- **공급자:** `lib/data.ts`(`PLACES`·`getPlace`·`MAP_CATEGORIES`), 개발 전용 `lib/booking/local-preview.ts`.
- **직접 소비 23개**
  - 서버 10개:
    - `app/api/bookings/route.ts`
    - `app/api/places/[id]/{availability,booking,catalog,location}/route.ts`
    - `app/place/[id]/book/page.tsx`
    - `app/place/[id]/opengraph-image.tsx`
    - `app/places/[category]/page.tsx`
    - `app/sitemap.ts`
    - `lib/place-profile-server.ts`
  - 클라이언트 13개:
    - `app/favorites/page.tsx`, `app/menu/page.tsx`
    - `app/mypage/reviews/{page,[id]/page,[id]/edit/page}.tsx`
    - `app/search/page.tsx`
    - `components/map/{filter-sheet,map-screen,map-sheet}.tsx`
    - `components/place/place-detail-body.tsx`(근처 장소)
    - `components/ui/favorite-button.tsx`
    - `lib/shared-lists.ts`
    - `lib/search.ts`(클라이언트 검색 페이지만 쓴다)
- **PLACES는 읽지 않지만 표시값을 직접 쓰는 곳:** `components/map/map-view.tsx`.
  - 장소는 props로 받고, PLACES는 주석(:118)에만 나온다.
  - 마커를 만들 때 name·nameKr로 title·alt·aria-label을 정한다.
  - 마커 key에는 이름이 없다. react-leaflet 5의 `updateMarker`는 position·icon·zIndexOffset·opacity·draggable만 바꾼다. 그래서 이름을 덮어써도 이미 그린 핀의 이름은 그대로다.
  - rating도 아이콘 캐시 키에 없어서, 덮어써도 배지 숫자가 바뀌지 않는다. P0는 rating을 덮지 않는다.
- **공개 장소 API를 쓰는 곳**
  - `components/booking/booking-location.tsx`: `/location`을 쓴다. 예약 검토 단계와 `/bookings/[id]`에 나온다.
  - `components/booking/booking-flow.tsx`: `/media`, `/booking`, `/availability`.
  - `components/place/public-service-menu.tsx`, `components/booking/booking-entry.tsx`: 상세의 `/catalog`, `/booking`.
  - `components/partner/partner-booking-editor.tsx`: `/booking`, `/availability`.
  - `components/partner/partner-store-profile.tsx`: `/booking`.
  - 파트너 미리보기 `components/partner/partner-store-preview.tsx`는 파트너 프로필로 이름을 만든다(§3.4).
- **간접 영향**
  - `app/place/[id]/page.tsx`(`getPublishedPlace`를 거친다).
  - Place를 props나 인자로 받는 컴포넌트와 lib. 예: `components/places/places-content.tsx`, `components/map/selected-place-summary.tsx`, `lib/places.ts`의 `applyFilters`·`isBookable`, `lib/subway.ts`, `lib/place-seo.ts`, `lib/booking/location.ts`, `lib/place-profile.ts`, `lib/place-media.ts`, `lib/published-place-lookup.ts`.
  - `MAP_CATEGORIES` 사용처 5곳. 장소 타입에서 나오므로 덮어쓰기의 영향이 없다.
  - 오프라인 스크립트 3개, 그리고 `lib/data.ts` 소스 텍스트를 잘라 읽는 `scripts/build-ados-places.mjs`.
  - 테스트 20개.

## 2. 고칠 문제 (이번 범위)

1. **두 개의 진실(F7).**
   - English OK, 이름, 주소가 정적값과 업체값에 따로 있다.
   - 상세, 예약, 지도 시트의 선택 장소는 병합한다. 하지만 핀, 목록, English only 필터, 검색 순위, 저장 목록, 공유 목록, 카테고리, OG 이미지는 정적값을 읽는다.
   - 'Bookable' 칩도 같은 종류다.
     - 칩은 정적 외부 예약 채널(네이버·카카오·인스타그램)로 거르고, 상세의 'Book a visit'은 `booking_catalog`로 정한다.
     - 그래서 앱에서 예약할 수 있어도 외부 채널이 없으면 칩에서 빠진다.
     - P0는 칩의 뜻(외부 채널)을 유지하고, 칩 이름을 그 뜻에 맞게 바꾼다(§4.1).
2. **목록용 읽기 모델이 없다.** 공개 업체값은 장소별 RPC로만 읽을 수 있다. 목록에서 쓰려면 장소마다 요청해야 한다.
3. **영업시간 표시(F1).**
   - 관리자 일정은 예약 가능 시간 계산에만 쓰이고, 고객이 보는 "Hours"는 정적값이다.
   - '관리자 일정 = 고객에게 보일 영업시간'인지는 아직 정의되지 않았다(§8 결정 1).
   - 영업 상태는 방문자 로컬 시간으로, 예약은 `Asia/Seoul`로 계산한다.
   - 결정 전까지 관리자 문구 "예약 설정에서 바꾸면 고객 화면에도 반영돼요"를 "예약 가능 시간에 반영돼요"로 고친다.

F4(출근표 '조회 필요')는 관리자 입력 검증 버그라 이 제안과 관계없다.

## 3. 바꾸지 않을 읽기 계약

투영은 아래 계약을 그대로 재현해야 한다. 이것이 ②단계 비교의 기준이다. ③에서 의도적으로 바꾸는 것은 §3.4와 §3.5에 따로 적었다.

기존 응답에는 새 필드를 붙일 수 없다. 최상위나 `profile`에 키가 하나만 늘어도 `exactKeys` 때문에 응답 전체가 무효가 된다. 그러면 다음처럼 처리된다.

- `/profile`은 503을 낸다.
- 서버 상세는 조용히 디렉터리값으로 돌아간다.
- 지도 시트는 실패로 처리한다.

새 필드는 새 응답(§4.6 스냅샷이나 새 버전 엔드포인트)으로 낸다. 배포는 '검증기 먼저, 데이터 나중' 순서로 한다.

### 3.1 `GET /api/places/[id]/profile`

- 미게시 응답은 `{status:'unpublished', placeId}`, 게시 응답은 `{status:'published', placeId, profile}`이다.
- 게시 조건은 `merchant_publications.published` ∧ `merchants.status='active'`다. booking_enabled는 보지 않는다.
- 응답 규칙:
  - 쿼리스트링이 붙거나 id가 `^[a-zA-Z0-9][a-zA-Z0-9_-]{0,199}$`에 맞지 않으면 400.
  - 응답이 계약에 맞지 않거나 placeId가 다르면 503.
  - 디렉터리에 없는 id도 200.
  - 헤더는 `private, no-store`와 `Vary: Cookie`.

| 키 | 원천 | TS 검증 |
| --- | --- | --- |
| contactPhone | `merchants.contact_phone` | ≤80자, '' 또는 `^[+\d(). -]+$` |
| contactEmail | `merchants.contact_email` | ≤254자, '' 또는 이메일 정규식 |
| englishOk | `coalesce(sp.english_ok, false)` | boolean |
| notice | `coalesce(sp.notice, '')` | ≤60자 |
| showPhotos(선택) | `coalesce(sp.show_photos, true)` | 있으면 boolean |
| nameKo | `merchants.display_name` | ≤120자, trim 후 비면 무효 |
| nameEn | `coalesce(sp.name_en, '')` | ≤120자 |
| address | `merchants.address` | ≤500자 |
| introductionKo/En | `coalesce(sp.introduction_*, '')` | 각 ≤4000자 |
| updatedAt | `greatest(m.updated_at, sp.updated_at)` | ISO, 소수 6자리 이하, Z 또는 ±HH:MM |

- `sp`는 `merchant_store_profiles`다. 이 행이 없으면 문자열은 '', englishOk는 false, showPhotos는 true가 되고, updatedAt은 `merchants.updated_at`이 된다.
- updatedAt은 파트너 화면의 낙관적 잠금 토큰과 같은 값이다.
  - `merchants`의 모든 UPDATE에서 바뀐다(status·booking_enabled·business_types 포함).
  - `merchant_store_profiles`의 모든 UPDATE에서 바뀐다(검수 요청·취소 touch 포함).
  - 의미를 바꾸려면 별도 계약 변경이 필요하다.
- DB 제약이 TS 검증보다 느슨하다. display_name 기본값은 ''이고, 이메일은 320자까지 허용하며 정규식이 없고, 전화번호에도 정규식이 없다.
  - 운영자 SQL로 하나라도 벗어나면 프로필 전체가 무효가 된다.
  - 그러면 `/profile`은 503, 서버 상세는 디렉터리값, 지도 시트는 직전 값을 쓴다.

### 3.2 `GET /api/places/[id]/media`

- 응답은 `{media: MerchantMedia[]}`이고 항목 10000개 이하, id 중복 없음이다.
- 항목은 정확히 9개 키다.
  - `id`
  - `targetKind`(store·menu·staff)
  - `targetId`(store면 null)
  - `status`(공개 응답에서는 항상 'active')
  - `url`(= `/api/places/{placeId}/media/{id}`)
  - `width`·`height`(1..2048)
  - `createdAt`, `updatedAt`
- 항목에는 키를 더할 수 없다. 최상위 추가 키는 클라이언트 검증기가 허용한다.
- 공개 조건은 `private.merchant_media_public`이 정한다. state='active' ∧ 업체 active ∧ 게시됨 ∧ (store ∨ visible 담당자 ∨ visible 서비스+visible 카테고리)다. show_photos는 보지 않는다.
- 순서는 `created_at desc, id`이고 store·menu·staff를 모두 담는다.
- 헤더와 쿼리 규칙은 `/profile`과 같다.
- `/media/[mediaId]`는 공개 여부를 다시 확인한다.
  - `public_merchant_media(placeId, id)`로 한 건을 읽는다. 없으면 404 `MEDIA_NOT_FOUND`를 낸다.
  - 있으면 그 `objectPath`(`<merchant_id>/<id>.webp`)로 비공개 버킷에서 요청자 클라이언트를 써서 내려받는다. Storage RLS `merchant_images_public_read`가 객체 이름으로 `merchant_media_public`을 다시 판정한다.
  - 헤더는 `public, max-age=60`이다.

### 3.3 `GET /api/places/[id]/location`

- 응답은 정확히 5개 키다: `{placeId, name, nameKr, address, coordinates}`.
  - coordinates는 `{lat, lng}` 또는 null이다.
  - 검증기는 `bookingLocation`이다(exactKeys, 문자열 ≤1000자).
- 헤더, 쿼리, id 규칙은 `/profile`과 같다(`private, no-store`, `Vary: Cookie`, 위반 시 400).
  - 프로필 RPC가 실패하면 디렉터리 장소여도 503이다.
  - 디렉터리에도 없고 게시도 아니면 404 `PLACE_NOT_FOUND`다.
- 게시 프로필이 있으면, 정적 장소가 있든 없든 다음 규칙을 쓴다.
  - `name`: `nameEn || nameKo`(trim 없음)
  - `nameKr`: `nameKo`
  - `address`: `profile.address`
- 게시 프로필이 없으면 디렉터리값을 쓴다.
- 좌표는 세 조건을 모두 만족할 때만 준다: 디렉터리 장소가 있고, 근사 핀이 아니고, trim한 주소가 디렉터리 주소와 같다.
- 소비처: 예약 검토 단계와 `/bookings/[id]`의 위치 카드(30초마다·복귀 때).

### 3.4 병합 규칙 (`lib/place-profile.ts`, `lib/place-media.ts`를 그대로 쓴다)

프로필 병합:

- 프로필이 무효이거나 미게시이거나 placeId가 다르면 장소를 그대로 둔다.
- 게시 상태면 다음처럼 덮어쓴다.

| 필드 | 값 | 비고 |
| --- | --- | --- |
| `name` | `nameEn.trim() \|\| nameKo` | 디렉터리 이름으로 돌아가지 않는다 |
| `nameKr` | `nameKo` | |
| `address` | `profile.address` | ''도 덮어쓴다 |
| `about` | `introductionEn \|\| undefined` | 빈값이면 디렉터리 소개도 지운다 |
| `aboutKr` | `introductionKo \|\| undefined` | 빈값이면 디렉터리 소개도 지운다 |
| `englishOk` | `profile.englishOk` | 프로필 행이 없으면 false가 디렉터리의 true를 덮는다 |
| `photosEnabled` | `showPhotos ?? true` | |
| `publishedContact` | `{contactPhone, contactEmail, notice}` | 화면에서 '업체가 게시한 장소' 표시로 쓴다 |

- trim한 주소가 디렉터리 주소와 다르면 `geoSource='area'`로 바꾸고 `stationWalk`를 지운다(좌표는 그대로 둔다).
- hours, rating, priceRange, photoThumbnail은 병합하지 않는다.

사진 병합:

- 사진 목록이 무효이거나 비어 있으면 장소를 그대로 둔다.
- 유효하면 `publishedMedia`에 전체를 넣는다.
- store 사진이 1장 이상이면 `photos`를 store url(최신순)로 전부 대체하고, `photoUrl`은 첫 store 사진으로 한다.
- menu·staff 사진만 있으면 정적 사진이 그대로 남는다.

이름 규칙은 다섯 곳에 있다. DB는 name_en의 길이만 검사하므로 공백뿐인 값도 들어갈 수 있다.

| 곳 | 규칙 | nameEn이 공백뿐일 때 |
| --- | --- | --- |
| `lib/place-profile.ts`(상세, 지도 시트, 정적 장소가 있는 예약 헤더) | `nameEn.trim() \|\| nameKo` | nameKo |
| 예약 페이지의 '정적 장소 없이 프로필만 있는' 분기 | `nameEn \|\| nameKo`. 소개는 `introductionEn \|\| introductionKo` | 빈 이름 |
| `lib/booking/location.ts`(`/location`) | `nameEn \|\| nameKo` | 빈 이름 |
| 파트너 '고객 앱 상세페이지 미리보기' | `nameEn \|\| nameKo` | 빈 이름 |
| `booking_catalog.merchantName`(DB, 예약마다 복사) | `nullif(catalog_text(name_en), '')`, 없으면 display_name | nameKo |

③에서 다섯 곳을 같은 결과로 맞춘다.

- 두 번째 분기는 없앤다(§3.5).
- `/location`과 파트너 미리보기는 `mergePublicPlaceProfile`에서 뽑은 필드 함수를 쓴다.

### 3.5 존재·표시·예약 권한

| 질문 | 답하는 곳 | 비고 |
| --- | --- | --- |
| 고객에게 이 장소가 있나 | 서버 `getVisiblePlace(id)` = 정적 디렉터리 ∧ 차단 아님(§4.5) | 상세, 예약 페이지, 공개 `booking`·`availability`·`catalog`·`location`, POST bookings, OG, `/places/[category]`가 같은 규칙을 쓴다. 지금은 예약 페이지와 location API만 프로필 단독으로도 받아 주고, 나머지는 404를 낸다. ③에서 프로필 단독 분기를 없애 하나로 맞춘다 |
| 내 예약 장소의 위치 | `GET /api/bookings/[id]/location`(예약 소유권으로 인가) | 디렉터리와 차단 상태를 보지 않는다. 예약의 merchant_id로 투영 행을 찾고, 없으면 예약 당시 place_id의 디렉터리값, 그것도 없으면 예약 스냅샷 이름을 쓴다. 응답은 §3.3의 5개 키에 `placeVisible`을 더한 새 계약이다. `placeVisible`이 false면 'View venue'를 숨긴다 |
| 파트너 도구의 예약 카탈로그·가능 시간 | 파트너 범위 엔드포인트(멤버십으로 인가) | 디렉터리와 차단 상태를 보지 않는다. 공개 `/booking`·`/availability`는 고객 전용이 된다 |
| 무엇을 보이나 | 병합 결과. 서버는 `getPublishedPlace`, 목록은 스냅샷 병합 | 병합 규칙은 §3.4 |
| 예약할 수 있나 | 기존 RPC `booking_catalog`·`booking_availability`·`booking_create` | 투영을 보지 않는다. 예약 RPC는 잠금을 잡은 뒤 `booking_catalog`로 다시 검증한다 |

- 계약 변경: 배포된 디렉터리에 없는 place_id로 게시된 업체는 고객 화면에 나오지 않는다.
  - 새 업체를 공개하려면 그 id가 든 정적 배포가 먼저 있어야 한다.
  - 감지 1: 매시간 점검이 '게시된 place_id ⊂ 배포된 디렉터리'를 확인한다(§5.2).
  - 감지 2: 연결 절차가 같은 조건을 요구한다(§8 결정 6).

## 4. 제안 (P0): 업체 공개 투영

### 4.1 범위

- 정적 디렉터리는 코드 번들로 그대로 둔다. DB에는 게시된 업체의 공개 프로필과 공개 사진만 투영한다.
  - ②단계: 투영이 §3의 응답을 그대로 재현하는지 확인한다.
  - ③단계: 상세, 예약, `/profile`, `/location`, `/media`가 투영을 읽는다.
  - ④단계: 목록은 투영에서 만든 스냅샷을 병합한다.
- P0에 넣은 것: 장소 차단(`place_blocks`, §4.5).
- P0에서 뺀 것:
  - 영업시간: §8 결정 1 뒤 P1에서 다룬다.
  - 'Bookable' 칩의 앱 내 예약:
    - 칩은 목록에서 쓰인다(§2).
    - P0는 칩의 뜻(외부 예약 채널)을 유지하고 이름만 그 뜻으로 바꾼다.
    - 앱 내 예약 가능(카탈로그가 있고 `booking_catalog`가 'available')을 넣으려면 P1에서 스냅샷 필드로 더한다(§8 결정 7).
    - 예약 허용은 RPC가 정한다.
  - 리뷰 집계: §7.
  - geo_hint: 병합할 때 계산한다.
- 효과: F7은 ④에서 해결된다. F1은 결정 1 뒤 P1에서 해결된다.
- 개인정보: 투영에는 고객 데이터가 없다. 리뷰 집계를 뺐으므로 계정 삭제 경로도 투영 원천을 건드리지 않는다.

### 4.2 새 객체와 열

| 객체 | 종류 | 역할 |
| --- | --- | --- |
| `public.published_store_profiles` | 표 | 게시 ∧ 활성 업체당 1행. 연결이 1:1이므로 장소당 1행이다 |
| `public.published_merchant_media` | 표 | 그 업체의 공개 사진. 공개 조건을 통과한 store·menu·staff 사진을 모두 담는다(이름은 원천 `merchant_media`를 따른다) |
| `public.place_blocks` | 표 | 장소 차단(§4.5) |
| `private.refresh_store_projection(target uuid)` | 함수, definer | 한 업체의 두 표를 다시 만든다 |
| `private.sync_store_projection()` | 트리거 함수, definer | transition table에서 업체 키를 모아 uuid 순으로 갱신한다 |
| `public_store_sync_ins`·`_upd`·`_del` | 문장 단위 AFTER 트리거 20개 | §4.3의 원천 7개에 단다(merchants는 upd·del만) |
| `public_store_truncate`, `private.store_projection_no_truncate()` | BEFORE TRUNCATE 문장 트리거 7개 | 원천 TRUNCATE를 막는다(§4.3 전제) |
| `private.repair_store_projection(target uuid)` | 함수, postgres 전용 | 702020을 잡은 뒤 갱신한다. 수리와 백필은 이 함수만 쓴다 |
| `private.operator_lock_merchants(variadic uuid[])` | 함수, postgres 전용 | 업체 uuid를 정렬해 702020을 잡는다. 정규형 `uuid::text`를 해시한다 |
| `public.public_media_object_path(text, uuid)` → private 구현 | 함수, definer | 투영 행이 있고 차단되지 않은 사진만 객체 경로를 준다. 바이트 라우트 전용이다 |
| `public.place_overrides_source()` | 함수, invoker | 스냅샷 원천. 투영 공개 열과 차단 id를 한 문장에서 읽는다 |
| `public.booking_location(uuid)` → private 구현 | 함수, definer | 예약 소유자에게 그 예약 업체의 투영 행(이름·주소)을 준다 |
| `public.store_projection_drift()` → private 구현 | 함수, definer | §5.2 점검을 한 문장으로 돌린다(service_role 전용) |
| `GET /api/place-overrides` | 라우트 | 목록 스냅샷(§4.6) |
| `GET /api/bookings/[id]/location` | 라우트 | 예약 뒤 위치(§3.5) |
| 파트너 범위 catalog·availability(가칭 `/api/partner/operations/catalog`, `/availability`) | 라우트 | 파트너 도구용(§3.5) |
| 서버 `getVisiblePlace(id)`, 클라이언트 `lib/directory-store.ts`(가칭) | 코드 | 존재 규칙과 구독형 디렉터리(§4.6) |
| `scripts/test-store-projection-db.cjs`, `scripts/test-store-projection-concurrency.cjs`, `supabase/tests/store_projection.test.sql`, `scripts/check-store-projection.cjs`, `.github/workflows/projection-drift.yml` | 시험·점검 | §5 |

```
public.published_store_profiles
  merchant_id uuid primary key,             -- FK 없음(§4.3 잠금 불변식), 열 권한 없음
  place_id text not null unique,            -- merchant_publications.place_id  → placeId
  name_ko text not null,                    -- merchants.display_name           → nameKo
  name_en text not null,                    -- coalesce(sp.name_en,'')          → nameEn
  address text not null,                    -- merchants.address                → address
  introduction_ko text not null,            -- coalesce(sp.introduction_ko,'')  → introductionKo
  introduction_en text not null,            -- coalesce(sp.introduction_en,'')  → introductionEn
  contact_phone text not null,              -- merchants.contact_phone          → contactPhone
  contact_email text not null,              -- merchants.contact_email          → contactEmail
  english_ok boolean not null,              -- coalesce(sp.english_ok,false)    → englishOk
  notice text not null,                     -- coalesce(sp.notice,'')           → notice
  show_photos boolean not null,             -- coalesce(sp.show_photos,true)    → showPhotos
  profile_updated_at timestamptz not null,  -- greatest(m.updated_at, sp.updated_at) = 원천 버전 → updatedAt
  built_at timestamptz not null             -- 투영을 만든 시각 clock_timestamp(), 응답에 내보내지 않음

public.published_merchant_media              -- store·menu·staff 모두
  merchant_id uuid not null references public.published_store_profiles(merchant_id) on delete cascade, -- 투영 안의 FK, 열 권한 없음
  media_id uuid not null,                   -- merchant_media.id → id
  place_id text not null,                   -- 부모와 같은 값(조회용)
  target_kind text not null,                -- → targetKind
  target_id uuid,                           -- → targetId (store면 null)
  width int not null, height int not null,  -- → width, height
  created_at timestamptz not null,          -- → createdAt
  updated_at timestamptz not null,          -- → updatedAt
  primary key (merchant_id, media_id)       -- 색인 (place_id, created_at desc, media_id)
```

- `status`는 상수 'active'로 내보낸다. 공개 행만 저장하기 때문이다.
- `url`은 읽을 때 `/api/places/{placeId}/media/{id}`로 만든다.
- `object_path`는 저장하지 않는다. 경로는 `merchant_media`의 check 제약대로 `merchant_id/id.webp`로 정해지므로, 바이트 경로 함수가 만든다.
- 시각은 timestamptz로 저장하고 읽을 때 직렬화한다. 지금 RPC와 같은 PostgREST 세션에서 직렬화되므로 형식이 같다. 트리거에서 문자열로 굳히면 작성자 세션의 TimeZone이 들어가므로 그렇게 하지 않는다.
- 파생값(name, nameKr, about, geoSource)은 DB에 두지 않는다. 기존 병합 함수가 계산한다.
  - 표면마다 이름 규칙이 달라질 수 있고(§3.4), geoSource는 번들 안의 디렉터리 주소와 비교해야 한다.
- 값은 검증하지 않고 원값 그대로 옮긴다. 읽기 경로가 지금처럼 `publicStoreProfile`·`publicPlaceMedia`로 검증해 같은 폴백을 유지한다. 운영자가 넣은 잘못된 값 때문에 저장 트랜잭션이 실패하는 일이 없도록 하기 위해서다.
- merchant_id는 카탈로그 투영처럼 키로 두고 열 권한은 주지 않는다. FK는 걸지 않는다.
  - `merchant_publications`를 가리키면 §4.3의 교착이 생긴다.
  - 카탈로그처럼 `merchants`를 가리켜도 안 된다. `partner_store_profile`이 `merchants`를 FOR UPDATE하므로, 운영자 사진 경로와 같은 모양으로 교착한다.
  - 연결 해제 뒤의 정리는 갱신이 맡고, 남은 행은 §5.2가 잡는다. 롤백은 표를 비운다.

### 4.3 갱신 모델: 원 트랜잭션 안의 동기 갱신

원천 표 7개에 문장 단위 AFTER 트리거를 이벤트별로 단다.

- 이벤트별로 나누는 이유: 이벤트가 여럿인 트리거와 열 목록이 있는 UPDATE 트리거에는 transition table을 쓸 수 없다.
- 열 필터는 걸지 않는다. updatedAt이 모든 UPDATE에서 바뀌기 때문이다.

| 원천 | 이벤트 | 읽는 값 | 702020 |
| --- | --- | --- | --- |
| `merchant_publications` | insert·update·delete | place_id, published | 있음 |
| `merchants` | update·delete | 이름·연락처·주소·status·updated_at | 있음 |
| `merchant_store_profiles` | insert·update·delete | 소개·englishOk·notice·show_photos·updated_at | 있음 |
| `merchant_media` | insert·update·delete | state·대상·크기·시각 | 트리거 없음. 파트너 RPC는 직접 잡고, 운영자 SQL은 규칙으로 먼저 잡는다 |
| `merchant_staff` | insert·update·delete | visibility(담당자 사진에 영향) | 있음 |
| `merchant_services` | insert·update·delete | visibility·category(메뉴 사진에 영향) | 있음 |
| `merchant_categories` | insert·update·delete | visibility(메뉴 사진에 영향) | 있음 |

```sql
-- 원천마다 같은 묶음(merchants는 _upd·_del만). 이름 순으로 다른 AFTER 트리거 뒤에 돈다.
create trigger public_store_sync_ins after insert on public.merchant_media
  referencing new table as new_rows for each statement execute function private.sync_store_projection();
create trigger public_store_sync_upd after update on public.merchant_media
  referencing old table as old_rows new table as new_rows for each statement execute function private.sync_store_projection();
create trigger public_store_sync_del after delete on public.merchant_media
  referencing old table as old_rows for each statement execute function private.sync_store_projection();
create trigger public_store_truncate before truncate on public.merchant_media
  for each statement execute function private.store_projection_no_truncate();   -- 예외를 낸다
```

- `merchant_profile_reviews`는 원천이 아니다. fields가 공개되지 않고 승인 경로도 없다.
- `merchant_store_profiles` 트리거는 반드시 있어야 한다. `partner_store_profile('update')`는 `merchants`를 먼저 바꾸고 `merchant_store_profiles`를 나중에 upsert한다. 이 표의 트리거가 없으면 마지막 갱신이 옛 소개와 notice를 읽는다.

갱신 함수는 카탈로그 갱신과 같은 형태다.

```sql
-- private.refresh_store_projection(target uuid): plpgsql, security definer, volatile,
--   set search_path = '', set lock_timeout = '2s'
if current_setting('transaction_isolation') <> 'read committed' then raise exception 'store projection requires read committed'; end if;
perform pg_advisory_xact_lock(hashtextextended(target::text, 617923));   -- 읽기 전에 잠근다(카탈로그와 같은 키)
delete from public.published_store_profiles where merchant_id = target;  -- 사진 행은 투영 안의 FK cascade로 지워진다
insert into public.published_store_profiles (...)                        -- §4.2의 열
  select ... from public.merchant_publications p
  join public.merchants m on m.id = p.merchant_id
  left join public.merchant_store_profiles sp on sp.merchant_id = p.merchant_id
  where p.merchant_id = target and p.published and m.status = 'active';  -- 원천은 잠금 없이 읽는다
insert into public.published_merchant_media (...)
  select ... from public.merchant_media a join public.merchant_publications p on p.merchant_id = a.merchant_id
  where a.merchant_id = target and a.state = 'active'                     -- 색인 (merchant_id, …, state)으로 먼저 거른다
    and private.merchant_media_public(a.object_path);                     -- 공개 조건은 한 곳에서만 정의
```

트리거 함수 `private.sync_store_projection()`의 동작:

- transition table(`old_rows`·`new_rows` 가운데 있는 쪽)에서 업체 키를 모은다. merchants는 `id`, 나머지 표는 `merchant_id`다.
- 중복을 빼고 uuid 순으로 갱신한 뒤 `return null`한다.
- 같은 키를 쓰므로 READ COMMITTED 가드를 `refresh_merchant_catalog`에도 넣는다.

잠금 순서와 직렬화:

- 불변식은 `[702021] → 702020 → 원천 행 → 617923 → 투영 행`이다. 617923을 잡은 뒤에는 원천 행을 잠그지 않는다(FK 검사 포함).
  - 갱신은 702020을 잡지 않고, 원천을 잠금 없는 SELECT로만 읽는다.
  - 투영에서 원천으로 가는 FK를 두지 않는다. FK가 있으면 갱신의 INSERT가 617923을 쥔 채 `merchant_publications` 행에 FOR KEY SHARE를 건다.
  - 재연결(place_id는 unique라 FOR UPDATE)과 연결 삭제는 그 행을 먼저 잠근 뒤 702020·617923을 기다린다. 그래서 FK가 있으면 파트너 쓰기(702020 보유)나 운영자 사진 갱신(617923 보유)과 교착한다.
  - 오늘은 어떤 경로도 이 행을 잠그지 않으므로, FK를 두면 새 순환이 생긴다.
  - FK cascade도 문제다. RI 트리거가 `public_*` 트리거보다 먼저 돌기 때문에 617923 없이 투영 행을 지운다.
  - FK를 두지 않으므로 투영 행은 617923을 쥔 갱신만 쓴다. 투영 안의 FK(사진 → 프로필)는 둔다.
- 702020 없이 617923을 잡던 경로를 모두 702020 → 617923 순서로 맞춘다.
  - 수리·백필: `private.repair_store_projection(uuid)`만 쓴다(702020을 잡은 뒤 갱신). 갱신 함수를 직접 부르지 않는다.
  - 운영자 사진 SQL: 한 문장이어도 먼저 `select private.operator_lock_merchants('<uuid>'[, …])`를 부른다.
    - 코드는 `tenant::text`(소문자 정규형)를 해시한다. 이 함수도 uuid로 받아 정규형을 해시하므로, 대문자나 중괄호로 입력해도 같은 키가 된다.
    - 손으로 쓴다면 `hashtextextended('<uuid>'::uuid::text, 702020)`이다. 입력한 문자열을 그대로 해시하면 오류 없이 직렬화가 빠진다.
  - 운영자 세션은 `set idle_in_transaction_session_timeout = '30s'; set lock_timeout = '5s';`로 시작한다. 전용 운영자 역할이 생기면 역할 설정으로 고정한다(§8 결정 6).
  - 갱신 함수의 `lock_timeout = '2s'`는 규칙을 어겼을 때의 안전장치다.
    - 702020 없이 617923을 쥔 트랜잭션이 열려 있으면, 기다리던 파트너 저장은 2초 뒤 55P03(503, 다시 시도)으로 끝나고 702020을 놓는다.
    - 규칙을 지키면 617923은 경합하지 않으므로 이 상한에 걸리지 않는다.
  - 승인 RPC(§8 결정 6)가 생기면 코드가 이 순서를 강제한다.
- 결과: 617923은 같은 업체의 702020 안에서만 잡혀 경합하지 않는다. 기존 카탈로그와 같은 중첩이다.
  - 대가 1: 702020을 쥐는 시간이 갱신 시간만큼 늘어난다. 그만큼 같은 업체의 예약 생성이 기다린다. ①에서 저장 지연을 전후로 비교하고, 보관·삭제 사진 행이 많은 업체도 넣는다.
  - 대가 2: 최악의 대기 사슬은 '702020을 쥔 채 열린 운영자 트랜잭션 → 그 업체의 파트너 저장·예약 생성·파트너 예약 조작·계정 삭제 트리거(업체별 702020)'다.
    - 오늘 운영자가 `a_booking_lock` 표를 바꿀 때와 같은 사슬이다.
    - 상한은 운영자 세션의 idle_in_transaction_session_timeout(30초)과 기다리는 세션의 statement_timeout이다.
    - postgres 세션과 계정 삭제(Auth) 세션에는 짧은 statement_timeout이 보장되지 않는다. 그래서 운영자 쪽 상한이 실제 상한이다.
- 갱신이 702020을 잡아서는 안 된다. 잡으면 규칙을 어긴 운영자 SQL(행 잠금 → 702020)과 `partner_media_finalize`·`partner_media_delete`(702020 → FOR UPDATE)가 교착한다.
- 40P01이나 55P03이 나도 한쪽이 통째로 롤백되므로 투영이 어긋나지는 않는다.

변경이 사라지지 않는 이유:

0. **전제.** 아래가 깨지면 증명 밖이다. §5.2 자동 점검이 매시간 이를 잡는다.
   - 원천은 행 단위 DML로만 바뀐다.
     - TRUNCATE는 행 트리거를 부르지 않는다.
     - service_role과 postgres는 원천 7개에 TRUNCATE 권한이 있다. `merchant_media`·`merchant_store_profiles`·`merchant_publications`는 가리키는 FK가 없어 바로 비워진다.
     - 그래서 `public_store_truncate`로 막는다.
   - 공개 규칙(`merchant_media_public`, 게시 조건, 투영 매핑)을 `CREATE OR REPLACE`로 바꾸면 트리거가 돌지 않는다. 그런 마이그레이션은 같은 트랜잭션에서 업체 uuid 순으로 `repair_store_projection`을 다시 돈다. §8 결정 4나 대상 종류 추가가 여기에 해당한다.
   - `session_replication_role = replica`(복원·시드)나 `DISABLE TRIGGER`로 트리거가 꺼진 동안의 변경은 반영되지 않는다. 그런 작업 뒤에는 전체 수리와 §5.2를 돈다. 모든 마이그레이션과 복원 뒤에도 §5.2를 돈다.
   - 투영은 갱신 함수만 쓴다. API 역할과 service_role에는 쓰기 권한이 없다(§4.7).
   - 쓰기 트랜잭션은 READ COMMITTED다(기본값이고, 함수가 확인한다).
1. 투영이 읽는 열은 모두 위 7개 표에 있다. 문장 트리거는 열 필터 없이 그 표를 바꾸는 모든 문장 뒤에 돌고, transition table에는 그 문장이 바꾼 모든 행이 들어 있다. 따라서 커밋되는 원천 변경 뒤에는 같은 트랜잭션 안에서 그 업체의 갱신이 반드시 돈다.
2. 갱신은 617923(업체)을 잡은 뒤에 읽고, 그 잠금을 커밋이나 롤백까지 쥔다.
   - READ COMMITTED에서는 volatile 함수의 문장마다 새 스냅샷을 쓴다. 그래서 잠금을 기다린 갱신은 앞선 트랜잭션의 커밋을 본다.
   - 원천을 쓰는 트랜잭션은 모두 커밋 전에 617923을 거친다. 그래서 한 갱신의 문장 사이에 같은 업체의 다른 커밋이 끼어들 수 없다.
3. 같은 업체를 바꾼 두 트랜잭션 가운데, 잠금을 나중에 얻은 쪽의 마지막 갱신은 앞쪽의 커밋과 자기 변경을 모두 읽는다.
   - 처리 중에 들어온 변경도 빠지지 않는다. 그 변경을 한 트랜잭션의 갱신이 잠금을 기다렸다가 다시 읽기 때문이다.
   - 다른 업체끼리는 행을 공유하지 않는다.
4. 비용:
   - 한 문장 안의 행은 업체당 한 번으로 합친다. 문장이 여러 개면 문장마다 돈다(`partner_store_profile` 'update'는 두 번). 마지막 갱신이 모든 변경을 보므로 결과는 같다.
   - 한 번의 비용은 그 업체의 프로필 1행과 active 사진 행이다.
   - '매장 사진 최대 30장'은 pending·active·uploading의 업로드 상한일 뿐 비용 상한이 아니다. 보관·삭제 이력과 메뉴·담당자 사진은 계속 쌓이므로 state로 먼저 거른다.
   - 바뀐 행만 쓰는 upsert-if-changed는 ①의 측정을 보고 정한다.
5. 갱신이 실패하면 원 저장까지 롤백된다(fail-closed, 카탈로그와 같다).
   - 원값을 그대로 옮기므로 값 검증 때문에는 실패하지 않는다.
   - 남는 데이터성 실패는 투영 place_id의 unique 위반(23505) 하나다. 전제가 깨져 낡은 행이 남았을 때만 생긴다.
     - 그 낡은 행의 place_id를 새로 쓰려는 다른 업체의 원천 저장은 모두 롤백된다.
     - 파트너에게는 직접 쓰기면 409 PARTNER_CONFLICT, RPC면 503으로 보인다. 다시 시도해도 계속 실패한다.
     - §5.2 자동 점검이 그 행을 'unexpected'로 알리고, `repair_store_projection`으로 고친다.
   - 그 밖의 실패는 lock_timeout(55P03), statement_timeout, 40P01 같은 인프라 문제다. 아무것도 바뀌지 않았으므로 다시 시도하면 된다.
   - 큐가 없으므로 재시도, poison job, 소유권 상태를 따로 관리하지 않는다.

검토한 대안(채택하지 않음):

| 기준 | 동기 트리거(채택) | 큐 + 워커 |
| --- | --- | --- |
| 반영 시점 | 커밋과 동시. '바로 반영' 문구와 HTTP QA가 그대로 유지된다 | 워커 주기만큼 늦다. ②③을 투영으로 옮기면 '즉시 반영' 계약이 깨진다 |
| 실행 주체 | 트리거 | 스케줄러를 새로 만들어야 한다(`pg_cron`, Vercel cron 등 지금은 없음. GitHub 예약 작업은 30분 단위이고 늦어질 수 있다) |
| 실패 | 원 저장까지 롤백, 부분 상태가 없다 | 재시도, 백오프, poison job, 감시가 필요하다 |
| 직렬화 | 617923. 기존 카탈로그는 이 키를 702020 안에서만 잡아 왔다. 새 경로(운영자 사진, 수리, 백필)도 702020을 먼저 잡게 해 같은 중첩을 유지한다. 규칙을 어기면 lock_timeout이 끊는다 | 클레임(SKIP LOCKED), 업체 잠금, 재큐 규칙을 새로 증명해야 한다 |

큐로 바꿀 조건은 두 가지다. 원천 쓰기에 고객 쓰기(리뷰 등)가 들어올 때, 또는 갱신 비용이 저장 지연을 눈에 띄게 늘릴 때다. 그때 별도 제안으로 다룬다.

### 4.4 사진 의미 (P0는 지금 의미 그대로)

| 표면 | store 사진 ≥1 | store 사진 0 | show_photos=false |
| --- | --- | --- | --- |
| 상세 상단 사진 영역(상세 페이지, 지도 시트 상세) | store 사진(최신순)이 정적 사진을 전부 대체 | 정적 사진 | 영역 전체를 숨긴다(정적 사진이 있어도) |
| 지도 half 요약 사진 레일 | store 사진 | 정적 사진 | 플래그를 무시한다(왼쪽 두 칸과 같음) |
| 예약 헤더 | 첫 store 사진 | 정적 `photos[0]` | 플래그를 무시한다 |
| 예약 메뉴·담당자 썸네일 | `targetKind`·`targetId`로 짝지은 menu·staff 사진 | 같음 | 플래그를 무시한다 |
| JSON-LD image | `photos[0]`(store 사진) | 정적 `photos[0]` | 플래그를 무시한다 |
| 목록 썸네일 `photoThumbnail` | 정적 | 정적 | 정적 |
| `/media`·이미지 바이트 | 제공 | 제공 | 제공(플래그는 접근 제어가 아니다) |

- show_photos는 표시 플래그로만 투영하고, 사진 행을 비우지 않는다.
  - 빈 목록은 '업체 사진 없음'이라는 뜻이 된다.
  - 그러면 지도 요약, 예약, JSON-LD에 정적 사진이 다시 나타나고, 메뉴·담당자 썸네일이 사라진다.
- 메뉴·담당자 사진은 장소 사진을 대체하지 않는다. 장소 사진을 대체하는 것은 store 사진뿐이다.
- 이 의미는 관리자 문구("끄면 고객 상세페이지 맨 위의 사진 영역이 사라져요. 올린 사진은 그대로 보관돼요")와 `lib/published-place-client.test.ts`가 고정하고 있다.
- 모든 표면에서 사진을 끄려면 §8 결정 4의 계약 변경이 필요하다. 정적 사진은 번들에 있으므로 병합 단계에서 숨겨야 한다.

### 4.5 상태: 연결 해제, 디렉터리 밖, 장소 차단

| 상태 | 원인 | 투영 | 고객 발견·상세·예약 전 | 예약 뒤 위치(소유자) | 파트너 도구 |
| --- | --- | --- | --- | --- | --- |
| 게시 | `published` ∧ `status='active'` ∧ 디렉터리에 있음 | 행 있음 | 디렉터리값에 업체값을 병합 | 투영값 | 동작 |
| 게시 ∧ 디렉터리 밖 | 배포된 디렉터리에 없는 id로 게시 | 행 있음 | 없다. 상세와 예약 전 API는 404이고, 스냅샷은 이 id를 무시한다 | 투영값, `placeVisible=false` | 동작(파트너 범위 엔드포인트) |
| 연결 해제 | 게시 해제, 정지·폐업·온보딩, 연결 삭제, 다른 장소로 재연결(옛 장소 쪽) | 행 없음 | 디렉터리값으로 돌아간다. 예전 사진과 주소가 다시 보인다. 장소를 감추는 것이 아니다 | 디렉터리값, 그것도 없으면 예약 스냅샷 이름 | 예약 RPC가 'unavailable' |
| 차단 | 운영자 긴급 조치 | `place_blocks`에 행 | 핀, 목록, 검색에서 빠진다. 상세, 예약 전 API, OG는 404다. `/profile`은 unpublished, `/media`는 [], 바이트는 404다 | 계속 보인다, `placeVisible=false` | 동작(차단은 표시 상태다) |

- 우선순위는 차단 > 게시 > 디렉터리다. 차단은 운영자 SQL 하나로 즉시 적용되는 긴급 수단이다. 정적 제외 목록 `HIDDEN_PLACE_IDS`는 배포가 필요한 영구 제외로 남는다.
- 발견과 참조를 나눈다.
  - 발견(핀, 목록, 필터, 검색, 근처, 공유 목록 만들기)은 차단된 id와 디렉터리 밖 id를 뺀다. 새로 만드는 공유 목록에서 차단 id가 빠지는 것은 의도한 동작이다.
  - 참조(내 리뷰 목록·상세·편집·삭제, 즐겨찾기 목록·해제, 메뉴 개수)는 `resolvePlaceRef(id)`를 쓴다. 이 함수는 디렉터리 행에 `blocked: true`를 붙여 돌려준다.
  - 참조 화면은 '지금은 볼 수 없는 장소'로 표시하되 편집, 삭제, 해제는 허용한다. `published_reviews`에 남은 자기 공개 리뷰를 사용자가 계속 고치고 지울 수 있어야 한다.
- `place_blocks` 정의: `place_blocks(place_id text primary key check (char_length(place_id) between 1 and 1024), reason text not null, blocked_at timestamptz not null default now())`.
  - id 제약은 업체 연결 정규식이 아니라 `ratings`와 같은 길이 제약이다. 올리브영·다이소도 차단할 수 있게 하기 위해서다.
  - P0의 쓰기 경로는 운영자 SQL(postgres) 하나다. anon·authenticated에는 `select (place_id)`만 주고(사유는 공개하지 않는다), service_role에는 SELECT만 준다.
- 차단 절차(런북):
  1. `insert into public.place_blocks`(postgres)를 실행한다.
  2. 연결된 업체이고 예약과 사진 바이트까지 막으려면, 같은 트랜잭션에서 `published=false`도 한다.
     - 예약 RPC는 게시 조건만 보고, authenticated는 예약 RPC를 직접 부를 수 있다.
     - Storage RLS의 `merchant_media_public`도 이때 false가 된다.
  3. `vercel cache purge --type cdn`(CLI 64.5.0에 있음)으로 스냅샷 CDN 캐시를 비운다.
  4. 확인: 스냅샷 `blocked`에 id가 있고, 상세가 404이고, 업체 사진 URL이 404다.
- 차단 반영 상한:

| 표면 | 반영 |
| --- | --- |
| 상세 새 요청, 예약 전 API, `/profile`·`/media`·바이트 라우트, `/places/[category]` | 커밋 즉시 |
| 열린 상세 화면 | 30초 안(페이지 새로고침 주기, §4.6) |
| 지도 시트의 선택 장소 | 60초 안(`/profile` 재조회) |
| 핀, 목록, 검색, 저장 목록 | CDN을 비우면 60초 안(클라이언트 재조회). 비우지 않으면 §4.6의 목록 상한 |
| Storage에 객체 경로로 직접 하는 요청 | `published=false`를 함께 하면 즉시. 차단만으로는 막지 않는다 |
| 정적 사진 파일(`public/places/<id>/`), 사이트맵 | 다음 배포. 정적 사진은 차단과 무관하게 URL로 계속 열리므로, 지우려면 배포가 필요하다 |
| 이미 받은 OG 카드 | 브라우저·크롤러 캐시(최대 1년, §4.6) |

- 목록 첫 화면은 스냅샷이 도착하기 전까지 정적값이다.

### 4.6 전달·캐시·ETag·클라이언트 계약

| 표면 | 읽는 곳 | 반영 경로 | 최악 지연 |
| --- | --- | --- | --- |
| `/profile`, `/location`, `/media`, `/media/[mediaId]`의 공개 확인 | 투영(③부터) | no-store, 요청마다 읽음 | 커밋 즉시 |
| `/place/[id]` | 투영(요청 클라이언트, 동적 렌더 유지) | 이동하거나 새로고침하면 서버가 렌더한다. 열린 화면은 아래 bullet의 새로고침으로 다시 읽는다 | 30초 |
| 지도 시트 선택 장소 | `/profile`·`/media` | 기존 재조회 | 60초(실패하면 20초부터 두 배씩, 최대 5분) |
| 예약 화면 | 서버 프로필 + `/media` + `/location` | 헤더의 이름·안내·소개는 로드 때 읽는다. 사진과 위치 카드는 30초마다와 복귀 때 읽는다 | 헤더는 다시 열 때, 사진과 위치는 30초 |
| 예약 뒤 위치 | `/api/bookings/[id]/location` | 30초마다와 복귀 때 | 30초 |
| 사진 바이트 | Storage(비공개 버킷) | 요청마다 경로 확인과 Storage RLS 재확인, 브라우저 `max-age=60` | 60초 |
| 목록(핀, 목록, 필터, 검색, 즐겨찾기, 공유 목록, 메뉴, 내 리뷰) | 스냅샷 | CDN `s-maxage` + `stale-while-revalidate` + 클라이언트 재조회 | 목표 60 + 60 + 60초 ≈ 3분. 오래 요청이 없던 경로는 아래 단서가 붙는다. 차단은 런북에서 CDN을 비운다 |
| `/places/[category]` | 투영(서버 병합), 차단 제외 | 요청마다 | 즉시 |
| OG 이미지 | 정적 디렉터리값(제안) | 요청마다 렌더한다. ISR이 아니고, `revalidate = 86400`은 글꼴 fetch에만 적용된다. 응답 헤더는 ImageResponse 기본값 `public, immutable, no-transform, max-age=31536000`이다. og:image URL 해시는 소스 파일이 바뀔 때만 바뀐다 | 이미 받은 카드는 최대 1년 남는다. 배포로도 갱신되지 않는다 |

- 상세 화면 새로고침(③에서 추가):
  - `app/place/[id]/page.tsx` 전용 클라이언트 자식이 `useVisibleBookingRefresh`로 `router.refresh()`를 부른다. 보이는 동안 30초마다, 그리고 focus·visibilitychange 때다. 메뉴·예약 가능 여부와 같은 주기다.
  - 뒤로·앞으로 이동은 캐시된 RSC를 서버 렌더 없이 복원한다. 이 경우도 focus와 주기 새로고침이 덮는다.
  - `PlaceDetailBody`에는 두지 않는다. 지도 시트와 같이 쓰는 컴포넌트라서, 거기 두면 `/map`이 주기적으로 새로고침된다.
- 표면 사이의 일시 불일치는 위 상한의 차이만큼 허용한다. 예를 들어 목록 이름은 옛값이고, 선택한 장소의 상세는 새값일 수 있다. 2판의 '5분 보장' 표현은 뺀다.
- 목록 상한의 단서: Vercel은 만료된 응답을 비동기 재검증이 끝날 때까지 줄 수 있다. 그래서 한동안 요청이 없던 경로는 첫 응답이 목표보다 오래될 수 있다.
  - §5.5 (b)로 실제 지연을 잰다.
  - 상한이 없으면 `Vercel-CDN-Cache-Control`로 SWR 창을 강제하거나, 상한을 다시 적는다(§8 결정 3).
- 일반 편집은 CDN을 무효화하지 않고 TTL로 상한을 둔다. 파트너 저장 때 무효화할지는 §8 결정 3에서 정한다. 차단만 런북에서 CDN을 비운다.
- OG에 투영값을 쓰려면 ImageResponse `headers`에 짧은 Cache-Control(예: `public, max-age=0, s-maxage=86400, stale-while-revalidate=86400`)을 명시하고, 크롤러 쪽 캐시는 받아들인다.

스냅샷 `GET /api/place-overrides`의 요구사항:

- 원천: 쿠키를 읽지 않는 anon 클라이언트로 `place_overrides_source()`를 한 번 부른다.
  - 투영의 공개 열 전부와 `place_blocks.place_id`를 한 문장에서 읽는다. 그래서 places와 blocked가 같은 스냅샷이다.
- `bookingJson`과 `noBookingQuery`를 쓰지 않는다. 쿼리스트링도 쓰지 않는다.
- 헤더는 `Cache-Control: public, s-maxage=60, stale-while-revalidate=60`이고 Set-Cookie가 없어야 한다.
  - 미들웨어는 CDN보다 먼저 돌고 `getUser()`로 쿠키를 쓸 수 있다. 그래서 이 경로를 matcher에서 뺀다.
  - Vercel은 s-maxage 응답을 브라우저에 `public, max-age=0, must-revalidate`로 보낸다.
- 서버 검증:
  - 행마다 `{status:'published', placeId, profile}`을 정확히 만들어 상세와 같은 `publicStoreProfile`로 검증한다. 통과한 행만 낸다.
  - 이메일 정규식·254자, 전화 정규식, notice 60자, 소개 4000자, updatedAt 형식 가운데 하나라도 어긋나면 그 행은 빠진다. 그러면 목록도 상세와 같이 디렉터리값을 쓴다.
  - 디렉터리에 없는 id도 뺀다. 감시용으로 `invalid: [placeId]`를 둘 수 있다(선택).
  - 클라이언트는 5필드의 모양만 확인한다.
- 본문에는 목록에 필요한 원값만 담는다. 연락처, 이메일, 안내, 소개는 넣지 않는다.
  - 형식: `{ build, places: [{ placeId, nameKo, nameEn, address, englishOk }], blocked: [placeId] }`
  - places와 blocked 모두 placeId 순으로 정렬하고, 키 순서를 고정한다.
- ETag는 `"sha256(정규화한 본문)"`이다.
  - 본문 전체의 해시이므로 게시 해제·재연결(행 삭제)과 재생성이 모두 반영된다.
  - `build`(배포 커밋, 예: `VERCEL_GIT_COMMIT_SHA`)가 본문에 들어 있으므로 배포가 바뀌면 304가 이어지지 않는다.
  - 핸들러는 `If-None-Match`가 같으면 304를 준다.
  - 행별 version은 쓰지 않는다.
- 클라이언트는 `cache: 'no-cache'`(조건부 재검증)로 받는다.
  - 이때 브라우저는 `Cache-Control: max-age=0`과 `If-None-Match`를 보낸다. CDN이 이 요청에 HIT나 304를 주는지 §5.5 (a)에서 같은 요청으로 확인한다.
  - 화면이 보이는 동안 60초마다, 그리고 focus·visibilitychange 때 다시 받는다.
  - 실패하면 마지막 스냅샷을 유지한다. 실패는 '덮어쓰기 없음'과 다르다.
- 크기는 게시 업체 수(지금 수십 곳) × 5필드로 수 KB다. PostgREST `max_rows=1000`을 넘기 전까지는 한 번에 읽는다.

클라이언트 계약(④에서 만든다):

- `lib/directory-store.ts`(가칭)의 `useDirectory()`는 `useSyncExternalStore`로 `{version, places, getPlace}`를 준다.
  - `getServerSnapshot`은 정적 `PLACES`(version 0)를 준다. 그래서 SSR되는 'use client' 페이지도 첫 렌더가 정적값이고, hydration이 어긋나지 않는다.
  - 스냅샷이 오면 바뀐 행만 새 객체로 만들고, 나머지는 객체 동일성을 유지한다. 그래야 장소 객체에 묶인 effect(예: `usePublishedPlace`)가 쓸데없이 다시 돌지 않는다.
  - version은 useMemo 의존성에 넣는다.
- 순수 함수는 디렉터리를 인자로 받는다.
  - `applyFilters`와 `placesNearStation`은 이미 인자로 받는다.
  - `lib/search.ts`의 `rankPlaces`·`searchAll`, `lib/shared-lists.ts`의 `sanitizeListPlaceIds`는 목록이나 getter를 인자로 받게 바꾼다.
- 전환할 13개 파일:

| 파일 | 바꿀 것 |
| --- | --- |
| `components/map/map-screen.tsx` | `PLACES`·`getPlace` → `useDirectory()`. `applyFilters`·`placesNearStation`·`includeSelectedPlace`에 구독 목록과 getter를 넘긴다 |
| `components/map/map-sheet.tsx` | 선택 장소는 `useDirectory().getPlace`로 찾는다. `/profile` 병합 기준은 `getDirectoryPlace`다 |
| `components/map/filter-sheet.tsx` | `liveServiceFilters`에 구독 목록을 넘긴다 |
| `app/search/page.tsx`, `lib/search.ts` | 검색 함수가 목록을 인자로 받고, 페이지가 구독 목록을 넘긴다 |
| `components/place/place-detail-body.tsx` | 근처 장소에 구독 목록을 쓴다 |
| `components/ui/favorite-button.tsx` | `resolvePlaceRef` |
| `lib/shared-lists.ts` | 발견 기준의 getter를 인자로 받는다 |
| `app/favorites/page.tsx`, `app/menu/page.tsx` | `resolvePlaceRef`. 차단된 장소도 남기고 해제를 허용한다. 개수도 같은 기준이다 |
| `app/mypage/reviews/{page,[id]/page,[id]/edit/page}.tsx` | `resolvePlaceRef`. 편집과 삭제를 허용한다 |

- 지도 마커는 key에 name·nameKr의 해시를 넣는다. title·alt·aria-label은 마커를 만들 때만 정해지기 때문이다(§1.5).
- `/profile` 병합(지도 시트 `usePublishedPlace`, 상세, 예약)은 언제나 원래 정적 행 `getDirectoryPlace(id)`에서 시작한다. 덮어쓴 행에서 시작하면 addressChanged가 스냅샷 주소와 비교하므로 geoSource와 stationWalk가 틀린다.
- 이름, 주소(+ geoSource 하향), englishOk 규칙은 `mergePublicPlaceProfile`에서 필드 함수로 뽑아 함께 쓴다. 디렉터리에 없는 id는 무시한다.
- 지도 시트의 선택 장소에는 연락처, 안내, 소개, 사진이 필요하다. 그래서 `/profile`·`/media` 재조회는 유지한다. 올리브영·다이소 id는 작업 트리에서 이미 조회를 건너뛴다(`canHavePublishedProfile`).
- 상세 캐시: P0는 지금처럼 동적 렌더로 즉시 반영한다.
  - ISR로 바꾸려면 쿠키 없는 클라이언트와 명시적 `revalidate`가 필요하고, 그만큼 지연이 생긴다(§8 결정 2).
  - 쿠키를 읽지 않게 바꾸면서 segment 설정을 빠뜨리면 페이지가 정적으로 캐시될 수 있다. 그래서 그 결정 때 함께 정한다.

### 4.7 권한 DDL

```sql
alter table public.published_store_profiles enable row level security;
alter table public.published_merchant_media enable row level security;
alter table public.place_blocks             enable row level security;
revoke all on public.published_store_profiles, public.published_merchant_media, public.place_blocks
  from public, anon, authenticated, service_role;                    -- Supabase 기본 권한(ALL)까지 걷어낸다
grant select (place_id, name_ko, name_en, address, introduction_ko, introduction_en, contact_phone,
              contact_email, english_ok, notice, show_photos, profile_updated_at)
  on public.published_store_profiles to anon, authenticated;        -- merchant_id·built_at 제외
grant select (place_id, media_id, target_kind, target_id, width, height, created_at, updated_at)
  on public.published_merchant_media to anon, authenticated;        -- merchant_id 제외
grant select (place_id) on public.place_blocks to anon, authenticated; -- 사유는 비공개
grant select on public.published_store_profiles, public.published_merchant_media, public.place_blocks
  to service_role;                                                  -- 쓰기·TRUNCATE 없음
create policy published_store_profiles_read on public.published_store_profiles for select to anon, authenticated using (true);
create policy published_merchant_media_read on public.published_merchant_media for select to anon, authenticated using (true);
create policy place_blocks_read             on public.place_blocks             for select to anon, authenticated using (true);
-- 새 함수는 모두 먼저 revoke all ... from public, anon, authenticated, service_role(기존 마이그레이션의 루프 방식) 뒤 아래만 준다.
-- 트리거·운영 전용(refresh, sync, repair, operator_lock_merchants, no_truncate)은 EXECUTE 부여 없음: 소유자 postgres만.
grant execute on function public.public_media_object_path(text, uuid), private.public_media_object_path(text, uuid) to anon, authenticated;
grant execute on function public.place_overrides_source() to anon, authenticated;     -- invoker, 한 문장
grant execute on function public.booking_location(uuid), private.booking_location(uuid) to authenticated;
grant execute on function public.store_projection_drift(), private.store_projection_drift() to service_role;
notify pgrst, 'reload schema';
```

- 쓰기 권한과 쓰기 정책은 없다. 투영과 `place_blocks`의 쓰기는 소유자(postgres)가 한다. 투영은 소유자 권한 definer인 갱신 함수가, 차단은 운영자 SQL이 쓴다.
- 투영 표에는 `partner_touch`, `partner_audit`, `a_booking_lock`을 달지 않는다. 투영은 갱신 함수만 쓰므로 필요 없고, 달면 다른 세션의 쓰기에서 42501이나 추가 잠금이 생긴다.
- 공개 열은 모두 오늘 anon이 `public_store_profile`·`public_merchant_media`로 이미 받는 값이다.
  - `contact_email`도 재현을 위해 넣는다. 빼려면 계약 변경이 필요하다.
  - 달라지는 점은 하나다. 지금은 공개 id로 하나씩 읽어야 하지만, 이제는 한 번에 전체를 읽을 수 있다.
  - 연락처를 일괄로 노출하지 않으려면 두 연락처 열의 권한을 빼고, 그 두 값만 장소 단위 definer 함수로 낼 수 있다(§8 결정 5).
- 바이트 경로 함수는 merchant_id가 든 경로를 anon에게 준다.
  - 오늘 `public_merchant_media`가 주는 것과 같은 노출이다. 열 권한으로 merchant_id를 숨기는 것은 일괄 조회를 막는 뜻만 남는다.
  - 없애려면 객체를 merchant_id 없는 경로로 옮겨야 한다(별도).
  - Storage URL과 서명 URL은 저장하지 않는다.
- 갱신 함수는 `private`에 두지만, 경계는 위의 REVOKE다(anon·authenticated가 `private` USAGE를 가지므로). §5.3 시험으로 확인한다.
- 백필은 마이그레이션 안에서 트리거를 만든 뒤 owner 권한으로 한다: `do $$ declare m uuid; begin for m in select merchant_id from public.merchant_publications order by merchant_id loop perform private.repair_store_projection(m); end loop; end $$;`
  - 운영 카탈로그는 비어 있고 게시 업체는 수십 곳 이하다.
  - 규모가 커지면 업체별로 짧은 트랜잭션에서 돌린다. 트리거가 이미 켜져 있으므로 그사이의 변경도 빠지지 않는다.
  - 수리도 같은 래퍼를 운영 러너(postgres)로 부른다. API 역할에는 열지 않는다.
- 같은 마이그레이션에서 `refresh_merchant_catalog`에 READ COMMITTED 가드를 더한다.

## 5. 검증

### 5.1 응답 동일성 (②단계)

②는 두 갈래로 한다.

- (a) 값: 운영 러너가 RR 읽기 전용 트랜잭션에서 §5.2 점검(값·사진 포함)을 게시 장소 전부에 돌린다. 투영은 원천과 같은 트랜잭션에서 커밋되므로, 한 스냅샷에서 비교하면 허용오차 0을 정확히 주장할 수 있다.
- (b) 모양·헤더: `/profile`·`/media`가 RPC 응답과 투영 응답을 함께 만들어 구조를 비교한다. 실제 응답은 RPC 쪽을 보낸다.
  - 두 호출은 스냅샷이 다르다. 그래서 프로필은 updatedAt이 같을 때, 사진은 (id, updatedAt) 집합이 같을 때만 차이로 센다.
  - 버전이 다르면 한 번 다시 읽고, 그래도 다르면 세지 않는다.
  - 차이는 서버 로그 `store_projection_diff`(placeId와 필드 이름만)로 남긴다.
  - 바이트가 아니라 구조로 비교한다. 시각은 같은 순간(instant)인지로 비교한다.
- 종료 기준(③으로 넘어가는 조건):
  - (a)가 7일 연속 0건이다(매시간 자동 점검 포함).
  - 같은 기간 (b)에서 버전이 같은 차이가 0건이다.
  - 아래 사례가 전부 통과한다.
  - 게시된 place_id가 모두 배포된 `getPlace`로 풀린다.
- 비교 사례:
  - 게시(프로필 행 있음·없음), 게시 해제, 정지·폐업·온보딩, 연결 없음, 디렉터리에 없는 id
  - 무효 데이터: display_name '', 정규식 밖의 이메일. 둘 다 양쪽에서 503이어야 한다.
  - 사진: pending store 사진(없어야 함), active store 사진, 숨긴 서비스·카테고리·담당자, archived·deleted, 같은 created_at일 때의 id 순서
  - 바이트: 같은 사진 id에 대해 RPC 경로와 바이트 경로 함수가 같은 결과(200 또는 404)를 낸다.
  - show_photos: 4키 요청으로 저장한 뒤에도 false가 유지되는지
  - `/location`: 게시(store 행 있음·없음), 바뀐 주소(좌표 null), 근사 핀은 지금과 같아야 한다. 공백뿐인 nameEn은 ③ 뒤 nameKo가, 디렉터리에 없는 id는 ③ 뒤 404가 된다(의도한 변경).
- 기존 `scripts/test-partner-profile-http.cjs`와 `scripts/test-partner-media-http.cjs`가 그대로 통과해야 한다(no-store, 즉시 반영, pending 404, 삭제 즉시 404).

### 5.2 양방향 일치 점검과 자동 감시 (`private.store_projection_drift()`, 읽기 전용)

```sql
begin isolation level repeatable read read only;    -- 여러 문장을 한 스냅샷에서
with expected as (                                    -- 실제 공개 조건
  select p.merchant_id, p.place_id from public.merchant_publications p
  join public.merchants m on m.id = p.merchant_id
  where p.published and m.status = 'active')
select 'missing' as kind, e.place_id from expected e
  left join public.published_store_profiles t using (merchant_id) where t.merchant_id is null
union all
select 'unexpected', t.place_id from public.published_store_profiles t
  left join expected e using (merchant_id) where e.merchant_id is null or e.place_id <> t.place_id;
-- 아래 값·사진 비교도 같은 트랜잭션에서
commit;
```

- 위 쿼리 결과는 0행이어야 한다.
  - 빠진 행: 게시 ∧ 활성인데 투영에 없다.
  - 있으면 안 되는 행: 게시 해제, 정지, 폐업, 온보딩, 재연결 전의 옛 장소. 전제가 깨져 남은 낡은 행도 여기서 잡힌다.
- 값: 각 행을 같은 세션에서 jsonb로 만들어 `private.store_profile_json(m, sp)`와 같아야 한다. 같은 세션이므로 TimeZone도 같다.
- 사진: 장소별 투영 사진 목록이 `private.public_merchant_media(place_id)`의 (id, targetKind, targetId, width, height, createdAt, updatedAt)와 순서까지 같아야 한다. active가 아니거나 대상이 숨겨진 사진 행은 0이어야 한다.
- 이 셋을 한 SELECT로 묶은 것이 `private.store_projection_drift()`다. stable이고 한 문장이라서, 따로 트랜잭션을 열지 않아도 한 스냅샷에서 돈다.
- 실행 시점:
  - ① 직후와 각 단계 뒤에는 운영 러너가 위 RR 트랜잭션으로 돌린다.
  - 평소에는 `.github/workflows/projection-drift.yml`이 매시간 service_role로 `store_projection_drift` RPC를 부른다. 0행이 아니면 실패해서 알린다. service_role 키는 이미 공개 smoke 워크플로의 secret에 있다.
  - 같은 작업이 투영의 place_id가 모두 저장소의 `getPlace`로 풀리는지도 확인한다.
  - 이 자동 점검은 P0 완료 조건이다.
- 복원·유지보수 런북: 트리거를 끄거나 `session_replication_role=replica`로 작업한 뒤에는 전체 수리를 하고 이 점검을 돈다.

### 5.3 권한 시험 (`scripts/test-public-catalog-db.cjs` 형식 + pgTAP)

- 세 표 모두 `relrowsecurity`가 true다.
- 역할×표 기대값:

| 대상 | anon | authenticated(비회원) | authenticated(회원) | service_role |
| --- | --- | --- | --- | --- |
| `merchant_publications`, `merchant_store_profiles`, `merchant_media` | 42501 | 42501 | 42501 | 기존대로 |
| `merchants`, `merchant_categories`, `merchant_services`, `merchant_staff` | 42501 | 0행(SELECT 권한 + RLS) | 자기 업체 행만 | 기존대로 |
| `published_store_profiles`, `published_merchant_media` | §4.7의 열만 읽힌다. `merchant_id`·`built_at`은 42501 | 같음 | 같음 | SELECT만. INSERT·UPDATE·DELETE·TRUNCATE는 42501 |
| `place_blocks` | `place_id`만 읽힌다 | 같음 | 같음 | SELECT만 |

- anon·authenticated의 투영·`place_blocks` INSERT, UPDATE, DELETE, TRUNCATE는 42501이다.
- `has_function_privilege`:
  - 갱신, 동기화, 수리, `operator_lock_merchants`, `store_projection_no_truncate`는 anon·authenticated·service_role 모두 false다.
  - 이 함수들은 `prosecdef`가 true이고 `proconfig @> array['search_path=""']`다. 갱신 함수는 `lock_timeout=2s`도 가진다.
  - 바이트 경로와 `place_overrides_source`는 anon·authenticated에만 true다. `booking_location`은 authenticated, `store_projection_drift`는 service_role에만 true다.
- 트리거:
  - 마이그레이션 전후의 `(tgrelid::regclass, tgname, tgenabled)` 전체 스냅샷(tgisinternal 제외)을 비교한다.
  - 차이는 새 문장 트리거 20개와 TRUNCATE 가드 7개뿐이어야 한다. 기존 트리거(`a_booking_lock`, `booking_guard`, `partner_touch`, `partner_audit`, `public_catalog_sync`, `partner_staff_menu_limit`, `partner_booking_identity`, `ratings_sync_public_projection`, `review_reports_auto_hide`, `profiles_touch`, `ratings_touch`, `booking_forget_customer`, `a_booking_forget_communications`)는 이름과 활성 상태가 그대로다.
- 원천 TRUNCATE는 service_role·postgres 모두 가드에 막힌다.
- 세 종류 세션의 쓰기가 계속 동작해야 한다.
  - 파트너 직접 쓰기: 담당자·서비스·카테고리 가시성
  - 파트너 RPC: 매장 정보, 사진
  - 운영자 SQL: `operator_lock_merchants` 뒤 사진 승인, 게시
- 계정 삭제는 원천을 건드리지 않으므로 갱신 없이 그대로 성공한다.

### 5.4 동시성 시험 (`scripts/test-store-projection-concurrency.cjs`)

도우미와 단언 원칙:

- 기존 `waitForAdvisory`는 `wait_event='advisory'`와 차단 pid만 본다. 702020과 617923을 구분하지 못하고, 행 잠금 대기는 인식하지 못한다. 그래서 도우미를 새로 둔다.
  - `waitForAdvisoryKey(waiter, merchant, key)`: `pg_locks`에서 waiter pid가 `locktype='advisory' ∧ not granted ∧ objsubid=1 ∧ ((classid::bigint<<32)|objid::bigint) = hashtextextended(merchant::text, key)`인 잠금을 기다리는지 확인한다.
  - `waitForRowLock(waiter)`: `wait_event_type='Lock' ∧ wait_event in ('transactionid','tuple')`인지 확인한다.
- 교착이 나면 어느 쪽이 롤백되는지는 대기 시작 시점과 deadlock_timeout에 따라 달라진다. 그래서 교착 시험은 어느 쪽이 지든 허용하고 다음만 단언한다: 정확히 한쪽만 40P01 또는 55P03, 다른 쪽은 커밋, §5.2 0건.

| 시나리오 | 진행 | 기대 |
| --- | --- | --- |
| 1. 역순: 파트너 쓰기 중 재연결 | T1: `begin; select pg_advisory_xact_lock(hashtextextended(M::text,702020))`(파트너 쓰기 흉내). T2: 재연결 `update merchant_publications set place_id='Q'`(702020 대기를 키로 확인). T1: `update merchant_services … where merchant_id=M` 후 커밋 | 40P01 없음. T2가 이어서 커밋한다. Q에 T1 값이 반영된 1행이 있고 P에는 행이 없다. 투영→원천 FK가 있으면 여기서 40P01이 난다. 연결 삭제로도 같은 시험을 한다 |
| 2. 역순: 운영자 사진 중 재연결 | T1: 규칙을 어긴 운영자가 702020 없이 `update merchant_media … where id=X`(617923 보유). T2: 재연결(617923 대기를 키로 확인). T1: 같은 업체 사진을 한 번 더 바꾸고 2초 안에 커밋 | 40P01 없음, 둘 다 커밋. FK가 있으면 40P01이 난다. 연결 삭제로도 같은 시험을 한다 |
| 3. 재연결 vs 프로필 저장 | T1: 운영자가 `begin; update merchant_publications set place_id='Q'`(커밋 전). T2: `partner_store_profile('update')` | T2가 702020에서 기다린다(키 확인). T1 커밋 뒤 T2가 진행한다. 최종적으로 Q에 T2 값으로 1행이 있고, P에는 행이 없으며, `/profile`(P)는 unpublished다 |
| 4. 사진 비공개 vs 재계산 | T1: 운영자가 `operator_lock_merchants(M)` 뒤 store 사진을 `state='archived'`로(커밋 전). T2: `partner_media_finalize`(다른 대상의 메뉴 사진). 반대 순서도 시험한다 | 나중 쪽이 702020에서 기다린다(키 확인). 최종 사진 목록은 실시간 공개 조건의 결과와 같다 |
| 5. 규칙 위반 운영자 vs 파트너 저장 | T1: 702020 없이 사진 UPDATE 후 3초 동안 열어 둔다. T2: notice 저장 | T2는 617923에서 기다리다 2초 뒤 55P03(503)으로 끝난다. 그 순간 702020이 풀린다. T1 커밋 뒤 다시 하면 성공한다 |
| 6. 백필·수리 vs 실시간 변경 | T1: `select private.repair_store_projection(M)`(커밋 전). T2: notice 저장. 반대 순서도 시험한다 | 나중 쪽이 702020에서 기다렸다가 다시 읽는다. 최종 notice는 T2 값이다(낡은 백필 값으로 덮지 않는다) |
| 7. 삭제 vs 캐시 갱신(HTTP, 로컬) | 스냅샷 요청(ETag E1) → 게시 해제 커밋 → `If-None-Match: E1`로 요청 | 200을 받고 행이 없으며 ETag가 새 값이다. 새 ETag로 다시 요청하면 304다 |
| 8. 다른 원천의 동시 변경 | T1: 파트너가 `merchant_staff`를 직접 숨김. T2: 운영자가 `operator_lock_merchants` 뒤 store 사진 승인 | 두 변경이 모두 반영된다 |
| 9. 다문장 운영자 사진 vs 파트너 삭제 | T1: 702020 없이 두 문장으로 사진 2장 변경. T2: `partner_media_delete`(두 번째 사진) | 교착 원칙대로 한쪽만 실패하고 §5.2는 0건이다. T1이 `operator_lock_merchants`를 먼저 부르면 T2는 702020에서 기다리기만 하고 둘 다 성공한다 |
| 10. 두 업체 교차 재연결 | 두 업체의 연결을 서로 반대 순서로 바꾸는 두 트랜잭션 | 투영과 무관한 기존 702020 순서 문제로 40P01이 날 수 있다(교착 원칙). 업체 uuid 순으로 잠그는 연결 절차(§8 결정 6)로 해소되는지 확인한다 |
| 11. 여러 업체를 반대 순서로 바꾸는 두 문장 | T1·T2가 업체 A·B의 `merchant_media` 행을 VALUES 순서만 바꿔 넣는 INSERT를 동시에 실행 | 40P01 없음. 문장 트리거가 617923을 uuid 순으로 잡는다 |
| 12. READ COMMITTED가 아닌 쓰기 | `begin isolation level repeatable read; update merchant_staff …`, 같은 방식으로 `update merchant_services …` | 'store projection requires read committed' 오류가 난다(카탈로그도 같은 가드). 원천 변경도 롤백된다 |

### 5.5 전달 점검 (④단계)

- 스냅샷:
  - Set-Cookie가 없고 헤더가 §4.6과 같다.
  - 게시 해제 뒤와 재배포 뒤 ETag가 바뀐다. 내용이 같으면 두 요청의 ETag도 같다(places·blocked 정렬).
  - (a) 브라우저와 같은 요청(`Cache-Control: max-age=0` + `If-None-Match`)을 두 번 보내 CDN HIT나 304를 받아야 한다. curl의 `x-vercel-cache: HIT`만으로는 브라우저 재조회를 증명하지 못한다.
  - (b) 120초 넘게 요청하지 않은 뒤 요청해서 `x-vercel-cache`와, 마지막 커밋 대비 ETag가 얼마나 오래됐는지 기록한다. 상한이 없으면 결정 3으로 넘긴다.
  - (c) 조건부 요청 바로 뒤의 빈 캐시 요청이 본문이 있는 200을 받아야 한다. 원본 304가 새 클라이언트에 나가면 안 된다.
- 클라이언트:
  - 보이는 동안 60초마다, 탭 복귀 때 다시 받고, 실패하면 마지막 값을 유지한다.
  - 재마운트 없이 두 번째 스냅샷이 오면 English only 결과가 바뀐다.
  - 이름이 바뀐 스냅샷 뒤에는 핀의 title·aria-label이 바뀐다.
- 무효 행: 이메일이 정규식 밖인 행은 목록, 상세, 지도 시트(처음 열 때) 모두 디렉터리값을 보인다.
- 차단 런북: CDN을 비운 뒤 60초 안에 목록에서 빠지고, 업체 사진 URL은 404다.
- F7 회귀:
  - 관리자에서 English OK를 끄면 목록 상한 안에 지도 English only 필터에서 빠진다.
  - 검색과 저장 목록의 이름이 승인된 이름으로 바뀐다.
- 올리브영·다이소 핀을 선택해도 `/profile`·`/media` 요청이 0건이다.

## 6. 단계·배포·롤백

전제:

- 20261020123000(show_photos)을 운영에 먼저 적용한다. 지금은 로컬에만 있다.
- 미추적 마이그레이션 8개(20261019140243 ~ 20261020123000)를 먼저 커밋한 뒤, 이에 기대는 마이그레이션을 쓴다.
- 운영 적용은 허용 목록 러너로만 한다(lock_timeout 5초, statement_timeout 60초, 적용 뒤 `notify pgrst`). `supabase db push --include-all`은 쓰지 않는다(20260926083440이 보류 중이다).
- `CREATE TRIGGER`는 원천 표마다 SHARE ROW EXCLUSIVE를 잡는다. 쓰기가 적은 때에 적용하고, 시간 초과가 나면 다시 시도한다.
- 운영자 세션 설정(§4.3), 차단 런북(§4.5), 복원 런북(§5.2)을 ① 전에 문서로 둔다.

### 6.1 단계

| 단계 | 내용 | 검증 | 되돌리기 |
| --- | --- | --- | --- |
| ① | 마이그레이션: 투영 표 2개와 `place_blocks`, 함수, 문장 트리거 20개, TRUNCATE 가드 7개, 권한, 카탈로그 RC 가드, 백필(`repair_store_projection`, uuid 순) | §5.2가 0건, §5.3, §5.4. 기존 `test-public-catalog-db.cjs`·`test-partner-operations-db.cjs`·`test-partner-operations-concurrency.cjs` 통과. 파트너 저장 지연을 전후로 비교(보관·삭제 사진이 많은 업체 포함). 자동 점검 워크플로 가동 | §6.2 |
| ② | §5.1 (a)·(b) 비교. 응답은 RPC로 보낸다 | §5.1 종료 기준 | 비교를 끈다 |
| ③ | 서버 표면을 투영으로 전환한다(세부는 표 아래) | HTTP QA 2종과 `/location` 사례. Playwright로 상세·예약·예약 뒤 위치를 확인한다. 게시 해제·정지·차단 때의 동작도 확인한다 | 코드를 되돌린다(RPC는 아직 남아 있다) |
| ④ | 목록을 스냅샷 병합으로 전환한다(세부는 표 아래) | §5.5 | 코드를 되돌린다 |
| ⑤ | 구 경로를 정리한다(세부는 표 아래) | 관문과 회수 뒤 HTTP QA. 전체 테스트·typecheck·lint | 권한을 다시 준다 |

③단계에서 바꾸는 것:

- 공개 RPC 호출 6곳을 투영으로 바꾼다.
  - `/profile`, `/location`, `/media`, `/media/[mediaId]` 라우트
  - `readPublicPlaceProfile`, `readPublicPlaceMedia`(이 둘을 거치는 `getPublishedPlace`와 예약 페이지 포함)
  - 헤더, 검증, 폴백은 그대로 둔다.
  - `readPublicPlaceProfile`은 오류를 '미게시'로 삼키므로, 예약 페이지에 RPC 경로가 하나라도 남으면 이름 없는 venue를 조용히 보인다. 그래서 6곳을 모두 함께 바꾼다.
- 사진 바이트는 `public_media_object_path`로 경로를 받고, 요청자 클라이언트로 내려받는다. Storage RLS가 그대로 판정한다.
- 이름 규칙: 필드 함수를 뽑아 `/location`과 파트너 미리보기도 쓰게 한다(§3.4).
- 존재 규칙:
  - `getVisiblePlace`를 서버 소비 10곳에 쓴다. 이 10곳에는 catalog·availability가 포함된다. 사이트맵은 빌드 때 만들어지므로 다음 빌드까지 차단 id를 포함한다.
  - 예약 페이지와 `/location`의 프로필 단독 분기를 없앤다.
- 예약 뒤 위치: `/bookings/[id]`는 `/api/bookings/[id]/location`을 쓴다. 파트너 도구는 파트너 범위 catalog·availability로 옮긴다.
- 상세 화면 새로고침을 단다(§4.6).
- 실패 의미:
  - `BookingFlow`는 오류가 나면 마지막 유효 사진 목록을 유지한다.
  - 지도 시트는 200인데 `media`가 무효면 실패로 보고 직전 사진을 유지한다.
- OG는 정적 디렉터리값을 유지한다(§4.6).

④단계에서 바꾸는 것:

- `place_overrides_source()`와 스냅샷 라우트를 만들고, 미들웨어 matcher에서 뺀다.
- 구독형 진입점을 만들고, 클라이언트 소비 파일 13개를 전환한다(§4.6 표). 지도 마커 key도 바꾼다.
- `/places/[category]`는 서버에서 병합하고 차단을 뺀다.
- 'Bookable' 칩 이름을 그 뜻(외부 예약 채널)에 맞게 바꾼다.

⑤단계에서 바꾸는 것:

- 관문: `rg "public_store_profile|public_merchant_media" app lib components`가 0건이어야 한다. 남기는 함수(`public_media_object_path`)는 이름이 달라 잡히지 않는다.
- public·private `public_store_profile`·`public_merchant_media`에서 anon·authenticated의 EXECUTE를 회수한다.
  - 유지하는 것: Storage 정책이 쓰는 `merchant_media_public`, 바이트 경로 함수.
- 회수 뒤 HTTP QA:
  - `/location`이 200이고 본문이 같다.
  - `/place/{id}/book`에 업체 이름이 보인다.
  - active store 사진과 menu 사진은 200이다.
  - 미게시 업체 사진과 숨긴 대상의 사진은 404다.
- objectPath를 통한 merchant_id 노출은 바이트 경로 함수로 남는다(§4.7).

일정은 각 단계의 검증이 끝나야 다음 단계로 가는 조건부라서 날짜를 적지 않는다.

### 6.2 롤백 (새 트리거만, 이름으로 지정)

1. 코드를 먼저 되돌린다. ③④ 이전 빌드는 RPC를 읽는다. ⑤ 이후라면 RPC 권한부터 복구한다.
2. 변경 전에 떠 둔 트리거 스냅샷을 준비한다. 그다음 한 트랜잭션에서 실행한다.

   ```sql
   begin;
   set local lock_timeout = '5s';
   do $$ declare t record; begin
     for t in select tgrelid::regclass as rel, tgname from pg_trigger
       where not tgisinternal
         and tgname in ('public_store_sync_ins','public_store_sync_upd','public_store_sync_del','public_store_truncate')
     loop execute format('alter table %s disable trigger %I', t.rel, t.tgname); end loop;
   end $$;
   revoke select on public.published_store_profiles, public.published_merchant_media from anon, authenticated, service_role;
   truncate public.published_merchant_media, public.published_store_profiles;
   commit;
   ```

   - `DISABLE TRIGGER ALL`이나 `USER`는 쓰지 않는다. 쓰면 `a_booking_lock`, `booking_guard`, `partner_touch`, `partner_audit`, `public_catalog_sync`까지 꺼진다.
   - 트리거만 끄고 표를 남겨 두면, 정지되거나 연결이 해제된 업체의 값이 굳은 채 공개된다. 그래서 권한 회수와 비우기를 같은 트랜잭션에서 한다.
3. 진행 중인 갱신:
   - 갱신은 쓰기 트랜잭션 안에서만 돌고, 트랜잭션 밖에 남는 작업이 없다.
   - `DISABLE TRIGGER`는 SHARE ROW EXCLUSIVE를 잡으려고 진행 중인 쓰기가 커밋되길 기다린다. 그 뒤로는 갱신이 돌지 않는다.
   - 기다리는 동안 뒤따르는 쓰기도 막힌다. 그래서 5초를 넘으면 실패시키고 다시 시도한다.
4. 확인: 변경 전 `(tgrelid::regclass, tgname, tgenabled)` 스냅샷과 비교한다. 차이는 새 트리거 27개가 'D'인 것뿐이어야 한다. DB 전체에서 'O'를 기대하지 않는다. 원래 꺼져 있던 트리거가 있을 수 있기 때문이다.
5. 되살리기는 한 트랜잭션에서 이 순서로 한다.
   1. 같은 트리거를 켠다.
   2. 업체 uuid 순으로 `repair_store_projection`을 돈다.
   3. §5.2가 0건인지 확인한다.
   4. 권한을 다시 준다.

   나눠서 할 때도 권한은 마지막에 준다. 비어 있거나 일부만 찬 투영이 공개되지 않게 하기 위해서다.

## 7. 리뷰 집계: P0에서 제외

빼는 이유:

- **대상이 다르다.** 투영 행은 업체에 연결·게시된 장소(ASCII id)에만 있다. 리뷰는 디렉터리의 모든 장소에 달린다. 올리브영 366곳과 다이소 284곳은 연결될 수 없으므로 집계를 둘 곳이 없다.
- **수명이 다르다.** 연결을 해제하면 투영 행이 사라진다. 리뷰는 남아 있는데 집계가 없어진다.
- **잠금이 다르다.** 리뷰를 쓰는 쪽(사용자, 신고 자동 숨김, 계정 삭제)은 업체 잠금을 잡지 않는다. 같은 행을 쓰면 리뷰 트래픽이 702020을 쥔 쪽과 경합한다. 잠금 없이 다시 계산하면 동시에 쓰인 리뷰를 잃는다.
- **쓰는 화면이 없다.** 화면의 별점과 개수는 모두 외부에서 가져온 정적값이다. 'Traveler reviews · N'은 최신 10개를 조회한 결과의 길이라서 10에서 멈춘다.

후속 설계(별도 제안):

- **표:** `public.place_review_stats(place_id text primary key check (char_length(place_id) between 1 and 1024), review_count int not null, rating_sum int not null, updated_at timestamptz not null)`.
  - 평균은 rating_sum / review_count다.
  - anon·authenticated에는 SELECT만 준다.
  - 쓰기는 `review_internal`의 definer 트리거 함수(빈 search_path)만 한다.
- **트리거:** `ratings`가 아니라 `published_reviews`에 AFTER INSERT·UPDATE·DELETE로 단다.
  - 이 투영은 이미 다음을 모두 정규화한다: 공개 동의, 빈 본문, 숨김과 복구, 삭제, 계정 삭제 cascade, place_id 이동, 별점 변경, service_role 수정.
  - UPDATE면 OLD.place_id에서 빼고 NEW.place_id에 더하며, 별점 차이를 반영한다.
- **증분 갱신:** `... on conflict (place_id) do update set review_count = place_review_stats.review_count + excluded.review_count` 형태로 쓴다.
  - 증분 자체는 증가분을 잃지 않는다. 그러나 여러 장소 행을 이벤트 순서대로 잠근다.
  - place_id를 A→B로 옮기는 갱신과 B→A가 동시에 돌면 40P01이 난다.
  - 계정 삭제 cascade는 그 사용자의 장소들을 ratings 행 순서로 잠근다. 그래서 다른 계정 삭제나 여러 행을 쓰는 동기화와 교착할 수 있다.
  - 그러면 '예외를 내지 않는다'를 지킬 수 없고 `auth.admin.deleteUser`가 실패한다. 개인정보 페이지는 즉시 삭제를 약속한다.
  - 대응 1: 한 행 안의 두 장소는 place_id 순으로 적용한다.
  - 대응 2: 여러 장소를 합치려면 `ratings`의 문장 트리거(transition table)에서 공개 조건을 적용해 장소별로 합산하고, place_id 순으로 적용한다.
    - `published_reviews`는 동기화 트리거가 한 행씩 따로 쓰므로, 거기 단 문장 트리거로는 cascade를 합칠 수 없다.
    - 이 방식은 service_role의 `published_reviews` 직접 수정(아래 이벤트 8)을 놓친다.
  - 그래서 후속 제안은 아래 대안(집계 뷰)으로 시작하는 것을 우선한다.
- **변경 이벤트 8종:**
  1. 공개 리뷰 작성
  2. 공개 리뷰의 별점 변경(평균만 바뀜)
  3. 본문 비움 또는 is_public 변경
  4. 신고 3명으로 숨김, service_role의 복구
  5. 소유자가 API로 place_id 변경(두 장소가 바뀜)
  6. 소유자가 API로 삭제(UI는 없음)
  7. 계정 삭제 cascade
  8. service_role의 `published_reviews` 직접 수정
- **의미:**
  - 공개 텍스트 리뷰의 별점 평균이다.
  - 비공개 별점만 있는 평가는 절대 넣지 않는다. n이 작으면 한 사람의 비공개 별점이 드러난다.
  - 평균을 보일 최소 n을 정한다.
- **표시:**
  - `travelerReviewCount`·`travelerReviewAvg` 같은 별도 필드로 낸다. 외부에서 가져온 `Place.rating/ratingCount`는 덮지 않는다.
  - 핀 배지 값을 바꾸면 `map-view` 아이콘 캐시 키에 그 값을 넣는다.
  - JSON-LD `aggregateRating`은 따로 결정한다.
- **대안(지금 규모, 우선):** 캐시 없이 `published_reviews`를 place_id로 묶는 security_invoker 뷰를 스냅샷에 싣는다(색인이 이미 있다). 쓰기와 잠금이 없어 교착도 없다. 원본 행을 PostgREST로 가져와 세지는 않는다(`max_rows=1000`).
- **시험:** place_id 이동, 공개 리뷰의 별점 변경, auth.users 삭제 cascade, 신고 3명 숨김 뒤 복구, 동시 증분, A→B와 B→A 동시 실행, 계정 삭제 두 건과 리뷰 작성 동시 실행.

## 8. 먼저 정할 것

1. **영업시간의 의미(F1).**
   - 정할 것: `merchant_schedules`를 고객용 영업시간으로 보일지, 안내용 필드를 따로 둘지. 휴게시간과 날짜별 변경을 보일지. `Asia/Seoul`로 통일할지.
   - 정하면 P1에서 주간 시간과 날짜 예외를 원값으로 투영한다. 60일 창과 영업 중 여부는 읽을 때 `Asia/Seoul`로 계산하므로 크론이 필요 없다.
   - `merchant_schedules`는 지금 anon 권한이 없으므로 새로운 공개 범위가 된다.
   - 새 필드는 기존 `/profile`이 아니라 스냅샷이나 새 응답에 싣는다.
2. **상세 캐시.** 동적 렌더와 30초 새로고침을 유지할지(즉시 반영, 제안), ISR로 바꿀지 정한다. ISR은 쿠키 없는 클라이언트와 명시적 revalidate가 필요하고 지연이 생긴다.
3. **목록 지연 상한과 무효화.**
   - s-maxage, SWR, 재조회 주기를 정한다(제안: 각 60초, 합쳐 약 3분).
   - §5.5 (b) 결과가 나쁘면 `Vercel-CDN-Cache-Control`로 SWR 창을 강제할지 정한다.
   - 파트너 저장 때 무효화할지 정한다. 하려면 스냅샷을 Next 태그 캐시로 옮기고, 저장 라우트에서 `revalidateTag('place-overrides')`를 부른다.
4. **사진 플래그의 범위.** 지금처럼 상세 상단만 숨길지(제안), 모든 표면에서 숨길지 정한다.
   - 모든 표면은 계약 변경이다.
   - 관리자 문구와 `published-place-client.test`를 고치고, 병합 단계에서 정적 사진도 숨겨야 한다.
   - 공개 규칙을 바꾸므로 같은 트랜잭션에서 전체 수리도 해야 한다(§4.3 전제).
5. **빈값, 우선순위, 연락처 공개.**
   - 빈값 규칙은 이미 코드와 테스트로 정해져 있다.
     - 이름은 `nameEn.trim() || nameKo`다.
     - 빈 소개는 디렉터리 소개도 지운다.
     - '' 주소도 덮어쓰고 좌표 신뢰도를 낮춘다.
     - 빈 연락처와 안내는 숨긴다.
   - '디렉터리값으로 되돌림'으로 바꾸려면 계약 변경이 필요하다. `place-profile.test`와 관리자 문구("비우면 고객 화면의 안내가 사라져요")를 고쳐야 한다.
   - 연락처 이메일 공개를 멈추거나 연락처를 일괄로 읽지 못하게 하는 것(§4.7)도 같은 종류의 변경이다.
6. **운영자 절차.**
   - 매장 정보 검수와 매장 사진 승인 RPC를 만든다. 잠금 순서는 파트너 RPC와 같게 한다: 702020 → FOR UPDATE `merchants` → `merchant_store_profiles` → `merchant_profile_reviews`·`merchant_media`.
   - 연결·재연결 RPC를 만든다.
     - 두 업체를 uuid 순으로 702020 잠금한다.
     - 감사 기록을 남긴다(지금 `merchant_publications`에는 감사가 없다).
     - 배포된 디렉터리에 그 id가 있어야 연결을 허용한다.
   - 차단·해제 RPC나 관리자 화면을 만든다. 쓰기와 CDN 무효화를 함께 한다.
   - 전용 운영자 역할을 만들고 idle_in_transaction_session_timeout·lock_timeout을 역할 설정으로 고정한다.
   - 그전까지 운영자 SQL은 §4.3의 규칙과 §4.5의 차단 런북을 따른다.
7. **'Bookable' 칩.**
   - P0: 외부 예약 채널 뜻을 유지하고 칩 이름을 바꾼다. 문구는 디자인 결정이다.
   - P1: 앱 내 예약 가능(카탈로그 ∧ `booking_catalog` 'available')을 스냅샷 필드로 더해 칩에 넣을지 정한다.

## 9. 이번 범위에서 뺀 것 (각각 별도 제안)

- **결제·정산**
  - 플랫폼 수납, 예약금, 환불, 결제사, 정산 주기가 정해지기 전에는 테이블 뼈대도 넣지 않는다.
  - `payment_mode` 체크 제약이 두 표에 있고, 생성 RPC가 `pay_at_venue`를 직접 기록한다.
  - 결정 뒤 상태 전이를 설계한다: 결제 대기 점유와 만료, 취소와 결제 성공의 경합, 부분·중복 환불, 정산 확정 후 조정.
  - 웹훅 멱등 키의 범위도 함께 설계한다.
- **다국어**
  - `_en` 열을 옮기려면 RPC의 행 타입, 열 참조, 쓰기 권한을 함께 바꿔야 한다.
  - 승인된 번역을 유지하면서 새 초안을 검수하는 모델이 필요하다.
  - 운영팀의 승인 주체와 기계 번역 사용 여부부터 정한다.
- **리뷰 보상·쿠폰**
  - 'reviews 테이블'은 없다. 리뷰는 `ratings` 행이고 PK가 (user_id, place_id)라서, 한 사람이 한 장소에 하나만 쓴다.
  - 방문 인증이나 보상 규칙은 다음 세 가지를 다뤄야 한다.
    - 두 번째 방문에 두 번째 리뷰를 주려면 스키마를 바꿔야 한다.
    - 소유자가 이미 API로 삭제할 수 있으므로 '삭제 후 재작성'이 가능하다.
    - 소유자가 place_id를 바꿀 수 있다.
  - 예약과 연결하려면 작성자 소유, 같은 장소, 완료 상태를 서버에서 검증한다.
- **운영 큐 통합.** 기존 검수 원본(`merchant_profile_reviews`·`merchant_media`·`review_reports`)을 읽는 통합 읽기 모델부터 만든다. 쓰기는 §8 결정 6의 승인 RPC로 한다.
- **알림 아웃박스, 텔레메트리 분리, shared_lists 정규화.** 각각 작은 변경이지만 이번 문제와 관계없다.
- **사진 객체 경로 이전.** merchant_id가 없는 경로로 옮기면 바이트 경로를 통한 merchant_id 노출이 사라진다(§4.7).
- **기존 잠금 역순 위험**
  - 직접 UPDATE/DELETE(행 잠금 → 702020)와 RPC(702020 → FOR UPDATE)의 순서가 반대다.
  - 여러 업체에 걸친 한 문장은 `a_booking_lock`(702020)과 카탈로그 갱신(617923)을 행 순서로 잡는다.
  - `scripts/test-partner-operations-concurrency.cjs`에 두 시나리오를 넣는다.
    - `merchant_staff` 직접 수정 vs `partner_staff_profile`, 그리고 vs 담당자 메뉴 추가
    - 운영자의 `merchants` 수정 vs `partner_store_profile`
  - 40P01이 재현되면 그 쓰기를 702020을 먼저 잡는 RPC로 옮긴다.
  - 이 제안은 새 잠금 순서를 만들지 않는다.
    - 617923은 702020 안에서만 잡는다(§4.3 규칙).
    - 617923 뒤에는 투영 행만 잠근다(투영→원천 FK 없음).
    - 문장 트리거는 여러 업체를 uuid 순으로 갱신한다.
    - 규칙을 어긴 운영자 SQL은 교착이나 갱신의 lock_timeout(55P03)으로 한쪽만 롤백된다.
