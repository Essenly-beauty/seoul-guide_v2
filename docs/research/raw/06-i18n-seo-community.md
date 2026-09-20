# MYSEOULDROP 리서치 보고서 — i18n/l10n · SEO/공유 · 출시 교훈 (2025–2026 기준, 출처 직접 확인)

**검증 범위**: 아래 모든 규칙은 2026-09-20에 실제로 페이지를 fetch(또는 curl)해 확인한 것만 실었습니다. 수집 실패 출처는 맨 끝 "미수집 출처"에 명시. 저장소 grep으로 확인한 현재 상태도 각 항목에 반영했습니다(`app/layout.tsx`의 `lang="en"`, `lang="ko"` span 3곳, `globals.css`의 `word-break: keep-all` 3곳, `app/sitemap.ts`의 `encodeURIComponent`, `app/opengraph-image.tsx` 1200×630, `middleware.ts`는 Supabase 세션 전용, `app/place/[id]/page.tsx`에 `generateMetadata` 없음, hreflang/JSON-LD 없음).

우선순위: **P0** 출시 전 필수 · **P1** 로케일 추가 전 · **P2** 이후 개선

---

## A1. 언어·문자·서식 (W3C / MDN)

### 1. [P0] `<html lang>`은 항상, 로케일마다 다르게
- **규칙**: "Always use a language attribute on the `html` tag to declare the default language of the text in the page." `meta http-equiv="Content-Language"`는 "You should never use" — 페이지 언어 선언 수단이 아님.
- **적용**: 지금은 `app/layout.tsx:58`에 `lang="en"` 하드코딩. `[locale]` 세그먼트 도입 시 `<html lang={locale}>`로 바꿔야 함(Next.js 가이드도 동일 패턴 `<html lang={(await params).lang}>`). Google은 `lang`을 언어 판별에 쓰지 않지만(B-25 참고) 스크린리더·폰트 폴백·하이픈 처리에 영향.
- 출처: W3C — Declaring language in HTML — https://www.w3.org/International/questions/qa-html-language-declarations — accessed 2026-09

### 2. [P0] 한국어 원명·주소에는 인라인 `lang="ko"` (이미 부분 적용)
- **규칙**: "When the page contains content in another language, add a language attribute to an element surrounding that content." (`span`, `bdi`, `div`로 감싸기)
- **적용**: `components/places/places-content.tsx:103`, `components/map/selected-place-summary.tsx:46,91`에 `lang="ko"` 이미 있음 → **이미 커버**. 미적용 지점 점검 필요: 택시 기사에게 보여주는 카드(한국어 주소·전화), 즐겨찾기 리스트, OG 카드 alt, 리뷰 본문 내 한국어 인용. 로케일이 ja/zh/th가 되면 영어 표시명에도 `lang="en"`이 필요해짐(기본 언어가 더 이상 en이 아니므로).
- 출처: 위와 동일

### 3. [P0] 언어 협상은 "항상, 그러나 단독은 아님" + 스위처 + 선택 고정(stickiness)
- **규칙**: "The short answer is: _always_. A slightly longer answer is: _almost_ always, _but not alone_." / "it is important to provide means for visitors to _override_ the automatic choice of language when it is wrong." / "Language controls must also be provided, whether negotiation is implemented or not" (모든 페이지) / "What is needed here is some _stickyness_ of the explicit language selection." (쿠키 저장 또는 언어 명시 URL로 내부 링크).
- **적용**: 첫 방문만 Accept-Language로 안내, 이후에는 URL 접두어(/ja/map)와 `NEXT_LOCALE` 쿠키(A2-14)로 고정. 언어 스위처를 헤더/설정에 상시 노출. Google도 자동 리다이렉트를 피하라고 함(B-25).
- 출처: W3C — When to use language negotiation — https://www.w3.org/International/questions/qa-when-lang-neg — accessed 2026-09

### 4. [P1] 번역 시 문자열 확장률: 10자 이하 영문은 200–300%
- **규칙(IBM 표)**: Up to 10 chars → 200–300%, 11–20 → 180–200%, 21–30 → 160–180%, 31–50 → 140–160%, 51–70 → 151–170%, Over 70 → 130%. "Allow text to reflow and avoid small fixed-width containers or tight squeezes where possible." CJK: 글자 수는 줄어도 "greater horizontal space", Thai는 글리프 높이 때문에 줄간격 여유 필요.
- **적용**: 하단 탭바 라벨, 카테고리 칩(`components/category/filters.tsx`), "Directions"/"Save" 버튼처럼 짧은 문자열이 최대 위험. 고정 `width` 금지, `min-width` + wrap 허용, 탭 라벨은 2줄 허용 또는 아이콘-only 폴백. Thai 로케일에서 `line-height` 1.6 이상 검토.
- 출처: W3C — Text size in translation — https://www.w3.org/International/articles/article-text-size — accessed 2026-09

### 5. [P0] 한국어 줄바꿈: `word-break: keep-all` + `line-break` (이미 부분 적용)
- **규칙**: MDN `keep-all`: "Word breaks should not be used for Chinese/Japanese/Korean (CJK) text. Non-CJK text behavior is the same as for `normal`." KLREQ 7.1.1: "If a line ends in Hangul, line breaking is done on character or word basis." 7.1.2: 행두 금지 문자(닫는 괄호, 마침표·쉼표 등), 7.1.3: 여는 괄호 행말 금지. MDN `line-break`는 "how to break lines of Chinese, Japanese, or Korean (CJK) text when working with punctuation and symbols" (`strict`/`normal`/`loose`).
- **적용**: `globals.css:3528,3535,5895`에 `keep-all` 이미 있음 → 어떤 셀렉터인지 확인해 `[lang="ko"]`, `.place-name-secondary`, 주소 블록에 일관 적용. 좁은 카드에서 긴 한국어 상호가 넘칠 수 있으므로 `overflow-wrap: anywhere`를 함께 두는 것을 권장. ja/zh 로케일 본문은 `keep-all` 쓰지 말 것(일본어·중국어는 글자 단위 줄바꿈이 정상) — `html[lang^="ko"] body`처럼 한정.
- 출처: MDN — word-break — https://developer.mozilla.org/en-US/docs/Web/CSS/word-break ; MDN — line-break — https://developer.mozilla.org/en-US/docs/Web/CSS/line-break ; W3C — Requirements for Hangul Text Layout (KLREQ) §7.1 — https://www.w3.org/TR/klreq/ — accessed 2026-09

