# UX·인터랙션 리뷰 2026-09 — 드로어/팝업 · 지하철 출발/도착 피커

작성 2026-09-20 · 대상 MYSEOULDROP `/map` (Next.js 15 / React 19, iOS Safari 17+ / Android Chrome)
검증 방식: 소스 직독(file:line) + 라이브 Playwright 계측(390×844 @3x, iPhone UA) + 3개 렌즈 교차검증(exists / decisions / platform)
근거 규칙은 `docs/research/raw/02-mobile-ux.md`, `docs/research/raw/03-accessibility.md`, `docs/research/raw/04-pwa-offline-ios.md`의 1차 출처를 인용했습니다.

---

## 0. 결론

**지하철 출발/도착 피커 — 개선 필요합니다. 단, 정보구조가 아니라 네 군데의 기계적 결함입니다.** 의미론 레이어는 오히려 상당히 좋습니다: W3C APG 콤보박스 패턴을 거의 완전히 구현했고(role / aria-autocomplete / aria-expanded / aria-controls / aria-activedescendant, 방향키+Enter, WCAG 2.5.7을 만족하는 버튼 기반 경유지 재정렬, Cancel로 복원되는 draft), 영문·한글 검색 결과가 동일하다는 것을 라이브로 확인했습니다. 고쳐야 할 네 가지는 (1) iOS 키보드가 올라온 상태에서 6개 결과 중 2개만 보이고 완전히 보이는 것은 1개 — 결과 패널 하단이 화면 아래 56px에 있고, `window.visualViewport`를 읽는 코드가 `map-view.tsx` 외에는 어디에도 없으며 입력 중에도 헤더(64px)와 비활성 푸터(92px)가 그대로 남습니다; (2) 하단 고정 역 스테퍼가 `position:absolute; bottom:0`(globals.css:3711)인데 스크롤러 하단 패딩은 18px뿐(:356)이라 목록 마지막 **약 80px가 영구히 도달 불가** — 장식 문제가 아니라 WCAG 2.4.11 실패; (3) `searchStations`가 키 입력마다 600개 역 × 약 4개 용어를 8개 정규식 체인으로 다시 정규화(`lib/subway.ts:111-125`) — 타이핑 지연의 원인; (4) 스테퍼 버튼 34px·지도 칩 40px로 **프로젝트가 스스로 문서화한 44px 하한**(2026-08-22 스펙:105) 미달. 매치 하이라이트 없음, 포커스 중에만 나타나는 ✕ 등 검색 폴리시는 실재하지만 2순위입니다.

**드로어/팝업 — 절반은 손댈 것이 없고, 절반은 전면적으로 필요합니다.** `components/map/map-sheet.tsx`는 이미 Apple 수준입니다: 마우스·실제 CDP 터치 양쪽에서 transform이 포인터를 **오차 0.0px로 1:1 추종**하고, 첫 추종 프레임 전에 `transition-duration`이 0s로 떨어지며, 릴리즈는 속도를 승계하는 WAAPI 스프링(stiffness 260 / damping 30, 감쇠비 0.93)으로 293ms 만에 오버슈트 없이 안착합니다 — 대부분의 상용 웹 시트보다 낫습니다. 문제는 그 **주변부 전부**입니다. 눌림 상태가 앱 어디에도 없습니다: CSS 6,407줄에 `:active` 규칙이 정확히 2개, `-webkit-tap-highlight-color` 0개, `touch-action: manipulation` 0회 — `:hover`가 발생하지 않는 터치에서는 모든 행·칩·버튼이 손가락 아래에서 죽은 것처럼 보입니다. 모든 오버레이는 들어올 때만 애니메이션하고 나갈 때는 잘립니다(필터 시트: 진입 300ms, 퇴장 49.8ms·무애니메이션). 공용 `components/ui/bottom-sheet.tsx`(필터·피드백·로그인 넛지)는 포인터 핸들러가 전무해 200px 아래 드래그를 무시했고, 자기 CSS가 스타일링하는 `.sheet .handle` 그래버를 렌더링조차 하지 않습니다. 그리고 history 엔트리를 쌓는 코드가 전무해서 Android 뒤로가기가 레이어를 닫는 대신 앱을 벗어납니다. 지하철 패널은 별개의 최악 사례입니다: 그립에 `onPointerMove`가 없어(subway-route-controller.tsx:501-514) 200px 드래그 내내 패널 상단이 320.7px에 **얼어붙어 있다가** 릴리즈에서 점프했고, 레이아웃 속성인 `height`를 애니메이션해 14장 이상의 카드를 담은 패널을 매 프레임 리레이아웃합니다. "Apple 앱처럼 안 움직인다"는 체감의 대부분이 여기에서 나옵니다.

---

## 1. 이미 잘 되어 있는 것 (건드리지 말 것)

| 영역 | 확인된 내용 |
|---|---|
| 맵시트 드래그 물리 | 마우스 12스텝·실터치 9스텝 모두 1:1 오차 0.0px, `.dragging`이 첫 추종 프레임 전 transition 0s, 릴리즈 293ms 무오버슈트. `lib/map-sheet-state.ts`가 순수·단위테스트된 모델(iOS 고무줄 계수 0.55 :64, 플릭 0.45 px/ms :29-59, 스프링 260/30/1 = 감쇠비 0.93) |
| 프로그램 스냅 곡선 | `transform 0.42s cubic-bezier(0.32,0.72,0,1)`(:4303) — Vaul이 iOS 시트 모방용으로 문서화한 Ionic 곡선과 동일, transform 전용이라 리레이아웃 없음 |
| 스크롤 vs 드래그 핸드오프 | map-sheet.tsx:322-329 — 스크롤러가 최상단이고 아래로 당길 때만 시트가 제스처를 가져감. 수평 제스처는 콘텐츠/OS에 반환(:321), 포토 레일은 `overscroll-behavior-x: contain` |
| reduced-motion | `@layer base`의 전역 블록(:248-253)이 `!important`로 레이어 역전 → 모든 컴포넌트 애니메이션 제압. 라이브 계측에서 전 표면 none/none, 드래그 릴리즈 46.4ms 즉시 커밋, JS도 준수(map-sheet.tsx:274-277) |
| WCAG 2.5.7 드래그 대체수단 | 그래버 탭/Enter·Space 스냅 순환, 지하철 그립 동일(:516-527), 경유지 재정렬은 44px 버튼, 티켓 트랙은 `role="slider"` — 레트로핏이 아니라 설계상 충족 |
| 역 콤보박스 의미론 | APG 패턴 거의 완전 구현(role/aria-autocomplete/expanded/controls/activedescendant/invalid/describedby, listbox+option+aria-selected, 위아래 래핑, Enter 커밋, reduced-motion 존중하는 `scrollIntoView({block:"nearest"})`), 옵션 내부에 중첩 인터랙티브 요소 없음 |
| 이중언어 검색 | "gangnam"과 "강남"이 동일한 정확한 2행 반환(라이브 확인), 한글명에 `lang="ko"`(WCAG 3.1.2), 노선 배지는 상대휘도로 전경색 계산 — 색상 단독 의존 아님 |
| 모바일 입력 설정 | `type=search inputMode=search enterKeyHint=search autoComplete=off spellCheck=false` 16px, layout.tsx:42-48 `interactiveWidget: "resizes-content"` + `maximumScale`/`userScalable` 없음 → iOS 줌 점프 0건, 핀치줌 차단 없음 |
| 데이터 정직성 | 소요시간 미표기(그래프 산술이 보장 못 함), 거리는 "역 중심 직선거리"로 라벨, "Live" 배지 제거, 티켓엔 정거장·환승만. 엔드포인트 편집은 draft라 Cancel로 복원(WCAG 3.3.7) |
| 모달 다이얼로그 | `role="dialog"`+`aria-modal`, 열 때 Close로 포커스 이동, Tab 트랩, Escape, 닫을 때 호출 칩으로 복원 — 공용 `use-dialog-focus.ts` 하나로 처리(iOS 키보드가 튀지 않게 일부러 텍스트 입력이 아닌 첫 컨트롤에 포커스). HamburgerMenu만 미사용(3줄 수정) |
| 안전영역 | 모든 하단 크롬에 `env(safe-area-inset-bottom)` 일관 적용, `100vh` 0회, 스티키 CTA는 `flex:none`+`padding-bottom: max(10px, env(...))` |
| 스크롤 성능 | 4× CPU 스로틀에서 2,400px 스크롤 p50 16.4ms / p95 23.1ms, 32ms 초과 프레임 0. 남은 비용은 초기 렌더(878행·678이미지·11,512노드)이며 이는 HANDOFF §4의 "장소 데이터 번들 분할" 항목 — 별도 트랙 |
| z-index 격리 | 지도용 서브스케일을 의도적으로 가둬(:3537-3545, 근거 주석 포함) 포털 다이얼로그가 항상 승리. 선택된 장소 위에 필터 시트를 열어도 `.mapsheet`(950) 위에 오버레이(80)가 정상 도색 |

