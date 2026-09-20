# 좌우 여백(gutter) 정렬 감사 — 2026-09

owner 신고(2026-09-20, 스크린샷): 지하철 모드 역 패널에서 **"Products to look for"** 섹션 헤더가 주변 행들보다 왼쪽으로 바짝 붙음.
검증 범위: live 측정(390×844 / 360×640, Chromium + WebKit) + CSS 정적 감사 + 3개 렌즈 교차검증(applicable / blast / responsive).

> **⚠️ 라인 번호 주의 — 라인으로 적용하지 말 것.** `app/globals.css`는 이 감사 도중에도 다른 작업(P0 터치 타깃 배치)에 의해 계속 커지고 있다.
> 참고 자료의 라인은 이미 ~+44 밀려 있었고, **이 문서를 쓰는 30분 사이에도 6,498 → 6,552줄로 또 +54 밀렸다**.
> 아래 라인 번호는 작업 트리(6,552줄, md5 `3d1355ca`, 2026-09-20 17:43) 기준으로 재확인한 값이지만,
> **적용은 반드시 `current` 문자열 앵커로** 하고, 편집 직전에 `grep -c`로 유일성을 다시 확인할 것.
> 아래 모든 `current` 문자열은 파일 내 유일함을 확인했다(`.subway-product-picks > a`의 `margin: 0 16px` / `padding: 9px 0`만 예외이므로 3줄 묶음으로 앵커할 것).

---

## 0. 결론

**표준 좌우 여백은 16px**다. 프로젝트 문서가 숫자로 약속한 유일한 값이고(`docs/superpowers/specs/2026-08-19-map-place-sheet-density-design.md:31` — "a map-specific summary header with 16px horizontal padding"), `app/globals.css`에서도 36:15로 18px을 이긴다. Material 3 compact 마진(16dp)과도 일치한다. 단, `.pad { padding: 16px 18px }`(globals.css:1501-1503)가 지배하는 **일반 스크롤 화면 31곳은 아직 18px**이며, 이 18→16 통일은 이번 수정 범위가 **아니다**(아래 §3 하단 경고).

어긋난 곳은 **6건(검증 통과) + 5건(하위 우선순위) = 11건**. 이 중 P0는 신고된 1건뿐이고, 나머지는 2~4px 급 불일치다.

신고된 케이스의 원인은 **선언 한 줄**이다. `app/globals.css:3865`의 `.subway-controller.route-ready .subway-nearby-heading { padding: 10px 0 6px; }`가 `padding` 단축 속성으로 좌우 padding을 0으로 덮어쓴다. 명시도 (0,3,0)이라 **둘 다 16px을 말하고 있는** `:5744`(0,2,0)과 `:1079`(0,1,0)을 모두 이긴다. 실측 결과 헤더와 부제는 content-x = **0**, 같은 스크롤러의 형제들(`.station-row`, `.subway-product-picks > a`, `.subway-route-summary`)은 전부 **16** — 정확히 16 CSS px 차이다. owner가 캡쳐에서 잰 44 vs 12 image px는 2x Retina 캡쳐이므로 `(44-12)/2 = 16 CSS px`로 산술이 정확히 맞는다.

---

## 1. 원인 — "Products to look for" 요소 체인

JSX: `components/subway/subway-route-controller.tsx:1233-1237` (`<section className="subway-product-picks">` → `<div className="subway-nearby-heading">` → `<h3>Products to look for</h3>` + `<p>`).
`.subway-nearby-heading`은 **코드베이스 전체에서 이 한 곳에서만** 렌더된다.

| # | 요소 | 규칙 (file:line) | 좌우 여백 | 비고 |
|---|---|---|---|---|
| 0 | `body` / `.map-screen` | — | 0 | |
| 1 | `.subway-controller` | globals.css:395 영역 | 0 | 패널은 뷰포트 전폭 |
| 2 | `.subway-controller-scroll` | globals.css:395 | **0 (의도적)** | owner 결정 2026-08-22, globals.css:3850-3853 — "자식들이 각자 padding을 가진다" |
| 3 | `.subway-product-picks` | globals.css:1121 | 0 | `margin-top`/`border-top`만 선언 |
| 4 | `.subway-nearby-heading` | **globals.css:3865** | **0 ← 버그** | `padding: 10px 0 6px`, (0,3,0) |
| 4' | 같은 요소, 패배한 규칙 | globals.css:5744 | 16 | `.subway-controller .subway-nearby-heading { padding: 9px 16px 5px }` (0,2,0) |
| 4'' | 같은 요소, 패배한 규칙 | globals.css:1079 | 16 | `.subway-nearby-heading { padding: 20px 16px 12px }` (0,1,0) |
| 5 | `<h3>` / `<p>` | globals.css:1081, 3867-3870 | 0 | `p`는 `margin: 0`이라 되돌릴 여백이 없음 |

