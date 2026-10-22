# 원격 DB 마이그레이션 적용 계획 — 20261020123000_store_profile_show_photos (2026-10-21, 2026-10-22 개정)

> **상태: 승인 대기 중이며 아직 아무것도 실행하지 않았다.** 운영 DB, 운영 배포, GitHub main 모두 그대로다.
> **10-22 개정(Claude).** 마이그레이션 파일·원장·함수 md5는 그대로다. 실행 파일은 세션 임시 폴더에서 `reports/operations/show-photos-release-20261021/`로 옮겼다.
> 1. **기준 재계산.** 기능 브랜치에 화면 점검 수정 커밋 `7b3af94`와 `2d16930`이 올라갔다. 그래서 F=`2d16930`, T=`64bd9652…`로 다시 계산했다.
>    - 충돌은 37개다. `e608426` 기준 25개에서 늘었다.
>    - 임시 인덱스로 병합 결과를 만들어 해소 트리가 T와 같음을 확인했다.
>    - A1-2의 "b26586b와 겹치는 파일" 기대값을 6개에서 7개로 고쳤다(`app/customer-theme.css` 추가). 고치지 않으면 A1-2에서 멈춘다.
> 2. **Codex 계획 검토(5/10) 반영.**
>    - 적용·롤백 모두 원장 테이블을 잠근다.
>    - 동결 테이블 5개를 SHARE로 잠그고, 동결 검사를 C1 `5.gate`와 같게 했다.
>    - 원장 insert 뒤 LEDGER_GUARD로 확인한다. 재실행 skip도 검증한다.
>    - 복원 오류는 허용 목록(`check-restore-errors.cjs`)으로 판정한다.
>    - B2-7은 커밋·실행자·시각으로 실행을 정확히 하나만 고른다.
>    - F 블록이 새 운영 배포를 처리한다.
>    - A0-2의 포트 검사와 기능 브랜치 검사를 고쳤다.
>    - 2차 검토(8/10, 1차 지적 7건 모두 해결)의 새 지적도 반영했다. M을 되돌린 배포도 M을 조상으로 가지므로, F가 그 배포를 점검해 사전 승인된 롤백으로 M을 다시 올릴 수 있었다.
>      - 5.1-2가 `m-reverted` 표식을 남긴다. F는 그 표식을 보면 멈춘다.
>      - 새 배포가 M의 프로필 계약·마이그레이션 파일을 바꿨으면 F가 멈춘다(사전 승인 밖).
>      - 새 배포에서 M 전용 화면 표식만 실패하면 트리거로 보지 않는다.
>    - 3차 검토(10-22): 2차 지적 해결, 새 문제 없음. **9/10.**
> 3. **로컬 시험.** 바뀐 적용·롤백 도구를 임시 로컬 Supabase에서 10개 시나리오(19개 확인)로 시험했고 모두 통과했다(부록 D). 운영과 무관하고, 운영 원장과 같은 23개 마이그레이션 상태다.
>
> **선행 조건:** `7b3af94`와 `2d16930`을 GitHub 기능 브랜치에 푸시해야 A0-2를 통과한다. 그 뒤에 `reports/`·`docs/`만 바꾸는 커밋(이 계획 등)이 더 올라가도 된다. A1-1이 확인한다.
> 기준: 기능 브랜치 `codex/service-quality-release-20261018` = `2d16930`(10-22, `e608426` + 화면 점검 수정 2커밋), GitHub main = `b26586b`, 운영 배포 `dpl_2ZEE7c1s3WdeyB5Et94e6bvxxAQb`.
> 표기: **⚠ 운영 쓰기**는 운영 DB, 운영 배포, GitHub main을 바꾸는 명령이다. 표기가 없는 명령은 읽기 전용이거나 로컬 전용이다. **M**은 이 계획에서 만드는 통합 병합 커밋이고, **MDPL**은 M의 운영 배포 ID다. 셀 A–D는 앱과 DB의 조합이다(§3.2).
> 자격 증명: 스크립트가 `$R/.vercel/.env.production.local`을 메모리로만 읽는다. 명령 인자, 출력, 로그에는 넣지 않는다. `set -x`와 값 `echo`는 금지한다.
> 실행 파일: 이 문서의 SQL과 스크립트는 `/Users/hanmyeong-gwan/mobile_design/.worktrees/service-quality-20261018/reports/operations/show-photos-release-20261021`에 있다(부록 A). A0에서 영구 폴더 `/Users/hanmyeong-gwan/myseouldrop-ops/show-photos`로 복사한 뒤 sha256으로 고정한다.

## 0. 한 줄 요약과 결정 필요 사항

운영에 남은 마이그레이션은 `20261020123000` 하나다. 관련 테이블이 모두 0행이라 적용 자체는 메타데이터 변경이고, DB 시간은 20 ms 미만이다. 문제는 지금 운영 앱(main `b26586b`)이 적용 후의 11키 프로필 응답을 거부한다는 점이다.

그래서 다음 순서로 진행한다.
1. 통합 커밋 M을 로컬에서 만들고 검증한다.
2. 운영 읽기 전용 점검과 복원본 리허설을 한다(C).
3. rpc-2를 결정한다.
4. PR을 연다.
5. main에 push한다(앱 먼저).
6. 허용 목록 러너로 DB를 적용하고 검증한다.
7. 시각이 정해진 체크포인트에서 관찰한다.
8. 첫 매장(카나리아) 점검표를 통과하면 온보딩 동결을 해제한다.

모든 결정의 승인자는 사람(오너)이다. Codex 세션은 검토 의견을 내는 역할이다.

| # | 결정 | 승인 | 시점 | 승인되지 않으면 |
|---|---|---|---|---|
| 1 | 순서를 **앱 먼저 → DB**로 바꾼다. `reports/design/2026-10-20-codex-review-fixes.md:148`과 핸드오프 122행의 "DB 먼저, 앱 나중"을 철회한다. 그 판단은 4키 요청만 봤고, main이 11키 **응답**을 거부한다는 점을 놓쳤다 | 오너 | A 시작 전 | 착수하지 않는다 |
| 2 | M을 main에 push한다(= 운영 배포). 함께 나가는 제품 판단: 썸네일 cover는 장소 사진에만 쓰고 상품은 contain(`codex-review-fixes.md:144`). 비회원 ♥는 보관하지 않음 | 오너 | B1 직전(PR이 초안인 동안) | A3에서 멈춘다. 분리 경로: 4키·5키 응답을 모두 받는 파서만 담은 작은 핫픽스(§3.3) |
| 3 | rpc-2: `private.booking_quote`가 `profile.updated_at` 대신 `profile.name_en`을 해시하고, 연락처가 바뀔 때만 `merchants`를 갱신한다. Codex의 예약 견적 정의를 바꾸는 변경이다(`codex-review-fixes.md:80,145`) | 오너(Codex는 검토 의견) | **C4 통과 뒤, A3 전** | 이 계획을 멈춘다. 이 파일은 운영 원장에 없으므로 적용 전에 고친다(§1.4). 기능 브랜치의 검토 커밋에서 booking_quote 변경과 merchants 조건부 갱신을 빼거나 분리한다. 그다음 F·T·sha256을 다시 계산하고 C3·C4와 A를 다시 한다. "적용한 뒤 되돌리는 마이그레이션"은 쓰지 않는다. 그 길은 ⚠를 두 번 거치고, 견적을 두 번 무효로 만들며, 거부된 정의를 원장에 영구히 남긴다 |
| 4 | 운영 DB 적용 실행 시각 확정(⚠) | 오너 | D0 직전 | B에서 멈춘다(C 셀, 동결 유지) |
| 5 | **동결 두 가지.** (가) 온보딩 동결: A0부터 F4 첫 매장 점검표 통과까지 멤버십·매장·게시를 만들지 않는다. D가 미뤄지면 D 완료까지 유지한다. 오너가 C 셀에서 온보딩하려면 C4 셀 점검 증거와 F4 점검표를 C 셀에서 통과해야 한다. (나) main push 동결: A0부터 E 종료까지(약 6시간) 다른 세션의 main push를 금지한다. E 뒤에는 push를 허용하되, 운영 배포마다 헤드리스 점검을 하고 `$RUN/rollback-target`을 다시 기록한다. 공지 채널과 문안은 §6에 있다 | 오너 | A 시작 전 | 착수하지 않는다 |
| 6 | 비상 DB 전체 롤백(§5.3) | 오너가 실행할 때마다 승인 | 사고 시 | fix-forward |
| 7 | 앱 롤백 사전 승인: B1부터 F 종료까지 §4 F2의 수치 트리거가 충족되면 실행자가 바로 §5.1-1(⚠)을 실행하고 즉시 보고한다. 단, 5.1-2로 M을 되돌린 뒤와 새 배포가 M의 프로필 계약·마이그레이션 파일을 바꾼 경우는 범위 밖이다(F2) | 오너 | B0 | 트리거가 생길 때마다 오너 승인을 기다린다 |

- 실행자는 Claude 세션이다. ⚠ 지점(B1, D1, §5의 롤백, F4 차단 수단)은 실행 직전에 오너의 "진행"을 받는다. 결정 7의 사전 승인 범위만 예외다.
- 실행자는 스케줄러 없이 24시간 관찰을 유지할 수 없다. 그래서 F 체크포인트마다 시각과 사람 담당을 정해 둔다(§4 F1, §6).

## 1. 현재 상태 (검증된 사실)

### 1.1 운영 DB — 2026-10-21 저녁(KST) 읽기 전용 감사 (TLS 검증, `READ ONLY` 트랜잭션)

| 항목 | 값 |
|---|---|
| 프로젝트·버전 | `njsocpyuesntblifpips`, PostgreSQL 17.6 (`170006`) |
| 원장 | 23행. 마지막 행은 `20261019200901 merchant_media_storage`. 예약·관리자 마이그레이션 11개가 모두 있다(2026-10-20 02:01 UTC 적용) |
| 대상 객체 | `merchant_store_profiles.show_photos` 열 없음. `booking_quote`는 `profile.updated_at`을 해시함(옛 정의). `partner_store_profile`은 정확히 4키만 받음(옛 정의) |
| 행 수 | merchants 0, merchant_memberships 0, merchant_publications 0, merchant_store_profiles 0, merchant_profile_reviews 0, merchant_media 0, customer_bookings 0, booking_messages 0, favorites 10, profiles 5 |
| 버킷 | `merchant-images` 비공개, 5 MiB, `image/webp` |
| 잠금 | 대기 잠금 0, 긴 트랜잭션 0 |

**10-20 적용 관례**(`reports/operations/2026-10-20-production-db-readiness.md`)
- 허용 목록 러너가 각 버전을 SQL과 같은 트랜잭션에서 원장에 기록했다.
- `lock_timeout` 5 s, `statement_timeout` 60 s를 걸었다.
- pg_dump 백업을 만들고 복원 리허설을 했다.
- PostgREST를 재로드하고 REST로 점검했다.

**이번에 바꾸는 점**
- 같은 관례를 따르되 `lock_timeout`은 3 s로 줄인다(§4 D1).
- 데이터 덤프는 개인정보를 빼고 만든다(§4 C2).

**아직 운영에서 증명되지 않은 것.** 모두 C1에서 확인한다(부록 B-1 `2.privileges`, `info.auth-users`, V5·V6 기준선).
- `supabase_migrations.schema_migrations`의 DELETE 권한. 비상 롤백에 필요하다. 10-20에는 INSERT와 SELECT만 썼다.
- postgres의 `anon`·`authenticated` SET ROLE. V5·V6에 필요하다.
- SECURITY DEFINER 함수 소유자의 `auth.users` 읽기 권한(`20261019194943:59-63`).

### 1.2 마이그레이션

- **남은 것: `20261020123000_store_profile_show_photos` 1개.**
  - 7,833 bytes, LF, 문장 4개.
  - sha256 `22e132c52d2b67e941d0e1d9fd69cb6cb4de44b34f125603c71236356f4433a5`.
- **보류: `20260926083440_lock_down_shared_lists`.** 별도의 공유 목록 변경이므로 이 작업에서 절대 적용하지 않는다.
- **정정할 기록:** 핸드오프 133행의 "8개 남음(`20261019*` 7개 + 이것)"은 틀렸다.
  - `20261019*`는 10-20에 이미 적용됐다.
  - 다시 돌리면 비멱등 `CREATE`에서 실패한다.
- **현재 운영 함수 본문:** 적용된 11개 파일은 HEAD, main, 10-20 매니페스트에서 sha256이 같다. 따라서 운영의 현재 함수 본문은 `20261019200212` 파일의 본문과 같다.
- **함수 헤더:** language, security definer, `search_path=''`, volatility와 인자·기본값 목록은 200212, 123000, 롤백 파일 세 곳에서 바이트 단위로 같다. 로컬에서 대조를 마쳤다.
- **교체될 함수의 `md5(prosrc)`:** 파일에서 계산했고 로컬에서 대조를 마쳤다.

| 함수 | 지금 운영 (`20261019200212`) | 적용 후 (`20261020123000`) |
|---|---|---|
| `private.store_profile_json` | `11a705af62d2d67eb054feb684c110e1` | `289c62d7632528f242c8100f1934c5a0` |
| `private.partner_store_profile` | `fad8cf13c2c00209bd5b2672a1796ed5` | `8fafbb7d56196ec7aeba628b95feda83` |
| `private.booking_quote` | `c4b538c9f97e676a005dc82323de62e2` | `bea475352d419bb440854ecd2b02f277` |

### 1.3 운영 앱(main)과 기능 브랜치

**운영 배포**
- Vercel 프로젝트 `seoul-guide-v2`가 main을 자동 배포한다.
- 현재 배포는 `dpl_2ZEE7c1s3WdeyB5Et94e6bvxxAQb`(main `b26586b`)이고, 도메인은 myseouldrop.app과 seoul-guide-v2.vercel.app이다.
- 요금제는 hobby로 기록돼 있다(`/private/tmp/myseouldrop-vercel-current-user.json`, `…-deployment-detail.json`). A0에서 다시 확인한다.
- 두 번째 Vercel 프로젝트 `seoul-guide-v2-preview-20261018`도 이 저장소를 빌드한다. e608426에서는 실패했고, 마지막 성공은 b26586b다.

**Git 관계**
- 공통 조상은 `c66c5db`다.
- main에만 있는 커밋 4개:
  - `dc30b07` 예약·관리자 통합
  - `39ce149` CI Node 24
  - `8130d1a` 로고 출처 문서
  - `b26586b` 루틴 사진·배경·필터 스크롤
- 기능 브랜치에만 있는 커밋 6개: `812d9e6`, `906b30c`, `3dea772`, `e608426`, `7b3af94`(화면 문장·레이아웃·버튼 점검 수정), `2d16930`(예약 기록 접기 항목의 펼침 표시 회귀 수정). 뒤의 둘은 마이그레이션 파일을 건드리지 않는다.
- 모든 커밋의 작성자는 `gksaudrhks12-sys <gksaudrhks12@gmail.com>`이다. Vercel은 커밋 작성자의 권한을 검사한다(10-20 `TEAM_ACCESS_REQUIRED`). 그래서 M도 같은 작성자로 만든다.

**통합 결과는 기능 브랜치 트리와 같아야 한다**
- main의 4개 커밋은 같은 Codex 작업 트리를 복사한 것이다.
- main이 바꾼 295개 파일 중 254개는 기능 브랜치(`2d16930`)와 바이트 단위로 같다. 나머지 41개도 기능 쪽이 main의 변경을 포함한다.
  - 29개는 10-21에 파일별로 대조했다.
  - 12개는 `e608426`까지 main과 같았고, 그 위에 `7b3af94`가 화면 점검 수정을 더했다.
- 따라서 올바른 통합 결과 트리는 **`2d16930^{tree}` = `64bd96528c78dd718359146d85295145fd8f9800`**이다.

**충돌과 위험한 자동 병합**
- `git merge-tree --write-tree github/main 2d16930`은 충돌 37개를 보고한다(추가/추가 30, 내용 7).
  - `e608426` 기준 25개(추가/추가 19, 내용 6)에서 `7b3af94`가 고친 12개 파일이 늘었다.
  - `2d16930`은 이미 충돌 목록에 있는 `components/partner/dashboard.css`와 새 테스트 파일만 바꾸므로 수가 그대로다.
- 10-22에 병합 결과를 임시 인덱스로 만들어 확인했다. 37개와 `components/map/map-sheet.tsx`를 기능 쪽으로 채택하면 트리가 `64bd9652…`(= `2d16930^{tree}`)와 정확히 같다. A1-2의 채택 목록도 37개 충돌과 일치한다.
- `components/map/map-sheet.tsx`는 충돌 없이 자동 병합되지만, 반높이 `useLayoutEffect`가 두 번 들어간다. tsc, lint, vitest로는 잡히지 않으므로 트리 동일성 검사로 막는다.

**main과 기능 브랜치의 차이**
- 178개 파일이 다르다(추가 123, 수정 55). `reports/`·`docs/` 밖은 100개(추가 49, 수정 51)다.
- 다음은 같다: 패키지, CI, 설정, e2e, data, public, 환경변수 이름, RPC·테이블 대상.
- DB 응답 형식과 관련된 코드 차이는 아래 하나뿐이다.
- 다만 M은 DB 읽기 트래픽을 새로 만든다. 지도 핀을 선택하면 `/api/places/{id}/profile`과 `/media`를 읽고, 선택이 유지되는 동안 60초마다 다시 읽는다(`components/place/use-published-place.ts:37,48`, `lib/published-place-lookup.ts` `FRESH_MS`). main의 `map-sheet.tsx`는 이 호출을 하지 않는다.

| | main `b26586b` (운영) | 기능 `2d16930` |
|---|---|---|
| 프로필 응답 검사 `lib/partner/profile-contracts.ts:18` | 즉시 필드가 정확히 4키여야 함 | 4키, 또는 boolean `showPhotos`를 더한 5키 |
| 관리자 사진 스위치 | 없음 | 서버가 `showPhotos`를 줄 때만 표시하고 전송(`storeInstantDraft`, `partner-store-profile.tsx:60`) |
| 공개 상세 사진 | 프로필 조회가 실패해도 매장 사진을 섞음 | `photosEnabled = showPhotos ?? true`(`lib/place-profile.ts:20`). 공개 프로필이 없으면 매장 사진을 섞지 않음 |
| `supabase/migrations` | 24개 | 25개 (+`20261020123000`) |

**M이 함께 싣는 사용자 변화(요약)**
- 예약·메뉴·저장 목록의 스켈레톤 로딩
- 장소 상세 사진 헤더(콜라주, +N, 라이트박스). Photos 탭과 섹션은 제거
- 비회원 ♥를 보관하지 않는다는 안내
- 즐겨찾기 저장소 재작성(`lib/favorites.ts` 536줄 변경, 계정별 세션, 기기 사본 소유 태그 `essenly.favorites.owner`, 로그아웃 때 기기 사본 삭제). 운영 실데이터(favorites 10행, profiles 5행)가 지나가는 경로다
- 로그아웃 실패 알림
- 지도 핀 선택 때 공개 프로필·사진 조회
- 지하철 노선 트랙과 슬라이더 키
- 썸네일 cover/contain

**로컬 검증(10-21)**
- 빈 DB에 25개 마이그레이션을 순서대로 적용한 뒤 `scripts/test-partner-operations-db.cjs` 161 checks 통과. 로컬 QA DB에서도 161 checks 통과.
- 테스트 결과:
  - 10-21: vitest 214파일 2,399개, tsc 0, lint 0.
  - `7b3af94`(화면 점검 수정) 뒤: vitest 216파일 2,411개. Codex 10차 9/10.
  - `2d16930` 뒤(10-22): vitest 216파일 2,412개, tsc 0, lint 0.
- `e608426` 트리의 Preview가 `seoul-guide-v2`에서 10-21 11:40:32Z에 성공했다. `2d16930`의 Preview는 GitHub에 푸시한 뒤 A3-3에서 다시 확인한다.

**실행 증거의 한계**
- 지금까지 실행한 DB 증거는 모두 D 셀(적용 후 DB)이다.
  - 테스트 스크립트는 자기 트랜잭션 안에서 show_photos 마이그레이션을 항상 적용한다(`scripts/test-partner-operations-db.cjs:22-24`).
  - 두 DB 모두 25개가 적용돼 있다.
  - 브라우저 QA도 QA DB에서 했다.
- C 셀(M × 적용 전)과 B 셀(main × 적용 후)은 코드 읽기와 단위 테스트(모의 데이터)뿐이다.
- 그래서 C4에서 복원본으로 실제 RPC 응답을 만들고, M과 main의 실제 파서로 검사한다(`cell-probe.cjs`).

### 1.4 바로잡을 기록

- 다음 세 곳은 4키 요청만 검토했다. main은 11키 응답을 거부하므로 순서는 앱 먼저여야 한다.
  - `codex-review-fixes.md:148`
  - 핸드오프 122행
  - 마이그레이션 머리말 3–4행("either order")
- 초안에 적은 "마이그레이션 파일은 고치지 않는다. 고치면 원장의 `statements`, sha256과 달라진다"는 **틀렸다.**
  - 운영 원장에는 `20261020123000` 행이 없다(23행, head `20261019200901`).
  - 실제 제약은 둘이다.
    1. 파일을 바꾸면 M 트리 = `2d16930^{tree}`(A1 검사)와 매니페스트·러너의 sha256 고정이 깨진다. 따라서 기능 브랜치에서 검토 커밋을 만들고, 새 F·T·sha256을 계산해야 한다.
    2. 로컬 검증(C3, C4)을 다시 해야 한다.
- 결정 3이 승인되면 파일을 그대로 적용한다. 이때 머리말의 "either order" 주석도 원장 `statements`에 그대로 남는다. 주석이라 동작에는 영향이 없고, 정정은 보고서에 남긴다.
- 결정 3 때문에 파일을 고치게 되면 같은 커밋에서 머리말도 고친다.
- 정정은 F가 끝난 뒤 보고서와 핸드오프에만, 별도 커밋으로 한다.

## 2. 범위와 하지 않을 것

**범위**
1. GitHub에서 새로 받은 통합 클론 `$W`에서 병합 커밋 M(트리 `64bd9652`)을 만든다. 초안 PR에서 CI와 Preview를 확인한 뒤, 같은 SHA를 main에 fast-forward push한다. push하면 운영에 자동 배포된다.
2. 운영 DB에 `20261020123000` **하나만** 적용한다.
   - 1개짜리 허용 목록 러너를 쓴다.
   - 한 트랜잭션 안에서 원장에 기록한다.
   - PRE/POST 가드와 함수 속성 스냅샷 동일성을 확인한다.
   - PostgREST 재로드는 같은 트랜잭션에서 커밋과 함께 전달한다.
3. 함께 하는 점검:
   - 읽기 전용 사전 점검(C1 출력을 골든으로 저장)
   - 개인정보 없는 스키마 백업
   - 복원본 리허설(셀 점검, 롤백 음성 시험, 롤백, 재적용)
   - 적용 후 SQL·REST·앱·헤드리스 검증
   - 체크포인트 관찰
   - 첫 매장 점검표
4. 이번 실행용 안전 도구(부록 C): `env.sh`, `ro-sql.cjs`, `check-results.cjs`, `cell-probe.cjs`, `headless-check.cjs`, `orphans.sql` 등.

**하지 않을 것**
- `20260926083440_lock_down_shared_lists` 적용.
- 다음 명령: 인자 없는 `supabase db push`, `--include-all`, `supabase migration repair`, SQL Editor로 마이그레이션 실행.
- 운영 데이터 쓰기:
  - 매장, 멤버십, 게시, 예약, 메시지, 리뷰의 생성·수정(F4 첫 매장은 별도 운영 절차)
  - 합성 테스트 매장(셀 점검은 로컬 복원본에서만, 롤백되는 트랜잭션으로)
  - Production public smoke의 `include_account_data=true`(운영에 임시 계정을 만든다)
- 개인정보가 담긴 데이터 덤프(auth, profiles, favorites, client_errors, feedback의 행).
- 결제·예약금·환불 연동, 예약 정책 변경.
- Vercel·Supabase 설정 변경(환경변수, 도메인, Auth, 보안 경고), 두 번째 Vercel 프로젝트 수정. 두 번째 프로젝트는 B4에서 관찰만 하고, 조치는 오너가 결정한다.
- 기본 CLI 계정으로 하는 운영 명령. 기본 Vercel 설정은 다른 계정(`mg1018-whatapios-projects`)이고, 활성 gh 계정과 `~/.ssh/config`의 github.com 키도 다른 계정이다.
- 로컬 Supabase 스택(`supabase_db_partner-app-20261018-Io8Zlv`, 54381/54382)의 정지·리셋.
- force push, GitHub 머지 버튼, main 이력 재작성.
- 다음 위치에서의 merge, checkout, commit, 파일 수정:
  - 메인 작업 폴더 `/Users/hanmyeong-gwan/mobile_design`
  - 기능 작업 트리(Codex와 공유)
  - 공유 트리에서는 자격 증명 파일만 읽는다. 핸드오프 파일도 공유 트리에 있으므로 동결 공지 채널로 쓰지 않는다.
- 마이그레이션 파일 수정. 결정 3이 거부되면 이 계획을 멈추고 별도 검토 커밋으로 한다.
- F 이후 별도 커밋이나 오너 판단으로 미루는 것:
  - 알려진 e2e 실패 3건의 fixme 처리나 수정
  - 문서 정정
  - `lib/.lightbox-*-extracted.tsx` 정리
  - `$R/.vercel/.env.production.local` 권한을 0644에서 0600으로 바꾸기(오너에게 제안)

## 3. 호환성 표와 권장 순서

### 3.1 마이그레이션이 바꾸는 것

| 파일 줄 | 대상 | 변경 |
|---|---|---|
| `:5` | `public.merchant_store_profiles` | `show_photos boolean not null default true` 추가. 기본값이 상수라 테이블을 다시 쓰지 않는다. 0행이다 |
| `:7-11` | `private.store_profile_json` | 응답이 10키에서 11키(`showPhotos`)가 된다. `partner_store_profile`·`public_store_profile` 응답에 그대로 실린다 |
| `:13-70` | `private.partner_store_profile` | update가 4키 또는 5키(boolean `showPhotos`)를 받는다. `merchants`는 연락처가 실제로 바뀔 때만 갱신한다. `showPhotos`가 없으면 저장된 값을 유지한다 |
| `:74-80` | `private.booking_quote` | 견적 해시에 `profile.updated_at` 대신 `profile.name_en`을 쓴다(rpc-2) |

- **함수 속성:**
  - `CREATE OR REPLACE`는 소유자와 ACL만 유지한다. 나머지 속성(strict, parallel, cost, language, 인자·기본값, 반환형, security definer, volatility, `search_path`)은 문장에서 다시 정해진다.
  - 새 헤더는 옛 정의와 바이트 단위로 같다(§1.2).
  - 러너의 SNAPSHOT이 이 속성 전부를 적용 전후로 비교한다(부록 B-2).
  - GRANT/REVOKE가 없고 시그니처가 같으므로 새 오버로드는 생기지 않는다.
- **견적 버전:** 적용하는 순간 모든 `quoteVersion`이 한 번 바뀐다. 진행 중인 예약은 0단계로 돌아간다. 지금은 매장이 0개라 영향이 없다.

### 3.2 앱 × DB 호환 표

| 표면 | A: main × 적용 전 (지금 운영) | B: main × 적용 후 | C: M × 적용 전 | D: M × 적용 후 (목표) |
|---|---|---|---|---|
| 프로필 응답 검사 | 통과 | **실패.** 즉시 필드 5키가 `exactKeys(4)`에 걸린다. `unpublished` 응답은 통과 | 통과(4키) | 통과(5키) |
| `/api/partner/operations/profile` | 정상 | 멤버가 있으면 GET 503. PATCH는 RPC가 저장·커밋한 **뒤에** 503 | 정상. 4키 전송이 옛 RPC 조건과 맞는다 | 정상 |
| 관리자 "매장 정보" | 스위치 없음 | 로딩 상태에서 멈춘다. 안에 있는 매장 사진 관리도 보이지 않는다 | 스위치 숨김 | 스위치 동작 |
| `/api/places/[id]/profile`·`/location` | 정상 | 게시 매장은 503. 예약 요약과 내 예약의 위치 카드가 "Location unavailable"을 표시 | 정상 | 정상 |
| 공개 상세 `/place/[id]`·`/book` | 정상 | 공개 프로필이 조용히 빠지고 디렉터리 정보가 표시된다. 영어 응대·연락처·공지가 없고, 꺼둔 사진도 보인다 | 정상(`showPhotos ?? true`) | 정상(스위치 반영) |
| 지도 핀 선택 | 공개 프로필·사진을 읽지 않음 | A와 같음 | `/api/places/{id}/profile`·`/media`를 읽고, 선택이 유지되면 60초마다 다시 읽는다(새 DB 읽기 트래픽) | C와 같음 |
| 예약 `quoteVersion` | 즉시 필드 저장, 검수 요청, 취소마다 진행 중 견적이 무효 | 연락처나 `name_en`이 바뀔 때만 무효 | A와 같음 | B와 같음 |
| 즐겨찾기·인증 | 기존 동작 | 기존 동작 | 새 저장소(DB 형식과 무관, 실데이터 경로 → B2 회원 스모크) | C와 같음 |
| **오늘(매장·멤버십·게시 0) 사용자 영향** | 없음 | 없음 | 없음 | 없음 |
| **실행 증거** | 운영 그대로 | C4 셀 점검 post(main 파서 실패) | C4 셀 점검 pre(M·main 파서 통과, M의 4키 저장 포함) | 로컬 161 checks, QA 브라우저, C4 셀 점검 post, E |

B 셀이 깨지기 시작하는 시점:
- 파트너 쪽: 해지되지 않은 멤버십이 생길 때.
- 공개 쪽: 게시(`published`)가 있고 매장이 `active`일 때.
- 이런 행은 `postgres`와 `service_role`만 만들 수 있다. 사용자가 이 상태를 만들 수는 없다.

**같은 운영 Supabase를 쓰는 다른 클라이언트**
- 두 번째 Vercel 프로젝트 `seoul-guide-v2-preview-20261018`의 마지막 성공 배포는 b26586b 코드다.
- 그 배포가 공개돼 있고 운영 Supabase를 쓴다면, D 이후 첫 온보딩부터 B 셀 클라이언트가 된다.
- 운영 프로젝트의 오래된 Preview 배포도 보호가 없으면 같은 위험이 있다.
- B4에서 확인하고, 결과를 동결 해제 조건(F4)에 넣는다.

### 3.3 권장 순서: 앱 먼저 → DB

1. A·C·B: M을 배포한다(C 셀).
   - 온보딩 동결이 유지되는 동안 무기한 안전하다. 잃는 것은 숨겨진 사진 스위치와 지금 운영과 같은 견적 동작뿐이다.
   - D가 미뤄지면 온보딩 동결은 D 완료까지 유지한다. 오너가 C 셀에서 온보딩하려면 C4 셀 점검(pre) 증거와 F4 점검표를 C 셀에서 통과해야 한다.
2. D·E: DB를 적용한다(D 셀). 이 순서는 호환되지 않는 조합(B)을 한 번도 거치지 않는다.
3. F: 체크포인트에서 관찰하고, 첫 매장(카나리아) 점검표를 통과한 뒤 오너가 동결을 해제한다.

**결정 2가 막힐 때의 분리 경로**
- main에 작은 핫픽스를 별도 PR·CI·배포로 올리면 '앱 먼저' 조건이 채워진다. 핫픽스는 `lib/partner/profile-contracts.ts`의 즉시 필드 검사만 "4키 또는 boolean `showPhotos`를 더한 5키"로 넓히고 테스트를 더한다.
- 그 핫픽스와 적용 후 DB 조합에서는 사진 스위치가 없어 값이 기본값(true)으로 유지되므로, 공개 상세 동작이 맞는다.
- 핫픽스 번들도 C4 셀 점검을 pre/post 모두 통과해야 한다(main 번들 대신 핫픽스 번들로).
- 이 경우 나중 통합(A1)의 기준(main SHA, 충돌, 트리)이 바뀌므로 A4 절차로 다시 계산한다.

**반대 순서(DB 먼저)일 때**
- B 셀을 지나게 된다. 오늘은 영향이 없지만, 첫 온보딩 순간부터 위 표의 B열 결함이 나타난다.
- 허용 창은 시간이 아니라 상태로 정해진다: `merchant_memberships where revoked_at is null` = 0 **이고** `merchant_publications where published` = 0인 동안만이다.
- 그래도 DB 먼저를 택한다면 조건이 세 가지다.
  - 트랜잭션 안의 동결 게이트. PRE_GUARD에 이미 들어 있다(동결 테이블 SHARE 잠금 + `5.gate`와 같은 5개 수치).
  - 적용 직후 곧바로 M을 배포한다.
  - 그 사이에는 온보딩도 합성 매장 점검도 하지 않는다.

**롤백 제약**
- D 이후에 앱을 `b26586b`로 되돌리면 B 셀이 된다. 온보딩 전에만 안전하다. 온보딩 뒤에는 M 이후의 배포로만 되돌린다.
- 사진을 끈 매장이 있는 상태에서 옛 앱으로 되돌리면 그 사진이 다시 보인다.
- Hobby 요금제에서 Instant Rollback은 바로 앞 운영 배포로만 갈 수 있다(§5.1).

## 4. 단계별 실행 절차

**실행 규칙(모든 단계 공통)**

- **실행 순서:** A0 → A1 → A2 → C1 → C2 → (C3) → C4 → 결정 3 → A3 → B0 → B1 → B2 → B3 → B4 → D0 → D1 → (D2) → E → F. 문서도 이 순서대로 A, C, B, D, E, F로 배열했다. 앞 블록이 실패하면 다음 블록으로 가지 않는다.
- **블록 = 호출:**
  - 코드 블록 하나가 Bash 도구 호출 하나다. 첫 줄 주석에 호출 이름과 timeout을 적었다. 적지 않았으면 기본값(120000 ms)이다.
  - `timeout 600000`(최대)이나 `run_in_background`가 필요한 블록은 그렇게 표시했다.
  - D1과 §5.3 롤백은 포그라운드에서 timeout 600000으로만 실행한다.
- **공통 환경:**
  - 모든 블록(A0-1 제외)의 첫 줄은 `source /Users/hanmyeong-gwan/myseouldrop-ops/show-photos/env.sh`다(부록 C-6).
  - Bash 도구는 호출 사이에 변수와 함수를 잃는다. 그래서 이 파일이 매 호출마다 다음을 다시 만든다:
    - 변수: R W RUN BK F B T REPO ORIGIN ALT P PH C VTEAM VSCOPE VPRJ PREV_DPL
    - `GIT_SSH_COMMAND`
    - 함수: `ghs`, `vadm`, `rpsql`, `stop`, `prod_state`, `assert_prod_is_m`
    - `M`(A1 뒤), `MDPL`(B2 뒤), `REL`(M의 앞 12자)
  - 이 파일이 `setopt err_exit no_unset pipe_fail`과 `umask 077`을 켠다.