---

## 2. 권장 개선안 (검증 통과)

| ID | 영역 | 우선 | 효과 | 난이도 | 요약 |
|---|---|---|---|---|---|
| R1 | 터치 피드백(앱 전역) | **P0** | 최대 | S | 눌림 상태 0개 + 탭 지연 — 약 20줄 CSS |
| R2 | 지하철 패널 레이아웃 | **P0** | 큼 | S | 고정 스테퍼가 목록 마지막 ~80px를 영구 가림 |
| R3 | 피커 키보드 대응 | **P0** | 큼 | M | 키보드 올라오면 결과 1개만 완전 노출 |
| R4 | 지하철 그립 물리 | **P0** | 큼 | L | 손가락을 따라오지 않고 `height`를 애니메이션 |
| R5 | 뒤로가기 해제 | P1 | 큼 | M/L | 어떤 오버레이도 Back으로 안 닫힘 → 앱 이탈 |
| R6 | 진입/퇴장 대칭 | P1 | 중 | M | 모든 시트·모달이 1프레임에 잘려나감 |
| R7 | 탭 vs 드래그 | P1 | 중 | S | 4px 슬롭이 걷는 중 탭을 훔침 |
| R8 | 터치 타깃 | P1 | 중 | S | 5개 컨트롤 계열이 자체 44px 하한 미달 |

### R1 — 눌림 상태 추가 + 탭 지연 제거 (P0 / S)

| | |
|---|---|
| 현재 | `app/globals.css` 6,407줄 중 `:active` 2개뿐(:3678 `.subway-ticket-track:active{cursor:grabbing}`, :4688 `.metro-toolbar-seg:active`). `tap-highlight` 0회, `touch-action: manipulation` 0회. `.maprow`(:4350)·`.chip`(:1677)·`.bottomnav .nav`(:2703)·`.sfchip`(:3732)는 hover조차 없음(hover 27 : active 2). framer-motion 미사용, `whileTap`/`data-pressed` 0건 |
| 변경 | 공유 규칙 `.maprow:active, .drow:active, .chip:active, .sfchip:active, .bottomnav .nav:active, .card.tap:active, .selected-place-summary-main:active { background: var(--surface-hover); transform: scale(0.98); transition: transform 90ms cubic-bezier(0.2,0,0,1), background 90ms linear }` — **파일 말미(컴포넌트 규칙 뒤)** 에 둘 것. `@layer base`에 두면 `.chip{background:transparent}`(:1683)에 진다. 풀폭 버튼은 분리: `.btn:active{filter:brightness(.94)}` + `.btn`에 `transition: filter 90ms linear`(기존 :1593 단축형이 base transition을 지움). `button,a,[role="button"]{ -webkit-tap-highlight-color: transparent; touch-action: manipulation }`는 **`@layer base`(이른 위치)** 에 두고, `.mapsheet-handle, .subway-snap-handle { touch-action: none }`(:4306, :5472)을 주석과 함께 재선언. 선택 상태 충돌: `.station-result-options > button`은 :607-608의 `aria-selected` 배경과 동일 특이도이므로 배경 교체 대신 `filter: brightness(.96)` 사용 |
| 보정 | reduced-motion이 자동 무력화한다는 주장은 **거짓** — :248-253은 `animation/transition: none`이라 `scale(0.98)`은 즉시 점프로 남음. 같은 블록에 눌림 셀렉터 `transform:none` 추가. `touch-action: manipulation`의 지연 회수 효과도 과장 — layout.tsx:43-45가 이미 `width=device-width, initialScale:1`이라 기본 배율에서는 iOS가 이미 fast tap(WebKit "More Responsive Tapping on iOS"); 이득은 확대 상태 + 더블탭 줌 억제. iOS 17+ 실기기에서 `:active`가 실제로 칠해지는지 확인한 **뒤에** tap-highlight 제거분을 배포 |
| 문서 연동 | `docs/design-system.md` §6(:95-99)은 이미 모든 인터랙티브 컴포넌트에 pressed 상태를 요구 — 되돌리는 게 아니라 **미이행 계약을 이행**. 단 §6/§4에 따라 공용 컴포넌트 CSS와 `/design` 쇼케이스에도 함께 반영해야 하고(일회성 셀렉터 나열 금지), `transform: scale()`은 컴포지터 전용이라 "색상 변화만으로 레이아웃 이동 없음" 조건 충족. `touch-action: manipulation`은 2026-07-25 스펙:10 "Allow browser text and page zoom"이 다룬 더블탭 줌 어포던스를 좁히므로 **오너에게 명시 후** 반영 |
| 출처 | NN/g *Response Times: The 3 Important Limits* (0.1초 = 즉시) nngroup.com/articles/response-times-3-important-limits/ · MDN *touch-action* (2019-09 Baseline) · Apple WWDC18 803 *Designing Fluid Interfaces* |
| 검증 | 3개 렌즈 모두 유지. exists: grep 재현(2 / 0 / 0), 인용 라인 전부 실재. decisions: design-system.md §6이 오히려 요구. platform: 기술적으로 안전, 단 `.btn` 분리·레이어 배치·iOS `:active` 선행 확인 필요 |