**왜 왼쪽으로 붙나**: 2단계 스크롤러가 좌우 padding을 일부러 갖지 않기 때문에, 자식이 자기 padding을 0으로 만들면 곧바로 패널 가장자리에 닿는다. 형제들은 전부 자기 16px을 들고 있다 — `.station-row { padding: 10px 16px }`(:3833), `.subway-product-picks > a { margin: 0 16px }`(:1128), `.subway-route-summary { padding: 12px 16px 9px }`(:746).

**live 인과 증명**: DOM에서 `.route-ready` 클래스만 제거하면 computed `padding-left/right`가 `0px → 16px`로 뒤집힌다(390/360 양쪽).
**출처**: `git blame` → commit `1df220d`(2026-08-22, "fix: the route-ready subway panel"). 같은 커밋이 padding 있는 래퍼 안에 있던 다른 두 호출부를 삭제하면서, 래퍼 없는 `.subway-product-picks` 안의 이 호출부에 `padding: 10px 0`을 남겼다. **owner 결정이 아니라 그때 흘러든 회귀**이며, 바로 위 주석(:3850-3853)이 오히려 반대 계약("they just need their padding")을 기록하고 있다.

---

## 2. 실측 결과 (390×844 기준, 괄호는 360×640)

| 화면 | 요소 | 실측 x | 기준 x | 차이 | 원인 규칙 |
|---|---|---|---|---|---|
| /map 지하철 route-ready (Olive Young) | `.subway-nearby-heading` + h3 + p | **0.0** (0.0) | 16 (16) | **−16.0** | globals.css:3865 `padding: 10px 0 6px` |
| 〃 (우측) | 같은 요소 | 390.0 (360.0) | 374 (344) | **+16.0** | 동일 — 360px에선 부제가 화면 물리 가장자리에 닿음 |
| /map 기본·sheet-full | `.map-top` 검색 필 행 / 칩 레일 | 14.0 (14.0) | 16 (16) | −2.0 | globals.css:3931 `… 14px 0` |
| /place/[id] | `.anchortabs`, `.bookbar` | 16.0 (16.0) | 18 (18) | −2.0 | 바는 16, 본문은 `.pad` 18 |
| /shop/[id] | `.product-cta-bar` | 12 (정적) | 16 | −4.0 | globals.css:6055 |
| /map 지하철 역 브라우즈 | `.subway-plan-route` | 18 (정적) | 16 | +2.0 | globals.css:3857 |
| 지하철 역 자동완성 | `.station-results-label` / `.station-location-note` | 11 (정적) | 12 | −1.0 | globals.css:617, 615 |
| /settings/account | `.settings-row` / `.settings-account-actions .settings-group-list` | 13 / 12 (정적) | 14 | −1 / −2 | globals.css:5246, 5292 |

**정상 예외 — 고치면 안 되는 것** (live 측정에서 CLEARED)

| 종류 | 예 | 왜 정상인가 |
|---|---|---|
| 의도적 풀블리드 | `.station-sheet { margin: -4px -16px 0 }`, `.maprow.on`, `.subway-search-preview` | 부모의 16px을 정확히 상쇄하고 자식이 16px을 되돌림 |
| 가로 스크롤 레일 | `.subway-route-steps`(우측 마스크), `.chiprow.faded` | 항목이 화면 밖으로 흘러가는 게 목적. 단 **첫 항목은 16px에서 시작**해야 함 |
| 미디어/아이콘 컬럼 | 지하철 패널 x=88(16 + 썸네일 58 + gap 14), 맵 시트 x=112, /settings x=75 | 행 컨테이너는 16, 텍스트는 그 안쪽. 헤더를 88px로 들여쓰면 안 됨 |
| 광학 정렬 | `.anchortabs { padding: 0 16px }` + 버튼 `padding: 11px 2px` → 라벨이 정확히 18 | 18px로 "고치면" 라벨이 20px로 밀림 |
| 카드 내부 인셋 | /settings `.settings-row`(19/371) — 카드 바깥 테두리는 18에 정렬 | 1px border가 content box를 민 것 |
| 섹션 구분 띠 | `.subway-product-picks { border-top: 8px solid }` | 섹션 구분용 풀블리드 면 |

