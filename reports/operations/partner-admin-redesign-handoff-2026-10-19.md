# 파트너 예약 관리자 재설계 — 핸드오프 (2026-10-19)

다른 계정·다른 기기에서 이 작업을 그대로 이어가기 위한 문서. 이 문서 하나와 브랜치만 있으면 된다.

## 1. 지금 상태 한 줄

업체용 예약 관리자(`/partner/*`)의 **UX 재설계 시안 v3**가 사용자 검토 대기 중이다. 시안은 승인 전 인터랙션 목업이며, 실제 앱·서버·DB·배포는 바꾸지 않았다. 승인되면 시안을 현재 API에 연결하는 구현 단계로 넘어간다.

## 2. 어디에 무엇이 있나

| 항목 | 위치 |
| --- | --- |
| 작업 브랜치 | `codex/service-quality-release-20261018` (GitHub `Essenly-beauty/seoul-guide_v2`). 운영 기준 커밋 `c6c4b94`(main) 위에 올라간 릴리스 후보 + 이 시안 |
| 시안(클릭 가능한 HTML 1장) | `docs/designs/partner-admin-redesign-20261019/index.html` |
| 시안 자동 검증 | `docs/designs/partner-admin-redesign-20261019/qa/` (README에 실행법) |
| 설계 문서 | `docs/superpowers/specs/2026-10-19-partner-admin-ux-redesign.md` (승인된 운영 범위 `2026-10-18-partner-reservation-operations-design.md`를 바꾸지 않는다) |
| 레퍼런스 조사 | `reports/design/2026-10-19-partner-admin-benchmark.md` (1차 10/19 오전, 2차 6절 10/19 오후) |
| 검증 기록 | `reports/design/2026-10-19-partner-admin-preview-check.md` |
| 릴리스 후보 검토(Codex) | `reports/operations/service-quality-release-2026-10-18.md`, `reports/operations/partner-booking-progress-2026-10-18.md` |
| 실서비스 운영 요건 검토(환불 흐름·영역별 점검표·출시 최소 세트·결정 5개) | `reports/operations/partner-service-launch-readiness-2026-10-19.md` |

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

앱 자체를 실행하려면 기존 `docs/HANDOFF.md`(Supabase·Vercel·env) 절차를 따른다. 이 브랜치의 앱 테스트는 10/19 01:49 기준 1,915개, DB 테스트 552개, 타입·린트·빌드 통과(`partner-booking-progress-2026-10-18.md`).

## 4. 지금까지 한 일 (시간순)