- **가드:**
  - 가드는 `조건 || stop "이유"`로 쓴다. `&&` 목록 안의 실패는 err_exit가 잡지 않는다.
  - ⚠ 명령 앞에는 `: ${M:?} ${B:?} ${W:?}`를 둔다.
  - zsh에서 `"$M:refs/…"`는 콜론 수식어(`:r`)로 바뀐다. 그래서 콜론 앞 변수는 항상 `${M}`처럼 중괄호로 쓴다.
  - `?`·`*`가 든 URL은 항상 따옴표로 감싼다.
- **영구 폴더:**
  - `$OPS=/Users/hanmyeong-gwan/myseouldrop-ops/show-photos`(0700)에 다음을 둔다: 실행 파일과 증거(`$RUN`), 백업(`$BK`), CA, Vercel 관리자 설정 사본, 통합 클론(`$W`), 리허설 DB 이름, 기록.
  - `/private/tmp`는 재부팅 때 지워진다. 기능 작업 트리의 git 디렉터리도 `/private/tmp/myseouldrop-quality-NH3g1c/repo/.git`에 있다. 그래서 이번 실행의 상태는 거기에 두지 않는다.
- **증거:**
  - 증거 파일은 덮어쓰지 않는다(ro-sql·헤드리스·백업·적용기가 `wx`로 연다). 다시 실행할 때는 시각 접미사를 붙인 새 이름을 쓴다.
  - 골든 파일은 `golden-preflight.json`과 `golden-fn-defs.json` 두 개다.
- **기록:**
  - `$OPS/release-log.txt`에 시각, 결정, SHA, 배포 ID, 판정을 한 줄씩 덧붙인다.
  - E4에서 요약을 쓰고, F에서는 덧붙이기만 한다.
  - `$OPS/freeze-log.txt`에는 공지 문안과 시각을 남긴다.

### A. 준비와 통합 (로컬과 읽기 전용, 운영 영향 없음)

**A0 사전 확인과 실행 폴더 준비** — 목적: 실행 파일, 기준 SHA, 신원(SSH·gh·Vercel), 요금제를 고정한다.

```sh
# [A0-1] 한 번의 호출 · env.sh가 아직 없으므로 여기서만 옵션을 직접 켠다
setopt err_exit no_unset pipe_fail; umask 077
OPS=/Users/hanmyeong-gwan/myseouldrop-ops/show-photos
PLAN=/Users/hanmyeong-gwan/mobile_design/.worktrees/service-quality-20261018/reports/operations/show-photos-release-20261021
[[ -e $OPS ]] && { print -u2 "STOP: $OPS 가 이미 있다(이전 시도의 증거일 수 있다. 옮길지 오너와 정한다)"; exit 1; }
mkdir -p "$OPS"/{run,backup,ca,vercel-admin}
chmod 700 "$OPS" "$OPS"/{run,backup,ca,vercel-admin}
cp "$PLAN/env.sh" "$OPS/env.sh"
cp "$PLAN"/{release-migrations-20261021.json,apply-guards.sql,apply-show-photos.cjs,rollback-20261020123000.sql,rollback-show-photos.cjs,backup-show-photos.cjs,ro-sql.cjs,check-results.cjs,check-restore-errors.cjs,cell-probe.cjs,headless-check.cjs,rehearsal-pg.cjs,preflight.sql,fn-defs.sql,verify-v1-v4.sql,verify-v5.sql,verify-v6.sql,monitor.sql,orphans.sql} "$OPS/run/"
cp /private/tmp/supabase-prod-ca-2021.crt "$OPS/ca/"
cp -Rp /private/tmp/myseouldrop-vercel-reauth-YzCkLd/. "$OPS/vercel-admin/"   # 관리자 CLI 설정 사본(토큰 포함, 출력 금지). 이후 사본만 쓴다
chmod 600 "$OPS/env.sh" "$OPS"/run/* "$OPS"/ca/* "$OPS"/vercel-admin/*
(cd "$OPS" && shasum -a 256 -c <<'EOF'
98035fc4cc93113dda37a8c6b1b97c29e367c4ea3e71eb244db79704e0d91832  env.sh
700723581420dd1ac98fd7e9ac529f0ef210eadcaf87fc868a3ad7d114c2f3b7  ca/supabase-prod-ca-2021.crt
9721bc860ecf18817cc96dd7126771fe08194fed877377745cd5e7db970d44ac  run/release-migrations-20261021.json
4f1182ec2d8816260403b817830ed5096fe58e126e0504f639f8cc5a4f4d15a2  run/apply-guards.sql
36e6d2961f5d54aa61867dde7dda78bcc2566d1fde2aff7b59b434ccc0d8b38f  run/apply-show-photos.cjs
4f528decb7c291eed917358236f6d2aa5e453d208ec4237c0bb178d415892eab  run/rollback-20261020123000.sql
88e2596473cb24e290ea83e7d2e7f0f7217bfb5a8a6c7a3a2d82b8a4693236ee  run/rollback-show-photos.cjs
f89a285ddeb5811a16c3f2ebaa3ad66f063b9d74556a100a90fda3d0c0b0eb44  run/backup-show-photos.cjs
e9c73ac2748f17fafdb13aff32fadbb4a8063e2cc5067d831859f9eec29f0b0f  run/ro-sql.cjs
60bb64998af99f2489659adaadfdfda31555bd59200d36bae5c2e1707455989c  run/check-results.cjs
6ac47faf543b9400653422aec9fda0a498e4ad63f070e1e6f3b692fb82149f08  run/check-restore-errors.cjs
62705d80f4280634fb6c98c41392f9fe39b1d58d48bb6f31a183997dc22bba87  run/cell-probe.cjs
5ff6ee53ad048c4d08ce7903f8b9f862453af4e23a9a26272b96a8d701b10941  run/headless-check.cjs
43fdd1072149c5005fb93ae5ced4ea8ee5e7ff935d011ff13c3c4f24edb007a1  run/rehearsal-pg.cjs
638eefa3a95420d8bbd9402d3e4cdf2564d60cb94ce5eec0f4d0a58d988a36ac  run/preflight.sql
ae9f394816f9e37995a73d1a25a3b1b8c6022bab9b559dfc185febb2e0d61644  run/fn-defs.sql
0e3061d68be56d47b4c4b8ffb46461aa5c8f32bdfdffa6074fdcc1c21f6baaaf  run/verify-v1-v4.sql
82d9c0de168abf5a27d6430a22e745fe013b7e4fed2f743d1fae54cfc08388ef  run/verify-v5.sql
4a2f19d5223fca51072b1970dccac8b4b141cd80f9696af18572c8f52f9c5886  run/verify-v6.sql
48dcb95c307bd22424893a19f0104f6ff4094b9501ddc495f217bfbe5521a4d7  run/monitor.sql
ff99a10586b6061837a6c74a076e29ce1beccf4e76eee0848c75509fda794d4c  run/orphans.sql
EOF
)
: > "$OPS/release-log.txt"; : > "$OPS/freeze-log.txt"
print -r -- "$(date '+%F %T %Z') A0 실행 파일 20개, CA sha256 일치" >> "$OPS/release-log.txt"
```

```sh
# [A0-2] 한 번의 호출 · Git·GitHub 신원과 기준 SHA(읽기 전용)
source /Users/hanmyeong-gwan/myseouldrop-ops/show-photos/env.sh
out=$(ssh -F /dev/null -i ~/.ssh/id_ed25519_gksaudrhks12_sys -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes -T git@github.com 2>&1 || true)
[[ $out == *"Hi gksaudrhks12-sys!"* ]] || stop "push에 쓸 SSH 키의 GitHub 계정이 gksaudrhks12-sys가 아니다: $out"
test "$(git ls-remote "git@github.com:${REPO}.git" refs/heads/main | cut -f1)" = "$B" || stop "GitHub main이 b26586b가 아니다 → A4"
FH=$(git ls-remote "git@github.com:${REPO}.git" refs/heads/codex/service-quality-release-20261018 | cut -f1)
[[ -n $FH ]] || stop "GitHub에 기능 브랜치가 없다"
# FH가 F와 다르면 F 뒤에 커밋이 더 있다는 뜻이다. F를 포함하는지, F 뒤 커밋이 reports/·docs/만 바꿨는지는 A1-1이 클론에서 확인한다
test "$(ghs api user --jq .login)" = gksaudrhks12-sys || stop "gh 토큰 계정이 gksaudrhks12-sys가 아니다"
test "$(ghs api "repos/$REPO" --jq .permissions.push)" = true || stop "push 권한이 없다"
test "$(ghs api "repos/$REPO/branches/main" --jq .protected)" = false || stop "main에 보호 규칙이 있다: 규칙을 읽고 오너와 B1 방식을 정한다"
test "$(ghs api "repos/$REPO/rules/branches/main" --jq length)" = 0 || stop "main에 ruleset이 있다(동결용 임시 ruleset이면 B1 계정이 bypass에 있는지 확인·기록한 뒤 진행)"
for port in 3001 3002; do
  if lsof -nP -iTCP:$port -sTCP:LISTEN >/dev/null; then stop "$port 포트 사용 중"; fi
done
print -r -- "$(date '+%F %T %Z') A0 Git: SSH=gksaudrhks12-sys, main=$B, feature head=$FH (F=$F), push 권한, 보호 규칙 없음" >> "$OPS/release-log.txt"
```

```sh
# [A0-3] 한 번의 호출 · Vercel 관리자 신원, 운영 도메인, 롤백 상태, 요금제(읽기 전용)
source /Users/hanmyeong-gwan/myseouldrop-ops/show-photos/env.sh
vadm whoami > "$RUN/a0-vercel-whoami.txt" 2>&1 || stop "관리자 토큰 갱신 실패: 오너가 'vercel login --global-config $OPS/vercel-admin'으로 다시 로그인한 뒤 재실행"
grep -q 'admin-28156576' "$RUN/a0-vercel-whoami.txt" || stop "Vercel 계정이 admin-28156576이 아니다"
for u in "$ORIGIN" "$ALT"; do
  vadm inspect "$u" --json | jq -e --arg d "$PREV_DPL" '.id == $d and .target == "production" and .readyState == "READY"' >/dev/null || stop "$u 가 $PREV_DPL 을 가리키지 않는다"
done
vadm rollback status seoul-guide-v2 > "$RUN/a0-rollback-status.txt" 2>&1 || stop "rollback status를 읽지 못했다(권한 확인)"
prod_state | tee "$RUN/a0-prod-state.json" | jq -e --arg d "$PREV_DPL" --arg b "$B" '.id == $d and .sha == $b' >/dev/null || stop "프로젝트 운영 대상이 b26586b 배포가 아니다"
vadm api "/v13/deployments/$PREV_DPL?teamId=$VTEAM" | jq -r .plan > "$RUN/a0-vercel-plan.txt"
print -r -- "$PREV_DPL" > "$RUN/rollback-target"
print -r -- "$(date '+%F %T %Z') A0 Vercel: 관리자 계정, 도메인 2개 = $PREV_DPL, 요금제 $(cat "$RUN/a0-vercel-plan.txt")" >> "$OPS/release-log.txt"
```

**A0-4 공지와 결정 기록(오너)**
- 결정 1·5·7을 `release-log.txt`에 기록한다.
- 오너가 §6의 "시작" 문안을 Codex 세션에 직접 전달한다.
- 실행자는 같은 문안을 `freeze-log.txt`에 남긴다.

판정:
- **성공:** 모든 검사를 통과했다. 실행 파일 20개와 CA의 sha256이 일치한다. 요금제가 기록됐다(`hobby`이면 §5.1의 Hobby 제약을 따른다). 결정 1·5·7이 기록돼 있다.
- **중단:**
  - main이 `b26586b`가 아니면 A4로 간다.
  - 관리자 토큰을 갱신하지 못하면 B1 전에 오너가 다시 로그인한다. 그때까지 대시보드 Promote 경로(§5.1)를 쓸 수 있도록, 오너는 B–F 동안 관리자 계정으로 대시보드에 로그인해 둔다.
  - `$PLAN`이 없으면 부록 본문으로 파일을 다시 만든다. 새 sha256을 이 표와 러너의 고정값에 반영하고, C4를 반드시 거친다.

**A1 통합 클론, 병합, 커밋** — 목적: 트리가 정확히 `2d16930`과 같은 병합 커밋 M을 만든다. 공유 작업 트리와 `/private/tmp`의 git 디렉터리와는 무관한 새 클론에서 한다.

```sh
# [A1-1] 한 번의 호출 · timeout 600000
source /Users/hanmyeong-gwan/myseouldrop-ops/show-photos/env.sh
[[ -e $W ]] && stop "$W 가 이미 있다"
git clone -q -o github --no-checkout "git@github.com:${REPO}.git" "$W"
git -C "$W" config user.name gksaudrhks12-sys
git -C "$W" config user.email gksaudrhks12@gmail.com
test "$(git -C "$W" rev-parse github/main)" = "$B" || stop "main이 움직였다 → A4"
FH=$(git -C "$W" rev-parse github/codex/service-quality-release-20261018)
git -C "$W" merge-base --is-ancestor "$F" "$FH" || stop "기능 브랜치가 F를 포함하지 않는다(강제 push?)"
test -z "$(git -C "$W" diff --name-only "$F" "$FH" -- . ':!reports/' ':!docs/')" || stop "F 뒤 기능 브랜치 커밋이 reports/·docs/ 밖을 바꿨다: F·T를 다시 정하고 계획을 다시 검토한다"
test "$(git -C "$W" rev-parse "${F}^{tree}")" = "$T" || stop "기능 트리가 다르다"
test "$(git -C "$W" log -1 --format=%ae "$B")" = "$(git -C "$W" config user.email)" || stop "커밋 작성자가 b26586b(Vercel이 받아들인 작성자)와 다르다"
git -C "$W" checkout -q -b integrate/booking-admin-20261021 "$B"
```

```sh
# [A1-2] 한 번의 호출 · 병합, 충돌 해소, 커밋(로컬)
source /Users/hanmyeong-gwan/myseouldrop-ops/show-photos/env.sh
cd "$W"
git merge --no-ff --no-commit "$F" > "$RUN/a1-merge.txt" 2>&1 || true      # CONFLICT 37건이 정상(종료 코드 1)
test "$(git ls-files -u | cut -f2 | sort -u | wc -l | tr -d ' ')" = 37 || stop "충돌 수가 37이 아니다: git merge --abort 후 원인 확인"
git checkout "$F" -- app/favorites/page.tsx components/auth/signin-nudge.tsx \
 components/booking/booking-conversation.tsx components/booking/booking-entry.tsx components/booking/booking-flow.tsx \
 components/booking/booking-location.tsx components/booking/my-bookings.tsx components/partner/partner-store-preview.tsx \
 components/partner/partner-store-profile.tsx components/place/place-detail-body.tsx components/place/place-thumbnail.tsx \
 components/place/public-service-menu.tsx components/product/product-detail-body.tsx components/product/product-thumbnail.tsx \
 components/subway/subway-route-controller.tsx components/ui/image-thumbnail.tsx lib/i18n/messages.ts \
 lib/map-selection-wiring.test.ts lib/partner/profile-api.test.ts lib/partner/profile-contracts.ts \
 lib/partner/store-preview.test.tsx lib/place-image.test.tsx lib/place-profile-server.ts lib/place-profile.ts \
 scripts/test-partner-operations-db.cjs components/map/map-sheet.tsx \
 app/customer-theme.css components/booking/booking-summary.tsx components/booking/booking-ui.tsx \
 components/booking/customer-booking-state.ts components/booking/customer-booking.module.css components/partner/dashboard.css \
 components/partner/partner-booking-editor.tsx components/partner/partner-calendar-view.tsx components/partner/partner-editors.module.css \
 components/partner/partner-insights.tsx components/partner/partner.module.css lib/partner/dashboard.ts
test -z "$(git ls-files -u)" || stop "미해결 충돌이 남았다"
test "$(git write-tree)" = "$T" || stop "트리가 2d16930과 다르다: git merge --abort"
test "$(grep -c 'const actionHeight = actions instanceof HTMLElement' components/map/map-sheet.tsx)" = 1 || stop "map-sheet effect가 중복됐다"
git diff --cached --quiet "$B" -- .github/workflows/ci.yml docs/assets/retailer-logo-sources.md || stop "main 쪽 CI·로고 문서가 달라졌다"
git diff --cached --name-only "$B" -- $(git diff-tree --no-commit-id -r --name-only "$B") | sort > "$RUN/a1-b26586b-files.txt"
print -l app/customer-theme.css app/globals.css components/product/product-detail-body.tsx components/product/product-thumbnail.tsx \
 components/ui/image-thumbnail.tsx lib/map-selection-wiring.test.ts lib/place-image.test.tsx | sort | diff - "$RUN/a1-b26586b-files.txt" \
 || stop "b26586b 변경과 겹치는 파일이 예상한 7개가 아니다"
git commit -q -m "Merge codex/service-quality-release-20261018 (2d16930) into main" \
 -m "37 conflicts and components/map/map-sheet.tsx taken from the feature branch; tree == 2d16930^{tree} (64bd9652)." \
 -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git rev-parse HEAD > "$RUN/merge-sha"
M=$(cat "$RUN/merge-sha")
{ test "$(git rev-parse "${M}^1")" = "$B" && test "$(git rev-parse "${M}^2")" = "$F" && test "$(git rev-parse "${M}^{tree}")" = "$T"; } || stop "M의 부모·트리가 다르다"
print -r -- "$(date '+%F %T %Z') A1 M=$M (tree $T, 부모 $B $F)" >> "$OPS/release-log.txt"
```

판정:
- **성공:** 트리가 `T`이고, 첫 부모가 `b26586b`, 둘째 부모가 `2d16930`이다.
  - b26586b와 겹치는 7개 파일은 모두 b26586b의 변경을 포함한다.
  - 6개는 10-21에 파일별로 대조했다.
  - `app/customer-theme.css`는 10-22에 b26586b 패치를 `2d16930` 쪽 파일에 거꾸로 적용해 보아 확인했다(`git apply --check -R` 통과).
- **중단:** 충돌 수가 37이 아니거나 트리가 다르면 `git merge --abort`로 되돌리고 원인을 확인한다.

**A2 로컬 게이트** — 목적: push할 SHA(M)를 그대로 검증한다. 빌드와 e2e는 **로컬 QA Supabase 스택(API 54381)**을 가리킨다. 운영 Supabase에 요청하지 않으므로 운영의 `web_vitals`·`client_errors`에 행이 생기지 않는다.

```sh
# [A2-1] 한 번의 호출 · timeout 600000 · QA 스택 값으로 빌드 환경을 만들고(값은 출력하지 않는다) 의존성을 설치
source /Users/hanmyeong-gwan/myseouldrop-ops/show-photos/env.sh
J=$(supabase status --workdir /private/tmp/partner-app-20261018-Io8Zlv -o json 2>/dev/null) || stop "QA 스택이 꺼져 있다: 오너 확인 후 supabase start --workdir /private/tmp/partner-app-20261018-Io8Zlv (정지·리셋 금지)"
URL=$(print -r -- "$J" | jq -r .API_URL)
[[ $URL =~ '^http://127\.0\.0\.1:543[0-9][0-9]$' ]] || stop "QA API 주소가 로컬이 아니다: $URL"
print -r -- "NEXT_PUBLIC_SUPABASE_URL=$URL" > "$W/.env.production.local"
print -r -- "NEXT_PUBLIC_SUPABASE_ANON_KEY=$(print -r -- "$J" | jq -r .ANON_KEY)" >> "$W/.env.production.local"
unset J
grep -q '^NEXT_PUBLIC_SUPABASE_ANON_KEY=..' "$W/.env.production.local" || stop "QA anon 키를 읽지 못했다"
grep -q njsocpyuesntblifpips "$W/.env.production.local" && stop "운영 프로젝트 값이 들어갔다" || true
cd "$W" && npm ci --no-audit --no-fund
```

```sh
# [A2-2] 한 번의 호출 · timeout 600000
source /Users/hanmyeong-gwan/myseouldrop-ops/show-photos/env.sh
cd "$W"
npm run typecheck
npm run lint
npm test                                        # 전체 실행만 인정: 216파일 / 2,412개
```

```sh
# [A2-3] 한 번의 호출 · timeout 600000
source /Users/hanmyeong-gwan/myseouldrop-ops/show-photos/env.sh
cd "$W"
npm run audit:data:check
npm run build
test -z "$(git status --porcelain)" || stop "테스트·빌드가 추적 파일을 바꿨다(lib/.lightbox-*-extracted.tsx도 바이트까지 같아야 한다)"
```

```sh
# [A2-4] run_in_background · e2e(로그인이 필요한 spec은 스스로 skip한다). 끝난 뒤 출력을 확인한다
source /Users/hanmyeong-gwan/myseouldrop-ops/show-photos/env.sh
cd "$W"
npx playwright install chromium
CI=1 npx playwright test e2e/launch.spec.ts e2e/review-login-gate.spec.ts e2e/shared-list-auth.spec.ts e2e/ranking-retailers.spec.ts e2e/daiso-map.spec.ts > "$RUN/a2-e2e.log" 2>&1 || true
grep -qE '[0-9]+ passed' "$RUN/a2-e2e.log" || stop "e2e가 실행되지 않았다: $RUN/a2-e2e.log"
print -l '[chromium] › e2e/launch.spec.ts:68' '[chromium] › e2e/launch.spec.ts:77' '[chromium] › e2e/launch.spec.ts:85' | sort > "$RUN/known-failures.txt"
grep -oE '\[chromium\] › e2e/[a-z0-9-]+\.spec\.ts:[0-9]+' "$RUN/a2-e2e.log" | sort -u > "$RUN/a2-e2e-failed.txt" || true
test -z "$(comm -13 "$RUN/known-failures.txt" "$RUN/a2-e2e-failed.txt")" || stop "알려진 3건 밖의 e2e 실패: $(comm -13 "$RUN/known-failures.txt" "$RUN/a2-e2e-failed.txt")"
```

```sh
# [A2-5] run_in_background · 로컬 운영 빌드 서버(3002, QA 스택 사용)
source /Users/hanmyeong-gwan/myseouldrop-ops/show-photos/env.sh
cd "$W" && exec npm run start -- --hostname 127.0.0.1 --port 3002
```

```sh
# [A2-6] 한 번의 호출 · timeout 600000 · 헤드리스 점검 스크립트를 M 빌드로 먼저 검증한다(B2·D0·E3·F에서 같은 스크립트를 운영에 쓴다)
source /Users/hanmyeong-gwan/myseouldrop-ops/show-photos/env.sh
curl -sS --retry 60 --retry-connrefused --retry-delay 1 -o /dev/null http://127.0.0.1:3002/map
node "$RUN/headless-check.cjs" http://127.0.0.1:3002 "$RUN/headless-a2-local.json"
kill $(lsof -nP -t -iTCP:3002 -sTCP:LISTEN) || true
test -z "$(git -C "$W" status --porcelain)" || stop "통합 클론이 바뀌었다"
```

판정:
- **성공:**
  - typecheck와 lint 오류가 0이다. 2,412개가 통과한다. data audit와 build가 성공한다. git status가 비어 있다.
  - e2e 실패는 알려진 3건(`e2e/launch.spec.ts` 68·77·85행) 안에 있다.
  - 로컬 헤드리스 점검이 `failed: 0`이다.
- **중단:** 그 밖의 실패.
- **참고:**
  - 로컬 Node는 v23.9다. Node 24 검증은 A3의 PR CI가 맡는다.
  - 헤드리스 점검의 M 전용 표식(Photos 탭·섹션 없음, 저장 목록 안내 문구, 지도 핀의 공개 프로필 조회)은 main(b26586b)에서는 실패해야 정상이다.

**A3 PR(초안), CI, Preview** — 시작 조건: **C4 통과와 결정 3 승인.** 원격 브랜치에 쓰지만 운영은 아니다. Preview 배포만 생긴다.

```sh
# [A3-1] 한 번의 호출 · 통합 브랜치 push, 초안 PR, 동결 공지 코멘트
source /Users/hanmyeong-gwan/myseouldrop-ops/show-photos/env.sh
: ${M:?}
test "$(git -C "$W" rev-parse HEAD)" = "$M" || stop "통합 클론 HEAD가 M이 아니다"
git -C "$W" push github "${M}:refs/heads/integrate/booking-admin-20261021"
cat > "$RUN/pr-body.md" <<'EOF'
기능 브랜치 `codex/service-quality-release-20261018`(2d16930)를 main에 병합한다.
- 충돌 37개와 `components/map/map-sheet.tsx`는 기능 쪽을 채택했다. 결과 트리 = 2d16930^{tree} (64bd9652).
- main 쪽 4개 커밋(dc30b07·39ce149·8130d1a·b26586b)의 변경은 모두 기능 브랜치에 이미 들어 있다.
- DB 변경 없음. `20261020123000_store_profile_show_photos`는 이 배포 뒤 허용 목록 러너로 따로 적용한다(이 앱은 4키·5키 응답을 모두 받는다).
- 초안으로 둔다. 머지 버튼으로 병합하지 않는다. 검증한 같은 SHA를 main에 fast-forward push한다.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
ghs pr create --draft --repo "$REPO" --base main --head integrate/booking-admin-20261021 \
 --title "Merge booking admin release (2d16930) into main" --body-file "$RUN/pr-body.md"
ghs pr view integrate/booking-admin-20261021 --repo "$REPO" --json number --jq .number > "$RUN/pr-number"
ghs pr comment "$(cat "$RUN/pr-number")" --repo "$REPO" --body "$(tail -1 "$OPS/freeze-log.txt")"
```

```sh
# [A3-2] 한 번의 호출 · timeout 600000 · PR CI(Node 24). CI 실행이 아직 없으면 1분 뒤 다시 호출한다
source /Users/hanmyeong-gwan/myseouldrop-ops/show-photos/env.sh
RID=$(ghs run list --repo "$REPO" --workflow CI --branch integrate/booking-admin-20261021 -L5 --json databaseId,headSha --jq ".[] | select(.headSha == \"$M\") | .databaseId" | head -1)
[[ -n $RID ]] || stop "PR CI 실행이 아직 없다: 1분 뒤 다시"
ghs run watch "$RID" --repo "$REPO" --exit-status > "$RUN/a3-ci.txt" 2>&1 || stop "PR CI 실패: $RUN/a3-ci.txt"
```

```sh
# [A3-3] 한 번의 호출 · 운영 프로젝트 Preview 상태와 두 번째 프로젝트 실패 원인(읽기)
source /Users/hanmyeong-gwan/myseouldrop-ops/show-photos/env.sh
ghs api "repos/$REPO/commits/$M/status" --jq '.statuses[] | [.context, .state, .target_url] | @tsv' > "$RUN/a3-statuses.tsv"
grep -q $'^Vercel – seoul-guide-v2\tsuccess' "$RUN/a3-statuses.tsv" || stop "운영 프로젝트 Preview가 success가 아니다(빌드 중이면 잠시 뒤 다시)"
vadm inspect dpl_A26haHJUsEFkA8BewvEsFUF4VQ83 --logs 2>&1 | tail -40 > "$RUN/a3-second-project-e608426.log"
```

판정:
- **성공:**
  - PR CI(npm ci, typecheck, lint, test, build, Node 24)가 green이다.
  - `Vercel – seoul-guide-v2`가 success다. 커밋 상태는 전체 `.state`가 아니라 이 context만 본다. 두 번째 프로젝트 때문에 전체 상태가 빨갈 수 있다.
  - 두 번째 프로젝트의 실패 원인을 기록했다.
- **중단:**
  - CI 실패.
  - 운영 프로젝트 Preview 실패.
  - 두 번째 프로젝트의 실패 원인이 앱 코드 결함.
- PR은 B1까지 초안으로 둔다. 초안이어도 CI는 돈다.

**A4 (필요할 때만) main이 움직였을 때** — force push는 금지한다.

- **기본 규칙:** 이번 창을 닫고, 다른 날 A0부터 다시 계획한다. env.sh의 B·T·PREV_DPL, 충돌 수, 롤백 대상이 모두 바뀌기 때문이다.
- **같은 날 계속하기로 오너가 정하면**, 아래 절차로 기대 트리를 기계적으로 계산한다.

```sh
# [A4] 한 번의 호출 · 새 main(N2)이 기능 파일·DB 관련 파일을 건드리지 않았는지 확인하고 다시 병합
source /Users/hanmyeong-gwan/myseouldrop-ops/show-photos/env.sh
git -C "$W" fetch github
N2=$(git -C "$W" rev-parse github/main)
git -C "$W" merge-base --is-ancestor "$B" "$N2" || stop "main이 b26586b의 후손이 아니다(이력 재작성?)"
test -z "$(comm -12 <(git -C "$W" diff --name-only "$B" "$N2" | sort) <(git -C "$W" diff --name-only "$B" "$F" | sort))" || stop "새 main이 기능 파일을 건드렸다: 파일별 검토"
test -z "$(git -C "$W" diff --name-only "$B" "$N2" -- supabase scripts lib/partner lib/place-profile.ts lib/place-profile-server.ts)" || stop "새 main이 DB·계약 관련 파일을 바꿨다: C부터 다시"
cd "$W"
git checkout -q -B integrate/booking-admin-20261021-2 "$N2"
git merge --no-ff --no-commit "$F" > "$RUN/a4-merge.txt" 2>&1 || true
git checkout "$F" -- $(git diff --name-only "$B" "$F")          # 기능이 바꾼 178개(삭제 없음)는 모두 기능 쪽
test -z "$(git ls-files -u)" || stop "미해결 충돌"
test "$(git diff --cached --name-only "$N2" | sort)" = "$(git diff --name-only "$B" "$F" | sort)" || stop "새 main 대비 바뀐 파일이 기능의 178개와 다르다"
test "$(git diff --cached --name-only "$F" | sort)" = "$(git diff --name-only "$B" "$N2" | sort)" || stop "기능 대비 바뀐 파일이 새 main의 변경과 다르다"
git commit -q -m "Merge codex/service-quality-release-20261018 (2d16930) into main" \
 -m "Tree = 2d16930^{tree} with the main changes since b26586b; checked with git diff --name-only against both parents." \
 -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git rev-parse HEAD > "$RUN/merge-sha"
```

A4 뒤에 할 일:
1. env.sh의 `B`를 N2로, `T`를 새 트리로, `PREV_DPL`을 `vadm inspect "$ORIGIN" --json`의 id로 고친다. 고친 env.sh의 sha256을 `release-log.txt`에 기록한다.
2. `$RUN/rollback-target`을 다시 쓴다.
3. A2를 다시 한다.
4. 새 브랜치로 A3를 다시 한다(새 초안 PR, 옛 PR은 닫는다).
5. C3·C4는 위 두 번째 검사(DB·계약 파일)가 통과했으면 다시 하지 않는다.

### C. DB 사전 점검, 백업, 리허설 (A2 뒤, A3 전)

**C1 사전 점검** (운영 읽기 전용, 부록 B-1과 B-4) — 기대값은 SQL의 `ok` 열과 `check-results.cjs`가 판정한다. 눈으로 비교하지 않는다.

```sh
# [C1] 한 번의 호출 · timeout 600000
source /Users/hanmyeong-gwan/myseouldrop-ops/show-photos/env.sh
TS=$(date +%H%M)
node "$RUN/ro-sql.cjs" --production "$RUN/preflight.sql" "$RUN/preflight-production-$TS.json"
node "$RUN/check-results.cjs" ok "$RUN/preflight-production-$TS.json" --target production
cp -n "$RUN/preflight-production-$TS.json" "$RUN/golden-preflight.json"          # 이후 모든 비교의 골든
node "$RUN/ro-sql.cjs" --production "$RUN/verify-v5.sql" "$RUN/v5-baseline-c1.json" --set phase=pre
node "$RUN/check-results.cjs" ok "$RUN/v5-baseline-c1.json" --target production
node "$RUN/ro-sql.cjs" --production "$RUN/verify-v6.sql" "$RUN/v6-baseline-c1.json" || true   # 마지막 문장의 오류가 정상이라 종료 코드 1
node "$RUN/check-results.cjs" ok "$RUN/v6-baseline-c1.json" --target production --expect-error V6.partner-profile=P0001:AUTH_REQUIRED
```

`ok`가 판정하는 것:
1. `1.target`: `postgres`, `170006`, `check_function_bodies = on`. ro-sql은 접속 DB 이름, read-only 적용 여부, TLS 검증을 따로 단언한다.
2. `2.ledger`, `2.statements`, `2.ledger-columns`:
   - 원장 23행, head `20261019200901`, 보류 0, 대상 0.
   - `20261019200212`와 `20261019200901`의 statements sha256은 `3c06f5d8…`와 `6c1872e6…`다.
3. `2.privileges`: 원장 INSERT·DELETE 권한, `anon`·`authenticated`의 MEMBER·SET 권한이 모두 t다.
4. `3.columns`, `3.owner`: 7열이고 `show_photos`가 없다. `can_alter`가 t다.
5. `4.*`:
   - 본문 md5가 §1.2의 "지금 운영" 값과 같다.
   - owner는 postgres, prosecdef는 f/t/f, provolatile은 s/v/s다(booking_quote/partner_store_profile/store_profile_json 순).
   - `proconfig = {search_path=""}`, strict f, parallel u.
   - ACL(정렬)에 PUBLIC과 anon이 없고, authenticated는 `partner_store_profile`에만 있다.
   - 이름마다 함수가 1개다. 인자·반환형·cost·`pg_get_functiondef` md5는 골든 값으로만 쓴다.
6. `5.gate`: `0 | 0 | 0 | 0 | 0`.
7. `6.*`:
   - 대상 테이블 9개(merchant_store_profiles, merchants, merchant_profile_reviews, merchant_services, merchant_categories, merchant_booking_settings, merchant_staff, merchant_staff_menus, schema_migrations)에 5초 넘게 열린 트랜잭션의 잠금이 없다.
   - public·private·supabase_migrations에 AccessExclusive 잠금이나 대기 잠금이 없다.
   - 30초 넘은 트랜잭션이 없다.
8. `7.views`: 뷰(`pg_rewrite`) 의존이 없다.
9. V5 기준선: NULL 입력 응답이 10키이고 `showPhotos`가 없다. 견적이 32자 hex다. anon이 `{"status": "unpublished", …}`를 받는다.
10. V6 기준선: `P0001 AUTH_REQUIRED`.