**테마 블록 중복 없음**: `data-theme` 35개 선택자 전부 색/그림자/배경만 건드린다. 라이트/다크에 여백 값이 중복된 곳은 **0건**.

---

## 3. 적용할 패치 (검증 통과)

3개 렌즈(applicable=텍스트·캐스케이드, blast=파급범위, responsive=320/360/안전영역)가 모두 확인한 것만.
**적용은 라인이 아니라 `current` 문자열 앵커로.** 모든 `current` 문자열은 파일 내 유일함을 재확인했다.

| 순위 | 파일:라인 | 현재 | 변경 | 영향 범위 | 검증 |
|---|---|---|---|---|---|
| **P0** | `app/globals.css:3865` | `padding: 10px 0 6px;` | `padding-block: 10px 6px;` | route-ready 지하철 패널 헤더 1곳 (JSX 호출부 1개) | applicable ✅ blast ✅ responsive ✅ (WebKit 포함 검증) |
| P1 | `app/globals.css:1128-1129` | `margin: 0 16px;`<br>`padding: 9px 0;` | `margin: 0;`<br>`padding: 9px 16px;` | 제품 행의 `border-bottom`이 `.station-row`과 같은 폭으로 그려짐. 텍스트 위치 불변 | 정적 (P0와 같은 스크롤러, 같은 결함 클래스) |
| P2 | `app/globals.css:3931` **+ 형제 4개** | `… env(safe-area-inset-top)) 14px 0;` | `… env(safe-area-inset-top)) 16px 0;` | 맵 상단 크롬 전체 | applicable ✅ responsive ✅ **blast ⚠️ 단독 적용 금지** |
| P3 | `app/globals.css:6055` | `padding: 10px 12px max(10px, env(safe-area-inset-bottom));` | `padding: 10px 16px max(10px, env(safe-area-inset-bottom));` | `/shop/[id]` 두 CTA 바. ≤360px 블록(:6123)은 그대로 이김 | applicable ✅ blast ✅ responsive ✅ |
| P4 | `app/globals.css:3891` | `min-height: 44px; margin: 12px 18px 4px;` | `min-height: 44px; margin: 12px 16px 4px;` | "Plan a route from {역}" 버튼 1개 | applicable ✅ blast ✅ responsive ✅ |
| P5 | `app/globals.css:3877-3885` | `.subway-station-focus { … padding-inline: 12px; … }` | **손대지 말 것 — 죽은 선언** | — | 아래 ⚠️ 참조 |

### P0 — 정확한 교체 내용

```css
  .subway-controller.route-ready .subway-nearby-heading {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 8px;
    /* 블록축만. 좌우 16px은 기본 규칙 `.subway-controller .subway-nearby-heading`
       에서 내려온다 — 그래야 .station-row / .subway-product-picks > a 와 같은
       선에 선다. 여기서 `padding` 단축 속성을 쓰면 좌우가 다시 0이 된다:
       그게 owner가 2026-09-20에 신고한 회귀다. 그 기본 규칙을 지우지 말 것. */
    padding-block: 10px 6px;
  }
```
단축 속성을 `padding-block`으로 좁히면 좌우 longhand가 (0,3,0)에서 미청구 상태가 되어 `:5744`의 16px로 떨어진다. 새 숫자·새 선택자 없음, `1df220d`의 10/6 세로 밀도는 그대로. Chromium과 **WebKit(iOS Safari 엔진)** 양쪽에서 `padding: 10px 16px 6px`로 계산됨을 확인.
*대안* `padding: 10px 16px 6px;`(리터럴 직접 기입)도 동일하게 동작한다 — `:3857`의 `.station-sheet-filters { padding-inline: 16px }`와 같은 모양이라 원격 의존이 없다는 장점. 둘 중 무엇을 택하든 **`:5744`을 삭제하는 CSS 정리 작업은 금지**(전자를 택했을 때 버그가 조용히 되살아남).