### 6. [P1] 언어 태그: 가능한 짧게, 중국어는 스크립트 서브태그(`zh-Hans`/`zh-Hant`)
- **규칙**: "the golden rule is to keep your language tag as short as possible. Only add further subtags ... if they are needed to distinguish the language". "Script subtags should only be used ... when the script adds some useful distinguishing information" (한 언어가 두 스크립트로 쓰일 때 — 중국어가 대표 사례). Google hreflang 예시도 `zh-Hant: Chinese (Traditional)`, `zh-Hans: Chinese (Simplified)`.
- **적용**: URL 접두어는 계획대로 `/zh-CN`, `/zh-TW`를 써도 되지만 `<html lang>`과 `hreflang` 값은 `zh-Hans`, `zh-Hant`(또는 `zh-Hant-TW`)로 매핑하는 테이블을 `i18n/routing.ts`에 둘 것. ja, th, ko는 그대로.
- 출처: W3C — Choosing a language tag — https://www.w3.org/International/questions/qa-choosing-language-tags ; Google — Localized versions — https://developers.google.com/search/docs/specialty/international/localized-versions — accessed 2026-09

### 7. [P2] 텍스트 방향: 대상 로케일 전부 LTR → `dir` 불필요, 사용자 입력에는 `dir="auto"`
- **규칙**: "No dir attribute is needed for documents that have a base direction of left-to-right, since this is the default". `dir="auto"`는 "the browser will look at the first strongly typed character in the element" — 폼/UGC에 유용.
- **적용**: 리뷰 입력 `textarea`와 리뷰 렌더링 요소에 `dir="auto"`(아랍어·히브리어 여행자가 남길 수 있음). 그 외 변경 없음.
- 출처: W3C — Structural markup and right-to-left text in HTML — https://www.w3.org/International/questions/qa-html-dir — accessed 2026-09

### 8. [P2] 이름 필드: "first/last name" 라벨 금지, 한·일·중은 성이 먼저
- **규칙**: "ask yourself whether you really need to have separate fields for given name and family name". 분리해야 하면 "Family name"과 "Other/given names"로 라벨. "Japan, Korea, and Hungary, also order names as family name followed by given name(s)". 정렬: "Thai and Icelandic people expect lists to be sorted by given name".
- **적용**: 리뷰어 표시명·프로필은 단일 "Display name" 필드 유지(Supabase 프로필). 예약/문의 폼이 생기면 분리하지 말 것.
- 출처: W3C — Personal names around the world — https://www.w3.org/International/questions/qa-personal-names — accessed 2026-09

### 9. [P1] `Intl.Segmenter`로 리뷰 요약 자르기·검색 토크나이즈 (Baseline 2024)
- **규칙**: `String.split(" ")`은 "would not get the correct result if the locale of the text does not use whitespaces between words (which is the case for Japanese, Chinese, Thai, ...)". "Since April 2024, this feature works across the latest devices and browser versions."
- **적용**: 리뷰 카드 "더보기" 요약(문장 단위 `granularity:'sentence'`), 장소 검색 인덱스의 단어 분할(`'word'`), 글자 수 카운터(`'grapheme'` — 태국어 결합문자·이모지 안전).
- 출처: MDN — Intl.Segmenter — https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/Segmenter — accessed 2026-09

### 10. [P1] 언어 스위처 라벨은 `Intl.DisplayNames`로 자국어 표기
- **규칙**: "enables the consistent translation of language, region and script display names"; `new Intl.DisplayNames(["zh-Hant"], {type:"language"}).of("zh") // "中文"`. Baseline "available across browsers since April 2021".
- **적용**: 스위처에서 각 항목을 해당 언어 자체로(日本語, 中文(简体), 中文(繁體), ไทย, 한국어) 렌더 — `new Intl.DisplayNames([code],{type:'language'}).of(code)`. `navigator.languages`는 "ordered by preference with the most preferred language first"이며 Accept-Language와 대체로 동일(클라이언트 측 제안 배너용).
- 출처: MDN — Intl.DisplayNames — https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DisplayNames ; MDN — Navigator.languages — https://developer.mozilla.org/en-US/docs/Web/API/Navigator/languages — accessed 2026-09

### 11. [P2] i18n vs l10n 정의 — "로컬라이즈 가능한 요소를 소스코드에서 분리"
- **규칙**: Internationalization은 "Separating localizable elements from source code or content, such that localized alternatives can be loaded or selected based on the user's international preferences as needed."
- **적용**: TSX 하드코딩 문자열을 먼저 `messages/en.json`으로 뽑아내는 것이 첫 단계(번역 전에). 이 추출 자체가 A1-4 확장률 문제를 드러내는 계기.
- 출처: W3C — Localization vs. Internationalization — https://www.w3.org/International/questions/qa-i18n — accessed 2026-09

---

## A2. Next.js i18n 구현 (Next.js 15 App Router + next-intl)

### 12. [P1] 서브패스 로케일 + 미들웨어 리다이렉트 + `[lang]` 세그먼트
- **규칙(Next 공식)**: "Routing can be internationalized by either the sub-path (`/fr/products`) or domain". Negotiator + `@formatjs/intl-localematcher`로 `match(languages, locales, defaultLocale)`. 로케일 없는 경로는 `NextResponse.redirect`. "ensure all special files inside `app/` are nested under `app/[lang]`". `hasLocale`로 좁혀 "ensures a 404 is returned if a translation is missing". 사전은 `import 'server-only'` + 동적 import → "we do not need to worry about the size of the translation files affecting our client-side JavaScript bundle size". 문서는 v16.3.5 기준으로 파일명이 `proxy.ts`("`proxy.ts` was called `middleware.ts` up until Next.js 16") — **프로젝트는 Next 15.5이므로 `middleware.ts` 유지**.
- **적용**: 현재 `middleware.ts`는 Supabase 세션 갱신 전용. next-intl `createMiddleware`와 체이닝(next-intl 응답 객체에 Supabase 쿠키 set) 필요. matcher는 next-intl 권장 `'/((?!api|trpc|_next|_vercel|.*\\..*).*)'`로 정적 파일·API 제외.
- 출처: Next.js — Internationalization guide (lastUpdated 2026-06-10) — https://nextjs.org/docs/app/guides/internationalization ; next-intl — Middleware — https://next-intl.dev/docs/routing/middleware — accessed 2026-09

### 13. [P1] 로케일 감지 순서와 쿠키 (next-intl)
- **규칙**: 감지 순서 = ① URL 접두어 → ② 쿠키("A cookie is present that contains a previously detected locale") → ③ `accept-language`("best fit" 알고리즘) → ④ `defaultLocale`. 쿠키 기본명 `NEXT_LOCALE`, `sameSite: 'lax'`, "no `max-age` set (session cookie for GDPR compliance)". `localeDetection: false`면 "rely entirely on the URL".
- **적용**: 여행자는 공항 와이파이·타인 기기 사용이 흔하므로(W3C가 든 인터넷카페 사례) 세션 쿠키 기본값이 적절. 스위처 선택 시에만 `maxAge`를 길게 주는 별도 쿠키를 고려.
- 출처: next-intl — Routing configuration — https://next-intl.dev/docs/routing/configuration ; next-intl — Middleware — https://next-intl.dev/docs/routing/middleware — accessed 2026-09

