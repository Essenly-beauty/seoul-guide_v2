# MYSEOULDROP 웹 접근성 요구사항 및 실무 패턴 리서치 (2026-09 기준)

모든 항목은 실제로 fetch한 페이지를 근거로 작성했습니다. 접근 실패한 페이지는 맨 끝에 명시했습니다. 참고: WCAG 2.2는 2023-10-05 W3C 권고안으로 발행되었고, 4.1.1 Parsing이 삭제되었습니다 (W3C WAI "What's New in WCAG 2.2").

브랜드 오렌지 관련 사전 계산 (WCAG 상대휘도 공식으로 직접 계산):
- `#e94f00` on `#fff` = 3.76:1 → 일반 텍스트(1.4.3, 4.5:1) 실패 / 큰 텍스트·UI 컴포넌트·아이콘(3:1) 통과
- 텍스트용 다크 변형 후보: `#cc4400` 4.78:1, `#c24100` 5.19:1, `#b83d00` 5.67:1 (모두 4.5:1 통과)
- `#e94f00` on 다크 배경 `#111827` = 4.72:1 → 다크 테마에서는 그대로 통과

---

## A. WCAG 2.2 신규/핵심 기준

### A1. 2.5.8 Target Size (Minimum) — AA (2.2 신규)
- 규칙: "The size of the target for pointer inputs is at least 24 by 24 CSS pixels" 단, 예외 5가지 — Spacing(24px 지름 원을 각 타깃 바운딩박스 중심에 그렸을 때 다른 타깃과 교차하지 않으면 OK), Equivalent(같은 페이지의 다른 컨트롤로 동일 기능 가능), Inline(문장 내), User agent control, Essential. Understanding 문서는 **지도 핀은 Essential 예외**(핀 위치가 실제 지리 위치를 반영해야 하므로 밀집돼도 허용)를 명시. 참고로 2.5.5 Target Size (Enhanced, AAA)는 44×44 CSS px.
- MYSEOULDROP 적용: (1) 600개 div-icon 마커는 Essential 예외로 법적 통과 가능하지만, 마커의 `iconSize`를 최소 24×24로 두고 클러스터링/줌 임계값으로 겹침을 줄일 것. (2) 필터 칩, 바텀시트 핸들, 헤더 아이콘 버튼, 별점 별(★) 하나하나, 하트 토글은 24×24 이상(권장 44×44)으로. 칩이 20px 높이라면 상하 여백으로 24 확보. (3) 바텀시트 리스트가 마커와 "Equivalent" 컨트롤 역할을 하므로 리스트 항목이 확실히 24px 이상이어야 함.
- 출처: W3C WAI — Understanding SC 2.5.8 Target Size (Minimum) — https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html — (accessed 2026-09); Understanding SC 2.5.5 — https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced.html — (accessed 2026-09)

### A2. 2.4.11 Focus Not Obscured (Minimum) — AA (2.2 신규)
- 규칙: "When a user interface component receives keyboard focus, the component is not entirely hidden due to author-created content." 스티키 헤더/푸터, 쿠키 배너, 비모달 다이얼로그가 포커스 요소를 **완전히** 가리면 실패(부분 가림은 AA 허용, AAA 2.4.12는 부분 가림도 불가). 해결책: `scroll-padding`, 배너를 모달로, 포커스 잃으면 닫히는 알림.
- MYSEOULDROP 적용: 바텀시트가 열린 상태(비모달)에서 지도 컨트롤(줌 ±, 현재위치)이나 지도 마커에 Tab 포커스가 가면 시트 뒤에 완전히 숨겨질 수 있음 → 시트가 화면 위쪽 영역을 덮지 않게 하거나, 시트 열림 시 뒤 콘텐츠를 `inert`로 처리(모달화), 또는 포커스된 마커를 `map.panTo`로 시트 위 가시 영역으로 이동. 하단 탭바/토스트가 리스트 마지막 항목의 포커스를 가리지 않도록 `scroll-padding-bottom`을 탭바 높이만큼 지정.
- 출처: W3C WAI — Understanding SC 2.4.11 Focus Not Obscured (Minimum) — https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html — (accessed 2026-09)

### A3. 2.4.7 Focus Visible (AA) + 2.4.13 Focus Appearance (AAA, 2.2 신규) + 1.4.11
- 규칙: 2.4.7 "Any keyboard operable user interface has a mode of operation where the keyboard focus indicator is visible." (outline 제거는 실패 F78). 2.4.13(AAA): 포커스 표시 영역이 "at least as large as the area of a 2 CSS pixel thick perimeter of the unfocused component" 이고 포커스 전후 "contrast ratio of at least 3:1". 권장 기법은 2px 실선 outline + `outline-offset`. 1.4.11은 포커스 표시가 인접 배경과 3:1 요구.
- MYSEOULDROP 적용: Tailwind `focus-visible:outline-2 focus-visible:outline-offset-2`를 전역 기본으로. 지도 타일 위 마커 포커스 링은 배경이 복잡하므로 이중 링(흰 2px + 짙은 2px)을 권장(Minnesota 가이드도 "busy background" 위 포커스를 별도 테스트하라고 명시). 오렌지 `#e94f00` 링은 흰 배경에서 3.76:1이라 3:1 통과.
- 출처: W3C WAI — Understanding SC 2.4.7 — https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html; Understanding SC 2.4.13 Focus Appearance — https://www.w3.org/WAI/WCAG22/Understanding/focus-appearance.html; Understanding SC 1.4.11 — https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html — (accessed 2026-09)

### A4. 2.5.7 Dragging Movements — AA (2.2 신규) + 2.5.1 Pointer Gestures (A)
- 규칙: 2.5.7 "All functionality that uses a dragging movement for operation can be achieved by a single pointer without dragging, unless dragging is essential…" Understanding 예시: "A map allows users to drag the view of the map around, and the map has up/down/left/right buttons to move the view as well." 2.5.1: 멀티포인트/경로 제스처는 단일 포인터 대안 필수 — 예시 그대로 "the map also includes plus/minus buttons to zoom in and out."
- MYSEOULDROP 적용: (1) 지도 팬 드래그 → 화살표 팬 버튼 4개(또는 "이 지역 검색" 버튼 + 리스트에서 선택 시 `panTo`)를 시각적으로 제공. (2) 핀치 줌 → Leaflet 기본 줌 컨트롤(+/−)을 숨기지 말 것(모바일 UI에서 흔히 제거함). (3) 바텀시트 스와이프 확장/축소 → 핸들을 `button`으로 만들어 탭으로 토글(펼침/접힘/닫기). (4) 별점 슬라이더가 있다면 탭으로 값 설정 가능해야 함.
- 출처: W3C WAI — Understanding SC 2.5.7 Dragging Movements — https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html; Understanding SC 2.5.1 Pointer Gestures — https://www.w3.org/WAI/WCAG22/Understanding/pointer-gestures.html — (accessed 2026-09)