중단과 해석:
- `2.ledger`·`2.statements`·`3.*`·`4.*`가 다르면 수동 변경을 의심하고 멈춘다.
- `5.gate`가 0이 아니면 동결 위반이다. 오너에게 보고한다.
- `6.*`는 순간값이다. 1분 뒤 새 이름으로 다시 실행한다.
- `2.privileges`가 f일 때:
  - DELETE가 없으면 멈추고 오너와 방법을 정한다(권한 부여, 또는 계획 수정과 재검토). 이유는 두 가지다.
    - §5.3 비상 롤백이 불가능하다.
    - 적용기와 롤백 SQL의 원장 잠금(`LOCK … IN SHARE ROW EXCLUSIVE MODE`)에는 원장의 UPDATE·DELETE·TRUNCATE 중 하나가 필요하다.
  - SET이 없으면 V5·V6을 운영에서 쓸 수 없다. 대신 E2 REST로 확인하고 기록한다.
- V6 기준선이 P0001이 아니면 메시지로 판단한다.
  - `permission denied to set role`: 검증 경로가 막힌 것이다. 이번 변경과 무관하다. E1에서 V6을 빼고 E2로 대신한다.
  - `permission denied for table users`: 기존 결함이다(`info.auth-users`도 f). 파트너 기능이 운영에서 이미 막혀 있다는 뜻이므로 오너에게 보고하고 온보딩 전 별도 과제로 넘긴다. D0·E1에서는 같은 코드·메시지로 `--expect-error`를 바꿔 "변화 없음"을 확인한다.
  - `permission denied for function`: 권한 문제다. 멈춘다.
- 인증 실패로 연결이 안 되면, 오너 확인 뒤 `vercel env pull`로 공유 트리의 로컬 파일을 갱신한다(오너 작업).

**C2 백업** (운영 읽기 전용, pg_dump) — 개인정보 행은 받지 않는다.
- `schema.dump`: 6개 스키마의 구조(함수 정의·권한 포함).
- `data.dump`: 원장과 `storage.buckets` 행만.
- 이번 변경이 닿는 테이블은 0행이고, 복구 경로는 fix-forward, §5.3 롤백 SQL, `fn-defs.sql` 출력이다. auth, profiles, favorites, client_errors, feedback의 행은 복구에 쓰일 일이 없으므로 복사하지 않는다.

```sh
# [C2] 한 번의 호출 · timeout 600000
source /Users/hanmyeong-gwan/myseouldrop-ops/show-photos/env.sh
docker ps --format '{{.Names}}' | grep -qx "$C" || stop "Docker 컨테이너 $C 가 없다"
docker cp "$CA" "$C":/tmp/myseouldrop-prod-ca.crt
node "$RUN/backup-show-photos.cjs" rehearsal
jq -e '.toc.ok' "$BK/backup-rehearsal.json" >/dev/null || stop "백업 목차 점검 실패: $BK/backup-rehearsal.json"
node "$RUN/ro-sql.cjs" --production "$RUN/fn-defs.sql" "$RUN/fn-defs-production.json"
node "$RUN/check-results.cjs" ok "$RUN/fn-defs-production.json" --target production
cp -n "$RUN/fn-defs-production.json" "$RUN/golden-fn-defs.json"
```

- **성공:**
  - `toc.ok`가 true다. 즉 `private` 스키마, 교체될 함수 3개, 원장 행, 버킷 행이 들어 있고, 그 밖의 TABLE DATA가 없다.
  - 두 덤프의 sha256이 기록돼 있다.
  - 함수 정의 골든이 저장됐다.
- **중단:** 실패, 또는 목차 점검 실패.
- 이 덤프는 리허설용이다. 기록용 백업은 D1 직전에 새로 받는다(D0-1).

**C3 빈 DB 리허설** — 10-21에 마쳤다. 25개를 순서대로 적용하고 161 checks를 통과했다.
- 다시 하지 않는다. M의 트리가 2d16930과 같고, 7b3af94·2d16930은 DB 파일을 바꾸지 않았다.
- 트리가 달라지면(결정 3 거부 후 수정, 또는 A4가 DB 파일을 바꾼 경우) `/private/tmp/claude-501/-Users-hanmyeong-gwan-mobile-design/c0d42143-4b4a-430f-8cde-e410efaabd0e/scratchpad/fresh-stack.sh`의 `REPO`를 `$W`로 바꿔 다시 실행한다.
- 이 리허설은 보류 마이그레이션까지 포함하는 로컬 전용 리허설이다.

**C4 복원본 리허설** (로컬 54382, 운영과 무관) — 모듈(`pg`, `esbuild`)과 테스트 스크립트는 `$W`(M)에서 쓴다. 공유 트리에서는 아무것도 실행하지 않는다.

```sh
# [C4-1] 한 번의 호출 · timeout 600000 · 복원 DB
source /Users/hanmyeong-gwan/myseouldrop-ops/show-photos/env.sh
docker ps --format '{{.Names}}' | grep -qx "$C" || stop "Docker 컨테이너 $C 가 없다"
N=booking_release_rehearsal_$(date +%s)
rpsql psql -h 127.0.0.1 -U postgres -d postgres -v ON_ERROR_STOP=1 -q -c "create database $N"
print -r -- "$N" > "$OPS/rehearsal-db-name"
docker cp "$BK/rehearsal/schema.dump" "$C":/tmp/show-photos-schema.dump
docker cp "$BK/rehearsal/data.dump" "$C":/tmp/show-photos-data.dump
rpsql pg_restore -h 127.0.0.1 -U postgres -d "$N" --no-owner /tmp/show-photos-schema.dump 2> "$RUN/c4-restore-schema.err" || true
rpsql pg_restore -h 127.0.0.1 -U postgres -d "$N" --no-owner --data-only /tmp/show-photos-data.dump 2> "$RUN/c4-restore-data.err" || true
docker exec "$C" rm -f /tmp/show-photos-schema.dump /tmp/show-photos-data.dump
node "$RUN/check-restore-errors.cjs" "$RUN/c4-restore-schema.err" "$RUN/c4-restore-data.err" | tee "$RUN/c4-restore-check.json" \
 || stop "허용 목록 밖의 복원 오류가 있다(위 블록): 아래 절차로 판단한다"
```

**복원 오류 판정.** `pg_restore`는 Supabase가 관리하는 역할과 기본 권한 때문에 오류를 내고 종료 코드 1로 끝난다. 그래서 종료 코드로 판정하지 않는다. 대신 `check-restore-errors.cjs`(부록 C-11)가 오류 블록을 하나씩 허용 목록과 맞춘다.
- 허용 목록에는 10-22 로컬 시험(같은 pg_dump 옵션, PostgreSQL 17.6, 부록 D)에서 나온 두 종류만 있다.
  - 새 DB에 `public` 스키마가 이미 있다.
  - Supabase 관리 역할(`supabase_admin`, `supabase_auth_admin`, `supabase_storage_admin`)의 기본 권한을 바꿀 수 없다.
- 운영 덤프는 로컬과 다른 오류를 낼 수 있다. 목록 밖의 블록이 하나라도 있으면 멈춘다.
- 멈췄을 때는 그 블록이 리허설 결과에 영향을 주는지 판단한다.
  - 무관하다고 판단하는 기준: 비교 대상(public·private·supabase_migrations의 객체, `storage.buckets`, 대상 함수가 부르는 auth 함수)과 관계가 없고, 리허설 결과를 바꾸지 않는다.
  - 무관하면: 근거를 `release-log.txt`에 쓴다. `$RUN/check-restore-errors.cjs`의 `ALLOW`에 그 블록에만 맞는 규칙을 하나 더하고, 새 sha256을 release-log에 기록한다. 그다음 새 DB로 C4-1부터 다시 한다.
  - 판단할 수 없으면 C4 실패다.

**리허설이 운영과 같다고 보는 범위.** C4-2·C4-5가 `same`으로 비교하는 항목뿐이다.
- 비교 항목:
  - 원장: statements, 열, 권한
  - 대상 테이블: 열, 소유자
  - 대상 함수: 본문, 속성, 정의, 오버로드
  - 동결 게이트, 뷰 의존
- 다를 수 있는 것: 역할·확장·auth·storage의 내부 구현, 다른 테이블의 데이터, 잠금 경합과 지연.
- 따라서 C4는 이 마이그레이션과 도구의 동작을 증명한다. 운영의 동시성은 D0의 `6.*`와 D1의 잠금·`lock_timeout`이 맡는다.

```sh
# [C4-2] 한 번의 호출 · timeout 600000 · 리허설이 운영 골든과 비교 항목에서 같은지, 파서 번들, 적용 전 셀 점검(C·A 셀)
source /Users/hanmyeong-gwan/myseouldrop-ops/show-photos/env.sh
node "$RUN/ro-sql.cjs" --rehearsal "$RUN/preflight.sql" "$RUN/preflight-rehearsal.json"
node "$RUN/check-results.cjs" same "$RUN/golden-preflight.json" "$RUN/preflight-rehearsal.json" \
 2.ledger 2.statements 2.ledger-columns 2.privileges 3.columns 3.owner 4.bodies 4.attrs 4.defs 4.overloads 5.gate 7.views
mkdir -p "$RUN/probe/main-src"
git -C "$W" archive "$B" lib tsconfig.json | tar -x -C "$RUN/probe/main-src"
"$W/node_modules/.bin/esbuild" "$W/lib/partner/profile-contracts.ts" --bundle --platform=node --format=cjs --log-level=warning --outfile="$RUN/probe/contracts-M.cjs"
"$W/node_modules/.bin/esbuild" "$RUN/probe/main-src/lib/partner/profile-contracts.ts" --bundle --platform=node --format=cjs --log-level=warning --outfile="$RUN/probe/contracts-main.cjs"
node "$RUN/cell-probe.cjs" --expect=pre "$RUN/cell-pre.json"
```

```sh
# [C4-3] 한 번의 호출 · timeout 600000 · 적용, 재실행 skip, V1–V6, 적용 후 셀 점검(D·B 셀)
source /Users/hanmyeong-gwan/myseouldrop-ops/show-photos/env.sh
node "$RUN/apply-show-photos.cjs" --rehearsal | tee "$RUN/c4-apply.txt"
node "$RUN/apply-show-photos.cjs" --rehearsal | tee "$RUN/c4-rerun.txt"
grep -qF '"verified":["LEDGER_GUARD","POST_GUARD"]' "$RUN/c4-rerun.txt" || stop "재실행이 검증된 skip이 아니다"
node "$RUN/ro-sql.cjs" --rehearsal "$RUN/verify-v1-v4.sql" "$RUN/verify-rehearsal.json"
node "$RUN/check-results.cjs" ok "$RUN/verify-rehearsal.json" --target rehearsal
node "$RUN/check-results.cjs" same "$RUN/preflight-rehearsal.json" "$RUN/verify-rehearsal.json" 4.attrs=V3.attrs
node "$RUN/ro-sql.cjs" --rehearsal "$RUN/verify-v5.sql" "$RUN/v5-rehearsal.json" --set phase=post
node "$RUN/check-results.cjs" ok "$RUN/v5-rehearsal.json" --target rehearsal
node "$RUN/ro-sql.cjs" --rehearsal "$RUN/verify-v6.sql" "$RUN/v6-rehearsal.json" || true
node "$RUN/check-results.cjs" ok "$RUN/v6-rehearsal.json" --target rehearsal --expect-error V6.partner-profile=P0001:AUTH_REQUIRED
node "$RUN/cell-probe.cjs" --expect=post "$RUN/cell-post.json"
```

```sh
# [C4-4] 한 번의 호출 · timeout 600000 · 의미 검증(161 checks, 고객 예약). 이 스크립트는 자기 트랜잭션에서 마이그레이션 본문을
# 다시 적용하므로 '러너가 설치한 상태'의 증거가 아니다. 설치 상태는 위 V1–V6과 skip이 증명하고, 아래 V 재확인으로 바뀌지 않았음을 본다
source /Users/hanmyeong-gwan/myseouldrop-ops/show-photos/env.sh
(cd "$W" && BOOKING_TEST_DB_PORT=54382 node -r "$RUN/rehearsal-pg.cjs" scripts/test-partner-operations-db.cjs) | tail -1 > "$RUN/c4-partner-ops.json"
jq -e '.status == "passed" and .checks == 161' "$RUN/c4-partner-ops.json" >/dev/null || stop "partner operations DB 검증 실패"
(cd "$W" && BOOKING_TEST_DB_PORT=54382 node -r "$RUN/rehearsal-pg.cjs" scripts/test-integrated-booking-db.cjs) | tail -1 > "$RUN/c4-integrated-booking.json"
jq -e '.status == "passed"' "$RUN/c4-integrated-booking.json" >/dev/null || stop "고객 예약 DB 검증 실패"
node "$RUN/ro-sql.cjs" --rehearsal "$RUN/verify-v1-v4.sql" "$RUN/verify-rehearsal-after-tests.json"
node "$RUN/check-results.cjs" same "$RUN/verify-rehearsal.json" "$RUN/verify-rehearsal-after-tests.json" V1.column V2.bodies V3.attrs V4.ledger V4.counts
```

```sh
# [C4-5] 한 번의 호출 · timeout 600000 · 비상 롤백 리허설: 음성 시험(원장 head가 아님) → 실제 롤백 → 골든 비교 → 재적용
source /Users/hanmyeong-gwan/myseouldrop-ops/show-photos/env.sh
N=$(cat "$OPS/rehearsal-db-name")
rpsql psql -h 127.0.0.1 -U postgres -d "$N" -v ON_ERROR_STOP=1 -q -c "insert into supabase_migrations.schema_migrations(version, name, statements) values ('20261021999999', 'c4_negative_probe', array['-- c4 negative probe'])"
node "$RUN/rollback-show-photos.cjs" --rehearsal 2> "$RUN/c4-negative-head.err" && stop "음성 시험 실패: 20261020123000이 head가 아닌데 롤백이 커밋됐다"
grep -q 'is not the ledger head' "$RUN/c4-negative-head.err" || stop "음성 시험이 ROLLBACK_GUARD가 아닌 이유로 실패했다: $(cat "$RUN/c4-negative-head.err")"
rpsql psql -h 127.0.0.1 -U postgres -d "$N" -v ON_ERROR_STOP=1 -q -c "delete from supabase_migrations.schema_migrations where version = '20261021999999'"
node "$RUN/rollback-show-photos.cjs" --rehearsal | tee "$RUN/c4-rollback.txt"
node "$RUN/ro-sql.cjs" --rehearsal "$RUN/preflight.sql" "$RUN/preflight-rehearsal-after-rollback.json"
node "$RUN/check-results.cjs" same "$RUN/golden-preflight.json" "$RUN/preflight-rehearsal-after-rollback.json" \
 2.ledger 2.statements 3.columns 3.owner 4.bodies 4.attrs 4.defs 4.overloads 5.gate
node "$RUN/ro-sql.cjs" --rehearsal "$RUN/fn-defs.sql" "$RUN/fn-defs-rehearsal-after-rollback.json"
node "$RUN/check-results.cjs" same "$RUN/golden-fn-defs.json" "$RUN/fn-defs-rehearsal-after-rollback.json" defs
node "$RUN/apply-show-photos.cjs" --rehearsal | tee "$RUN/c4-reapply.txt"         # 다시 적용(이때 V1 attnum은 9. 리허설에서만 정상)
node "$RUN/ro-sql.cjs" --rehearsal "$RUN/verify-v1-v4.sql" "$RUN/verify-rehearsal-reapply.json"
node "$RUN/check-results.cjs" ok "$RUN/verify-rehearsal-reapply.json" --target rehearsal
```

```sh
# [C4-6] 한 번의 호출 · 통과 표식(운영 적용기는 이 파일이 없으면 시작하지 않는다)
source /Users/hanmyeong-gwan/myseouldrop-ops/show-photos/env.sh
jq -s -e 'all(.[]; .verdict == .want)' "$RUN/cell-pre.json" "$RUN/cell-post.json" >/dev/null || stop "셀 점검 증거가 없다"
grep -q '"rolledBack"' "$RUN/c4-rollback.txt" && grep -q '"applied"' "$RUN/c4-reapply.txt" || stop "롤백·재적용 증거가 없다"
jq -n --arg db "$(cat "$OPS/rehearsal-db-name")" \
 --arg migration "$(shasum -a 256 "$W/supabase/migrations/20261020123000_store_profile_show_photos.sql" | cut -d' ' -f1)" \
 --arg guards "$(shasum -a 256 "$RUN/apply-guards.sql" | cut -d' ' -f1)" \
 --arg rollback "$(shasum -a 256 "$RUN/rollback-20261020123000.sql" | cut -d' ' -f1)" \
 --slurpfile backup "$BK/backup-rehearsal.json" \
 '{rehearsalDb: $db, migrationSha256: $migration, guardsSha256: $guards, rollbackSqlSha256: $rollback,
   rehearsalBackup: [$backup[0].files[] | {part, sha256}], completedAt: (now | todate)}' > "$RUN/c4-passed.json"
print -r -- "$(date '+%F %T %Z') C4 통과: $(jq -c . "$RUN/c4-passed.json")" >> "$OPS/release-log.txt"
```

- **러너가 마이그레이션을 실제로 설치했다는 증거:** 이것이 C4의 통과 기준이다.
  - 적용 출력(`applied`)과 검증된 재실행 skip(LEDGER_GUARD·POST_GUARD 통과)
  - V1–V4 `ok`와 `4.attrs=V3.attrs` 동일
  - V5(post)와 V6(P0001)
  - 셀 점검 post
  - 테스트 뒤 V 재확인(바뀌지 않음)
- **의미 검증(보조):** 161 checks와 고객 예약 검증.
- **호환 표 실행 증거:**
  - `cell-pre.json`: M과 main 파서가 둘 다 통과한다. M이 보내는 4키 저장도 통과한다.
  - `cell-post.json`: M은 통과하고 main은 GET·저장·공개 모두 실패한다.
- **롤백 증거:**
  - 음성 시험이 원장 head 검사에서 거부된다.
  - 롤백 뒤 `preflight`와 `fn-defs`가 운영 골든과 같다. 즉 `pg_get_functiondef`까지 일치한다.
  - 재적용이 `ok`다.
- **중단:** 어느 하나라도 실패하면 D로 가지 않는다. 고친 뒤 C1부터 다시 한다. 실행 파일을 고쳤다면 sha256과 러너의 고정값을 바꾸고 다시 검토한다.

**결정 3 확인** — C4 통과 뒤, A3 전에 오너가 rpc-2를 결정하고 `release-log.txt`에 기록한다.
- 근거 자료: `cell-pre/post.json`, `codex-review-fixes.md:80,145`, Codex 검토 의견.
- 거부되면 §0 결정 3대로 이 계획을 멈춘다.

### B. 앱 배포와 확인

**B0 push 직전 기준선** (운영 읽기 전용)

```sh
# [B0] 한 번의 호출
source /Users/hanmyeong-gwan/myseouldrop-ops/show-photos/env.sh
: ${M:?}
test -f "$RUN/c4-passed.json" || stop "C4 통과 표식이 없다"
vadm inspect "$ORIGIN" --json | jq -e --arg d "$(cat "$RUN/rollback-target")" '.id == $d' >/dev/null || stop "운영이 기록한 롤백 대상($PREV_DPL)이 아니다"
date -u +%FT%TZ > "$RUN/b0-at"
node "$RUN/ro-sql.cjs" --production "$RUN/monitor.sql" "$RUN/monitor-before-app.json" --set "release=$REL" --set "since=$(cat "$RUN/b0-at")"
node "$RUN/check-results.cjs" ok "$RUN/monitor-before-app.json" --target production
```

- **오너 회원 기준선:**
  - 오너가 자기 계정으로 myseouldrop.app에 로그인한 상태에서 Saved 목록의 장소·상품 수를 적는다.
  - DevTools → Application → Local Storage에서 `essenly.favorites`, `essenly.favorites.owner` 키가 있는지 확인한다.
  - 실행자가 이 숫자와 결과를 기록한다.
- **결정 확인:** 결정 2(push)와 결정 7(사전 승인)이 기록돼 있어야 한다.

**B1 ⚠ 운영 쓰기 — main fast-forward push** (결정 2 이후)

```sh
# [B1] 한 번의 호출 · ⚠ 운영 쓰기(Vercel이 운영에 자동 배포)
source /Users/hanmyeong-gwan/myseouldrop-ops/show-photos/env.sh
: ${M:?} ${B:?} ${W:?}
[[ ${#M} -eq 40 ]] || stop "M 형식이 이상하다"
git -C "$W" fetch github && test "$(git -C "$W" rev-parse github/main)" = "$B" && test "$(git -C "$W" rev-parse HEAD)" = "$M" && git -C "$W" push github "${M}:refs/heads/main" || stop "B1 중단: main이 움직였거나 push가 거부됐다 → A4"
date -u +%FT%TZ > "$RUN/b1-pushed-at"
print -r -- "$(date '+%F %T %Z') B1 push M=$M" >> "$OPS/release-log.txt"
```

- **성공:** push가 fast-forward로 수락된다.
- **중단:** 거부되면(main이 움직였다면) A4로 간다.
- GitHub 머지 버튼은 다른 SHA를 만들므로 쓰지 않는다.
- CI는 배포를 막지 않으므로 모든 검증은 A와 C에서 끝나 있어야 한다.

**B2 배포 확인** — 운영 도메인 두 개가 M의 배포를 가리키는지 단언한다. 커밋 상태 context는 Preview와 공유되므로 배포 판단에 쓰지 않는다.

```sh
# [B2-1] 한 번의 호출 · M의 운영 배포 찾기. 아직 없으면 1분 간격으로 다시 호출한다(최대 10분)
source /Users/hanmyeong-gwan/myseouldrop-ops/show-photos/env.sh
: ${M:?}
vadm api "/v6/deployments?projectId=$VPRJ&teamId=$VTEAM&limit=10" \
 | jq --arg m "$M" '[.deployments[] | select(.meta.githubCommitSha == $m and .target == "production") | {uid, url, state, readyState, target, source, ref: .meta.githubCommitRef}]' > "$RUN/b2-m-deployments.json"
jq -e 'length == 1 and .[0].source == "git" and .[0].ref == "main"' "$RUN/b2-m-deployments.json" >/dev/null || stop "M의 운영 배포가 아직 하나로 잡히지 않는다: $(jq -c . "$RUN/b2-m-deployments.json")"
```

```sh
# [B2-2] 한 번의 호출 · timeout 600000 · READY까지 기다리고 MDPL을 기록(9분 안에 끝나지 않으면 다시 호출)
source /Users/hanmyeong-gwan/myseouldrop-ops/show-photos/env.sh
U=$(jq -r '.[0].url' "$RUN/b2-m-deployments.json")
vadm inspect "https://$U" --wait --timeout 9m --json > "$RUN/b2-inspect-m.json" || stop "M 배포가 READY가 아니다(ERROR·BLOCKED이면 §5.1 'B2 빌드 실패')"
jq -e '.readyState == "READY" and .target == "production"' "$RUN/b2-inspect-m.json" >/dev/null || stop "M 배포 상태가 이상하다"
jq -r .id "$RUN/b2-inspect-m.json" > "$RUN/m-deployment-id"
```

```sh
# [B2-3] 한 번의 호출 · 운영 = M 단언(GitHub main, 프로젝트 운영 대상, 두 도메인)과 GitHub Production 배포 상태
source /Users/hanmyeong-gwan/myseouldrop-ops/show-photos/env.sh
assert_prod_is_m
DEP=$(ghs api "repos/$REPO/deployments?sha=$M&per_page=30" --jq '[.[] | select(.environment | test("^production( – seoul-guide-v2)?$"; "i"))] | if length == 1 then .[0].id else error("Production deployments for M: \(length)") end')
test "$(ghs api "repos/$REPO/deployments/$DEP/statuses?per_page=1" --jq '.[0].state')" = success || stop "GitHub Production 배포 상태가 success가 아니다"
print -r -- "$(date '+%F %T %Z') B2 MDPL=$MDPL, 도메인 2개 = MDPL" >> "$OPS/release-log.txt"
```

```sh
# [B2-4] 한 번의 호출 · timeout 600000 · main CI(배포는 막지 않지만 결과를 확인)
source /Users/hanmyeong-gwan/myseouldrop-ops/show-photos/env.sh
RID=$(ghs run list --repo "$REPO" --workflow CI --branch main -L5 --json databaseId,headSha --jq ".[] | select(.headSha == \"$M\") | .databaseId" | head -1)
[[ -n $RID ]] || stop "main CI 실행이 아직 없다: 잠시 뒤 다시"
ghs run watch "$RID" --repo "$REPO" --exit-status > "$RUN/b2-ci.txt" 2>&1 || stop "main CI 실패(배포는 이미 됐다) → §5.1 판단"
```

```sh
# [B2-5] 한 번의 호출 · timeout 600000 · HTTP와 헤드리스(M 전용 표식은 하드 단언)
source /Users/hanmyeong-gwan/myseouldrop-ops/show-photos/env.sh
{ for p in / /map /favorites /bookings /partner "/place/$P" "/place/$PH"; do print -r -- "page $p $(curl -sS -L -o /dev/null -w '%{http_code}' "$ORIGIN$p")"; done
  for p in profile location booking; do print -r -- "api $p $(curl -sS -o /dev/null -w '%{http_code}' "$ORIGIN/api/places/$P/$p")"; done
  print -r -- "api partner $(curl -sS -o /dev/null -w '%{http_code}' "$ORIGIN/api/partner/operations/profile")"; } | tee "$RUN/b2-http.txt"
diff <(print -l "page / 200" "page /map 200" "page /favorites 200" "page /bookings 200" "page /partner 200" "page /place/$P 200" "page /place/$PH 200" \
 "api profile 200" "api location 200" "api booking 200" "api partner 401") "$RUN/b2-http.txt" || stop "HTTP 기대값과 다르다(403이면 봇 챌린지: 헤드리스 결과로 판단)"
curl -sS "$ORIGIN/api/places/$P/profile" | jq -e --arg p "$P" '. == {status: "unpublished", placeId: $p}' >/dev/null || stop "공개 프로필 응답이 다르다"
node "$RUN/headless-check.cjs" "$ORIGIN" "$RUN/headless-b2.json"
```

```sh
# [B2-6] 한 번의 호출 · 스모크와 Uptime 실행 요청(include_account_data는 기본값 false)
source /Users/hanmyeong-gwan/myseouldrop-ops/show-photos/env.sh
date -u +%FT%TZ > "$RUN/b2-dispatch-at"
ghs workflow run "Production public smoke" --repo "$REPO" -f base_url="$ORIGIN"
ghs workflow run Uptime --repo "$REPO"
```

```sh
# [B2-7] 한 번의 호출 · 방금 요청한 실행 ID 찾기(목록에 아직 없으면 30초 뒤 다시)
# 고르는 조건: workflow_dispatch, head_sha = M, 실행자 = gksaudrhks12-sys, T0 이후 생성. 정확히 하나여야 한다
source /Users/hanmyeong-gwan/myseouldrop-ops/show-photos/env.sh
: ${M:?}
T0=$(cat "$RUN/b2-dispatch-at")
for wf in production-public-smoke uptime; do
  ghs api -X GET "repos/$REPO/actions/workflows/$wf.yml/runs" -f event=workflow_dispatch -f head_sha="$M" \
   -f actor=gksaudrhks12-sys -f created=">=$T0" -f per_page=10 \
   --jq '[.workflow_runs[] | {id, created_at, head_sha, actor: .actor.login, status}]' > "$RUN/b2-runs-$wf.json"
  n=$(jq length "$RUN/b2-runs-$wf.json")
  [[ $n != 0 ]] || stop "$wf 실행이 아직 목록에 없다: 30초 뒤 다시"
  [[ $n == 1 ]] || stop "$wf: 조건에 맞는 실행이 $n개다(같은 계정의 중복 요청?): $(jq -c . "$RUN/b2-runs-$wf.json")"
  jq -r '.[0].id' "$RUN/b2-runs-$wf.json" > "$RUN/b2-run-$wf"
done
```

```sh
# [B2-8] 한 번의 호출 · timeout 600000 · 결과 판정: 스모크 실패는 알려진 3건(68·77·85)의 부분집합이어야 한다
source /Users/hanmyeong-gwan/myseouldrop-ops/show-photos/env.sh
SM=$(cat "$RUN/b2-run-production-public-smoke"); UP=$(cat "$RUN/b2-run-uptime")
ghs run watch "$UP" --repo "$REPO" --exit-status > /dev/null 2>&1 || stop "Uptime 실패 → §5.1 트리거"
ghs run watch "$SM" --repo "$REPO" > /dev/null 2>&1 || true
CONC=$(ghs run view "$SM" --repo "$REPO" --json conclusion --jq .conclusion)
if [[ $CONC != success ]]; then
  ghs run view "$SM" --repo "$REPO" --log-failed > "$RUN/smoke-$SM.log" 2>&1 || true
  grep -oE '\[chromium\] › e2e/[a-z0-9-]+\.spec\.ts:[0-9]+' "$RUN/smoke-$SM.log" | sort -u > "$RUN/smoke-$SM-failed.txt" || true
  [[ -s $RUN/smoke-$SM-failed.txt ]] || stop "스모크가 테스트 전에 실패했다: $RUN/smoke-$SM.log"
  test -z "$(comm -13 "$RUN/known-failures.txt" "$RUN/smoke-$SM-failed.txt")" || stop "알려진 3건 밖의 스모크 실패: $(comm -13 "$RUN/known-failures.txt" "$RUN/smoke-$SM-failed.txt")"
fi
```

**B2-9 오너 회원 스모크** (오너가 자기 계정으로)
1. 로그인한다.
2. Saved 목록의 장소·상품 수가 B0 기록과 같은지 본다.
3. 새로고침한 뒤 다시 본다.
4. 로그아웃한다.
5. 오류 알림이 없는지, 그리고 Local Storage에서 `essenly.favorites`, `essenly.favorites.owner`, `essenly.favorites.mergedFor`가 지워졌는지 본다.
6. 다시 로그인해 목록이 그대로인지 본다.
- 하트가 사라지거나 목록이 다르면 즉시 §5.1로 간다.
- 선택: 오너가 승인하면 자기 계정에서 하트 1개를 켰다가 끈다(**⚠ 운영 쓰기**, 오너 자신의 favorites 1행). 다른 기기에서 반영되는지 확인한다.

B2 판정:
- **성공:**
  - B2-3의 단언(GitHub main, 프로젝트 운영 대상, 두 도메인 = MDPL, GitHub Production 배포 success)이 통과한다.
  - main CI가 success다.
  - HTTP 기대값이 맞다.
  - 헤드리스가 `failed: 0`이다. M 전용 표식이 하드 단언으로 들어 있다:
    - `/place/$P`에 Photos 탭·섹션 없음
    - `/place/$PH`에 콜라주 3칸, "+2", 라이트박스
    - `/favorites` 비회원 문구 "Sign in to save places — hearts are kept on your account."
    - 지도 핀 선택 때 공개 프로필·사진 조회
    - 상품 히어로 contain
  - 스모크 실패가 알려진 3건 안에 있다. Uptime이 success다.
  - 오너 회원 스모크를 통과했다.
- **중단:**
  - 배포가 ERROR나 BLOCKED이면 운영은 이전 배포 그대로다. §5.1 "B2 빌드 실패"로 간다. C 이후로 진행하지 않는다.
  - 새 실패, 5xx, 헤드리스 실패가 나오면 §5.1로 간다(결정 7).

**B3 관찰 30분 이상** (운영 읽기 전용) — 사용자가 5명 수준이라 수동 관찰만으로는 표본이 거의 없다. 그래서 스크립트로 헤드리스 순회를 돌려 트래픽을 만든다.

```sh
# [B3-1] run_in_background · 헤드리스 10회 순회(사용자 에이전트에 점검 표식)
source /Users/hanmyeong-gwan/myseouldrop-ops/show-photos/env.sh
node "$RUN/headless-check.cjs" "$ORIGIN" "$RUN/headless-b3-loop.json" --loops=10
```

```sh
# [B3-2] 한 번의 호출 · B1 뒤 30분 이상 지나 실행
source /Users/hanmyeong-gwan/myseouldrop-ops/show-photos/env.sh
TS=$(date +%H%M)
node "$RUN/ro-sql.cjs" --production "$RUN/monitor.sql" "$RUN/monitor-b3-$TS.json" --set "release=$REL" --set "since=$(cat "$RUN/b1-pushed-at")"
node "$RUN/check-results.cjs" ok "$RUN/monitor-b3-$TS.json" --target production
jq -e '.failed == 0' "$RUN/headless-b3-loop.json" >/dev/null || stop "B3 헤드리스 순회 실패 → §5.1 트리거"
```

- **성공:** `M.release-trigger`가 ok다(release = `left(M,12)` 오류가 3건 미만이고 1개 페이지 이하). 동결 수치가 0이다. 순회가 실패 0이다.
- 옛 번들을 연 채 남은 브라우저는 옛 release(`b26586bd65f8`)로 chunk-load 오류를 남길 수 있다. 이것은 예상된 일시 오류이며 트리거가 아니다.
- **중단:** F2의 수치 트리거를 충족하면 §5.1로 간다.

**B4 같은 운영 Supabase를 쓰는 다른 배포** (읽기 전용, D0 전)

```sh
# [B4] 한 번의 호출 · 두 번째 프로젝트의 운영 배포·도메인·보호 설정, 운영 프로젝트의 Preview 보호
source /Users/hanmyeong-gwan/myseouldrop-ops/show-photos/env.sh
vadm api "/v9/projects/seoul-guide-v2-preview-20261018?teamId=$VTEAM" | jq '{id, name, ssoProtection, passwordProtection, production: (.targets.production | {id, url, readyState, sha: .meta.githubCommitSha})}' | tee "$RUN/b4-second-project.json"
vadm api "/v9/projects/seoul-guide-v2-preview-20261018/domains?teamId=$VTEAM" | jq -r '.domains[].name' > "$RUN/b4-second-domains.txt"
vadm api "/v9/projects/$VPRJ?teamId=$VTEAM" | jq '{ssoProtection, passwordProtection}' | tee "$RUN/b4-main-project-protection.json"
: > "$RUN/b4-second-domains-check.txt"
for d in $(cat "$RUN/b4-second-domains.txt"); do
  code=$(curl -sS -o "$RUN/b4-$d.html" -w '%{http_code}' "https://$d/" || print 000); hits=0
  if [[ $code == 200 ]]; then
    for c in $(grep -oE '/_next/static/chunks/[A-Za-z0-9/_.-]+\.js' "$RUN/b4-$d.html" | sort -u); do
      curl -sS -o "$RUN/b4-chunk.js" "https://$d$c" || true
      grep -q njsocpyuesntblifpips "$RUN/b4-chunk.js" && hits=$((hits+1)) || true
    done
  fi
  print -r -- "$d http=$code production-supabase-chunks=$hits" | tee -a "$RUN/b4-second-domains-check.txt"
done
```