### R2 — 고정 역 스테퍼가 목록 마지막 ~80px를 영구히 가림 (P0 / S)

| | |
|---|---|
| 현재 | `app/globals.css:3711-3724` `.subway-station-focus.pinned{position:absolute;left:0;right:0;bottom:0;z-index:960;padding:8px 12px max(10px,env(safe-area-inset-bottom))}`. 그 아래 스크롤러는 `.subway-controller-scroll{...padding-bottom:max(18px,env(...))}`(:346-357, 유일 규칙). JSX상 바는 `.subway-controller`의 마지막 자식(subway-route-controller.tsx:1248-1277) |
| 변경 | **A안(권장)**: :3711-3717에서 `position/left/right/bottom` 삭제 + `flex:none`. `.subway-controller`는 이미 `display:flex; flex-direction:column`이고 바가 스크롤러 다음 형제라 JSX 변경 0. **B안(플로팅 그림자 유지 시)**: `.subway-controller.route-ready:not(.snap-compact) .subway-controller-scroll{ padding-bottom: calc(80px + max(0px, env(safe-area-inset-bottom,0px) - 10px)); scroll-padding-bottom: 동일 }` — `scroll-padding-bottom`은 :452-453의 `scrollIntoView` 때문에 필수 |
| 보정 | 가려지는 폭은 76/78px이 아니라 **≥80px** — `.subway-station-focus`의 `min-height`가 네 곳(:793/1095/3799/5662)에서 재정의되고 소스 순서상 **:5662의 80px가 승리**. 기존 `max(18px, env(...))`는 합이 아니라 max라 34px 인셋 기기에서도 ~46px 부족. B안은 `snap-compact`에서 렌더되지 않으므로 스냅 스코프 필요 |
| 문서 연동 | 바닥 고정은 2026-08-22 오너 결정(commit 00ca16f, 주석 subway-route-controller.tsx:1166-1168 "Kakao Metro처럼 엄지가 닿는 바닥에, 스크롤로 사라지면 안 됨"). A안도 스크롤러 밖·바닥 고정·엄지존을 모두 유지하므로 결정의 실질은 보존 — 다만 플로팅 외형은 포기. 회귀 테스트 `lib/subway-search-layout.test.ts:321-326`이 `bottom: 0;` 문자열을 전체파일 매칭으로 확인하므로 A안에서도 그린으로 남아 무의미해짐 → **같은 커밋에서 재타깃** |
| 플래그 | globals.css:5454-5456이 "snap-half는 `Near {station}` 헤더 + 한 행이 스크롤 없이 들어가게 산정(E3)"이라 기록 — 바를 인플로우로 돌리면 스크롤러가 ~80px 줄어 한 행을 잃습니다. 재측정 또는 `min(62%,580px)` 상향 필요 |
| 출처 | W3C WAI *Understanding SC 2.4.11 Focus Not Obscured (Minimum)* (WCAG 2.2 AA) — `docs/research/raw/03-accessibility.md` §A2 |
| 검증 | 3렌즈 유지. exists: 두 CSS 규칙·JSX 위치·scrollIntoView 전부 재현, 보정은 80px. decisions: 어떤 스펙도 오버레이를 요구하지 않음, 결정 실질 보존. platform: `scroll-padding-bottom`은 WebKit 179379 수정(2021-03) 후 Baseline이라 안전, 단 78px 상수는 인셋 이중계산 |

### R3 — 키보드가 올라오면 역 결과가 1개만 완전히 보임 (P0 / M)

| | |
|---|---|
| 현재 | 시각 뷰포트 390×430 라이브 계측: 결과 패널 top 246 / bottom 486 = **화면 아래 56px**, 내부 스크롤러 scrollHeight 441 vs clientHeight 238. 원인은 `app/globals.css:547-556` `.station-search-field-stack .station-search-results{position:absolute; max-height: clamp(240px, calc(78dvh - 225px), 520px)}` — 240px 하한이 실제 가용 97px 아래로 못 내려감. `grep -rn visualViewport app components lib` → `components/map/map-view.tsx:440,445` 뿐 |
| 변경 | `components/ui/use-keyboard-inset.ts`(신규, `"use client"`, `useEffect` 안에서만 `window.visualViewport` 접근): resize/scroll에서 `--kb = max(0, innerHeight - visualViewport.height - visualViewport.offsetTop)`를 documentElement에 기록, 언마운트 시 해제. CSS는 **이동이 아니라 축소**: `.subway-controller{ bottom: var(--kb,0px); max-height: calc(100% - var(--kb,0px)) }` — `max-height`는 :285/:302/:562/:3551의 네 height 변형을 한 번에 보정하고 기존 `transition: height`와 싸우지 않음. 드롭다운 자리를 예약하는 형제 규칙도 인셋 인지로: `.subway-search-fields:has(.station-search-results){ margin-bottom: clamp(0px, calc(78dvh - 219px - var(--kb,0px)), 526px) }`(:559). 결과 패널은 매직넘버 대신 기존 clamp를 상한: `max-height: min(clamp(240px, calc(78dvh - 225px), 520px), calc(100dvh - var(--kb,0px) - 200px))`. `.sheet`에도 `bottom: var(--kb,0px); max-height: calc(92% - var(--kb,0px))`(기존 퍼센트 기준 유지, :3062) |
| 보정 | 헤더는 190px이 아니라 **64px**(`.subway-controller-header`, :309), 푸터는 338-430px의 92px — 크롬 접기로 얻는 건 156px이고 본질적 이득은 인셋+clamp 하한 제거. `.subway-search-head`는 **리포지토리에 존재하지 않음** → `.subway-controller-header`/`.subway-controller-kicker`. `bottom`만 올리면 `.map-screen{overflow:hidden}` 때문에 패널 상단(입력 필드)이 잘려 사라짐 → `max-height` 필수. 훅 하드닝: rAF로 쓰기 병합 + 무변화 스킵(문서 전체 스타일 무효화 방지), `vv.scale > 1`이면 인셋 0(핀치줌 오검출), `focusout`/`scrollend`에서 재계산(iOS가 `offsetTop`을 0으로 되돌리지 않는 사례) |
| 문서 연동 | HANDOFF §2-B(2026-08-03 "지하철: 경로 편집 전체화면(카카오식)", globals.css:3548-3555) **안에서** 동작 — 지도를 되살리지 않고 크롬만 접고 키보드를 존중. 2026-08-22 스펙:79-80 "Screen B — station search overlay: Full-screen list over the map, keyboard up"이 오히려 이 방향을 규정. 크롬을 접더라도 **탈출구는 남길 것**: 같은 스펙:50-51이 "헤더를 숨겨 Close와 Edit이 모두 사라져 그립 외 출구가 없는 상태"를 결함으로 기록 → Close(:766)와 Cancel(:1282)은 유지하고 kicker·h2·비활성 CTA·나그 문구만 접기 |
| 출처 | MDN *VisualViewport* ("OSK가 레이아웃 뷰포트는 두고 시각 뷰포트만 줄인다", 2021-08 Baseline) · `docs/research/raw/04-pwa-offline-ios.md` D5/E4 · Baymard(키보드가 뷰포트의 약 40% 점유) — `02-mobile-ux.md` §24 |
| 검증 | exists·decisions 유지, platform은 **CSS 레버를 반려**(이동→축소로 교체). 위 "변경"은 반려 내용을 반영한 최종안. 존재하지 않는 스펙 인용("min(78%,700px)")은 제거, Screen B로 대체 |