### 14. [P1] `localePrefix: 'as-needed'`로 기존 영어 URL 보존 + 자동 hreflang `Link` 헤더
- **규칙**: `'always'`(기본) "Pathnames always start with the locale"; `'as-needed'` "Use no prefix for the default locale (e.g. `/about`) while keeping it for other locales (e.g. `/de/about`)"; `'never'`는 alternate links 비활성("URLs might not be unique per locale"). `alternateLinks`(기본 on): 미들웨어가 "automatically sets the `link` header to inform search engines that your content is available in different languages" + `x-default` 포함.
- **적용**: 이미 인덱싱된 `/place/…` 영어 URL을 지키려면 `as-needed`. 단, Google hreflang은 **상호 링크 필수**(B-24)이므로 `Link` 헤더 자동 생성이 큰 이득. Vercel에서 헤더 크기 제한을 넘지 않도록 로케일 수(6개)는 문제없음.
- 출처: next-intl — Routing configuration — https://next-intl.dev/docs/routing/configuration — accessed 2026-09

### 15. [P1] 정적 렌더링: `generateStaticParams` + (`setRequestLocale`은 legacy)
- **규칙**: Next 공식: `generateStaticParams`로 `[{ lang: 'en-US' }, …]` 반환. next-intl: `next/root-params` 사용 시 "automatically eligible for static rendering"; `setRequestLocale`은 "a legacy API"로, `generateStaticParams`와 함께 "before you invoke any functions from `next-intl`" 호출해야 하며 없으면 "opts the route into dynamic rendering".
- **적용**: ~600 장소 × 6 로케일 = ~3,600 페이지. 전부 SSG 하지 말고 `generateStaticParams`는 로케일만 반환하고 장소는 ISR로. `setRequestLocale`을 각 `[locale]/layout.tsx`·`page.tsx` 최상단에 넣지 않으면 전 페이지가 동적 렌더링으로 떨어지는 것이 대표 함정.
- 출처: Next.js — Internationalization — https://nextjs.org/docs/app/guides/internationalization ; next-intl — App Router setup with i18n routing — https://next-intl.dev/docs/getting-started/app-router/with-i18n-routing — accessed 2026-09

### 16. [P1] CJK 웹폰트: Google Fonts는 KR/JP를 124조각 `unicode-range`로 슬라이스, Thai는 3조각
- **사실(curl, Chrome UA)**: `css2?family=Noto+Sans+KR:wght@400` → `@font-face` **124블록**, 모두 `woff2` + `unicode-range`(예: `U+d723-d728, …, U+d79e-d7a3, U+f900-f909…`; 자주 쓰는 음절만 모은 조각 `U+ac00, U+ace0, U+ae30, U+b2e4…`). Noto Sans JP도 124블록, Noto Sans Thai는 3블록. MDN: "If the page doesn't use any character in this range, the font is not downloaded". Next `next/font/google`: "CSS and font files are downloaded at build time and self-hosted … No requests are sent to Google by the browser." `subsets`를 지정하지 않으면 "Failing to specify any subsets while `preload` is `true` will result in a warning." `adjustFontFallback` 기본 `true`(CLS 완화), `display` 기본 `'swap'`.
- **적용**: (a) 현재 `globals.css`는 `var(--sans)` 시스템 스택 → 한국어 원명(`lang="ko"`)은 iOS/Android 시스템 한글 폰트로 이미 렌더됨. 로케일 UI 전체를 Noto로 바꿀 필요는 없고, **로케일별 루트 레이아웃에서만** `Noto_Sans_JP`/`Noto_Sans_SC`/`Noto_Sans_TC`/`Noto_Sans_Thai`를 `variable`로 로드해 `html[lang]`에 따라 `--sans`를 교체. (b) `next/font`가 슬라이스 CSS를 그대로 셀프호스팅하므로 브라우저는 실제 등장 글자 조각만 받음 — 한 페이지에 3–6조각 수준. (c) `preload`는 latin 등 작은 서브셋만; CJK는 `preload: false`로 두어 헤더 비대화 방지.
- 출처: Google Fonts CSS API (curl 2026-09-20) — https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400&display=swap ; MDN — unicode-range — https://developer.mozilla.org/en-US/docs/Web/CSS/@font-face/unicode-range ; Next.js — Font module (lastUpdated 2025-08-06) — https://nextjs.org/docs/app/api-reference/components/font — accessed 2026-09. (Google Fonts specimen/knowledge 페이지는 JS 렌더링이라 본문 미수집.)

### 17. [P1] OG 이미지의 로케일별 폰트는 `ImageResponse`에 직접 주입
- **규칙**: `opengraph-image.tsx`는 `export const size = { width: 1200, height: 630 }`, `contentType`, `alt`를 내보내고 `fonts: [{ name, data, style, weight }]`로 폰트 바이너리를 전달. "By default, generated images are statically optimized (generated at build time and cached) unless they use Request-time APIs or uncached data." `params`는 동적 세그먼트에서 Promise로 전달.
- **적용**: 현재 `app/opengraph-image.tsx`는 요청 시 `fetch("https://fonts.googleapis.com/css2?family=Michroma")` — 라틴 전용이라 한국어 상호·일본어 제목이 들어가면 두부(tofu)가 됨. `app/place/[id]/opengraph-image.tsx`를 새로 만들고 `readFile`로 로컬 Noto Sans KR/JP 서브셋 TTF를 모듈 스코프에서 한 번 읽어 `fonts`에 추가. 즐겨찾기 리스트 OG도 동일.
- 출처: Next.js — opengraph-image (lastUpdated 2026-07-09) — https://nextjs.org/docs/app/api-reference/file-conventions/metadata/opengraph-image — accessed 2026-09

---

## A3. 여행자 서식(통화·시간·주소·전화·단위)

