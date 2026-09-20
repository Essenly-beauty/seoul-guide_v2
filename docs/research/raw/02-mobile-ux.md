# MYSEOULDROP 모바일 사용성·UX 가이드라인 리서치 (권위 있는 출처 기반)

작성 기준일: 2026-09-20. 아래 모든 URL은 이번 세션에서 실제로 fetch하여 내용을 확인한 페이지이며, 가져오지 못한 페이지는 맨 끝 "가져오지 못한 페이지" 절에 명시했습니다. Apple HIG는 HTML이 JS 렌더링이라 본문이 비어 나와서, 동일 콘텐츠를 제공하는 공식 데이터 엔드포인트(`developer.apple.com/tutorials/data/design/human-interface-guidelines/*.json`)로 읽었습니다. Material 3는 `r.jina.ai` 리더 프록시로 본문을 읽었고, 숫자 스펙은 M2 공식 접근성 페이지·Android 개발자 문서·web.dev로 교차 확인했습니다.

우선순위 표기: **[P0]** 즉시 점검, **[P1]** 다음 스프린트, **[P2]** 여유 시.

---

## A. 터치/레이아웃 기본

### 1. 터치 타깃 최소 크기: 44pt(iOS) / 48dp(Android·Web) / 물리 7–10mm [P0]
- 근거/원칙: Apple HIG는 iOS·iPadOS 컨트롤의 기본 히트 영역을 **44×44pt**(최소 28×28pt)로 규정. Material(M2 접근성 페이지)은 "터치 타깃을 **최소 48×48dp**로", Android 문서도 "최소 48dp×48dp, 클수록 좋다". web.dev는 "48dp ≈ **9mm**, 손가락 패드 크기". NN/g는 렌더링된 물리 크기 **1cm×1cm(0.4in)**, Baymard는 **7mm×7mm** 최소 히트 영역을 권고. WCAG 2.2는 최소 24×24 CSS px(2.5.8, AA), 강화 기준 44×44 CSS px(2.5.5, AAA).
- MYSEOULDROP 적용 제안: 지도 위 마커, 바텀시트의 카테고리 칩, 필터 칩, 상세화면의 "복사" 아이콘 버튼, 즐겨찾기 하트, 별점 별 하나하나를 44×44 CSS px 이상으로(시각 크기가 작더라도 padding으로 히트 영역 확보). Leaflet 마커는 `iconSize`/`iconAnchor`를 최소 44px 박스로 잡고, 겹치는 마커는 클러스터링(항목 12).
- 출처: Apple — Human Interface Guidelines: Accessibility — https://developer.apple.com/design/human-interface-guidelines/accessibility — (accessed 2026-09, JSON 엔드포인트로 확인) / Google — Material Design (M2) Accessibility: Layout and typography — https://m2.material.io/design/usability/accessibility.html — (accessed 2026-09) / Google — Android: Make apps more accessible — https://developer.android.com/guide/topics/ui/accessibility/apps — (accessed 2026-09) / Google — web.dev: Accessible tap targets — https://web.dev/articles/accessible-tap-targets — (2020-03-31) / NN/g — Touch Targets on Touchscreens — https://www.nngroup.com/articles/touch-target-size/ — (2019-05-05) / Baymard — Button Design: Best Practices — https://baymard.com/learn/button-design — (accessed 2026-09) / W3C — Understanding SC 2.5.8 Target Size (Minimum) — https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html — (accessed 2026-09) / W3C — Understanding SC 2.5.5 Target Size (Enhanced) — https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced.html — (accessed 2026-09)

### 2. 타깃 간 간격 8dp(≈2mm) 이상, 이동 중 사용자는 더 크게 [P0]
- 근거/원칙: Material: "**8dp 이상** 떨어진 터치 타깃이 균형 잡힌 밀도와 사용성을 만든다". web.dev: "가로·세로 **약 8px** 간격". NN/g: 흔히 권장되는 최소 간격은 **약 2mm**, 손가락 끝 폭 1.6–2cm, 엄지 접촉면 **2.5cm**; "걷거나 이동 중 사용"에는 더 큰 타깃이 필요. Baymard 모바일 연구: 어떤 사이트는 히트 영역이 **~1.9mm×1.9mm**에 불과해 오탭·미등록 탭이 대량 발생.
- MYSEOULDROP 적용 제안: 카테고리 칩 행, 지도 우측 컨트롤(현재 위치·확대축소), 상세화면 액션 행(복사/길찾기/저장)에 최소 8px 간격. 여행자는 걸으면서 쓰므로 주요 CTA(길찾기, 주소 복사)는 48px 높이 이상 풀폭 버튼으로.
- 출처: 위 Material M2·web.dev·NN/g 링크 동일 / Baymard — Understanding Mobile E-Commerce UX: 5 Overarching Issues — https://baymard.com/blog/mobile-commerce-design — (2021-01-26)

### 3. 엄지 존: 49% 한 손·75% 엄지 → 핵심 컨트롤은 하단 [P0]
- 근거/원칙: Hoober의 1,333건 거리 관찰: **한 손 49%**(그중 오른엄지 67%), **받쳐 들기 36%**, **두 손 15%**; 사용자는 몇 초마다 잡는 방식을 바꿈. Smashing(2019)이 인용: "**75%**가 엄지 하나로 터치". NN/g 연구: 모바일에서 보이는 내비게이션(콤보) 사용률 **86%** vs 숨긴 햄버거 **57%**, 숨기면 과제 **15% 느려짐**.
- MYSEOULDROP 적용 제안: 지도 화면의 "현재 위치", "이 지역 검색", 리스트 열기 핸들, 필터 버튼을 화면 하단 1/3(엄지 녹색 존)에 배치. 상단 우측 코너에 자주 쓰는 액션을 두지 말 것(뒤로가기·언어 전환 정도만). 세 가지 그립 모두로 실기기 테스트.
- 출처: UXmatters — Steven Hoober, How Do Users Really Hold Mobile Devices? — https://www.uxmatters.com/mt/archives/2013/02/how-do-users-really-hold-mobile-devices.php — (2013-02-18) / Smashing Magazine — Bottom Navigation Pattern On Mobile Web Pages: A Better Alternative? — https://www.smashingmagazine.com/2019/08/bottom-navigation-pattern-mobile-web-pages/ — (2019-08-29) / NN/g — Hamburger Menus and Hidden Navigation Hurt UX Metrics — https://www.nngroup.com/articles/hamburger-menus/ — (2016-06-26)