### R4 — 지하철 그립이 손가락을 따라오지 않고 `height`를 애니메이션 (P0 / L)

| | |
|---|---|
| 현재 | `subway-route-controller.tsx:501-514`는 pointerdown(좌표·스냅 기록 + 포인터 캡처)과 pointerup(`|dy|>40`이면 한 칸 이동)만 바인딩 — **`onPointerMove` 없음**(JSX :740-744도 동일). 주석 :500은 "Grip drag mirrors MapSheet"라고 주장. 스냅은 `transition: height 0.28s`(:5458)와 `.snap-compact{max(22%,158px)} / .snap-half{min(62%,580px)} / .snap-full{min(85%,720px)}`(:5460-5462). 라이브: 200px 드래그 8스텝 내내 top 320.7px 고정 → 릴리즈에서 126.6px로 점프, height 523.266 → 717.391 |
| 변경 | `.subway-controller.route-ready`에 고정 지오메트리(`min(85%,720px)`)를 주고 티어를 transform으로 표현하되, **퍼센트 하드코딩 금지**: `snapOffsets()`(map-sheet.tsx:164-171)처럼 px를 측정해 `--snap-half`/`--snap-compact` 커스텀 속성으로 쓰고 클래스는 `transform: translateY(var(--snap-*,0px))`. 제스처는 `onPointerMove`에서 `el.style.transform = translateY(rubberBand(...))`, 80ms 창의 `{t,y}` 샘플, 릴리즈에 `resolveReleaseSnap` → `springKeyframes` — 모두 `lib/map-sheet-state.ts`(:29/:38/:64/:75)에 이미 순수·테스트된 형태로 존재. `onGripClick`/`onGripKeyDown`은 비드래그 대체수단이므로 그대로 유지 |
| 보정 | (a) `.subway-controller.route-ready.dragging{transition:none; user-select:none}`를 첫 transform 기록 **전에** 토글(globals.css:6148의 `.mapsheet.dragging` 선례) — 없으면 420ms 트랜지션이 매 프레임 재시작해 지금보다 나빠짐. (b) `animation: sheetup 0.24s`(:299)의 키프레임이 `translateY(100%)→0`이라 마운트 240ms 동안 티어 transform을 덮어씀 → route-ready에서 제외하거나 opacity 페이드로 교체. (c) `resolveReleaseSnap`은 `MapSheetSnap`("peek"|"half"|"full") 타입이라 `SubwaySnap`("compact"|...)에 그대로 안 들어감 → 제네릭화(순수 리팩터, 기존 테스트 유지). (d) 고정 27%/74%는 `max(22%,158px)`/`min(62%,580px)` 클램프를 깨뜨림(667px 기기에서 compact 158 → 147px). (e) 같은 요소에 height 상태가 5개(:293 기본, :302 search-ready, :3551 subway-editing `height:100%`, :3559 station-browse, :1093 max-height 쿼리) — 특히 `:3551`이 특이도 (0,4,0)으로 승리하므로 정리 필요. (f) `prefers-reduced-motion` 분기(:5463-5465 및 springKeyframes 스킵) 유지. (g) 티어 콘텐츠가 커밋 시점에만 바뀌므로 드래그 중 빈 면이 노출됨 → 라이브 오프셋 기준으로 렌더 |
| 문서 연동 | `lib/subway-search-layout.test.ts:225`가 `.subway-controller.route-ready.snap-half { height: min(62%, 580px); }` 문자열을 고정 → 같은 커밋에서 레이아웃 예산 테스트로 재타깃(2026-08-22 스펙 Phase 4가 허용하되 "명시적 산출물이어야 한다"고 규정). 같은 스펙:180-188은 "map-sheet.tsx에서 셸을 추출하지 말고 `lib/map-sheet-state.ts`의 순수 어휘만 공유하라, 두 시트 통합은 **post-beta 리팩터**"라고 명시 — 본 안의 *방법*은 준수하지만 *시점*(P0 즉시)은 문서화된 일정과 충돌하므로 **오너 판단 필요** |
| 출처 | Apple HIG *Sheets* ("a sheet responds to the drag as it happens") · WWDC18 803(1:1 추종, 중단·방향전환 가능한 제스처) · web.dev *Animations guide* ("opacity와 transform으로 제한", 레이아웃 경로 측정치 37ms 렌더 vs 0) |
| 검증 | 3렌즈 유지. exists: 핸들러 부재·CSS·헬퍼 전부 재현(height transition은 :5458). decisions: 2026-08-22 스펙이 비율 기반 스냅과 "transform만 변경" 관례를 오히려 지지, 단 일정 플래그. platform: 방향 타당, 위 (a)~(g) 보정 필수 |

### R5 — 어떤 오버레이도 Back으로 닫히지 않음 (P1 / M~L)

