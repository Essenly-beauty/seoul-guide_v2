# 파트너 예약 관리자 재설계 — 핸드오프 (2026-10-20 오후 갱신)

다른 계정·다른 기기에서 이 작업을 그대로 이어가기 위한 문서. 이 문서 하나와 브랜치만 있으면 된다. 마지막 갱신: 2026-10-20 오후, 커밋 `c66c5db`(시안 v3.4) 이후.

## 1. 지금 상태 한 줄

시안 **v3.4**(`c66c5db`)는 사용자 검토 대기 중인데, 10/19 밤~10/20 오후에 **Codex 세션이 같은 클론에서 시안을 실제 `/partner/*` 13개 화면과 고객 예약 흐름에 연결했다**(`reports/operations/2026-10-20-dashboard-demo-parity.md`, `2026-10-20-integrated-booking.md`, `2026-10-20-partner-operations.md`; 10/20 오후 기준 **커밋 전 작업 트리에 261개 파일 변경**, 로컬 Supabase 마이그레이션 4개). Claude는 10/20 오후에 그 구현을 3113에서 PC·모바일로 점검해 결함 14건(높음 1·중 5·낮 8)을 `reports/design/2026-10-20-partner-admin-implementation-screen-check.md`에 남겼다. 다음은 (1) Codex 작업 커밋·푸시, (2) 결함 A~F 수정과 재검증, (3) 6절의 사용자 결정이다.

## 2. 어디에 무엇이 있나

| 항목 | 위치 |
| --- | --- |
| 작업 브랜치 | `codex/service-quality-release-20261018` (GitHub `Essenly-beauty/seoul-guide_v2`). 운영 기준 커밋 `c6c4b94`(main) 위에 올라간 릴리스 후보 + 이 시안 |
| 시안(클릭 가능한 HTML 1장) | `docs/designs/partner-admin-redesign-20261019/index.html` |
| 시안 자동 검증 | `docs/designs/partner-admin-redesign-20261019/qa/` (README에 실행법, ops 135 + cal 71 = 206개) |
| 시안 화면 | 홈 / 예약 운영(예약 캘린더 일·주·월, 예약 목록, 고객, 메시지) / 예약 설정(메뉴·패키지, 담당자, 기본 근무시간, 출근표, 예약 설정) / 매장(통계, 정산, 매장 정보). 모바일 탭: 홈·예약·메시지·고객·더보기 |
| 설계 문서 | `docs/superpowers/specs/2026-10-19-partner-admin-ux-redesign.md` (승인된 운영 범위 `2026-10-18-partner-reservation-operations-design.md`를 바꾸지 않는다) |
| 레퍼런스 조사 | `reports/design/2026-10-19-partner-admin-benchmark.md` (1차 10/19 오전, 2차 6절 10/19 오후) |
| 검증 기록 | `reports/design/2026-10-19-partner-admin-preview-check.md` |
| 릴리스 후보 검토(Codex) | `reports/operations/service-quality-release-2026-10-18.md`, `reports/operations/partner-booking-progress-2026-10-18.md` |
| 실서비스 운영 요건 검토(환불 흐름·영역별 점검표·출시 최소 세트·결정 5개) | `reports/operations/partner-service-launch-readiness-2026-10-19.md` |
| 실제 구현(Codex 10/20) 기록 | `reports/operations/2026-10-20-dashboard-demo-parity.md`(화면·범위·검증), `2026-10-20-integrated-booking.md`(예약 연동·테스트 계정 위치·실행 자료), `2026-10-20-partner-operations.md`(API 계약·마이그레이션) — 10/20 오후 기준 미커밋 |
| 시안↔구현 화면 점검(Claude 10/20) | `reports/design/2026-10-20-partner-admin-implementation-screen-check.md` + `docs/designs/partner-admin-redesign-20261019/qa/impl-screens.cjs`·`impl-flow.cjs` (3113 로그인 후 13개 화면·흐름·터치) |

`docs/`는 `.gitignore`의 `/docs/*`에 걸린다. 시안·설계 파일은 `git add -f`로 올렸으므로 수정 후에도 `git add -f 경로`로 다시 올린다. `docs/superpowers/specs/*`의 기존 설계 문서들도 같은 방식이다.