### P2 — 반드시 5개를 한 커밋에

blast 렌즈가 패치의 전제("14px은 다른 데 안 쓰인다")를 반증했다. 14px은 **떠 있는 맵 크롬 일가의 공통 모서리**다. `.map-top`만 옮기면 바로 아래 배너가 2px 밖에 남아 — 신고된 것과 **같은 결함을 맵 오버레이 층에 새로 만든다**.

| 파일:라인 | 선택자 | 현재 → 변경 |
|---|---|---|
| globals.css:3931 | `.map-top` | `14px` → `16px` |
| globals.css:4089-4090 | `.map-banner` | `left/right: 14px` → `16px` (칩 레일 바로 아래 전폭 띠, /map에서 3개 상태로 렌더) |
| globals.css:4069 | `.map-rotation-reset` | `right: 14px` → `16px` |
| globals.css:4025 | `.map-fab` | `right: 14px` → `16px` |
| globals.css:4777 | `.metro-zoombtn` | `right: 14px` → `16px` (지하철 맵. 범위 밖이면 "의도적 제외"로 명시) |

제외: `.product-detail-hero-actions`(:5825-5826) — 다른 화면의 히어로 이미지 오버레이, 별도 판단.
`.map-banner` 내부 `padding: 8px 8px 8px 14px`은 카드 패딩이므로 건드리지 않음.
4px을 잃는 레일은 `.map-searchpill`(`flex:1; min-width:0`)과 `.station-filter-rail`(`min-width:0` 스크롤러)이 흡수 → 360px에서 모드 버튼 + 검색 필 행 1회 확인.

### ⚠️ 이번 범위에서 **제외**하는 것

- **`.pad` 18 → 16 전면 통일**: 31개 화면 + 짝지어진 음수 블리드 5곳(`:3166, 5064, 5067, 5315, 5318` 계열)을 동시에 옮겨야 한다. commit `bee7057`("The bleed used -18px against a container that pads 16px … the horizontal scrollbar came back on production")이 정확히 이걸 틀려서 프로덕션 가로 스크롤바를 냈다. **버그 수정이 아니라 owner 승인이 필요한 정규화 작업**이다.
- **`.subway-station-focus.pinned` 게터 12 → 16**(참고자료의 P5): 검증에서 탈락 — §5 참조. `:3843`의 `padding-inline: 12px`와 `:1140`의 `padding-inline: 6px`는 둘 다 `.pinned`(0,2,0)에 져서 **한 번도 렌더된 적 없는 죽은 선언**이다. 여기를 고쳐도 화면은 안 바뀐다.

### 지켜야 할 owner 결정 (역행 금지 — 전부 대조 완료)

1. `globals.css:3850-3853` (2026-08-22) — route-ready 스크롤러는 좌우 padding을 갖지 않는다. **P0는 자식에 양수 padding을 더할 뿐 margin을 건드리지 않으므로 이 결정을 역행이 아니라 이행한다.**
2. `globals.css:395` 영역 `overflow-x: hidden` (같은 사건) — 유지.
3. `globals.css:1079` "was 13/7 — the section felt cramped" — 세로 padding 결정. P0는 세로를 그대로 둔다.
4. `globals.css:3785-3792` — 스테퍼가 스크롤러를 덮지 않도록 in-flow로 바꾼 WCAG 2.4.11 결정. 건드리지 않음.
5. `globals.css:622-625` (2026-08-22) — 상태 줄은 "조용한 줄이지 콜아웃이 아니다". P8/P9는 가로 인셋만 바꾸고 `margin-block: -11px` 세로 오버행은 유지.
6. **`docs/HANDOFF.md` §2에는 여백/패딩 결정이 한 줄도 없다** (padding/gutter/여백/간격 grep 결과 0건). 과업 설명이 예상한 "2026-08-23 padding 결정"은 §2에 존재하지 않는다 — 이 화면의 여백 결정들은 CSS 주석과 커밋 메시지에만 남아 있다. **이 공백 자체가 리스크**이며 §6의 후속 작업으로 제안한다.

---

## 4. 하위 우선순위 (미검증 — 정적 근거만)