| | |
|---|---|
| 현재 | `grep -rn "popstate\|pushState\|replaceState" app components lib e2e` → **0건**(유일한 `window.history` 참조는 back-button.tsx:14,30의 length 가드). BottomSheet는 스크림 클릭(:40)과 Escape(use-dialog-focus.ts:41-46)로만 닫히고, HamburgerMenu는 `useDialogFocus`를 쓰지 않아 **Escape조차 없음**. 지하철 플래너는 불투명 전체화면이라 스크림이 없음((195,200) 탭이 도착역 입력으로 떨어짐). 프로젝트 자체 승인 스펙이 요구했던 사항: `docs/superpowers/specs/2026-07-06-map-place-drawer-design.md:40-41` "열릴 때 `history.pushState(…)`; `popstate` 수신 시 `onClose()`" — place-drawer.tsx 삭제와 함께 유실 |
| 변경 | `components/ui/use-dismiss-on-back.ts`(리포에 `hooks/`는 없음; 훅은 컴포넌트 옆에 두는 관례). **핵심 4가지**: (1) `pushState`는 반드시 **사용자 제스처 태스크 안에서** 호출 — WebKit 248303(NEW)으로 iOS 엣지스와이프는 제스처 밖에서 push된 엔트리에 popstate를 발화하지 않음. (2) `useDialogFocus`에 매달지 말 것 — bottom-sheet.tsx:31이 `Boolean(host)`(마운트 후 effect)를 넘기고, `reactStrictMode:true`(next.config.mjs:39)의 이중 호출이 push(A)/back()/push(B) 경합을 만들어 열자마자 닫힘. 각 오버레이의 open/close 핸들러에서 호출. (3) 토큰은 모듈 스코프 카운터 — `crypto.randomUUID()`는 secure context 전용이라 실기기 테스트용 `http://<LAN-IP>:3000`에서 undefined. (4) 닫을 때 `history.state`에서 토큰을 되읽지 말 것 — Next 15는 라우터 상태 변경 시 `replaceState`로 엔트리를 재구성하고(navigate/refresh/server-patch/server-action reducer) signout-modal.tsx:55가 자기 모달이 열린 채 `router.refresh()`를 호출함. 모듈 스코프 깊이 카운터로 소유권 판단 |
| 추가 | 콤보박스 Escape(subway-route-controller.tsx:225-235)는 **이미** `lastSelectedRef` 복원을 수행합니다(기존 설명은 부정확). 실제 결함은 APG 1단계 부재 — 첫 Escape가 팝업만 닫고 입력 중 텍스트를 보존해야 하는데, 지금은 곧바로 이전 역명으로 덮어쓰거나(선택 이력 있음) 쿼리를 지우고 `onSelect(null)`을 호출(선택 이력 없음)합니다. 후자는 `map-screen.tsx:609-628`로 전파돼 지도 카메라가 움직입니다. 수정: 첫 Escape = `setOpen(false)` + `stopPropagation()`(문서 레벨 핸들러 중복 방지), 두 번째 = 복원 또는 클리어, `selectedId`가 이미 null이면 `onSelect(null)` 생략 |
| 문서 연동 | `docs/research/web-app-best-practices-2026-09.md:95`가 "`popstate` 연동 (P1)"을 이미 미결 액션으로 등재(HANDOFF:168 백로그 헤드). 2026-08-22 스펙은 `snap`을 URL에 쓰지 말라고 하는데, 본 안은 오버레이 수명당 1엔트리라 충돌 없음. 다만 같은 스펙 phase 3에서 경로 계획이 실제 `/map/route`로 옮겨가면 지하철 분량은 네이티브 Back으로 대체되므로 **BottomSheet/HamburgerMenu/SignoutModal 분량을 먼저 출하** |
| 출처 | NN/g *Bottom Sheets* ("Allow the Use of Back for Dismissing the Bottom Sheet") · NN/g *Accidental Dismissal of Overlays* — `02-mobile-ux.md` §9 · W3C APG *Combobox* — `03-accessibility.md` §C3 · 프로젝트 스펙 2026-07-06 §2.3 |
| 검증 | 3렌즈 유지. exists/decisions: grep 0건·스펙 요구 재현, 단 Escape 서술 정정·경로는 `components/ui/`. platform: Next 15 history 패치와 충돌 없음 확인, 단 위 (1)~(4) 필수. `goBack() → about:blank`는 Playwright 신규 컨텍스트 아티팩트이므로 증거에서 제외(앱 이탈은 Android 설치형 PWA에 해당) |

### R6 — 모든 시트·모달·드로어가 한 프레임에 잘려나감 (P1 / M)

| | |
|---|---|
| 현재 | 진입 애니메이션은 전부 존재(`.sheet{sheetup .3s}` :3068, `.drawer{drawerin .28s}` :3337, `.overlay/.modal/.drawer-scrim{fade .2s}` :3056/3118/3322, `.subway-controller{sheetup .24s}` :299)하지만 소비자는 모두 무조건 언마운트(feedback-sheet.tsx:96, hamburger-menu.tsx:50, signout-modal.tsx:29, signin-nudge.tsx:91, map-screen.tsx:597). 라이브: Close 탭 → DOM 제거 **49.8ms**. 퇴장 키프레임은 파일 전체(@keyframes 9개)에 0개. 또한 스크림 3종이 페이지 푸시용 `@keyframes fade`(:1411-1420, `transform: translateX(6px)` 포함)를 재사용 → `inset:0` 전면 스크림이 좌우로 6px 미끄러짐 |
| 변경 | `sheetdown` / `drawerout` / `scrim-in` / `scrim-out` 키프레임 추가, 스크림을 `fade` 대신 `scrim-in 180ms linear`로(오프셋이 의도된 `.app-scroll`만 `fade` 유지). 토큰을 `:root`에 1회 정의: `--ease-sheet: cubic-bezier(0.32,0.72,0,1); --ease-exit: cubic-bezier(0.3,0,0.8,0.15); --dur-exit: 200ms; --dur-micro: 90ms`. **언마운트의 진실 공급원은 타이머**: 부모에 `useExitTransition(open)`을 두어 `open`이 false가 된 뒤 `EXIT_MS`만큼 유지 — Escape(use-dialog-focus), filter-sheet.tsx:43 Apply, feedback-sheet.tsx:37 제출 후, 넛지의 "Keep exploring"까지 모두 커버(자식이 든 `closing` 상태로는 ✕와 스크림만 커버됨). `animationend`는 조기 종료 힌트로만 쓰고 `e.target===e.currentTarget && e.animationName==="sheetdown"` 가드 |
| 보정 | **`animationend` 게이팅은 반려됨**: :248-253이 `animation:none !important`라 reduced-motion 사용자에게는 이벤트가 영영 발화되지 않아 시트·모달이 닫히지 않는 **출시 차단급 행업**이 됩니다. `matchMedia`는 effect 안에서 읽고(렌더 중 금지 — React 19 하이드레이션 불일치), 매치 시 즉시 닫기. `.overlay.closing/.modal.closing/.drawer-scrim.closing`에 `pointer-events:none`(전면 스크림이 200ms간 지도 탭을 삼킴). `map-screen.tsx:378`과 `:652`는 `closeSubway`를 거치지 않고 `setMode("map")`를 직접 호출하므로 경유시킬 것, 포커스 복원(:281 rAF)은 퇴장 완료 콜백으로 이동. M3 수치 정정: emphasized accelerate는 **200ms / cubic-bezier(0.3,0,0.8,0.15)**(제안된 240ms·(0.4,0,1,1)은 MD2 값). `--dur-enter: 320ms`는 `.subway-controller`의 0.24s를 1/3 늦추므로 스코프 분리 |
| 주의 | `.mapsheet`의 `transition: transform 0.42s cubic-bezier(0.32,0.72,0,1)` 문자열은 `lib/map-selection-wiring.test.ts:273`이 고정 → **토큰화 대상에서 제외**. `components/map/map-view.tsx:437`의 `animationend` 리스너(진입 후 지도 refit)는 퇴장에서도 발화하므로 `animationName` 필터 추가. `:2507`·`:3495`가 참조하는 `--ease`는 선언된 적이 없어 폴백으로만 동작 — 토큰 정리 시 함께 해소. `subway-route-controller.tsx:1143`는 `<>` 프래그먼트라 className 불가 → `<Fragment key="route">` + 기존 내부 요소에 `.mapsheet-view-enter` |
| 출처 | Material 3 *Applying easing and duration* ("exit/dismiss/collapse는 더 짧은 지속시간") · Apple HIG *Sheets / Modality* — `02-mobile-ux.md` §8-9 |
| 검증 | exists/decisions 유지(사실관계 전부 재현, 스펙 충돌 없음), platform은 **메커니즘 반려** → 위 타이머 기반으로 교체. 방향(퇴장 애니메이션·토큰·스크림 fade 수정)은 3렌즈 모두 인정 |