## 3. 이어서 하는 법

```sh
git clone git@github.com:Essenly-beauty/seoul-guide_v2.git && cd seoul-guide_v2
git switch codex/service-quality-release-20261018
npm ci
python3 -m http.server 3111 --bind 127.0.0.1 --directory docs/designs/partner-admin-redesign-20261019
# 브라우저에서 http://127.0.0.1:3111/ — 첫 화면이 홈 대시보드
```

시안은 브라우저 메모리에서만 동작하고 새로고침하면 초기화된다. 오른쪽 위 ‘예약 연동 후 예시 / 현재 제공 범위’로 두 상태를 비교한다. 검증은 `docs/designs/partner-admin-redesign-20261019/qa/README.md`.

### 재개 체크리스트 (로그인 직후 10분)

1. 이 문서 4절(한 일)·6절(대기 질문)·7절(다음 단계)을 읽는다.
2. `git fetch && git switch codex/service-quality-release-20261018 && git log --oneline -6` — 맨 위가 ‘docs: 실제 관리자 구현 화면 점검…’ 커밋이면 이 문서와 같은 상태다. 더 새 커밋이 있으면 그 커밋 메시지부터 읽는다. **`git status`에 `app/partner/*`·`components/partner/*` 등 대량 변경이 미커밋으로 보이면 Codex 세션의 작업 중 상태다** — 통째로 커밋·되돌리기 하지 말고 8절을 읽는다.
3. 위 명령으로 시안 서버를 띄우고 홈 → 매장 정보 → 예약 캘린더 순으로 한 번 훑는다.
4. `node docs/designs/partner-admin-redesign-20261019/qa/ops-verify.cjs`와 `cal-verify.cjs`로 206개 통과를 확인한다(Playwright 필요: `npx playwright install chromium`).
5. 사용자가 6절 질문에 답했는지 확인한다. 답이 있으면 설계 문서 ‘승인 전 확인할 질문’을 확정 사항으로 옮기고, 없으면 시안 범위 안에서만 작업한다.
6. 이 기기(`/Users/hanmyeong-gwan`)라면 작업 클론은 `mobile_design/.worktrees/service-quality-20261018`이고 서버는 그 폴더에서 띄운다. 다른 기기라면 위 clone 절차를 쓴다.

앱 자체를 실행하려면 기존 `docs/HANDOFF.md`(Supabase·Vercel·env) 절차를 따른다. 이 브랜치의 앱 테스트는 10/19 01:49 기준 1,915개, DB 테스트 552개, 타입·린트·빌드 통과(`partner-booking-progress-2026-10-18.md`).

## 4. 지금까지 한 일 (시간순)

