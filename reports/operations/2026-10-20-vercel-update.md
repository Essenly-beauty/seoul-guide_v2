# Vercel 업데이트 준비 및 배포 권한 확인 — 2026-10-20

## 최종 업데이트 — GitHub main 및 공식 도메인 자동 배포 완료

2026-10-20 03:06 UTC에 GitHub main 반영, 자동 배포 및 공식 도메인 점검까지 완료했다. 아래 직접 배포/인증 대기 기록은 이전 이력이다.

- 공식 서비스 **https://myseouldrop.app**, 로그인 `/login?next=/menu`, 관리자 `/partner`. 기존 https://seoul-guide-v2.vercel.app 도 동일 배포이며 www는 공식 루트로 리디렉션된다.
- GitHub main 및 운영 SHA **`8130d1a5b265c8f71192176c3346356794016898`**. 기존 main 이력을 보존한 일반 push로 반영했다.
- 운영 **`dpl_J3rNWSmgyJendHmeZCoBDVWaFYen`, READY, source=git, branch=main**. Vercel inspect에서 공식 주소들이 이 배포의 aliases임을 확인했다.
- GitHub CI **174개 파일 / 2,241개 테스트, typecheck, lint, 프로덕션 빌드 모두 성공**. [실행 기록](https://github.com/Essenly-beauty/seoul-guide_v2/actions/runs/39362035781).
- 공식 도메인에서 화면/API **11개**, 초기 JS 자산 **13개** 점검 통과. 대체 도메인 두 개도200. 브라우저 시각·터치 검증을 새로 수행했다는 의미는 아니다.
- 앱 코드는 앞서 검증한 `dc30b07` 배포와 같다. Git 자동 검증의 Node 버전을24로 맞췄고, 테스트에서 읽는 최신 로고 출처 문서를 함께 반영했다. 첫 CI의 문서 관련1건 실패는 최종 CI에서 해결됐다.
- GitHub 계정 `Essenly-beauty`의 정상 public_repo/workflow 권한으로 반영했다. 추가 인증 필요 없음. Git 작성자/이력 변경, 프로젝트 이전, 강제 push 없음.
- 운영 DB 마이그레이션은 이전 적용분을 유지했다. 실제 예약 활성화를 위한 매장·관리자 연결은 여전히 필요하며 개발 테스트 매장은 운영에 노출하지 않았다.

검증 자료: `/private/tmp/myseouldrop-git-deploy-status.json`, `/private/tmp/myseouldrop-public-after-git.json`, `/private/tmp/myseouldrop-github-ci-39362035781.log`. 재개 지침: 루트 `DEPLOY-RESUME.md`.


## 최종 결과 — 운영 배포 완료

**최신 작업을 기존 Vercel 프로젝트에 배포하고 운영 도메인으로 승격했다.** 아래의 BLOCKED/연결 대기 내용은 해결 전 이력이다.

- 서비스: https://seoul-guide-v2.vercel.app
- 로그인: https://seoul-guide-v2.vercel.app/login?next=/menu
- 관리자 대시보드: https://seoul-guide-v2.vercel.app/partner
- 운영 배포 ID: `dpl_FwWGGZQrzYssTDEiiL9fGDy9BTbM`, `READY`, production. 프로젝트의 `targets.production.id`를 다시 조회해 이 ID로 전환됐음을 확인했다.
- 고정 배포 URL: https://seoul-guide-v2-c6oxzwxzn-admin-28156576s-projects.vercel.app
- 이전 운영 배포(앱 롤백 기준): `dpl_8vThEd45Live5HoL4VVZuYyGfNr3`.
- 원래 작업트리를 보존하고 `/private/tmp/myseouldrop-release-git-FG92a2`에 최신 코드 278개 파일을 반영했다. 로컬 커밋은 `dc30b07ae4e2a262698734c33a3b35469a1e2747`; GitHub push는 수행하지 않았다. 공개 저장소 자격 증명 문자열 점검에서 탐지 사항이 없었다. 비밀 환경변수·캐시·내부 보고서는 배포 입력에서 제외했다.
- 기존 작업트리 origin은 로컬 경로였고, 배포용 체크아웃은 실제 상위 저장소 `git@github.com:Essenly-beauty/seoul-guide_v2.git`를 사용했다. **작성자 이름/이메일은 바꾸지 않았다.** Vercel이 GitHub 메타데이터를 인식한 새 배포는 권한 검사를 통과했다. 이 결과는 계정 이전이나 Git 작성자 위조 없이 얻었다.
- 사용자가 두 Vercel 계정 모두 관리 계정이라고 확인했다. 새 Gmail 인증은 완료됐지만 기존 프로젝트는 원래 admin 계정에 유지했다. 추가 GitHub 기기 인증은 배포에 필요하지 않아 사용자에게 건너뛰도록 안내했다.

### 배포 후 검증

- Vercel 원격 빌드 완료: 컴파일, lint/typecheck, 정적 페이지 69개 생성.
- staged 배포의 화면/API 11개 점검 통과. 운영 도메인에서 보호 우회 없이 화면/API 8개 점검 통과. 운영 홈 HTML이 검증한 staged 홈 HTML과 SHA256까지 일치했다.
- 홈·로그인·올리브영/다이소 랭킹·관리자 진입 화면 HTTP 200. 비로그인 예약 및 관리자 예약 API는 401 `AUTH_REQUIRED`. 공개 매장 위치 API는 200이며 기존 검증 주소/좌표를 반환했다.
- 운영 Supabase REST 5개 점검 통과: 공개 카탈로그/RPC 200, 예약 원장·메시지·예약 목록의 익명 접근 401. 실제 예약·결제·메시지를 생성하지 않았다.
- 초기 화면의 JS 자산 13개와 동적 JS 자산 6개 모두 200. **실제 운영 지도 JS(2716·4508)에 올바른 CARTO 키가 포함됐음을 확인했다.** 이 키를 사용한 지도 타일은 운영 Referer로 HTTP 200 / 10,762 bytes. 브라우저 시각·터치 검증은 여전히 미완료다.

### 운영에서 남은 설정

- 예약·관리자 DB 11개 마이그레이션은 **실제 운영 적용 완료**. RLS 20개 테이블, private WebP 5 MiB 이미지 버킷, 보류한 공유 목록 마이그레이션 미적용을 확인했다.
- 운영에 공개/예약 활성화된 매장과 관리자 membership은 아직 없다. 공개 매장 예약 API는 정상적으로 `unavailable`, 메뉴는 `unpublished`를 반환한다. 실제 운영 예약 활성화를 위해 매장·관리자 계정 연결, 메뉴/담당자/일정, 예약 설정과 공개 매핑이 필요하다.
- 개발 전용 `myseouldrop-booking-studio`는 운영 예약 API에서 404다. 해당 페이지도 not-found/noindex 내용이며, Next.js 스트리밍으로 HTTP 200을 반환하는 soft-404를 관찰했다. 이 URL을 운영 예약 데모로 안내하지 않는다.
- 현재 결제 방식은 현장 결제이며 결제 대행/실제 예약금 수납·자동 환불 연동은 별도다.

검증 자료: `/private/tmp/myseouldrop-{staged-http-results,public-http-results,production-api-results,promoted-deployment,public-map-check,migrations-production}.json`.

## 최신 상태 — 로그인 완료 후 확인

**로그인과 프로덕션 빌드는 성공했으나, 최신 배포는 Git 작성자 권한 부족으로 BLOCKED다. 운영 도메인과 운영 DB는 아직 변경하지 않았다.** 아래 기존 기록의 DNS 실패와 '신규 배포 없음'은 이 확인 이전의 이력이다.

- 활성 CLI 인증: `/private/tmp/myseouldrop-vercel-reauth-YzCkLd`, `admin-28156576` / `admin@essenly.beauty`. 기존 프로젝트와 팀을 원격으로 확인했다. MCP 연결은 별도로 403이므로 재설치 대신 정상 CLI를 사용한다.
- 프로세스 DNS 설정으로 Vercel·Google Fonts·Supabase 연결을 복구했다. 원래 호스트명과 TLS 검증을 유지한다. 운영 환경변수로 `npm run build` 통과, 69개 정적 페이지 생성 완료.
- 최신 미커밋 소스가 포함된 staged production 배포: `dpl_5SfCd8ZWi4pwFS6FSVWm4X4LaS5t`. [배포 상세](https://vercel.com/admin-28156576s-projects/seoul-guide-v2/5SfCd8ZWi4pwFS6FSVWm4X4LaS5t).
- Vercel 응답: `BLOCKED`, `TEAM_ACCESS_REQUIRED`, `alwaysRefuseToBuild: true`, `aliasAssigned: false`. 커밋 작성자에게 프로젝트 배포 권한이 없다는 이유다. Git 작성자 이름 `gksaudrhks12-sys`, 이메일 `gksaudrhks12@gmail.com`. 실제 연결 GitHub 계정은 미확인이다.
- 사용자에게 [Authentication 설정](https://vercel.com/account/settings/authentication)의 GitHub 계정 연결을 확인하도록 요청했다. 작성자 정보를 제거하거나 위조하지 않는다. 권한 해결 후 새 배포가 필요하다.
- `.vercelignore`를 추가해 `.env*`, `.vercel`, `.next*`, `node_modules`, 보고서 등 배포 불필요 파일을 제외했다. 최종 입력 2,420개 / 79,753,558 bytes, 최신 예약·관리자 파일 포함을 확인했다.
- 지도 워터마크는 로컬 CARTO 키 누락으로 확인했다. 기존 운영 키는 유효하며 키를 사용한 실제 지도 PNG를 확인했다. 두 로컬 미리보기의 개발 환경변수에 기존 공개 키를 설정했다. HTTP 200만으로 지도 정상 여부를 판단하지 않는다.
- 운영 백업 복원 및 11개 마이그레이션 리허설 성공. 복원 DB에서 고객 예약 56개, 관리자 150개 검증 통과. 상세는 [DB 준비 기록](2026-10-20-production-db-readiness.md) 참조.
- 브라우저 시각·터치 검증은 관리 정책 차단으로 여전히 미완료다. 개발용 예약 테스트 장소는 production에서 제공되지 않는다.

프로덕션 빌드 로그: `/private/tmp/myseouldrop-production-build-configured-20261020.log`. 재개 지침: `/Users/hanmyeong-gwan/mobile_design/DEPLOY-RESUME.md`.

## 이전 시도 기록

## 현재 상태

사용자가 기존 Vercel 서비스 업데이트를 요청했다. 최신 작업은 아래 작업트리에 저장되어 있으나, **이번 요청으로 생성된 배포는 없으며 운영 DB도 변경하지 않았다.**

- 작업트리: `/Users/hanmyeong-gwan/mobile_design/.worktrees/service-quality-20261018`
- 브랜치: `codex/service-quality-release-20261018` (기준 커밋 `c66c5db`, 미커밋 작업 포함)
- 루트의 기존 `.vercel/project.json`: 프로젝트 `seoul-guide-v2`, ID `prj_5eidC5l66Xu01vsVyJhpmv5H3qXf`, 팀 `team_F8hIyOkJ9p0Bdyn44Phngi1a`
- 기존 서비스 주소: `https://seoul-guide-v2.vercel.app` (이번 실행에서 원격 상태를 확인하지 못함)

## 이번에 마무리한 변경

- 예약 제출 전 확인 화면과 예약 상세에 작은 매장 지도, 주소, 지도 열기·길찾기 추가. 지도 링크는 새 탭으로 열어 입력 중인 예약을 유지한다.
- 승인된 주소가 기존 좌표의 주소와 다르거나 좌표가 대략적이면 정확한 매장 핀을 표시하지 않는다. 실제 매장이 아닌 로컬 테스트 장소도 미확인 좌표로 표시한다. 공개 프로필 조회 실패 시 오래된 주소/좌표를 대신 노출하지 않는다.
- 올리브영·다이소의 브랜드 헤더, 상위 탭, 검색/하위 필터와 결과 제목은 고정하고 결과 목록만 스크롤한다.
- 상위 선택 탭은 검정 강조(다크 모드 반전), 하위 필터는 작은 외곽선으로 구분한다. 필터의 44px 터치 영역을 유지하며 탭·필터·제목 간격을 축소했다.
- 앞서 구현한 실제 예약 및 별도 관리자 대시보드는 [데모 대응 기록](2026-10-20-dashboard-demo-parity.md)과 [백엔드 기록](2026-10-20-partner-operations.md)에 정리되어 있다.

## 검증

- 전체 단위·렌더링 테스트: **174개 파일 / 2,241개 통과**.
- TypeScript 검사 및 ESLint 통과.
- 한국어 로케일 데이터 감사 통과: 기존 감사 결과와 일치. 데이터 완전성을 새로 보증한다는 의미는 아니다.
- 로컬 HTTP: 올리브영·다이소 랭킹 200, 실제 공개 목록 매장 위치 200(목록 좌표와 일치), 테스트 매장 위치 200(정확한 좌표 미표시), 없는 장소 404. 위치 응답은 `no-store`.
- 기존 Chrome 관리 정책 차단으로 모바일 실제 화면·키보드·지도 타일 시각 검증과 스크린샷은 미완료.

## 배포를 막은 오류

1. 기존 연결 디렉터리에서 `vercel project inspect --non-interactive` 실행: `fetch failed`.
2. `api.vercel.com` 및 기존 서비스 도메인의 일반 HTTPS 요청: `Could not resolve host`.
3. 작업트리에서 기존 프로젝트/팀을 명시한 조회 재시도도 `fetch failed`.
4. 운영용 `npm run build`: `fonts.googleapis.com`의 `getaddrinfo ENOTFOUND`로 기존 `next/font/google` 폰트 다운로드 실패. 폰트나 보안 설정을 임시로 바꾸어 빌드 성공으로 처리하지 않았다.

실제 업로드·도메인 전환 전에 필요한 원격 프로젝트 확인 단계에서 중단되었다. 권한 승인을 거절당한 상황이 아니라 외부 주소를 해석하지 못하는 연결 오류다. 로컬 검사 통과는 운영 빌드나 배포 완료를 뜻하지 않는다.

## 연결 복구 후 재개

1. 위 기존 프로젝트/팀과 현재 운영 배포를 원격 조회로 다시 확인한다. 새 프로젝트를 만들거나 임의로 재연결하지 않는다.
2. [운영 DB 준비 보고서](2026-10-20-production-db-readiness.md)의 대상과 원격 마이그레이션 이력을 대조한다. 예약·관리자 기능의 11개 후보 중 실제로 누락된 변경만 검증·적용한다. 별도 보류 중인 공유 목록 잠금 마이그레이션을 일괄 적용하지 않는다.
3. Vercel Production 환경으로 새 배포를 만들되 도메인은 즉시 전환하지 않는다. 로컬 테스트 DB·테스트 계정·개발용 예약 플래그를 운영으로 옮기지 않는다.
4. 빌드 Ready와 공개 화면, 인증·예약·관리자 API 동작을 확인한 뒤 기존 도메인으로 승격한다. 테스트 목적으로 실제 고객 예약이나 결제를 만들지 않는다.
5. 새 배포 URL과 운영 확인 결과를 이 기록에 추가한다.

진단 로그는 `/private/tmp/release-{tests,typecheck,lint,data-audit,build,vercel-inspect}-20261020.log`에 있다. 인증 정보는 보고서와 로그에 기록하지 않았다.

## 로그인 후 재시도

사용자가 Vercel 로그인 완료를 알린 후, 기존 연결 디렉터리에서 원격 프로젝트 조회를 다시 실행했다. 결과는 `fetch failed`이며 인증 성공/실패 응답을 받지 못했다. 동일 세션의 주소 조회는 `api.vercel.com`과 `njsocpyuesntblifpips.supabase.co` 모두 `ENOTFOUND`, `scutil --dns`는 `No DNS configuration available`을 반환했다. 로그인 실패로 단정할 근거는 없으며 현재 확인된 장애는 이 실행 세션의 DNS 접근이다.

새 배포 생성·업로드·운영 도메인 변경·원격 DB 변경은 수행되지 않았다. 로그인 경로를 확인하여 이 세션에서 사용할 수 있는 연결인지 구분해야 한다. 비밀번호·토큰을 대화로 요청하지 않았다.

## 플러그인 설치 확인 후 상태

이후 사용자가 조직 선택과 설치를 완료했고, 마지막 연결 조회에서 **Vercel·Supabase 모두 `installed: true`**를 확인했다. 재설치가 필요한 상황으로 안내해서는 안 된다. 다만 현재 대화에는 두 플러그인의 실제 실행 도구가 아직 제공되지 않았으며, CLI 프로젝트 조회와 두 서비스의 DNS 조회도 다시 실패했다. 설치 여부와 실행 도구 사용 가능 여부를 구분한다.

루트의 `/Users/hanmyeong-gwan/mobile_design/DEPLOY-RESUME.md`에 새 세션용 재개 지침을 저장했다. 소스·테스트·배포 대상은 그대로 보존되어 있고, 실제 신규 배포 및 원격 DB 변경은 여전히 없다.


## 실행 도구 연결 후 재확인 및 휴대폰 링크

Vercel과 Supabase 실행 도구가 이제 제공된다. Supabase의 기존 프로젝트 조회, 원격 마이그레이션 목록 및 읽기 전용 SQL 조회에 성공했다. 예약·관리자 11개 마이그레이션과 주요 테이블은 모두 누락된 상태이며 원격 DB는 변경하지 않았다.

Vercel의 기존 프로젝트/팀 조회 및 배포 목록은 `403 forbidden`으로 거절되었다. 오류에 명시된 범위는 `admin-28156576s-projects`이다. 안내된 동일 대상 CLI 대체 조회는 `fetch failed`였고, 권한 진단용 팀 목록은 비어 있었다. 설치가 아니라 기존 팀에 대한 현재 연결 권한 문제다. 신규 배포는 여전히 없다.

휴대폰 확인을 위해 최신 소스의 별도 로컬 스냅샷과 서버를 준비했다. 같은 Wi-Fi에서 `http://10.160.130.73:3114/place/myseouldrop-booking-studio`로 접근할 수 있도록 LAN 주소에 바인딩했다. Supabase는 로컬 테스트 DB만 사용한다. 기존 3113 및 운영 서버는 변경하지 않았다. 같은 컴퓨터에서 LAN 주소로 테스트 페이지 HTTP 200을 확인했다. 실제 휴대폰 접속 및 터치/시각 확인은 사용자의 기기에서 남아 있다. 외부 폰트 다운로드 DNS 오류로 현재는 대체 폰트가 표시된다. 이 링크를 Vercel 최신 배포로 안내하지 말 것.