### R7 — 4px 슬롭이 걷는 중 장소 행의 탭을 훔침 (P1 / S)

| | |
|---|---|
| 현재 | `components/map/map-sheet.tsx:25` `const DRAG_SLOP = 4;`, :320에서 비교. 드래그 확정 즉시 :345가 `dragMoved.current = true`를 무조건 설정하고, `onSheetClickCapture`(:388-393)가 뒤따르는 클릭을 `preventDefault()+stopPropagation()`으로 삼킴. 목록이 최상단(`scrollTop<=0`)일 때 아래로 5px 흔들리면 드래그 확정 → 시트는 ~1px 움직였다 제자리로 돌아오고 행 클릭만 사라짐 |
| 변경 | `DRAG_SLOP`을 **8**로(Android `getScaledTouchSlop()` ≈ 8dp, iOS ≈ 10pt). `dragMoved`는 확정 시점이 아니라 **릴리즈 시점**에 손가락 좌표로 결정: 제스처 객체에 `travel` 누적(`g.travel = Math.max(g.travel, Math.abs(e.clientY - g.downY))`), :345에서는 `false`로 초기화, `finishGesture`에서 `resolveReleaseSnap` 직후 `dragMoved.current = target !== snap || g.travel > DRAG_SLOP + 6` |
| 보정 | 제안된 `|position - g.startOffset| > 6`(rubberBand 통과값 기준)은 **반려** — 경계에서 감쇠(계수 0.55)로 19px 손가락 이동이 6px 미만으로 읽히고, 스냅을 바꾸는 짧고 빠른 플릭(0.625 px/ms)은 `dragMoved=false`가 되어 시트 확장과 장소 상세가 **동시에** 열립니다. 또 `onHandleClick`(:394-396)이 같은 플래그로 보호되므로, 잘못 설계하면 확정된 그립 드래그가 `settleTo` + `cycle()`을 둘 다 실행합니다. 위 "릴리즈 시점 + 최대 이동량" 방식이 세 구멍을 모두 막습니다. 참고로 **위쪽** 흔들림은 이미 안전(:329-331의 `sheetWantsIt` 조건) |
| 문서 연동 | `docs/` 전체에 `DRAG_SLOP` 언급 0건. 계약 테스트 `lib/map-selection-wiring.test.ts:319`는 표현식 문자열만 고정하므로 값 변경은 그린 유지. 주석 `subway-route-controller.tsx:500`("mirrors MapSheet: 40px threshold")은 같은 커밋에서 갱신 |
| 출처 | Apple WWDC18 803 ("Touches must move at least 10 points before a drag is confirmed as a swipe" — 히스테리시스로 마음을 바꿀 수 있게) — `02-mobile-ux.md` §1-2 |
| 검증 | exists/decisions 유지, platform은 `dragMoved` 구현을 반려하고 위 대안 제시. `DRAG_SLOP=8`은 3렌즈 모두 인정 |

### R8 — 5개 컨트롤 계열이 프로젝트 자체 44px 하한 미달 (P1 / S)

| | |
|---|---|
| 현재 | `.subway-station-focus > button{min-height:34px}`(선언 :823, 360px 이하에서 `font-size:9.5px` :1088) — 경로 이동의 주 컨트롤이 화면 하단 57px 지점에. `.station-filter-rail .sfchip{min-height:40px}`(:3613)가 `.sfchip{44px}`(:3734)를 특이도로 제압. `.map-top .chip{36px}`(:3903, 실측 36~37.5px × 10개). `.filtersheet .chip{38px}`(:2292)가 `.chip{44px}`(:1678)을 제압(32개). `.subway-snap-handle`(:5470)은 실측 390×16px. `lib/mobile-ux-contracts.test.ts:29-36`은 기본 셀렉터만 보고 오버라이드를 못 봄 |
| 변경 | `.subway-station-focus > button{min-height:44px; padding:6px 10px}` — 컨테이너는 `min-height:80px`(:5662) + `display:grid; align-items:center`라 **높이가 늘지 않음**. :3613의 40px 삭제(`.sfchip` 44px 승계), `.map-top .chip`과 `.filtersheet .chip`을 44px로. 스냅 핸들은 레이아웃 높이 대신 **히트 영역**으로: 가시 스트립은 ~20px 유지하고 절대배치 `::before`로 44px 히트영역 확보(`touch-action: none` 승계) — 2026-07-25 스펙:24가 "아이콘이 작아도 44px 히트 영역"을 허용. 테스트는 `[\s\S]*?` 대신 `[^}]*`로 규칙 블록 내부에 한정해 재작성 |
| 보정 | 제안된 `min-height:44px; padding:14px 16px 10px`는 내부 20px 박스에 4px 그립이 stretch되지 않아 **6px 비대칭** — `padding: 20px 16px`(20+4+20=44) 또는 `align-content:center`. 기존 테스트 정규식은 mutation test에서 **미수정 CSS를 그대로 통과**했고 `.chip` 기본값을 38px로 바꿔도 통과 — 같은 형태로 5줄을 더 추가해도 무의미. 누락된 위반: `.subway-route-steps > span{38px}`(:773, 1097에서 34px), `.daiso-category-chip-visual{36px}`(:1735) |
| 문서 연동 | `.subway-snap-handle`만 결정과 충돌 — commit 0461170이 "station browse 크롬 155px→90px, 3행→4행"을 오너 요청으로 기록했고 globals.css:3572-3574와 2026-08-22 스펙:206이 "half에서 크롬 ≤125px, 844px에서 3행 완전 노출"을 레이아웃 예산 테스트로 고정. +28px는 `snap-compact`(`max(22%,158px)`) 의 약 18%를 소모하므로 히트영역 방식 권장. `.station-sheet-grip`(:3576-3579)은 스펙:93이 20px로 예산화했으므로 **건드리지 말 것**. 상향 후 "half에서 3행" 재측정 및 행 수 단언 추가 |
| 출처 | Apple HIG *Layout* 44×44pt · Material *Accessibility* 48×48dp · WCAG 2.5.5 (AAA) 44×44 CSS px — `02-mobile-ux.md` item 1 · 프로젝트 계약 2026-08-22 스펙:105 |
| 검증 | 3렌즈 유지. exists: 5개 규칙 전부 실재(선언 라인 :823/:3613/:3903/:2292/:5470), 위반 2건 추가. decisions: 모든 문서가 44px를 명령, 스냅 핸들만 예산 충돌 플래그. platform: CSS 안전, 단 테스트 정규식 무력·핸들 수치 보정 |