1. **10/14–10/18 (Codex)**: 배포 계정 분리(GitHub `gksaudrhks12-sys`, SSH 키 `~/.ssh/id_ed25519_gksaudrhks12_sys`), 공유 목록 보안 릴리스(PR #4, main 병합), 서비스 품질 개선 릴리스 후보, 예약 시스템 기획(즉시 확정·예약금, 미용실·네일·헤드스파 우선), 업체 관리자 1차 구현(`components/partner/*`: 카테고리·메뉴, 담당자·제공 메뉴·근무 일정, 저장 실패·충돌 복구). 로컬 QA 환경에서 담당자 저장·격리·읽기 전용 검증.
2. **10/19 오전 (Codex → 사용량 한도로 중단)**: 사용자가 관리자 UI/UX 불편을 지적 → 네이버·토스·카카오비즈니스·마메드네 공개 자료 조사 → 재설계 시안 v1(목록→선택→편집, 일정은 ‘매주 반복/특정 날짜’).
3. **10/19 (Claude)**: 시안 v1 모바일 검증·결함 5건 수정. 사용자 요청으로 **v2 예약 캘린더**(일간=디자이너별 열, 주간=요일 열, 모바일=목록 우선, 빈 칸 → 예약 추가/시간 막기/휴무, 예약 상세, 고객 화면 미리보기에 디자이너 선택). 이어서 **v3**: 네이버 예약 운영 도움말·공비서/헤어짱/Fresha/Booksy·국내 대시보드 디자인 언어 조사 후 홈 대시보드, 예약 목록, 고객, 통계, 알림 설정, 처리 규칙(완료·노쇼는 시작 후만·철회 불가, 취소 사유 필수, 시간 변경 시 고객 알림), 시간 막기 매주 반복, 시각 토큰 교체(Pretendard·흰 카드·hairline·radius 14). 자동 검증 126개 통과. 이어서 **v3.1**: 캘린더 열 머리·칩·담당자 화면·고객 미리보기에 원형 담당자 아바타(사진 없으면 색 실루엣, 기본정보 탭에 사진 올리기 자리), 구글 캘린더식 끌어서 옮기기(15분 단위, 디자이너·날짜 간, 놓으면 확인 상자, 제공 메뉴·겹침 검사). 검증 136개. 이어서 **v3.2**(사용자 요청): 예약 목록·홈에서 ‘+ 예약 추가’가 바로 입력 폼을 열도록 수정(캘린더 밖에서는 팝업이 안 보이던 문제), 캘린더 **월간 보기**(휴무·출근 디자이너·예약 미리보기), **출근표**(디자이너별 날짜 단위 출근/휴무, 되돌리기), **메시지**(앱 예약 상세에서 온 고객 대화, 빠른 답장, 읽지 않음 배지, 홈 할 일 연동), **메뉴 사진** 자리. 검증 171개(ops 103 + cal 68).

## 5. 사용자 결정 사항 (이미 정해진 것)

- 예약은 **즉시 확정**, 예약금 있음. 네이버 예약 연동 대신 자체 예약 + 업체 관리자.
- 관리자는 **예약 운영에 집중**(메뉴·담당자·일정·예약 처리). 매장 소개·사진은 플랫폼 운영팀이 관리.
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

## 7. 다음 단계 (승인 후)

1. 공통 shell·탐색·목록-상세·독립 탭과 예약 캘린더(일간·주간·모바일 목록)를 현재 API(근무·휴게·막은 시간·날짜 예외, `merchant_schedules`/`merchant_staff_schedules`의 `hours/breaks/blocks/overrides`)에 연결. 반복 막기는 `blocks`의 `weekday` 규칙.
2. 예약 저장(앱 예약 + 업체 입력 전화·방문)과 업체별 고객 테이블은 **아직 서버에 없다**. 이 둘이 생겨야 홈 KPI·예약 목록·고객·통계·최근 활동이 실제 데이터로 동작한다. 그 전에는 ‘현재 제공 범위’ 화면만 노출.
3. 고객 앱 `components/booking/booking-sheet.tsx`는 고정 데이터 데모라 디자이너 선택 단계가 없다. 관리자 데이터(메뉴 → 제공 디자이너 → 가용 시간)로 교체.
4. 알림(사장님·담당 디자이너 푸시, 고객 리마인드, 아침 요약)은 발송 채널 승인 후.
5. 업체 시나리오 테스트(‘메뉴 추가’, ‘담당 메뉴 연결’, ‘다음 화요일 휴무’, ‘오늘 예약 상세 확인’을 설명 없이 수행) 후 배포 여부 결정.
6. 메시지: `conversations`/`messages` 테이블 + RLS + Supabase Realtime 구독 + 앱 예약 상세의 입력 UI + 사업자 푸시. 예약 저장 테이블 이후. 출근표는 기존 `overrides`(날짜+hours+breaks)로 표현되므로 스키마 추가 없음. 메뉴 사진은 Storage 버킷 + `merchant_services`에 이미지 경로 추가.

## 8. 주의할 점

- **메인 작업 폴더 `/Users/hanmyeong-gwan/mobile_design`은 여러 세션이 함께 쓴다.** 거기서 `git merge`·`reset`·파일 통째 커밋 금지. 이 브랜치는 별도 클론 `.worktrees/service-quality-20261018`에서 작업했고, 그 클론의 `origin`은 로컬 경로다(GitHub 푸시는 `git push git@github.com:Essenly-beauty/seoul-guide_v2.git 브랜치`).
- 푸시는 개인 계정 키로: `GIT_SSH_COMMAND="ssh -i ~/.ssh/id_ed25519_gksaudrhks12_sys -o IdentitiesOnly=yes" git push …`. `~/.ssh/config`의 기본 github.com 키는 회사 계정이다.
- 시안의 루트 레이아웃 클래스가 `.app`이라 상태·세그먼트 클래스 이름으로 `app`을 쓰면 충돌한다(`k-app`, `s-app` 사용).
- 시안의 모든 상호·이름·연락처·금액은 가상 예시다. ‘연동 후 예시’ 숫자를 실제 통계로 옮기지 않는다.
- Codex(VS Code)는 10/25까지 사용량 한도. 그 전까지는 Claude Code에서 이어간다. Claude 쪽 메모리는 기기·계정별이므로 이 문서가 기준이다.