판정은 기록이고, 조치는 오너가 결정한다.
- 두 번째 프로젝트가 401·403(보호됨)이거나 운영 Supabase를 쓰지 않으면 사용자 노출 위험이 없다.
- 공개(200)이고 운영 Supabase를 쓰며 운영 배포가 b26586b 코드면, D 이후 첫 온보딩부터 B 셀 클라이언트가 된다. 이때 오너가 둘 중 하나를 결정한다: 그 프로젝트를 M 이상으로 다시 배포한다, 또는 별칭과 Git 자동 배포를 끈다. 이 작업은 이 계획 밖이다. 결정과 조치 완료는 **동결 해제 조건(F4)**에 넣는다.
- 운영 프로젝트 Preview에 보호(`ssoProtection`)가 없으면, 오래된 Preview가 공개돼 있다는 위험을 기록하고 오너가 수용 여부를 정한다.

### D. 적용

**D0 직전 재확인** (D1 전 30분 이내, 읽기 전용) — 기록용 백업을 새로 받는다. D1이 3시간 넘게 밀리면 D0을 다시 한다. 적용기가 3시간 넘은 백업을 거부한다.

```sh
# [D0-1] 한 번의 호출 · timeout 600000 · 기록용 백업(다시 받을 때는 먼저 mv "$BK/d1" "$BK/d1-$(date +%H%M)" && mv "$BK/backup-d1.json" "$BK/backup-d1-$(date +%H%M).json")
source /Users/hanmyeong-gwan/myseouldrop-ops/show-photos/env.sh
docker ps --format '{{.Names}}' | grep -qx "$C" || stop "Docker 컨테이너 $C 가 없다"
docker cp "$CA" "$C":/tmp/myseouldrop-prod-ca.crt
node "$RUN/backup-show-photos.cjs" d1
jq -e '.toc.ok' "$BK/backup-d1.json" >/dev/null || stop "D0 백업 목차 점검 실패"
```

```sh
# [D0-2] 한 번의 호출 · timeout 600000 · C1 골든과 같은지, V5·V6 기준선, 남은 세션
source /Users/hanmyeong-gwan/myseouldrop-ops/show-photos/env.sh
TS=$(date +%H%M)
node "$RUN/ro-sql.cjs" --production "$RUN/preflight.sql" "$RUN/preflight-d0-$TS.json"
node "$RUN/check-results.cjs" ok "$RUN/preflight-d0-$TS.json" --target production
node "$RUN/check-results.cjs" same "$RUN/golden-preflight.json" "$RUN/preflight-d0-$TS.json" \
 1.target 2.ledger 2.statements 2.ledger-columns 2.privileges 3.columns 3.owner 4.bodies 4.attrs 4.defs 4.overloads 5.gate 7.views
node "$RUN/ro-sql.cjs" --production "$RUN/verify-v5.sql" "$RUN/v5-baseline-d0-$TS.json" --set phase=pre
node "$RUN/check-results.cjs" ok "$RUN/v5-baseline-d0-$TS.json" --target production
node "$RUN/ro-sql.cjs" --production "$RUN/verify-v6.sql" "$RUN/v6-baseline-d0-$TS.json" || true
node "$RUN/check-results.cjs" ok "$RUN/v6-baseline-d0-$TS.json" --target production --expect-error V6.partner-profile=P0001:AUTH_REQUIRED
node "$RUN/ro-sql.cjs" --production "$RUN/orphans.sql" "$RUN/orphans-d0-$TS.json"
node "$RUN/check-results.cjs" ok "$RUN/orphans-d0-$TS.json" --target production
```

```sh
# [D0-3] 한 번의 호출 · 운영 = M(앱 먼저 원칙)
source /Users/hanmyeong-gwan/myseouldrop-ops/show-photos/env.sh
assert_prod_is_m
```

- **성공:**
  - 기록용 백업 목차가 ok다.
  - D0 출력이 `ok`이고 C1 골든과 같다.
  - V5·V6 기준선이 C1과 같다.
  - 남은 세션과 잠금이 없다.
  - 운영이 M이다.
  - 결정 3·4가 기록돼 있다.
  - B4 결과를 오너가 확인했다.
  - 오너가 "진행"이라고 했다.
- **중단:** 하나라도 아니면 멈춘다. 운영이 M이 아니면 앱 먼저 원칙에 어긋나므로 멈춘다.

**D1 ⚠ 운영 쓰기 — 적용** (포그라운드, timeout 600000. 백그라운드나 짧은 timeout으로 실행하지 않는다)

```sh
# [D1] 한 번의 호출 · ⚠ 운영 쓰기 · 포그라운드 · timeout 600000
source /Users/hanmyeong-gwan/myseouldrop-ops/show-photos/env.sh
: ${M:?} ${MDPL:?}
node "$RUN/apply-show-photos.cjs" --production 2>&1 | tee "$RUN/apply-production.log"
print -r -- "$(date '+%F %T %Z') D1 적용 완료: $(grep -c '"applied"' "$RUN/apply-production.log")" >> "$OPS/release-log.txt"
```

**시작 전 확인(적용기 자신이 한다, 부록 C-1)**
- 매니페스트 1개, 소스는 `$W`.
- `apply-guards.sql`의 sha256 고정값.
- 마이그레이션 sha256.
- `c4-passed.json`이 같은 마이그레이션·가드를 리허설했는지.
- `backup-d1.json`: 덤프 sha256 재계산 일치, 목차 ok, 3시간 이내.

**트랜잭션 안 순서**
1. `set application_name = 'myseouldrop-show-photos-apply'`(begin 전, 풀러를 거쳐도 세션을 식별할 수 있게)
2. `begin`
3. `lock_timeout 3s`, `statement_timeout 60s`, `idle_in_transaction_session_timeout 30s`
4. `pg_advisory_xact_lock(hashtext('myseouldrop-release-migrations'))`
5. 원장에 대상 버전이 있는지 본다. 있으면 LEDGER_GUARD와 POST_GUARD로 상태를 검증한 뒤 아무것도 쓰지 않고 rollback하고 skip을 보고한다(검증 실패는 `phase=skip-verify`).
6. PRE_GUARD
   - 먼저 잠근다:
     - 원장: `SHARE ROW EXCLUSIVE`. Supabase CLI 등 다른 쓰기는 advisory lock을 잡지 않으므로 테이블 잠금으로 막는다.
     - 동결 테이블 5개(merchants, merchant_memberships, merchant_publications, merchant_store_profiles, customer_bookings): `SHARE`. COMMIT까지 쓰기를 막고 읽기는 막지 않는다.
   - 그다음 검사한다: 원장 23·head·보류·대상, 열 없음, 본문 md5, `check_function_bodies`, 온보딩 동결(C1 `5.gate`와 같은 5개 수치가 모두 0)
7. SNAPSHOT(before): owner, security definer, volatility, config, ACL, strict, parallel, cost, language, 인자, 반환형
8. 마이그레이션 파일 원문
9. POST_GUARD
10. SNAPSHOT(after), before와 같다고 단언
11. 원장 insert
12. LEDGER_GUARD: 24행, head `20261020123000`, 보류 없음. 그 행의 name과 statements(1개, sha256 = 파일)가 검토본이다.
13. `notify pgrst, 'reload schema'`: 트랜잭션 안에 쌓였다가 COMMIT이 성공할 때만 전달된다
14. `commit`

잠금 순서는 적용과 롤백 모두 advisory lock → 원장 → public 테이블이다.

**커밋 뒤(보고 전용)**
- 원장, RLS 테이블 15개 이상, 버킷 설정을 다시 읽어 보고한다.
- 증거는 `$RUN/migrations-production-<ms>.json`(0600)에 남긴다.
- 이 점검이 실패하면 종료 코드 3이다. 적용은 끝났고 재로드도 이미 전달됐다. 재실행하지 않는다.

**잠금과 시간**
- ALTER가 잡은 `merchant_store_profiles`의 AccessExclusiveLock은 COMMIT까지 유지된다. PRE_GUARD가 이미 SHARE로 잡은 같은 테이블을 같은 트랜잭션 안에서 올리는 것이다.
  - ALTER 뒤 COMMIT까지 왕복은 POST_GUARD, SNAPSHOT, insert, LEDGER_GUARD, notify, commit 등 약 7회다.
  - 서울에서 us-east-1까지 약 1.2–1.8초 걸린다.
- **최악의 경우**, 일부 장소 프로필 요청이 최대 약 5초(대기 3초 + 보유 1.8초) 멈출 수 있다.
  - ALTER가 잠금을 기다리는 동안(최대 `lock_timeout` 3초)에도, 그 뒤에 오는 AccessShareLock 요청은 줄을 선다.
  - 해당 요청은 `private.public_store_profile`의 첫 호출이다. 이 함수는 plpgsql이고 `p public.merchant_store_profiles`를 선언한다(200212:90).
  - 아직 행 타입을 캐시하지 않은 백엔드에서 첫 호출은 행 타입 조회를 위해 테이블을 AccessShareLock으로 연다.
  - 공개 프로필·위치·장소 상세 요청 일부가 여기에 해당한다.
- 원장과 동결 테이블 5개의 잠금은 PRE_GUARD부터 COMMIT까지 약 2초 유지된다.
  - 이 잠금들은 쓰기만 막는다. 동결 중에는 이 테이블에 쓰는 요청이 없다.
  - 동결을 깬 쓰기가 진행 중이면 3초 뒤 55P03으로 끝난다.
  - 그런 쓰기와 잠금 순서가 엇갈리면 40P01(교착)로 끝날 수도 있다. 둘 다 자동 롤백이다.
- 함수 검증 중에 트랜잭션이 merchants, merchant_profile_reviews, merchant_services, merchant_categories, merchant_booking_settings(행 타입)를 잠깐 연다. C1·D0의 `6.locks`가 이 테이블들과 public·private·supabase_migrations의 AccessExclusive·대기 잠금을 함께 본다.
- 게시 매장이 0이라 이 테이블의 행을 읽는 요청은 없다. DB 시간은 20 ms 미만이다.

**성공 출력:** `{"target":"production","applied":"20261020123000_store_profile_show_photos.sql"}` 다음에 보고 JSON이 나온다(`postCommit.ledgerRows` 24, `postCommitOk` true, 함수 3행).

| 증상(오류 JSON의 `phase`, `error`, `message`, `detail`, `where`) | 의미 | 조치 |
|---|---|---|
| 시작 전 assert(`c4-passed`, 백업 3시간, sha256) | 아무것도 연결하지 않았다 | 원인을 고친다. 백업이 오래됐으면 D0-1을 다시 한다 |
| `PRE_GUARD: …` | 원장, 열, 함수 본문, 동결 중 하나가 예상과 다르다 | 자동으로 롤백됐다. 멈추고 조사한다. `onboarding freeze was broken`이면 동결 위반이므로 오너에게 보고한다. 괄호 안의 5개 수치(매장, 활성 멤버십, 게시, 매장 프로필, 열린 예약) 중 0이 아닌 것이 깨진 동결이다. 의도된 온보딩이었다면 그 매장을 F4 점검표로 C 셀에서 확인한 뒤, 게이트를 뺀 `apply-guards.sql`을 다시 검토·고정하고 C4부터 다시 한다 |
| 55P03 `lock_timeout` | 3초 안에 잠금(advisory, 원장, 동결 테이블, ALTER)을 못 얻었다 | 자동으로 롤백됐다. `orphans.sql`의 `O.locks`와 C1 `6.locks`로 누가 잡고 있는지 본다. 원장이나 동결 테이블에 쓰는 세션이면 동결 위반이나 다른 마이그레이션이므로 오너에게 보고한다. 원인이 사라진 뒤 한 번만 재시도한다 |
| 40P01 교착 | 동결 테이블에 쓰는 트랜잭션과 잠금 순서가 엇갈렸다 | 자동으로 롤백됐다. 동결 위반이다. 오너에게 보고하고 55P03과 같이 조사한다 |
| 42501 `permission denied for table schema_migrations` | 원장 잠금 권한이 없다(C1 `2.privileges`에서 걸렀어야 한다) | 자동으로 롤백됐다. 멈춘다 |
| `LEDGER_GUARD: …`(`phase=transaction`) | insert 뒤 원장이 24행·head·검토본이 아니다 | 자동으로 롤백됐다. 잠금 아래에서는 생길 수 없는 일이므로 멈추고 조사한다 |
| `phase=skip-verify` | 원장에는 대상 버전이 있는데, 상태가 이 러너가 남기는 상태와 다르다(LEDGER_GUARD 또는 POST_GUARD) | 아무것도 쓰지 않았다. 수동 변경이나 반쯤 된 롤백을 의심하고 멈춘다. 재실행·`migration repair`는 금지 |
| 57014, 또는 `phase=transaction`에서 연결 끊김 | 시간 초과나 중단. 서버 쪽 트랜잭션이 남아 잠금을 쥐고 있을 수 있다(Supavisor 경유, 최대 idle 30초) | 아래 "끊김 뒤 절차"를 따른다. `O.sessions`가 ok가 된 뒤 V1·V4로 미적용(둘 다 n=0)을 확인하고 재시도할지 정한다 |
| `POST_GUARD: …`, `function attributes changed` | 결과가 검토본과 다르다 | 자동으로 롤백됐다. 멈춘다 |
| `phase=commit`에서 연결 끊김 | 결과를 알 수 없다 | "끊김 뒤 절차" 뒤에 `verify-v1-v4.sql`을 실행한다. `V1.column` n과 `V4.ledger` n이 둘 다 1이면 커밋됐으므로 E로 간다. 둘 다 0이면 롤백됐으므로 재실행할 수 있다. 하나만 1이면 멈추고 수동 적용 흔적을 조사한다(SQL 재실행과 `migration repair`는 금지) |
| 종료 코드 3(커밋 뒤 점검 실패) | 적용은 끝났다 | 재실행하지 않는다(재실행해도 검증 뒤 skip된다). E로 상태를 확인하고 원인을 조사한다 |

**끊김 뒤 절차**
1. 아래 블록을 1분 간격으로 실행한다. `O.sessions`가 ok(0행)가 될 때까지, 최대 5분 기다린다.
2. 5분이 지나도 남아 있으면 오너 승인 후 Supabase SQL Editor에서 `select pg_terminate_backend(<O.sessions의 pid>);`를 실행한다(**⚠ 운영 쓰기**: 세션 종료). 그 세션은 같은 역할이라 종료할 수 있다.
3. 그다음에만 V1·V4를 읽고 재시도할지 정한다.

```sh
# [D1-끊김] 한 번의 호출 · 우리 세션이 남았는지, 누가 잠금을 쥐었는지(읽기 전용)
source /Users/hanmyeong-gwan/myseouldrop-ops/show-photos/env.sh
TS=$(date +%H%M%S)
node "$RUN/ro-sql.cjs" --production "$RUN/orphans.sql" "$RUN/orphans-$TS.json" || true
node "$RUN/check-results.cjs" ok "$RUN/orphans-$TS.json" --target production || print -r -- "아직 남아 있다: 1분 뒤 다시"
```

**D2 PostgREST 재로드**
- 재로드 요청은 D1 트랜잭션 안에서 보내므로 커밋과 함께 전달된다. Supabase DDL 이벤트 트리거가 있으면 그것도 재로드를 건다.
- 공개 함수의 시그니처가 그대로라 재로드가 꼭 필요하지는 않다. E2의 REST 점검이 통과하면 확인된 것으로 본다.
- REST가 PGRST202 같은 스키마 캐시 오류를 낼 때만, Supabase SQL Editor에서 `notify pgrst, 'reload schema';`를 실행한다. **⚠ 운영 쓰기**(데이터 변경 없음).

### E. 적용 후 검증

**E1 SQL** (새 연결, 읽기 전용, 부록 B-3·B-4)

```sh
# [E1] 한 번의 호출 · timeout 600000
source /Users/hanmyeong-gwan/myseouldrop-ops/show-photos/env.sh
TS=$(date +%H%M)
node "$RUN/ro-sql.cjs" --production "$RUN/verify-v1-v4.sql" "$RUN/verify-production-$TS.json"
node "$RUN/check-results.cjs" ok "$RUN/verify-production-$TS.json" --target production
node "$RUN/check-results.cjs" same "$RUN/golden-preflight.json" "$RUN/verify-production-$TS.json" 4.attrs=V3.attrs
node "$RUN/ro-sql.cjs" --production "$RUN/verify-v5.sql" "$RUN/v5-production-$TS.json" --set phase=post
node "$RUN/check-results.cjs" ok "$RUN/v5-production-$TS.json" --target production
node "$RUN/ro-sql.cjs" --production "$RUN/verify-v6.sql" "$RUN/v6-production-$TS.json" || true
node "$RUN/check-results.cjs" ok "$RUN/v6-production-$TS.json" --target production --expect-error V6.partner-profile=P0001:AUTH_REQUIRED
```

| 검사 | 기대(`ok`가 판정) |
|---|---|
| V1 열 | n=1, boolean, NOT NULL, default `true`. information_schema도 `NO`·`true`·`boolean`. attnum은 참고값 |
| V2 본문 | md5가 §1.2의 "적용 후" 3개와 같고, 표식 문자열이 모두 맞다 |
| V3 속성·권한 | `V3.attrs`가 C1 골든 `4.attrs`와 같다(러너도 트랜잭션 안에서 단언함). 실행 권한(anon, authenticated): private.booking_quote f f, private.partner_store_profile f t, private.public_store_profile t t, private.store_profile_json f f, public.partner_store_profile f t, public.public_store_profile t t |
| V4 원장 | `20261020123000 / store_profile_show_photos / 1 / 파일 sha256 일치`, 그리고 24행, head `20261020123000`, 보류 0 |
| V5 스모크 | NULL 입력 응답이 11키이고 `showPhotos: true`, 견적이 32자 hex, anon이 `{"status": "unpublished", "placeId": "ct-more-on-hair-seongsu-branch"}`를 받는다 |
| V6 권한 경로 | `P0001 AUTH_REQUIRED`. C1 기준선과 다른 42501이면 메시지로 읽는다(`set role` = 검증 경로, `for function` = 권한 회귀, `table users` = 기존 결함) |

**E2 REST와 앱** (운영 읽기). 대상 URL을 확인한 **뒤에만** 키를 읽는다. 키는 셸 변수에만 두고, curl에는 인자가 아니라 파일 서술자로 넘긴다.

```sh
# [E2] 한 번의 호출
source /Users/hanmyeong-gwan/myseouldrop-ops/show-photos/env.sh
ENVF="$R/.vercel/.env.production.local"
SB=$(sed -n 's/^NEXT_PUBLIC_SUPABASE_URL=//p' "$ENVF" | tr -d '"')
[[ $SB == https://njsocpyuesntblifpips.supabase.co ]] || stop "대상 프로젝트가 아니다(키를 읽기 전에 멈춘다)"
K=$(sed -n 's/^NEXT_PUBLIC_SUPABASE_ANON_KEY=//p' "$ENVF" | tr -d '"'); [[ -n $K ]] || stop "anon 키가 없다"
hdr() { printf 'apikey: %s\nContent-Type: application/json\n' "$K"; }
rest() { curl -sS -o "$RUN/e2-body.json" -w '%{http_code}' -H @<(hdr) "$@"; }
c=$(rest -X POST "$SB/rest/v1/rpc/public_store_profile" -d "{\"p_place_id\":\"$P\"}")
[[ $c == 200 ]] && jq -e --arg p "$P" '. == {status: "unpublished", placeId: $p}' "$RUN/e2-body.json" >/dev/null || stop "public_store_profile: $c"
c=$(rest -X POST "$SB/rest/v1/rpc/partner_store_profile" -d '{}')
[[ $c == 401 ]] && jq -e '.code == "42501"' "$RUN/e2-body.json" >/dev/null || stop "partner_store_profile(anon): $c"
c=$(rest -X POST "$SB/rest/v1/rpc/booking_catalog" -d "{\"p_place_id\":\"$P\"}")
[[ $c == 200 ]] && jq -e '.status == "unavailable"' "$RUN/e2-body.json" >/dev/null || stop "booking_catalog: $c"
c=$(rest "$SB/rest/v1/merchant_store_profiles?select=merchant_id,show_photos&limit=1")
[[ $c == 401 ]] && jq -e '.code == "42501"' "$RUN/e2-body.json" >/dev/null || stop "merchant_store_profiles 직접 읽기: $c"
unset K
{ for p in "/api/places/$P/profile" "/api/places/$P/location" "/api/places/$P/booking" /api/partner/operations/profile; do print -r -- "$p $(curl -sS -o /dev/null -w '%{http_code}' "$ORIGIN$p")"; done
  print -r -- "/place/$P $(curl -sS -L -o /dev/null -w '%{http_code}' "$ORIGIN/place/$P")"; } | tee "$RUN/e2-app.txt"
diff <(print -l "/api/places/$P/profile 200" "/api/places/$P/location 200" "/api/places/$P/booking 200" "/api/partner/operations/profile 401" "/place/$P 200") "$RUN/e2-app.txt" || stop "앱 HTTP 기대값과 다르다"
```

**E3 브라우저와 스모크**
- B2-5의 헤드리스(`headless-e3.json`)를 반복한다.
- B2-6~B2-8을 E3 파일 이름(`e3-dispatch-at`, `e3-runs-*.json`, `e3-run-*`)으로 다시 실행한다. B2-7과 같은 조건으로 실행을 정확히 하나 고른다.

- **성공:** 모든 값이 기대값이다. 헤드리스가 실패 0이다. 스모크 실패가 알려진 3건 안에 있다.
- **중단:** §5의 표에 따라 판단한다.

**E4 실행 기록과 공지(E 직후)**
- `release-log.txt`에 요약을 남긴다: M, MDPL, 적용 증거 파일 이름, D1 시각, E1–E3 결과, `rollback-target`(= PREV_DPL).
- 이후에는 덧붙이기만 한다. 재부팅이나 세션 종료로 증거를 잃지 않도록, 보고서를 F 뒤로 미루지 않는다.
- 공지(§6): "D1 완료"와 "main push 동결 해제(E 종료)". 온보딩 동결은 유지한다.
- E 뒤 main push 규칙: 새 운영 배포가 생기면 바로 F 블록을 실행한다. F 블록은 다음 순서로 동작한다.
  1. 새 배포가 M을 포함하는지, 두 도메인이 그 배포를 가리키는지 확인한다.
  2. 그 배포의 바로 앞 운영 배포를 Vercel API로 찾는다. 그 배포도 M을 포함하는지 확인한다.
  3. 점검보다 **먼저** `$RUN/rollback-target`에 그 바로 앞 배포를 기록한다.
  4. 새 배포의 release로 monitor와 헤드리스 점검을 한다.
  - 점검이 실패하면 §5.1-1이 그 바로 앞 배포로 되돌린다.

### F. 모니터링과 동결 해제

**F1 체크포인트** — 시각과 사람 담당을 정한다. 실행자는 담당자가 세션을 열어 지시할 때 아래 블록을 실행한다.

| 체크포인트 | 시각(예정, KST) | 담당 | 추가로 할 일 |
|---|---|---|---|
| F-1 | E + 30분 (10/22 ~16:45) | 실행자, 오너 확인 | — |
| F-2 | E + 2시간 (~18:15) | 오너 | Supabase API 로그 확인(F3) |
| F-3 | E + 6시간 (~22:15) | 오너 | 6시간 주기 스모크 결과를 B2-8과 같은 방식으로 비교 |
| F-4 | 다음 날 09:00 (10/23) | 오너 | Supabase·Vercel 사용량(F3) |
| F-5 | E + 24시간 (10/23 ~16:15) | 오너, 실행자 | F 종료 판정, F4 시작 여부 |

```sh
# [F] 체크포인트마다 한 번의 호출 · timeout 600000
source /Users/hanmyeong-gwan/myseouldrop-ops/show-photos/env.sh
: ${M:?} ${MDPL:?}
[[ ! -e $RUN/m-reverted ]] || stop "M을 되돌렸다(5.1-2, $(cat "$RUN/m-reverted")): F 체크포인트와 결정 7의 사전 승인은 끝났다. 다음 단계는 오너가 정한다"
TS=$(date +%m%d-%H%M)
prod_state | tee "$RUN/f-prod-$TS.json"
jq -e '.readyState == "READY"' "$RUN/f-prod-$TS.json" >/dev/null || stop "운영 대상 배포가 READY가 아니다"
CUR=$(jq -r .id "$RUN/f-prod-$TS.json"); CURSHA=$(jq -r .sha "$RUN/f-prod-$TS.json")
LAST=$(cat "$RUN/last-checked-dpl" 2>/dev/null || print -r -- "$MDPL")
if [[ $CUR != "$LAST" ]]; then
  # E 이후 새 운영 배포. 점검보다 먼저 롤백 대상을 그 배포의 바로 앞 운영 배포로 바꾼다(Hobby의 Instant Rollback은 바로 앞으로만 간다).
  # 점검이 실패하면 §5.1-1이 이 값을 쓴다.
  git -C "$W" fetch -q github
  git -C "$W" merge-base --is-ancestor "$M" "$CURSHA" || stop "새 운영 배포가 M을 포함하지 않는다(롤백·다른 브랜치?) → 원인 확인"
  # M을 되돌린 커밋도 M을 조상으로 가진다. 그래서 DB 호환을 정하는 파일이 M과 같은지 따로 본다(다르면 결정 7의 사전 승인 밖)
  if ! git -C "$W" diff --quiet "$M" "$CURSHA" -- lib/partner/profile-contracts.ts lib/place-profile.ts lib/place-profile-server.ts supabase/migrations; then
    grep -qx "$CURSHA" "$RUN/f-contract-approved" 2>/dev/null \
     || stop "새 배포가 M의 프로필 계약·마이그레이션 파일을 바꿨다(되돌림 포함): 결정 7의 사전 승인 밖이다. 앱 롤백도 하지 않는다. 오너가 판단하고, 계속하기로 하면 그 SHA를 $RUN/f-contract-approved 에 한 줄로 기록한 뒤 다시 실행한다"
  fi
  for u in "$ORIGIN" "$ALT"; do
    vadm inspect "$u" --json | jq -e --arg d "$CUR" '.id == $d and .readyState == "READY"' >/dev/null || stop "$u 가 새 운영 배포 $CUR 를 가리키지 않는다"
  done
  vadm api "/v6/deployments?projectId=$VPRJ&teamId=$VTEAM&target=production&state=READY&limit=20" \
   | jq -c --arg d "$CUR" '[.deployments[] | {uid, sha: .meta.githubCommitSha, created}] | sort_by(-.created)
       | (map(.uid) | index($d)) as $i | if $i == null or $i + 1 >= length then error("바로 앞 운영 배포를 찾지 못했다") else .[$i + 1] end' > "$RUN/f-prev-$TS.json"
  git -C "$W" merge-base --is-ancestor "$M" "$(jq -r .sha "$RUN/f-prev-$TS.json")" \
   || stop "바로 앞 운영 배포가 M을 포함하지 않는다: Instant Rollback을 쓰면 B 셀이 된다. 5.1-2(git revert) 범위를 오너와 정한다"
  jq -r .uid "$RUN/f-prev-$TS.json" > "$RUN/rollback-target"
  print -r -- "$CUR" > "$RUN/last-checked-dpl"
  print -r -- "$(date '+%F %T %Z') F 새 운영 배포 $CUR (${CURSHA[1,12]}): rollback-target = $(cat "$RUN/rollback-target")" >> "$OPS/release-log.txt"
fi
node "$RUN/ro-sql.cjs" --production "$RUN/monitor.sql" "$RUN/monitor-$TS.json" --set "release=$REL" --set "since=$(cat "$RUN/b1-pushed-at")"
node "$RUN/check-results.cjs" ok "$RUN/monitor-$TS.json" --target production
if [[ ${CURSHA[1,12]} != "$REL" ]]; then
  node "$RUN/ro-sql.cjs" --production "$RUN/monitor.sql" "$RUN/monitor-$TS-current.json" --set "release=${CURSHA[1,12]}" --set "since=$(cat "$RUN/b1-pushed-at")"
  node "$RUN/check-results.cjs" ok "$RUN/monitor-$TS-current.json" --target production
fi
{ for p in "/api/places/$P/profile" "/api/places/$P/location" "/api/places/$P/booking" /api/partner/operations/profile; do print -r -- "$p $(curl -sS -o /dev/null -w '%{http_code}' "$ORIGIN$p")"; done; } | tee "$RUN/f-http-$TS.txt"
diff <(print -l "/api/places/$P/profile 200" "/api/places/$P/location 200" "/api/places/$P/booking 200" "/api/partner/operations/profile 401") "$RUN/f-http-$TS.txt" || stop "HTTP 기대값과 다르다"
# M 전용 화면 표식. E 뒤 새 배포가 그 화면을 일부러 바꿨을 수 있으므로, 새 배포에서 이것만 실패하면 F2 트리거로 보지 않는다
MARKERS='^(place:(no-photos-section|no-photos-anchor-tab|empty-photo-state)|photos:(collage-three|more-badge-plus-2|no-photos-section|lightbox-opens|lightbox-closes)|favorites:guest-copy|product:hero-contain)$'
if ! node "$RUN/headless-check.cjs" "$ORIGIN" "$RUN/headless-$TS.json"; then
  [[ -s $RUN/headless-$TS.json ]] || stop "헤드리스 점검기가 결과를 남기지 못했다: 점검기 문제인지 먼저 확인한다(트리거 판단 전)"
  OTHER=$(jq -r --arg m "$MARKERS" '[.results[] | select(.pass | not) | .name | select(test($m) | not)] | unique | join(",")' "$RUN/headless-$TS.json")
  if [[ -z $OTHER && $CUR != "$MDPL" ]]; then stop "새 배포에서 M 전용 화면 표식만 실패했다: F2 트리거가 아니다. 그 배포가 해당 화면을 바꿨는지 확인하고 오너에게 보고한다"; fi
  stop "헤드리스 실패 → F2 트리거(§5.1): ${OTHER:-M 전용 표식(운영 = MDPL)}"
fi
print -r -- "$(date '+%F %T %Z') F 체크포인트 $TS 통과" >> "$OPS/release-log.txt"
```

**F2 판정 기준(수치 트리거)** — 하나라도 충족하면 §5.1로 간다(결정 7의 사전 승인 범위).
- `M.release-trigger`가 false다. 기준은 `release = left(M,12)` 오류가 B1 이후 3건 이상이거나 2개 이상 페이지에서 나온 경우다. 옛 release의 chunk-load 오류는 제외한다.
- 헤드리스 점검이 실패한다(M 전용 표식 포함). 예외: 운영이 MDPL이 아닌 새 배포이고 실패가 M 전용 화면 표식(F 블록의 `MARKERS`)에만 있으면 트리거가 아니다. 그 배포가 해당 화면을 바꿨는지 확인하고 오너에게 보고한다.
- 사전 승인 밖(오너가 정한다): 5.1-2로 M을 되돌린 뒤, 그리고 새 배포가 M의 프로필 계약·마이그레이션 파일을 바꾼 경우. F 블록이 두 경우 모두 점검 전에 멈춘다. 이때 앱 롤백은 되돌림을 다시 되돌릴 수 있기 때문이다.
- HTTP 프로브가 5xx이거나 기대와 다른 코드를 낸다.
- Uptime 실행이 실패한다.
- 알려진 3건(`launch.spec.ts` 68·77·85) 밖의 스모크 실패가 나온다.

**F3 수동 채널(보조. 판정은 F1의 능동 점검이 한다)**
- **Supabase Dashboard → Logs → API:**
  - 경로 `/rest/v1/rpc/(public_store_profile|partner_store_profile|booking_catalog)`의 상태 ≥ 400을 본다.
  - 비회원의 `partner_store_profile` 401은 예상된 값이므로 제외한다.
  - RAISE(P0001)는 PostgREST에서 400이 되므로, 5xx만 보면 놓친다.
- **Supabase Reports → API 요청량:** B1 전 수준과 비교한다. 지도 핀 조회로 늘어나는 것은 예상이지만 급증은 본다.
- **Vercel Observability(또는 Usage):** `/api/places/[id]/profile`과 `/api/places/[id]/media`의 호출 수를 본다(새 트래픽, 핀 선택 유지 중 60초 재조회).
- **Vercel Logs:** Hobby는 런타임 로그를 약 1시간만 보관한다. 따라서 "24시간 뒤에 몰아서 확인"은 할 수 없고, 체크포인트마다 직전 1시간만 본다.
- **Uptime(30분)과 Production public smoke(6시간):**
  - Uptime은 `/`, `/map`, `/api/account/export`, Supabase auth·client_errors만 본다.
  - 스모크는 이번 변경 표면을 거의 보지 않는다.
  - 둘 다 보조로만 쓴다.
- **한계:** 매장이 0곳이라 E·F의 어떤 요청도 바뀐 함수 본문에 닿지 않는다. 미게시 장소에서는 `public_store_profile`이 `merchant_store_profiles`를 읽기 전에 반환한다(200212:94). 운영에서 바뀐 함수가 실제로 실행되는 곳은 POST_GUARD와 V5의 NULL 입력 스모크뿐이다. **이 마이그레이션의 진짜 카나리아는 첫 온보딩이다(F4).**

**F4 첫 매장(카나리아) 점검표, 차단 수단, 동결 해제**

이 점검표는 지금 작성해 두고, 첫 온보딩 때 실행한다.

**시작 조건**
- F-5를 통과했다.
- B4에서 나온 다른 배포 문제를 해결했거나, 오너가 위험을 받아들인다고 기록했다.
- 오너가 승인했다.
- 차단 수단이 준비돼 있다(SQL Editor를 열어 둠).
- 첫 매장의 생성·멤버십·게시는 별도 운영 절차(service_role)다.

**점검표**(첫 매장 게시 직후, 오너와 실행자)
1. `/place/<id>`: 공개 프로필(영어 이름, 영어 응대, 연락처, 공지)과 사진 헤더가 보인다. `/api/places/<id>/profile`이 200이고 `status: published`, profile 11키, `showPhotos: true`다.
2. 관리자 "매장 정보"에서 사진 스위치를 OFF로 저장한다 → `/place/<id>` 사진 헤더가 숨겨지고, 지도 시트는 60초 안에 숨겨진다 → ON으로 저장한다 → 다시 보인다.
3. 위치 카드: 예약 요약과 내 예약의 위치 카드가 정상이다(`/api/places/<id>/location` 200, "Location unavailable" 없음).
4. 공지·영어 응대·사진 스위치만 저장하면 진행 중 견적의 `quoteVersion`이 유지되고, 연락처를 바꿀 때만 바뀐다(rpc-2). `booking_catalog`의 quoteVersion을 저장 전후로 비교한다.
5. 오류: `release = left(M,12)` client_errors가 늘지 않는다. 관리자 화면에 503이 없다. Supabase 로그에 RPC non-2xx가 없다(예상된 401 제외).

**차단 수단(⚠ 운영 쓰기, 오너 승인).** Supabase SQL Editor에서:
- `update public.merchant_publications set published = false where merchant_id = '<merchant_id>';`
  - 공개 프로필이 즉시 unpublished로 돌아간다. 앱 배포는 필요 없다. 지도 메모는 60초 안에 갱신된다.
