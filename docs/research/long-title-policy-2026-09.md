# 긴 이름(제목) 처리 정책 — 2026-09-20

오너 리포트: half 선택 카드에서 `Olive Young SsijeiENMKeomeoseubumun`(한 덩어리 23자,
원문 `올리브영 씨제이ENM커머스부문점`) 제목이 한 줄로 뻗으면서 닫기(×) 버튼이 레이아웃 밖으로 밀림.

측정 기준: 프로덕션 빌드(`next start`), 390×844 / 360×640, headless Chrome + WebKit 2336.
**본문의 `file:line`은 2026-09-20 `feat/p0-best-practices` 기준이며 globals.css는 병렬 작업으로
계속 밀린다. 패치는 반드시 줄 번호가 아니라 셀렉터 텍스트를 앵커로 적용할 것.**

---

## 0. 결론

`.place-name-primary { white-space: nowrap }`(globals.css:4180) 때문에 제목 박스의 min-content 폭이
끊기지 않는 토큰 전체(385.80px)가 되고, 그 카드(`article.selected-place-summary`)가
row 방향 flex item인데 `min-width:auto`라서 그 min-content가 **사용 최소 폭**이 된다. 결과적으로
358px 슬롯 안에서 카드가 441.80px로 부풀고 44×44 닫기 버튼이 x=413.8 — 왼쪽 모서리부터 이미
뷰포트(390px) 밖 — 에 놓여 `.mapsheet-body{overflow-x:hidden}`(globals.css:4427)에 잘린다.
즉 ×는 **어긋난 게 아니라 도달 불가능**이고, 남은 닫기 수단은 시트 드래그와 지도 탭뿐이다.

확인 방법: `/map?place=oy-씨제이enm커머스부문점` → DevTools에서
`article.selected-place-summary` width 441.80 / `.mapsheet-view-enter`(슬롯) width 358 /
`.mapsheet-body` scrollWidth 458 vs clientWidth 390. 441.80 = 385.80(제목) + 12(gap) + 44(버튼),
정확히 헤더의 min-content 폭이다. 페이지 가로 스크롤은 생기지 않으므로(clip) 스크롤로도 못 찾는다.

**한 건짜리 버그가 아니다.** 공개 878곳 중 112곳(12.8%)이 공백 없는 18자 이상 토큰을 갖고,
최악은 35자 `Daiso Hanaromateudongseoulnonghyeopjangan`(버튼이 138px 밖). 같은 유형이
`/place/<id>` h1(486px, 뷰포트 밖 114px, 카테고리 배지 겹쳐 그림)과 `/search` 행(이름이
열기 화살표 버튼 위에 겹쳐 그림)도 독립적으로 깨뜨린다.

---

## 1. 원인

### 1-1. 요소 체인 (half 스냅 = 기본 스냅)

| # | 요소 | 현재 CSS (`app/globals.css`) | 역할 |
|---|---|---|---|
| 1 | `.mapsheet-body.mapsheet-detail-body` | 4427 `overflow-x: hidden` | 넘친 68px을 **자르는** 주체 |
| 2 | `.mapsheet.half.has-selection .mapsheet-view-enter` | 4537 `display:flex; flex:1; min-height:0` — **`flex-direction` 없음 → row** | 카드를 가로축 flex item으로 만든 조건 |
| 3 | `article.selected-place-summary` | 4123 `position:relative; color:…` — **`min-width` 없음** | **부푸는 박스**. `min-width:auto` → min-content |
| 4 | `.selected-place-summary-header` | `display:flex; gap:12px` | 441.80 = 385.80 + 12 + 44 |
| 5 | `.selected-place-summary-copy` | 4137 `min-width:0; flex:1` | 자신은 줄어들지만 min-content 기여는 못 막음 |
| 6 | `h2.selected-place-summary-title` | 4148 `display:-webkit-box; -webkit-line-clamp:2; text-overflow:ellipsis` | **클램프가 죽어 있음**(1-3) |
| 7 | `span.place-name-primary` | 4180 `display:block; overflow:hidden; text-overflow:ellipsis; **white-space:nowrap**` | min-content = 토큰 전체 |
| 8 | `.selected-place-summary-close` | 4325 `flex:none; 44×44` | 밀려나서 잘리는 피해자 |

### 1-2. `min-width:0`과 `overflow:hidden`이 있는데도 밀려난 이유