### 4. iOS Safe Area: `viewport-fit=cover` + `env(safe-area-inset-bottom)` [P0]
- 근거/원칙: Apple HIG: "세이프 에어리어는 하드웨어 기능이나 툴바·탭바·상태바 같은 다른 뷰에 가려지지 않는 영역… 이를 지키는 것이 필수". WebKit 공식 블로그: `<meta name='viewport' content='initial-scale=1, viewport-fit=cover'>` 후 `padding-bottom: max(12px, env(safe-area-inset-bottom))` 식으로 고정 하단 바에 적용.
- MYSEOULDROP 적용 제안: PWA 하단 탭바·바텀시트 최하단·지도 위 플로팅 버튼에 `env(safe-area-inset-bottom)` 패딩(홈 인디케이터와 충돌 방지). 지도 상단 컨트롤은 `safe-area-inset-top`(다이나믹 아일랜드). 스탠드얼론 모드와 Safari 탭 모드 둘 다 스크린샷 검증.
- 출처: Apple — HIG: Layout — https://developer.apple.com/design/human-interface-guidelines/layout — (accessed 2026-09, JSON 엔드포인트로 확인) / WebKit — Designing Websites for iPhone X — https://webkit.org/blog/7929/designing-websites-for-iphone-x/ — (2017-09-22)