### 18. [P0] KRW는 소수 자리 0 — `Intl.NumberFormat(locale, {style:'currency', currency:'KRW'})`
- **사실**: ISO 4217 list-one.xml(Pblshd 2026-09-17): `<Ccy>KRW</Ccy><CcyMnrUnts>0</CcyMnrUnts>` (JPY도 0, THB는 2). MDN: 통화의 기본 소수 자릿수는 "the number of minor unit digits provided by the ISO 4217 currency code list (2 if the list doesn't provide that information)" → JPY 예시 `"￥123,457"`. `currencyDisplay`: `"code"|"symbol"(기본)|"narrowSymbol"|"name"`.
- **적용**: `components/product/daiso-product-detail-body.tsx:10`의 `new Intl.NumberFormat("ko-KR")`는 통화 스타일이 아니라 순수 숫자 → `{style:'currency', currency:'KRW', currencyDisplay:'narrowSymbol'}`로 바꾸고 로케일은 사용자 로케일 전달(일본어 사용자에겐 `₩45,000`가 `￦45,000`로 나올 수 있으니 `narrowSymbol` 권장). 가격대 칩 `₩/₩₩/₩₩₩`(`filters.tsx`)는 그대로 두되 `aria-label`에 "Budget/Mid/Premium" 번역. 하드코딩 `₩45,000`(`cancel-booking-button.tsx:42`) 제거.
- 출처: SIX/ISO 4217 — List One (XML, curl 2026-09-20) — https://www.six-group.com/dam/download/financial-information/data-center/iso-currrency/lists/list-one.xml ; MDN — Intl.NumberFormat() constructor — https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/NumberFormat/NumberFormat — accessed 2026-09

### 19. [P0] 영업시간은 `timeZone: 'Asia/Seoul'` 고정, 12/24시는 로케일에 맡김
- **규칙**: `timeZone`은 "any IANA time zone name… The default is the runtime's time zone" → 해외에서 보는 사용자는 기본값이 자기 나라 시간대. `hour12: true`는 `hourCycle`을 "h11"/"h12"로, `false`는 "h23"으로 강제하며 "overrides both the `hc` locale extension tag and the `hourCycle` option". `dateStyle/timeStyle`은 component 옵션과 "must be `undefined`"(동시 사용 불가). 사용자 시간대는 `new Intl.DateTimeFormat().resolvedOptions().timeZone // e.g., "Europe/Brussels"`.
- **적용**: "지금 영업 중" 배지, 영업시간 표시, 리뷰 작성일은 전부 `timeZone:'Asia/Seoul'` 명시(출국 전 집에서 계획 세우는 사용자 케이스). `hour12`를 강제하지 말고 로케일 기본(en-US 12h, ja/zh/th/ko 24h)에 맡기되, 사용자 시간대가 Asia/Seoul이 아니면 "KST" `timeZoneName:'short'`를 붙여 혼동 방지.
- 출처: MDN — Intl.DateTimeFormat() constructor — https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat/DateTimeFormat ; MDN — resolvedOptions() — https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat/resolvedOptions ; MDN — Intl.DateTimeFormat — https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat — accessed 2026-09

### 20. [P2] 리뷰 상대시간은 `Intl.RelativeTimeFormat({numeric:'auto'})`
- **규칙**: "Widely available… since September 2020". `numeric:'auto'`면 `formatToParts(-1,'day') → "yesterday"`.
- **적용**: `app/mypage/reviews/[id]/page.tsx:18`의 `Intl.DateTimeFormat("en", …)`는 로케일 하드코딩 → 로케일 인자화. 리뷰 목록은 7일 이내 상대시간, 이후 절대 날짜.
- 출처: MDN — Intl.RelativeTimeFormat — https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/RelativeTimeFormat — accessed 2026-09

### 21. [P1] 거리·도보시간은 `style:'unit'` (kilometer/meter/minute)
- **규칙**: "If the `style` is `'unit'`, a `unit` property must be provided. Optionally, `unitDisplay` controls the unit formatting." 예: `{style:"unit", unit:"liter"}` → `'3,500 L'`, `unitDisplay:"long"` → `'3,500 liters'`.
- **적용**: 지하철 경로 "450 m · 6 min" 문자열을 `Intl.NumberFormat(locale,{style:'unit',unit:'meter',unitDisplay:'short'})`로 생성 → 일본어 "450 m", 태국어 "450 ม." 등 자동. 한국은 미터법이므로 마일 변환 불필요(en-US라도 현지 표기 유지, 단 `unitDisplay` 로케일 표기만 적용).
- 출처: MDN — Intl.NumberFormat() constructor — https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/NumberFormat/NumberFormat — accessed 2026-09

### 22. [P0] 도로명주소: 한국어 원문 + 영문(로마자) 두 벌, 영문은 역순·`-daero/-ro/-gil`·5자리 우편번호
- **규칙(국립국어원 로마자 표기법)**: "Romanization is based on standard Korean pronunciation." 행정구역은 "-do, -si, -gun, -gu, -eup, -myeon, -ri, -dong, and -ga"로 하이픈 연결, "Assimilated sound changes before and after the hyphen are not transcribed." 인명은 "family name first, followed by a space and the given name". 영문 주소 순서(Jusome 가이드): "Unit / Room number, Building name, Building number + Road name, Neighborhood / District (gu…), City, Province (omit for Seoul, Busan…), Postal code + Republic of Korea"; 접미사 "-daero: major boulevard, -ro: standard road, -gil: small lane"; 5자리 우편번호; 공식 변환은 juso.go.kr. 예: "152 Teheran-daero, Gangnam-gu, Seoul 06236, Republic of Korea".
- **적용**: 장소 상세의 "택시 기사에게 보여주기" 카드는 **한국어 주소를 크게**(`lang="ko"`, `keep-all`), 그 아래 로마자 주소를 보조로. 데이터 파이프라인에서 로마자 주소를 자체 변환하지 말고 juso.go.kr 검색 결과의 영문 주소 필드를 저장(발음 동화 미반영 규칙 때문에 자동 로마자화가 틀리기 쉬움 — 검색 결과 요약도 "Jong-ro"처럼 -ro 철자 유지 사례 언급).
- 출처: National Institute of Korean Language — Romanization of Korean — https://www.korean.go.kr/front_eng/roman/roman_01.do ; Jusome — How to Write a Korean Address in English — https://jusome.com/en/blog/how-to-write-a-korean-address-in-english-for-international-shipping-2 — accessed 2026-09 ; (검색결과에만 등장, 본문 미수집: juso.go.kr — Introduction Road name address — https://www.juso.go.kr/CommonPageLink.do?link=/eng/about/GuideBook)

### 23. [P1] 전화번호는 E.164로 저장, 표시는 국제 형식
- **규칙**: E.164 = "+로 시작", "Be limited to a total of 15 digits", 예 `+14155552671`. libphonenumber는 `PhoneNumberFormat.E164` → `'+41446681800'`, INTERNATIONAL → `'+41 44 668 18 00'`, NATIONAL → `'044 668 18 00'`; `AsYouTypeFormatter`로 입력 중 포맷.
- **적용**: Supabase `places.phone`을 `+82…` E.164로 정규화하고, 화면에는 항상 국제 형식(`+82 2-xxx-xxxx`) + `href="tel:+82…"` — 외국인은 로밍/현지 유심 상황이 섞여 국내 형식(02-…)이 걸리지 않을 수 있음. 클라이언트 번들 부담을 피하려면 서버에서 포맷해 문자열로 전달.
- 출처: Twilio — What is E.164? — https://www.twilio.com/docs/glossary/what-e164 ; Google — libphonenumber README — https://github.com/google/libphonenumber — accessed 2026-09