- 관리자 접근까지 막아야 하면 `update public.merchant_memberships set revoked_at = now() where merchant_id = '<merchant_id>' and revoked_at is null;`

**동결 해제**
- 점검표를 모두 통과하면 오너가 온보딩 동결을 해제하고 공지한다(§6).
- 24시간이 지났다는 것만으로는 해제하지 않는다.

**F5 정리**
- 실행 보고서(`reports/operations/`)와 핸드오프 갱신, §1.4의 기록 정정은 동결이 끝난 뒤 Codex와 조율해 별도 커밋으로 한다.
- 오너 확인 후 삭제(E가 끝난 뒤):
  - 이번 리허설 DB(`$OPS/rehearsal-db-name`)와 10-20 리허설 DB `booking_release_rehearsal_1792460532653`: `rpsql psql -h 127.0.0.1 -U postgres -d postgres -c "drop database <이름>"`. 로컬 작업이다.
  - 10-20 덤프 두 개(`/private/tmp/myseouldrop-production-backup-20261020/`, 개인정보 포함).
- 오너 확인 후 삭제(보관 기한이 지나면):
  - 이번 덤프(`$BK`, 개인정보 없음): 보관 기한(제안: 14일)이 지나면 삭제한다.
  - Vercel 관리자 설정 사본(`$OPS/vercel-admin`)과 통합 클론(`$W`): F가 끝나면 삭제한다. 다음 릴리스에 쓰려면 보관한다.
- 오너에게 제안: `chmod 600 $R/.vercel/.env.production.local`. 지금은 0644다.
- 증거 위치: `$RUN/*.json`, `$RUN/*.txt`, `$RUN/*.log`, `$OPS/release-log.txt`, `$OPS/freeze-log.txt`, `$BK/backup-*.json`.

## 5. 롤백

### 5.1 앱 롤백

**언제:** F2의 수치 트리거를 충족할 때, 또는 B2 오너 회원 스모크가 실패할 때. 결정 7로 B1부터 F 종료까지 사전 승인돼 있다. 실행자는 실행 직후 오너에게 보고한다.

**Hobby 제약** (A0에서 요금제가 `hobby`로 확인되면)
- Instant Rollback(CLI·대시보드)은 **바로 앞 운영 배포로만** 갈 수 있다. 그래서 A0부터 E까지 main push를 동결한다. 이 기간에는 바로 앞 배포가 항상 `PREV_DPL`(b26586b)이다.
- E 뒤에 다른 배포가 생기면, Instant Rollback은 그 배포의 바로 앞으로만 간다. F 블록이 그 값을 `$RUN/rollback-target`에 점검 전에 기록한다. 그 배포가 M을 포함하지 않으면 F 블록이 멈춘다. M 자체를 빼려면 5.1-2(git revert)를 쓴다.
- 런타임 로그 보관은 1시간이다(F3).

```sh
# [5.1-1] 한 번의 호출 · ⚠ 운영 쓰기: 직전 운영 배포로 즉시 전환
source /Users/hanmyeong-gwan/myseouldrop-ops/show-photos/env.sh
TARGET=$(cat "$RUN/rollback-target")
vadm rollback "$TARGET" --timeout 5m
vadm rollback status seoul-guide-v2
for u in "$ORIGIN" "$ALT"; do vadm inspect "$u" --json | jq -e --arg d "$TARGET" '.id == $d' >/dev/null || stop "$u 가 $TARGET 로 돌아가지 않았다"; done
print -r -- "$TARGET" > "$RUN/last-checked-dpl"      # F 블록이 롤백된 배포를 '새 배포'로 오인하지 않게 한다
print -r -- "$(date '+%F %T %Z') 앱 롤백 → $TARGET" >> "$OPS/release-log.txt"
```

- 대시보드로 할 수도 있다: Vercel Dashboard → seoul-guide-v2 → Deployments → 해당 배포 → Promote to Production(`docs/runbook.md` 58–69행). 오너가 B–F 동안 관리자 계정으로 로그인해 둔다.
- 롤백하면 Vercel이 운영 도메인 자동 할당을 끈다. 그 뒤의 main push는 운영에 올라가지 않는다.
  - 복구할 때는 고친 배포에 대해 `vadm promote <배포 ID>`를 실행한다(**⚠ 운영 쓰기**).
  - 운영 배포가 아닌(Preview) ID에는 쓰지 않는다. 그런 경우 CLI가 새 운영 빌드를 만든다.

```sh
# [5.1-2] 한 번의 호출 · ⚠ 운영 쓰기: M을 main에서 되돌리는 커밋(빌드 5–10분 뒤 배포)
source /Users/hanmyeong-gwan/myseouldrop-ops/show-photos/env.sh
: ${M:?} ${B:?}
git -C "$W" fetch github
test "$(git -C "$W" rev-parse github/main)" = "$M" || stop "main이 M이 아니다(E 이후 push가 있었다): 되돌릴 범위를 오너와 정한다"
git -C "$W" checkout -q -B revert-m github/main
git -C "$W" revert --no-commit -m 1 "$M"
git -C "$W" commit -q -m "Revert merge of booking admin release (${M[1,12]})" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
test "$(git -C "$W" rev-parse 'HEAD^{tree}')" = "$(git -C "$W" rev-parse "${B}^{tree}")" || stop "되돌린 트리가 b26586b와 다르다"
git -C "$W" push github "HEAD:refs/heads/main"
git -C "$W" rev-parse HEAD > "$RUN/m-reverted"      # F 블록은 이 파일이 있으면 멈춘다(되돌림을 다시 되돌리지 않게)
print -r -- "$(date '+%F %T %Z') 5.1-2 M 되돌림 push: $(cat "$RUN/m-reverted")" >> "$OPS/release-log.txt"
```

- 되돌린 뒤에는 F 체크포인트와 결정 7의 사전 승인이 끝난다. 다음 단계(다시 올리기, DB 상태, 동결)는 오너가 정한다.
- 5.1-1로 롤백한 뒤라 자동 할당이 꺼져 있으면, revert 배포가 READY가 된 뒤 `vadm promote <revert 배포 ID>`(**⚠ 운영 쓰기**)로 올린다.
- 다시 올릴 때는 그 revert를 revert한다.
- **B2 빌드 실패(ERROR·BLOCKED)일 때:**
  - 운영은 이전 배포 그대로지만, main은 배포되지 않은 M에 남는다. 그 뒤의 모든 push가 M 위에서 빌드된다.
  - 30분 안에 원인을 찾아 고치지 못하면, 오너 승인을 받아 5.1-2로 main을 배포 가능한 상태(b26586b 트리)로 되돌린다.
  - 동결은 유지한다. C 이후로 진행하지 않는다.
- **제약:** D 이후에 `b26586b`로 되돌리면 B 셀이다. 온보딩 전(멤버십·게시 0)에만 안전하다. 온보딩 뒤에는 M 이후의 배포로만 되돌린다.
- **브라우저 저장소:** 호환된다. 같은 키를 쓰고, `b26586b`는 `essenly.favorites.owner`를 무시한다.

### 5.2 DB — 기본은 fix-forward

런북의 원칙은 "DB 마이그레이션은 롤백하지 않는다"이다(`docs/runbook.md:58-61`). 실패한 적용은 스스로 롤백된다.

| 적용 뒤 문제 | 조치 |
|---|---|
| D1 트랜잭션 실패 | 자동으로 롤백됐다. DB는 그대로다. D1 표대로 원인을 확인하고 재시도할지 정한다 |
| 앱을 `b26586b`로 되돌려야 함(온보딩 전) | DB는 그대로 둔다(B 셀, 영향 없음) |
| 온보딩 뒤 옛 앱이 깨짐 | M 이후 배포로 되돌린다. 또는 `store_profile_json`만 200212 본문으로 되돌리는 새 마이그레이션을 만든다(열은 유지되고 스위치는 숨겨진다) |
| rpc-2 | 결정 3은 A3 전(적용 전)에 받는다. 거부되면 이 계획을 멈추고 마이그레이션 자체를 고친다(§0). 적용 뒤에 결정이 번복될 때만 `booking_quote`를 200212 본문(부록 B-6의 해당 문장)으로 되돌리는 새 마이그레이션을 만든다 |
| 함수 논리 결함 | 새 `CREATE OR REPLACE` 마이그레이션 |

fix-forward 마이그레이션도 같은 길로 간다:
1. 저장소에 검토 커밋으로 넣는다.
2. 1개짜리 매니페스트를 만든다.
3. C1 골든을 새로 받는다.
4. 복원본에서 리허설한다(C4와 같은 단계).
5. 러너로 적용한다(**⚠ 운영 쓰기**).
6. 원장에 기록된다.

### 5.3 비상 전체 롤백 (오너 승인 필수)

**조건(모두 충족해야 함)**
- 오너가 승인했다.
- 시간 안에 fix-forward를 할 수 없다.
- `show_photos=false`인 매장이 없다. 있으면 SQL이 거부한다. 파트너가 고른 값을 잃기 때문이다.
- `20261020123000`이 원장의 head다(24행, 그 뒤 적용분 없음, 보류 마이그레이션 없음). 아니면 SQL이 거부한다.
- C1에서 원장 DELETE 권한이 확인됐다.

**효과와 안전장치(부록 B-6)**
- 모든 판단은 한 트랜잭션 안에서, 커밋 전에 한다.
- `merchant_store_profiles`를 ACCESS EXCLUSIVE로 먼저 잠근다. 그 뒤에 사진 OFF 검사를 하므로, 검사와 DROP 사이에 파트너 저장이 끼어들 수 없다.
- 함수 3개를 200212 본문으로 되돌린다. 롤백 전 속성(owner, security definer, volatility, config, ACL)이 C1 골든 값과 같아야 하고, 롤백 뒤 모든 속성(strict, parallel, cost, language, 인자, 반환형 포함)이 롤백 전과 같아야 한다.
- 열을 삭제하고 원장 행을 지운다. 그래서 같은 러너로 나중에 다시 적용할 수 있다.
- 커밋 전에 원장이 23행, head `20261019200901`인지 검사한다.
- PostgREST 재로드는 커밋과 함께 전달된다.
- 견적이 한 번 더 바뀐다. main과 M 모두 그대로 동작한다.

```sh
# [5.3-1] 한 번의 호출 · ⚠ 운영 쓰기 · 오너 승인 · 포그라운드 timeout 600000
source /Users/hanmyeong-gwan/myseouldrop-ops/show-photos/env.sh
node "$RUN/rollback-show-photos.cjs" --production 2>&1 | tee "$RUN/rollback-production.log"
```

```sh
# [5.3-2] 한 번의 호출 · timeout 600000 · 롤백 뒤 확인(읽기 전용): 골든과 같은지, 함수 정의 전문까지
source /Users/hanmyeong-gwan/myseouldrop-ops/show-photos/env.sh
TS=$(date +%H%M)
node "$RUN/ro-sql.cjs" --production "$RUN/preflight.sql" "$RUN/preflight-after-rollback-$TS.json"
node "$RUN/check-results.cjs" same "$RUN/golden-preflight.json" "$RUN/preflight-after-rollback-$TS.json" 2.ledger 2.statements 3.columns 3.owner 4.bodies 4.attrs 4.defs 4.overloads
node "$RUN/ro-sql.cjs" --production "$RUN/fn-defs.sql" "$RUN/fn-defs-after-rollback-$TS.json"
node "$RUN/check-results.cjs" same "$RUN/golden-fn-defs.json" "$RUN/fn-defs-after-rollback-$TS.json" defs
```

- 롤백 중에 연결이 끊기면(`phase=transaction`) 결과를 알 수 없다. D1의 "끊김 뒤 절차"로 남은 세션이 사라진 것을 확인한다. 그다음 V1·V4로 판단한다. 열이 없고 원장 n=0이면 롤백이 끝난 것이다.
- C4에서 같은 도구와 같은 SQL로 리허설한다. 음성 시험(원장 head가 아닐 때 거부)도 포함한다.

## 6. 일정, 소요 시간, 담당, 체크리스트

**제안 일정(KST), 10/22(목)**
- 09:30: 결정 1·5·7, 시작 공지, A0. 오너가 자리에 있어야 한다. Vercel 재로그인이 필요하면 이때 한다.
- 10:00–11:45: A1·A2.
- 11:45–13:00: C1·C2·C4.
- 13:00: 결정 3(오너). 13:00–13:30: A3.
- 13:30: 결정 2(오너), B0(오너 회원 기준선), B1 ⚠(오너 "진행").
- 13:45–14:30: B2(오너 회원 스모크 포함).
- 14:30–15:15: B3·B4.
- 15:15: D0. 15:30: D1 ⚠(오너 "진행"). **D1은 16:00 전에 시작한다.**
- 15:45–16:15: E, E4(기록, 공지, main push 동결 해제).
- F 체크포인트: §4 F1 표. F 종료 = E 통과 + 24시간.

**D1을 목요일 16:00까지 시작하지 못하면**
- B까지 마친 상태(C 셀)에서 멈춘다. 온보딩 동결과 main push 동결은 유지한다.
- D0–E는 10/23(금) 09:30–11:00에 한다(D1은 11:00 전). 이 경우 F-5가 토요일 11:00 무렵이 되므로, 오너가 토요일 체크포인트를 맡을 때만 금요일에 한다.
- 그렇지 않으면 다음 주 월~목의 같은 시간대로 미룬다. 이때는 B3를 통과한 시점에 main push 동결을 풀고, 이후 배포마다 F 블록과 `rollback-target` 재기록 규칙을 적용한다. 그동안 M 자체의 롤백은 5.1-2(git revert)로 한다.

| 순서 | 단계 | 소요(예상) | 담당 | 오너가 있어야 함 | 시작 조건 |
|---|---|---|---|---|---|
| 0 | 결정 1·5·7, 시작 공지 | 15분 | 오너 | 예 | 이 문서 검토 |
| 1 | A0 | 20분 | 실행자 | Vercel 재로그인 때만 | 결정 1·5 |
| 2 | A1·A2 | 90–120분 | 실행자 | 아니오 | A0 |
| 3 | C1·C2·C4 | 60–75분 | 실행자 | 아니오 | A2 |
| 4 | 결정 3, A3 | 30–40분 | 오너, 실행자 | 예(결정 3) | C4 통과 |
| 5 | B0·B1 ⚠·B2 | 40–50분(빌드 5–10분 포함) | 실행자, 오너 "진행"·회원 스모크 | 예 | 결정 2, A3 통과 |
| 6 | B3·B4 | 35–45분 | 실행자 | B4 판단 때 | B2 통과 |
| 7 | D0·D1 ⚠ | 25분(DB 잠금 약 1.2–1.8초, 최악 대기 약 5초) | 실행자, 오너 "진행" | 예 | 결정 3·4, B3·B4·C 통과 |
| 8 | E, E4 | 30분 | 실행자, 공지는 오너 | 공지 때 | D1 성공 |
| 9 | F 체크포인트 5회 | E + 24시간 | F1 표의 담당 | F-2~F-5 | E 통과 |
| 10 | F4 첫 매장, 동결 해제, F5 정리 | 별도 | 오너, 실행자 | 예 | F-5 통과 |

**공지 채널과 문안**
- **채널:**
  1. 오너가 Codex 세션에 직접 전달한다(주 채널).
  2. A3 이후에는 초안 PR 코멘트에도 남긴다.
  3. 실행자가 `$OPS/freeze-log.txt`에 시각과 문안을 남긴다.
  - 공유 작업 트리의 핸드오프는 쓰지 않는다.
- **시작(A0):** "[MYSEOULDROP 릴리스 동결 시작 10/22 hh:mm] show_photos 적용 작업 중입니다. ① main push 금지(E 종료 예정 16:15 무렵까지) ② 매장·멤버십·게시 생성 금지(첫 매장 점검표 통과까지) ③ 로컬 Supabase 스택(54382, partner-app-20261018-Io8Zlv) 정지·리셋 금지 ④ 공유 작업 트리의 supabase/·scripts/·node_modules 변경 보류. 문의: 오너."
- **D1 완료:** "[hh:mm] 20261020123000 운영 적용 완료, E 검증 중. 동결 유지."
- **롤백:** "[hh:mm] 앱/DB 롤백 실행(사유 한 줄). main push 금지, 온보딩 동결 유지."
- **E 종료:** "[hh:mm] E 통과. main push 재개 가능(배포 뒤 헤드리스 점검 필수, 실행자에게 알림). 온보딩 동결은 유지. 54382 스택 규칙은 F 종료까지 유지."
- **동결 해제:** "[hh:mm] 첫 매장 점검표 통과. 온보딩 동결 해제."

**체크리스트**

- 결정
  - [ ] 결정 1 순서 변경(오너)
  - [ ] 결정 5 동결 범위와 공지(오너)
  - [ ] 결정 7 앱 롤백 사전 승인(오너)
  - [ ] 결정 3 rpc-2(오너, C4 뒤 A3 전)
  - [ ] 결정 2 배포(오너, B1 전)
  - [ ] 결정 4 적용 시각(오너, D0 전)
- 공지
  - [ ] 시작
  - [ ] D1 완료
  - [ ] (롤백 시) 롤백
  - [ ] E 종료(push 동결 해제)
  - [ ] 온보딩 동결 해제
- A
  - [ ] A0: 실행 파일 20개와 CA의 sha256, SSH 신원, gh 계정·권한, 보호 규칙·ruleset 없음, Vercel 관리자 whoami, 도메인 2개 = PREV_DPL, rollback status, 요금제 기록
  - [ ] A1: 클론, 기능 브랜치가 F를 포함하고 F 뒤는 reports/·docs/만, 충돌 37, 트리 `64bd9652`, map-sheet 1회, b26586b 겹침 7개, 작성자, 부모 B·F
  - [ ] A2: QA 스택 환경, typecheck·lint 0, vitest 216/2,412, data audit, build, status 비어 있음, e2e(알려진 3건 안), 로컬 헤드리스 실패 0
  - [ ] A3: 초안 PR, PR CI green, `Vercel – seoul-guide-v2` success, 두 번째 프로젝트 원인 기록
- C
  - [ ] C1: preflight `ok`, 골든 저장, V5·V6 기준선
  - [ ] C2: 백업 목차 ok(개인정보 행 없음), 함수 정의 골든
  - [ ] C4: 복원 오류 허용 목록 통과, 리허설 = 골든(비교 항목), 셀 점검 pre, 적용, 검증된 skip, V1–V6, 셀 점검 post, 161 checks와 고객 예약(보조), 테스트 뒤 V 동일, 음성 시험, 롤백 뒤 골든·함수 정의 동일, 재적용 `ok`, `c4-passed.json`
- B
  - [ ] B0: 롤백 대상 확인, monitor 기준선, 오너 회원 기준선
  - [ ] B1 ⚠ fast-forward push
  - [ ] B2: M 배포 READY, MDPL 기록, `assert_prod_is_m`, GitHub Production 배포 success, main CI, HTTP 11건, 헤드리스 실패 0, 스모크(알려진 3건 안)와 Uptime(실행 ID는 M·실행자·T0로 정확히 1개), 오너 회원 스모크
  - [ ] B3: 헤드리스 10회 순회, monitor `ok`(release = `left(M,12)`)
  - [ ] B4: 두 번째 프로젝트·Preview 보호 기록과 오너 판단
- D
  - [ ] D0: 기록용 백업, preflight `ok`와 골든 동일, V5·V6 기준선, 남은 세션 0, 운영 = M
  - [ ] D1 ⚠: 적용 출력, `postCommitOk`, 증거 파일
- E
  - [ ] E1: V1–V6 `ok`, `4.attrs=V3.attrs`
  - [ ] E2: REST 4건, 앱 5건
  - [ ] E3: 헤드리스, 스모크
  - [ ] E4: 기록, 공지
- F
  - [ ] F-1~F-5 체크포인트(담당·시각대로). 새 운영 배포가 있으면 rollback-target을 먼저 다시 기록
  - [ ] F3 보조 채널(Supabase API 로그, 요청량, Vercel 호출 수)
  - [ ] F4: 첫 매장 점검표 통과, 동결 해제(오너)
  - [ ] F5: 리허설 DB·10-20 덤프 삭제(오너), 보고서·핸드오프·기록 정정, 권한 제안

## 7. 위험과 완화

| 위험 | 영향 | 완화 |
|---|---|---|
| main(`b26586b`)이 11키 응답을 거부 | 온보딩 뒤 파트너 화면 503, 공개 프로필 무시, 꺼둔 사진 노출 | 앱 먼저(결정 1). PRE_GUARD 동결 게이트. 온보딩 동결(결정 5). C4 셀 점검으로 실행 증거 |
| 잘못된 자동 병합(map-sheet effect 중복) | 시트 높이 이중 계산. 테스트로 안 잡힘 | 트리 = `T` 검사, grep 1회, 기능 쪽 파일 채택 |
| 다른 세션이 main에 push | push 거부, 잘못된 기준, 롤백 대상 변경 | A0→E main push 동결과 공지. B1의 `&&` 가드. A4 기본은 창 닫기. E 뒤 `rollback-target` 재기록 |
| 기본 CLI 계정 사용(다른 Vercel 계정, 회사 gh·SSH 키) | B2·D0 판단과 롤백이 실패하거나 다른 계정으로 push | `vadm`(관리자 설정 사본 + `--scope`), `ghs`, `GIT_SSH_COMMAND`(`-F /dev/null`). A0 신원 게이트 |
| 관리자 Vercel 토큰 만료(10-20 20:46 UTC 만료, refresh 토큰만 남음) | CLI 롤백·확인 불가 | A0에서 갱신 확인. 실패하면 B1 전 오너 재로그인. 오너가 대시보드에 로그인해 Promote 경로 대비 |
| 운영이 M을 가리킨다고 오판 | 앱 먼저 원칙이 깨진 채 D1 | `assert_prod_is_m`(GitHub main, 프로젝트 운영 대상, 두 도메인), GitHub Deployments API, M 전용 표식 헤드리스 하드 단언 |
| Hobby 요금제 제약 | 다른 배포 뒤 Instant Rollback 불가, 로그 1시간 | A0 요금제 확인, push 동결, git revert 경로, 체크포인트마다 로그 확인 |
| main CI가 배포를 막지 않음 | 깨진 빌드가 운영으로 감 | 초안 PR에서 CI·Preview를 먼저 확인하고 같은 SHA를 fast-forward push. 머지 버튼 금지 |
| 두 번째 Vercel 프로젝트 | 커밋 상태가 빨갛게 보임. 공개 상태면 B 셀 클라이언트 | context로 필터. B4 점검과 동결 해제 조건 |
| 스모크의 기존 실패 3건 | 새 실패를 가림 | 실패 테스트 위치를 알려진 3건과 기계 비교. 테스트 전 실패 감지 |
| 셸 상태 소실·가드 무력화 | 빈 `$M`, 다른 계정 키, 가드 뒤 명령 실행 | env.sh를 매 호출 첫 줄로. err_exit·no_unset·pipe_fail. `|| stop`. `${M}` 중괄호(zsh 콜론 수식어). `[[ ${#M} -eq 40 ]]` |
| `/private/tmp` 소실(재부팅) | 백업·증거·도구·클론 손실 | `$OPS` 영구 폴더(0700), GitHub에서 받은 독립 클론, A0 sha256 |
| 잠금 대기 | 일부 요청이 최대 약 5초 정지 | `lock_timeout` 3 s. C1·D0 `6.*` 확장(9개 테이블 + AccessExclusive·대기 잠금). 원장·동결 테이블 잠금은 쓰기만 막는다 |
| 부분 적용이나 수동 적용 | 원장과 스키마 불일치 | 한 트랜잭션 안에서 원장 insert와 LEDGER_GUARD. PRE_GUARD(열, md5, 원장). 재실행 skip도 LEDGER_GUARD·POST_GUARD를 통과해야 한다. `phase` 표시와 끊김 판정표 |
| 원장 경쟁(CLI 등 다른 쓰기) | 가드 검사와 COMMIT 사이에 원장 행이 생기거나 사라짐 | 적용·롤백 모두 advisory lock 뒤 원장을 `SHARE ROW EXCLUSIVE`로 잠근다(CLI는 advisory lock을 잡지 않는다). insert 뒤 LEDGER_GUARD. 로컬 시험 T8·T5b |
| 적용 순간의 동결 위반 | 검사 뒤 COMMIT 전에 매장·멤버십·게시·예약이 생김 | 동결 테이블 5개 `SHARE` 잠금 뒤 `5.gate`와 같은 5개 수치 검사. 로컬 시험 T7·T9 |
| 연결 끊김 뒤 남은 세션 | 잠금 보유, 재시도가 55P03 | `application_name`(시작 매개변수 + SET), `orphans.sql`, 대기 뒤 판정, 필요하면 세션 종료(⚠) |
| 커밋 뒤 점검 실패로 재로드 누락 | 스키마 캐시 지연 | NOTIFY를 트랜잭션 안에서 보내 커밋과 함께 전달. 커밋 뒤 점검은 보고 전용(종료 코드 3) |
| 소유자나 권한·헤더 속성 변화 | 권한 회귀, 속성 초기화 | SNAPSHOT 확장(strict, parallel, cost, language, 인자, 반환형). V3 골든 비교. `pg_get_functiondef` 비교 |
| 보류 마이그레이션을 실수로 적용 | 검증 안 된 공유 목록 잠금이 운영에 들어감 | 1개짜리 허용 목록, 러너 단언, PRE_GUARD, `db push` 금지 |
| 견적 1회 무효화 | 진행 중 예약이 0단계로 | 매장 0, 열린 예약 0 확인(C1 `5.gate`) |
| rpc-2 거부 | 예약 견적 정책 불일치 | 결정 3을 적용 전(A3 전)에 받는다. 거부되면 파일을 고치고 다시 한다 |
| 비상 롤백의 경쟁 조건·원장 구멍 | 사진 OFF 손실, 함수 깨짐 | 원장·테이블 잠금 먼저, 원장 head 검사, 속성 비교, COMMIT 전 원장 검사, C4 음성 시험 |
| 롤백 SQL·도구 미검증 | 비상 시 실패 | C4에서 같은 도구로 음성 시험, 롤백, 골든 비교, 재적용 |
| 리허설이 운영과 다름 | 거짓 통과 | 복원 오류 허용 목록(목록 밖이면 멈춤). 리허설 preflight와 함수 정의를 운영 골든과 `same`으로 비교. 같다고 보는 범위는 비교 항목뿐이다(C4-1 아래) |
| 기대값을 눈으로 비교 | 거짓 중단이나 느슨한 비교 | SQL `ok` 열과 `check-results.cjs` |
| 운영 읽기 도구가 다른 대상을 읽음 | 리허설을 운영 결과로 오인 | ro-sql의 `--production`/`--rehearsal` 필수, DB 이름·read-only 단언, 출력에 대상 기록, `check-results --target` |
| 백업·리허설 DB의 개인정보 | 유출 | 스키마 전용 + 원장·버킷 행만. 10-20 덤프와 리허설 DB 삭제(오너). 0600·0700 |
| A2가 운영 Supabase에 요청 | 운영 `web_vitals`·`client_errors` 오염 | A2는 QA 스택(54381)만. 운영 헤드리스는 사용자 에이전트 표식 |
| 관찰 사각지대(매장 0곳) | 24시간 관찰이 신호를 못 만든다 | 체크포인트 능동 점검. 진짜 카나리아는 첫 매장(F4). 차단 수단 준비 |
| 회원 즐겨찾기 회귀 | 실데이터(favorites 10, profiles 5)에 영향 | B0·B2 오너 회원 스모크, 즉시 §5.1 |
| 자격 증명 노출 | 키 유출 | 스크립트가 메모리로만 읽음. 대상 확인 뒤에만 키 읽기. `set -x`·echo 금지. curl 키는 fd로. gh 토큰은 함수 안 환경변수로. 관리자 CLI 설정은 0600 |
| 앱 롤백 뒤 자동 도메인 할당이 꺼짐 | 다음 push가 운영에 안 올라감 | `vadm promote`로 복구하고 기록 |
| 공유 작업 트리(Codex) 변경 | 실행 중 파일이 바뀜 | 모듈·테스트·마이그레이션은 `$W`에서, 공유 트리는 자격 증명만 읽음. sha256 고정. 공지 |
| 커밋된 테스트 생성 파일 `lib/.lightbox-*-extracted.tsx` | 정리 필요 | M에는 유지(트리 동일성). 후속 커밋에서 `.gitignore` |
| Node 버전(로컬 23.9, 운영 24) | 런타임 차이 | PR CI(Node 24) 통과를 게이트로 |

## 부록 A. 실행 파일

출처는 `/Users/hanmyeong-gwan/mobile_design/.worktrees/service-quality-20261018/reports/operations/show-photos-release-20261021`다.
- A0에서 `env.sh`는 `$OPS`로, 나머지는 `$RUN`으로 복사하고 sha256을 대조한다(A0-1의 목록).
- 아래 부록 B·C의 본문은 검토용 사본이다.
- 검증한 것:
  - SQL 전 문장과 DO·plpgsql 본문은 PostgreSQL 파서(libpg_query)로 구문을 확인했다.
  - JS는 `node --check`로 확인했다.
  - `ro-sql.cjs`의 문장 분리와 `check-results.cjs`의 판정은 합성 결과 파일로 시험했다.
  - 두 파서 번들(M, main)은 esbuild로 만들어 합성 응답으로 판정을 확인했다.
- 적용·롤백 도구의 DB 동작은 10-22 임시 로컬 Supabase에서 먼저 확인했다(부록 D, 19개 확인 통과). 운영 복원본으로는 C4에서 검증한다.

| 파일 | 용도 | 운영 접근 | sha256(앞 8자) |
|---|---|---|---|
| `env.sh` | 공통 환경(zsh), 신원 함수, 운영 = M 단언 | — | `98035fc4` |
| `release-migrations-20261021.json` | 허용 목록(1개, 소스 `$W`) | — | `9721bc86` |
| `apply-guards.sql` | PRE_GUARD(원장·동결 테이블 잠금 포함), SNAPSHOT, POST_GUARD, LEDGER_GUARD | 적용 트랜잭션 안 | `4f1182ec` |
| `apply-show-photos.cjs` | 적용기(재실행은 검증 뒤 skip) | **⚠ 운영 쓰기**(`--production`) | `36e6d296` |
| `rollback-20261020123000.sql` | 비상 롤백 SQL | **⚠ 운영 쓰기** | `4f528dec` |
| `rollback-show-photos.cjs` | 비상 롤백 실행기 | **⚠ 운영 쓰기**(`--production`) | `88e25964` |
| `backup-show-photos.cjs` | pg_dump(스키마 + 원장·버킷 행) | 읽기 | `f89a285d` |
| `ro-sql.cjs` | 읽기 전용 SQL 실행기(문장별 결과) | 읽기 | `e9c73ac2` |
| `check-results.cjs` | `ok`·`same` 판정 | — | `60bb6499` |
| `check-restore-errors.cjs` | C4-1 복원 오류 허용 목록 판정 | — | `6ac47faf` |
| `cell-probe.cjs` | 셀 점검(로컬 리허설 DB) | — | `62705d80` |
| `headless-check.cjs` | 헤드리스 점검(M 전용 표식) | 공개 페이지 읽기 | `5ff6ee53` |
| `rehearsal-pg.cjs` | 테스트 스크립트를 리허설 DB로 보내는 preload | — | `43fdd107` |
| `preflight.sql`, `fn-defs.sql`, `verify-v1-v4.sql`, `verify-v5.sql`, `verify-v6.sql`, `monitor.sql`, `orphans.sql` | 점검 | 읽기 | A0-1 목록 |

## 부록 B. SQL

### B-1 `preflight.sql` (읽기 전용)