### 5. 색 대비: 브랜드 오렌지 #e94f00은 본문 텍스트용으로 부족 [P1]
- 근거/원칙: Apple HIG: 17pt 이하 텍스트 **4.5:1**, 18pt 이상 또는 볼드 **3:1**; Android: 18sp 미만(볼드 14sp 미만) **4.5:1**, 그 외 **3:1**. Material 내비게이션 바 아이콘은 컨테이너 대비 **3:1** 이상. (WCAG 상대휘도 공식으로 직접 계산: #e94f00 vs 흰색 ≈ **3.8:1** — 큰 텍스트·아이콘·UI 컴포넌트는 통과, 작은 본문·라벨은 미달.)
- MYSEOULDROP 적용 제안: 오렌지를 작은 텍스트(거리 "350m", 칩 라벨, 링크)에 쓰지 말고 채움색·아이콘·큰 헤드라인·볼드에만 사용. 텍스트용은 더 진한 오렌지(예: 4.5:1 이상 확보한 변형 토큰)를 별도 정의. 흰 글자 on 오렌지 버튼도 동일 비율(≈3.8:1)이므로 버튼 라벨은 볼드·17px 이상으로.
- 출처: Apple — HIG: Accessibility (Color and effects) — https://developer.apple.com/design/human-interface-guidelines/accessibility — (accessed 2026-09) / Google — Android: Make apps more accessible — https://developer.android.com/guide/topics/ui/accessibility/apps — (accessed 2026-09) / Google — Material 3: Navigation bar guidelines — https://m3.material.io/components/navigation-bar/guidelines — (accessed 2026-09 via r.jina.ai)

### 6. 제스처 전용 조작 금지, 항상 탭 대안 제공 [P1]
- 근거/원칙: Apple HIG: "특정 제스처를 쓸 수 있다고 가정하지 말 것… 단축 제스처는 표준 제스처를 보완할 뿐 대체하지 않는다"; "시스템 UI 제스처(엣지 스와이프)와 충돌하는 커스텀 제스처를 피하라". NN/g 바텀시트: 그랩 핸들은 많은 사용자가 놓치거나 정확히 스와이프하지 못하므로 **보이는 Close(X) 버튼** 포함.
- MYSEOULDROP 적용 제안: 바텀시트 확장/축소는 드래그 외에 핸들 탭·"목록 보기/지도 보기" 버튼으로도 가능하게. 화면 좌측 엣지 근처의 가로 스와이프(카테고리 캐러셀 등)는 iOS 뒤로가기 제스처와 충돌하므로 좌측 16–20px 여백을 둘 것.
- 출처: Apple — HIG: Gestures — https://developer.apple.com/design/human-interface-guidelines/gestures — (accessed 2026-09) / NN/g — Bottom Sheets: Definition and UX Guidelines — https://www.nngroup.com/articles/bottom-sheet/ — (2023-06-11)

---

## B. 내비게이션·바텀시트·FAB

### 7. 하단 탭바: 3–5개, 항상 라벨, 항상 보이게, 액션 금지 [P0]
- 근거/원칙: Material 3: "내비게이션 바는 **3~5개** 목적지… 모든 항목에 **라벨 필수**(1–2단어)… 라벨 제거·줄바꿈·잘림 금지". Apple HIG: "탭 라벨은 가능한 **한 단어**"; "탭바는 내비게이션용이지 액션용이 아니다"; "탭바를 숨기면 사용자가 어느 영역에 있는지 잊는다"; "콘텐츠가 없어도 탭을 비활성화·숨기지 말 것". NN/g: 5개 넘으면 터치 타깃 유지가 어려움. NN/g 아이콘 연구: 보편 아이콘은 홈·프린트·검색(돋보기) 정도뿐이므로 **텍스트 라벨 필수**. Smashing: 라벨 병기 시 참여 75% 증가(인용), 각 탭은 메뉴가 아닌 목적지로 바로 이동.
- MYSEOULDROP 적용 제안: 탭 구성을 예: `Map · Subway · Saved · Me`(4개)로 고정. "Filter"나 "Search"처럼 액션성 항목은 탭이 아니라 화면 내 컨트롤로. 상세화면에 들어가도 탭바 유지(iOS는 하단 플로팅). 게스트도 Saved 탭을 숨기지 말고 빈 상태(항목 20)로 안내.
- 출처: Google — Material 3: Navigation bar guidelines — https://m3.material.io/components/navigation-bar/guidelines — (accessed 2026-09 via r.jina.ai) / Apple — HIG: Tab bars — https://developer.apple.com/design/human-interface-guidelines/tab-bars — (accessed 2026-09) / NN/g — Basic Patterns for Mobile Navigation: A Primer — https://www.nngroup.com/articles/mobile-navigation-patterns/ — (2015-11-15) / NN/g — Icon Usability — https://www.nngroup.com/articles/icon-usability/ — (2014-07-27) / Smashing Magazine — The Golden Rules Of Bottom Navigation Design — https://www.smashingmagazine.com/2016/11/the-golden-rules-of-mobile-navigation-design/ — (2016-11-02)

### 8. 지도 위 리스트 바텀시트: 논모달 + 디텐트(반/전체) + 그래버 + 보이는 닫기 [P0]
- 근거/원칙: Apple HIG: "iOS 시트는 모달/논모달 가능… **medium 디텐트는 전체의 약 절반**… iPhone 앱에서는 점진적 공개를 위해 medium 디텐트 지원을 고려… **리사이즈 가능한 시트에는 그래버 포함**(탭하면 디텐트 순환, VoiceOver 지원)… 스와이프로 닫기 지원… **한 번에 시트 하나만**". Material 3: 스탠다드 시트는 "메인 UI와 공존하며 동시에 보고 상호작용"; 드래그 핸들 선택 시 프리셋 높이 순환; 모달 초기 높이는 화면의 **50%** 상한; 폭 **640dp**까지 풀폭. NN/g: 배경 콘텐츠를 참조해야 할 때 논모달이 적합; **보이는 Close(X)**·기기 뒤로가기로 닫기·**시트 겹치기 금지**·페이지 간 플로우 대체 금지.
- MYSEOULDROP 적용 제안: 지도 화면 리스트는 논모달 스탠다드 시트로 3단(피크≈헤더+칩 행 / 절반 / 전체). 상단 그래버(32×4dp 시각, 44px 히트) + 전체 확장 시 X 버튼 노출. 시트를 전체로 올리면 지도 조작 불가하므로 "지도 보기" 버튼 제공. 장소 상세는 시트 위에 또 시트를 쌓지 말고 라우트(페이지)로 이동하되 뒤로가기 시 시트 상태 복원.
- 출처: Apple — HIG: Sheets — https://developer.apple.com/design/human-interface-guidelines/sheets — (accessed 2026-09) / Google — Material 3: Bottom sheets guidelines — https://m3.material.io/components/bottom-sheets/guidelines — (accessed 2026-09 via r.jina.ai) / Google — Material 3: Bottom sheets specs — https://m3.material.io/components/bottom-sheets/specs — (accessed 2026-09 via r.jina.ai) / NN/g — Bottom Sheets: Definition and UX Guidelines — https://www.nngroup.com/articles/bottom-sheet/ — (2023-06-11)

### 9. 오버레이 실수 닫힘 방지: 작업 손실 없이, 부분 오버레이 우선 [P1]
- 근거/원칙: NN/g 연구: 닫기 방식(X, 바깥 탭, 스와이프, 뒤로가기)이 앱마다 달라 사용자가 잘못 닫고 여러 단계 뒤로 튕겨 작업을 잃음. 권고: 가능하면 오버레이 대신 페이지/아코디언, **전체화면보다 부분 오버레이**, **스택 금지**, 모든 오버레이에 보이는 닫기 버튼 + 기기 뒤로가기 지원. Apple 모달리티: "모달 뷰를 닫는 명확한 방법을 항상 제공… 닫으면 사용자 생성 콘텐츠가 사라질 때는 확인".
- MYSEOULDROP 적용 제안: 필터 시트에서 바깥 탭으로 닫혀도 선택 중이던 필터가 사라지지 않게(적용 전 상태 보존 또는 "적용 안 함" 명시). 리뷰 작성 시트는 스와이프 닫기 시 작성 중 텍스트가 있으면 "삭제/계속 작성" 액션시트. Android 뒤로가기(`popstate`)로 시트가 닫히도록 history 연동.
- 출처: NN/g — Accidental Dismissal of Overlays: A Common Mobile Usability Problem — https://www.nngroup.com/articles/accidental-overlay-dismissal/ — (2022-09-18) / Apple — HIG: Modality — https://developer.apple.com/design/human-interface-guidelines/modality — (accessed 2026-09)

### 10. FAB는 화면당 1개, 가장 중요한 단일 액션만 [P1]
- 근거/원칙: Material 3: "FAB는 화면에서 **가장 중요한 액션**에… **한 화면에 여러 FAB 표시 금지**… 컴팩트 기기는 **우하단**… 사소하거나 파괴적 액션(휴지통, 알림/에러, 툴바에 맞는 컨트롤)에 쓰지 말 것". Material 3 스낵바: "FAB **위**에 표시… 자주 쓰는 터치 타깃이나 내비게이션 앞에 두지 말 것".
- MYSEOULDROP 적용 제안: 지도 화면의 플로팅 버튼은 "현재 위치"(지도 컨트롤)와 "이 지역 검색"(상태 의존 칩)만 두고 FAB 스타일의 오렌지 원형 버튼은 최대 1개(예: 저장 목록 화면의 "새 목록"). 토스트/스낵바는 탭바·FAB 위 영역에 띄우고 `safe-area-inset-bottom` 반영.
- 출처: Google — Material 3: FAB guidelines — https://m3.material.io/components/floating-action-button/guidelines — (accessed 2026-09 via r.jina.ai) / Google — Material 3: Snackbar guidelines — https://m3.material.io/components/snackbar/guidelines — (accessed 2026-09 via r.jina.ai)

---

## C. 지도 UX 패턴

### 11. 리스트를 기본으로, 지도는 토글: 거리 표시가 핵심 [P0]
- 근거/원칙: NN/g 모바일 지도 연구: "**기본 뷰는 리스트**"(정보 밀도가 높고 선택이 빠름); "검색 위치로부터의 **거리만 있으면 사용자는 리스트에서 기꺼이 선택**"; 결과 페이지에 지도가 없어도 "지도를 원한다고 말한 사용자는 한 명도 없었다"; 지도는 상세 페이지·길찾기에서 유용. 지도 마커가 촘촘하면 "손가락 패드가 여러 핀을 동시에 누름". Google Locator Plus: 직선거리와 경로거리는 자주 다르므로 Distance Matrix로 **도보 등 이동수단별 거리·시간** 계산 권고.
- MYSEOULDROP 적용 제안: 첫 진입 시 바텀시트를 "절반" 디텐트로 열어 리스트가 즉시 보이게(지도 풀스크린만 보이는 상태로 시작하지 않기). 각 리스트 행에 거리(m/km)와 도보 분(可能하면 경로 기반)을 항상 표시. "List / Map" 세그먼트 토글을 시트 헤더에.
- 출처: NN/g — Maps and Location Finders on Mobile Devices — https://www.nngroup.com/articles/mobile-maps-locations/ — (2014-01-19) / Google — Locator Plus implementation guide — https://developers.google.com/maps/solutions/store-locator/best-practices — (updated 2026-09-17)

### 12. 겹치는 마커는 클러스터링, 마커 간 간격 확보 [P0]
- 근거/원칙: Apple HIG Maps: "**겹치는 관심지점을 클러스터링**해 가독성 향상… 확대하면 클러스터가 점진적으로 개별 POI로 펼쳐진다". Google 클러스터링 가이드: 기본 그리드 **60×60px**, 기본 **2개**부터 클러스터, 클릭 시 포함 마커가 모두 보이는 범위로 줌; 마커 추가/제거는 지도가 정지했을 때(`dragend`)만. Mapbox iOS 디자인 가이드: "핀·현재위치·경로선 같은 인터랙티브 요소를 주변 지도와 쉽게 구분… 부정확한 탭을 감안해 마커 사이 간격을 충분히".
- MYSEOULDROP 적용 제안: Leaflet에 `markercluster` 적용(그리드 60px 내외, 카테고리별 색 유지). 클러스터 탭 → `fitBounds`. 올리브영·다이소처럼 밀집 매장은 줌 15 이하에서 항상 클러스터. 마커 이미지가 44px 미만이면 투명 히트 영역 확대.
- 출처: Apple — HIG: Maps — https://developer.apple.com/design/human-interface-guidelines/maps — (accessed 2026-09) / Google Maps Platform — How to cluster map markers — https://mapsplatform.google.com/resources/blog/how-cluster-map-markers/ — (2019-12-20) / Mapbox — Map design for iOS (Maps SDK v6) — https://docs.mapbox.com/ios/legacy/maps/guides/map-design-for-ios/ — (accessed 2026-09)

### 13. 선택 마커 상태 구분 + 장소 카드 띄워도 위치가 보이게 [P0]
- 근거/원칙: Apple HIG Maps: "선택된 요소를 명확히 식별… **외곽선과 색 변화** 같은 구별되는 스타일"; "장소 카드를 표시할 때 **지도 위 해당 위치가 계속 보이도록** 유지"; 어노테이션 아이콘 문자열은 **2–3자**; 커스텀 컨트롤은 지도와 대비를 위해 **얇은 스트로크나 옅은 그림자**; 장소 카드 스타일 중 caption은 "Open in Apple Maps" 링크만 표시.
- MYSEOULDROP 적용 제안: 리스트 행 탭/마커 탭 시 마커를 오렌지 확대+흰 테두리로 승격하고 나머지는 회색 톤다운(양방향 동기화). 미리보기 카드가 마커를 가리지 않도록 지도를 `panBy`로 위쪽으로 밀어 마커를 카드 위에 유지. 흰 지도 위 흰 컨트롤 버튼에는 1px 스트로크+섀도.
- 출처: Apple — HIG: Maps — https://developer.apple.com/design/human-interface-guidelines/maps — (accessed 2026-09)

### 14. "이 지역 검색" 버튼: 지도 이동 시 나타나고, 클릭 후 숨김 [P1]
- 근거/원칙: Map UI Patterns: "지도 범위가 바뀌어 새 피처를 요청할 수 있을 때 버튼을 표시, 사용자가 클릭해 현재 범위를 가져오면 다시 숨김"; 대안으로 "Search as map moves" 체크박스 — Google Maps·Airbnb·Yelp가 둘 다 제공. 자동 갱신은 대역폭 낭비와 리스트가 계속 바뀌는 혼란을 유발. Mapbox 공식 예제도 "지도를 움직이면 검색 버튼이 다시 나타난다"는 동일 패턴.
- MYSEOULDROP 적용 제안: 지도 `moveend`에서 이전 조회 범위와 일정 비율 이상 벗어나면 상단 중앙(엄지 도달 가능하면 시트 헤더 위)에 "Search this area" 칩 표시. 클릭 시 기존 마커 교체 + 리스트 갱신 + 결과 수 표시. 로밍 데이터 사용자 배려로 자동 갱신은 기본 off.
- 출처: Map UI Patterns — Search this area — https://mapuipatterns.com/search-this-area/ — (accessed 2026-09) / Mapbox — Search again in an area (Maps SDK v9 Android example) — https://docs.mapbox.com/android/legacy/maps/examples/redo-search-in-area/ — (accessed 2026-09)

### 15. 위치 권한 프라이밍 + 명시적 "현재 위치" 버튼 + 기본 위치 폴백 [P0]
- 근거/원칙: Apple HIG Privacy: "앱이 명백히 필요할 때만 권한 요청… **실행 시점 요청은 피하라**… 사용자가 해당 기능을 실제로 쓸 때 요청"; 사전 화면에는 **버튼 하나("Continue"/"Next")**만 두고 시스템 알림을 열게; "가게 찾기 등에는 **위치 버튼**으로 가벼운 1회 공유". Android: "기능과 상호작용을 시작할 때 **맥락 속에서** 요청… 거부 시 **우아하게 저하**… 전체화면 경고로 앱 사용을 막지 말 것… 대략 위치(약 3km²)만 허용해도 앱이 동작해야". NN/g 스토어 파인더: "**명시적 'Use Current Location' 요소**(버튼·체크박스·링크) 포함". Google Locator Plus: 위치 미확보 시 **주소 자동완성 입력**(geocode 타입 제한)으로 폴백. Map UI Patterns Locate-me: 버튼은 "모바일에서는 하단 근처 코너", 위치 확보 시 "줌+센터+파란 점", 지도를 옮기면 아이콘의 점이 사라지는 상태 표현. Growth.design Hopper 사례: 사용자 의도로 트리거될 때 수락률↑.
- MYSEOULDROP 적용 제안: 첫 진입 시 권한 팝업 없이 **서울 시청/명동 기본 뷰**로 로드하고, "Near me" 버튼을 눌렀을 때만 (1) 한 문장 프라이밍 시트("주변 K-뷰티 장소를 거리순으로 보여드려요" + Continue) → (2) 브라우저 권한. 거부 시 검색창에 "호텔/역 이름 입력" 폴백(자동완성)과 "지도를 움직여 이 지역 검색" 안내. 위치 확보 후 파란 점 + 정확도 원. iOS Safari PWA는 권한이 세션마다 재요청될 수 있으니 상태 텍스트로 안내.
- 출처: Apple — HIG: Privacy (Requesting permission) — https://developer.apple.com/design/human-interface-guidelines/privacy — (accessed 2026-09) / Google — Android: Request runtime permissions — https://developer.android.com/training/permissions/requesting — (accessed 2026-09) / Google — Android: Request location permissions — https://developer.android.com/develop/sensors-and-location/location/permissions — (accessed 2026-09) / NN/g — Store Finders and Locators — https://www.nngroup.com/articles/store-finders-and-locators/ — (2018-10-07) / Google — Locator Plus implementation guide — https://developers.google.com/maps/solutions/store-locator/best-practices — (updated 2026-09-17) / Map UI Patterns — Locate me — https://mapuipatterns.com/locate-me/ — (accessed 2026-09) / Growth.design — How Hopper Perfectly Nails Permission Requests UX — https://growth.design/case-studies/hopper-permission-requests-ux — (accessed 2026-09)

### 16. 스크롤 vs 지도 팬 충돌("스와이프 모호성") 제거 [P1]
- 근거/원칙: NN/g: 페이지 안에 임베드된 인터랙티브 지도는 사용자가 스크롤하려다 지도 팬이 걸리는 "swipe ambiguity"를 유발 → 좌우 거터를 두거나 지도 접기 링크 제공; 느린 연결에서 지도가 "무반응"으로 보이면 통제감 상실. Apple HIG: "지도는 인터랙티브하게… 지도를 가리는 비인터랙티브 요소는 기대와 충돌".
- MYSEOULDROP 적용 제안: 풀스크린 지도이므로 리스트 시트 영역 안에서는 지도 제스처가 절대 발동하지 않게(터치 이벤트 전파 차단), 시트가 "전체"일 때는 지도 비활성. 장소 상세 안의 미니맵은 정적 이미지+탭 시 확장(스크롤 방해 방지). 타일 로딩 중에는 회색 플레이스홀더 타일과 상단 얇은 프로그레스로 "로딩 중" 표시.
- 출처: NN/g — Maps and Location Finders on Mobile Devices — https://www.nngroup.com/articles/mobile-maps-locations/ — (2014-01-19) / Apple — HIG: Maps — https://developer.apple.com/design/human-interface-guidelines/maps — (accessed 2026-09)

### 17. 길찾기는 외부 지도 앱으로 넘기되, 상세 정보(영업시간·임시휴업)는 앱 안에서 [P1]
- 근거/원칙: NN/g 스토어 파인더: 테스트 11개 중 2개만 자체 지도 도구 사용, 대부분 Google/Apple Maps/Waze로 **링크 아웃**해 더 일관된 경험; 각 지점의 편의시설·"특정 시간에 영업" 같은 요구를 지원. Google Locator Plus: "영업시간·사진·리뷰… **임시 휴업 상태**"를 보여주고, 길찾기 링크를 문자/이메일로 보낼 수 있게. Apple HIG Maps: 검색 + **카테고리 필터** 조합 권장.
- MYSEOULDROP 적용 제안: 상세화면 상단 고정 액션: [Copy Korean address] [Directions ▾ (Google/Kakao/Naver)] [Save]. 한국에서는 Google Maps 도보/대중교통 안내가 제한적이라는 점을 앱 내 한 줄 힌트로 알리고 Naver/Kakao를 기본 추천. 영업시간·오늘 영업 여부·임시휴업을 리스트 행에도 배지로.
- 출처: NN/g — Store Finders and Locators — https://www.nngroup.com/articles/store-finders-and-locators/ — (2018-10-07) / Google — Locator Plus implementation guide — https://developers.google.com/maps/solutions/store-locator/best-practices — (updated 2026-09-17) / Apple — HIG: Maps — https://developer.apple.com/design/human-interface-guidelines/maps — (accessed 2026-09)

---

## D. 검색·필터·리스트

### 18. 검색: 한 곳에서, 자동완성 4–8개, 인접 제출 버튼, 최근 검색 [P1]
- 근거/원칙: Apple HIG: "검색이 중요하면 **주요 위치**에… 앱 콘텐츠를 **단일 위치**에서 검색… 현재 범위(scope)를 명확히 표시… 최근 검색/예측 제안으로 타이핑 줄이기… 검색 기록은 지울 수 있게". Material 3: 컴팩트(<600dp)에서는 **풀스크린 검색 뷰**가 기본, 포커스 시 clear 아이콘, 뒤로가기는 포커스 해제·제안 닫기. Baymard: 모바일 자동완성 **4–8개**, 제안된 부분만 하이라이트, 넉넉한 행 간격·히트 영역; **21%**가 검색창 옆 제출 버튼이 없고 **17%**가 키보드 키를 "Search/Go"로 바꾸지 않음. NN/g: 나쁜 제안은 "도움이 안 되는 정도가 아니라 사용자를 옆길로 샌다"; 모바일에서는 텍스트 제안만 단순하게; 오타 허용은 비원어민에게 필수(NN/g 국제 사용성).
- MYSEOULDROP 적용 제안: 지도 상단 검색 필드 하나(장소명·역·동네·카테고리 통합), 탭 시 풀스크린 검색 뷰. 제안은 최대 6개(뷰포트 내), "Recent" 섹션, 각 제안에 카테고리 라벨("· Olive Young", "· Station"). `<input type="search" enterkeyhint="search">`, 오른쪽에 돋보기 제출 버튼과 X clear. 로마자/영문 표기 오타(예 "Myungdong/Myeongdong")에 관대한 매칭.
- 출처: Apple — HIG: Searching — https://developer.apple.com/design/human-interface-guidelines/searching — (accessed 2026-09) / Google — Material 3: Search guidelines — https://m3.material.io/components/search/guidelines — (accessed 2026-09 via r.jina.ai) / Baymard — 9 UX Best Practice Design Patterns for Autocomplete Suggestions — https://baymard.com/blog/autocomplete-design — (2022-08-02) / Baymard — Always Provide a Submit Button Adjacent to the Search Field on Mobile — https://baymard.com/blog/mobile-search-submit-button — (2021-06-01) / NN/g — Site Search Suggestions — https://www.nngroup.com/articles/site-search-suggestions/ — (2018-05-20) / NN/g — International Usability: Big Stuff the Same, Details Differ — https://www.nngroup.com/articles/international-usability-details-differ/ — (2011-06-05)

### 19. 필터: "Filter" 텍스트 라벨, 자체 레이어(바텀시트), 배치 적용 + "Show N results", 적용 필터 칩 [P0]
- 근거/원칙: NN/g: "Filter/Refine 같은 텍스트 라벨이 알 수 없는 아이콘보다 훨씬 이해하기 쉽다"; 결과 수는 스크롤해도 **항상 보이게**; 결과가 뒤에 보이면 잘못 적용한 필터를 바로 알아챔. NN/g 배치 vs 인터랙티브: 모바일은 페이지 로드가 느리므로 **배치 적용** 권장(1초 미만이면 인터랙티브 가능), 0건 방지를 위해 개수 표시. Baymard: 필터는 풀스크린 또는 **바텀시트** 레이어, "Filter & Sort" 버튼은 스크롤 중에도 보이게, **스티키 "Show X results"** 버튼이 선택마다 개수 갱신, 변경 없이 나가는 길 제공, **적용 필터 오버뷰**(개별 제거 + 전체 해제; 28%가 미제공), 카테고리별 라벨 불명확 40%. Material 3 필터 칩: 체크박스 대안, 선택 시 체크마크, 다중 선택, 2행 넘으면 가로 스크롤.
- MYSEOULDROP 적용 제안: 시트 헤더에 가로 스크롤 필터 칩(카테고리: Salon / Olive Young / Daiso / Clinic / Spot + Open now) — 칩 탭은 즉시 적용(로컬 데이터라 <1초면 인터랙티브 OK). 거리(500m/1km/3km)·정렬·평점 같은 복합 필터는 "Filter" 텍스트 버튼 → 바텀시트 → 하단 스티키 "Show 23 places" 오렌지 버튼 + "Reset". 적용된 필터는 칩으로 리스트 위에 표시하고 개별 X. 필터 결과 0건이면 "Clear filters" 경로(항목 20).
- 출처: NN/g — Mobile Faceted Search with a Tray — https://www.nngroup.com/articles/mobile-faceted-search/ — (2015-07-26) / NN/g — Applying Filters: Batch or Interactive? — https://www.nngroup.com/articles/applying-filters/ — (2016-02-07) / Baymard — What Is an Ecommerce Filter? UI Best Practices — https://baymard.com/learn/ecommerce-filter-ui — (accessed 2026-09) / Baymard — Filtering UX: Display "Applied Filters" in an Overview — https://baymard.com/blog/how-to-design-applied-filters — (2020-10-06, updated 2026-05-13) / Google — Material 3: Chips guidelines — https://m3.material.io/components/chips/guidelines — (accessed 2026-09 via r.jina.ai)

### 20. 빈 상태: 상태 설명 + 학습 힌트 + 다음 행동 경로 [P1]
- 근거/원칙: NN/g 3원칙: (1) 시스템 상태 전달(로딩 중인지, 없는지 구분), (2) "Star your favorites to list them here" 같은 **풀 리빌레이션** 학습 힌트, (3) 채우기로 가는 **직접 경로**(버튼/링크). Apple 탭바: 콘텐츠 없어도 탭 숨기지 말 것.
- MYSEOULDROP 적용 제안: Saved 탭(게스트/신규): "저장한 장소가 여기 모여요 — 하트를 눌러 저장" + [Explore map] 버튼. 필터 0건: "이 지역엔 Open-now 살롱이 없어요" + [Widen to 3 km] [Clear filters]. 리뷰 0건: "첫 리뷰를 남겨보세요" + 별점 컨트롤. 검색 0건: 오타 제안 + 인기 검색.
- 출처: NN/g — Designing Empty States in Complex Applications: 3 Guidelines — https://www.nngroup.com/articles/empty-state-interface-design/ — (2021-09-19) / Apple — HIG: Tab bars — https://developer.apple.com/design/human-interface-guidelines/tab-bars — (accessed 2026-09)

### 21. 리스트 행은 단일 히트 영역, 내부 아이콘은 명확히 분리 [P1]
- 근거/원칙: Baymard: 모바일은 호버가 없으므로 "여러 히트 영역이 든 복잡한 시각 요소를 피하고 각 항목을 **단일 히트 영역**으로 캡슐화"; 히트 영역 크기는 시각 요소와 일치; 33%가 불명확. NN/g 모바일 이슈: 오탭 후 원래 스크롤 위치로 돌아오려면 긴 재스크롤 필요.
- MYSEOULDROP 적용 제안: 리스트 행 전체 탭 = 상세 이동. 행 안의 하트(저장)만 예외로 두되 44px 히트 영역 + 시각적 분리(원형 배경). 상세에서 뒤로 오면 시트 스크롤 위치·디텐트·선택 마커 복원.
- 출처: Baymard — Make It Clear Where Hit Areas in Visual Elements Lead — https://baymard.com/blog/hit-areas-in-visual-elements — (2022-05-30) / Baymard — Understanding Mobile E-Commerce UX: 5 Overarching Issues — https://baymard.com/blog/mobile-commerce-design — (2021-01-26)

---

## E. 폼·에러·피드백·로딩

### 22. 응답시간 0.1/1/10초 규칙 + 스켈레톤(1–10초) + 진행률(10초↑) [P1]
- 근거/원칙: NN/g: **0.1초** 즉각 반응 한계, **1초** 사고 흐름 유지 한계(작동 중 표시), **10초** 주의 유지 한계(진행률 + 취소). 스켈레톤: 1초 미만은 인디케이터 생략, 1–10초 스켈레톤/스피너, 10초 초과 진행바; 헤더/푸터만 있는 "프레임형" 스켈레톤은 빈 화면처럼 보여 이탈 유발. Apple: "로딩 완료까지 아무것도 안 보이면 앱 문제로 오해… 플레이스홀더를 먼저 보이고 교체"; 백그라운드 로딩으로 다른 행동 허용.
- MYSEOULDROP 적용 제안: 리스트 시트에 카드 모양 스켈레톤(이미지·제목·거리 자리) 5–6개. 지도 타일과 리스트를 병렬 로드하고 시트를 먼저 보여줌. 지하철 경로 계산이 1초 넘으면 "Finding route…" 인라인 스피너, 5초 넘으면 취소 버튼. 저장/별점 탭은 0.1초 내 옵티미스틱 UI.
- 출처: NN/g — Response Times: The 3 Important Limits — https://www.nngroup.com/articles/response-times-3-important-limits/ — (1993, updated 2014) / NN/g — Skeleton Screens 101 — https://www.nngroup.com/articles/skeleton-screens/ — (2023-06-04, reviewed 2026-09-02) / Apple — HIG: Loading — https://developer.apple.com/design/human-interface-guidelines/loading — (accessed 2026-09)

### 23. 에러 메시지: 원인 옆에, 빨강+아이콘, 평이한 말, 해결책, 입력 보존 [P0]
- 근거/원칙: NN/g: "오류 원인 가까이 표시… 굵은 고대비 빨강 + 아이콘 등 중복 신호… 심각도에 맞는 크기(토스트↔모달)… 탐색을 방해하는 조기 검증 금지… 코드 없이 평이한 언어… 건설적 해결책… 'invalid/illegal' 같은 비난 어휘 금지… **사용자 입력 보존**". 휴리스틱 #9 동일. Apple 데이터 입력: "필드 값을 동적으로 검증"(긴 폼을 다 쓰고 나서 고치게 하지 말 것).
- MYSEOULDROP 적용 제안: 로그인/가입: 이메일 형식 오류는 blur 후 필드 아래 인라인(빨강 텍스트+아이콘), 서버 오류(잘못된 비밀번호, 중복 이메일)는 폼 상단이 아니라 해당 필드 옆 + 해결 링크("Reset password" / "Sign in instead"). 오프라인·타일 실패는 시트 상단 비침습 배너 "You're offline — showing saved places" + Retry. 리뷰 제출 실패 시 텍스트 유지.
- 출처: NN/g — Error-Message Guidelines — https://www.nngroup.com/articles/error-message-guidelines/ — (2023-05-14) / NN/g — 10 Usability Heuristics for User Interface Design — https://www.nngroup.com/articles/ten-usability-heuristics/ — (1994, updated 2024-01-30) / Apple — HIG: Entering data — https://developer.apple.com/design/human-interface-guidelines/entering-data — (accessed 2026-09)

### 24. 폼: 타이핑 최소화, 올바른 키보드, 자동교정 off, 라벨은 위에 [P1]
- 근거/원칙: Apple: "시스템에서 얻을 수 있는 정보는 묻지 말 것… 텍스트 입력 대신 **선택지 제공**… 합리적 기본값으로 프리필… 비밀번호 필드는 절대 프리필 금지". Baymard: **54%**가 전화/우편번호 필드에 최적화 키보드 미적용, **79%**가 자동교정 미해제(주소가 잘못 교정되어 제출), **27%**가 자동대문자 문제(사용자가 이메일 대문자를 지우며 불안); 라벨은 **필드 위**(입력 중 보이도록), 인라인(placeholder만) 라벨 금지, 키보드가 뜨면 뷰포트 약 **40%** 감소.
- MYSEOULDROP 적용 제안: 이메일 필드 `type="email" autocomplete="email" autocapitalize="none" autocorrect="off" spellcheck="false" inputmode="email"`, 비밀번호 `autocomplete="current-password"/"new-password"`. 라벨은 필드 위 고정, placeholder는 예시만. 리뷰 작성은 별점 탭 + 선택형 태그(Clean / English OK / Card OK)로 타이핑 최소화, 자유 텍스트는 선택. 이름·국가는 묻지 않기(Google 로그인에서 가져옴).
- 출처: Apple — HIG: Entering data — https://developer.apple.com/design/human-interface-guidelines/entering-data — (accessed 2026-09) / Baymard — 'Touch Keyboard' Implementations Have Improved Just 9% Since 2013 — https://baymard.com/blog/mobile-touch-keyboards — (2015-12-15) / Baymard — 6 Mobile Checkout Usability Considerations — https://baymard.com/blog/mobile-checkout — (2013-10-01)

### 25. 확인 대화상자 대신 되돌리기(Undo) 스낵바, 확인은 되돌릴 수 없는 일에만 [P1]
- 근거/원칙: NN/g: 확인은 "작업 파괴나 큰 비용처럼 **심각하고 되돌릴 수 없는** 결과에만"; 남발하면 "양치기 소년"처럼 무시됨; Yes/No 대신 **서술형 버튼**; "가능한 한 **Undo 제공**". Apple Undo: 결과를 보이게 하고(안 보이는 영역이면 강조), 횟수 제한 금지. Material 스낵바: 액션 **1개**(Undo), 액션 없으면 **4–10초** 자동 소멸, 한 번에 하나, FAB 위·내비 앞 금지.
- MYSEOULDROP 적용 제안: 저장 해제·리뷰 삭제 → 확인 없이 즉시 실행 + "Removed from Saved · Undo" 스낵바(6초). 계정 삭제·전체 저장 목록 삭제만 확인 대화상자(버튼 라벨 "Delete 12 places" / "Keep"). 필터 초기화는 확인 없이 Undo 가능하게.
- 출처: NN/g — Confirmation Dialogs Can Prevent User Errors — If Not Overused — https://www.nngroup.com/articles/confirmation-dialog/ — (2018-02-18, reviewed 2026-08-07) / Apple — HIG: Undo and redo — https://developer.apple.com/design/human-interface-guidelines/undo-and-redo — (accessed 2026-09) / Google — Material 3: Snackbar guidelines — https://m3.material.io/components/snackbar/guidelines — (accessed 2026-09 via r.jina.ai)

---

## F. 온보딩·권한 요청·게스트→가입

### 26. 로그인 벽 금지: 게스트로 끝까지, 가입은 가치가 생기는 순간에 [P0]
- 근거/원칙: NN/g: 로그인 벽은 탐색을 막고 모바일 비밀번호 입력이 고통을 가중; "실제 기능을 먼저 쓰게 하라… 게스트 결제를 주 옵션으로… **호혜(reciprocity)**: 좋은 경험 뒤에 가입 요청". Apple: "핵심 기능이 요구할 때만 계정 생성… **가능한 한 로그인을 늦추라**… 가입 이점을 짧게 설명… 앱 내 계정 생성이 있으면 **삭제**도 앱 내에서 제공". Apple 온보딩: "비필수 설정은 뒤로 미루고 합리적 기본값".
- MYSEOULDROP 적용 제안: 지도·검색·상세·길찾기·주소 복사·지하철 경로는 게스트 100% 가능(현재 구조 유지). 하트를 누르면 로컬 저장 먼저 되고, 두 번째 저장 또는 다른 기기 동기화 시점에 "Sign in to keep your list across devices" 시트 1회(닫기 가능). 리뷰 작성만 로그인 필수로 하되 별점 입력 중 상태를 보존한 채 로그인 후 복귀. 설정에 "Delete account" 노출.
- 출처: NN/g — Login Walls Stop Users in Their Tracks — https://www.nngroup.com/articles/login-walls/ — (2014-03-02) / Apple — HIG: Managing accounts — https://developer.apple.com/design/human-interface-guidelines/managing-accounts — (accessed 2026-09) / Apple — HIG: Onboarding — https://developer.apple.com/design/human-interface-guidelines/onboarding — (accessed 2026-09)

### 27. 온보딩은 없거나 선택적·맥락형 팁으로, 튜토리얼 카드 금지 [P1]
- 근거/원칙: NN/g: 튜토리얼/카드덱은 "인터페이스를 실제보다 복잡해 보이게" 하고 "과제 성과를 개선하지 못했다"; 쓰더라도 건너뛰기+최소 분량, 새롭고 낯선 상호작용에만. Apple: "경험만으로 이해되는 게 이상적… 필요하면 **빠르고 재미있고 선택적**… 단일 플로우 대신 **맥락별 팁**… 건너뛴 튜토리얼은 다음 실행 때 다시 띄우지 말 것… 권한 요청은 핵심 기능에 필수일 때만 온보딩에".
- MYSEOULDROP 적용 제안: 스플래시 뒤 바로 지도. 첫 진입 시 "Search this area" 칩·바텀시트 핸들에 1회성 코치마크(한 줄, 탭하면 사라짐) 정도만. 언어 선택은 브라우저 언어 자동 적용(항목 29) 후 상단에서 변경 가능. 튜토리얼은 "Me > How to use" 에만.
- 출처: NN/g — Mobile-App Onboarding: An Analysis of Components and Techniques — https://www.nngroup.com/articles/mobile-app-onboarding/ — (2020-06-21) / Apple — HIG: Onboarding — https://developer.apple.com/design/human-interface-guidelines/onboarding — (accessed 2026-09)

### 28. 권한·알림 요청 타이밍: 사용자 의도가 트리거 [P1]
- 근거/원칙: Growth.design Hopper 사례: 실행 시점이 아니라 관련 기능을 만나는 순간에 요청, 시각·감성 프라이밍, 직접적 가치 설명, "사용자 의도로 구동될 때 더 자연스럽고 전환이 좋다". Android: "사용자가 이유를 알면 훨씬 편안해한다는 연구… 교육 UI에는 항상 취소 옵션… 거부한 선호를 존중(계속 조르지 말 것)". Apple: 사전 화면에는 시스템 알림을 여는 버튼 하나만.
- MYSEOULDROP 적용 제안: 위치는 항목 15대로. PWA 설치 배너(A2HS)는 3회 방문 또는 저장 1건 이후, 홈 화면 추가의 이점("오프라인에서도 저장한 장소 보기")을 한 줄로. 클립보드 쓰기(주소 복사)는 사용자 탭 직후에만 호출하고 성공 토스트 "Copied — show to taxi driver".
- 출처: Growth.design — How Hopper Perfectly Nails Permission Requests UX — https://growth.design/case-studies/hopper-permission-requests-ux — (accessed 2026-09) / Google — Android: Request runtime permissions — https://developer.android.com/training/permissions/requesting — (accessed 2026-09) / Apple — HIG: Privacy — https://developer.apple.com/design/human-interface-guidelines/privacy — (accessed 2026-09)

---

## G. 여행자(외국인) 특유 고려

### 29. 언어: 브라우저 언어 기본 적용, 자국어 표기 스위처, 국기만 쓰지 않기, 번역 50% 여유 [P1]
- 근거/원칙: NN/g 언어 스위처 6원칙: 브라우저 설정으로 **자동 감지·기본 적용**, 모바일은 상단 접힘 위/메뉴 안에, 언어명은 **자국어("Español", "日本語")**, "국기만 쓰면 인식이 어려움" → 국기+언어명 조합, 언어와 국가/통화는 **독립적으로** 변경. NN/g 국제 사용성: 번역 라벨은 **50% 확장** 여유, 비원어민을 위한 **철자 관용**, 단위는 지역 기대에 맞게. NN/g 아이콘: 국가마다 다른 우체통보다 봉투처럼 **문화 불변 아이콘** 사용.
- MYSEOULDROP 적용 제안: `Accept-Language`/`navigator.languages`로 초기 언어(en/ja/zh-Hans/zh-Hant/ko 등) 결정, "Me" 탭과 지도 상단에 "文/A" 아이콘+현재 언어명. 칩·탭 라벨은 독일어·인도네시아어 기준 50% 길어져도 줄바꿈/잘림 없게(Material: 라벨 잘림 금지). 거리 단위는 km/m 기본이되 미국 사용자용 mi 토글.
- 출처: NN/g — 6 Tips for Improving Language Switchers on Ecommerce Sites — https://www.nngroup.com/articles/language-switching-ecommerce/ — (2022-03-27) / NN/g — International Usability: Big Stuff the Same, Details Differ — https://www.nngroup.com/articles/international-usability-details-differ/ — (2011-06-05) / NN/g — Icon Usability — https://www.nngroup.com/articles/icon-usability/ — (2014-07-27)

### 30. "현실 세계와의 일치·인식 우선": 한국어 원문 + 로마자 + 택시 카드 [P1]
- 근거/원칙: NN/g 휴리스틱 #2 "사용자의 언어로 말하라", #6 "기억이 아닌 인식(recognition rather than recall): 요소·행동·옵션을 보이게". NN/g 모바일 지도 연구: 사용자는 거리와 주소 같은 실용 정보를 원함. Google Locator Plus: 영업시간·임시휴업 등 "방문 시 무엇을 기대할지" 정확히 알려줄 것. NN/g 스토어 파인더: 위치를 다른 기기로 보내는 링크 등 실제 이동 상황 지원.
- MYSEOULDROP 적용 제안: 상세화면 최상단에 큰 글자로 **한국어 상호·주소**(택시 기사에게 보여주는 "Show to driver" 풀스크린 카드: 한글 크게 + 전화번호 + 지도 스니펫)와 한 번에 복사되는 버튼. 로마자 표기(Myeongdong-gil)와 영문 랜드마크("near Exit 6, Myeongdong Stn.")를 병기. 지하철 경로 화면은 호선 색·역 번호(예: 424)·출구 번호를 아이콘으로 — 문자 기억 부담 제거. 오프라인(로밍 없음) 대비 저장 장소는 서비스워커 캐시.
- 출처: NN/g — 10 Usability Heuristics for User Interface Design — https://www.nngroup.com/articles/ten-usability-heuristics/ — (updated 2024-01-30) / NN/g — Maps and Location Finders on Mobile Devices — https://www.nngroup.com/articles/mobile-maps-locations/ — (2014-01-19) / NN/g — Store Finders and Locators — https://www.nngroup.com/articles/store-finders-and-locators/ — (2018-10-07) / Google — Locator Plus implementation guide — https://developers.google.com/maps/solutions/store-locator/best-practices — (updated 2026-09-17)

---

## 체크리스트 요약 (개발자가 앱에 대고 바로 돌려볼 10가지 Yes/No)

1. 모든 탭 가능한 요소(마커·칩·하트·별·복사 아이콘 포함)의 히트 박스가 **44×44 CSS px 이상**이고 이웃과 **8px 이상** 떨어져 있는가? (DevTools로 `getBoundingClientRect` 스캔)
2. `viewport-fit=cover`가 설정되어 있고, 하단 탭바·바텀시트·플로팅 버튼·스낵바가 `env(safe-area-inset-bottom)`을 반영해 홈 인디케이터와 겹치지 않는가? (iPhone 스탠드얼론 PWA에서 스크린샷)
3. 하단 탭이 3–5개이며 모두 텍스트 라벨이 있고, 상세화면에서도 사라지지 않으며, 게스트 상태에서 비활성화된 탭이 없는가?
4. 지도 리스트 바텀시트에 그래버 + 전체 확장 시 X 닫기가 있고, Android 뒤로가기/iOS 스와이프로 닫히며, 시트 위에 다른 시트가 겹치는 경로가 없는가?
5. 첫 진입 시 위치 권한 팝업 없이 서울 기본 뷰가 뜨고, "현재 위치" 버튼을 눌렀을 때만 한 문장 프라이밍 → 권한 요청이 일어나며, 거부해도 검색/이 지역 검색으로 계속 쓸 수 있는가?
6. 줌 아웃 시 마커가 클러스터링되고, 리스트 행 선택 ↔ 마커 선택 상태가 양방향으로 동기화되며, 장소 카드가 선택 마커를 가리지 않는가?
7. 지도를 이동하면 "Search this area" 칩이 나타나고 탭 후 사라지며, 리스트 각 행에 거리(및 가능하면 도보 분)가 표시되는가?
8. 필터 버튼이 텍스트 라벨("Filter")이고, 필터 시트 하단에 결과 수가 실시간 갱신되는 스티키 "Show N places" 버튼과 초기화가 있으며, 적용된 필터가 칩으로 표시되어 개별 제거가 되는가? 0건일 때 해제/반경 확대 경로가 있는가?
9. 로그인 폼이 `type=email`, `autocapitalize=none`, `autocorrect=off`, `autocomplete=current-password`를 쓰고, 오류가 필드 옆에 빨강+아이콘+해결책으로 표시되며 입력값이 보존되는가? 저장 해제 등 되돌릴 수 있는 행동에 확인 대화상자 대신 Undo 스낵바를 쓰는가?
10. 게스트로 지도·검색·상세·주소 복사·길찾기·지하철 경로가 모두 되고, 가입 유도는 저장/리뷰처럼 가치가 생기는 순간에만 1회 닫기 가능한 시트로 나오며, 브라우저 언어가 자동 적용되고 오렌지 #e94f00이 작은 텍스트 색으로 쓰이지 않는가?

---

## 가져오지 못했거나 본문이 없던 페이지 (투명성 노트)

- Apple HIG HTML 페이지(`developer.apple.com/design/human-interface-guidelines/*`)는 JS 렌더링이라 WebFetch 본문이 비어 있었음 → 동일 콘텐츠의 공식 JSON 엔드포인트(`/tutorials/data/design/human-interface-guidelines/{layout,accessibility,sheets,maps,onboarding,privacy,gestures,tab-bars,entering-data,managing-accounts,searching,loading,undo-and-redo,modality}.json`)로 확인. 출처 URL은 사람이 읽는 HTML 주소로 표기.
- Material 3 `m3.material.io` 직접 fetch는 제목만 반환 → `r.jina.ai` 프록시로 guidelines 본문 확인. 단 `foundations/accessible-design/accessibility-basics`(404)와 `accessible-design/overview`(원칙만, 숫자 없음), 그리고 navigation-bar/FAB specs의 dp 수치(이미지로만 제공)는 확인 불가 → 48dp/8dp는 M2 접근성 페이지·Android 문서·web.dev로 대체 검증.
- Baymard `store-locator`, `map-listings` 페이지는 예시 갤러리만 있고 가이드라인 텍스트 없음. Baymard "스티키 CTA" 전용 글은 검색 결과에 직접 페이지가 없어 인용하지 않음(필터 시트의 스티키 "Show X results"는 `learn/ecommerce-filter-ui`·`learn/button-design`에서 확인).
- Smashing Magazine에는 "바텀시트" 전용 글이 검색되지 않아 하단 내비게이션/엄지 존 글 2편만 사용.
- Google Maps Platform "15 best practices" 블로그는 기술·과금 중심이라 UX 항목에 인용하지 않음(클러스터링 블로그와 Locator Plus 가이드로 대체).
- 오렌지 #e94f00의 대비 3.8:1은 출처 페이지의 수치가 아니라 WCAG 상대휘도 공식으로 제가 계산한 값임.