| # | 파일:라인 | 현재 → 변경 | 화면 | 근거 |
|---|---|---|---|---|
| L1 | globals.css:617 | `padding: 8px 11px 5px;` → `8px 12px 5px` | 역 자동완성 그룹 라벨 | 같은 카드 안 결과 행은 `:654` 12px, 빈 상태는 `:684` 12px |
| L2 | globals.css:631 | `padding: 2px 11px;` → `2px 12px` | 같은 카드 상태 줄 | L1과 한 커밋으로 |
| L3 | globals.css:5246 | `padding: 7px 13px;` → `7px 14px` | `/settings*` 행 | 한 화면에 13/14/12 세 개 내부 게터가 공존 |
| L4 | globals.css:5326 | `padding: 4px 12px;` → `4px 14px` | `/settings/account` 로그아웃 카드 | L3과 한 커밋으로 |
| L5 | globals.css:956, 958 | `.routestrip.embedded .routescroll { padding: 4px 0 }`, `.routestrip-controls { padding: 5px 6px }` | route-ready 패널 상단 역 스트립 | 같은 패널의 다른 가로 레일 `.subway-route-steps`는 `padding: 7px 16px`(:813). 단 첫 자식이 44px 아이콘 버튼이라 광학적으로 일부 정당화됨 — **owner 확인 후** |

죽은 CSS (정리 후보, 렌더 영향 0): `.subway-station-focus`의 `padding-inline: 12px`(:3880)과 `:1140`의 `padding-inline: 6px` / `:1141`의 `font-size: 9.5px` — 전부 `.pinned`(0,2,0)에 짐. 그리고 `.subway-nearby-heading`의 `padding: 20px 16px 12px`(:1079)도 `.subway-controller` 안에서는 항상 `:5744`에 진다.

---

## 5. 검증에서 탈락한 항목

| 항목 | 탈락 사유 |
|---|---|
| **P5 — `.subway-station-focus.pinned` 12 → 16** (globals.css:3800) | 핵심 논거가 **틀렸다**. 패치는 "`padding` 단축 속성이라서 좁은 화면 오버라이드를 죽인다"고 주장했지만, 명시도는 **선택자의 속성이지 선언 형태의 속성이 아니다**. longhand로 쪼개도 `.subway-station-focus.pinned`는 그대로 (0,2,0)이고, `:1140`의 6px(0,1,0)은 여전히 진다. Chromium 실측: 분리 전후 모두 `:1140`가 적용되지 않음. 게다가 단독 적용 시 **360px에서 게터가 12 → 16으로 넓어져** 3열 그리드(`minmax(0,1.1fr) minmax(104px,1.15fr) …`)의 역 이름 라벨 공간을 8px 빼앗는다 — owner가 여백을 신고한 바로 그 화면 폭에서. 그리고 이 스트립은 명시적 owner 참조(globals.css:3874-3877, 카카오 지하철 하단 바, 2026-08-22)다. **→ 현 상태 12px 유지.** |
| **P6 — 360px 스테퍼 오버라이드 추가** | P5에 종속된 패치. P5가 빠지면 필요 없다. 게다가 제안된 삽입 위치(라인 지정)가 `.subway-track-stop` 선언 블록 **내부**여서 그대로 적용하면 CSS가 깨진다. 죽은 `:1140-1141`는 §4의 정리 후보로만 남긴다. |
| **P2 단독 적용** | 반증되진 않았으나 **불완전**. §3의 5개 규칙을 같이 옮기지 않으면 새 불일치를 만든다. → 확장해서 채택. |

---

## 6. 재발 방지

**파일**: `/Users/hanmyeong-gwan/mobile_design/lib/subway-search-layout.test.ts`
**위치**: `describe("route-ready panel shares the station-sheet language", …)` 블록 안(현재 188-227행). 이 블록은 이미 `const css = readFileSync(new URL("../app/globals.css", …), "utf8")`로 CSS를 읽고 정규식으로 단언한다 — `lib/design-system-contracts.test.ts`와 같은 하우스 스타일. `npm test`(vitest run)로 돈다.