```sql
-- Read-only preflight for 20261020123000_store_profile_show_photos. Run it only through ro-sql.cjs:
-- one statement per `-- @<id>` line, one read-only repeatable-read transaction, search_path = ''.
-- `ok` columns compare against the expected values in SQL; `check-results.cjs ok` requires every ok = true.
-- The C1 output is the golden file. D0, after-rollback and rehearsal runs are compared to it with `check-results.cjs same`.
-- Ids starting with 6. or info. are point-in-time or informational and are never golden-compared.

-- @1.target
select current_database() as db, current_user as usr, current_setting('server_version_num') as server_version_num,
       current_setting('check_function_bodies') as check_function_bodies,
       (current_user = 'postgres' and current_setting('server_version_num') = '170006'
        and current_setting('check_function_bodies') = 'on') as ok

-- @2.ledger
select count(*)::int as n, max(version) as head,
       (count(*) filter (where version = '20260926083440'))::int as withheld,
       (count(*) filter (where version = '20261020123000'))::int as target,
       (count(*) = 23 and max(version) = '20261019200901'
        and count(*) filter (where version in ('20260926083440', '20261020123000')) = 0) as ok
from supabase_migrations.schema_migrations

-- @2.statements
select jsonb_agg(jsonb_build_object('version', version, 'name', name, 'n_statements', array_length(statements, 1),
         'sha256', encode(sha256(convert_to(statements[1], 'UTF8')), 'hex')) order by version) as rows,
       (count(*) = 2 and bool_and(array_length(statements, 1) = 1 and encode(sha256(convert_to(statements[1], 'UTF8')), 'hex') = case version
          when '20261019200212' then '3c06f5d8999997ff73adde5164a323bfe4c6e0c18ec26061317c44d20b96a4d7'
          when '20261019200901' then '6c1872e6dffc80d39569d67428d988acbab43f081f3f38af0e0a3327036a56c1' end)) as ok
from supabase_migrations.schema_migrations where version in ('20261019200212', '20261019200901')

-- @2.ledger-columns
select column_name::text as column_name, data_type::text as data_type, is_nullable::text as is_nullable, column_default::text as column_default,
       case column_name::text
         when 'version' then data_type::text = 'text' and is_nullable::text = 'NO'
         when 'statements' then data_type::text = 'ARRAY'
         when 'name' then data_type::text = 'text'
         else is_nullable::text = 'YES' or column_default is not null
       end as ok
from information_schema.columns
where table_schema = 'supabase_migrations' and table_name = 'schema_migrations' order by ordinal_position

-- @2.privileges
select has_schema_privilege(current_user, 'supabase_migrations', 'USAGE') as ledger_usage,
       has_table_privilege(current_user, 'supabase_migrations.schema_migrations', 'INSERT') as ledger_insert,
       has_table_privilege(current_user, 'supabase_migrations.schema_migrations', 'DELETE') as ledger_delete,
       pg_has_role(current_user, 'anon', 'MEMBER') as anon_member,
       pg_has_role(current_user, 'anon', 'SET') as anon_set,
       pg_has_role(current_user, 'authenticated', 'MEMBER') as authenticated_member,
       pg_has_role(current_user, 'authenticated', 'SET') as authenticated_set,
       (has_schema_privilege(current_user, 'supabase_migrations', 'USAGE')
        and has_table_privilege(current_user, 'supabase_migrations.schema_migrations', 'INSERT')
        and has_table_privilege(current_user, 'supabase_migrations.schema_migrations', 'DELETE')
        and pg_has_role(current_user, 'anon', 'MEMBER') and pg_has_role(current_user, 'anon', 'SET')
        and pg_has_role(current_user, 'authenticated', 'MEMBER') and pg_has_role(current_user, 'authenticated', 'SET')) as ok

-- @info.auth-users
select has_table_privilege(current_user, 'auth.users', 'SELECT') as owner_reads_auth_users

-- @3.columns
select string_agg(attname || ' ' || format_type(atttypid, atttypmod), ', ' order by attnum) as columns,
       string_agg(attname || ' ' || format_type(atttypid, atttypmod), ', ' order by attnum)
         = 'merchant_id uuid, name_en text, introduction_ko text, introduction_en text, english_ok boolean, notice text, updated_at timestamp with time zone' as ok
from pg_attribute where attrelid = 'public.merchant_store_profiles'::regclass and attnum > 0 and not attisdropped

-- @3.owner
select pg_has_role(current_user, relowner, 'MEMBER') as can_alter, pg_has_role(current_user, relowner, 'MEMBER') as ok
from pg_class where oid = 'public.merchant_store_profiles'::regclass

-- @4.bodies
select p.proname, md5(p.prosrc) as src_md5,
       md5(p.prosrc) = case p.proname
         when 'booking_quote' then 'c4b538c9f97e676a005dc82323de62e2'
         when 'partner_store_profile' then 'fad8cf13c2c00209bd5b2672a1796ed5'
         when 'store_profile_json' then '11a705af62d2d67eb054feb684c110e1' end as ok
from pg_proc p
where p.oid = any ('{"private.store_profile_json(public.merchants,public.merchant_store_profiles)","private.partner_store_profile(text,timestamptz,jsonb,uuid)","private.booking_quote(public.merchant_services,public.merchant_categories,public.merchants,public.merchant_booking_settings)"}'::regprocedure[])
order by p.proname

-- @4.attrs
select proname, owner, prosecdef, provolatile, proconfig, acl, proisstrict, proparallel, procost, lang, args, result, can_replace,
       (owner = 'postgres' and can_replace and proconfig = array['search_path=""'] and not proisstrict and proparallel = 'u'
        and case proname
              when 'booking_quote' then not prosecdef and provolatile = 's' and lang = 'sql'
                and acl = array['postgres=X/postgres', 'service_role=X/postgres']
              when 'partner_store_profile' then prosecdef and provolatile = 'v' and lang = 'plpgsql'
                and acl = array['authenticated=X/postgres', 'postgres=X/postgres', 'service_role=X/postgres']
              when 'store_profile_json' then not prosecdef and provolatile = 's' and lang = 'sql'
                and acl = array['postgres=X/postgres', 'service_role=X/postgres']
              else false end) as ok
from (select p.proname::text as proname, pg_get_userbyid(p.proowner)::text as owner, p.prosecdef, p.provolatile::text as provolatile, p.proconfig,
             array(select a::text from unnest(p.proacl) a order by a::text collate "C") as acl,
             p.proisstrict, p.proparallel::text as proparallel, p.procost, l.lanname::text as lang,
             pg_get_function_arguments(p.oid) as args, pg_get_function_result(p.oid) as result,
             pg_has_role(current_user, p.proowner, 'MEMBER') as can_replace
      from pg_proc p join pg_language l on l.oid = p.prolang
      where p.oid = any ('{"private.store_profile_json(public.merchants,public.merchant_store_profiles)","private.partner_store_profile(text,timestamptz,jsonb,uuid)","private.booking_quote(public.merchant_services,public.merchant_categories,public.merchants,public.merchant_booking_settings)"}'::regprocedure[])) s
order by proname

-- @4.defs
select p.proname, md5(pg_get_functiondef(p.oid)) as def_md5
from pg_proc p
where p.oid = any ('{"private.store_profile_json(public.merchants,public.merchant_store_profiles)","private.partner_store_profile(text,timestamptz,jsonb,uuid)","private.booking_quote(public.merchant_services,public.merchant_categories,public.merchants,public.merchant_booking_settings)"}'::regprocedure[])
order by p.proname

-- @4.overloads
select proname::text as proname, count(*)::int as n, count(*) = 1 as ok from pg_proc
where pronamespace = 'private'::regnamespace and proname in ('store_profile_json', 'partner_store_profile', 'booking_quote')
group by 1 order by 1

-- @5.gate
select merchants, active_memberships, published, store_profiles, open_bookings,
       (merchants = 0 and active_memberships = 0 and published = 0 and store_profiles = 0 and open_bookings = 0) as ok
from (select (select count(*)::int from public.merchants) as merchants,
             (select count(*)::int from public.merchant_memberships where revoked_at is null) as active_memberships,
             (select count(*)::int from public.merchant_publications where published) as published,
             (select count(*)::int from public.merchant_store_profiles) as store_profiles,
             (select count(*)::int from public.customer_bookings where status in ('requested', 'confirmed')) as open_bookings) s

-- @6.locks
select count(*)::int as n,
       coalesce(jsonb_agg(jsonb_build_object('pid', l.pid, 'rel', l.relation::regclass::text, 'mode', l.mode, 'granted', l.granted,
         'app', a.application_name, 'state', a.state, 'xact_age_s', round(extract(epoch from now() - a.xact_start)),
         'query', left(a.query, 80)) order by l.pid), '[]'::jsonb) as detail,
       count(*) = 0 as ok
from pg_locks l
join pg_class c on c.oid = l.relation
left join pg_stat_activity a on a.pid = l.pid
where l.locktype = 'relation' and l.pid <> pg_backend_pid()
  and l.database = (select oid from pg_database where datname = current_database())
  and (((l.mode = 'AccessExclusiveLock' or not l.granted)
        and c.relnamespace in ('public'::regnamespace, 'private'::regnamespace, 'supabase_migrations'::regnamespace))
    or (l.relation = any ('{public.merchant_store_profiles,public.merchants,public.merchant_profile_reviews,public.merchant_services,public.merchant_categories,public.merchant_booking_settings,public.merchant_staff,public.merchant_staff_menus,supabase_migrations.schema_migrations}'::regclass[])
        and a.xact_start < now() - interval '5 seconds'))

-- @6.waiting
select count(*)::int as waiting_locks, count(*) = 0 as ok
from pg_locks
where not granted and (database is null or database = (select oid from pg_database where datname = current_database()))

-- @6.long-xacts
select count(*)::int as n,
       coalesce(jsonb_agg(jsonb_build_object('pid', pid, 'user', usename, 'app', application_name, 'state', state,
         'xact_age_s', round(extract(epoch from now() - xact_start)), 'query', left(query, 80)) order by pid), '[]'::jsonb) as detail,
       count(*) = 0 as ok
from pg_stat_activity
where backend_type = 'client backend' and pid <> pg_backend_pid() and datname = current_database()
  and xact_start < now() - interval '30 seconds'

-- @7.views
select count(*)::int as views, count(*) = 0 as ok
from pg_depend
where classid = 'pg_rewrite'::regclass
  and ((refclassid = 'pg_class'::regclass and refobjid = 'public.merchant_store_profiles'::regclass)
    or (refclassid = 'pg_type'::regclass and refobjid = 'public.merchant_store_profiles'::regtype))

-- @info.dependents
select classid::regclass::text as catalog, pg_describe_object(classid, objid, objsubid) as object, deptype::text as deptype
from pg_depend
where (refclassid = 'pg_class'::regclass and refobjid = 'public.merchant_store_profiles'::regclass)
   or (refclassid = 'pg_type'::regclass and refobjid = 'public.merchant_store_profiles'::regtype)
order by 1, 2

-- @info.event-triggers
select evtname::text as evtname, evtevent::text as evtevent, evtenabled::text as evtenabled from pg_event_trigger order by 1
```

### B-2 `apply-guards.sql` (적용 트랜잭션 안, ⚠ 운영 쓰기의 일부)

```sql
-- Statements the runner (apply-show-photos.cjs) executes INSIDE the migration transaction, in this order:
--   set application_name = 'myseouldrop-show-photos-apply';   -- before begin, so the pooler cannot hide the session
--   begin; set local lock_timeout='3s'; set local statement_timeout='60s'; set local idle_in_transaction_session_timeout='30s';
--   select pg_advisory_xact_lock(hashtext('myseouldrop-release-migrations'));
--   ledger-exists check: if the version is already there, [LEDGER_GUARD] [POST_GUARD], rollback, report skip (nothing written)
--   [PRE_GUARD: ledger and freeze-table locks, then the checks]  [SNAPSHOT -> before]
--   <20261020123000_store_profile_show_photos.sql verbatim, sha256 22e132c52d2b67e941d0e1d9fd69cb6cb4de44b34f125603c71236356f4433a5>
--   [POST_GUARD] [SNAPSHOT -> after; runner asserts deepEqual(before, after)]
--   insert into supabase_migrations.schema_migrations(version,name,statements) values($1,$2,$3)
--       -- $1='20261020123000', $2='store_profile_show_photos', $3=[file text]
--   [LEDGER_GUARD]
--   notify pgrst, 'reload schema';   -- queued in the transaction; PostgreSQL delivers it only when COMMIT succeeds
--   commit;
-- The runner pins this file's sha256. Any edit needs a new review, a new pin in the runner and A0, and a new C4 rehearsal.
-- CREATE OR REPLACE keeps only owner and ACL; every other attribute comes from the statement, so SNAPSHOT covers them all.
-- Lock order everywhere (apply and rollback): advisory lock, ledger, then public tables. LOCK ... SHARE ROW EXCLUSIVE on the
-- ledger needs UPDATE, DELETE or TRUNCATE on it (C1 2.privileges checks DELETE).

-- ===== PRE_GUARD =====
-- The advisory lock only stops our own runners. The ledger lock also stops the Supabase CLI or anyone else from adding a
-- row until COMMIT; the SHARE locks stop inserts and updates on the five freeze tables until COMMIT, so every check below
-- still holds when the transaction commits. Readers are not blocked. The ALTER in the migration then upgrades
-- merchant_store_profiles to ACCESS EXCLUSIVE inside this same transaction.
lock table supabase_migrations.schema_migrations in share row exclusive mode;
lock table public.merchants, public.merchant_memberships, public.merchant_publications, public.merchant_store_profiles,
           public.customer_bookings in share mode;
do $pre$
declare fns regprocedure[] := '{"private.store_profile_json(public.merchants,public.merchant_store_profiles)","private.partner_store_profile(text,timestamptz,jsonb,uuid)","private.booking_quote(public.merchant_services,public.merchant_categories,public.merchants,public.merchant_booking_settings)"}';
  gate int[];
begin
  if (select count(*) from supabase_migrations.schema_migrations) <> 23
     or (select max(version) from supabase_migrations.schema_migrations) <> '20261019200901'
     or exists (select 1 from supabase_migrations.schema_migrations where version in ('20260926083440', '20261020123000')) then
    raise exception 'PRE_GUARD: unexpected migration ledger';
  end if;
  if exists (select 1 from pg_attribute where attrelid = 'public.merchant_store_profiles'::regclass and attname = 'show_photos' and not attisdropped) then
    raise exception 'PRE_GUARD: show_photos already exists (manual application?)';
  end if;
  if (select string_agg(p.proname || '=' || md5(p.prosrc), ',' order by p.proname) from pg_proc p where p.oid = any (fns))
     is distinct from 'booking_quote=c4b538c9f97e676a005dc82323de62e2,partner_store_profile=fad8cf13c2c00209bd5b2672a1796ed5,store_profile_json=11a705af62d2d67eb054feb684c110e1' then
    raise exception 'PRE_GUARD: live bodies differ from 20261019200212';
  end if;
  if current_setting('check_function_bodies') <> 'on' then
    raise exception 'PRE_GUARD: check_function_bodies is off';
  end if;
  -- Onboarding freeze, enforced at apply time with the same five counts as preflight 5.gate (C1, D0): no store, no active
  -- partner member, no published store, no store profile and no open booking may exist yet.
  gate := array[(select count(*)::int from public.merchants),
                (select count(*)::int from public.merchant_memberships where revoked_at is null),
                (select count(*)::int from public.merchant_publications where published),
                (select count(*)::int from public.merchant_store_profiles),
                (select count(*)::int from public.customer_bookings where status in ('requested', 'confirmed'))];
  if gate <> array[0, 0, 0, 0, 0] then
    raise exception 'PRE_GUARD: the onboarding freeze was broken (merchants, active memberships, published, store profiles, open bookings = %)', gate;
  end if;
end $pre$;

-- ===== SNAPSHOT (run before and after the migration SQL; must be identical) =====
select p.oid::regprocedure::text as fn, p.proowner::regrole::text as owner, p.prosecdef, p.provolatile, p.proconfig, p.proacl::text as acl,
       p.proisstrict, p.proparallel, p.procost, l.lanname::text as lang,
       pg_get_function_arguments(p.oid) as args, pg_get_function_result(p.oid) as result
from pg_proc p join pg_language l on l.oid = p.prolang
where p.oid = any ('{"private.store_profile_json(public.merchants,public.merchant_store_profiles)","private.partner_store_profile(text,timestamptz,jsonb,uuid)","private.booking_quote(public.merchant_services,public.merchant_categories,public.merchants,public.merchant_booking_settings)"}'::regprocedure[])
order by 1;

-- ===== POST_GUARD =====
do $post$
declare fns regprocedure[] := '{"private.store_profile_json(public.merchants,public.merchant_store_profiles)","private.partner_store_profile(text,timestamptz,jsonb,uuid)","private.booking_quote(public.merchant_services,public.merchant_categories,public.merchants,public.merchant_booking_settings)"}';
begin
  if not exists (select 1 from pg_attribute a join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
                 where a.attrelid = 'public.merchant_store_profiles'::regclass and a.attname = 'show_photos' and not a.attisdropped
                   and a.atttypid = 'boolean'::regtype and a.attnotnull and pg_get_expr(d.adbin, d.adrelid) = 'true') then
    raise exception 'POST_GUARD: show_photos definition mismatch';
  end if;
  if (select string_agg(p.proname || '=' || md5(p.prosrc), ',' order by p.proname) from pg_proc p where p.oid = any (fns))
     is distinct from 'booking_quote=bea475352d419bb440854ecd2b02f277,partner_store_profile=8fafbb7d56196ec7aeba628b95feda83,store_profile_json=289c62d7632528f242c8100f1934c5a0' then
    raise exception 'POST_GUARD: bodies differ from 20261020123000';
  end if;
  if (select count(*) from pg_proc where pronamespace = 'private'::regnamespace
      and proname in ('store_profile_json', 'partner_store_profile', 'booking_quote')) <> 3 then
    raise exception 'POST_GUARD: unexpected overloads';
  end if;
  if (private.store_profile_json(null::public.merchants, null::public.merchant_store_profiles) -> 'showPhotos') is distinct from 'true'::jsonb then
    raise exception 'POST_GUARD: store_profile_json smoke failed';
  end if;
  if private.booking_quote(null::public.merchant_services, null::public.merchant_categories, null::public.merchants, null::public.merchant_booking_settings) !~ '^[0-9a-f]{32}$' then
    raise exception 'POST_GUARD: booking_quote smoke failed';
  end if;
end $post$;

-- ===== LEDGER_GUARD (after the ledger insert, before COMMIT; and on the skip path) =====
do $ledger$
begin
  if (select count(*) from supabase_migrations.schema_migrations) <> 24
     or (select max(version) from supabase_migrations.schema_migrations) <> '20261020123000'
     or exists (select 1 from supabase_migrations.schema_migrations where version = '20260926083440') then
    raise exception 'LEDGER_GUARD: the ledger is not 24 rows with head 20261020123000 and the withheld migration absent';
  end if;
  if not exists (select 1 from supabase_migrations.schema_migrations
                 where version = '20261020123000' and name = 'store_profile_show_photos' and array_length(statements, 1) = 1
                   and encode(sha256(convert_to(statements[1], 'UTF8')), 'hex') = '22e132c52d2b67e941d0e1d9fd69cb6cb4de44b34f125603c71236356f4433a5') then
    raise exception 'LEDGER_GUARD: the 20261020123000 ledger row does not hold the reviewed file';
  end if;
end $ledger$;
```

### B-3 `verify-v1-v4.sql` (읽기 전용)

```sql
-- Post-commit verification on a NEW connection (ro-sql.cjs; read-only; touches no rows).
-- V3.attrs is the same query as preflight 4.attrs: `check-results.cjs same <C1 golden> <this output> 4.attrs=V3.attrs`.
-- After a disconnect, V1.column n and V4.ledger n say whether the migration committed (both 1) or not (both 0).

-- @V1.column
select count(*)::int as n, min(a.attnum)::int as attnum,
       bool_and(format_type(a.atttypid, a.atttypmod) = 'boolean' and a.attnotnull and pg_get_expr(d.adbin, d.adrelid) = 'true') as definition_ok,
       (count(*) = 1 and coalesce(bool_and(format_type(a.atttypid, a.atttypmod) = 'boolean' and a.attnotnull
                                          and pg_get_expr(d.adbin, d.adrelid) = 'true'), false)) as ok
from pg_attribute a left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
where a.attrelid = 'public.merchant_store_profiles'::regclass and a.attname = 'show_photos' and not a.attisdropped

-- @V1.info-schema
select count(*)::int as n, max(is_nullable::text) as is_nullable, max(column_default::text) as column_default, max(data_type::text) as data_type,
       (count(*) = 1 and max(is_nullable::text) = 'NO' and max(column_default::text) = 'true' and max(data_type::text) = 'boolean') as ok
from information_schema.columns
where table_schema = 'public' and table_name = 'merchant_store_profiles' and column_name = 'show_photos'

-- @V2.bodies
select proname, src_md5, markers_ok,
       (markers_ok and src_md5 = case proname
          when 'booking_quote' then 'bea475352d419bb440854ecd2b02f277'
          when 'partner_store_profile' then '8fafbb7d56196ec7aeba628b95feda83'
          when 'store_profile_json' then '289c62d7632528f242c8100f1934c5a0' end) as ok
from (select p.proname::text as proname, md5(p.prosrc) as src_md5,
             case p.proname
               when 'store_profile_json' then strpos(p.prosrc, '''showPhotos'',coalesce(p.show_photos,true)') > 0
               when 'partner_store_profile' then strpos(p.prosrc, 'jsonb_object_keys(p_values - ''showPhotos''))<>4') > 0
                 and strpos(p.prosrc, 'show_photos=excluded.show_photos') > 0
                 and strpos(p.prosrc, 'if m.contact_phone is distinct from p_values->>''contactPhone''') > 0
                 and strpos(p.prosrc, 'jsonb_object_keys(p_values))<>4') = 0
               when 'booking_quote' then strpos(p.prosrc, 'select profile.name_en from public.merchant_store_profiles') > 0
                 and strpos(p.prosrc, 'select profile.updated_at from public.merchant_store_profiles') = 0
             end as markers_ok
      from pg_proc p
      where p.oid = any ('{"private.store_profile_json(public.merchants,public.merchant_store_profiles)","private.partner_store_profile(text,timestamptz,jsonb,uuid)","private.booking_quote(public.merchant_services,public.merchant_categories,public.merchants,public.merchant_booking_settings)"}'::regprocedure[])) s
order by proname

-- @V3.attrs
select proname, owner, prosecdef, provolatile, proconfig, acl, proisstrict, proparallel, procost, lang, args, result, can_replace,
       (owner = 'postgres' and can_replace and proconfig = array['search_path=""'] and not proisstrict and proparallel = 'u'
        and case proname
              when 'booking_quote' then not prosecdef and provolatile = 's' and lang = 'sql'
                and acl = array['postgres=X/postgres', 'service_role=X/postgres']
              when 'partner_store_profile' then prosecdef and provolatile = 'v' and lang = 'plpgsql'
                and acl = array['authenticated=X/postgres', 'postgres=X/postgres', 'service_role=X/postgres']
              when 'store_profile_json' then not prosecdef and provolatile = 's' and lang = 'sql'
                and acl = array['postgres=X/postgres', 'service_role=X/postgres']
              else false end) as ok
from (select p.proname::text as proname, pg_get_userbyid(p.proowner)::text as owner, p.prosecdef, p.provolatile::text as provolatile, p.proconfig,
             array(select a::text from unnest(p.proacl) a order by a::text collate "C") as acl,
             p.proisstrict, p.proparallel::text as proparallel, p.procost, l.lanname::text as lang,
             pg_get_function_arguments(p.oid) as args, pg_get_function_result(p.oid) as result,
             pg_has_role(current_user, p.proowner, 'MEMBER') as can_replace
      from pg_proc p join pg_language l on l.oid = p.prolang
      where p.oid = any ('{"private.store_profile_json(public.merchants,public.merchant_store_profiles)","private.partner_store_profile(text,timestamptz,jsonb,uuid)","private.booking_quote(public.merchant_services,public.merchant_categories,public.merchants,public.merchant_booking_settings)"}'::regprocedure[])) s
order by proname

-- @V3.exec
select jsonb_agg(jsonb_build_object('fn', fn, 'anon', anon, 'authenticated', authenticated) order by fn) as functions,
       (count(*) = 6 and bool_and(case fn
          when 'private.booking_quote' then not anon and not authenticated
          when 'private.partner_store_profile' then not anon and authenticated
          when 'private.public_store_profile' then anon and authenticated
          when 'private.store_profile_json' then not anon and not authenticated
          when 'public.partner_store_profile' then not anon and authenticated
          when 'public.public_store_profile' then anon and authenticated
          else false end)) as ok
from (select format('%s.%s', n.nspname, p.proname) as fn,
             has_function_privilege('anon', p.oid, 'EXECUTE') as anon,
             has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where (n.nspname::text, p.proname::text) in (('public', 'partner_store_profile'), ('public', 'public_store_profile'),
            ('private', 'partner_store_profile'), ('private', 'public_store_profile'), ('private', 'store_profile_json'), ('private', 'booking_quote'))) s

-- @info.V3.grants
select p.proname::text as proname, case when a.grantee = 0 then 'PUBLIC' else a.grantee::regrole::text end as grantee, a.privilege_type
from pg_proc p cross join lateral aclexplode(p.proacl) a
where p.oid = any ('{"private.store_profile_json(public.merchants,public.merchant_store_profiles)","private.partner_store_profile(text,timestamptz,jsonb,uuid)","private.booking_quote(public.merchant_services,public.merchant_categories,public.merchants,public.merchant_booking_settings)"}'::regprocedure[])
order by 1, 2

-- @V4.ledger
select count(*)::int as n, min(name) as name, min(array_length(statements, 1)) as n_statements,
       bool_and(encode(sha256(convert_to(statements[1], 'UTF8')), 'hex') = '22e132c52d2b67e941d0e1d9fd69cb6cb4de44b34f125603c71236356f4433a5') as matches_file,
       (count(*) = 1 and min(name) = 'store_profile_show_photos' and min(array_length(statements, 1)) = 1
        and coalesce(bool_and(encode(sha256(convert_to(statements[1], 'UTF8')), 'hex') = '22e132c52d2b67e941d0e1d9fd69cb6cb4de44b34f125603c71236356f4433a5'), false)) as ok
from supabase_migrations.schema_migrations where version = '20261020123000'

-- @V4.counts
select count(*)::int as n, max(version) as head, (count(*) filter (where version = '20260926083440'))::int as withheld,
       (count(*) = 24 and max(version) = '20261020123000' and count(*) filter (where version = '20260926083440') = 0) as ok
from supabase_migrations.schema_migrations
```

### B-4 `verify-v5.sql`, `verify-v6.sql` (읽기 전용, 각각 단독 실행)

```sql
-- V5 smoke (ro-sql.cjs, read-only). Run with --set phase=pre (C1 and D0 baseline) or --set phase=post (C4 and E1).
-- Kept apart from V1-V4 so that a failed SET ROLE cannot cost the catalog checks; ro-sql stops at the first error
-- and never runs the anon call as postgres.

-- @V5.null-json
select (j -> 'showPhotos') as show_photos, (select count(*)::int from jsonb_object_keys(j)) as n_keys,
       case current_setting('myseouldrop.phase', true)
         when 'pre' then not (j ? 'showPhotos') and (select count(*) from jsonb_object_keys(j)) = 10
         when 'post' then (j -> 'showPhotos') = 'true'::jsonb and (select count(*) from jsonb_object_keys(j)) = 11
       end as ok
from (select private.store_profile_json(null::public.merchants, null::public.merchant_store_profiles) as j) s

-- @V5.null-quote
select q ~ '^[0-9a-f]{32}$' as ok
from (select private.booking_quote(null::public.merchant_services, null::public.merchant_categories, null::public.merchants,
                                    null::public.merchant_booking_settings) as q) s

-- @V5.set-role
set local role anon

-- @V5.anon-public-profile
select v, v = '{"status": "unpublished", "placeId": "ct-more-on-hair-seongsu-branch"}'::jsonb as ok
from (select public.public_store_profile('ct-more-on-hair-seongsu-branch') as v) s

-- @V5.reset-role
reset role
```

```sql
-- V6 (ro-sql.cjs, read-only): authenticated still reaches the private function and stops at AUTH_REQUIRED.
-- Pass: check-results.cjs ok <out> --expect-error V6.partner-profile=P0001:AUTH_REQUIRED
-- Reading a 42501 by its message:
--   "permission denied to set role"        -> this verification path does not work here (not caused by the migration)
--   "permission denied for function"       -> EXECUTE regression on partner_store_profile
--   "permission denied for table users"    -> the SECURITY DEFINER owner cannot read auth.users (pre-existing if the C1 baseline shows it)

-- @V6.claim
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000000', true) is not null as ok

-- @V6.set-role
set local role authenticated

-- @V6.partner-profile
select public.partner_store_profile()
```

### B-5 `monitor.sql`, `fn-defs.sql`, `orphans.sql` (읽기 전용)

```sql
-- Monitoring (ro-sql.cjs, read-only). Always pass --set release=<first 12 hex chars of M> --set since=<ISO time of the B1 push>:
-- client_errors.release holds only the first 12 characters of the commit SHA.
-- Rows from our own headless checks carry "myseouldrop-release-check" in user_agent (synthetic). They count: they ran M's code.

-- @M.errors-by-release
select release, kind, count(*)::int as n,
       (count(*) filter (where user_agent like '%myseouldrop-release-check%'))::int as synthetic, max(created_at) as last_seen
from public.client_errors where created_at > now() - interval '24 hours'
group by 1, 2 order by n desc limit 20

-- @M.errors-recent
select created_at, kind, left(message, 160) as message, page, release,
       coalesce(user_agent like '%myseouldrop-release-check%', false) as synthetic
from public.client_errors where created_at > now() - interval '2 hours'
order by created_at desc limit 30

-- @M.release-trigger
select current_setting('myseouldrop.release', true) as release, count(*)::int as n,
       count(distinct message)::int as messages, count(distinct page)::int as pages,
       (count(*) >= 3 or count(distinct page) >= 2) as trigger,
       (coalesce(current_setting('myseouldrop.release', true), '') ~ '^[0-9a-f]{12}$'
        and not (count(*) >= 3 or count(distinct page) >= 2)) as ok
from public.client_errors
where release = current_setting('myseouldrop.release', true)
  and created_at >= coalesce(nullif(current_setting('myseouldrop.since', true), '')::timestamptz, now() - interval '24 hours')

-- @M.freeze
select merchants, active_memberships, published, store_profiles, open_bookings,
       (merchants = 0 and active_memberships = 0 and published = 0 and store_profiles = 0 and open_bookings = 0) as ok
from (select (select count(*)::int from public.merchants) as merchants,
             (select count(*)::int from public.merchant_memberships where revoked_at is null) as active_memberships,
             (select count(*)::int from public.merchant_publications where published) as published,
             (select count(*)::int from public.merchant_store_profiles) as store_profiles,
             (select count(*)::int from public.customer_bookings where status in ('requested', 'confirmed')) as open_bookings) s
```

```sql
-- Read-only: full definitions, owner and ACL of the three functions the migration replaces (ro-sql.cjs).
-- C2 keeps the production copy; after any rollback, `check-results.cjs same <C2 copy> <new copy> defs` must pass.

-- @defs
select p.oid::regprocedure::text as fn, pg_get_userbyid(p.proowner)::text as owner,
       array(select a::text from unnest(p.proacl) a order by a::text collate "C") as acl,
       pg_get_functiondef(p.oid) as def
from pg_proc p
where p.oid = any ('{"private.store_profile_json(public.merchants,public.merchant_store_profiles)","private.partner_store_profile(text,timestamptz,jsonb,uuid)","private.booking_quote(public.merchant_services,public.merchant_categories,public.merchants,public.merchant_booking_settings)"}'::regprocedure[])
order by 1
```

```sql
-- After a disconnect, a timeout or 55P03 (ro-sql.cjs, read-only): is a session of ours still alive, and who holds the locks
-- the apply/rollback needs. The runners set application_name both at startup and with SET, so the pooler cannot hide it.
-- Decide nothing (no V1/V4 reading, no retry) until O.sessions is ok.

-- @O.sessions
select count(*)::int as n,
       coalesce(jsonb_agg(jsonb_build_object('pid', pid, 'app', application_name, 'state', state, 'xid', backend_xid::text,
         'xact_age_s', round(extract(epoch from now() - xact_start)), 'state_age_s', round(extract(epoch from now() - state_change)),
         'wait', wait_event_type || ':' || wait_event, 'query', left(query, 80)) order by pid), '[]'::jsonb) as detail,
       count(*) = 0 as ok
from pg_stat_activity
where pid <> pg_backend_pid() and application_name in ('myseouldrop-show-photos-apply', 'myseouldrop-show-photos-rollback')

-- @O.idle-in-transaction
select count(*)::int as n,
       coalesce(jsonb_agg(jsonb_build_object('pid', pid, 'app', application_name, 'state', state,
         'xact_age_s', round(extract(epoch from now() - xact_start)), 'query', left(query, 80)) order by pid), '[]'::jsonb) as detail
from pg_stat_activity
where pid <> pg_backend_pid() and usename = current_user and datname = current_database() and state like 'idle in transaction%'

-- @O.locks
select count(*)::int as n,
       coalesce(jsonb_agg(jsonb_build_object('pid', l.pid, 'app', a.application_name, 'locktype', l.locktype,
         'rel', case when l.locktype = 'relation' then l.relation::regclass::text end, 'mode', l.mode, 'granted', l.granted,
         'xact_age_s', round(extract(epoch from now() - a.xact_start)), 'query', left(a.query, 80)) order by l.pid), '[]'::jsonb) as detail,
       count(*) = 0 as ok
from pg_locks l left join pg_stat_activity a on a.pid = l.pid
where l.pid <> pg_backend_pid()
  and (a.application_name in ('myseouldrop-show-photos-apply', 'myseouldrop-show-photos-rollback')
    or (l.locktype = 'relation' and l.database = (select oid from pg_database where datname = current_database())
        and l.relation in ('public.merchant_store_profiles'::regclass, 'supabase_migrations.schema_migrations'::regclass)))
```

### B-6 `rollback-20261020123000.sql` — ⚠ 운영 쓰기 (비상용, 오너 승인)

- 함수 본문은 `20261019200212`(blob e608426)에서 그대로 옮겼다. 본문 md5와 헤더가 200212와 같은지 로컬에서 대조를 마쳤다.
- 이 파일의 sha256은 `4f528decb7c291eed917358236f6d2aa5e453d208ec4237c0bb178d415892eab`이고, 부록 C-4와 A0-1에 고정했다.

