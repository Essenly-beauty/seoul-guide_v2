# 로그인 검증 재개 — 2026-10-10

> 최신 결과: 아래 인증 성공 검증 완료 절 참고. 앞부분은 원인 진단 당시의 기록이다.

- 사용자가 로그인 완료를 알린 뒤 연결된 Chrome에서 확인했다.
- 검증 브랜치의 `/mypage/reviews`는 `Sign in to rate places, write reviews, and see your reviews.`를 표시했다.
- 운영 사이트 `/menu` 역시 Sign in과 로그인 안내를 표시했다. 실제 인증 세션을 확인하지 못했으므로 리뷰 저장·수정·로그아웃을 수행하지 않았다.
- 사용자에게 로그인 방식(Google/이메일) 및 다른 브라우저·기기 사용 여부를 질문했다. Google 리디렉션 오류라고 단정하지 않는다.
- 검증 로그인 페이지를 열어 유지했다. 앱 production 배포는 이전 검증 게이트에 따라 보류, DB 변경 없음.

## 로컬 작업 위치 복구

- 이전 `.worktrees/review-auth-gate-20261005/.git`가 참조하는 임시 clone의 Git 메타데이터를 찾지 못했다. 기존 파일이나 백업은 변경하지 않았다.
- 원격 리뷰 브랜치 `8707e738ca10c4bede68b3e0dd524140aa81a3b2`를 `.worktrees/review-release-20261010`에 별도 clone했다. 이후 Git 작업은 이 위치에서 진행한다.
- 기존 리뷰 백업은 이전 작업 트리 `scripts/.cache/private-review-backups/`에 여전히 존재한다. 새 clone에는 복사하지 않았다.
- 원격 main은 `7447ef17124c24e41a2d382b895529d4b7c1c233`로 진행되어 있으므로 배포 전에 차이를 재검토한다. dirty root는 건드리지 않는다.

## Google 로그인 후속 진단

- 사용자가 Google 로그인 사용을 확인했다.
- 실제 Supabase URL Configuration에서 Site URL은 `https://myseouldrop.app`, 허용 Redirect URLs는 운영 도메인 callback 2개 및 localhost callback 2개뿐이었다. 이번 리뷰 프리뷰 도메인은 없다.
- 프리뷰 코드는 현재 origin의 `/auth/callback?next=/map`을 Google 로그인 `redirectTo`로 전달한다.
- Dashboard 안내에 따르면 미허용 redirect는 Site URL로 되돌아간다. 프리뷰 로그인 후 운영 사이트로 이동하고 세션이 확인되지 않은 현상과 일치한다. 실제 콜백 로그 전체를 추적한 것은 아니다.
- 해결 대상은 리뷰 브랜치의 고정 프리뷰 호스트 callback 하나만 허용하는 것. 전체 vercel.app wildcard나 Site URL 변경은 필요 없다. 새 인증 반환 주소 추가는 보안 설정 변경이므로 UI 저장 직전에 사용자 확인을 요청한다. 아직 설정을 수정하지 않았다.

## 승인 후 설정 반영

- 사용자가 주소 추가를 승인하여 `https://seoul-guide-v2-git-feat-review-d938db-admin-28156576s-projects.vercel.app/auth/callback` 1개만 저장했다.
- Dashboard에서 Total URLs 5 및 추가한 정확한 주소 표시를 확인했다. Site URL은 `https://myseouldrop.app` 그대로이며 wildcard는 추가하지 않았다.
- 검증 사이트의 Google 로그인 버튼을 눌러 계정 선택 화면까지 열었다. 여러 Google 계정 중 테스트할 계정은 사용자가 직접 선택하도록 인계한다.
- 최종 인증 복귀/세션 유지/리뷰 저장은 아직 검증 전이며 앱 production 배포는 계속 보류한다.

## 쿼리 포함 주소 불일치 수정 및 서버 검증

- 사용자가 다시 로그인했지만 운영 `/map`으로 돌아왔으며 운영 `/menu`는 여전히 비회원 안내를 표시했다. 최초 callback 주소만 추가한 처리는 불완전했다.
- Supabase Auth 공식 `internal/utilities/request.go`는 fragment만 제외하고 query를 포함한 URL 전체를 허용 패턴과 비교한다. 실제 Google 요청의 `?next=/map`이 최초 등록 주소에는 없었다.
- 승인된 동일 호스트·콜백의 정확한 `.../auth/callback?next=/map`을 추가했다. 전체 wildcard, 다른 호스트, Site URL은 변경하지 않았다. Dashboard Total URLs 6 확인.
- 실제 Auth API authorize → 사용자 인증 없는 access_denied 취소 콜백으로 redirect 검증. 계정 생성/사용자 세션 생성/리뷰 변경 없음.
- 허용 요청 `?next=/map`: HTTP 302, 프리뷰 origin + `/auth/callback`, next `/map` 반환 확인.
- 비허용 대조 요청 `?next=/not-allowed-check`: 기본 운영 origin 반환 확인. 정확한 요청만 허용됨을 확인했다.
- 사용자 Google 인증을 다시 완료해야 리뷰 저장 검증을 이어갈 수 있다. 이번 검사는 인증 성공 및 세션 저장 자체를 검증한 것이 아니다.