---

## B. SEO · 구조화 데이터 · 공유

### 24. [P1] hreflang: 3가지 방식, **상호 링크 필수**, `x-default`, 절대 URL
- **규칙**: 방법 = `<link rel="alternate" hreflang>` / HTTP `Link` 헤더 / 사이트맵 `<xhtml:link>`. "Each language version must list itself as well as all other language versions", "If two pages don't both point to each other, the tags will be ignored." "Alternate URLs must be fully-qualified, including the transport method". 코드는 ISO 639-1 + 선택적 ISO 3166-1 Alpha 2; "Specifying the region alone is not valid". `x-default`: "used when no other language/region matches the user's browser setting". "Google doesn't use `hreflang` or the HTML `lang` attribute to detect the language of a page".
- **적용**: 현재 hreflang 없음. Next `generateMetadata`의 `alternates.languages`(출력: `<link rel="alternate" hreflang="en-US" href="…">`) + `app/sitemap.ts`의 `alternates.languages`(출력: `<xhtml:link rel="alternate" hreflang="es" href="…"/>`, v14.2.0+)를 **각 장소 페이지마다** 6개 로케일 전부 + `x-default`(=영어)로 생성. next-intl `Link` 헤더와 중복돼도 무해하지만 값이 서로 달라지지 않도록 단일 헬퍼로.
- 출처: Google — Localized versions of your pages — https://developers.google.com/search/docs/specialty/international/localized-versions ; Next.js — generateMetadata `alternates` (lastUpdated 2026-08-25) — https://nextjs.org/docs/app/api-reference/functions/generate-metadata ; Next.js — sitemap.xml — https://nextjs.org/docs/app/api-reference/file-conventions/metadata/sitemap — accessed 2026-09

### 25. [P0] 언어별 별도 URL, 자동 리다이렉트 금지, 페이지당 단일 언어, Googlebot은 미국발
- **규칙**: "Google recommends using different URLs for each language version of a page rather than using cookies or browser settings". "Avoid automatically redirecting users from one language version of a site to a different language version". "Consider adding hyperlinks to other language versions". "use a single language for content and navigation on each page". "Most, but not all, Google crawls originate from the US, and we don't attempt to vary the location". URL 파라미터(`?loc=de`)는 "Not recommended".
- **적용**: A2-13의 쿠키 리다이렉트는 **접두어 없는 루트 요청에만**, 그리고 Accept-Language 기반 리다이렉트는 봇에 걸리지 않게 첫 방문 배너("日本語で見る?")로 대체하는 편이 안전. 한국어 원명·주소는 `lang="ko"` span으로 감싼 "보조 정보"이므로 "단일 언어" 원칙과 충돌하지 않지만, 영어 페이지의 본문 대부분이 한국어가 되지 않도록 유지.
- 출처: Google — Managing multi-regional and multilingual sites — https://developers.google.com/search/docs/specialty/international/managing-multi-regional-sites — accessed 2026-09

### 26. [P1] canonical은 같은 언어끼리, 절대 경로, JS로 바꾸지 말 것
- **규칙**: "If you're using `hreflang` elements, make sure to specify a canonical page in the same language, or the best possible substitute language". "Use absolute paths rather than relative paths with the `rel="canonical"`". 신호 강도: 리다이렉트 > `rel=canonical` > 사이트맵 포함(약함). JS SEO: "you shouldn't use JavaScript to change the canonical URL".
- **적용**: `/ja/place/x`의 canonical은 `/ja/place/x` 자기 자신(영어로 몰지 말 것). `metadataBase`가 이미 있으므로 `alternates.canonical`은 로케일 경로만 넣으면 절대 URL로 해석됨. 즐겨찾기 공유 URL에 쿼리(`?ref=`)가 붙으면 canonical로 정리.
- 출처: Google — Consolidate duplicate URLs — https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls ; Google — JavaScript SEO basics — https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics — accessed 2026-09

### 27. [P1] 한글 ID URL: percent-encoding, 사이트맵 UTF-8·escape, 50k/50MB, `priority` 무시
- **규칙**: "Characters in the non-ASCII range should be percent encoded" (예: `https://example.com/%E6%9D%82%E8%B4%A7/%E8%96%84%E8%8D%B7`). 하이픈 권장("hyphens (`-`) instead of underscores"). 사이트맵: "limit a single sitemap to 50MB (uncompressed) or 50,000 URLs", "must be UTF-8 encoded", "all tag values must be entity escaped", "Use fully-qualified, absolute URLs", "Google ignores `<priority>` and `<changefreq>`", `<lastmod>`는 "if it's consistently and verifiably accurate"일 때만.
- **적용**: `app/sitemap.ts`는 이미 `encodeURIComponent(p.id)` 사용 → **이미 커버**. 개선: (a) `priority` 필드는 무의미하므로 제거해도 됨, (b) `lastModified`는 실제 데이터 갱신일(Supabase `updated_at`)이 있을 때만 넣기(현재 없음 = 올바름), (c) 6개 로케일 × 600 = 3,600 URL로 한도 내지만 장소·상품·글 별로 `generateSitemaps` 분할 준비, (d) 장기적으로 한글 ID 대신 로마자 slug(`-` 구분)로 전환하면 공유 링크 가독성·복사 안정성 향상(리다이렉트 301로 이전).
- 출처: Google — URL structure best practices — https://developers.google.com/search/docs/crawling-indexing/url-structure ; Google — Build and submit a sitemap — https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap ; Next.js — sitemap.xml / generateSitemaps — https://nextjs.org/docs/app/api-reference/file-conventions/metadata/sitemap — accessed 2026-09

### 28. [P0] 장소 페이지 `generateMetadata` 부재 — 고유 title/description/OG가 없음
- **규칙**: "Unique, descriptive title elements and meta descriptions help users quickly identify the best result". 모바일 우선: "Make sure that the title element and the meta description are equivalent across both versions". "Use a meaningful status code, like a 404".
- **적용**: grep 결과 `generateMetadata`는 `app/map/page.tsx`에만 존재, `app/place/[id]/page.tsx`에는 없음 → 600개 장소 페이지가 루트 metadata를 상속 중(**P0 갭**). `generateMetadata`에서 `title: "{영문명} ({한국어명}) – {카테고리} in {동네} | MYSEOULDROP"`, `description`, `openGraph.images`(B-31), `alternates`(B-24)를 생성. 없는 ID는 `notFound()`로 진짜 404.
- 출처: Google — JavaScript SEO basics — https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics ; Google — Mobile-first indexing best practices — https://developers.google.com/search/docs/crawling-indexing/mobile/mobile-sites-mobile-first-indexing — accessed 2026-09

