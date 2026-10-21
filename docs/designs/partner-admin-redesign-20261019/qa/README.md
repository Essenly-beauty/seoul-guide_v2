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

## 웹앱 쪽 Codex 리뷰 수정 검증 — 2026-10-20 밤 추가

1차 Codex 코드 리뷰(6/10)의 지적을 고친 뒤 실제 앱(3113)에서 확인한 스크립트. 앞 절과 같은 전제(로컬 Supabase·테스트 매장·`$TMPDIR/myseouldrop-booking-local-access.json`).

```sh
NODE_PATH=$PWD/node_modules node docs/designs/partner-admin-redesign-20261019/qa/impl-map-lightbox.cjs     # 지도 시트 → 전체 상세 → 사진 라이트박스: .app-shell 포털·전면 덮기·초기 포커스·‹ ›/화살표·Tab 트랩·배경 inert·갤러리 안 세로 드래그가 시트를 접지 않음·Esc 후 타일로 포커스 복귀 (21)
NODE_PATH=$PWD/node_modules node docs/designs/partner-admin-redesign-20261019/qa/impl-map-photos-off.cjs   # 관리자 API로 사진 영역 OFF → 지도 상세에서 사진 영역 사라짐(프로필 이름 표시) → ON 복귀, 4키(레거시) PATCH 200 (10)
NODE_PATH=$PWD/node_modules node docs/designs/partner-admin-redesign-20261019/qa/impl-track-geometry.cjs   # 320/390px × 16·39·48·60역 합성 트랙: 넘침 0, 양 끝 안쪽, 점 중심 ↔ 포인터 매핑 일치 (8)
```

- `impl-map-lightbox.cjs`는 `PLACE=<id>`로 사진 있는 장소를 바꿀 수 있다(기본 `ados-63-skypicnic`). `impl-map-photos-off.cjs`는 테스트 매장의 공개 설정을 잠시 바꿨다가 되돌린다 — 운영 주소에는 쓰지 않는다.
- 두 다이얼로그(지도 시트·라이트박스)가 모두 `aria-modal`이면 Playwright의 role 질의가 포털된 쪽을 숨기므로 CSS 로케이터를 쓴다.
- 결과·스크린샷은 `reports/design/2026-10-20-codex-review-fixes.md`와 `reports/design/evidence/2026-10-20-codex-round2/`.

## 웹앱 ↔ 관리자 왕복 실측 — 2026-10-21 추가

```sh
NODE_PATH=$PWD/node_modules node docs/designs/partner-admin-redesign-20261019/qa/impl-member-roundtrip.cjs   # (A) 검색→결과→/map?place→시트 전체 상세→외부 지도 목적지→뒤로가기 9 + (B) 예약 요청→고객 메시지→관리자 스레드·답장→고객 답장 표시→관리자 시간 변경→고객 목록 반영→고객 취소→관리자 목록·홈 최근 변경 13
```

- 날짜·시간은 실행 시점에 비어 있는 칸에서 고른다(이틀 뒤 우선). 전날 스크립트는 `10월 22일 16:00`을 고정으로 써서 이전 실행이 그 칸을 차지하자 멈췄다.
- 로컬 테스트 매장에 예약 1건을 만들고 시간 변경 후 고객 취소로 끝낸다. 메시지 본문에 `QA <실행 ID>`가 붙는다(`QA_RUN_ID`). 운영 주소에는 쓰지 않는다.
- `SKIP_A=1`이면 (B)만 실행. 결과 JSON은 `QA_OUT/member-roundtrip.json`(체크별 근거 문자열 포함).
- 관리자 메시지 화면은 첫 진입 시 “매장 정보를 불러오고 있습니다”가 수 초 보이므로 그 문구가 사라질 때까지 기다린다. 스레드는 `main button`으로 열고 입력창을 클릭한 뒤 입력해야 `메시지 보내기`가 활성화된다.

```sh
NODE_PATH=$PWD/node_modules node docs/designs/partner-admin-redesign-20261019/qa/impl-photo-fit-and-ticket.cjs   # 라이트박스 사진이 가로 폰(844×390)·노트북(1280×720)·세로 폰에서 틀 안에 맞춰짐 + 긴 역 이름이 노선 티켓을 넓히지 않음(320/390px) (5)
```

## 화면 문장·레이아웃·버튼 전수 점검 — 2026-10-21 추가