`min-width:0`(5·6·7)과 `overflow:hidden`(6·7)은 **그 박스 자신**이 줄어들 수 있게 할 뿐,
**자기가 조상에게 올려보내는 min-content 기여치를 깎지 않는다.** 실제로 부푼 건 3번(article)이고,
3번에는 둘 중 아무것도 없다. CSS Flexbox L1 §4.5에 따라 row-flex item의 `min-width:auto`는
content-based minimum(= min-content)으로 해석되므로, 7번의 385.80px가 그대로 3번의 사용 최소 폭이 된다.
런타임 확인: `viewEnterDisplay:"flex", viewEnterDir:"row", articleMinW:"auto"`.

`text-overflow: ellipsis`도 발동하지 않는다. 7번은 `scrollWidth 386 === clientWidth 386` —
글자가 잘린 게 아니라 **박스가 글자 크기만큼 자랐다.**

### 1-3. 덤으로 발견된 세 번째 결함 — 2줄 클램프는 처음부터 작동한 적이 없다

h2(6번)는 `.selected-place-summary-title-row{display:flex}`의 flex item이라
Chromium에서 `display`가 `flow-root`로 blockify된다(측정값). 따라서 `-webkit-line-clamp:2`는 **무효**.
증거: nowrap을 제거하면 35자 이름이 **3줄**로 렌더되고 `scrollHeight === clientHeight`(클램프 없음).

주의 — **이 설명은 Chromium 한정이다.** WebKit 2336은 같은 h2의 `display`를 `-webkit-box`로 계산한다.
즉 iOS에서는 h2의 클램프가 살아 있고, 아래 수정안은 `-webkit-box` 안에 `-webkit-box-orient`가 중첩된
형태가 된다. WebKit에서 직접 측정한 결과 **정상 동작**(48px = 2줄, ×는 카드 안, 가로 스크롤 없음)이다.