1. **10/14–10/18 (Codex)**: 배포 계정 분리(GitHub `gksaudrhks12-sys`, SSH 키 `~/.ssh/id_ed25519_gksaudrhks12_sys`), 공유 목록 보안 릴리스(PR #4, main 병합), 서비스 품질 개선 릴리스 후보, 예약 시스템 기획(즉시 확정·예약금, 미용실·네일·헤드스파 우선), 업체 관리자 1차 구현(`components/partner/*`: 카테고리·메뉴, 담당자·제공 메뉴·근무 일정, 저장 실패·충돌 복구). 로컬 QA 환경에서 담당자 저장·격리·읽기 전용 검증.
2. **10/19 오전 (Codex → 사용량 한도로 중단)**: 사용자가 관리자 UI/UX 불편을 지적 → 네이버·토스·카카오비즈니스·마메드네 공개 자료 조사 → 재설계 시안 v1(목록→선택→편집, 일정은 ‘매주 반복/특정 날짜’).
3. **10/19 (Claude)**: 시안 v1 모바일 검증·결함 5건 수정. 사용자 요청으로 **v2 예약 캘린더**(일간=디자이너별 열, 주간=요일 열, 모바일=목록 우선, 빈 칸 → 예약 추가/시간 막기/휴무, 예약 상세, 고객 화면 미리보기에 디자이너 선택). 이어서 **v3**: 네이버 예약 운영 도움말·공비서/헤어짱/Fresha/Booksy·국내 대시보드 디자인 언어 조사 후 홈 대시보드, 예약 목록, 고객, 통계, 알림 설정, 처리 규칙(완료·노쇼는 시작 후만·철회 불가, 취소 사유 필수, 시간 변경 시 고객 알림), 시간 막기 매주 반복, 시각 토큰 교체(Pretendard·흰 카드·hairline·radius 14). 자동 검증 126개 통과. 이어서 **v3.1**: 캘린더 열 머리·칩·담당자 화면·고객 미리보기에 원형 담당자 아바타(사진 없으면 색 실루엣, 기본정보 탭에 사진 올리기 자리), 구글 캘린더식 끌어서 옮기기(15분 단위, 디자이너·날짜 간, 놓으면 확인 상자, 제공 메뉴·겹침 검사). 검증 136개. 이어서 **v3.2**(사용자 요청): 예약 목록·홈에서 ‘+ 예약 추가’가 바로 입력 폼을 열도록 수정(캘린더 밖에서는 팝업이 안 보이던 문제), 캘린더 **월간 보기**(휴무·출근 디자이너·예약 미리보기), **출근표**(디자이너별 날짜 단위 출근/휴무, 되돌리기), **메시지**(앱 예약 상세에서 온 고객 대화, 빠른 답장, 읽지 않음 배지, 홈 할 일 연동), **메뉴 사진** 자리. 검증 171개(ops 103 + cal 68).
4. **10/19 저녁 (Claude)**: 사용자 질문 “매장 정보를 바꾸면 지도·상세페이지에 자동 반영되나” → 현재는 아님(상세페이지는 정적 생성 데이터, 업체↔장소 연결 없음)이라고 답하고, **v3.3** 매장 정보 화면을 ‘설정에서 자동 반영 / 저장하면 즉시 반영 / 운영팀 검수 후 반영’ 3단계 + 고객 앱 상세페이지 미리보기(검수 중 표시) + 홈 할 일 연동으로 교체. 검증 187개(ops 119 + cal 68).
5. **10/19 밤 (Claude, “하던 작업 계속” 요청)**: 운영 요건 검토에서 비어 있던 관리자 항목을 시안 **v3.4**로 채움 — 예약별 결제·환불 상태 칩(예약 상세·목록·정산 공통), **정산** 화면(월 선택, 수납/환불/정산 대상/지급 예정 KPI, 예약별 명세, 지난달 지급 완료 예시; 돈의 흐름 기본안 가정·수수료 예시 10% 표기), 메뉴·디자이너 **영문 이름**(편집기·담당자 폼·고객 미리보기 영문 우선·홈 할 일), 터치 기기에서 예약 블록을 잡아도 스크롤되도록 `touch-action` 수정(길게 누른 뒤 끌기만 이동), 토스트가 클릭을 가로채지 않도록 수정. 검증 206개(ops 135 + cal 71, CDP 터치 포함).

6. **10/19 밤–10/20 오후 (Codex, 같은 클론·커밋 전)**: 시안 v3.4를 실제 앱에 연결 — 예약 원장(`customer_bookings`·이벤트)과 고객 예약 흐름(메뉴→담당자→시간→확인, 내 예약, 취소, 대화), 관리자 13개 화면(`app/partner/{calendar,bookings,customers,messages,statistics,roster,rules,settlement}` 신설 + 기존 services·staff·availability·settings 재구성, `components/partner/dashboard.css`), 운영 API(`/api/partner/operations/*`: 전화·방문 예약, 확정·취소·완료·미방문·시간 변경, 고객 메모, 메시지, 매장 정보 즉시/검수, 담당자 영문, 사진 업로드), 마이그레이션 4개(로컬만). 결제 모드는 `pay_at_venue`, 예약금·수수료는 ‘결정 전’ 표기. DB 150·동시성 28·HTTP 178·단위 2,223개 통과. 브라우저 화면·터치 검증은 Chrome 정책 차단으로 미완료.
7. **10/20 오후 (Claude)**: 6의 빈칸을 Playwright로 채움 — 3113 로그인 후 13개 화면 PC·모바일 캡처(HTTP 200·오류 0·넘침 0), 전화 예약 추가→캘린더→모바일 터치(쓸기=스크롤, 길게 누른 뒤 끌기=이동 안내)→상세→업체 취소 흐름 통과. 결함 14건 기록(로그인 폼 하이드레이션 전 GET 제출로 비밀번호 URL 노출, 예약 목록 필터 행 찌그러짐, 모바일 머리 버튼 줄바꿈, 상태 탭 겹침, 출근표가 반복 영업시간을 반영 안 함, 주간 머리 잘림 등). 스크립트 `qa/impl-screens.cjs`·`qa/impl-flow.cjs` 추가. 코드는 손대지 않았다(Codex 세션이 작업 중).

커밋(모두 GitHub에 푸시됨): `74be7d8` 시안 v3 + 조사 + 핸드오프 → `163f867` 아바타·끌어서 옮기기(v3.1) → `838d020` 월간·출근표·메시지·메뉴 사진·예약 추가 수정(v3.2) → `27b1d73` 실서비스 운영 요건 검토 → `d4ae672` 매장 정보 3단계 반영(v3.3) → `d341fd3` 핸드오프 갱신 → `c66c5db` 정산·결제 상태·영문 이름·터치(v3.4) → 다음 커밋 구현 화면 점검(10/20). **Codex의 10/20 구현(6번)은 아직 어떤 커밋에도 없다.**

## 5. 사용자 결정 사항 (이미 정해진 것)

- 예약은 **즉시 확정**, 예약금 있음. 네이버 예약 연동 대신 자체 예약 + 업체 관리자.
- 관리자는 **예약 운영에 집중**(메뉴·담당자·일정·예약 처리). 매장 소개·사진은 플랫폼 운영팀이 관리. → 10/19 저녁 시안 v3.3에서 ‘업체가 올리고 운영팀이 검수’로 완화하는 안을 제안했고 사용자 확인 대기(6절 6번).
- 캘린더는 구글 캘린더 느낌 + 시간·담당자·예약자 정보가 한눈에. 빈 시간에서 예약 추가와 시간 막기·휴무 둘 다.
- 헤어샵은 고객이 **디자이너를 직접 선택**한다(‘아무나 배정’ 없음). 서버는 이미 담당자 선택형/매장 예약형을 지원한다.
- 지도는 현행(Leaflet+CARTO) 유지.

## 6. 사용자 확인 대기 (답이 오면 반영)

0. **운영 요건 검토의 결정 5개**(돈의 흐름, 예약금·환불 스케줄, 결제사, 파일럿 업체, 운영팀 역할) — `partner-service-launch-readiness-2026-10-19.md` 4절.

1. 홈 KPI 4개(오늘 예약·방문 완료·노쇼·현장 결제 예정)와 할 일 항목이 아침에 보고 싶은 것과 맞는가.
2. 업체가 직접 넣는 예약이 근무시간 밖이거나 휴게와 겹칠 때: 시안은 경고 후 허용(다른 예약·막은 시간·휴무일은 차단).
3. 고객 연락처·메모를 우리 서버에 보관하는 기간과 마스킹(네이버는 6개월 후 마스킹) — 운영팀 결정.
4. 일부러 뺀 것 중 필요한 게 있는가: 블랙리스트, 마케팅 문자 발송, 환불 금액을 업체가 고르는 기능, 예약 길이 드래그 조절. (끌어서 옮기기는 10/19 요청으로 추가함.)
5. PC에서 초기 설정 + 모바일에서 당일 처리라는 가정.
6. 매장 정보: 업체가 직접 고칠 항목과 즉시/검수 구분(시안: 전화·영어 응대·임시 안내는 즉시, 이름·주소·소개·사진은 검수, 1영업일)이 맞는가.
7. 정산 화면의 가정(플랫폼 수납 후 월 정산, 예약금 정액 1만 원, 업체 취소 전액 환불·고객 당일 취소 0%, 수수료 예시 10%, 익월 10일 지급)이 결정과 맞는가. 결정되면 문구·숫자만 바꾼다.

## 7. 다음 단계 (승인 후)

**10/20 추가.** 아래 1~3·6~8의 상당 부분을 Codex가 10/20에 구현했다(4절 6번, 커밋 전). 지금 당장의 순서는 (0) Codex 작업을 검토해 커밋·푸시(테스트 2,223개·typecheck·lint 통과 상태라고 보고됨) → (0b) 화면 점검 결함 A~F 수정(`reports/design/2026-10-20-partner-admin-implementation-screen-check.md` 2절) 후 `qa/impl-screens.cjs`·`qa/impl-flow.cjs` 재실행 → (0c) 실제 기기 터치·고객 예약 흐름 확인. 그 뒤 아래 항목 중 남은 것(알림, 결제·환불 실제 연동, 검수 큐 운영 화면, 원격 DB 마이그레이션·배포)으로 간다.

1. 공통 shell·탐색·목록-상세·독립 탭과 예약 캘린더(일간·주간·모바일 목록)를 현재 API(근무·휴게·막은 시간·날짜 예외, `merchant_schedules`/`merchant_staff_schedules`의 `hours/breaks/blocks/overrides`)에 연결. 반복 막기는 `blocks`의 `weekday` 규칙.
2. 예약 저장(앱 예약 + 업체 입력 전화·방문)과 업체별 고객 테이블은 **아직 서버에 없다**. 이 둘이 생겨야 홈 KPI·예약 목록·고객·통계·최근 활동이 실제 데이터로 동작한다. 그 전에는 ‘현재 제공 범위’ 화면만 노출.
3. 고객 앱 `components/booking/booking-sheet.tsx`는 고정 데이터 데모라 디자이너 선택 단계가 없다. 관리자 데이터(메뉴 → 제공 디자이너 → 가용 시간)로 교체.
4. 알림(사장님·담당 디자이너 푸시, 고객 리마인드, 아침 요약)은 발송 채널 승인 후.
5. 업체 시나리오 테스트(‘메뉴 추가’, ‘담당 메뉴 연결’, ‘다음 화요일 휴무’, ‘오늘 예약 상세 확인’을 설명 없이 수행) 후 배포 여부 결정.
6. 메시지: `conversations`/`messages` 테이블 + RLS + Supabase Realtime 구독 + 앱 예약 상세의 입력 UI + 사업자 푸시. 예약 저장 테이블 이후. 출근표는 기존 `overrides`(날짜+hours+breaks)로 표현되므로 스키마 추가 없음. 메뉴 사진은 Storage 버킷 + `merchant_services`에 이미지 경로 추가.
7. 매장 정보 연동: `merchants`↔장소 id 연결 컬럼(운영팀 승인), 즉시 반영 항목(전화·영어 응대·임시 안내)을 상세페이지가 DB에서 덮어쓰기(ISR 재검증), 검수 큐(1단계는 수동), 사진 Storage. 예약 저장 테이블과 독립이라 먼저 할 수 있다.
8. 결제·환불 상태: 예약 테이블에 결제 상태·환불 상태·환불 완료일 컬럼을 두고 결제사 웹훅으로 갱신(예약 상태와 분리). 정산은 1단계 수동(스프레드시트)이므로 화면은 읽기 전용 명세부터, 수수료율·지급일은 설정값. 영문 이름은 `merchant_services`·`merchant_staff`에 컬럼 추가.

## 8. 주의할 점

- **메인 작업 폴더 `/Users/hanmyeong-gwan/mobile_design`은 여러 세션이 함께 쓴다.** 거기서 `git merge`·`reset`·파일 통째 커밋 금지. 이 브랜치는 별도 클론 `.worktrees/service-quality-20261018`에서 작업했고, 그 클론의 `origin`은 로컬 경로다(GitHub 푸시는 `git push git@github.com:Essenly-beauty/seoul-guide_v2.git 브랜치`).
- 푸시는 개인 계정 키로: `GIT_SSH_COMMAND="ssh -i ~/.ssh/id_ed25519_gksaudrhks12_sys -o IdentitiesOnly=yes" git push …`. `~/.ssh/config`의 기본 github.com 키는 회사 계정이다.
- 시안의 루트 레이아웃 클래스가 `.app`이라 상태·세그먼트 클래스 이름으로 `app`을 쓰면 충돌한다(`k-app`, `s-app` 사용). `.now`(캘린더 현재 시각 선)·`.warn`도 이미 쓰인다. 새 클래스는 접두어를 붙이고, 넣기 전에 기존 `<style>`과 이름을 대조한다.
- 시안은 HTML 한 파일이라 Claude/Codex가 고칠 때는 파이썬 치환 스크립트로 넣는 편이 안전하다. 한글이 들어간 스크립트는 `python3 -X utf8`로 실행하고 파일 머리에 `# -*- coding: utf-8 -*-`를 둔다.
- 시안의 모든 상호·이름·연락처·금액은 가상 예시다. ‘연동 후 예시’ 숫자를 실제 통계로 옮기지 않는다.
- **이 클론도 10/20부터 Codex 세션과 함께 쓴다.** 커밋 전에 `git status`로 남의 변경을 확인하고, 자기 파일만 `git add 경로`로 올린다(`git add -A`·`git commit -a` 금지). Codex가 만든 미커밋 변경은 되돌리거나 stash 하지 않는다.
- 로컬 테스트 계정은 `$TMPDIR/myseouldrop-booking-local-access.json`(Codex 프로비저닝 스크립트가 생성, 권한 600). 스크립트는 이 파일을 읽기만 하고 값은 저장소·보고서·대화에 적지 않는다.
- 로그인 폼은 하이드레이션 전에 제출되면 GET으로 비밀번호가 URL에 실린다(화면 점검 결함 A). 자동화에서는 `#signin-email`이 뜬 뒤 2초 기다렸다 제출한다. 고쳐지면 이 주의는 지운다.
- Codex(VS Code)는 10/19 오전에 사용량 한도였지만 10/19 밤부터 다시 동작했다. Claude 쪽 메모리는 기기·계정별이므로 이 문서가 기준이다.

## 9. 2026-10-20 밤 추가 (사용량 한도로 중단된 상태)

- **QA 보고서** `reports/design/2026-10-20-webapp-admin-propagation-qa.md`(4차; Codex 채점 7/10 — 남은 요구: 회원 메시지·시간 변경·고객 취소 왕복과 검색→지도→상세 실측, 과거 소스 보관본). 원본 증거는 `.gstack/qa-reports/run-20261020T105544Z-webapp/`(gitignore, 이 기기에만 있음).
- **DB 구조 제안 2판** `reports/architecture/2026-10-20-database-architecture-proposal.md`(Codex 채점 7/10 — 남은 요구: 지연 트리거 무잠금 주장 제거·큐/재시도 계약, 기존 프로필·미디어 응답 재현 필드, 연결 해제 vs 장소 비공개 구분·캐시 무효화·ETag, 리뷰 집계 제외 또는 전체 이벤트, 권한 DDL·정합성 검사·트리거 롤백 이름).
- **코드 변경(미커밋, Codex 작업 트리와 같은 파일 포함)**: 비회원 ♥ 미보관(`lib/favorites.ts`·`favorite-button`·상세 Save·지도 공유 목록·`signin-nudge`·`signup-return-notice`·favorites 문구·i18n), 스켈레톤 로딩(`components/ui/skeleton.tsx`, `app/loading.tsx`, 고객 예약·메뉴·저장 목록 로딩 상태, globals.css), 상세 사진 헤더(커버 타일·+N·라이트박스, Photos 섹션·탭 제거, `.place-hero-chrome`), 썸네일 cover, 첫 리뷰 유도(TravelerReviews), 지하철 트랙 밀도(`data-density` + CSS; 16/39/60정거장 342px에서 넘침 없음 실측), **관리자 ‘고객 화면 사진 영역’ 스위치**(마이그레이션 `20261020123000_store_profile_show_photos.sql` — 로컬 DB에만 적용, `profile-contracts.ts` showPhotos, `place-profile.ts` photosEnabled, 관리자 토글·미리보기). 검증: typecheck·lint 통과, vitest 36파일 938개 통과, Playwright `scripts/verify-impl*.cjs`·`verify-toggle.cjs` 통과(비회원 ♥→가입 시트→로그인 복귀 시 저장, 토글 왕복 9/9). Codex 코드 리뷰는 요청해 둔 상태(결과 미확인, `codex-impl1.log`는 scratchpad에만).
- 원격 DB에는 아무것도 적용하지 않았다. 이 코드 변경을 커밋하려면 Codex의 미커밋 변경과 섞이므로 파일 단위로 조정이 필요하다.