```ts
  it("keeps every route-ready panel block on the panel's 16px gutter", () => {
    // .subway-controller-scroll 은 설계상 좌우 padding 을 갖지 않는다 — 자식이
    // 각자 16px 을 들고 있다(owner report 2026-08-22, globals.css:3850-3853).
    // route-ready 티어에서 `padding` 단축 속성을 쓰면 그 게터가 조용히 0 이 된다:
    // "Products to look for" 가 화면 가장자리에 붙어 나간 경로가 정확히 이것이다
    // (owner report 2026-09-20).
    const block = css.match(
      /\.subway-controller\.route-ready \.subway-nearby-heading\s*\{([^}]*)\}/,
    )?.[1];
    expect(block, ".subway-controller.route-ready .subway-nearby-heading must exist").toBeTruthy();
    // 여기에 단축 속성 금지 — 좌우 longhand 까지 같이 청구해 버린다
    expect(block).not.toMatch(/(^|[;\s])padding\s*:/);
    expect(block).toMatch(/padding-block:\s*10px 6px;/);
    // 떨어져 내려올 좌우 게터가 여전히 선언되어 있고 16px 인지
    expect(css).toMatch(
      /\.subway-controller \.subway-nearby-heading\s*\{[^}]*padding:\s*9px 16px 5px;/,
    );

    // 같은 스크롤러의 다른 게터들도 16 에서 이탈하지 않도록 고정
    for (const rule of [
      /\.station-row\s*\{[^}]*padding:\s*10px 16px;/,
      /\.subway-route-summary\s*\{[^}]*padding:\s*12px 16px 9px;/,
      /\.subway-route-steps\s*\{[^}]*padding:\s*7px 16px;/,
      /\.subway-product-picks > a\s*\{[^}]*padding:\s*9px 16px;/,   // P1 적용 후
      /\.subway-empty-state\s*\{[^}]*margin:\s*4px 16px 12px;/,
      /\.subway-plan-route\s*\{[^}]*margin:\s*12px 16px 4px;/,      // P4 적용 후
      /\.subway-controller\.route-ready \.station-sheet-filters\s*\{\s*padding-inline:\s*16px;/,
    ]) {
      expect(css).toMatch(rule);
    }

    // route-ready 티어가 음수 좌우 margin 을 다시 들이지 않는지 —
    // 그게 프로덕션 가로 스크롤바였다(commits e28bddb, bee7057)
    const routeReady = css.match(/\.subway-controller\.route-ready [^{]*\{[^}]*\}/g) ?? [];
    expect(routeReady.filter((r) => /margin-inline:\s*-/.test(r))).toEqual([]);
  });
```

> **주의 — 참고자료의 단언문에서 3줄 고쳤다.** ① `.subway-product-picks > a`는 **P1 적용 후에만** `padding: 9px 16px`이 된다(현재는 `margin: 0 16px; padding: 9px 0`). ② `.subway-plan-route`는 **P4 적용 후에만** `12px 16px 4px`이다(현재 18px). ③ `.subway-station-focus.pinned`의 `padding-inline: 16px` 단언은 **삭제했다** — P5가 탈락해 그 바는 12px로 남기 때문. 테스트를 먼저 넣으면 이 세 줄이 실패한다. **P0~P4를 먼저 적용하고 테스트를 추가할 것.**

**선택적 2차 방어 (Playwright)** — `/Users/hanmyeong-gwan/mobile_design/e2e/subway-gutter.spec.ts`: 규칙이 아니라 렌더된 모서리를 단언한다.

```ts
const heading = page.locator('.subway-product-picks .subway-nearby-heading');
const row = page.locator('.subway-product-picks > a').first();
expect((await heading.boundingBox())!.x).toBeCloseTo((await row.boundingBox())!.x, 0);
// 게터 변경이 프로덕션 가로 스크롤바를 되살리지 못하게 (WCAG 1.4.10 Reflow)
expect(await page.evaluate(
  () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
)).toBe(0); // 320 / 360 / 390 각각
```

**구조적 제안 (별건)**: 게터 토큰이 없다 — `--gutter`/`--pad` 변수 0개, 하드코딩 리터럴 274개. `:root`에 `--gutter-sheet: 16px` / `--gutter-page: 18px`를 두고 모든 블리드를 `calc(-1 * var(--gutter-…))`로 쓰면 컨테이너와 블리드가 짝을 잃는 구조 자체가 사라진다. 그리고 **`docs/design-system.md`에 가로 게터 절이 없다** — 현재 §2는 "12px 리듬"이라는 세로 진술뿐이라 16px이 owner 신고 주석에서 역추적되어야 했다. 두 값과 각각이 지배하는 표면을 문서에 명시할 것.