## 인증 성공 검증 완료

- 사용자의 Google 로그인 후 프리뷰에서 실제 인증 세션과 기존 내 리뷰 1건을 확인했다. 기존 리뷰는 수정하지 않았다.
- 기존 기록이 없는 Soonsoo 장소에서 별점 4점 단독 저장 → 새로고침 복원 확인.
- 비공개 테스트 문구 저장 → 새로고침 복원 → 문구 수정 → 내 리뷰 목록 반영을 확인했다. 공개 동의 체크박스는 기본 미선택이며 수정 때도 미선택이다.
- DB에서 새 테스트 행의 별점 4, 수정 문구, is_public=false를 검증했다. 공개 리뷰 뷰의 해당 장소 테스트 행은 0건이다. 공개 가상 리뷰는 작성하지 않았다.
- 테스트 전에 원본 3행을 비공개 로컬 백업했다. 정확한 신규 ID·장소·테스트 문구·비공개 조건으로 테스트 1행만 삭제하고 원본 3행 전체 값이 동일함을 비교했다. 테스트 행 삭제 전 별도 비공개 백업도 남겼다. 백업은 scripts/.cache/review-qa-20261010/에 있고 Git에서 제외한다.
- 새로고침 후 내 리뷰 목록은 원래 1건으로 돌아왔다. 로그아웃 후 내 리뷰 접근은 로그인 안내로 전환됐다.
- 최신 main 86da52c의 카페 자료 4개 커밋을 독립 작업 복사본에 병합(44778f7). root의 다른 작업은 변경하지 않았다.
- 병합 후 전체 단위 테스트 972개/102파일 통과, typecheck 및 lint 통과. 배포 Ready와 운영 비회원 접근 확인은 후속 릴리즈 기록에 남긴다.

## 남은 범위

- 추가 `audit:data:check`는 저장된 보고서의 정렬 순서 차이로 실패했다. 공식 생성기를 실행해 ID별 비교한 결과 1,122개 레코드의 값 및 summary는 전부 동일하고 순서만 달랐다. 재생성 직후 검사는 통과했지만 불필요한 9천 행 diff를 배포에 포함하지 않고 이번에 생성한 두 보고서만 원복했다. 따라서 원본 상태의 데이터 감사까지 모두 통과했다고 주장하지 않는다. 정렬은 `lib/place-audit.ts`의 localeCompare를 사용하며 환경 간 결정성 개선은 후속 과제다.

- 사용자 직접 리뷰 삭제 UI는 현재 없다. 이번 작업은 로그인·저장·수정·공개 분리 검증이며 삭제 UX 추가는 후속 작업이다.
- 운영 도메인에서 새 로그인 후 쓰기는 별도 사용자 세션 검증이 필요하다. 실제 쓰기 검증은 동일 Supabase를 사용하는 프리뷰에서 수행했다.
- Vercel CLI 60.1.3은 구버전이다. 관리 기기에서 `npm i -g vercel@latest` 업그레이드를 권장하며 이번 배포는 Git 연동을 사용한다.

## Production 배포 완료

- 검증 커밋: `a60501fd032418b02a8f4b2813df696b410b7d97`. 최신 main을 포함하는지 재확인한 뒤 강제 푸시 없이 main에 반영했다.
- Preview `8ZTdqjJKEhtXmaAhERpDxJ99KCeY`: Ready, 53초.
- Production `4KwjBfospudJAMRpFeJ4qiXTE7V2`: Ready, 1분 18초. 대시보드에서 main/a60501f 및 myseouldrop.app 도메인 연결 확인.
- 운영 `https://myseouldrop.app/place/ct-soonsoo-celebrity-hair-makeup-salon-in-cheongdam` 비회원 상세 열람 성공. 별점 클릭 시 로그인 안내가 나타나며 별점 선택/저장은 발생하지 않았다. 프리뷰에서 로그아웃 후 리뷰 버튼 및 내 리뷰 접근 차단도 확인했다.
- 실제 로그인 쓰기 검증은 프리뷰에서, 배포 후 비회원 차단은 운영 도메인에서 수행했다. 운영 도메인에서 로그인 쓰기까지 검증했다고 확대 해석하지 않는다.
- 후속 결과 문서 커밋은 리뷰 브랜치에 공유하며, 배포 앱 커밋은 위 a60501f로 구분한다.
- 배포 ID로 필터한 Vercel Logs의 Last 30 minutes 조회: Warning 0 / Error 0 / Fatal 0. 배포 직후의 짧은 관찰이며 장기 안정성 보장이 아니다. Web Analytics와 Speed Insights는 대시보드상 Not Enabled, 외부 log drain 구성은 이번에 확인하지 않았다.