```sql
-- EMERGENCY ROLLBACK of 20261020123000_store_profile_show_photos (⚠ production write; explicit owner approval only).
-- Restores the 20261019200212 bodies verbatim (from git blob e608426), drops show_photos, removes the ledger row.
-- Runbook policy is fix-forward (docs/runbook.md:58-61).
-- Every check that decides whether to proceed runs inside this one transaction, after the table locks and before COMMIT:
--   * the ledger is locked SHARE ROW EXCLUSIVE right after the advisory lock (same order as the apply runner), so neither the
--     Supabase CLI nor anyone else can add a ledger row between the head check and COMMIT;
--   * merchant_store_profiles is locked ACCESS EXCLUSIVE before the show_photos=false check, so no partner save can commit in between;
--   * 20261020123000 must be the ledger head: 24 rows, nothing applied after it, the withheld 20260926083440 absent;
--   * owner, security definer, volatility, config and ACL must equal the C1 golden values before the rollback, and every
--     attribute CREATE OR REPLACE can reset (also strict, parallel, cost, language, arguments, result) must be unchanged after it;
--   * the ledger must be back at 23 rows / head 20261019200901 before COMMIT.
begin;
set local lock_timeout = '3s';
set local statement_timeout = '60s';
set local idle_in_transaction_session_timeout = '30s';
select pg_advisory_xact_lock(hashtext('myseouldrop-release-migrations'));
lock table supabase_migrations.schema_migrations in share row exclusive mode;
lock table public.merchant_store_profiles in access exclusive mode;
do $guard$
declare
  fns regprocedure[] := '{"private.store_profile_json(public.merchants,public.merchant_store_profiles)","private.partner_store_profile(text,timestamptz,jsonb,uuid)","private.booking_quote(public.merchant_services,public.merchant_categories,public.merchants,public.merchant_booking_settings)"}';
  attrs jsonb;
begin
  if (select count(*) from supabase_migrations.schema_migrations) <> 24
     or (select max(version) from supabase_migrations.schema_migrations) <> '20261020123000'
     or exists (select 1 from supabase_migrations.schema_migrations where version = '20260926083440') then
    raise exception 'ROLLBACK_GUARD: 20261020123000 is not the ledger head (expect 24 rows, head 20261020123000, withheld migration absent)';
  end if;
  if (select string_agg(p.proname||'='||md5(p.prosrc),',' order by p.proname) from pg_proc p where p.oid = any (fns))
     is distinct from 'booking_quote=bea475352d419bb440854ecd2b02f277,partner_store_profile=8fafbb7d56196ec7aeba628b95feda83,store_profile_json=289c62d7632528f242c8100f1934c5a0' then
    raise exception 'ROLLBACK_GUARD: live bodies are not the 20261020123000 bodies: %',
      (select string_agg(p.proname||'='||md5(p.prosrc),',' order by p.proname) from pg_proc p where p.oid = any (fns));
  end if;
  if exists (select 1 from public.merchant_store_profiles where show_photos is false) then
    raise exception 'ROLLBACK_GUARD: stores with show_photos=false would lose that setting; fix forward instead';
  end if;
  select jsonb_agg(jsonb_build_object('fn', p.proname::text, 'owner', pg_get_userbyid(p.proowner)::text, 'secdef', p.prosecdef,
           'volatile', p.provolatile::text, 'config', to_jsonb(p.proconfig),
           'acl', (select jsonb_agg(a::text order by a::text collate "C") from unnest(p.proacl) a),
           'strict', p.proisstrict, 'parallel', p.proparallel::text, 'cost', p.procost,
           'lang', (select l.lanname::text from pg_language l where l.oid = p.prolang),
           'args', pg_get_function_arguments(p.oid), 'result', pg_get_function_result(p.oid)) order by p.proname)
    into attrs from pg_proc p where p.oid = any (fns);
  if (select jsonb_agg(v - array['strict', 'parallel', 'cost', 'lang', 'args', 'result'] order by v->>'fn') from jsonb_array_elements(attrs) as e(v))
     is distinct from '[{"fn": "booking_quote", "owner": "postgres", "secdef": false, "volatile": "s", "config": ["search_path=\"\""], "acl": ["postgres=X/postgres", "service_role=X/postgres"]},
                        {"fn": "partner_store_profile", "owner": "postgres", "secdef": true, "volatile": "v", "config": ["search_path=\"\""], "acl": ["authenticated=X/postgres", "postgres=X/postgres", "service_role=X/postgres"]},
                        {"fn": "store_profile_json", "owner": "postgres", "secdef": false, "volatile": "s", "config": ["search_path=\"\""], "acl": ["postgres=X/postgres", "service_role=X/postgres"]}]'::jsonb then
    raise exception 'ROLLBACK_GUARD: function owner/security definer/volatility/config/ACL differ from the C1 golden values: %', attrs;
  end if;
  perform set_config('myseouldrop.rollback_attrs', attrs::text, true);
end $guard$;

create or replace function private.store_profile_json(m public.merchants,p public.merchant_store_profiles) returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('contactPhone',m.contact_phone,'contactEmail',m.contact_email,'nameKo',m.display_name,'address',m.address,
  'nameEn',coalesce(p.name_en,''),'introductionKo',coalesce(p.introduction_ko,''),'introductionEn',coalesce(p.introduction_en,''),
  'englishOk',coalesce(p.english_ok,false),'notice',coalesce(p.notice,''),'updatedAt',greatest(m.updated_at,p.updated_at))
$$;
create or replace function private.partner_store_profile(p_action text default null,p_expected_updated_at timestamptz default null,p_values jsonb default null,p_review_id uuid default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare tenant uuid:=private.partner_booking_merchant(p_action is not null); m public.merchants; p public.merchant_store_profiles;
 r public.merchant_profile_reviews; current_profile jsonb; changes jsonb; place text;
begin
 select * into m from public.merchants where id=tenant;
 select * into p from public.merchant_store_profiles where merchant_id=tenant;
 if p_action is not null then
  if p_action not in ('update','request_review','cancel_review') or p_expected_updated_at is null or not isfinite(p_expected_updated_at) then raise exception 'INVALID_REQUEST'; end if;
  perform pg_advisory_xact_lock(hashtextextended(tenant::text,702020));
  if private.partner_booking_merchant(true)<>tenant then raise exception 'PARTNER_FORBIDDEN'; end if;
  select * into m from public.merchants where id=tenant for update;
  select * into p from public.merchant_store_profiles where merchant_id=tenant for update;
  if greatest(m.updated_at,p.updated_at)<>p_expected_updated_at then raise exception 'BOOKING_CONFLICT'; end if;
  current_profile:=private.store_profile_json(m,p);
  if p_action='update' then
   if p_review_id is not null or p_values is null or jsonb_typeof(p_values)<>'object' or
    (select count(*) from jsonb_object_keys(p_values))<>4 or not (p_values ?& array['contactPhone','contactEmail','englishOk','notice']) or
    jsonb_typeof(p_values->'contactPhone')<>'string' or length(p_values->>'contactPhone')>80 or
    ((p_values->>'contactPhone')<>'' and (p_values->>'contactPhone')!~ '^[0-9+(). -]+$') or
    jsonb_typeof(p_values->'contactEmail')<>'string' or length(p_values->>'contactEmail')>254 or
    ((p_values->>'contactEmail')<>'' and (p_values->>'contactEmail')!~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') or
    jsonb_typeof(p_values->'englishOk')<>'boolean' or jsonb_typeof(p_values->'notice')<>'string' or length(p_values->>'notice')>60 then raise exception 'INVALID_REQUEST'; end if;
   update public.merchants set contact_phone=p_values->>'contactPhone',contact_email=p_values->>'contactEmail' where id=tenant returning * into m;
   insert into public.merchant_store_profiles(merchant_id,english_ok,notice) values(tenant,(p_values->>'englishOk')::boolean,p_values->>'notice')
   on conflict(merchant_id) do update set english_ok=excluded.english_ok,notice=excluded.notice returning * into p;
  elsif p_action='request_review' then
   if p_review_id is not null or p_values is null or jsonb_typeof(p_values)<>'object' or
    (select count(*) from jsonb_object_keys(p_values))<>5 or not (p_values ?& array['nameKo','nameEn','address','introductionKo','introductionEn']) or
    jsonb_typeof(p_values->'nameKo')<>'string' or length(private.catalog_text(p_values->>'nameKo')) not between 1 and 120 or
    jsonb_typeof(p_values->'nameEn')<>'string' or length(p_values->>'nameEn')>120 or
    jsonb_typeof(p_values->'address')<>'string' or length(p_values->>'address')>500 or
    jsonb_typeof(p_values->'introductionKo')<>'string' or length(p_values->>'introductionKo')>4000 or
    jsonb_typeof(p_values->'introductionEn')<>'string' or length(p_values->>'introductionEn')>4000 then raise exception 'INVALID_REQUEST'; end if;
   select coalesce(jsonb_object_agg(key,value),'{}'::jsonb) into changes from jsonb_each(p_values) where value is distinct from current_profile->key;
   if changes='{}'::jsonb then raise exception 'INVALID_REQUEST'; end if;
   update public.merchant_profile_reviews set status='cancelled' where merchant_id=tenant and status='pending';
   insert into public.merchant_profile_reviews(merchant_id,fields,actor_id) values(tenant,changes,auth.uid());
   insert into public.merchant_store_profiles(merchant_id) values(tenant) on conflict(merchant_id) do update set updated_at=clock_timestamp() returning * into p;
  else
   if p_values is not null or p_review_id is null then raise exception 'INVALID_REQUEST'; end if;
   update public.merchant_profile_reviews set status='cancelled' where id=p_review_id and merchant_id=tenant and status='pending';
   if not found then raise exception 'PROFILE_REVIEW_NOT_FOUND'; end if;
   update public.merchant_store_profiles set updated_at=clock_timestamp() where merchant_id=tenant returning * into p;
  end if;
 elsif p_expected_updated_at is not null or p_values is not null or p_review_id is not null then raise exception 'INVALID_REQUEST';
 end if;
 select * into r from public.merchant_profile_reviews where merchant_id=tenant and status='pending';
 select place_id into place from public.merchant_publications where merchant_id=tenant and published;
 return jsonb_build_object('profile',private.store_profile_json(m,p),'placeId',place,
  'pendingReview',case when r.id is null then null else jsonb_build_object('id',r.id,'fields',r.fields,'createdAt',r.created_at,'updatedAt',r.updated_at) end);
end $$;

create or replace function private.booking_quote(s public.merchant_services, c public.merchant_categories, m public.merchants, p public.merchant_booking_settings)
returns text language sql stable set search_path='' as $$
 select md5(jsonb_build_array(s.id,s.updated_at,s.price_krw,s.duration_minutes,s.cleanup_minutes,s.name_en,s.description_en,c.name_en,c.updated_at,m.updated_at,p.confirmation_mode,p.payment_mode,p.updated_at,(select profile.updated_at from public.merchant_store_profiles profile where profile.merchant_id=m.id),
 (select coalesce(jsonb_agg(jsonb_build_array(st.id,st.updated_at) order by st.id),'[]'::jsonb)
  from public.merchant_staff st join public.merchant_staff_menus sm on sm.merchant_id=st.merchant_id and sm.staff_id=st.id
  where sm.merchant_id=s.merchant_id and sm.service_id=s.id and st.visibility='visible'))::text)
$$;

alter table public.merchant_store_profiles drop column show_photos;
delete from supabase_migrations.schema_migrations where version = '20261020123000';

do $verify$
declare
  fns regprocedure[] := '{"private.store_profile_json(public.merchants,public.merchant_store_profiles)","private.partner_store_profile(text,timestamptz,jsonb,uuid)","private.booking_quote(public.merchant_services,public.merchant_categories,public.merchants,public.merchant_booking_settings)"}';
  attrs jsonb;
begin
  if (select string_agg(p.proname||'='||md5(p.prosrc),',' order by p.proname) from pg_proc p where p.oid = any (fns))
     is distinct from 'booking_quote=c4b538c9f97e676a005dc82323de62e2,partner_store_profile=fad8cf13c2c00209bd5b2672a1796ed5,store_profile_json=11a705af62d2d67eb054feb684c110e1' then
    raise exception 'ROLLBACK_VERIFY: bodies are not the 20261019200212 bodies: %',
      (select string_agg(p.proname||'='||md5(p.prosrc),',' order by p.proname) from pg_proc p where p.oid = any (fns));
  end if;
  if exists (select 1 from pg_attribute where attrelid = 'public.merchant_store_profiles'::regclass and attname = 'show_photos' and not attisdropped) then
    raise exception 'ROLLBACK_VERIFY: show_photos still present';
  end if;
  select jsonb_agg(jsonb_build_object('fn', p.proname::text, 'owner', pg_get_userbyid(p.proowner)::text, 'secdef', p.prosecdef,
           'volatile', p.provolatile::text, 'config', to_jsonb(p.proconfig),
           'acl', (select jsonb_agg(a::text order by a::text collate "C") from unnest(p.proacl) a),
           'strict', p.proisstrict, 'parallel', p.proparallel::text, 'cost', p.procost,
           'lang', (select l.lanname::text from pg_language l where l.oid = p.prolang),
           'args', pg_get_function_arguments(p.oid), 'result', pg_get_function_result(p.oid)) order by p.proname)
    into attrs from pg_proc p where p.oid = any (fns);
  if attrs is distinct from current_setting('myseouldrop.rollback_attrs')::jsonb then
    raise exception 'ROLLBACK_VERIFY: function attributes changed: % (before: %)', attrs, current_setting('myseouldrop.rollback_attrs');
  end if;
  if (select count(*) from supabase_migrations.schema_migrations) <> 23
     or (select max(version) from supabase_migrations.schema_migrations) <> '20261019200901'
     or exists (select 1 from supabase_migrations.schema_migrations where version in ('20261020123000', '20260926083440')) then
    raise exception 'ROLLBACK_VERIFY: ledger is not back at 23 rows / head 20261019200901';
  end if;
end $verify$;
notify pgrst, 'reload schema';
commit;
```

## 부록 C. 스크립트

### C-1 `apply-show-photos.cjs` — ⚠ 운영 쓰기(`--production`)

```js
'use strict';
// 20261020123000_store_profile_show_photos 전용 적용기(2026-10-20 러너 기반). node apply-show-photos.cjs --rehearsal | --production
// --production 은 ⚠ 운영 쓰기다. c4-passed.json(같은 SQL로 C4를 통과한 표식)과 3시간 이내의 D0 백업이 있어야 시작한다.
// 종료 코드: 0 적용, 또는 검증을 통과한 skip(이미 원장에 있음). 1 커밋 전 실패(phase 로 위치 표시; phase=commit 이면 결과 미확정,
// phase=skip-verify 면 원장에는 있는데 상태가 이 러너가 남기는 상태와 다름). 3 커밋 뒤 보고용 점검 실패.
// 자격 증명은 메모리에서만 쓰고 출력하지 않는다.
const fs=require('node:fs'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const OPS='/Users/hanmyeong-gwan/myseouldrop-ops/show-photos',RUN=OPS+'/run',W=OPS+'/integrate';
const R='/Users/hanmyeong-gwan/mobile_design/.worktrees/service-quality-20261018';
const GUARDS_SHA256='4f1182ec2d8816260403b817830ed5096fe58e126e0504f639f8cc5a4f4d15a2';
const APP='myseouldrop-show-photos-apply';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const production=process.argv.includes('--production'),rehearsal=process.argv.includes('--rehearsal');
if(production===rehearsal)throw Error('Select exactly one target: --production or --rehearsal');
const target=production?'production':'rehearsal';
const manifest=JSON.parse(fs.readFileSync(RUN+'/release-migrations-20261021.json','utf8'));
assert.equal(manifest.source,W,'manifest source must be the integration clone');
assert.deepEqual(manifest.files.map(f=>f.version),['20261020123000'],'allowlist must hold exactly one version');
const guards=fs.readFileSync(RUN+'/apply-guards.sql','utf8');
assert.equal(sha(guards),GUARDS_SHA256,'apply-guards.sql changed after review');
const [,PRE_GUARD,SNAPSHOT,POST_GUARD,LEDGER_GUARD]=guards.split(/^-- ===== .*$/m);
assert.ok(PRE_GUARD.includes('share row exclusive')&&PRE_GUARD.includes('$pre$')&&SNAPSHOT.includes('regprocedure')&&POST_GUARD.includes('$post$')&&LEDGER_GUARD.includes('$ledger$'),'apply-guards.sql layout');
const file=manifest.files[0];
const sql=fs.readFileSync(W+'/supabase/migrations/'+file.name,'utf8');
assert.equal(sha(sql),file.sha256,'Source changed after review');
const {Client}=require(W+'/node_modules/pg');
let config;
if(production){
 const marker=JSON.parse(fs.readFileSync(RUN+'/c4-passed.json','utf8'));
 assert.equal(marker.migrationSha256,file.sha256,'C4 rehearsed a different migration');
 assert.equal(marker.guardsSha256,GUARDS_SHA256,'C4 rehearsed different guards');
 const backup=JSON.parse(fs.readFileSync(OPS+'/backup/backup-d1.json','utf8'));
 assert.equal(backup.toc.ok,true,'D0 backup archive check failed');
 for(const part of backup.files)assert.equal(sha(fs.readFileSync(part.path)),part.sha256,'D0 backup changed: '+part.path);
 assert.ok(Date.now()-Date.parse(backup.completedAt)<3*3600e3,'D0 backup is older than 3 hours; take a new one (D0)');
 const {processEnv}=require(W+'/node_modules/@next/env');
 const [,settings]=processEnv([{path:'.vercel/.env.production.local',contents:fs.readFileSync(R+'/.vercel/.env.production.local','utf8'),env:{}}],R,{info(){},error(){}});
 const u=new URL(settings.POSTGRES_URL_NON_POOLING||settings.POSTGRES_URL);
 if(!u.username.includes('njsocpyuesntblifpips')&&!u.hostname.includes('njsocpyuesntblifpips'))throw Error('Wrong production target');
 u.searchParams.delete('sslmode');
 config={connectionString:u.href,ssl:{rejectUnauthorized:true,ca:fs.readFileSync(OPS+'/ca/supabase-prod-ca-2021.crt','utf8')}};
}else{
 const name=fs.readFileSync(OPS+'/rehearsal-db-name','utf8').trim();
 if(!/^booking_release_rehearsal_[0-9]+$/.test(name))throw Error('Wrong rehearsal database');
 config={host:'127.0.0.1',port:54382,user:'postgres',password:process.env.REHEARSAL_PGPASSWORD||'postgres',database:name};
}
const client=new Client({...config,application_name:APP,connectionTimeoutMillis:10000,query_timeout:90000});
let phase='connect';
client.on('error',e=>console.error(JSON.stringify({target,phase,connectionError:e.code??null,message:e.message})));
const report={target,startedAt:new Date().toISOString()};
(async()=>{
 await client.connect();
 try{
  phase='precheck';
  if(production)assert.equal(client.connection.stream.authorized,true);
  await client.query(`set application_name = '${APP}'`);   // the startup parameter may not survive the pooler; this SET does
  const initial=(await client.query('select version from supabase_migrations.schema_migrations order by version')).rows.map(r=>r.version);
  assert.equal(initial.includes('20260926083440'),false,'Withheld migration must remain absent');
  let before,after;
  phase='transaction';
  await client.query('begin');
  try{
   await client.query("set local lock_timeout='3s'; set local statement_timeout='60s'; set local idle_in_transaction_session_timeout='30s'");
   await client.query("select pg_advisory_xact_lock(hashtext('myseouldrop-release-migrations'))");
   const exists=await client.query('select 1 from supabase_migrations.schema_migrations where version=$1',[file.version]);
   if(exists.rowCount>0){
    // Already in the ledger. Report skip only after proving the committed state is the one this runner leaves behind:
    // LEDGER_GUARD (24 rows, head = this version, withheld absent, the row holds the reviewed file) and POST_GUARD
    // (column, bodies, overloads, smoke). Nothing is written; function attributes are compared to the C1 golden by V3.
    phase='skip-verify';
    await client.query(LEDGER_GUARD);
    await client.query(POST_GUARD);
    await client.query('rollback');
    console.log(JSON.stringify({target,skip:file.name,verified:['LEDGER_GUARD','POST_GUARD']}));
    return;
   }
   await client.query(PRE_GUARD);   // takes the ledger and freeze-table locks, then checks under them
   before=(await client.query(SNAPSHOT)).rows;
   assert.equal(before.length,3,'snapshot must cover the three functions');
   await client.query(sql);
   await client.query(POST_GUARD);
   after=(await client.query(SNAPSHOT)).rows;
   assert.deepEqual(after,before,'function attributes changed (owner/security definer/volatility/config/ACL/strict/parallel/cost/language/arguments/result)');
   await client.query('insert into supabase_migrations.schema_migrations(version,name,statements) values($1,$2,$3)',[file.version,file.name.slice(file.version.length+1,-4),[sql]]);
   await client.query(LEDGER_GUARD);   // 24 rows, head = this version, and the row holds the reviewed file, before COMMIT
   // NOTIFY is transactional: it is delivered when COMMIT succeeds and dropped with a rollback, so no failure after
   // COMMIT can leave PostgREST without the reload.
   await client.query("notify pgrst, 'reload schema'");
   phase='commit';
   await client.query('commit');
  }catch(e){if(phase!=='commit')await client.query('rollback').catch(()=>{});throw e;}
  phase='post-commit';
  report.applied=[file.version];report.sha256=file.sha256;report.functions=after;report.committedAt=new Date().toISOString();
  console.log(JSON.stringify({target,applied:file.name}));
  // Reporting only: the migration is committed. A failure here is examined in E and never answered with a re-run.
  const checks={};
  try{
   const history=(await client.query('select version from supabase_migrations.schema_migrations order by version')).rows.map(r=>r.version);
   checks.ledgerRows=history.length;checks.targetPresent=history.includes(file.version);checks.withheldAbsent=!history.includes('20260926083440');
   const tables=await client.query("select relname,relrowsecurity from pg_class where relnamespace='public'::regnamespace and relkind='r' and (relname like 'merchant_%' or relname in ('merchants','customer_bookings','customer_booking_events','booking_messages','published_merchant_catalogs')) order by relname");
   checks.rlsTables=tables.rowCount;checks.allRls=tables.rows.every(t=>t.relrowsecurity);
   const bucket=await client.query("select public,file_size_limit,allowed_mime_types from storage.buckets where id='merchant-images'");
   checks.bucketOk=JSON.stringify(bucket.rows)===JSON.stringify([{public:false,file_size_limit:'5242880',allowed_mime_types:['image/webp']}]);
  }catch(e){checks.error=e.message;}
  report.postCommit=checks;
  report.postCommitOk=checks.targetPresent===true&&checks.withheldAbsent===true&&checks.rlsTables>=15&&checks.allRls===true&&checks.bucketOk===true;
  fs.writeFileSync(RUN+'/migrations-'+target+'-'+Date.now()+'.json',JSON.stringify(report,null,2)+'\n',{mode:0o600,flag:'wx'});
  console.log(JSON.stringify(report));
  if(!report.postCommitOk)process.exitCode=3;
 }finally{await client.end().catch(()=>{});}
})().catch(e=>{console.error(JSON.stringify({target,phase,error:e.code??null,message:e.message,detail:e.detail??null,where:e.where??null,hint:e.hint??null}));process.exitCode=1;});
```

### C-2 `backup-show-photos.cjs` (운영 읽기, pg_dump 17.6 in Docker, `verify-full`)

```js
'use strict';
// 운영 읽기 전용 백업(pg_dump 17.6 in Docker, sslmode verify-full). node backup-show-photos.cjs rehearsal|d1
// 개인정보가 담긴 행은 덤프하지 않는다. schema.dump = 6개 스키마의 구조(함수 정의·권한 포함),
// data.dump = supabase_migrations.schema_migrations 와 storage.buckets 의 행만. 복구 자료는 이것과 fn-defs.sql 출력이다.
// 결과: $OPS/backup/<label>/{schema,data}.dump(+ .toc.txt), $OPS/backup/backup-<label>.json. 어떤 파일도 덮어쓰지 않는다.
const fs=require('node:fs'),crypto=require('node:crypto'),{spawn,spawnSync}=require('node:child_process');
const OPS='/Users/hanmyeong-gwan/myseouldrop-ops/show-photos',W=OPS+'/integrate';
const R='/Users/hanmyeong-gwan/mobile_design/.worktrees/service-quality-20261018';
const C='supabase_db_partner-app-20261018-Io8Zlv';
const label=process.argv[2];
if(!/^(rehearsal|d1)$/.test(label||''))throw Error('usage: backup-show-photos.cjs rehearsal|d1');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const {processEnv}=require(W+'/node_modules/@next/env');
const [,settings]=processEnv([{path:'.vercel/.env.production.local',contents:fs.readFileSync(R+'/.vercel/.env.production.local','utf8'),env:{}}],R,{info(){},error(){}});
const dump=(args,env,fd)=>new Promise((ok,no)=>{
 const p=spawn('docker',args,{env,stdio:['ignore',fd,'pipe']});let err='';
 p.stderr.on('data',x=>{err+=x;});p.on('error',no);
 p.on('exit',code=>code?no(Error('pg_dump exited '+code+': '+err.slice(0,2000))):ok());
});
(async()=>{
 const u=new URL(settings.POSTGRES_URL_NON_POOLING||settings.POSTGRES_URL);
 if(!u.username.includes('njsocpyuesntblifpips')&&!u.hostname.includes('njsocpyuesntblifpips'))throw Error('Wrong DB target');
 const {address}=await new Promise((ok,no)=>require('node:dns').lookup(u.hostname,(e,address)=>e?no(e):ok({address})));
 const dir=OPS+'/backup/'+label;fs.mkdirSync(dir,{recursive:false,mode:0o700});
 const env={...process.env,PGHOST:u.hostname,PGHOSTADDR:address,PGPORT:u.port||'5432',PGUSER:decodeURIComponent(u.username),
  PGPASSWORD:decodeURIComponent(u.password),PGDATABASE:decodeURIComponent(u.pathname.slice(1)),PGSSLMODE:'verify-full',
  PGSSLROOTCERT:'/tmp/myseouldrop-prod-ca.crt',PGCONNECT_TIMEOUT:'10',PGAPPNAME:'myseouldrop-show-photos-backup'};
 const keys=['PGHOST','PGHOSTADDR','PGPORT','PGUSER','PGPASSWORD','PGDATABASE','PGSSLMODE','PGSSLROOTCERT','PGCONNECT_TIMEOUT','PGAPPNAME'];
 const base=['exec',...keys.flatMap(k=>['-e',k]),C,'pg_dump','--format=custom','--no-owner'];
 const parts=[
  {part:'schema',args:['--schema-only','--schema=public','--schema=private','--schema=review_internal','--schema=auth','--schema=storage','--schema=supabase_migrations']},
  {part:'data',args:['--data-only','--table=supabase_migrations.schema_migrations','--table=storage.buckets']},
 ];
 const files=[];
 for(const {part,args} of parts){
  const path=dir+'/'+part+'.dump',fd=fs.openSync(path,'wx',0o600);
  try{await dump([...base,...args],env,fd);}finally{fs.closeSync(fd);}
  const data=fs.readFileSync(path);files.push({part,path,bytes:data.length,sha256:sha(data)});
 }
 // Read the archive table of contents without copying the archive into the container: pg_restore -l reads stdin.
 const toc={};
 for(const f of files){
  const r=spawnSync('docker',['exec','-i',C,'pg_restore','-l'],{input:fs.readFileSync(f.path),maxBuffer:64<<20});
  if(r.status!==0)throw Error('pg_restore -l failed for '+f.part+': '+String(r.stderr).slice(0,500));
  fs.writeFileSync(dir+'/'+f.part+'.toc.txt',r.stdout,{mode:0o600,flag:'wx'});toc[f.part]=String(r.stdout);
 }
 const check={
  privateSchema:/ SCHEMA - private /.test(toc.schema),
  replacedFunctions:['store_profile_json','partner_store_profile','booking_quote'].every(n=>new RegExp(' FUNCTION private '+n+'\\(').test(toc.schema)),
  ledgerRows:/ TABLE DATA supabase_migrations schema_migrations /.test(toc.data),
  bucketRows:/ TABLE DATA storage buckets /.test(toc.data),
  noOtherRows:!/ TABLE DATA /.test(toc.schema)&&(toc.data.match(/ TABLE DATA /g)||[]).length===2,
 };
 const record={label,files,toc:{...check,ok:Object.values(check).every(Boolean)},completedAt:new Date().toISOString()};
 fs.writeFileSync(OPS+'/backup/backup-'+label+'.json',JSON.stringify(record,null,2)+'\n',{mode:0o600,flag:'wx'});
 console.log(JSON.stringify(record));
 if(!record.toc.ok)process.exitCode=2;
})().catch(e=>{console.error(e.message);process.exitCode=1;});
```

### C-3 `ro-sql.cjs` (읽기 전용 SQL 실행기)

```js
'use strict';
// 읽기 전용 SQL 실행기: node ro-sql.cjs --production|--rehearsal <file.sql> <out.json> [--set key=value]...
// 파일은 `-- @<id>` 줄로 시작하는 문장의 목록이다. 한 연결, 한 트랜잭션(repeatable read, read only, search_path='')에서
// 순서대로 실행하고 문장마다 결과를 남긴다. 오류가 나면 그 문장의 오류까지 기록하고 멈춘다(종료 코드 1, 출력 파일은 남는다).
// --set key=value 는 트랜잭션 안에서 myseouldrop.<key> 로 읽힌다. 출력 파일은 덮어쓰지 않는다. 자격 증명은 출력하지 않는다.
const fs=require('node:fs'),crypto=require('node:crypto');
const OPS='/Users/hanmyeong-gwan/myseouldrop-ops/show-photos',W=OPS+'/integrate';
const R='/Users/hanmyeong-gwan/mobile_design/.worktrees/service-quality-20261018';
const USAGE='usage: ro-sql.cjs --production|--rehearsal <file.sql> <out.json> [--set key=value]...';
const argv=process.argv.slice(2),sets=[],pos=[];
for(let i=0;i<argv.length;i++){
 const a=argv[i];
 if(a==='--set'){const m=/^([a-z_][a-z0-9_]*)=(.*)$/.exec(argv[++i]||'');if(!m)throw Error('bad --set; '+USAGE);sets.push([m[1],m[2]]);}
 else if(a==='--production'||a==='--rehearsal')continue;
 else if(a.startsWith('--'))throw Error('unknown option '+a+'; '+USAGE);
 else pos.push(a);
}
const production=argv.includes('--production'),rehearsal=argv.includes('--rehearsal');
if(production===rehearsal||pos.length!==2)throw Error(USAGE);
const [file,out]=pos;
if(fs.existsSync(out))throw Error('Output exists, choose a new name: '+out);
const text=fs.readFileSync(file,'utf8');
const parts=text.split(/^-- @([A-Za-z0-9_.=-]+)[ \t]*$/m);
if(parts.length<3)throw Error('No `-- @id` statements in '+file);
if(parts[0].split('\n').some(l=>l.trim()&&!l.trim().startsWith('--')))throw Error('SQL outside a `-- @id` block in '+file);
const statements=[];
for(let i=1;i<parts.length;i+=2)statements.push({id:parts[i],sql:parts[i+1].trim()});
if(new Set(statements.map(s=>s.id)).size!==statements.length||statements.some(s=>!s.sql))throw Error('Duplicate or empty statement id in '+file);
const {Client}=require(W+'/node_modules/pg');
let config,expectDb;
if(rehearsal){
 const name=fs.readFileSync(OPS+'/rehearsal-db-name','utf8').trim();
 if(!/^booking_release_rehearsal_[0-9]+$/.test(name))throw Error('Wrong rehearsal database');
 config={host:'127.0.0.1',port:54382,user:'postgres',password:process.env.REHEARSAL_PGPASSWORD||'postgres',database:name};expectDb=name;
}else{
 const {processEnv}=require(W+'/node_modules/@next/env');
 const [,s]=processEnv([{path:'.vercel/.env.production.local',contents:fs.readFileSync(R+'/.vercel/.env.production.local','utf8'),env:{}}],R,{info(){},error(){}});
 const u=new URL(s.POSTGRES_URL_NON_POOLING||s.POSTGRES_URL);
 if(!u.username.includes('njsocpyuesntblifpips')&&!u.hostname.includes('njsocpyuesntblifpips'))throw Error('Wrong production target');
 u.searchParams.delete('sslmode');
 config={connectionString:u.href,ssl:{rejectUnauthorized:true,ca:fs.readFileSync(OPS+'/ca/supabase-prod-ca-2021.crt','utf8')}};expectDb=decodeURIComponent(u.pathname.slice(1));
}
const c=new Client({...config,application_name:'myseouldrop-show-photos-ro',connectionTimeoutMillis:10000,query_timeout:60000,statement_timeout:15000,options:'-c default_transaction_read_only=on'});
c.on('error',()=>{});
const report={target:production?'production':'rehearsal',file,fileSha256:crypto.createHash('sha256').update(text).digest('hex'),
 statementIds:statements.map(s=>s.id),sets:Object.fromEntries(sets),startedAt:new Date().toISOString(),results:[],complete:false};
(async()=>{
 await c.connect();
 try{
  if(production&&c.connection.stream.authorized!==true)throw Error('TLS peer not verified');
  // The startup option can be dropped by the pooler; this SET cannot, and the checks below prove it took effect.
  await c.query("set application_name = 'myseouldrop-show-photos-ro'");
  await c.query('set session characteristics as transaction read only');
  const s=(await c.query("select current_database() as db, current_user as usr, current_setting('default_transaction_read_only') as ro")).rows[0];
  if(s.ro!=='on')throw Error('default_transaction_read_only is not on');
  if(s.db!==expectDb)throw Error('Connected to database '+s.db+', expected '+expectDb);
  report.db=s.db;report.user=s.usr;
  await c.query('begin isolation level repeatable read read only');
  if((await c.query("select current_setting('transaction_read_only') as ro")).rows[0].ro!=='on')throw Error('Transaction is not read only');
  await c.query("set local search_path = ''");
  for(const [k,v] of sets)await c.query('select set_config($1,$2,true)',['myseouldrop.'+k,v]);
  for(const st of statements){
   try{
    const r=await c.query(st.sql);
    if(Array.isArray(r))throw Object.assign(Error('More than one statement under @'+st.id),{code:'XXSPL'});
    report.results.push(r.command==='SELECT'?{id:st.id,rows:r.rows}:{id:st.id,command:r.command});
   }catch(e){report.results.push({id:st.id,error:{code:e.code??null,message:String(e.message),detail:e.detail??null,where:e.where??null}});break;}
  }
  report.complete=report.results.length===statements.length&&!report.results.some(x=>x.error);
 }finally{
  await c.query('rollback').catch(()=>{});await c.end().catch(()=>{});
  report.finishedAt=new Date().toISOString();
  fs.writeFileSync(out,JSON.stringify(report,null,1)+'\n',{mode:0o600,flag:'wx'});
 }
 for(const r of report.results)console.log(JSON.stringify(r.error?{id:r.id,error:r.error.code,message:r.error.message.split('\n')[0]}
  :r.rows?{id:r.id,rows:r.rows.length,ok:r.rows.some(x=>Object.hasOwn(x,'ok'))?r.rows.every(x=>x.ok===true):undefined}:{id:r.id,command:r.command}));
 console.log(JSON.stringify({target:report.target,db:report.db,complete:report.complete,out}));
 if(!report.complete)process.exitCode=1;
})().catch(e=>{console.error(JSON.stringify({code:e.code??null,message:String(e.message).split('\n')[0]}));process.exitCode=1;});
```

### C-4 `rollback-show-photos.cjs` — ⚠ 운영 쓰기(`--production`, 오너 승인)

이 계획에서 새로 작성했다. `node --check`로 문법을 확인했다. C4에서 `--rehearsal`로 음성 시험, 롤백, 재적용을 먼저 실행해 검증한다.