---

## 3. 하위 우선순위 (미검증 — 렌즈 교차검증 미수행)

| ID | 영역 | 우선 | 난이도 | 내용 요약 |
|---|---|---|---|---|
| R9 | 검색 성능 | P1 | S | `searchStations`가 키 입력마다 600역 × ~5용어를 8정규식 체인으로 재정규화(`lib/subway.ts:111-125`, 콤보박스 3개가 각자 useMemo). 모듈 스코프에 `SEARCH_INDEX` 1회 생성 → 쿼리 1회 정규화만. 순수 리팩터, 출력 동일. NN/g 0.1s / web.dev INP ≤200ms |
| R10 | 상태 메시지 접근성 | P1 | S | `{suggestions.length} station results` 라이브 리전이 `{open && …}` 블록 안에 있어 리전과 내용이 **동시 생성** → 발화되지 않음(WCAG 4.1.3은 리전이 먼저 존재할 것을 요구). 또 `:779`가 경로 카드 **전체**에 `aria-live`를 걸어 스테퍼 탭마다 20개 라벨을 재낭독. 지속 리전 1개로 통합, 텍스트는 쿼리를 포함해 항상 변하게 |
| R11 | 피커 검색 UX | P1 | S | 클리어 ✕가 `open` 게이트(:238)라 포커스 해제 시 사라짐 → 재선택에 포커스 왕복 + 키보드 + `clamp(246px,…)` 레이아웃 점프 비용. 매치 구간 하이라이트 부재(`searchStations`가 오프셋 폐기, `lib/subway.ts:135`) — 서울 역명은 접두사가 길게 겹침(Gangnam / Gangnam-gu Office / Gangnamseowon). `<mark>`는 굵기 변화를 동반해 색상 단독 의존 회피(WCAG 1.4.1) |
| R12 | 공용 BottomSheet | P1 | M | 그래버 미렌더(`.sheet .handle` CSS는 존재, :3070-3076), 포인터 핸들러 0개(200px 드래그 무반응), 92% 높이라 엄지가 닿는 해제 수단은 상단 67.5px 스크림뿐. + `dismissGuard`로 입력 중 텍스트 보호(feedback-sheet.tsx:33-35는 전송 실패 시 이미 텍스트를 지키는데 스크림 스침 한 번에 사라짐), 스크림·시트 바디에 `overscroll-behavior: contain` |
| R13 | 맵시트 릴리즈 순간 | P1 | M | 콘텐츠 스왑과 FAB이 손가락을 뗀 뒤 최대 0.7s 늦게 도착(`commitSnap`이 스프링 `onfinish`에서만 실행). FAB은 레이아웃 속성 `bottom`을 0.42s 애니메이션(:3972, :6167). 커밋을 릴리즈 시점으로 이동, FAB은 `--sheet-visible-height` + transform, `will-change`는 `.mapsheet` 상시(:4304)에서 `.dragging`으로. pointerdown에서 스프링 취소(현재는 탭 중단이 최대 700ms 무시됨) |
| R14 | station-browse 시트 | P2 | M | `subway-route-controller.tsx:891`이 핸들러도 role도 없는 `<span class="station-sheet-grip">`을 진짜 그래버와 동일하게(36×4, :3578-3581) 그림 — 시트는 `height: min(60%,560px)` 고정(:3559). 리디자인의 주 착지 상태인데 거짓 어포던스. R4의 3티어 처리를 이 상태에도 적용하거나, 이번 스프린트 범위 밖이면 span과 규칙을 삭제 |

---

## 4. 검증에서 탈락한 항목

없습니다. 검증에 올린 8건(R1-R8) 전부가 3렌즈 교차검증을 통과했습니다. 다만 **부분 반려**가 3건 있고 본문에 반영했습니다: R3의 CSS 레버(패널 이동 → 축소), R6의 언마운트 메커니즘(`animationend` 게이팅 → 타이머, reduced-motion에서 영구 미해제 위험), R7의 `dragMoved` 판정(고무줄 통과 위치 → 릴리즈 시점 최대 손가락 이동량). 세 경우 모두 문제 진단과 방향은 유지되고 구현만 교체되었습니다.

---

## 5. 계측 요약 (Playwright, 390×844 @3x, iPhone UA, 프로덕션 빌드 127.0.0.1:3311)

| 대상 | 지표 | 값 | 판정 |
|---|---|---|---|
| `.mapsheet` 드래그 | 포인터→transform 추종 | 마우스 12스텝·터치 9스텝 모두 오차 **0.0px** | ok |
| `.mapsheet` 릴리즈(상) | 정착 시간 | 293ms(±0.5px), 오버슈트 없음 | ok |
| `.mapsheet` 릴리즈(하) | 정착 시간 | 455ms — 292px 중 마지막 15px에 234ms | warn |
| `.subway-snap-handle` 드래그 | 패널 상단 추종 | 200px 드래그 8스텝 내내 **320.7px 고정** → 릴리즈에 126.6px 점프 | fail |
| `.subway-controller` 스냅 | 애니메이션 속성 | `height 0.28s` (523.266→717.391px) | fail |
| 피커(키보드 390×430) | 완전히 보이는 결과 | 6개 중 **1개**, 패널 하단 화면 아래 56px | fail |
| 히스토리 | 레이어당 엔트리 | **0** (popstate/pushState 전무) | fail |
| BottomSheet | 진입 / 퇴장 | 300ms / **49.8ms 무애니메이션** | fail |
| BottomSheet | 드래그 해제, 그래버 | 200px 드래그 무반응, `.sheet .handle` = null | fail |
| BottomSheet | 다이얼로그 의미론 | role/aria-modal, 포커스 이동·트랩·복원 모두 정상 | ok |
| 탭 타깃 | 44px 미만 | 필터칩 32개 38px, 지도칩 10개 36-37.5px, 역칩 7개 40px, 스냅핸들 390×16, "Departure" 132.2×34 | fail |
| DOM 부하 | 노드/이미지/롱태스크 | 878행·678 img·11,512 노드, 롱태스크 8개(최대 182ms) | fail |
| 목록 스크롤(4× 스로틀) | 프레임 | p50 16.4ms / p95 23.1ms, 32ms 초과 0 | ok |
| reduced-motion | 전 표면 | transition/animation 전부 none, 릴리즈 46.4ms 즉시 커밋 | ok |
| 포커스 | 지하철 진입 / 장소 선택 후 | 둘 다 `<body>` | fail |
| 콘솔 | 에러 | `POST /api/vitals` **400** 반복(그 외 0) | fail |

