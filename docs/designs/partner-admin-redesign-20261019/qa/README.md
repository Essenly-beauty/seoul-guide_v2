# 시안 자동 검증

시안(`../index.html`)을 로컬 서버로 띄운 뒤 Playwright 헤드리스 Chromium으로 PC(1440)·태블릿(1024)·모바일(390, 터치) 동작을 확인한다. 실제 앱·서버·DB에는 접근하지 않는다.

```sh
# 저장소 루트에서
npm ci                       # playwright 패키지 포함
npx playwright install chromium   # 브라우저가 없을 때 한 번
python3 -m http.server 3111 --bind 127.0.0.1 --directory docs/designs/partner-admin-redesign-20261019 &
node docs/designs/partner-admin-redesign-20261019/qa/cal-verify.cjs   # 예약 캘린더·고객 미리보기·터치 드래그 71개
node docs/designs/partner-admin-redesign-20261019/qa/ops-verify.cjs   # 홈·예약 목록·고객·통계·처리 규칙·월간·출근표·메시지·매장 정보·정산·영문 이름 135개
```

- 마지막 줄 `N/N passed`가 기준. 스크린샷은 `$TMPDIR/partner-admin-qa/{cal,ops}/`에 남는다(`QA_OUT`으로 변경).
- 다른 포트로 띄웠으면 `QA_URL=http://127.0.0.1:포트/`.
- 두 스크립트는 같은 서버를 순서대로 써도 된다. 시안은 새로고침마다 초기화되므로 서로 영향이 없다.
- 단언의 기대값(예약 건수·금액)은 `index.html`의 예시 데이터에 맞춰져 있다. 예시 데이터를 바꾸면 기대값도 같이 고친다.

## 실제 구현(3113 `/partner/*`) 화면 점검 — 2026-10-20 추가

시안이 아니라 Next.js 앱의 파트너 관리자를 대상으로 한다. 로컬 Supabase와 테스트 매장이 떠 있어야 하고(`scripts/provision-local-booking-preview.cjs`가 `$TMPDIR/myseouldrop-booking-local-access.json`에 테스트 계정을 쓴다), 스크립트는 그 파일에서 계정을 읽어 로그인하며 비밀번호를 출력하지 않는다.

```sh
# 앱이 http://127.0.0.1:3113 에 떠 있을 때, 저장소 루트에서
NODE_PATH=$PWD/node_modules node docs/designs/partner-admin-redesign-20261019/qa/impl-screens.cjs   # 13개 화면 × PC·모바일 + 캘린더 보기 전환 + 더보기 메뉴
NODE_PATH=$PWD/node_modules QA_FLOW_DATE=2026-10-21 node docs/designs/partner-admin-redesign-20261019/qa/impl-flow.cjs   # 전화 예약 추가 → 캘린더 → 모바일 터치 → 상세 → 업체 취소
```

- 다른 주소면 `QA_IMPL_URL=http://127.0.0.1:포트`. 스크린샷은 `$TMPDIR/partner-admin-qa/impl/`.
- `impl-flow.cjs`는 로컬 테스트 매장에 전화 예약 1건을 만들고 마지막에 ‘기타’ 사유로 취소한다(취소 기록 1건이 남는다). 운영 DB를 가리키는 주소에는 쓰지 않는다. 날짜는 매장 영업일이어야 하며 기본값은 내일이다.
- 결과 해석과 발견된 결함은 `reports/design/2026-10-20-partner-admin-implementation-screen-check.md`.
