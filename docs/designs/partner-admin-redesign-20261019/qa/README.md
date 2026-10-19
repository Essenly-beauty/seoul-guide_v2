# 시안 자동 검증

시안(`../index.html`)을 로컬 서버로 띄운 뒤 Playwright 헤드리스 Chromium으로 PC(1440)·태블릿(1024)·모바일(390, 터치) 동작을 확인한다. 실제 앱·서버·DB에는 접근하지 않는다.

```sh
# 저장소 루트에서
npm ci                       # playwright 패키지 포함
npx playwright install chromium   # 브라우저가 없을 때 한 번
python3 -m http.server 3111 --bind 127.0.0.1 --directory docs/designs/partner-admin-redesign-20261019 &
node docs/designs/partner-admin-redesign-20261019/qa/cal-verify.cjs   # 예약 캘린더·고객 미리보기 68개
node docs/designs/partner-admin-redesign-20261019/qa/ops-verify.cjs   # 홈·예약 목록·고객·통계·처리 규칙·월간·출근표·메시지·매장 정보 119개
```

- 마지막 줄 `N/N passed`가 기준. 스크린샷은 `$TMPDIR/partner-admin-qa/{cal,ops}/`에 남는다(`QA_OUT`으로 변경).
- 다른 포트로 띄웠으면 `QA_URL=http://127.0.0.1:포트/`.
- 두 스크립트는 같은 서버를 순서대로 써도 된다. 시안은 새로고침마다 초기화되므로 서로 영향이 없다.
- 단언의 기대값(예약 건수·금액)은 `index.html`의 예시 데이터에 맞춰져 있다. 예시 데이터를 바꾸면 기대값도 같이 고친다.