```js
'use strict';
// 20261020123000 비상 전체 롤백 실행기. node rollback-show-photos.cjs --rehearsal | --production
// --production 은 ⚠ 운영 쓰기: 오너 승인 뒤에만 실행한다. 진행 여부를 가르는 검사(원장·테이블 잠금, 원장 head, 사진 OFF 매장,
// 함수 속성, 롤백 뒤 원장 23행)는 모두 SQL 파일 안에서 COMMIT 전에 한다. 이 실행기는 파일을 고정하고 결과를 기록할 뿐이다.
// 자격 증명은 메모리에서만 쓰고 출력하지 않는다.
const fs=require('node:fs'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const OPS='/Users/hanmyeong-gwan/myseouldrop-ops/show-photos',RUN=OPS+'/run',W=OPS+'/integrate';
const R='/Users/hanmyeong-gwan/mobile_design/.worktrees/service-quality-20261018';
const APP='myseouldrop-show-photos-rollback';
const production=process.argv.includes('--production'),rehearsal=process.argv.includes('--rehearsal');
if(production===rehearsal)throw Error('Select exactly one target: --production or --rehearsal');
const target=production?'production':'rehearsal';
const sql=fs.readFileSync(RUN+'/rollback-20261020123000.sql','utf8');
assert.equal(crypto.createHash('sha256').update(sql).digest('hex'),'4f528decb7c291eed917358236f6d2aa5e453d208ec4237c0bb178d415892eab','Rollback SQL changed after review');
const {Client}=require(W+'/node_modules/pg');
let config;
if(production){
 const {processEnv}=require(W+'/node_modules/@next/env');
 const [,s]=processEnv([{path:'.vercel/.env.production.local',contents:fs.readFileSync(R+'/.vercel/.env.production.local','utf8'),env:{}}],R,{info(){},error(){}});
 const u=new URL(s.POSTGRES_URL_NON_POOLING||s.POSTGRES_URL);
 if(!u.username.includes('njsocpyuesntblifpips')&&!u.hostname.includes('njsocpyuesntblifpips'))throw Error('Wrong production target');
 u.searchParams.delete('sslmode');
 config={connectionString:u.href,ssl:{rejectUnauthorized:true,ca:fs.readFileSync(OPS+'/ca/supabase-prod-ca-2021.crt','utf8')}};
}else{
 const name=fs.readFileSync(OPS+'/rehearsal-db-name','utf8').trim();
 if(!/^booking_release_rehearsal_[0-9]+$/.test(name))throw Error('Wrong rehearsal database');
 config={host:'127.0.0.1',port:54382,user:'postgres',password:process.env.REHEARSAL_PGPASSWORD||'postgres',database:name};
}
const c=new Client({...config,application_name:APP,connectionTimeoutMillis:10000,query_timeout:90000});
let phase='connect';
c.on('error',e=>console.error(JSON.stringify({target,phase,connectionError:e.code??null,message:e.message})));
(async()=>{
 await c.connect();
 try{
  phase='precheck';
  if(production)assert.equal(c.connection.stream.authorized,true);
  await c.query(`set application_name = '${APP}'`);
  // One query: begin, lock, guards, bodies, drop, ledger delete, verify, notify, commit. On any error the server skips the
  // rest of the string and leaves the transaction aborted, so end it here. A lost connection in this phase = outcome unknown.
  phase='transaction';
  try{await c.query(sql);}catch(e){await c.query('rollback').catch(()=>{});throw e;}
  phase='post-commit';
  // Reporting only: the file already required 23 rows / head 20261019200901 before COMMIT.
  const r=(await c.query("select count(*)::int as n,max(version) as head,count(*) filter (where version='20261020123000')::int as target,count(*) filter (where version='20260926083440')::int as withheld from supabase_migrations.schema_migrations")).rows[0];
  const report={target,rolledBack:'20261020123000',ledger:r,completedAt:new Date().toISOString()};
  fs.writeFileSync(RUN+'/rollback-'+target+'-'+Date.now()+'.json',JSON.stringify(report,null,2)+'\n',{mode:0o600,flag:'wx'});
  console.log(JSON.stringify(report));
 }finally{await c.end().catch(()=>{});}
})().catch(e=>{console.error(JSON.stringify({target,phase,error:e.code??null,message:e.message,detail:e.detail??null,where:e.where??null}));process.exitCode=1;});
```

### C-5 `release-migrations-20261021.json`

```json
{
  "source": "/Users/hanmyeong-gwan/myseouldrop-ops/show-photos/integrate",
  "files": [
    {
      "version": "20261020123000",
      "name": "20261020123000_store_profile_show_photos.sql",
      "sha256": "22e132c52d2b67e941d0e1d9fd69cb6cb4de44b34f125603c71236356f4433a5"
    }
  ]
}
```

### C-6 `env.sh` (모든 호출의 첫 줄에서 `source`)

```sh
# MYSEOULDROP show_photos 릴리스 공통 환경(zsh, 비밀값 없음). 모든 Bash 호출의 첫 줄:
#   source /Users/hanmyeong-gwan/myseouldrop-ops/show-photos/env.sh
# 실행자(Claude 세션)의 Bash 도구는 호출마다 변수와 함수를 잃는다. 이 파일이 매 호출의 상태를 똑같이 다시 만든다.
# err_exit: 실패한 명령에서 멈춘다(&&·|| 목록 안의 실패는 예외이므로 가드는 `|| stop` 으로 쓴다).
# no_unset: 정의되지 않은 변수를 오류로 본다. pipe_fail: 파이프 중간의 실패도 실패로 본다.
setopt err_exit no_unset pipe_fail
umask 077
OPS=/Users/hanmyeong-gwan/myseouldrop-ops/show-photos            # 영구 보관(0700): 실행 파일, 증거, 백업, CA, Vercel 관리자 설정 사본
RUN=$OPS/run                                                      # 검토된 실행 파일과 증거 JSON
BK=$OPS/backup                                                    # 덤프(개인정보 없음: 스키마 + 원장·버킷 행)
W=$OPS/integrate                                                  # 통합용 클론(GitHub에서 새로 받는다. 공유 작업 트리와 git 디렉터리를 나누지 않는다)
R=/Users/hanmyeong-gwan/mobile_design/.worktrees/service-quality-20261018   # 기능 작업 트리(Codex 공유): 자격 증명 파일만 읽는다
PLAN=/Users/hanmyeong-gwan/mobile_design/.worktrees/service-quality-20261018/reports/operations/show-photos-release-20261021
CA=$OPS/ca/supabase-prod-ca-2021.crt
F=2d169309e6bb1fc8c2f004228132af98b4df9354                         # 기능 브랜치(2d16930 = e608426 + 화면 점검 수정 2커밋)
B=b26586bd65f894bf4eb54d0405add238b39d4c0d                         # GitHub main (A0에서 확인)
T=64bd96528c78dd718359146d85295145fd8f9800                         # 2d16930^{tree}
PREV_DPL=dpl_2ZEE7c1s3WdeyB5Et94e6bvxxAQb                          # b26586b 운영 배포(앱 롤백 기준)
REPO=Essenly-beauty/seoul-guide_v2
ORIGIN=https://myseouldrop.app
ALT=https://seoul-guide-v2.vercel.app
VTEAM=team_F8hIyOkJ9p0Bdyn44Phngi1a
VSCOPE=admin-28156576s-projects
VPRJ=prj_5eidC5l66Xu01vsVyJhpmv5H3qXf
P=ct-more-on-hair-seongsu-branch                                   # 점검용 장소(게시 안 됨, 사진 없음)
PH=ados-dakyo-nail-seongsu                                         # 사진 5장 장소(콜라주 3칸, +2, 라이트박스)
C=supabase_db_partner-app-20261018-Io8Zlv                          # 로컬 Docker(pg 17.6), 리허설 포트 54382
export GIT_SSH_COMMAND="ssh -F /dev/null -i $HOME/.ssh/id_ed25519_gksaudrhks12_sys -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes"
M=$(cat "$RUN/merge-sha" 2>/dev/null || true)                      # A1 뒤에만 값이 있다. ⚠ 명령 앞에서 ${M:?} 로 확인한다
MDPL=$(cat "$RUN/m-deployment-id" 2>/dev/null || true)             # B2 뒤에만 값이 있다
REL=${M[1,12]}                                                     # client_errors.release 는 SHA 앞 12자다
ghs() { GH_TOKEN="$(gh auth token --user gksaudrhks12-sys)" gh "$@"; }   # 활성 gh 계정(회사)은 그대로 두고 토큰은 출력하지 않는다
vadm() { (cd "$OPS" && vercel --global-config "$OPS/vercel-admin" --scope "$VSCOPE" "$@"); }   # 관리자 Vercel 계정. 기본 CLI 계정은 쓰지 않는다
rpsql() { PGPASSWORD="${REHEARSAL_PGPASSWORD:-postgres}" docker exec -i -e PGPASSWORD "$C" "$@"; }   # 로컬 리허설 DB 전용
stop() { print -u2 -r -- "STOP: $*"; exit 1; }
# 지금 운영 대상 배포: {id, readyState, sha, ref} (Vercel 프로젝트의 targets.production)
prod_state() { vadm api "/v9/projects/$VPRJ?teamId=$VTEAM" | jq -c '.targets.production | {id, readyState, sha: .meta.githubCommitSha, ref: .meta.githubCommitRef}'; }
# 운영 = M 단언: GitHub main, 프로젝트 운영 대상, 두 운영 도메인이 모두 M 배포(MDPL)를 가리켜야 한다.
# 주의: zsh 에서 "$M:..." 은 콜론 수식어로 해석된다. 콜론 앞 변수는 항상 ${M} 처럼 중괄호로 쓴다.
assert_prod_is_m() {
  : ${M:?A1 전이다} ${MDPL:?B2 전이다}
  test "$(git ls-remote "git@github.com:${REPO}.git" refs/heads/main | cut -f1)" = "$M" || stop "GitHub main 이 M 이 아니다"
  prod_state | jq -e --arg d "$MDPL" --arg m "$M" '.id == $d and .readyState == "READY" and .sha == $m and .ref == "main"' >/dev/null || stop "프로젝트 운영 대상이 M 배포가 아니다: $(prod_state)"
  for u in "$ORIGIN" "$ALT"; do
    vadm inspect "$u" --json | jq -e --arg d "$MDPL" '.id == $d and .target == "production" and .readyState == "READY"' >/dev/null || stop "$u 가 M 배포를 가리키지 않는다"
  done
}
```

### C-7 `check-results.cjs` (판정)

```js
'use strict';
// ro-sql.cjs 결과를 눈이 아니라 스크립트로 판정한다.
//   node check-results.cjs ok <result.json> [--target production|rehearsal] [--expect-error <id>=<SQLSTATE>[:<text>]]...
//     모든 문장이 실행됐고(기대한 오류 하나 제외), ok 열이 있는 행은 모두 ok=true 인지 본다.
//   node check-results.cjs same <golden.json> <other.json> <id | goldenId=otherId>...
//     두 결과 파일에서 같은 문장의 rows 가 정확히 같은지 본다(C1 골든 비교).
// 통과하면 PASS, 아니면 이유를 출력하고 종료 코드 1.
const fs=require('node:fs'),{isDeepStrictEqual}=require('node:util');
const [cmd,...rest]=process.argv.slice(2);
const load=p=>{const j=JSON.parse(fs.readFileSync(p,'utf8'));if(!Array.isArray(j.results)||!Array.isArray(j.statementIds))throw Error(p+': not a ro-sql.cjs result');return j;};
const fail=[];
if(cmd==='ok'){
 const file=rest[0],expected=new Map();let target=null;
 for(let i=1;i<rest.length;i++){
  if(rest[i]==='--target'){target=rest[++i];continue;}
  if(rest[i]!=='--expect-error')throw Error('unknown option '+rest[i]);
  const m=/^([^=]+)=([0-9A-Z]{5})(?::(.+))?$/.exec(rest[++i]||'');if(!m)throw Error('bad --expect-error');
  expected.set(m[1],{code:m[2],text:m[3]??null});
 }
 const j=load(file);
 console.log(`${file}: target=${j.target} db=${j.db} complete=${j.complete}`);
 if(target&&j.target!==target)fail.push(`target is ${j.target}, expected ${target}`);
 const ran=new Map(j.results.map(r=>[r.id,r]));
 for(const id of j.statementIds){
  const r=ran.get(id),e=expected.get(id);
  if(!r){fail.push(`${id}: never ran (an earlier statement failed)`);continue;}
  if(r.error){
   if(!e)fail.push(`${id}: unexpected error ${r.error.code} ${r.error.message}`);
   else if(r.error.code!==e.code||(e.text&&!r.error.message.includes(e.text)))fail.push(`${id}: expected ${e.code}${e.text?' '+e.text:''}, got ${r.error.code} ${r.error.message}`);
   else console.log(`${id}: expected error ${r.error.code} ${r.error.message}`);
   continue;
  }
  if(e){fail.push(`${id}: expected error ${e.code}, but the statement succeeded`);continue;}
  if(!r.rows){console.log(`${id}: ${r.command}`);continue;}
  const graded=r.rows.filter(x=>Object.hasOwn(x,'ok'));
  const bad=graded.filter(x=>x.ok!==true);
  if(bad.length)fail.push(`${id}: ok is not true in ${bad.length} row(s): ${JSON.stringify(bad)}`);
  else console.log(`${id}: ${r.rows.length} row(s)${graded.length?', ok':''}`);
 }
 for(const id of expected.keys())if(!j.statementIds.includes(id))fail.push(`${id}: no such statement in ${file}`);
}else if(cmd==='same'){
 const [g,o,...pairs]=rest;
 if(!g||!o||!pairs.length)throw Error('usage: check-results.cjs same <golden.json> <other.json> <id|goldenId=otherId>...');
 const G=load(g),O=load(o);
 console.log(`golden ${g}: target=${G.target} db=${G.db}; other ${o}: target=${O.target} db=${O.db}`);
 const gm=new Map(G.results.map(r=>[r.id,r])),om=new Map(O.results.map(r=>[r.id,r]));
 for(const p of pairs){
  const [gid,oid=gid]=p.split('=');const a=gm.get(gid),b=om.get(oid);
  if(!a||!b||a.error||b.error||!a.rows||!b.rows){fail.push(`${p}: missing, failed or not a SELECT in one of the files`);continue;}
  if(isDeepStrictEqual(a.rows,b.rows))console.log(`${p}: same`);
  else fail.push(`${p}: differs\n  golden: ${JSON.stringify(a.rows)}\n  other:  ${JSON.stringify(b.rows)}`);
 }
}else throw Error('usage: check-results.cjs ok|same ...');
if(fail.length){console.error('FAIL\n'+fail.join('\n'));process.exitCode=1;}else console.log('PASS');
```

### C-8 `cell-probe.cjs` (C4 전용, 로컬 리허설 DB)

```js
'use strict';
// C4 전용(로컬 리허설 DB, 운영과 무관): node cell-probe.cjs --expect=pre|post <out.json>
// 합성 매장·멤버십·게시를 만들어 RPC의 실제 응답을 받고(파트너 조회, M이 보내는 즉시 필드 저장, 공개 조회) 트랜잭션은 전부 롤백한다.
// 그 응답을 M과 main의 실제 파서(esbuild 번들)로 검사해 호환 표의 셀을 실행 증거로 남긴다.
//   --expect=pre  (적용 전): C 셀(M)과 A 셀(main) 모두 통과해야 한다.
//   --expect=post (적용 후): D 셀(M)은 통과, B 셀(main)은 실패해야 한다.
const fs=require('node:fs'),assert=require('node:assert/strict');
const OPS='/Users/hanmyeong-gwan/myseouldrop-ops/show-photos',RUN=OPS+'/run',W=OPS+'/integrate';
const args=process.argv.slice(2);
const expect=(args.find(a=>a.startsWith('--expect='))||'').slice('--expect='.length);
const out=args.find(a=>!a.startsWith('--'));
if(!['pre','post'].includes(expect)||!out)throw Error('usage: cell-probe.cjs --expect=pre|post <out.json>');
if(fs.existsSync(out))throw Error('Output exists, choose a new name: '+out);
const name=fs.readFileSync(OPS+'/rehearsal-db-name','utf8').trim();
if(!/^booking_release_rehearsal_[0-9]+$/.test(name))throw Error('Wrong rehearsal database');
const {Client}=require(W+'/node_modules/pg');
const parsers={M:require(RUN+'/probe/contracts-M.cjs'),main:require(RUN+'/probe/contracts-main.cjs')};
const ids={user:'b2000000-0000-4000-8000-000000000001',merchant:'b2000000-0000-4000-8000-000000000002'},place='show-photos-probe';
const c=new Client({host:'127.0.0.1',port:54382,user:'postgres',password:process.env.REHEARSAL_PGPASSWORD||'postgres',database:name,application_name:'myseouldrop-show-photos-probe'});
(async()=>{
 await c.connect();
 const seen={};
 try{
  await c.query('begin');
  assert.equal((await c.query('select current_database() as d')).rows[0].d,name);
  seen.showPhotosColumn=(await c.query("select count(*)::int as n from pg_attribute where attrelid='public.merchant_store_profiles'::regclass and attname='show_photos' and not attisdropped")).rows[0].n===1;
  await c.query("insert into auth.users(id,aud,role,email) values($1,'authenticated','authenticated','probe@show-photos.invalid')",[ids.user]);
  await c.query("insert into public.merchants(id,display_name,contact_phone,contact_email,address,status) values($1,'사진 스위치 점검 매장','02-000-0000','probe@show-photos.invalid','서울 성동구','active')",[ids.merchant]);
  await c.query('insert into public.merchant_memberships(merchant_id,user_id) values($1,$2)',[ids.merchant,ids.user]);
  await c.query("insert into public.merchant_store_profiles(merchant_id,name_en,english_ok,notice) values($1,'Show photos probe',true,'probe')",[ids.merchant]);
  await c.query('insert into public.merchant_publications(merchant_id,place_id,published) values($1,$2,true)',[ids.merchant,place]);
  await c.query("select set_config('request.jwt.claim.sub',$1,true)",[ids.user]);
  await c.query('set local role authenticated');
  seen.partnerGet=(await c.query('select public.partner_store_profile() as v')).rows[0].v;
  seen.publicGet=(await c.query('select public.public_store_profile($1) as v',[place])).rows[0].v;
  // The instant-field save M sends: storeInstantDraft carries showPhotos only when the server reported it (4 keys before, 5 after).
  seen.draft=parsers.M.storeInstantDraft(seen.partnerGet);
  seen.partnerSave=(await c.query("select public.partner_store_profile('update',$1::timestamptz,$2::jsonb) as v",
   [seen.partnerGet.profile.updatedAt,JSON.stringify(seen.draft)])).rows[0].v;
 }finally{await c.query('rollback').catch(()=>{});await c.end().catch(()=>{});}
 const verdict={};
 for(const [k,p] of Object.entries(parsers))verdict[k]={get:p.partnerStoreProfileSnapshot(seen.partnerGet),save:p.partnerStoreProfileSnapshot(seen.partnerSave),public:p.publicStoreProfile(seen.publicGet)};
 const want=expect==='pre'?{M:{get:true,save:true,public:true},main:{get:true,save:true,public:true}}
  :{M:{get:true,save:true,public:true},main:{get:false,save:false,public:false}};
 const report={expect,db:name,showPhotosColumn:seen.showPhotosColumn,profileKeys:Object.keys(seen.partnerGet.profile).length,
  draftKeys:Object.keys(seen.draft).length,verdict,want,responses:{partnerGet:seen.partnerGet,partnerSave:seen.partnerSave,publicGet:seen.publicGet},
  checkedAt:new Date().toISOString()};
 fs.writeFileSync(out,JSON.stringify(report,null,1)+'\n',{mode:0o600,flag:'wx'});
 assert.equal(seen.showPhotosColumn,expect==='post','show_photos column presence does not match --expect');
 assert.equal(report.profileKeys,expect==='pre'?10:11,'profile key count');
 assert.equal(report.draftKeys,expect==='pre'?4:5,'instant draft key count');
 assert.deepEqual(verdict,want,'cell verdict');
 console.log(JSON.stringify({expect,profileKeys:report.profileKeys,draftKeys:report.draftKeys,verdict,out}));
})().catch(e=>{console.error(JSON.stringify({code:e.code??null,message:e.message,detail:e.detail??null}));process.exitCode=1;});
```

### C-9 `headless-check.cjs` (헤드리스 점검, M 전용 표식 하드 단언)

```js
'use strict';
// 헤드리스 점검: node headless-check.cjs <base-url> <out.json> [--loops=N]
// M에만 있는 표식을 하드 단언한다(main b26586b 에서는 실패해야 정상). 하나라도 어긋나면 종료 코드 1.
// networkidle 은 기다리지 않는다. 가로 넘침은 scrollWidth 로 판정한다. 사용자 에이전트에 점검 표식을 붙여
// 이 트래픽이 client_errors·web_vitals 에서 구분되게 한다.
const fs=require('node:fs');
const OPS='/Users/hanmyeong-gwan/myseouldrop-ops/show-photos';
const {chromium}=require(OPS+'/integrate/node_modules/playwright');
const pos=process.argv.slice(2).filter(a=>!a.startsWith('--'));
const loops=Number((process.argv.find(a=>a.startsWith('--loops='))||'--loops=1').slice('--loops='.length));
const [base,out]=pos;
if(!/^https?:\/\/[^/]+$/.test(base||'')||!out||!(Number.isInteger(loops)&&loops>=1&&loops<=30))throw Error('usage: headless-check.cjs <base-url> <out.json> [--loops=N]');
if(fs.existsSync(out))throw Error('Output exists, choose a new name: '+out);
const P='ct-more-on-hair-seongsu-branch';   // 게시 안 됨, 사진 없음
const PH='ados-dakyo-nail-seongsu';         // 사진 5장: 콜라주 3칸 + "+2"
const TAG='myseouldrop-release-check/20261022';
const results=[];
const check=(loop,name,pass,detail)=>{results.push({loop,name,pass:pass===true,...(detail===undefined?{}:{detail})});};
const visible=locator=>locator.first().waitFor({state:'visible',timeout:20000}).then(()=>true,()=>false);
(async()=>{
 const browser=await chromium.launch();
 const startedAt=new Date().toISOString();
 try{
  const probe=await browser.newContext();const ua=await (await probe.newPage()).evaluate(()=>navigator.userAgent);await probe.close();
  for(let loop=1;loop<=loops;loop++){
   const context=await browser.newContext({viewport:{width:390,height:844},locale:'en-US',userAgent:ua+' '+TAG});
   const page=await context.newPage();
   const consoleErrors=[],api=[];
   page.on('console',m=>{if(m.type()==='error')consoleErrors.push({url:page.url(),text:m.text().slice(0,300)});});
   page.on('pageerror',e=>consoleErrors.push({url:page.url(),text:'pageerror: '+String(e.message).slice(0,300)}));
   page.on('response',r=>{const u=new URL(r.url());if(u.pathname.startsWith('/api/places/'))api.push({path:u.pathname,status:r.status()});});
   const overflow=()=>page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth);
   try{
    // 1. 사진 없는 미게시 장소: M 에는 Photos 탭·섹션이 없다(main 에는 있다).
    let res=await page.goto(base+'/place/'+P,{waitUntil:'domcontentloaded'});
    check(loop,'place:http-200',res?.status()===200,res?.status());
    check(loop,'place:heading',await visible(page.locator('h1')));
    check(loop,'place:no-photos-section',await page.locator('#d-photos').count()===0);
    check(loop,'place:no-photos-anchor-tab',await page.locator('nav.anchortabs button').filter({hasText:/^Photos$/}).count()===0);
    check(loop,'place:empty-photo-state',await visible(page.locator('.place-photo-empty')));
    check(loop,'place:no-horizontal-overflow',await overflow());
    // 2. 사진 5장 장소: 사진 헤더 콜라주 3칸, "+2", 타일을 누르면 라이트박스, 닫기 버튼으로 닫힘.
    res=await page.goto(base+'/place/'+PH,{waitUntil:'domcontentloaded'});
    check(loop,'photos:http-200',res?.status()===200,res?.status());
    const collage=page.locator('.place-photo-collage.layout-three');
    check(loop,'photos:collage-three',await visible(collage));
    check(loop,'photos:more-badge-plus-2',(await page.locator('.place-photo-more').first().textContent({timeout:10000}).catch(()=>null))?.trim()==='+2');
    check(loop,'photos:no-photos-section',await page.locator('#d-photos').count()===0);
    await collage.first().locator('button').first().click({timeout:10000}).catch(()=>{});
    const lightbox=page.locator('.photo-lightbox[role="dialog"]');
    check(loop,'photos:lightbox-opens',await visible(lightbox));
    await page.locator('.photo-lightbox button[aria-label="Close photos"]').first().click({timeout:10000}).catch(()=>{});
    check(loop,'photos:lightbox-closes',await lightbox.first().waitFor({state:'hidden',timeout:10000}).then(()=>true,()=>false));
    check(loop,'photos:no-horizontal-overflow',await overflow());
    const placeErrors=consoleErrors.filter(e=>e.url.includes('/place/'));
    check(loop,'place-pages:no-console-errors',placeErrors.length===0,placeErrors);
    // 3. 비회원 화면: M 의 저장 목록 안내 문구(main 에는 없다), 예약·관리자 로그인 게이트.
    await page.goto(base+'/favorites',{waitUntil:'domcontentloaded'});
    check(loop,'favorites:guest-copy',await visible(page.getByText('Sign in to save places — hearts are kept on your account.',{exact:true})));
    await page.goto(base+'/bookings',{waitUntil:'domcontentloaded'});
    check(loop,'bookings:sign-in-gate',await visible(page.getByText('Sign in to view and manage your appointments.')));
    await page.goto(base+'/partner',{waitUntil:'domcontentloaded'});
    check(loop,'partner:sign-in-gate',await visible(page.getByText('가맹점 계정으로 로그인해 주세요')));
    // 4. 지도 핀 선택: M 은 공개 프로필·사진을 한 번 읽고 60초 동안 다시 읽지 않는다(main 은 읽지 않는다).
    api.length=0;
    await page.goto(base+'/map?place='+PH,{waitUntil:'domcontentloaded'});
    check(loop,'map:sheet-open',await visible(page.locator('.mapsheet.has-selection')));
    await page.waitForTimeout(8000);
    const profile=api.filter(a=>a.path==='/api/places/'+PH+'/profile'),media=api.filter(a=>a.path==='/api/places/'+PH+'/media');
    check(loop,'map:profile-read-200',profile.length>=1&&profile.every(a=>a.status===200),profile);
    check(loop,'map:media-read-200',media.length>=1&&media.every(a=>a.status===200),media);
    check(loop,'map:no-rapid-rereads',profile.length<=2&&media.length<=2,{profile:profile.length,media:media.length});
    check(loop,'map:no-horizontal-overflow',await overflow());
    // 5. 랭킹 → 상품 상세: 상품 사진은 잘리지 않는다(contain).
    await page.goto(base+'/ranking',{waitUntil:'domcontentloaded'});
    const link=page.locator('a[href^="/shop/"]:not([href^="/shop/daiso"]):not([href="/shop/routine-filter"])').first();
    const href=await link.waitFor({timeout:20000}).then(()=>link.getAttribute('href'),()=>null);
    let fit=null;
    if(href){
     await page.goto(base+href,{waitUntil:'domcontentloaded'});
     const img=page.locator('.product-detail-gallery img').first();
     fit=await img.waitFor({timeout:15000}).then(()=>img.evaluate(e=>getComputedStyle(e).objectFit),()=>null);
    }
    check(loop,'product:hero-contain',fit==='contain',{href,fit});
   }catch(e){check(loop,'run:exception',false,String(e.message).slice(0,300));}
   check(loop,'info:console-errors-all-pages',true,consoleErrors);
   await context.close();
  }
 }finally{await browser.close();}
 const failed=results.filter(r=>!r.pass);
 fs.writeFileSync(out,JSON.stringify({base,loops,tag:TAG,startedAt,finishedAt:new Date().toISOString(),failed:failed.length,results},null,1)+'\n',{mode:0o600,flag:'wx'});
 for(const r of failed)console.log(JSON.stringify(r));
 console.log(JSON.stringify({base,loops,checks:results.length,failed:failed.length,out}));
 if(failed.length)process.exitCode=1;
})().catch(e=>{console.error(String(e.message).slice(0,500));process.exitCode=1;});
```

### C-10 `rehearsal-pg.cjs` (리허설 전용 preload)

```js
'use strict';
// 리허설 전용 preload: (cd $W && BOOKING_TEST_DB_PORT=54382 node -r $RUN/rehearsal-pg.cjs scripts/test-*.cjs)
// 통합 클론($W)의 pg 만 패치한다. 테스트 스크립트의 연결(127.0.0.1:54382/postgres)만 허용하고 대상 DB를 리허설 DB로 바꾼다.
const fs=require('node:fs');
const OPS='/Users/hanmyeong-gwan/myseouldrop-ops/show-photos';
const pgPath=require.resolve('pg',{paths:[process.cwd()]});
if(!pgPath.startsWith(OPS+'/integrate/node_modules/'))throw Error('Run the test scripts from the integration clone, not '+pgPath);
const name=fs.readFileSync(OPS+'/rehearsal-db-name','utf8').trim();
if(!/^booking_release_rehearsal_[0-9]+$/.test(name))throw Error('Invalid rehearsal target');
const pg=require(pgPath);
const Original=pg.Client;
pg.Client=class extends Original{constructor(options){
 if(!options||options.host!=='127.0.0.1'||options.port!==54382||options.database!=='postgres')throw Error('Only isolated local test connections allowed');
 super({...options,database:name,application_name:'myseouldrop-show-photos-test'});
}};
```

### C-11 `check-restore-errors.cjs` (C4-1 복원 오류 판정)

10-22에 Codex 검토(C4-1의 `|| true`와 좁은 grep)를 반영해 새로 작성했다. 허용 목록은 부록 D의 로컬 복원에서 나온 두 종류뿐이다. 실제 오류 파일(통과), 대상 함수 오류·publication 오류·`FOR ROLE postgres` 기본 권한 오류·HINT 줄이 붙은 블록(모두 실패), 빈 파일(통과)로 시험했다.

```js
'use strict';
// C4-1 전용: pg_restore 의 stderr 파일을 오류 블록 단위로 읽고, 허용 목록에 없는 블록이 하나라도 있으면 종료 코드 1로 멈춘다.
// 허용 목록에는 비교 대상(public·private·supabase_migrations 의 객체, storage.buckets, 대상 함수가 쓰는 auth 함수)과 무관하고
// 리허설 결과를 바꾸지 않는 오류만 둔다. 2026-10-22 로컬 Supabase(PostgreSQL 17.6)에서 같은 pg_dump 옵션으로 만든 덤프를
// 새 DB에 복원해 나온 두 종류다. 목록 밖의 블록이 나오면 계획 C4-1 아래의 절차대로 판단한다(자동으로 넓히지 않는다).
// 사용: node check-restore-errors.cjs <stderr 파일>...
const fs=require('node:fs');
const ALLOW=[
 // 새 DB에도 public 스키마가 이미 있다.
 {why:'public schema exists',error:/^ERROR:  schema "public" already exists$/,command:/^CREATE SCHEMA public;$/},
 // postgres 는 Supabase 관리 역할이 '앞으로 만들' 객체의 기본 권한을 바꿀 수 없다. 이미 있는 객체의 GRANT 는 따로 복원된다.
 {why:'default privileges of Supabase-managed roles',error:/^ERROR:  permission denied to change default privileges$/,
  command:/^(?:ALTER DEFAULT PRIVILEGES FOR ROLE (?:supabase_admin|supabase_auth_admin|supabase_storage_admin) IN SCHEMA (?:public|auth|storage) GRANT ALL ON (?:TABLES|SEQUENCES|FUNCTIONS) TO [a-z_]+;\n?)+$/},
];
const counts=Object.fromEntries(ALLOW.map(a=>[a.why,0])),bad=[];
for(const file of process.argv.slice(2)){
 for(const block of fs.readFileSync(file,'utf8').split(/\n(?=pg_restore: )/).map(b=>b.trim()).filter(Boolean)){
  if(/^pg_restore: warning: errors ignored on restore: \d+$/.test(block))continue;
  const m=block.match(/^pg_restore: error: could not execute query: (ERROR: [^\n]*)\nCommand was: ([\s\S]*)$/);
  const hit=m&&ALLOW.find(a=>a.error.test(m[1])&&a.command.test(m[2].trim()));
  if(hit)counts[hit.why]++;else bad.push(file+'\n'+block);
 }
}
console.log(JSON.stringify({allowed:counts,notAllowed:bad.length}));
if(bad.length){console.error(bad.join('\n\n'));process.exitCode=1;}
```

## 부록 D. 적용·롤백 도구 로컬 시험 (2026-10-22)

10-22 개정에서 바꾼 적용·롤백 도구를 운영과 무관한 임시 로컬 Supabase에서 실행했다. 시험이 끝난 뒤 스택은 지웠다. 기록은 `show-photos-release-20261021/selftest-20261022/`에 있다(`environment.txt`, `drive.zsh`, `results.txt`, `restore-*.err`, `test-copy-diff.txt`). 이 폴더는 실행 파일이 아니므로 A0에서 복사하지 않는다.

**환경**
- Supabase CLI 2.115.0, `public.ecr.aws/supabase/postgres:17.6.1.159`(PostgreSQL 17.6), 포트 545xx. QA 스택(54381/54382)과는 무관하다.
- 마이그레이션은 저장소의 23개다. 대상(`20261020123000`)과 보류(`20260926083440`)를 뺐으므로 운영 원장(23행, head `20261019200901`)과 같은 상태다.
- C4-1과 같은 방법으로 리허설 DB를 만들었다. `backup-show-photos.cjs`와 같은 pg_dump 옵션으로 덤프하고, `create database booking_release_rehearsal_<epoch>` 뒤 `pg_restore --no-owner`로 복원했다.
- 실행기 사본은 릴리스 파일과 세 가지만 다르다: `OPS` 경로, 리허설 포트(54382 → 54522), 매니페스트의 source 경로. `apply-guards.sql`과 롤백 SQL은 그대로 썼다. 실행기가 sha256 고정값 검사를 통과했다.

**결과: 10개 시나리오, 19개 확인 모두 통과**

| 시나리오 | 확인한 것 |
|---|---|
| T7 동결 위반 | 매장 행 1개가 있으면 PRE_GUARD가 `the onboarding freeze was broken (… = {1,0,0,0,0})`로 멈추고 원장은 23행 그대로다 |
| T8 원장 잠금(적용) | 다른 세션이 원장에 ROW EXCLUSIVE(INSERT가 잡는 잠금)를 쥐고 있으면 적용기가 55P03으로 멈추고 원장은 그대로다 |
| T9 동결 테이블 잠금 | `customer_bookings`에 쓰는 세션이 있으면 55P03으로 멈춘다 |
| T1 적용 | `applied`, `postCommitOk: true`(RLS 테이블 20, 버킷 설정 일치). 원장 24행, head `20261020123000` |
| T2 재실행 | `"verified":["LEDGER_GUARD","POST_GUARD"]`가 붙은 skip |
| T3 원장 행 변조 | statements 끝에 공백 한 칸을 더하면 skip 검증이 `LEDGER_GUARD: the 20261020123000 ledger row …`로 실패한다(`phase=skip-verify`) |
| T4 열 정의 변경 | `show_photos`의 기본값을 지우면 skip 검증이 `POST_GUARD: show_photos definition mismatch`로 실패한다. 되돌리면 다시 skip |
| T5 롤백 음성 | 원장 head가 대상이 아니면 롤백이 `is not the ledger head`로 거부된다 |
| T5b 원장 잠금(롤백) | 원장에 쓰는 세션이 있으면 롤백이 55P03으로 멈추고 원장은 24행 그대로다 |
| T6 롤백 | 23행, head `20261019200901`, 열 없음 |
| T10 재적용 | 다시 `applied`, 그다음 재실행은 검증된 skip |

**복원 오류.** 스키마 복원에서 오류 블록 7개가 나왔다. `public` 스키마 중복 1개와 Supabase 관리 역할의 기본 권한 변경 거부 6개다. 데이터 복원은 오류가 0개다. 이 두 종류가 `check-restore-errors.cjs`의 허용 목록이다.

**한계.**
- 로컬 Supabase의 역할·확장·auth·storage 구성은 운영과 다를 수 있다. 그래서 운영 덤프의 복원 오류는 C4-1에서 다시 판정한다.
- 잠금 시험은 잠금이 걸리는지만 확인했다. 운영 트래픽에서의 대기 시간은 확인하지 않았다.
- 비교 기준은 C1 골든이 아니라 같은 마이그레이션 파일이다. 운영 골든과의 비교는 C4가 한다.