### 29. [P1] 구조화 데이터: `HairSalon`/`Store` 등 가장 구체적 하위 타입, `TouristAttraction`은 `additionalType`, 리뷰 별점은 제3자 사이트만 허용
- **규칙(Google LocalBusiness)**: 필수 `name`, `address`(PostalAddress: streetAddress, addressLocality, addressRegion, postalCode, addressCountry); 권장 `geo`(위경도 "minimum 5 decimal places"), `openingHoursSpecification`(`dayOfWeek`, `opens: "09:00"`, `closes`), `telephone`("with country and area codes"), `priceRange`(100자 미만), `url`, `image`. "Use the most specific LocalBusiness sub-type possible". 리뷰: "This property is only recommended for sites that capture reviews about **other local businesses**"; Review snippet 정책: "If the entity that's being reviewed controls the reviews about itself… ineligible", "Ratings must be sourced directly from users", `aggregateRating`은 `ratingValue` + `ratingCount|reviewCount` 필수. 일반 정책: "JSON-LD (recommended)", "Your structured data must be a true representation of the page content", "Don't mark up content that is not visible", "All image URLs specified in structured data must be crawlable". schema.org: `HairSalon` = Thing > Organization > LocalBusiness > HealthAndBeautyBusiness > HairSalon(`currenciesAccepted` ISO 4217, `paymentAccepted`); `TouristAttraction`은 "can be used on its own… or be used as an additionalType to add tourist attraction properties to any other type".
- **적용**: 현재 JSON-LD 없음. 장소 페이지에 `@type` 매핑(미용실→`HairSalon`, 올리브영/다이소→`Store`, 클리닉→`MedicalClinic`, 관광지→`TouristAttraction`), `address`는 **로마자 주소**로, `name`에 영문명 + `alternateName`에 한국어명, `geo` 소수 5자리 이상, `telephone` E.164, `priceRange` "₩₩". MYSEOULDROP은 타 업체 리뷰를 모으는 사이트이므로 사용자 리뷰가 실제로 그 페이지에 보일 때만 `aggregateRating` 포함(편집자 산정 금지). 이미지 URL은 Supabase 스토리지 공개 URL이어야 함.
- 출처: Google — Local business structured data — https://developers.google.com/search/docs/appearance/structured-data/local-business ; Google — Review snippet — https://developers.google.com/search/docs/appearance/structured-data/review-snippet ; Google — General structured data guidelines — https://developers.google.com/search/docs/appearance/structured-data/sd-policies ; schema.org — HairSalon — https://schema.org/HairSalon ; schema.org — TouristAttraction — https://schema.org/TouristAttraction — accessed 2026-09

### 30. [P0] 모바일 우선 인덱싱: 상호작용으로 지연 로드된 주요 콘텐츠는 색인되지 않음 + SSR 유지
- **규칙**: "Google uses the mobile version of a site's content, crawled with the smartphone agent, for indexing and ranking." "Don't lazy-load primary content upon user interaction. Google won't load content that requires user interactions (for example, swiping, clicking, or typing) to load." "Let Google crawl your resources". JS SEO: 렌더링 큐 "The page may stay on this queue for a few seconds, but it can take longer than that"; "server-side or pre-rendering is still a great idea".
- **적용**: 장소 상세의 리뷰 탭·영업시간 아코디언·"더보기"가 클릭 후 fetch라면 초기 HTML에 포함(서버 컴포넌트로). 지도 자체는 클라이언트여도 되지만 장소 목록 텍스트는 SSR. `robots.ts`가 `/mypage`, `/settings`, `/auth/`만 차단 → 이미지·API 리소스는 열려 있어 적절.
- 출처: Google — Mobile-first indexing — https://developers.google.com/search/docs/crawling-indexing/mobile/mobile-sites-mobile-first-indexing ; Google — JavaScript SEO basics — https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics — accessed 2026-09

### 31. [P1] Core Web Vitals: LCP ≤ 2.5s, INP ≤ 200ms, CLS ≤ 0.1, p75 모바일 기준
- **규칙**: "strive to have LCP occur within the first 2.5 seconds", "INP of less than 200 milliseconds", "CLS score of less than 0.1"; "aligns with what our core ranking systems seek to reward". web.dev: "a good threshold to measure is the 75th percentile of page loads, segmented across mobile and desktop devices"; 측정은 "web-vitals JavaScript library, a small, production-ready wrapper"; INP는 2024년 FID를 대체.
- **적용**: 지도 페이지는 INP 위험(마커 클릭→바텀시트) — `web-vitals` 라이브러리로 RUM 전송(Vercel Analytics/Speed Insights 또는 자체 엔드포인트). CJK 폰트 스왑으로 인한 CLS는 A2-16 `adjustFontFallback` + 로케일별 폰트만 로드로 억제. Search Console CWV 리포트를 배포 후 모니터링 루틴에 포함.
- 출처: Google — Core Web Vitals and Search — https://developers.google.com/search/docs/appearance/core-web-vitals ; web.dev — Web Vitals — https://web.dev/articles/vitals — accessed 2026-09

### 32. [P0] OG 카드: 4개 필수 속성, 1200×630(1.91:1), `og:image:width/height/alt`, `og:locale` + `og:locale:alternate`
- **규칙(ogp.me)**: 필수 `og:title`, `og:type`, `og:image`, `og:url`("The canonical URL of your object that will be used as its permanent ID"); `og:locale` "Of the format `language_TERRITORY`. Default is `en_US`"; `og:locale:alternate` "An array of other locales this page is available in"; `og:image:alt` "A description of what is in the image (not a caption)". Facebook: "at least 1200 x 630 pixels", 최소 "600 x 315", "as close to 1.91:1", "must not exceed 8 MB", width/height 태그로 "render the image immediately without having to asynchronously download". Next: `twitter-image`는 5MB, `opengraph-image`는 8MB 초과 시 빌드 실패.
- **적용**: 루트 `opengraph-image.tsx`는 1200×630 → **이미 커버**. 갭: 장소별·즐겨찾기 리스트별 OG 이미지 없음(B-28와 함께 `app/place/[id]/opengraph-image.tsx`, `app/lists/[id]/opengraph-image.tsx`). `generateMetadata.openGraph`에 `locale: 'ja_JP'`, `alternateLocale: ['en_US','zh_CN','zh_TW','th_TH']`, `images[].alt`(영문명 + 한국어명). `og:url`은 로케일 포함 절대 URL. 카카오톡·LINE 공유가 많을 것이므로 OG 태그가 초기 HTML에 있어야 함(SSR).
- 출처: Open Graph protocol — https://ogp.me/ ; Meta — Images in Link Shares — https://developers.facebook.com/docs/sharing/webmasters/images/ ; Next.js — opengraph-image — https://nextjs.org/docs/app/api-reference/file-conventions/metadata/opengraph-image ; Next.js — generateMetadata `openGraph` — https://nextjs.org/docs/app/api-reference/functions/generate-metadata — accessed 2026-09. (X/Twitter 카드 공식 문서는 HTTP 402로 미수집.)