---

## 7. 참고 규칙 · 스크린샷

| 출처 | 인용 |
|---|---|
| [Apple HIG — Layout](https://developer.apple.com/design/human-interface-guidelines/layout) | "Align elements to make them easier to scan…" / "Use consistent spacing. When content isn't consistently spaced, it no longer looks like a grid and it's harder for people to scan." (iPhone 측면 마진 숫자는 HIG에 없음 — 규칙만 제공) |
| [Material 3 — Applying layout / Compact](https://m3.material.io/foundations/layout/applying-layout/compact) | "Margins are 16dp from the leading and trailing edge of the window." (compact = <600dp) |
| [Material 2 — Responsive layout grid](https://m2.material.io/design/layout/responsive-layout-grid.html) | 폰 0–599dp: 마진 16dp, 거터 16dp. "Gutter widths are fixed values at each breakpoint range." |
| [Material 3 — Lists specs](https://m3.material.io/components/lists/specs) | 라벨/리딩 요소 좌측 16dp. 행의 **컨테이너** 모서리가 게터이고, 섹션 헤더는 거기에 맞춘다 |
| [Material 3 — Spacing](https://m3.material.io/m3/pages/spacing/overview) | 8dp 스케일. 16은 스케일 위, **18은 스케일 밖** |
| [NN/g — Text Scanning Patterns](https://www.nngroup.com/articles/text-scanning-patterns-eyetracking/) | layer-cake 스캔은 헤딩이 본문과 **하나의 좌측선**을 공유할 때 성립 — 헤더가 튀어나오면 깨짐 |
| [NN/g — Zigzag Layouts](https://www.nngroup.com/articles/zigzag-page-layout/) | 불규칙 배치가 불필요한 시선 고정(accidental fixations)을 만든다 |
| [WCAG 2.2 SC 1.4.10 Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html) | 320 CSS px에서 2차원 스크롤 금지. 지도 캔버스는 면제, 지하철 패널·시트·목록은 **아님** |
| WCAG 2.2 SC 2.5.8 + `docs/design-system.md:107` | 터치 영역 44×44px — 게터 변경이 히트 영역을 줄이면 안 됨 |

**프로젝트 문서**: `docs/superpowers/specs/2026-08-19-map-place-sheet-density-design.md:31`(유일한 16px 명문), `:67-68`(360–430px 범위) / `docs/superpowers/specs/2026-08-22-subway-station-first-design.md:8-13, 247-249`(하단 크롬을 키워 샵 행을 접힘선 아래로 밀지 말 것) / `docs/superpowers/specs/2026-08-19-settings-hub-account-flows-design.md:47`(그룹 사이만 여백, 행 사이는 얇은 선).

**스크린샷** (`/private/tmp/claude-501/-Users-hanmyeong-gwan-mobile-design/40ba898f-5884-48df-910f-ff968e2d3c24/scratchpad/gutter/`)

| 파일 | 내용 |
|---|---|
| `390-sub-C-products.png` | **신고 화면 390×844** — 헤더/부제 x=0, 역 행·제품 행 x=16 |
| `360-sub-C-products.png` | 같은 결함 360×640 — 부제가 물리 가장자리에 닿음 |
| `390-sub-A-route-full.png`, `390-sub-B-oliveyoung.png` | route-ready 패널 (All / Olive Young 선택 후) |
| `390-map-sheet-full.png` | /map 14 vs 16 칩·행 불일치 |
| `390-place-top/mid/low.png` | /place 18 본문 vs 16 앵커탭·북바 |
| `390-ranking/search/favorites/menu/settings.png` | 18px 게터 정상 확인 (360 버전 동일 세트 존재) |

**측정 공백** (재현 시 참고): ① 역 브라우즈 모드(route 미적용)는 Leaflet 캔버스 탭이 필요해 미도달 — DOM에서 `.route-ready` 제거로 간접 증명만 함. ② `/shop/[id]`, `/settings` 카드 **내부**는 정적 판독만(P3·L3·L4가 STATIC-ONLY인 이유). ③ `/place/*` id는 `lib/data.ts`가 아니라 `/sitemap.xml`에서 가져올 것 — 시드 id는 200을 주면서 notFound를 렌더해 게터 측정이 오염된다. ④ `/search`, `/favorites`는 빈 상태만 측정.