결과적으로 `docs/superpowers/specs/2026-08-19-map-place-sheet-density-design.md:33,44,69`
("maximum two lines, ellipsis after line two", "Long names use a two-line clamp; category and status
must never force the close control off-screen")는 **이 화면에서 한 번도 구현된 적이 없다.**
따라서 아래 수정은 문서화된 결정을 뒤집는 게 아니라 **복원**한다.

---

## 2. 앱 전체 긴 이름 정책

### 2-0. 대원칙 4개

1. **이름과 카드 사이의 모든 박스는 줄어들 수 있어야 한다.** 이름 span부터 카드 루트까지의
   flex/grid item은 각각 `min-width:0` 또는 `overflow:hidden`을 갖거나 `minmax(0,1fr)` 트랙 안에 있어야 한다.
   셋 다 없는 flex item이 이 버그 계열의 전부다. (CSS Flexbox L1 §4.5)
2. **감싸고 나서 자른다(wrap → clamp). 데이터 유래 문자열에 `nowrap`을 쓰지 않는다.**
   `nowrap`은 코드가 통제하는 유한 토큰(거리, ★평점, 가격, LIVE 배지, 카테고리 라벨)에만 허용.
3. **`overflow-wrap: anywhere`만 쓴다.** `break-word`는 min-content를 낮추지 못해서(MDN 명시)
   flex item 부풀기를 **막지 못한다**. 즉 `anywhere`는 미관이 아니라 하중을 받는 선언이다.
4. **전체 이름은 어딘가에서 반드시 도달 가능해야 한다.** `/place/<id>`의
   `.place-address-detail-row`(globals.css:2954)가 전체 이름을 줄바꿈+복사 가능하게 보유한다.
   `title` 속성은 대체 수단으로 쓰지 않는다(이 앱 사용자는 터치 전용).

### 2-1. 화면별 줄 수 예산

| 화면 / 요소 | 줄 수 | 줄바꿈 vs 말줄임 | 정확한 CSS 선언 | 근거 |
|---|---|---|---|---|
| half 카드 제목 `.selected-place-summary.half .place-name-primary` | **2** | 줄바꿈 후 클램프 | `display:-webkit-box; -webkit-box-orient:vertical; -webkit-line-clamp:2; white-space:normal; overflow-wrap:anywhere; overflow:hidden` | spec:33,69 / 실측 48px=2줄+말줄임 |
| half 카드 한국어명 `.place-name-secondary` | **1** | 말줄임(현행 유지) | 변경 없음 — §6 참조 | 밀도 변경은 오너 결정 |
| compact/peek 카드 제목 | **1** | 말줄임(현행 유지) | 변경 없음 | spec:44는 2줄이라 **의도적 불일치**, §3 플래그 |
| `/place/<id>` h1 `.place-detail-name-stack` | **2** | 줄바꿈 후 클램프 | 위와 동일 + `.place-detail-name-stack > h1 { min-width: 0 }` | 전체 이름 보유 화면의 전제조건(Apple) |
| 스캔용 1줄 행 `.maprow` `.station-row` `.listrow` 브랜드/랭킹 행 | **1** | 말줄임 | 현행 유지(`overflow:hidden`이 이미 자동 최소치를 0으로 만듦) | NN/g: 목록은 앞 2단어로 스캔 |
| 검색 결과 이름 `app/search/page.tsx:119,259` | **2** | 줄바꿈 후 클램프 | `display:-webkit-box; WebkitBoxOrient:vertical; WebkitLineClamp:2; overflow:hidden; overflowWrap:anywhere` | 카테고리(`· Olive Young`)가 같은 div에 있어 nowrap 금지 |
| 랭킹 타일(고정 128px) | **2** | 줄바꿈 후 클램프 | 기존 클램프에 `overflowWrap:"anywhere", wordBreak:"keep-all"` 추가 | 클램프는 끊을 지점이 없으면 무력 |
| BottomSheet 헤더 `.sheet-title`(3161) | **2** | 줄바꿈 후 클램프 | 위 클램프 트리오 + `overflow-wrap:anywhere; word-break:keep-all` | 모달 닫기 버튼 보호 |
| 택시 카드 `.taxi-modal-name`(3594) `.taxi-modal-addr`(3601) | 제한 없음 | 전문 줄바꿈 | 기존 `word-break:keep-all` 옆에 `overflow-wrap:anywhere` 추가 | 낯선 사람이 읽는 화면 = 잘림은 기능 실패 |
| 주소 상세행 `.place-address-detail-row > b`(2954) | 제한 없음 | 전문 줄바꿈 | **이미 안전 — 레퍼런스 패턴** `grid-template-columns:76px minmax(0,1fr) auto` + `overflow-wrap:anywhere` | 최악 35자 토큰을 오늘도 정상 처리 중 |
| OG 카드 / `<title>` / JSON-LD | 서버 절단 | grapheme 단위 | `Intl.Segmenter` + Satori `wordBreak:"break-word"` | UTF-16 code unit 절단 금지 |
| **어느 화면이든 절대 상한** | **3~4줄** | — | — | Baymard: 그 이상은 제목이 아니라 설명으로 읽힘 |

### 2-2. 한국어 텍스트에 `break-all`을 쓰지 않는 이유

* MDN `word-break`: `break-all`은 "Chinese/Japanese/Korean text **제외**"가 정의에 명시돼 있다.
  즉 한국어에는 애초에 적용되지 않으면서, 같은 요소의 영문은 단어 중간에서 찢는다. 양쪽 다 손해다.
* 한국어에 필요한 건 `word-break: keep-all`(어절 경계 유지, W3C KLREQ §7.1) +
  최후 수단 `overflow-wrap: anywhere` 조합이다. `keep-all`은 **비CJK에 대해 `normal`과 동일**이므로
  로마자 토큰에는 아무 효과가 없다 — `overflow-wrap`의 대체재가 될 수 없다.
* 이 저장소에 이미 같은 조합이 있다: `.product-staff-modal-question`(globals.css:5983).
  새 관례를 만들지 말고 이걸 따른다.
* `hyphens:auto`도 금지. 기계 음역 토큰에 대한 하이픈 사전은 존재하지 않고, 루트가 `lang="en"`이라
  영어 사전이 엉뚱한 지점을 자신 있게 끊는다.

---

## 3. 조치 목록

### 3-1. 검증 통과 (3개 렌즈 전원 "ship")

| P | 난이도 | 레이어 | ID | 현재 동작 | 구체 변경 | 검증 메모 |
|---|---|---|---|---|---|---|
| **P0** | S | css | **R1** half 카드 | `app/globals.css:4123` `.selected-place-summary`에 `min-width` 없음 / `:4180` `.place-name-primary{white-space:nowrap}` / `:4148` h2 클램프 무효 | ① `.selected-place-summary { min-width: 0 }` 추가 ② **새 규칙**(기존 `.place-name-primary` 규칙은 건드리지 말 것): `.selected-place-summary.half .place-name-primary, .place-detail-name-stack .place-name-primary { display:-webkit-box; -webkit-box-orient:vertical; -webkit-line-clamp:2; white-space:normal; overflow-wrap:anywhere; overflow:hidden }` ③ `:4158` `text-overflow: ellipsis` 삭제(`-webkit-box`에서 무효, 클램프 활성 시 브라우저가 비활성화) | 실측 AFTER: article 358, × x=330 right=374(안쪽), 제목 48px=2줄+실제 말줄임, 360px에서 article 328 / × right 344. 대조군 "Ssamzigil" 수치 전부 동일. **compact는 의도적으로 스코프에서 제외** — 미스코프 버전(F8)은 peek 카드를 `"Daiso …"`로 무너뜨림(숫자 검사만으론 통과함) |
| **P0** | S | css | **R2** 래퍼 | `:4537` `.mapsheet.half.has-selection .mapsheet-view-enter { display:flex; flex:1; min-height:0 }` — 방향 없음 → row | `flex-direction: column;` 1줄 추가 | 단독으로도 오버플로 해소(article 358 / × right 374) 확인. 사진 레일 높이 체인 영향 없음(170px 유지) — row일 때 세로 신축은 `align-items:stretch`의 부산물이었고 column이 4438 주석이 의도한 형태 |
| **P1** | S | css | **R4** 상세 h1 | `:4174` `.place-detail-name-stack{display:grid; min-width:0}` + `:4179` `flex:1`; h1은 `overflow:visible`, `min-width` 없음 | `.place-detail-name-stack > h1 { min-width: 0 }` | **"방어용"이 아니라 하중 부담**: R1이 언젠가 `break-word`로 "단순화"되면 트랙이 다시 바닥을 치고 이 선언만이 막는다. 실측 BEFORE h1 486px(뷰포트 밖 114px, 배지 겹침) → AFTER 0건. **단독 배포 금지** — 단독이면 1줄 말줄임이라 지도 카드(2줄)보다 적게 보여 위계가 뒤집힘. R1과 같은 커밋 |
| **P1** | S | comp | **R5′** 검색 행 | `app/search/page.tsx:119` `<div style={{fontWeight:600,fontSize:14.5}}>` — overflow/white-space/overflow-wrap 전무(바로 아래 :123 캡션은 3개 다 있음). :259도 동일 | 두 div에 **2줄 클램프**: `display:"-webkit-box", WebkitBoxOrient:"vertical", WebkitLineClamp:2, overflow:"hidden", overflowWrap:"anywhere"` | **원안에서 수정됨** — §6 참조. `white-space:nowrap`을 넣으면 ⓐ 같은 div의 `· {카테고리}`가 통째로 잘려 유일한 식별자가 사라지고 ⓑ `overflow-wrap`이 무효가 된다. 전역 `.listrow{overflow-wrap:anywhere}`도 폐기(상속 + ~20개 호출처 min-content 변경) |
| **P3** | S | data | **R6′** CJ 2행 | `lib/generated/oliveyoung-places.ts:2258` 등 | `VERIFIED_PLACE_PATCHES`(lib/data.ts:335)에 `"oy-씨제이enm커머스부문점": { name: "Olive Young CJ ENM Commerce" }`, `"oy-씨제이남산더센터점": { name: "Olive Young CJ Namsan" }` | **P1→P3으로 강등.** 이 두 행은 22~29번째로 나쁠 뿐이고 35자 행이 그대로 남는다 = 버그를 닫지 못함. 게다가 둘 다 CJ 사옥 지하/로비의 **임직원용 매장**(09:00–18:00) — 이름을 예쁘게 다듬는 것보다 `HIDDEN_PLACE_IDS`(lib/data.ts) 후보인지가 먼저다. 검증 링크는 `naverEnglish`(깨진 이름으로 검색 → 0건 보장) 대신 `naver`(nameKr+주소)를 쓸 것. `npm run audit:data` 리포트 동시 커밋 필요 |

### 3-2. 미검증 (근거는 있으나 3렌즈 통과 안 함)

| P | 난이도 | 레이어 | 항목 | 요지 |
|---|---|---|---|---|
| P1 | L | data | R7 파이프라인 | `scripts/lib/hangul-romanize.mjs:219`가 한글 런을 **공백 없이** 재결합 → 23자 토큰 제조. OY 87행은 `scripts/lib/en-name-overrides.json`(kr-name-overrides.json 미러), Daiso 114행은 체인 어휘집(하나로마트→"Hanaro Mart" 등)으로 최대 토큰 35→12자 미만 |
| P1 | S | test | R8 CSS 계약 | `lib/map-selection-wiring.test.ts`에 `min-width:0`·`flex-direction:column`·스팬 클램프 단언 추가(§5) |
| P2 | S | css | R9 한국어 표면 | `.taxi-modal-name/.addr`, `.review-detail-place h1`, `.place-correction-place > b`, `.sheet-title`에 `overflow-wrap:anywhere` 페어링. `.place-correction-place > b`는 `.sbody{overflow-y:auto}` 때문에 **앱에서 유일하게 실제 가로 스크롤바**를 만듦 |
| P2 | M | comp | R10 OG/메타 | `opengraph-image.tsx:77` `wordBreak:"break-word"` + `Intl.Segmenter` grapheme 절단, `lib/place-seo.ts:38` 이름 45 grapheme 상한 |
| P2 | M | data | R11 감사 래칫 | `longestNameToken()` 신규 finding + CI 예산 고정(§4) + `docs/design-system.md`에 본 정책 수록 |
| P2 | S | css | R12 잔여 표면 | `/places`, 지하철 근처/역 목록, 즐겨찾기, 랭킹 행은 **미측정**. `.place-name-primary, .place-name-secondary { max-width:100% }` 방어 규칙 추가 후 35자 카나리로 실측 |

### 3-3. 오너 결정이 필요한 플래그 (조용히 바꾸지 말 것)

1. `docs/…density-design.md:33,44`는 half 19px/1.25, compact 18px를 말하지만 globals.css는 둘 다 20px/1.2다(기존 드리프트, 이번 패치 무관).
2. 같은 spec:44는 **compact도 2줄**이라고 적었으나 R1은 compact를 1줄로 유지한다(실측 회귀 회피 목적). 의도적 불일치.
3. `.place-name-secondary`를 2줄로 풀지 여부 = 카드 세로 리듬 변경 → 오너 결정(§6).

---

## 4. 데이터 문제

CSS는 잘라주기만 할 뿐 **읽을 수 있게 만들지 못한다.** `SsijeiENMKeomeoseubumun`은 맞춰 넣어도 무의미하다.

### 4-1. 현황 (공개 `PLACES` 878건)

| 지표 | 값 |
|---|---|
| 기계 음역 의심 | **241건 (27.4%)** — daiso 114, kakao 87, creatrip 20, ados 20 |
| 최장 토큰 ≥18자 / >18자 | **112건 (12.8%) / 88건 (10.0%)** ← CI 비교 연산자 주의 |
| 최장 토큰 ≥20 / ≥30 / 최댓값 | 70 / 11 / **35자** |
| 이름 길이 중앙값 / p95 / 최댓값 | 24 / 58 / **105자** |
| 현행 CI `englishNameNeedsReview`(name>72) 적중 | 145건 — **최장 토큰>18과 교집합 0건** |
| 지하철역 600개 중 임계 초과 | **0건** (`STATION_DISPLAY_NAME_OVERRIDES`가 이미 해결 — 복제할 선례) |

### 4-2. 대표 사례

| id | 현재 `name` | 최장 토큰 | 원문 | 올바른 영문 |
|---|---|---|---|---|
| `daisomall-official:71851` | Daiso Hanaromateudongseoulnonghyeopjangan | **35** | 하나로마트동서울농협장안점 | Hanaro Mart Dongseoul NH Jangan |
| `oy-현대백화점무역센터점` | Olive Young Hyeondaebaekhwajeommuyeoksenteo | 31 | 올리브영 현대백화점무역센터점 | Hyundai Dept. Trade Center |
| `oy-스타필드애비뉴그랑서울점` | Olive Young Seutapildeuaebinyugeurangseoul | 30 | — | Starfield Avenue Grand Seoul |
| `oy-영등포타임스퀘어점` | Olive Young Yeongdeungpotaimseukweeo | 22 | — | Yeongdeungpo Times Square |
| `oy-씨제이enm커머스부문점` | Olive Young SsijeiENMKeomeoseubumun | 23 | 올리브영 씨제이ENM커머스부문점 | CJ ENM Commerce (리포트된 행) |
| `daisomall-official:71292` | Daiso Eebeurideigongreungdong | 25 | e에브리데이공릉동점 | 공릉 = **Gongneung**(음운 동화 미반영) |

두 번째 유형(다른 버그): creatrip 마케팅 헤드라인 105자
`"HOSU DOSAN … | K-Pop Hair + CCL Color Image Convergence Lab | Personal Color Analysis"` —
최장 토큰은 11자라 줄바꿈은 되지만 2줄 클램프를 넘긴다. 파이프라인에서 `" | "` 분리 필요.

### 4-3. 교정 방법 (3계층)

1. **오늘**: `VERIFIED_PLACE_PATCHES`(lib/data.ts:335, 재빌드 무효화 방지) — 단, §3의 R6′ 유의사항.
2. **파이프라인**: OY는 `en-name-overrides.json` 신설 + `applyHoursOverrides` 패턴 복제.
   Daiso는 로마자화를 고치지 말고 스냅샷 `nameEn` 채우기(이미 `nameVerification:"provisional"` 표시 중).
3. **CI 게이트**: `lib/place-audit.ts`에 `longestNameToken()` export + `automaticFindings`에
   `...(longestNameToken(place.name) > 18 ? ["unreadable_romanized_name"] : [])` 1줄,
   `scripts/audit-places.ts`에 `const MAX_UNREADABLE_NAMES = 88; // >18 기준, 2026-09-20 베이스라인. 내리기만 할 것`.
   *임계 18자는 측정값이다*: 14자는 178곳+역 10곳(소음), 18자는 88곳+역 0곳, 22자는 39곳(느슨).
   20px/750 제목이 360px에서 44px 버튼과 공존 가능한 최대 폭.

### 4-4. 뒤집으면 안 되는 결정

2026-08-23 "English-first titles"(`scripts/lib/hangul-romanize.mjs:204-209`)는 **유지**한다.
바꾸는 건 영문의 **출처**다: 영문 우선 YES, **기계 로마자화를 표시 이름으로 쓰는 것은 NO**
(로마자화는 원래 목적인 매칭 신호로 환원). `docs/research/raw/06-i18n-seo-community.md:126`이
이미 같은 규칙을 적어 두었다. 이 결정은 코드 주석에만 있으므로
`docs/decisions-and-history.md`로 승격할 것.

---

## 5. 회귀 방지

### 5-1. CSS 계약 테스트 — `lib/map-selection-wiring.test.ts` (:396 블록 옆)

집 안의 기존 관례는 `lib/product-detail-layout.test.ts:121-123`
("allows a long Korean product name to wrap without hiding the staff action")이다. 그대로 복제한다.

```ts
it("keeps the half card shrinkable and its name clamped to two lines", () => {
  expect(styles).toMatch(/\.selected-place-summary\s*\{[^}]*min-width:\s*0/s);
  const wrapper = styles.match(
    /\.mapsheet\.half\.has-selection \.mapsheet-view-enter \{([\s\S]*?)\}/)?.[1] ?? "";
  expect(wrapper).toContain("flex-direction: column;"); // row 래퍼는 카드를 min-content로 바닥 고정
  const clamp = styles.match(
    /\.selected-place-summary\.half \.place-name-primary[^{]*\{([\s\S]*?)\}/)?.[1] ?? "";
  expect(clamp).toContain("-webkit-line-clamp: 2");
  expect(clamp).toContain("overflow-wrap: anywhere"); // break-word는 min-content를 못 낮춤
  expect(clamp).toContain("white-space: normal");
});
```

`lib/category-publication-contract.test.ts:43-44`는 기존 `.place-name-primary` 규칙이
`display:block` + `text-overflow:ellipsis`를 유지하는지 감시하는 **트립와이어로 그대로 둔다**.
정규식 `[^}]*`는 `}`를 넘지 못하고 매칭은 leftmost-first라, 새 스코프 규칙(파일 뒤쪽)은 이 테스트를 깨지 않는다.

### 5-2. 레이아웃 e2e — `e2e/long-name-layout.spec.ts` (신규 파일 권장)

```ts
const WORST_ID = "daisomall-official:71851"; // 35자 토큰, 데이터셋 최악
for (const vp of [{ width: 390, height: 844 }, { width: 360, height: 640 }, { width: 320, height: 640 }]) {
  test(`long name keeps the close button inside the card @${vp.width}`, async ({ page }) => {
    const worst = PLACES.find((p) => p.id === WORST_ID);   // DAISO_PLACES 아님! §6 참조
    expect(worst, `${WORST_ID} must stay published`).toBeDefined();
    await page.setViewportSize(vp);
    await page.goto(`/map?place=${encodeURIComponent(WORST_ID)}`);
    const card = page.locator(".selected-place-summary.half");
    await expect(card).toContainText(worst!.name);
    const c = (await card.boundingBox())!;
    const x = (await card.locator(".selected-place-summary-close").boundingBox())!;
    expect(c.x + c.width).toBeLessThanOrEqual(vp.width + 1);   // 카드 자체를 뷰포트에 고정
    expect(x.x + x.width).toBeLessThanOrEqual(vp.width + 1);
    expect(await page.locator(".mapsheet-body")
      .evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);
    expect(x).toMatchObject({ width: 44, height: 44 }); // 터치 타깃을 줄여서 끼워 맞추지 못하게
  });
}
```

추가로 `/place/<id>`는 `h1` 오른쪽 모서리 ≤ 뷰포트만 단언한다 —
그 화면은 `documentElement.scrollWidth - clientWidth === 0`이면서 h1이 114px 밖이므로
문서 오버플로 검사는 **공허하게 통과**한다.

`playwright.config.ts`의 WebKit 프로젝트는 현재 `**/ranking-retailers.spec.ts`만 매칭한다.
`-webkit-box` blockify 동작이 엔진마다 다르므로(§1-3) 이 스펙을 `E2E_WEBKIT=1` 대상에 포함시킬 것.

---

## 6. 검증 탈락 항목과 이유

| 항목 | 왜 탈락 |
|---|---|
| **R3 원안 Playwright 핀** | ① `DAISO_PLACES.find(p => p.id === "daisomall-official:71851")`는 **undefined** — 그 행은 `DAISO_SUPPLEMENT_PLACES`에 있고 `DAISO_PLACES`의 251개 id는 전부 `daiso-official:` 접두사. `!`는 런타임에 지워져 TypeError. ② 더 나쁜 건, 핵심 단언이 **깨진 빌드에서 통과한다**: 실측 card right=528, close right=528이라 `close.right <= card.right + 1`은 참. **부푸는 박스가 카드 자신**이므로 버튼을 카드에 앵커하면 이 버그 계열을 영원히 못 잡는다. → §5-2로 교체 |
| 전역 `.listrow { overflow-wrap: anywhere }` | 상속 속성 + 호출처 ~20곳(favorites/brand/blog/ranking/place-detail/notifications). `anywhere`는 min-content 계산에 **포함**되므로 아무도 측정 안 한 행들의 flex 여유 공간 분배가 조용히 바뀐다. 게다가 인라인 `nowrap`과 함께 쓰면 서로 상쇄 |
| `.selected-place-summary .place-name-secondary { word-break:keep-all; overflow-wrap:anywhere }` | **측정된 죽은 CSS.** 기반 규칙(globals.css:4187)의 `white-space:nowrap`이 살아 있어 두 속성 모두 종속적으로 무효. 30자 한국어명 높이 16.19px → 16.19px, 양 엔진 동일. 넣으려면 `white-space:normal`이 필요하고 그건 카드 세로 리듬 변경 = 오너 결정 |
| "`min-width:0`만으로 완결" (정적 진단) | 절반만 맞다. 오버플로는 멎지만 **한 줄 하드 클립**이 남는다. 클램프를 스팬으로 옮겨야 2줄+말줄임이 된다 |
| "`min-width:0`은 벨트+멜빵(중복)" (R1 근거문) | 반대로 하중을 받는다. 320px + 짧은 영문명 + 긴 `nameKr` 조합에서 close.right=330.4(뷰포트 320) — 클램프 변경은 `.place-name-secondary`가 절대 줄바꿈하지 않으므로 이 변종을 못 고친다. `min-width:0`만이 고친다 |
| "h2가 blockify되므로 클램프가 무효" (보편 주장) | Chromium 한정. WebKit 2336은 `-webkit-box`로 계산. 결론(스팬 클램프)은 양 엔진에서 유효하나 **근거 문장은 엔진 한정으로 서술**해야 하고, 가드를 Chromium 전용 프로브로 두면 안 됨 |
| "리포트된 행이 데이터셋 유일 camel-case" 프레이밍 | 문자 그대로는 참이나, 오도한다. 문제는 대문자 패턴이 아니라 **토큰 길이**이고 더 나쁜 행이 28개 있다. 이 프레이밍이 두 행 개명을 P1처럼 보이게 만들었다 |
| `overflow-wrap: break-word` | min-content를 낮추지 않아 flex item 부풀기를 못 막음(MDN 명시). 짧은 이름에서 겉보기 변화가 없어 리뷰에서 "단순화"로 둔갑하기 쉬움 — 테스트로 고정할 것 |
| `word-break: break-all` / `hyphens: auto` / `title` 속성 | §2-2 참조 |

---

## 7. 계측·스크린샷 경로와 참고 규칙

### 7-1. 산출물

```
/private/tmp/claude-501/-Users-hanmyeong-gwan-mobile-design/
  40ba898f-5884-48df-910f-ff968e2d3c24/scratchpad/long-title/
```
| 파일 | 내용 |
|---|---|
| `01-baseline-390-full.png` | BEFORE 390×844 전체 — 오너 스크린샷 재현(× 버튼 없음) |
| `crop-ssijei-BASE-390.png` / `crop-ssijei-F8-390.png` | 리포트된 행 BEFORE/AFTER 헤더 크롭 |
| `crop-daiso35-BASE-390.png` / `crop-daiso35-F9-390.png` | 최악 35자 BEFORE(버튼 138px 밖) / AFTER(2줄+말줄임) |
| `crop-daiso35-F1/F4/F6-390.png` | 후보 비교: 3줄 무제한 / 2줄 하드컷(말줄임 없음) / 2줄+말줄임 |
| `compactcrop-BASE/F8/F9-390.png` | compact 회귀 증거 — F8(미스코프)은 `"Daiso …"`로 붕괴 |
| `surf-detail-daiso35-BASE/F7-390.png` | `/place/<id>` h1 배지 겹침 → 해소 |
| `search-BASE/F8-390.png`, `maprow-BASE-390.png`, `og-daiso35.png` | 검색 겹침 / 지도 행(영향 없음) / OG 1200×630 |
| `crop-ctrl-BASE/F9-390.png` | 대조군 "Ssamzigil" — 변화 없음 |

계측 한계: headless Chrome 153(iPhone UA) + WebKit 2336. **실제 iOS Safari / Android Chrome 미검증.**
지도 타일은 이 환경에서 "API KEY REQUIRED" 플레이스홀더(카드 계측에는 무영향).
`/search`는 `?q=` 파라미터를 무시하므로 재현 시 입력창에 직접 타이핑해야 한다.

### 7-2. 참고 규칙

| 규칙 | 출처 |
|---|---|
| flex item `min-width:auto` → content-based minimum | https://www.w3.org/TR/css-flexbox-1/#min-size-auto §4.5 |
| `anywhere`만 min-content 계산에 포함, `break-word`는 미포함 | https://developer.mozilla.org/en-US/docs/Web/CSS/overflow-wrap |
| `break-all`은 CJK 제외 / `keep-all`은 비CJK에서 `normal`과 동일 | https://developer.mozilla.org/en-US/docs/Web/CSS/word-break |
| `-webkit-line-clamp` 3종 공의존, `line-clamp`는 2026년에도 비Baseline | https://developer.mozilla.org/en-US/docs/Web/CSS/-webkit-line-clamp |
| line-clamp 활성 시 `text-overflow` 무력화(WontFix) | https://github.com/w3c/csswg-drafts/issues/10823 |
| 클램프된 텍스트를 스크린리더에서도 숨기는 방향으로 결의 | https://github.com/w3c/csswg-drafts/issues/12859 |
| 한국어 줄바꿈(어절/문자 단위, 금칙) | https://www.w3.org/TR/klreq/ §7.1 |
| 단, 전체 텍스트가 다른 화면에 있으면 1~2줄 절단 허용 | https://developer.apple.com/help/app-store-connect/manage-app-accessibility/larger-text-evaluation-criteria |
| 200% 확대에서 컨트롤이 잘리면 실패 / 320px 리플로 | https://www.w3.org/WAI/WCAG22/Understanding/resize-text.html · `/reflow.html` |
| 타깃 크기 최소치(44×44 유지 근거) | https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html |
| 모바일 제목 3~4줄 상한 | https://baymard.com/blog/product-listing-information |
| 목록은 앞 2단어로 스캔된다 | https://www.nngroup.com/articles/first-2-words-a-signal-for-scanning/ |
| 국어 로마자 표기법(CamelCase 연결을 허용하는 조항 없음) | https://www.korean.go.kr/front_eng/roman/roman_01.do |
| 상호명에 불필요 정보 금지 | https://support.google.com/business/answer/3038177 |
| `title` 속성은 터치/키보드/AT에서 문제적 | https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/title |

사내 참조: `docs/research/raw/02-mobile-ux.md`, `03-accessibility.md`,
`06-i18n-seo-community.md:31-33,51-54,126`,
`docs/superpowers/specs/2026-08-19-map-place-sheet-density-design.md:33,44,69`.
