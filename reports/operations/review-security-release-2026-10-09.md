# 로그인 리뷰 및 DB 보안 릴리즈 — 2026-10-09

## 범위와 확정 정책

- 장소 검색·상세·길찾기·기기 내 저장은 비회원 유지.
- 별점과 리뷰는 로그인 후 하나의 작성 화면에서 저장. 별점만 저장 가능.
- 공개 동의 기본값은 꺼짐. 기존 비공개 리뷰를 공개로 전환하지 않음.
- 공개 작성자 기본 표시는 `User`. 인증 사용자 메타데이터를 공개 뷰에서 조회하지 않음.
- 이미지, 상품 랭킹 수집, 카페 조사 등 다른 작업은 변경하지 않음.

## 구현 및 검증

- UI/저장 로직: `ae02c37`; 로그아웃 뒤 지연된 getUser 응답 무효화: `cb563db`.
- 전체 Vitest 102개 파일, 972개 테스트 통과. typecheck 및 lint 통과.
- 로컬 PostgreSQL(PGlite) 역할별 통합 검사 24개 통과: 로그인 사용자 upsert, 소유권 이전 거절, 타 사용자 변경 차단, 비회원 작성 차단, 공개/비공개 전환, 신고 3건 자동 숨김, 삭제 동기화.
- 운영 DB에 트랜잭션 내부 적용 → 복구 SQL 실행 → 원본 비교 → 전체 ROLLBACK 리허설 성공.
- 운영 migration `20261009052244_secure_public_review_projection` 적용 완료. 원본 리뷰 3건/신고 0건의 모든 값 유지 확인.
- 적용 후 실제 익명 REST 요청: 공개 뷰/공개 projection HTTP 200, 원본 id 조회 0건, 원본 본문 조회 HTTP 401(42501).
- 운영 DB에서 authenticated/anon 역할로 upsert·소유권 표시·비공개 전환 검증 통과. 이 검사는 트랜잭션 전체를 되돌려 가상 리뷰가 저장되거나 다른 연결에 공개되지 않도록 수행. 실제 브라우저 로그인 검증을 대체하지 않음.
- Supabase Security Advisors 재실행: 공개 뷰의 Auth Users 노출 및 Security Definer View 오류 모두 사라짐. 오류 0개, 기존 경고 2개(`touch_updated_at` search_path, `web_vitals` 익명 INSERT 정책)는 별도 운영 보완 과제로 남음. 이번 변경을 전체 DB 보안 감사 완료로 간주하지 않음.

## DB 구조

`ratings`(본인 원본, RLS) → 내부 트리거 → `published_reviews`(공개 허용 필드만) → `public_reviews`(security_invoker 뷰).

- projection에는 사용자 UUID·이메일·인증 메타데이터 없음. 원본 리뷰의 공개 동의, 숨김, 본문 유무를 반영.
- 클라이언트는 projection을 수정할 수 없음. 소유자 표시 `mine`만 원본의 소유자 RLS 아래 계산.
- 일반 사용자의 `hidden` 수정 및 TRUNCATE 등 불필요한 테이블 권한 제거.
- 신고는 로그인 사용자 INSERT만 허용. 기존 자동 숨김 트리거 함수의 API 직접 실행 권한 제거.
- 내부 동기화 함수는 API 미노출 스키마에 두고 schema usage/EXECUTE 차단. 관리자의 숨김 변경 및 계정 삭제도 처리해야 하므로 JWT 존재 여부 대신 원본 쓰기 권한/RLS 및 트리거 전용 호출을 권한 경계로 사용.

## 백업 및 복구 한계

- 원본/기존 뷰/권한 스냅샷과 rollback SQL은 작업 트리의 `scripts/.cache/private-review-backups/`에 로컬 저장. 폴더 0700, 파일 0600, Git 제외.
- 이번 변경 범위의 백업이며 전체 DB·Auth·Storage 재해 복구 백업이 아님. 컴퓨터/작업 트리를 삭제하면 없어지므로 별도 암호화 보관과 정기 전체 백업 구축은 남은 운영 과제.
- DB rollback은 기존 취약한 권한과 뷰를 복원하므로 운영 장애 때만 검토. 원본 리뷰는 변경하거나 삭제하지 않음.
- Vercel 앱 롤백과 DB 롤백은 별개. 구버전 앱도 새 공개 뷰의 동일 컬럼을 사용할 수 있음.

## 재검증 명령

```sh
npm test
npm run typecheck
npm run lint
PGLITE_MODULE=/absolute/path/to/@electric-sql/pglite node scripts/test-review-db.cjs
```

PGlite는 이번에 별도 임시 디렉터리에 설치했으며 앱 의존성은 변경하지 않음. DB 작업 스크립트는 환경 파일을 메모리에서 읽고 인증서를 검증하며 자격증명/원본 행을 출력하지 않음. `apply-review-security.cjs`의 기본 모드는 변경을 커밋하지 않는 복구 리허설이며 `--apply`만 실제 적용. 이미 적용한 migration을 재실행하지 말 것.

## 아직 완료로 표시하지 않은 항목

- 실제 사용자 로그인 후 브라우저 저장/새로고침/재로그인 확인: 테스트 계정 로그인 대기.
- 변경 커밋의 main 반영 및 production 앱 배포: 로그인 브라우저 검증 전 보류. DB migration만 운영 적용한 상태. 리뷰 브랜치는 원격 push됨.
- 실제 iPhone 홈 화면/PWA 확인: 별도 실기기 확인 필요.

## 프리뷰와 재개 지점

- 프리뷰: https://seoul-guide-v2-git-feat-review-d938db-admin-28156576s-projects.vercel.app/
- 실제 Supabase 환경으로 비회원 장소 상세와 공개 리뷰 빈 상태가 정상 표시되고, 별점 클릭 시 로그인 안내가 뜨며 별점은 0으로 유지됨을 Chrome에서 확인.
- 사용자에게 위 프리뷰의 `/login?next=%2Fmenu`를 열어 로그인 요청함. 비밀번호 전달이나 기존 계정 비밀번호 변경은 요청하지 않음.
- 로그인 후 비공개 별점/글 저장 → 새로고침 → 내 리뷰 → 로그아웃 차단을 확인한다. 가상 리뷰를 공개 게시하지 말 것. 기존 개인 리뷰를 덮어쓰지 않도록 테스트 대상부터 확인한다.
- 이후 main을 fetch하여 기존 타 세션 변경 보존 → 검증된 리뷰 브랜치 반영 → Vercel production READY/커밋/라이브 동선 확인.
- 로컬 Vercel CLI 60.1.3은 오래된 버전이며 업데이트 권장(`npm i -g vercel@latest`). 이번에는 기존 Git 연동 프리뷰를 사용했고 전역 CLI를 변경하지 않음.
