# 런칭 자동화 작업 목록

> 기준일: 2026-08-22
> 대상: Essenly-beauty/seoul-guide_v2 / Production https://seoul-guide-v2.vercel.app
> 목적: 반복 검증은 자동화하고, 실제 판단·승인·실데이터 작업은 오너에게 분리한다.

## 1. 현재 기준선

| 영역 | 현재 상태 | 근거 |
|---|---|---|
| Vercel 배포 | 통과 | 72aaf25 Production Ready |
| CI | 통과 | typecheck, lint, test, build / CI #128 |
| 공개 smoke | 통과 | Production public smoke #6, visitor 6/6 |
| 계정 smoke | 통과 | Production public smoke #6, account 9/9 |
| Supabase 스키마 | 통과 | 0001~0008 Local/Remote 일치 |
| Supabase drift | 통과 | supabase db push --dry-run → up to date |
| Actions runtime | 통과 | checkout@v5, setup-node@v5 |
| 자동 공개 smoke | 준비 중 | 6시간 주기 변경이 로컬에 준비됨 |

## 2. 자동화 원칙

1. Production DB를 변경하는 작업은 자동화하지 않는다.
2. 마이그레이션 자동화는 supabase db push --dry-run까지만 허용한다.
3. 계정 생성·즐겨찾기·리뷰·계정 삭제 E2E는 수동 승인 후 실행한다.
4. 실패 로그에는 실행 URL, 커밋 SHA, 대상 URL, 실패 단계를 남긴다.
5. Secret 값은 로그·아티팩트·PR 코멘트에 출력하지 않는다.
6. 자동화는 실제 영업 여부나 이미지 진위를 판정하지 않는다. 이 부분은 수동 검수다.

## 3. P0 — 즉시 자동화할 작업

### AUT-01. 공개 페이지 smoke 정기 실행

목적: 배포 이후 비로그인 방문자 경로가 계속 살아 있는지 감시한다.

- 파일: .github/workflows/production-public-smoke.yml
- 트리거:
  - workflow_dispatch: 사람이 즉시 실행
  - schedule: 17 */6 * * * (6시간마다)
- 범위:
  - /, /map, /menu, /favorites, /settings, /place/[id]
  - prototype route redirect
  - 한글 place id
  - 잘못된 shared-list fallback
- 자동 실행에서 제외:
  - include_account_data=true
  - 테스트 계정 생성/삭제
  - 데이터 쓰기
- URL fallback:
  - base_url이 비어 있으면 https://seoul-guide-v2.vercel.app
- 성공 기준:
  - Visitor discovery smoke 6/6 통과
  - workflow 전체 Success
- 실패 대응:
  1. Actions 로그에서 route와 commit SHA 확인
  2. Vercel 배포 상태 확인
  3. 같은 커밋으로 1회 수동 재실행
  4. 재실패 시 공개 홍보 중지 및 롤백 판단

현재 변경사항 반영 명령:

~~~bash
git add .github/workflows/production-public-smoke.yml
git diff --cached --check
git commit -m "ci: schedule public production smoke"
git push origin main
~~~

### AUT-02. 계정 데이터 smoke 수동 승인 실행

목적: Auth, RLS, favorites, profile, ratings, export/delete, error tracking을 Production에서 확인한다.

- 실행: GitHub Actions → Production public smoke → Run workflow
- 입력:
  - base_url: Production URL
  - include_account_data: true
- 데이터 영향:
  - throwaway 계정 생성
  - 즐겨찾기·프로필·리뷰·오류 기록
  - 테스트 계정 삭제
- 성공 기준:
  - account-data smoke 9/9 통과
  - Auth Users에 테스트 계정 잔류 없음
- 자동 schedule에는 절대 포함하지 않는다.

### AUT-03. Supabase migration drift 검사

목적: 저장소 migration 파일과 Production migration history의 불일치를 감지한다.

권장 트리거:

- pull_request에서 supabase/migrations/** 변경 시
- push to main
- workflow_dispatch

검사 명령:

~~~bash
supabase migration list
supabase db push --dry-run
~~~

절대 실행하지 않는 명령:

~~~bash
supabase db push
~~~

필요한 보호 설정:

- Supabase project ref
- CLI access token 또는 protected project link
- DB 연결 인증 정보
- Secret은 GitHub Environment Secret에만 저장

성공 기준:

- Local/Remote migration version 동일
- dry-run에 pending migration 없음

실패 시:

1. 자동 apply 금지
2. migration list 결과 저장
3. 수동 변경이면 supabase db pull 검토
4. 이미 적용된 변경은 migration repair로 이력만 정리

### AUT-04. 배포 후 URL 검증

목적: CI build 성공과 실제 Production 배포 성공을 분리한다.

검증 대상:

- Vercel deployment Ready
- 승인된 commit SHA와 활성 배포 SHA 일치
- /robots.txt, /sitemap.xml, /, /map 응답 성공
- AUT-01 smoke 성공

배포 성공만으로 런칭하지 않고, smoke까지 통과해야 한다.

## 4. P1 — 이번 주 자동화할 작업

### AUT-05. 정적 데이터 무결성 리포트

목적: 데이터가 사실인지 자동 판정하지 않고 사람이 검수할 대상을 목록화한다.

추가 명령 예시:

~~~bash
npm run audit:data
~~~

리포트 항목:

| 검사 | 출력 |
|---|---|
| 전체 장소 수 | 현재 약 600 |
| source별 수 | curated / creatrip / kakao / ados |
| curated rating 잔존 | 반드시 0 |
| photoUrl 누락 | 장소별 count + id |
| imageUrl 누락 | 제품별 count + id |
| geoSource=area | 42개 목록 |
| 주소/영업시간 누락 | id, name, field |
| 중복 이름·주소 | 후보 그룹 |
| 검증일 누락 | lastVerifiedAt 도입 후 count |
| 구매 URL 검증일 누락 | 제품별 count |

성공 기준:

- CI 아티팩트에 현황 리포트가 남음
- 누락 수는 경고로 표시
- 오너가 기준치를 정한 뒤에만 CI gate로 승격

자동 판정하지 않는 항목:

- 현재 영업 여부
- 실제 영업시간
- 사진 진위
- 데이터 재배포 라이선스

### AUT-06. Dependabot 및 Actions 업데이트 PR

파일: .github/dependabot.yml

- 대상: npm, github-actions
- 주기: weekly
- 자동 merge 금지
- PR 생성 후 CI 통과와 사람이 검토한 뒤 merge

### AUT-07. Supabase 보안 점검 리포트

점검 대상:

- public 테이블 RLS 활성화
- anon/authenticated SELECT 권한
- feedback/client_errors insert-only 정책
- shared_lists 공개 링크 정책
- public_reviews/review_reports 정책
- SECURITY DEFINER 함수의 search_path와 owner 권한

운영 방식:

- Supabase Security Advisor를 주간 확인
- 보호된 CI job에서 실행할 경우 결과를 최소화해 기록
- 경고 발생 시 자동 수정하지 않고 운영자 검토로 전환

### AUT-08. client_errors 급증 알림

목적: 배포 후 브라우저 오류 급증을 조기에 발견한다.

집계 기준 예시:

- 최근 15분·1시간 오류 수
- 동일 message/pathname 반복 수
- release SHA별 오류 수

service-role key가 필요하면 별도 protected environment를 사용하고, 오류 원문에 개인정보·토큰이 없는지 먼저 확인한다.

### AUT-09. 자동화 역할 중복 방지

| 자동화 | 담당 |
|---|---|
| Uptime | 서버 응답·기본 endpoint |
| Public smoke | 렌더링·redirect·지도·장소 탐색 |
| Account smoke | 인증·RLS·쓰기/삭제 왕복, 수동 |
| CI | 코드 품질·production build |
| Migration drift | schema history와 파일 일치 |

## 5. P2 — 안정화 후 자동화할 작업

### AUT-10. 오래된 client_errors 보존기간 정리

- 보존기간은 법무 승인 후 확정
- Supabase Cron 또는 보호된 운영 job 사용
- 삭제 전 count와 집계 보존 여부 확인
- 예시 기준 30일은 정책 확정 전 적용하지 않음

### AUT-11. 리뷰 신고 대기열 요약

- 신규 신고 수
- 자동 숨김 리뷰 수
- 운영자 미처리 건수
- 반복 신고 리뷰
- 자동 삭제는 하지 않고 운영자 검토로 제한

### AUT-12. 부하·성능 회귀 검사

- 대상: /, /map, /search, /place/[id], /api/*
- Production 부하는 오너 승인 후에만 실행
- p95 latency, error rate, JS size, image transfer size 기록

### AUT-13. 백업·복구 리허설

- Supabase 백업 상태 확인
- 별도 환경에서 복구 가능성 확인
- Production DB에 직접 복구하지 않음
- 실행자·시각·결과·롤백 방법 기록

## 6. 자동화하지 않고 오너가 직접 해야 하는 작업

### 공개 런칭 전 P0

- 약관·개인정보처리방침의 Draft 승인
- 운영 주체·연락처·보존기간·위탁사 문구 확정
- Apple 로그인 버튼 숨김 또는 Apple OAuth 설정
- Supabase Phone Test Numbers가 비어 있는지 확인
- Confirm email OFF의 rate limit/CAPTCHA 정책 결정
- 지원 담당자·응답 시간·리뷰 신고 SLA 지정
- 실제 장소/제품 이미지 사용권 확인
- 600개 전체 공개인지 검수된 핵심 지역만 공개인지 결정

### 공개 홍보 전 P1

- myseouldrop.app 도메인 연결 여부
- DNS/HTTPS/metadata/canonical/OAuth redirect 확인
- SMTP와 비밀번호 재설정 메일 확인
- iPhone Safari/Android Chrome 실기기 QA
- 위치 권한·외부 지도 앱·PWA 설치 확인
- CARTO/OSM 사용량·저작자 표시 확인
- Actions/Vercel/Supabase 장애 알림 수신 확인

## 7. 병렬 실행 순서

### 자동화 트랙

| 순서 | 작업 | 상태 |
|---:|---|---|
| 1 | 공개 smoke 6시간 주기 | 워크플로 수정 준비, 커밋 필요 |
| 2 | migration drift dry-run job | Secret 확인 후 구현 |
| 3 | data integrity report | 스크립트/테스트 추가 |
| 4 | Dependabot 설정 | PR만 생성 |
| 5 | client_errors 알림 | 보안·개인정보 검토 후 구현 |

### 오너 트랙

| 순서 | 작업 | 완료 증적 |
|---:|---|---|
| 1 | 법무 문서 승인 | 승인된 문안/결정값 |
| 2 | Apple·Phone 정책 | Provider 상태 또는 숨김 결정 |
| 3 | 지원 운영 | 이메일/담당자/SLA |
| 4 | 데이터·이미지 공개 범위 | 지역/카테고리/라이선스 결정 |
| 5 | 도메인·SMTP | 콘솔 설정 및 실메일 |
| 6 | 실기기 QA | iPhone/Android 결과 |

두 트랙은 서로 막지 않는 항목부터 동시에 진행한다. 공개 런칭 공지는 오너 P0와 자동화 P0가 모두 완료된 뒤 진행한다.

## 8. Secret 및 권한 관리

- NEXT_PUBLIC_SUPABASE_*는 공개 번들 값이지만 Production 프로젝트인지 확인한다.
- SUPABASE_SERVICE_ROLE_KEY, DB password, CLI access token은 GitHub Environment Secret에만 저장한다.
- Secret을 PR fork에 노출하지 않는다.
- drift job은 contents: read 외 권한을 주지 않는다.
- 자동화 job에서 db push 또는 migration repair를 실행하지 않는다.
- account smoke는 workflow_dispatch만 허용한다.

## 9. 완료 기준

자동화 트랙:

- 공개 smoke가 수동·정기 모두 실행됨
- account smoke는 수동 승인으로만 실행됨
- migration drift가 pending migration을 감지함
- 데이터 무결성 리포트가 CI 아티팩트로 남음
- Actions/Dependabot 경고가 추적됨
- 실패 시 담당자와 롤백 절차가 정해짐

수동 트랙:

- 법무 문서가 Draft가 아님
- Provider와 Phone Test Numbers 상태 확정
- 실제 데이터·이미지 공개 범위와 라이선스 승인
- 지원 담당자와 응답 SLA 확정
- 모바일 실기기 QA 기록 완료

## 10. 권장 실행 순서

~~~text
1. 공개 smoke 6시간 주기 커밋·push
2. migration drift dry-run job 추가
3. data integrity report 추가
4. Dependabot 추가
5. client_errors 알림 검토
6. 오너의 법무·인증·지원·데이터·이미지 결정
7. 실기기 QA
8. 최종 Production smoke
9. 런칭 공지
~~~