스크린샷: `scratchpad/ux-review/` (세션 경로 `/private/tmp/claude-501/-Users-hanmyeong-gwan-mobile-design/40ba898f-5884-48df-910f-ff968e2d3c24/scratchpad/ux-review/`) — 핵심: `32-subway-keyboard-open.png`(키보드 결과 붕괴), `34-route-panel-dragged.png`(그립 드래그 무반응), `20-filter-sheet.png`·`21-after-backdrop.png`(공용 시트), `18-route-ready.png`, `33-route-strip.png`, `24-rm-filter.png`·`25-rm-subway.png`(reduced-motion), `31-stack-filter-over-preview.png`(z-index 격리), `01`~`04`(맵시트 스냅).

**계측 한계**: 실제 iOS Safari가 아닌 헤드리스 Chrome(iPhone UA)이며 키보드는 뷰포트 리사이즈로 근사했습니다 — Safari의 실제 visualViewport 동작, 고무줄 오버스크롤, URL 바 접힘에 따른 dvh 리플로우는 실기기 확인이 필요합니다. 베이스맵 타일에 API 키 워터마크가 있어 지도 가독성/마커 대비 판단은 불가. 위치 권한 미허용으로 최근접 역 경로 미검증. 경유지 흐름, 스왑 버튼(양끝 지정 상태), 반경 변경, 마커 탭, feedback/nudge/signout/hamburger는 미실행(공용 컴포넌트 기준 추론).

---

## 6. 참고한 모션 규칙 (숫자 포함)

| 규칙 | 수치 | 출처 |
|---|---|---|
| 즉시성 3단계 | 0.1s 즉각 / 1.0s 사고 흐름 유지 / 10s 주의 유지 한계 | NN/g *Response Times: The 3 Important Limits* — nngroup.com/articles/response-times-3-important-limits/ |
| 드래그 히스테리시스 | 스와이프 확정 전 최소 **10pt** 이동 (Android touch slop 8dp) | Apple WWDC18 803 *Designing Fluid Interfaces* — developer.apple.com/videos/play/wwdc2018/803/ |
| 1:1 추종 / 중단 가능 | "터치와 콘텐츠가 1:1로 움직이지 않는 순간 바로 알아챈다" / 제스처는 중단·방향전환 가능해야 | 같은 세션 803 |
| 스프링 감쇠 | 100% 감쇠에서 시작, **모멘텀이 있는 제스처에만** 오버슈트 보상(Music: 탭 100% / 스와이프 80%) | 같은 세션 803 |
| 고무줄 계수 | iOS 0.55 — 경계를 "부드럽게 알려주는" 수단 | 같은 세션 803 (본 앱 `lib/map-sheet-state.ts:64`가 동일 값) |
| 시트 그래버 | 리사이즈 가능한 시트에는 그래버 필수, 탭으로 디텐트 순환, VoiceOver 대응 | Apple HIG *Sheets* — developer.apple.com/design/human-interface-guidelines/sheets |
| 스와이프 해제 + 미저장 보호 | 시트는 수직 스와이프로 닫히고, 미저장 변경이 있으면 확인 시트 | 같은 HIG *Sheets* |
| 모션은 선택 가능해야 | Reduce Motion 시 축소·반복 모션 제거, 단 **제스처 추종 모션은 유지**, x/y/z 이동은 페이드로 대체 | Apple HIG *Accessibility* / *Motion* |
| 퇴장은 진입보다 빠르게 | emphasized decelerate **400ms**(진입) vs emphasized accelerate **200ms / cubic-bezier(0.3,0,0.8,0.15)**(퇴장) | Material 3 *Applying easing and duration* — m3.material.io/styles/motion/easing-and-duration/applying-easing-and-duration |
| 레이아웃 속성 금지 | opacity·transform으로 제한 — top/left 경로 실측 렌더 37ms vs transform 0 | web.dev *Animations guide* — web.dev/articles/animations-guide |
| `will-change` | 변경 직전에 켜고 끝나면 제거, 기본값으로 두지 말 것 | 같은 문서 |
| INP | 좋음 ≤ **200ms**, 나쁨 > 500ms (p75) | web.dev *Interaction to Next Paint* — web.dev/articles/inp |
| 탭 지연 | `touch-action: manipulation` = 더블탭 줌 제거 → 클릭 지연 제거 (2019-09 Baseline) | MDN *touch-action* |
| 키보드 | OSK는 레이아웃 뷰포트를 두고 시각 뷰포트만 줄인다; `height`/`offsetTop`/`resize`/`scroll` (2021-08 Baseline) | MDN *VisualViewport* |
| 스크롤 체이닝 | `overscroll-behavior: contain` — 이웃 스크롤 영역으로 전파 차단(로컬 바운스는 유지) | MDN *overscroll-behavior* |
| 바닥 시트 | 초기 높이는 화면의 50% 상한, 드래그 없이도 높이 순환·완전 닫기 가능해야, 시트 위 시트 금지, **Back으로 닫히게** | Material 3 *Bottom sheets* / NN/g *Bottom Sheets* |
| 포커스 가림 | 포커스된 컴포넌트가 다른 콘텐츠에 완전히 가려지면 안 됨 | W3C WAI *SC 2.4.11 Focus Not Obscured (Minimum)* |
| 상태 메시지 | 라이브 리전은 **업데이트 이전에 존재**해야 하고, 포커스 이동 없이 전달돼야 함 | W3C WAI *SC 4.1.3 Status Messages* |
| 참조 상수 | Vaul: duration 0.5s, ease `[0.32,0.72,0,1]`(Ionic 유래, iOS 시트 모방), 속도 임계 0.4, 닫힘 임계 0.25, 스크롤락 100ms — 본 앱은 0.42s / 0.45 px/ms | vaul `src/constants.ts` · emilkowal.ski/ui/building-a-drawer-component |
| 참조 상수 | react-spring 프리셋: stiff 210/20, wobbly 180/12 — 본 앱 260/30(감쇠비 0.93)은 stiff보다 더 단단함 | pmndrs `react-spring/packages/core/src/constants.ts` |

---

### 권장 실행 순서

1. **R1**(약 20줄 CSS, 체감 최대) → 2. **R2**(도달 불가 콘텐츠 제거, 수 줄) → 3. **R8**(44px, 수 줄 + 테스트 정규식 교정) → 4. **R3**(키보드 훅) → 5. **R6**의 BottomSheet 분량 + **R5**의 BottomSheet/HamburgerMenu/SignoutModal 분량 → 6. **R7** → 7. **R4**(오너 일정 판단 필요: 2026-08-22 스펙이 시트 통합을 post-beta로 예약) → 8. R9-R14.

오너 확인이 필요한 항목: **R4의 시점**(스펙상 post-beta 리팩터), **R1의 `touch-action: manipulation`**(더블탭 줌 어포던스 축소), **R2의 A안**(플로팅 외형 포기), **R8의 스냅 핸들**(크롬 예산 vs 히트 영역 방식).