### A5. 3.3.7 Redundant Entry — A (2.2 신규)
- 규칙: "Information previously entered by or provided to the user that is required to be entered again in the same process is either: auto-populated, or available for the user to select." 예외: 재입력이 필수, 보안상 필요, 이전 정보가 무효. 예시: 검색 결과 페이지가 이전 검색어를 미리 채움.
- MYSEOULDROP 적용: 회원가입 → 이메일 인증 → 프로필 입력 흐름에서 이메일 재입력 금지(자동 채움). 지하철 경로 플래너에서 출발역을 바꿔 재검색할 때 도착역 유지, "출발/도착 교체" 버튼 제공. 리뷰 작성 실패(네트워크) 후 입력 텍스트 보존. 단, 비밀번호 확인 필드는 보안 예외.
- 출처: W3C WAI — Understanding SC 3.3.7 Redundant Entry — https://www.w3.org/WAI/WCAG22/Understanding/redundant-entry.html — (accessed 2026-09)

### A6. 3.3.8 Accessible Authentication (Minimum) — AA (2.2 신규)
- 규칙: "A cognitive function test (such as remembering a password or solving a puzzle) is not required for any step in an authentication process unless that step provides at least one of: Alternative / Mechanism / Object Recognition / Personal Content." 실무: 비밀번호 필드에 붙여넣기 차단 금지, 비밀번호 관리자 자동 채움이 되도록 `autocomplete` 마크업(1.3.5 연계), OAuth·WebAuthn·이메일 링크 로그인은 적합한 대안. 오브젝트 인식 CAPTCHA는 AA 예외이나 오디오 대안이 받아쓰기라면 불충분.
- MYSEOULDROP 적용: Supabase 이메일+비밀번호 로그인은 "Mechanism"(브라우저/비밀번호 관리자)으로 통과 가능 — 조건: `<input type="email" autocomplete="email">`, `<input type="password" autocomplete="current-password">`(가입은 `new-password`), `onPaste` 차단 없음. Google 로그인이 이미 있으므로 "Alternative"도 충족. 향후 CAPTCHA 도입 시 텍스트 받아쓰기형 금지. 매직링크 로그인은 가장 안전한 대안.
- 출처: W3C WAI — Understanding SC 3.3.8 Accessible Authentication (Minimum) — https://www.w3.org/WAI/WCAG22/Understanding/accessible-authentication-minimum.html — (accessed 2026-09)