---

## C. 커뮤니티 교훈(출시 체크리스트)

### 33. [P0] "본인 데이터만 접근 가능한가"가 첫 번째 체크 — HN 2026
- **출처 내용**: "Ask HN: What do you check before launching a web app?" (2026-04, 1 comment — 저득표지만 최신) 원글: "unclear positioning above the fold", "missing security headers", "weak or missing privacy / terms pages", "no obvious trust signals", "poor mobile experience", "basic accessibility issues", "SEO metadata that has clearly been left until the end", "exposed implementation details in client-side bundles". 답글(benoau): "make sure users can only access their own stuff, endpoints can't be repurposed to do destructive things", 비밀번호 해시, 세션 관리, "exceptions and logging"에 시크릿 누출 금지, "rate limiting on authentication and payment endpoints".
- **적용**: Supabase RLS로 `reviews`, `favorites`, `lists` 테이블 소유자 정책 재검토(공개 리스트는 `is_public` 컬럼 기반 SELECT만). Supabase Auth의 rate limit 기본값 확인. Sentry 등에 PII 스크러빙. "SEO metadata left until the end"는 B-28 갭과 정확히 일치.
- 출처: Hacker News — Ask HN: What do you check before launching a web app? — https://news.ycombinator.com/item?id=47937333 — 2026-04

### 34. [P0] 고득표 HN 고-라이브 체크리스트(2017, 274pt): HTTPS/HSTS, securityheaders, SPF/DKIM/DMARC, Lighthouse, axe, 죽은 링크, 프로덕션 키
- **출처 내용**: "HTTPS and related (HSTS -> cookies etc) enabled/correctly configured"; SSL Labs·securityheaders.io 점검(janfry); hstspreload.org(egeozcan); 깨진 링크 크롤러(jesperht); "production keys are active, not test keys"; mixed content(corobo); Lighthouse(michaelwu); axe-core(binthere); 이메일 SPF/DKIM/DMARC(dbbk); 자동화 후에도 "you should still be verifying things are really OK"(scaryclam). 2011년 스레드(235pt)의 원 체크리스트: favicon, 404, analytics, SEO title/meta, sitemap, robots.txt, 크로스브라우저, 성능, 백업, contact 페이지, 에러 알림; 댓글 교훈: robots.txt는 접근 제어가 아님(mtogo: "actually stop them from being accessed"), 에러 메일 폭주 → 중복 필터(troels), 보안(SQLi/XSS/CSRF) 점검 누락 지적. 2017 보안 체크리스트 스레드(548pt)의 반론: "The costs of implementing these recommendations would be staggering for the questionable benefits"(sho) — 소규모 앱은 선별 적용.
- **적용**: Vercel이 HTTPS를 주지만 `next.config`에 HSTS·CSP·`X-Content-Type-Options`·`Referrer-Policy` 헤더 추가 후 securityheaders.io로 확인. Supabase 트랜잭션 메일(비밀번호 재설정) 도메인의 SPF/DKIM/DMARC. 배포 후 sitemap의 3,600 URL 링크 크롤 1회. Lighthouse+axe를 CI에.
- 출처: Hacker News — Ask HN: Website go-live checklist app — https://news.ycombinator.com/item?id=14958394 — 2017-08 ; Hacker News — The quick website launch checklist — https://news.ycombinator.com/item?id=2883651 — 2011-08 ; Hacker News — Web Developer Security Checklist (discussion) — https://news.ycombinator.com/item?id=14346652 — 2017-05 (원문 simplesecurity.sensedeep.com은 DNS 실패로 미수집)

### 35. [P0] Front-End-Checklist(74.2k★): `lang` BCP 47, viewport, 페이지 무게 <1500KB(이상 500KB), 라벨·키보드·대비
- **출처 내용**: Critical — "Use the HTML5 doctype", "Declare UTF-8 character encoding", "Set the responsive viewport meta tag", "Associate labels with form controls", "Enable keyboard navigation for all elements"; High — "The element must have a lang attribute with a valid BCP 47 language code", "Keep page weight under 1500KB… (ideally under 500KB)", "Minify all CSS/JavaScript", "Implement lazy loading for offscreen content", "Meet minimum color contrast ratios"; Medium — "Implement favicons for all devices".
- **적용**: 지도 SDK(Kakao/Naver/Google)가 페이지 무게를 지배 → `/map`은 예산을 별도로 잡고 나머지 페이지는 500KB 목표. 필터 칩·별점 입력의 키보드 접근성, 다크모드 대비 점검(`THEME_BOOT` 스크립트 존재).
- 출처: GitHub — thedaviddias/Front-End-Checklist — https://github.com/thedaviddias/Front-End-Checklist — accessed 2026-09

### 36. [P1] 12-Factor: 환경에 설정, 의존성 명시, dev/prod 동일성, 로그는 이벤트 스트림
- **출처 내용**: "II. Dependencies — Explicitly declare and isolate dependencies", "III. Config — Store config in the environment", "X. Dev/prod parity — Keep development, staging, and production as similar as possible", "XI. Logs — Treat logs as event streams".
- **적용**: `package.json`의 `"next": "^15.5.23"` 캐럿 범위 → lockfile 커밋 + CI `npm ci`로 사실상 핀 고정(메이저 16의 `proxy.ts` 리네임 같은 변경에 대비). Supabase 프로젝트를 preview/prod로 분리(Vercel 환경변수). `console.log` 대신 구조화 로그.
- 출처: The Twelve-Factor App — https://12factor.net/ — accessed 2026-09

