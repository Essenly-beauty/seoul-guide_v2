# 공유목록 접근 제한 릴리즈 준비 — 2026-09-27

## 현재 상태

- **운영 위험은 아직 해소되지 않았다.** 운영 Supabase 공개 키로 `shared_lists`의 ID 조건 없는 `HEAD`/정확한 건수 조회가 `200`, 1건으로 응답했다. 행 본문이나 소유자 정보는 읽지 않았다.
- 기존 `supabase/migrations/0006_shared_lists.sql`의 `shared_lists_select_any`는 `anon, authenticated`에 `using (true)`를 허용한다. 링크 UUID를 모르는 사람도 테이블을 나열할 수 있는 권한이다.
- 회원·수신자 로그인, 서버의 단일 UUID 조회, 소유자 전용 목록 관리, 비회원 리뷰 비공개 처리, RLS 제한 마이그레이션은 `release/member-guest-shared-main-integration-20260927`에 통합했다. **운영 앱 배포 및 DB 마이그레이션은 아직 하지 않았다.**
- 기존 공유 링크 1건은 삭제하거나 ID를 바꾸지 않는다. 현재 저장 장소가 공개 카탈로그에서 표시되지 않는다는 이전 운영 점검 결과는 별도로 안내해야 한다.

## 통합 검증

- 최신 `main`의 지도·로고·설치 안내 변경과 충돌한 6개 파일을 통합했다. 회원·공유 동선과 최신 지도 동작을 함께 보존했다.
- `npm test`: 108개 파일, 1,023개 테스트 통과.
- `npm run typecheck`, `npm run lint`, `npm run build`: 통과. 빌드에 `/api/shared-lists/[id]` 경로가 포함된다.
- 격리된 로컬 프로덕션 서버에서 비회원 `GET /api/shared-lists/{uuid}`는 `401`, 일반 `/map?list={uuid}` 문서는 `200`이었다.
- 화면 E2E 3건은 Chrome 프로세스가 실행 직후 `SIGABRT`로 종료되어 **실행되지 않았다**. 앱 기능 실패로 분류하지 않는다. 다른 실행 환경에서 재실행해야 한다.
- SQL 정책 테스트 `supabase/tests/shared_lists_rls.test.sql`은 코드에 있으나 운영 DB에서 실행하지 않았다.

## 적용 전 게이트

1. Supabase Dashboard의 Database Settings → SSL Configuration에서 해당 프로젝트의 서버 루트 인증서를 받아 검증 가능한 DB 접속을 준비한다. 현재 연결 문자열의 pooler 인증서 체인이 이 실행 환경에서 검증되지 않아, 인증서 검증을 끄고 SQL을 실행하지 않았다. [Supabase 연결·SSL 안내](https://supabase.com/docs/guides/database/connecting-to-postgres).
2. 격리 브랜치의 배포 환경에 서버 전용 `SUPABASE_SERVICE_ROLE_KEY`가 설정됐는지 **값을 노출하지 않고** 확인한다. 이 키가 없으면 로그인 수신자도 `503`을 받는다.
3. 미리보기 환경에서 로그인한 소유자의 링크 생성·목록·폐기, 로그인한 수신자의 정확한 링크 열기, 비회원 로그인 유도, 일반 비회원 지도 탐색, 리뷰 비공개 저장을 실제 브라우저에서 검증한다. 테스트용 새 링크는 테스트 데이터임을 기록하고 정리한다.
4. 앱 코드를 먼저 배포하고 로그인한 수신자의 기존 링크 조회가 성공하는지 확인한다. 이어서 `20260926072412_widen_place_ids_for_account_storage.sql`의 적용 여부와 스키마를 확인하고, `20260926083440_lock_down_shared_lists.sql`을 적용한다. 새 API가 준비되기 전에 공개 SELECT만 차단하면 기존 수신 링크가 깨진다.
5. 적용 직후 익명 직접 조회 거부, 소유자만 목록·폐기 가능, 수신자는 URL로 지정한 목록만 열람 가능, 폐기 링크 `404`, 기존 링크 ID 보존을 확인한다. 실패 시 정책 변경을 임의로 되돌리기 전에 데이터·권한 상태와 사용자 영향부터 확인한다.

`TO authenticated`만으로 행 소유권이 보장되지는 않는다. 직접 테이블 SELECT에는 `auth.uid() = owner`가 필요하고, 수신자의 공유 링크는 로그인 검사 뒤 서버에서 정확한 UUID 하나만 조회하도록 분리했다. [Supabase RLS 안내](https://supabase.com/docs/guides/database/postgres/row-level-security).