### A7. 1.4.3 Contrast (Minimum) — AA / 1.4.11 Non-text Contrast — AA
- 규칙: 1.4.3 "The visual presentation of text and images of text has a contrast ratio of at least 4.5:1", 큰 텍스트("at least 18 point or 14 point bold" ≈ 24px / 18.5px bold, CJK는 동등 크기)는 3:1. 로고타입·비활성 컴포넌트·장식 텍스트 예외. 1.4.11: UI 컴포넌트 식별에 필요한 시각 정보와 그래픽 객체는 인접 색과 3:1.
- MYSEOULDROP 적용: `#e94f00` on white = 3.76:1 → **본문 크기 오렌지 텍스트(가격, 링크, "OPEN" 라벨, 탭 활성 텍스트 등)만 실패**, 아이콘·마커·테두리·큰 제목(≥24px 또는 ≥18.66px bold)·로고는 통과. 제안: 텍스트 토큰을 둘로 분리 — `--brand`(#e94f00, 아이콘/마커/버튼 배경/큰 제목용)와 `--brand-text`(#c24100 등 ≥4.5:1, 작은 텍스트용). 흰 텍스트가 올라가는 오렌지 버튼도 3.76:1이므로 버튼 라벨은 18.66px bold 이상이거나 배경을 `#c24100`으로. 다크 테마는 4.72:1로 그대로 OK. 지도 마커 자체는 타일(회색/베이지) 위에서 3:1 — 흰색 테두리(halo)를 두르면 1.4.11 안전.
- 출처: W3C WAI — Understanding SC 1.4.3 Contrast (Minimum) — https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html; Understanding SC 1.4.11 Non-text Contrast — https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html — (accessed 2026-09)

### A8. 1.4.1 Use of Color — A
- 규칙: "Color is not used as the only visual means of conveying information, indicating an action, prompting a response, or distinguishing a visual element."
- MYSEOULDROP 적용: 카테고리별 마커(스킨케어/메이크업/올리브영/다이소 등)가 색으로만 구분되면 실패 → 마커 안에 아이콘/이니셜/모양 차이 + 범례. 즐겨찾기 하트(회색→오렌지)는 채움(outline→filled) 변화로 상태 표현. 선택된 필터 칩은 색 + 체크 아이콘 또는 굵기/테두리. 영업중/영업종료 배지는 텍스트 병기.
- 출처: W3C WAI — Understanding SC 1.4.1 Use of Color — https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html — (accessed 2026-09)

### A9. 1.4.4 Resize Text (AA) / 1.4.10 Reflow (AA) / 1.3.4 Orientation (AA)
- 규칙: 1.4.4 "text can be resized without assistive technology up to 200 percent without loss of content or functionality." 1.4.10 "without requiring scrolling in two dimensions for: Vertical scrolling content at a width equivalent to 320 CSS pixels" (1280px 창 400% 줌과 동등), 단 "images required for understanding (such as maps and diagrams)" 등 2차원 레이아웃 필수 콘텐츠는 예외. 1.3.4 "Content does not restrict its view and operation to a single display orientation… unless a specific display orientation is essential."
- MYSEOULDROP 적용: 지도 캔버스 자체는 Reflow 예외지만 **바텀시트, 필터, 상세 페이지, 로그인 폼은 320px 폭·200% 텍스트에서 가로 스크롤 없이 동작**해야 함. 확인 방법: iOS 설정 > 손쉬운 사용 > 디스플레이 및 텍스트 크기 > 더 큰 텍스트(최대) + 데스크톱 400% 줌. 폰트/패딩을 `rem` 기반으로(web.dev: "Base font sizes should be defined with a relative value (%, rem, or em)"), 필터 칩 행은 `flex-wrap` 또는 가로 스크롤 컨테이너 한정. `screen.orientation.lock` 사용 금지, 가로 모드에서 바텀시트가 화면을 다 덮지 않도록 `max-height: 60dvh` 등 조정.
- 출처: W3C WAI — Understanding SC 1.4.4 — https://www.w3.org/WAI/WCAG22/Understanding/resize-text.html; Understanding SC 1.4.10 Reflow — https://www.w3.org/WAI/WCAG22/Understanding/reflow.html; Understanding SC 1.3.4 Orientation — https://www.w3.org/WAI/WCAG22/Understanding/orientation.html; web.dev — Learn Accessibility: Typography — https://web.dev/learn/accessibility/typography — (accessed 2026-09)

### A10. 2.3.3 Animation from Interactions (AAA) + 2.2.2 Pause, Stop, Hide (A) + prefers-reduced-motion 실무
- 규칙: 2.3.3 "Motion animation triggered by interaction can be disabled, unless the animation is essential to the functionality or the information being conveyed." 기법 C39(CSS `prefers-reduced-motion`), SCR40(JS). 2.2.2: 자동 시작·5초 초과·다른 콘텐츠와 병행되는 움직임은 일시정지/정지/숨김 수단 필요. MDN: iOS는 설정 > 손쉬운 사용 > 동작(Motion) > 동작 줄이기, Android 9+ "Remove animations", Windows 11 "Animation Effects". web.dev: "reduce, don't remove" — 슬라이드 대신 크로스페이드 등 대체.
- MYSEOULDROP 적용: (1) CSS: `motion-reduce:transition-none` / `motion-safe:transition`(Tailwind 변형 존재). 바텀시트 슬라이드업 → 감소 모드에서 페이드 또는 즉시 표시. (2) Leaflet은 JS 옵션이므로 `window.matchMedia('(prefers-reduced-motion: reduce)').matches`로 `MapContainer`에 `zoomAnimation={false} fadeAnimation={false} markerZoomAnimation={false}` 전달하고, `panTo/flyTo/setView` 호출 시 `{animate: false}`(Leaflet 레퍼런스: pan `duration` 기본 0.25s, `zoomAnimationThreshold` 기본 4). (3) 앱 내 "애니메이션 줄이기" 토글(기법 Gx)을 설정에 추가하면 AAA까지 대응. (4) 자동 회전 배너/캐러셀이 있다면 5초 이상 자동재생 시 정지 버튼.
- 출처: W3C WAI — Understanding SC 2.3.3 — https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html; Technique C39 — https://www.w3.org/WAI/WCAG22/Techniques/css/C39; Understanding SC 2.2.2 — https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html; MDN — prefers-reduced-motion — https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion; web.dev — prefers-reduced-motion: Sometimes less movement is more — https://web.dev/articles/prefers-reduced-motion; Leaflet — API reference (Map options / PanOptions) — https://leafletjs.com/reference.html; Tailwind CSS — Hover, focus, and other states (motion-reduce/motion-safe) — https://tailwindcss.com/docs/hover-focus-and-other-states — (accessed 2026-09)

---

## B. 지도 접근성

### B1. 지도는 "정보형"이므로 리스트를 진실의 원천으로 (1.1.1, 1.3.1, 2.1.1)
- 규칙/가이드: 1.1.1 "All non-text content that is presented to the user has a text alternative that serves the equivalent purpose"; 장식이면 "implemented in a way that it can be ignored by assistive technology". Minnesota IT Services 가이드: "Consider whether the functional requirements of the application can be met without an interactive web map and, if so, consider incorporating the ability to use the application with or without the map present"; 예시 포털은 "Maps are accompanied by a full data table and are also created with keyboard and assistive technology users in mind." accessibility.build(2차 출처): 리스트가 "the source of truth; the map mirrors it", 스크린리더 사용자가 지도 없이 검색→결과→길찾기 전체를 완료할 수 있어야 함. Equal Entry: "it is best to provide a data table alternative for accessing the map information."
- MYSEOULDROP 적용: 이미 있는 바텀시트 리스트가 대안 역할을 하도록 — 리스트가 지도의 현재 뷰포트/필터와 동일한 데이터 집합을 갖고, 각 항목에 이름·카테고리·거리·영업 상태·"지도에서 보기" 버튼(누르면 `panTo` + 마커 강조)을 포함. 지도 컨테이너에는 `role="region" aria-label="Map of K-beauty places"`를 두고, 바로 앞에 스크린리더용 설명("This map shows N places. Use the list below to browse them.")을 배치. 지도 마커를 리스트와 별개로 600개 Tab 정지점으로 노출하는 것이 아니라(아래 B3), 리스트를 1차 경로로.
- 출처: W3C WAI — Understanding SC 1.1.1 — https://www.w3.org/WAI/WCAG22/Understanding/non-text-content.html; Minnesota IT Services — Accessibility Guide for Interactive Web Maps (Oct 2024, PDF) — https://mn.gov/mnit/assets/Accessibility%20Guide%20for%20Interactive%20Web%20Maps_tcm38-403564.pdf; Equal Entry — Accessible Maps on the Web (2018-05-21) — https://equalentry.com/accessible-maps-on-the-web/; accessibility.build — Accessible Maps: Interactive Maps & Store Locators (updated 2026-08, 2차) — https://accessibility.build/guides/accessible-maps — (accessed 2026-09)

### B2. Leaflet 기본 키보드 동작을 끄지 말 것 (2.1.1 Keyboard, 2.1.2 No Keyboard Trap)
- 규칙: 2.1.1 "All functionality of the content is operable through a keyboard interface…" (경로 의존 입력만 예외). 2.1.2: 포커스가 들어간 컴포넌트에서 키보드만으로 나갈 수 있어야 하며 비표준 키면 안내 필요. Leaflet 공식: "The map container and markers are keyboard operable by default"; Map 옵션 `keyboard`(기본 true) "Makes the map focusable and allows users to navigate the map with keyboard arrows and +/- keys", `keyboardPanDelta` 기본 80px; Marker 옵션 `keyboard`(기본 true) "Whether the marker can be tabbed to with a keyboard and clicked by pressing enter". Minnesota 가이드의 Leaflet 표: 팬=화살표, 줌=+/− 또는 컨트롤 Tab, 마커 포커스=Tab, 팝업=Enter; 줌 컨트롤은 `role=button aria-label="Zoom In/Out"`, 타일은 `role=presentation` + 빈 alt.
- MYSEOULDROP 적용: `MapContainer`에 `keyboard={false}`를 넣지 말 것(모바일 최적화 중 흔히 제거). 화살표 키가 지도 팬에 쓰이므로 지도 컨테이너에 포커스가 있을 때 Tab으로 빠져나갈 수 있음을 확인(트랩 아님). 시각적 지도 포커스 링(`.leaflet-container:focus-visible`)을 커스텀 CSS로 제거했는지 점검. 줌 컨트롤을 커스텀했다면 `aria-label` 유지.
- 출처: W3C WAI — Understanding SC 2.1.1 — https://www.w3.org/WAI/WCAG22/Understanding/keyboard.html; Understanding SC 2.1.2 — https://www.w3.org/WAI/WCAG22/Understanding/no-keyboard-trap.html; Leaflet — A guide to basic Leaflet accessibility — https://leafletjs.com/examples/accessibility/; Leaflet — API reference — https://leafletjs.com/reference.html; Minnesota IT Services — 위 PDF §5 "Leaflet Library" — (accessed 2026-09)

### B3. div-icon 마커의 접근 가능한 이름·역할 (4.1.2 Name, Role, Value; 1.1.1 Controls)
- 규칙: 4.1.2 "the name and role can be programmatically determined; states, properties, and values… can be programmatically set". Leaflet 공식: "When using markers, it is vital to ensure each has a unique and descriptive alt or title" / "In the case of divIcons, custom HTML can otherwise provide a visual or non-visual label." Leaflet Discussion #9388(메인테이너 답변): divIcon 바깥 div에 `tabindex="0"`과 `role="button"`이 붙지만 "If a div icon does not have a tooltip, and no custom HTML, you'll indeed have a button with a missing accessible name" — 접근 가능한 이름은 "child content of the button (whether text content, aria-label/title, etc.)"에서 파생. Leaflet 2.0 이슈 #9898(open, High): img 기반 마커가 Enter/Space로 활성화되지 않는 문제 보고 → 2.0 업그레이드 시 재검증 필요.
- MYSEOULDROP 적용: react-leaflet은 "Child components… use their props as options when creating the corresponding Leaflet instance"이므로 `<Marker alt={place.name} title={place.name} …>`를 넘기고, `L.divIcon({ html: '<span class="sr-only">Olive Young Myeongdong, skincare, open now</span><svg aria-hidden="true">…</svg>' })`처럼 **커스텀 HTML 안에 시각적으로 숨긴 텍스트**를 넣어 접근 가능한 이름 확보. 이름은 "Marker"가 아니라 장소명+카테고리. 선택된 마커는 `aria-pressed` 또는 `aria-current="true"`로 상태 노출. `setIcon`으로 아이콘을 교체하면 DOM이 새로 만들어지므로 속성이 유지되는지(검색 결과에서 지적된 회귀 유형) 확인. Equal Entry 권고: 동시에 Tab 가능한 마커는 20개 이하 → 뷰포트 밖 마커는 렌더 제외/클러스터, 또는 리스트를 1차 경로로 두고 마커는 `keyboard: false` + 리스트에서 "지도에서 보기"로 접근(B1과 연계; 둘 중 하나는 반드시 키보드 접근 가능해야 2.1.1 충족).
- 출처: W3C WAI — Understanding SC 4.1.2 — https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html; Leaflet — accessibility guide — https://leafletjs.com/examples/accessibility/; Leaflet GitHub — Discussion #9388 "Adding aria-label to (DivIcon) marker?" — https://github.com/Leaflet/Leaflet/discussions/9388; Leaflet GitHub — Issue #9898 "Interactive markers are not operable with a keyboard [2.0]" — https://github.com/Leaflet/Leaflet/issues/9898; React Leaflet — API components — https://react-leaflet.js.org/docs/api-components/; Equal Entry (2018) — https://equalentry.com/accessible-maps-on-the-web/ — (accessed 2026-09)

### B4. 지도 상태 변화의 라이브 리전 알림 (4.1.3 Status Messages)
- 규칙: "status messages can be programmatically determined through role or properties such that they can be presented to the user by assistive technologies without receiving focus." 예: "5 results returned"는 `role=status`, 오류는 `role=alert`. Minnesota 가이드: 팝업 열림을 `aria-live=assertive` **또는** `role=alert` 중 하나만(둘 다 쓰면 "double speaking in VoiceOver and iOS"). Maps4HTML `<mapml-viewer>` 참고 구현은 줌 레벨/축척을 스크린리더에 알리고, 지도 중앙 사각형 안 피처의 "keyboard index menu"와 "거리순 정렬 테이블"을 제공.
- MYSEOULDROP 적용: 필터 변경/지도 이동 후 "Showing 42 places in this area"를 `role="status"`(polite) 리전에 갱신 — 리전은 로드 시부터 DOM에 존재해야 함(web.dev). 즐겨찾기 추가 토스트는 `role="status"`, 로그인 오류는 `role="alert"`. 지도 팬 중 매 프레임 알리지 말고 `moveend`에서 debounce. Maps4HTML처럼 "지도 중앙 근처 장소 N개" 같은 요약도 유용.
- 출처: W3C WAI — Understanding SC 4.1.3 Status Messages — https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html; Minnesota IT Services — 위 PDF §2 "Map Popups"; Maps4HTML — <mapml-viewer> Extension Features — https://maps4html.org/web-map-doc/docs/extension/features/; web.dev — Learn Accessibility: JavaScript — https://web.dev/learn/accessibility/javascript — (accessed 2026-09)

### B5. 지도 위 팝업/툴팁 (1.4.13 Content on Hover or Focus, 2.4.3 Focus Order)
- 규칙: 1.4.13 — Dismissible("dismiss the additional content without moving pointer hover or keyboard focus", 보통 Esc), Hoverable, Persistent. 2.4.3 — 동적으로 삽입된 콘텐츠는 트리거 바로 뒤 DOM 순서에 배치.
- MYSEOULDROP 적용: 마커 탭 시 뜨는 미니 카드/팝업은 Esc로 닫히고, 포커스가 카드 안으로 이동했다가 닫힐 때 마커(또는 리스트 항목)로 복귀. 호버 툴팁을 쓴다면 마우스를 툴팁 위로 옮겨도 사라지지 않게. Leaflet 기본 팝업의 닫기는 앵커(`a`)이므로 커스텀 팝업에서는 `<button aria-label="Close">`로.
- 출처: W3C WAI — Understanding SC 1.4.13 — https://www.w3.org/WAI/WCAG22/Understanding/content-on-hover-or-focus.html; Understanding SC 2.4.3 Focus Order — https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html; Minnesota IT Services — 위 PDF §5 — (accessed 2026-09)

### B6. 스킵 링크와 랜드마크로 지도를 건너뛰기 (2.4.1 Bypass Blocks)
- 규칙: "A mechanism is available to bypass blocks of content that are repeated on multiple web pages." 기법 G1: 첫 번째 포커스 가능한 컨트롤이 메인 콘텐츠로 가는 링크, 포커스 시에만 보여도 됨. Minnesota 가이드: "Design a 'Skip to' content link… to skip navigation, the map, and the map navigation controls… 'Skip to table', 'Skip to data'". APG 랜드마크: 페이지당 `main` 하나, 검색 폼은 `search` 랜드마크, 다중 `nav`는 고유 `aria-label`.
- MYSEOULDROP 적용: 홈에 "Skip to place list" 링크(포커스 시 표시)를 첫 Tab 정지점으로 — 지도 컨테이너와 600개 마커를 건너뛰는 것이 핵심. 구조: `<header>`(배너) / `<search>`(검색+필터) / `<main>`(지도 region + 리스트) / 하단 탭 `<nav aria-label="Primary">`. VoiceOver 로터 "Landmarks"로 바로 이동 가능해짐.
- 출처: W3C WAI — Understanding SC 2.4.1 — https://www.w3.org/WAI/WCAG22/Understanding/bypass-blocks.html; Technique G1 — https://www.w3.org/WAI/WCAG22/Techniques/general/G1; W3C WAI APG — Landmark Regions — https://www.w3.org/WAI/ARIA/apg/practices/landmark-regions/; Minnesota IT Services — 위 PDF §3 — (accessed 2026-09)

---

## C. 컴포넌트 패턴 (APG)

### C1. 바텀시트 = Modal Dialog 패턴 (또는 명시적 비모달)
- 규칙(APG Modal Dialog): 컨테이너 `role="dialog"` + `aria-modal="true"` + `aria-labelledby`(보이는 제목) 또는 `aria-label`; "Tab and Shift + Tab do not move focus outside the dialog"; Esc로 닫기; 열릴 때 내부 적절한 요소로 포커스 이동(큰 다이얼로그는 제목 등 정적 요소 가능), 닫힐 때 호출 요소로 복귀; 뒤 콘텐츠는 inert + 시각적으로 흐리게 — `aria-modal="true"`는 "programmatic prevention of outside interaction and visual obscuring"을 실제로 보장할 때만.
- MYSEOULDROP 적용: 두 가지 모드를 구분할 것. (a) **장소 상세 시트/로그인 시트/필터 시트**처럼 완료 전 다른 조작이 무의미한 것 → 모달: `<dialog>` 또는 `role=dialog aria-modal`, 뒤 지도/리스트에 `inert`, 포커스 트랩, Esc, 닫힐 때 원래 마커/버튼으로 포커스 복귀, 배경 dim. (b) **지도와 병행하는 결과 리스트 시트**(반쯤 열림) → 모달 아님: `role="region" aria-label="Place list"`로 두고 `aria-modal` 붙이지 말 것(붙이면 스크린리더가 지도를 숨김). 시트 핸들은 `<button aria-expanded aria-controls>`(Disclosure 패턴)로 펼침/접힘 상태 노출. 로그인 시트 열림 시 첫 입력 필드 대신 제목으로 포커스를 두면 iOS 키보드가 갑자기 뜨는 문제를 피할 수 있음.
- 출처: W3C WAI APG — Dialog (Modal) Pattern — https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/; APG — Disclosure Pattern — https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/ — (accessed 2026-09)

### C2. 즐겨찾기 하트 = Toggle Button (aria-pressed)
- 규칙(APG Button): 토글 버튼은 `aria-pressed`로 상태 표현; "it is critical the label on a toggle does not change when its state changes" — 예: 항상 "Mute"이고 pressed 여부로 상태 전달; 라벨을 Mute/Unmute로 바꾸는 디자인이면 `aria-pressed`를 쓰지 말 것. Enter/Space로 활성화. 2.5.3 Label in Name: 보이는 텍스트가 있으면 접근 가능한 이름에 그 텍스트가 포함되어야(음성 제어).
- MYSEOULDROP 적용: `<button aria-pressed={isFav} aria-label="Save Olive Young Myeongdong to favorites">` — 라벨 고정, 상태만 토글. 아이콘 SVG는 `aria-hidden="true"`. 색 변화만이 아니라 채움/윤곽 변화(1.4.1). 결과를 `role=status`로 "Saved to favorites" 알림(4.1.3). 리스트 카드 안에 하트가 있으면 카드 전체가 링크일 때 중첩 인터랙티브가 되지 않도록 카드 링크와 하트 버튼을 형제로 배치.
- 출처: W3C WAI APG — Button Pattern — https://www.w3.org/WAI/ARIA/apg/patterns/button/; W3C WAI — Understanding SC 2.5.3 Label in Name — https://www.w3.org/WAI/WCAG22/Understanding/label-in-name.html — (accessed 2026-09)

### C3. 검색 자동완성 = Combobox 패턴
- 규칙(APG Combobox): 입력 요소 `role="combobox"`, 팝업 `role="listbox"` + `role="option"`; `aria-expanded`(팝업 표시 여부), `aria-controls`(팝업 id), `aria-autocomplete="list"`(입력에 따라 목록 필터); 포커스는 입력에 두고 `aria-activedescendant`로 활성 옵션 지정; Down/Up 화살표로 이동, Enter로 선택, Esc로 닫기, Alt+Down으로 열기. Listbox 제약: 옵션 안에 링크/버튼 등 상호작용 요소를 넣을 수 없고 옵션 이름은 한 덩어리로 읽힘.
- MYSEOULDROP 적용: 장소/역 검색 입력에 위 속성 부여. 옵션 텍스트는 "Olive Young Myeongdong — Skincare, Jung-gu"처럼 짧고 완결되게(긴 이름 지양). 옵션 안에 하트 버튼을 넣지 말 것. 결과 수는 `role=status`로 "8 suggestions". 지하철 출발/도착역 입력 둘 다 동일 패턴.
- 출처: W3C WAI APG — Combobox Pattern — https://www.w3.org/WAI/ARIA/apg/patterns/combobox/; APG — Listbox Pattern — https://www.w3.org/WAI/ARIA/apg/patterns/listbox/ — (accessed 2026-09)

### C4. 필터/상세 탭 = Tabs 패턴 (roving tabindex)
- 규칙(APG Tabs): `tablist` > `tab`(활성 탭 `aria-selected="true"`, `aria-controls`) / `tabpanel`(`aria-labelledby`); 좌우 화살표로 탭 간 이동(끝에서 순환), Home/End 선택; "It is recommended that tabs activate automatically when they receive focus as long as their associated tab panels are displayed without noticeable latency"; 패널에 포커스 가능한 요소가 없으면 `tabindex="0"`. APG 키보드 가이드: Tab은 위젯 간 이동, 화살표는 위젯 내부 이동(roving tabindex: 활성 하나만 `tabindex=0`, 나머지 `-1`).
- MYSEOULDROP 적용: 상세 페이지의 "Info / Reviews / Photos" 탭에 적용. 상단 **카테고리 필터 칩**은 다중 선택이면 탭이 아니라 `role="group" aria-label="Category filters"` 안의 토글 버튼(`aria-pressed`)으로 — 단일 선택 뷰 전환이면 tabs. 칩 행이 가로 스크롤이면 화살표 이동 시 `scrollIntoView`.
- 출처: W3C WAI APG — Tabs Pattern — https://www.w3.org/WAI/ARIA/apg/patterns/tabs/; APG — Developing a Keyboard Interface — https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/ — (accessed 2026-09)

### C5. 토스트/알림 = Alert / Status
- 규칙(APG Alert): `role="alert"`는 암묵적으로 `aria-live="assertive"` + `aria-atomic="true"`; "it is crucial they do not affect keyboard focus"; 자동으로 사라지는 알림 설계는 2.2.3(충분한 시간) 위반 소지, 잦은 알림은 2.2.4 위반 소지; 워크플로 중단이 필요하면 Alert Dialog. 4.1.3: 성공/상태는 `role=status`(polite).
- MYSEOULDROP 적용: "Added to favorites", "Route found" 등은 `role="status"`; 로그인 실패/네트워크 오류는 `role="alert"`; 토스트가 3초 뒤 사라지더라도 동일 정보가 UI에 남아 있게(예: 하트 상태, 인라인 오류 텍스트). 토스트로 포커스를 옮기지 말 것. 라이브 리전 컨테이너는 페이지 로드 때부터 존재.
- 출처: W3C WAI APG — Alert Pattern — https://www.w3.org/WAI/ARIA/apg/patterns/alert/; W3C WAI — Understanding SC 4.1.3 — https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html — (accessed 2026-09)

---

## D. 폼·인증

### D1. 라벨·오류 연결 (3.3.1 Error Identification, ARIA21, 1.3.5)
- 규칙: 3.3.1 "If an input error is automatically detected, the item that is in error is identified and the error is described to the user in text." ARIA21: `aria-invalid`는 "should not be set to 'true' before input validation is performed"; 예제 `<input … aria-describedby="pin4-errormsg" aria-invalid="true">` + `<span id="pin4-errormsg">Error: PIN is required</span>`. MDN: "Do not set aria-invalid='true' on empty required elements until after the user attempts to submit the form." web.dev: "Labels must be visible at all times", 보조 설명은 `aria-describedby`, 동적 오류는 `aria-live`.
- MYSEOULDROP 적용: 로그인/가입/리뷰 폼 — 모든 입력에 보이는 `<label for>`(placeholder만 사용 금지). 제출 후에만 `aria-invalid="true"` + `aria-describedby="email-error"`로 오류 텍스트 연결, 오류 요약은 `role="alert"`. Supabase 오류 메시지("Invalid login credentials")를 그대로 노출하기보다 어떤 필드를 고칠지 명시. 별점 입력은 `fieldset/legend` + 라디오(1~5)로 구현하면 키보드/스크린리더 무료 지원.
- 출처: W3C WAI — Understanding SC 3.3.1 — https://www.w3.org/WAI/WCAG22/Understanding/error-identification.html; Technique ARIA21 — https://www.w3.org/WAI/WCAG22/Techniques/aria/ARIA21; MDN — aria-invalid — https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-invalid; web.dev — Learn Accessibility: Forms — https://web.dev/learn/accessibility/forms — (accessed 2026-09)

### D2. autocomplete 토큰 (1.3.5 Identify Input Purpose)
- 규칙: 1.3.5 "The purpose of each input field collecting information about the user can be programmatically determined…" — HTML `autocomplete` 사용. MDN: `new-password`는 "When creating an new account or changing passwords… as opposed to a general 'Enter your current password' field… may be used by the browser both to avoid accidentally filling in an existing password and to offer assistance in creating a secure password"; `one-time-code`는 SMS/이메일/인증앱 OTP; "In most modern browsers, setting autocomplete to 'off' will not prevent a password manager…". Minnesota 가이드: 장소명 입력에 `autocomplete="name"`을 쓰면 안 됨(사람 이름 전용).
- MYSEOULDROP 적용: 로그인 `email`+`current-password`; 가입 `email`+`new-password`(확인 필드도 `new-password`)+`nickname` 또는 `name`; 이메일 OTP 화면 `one-time-code` + `inputmode="numeric"`; 장소 검색/역 검색 입력에는 `autocomplete="off"`가 아니라 개인정보 토큰을 **붙이지 않음**(콤보박스 팝업과 브라우저 자동완성 충돌 시 `autocomplete="off"` 허용). `onPaste` 차단 없음(A6).
- 출처: W3C WAI — Understanding SC 1.3.5 — https://www.w3.org/WAI/WCAG22/Understanding/identify-input-purpose.html; MDN — HTML autocomplete attribute — https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes/autocomplete; Minnesota IT Services — 위 PDF §2 "Forms and Labels" — (accessed 2026-09)

### D3. 한글 장소명의 lang 처리 (3.1.2 Language of Parts)
- 규칙: 3.1.2 "The human language of each passage or phrase in the content can be programmatically determined except for proper names, technical terms, words of indeterminate language, and words or phrases that have become part of the vernacular…" Understanding: "Proper names generally don't require an explicit programmatic change of language" (예: 영어 문서의 'Albert Camus'). MDN: `lang`은 BCP 47 태그, 부모로부터 상속, 목적은 "to allow assistive technologies such as screen readers to invoke the correct pronunciation"; 인라인 예 `<span lang="ko">한국어</span>`.
- MYSEOULDROP 적용: `<html lang="en">`(영어 UI). 한글 **문자로 표기된** 장소명·주소·역명(예: "올리브영 명동본점", "서울특별시 중구…")은 고유명사라 엄격히는 예외지만, 한글 문자열을 영어 음성으로 읽으면 VoiceOver가 문자 단위로 읽거나 건너뛰므로 실무상 `<span lang="ko">`를 붙이는 것이 강력 권장(비용 거의 없음). 로마자 표기("Olive Young Myeongdong")는 lang 불필요. 리뷰 본문이 한국어면 `lang="ko"`, 일본어면 `ja` — 사용자 리뷰 언어 필드가 없으면 최소한 UI 언어 전환 시 `html lang`을 갱신.
- 출처: W3C WAI — Understanding SC 3.1.2 Language of Parts — https://www.w3.org/WAI/WCAG22/Understanding/language-of-parts.html; MDN — lang global attribute — https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/lang — (accessed 2026-09)

### D4. SPA 라우트 전환 포커스·알림 (2.4.3 Focus Order, Next.js 라우트 어나운서)
- 규칙: Next.js 공식: "Next.js includes a route announcer by default. The Next.js route announcer looks for the page name to announce by first inspecting document.title, then the <h1> element, and finally the URL pathname. For the most accessible user experience, ensure that each page in your application has a unique and descriptive title." web.dev: "Focus must also be maintained when a user navigates from page-to-page" — 메인 컨테이너/스킵 링크/새 페이지 h1으로 포커스 이동; 라이브 리전은 로드 시 DOM에 존재해야 함.
- MYSEOULDROP 적용: 모든 라우트에 `generateMetadata`로 고유 `title`(예: "Olive Young Myeongdong – MYSEOULDROP") — 어나운서가 이걸 읽음. 장소 상세 페이지 진입 시 `<h1>`(장소명)에 `tabIndex={-1}` 두고 포커스 이동; 뒤로 가기 시 목록의 원래 항목으로 포커스 복원(스크롤 위치와 함께). 클라이언트 내 시트 전환(라우트가 아닌 상태 변경)은 어나운서가 감지 못하므로 C1의 다이얼로그 포커스 관리로 처리.
- 출처: Next.js — Accessibility (docs v16.3.5, last updated 2024-11-06) — https://nextjs.org/docs/architecture/accessibility; web.dev — Learn Accessibility: JavaScript — https://web.dev/learn/accessibility/javascript; W3C WAI — Understanding SC 2.4.3 — https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html — (accessed 2026-09)

---

## E. 모션·확대·모바일 스크린리더

### E1. 뷰포트 메타에서 확대 차단 금지 (1.4.4, 1.4.10)
- 규칙(MDN 경고): "Disabling zooming capabilities by setting user-scalable to a value of no prevents people experiencing low vision conditions from being able to read and understand page content. Additionally, WCAG requires a minimum of 2× scaling; however, the best practice is to enable a 5× zoom." `maximum-scale`도 동일하며 iOS 10+는 기본적으로 무시. W3C Mobile Accessibility 문서(2015 FPWD): "Restrictive values for user-scalable and maximum-scale attributes of this meta element should be avoided."
- MYSEOULDROP 적용: `viewport: { width: 'device-width', initialScale: 1, viewportFit: 'cover' }`만 사용, `userScalable: false`/`maximumScale: 1` 삭제(지도 앱에서 "핀치가 지도 줌과 충돌"을 이유로 넣는 경우가 많음 — Leaflet은 컨테이너 내부 터치를 자체 처리하므로 페이지 확대 차단은 불필요). 확대 후 바텀시트·필터가 320px 폭에서 가로 스크롤 없이 동작하는지(A9) 확인. `interactive-widget=resizes-content`는 iOS 키보드가 뜰 때 시트 레이아웃 보호에 검토.
- 출처: MDN — Viewport meta element — https://developer.mozilla.org/en-US/docs/Web/HTML/Guides/Viewport_meta_element; W3C — Mobile Accessibility: How WCAG 2.0 and Other W3C/WAI Guidelines Apply to Mobile (FPWD 2015-02-26) — https://www.w3.org/TR/mobile-accessibility-mapping/ — (accessed 2026-09)

### E2. prefers-contrast / forced-colors 대응
- 규칙(MDN): `prefers-contrast: more|less|custom|no-preference`; `custom`은 `forced-colors: active`의 사용자 팔레트와 일치. Tailwind에 `contrast-more:` / `contrast-less:` / `forced-colors:` / `not-forced-colors:` 변형 존재(예: `contrast-more:border-gray-400`, `forced-colors:appearance-auto`).
- MYSEOULDROP 적용: `contrast-more:` 변형으로 필터 칩 테두리·플레이스홀더·보조 텍스트(회색 400→600)를 진하게, 오렌지 텍스트는 `contrast-more:text-[#a33600]`(6.8:1). Windows 고대비(forced-colors)에서는 배경색으로만 표현되는 마커/칩/선택 상태가 사라지므로 `forced-colors:border` 등 테두리 추가, SVG 아이콘은 `fill="currentColor"`.
- 출처: MDN — prefers-contrast — https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-contrast; Tailwind CSS — Hover, focus, and other states — https://tailwindcss.com/docs/hover-focus-and-other-states — (accessed 2026-09)

### E3. 터치·키보드 동등성과 터치 타깃 (W3C Mobile A11y, 2.5.4)
- 규칙: W3C Mobile Accessibility 문서: 터치 타깃 "at least 9 mm high by 9 mm wide"(해상도 무관), 같은 동작을 하는 여러 요소는 "contained within the same actionable element"로 묶기, 외장 키보드·대체 키보드 지원 유지, 입력 줄이기("select menus, radio buttons, check boxes or by automatically entering known information (e.g. date, time, location)"), 기기 흔들기/기울이기엔 터치·키보드 대안. 2.5.4 Motion Actuation: 기기 모션으로 동작하는 기능은 UI 컴포넌트로도 가능하고 끌 수 있어야 함.
- MYSEOULDROP 적용: 리스트 카드에서 썸네일·제목·거리 텍스트가 각각 별개 링크가 아니라 카드 하나가 하나의 링크(+ 형제 하트 버튼). iOS VoiceOver + 블루투스 키보드로 Tab 순서가 시각 순서와 같은지 테스트. "흔들어서 현재 위치" 같은 모션 기능 도입 시 버튼 대안 필수. 현재 위치·근처 역 자동 채움은 W3C가 권장하는 "known information" 자동 입력에 해당.
- 출처: W3C — Mobile Accessibility mapping (2015 FPWD) — https://www.w3.org/TR/mobile-accessibility-mapping/; W3C WAI — Understanding SC 2.5.4 Motion Actuation — https://www.w3.org/WAI/WCAG22/Understanding/motion-actuation.html — (accessed 2026-09)

### E4. iOS VoiceOver 테스트 기본 절차
- 규칙/가이드: Apple: 로터는 "Rotate two fingers on your iOS or iPadOS device's screen as if you're turning a dial"; 웹용 로터 항목 — Headings, Links, Landmarks("Moves between banners, navigation, and buttons in HTML content"), Tables, Images, Buttons, Form Controls, Text Fields, Static Text. WebAIM: 설정 > 손쉬운 사용 > VoiceOver(또는 측면 버튼 3회 클릭), 한 손가락 오른쪽 스와이프=다음 항목, 두 번 탭=활성화, 두 손가락 위로 스와이프=페이지 처음부터 읽기, 세 손가락 스와이프=스크롤; "It is advisable to also conduct VoiceOver testing with a Bluetooth keyboard". web.dev: 헤딩·랜드마크가 스크린리더 사용자의 1차 탐색 수단, "Using an AT to test code against a set of rules and asking users about their experience often yields different results."
- MYSEOULDROP 적용: 테스트 시나리오 — (1) 홈에서 오른쪽 스와이프로 끝까지 훑기: 지도 타일이 읽히지 않는지(role=presentation), 마커 600개를 하나씩 읽지 않는지(B3), 리스트가 "Place list, region"으로 잡히는지. (2) 로터 Headings/Landmarks로 시트·리스트·검색으로 점프 가능한지. (3) 하트 두 번 탭 → "Save …, toggle button, selected/pressed" + status 알림. (4) 로그인 시트 열림 시 VoiceOver 커서가 시트로 들어가고 뒤 지도는 읽히지 않는지. (5) 상세 진입 시 제목이 읽히는지(라우트 어나운서). 스크린리더 대상은 Leaflet 문서도 VoiceOver(iOS/macOS), TalkBack, Narrator, Orca를 열거.
- 출처: Apple Support — About the VoiceOver rotor on iPhone or iPad — https://support.apple.com/en-us/111796; WebAIM — VoiceOver on Mobile — https://webaim.org/articles/voiceover/mobile; web.dev — Learn Accessibility: Test with assistive technology — https://web.dev/learn/accessibility/test-assistive-technology; Leaflet — accessibility guide — https://leafletjs.com/examples/accessibility/ — (accessed 2026-09)

### E5. 포커스 순서·tabindex 위생 (2.4.3, web.dev Focus)
- 규칙: web.dev: "The default focus order must be logical, intuitive, and match the visual order of a page"; `tabindex="0"`은 비포커스 요소를 순서에 추가(키보드 핸들러 직접 구현 필요), `-1`은 순서에서 제외 후 JS로 포커스, 양수 tabindex 금지; outline 제거 코드 경고. Minnesota: 화면 밖 콘텐츠(닫힌 시트/드로어)는 `display:none`으로 포커스 불가하게.
- MYSEOULDROP 적용: 닫힌 바텀시트/드로어가 `translateY(100%)`로만 숨겨져 있으면 Tab이 보이지 않는 요소로 들어감 → 닫힘 상태에서 `hidden`/`inert` 적용. 지도 컨트롤(줌, 현재위치) → 검색 → 필터 → 리스트 순서가 DOM에서도 같은지 확인. `div onClick` 카드는 `<a>`/`<button>`으로(eslint jsx-a11y `click-events-have-key-events`, `no-static-element-interactions`가 잡음).
- 출처: web.dev — Learn Accessibility: Focus — https://web.dev/learn/accessibility/focus; W3C WAI — Understanding SC 2.4.3 — https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html; Minnesota IT Services — 위 PDF §2 "Testing the Visible Focus" — (accessed 2026-09)

---

## F. 자동화 검사 도구

### F1. axe-core + Playwright (@axe-core/playwright)
- 규칙/도구: axe-core는 "on average 57% of WCAG issues automatically" 탐지, WCAG 2.0/2.1/2.2 A·AA·AAA 규칙 보유, 태그 `wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa, best-practice, ACT, EN-301-549` 등. Playwright 공식: `npm install @axe-core/playwright`; `const results = await new AxeBuilder({ page }).analyze(); expect(results.violations).toEqual([]);` `.withTags([...])`, `.include()`, `.exclude('#id')`(해당 요소에 모든 규칙 미적용 주의), `.disableRules(['duplicate-id'])`; "many accessibility problems can only be discovered through manual testing."
- MYSEOULDROP 적용: 기존 Playwright e2e(메모리: 캐시된 chromium_headless_shell로 실행)에 a11y 스펙 추가 — 홈(시트 닫힘/열림 두 상태), 상세, 로그인 시트, 지하철 플래너에 `withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa'])`. 지도 타일 영역은 `.exclude('.leaflet-tile-pane')`로 제외하되 마커 페인은 포함(이름 없는 `role=button` 마커를 `button-name` 규칙이 잡음). 오렌지 텍스트는 `color-contrast` 위반으로 잡힐 것 — 디자인 결정으로 유지할 곳은 `#c24100` 토큰 적용 범위를 먼저 좁힌 뒤 남는 항목만 명시적 예외 처리.
- 출처: Deque — axe-core (GitHub README) — https://github.com/dequelabs/axe-core; Deque — axe-core API (tags) — https://github.com/dequelabs/axe-core/blob/develop/doc/API.md; Playwright — Accessibility testing — https://playwright.dev/docs/accessibility-testing — (accessed 2026-09)

### F2. Lighthouse 접근성 점수의 한계
- 규칙: Lighthouse 접근성 점수는 "a weighted average of all accessibility audits"(axe 기반), 부분 통과 점수 없음, 수동 감사·저영향 항목은 점수에 미포함 — 100점이 완전한 접근성을 의미하지 않으며 포커스 관리, 키보드 탐색, 랜드마크 등은 수동 확인 목록.
- MYSEOULDROP 적용: CI 게이트로 Lighthouse a11y ≥ 95를 두되, 바텀시트 포커스 트랩·마커 키보드 접근·라이브 리전은 E4의 수동 체크리스트로 보완. gstack `/benchmark`·`/audit` 스킬이 Lighthouse를 감싸므로 그 결과에 위 수동 항목을 병기.
- 출처: Chrome for Developers — Lighthouse accessibility scoring — https://developer.chrome.com/docs/lighthouse/accessibility/scoring — (accessed 2026-09)

### F3. eslint-plugin-jsx-a11y (Next.js 기본 포함)
- 규칙: Next.js는 `eslint-plugin-jsx-a11y`를 기본 포함하여 `aria-props, aria-proptypes, aria-unsupported-elements, role-has-required-aria-props, role-supports-aria-props` 등을 경고. 플러그인 flat config: `import jsxA11y from 'eslint-plugin-jsx-a11y'; export default [jsxA11y.flatConfigs.recommended, …]` (또는 `strict`). 핵심 규칙: `click-events-have-key-events`, `no-static-element-interactions`, `interactive-supports-focus`, `label-has-associated-control`, `alt-text`, `anchor-is-valid`, `no-autofocus`, `control-has-associated-label`.
- MYSEOULDROP 적용: `eslint-config-next`의 기본 세트에서 `jsxA11y.flatConfigs.strict`로 상향하고 `click-events-have-key-events`/`no-static-element-interactions`를 error로 — 지도 위 커스텀 컨트롤과 카드 `div onClick`을 빌드 단계에서 차단. divIcon의 `html` 문자열은 정적 분석 밖이므로 F1의 런타임 검사로 커버.
- 출처: Next.js — Accessibility — https://nextjs.org/docs/architecture/accessibility; jsx-eslint — eslint-plugin-jsx-a11y (GitHub README) — https://github.com/jsx-eslint/eslint-plugin-jsx-a11y — (accessed 2026-09)

---

## 지금 앱에서 확인해야 할 10가지

1. `viewport` 메타에 `user-scalable=no` / `maximum-scale=1`이 있는지 → 있으면 제거 (E1, 1.4.4).
2. `<html lang="en">`이 있고, 한글 장소명·주소 렌더링 컴포넌트에 `lang="ko"`가 붙는지 (D3, 3.1.2).
3. div-icon 마커를 VoiceOver/axe로 열어 "button, (이름 없음)"으로 나오는지 → `alt`/`title` + sr-only 텍스트 (B3, 4.1.2). 동시에 `MapContainer`/`Marker`에 `keyboard={false}`가 없는지 (B2).
4. 바텀시트: 열렸을 때 `role=dialog aria-modal` + `inert` 배경 + Esc + 포커스 복귀가 되는지, 닫혔을 때 내부 요소가 Tab으로 잡히지 않는지 (C1, E5, 2.4.11).
5. 즐겨찾기 하트가 `<button aria-pressed>`이고 라벨이 상태에 따라 바뀌지 않는지, 색 외에 채움 변화가 있는지 (C2, 1.4.1).
6. 로그인/가입 입력의 `autocomplete`(email / current-password / new-password)와 붙여넣기 허용, 보이는 `<label>`, 제출 후 `aria-invalid` + `aria-describedby` (A6, D1, D2).
7. 본문 크기 오렌지 텍스트(가격·링크·활성 탭·버튼 라벨)를 목록화하고 `#c24100`(5.19:1)류 텍스트 토큰으로 교체 또는 18.66px bold 이상으로 (A7).
8. 지도 줌 +/− 버튼과 팬 대안(버튼 또는 리스트 "지도에서 보기")이 시각적으로 존재하는지, 시트 스와이프에 탭 대안이 있는지 (A4, 2.5.7/2.5.1).
9. iOS "동작 줄이기" 켜고: 시트 슬라이드/지도 flyTo/타일 페이드가 꺼지거나 페이드로 대체되는지 (`matchMedia` → Leaflet 옵션) (A10).
10. 필터 변경·지도 이동 시 "N places" 가 `role=status`로 알려지는지, 각 라우트 `title`이 고유해 라우트 어나운서가 읽는지, 첫 Tab이 "Skip to place list"인지 (B4, B6, D4).

---

## 접근 실패/제한 사항
- Harvard HUIT "How to Test Accessibility with an iPhone" (https://accessibility.huit.harvard.edu/test-iphone) — HTTP 403, 내용 미확인.
- Apple iPhone User Guide "Control VoiceOver using the rotor" (https://support.apple.com/guide/iphone/control-voiceover-using-the-rotor-iph3e2e3a6d/ios) — 페이지 본문이 반환되지 않아 대신 Apple Support 111796 문서를 인용.
- W3C WAI RD Wiki "Accessible Maps" (https://www.w3.org/WAI/RD/wiki/Accessible_Maps) — fetch 성공했으나 "does not necessarily represent consensus" 초안이며 촉각/음향 지도 연구 중심이라 실무 항목에 인용하지 않음.
- Maps4HTML UCR 문서(https://maps4html.org/HTML-Map-Element-UseCases-Requirements/)는 "map viewer must be explorable with… mouse/trackpad, touchscreen gestures, standard/intuitive keyboard shortcuts, accessibility API events" 요구만 확인됨; MapML-Proposal Issue #43은 "Most map libraries today largely or entirely neglect screen reader users and keyboard users"라는 문제 제기 외 세부 합의는 링크된 다른 이슈에 있어 미확인.
- accessibility.build 가이드는 2차 출처(민간)이며 W3C 문서로 교차 확인된 부분만 사용.