### 37. [P0] 반복되는 실전 교훈: 분석은 첫날부터, 에러 추적, 피드백 채널, 프로덕션에서 비밀번호 재설정 테스트, 실기기 테스트, 개인정보처리방침
- **출처 내용**: Shayan(2025-11): "Set up analytics before you have users"(PostHog/Mixpanel/Amplitude), 피드백 보드, 에러 모니터링(Sentry/Axiom), 트랜잭션 메일(비밀번호 재설정·환영), 랜딩 명확성, "fresh account"로 크리티컬 패스 테스트, 출시 채널 사전 준비, 사용자 소통 채널. Friedman(2026-05): "Error tracking (Sentry) active", "Analytics (Google Analytics 4) installed", "Uptime monitoring active (UptimeRobot, Pingdom)", "Privacy policy page live"/"Terms of service page live", "Mobile responsive on iPhone, Android, and tablet", "Test on real devices, not just Chrome DevTools", "Rate limiting on login attempts", DB 백업 구성; 'Launch disasters': broken password resets, failed payment webhooks, mobile layout breaks, missing privacy policies. HN 2024(build/deploy): "The more you can offload to managed services, the more time you can spend coding application logic", 인증은 직접 만들지 말 것, "one big VM for as long as possible. It's not better, but it's simpler."
- **적용**: Vercel Analytics 또는 PostHog(로케일·국가 차원 이벤트: 언어 스위처 사용, "Directions" 앱 선택 Google/Kakao/Naver 비율), Sentry(소스맵 업로드, PII 스크럽), Supabase PITR/백업 확인 및 **복구 리허설**, 프로덕션에서 재설정 메일 실제 수신 테스트(ja/th 메일 클라이언트 표시 포함), iPhone Safari + 갤럭시 Chrome 실기기, 개인정보처리방침(외국인 대상이면 GDPR·일본 APPI 언급), 리뷰 신고/문의 채널(이메일 + 인앱 폼), 이미 Supabase Auth 사용 = "직접 만들지 말 것" 충족.
- 출처: DEV — My checklist before launching any app (Shayan, 2025-11-26) — https://dev.to/shayy/my-checklist-before-launching-any-app-2a8h ; DEV — Web App Launch Checklist 2026: 47 Things (David Friedman, 2026-05-14) — https://dev.to/david_friedman_c2808375c1/web-app-launch-checklist-2026-47-things-to-check-before-going-live-1j7c ; Hacker News — Ask HN: How to build, deploy and maintain a web application? — https://news.ycombinator.com/item?id=40521013 — 2024-05

### 38. [P2] 도구 합의(2025 설문): 스택은 주류, 날짜 처리는 최대 고충 → `Intl`/`Temporal` 지향
- **출처 내용**: Stack Overflow 2025: Node.js 48.7%, React 44.7%, jQuery 23.4%, Next.js 20.8%; PostgreSQL 55.6%(1위); AWS 43.3%, Vercel 10.6%; "Docker has moved from a popular tool to a near-universal one" (+17pt). State of JS 2025: Next.js 사용 58.6%, 만족도 68%→55%(최대 하락), Vite 사용 84.4%·만족 98%, Webpack 만족 26%, Vitest·Playwright 사용 +14pt, Playwright 만족 94%, Jest 만족 65%; 언어 고충 2위 "Dates"(372), Browser API 고충 "Date management"(107), Temporal "actually being implemented in Firefox".
- **적용**: Next+Supabase(Postgres)+Vercel은 주류 — 채용·질문 답변 풀이 큼. E2E는 이미 Playwright(메모리 노트) = 커뮤니티 만족 최상위. 날짜/시간대 로직은 라이브러리 추가 대신 A3-19/20의 `Intl`로 해결하고, `Temporal` 폴리필은 아직 보류.
- 출처: Stack Overflow — 2025 Developer Survey: Technology — https://survey.stackoverflow.co/2025/technology ; State of JavaScript 2025 — Libraries — https://2025.stateofjs.com/en-US/libraries/ ; State of JavaScript 2025 — Features — https://2025.stateofjs.com/en-US/features/ — accessed 2026-09

---

## 출시 전 커뮤니티 공통 체크리스트 15항목 (출처가 2곳 이상 겹치는 것만)

1. **분석 도구를 사용자 0명일 때 설치** — 언어·국가·공유 채널 이벤트 포함 (Shayan; Friedman; HN 2011)
2. **에러 추적(Sentry 등) + 중복 알림 억제** (Shayan; Friedman; HN 2011 troels)
3. **업타임 모니터링 + 배포 후 Search Console CWV 확인** (Friedman; Google CWV)
4. **DB 백업 + 복구 리허설** (Friedman; HN 2011; HN 2024)
5. **HTTPS/HSTS/보안 헤더를 securityheaders.io·SSL Labs로 검증** (HN 2017 go-live; HN 2026)
6. **인증·결제 엔드포인트 rate limit, 사용자는 자기 데이터만(RLS)** (HN 2026; Friedman)
7. **인증은 직접 만들지 않기(Supabase Auth 유지), 관리형 서비스 우선** (HN 2024)
8. **프로덕션에서 새 계정으로 크리티컬 패스 실행: 가입→비밀번호 재설정 메일→리뷰 작성→공유** (Shayan; Friedman)
9. **실기기 테스트(iPhone Safari, Android Chrome) — DevTools 에뮬레이션만 금지** (Friedman; HN 2026 "poor mobile experience")
10. **개인정보처리방침·이용약관 페이지 공개 + 문의 채널** (HN 2026; Friedman; HN 2011 contact)
11. **404/500 페이지, 진짜 404 상태코드, 죽은 링크 크롤** (HN 2011; HN 2017; Google JS SEO)
12. **SEO 메타데이터를 "마지막"에 두지 않기: 페이지별 title/description/OG/canonical/hreflang** (HN 2026; Front-End-Checklist; Google)
13. **페이지 무게 예산(≤500KB 이상적, ≤1500KB) + Lighthouse/axe CI** (Front-End-Checklist; HN 2017)
14. **의존성 lockfile 고정, 환경변수로 설정, preview/prod 분리** (12-Factor; SO 2025 Docker 보편화)
15. **`lang` BCP 47, viewport, UTF-8, 폼 라벨·키보드 접근성** (Front-End-Checklist; W3C)

---

## 미수집(fetch 실패) 출처 — 본문 인용 없음
- X (Twitter) — Summary Card with Large Image — https://developer.x.com/en/docs/x-for-websites/cards/overview/summary-card-with-large-image — HTTP 402. 대신 Next.js 문서의 "twitter-image 5MB" 문구만 사용.
- Google Fonts — Noto Sans KR specimen / Fonts Knowledge "Subsetting" — JS 렌더링으로 본문 없음. 대신 Google Fonts CSS API 응답을 curl로 직접 확인.
- juso.go.kr — Introduction Road name address (GuideBook) — 본문 1.7KB JS 셸만 수신. 검색결과에 등장했으므로 URL만 기재.
- simplesecurity.sensedeep.com — Web Developer Security Checklist — DNS 실패. HN 토론 스레드만 사용.
- Reddit r/webdev·r/ExperiencedDevs — 도구가 reddit 접근 불가, 검색도 관련 스레드 미반환 → Reddit 출처는 보고서에 넣지 않음.
- Hacker News "Ask HN: What do you wish you knew before your first startup?" (https://news.ycombinator.com/item?id=45359421) — fetch는 됐으나 댓글 1개만 노출(저득표)이라 인용 제외.