관리자(/partner/*)와 고객 예약 흐름을 화면 크기·언어별로 브라우저에서 재고, 버튼을 하나씩 눌러 본다. 앞 절과 같은 전제(로컬 Supabase·테스트 매장·`$TMPDIR/myseouldrop-booking-local-access.json`). 결과 해석은 `reports/design/2026-10-21-screen-text-layout-review.md`.

```sh
# 레이아웃: 22개 조합(관리자 8개 화면 크기, 고객 영어 6개 + 일·중·스·프 각 2개)을 N개씩 동시에
NODE_PATH=$PWD/node_modules MATRIX=layout MATRIX_JOBS=3 MATRIX_OUT=/tmp/layout node docs/designs/partner-admin-redesign-20261019/qa/impl-audit-matrix.cjs
node docs/designs/partner-admin-redesign-20261019/qa/impl-audit-report.cjs /tmp/layout            # 같은 문제를 한 번만 묶어 출력(--json out.json)
# 한 조합만: AUDIT_SIDE=admin|customer AUDIT_VIEWPORT=390x844 [AUDIT_LOCALE=ja] [AUDIT_STATES=home,bookings-all]
NODE_PATH=$PWD/node_modules AUDIT_SIDE=admin AUDIT_VIEWPORT=390x844 node docs/designs/partner-admin-redesign-20261019/qa/impl-layout-audit.cjs
# 버튼: 누르면 무엇이든 일어나는지(이동·창·상태·요청), 오류·안 닫히는 창·눌리지 않는 버튼
NODE_PATH=$PWD/node_modules MATRIX=controls MATRIX_JOBS=2 MATRIX_OUT=/tmp/controls node docs/designs/partner-admin-redesign-20261019/qa/impl-audit-matrix.cjs
# 저장·확정 버튼 실제 흐름(로컬 테스트 매장만 바꾸고 원래대로 돌린다)
NODE_PATH=$PWD/node_modules node docs/designs/partner-admin-redesign-20261019/qa/impl-confirm-flow.cjs        # 예약 요청 → 예약 확정(확인창) → 고객 Confirmed → 메시지 버튼 → 업체 취소(사유) → 고객 Cancelled (16)
NODE_PATH=$PWD/node_modules node docs/designs/partner-admin-redesign-20261019/qa/impl-settings-roundtrip.cjs  # 예약 설정·매장 정보·메뉴 편집·근무시간: 저장 → 새로고침 반영 → 원복, 버리기·되돌리기 (29)
NODE_PATH=$PWD/node_modules node docs/designs/partner-admin-redesign-20261019/qa/impl-long-values.cjs         # 띄어쓰기 없는 40자 이름·긴 URL 메모 예약으로 6개 화면 × 360·1440 넘침 측정 후 예약 정리 (14)
```

- 점검 항목: 문서 가로 넘침, 상자에 잘린 글자(말줄임·줄 제한은 따로 표시), 상자 밖으로 삐져나온 글자, 화면 끝에서 잘린 요소, 버튼·탭·칩 이름이 2줄 이상, 한국어 어절 안 줄바꿈(단어가 칸보다 길면 `forced`), 1~2글자만 남은 마지막 줄(일·중은 글자 단위), 글자끼리 겹침, 선택 상자·안내 문구 잘림, 터치 화면 40px 미만 영역, 다른 요소에 가려 눌리지 않는 버튼, 하단 고정 바에 영구히 가려지는 내용.
- 겹침·가림은 스크롤에 따라 나타나는 머리글(전환 효과)이 있어 스크롤 후 화면 갱신을 기다려 판정하고, 열린 창·시트 뒤의 배경과 줄 끝 보존 공백은 문제로 보지 않는다.
- 개발 서버 하나에 여러 브라우저를 붙이면 컴파일·응답이 크게 늦어진다. 동시 실행은 서버당 2~3개가 적당하고, 처음 여는 경로는 컴파일되는 동안 404·시간 초과가 날 수 있어 로그인 도우미가 한 번 더 시도한다.
- 버튼 점검의 `NOT-CLICKABLE`·`not-found-after-reset`·data 속성 대기 `CRASH`는 React가 그 순간 다시 그린 경우가 대부분이다. 결과를 보고 해당 버튼을 따로 눌러 확인한다(보고서에 수동 확인 결과가 있다).
