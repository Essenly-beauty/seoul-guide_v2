# MYSEOULDROP 웹앱 개발·사용성 필수 고려사항 — 해외 공신력 소스 리서치 (2026-09-20)

> 목적: 웹앱(특히 모바일 PWA 지도 앱)을 만들 때 **반드시 고려해야 하는 개발·사용성 기준**을 해외 1차 출처(표준기구·플랫폼 벤더·대형 UX 연구기관·대형 커뮤니티)에서 수집하고, MYSEOULDROP 현재 코드와 대조해 "이미 됨 / 부분 / 갭"으로 분류한 문서.
> 원문 리포트 6편(항목별 상세 근거·인용·URL)은 `docs/research/raw/` 참고. 이 문서는 그 요약·우선순위판.

## 0. 조사 방법과 읽는 법

- **출처 기준**: W3C(WAI/WCAG 2.2·APG·i18n), Google web.dev·Chrome Developers·Search Central, MDN, Next.js·Vercel·React 공식 문서, Apple HIG·WebKit 블로그, Material Design 3, Nielsen Norman Group, Baymard Institute, OWASP(Top 10:2025·Cheat Sheets), NIST SP 800-63B-4, Supabase 공식 문서, HTTP Archive Web Almanac 2025, Hacker News 고득표 스레드, Front-End-Checklist(74k★), Stack Overflow/State of JS 2025 설문.
- **검증 방식**: 6개 주제(성능 / 모바일 UX / 접근성 / PWA·오프라인·iOS / 보안·인증·개인정보 / i18n·SEO·커뮤니티)를 병렬 조사. 모든 항목은 2026-09-20에 실제로 페이지를 가져와 확인한 내용만 실었고, 가져오지 못한 페이지는 원문 리포트 말미에 명시함.
- **코드 대조**: `next.config.mjs`, `app/layout.tsx`, `public/sw.js`, `public/manifest.json`, `middleware.ts`, `components/map/*`, `components/auth/*`, `components/map/use-location.ts`, `app/api/account/*`, `lib/error-reporter.ts`, `app/globals.css`, `app/place/[id]/page.tsx`, `app/sitemap.ts`를 grep/열람.
- **표기**: ✅ 이미 됨 · ⚠️ 부분/확인 필요 · ❌ 갭. 우선순위 **P0** 출시 전/즉시 · **P1** 다음 배치 · **P2** 여유 시.

---

## 1. 한눈에 보기 — 교차 주제 P0 (즉시 조치)

| # | 갭 | 근거(출처) | 현재 코드 | 조치 |
|---|---|---|---|---|
| 1 | **장소 상세 600페이지에 고유 메타데이터·OG·구조화 데이터 없음** | Google Search Central "unique title/description", ogp.me 필수 4속성, Google LocalBusiness 구조화 데이터 | `generateMetadata`는 `app/map/page.tsx`에만 존재. `app/place/[id]/page.tsx`는 루트 metadata 상속, `opengraph-image.tsx`는 루트 1개, JSON-LD 0건 | `generateMetadata`(title "영문명 (한글명) – 카테고리 in 동네", description, openGraph.images, alternates) + `app/place/[id]/opengraph-image.tsx` + `HairSalon`/`Store`/`TouristAttraction` JSON-LD |
| 2 | **Google Fonts를 CSS `@import`로 로드** (렌더 차단 + 서드파티 요청 + CLS) | Next.js Font 문서(빌드 시 셀프호스팅, 브라우저→Google 요청 0, `adjustFontFallback`), web.dev font best practices | `app/globals.css:1` `@import url("https://fonts.googleapis.com/css2?...Fraunces...Plus+Jakarta+Sans...Geist+Mono...Michroma")`; `app/opengraph-image.tsx`는 요청 시 Google Fonts fetch | `next/font/google`로 전환(`subsets:['latin']`, `display:'swap'`), OG 이미지는 로컬 폰트 파일을 `fonts:[]`로 주입. CSP `style-src`/`font-src`의 googleapis 항목도 제거 가능 |
| 3 | **위치 권한을 페이지 로드 시 자동 요청** | web.dev Permissions: 사전 상호작용 없는 프롬프트 허용률 12% vs 제스처 후 30%; Apple HIG "실행 시점 요청 금지"; Android "맥락 속에서 요청" | `components/map/use-location.ts:90` `useEffect(() => { request(); })` — 마운트 즉시 `getCurrentPosition` | 기본 뷰(강남/명동)로 먼저 렌더 → "Near me" 탭 시 1줄 프라이밍 → 요청. `permissions.query({name:'geolocation'})`로 `granted`면 즉시, `denied`면 설정 안내 |
| 4 | **장소 데이터 ~1MB TS가 First Load JS에 포함** | Vercel React Best Practices 규칙 2.2 "큰 데이터는 기능 활성화 시 로드", Next.js production checklist, HTTP Archive 2025 모바일 JS 중앙값 632KB | `lib/generated/*.ts` 1.0MB(daiso 228KB, creatrip 135KB…) — HANDOFF L절에서 "보류"로 기록 | 빌드 스크립트로 `public/data/places-index.<hash>.json`(지도용 최소 필드) + 상세 JSON 분리, `headers()`로 `immutable` 캐시, 클라이언트는 hydration 후 fetch. 서버 컴포넌트(상세·SEO)는 TS 모듈 유지 |
| 5 | **비밀번호 최소 6자** | NIST SP 800-63B-4(2025-08): 단일요소 15자·MFA요소 8자 최소, 64자+ 허용, 조합규칙·주기변경 금지, 유출 비번 차단, 표시 토글·붙여넣기 허용; Supabase "8자 미만 비권장" | `components/auth/register-client.tsx:196,219`, `app/reset-password/page.tsx:67,91` `minLength={6}` | 최소 12(권장)~15, Supabase 대시보드 정책 동기화, 조합 규칙 OFF, Show password 토글, Pro면 Leaked password protection ON |
| 6 | **CARTO 타일을 API 키 없이 사용** | CARTO Basemaps Terms(2026-08-26 갱신): "Customer must always use ... own unique API keys", 키 없으면 워터마크 가능, 월 500만 요청 한도, 클라이언트 캐시 30일 상한, 서버 프록시 금지 | `components/map/map-view.tsx:51-52` `https://{s}.basemaps.cartocdn.com/rastertiles/.../{z}/{x}/{y}{r}.png` (키 없음) | CARTO 계정에서 키 발급 → `?key=` 환경변수 주입. OSM 타일 서버 폴백 금지(오프라인·사전캐시 정책 위반). attribution은 현재 OSM+CARTO ✅ |
| 7 | **실사용자 Core Web Vitals(RUM) 미수집** | web.dev: CWV는 필드 p75 기준(LCP 2.5s / INP 200ms / CLS 0.1); Next.js `useReportWebVitals`; Speed Insights 무료 티어는 RES만 | web-vitals/Speed Insights/analytics 코드 0건 (Lighthouse 랩 81만 존재) | `useReportWebVitals` 클라이언트 컴포넌트 → `client_errors`형 Supabase 테이블 또는 Vercel Speed Insights. INP `entries[].target` 셀렉터도 저장 |
| 8 | **개인정보처리방침에 수탁자·국외이전·보관기간 명시** | GDPR Art.3(2)·Art.13, 한국 PIPA Art.28-8(국외이전 고지 6항목)·Art.30, 2026-09-11 개정법 시행 | export/delete API ✅, 정책 페이지 존재(사실 갱신됨) — 수탁자(Supabase·Vercel·Google·SMTP)와 이전 국가·항목·기간 명시 여부 ⚠️ | `/legal` 정책을 표 형식으로: 항목·목적·근거·보관·수령자·국외이전·권리행사(export/delete 링크)·감독기관. HANDOFF의 "법무 검토 미반영" 항목과 병합 |
| 9 | **에러 리포터에 토큰/쿼리 마스킹 없음** | OWASP Logging CS: 세션ID·액세스토큰·이메일 기록 금지, CR/LF 제거 | `lib/error-reporter.ts`에 mask/redact/strip 로직 미검출 | URL의 `?code=`·`#access_token`·쿠키·이메일·좌표 마스킹, 메시지 길이 상한 |
| 10 | **브랜드 오렌지 본문 텍스트 3.76:1** | WCAG 1.4.3 텍스트 4.5:1(큰 텍스트·아이콘·UI 3:1), Apple HIG·Android 동일 | 사용자 결정으로 유지, 토큰 주석에 문서화 ✅ | 결정 유지 시 **토큰 분리**: `--brand`(#e94f00: 아이콘·마커·큰 제목·채움) / `--brand-text`(#c24100 5.19:1: 작은 텍스트·링크·칩 라벨) — 결정을 뒤집지 않고 범위만 좁힘 |

### 반영 현황 (2026-09-20, 브랜치 `feat/p0-best-practices`)

| # | 상태 | 비고 |
|---|---|---|
| 1 | ✅ 반영 | `lib/place-seo.ts`, `app/place/[id]/{page,opengraph-image}.tsx` — aggregateRating 미출력 |
| 2 | ✅ 반영 | `app/fonts.ts`(next/font), CSP 축소 |
| 3 | ✅ 반영 | `lib/geolocation-policy.ts` — granted일 때만 자동, 아니면 탭 시 요청 |
| 4 | ⏸ 보류 | 대규모 리팩터 — HANDOFF P1 백로그 |
| 5 | ✅ 반영 | `lib/auth-policy.ts` 8자+/72바이트 — Supabase 대시보드 최소 길이 동기화는 오너 액션 |
| 6 | ✅ 코드 반영 | `NEXT_PUBLIC_CARTO_API_KEY` 주입 — 키 발급은 오너 액션 |
| 7 | ✅ 반영 | `/api/vitals` + `web_vitals`(0010) — **프로덕션 DB 적용 대기**(Supabase 접근 불가 상태) |
| 8 | ✅ 초안 반영 | 개인정보처리방침 갱신 — 법무 검토 전 |
| 9 | ✅ 반영 | `lib/redact.ts` + `client_errors` csp kind 버그 수정(0009, 적용 대기) |
| 10 | ⏸ 보류 | 8/15 사용자 디자인 결정 — 토큰 분리 제안만 |

---

## 2. 이미 잘 되어 있는 것 (코드에서 확인)

- **보안 헤더 + CSP 강제 적용** (`next.config.mjs`): HSTS 2년·includeSubDomains, `nosniff`, `X-Frame-Options: DENY` + `frame-ancestors 'none'`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: geolocation=(self)`(OWASP 예시의 `geolocation=()`를 그대로 쓰면 지도가 깨지는데 올바르게 self로 됨), `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`. CSP 위반은 `securitypolicyviolation` → client_errors로 수집.
- **viewport**: `user-scalable=no`/`maximum-scale` 없음(WCAG 1.4.4·MDN 경고 준수), `viewportFit: cover`, theme-color 테마 추종.
- **PWA 기본**: manifest에 `id: "/"`, `scope: "/"`, `start_url: "/map"`, 192/512 + maskable, `display: standalone`; `appleWebApp` 메타; `beforeinstallprompt` 저장형 설치 컨트롤 + iOS 브라우저별 "홈 화면에 추가" 안내(`components/pwa/pwa-install-control.tsx`); `navigator.share` + 폴백; `offline.html` 네비게이션 폴백(인증/API는 절대 캐시하지 않는 보수적 SW).
- **접근성 기초**: 바텀시트 `aria-modal`, 토스트 `role="status" aria-live="polite"`, `prefers-reduced-motion` 3곳, 한글 상호에 인라인 `lang="ko"`(map-sheet·selected-place-summary·places-content·subway), `word-break: keep-all`, 마커 요소 `aria-label`.
- **폼**: 로그인 `type="email" inputMode="email" autoComplete="email"` + `current-password`, 가입 `new-password`, 이름 `name`, 비번찾기·재설정 자동완성 — WCAG 3.3.8(Accessible Authentication)·web.dev 로그인 폼 가이드 충족.
- **계정 권리**: `GET /api/account/export`(`cache-control: no-store`, `getUser()` 서버 검증) + `POST /api/account/delete`(service role, same-origin 가드) — GDPR 접근·이동·삭제권 구현.
- **DB/운영**: RLS 전 테이블, insert-only 테이블(feedback·client_errors), 5종 격리 테스트, uptime cron, Playwright E2E 13종 + CI, 프로토타입 라우트 config 리다이렉트.
- **SEO 기본**: `metadataBase`, robots(계정 페이지 차단), sitemap 한글 id `encodeURIComponent`, 루트 OG 1200×630, 공유 리스트 OG.
- **성능 기본**: SSR 정적 지도 스냅샷(LCP), 마커 뷰포트 컬링, 지하철 지오메트리 지연 로드, 타일 CDN preconnect, `next/dynamic` 지도.
- **위치 옵션**: `timeout: 8000, maximumAge: 60000`, `enableHighAccuracy` 미설정(=false) — MDN이 경고하는 "timeout 기본 Infinity" 함정 회피.
- **쿠키 동의 배너 불필요 상태**: 현재 쿠키는 Supabase 세션(필수)만 — 분석 도구를 붙이는 순간 EU 방문자 opt-in 배너가 필요해짐(§3.5 F3).

---

## 3. 주제별 핵심 항목

### 3.1 성능 (web.dev · Next.js · Vercel · Leaflet · HTTP Archive)

| 항목 | 규칙·수치 | 현재 | 조치·우선순위 |
|---|---|---|---|
| CWV 기준값 | LCP ≤ 2.5s / INP ≤ 200ms / CLS ≤ 0.1, **모바일 p75** 기준. 2026-09 현재 기준 변경 없음("LCP 2.0s" 블로그 주장은 1차 출처 미확인) | 랩 LCP 2.5s(경계선), 필드 데이터 없음 | 랩 목표 LCP ≤ 1.8s로 여유 확보, RUM 수집(P0 #7) |
| INP 대상 | 탭·클릭·키 입력만(스크롤·핀치줌 제외). 50ms 초과 = 롱태스크. `scheduler.yield()`는 Safari 미지원 → `setTimeout` 폴백 | 마커 탭→시트, 필터 탭, 검색 입력이 대상 | `startTransition`/`useDeferredValue`, 리스트 `content-visibility: auto` (P1) |
| LCP 하위구간 | TTFB ~40% / 리소스 지연 <10% / 로드 ~40% / 렌더 지연 <10%. LCP 이미지 `fetchpriority="high"`, `loading="lazy"` 금지 | 스냅샷 `fetchpriority=high` ✅ | `sizes="100vw"`·쿼리 파라미터 없는 캐시 가능 URL 확인 (P1) |
| bfcache | `unload` 핸들러·HTML `Cache-Control: no-store`·열린 WebSocket이 차단. 복원 시 CLS/INP 0 | 상세↔지도 왕복 잦음 | 비인증 라우트 HTML에 `no-store` 금지, `pagehide`에서 연결 정리 (P1) |
| 클라이언트 경계 | `'use client'`가 import한 모듈은 전부 번들. children/props로 넘긴 서버 컴포넌트는 미포함. 데이터 모듈에 `import 'server-only'` | 장소 TS 모듈이 지도 클라이언트에서 import | P0 #4 + `server-only` 가드 |
| 번들 분석 | `@next/bundle-analyzer`(webpack) / `next experimental-analyze`(16.1+). `optimizePackageImports`(lucide-react 기본 포함) | 미측정 | 분석 결과를 PR마다 diff (P1) |
| `next/image` | `sizes` 없으면 100vw 가정. Next 16: `priority`→`preload`, `qualities:[75]`, `minimumCacheTTL` 4h. Vercel Hobby 월 5K 변환 한도 초과 시 402 | `<img>` 10곳 vs next/image 2파일. 올리브영 224장 사진 | `deviceSizes` 모바일 축소, `formats:['image/webp']`, 정확한 `sizes` (P1) |
| `next/font` | 빌드 시 셀프호스팅, `adjustFontFallback` 기본 true, `display` 기본 swap. CJK는 시스템 폰트 폴백이 로밍에 유리 | ❌ CSS @import | P0 #2 |
| 캐싱 모델 | Next 15: `fetch`·GET Route Handler·라우터 캐시 기본 **비캐시**(옵트인). Next 16: `cacheComponents` + `'use cache'` + `cacheLife` | Next 15.5 | 장소 라우트는 정적 셸, 사용자 데이터만 `<Suspense>` 뒤 스트리밍 (P1) |
| Vercel Cache-Control | 기본 `public, max-age=0, must-revalidate`. `set-cookie`·`Authorization`·`Vary: Cookie` 있으면 CDN 미캐시. `s-maxage`는 CDN만 소비 | 미들웨어가 전 라우트에서 세션 쿠키 갱신 | 지도/장소 응답에 `set-cookie`가 실리는지 `x-vercel-cache` 확인 (P1) |
| Leaflet 렌더 | `preferCanvas`는 Path(CircleMarker)에만 적용, `L.Marker`/divIcon은 DOM. markercluster `chunkedLoading`·`removeOutsideVisibleBounds`·`disableClusteringAtZoom` | 뷰포트 컬링 603→~60 divIcon ✅ | 줌아웃 오버뷰만 CircleMarker+canvas 또는 클러스터 (P2) |
| react-leaflet v5 | `MapContainer` props 불변(children 제외), `center/zoom` 변경은 `map.flyTo`. React `<Activity>`와 비호환 → `key` | — | 마커를 React 요소 600개로 매핑하지 말고 `useMap()` 네이티브 addLayer (P2) |
| 타일 로딩 | 모바일 기본 `updateWhenIdle: true`, `keepBuffer: 2`. 로밍 사용자는 타일 바이트가 비용 | preconnect 4서브도메인 ✅ | `keepBuffer` 늘리지 않기, `updateWhenZooming: false` 검토 (P2) |
| 벤치마크 | Web Almanac 2025 모바일 홈 중앙값: JS 632KB·이미지 911KB·폰트 122KB; 모바일 TBT 중앙값 1,916ms; CWV 전부 통과 48% | TBT 380ms(우수) | 목표: First Load JS < 300KB, LCP 이미지 ≤ 100KB, 장소 인덱스 ≤ 50KB |
| 측정 | Lighthouse(랩) + CrUX 28일 롤링(필드). Speed Insights 무료=RES만, Plus $10/프로젝트. 소프트 내비게이션은 CrUX 미반영 | 랩만 | `useReportWebVitals`(무료) 우선 (P0 #7), 상세→지도 복귀는 `performance.mark` 자체 계측 |

출처: web.dev [Vitals](https://web.dev/articles/vitals) · [INP](https://web.dev/articles/inp) · [Optimize LCP](https://web.dev/articles/optimize-lcp) · [Optimize CLS](https://web.dev/articles/optimize-cls) · [bfcache](https://web.dev/articles/bfcache) · [Optimize long tasks](https://web.dev/articles/optimize-long-tasks) · [Font best practices](https://web.dev/articles/font-best-practices) / Next.js [Production checklist](https://nextjs.org/docs/app/guides/production-checklist) · [Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components) · [Package bundling](https://nextjs.org/docs/app/guides/package-bundling) · [Lazy loading](https://nextjs.org/docs/app/guides/lazy-loading) · [Image](https://nextjs.org/docs/app/api-reference/components/image) · [Font](https://nextjs.org/docs/app/api-reference/components/font) · [Caching](https://nextjs.org/docs/app/getting-started/caching) · [useReportWebVitals](https://nextjs.org/docs/app/api-reference/functions/use-report-web-vitals) · [Next.js 15](https://nextjs.org/blog/next-15) · [Next.js 16](https://nextjs.org/blog/next-16) / Vercel [React Best Practices](https://vercel.com/blog/introducing-react-best-practices) · [Cache-Control headers](https://vercel.com/docs/caching/cache-control-headers) · [CDN Cache](https://vercel.com/docs/caching/cdn-cache) · [Speed Insights pricing](https://vercel.com/docs/speed-insights/limits-and-pricing) · [Image Optimization pricing](https://vercel.com/docs/image-optimization/limits-and-pricing) · [Fluid compute](https://vercel.com/docs/fluid-compute) / [Leaflet reference](https://leafletjs.com/reference.html) · [Leaflet.markercluster](https://github.com/Leaflet/Leaflet.markercluster) · [React Leaflet](https://react-leaflet.js.org/docs/start-introduction/) / HTTP Archive [Page Weight 2025](https://almanac.httparchive.org/en/2025/page-weight) · [Performance 2025](https://almanac.httparchive.org/en/2025/performance)

### 3.2 모바일 사용성 (NN/g · Apple HIG · Material 3 · Baymard · Google Maps Platform)

| 항목 | 규칙·수치 | 현재 | 조치·우선순위 |
|---|---|---|---|
| 터치 타깃 | iOS 44×44pt / Material 48dp / WCAG 2.2 최소 24px(AA)·44px(AAA) / NN/g 1cm / Baymard 7mm. 간격 8dp 이상. 걷는 사용자는 더 크게 | 미측정 | 마커·칩·하트·별·복사 아이콘 히트박스 44px 스캔(`getBoundingClientRect`) (P0) |
| 엄지 존 | 한 손 49%(오른엄지 67%), 엄지 조작 75%. 숨긴 햄버거는 사용률 57% vs 보이는 내비 86%, 과제 15% 느림 | 하단 탭바 ✅ | "현재 위치"·"이 지역 검색"·필터를 하단 1/3에 (P1) |
| Safe area | `viewport-fit=cover` + `padding-bottom: max(12px, env(safe-area-inset-bottom))` | cover ✅, safe-area 참조 다수 ✅ | 스탠드얼론 모드 스크린샷으로 탭바·FAB·스낵바 검증 (P1) |
| 하단 탭바 | 3–5개, **라벨 필수**(1–2단어), 항상 보이게, 액션 금지, 콘텐츠 없어도 탭 숨기지 않기 | 5탭(Map/Stories/Ranking/Saved/My) ✅ | 상세에서도 유지, 게스트 Saved는 빈 상태로 (P1) |
| 바텀시트 | iOS medium 디텐트≈절반, 그래버 포함(탭하면 디텐트 순환), 한 번에 하나만. NN/g: 보이는 Close(X), 기기 뒤로가기로 닫기, 스택 금지 | 3단 시트 + 핸들 ✅ | 전체 확장 시 X 노출, `popstate` 연동, 시트 위 시트 금지 (P1) |
| 실수 닫힘 | 닫혀도 작업(필터 선택·리뷰 텍스트) 손실 없이. 부분 오버레이 우선 | — | 필터 시트 바깥 탭 시 상태 보존, 리뷰 작성 중 닫기 확인 (P1) |
| FAB | 화면당 1개, 가장 중요한 단일 액션, 우하단. 스낵바는 FAB 위 | 하트 FAB 레이어 | 오렌지 원형 FAB 최대 1개 (P2) |
| 지도 vs 리스트 | NN/g: **기본 뷰는 리스트**, 거리만 있으면 리스트에서 선택. 촘촘한 핀은 오탭 | 지도 우선 + 시트 | 첫 진입 시 시트를 "절반"으로 열어 리스트 즉시 노출, 행마다 거리·도보분 (P0) |
| 클러스터링 | Apple HIG "겹치는 POI 클러스터링", Google 기본 그리드 60px·2개부터, 정지 시(`dragend`)만 갱신 | 컬링만 | markercluster(줌 15 이하 밀집 매장) (P1) |
| 선택 마커 | 외곽선+색 변화로 식별, 장소 카드가 마커를 가리지 않게(`panBy`), 아이콘 문자 2–3자 | 오렌지 승격 ✅ | 카드 표시 시 지도를 위로 밀어 마커 유지 (P1) |
| "이 지역 검색" | 지도 이동 시 나타나고 클릭 후 숨김(Google Maps·Airbnb·Yelp). 자동 갱신은 대역폭·혼란 | 재검색 버튼 ✅ | `moveend` 임계값 + 결과 수 표시, 자동 갱신 기본 off (P2) |
| 위치 프라이밍 | Apple: 사전 화면은 버튼 하나("Continue"), Android: 거부 시 우아한 저하, NN/g: 명시적 "Use Current Location" 요소, 폴백은 주소 자동완성 | ❌ 자동 요청 | P0 #3 |
| 스와이프 모호성 | 임베드 지도의 스크롤 vs 팬 충돌. 시트 영역에서 지도 제스처 차단 | 풀스크린 지도 | 시트 전체 확장 시 지도 비활성, 상세 미니맵은 정적 이미지 (P2) |
| 길찾기 | NN/g: 11개 중 9개가 Google/Apple Maps로 링크 아웃. 영업시간·임시휴업은 앱 안에서 | Google/Kakao/Naver 링크 ✅ | 한국은 Naver/Kakao 기본 추천 힌트, 영업 상태 배지 (P1) |
| 검색 | 단일 진입점, 자동완성 4–8개, 인접 제출 버튼(21% 미제공), `enterkeyhint="search"`, 최근 검색, 비원어민 오타 허용 | 통합 검색 ✅ | 제안 ≤6, 카테고리 라벨, 로마자 오타(Myungdong) 관용 (P1) |
| 필터 | "Filter" **텍스트 라벨**, 바텀시트 레이어, 스티키 "Show N results"(선택마다 갱신), 적용 필터 칩 오버뷰(28% 미제공), 모바일은 배치 적용(<1초면 인터랙티브 OK) | 칩 다중선택·거리 필터 ✅ | 결과 수 실시간 표시, 적용 필터 개별 X, 0건 시 "반경 확대/해제" (P0) |
| 빈 상태 | 상태 설명 + 학습 힌트("하트를 눌러 저장") + 직접 경로 버튼 | Saved 게스트 배너 ✅ | 필터 0건·검색 0건·리뷰 0건에도 적용 (P1) |
| 응답시간 | 0.1초 즉각 / 1초 사고 유지 / 10초 주의 한계. 1–10초 스켈레톤, 10초↑ 진행률+취소. 프레임형 스켈레톤은 빈 화면처럼 보임 | Saved 스켈레톤 ✅ | 리스트 카드형 스켈레톤 5–6개, 경로 계산 5초↑ 취소 (P1) |
| 에러 메시지 | 원인 옆에, 빨강+아이콘 중복 신호, 평이한 말, 해결책, **입력 보존**, "invalid/illegal" 어휘 금지 | 인라인 에러 ✅ | 서버 오류도 필드 옆 + 해결 링크("Reset password") (P1) |
| 폼 입력 | 54%가 최적화 키보드 미적용, 79%가 자동교정 미해제. 라벨은 필드 위, placeholder만 금지, 키보드 시 뷰포트 40% 감소 | `inputMode` ✅ | 이메일 `autocapitalize="none" autocorrect="off" spellcheck="false"` 추가 (P1) |
| Undo vs 확인 | 확인 대화상자는 되돌릴 수 없는 일에만. 스낵바 액션 1개(Undo), 4–10초 | 로그아웃·삭제 모달 ✅ | 저장 해제·리뷰 삭제는 Undo 스낵바 6초 (P1) |
| 로그인 벽 | NN/g: 게스트로 끝까지, 가입은 가치가 생기는 순간(호혜). Apple: 로그인 최대한 늦추기, 앱 내 계정 삭제 | 게스트 모드 + 첫 하트 넛지 1회 ✅, 계정 삭제 ✅ | 유지. 리뷰 작성만 로그인 필수 + 상태 보존 복귀 (✅) |
| 온보딩 | 튜토리얼 카드덱은 과제 성과 개선 없음. 맥락형 1회 팁만, 건너뛴 튜토리얼 재노출 금지 | 웰컴/스플래시/choose-mode | 코치마크 1줄 1회 정도로 축소 검토 (P2) |
| 언어 스위처 | 브라우저 언어 자동 적용, 언어명은 자국어("日本語"), 국기만 금지, 언어·국가·통화 독립, 번역 확장 50% 여유 | UI 영어 고정 | i18n 도입 시 §3.6 (P1) |
| 여행자 인식 | 휴리스틱 #2·#6: 한국어 원문 + 로마자 + "택시 기사에게 보여주기" 풀스크린 카드, 호선 색·역 번호·출구 번호 아이콘 | 택시 모달·nameKr ✅ | creatrip 205곳 `nameKr` 백필(HANDOFF P3) 선행 |

출처: NN/g [10 Heuristics](https://www.nngroup.com/articles/ten-usability-heuristics/) · [Touch Targets](https://www.nngroup.com/articles/touch-target-size/) · [Hamburger Menus](https://www.nngroup.com/articles/hamburger-menus/) · [Bottom Sheets](https://www.nngroup.com/articles/bottom-sheet/) · [Accidental Overlay Dismissal](https://www.nngroup.com/articles/accidental-overlay-dismissal/) · [Mobile Maps](https://www.nngroup.com/articles/mobile-maps-locations/) · [Store Finders](https://www.nngroup.com/articles/store-finders-and-locators/) · [Mobile Faceted Search](https://www.nngroup.com/articles/mobile-faceted-search/) · [Applying Filters](https://www.nngroup.com/articles/applying-filters/) · [Empty States](https://www.nngroup.com/articles/empty-state-interface-design/) · [Response Times](https://www.nngroup.com/articles/response-times-3-important-limits/) · [Skeleton Screens](https://www.nngroup.com/articles/skeleton-screens/) · [Error Messages](https://www.nngroup.com/articles/error-message-guidelines/) · [Confirmation Dialogs](https://www.nngroup.com/articles/confirmation-dialog/) · [Login Walls](https://www.nngroup.com/articles/login-walls/) · [Mobile Onboarding](https://www.nngroup.com/articles/mobile-app-onboarding/) · [Language Switchers](https://www.nngroup.com/articles/language-switching-ecommerce/) / Apple HIG [Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility) · [Layout](https://developer.apple.com/design/human-interface-guidelines/layout) · [Sheets](https://developer.apple.com/design/human-interface-guidelines/sheets) · [Maps](https://developer.apple.com/design/human-interface-guidelines/maps) · [Tab bars](https://developer.apple.com/design/human-interface-guidelines/tab-bars) · [Privacy](https://developer.apple.com/design/human-interface-guidelines/privacy) · [Managing accounts](https://developer.apple.com/design/human-interface-guidelines/managing-accounts) · [Onboarding](https://developer.apple.com/design/human-interface-guidelines/onboarding) · [Entering data](https://developer.apple.com/design/human-interface-guidelines/entering-data) / Material 3 [Navigation bar](https://m3.material.io/components/navigation-bar/guidelines) · [Bottom sheets](https://m3.material.io/components/bottom-sheets/guidelines) · [FAB](https://m3.material.io/components/floating-action-button/guidelines) · [Chips](https://m3.material.io/components/chips/guidelines) · [Snackbar](https://m3.material.io/components/snackbar/guidelines) / Baymard [Button design](https://baymard.com/learn/button-design) · [Autocomplete](https://baymard.com/blog/autocomplete-design) · [Mobile search submit](https://baymard.com/blog/mobile-search-submit-button) · [Filter UI](https://baymard.com/learn/ecommerce-filter-ui) · [Applied filters](https://baymard.com/blog/how-to-design-applied-filters) · [Touch keyboards](https://baymard.com/blog/mobile-touch-keyboards) / Google [Locator Plus](https://developers.google.com/maps/solutions/store-locator/best-practices) · [Marker clustering](https://mapsplatform.google.com/resources/blog/how-cluster-map-markers/) · [Android permissions](https://developer.android.com/training/permissions/requesting) / [WebKit iPhone X](https://webkit.org/blog/7929/designing-websites-for-iphone-x/) · [Hoober grip study](https://www.uxmatters.com/mt/archives/2013/02/how-do-users-really-hold-mobile-devices.php) · [Growth.design Hopper](https://growth.design/case-studies/hopper-permission-requests-ux)

### 3.3 접근성 (WCAG 2.2 · WAI-ARIA APG · Leaflet · MDN)

| 항목 | 규칙·수치 | 현재 | 조치·우선순위 |
|---|---|---|---|
| 2.5.8 Target Size (AA, 2.2 신규) | 24×24 CSS px 최소. **지도 핀은 Essential 예외**(지리 위치 반영). 칩·핸들·별·하트는 해당 | 미측정 | 칩 상하 여백으로 24 확보, 권장 44 (P0) |
| 2.4.11 Focus Not Obscured (AA, 신규) | 포커스 요소가 저작 콘텐츠(시트·탭바·토스트)에 **완전히** 가려지면 실패 | 시트 뒤 지도 컨트롤 | 시트 열림 시 뒤 콘텐츠 `inert` 또는 포커스된 마커 `panTo`, `scroll-padding-bottom` 탭바 높이 (P1) |
| 2.4.7/2.4.13 Focus Visible | outline 제거는 실패(F78). 2px 실선 + 3:1 대비. 복잡한 타일 배경 위는 이중 링 | 미확인 | `focus-visible:outline-2 outline-offset-2` 전역, 마커는 흰+짙은 이중 링 (P1) |
| 2.5.7 Dragging Movements (AA, 신규) / 2.5.1 | 드래그 기능은 단일 포인터 대안 필수 — Understanding 예시가 정확히 "지도 팬 → 방향 버튼", "핀치 줌 → +/− 버튼". 시트 스와이프 → 핸들 탭 토글 | 줌 컨트롤·핸들 `role="button"` ✅ | 줌 +/− 숨기지 않기, 팬 대안(리스트 "지도에서 보기"=`panTo`) (P1) |
| 3.3.7 Redundant Entry (A, 신규) | 같은 프로세스에서 재입력 금지 — 가입→인증→프로필의 이메일, 경로 재검색 시 도착역 유지, 리뷰 실패 시 텍스트 보존 | — | 검토 (P1) |
| 3.3.8 Accessible Authentication (AA, 신규) | 인지 테스트 금지 — 비밀번호 관리자 자동채움(`autocomplete`)·붙여넣기 허용·OAuth 대안이면 통과. CAPTCHA 도입 시 텍스트 받아쓰기형 금지 | ✅ | Turnstile 도입 시 관리형(보이지 않는) 모드 |
| 1.4.3 / 1.4.11 대비 | 텍스트 4.5:1(큰 텍스트 24px 또는 18.66px bold는 3:1), UI 컴포넌트·아이콘 3:1 | #e94f00 3.76:1 | P0 #10 토큰 분리. 마커는 흰 halo로 1.4.11 안전 |
| 1.4.1 Use of Color | 색만으로 정보 전달 금지 — 카테고리 마커는 아이콘/모양 차이, 하트는 채움 변화, 칩은 체크 아이콘 | 올리브영 로고 마크 ✅ | 나머지 카테고리 마커 형태 차이·범례 (P1) |
| 1.4.4 / 1.4.10 / 1.3.4 | 200% 텍스트, 320px 폭 가로 스크롤 없이(지도 캔버스는 예외), 방향 고정 금지 | `user-scalable` 제한 없음 ✅ | iOS 최대 글자 크기 + 데스크톱 400% 줌으로 시트·필터·폼 점검 (P1) |
| 2.3.3 / prefers-reduced-motion | 상호작용 애니메이션 비활성 수단. Leaflet은 JS 옵션 → `matchMedia`로 `zoomAnimation/fadeAnimation/markerZoomAnimation={false}`, `flyTo` `{animate:false}` | CSS 3곳 ✅ | Leaflet 옵션 연동 (P1) |
| 지도 = 정보형 | 1.1.1: 리스트가 지도와 동일 데이터 집합의 대안(Minnesota IT 가이드 "지도 없이도 사용 가능"). 지도 컨테이너 `role="region" aria-label`, 타일 `role=presentation` | 바텀시트 리스트 ✅ | 리스트가 뷰포트/필터와 동일 집합인지 확인, 지도 앞 sr-only 설명 (P1) |
| Leaflet 키보드 | 기본 `keyboard: true`(화살표 팬, +/− 줌, Tab 마커). Equal Entry: 동시 Tab 가능 마커 ≤20 | `map-view.tsx:719,732,745` `keyboard={false}` ×3 | 리스트가 1차 경로면 허용(2.1.1은 "둘 중 하나" 충족) — 단 지도 컨테이너 자체 포커스·줌 컨트롤 `aria-label` 유지 확인 (⚠️ P1) |
| divIcon 접근 이름 | 4.1.2: divIcon은 `role=button`+`tabindex`가 붙지만 이름 없음(Leaflet Discussion #9388). `alt`/`title` + html 안 sr-only 텍스트("장소명, 카테고리, 영업 상태"). 선택 상태 `aria-pressed`/`aria-current` | `setAttribute("aria-label")` ✅ | `setIcon` 교체 후 속성 유지 확인, 선택 상태 노출 (P1) |
| 4.1.3 Status Messages | 필터·이동 후 "Showing 42 places" `role=status`(polite, `moveend` debounce), 오류 `role=alert`. 라이브 리전은 로드 시부터 DOM에. VoiceOver 이중 발화 방지(둘 다 쓰지 않기) | 토스트 ✅ | 결과 수 status 리전 (P1) |
| 2.4.1 Bypass Blocks | 첫 Tab = "Skip to place list". 랜드마크 `header/search/main/nav[aria-label]` | 미확인 | 스킵 링크 + 랜드마크 (P1) |
| APG Modal Dialog | `role=dialog aria-modal aria-labelledby`, 포커스 트랩, Esc, 닫힐 때 호출 요소로 복귀, 뒤 콘텐츠 `inert`. **반쯤 열린 결과 리스트 시트는 비모달**(`aria-modal` 붙이면 지도가 숨겨짐) → `role=region` + 핸들 `aria-expanded` | `bottom-sheet.tsx` `aria-modal` | 모달/비모달 시트 구분 (P1) |
| APG Toggle Button | 하트: `aria-pressed`, **라벨 고정**(상태 따라 바꾸지 않기), SVG `aria-hidden` | 미확인 | (P1) |
| APG Combobox | 검색: `role=combobox aria-expanded aria-controls aria-autocomplete="list"`, `aria-activedescendant`, 옵션 안에 버튼 금지 | 미확인 | (P1) |
| 3.3.1 / ARIA21 | 제출 후에만 `aria-invalid` + `aria-describedby` 오류 연결, 보이는 `<label>`, 별점은 `fieldset/legend` 라디오 | 인라인 에러 ✅ | 속성 연결 확인 (P1) |
| 3.1.2 Language of Parts | 고유명사는 엄격히 예외지만 한글 문자열은 VoiceOver가 글자 단위로 읽으므로 `lang="ko"` 강력 권장 | 6곳 ✅ | 택시 카드·즐겨찾기·OG alt·리뷰 인용 확인 (P1) |
| Next.js 라우트 어나운서 | `document.title` → `h1` → pathname 순으로 읽음 → 라우트별 고유 title 필수 | 장소 title 없음 ❌ | P0 #1과 동일 |
| 검사 도구 | axe-core(WCAG 이슈 57% 자동), `@axe-core/playwright` `.withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa'])`, Lighthouse a11y는 가중 평균(100점≠완전), `eslint-plugin-jsx-a11y` strict | E2E 13종에 a11y 없음 | 홈(시트 닫힘/열림)·상세·로그인·지하철 4스펙 (P1) |

출처: W3C WAI [What's New in WCAG 2.2](https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/) · Understanding [2.5.8](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) · [2.4.11](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html) · [2.4.13](https://www.w3.org/WAI/WCAG22/Understanding/focus-appearance.html) · [2.5.7](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html) · [3.3.7](https://www.w3.org/WAI/WCAG22/Understanding/redundant-entry.html) · [3.3.8](https://www.w3.org/WAI/WCAG22/Understanding/accessible-authentication-minimum.html) · [1.4.3](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) · [1.4.11](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html) · [1.4.10](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html) · [2.3.3](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html) · [4.1.3](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html) · [3.1.2](https://www.w3.org/WAI/WCAG22/Understanding/language-of-parts.html) / APG [Dialog](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/) · [Button](https://www.w3.org/WAI/ARIA/apg/patterns/button/) · [Combobox](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/) · [Tabs](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/) · [Alert](https://www.w3.org/WAI/ARIA/apg/patterns/alert/) · [Landmarks](https://www.w3.org/WAI/ARIA/apg/practices/landmark-regions/) / [Leaflet accessibility](https://leafletjs.com/examples/accessibility/) · [Leaflet Discussion #9388](https://github.com/Leaflet/Leaflet/discussions/9388) · [Minnesota IT — Accessible Interactive Web Maps (PDF)](https://mn.gov/mnit/assets/Accessibility%20Guide%20for%20Interactive%20Web%20Maps_tcm38-403564.pdf) / MDN [Viewport meta](https://developer.mozilla.org/en-US/docs/Web/HTML/Guides/Viewport_meta_element) · [prefers-reduced-motion](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion) · [autocomplete](https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes/autocomplete) / web.dev Learn Accessibility [Forms](https://web.dev/learn/accessibility/forms) · [Focus](https://web.dev/learn/accessibility/focus) · [JavaScript](https://web.dev/learn/accessibility/javascript) / [Next.js Accessibility](https://nextjs.org/docs/architecture/accessibility) · [Playwright accessibility testing](https://playwright.dev/docs/accessibility-testing) · [axe-core](https://github.com/dequelabs/axe-core) · [WebAIM VoiceOver mobile](https://webaim.org/articles/voiceover/mobile)

### 3.4 PWA · 오프라인 · iOS Safari · Android Chrome (web.dev · MDN · WebKit · Workbox · CARTO/OSM 정책)

| 항목 | 규칙·수치 | 현재 | 조치·우선순위 |
|---|---|---|---|
| 설치 기준 | HTTPS, name, 192+512 아이콘, start_url, display. `beforeinstallprompt`는 여전히 SW `fetch` 핸들러 요구 + "1탭·30초" 휴리스틱 | manifest ✅, sw fetch ✅ | fetch 핸들러 유지(제거하면 Android 프롬프트 사라짐) |
| Richer Install UI | `screenshots`(320–3840px, 비율 ≤2.3, narrow) 1장↑이면 큰 대화상자, `description` ≤324자, `categories` 소문자, `shortcuts` scope 내 URL | ❌ screenshots/shortcuts/categories | 스크린샷 3–4장 + shortcuts 3개(Saved/Near me/Olive Young) (P1) |
| iOS 설치 | 프롬프트 없음 → 공유 시트 안내. **iOS 26/Safari 26: 홈 화면 추가 시 기본이 "Open as Web App"**, 설치 요건 0 | iOS 안내 시트 ✅ | iOS 26 토글 안내 추가 (P2) |
| iOS 메타 | `apple-touch-icon` 180px 1장(있으면 manifest 아이콘보다 우선), `apple-mobile-web-app-*`, 스플래시는 기기 해상도별 정확 매칭 필요 | `appleWebApp` ✅ | 스플래시는 비용 대비 낮음 → SSR 스냅샷으로 대체 (P2) |
| SW 전략 매핑 | `/_next/static` CacheFirst(해시 안전) / 이미지 SWR / 네비게이션·RSC NetworkFirst(타임아웃+offline.html) / Supabase `auth|rest`·`/login`·non-GET **NetworkOnly**. CacheFirst는 status 200만 | 네비게이션 폴백만(안전) ✅ | 정적 자산·이미지 런타임 캐시 추가 시 위 표 준수 (P1) |
| Next.js 해시 자산 함정 | 라우트별 청크 매니페스트 없음(Discussion #64336) → 프리캐시는 URL 고정 파일만, 오래된 HTML 서빙 시 청크 404 | offline.html·아이콘만 프리캐시 ✅ | 캐시 이름에 빌드 ID 주입, activate에서 구버전 삭제 (P1) |
| Navigation Preload | SW 부팅 모바일 ~250ms 상쇄. `event.preloadResponse` 대신 `fetch(request)` 쓰면 요청 2번 | ❌ | `activate`에서 `navigationPreload.enable()` + `preloadResponse ?? fetch` (P1) |
| SW 업데이트 | 무조건 `skipWaiting()`은 지연 로드 서브리소스를 깨뜨릴 수 있음 → `updatefound` → "New version — Reload" 토스트 → `SKIP_WAITING` 메시지 → `controllerchange` 1회 리로드 | `sw.js` 무조건 `skipWaiting` ⚠️ | 업데이트 토스트 흐름 (P1) |
| 캐시 만료 | Cache API는 자동 만료 없음 → `maxEntries`(LRU)/`maxAgeSeconds`/quota 에러 시 삭제 | — | 타일·이미지 캐시 도입 시 필수 (P1) |
| OSM 타일 정책 | 사전 다운로드·오프라인 사용 금지, 최소 7일 캐시, Referer 필수, no SLA | 미사용 ✅ | 폴백으로 붙이지 말 것 |
| **CARTO 약관** | API 키 필수, 월 500만 요청, **클라이언트 캐시 ≤30일**, 서버 프록시 금지, OSM+CARTO attribution | 키 없음 ❌, attribution ✅ | P0 #6. 타일 SW 캐시는 14일 상한, "서울 오프라인 팩" 금지 |
| Opaque 응답 | `no-cors` 타일은 Chrome 쿼터에 **개당 ~7MB**로 계산 | — | `L.tileLayer(..., {crossOrigin:'anonymous'})`(CARTO CDN CORS 확인 후) 아니면 `maxEntries ≤150` (P1) |
| 저장 쿼터 | Chromium 디스크 60%, Safari(iOS 17+) 60%, LRU origin 전체 퇴거. `navigator.storage.persist()`는 설치/상호작용 이력 기반 자동 승인 | — | 설치·첫 저장 시 `persist()`, 설정에 `estimate()` 사용량·삭제 (P2) |
| **ITP 7일 규칙** | 비설치 Safari: 7일(Safari 사용일 기준) 상호작용 없으면 localStorage·IndexedDB·Cache·SW 등록 **전부 삭제**. 서버 설정 쿠키는 예외, 홈 화면 앱은 예외 | 게스트 즐겨찾기 = localStorage ⚠️ | 게스트 저장 N개↑면 "계정에 저장 / 홈 화면에 추가" 넛지; Supabase 세션은 서버 쿠키라 유지 ✅ (P1) |
| Safari↔홈 화면 앱 스토리지 분리 | "설계상 의도"(WebKit 181849) — 설치 후 로그인 다시 필요, 게스트 데이터 안 보임. iOS 17.2–18.1 세션 쿠키 회귀 버그 272325 | 설치 안내에 미명시 | 안내 문구 + 401 시 조용한 refresh→재로그인 (P1) |
| Web Push | iOS 16.4+ **홈 화면 앱에서만**, 사용자 제스처 필수; 18.4 Declarative Web Push | 미사용 | 도입 시 `display-mode: standalone` 게이트 |
| `100vh` → `svh/dvh` | Safari 15.4+/Chrome 108+. dvh는 60fps 갱신 아님 → 지도 컨테이너는 `100svh`(`invalidateSize` 연속 호출 회피) | dvh/svh 참조 41곳 ✅ | 지도는 svh 확인 (P2) |
| iOS 입력 자동 확대 | input `font-size` <16px면 포커스 시 뷰포트 줌 | 미확인 | 검색·로그인·리뷰 입력 16px 고정 (P1) |
| 러버밴딩 | `overscroll-behavior: contain`(Safari 16+)로 풀투리프레시·바운스 차단; `-webkit-overflow-scrolling`은 iOS 13부터 no-op | 미확인 | 시트·리스트에 적용 (P2) |
| Android 키보드 | Chrome 108+는 키보드 시 layout viewport 미축소(기본 `resizes-visual`); `resizes-content`는 Leaflet 재렌더 유발 | `interactiveWidget: "resizes-content"` ⚠️ | 지도 재렌더 비용 vs 시트 레이아웃 트레이드오프 재검토 (P2) |
| 오프라인 표시 | `navigator.onLine`은 힌트일 뿐 → `offline` 이벤트 + 실제 fetch 실패 결합, 아이콘+텍스트(색만 금지), 기능 비활성화 대신 시도 후 실패 처리 | 피드백 오프라인 큐 ✅ | 상단 배지 "Showing saved places · no connection" (P1) |
| 쓰기 큐 | Background Sync는 **iOS Safari·Firefox 미지원** → IndexedDB 아웃박스 + `online`/`visibilitychange`/앱 시작 시 재전송, `maxRetentionTime` | 즐겨찾기 pending-intent 오버레이 ✅ | 아웃박스 일반화(즐겨찾기·별점·리뷰) (P2) |
| 위치 API | 제스처에서만, HTTPS 필수, `timeout` 기본 Infinity·`maximumAge` 기본 0 함정, 오류 1/2/3 분기, `watchPosition`은 `clearWatch` | timeout/maximumAge ✅, 자동 요청 ❌ | P0 #3 + 오류 코드별 문구(standalone이면 "Settings ▸ Apps ▸ MYSEOULDROP ▸ Location") |

출처: web.dev [Install criteria](https://web.dev/articles/install-criteria) · [Richer Install UI](https://web.dev/articles/web-apps/richer-install-ui) · [Customize install](https://web.dev/articles/customize-install) · [Navigation preload](https://web.dev/blog/navigation-preload) · [Handling navigation requests](https://web.dev/articles/handling-navigation-requests) · [Offline Cookbook](https://web.dev/articles/offline-cookbook) · [Learn PWA: Update](https://web.dev/learn/pwa/update) · [Storage for the web](https://web.dev/articles/storage-for-the-web) · [Offline UX guidelines](https://web.dev/articles/offline-ux-design-guidelines) · [User Location](https://web.dev/articles/user-location) · [Permissions best practices](https://web.dev/articles/permissions-best-practices) · [Viewport units](https://web.dev/blog/viewport-units) · [WebAPKs](https://web.dev/articles/webapks) / Workbox [Caching strategies](https://developer.chrome.com/docs/workbox/caching-strategies-overview) · [Expiration](https://developer.chrome.com/docs/workbox/modules/workbox-expiration) · [Storage quota](https://developer.chrome.com/docs/workbox/understanding-storage-quota) · [Background sync](https://developer.chrome.com/docs/workbox/modules/workbox-background-sync) · [Viewport resize behavior](https://developer.chrome.com/blog/viewport-resize-behavior) / MDN [Making PWAs installable](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable) · [Manifest id](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/id) · [shortcuts](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/shortcuts) · [Storage quotas](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria) · [getCurrentPosition](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation/getCurrentPosition) · [overscroll-behavior](https://developer.mozilla.org/en-US/docs/Web/CSS/overscroll-behavior) · [onLine](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/onLine) / WebKit [Safari 26.0](https://webkit.org/blog/17333/webkit-features-in-safari-26-0/) · [Safari 16.4](https://webkit.org/blog/13966/webkit-features-in-safari-16-4/) · [Web Push iOS](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/) · [ITP 7-day](https://webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/) · [Bug 181849](https://bugs.webkit.org/show_bug.cgi?id=181849) · [Bug 272325](https://bugs.webkit.org/show_bug.cgi?id=272325) / [OSM Tile Usage Policy](https://operations.osmfoundation.org/policies/tiles/) · [CARTO Basemaps Terms](https://carto.com/legal/basemap-terms/) · [CARTO Basemaps FAQ](https://docs.carto.com/faqs/carto-basemaps) / [Next.js Discussion #64336](https://github.com/vercel/next.js/discussions/64336) · [Serwist defaultCache](https://raw.githubusercontent.com/serwist/serwist/main/packages/next/src/index.worker.ts) · [caniuse Background Sync](https://caniuse.com/background-sync) · [CSS-Tricks 16px iOS zoom](https://css-tricks.com/16px-or-larger-text-prevents-ios-form-zoom/)

### 3.5 보안 · 인증 · 개인정보 (OWASP · NIST · Supabase · Next.js · GDPR/PIPA)

| 항목 | 규칙·수치 | 현재 | 조치·우선순위 |
|---|---|---|---|
| OWASP Top 10:2025 | A01 접근제어(RLS·소유권·레이트리밋), A02 설정(헤더·CSP), A03 공급망(의존성·Actions 핀), A07 인증(비번정책·열거방지), A09 로깅, A10 예외처리 | 6축 대부분 커버 | 점검표 프레임으로 채택 |
| 보안 헤더 | OWASP 권장값 세트. `X-Frame-Options`는 CSP `frame-ancestors`로 대체됨. `X-Powered-By` 제거, `X-XSS-Protection` 폐기, COOP `same-origin` | 세트 ✅, HSTS `preload` 없음, COOP 없음 | `poweredByHeader: false`, HSTS `preload`(hstspreload.org 등록 시), COOP Report-Only 검증 (P2) |
| CSP | strict CSP = nonce + `'strict-dynamic'`; Next.js는 nonce 시 동적 렌더링 필요, **PPR과 비호환**. Report-Only 롤아웃 | `'unsafe-inline'` 강제 적용 + 위반 수집 ✅ | 정적 페이지 많으면 현 방식 유지, 로그인/계정 페이지만 nonce 검토 (P2) |
| CSRF | 상태 변경은 POST, `Sec-Fetch-Site: cross-site` 거부, Origin 정확 일치(접미 우회 주의), SameSite는 보조. Server Actions는 Origin/Host 자동 비교 | delete same-origin 가드 ✅ | `Sec-Fetch-Site` 검사 추가, Origin 없으면 거부 (P1) |
| 오픈 리다이렉트 | `next`/`redirect_to`는 `/`로 시작·`//`·`\`·`http` 거부 allowlist. Supabase Redirect URLs에 `**` 남용 금지 | `/auth/callback` 방어 ✅ | 프리뷰 와일드카드 범위 확인 (P2) |
| 입력 검증 | 서버측 allowlist, 이메일 254/63자, 자유 텍스트 NFC 정규화·길이 상한, jsonb `profiles` 스키마·크기 check 제약 | — | 리뷰·피드백·리스트 이름·client_errors 길이 상한 (P1) |
| 로깅 | 비번·세션ID·토큰·DB 접속문자열 금지, 이메일·경로는 "고려", CR/LF 제거, 인증 실패는 반드시 기록 | 마스킹 미검출 ❌ | P0 #9 |
| XS-Leaks | 민감 응답 `no-store`, `Sec-Fetch-Dest: iframe` 거부, CORP `same-site` | export `no-store` ✅ | `/api/account/*` 전부 통일 (P2) |
| **NIST 800-63B-4 (2025-08)** | 단일요소 15자·MFA 8자 최소, ≥64자 허용, 조합규칙·주기변경 금지, 유출 비번 블록리스트, 표시 옵션, 붙여넣기 허용, 100회 연속 실패 제한 | `minLength={6}` ❌ | P0 #5 |
| Supabase 비밀번호 | 8자 미만 비권장, Leaked password protection은 **Pro**, bcrypt 72바이트 상한(멀티바이트 사용자 안내) | — | 대시보드 정책 동기화 |
| 열거 방지 | 로그인/가입/재설정 메시지·응답시간 통일, 계정 잠금 금지, 재설정 후 자동 로그인 금지, 변경 알림 | 비번찾기 앤티-열거 ✅ | 가입 시 기존 이메일 응답 차이 실측 (P1) |
| 레이트리밋 | Supabase 기본: 이메일 2통/시간(내장 SMTP), 가입/로그인 30회/5분, 토큰 150회/5분. Vercel WAF는 Hobby 1규칙 | Supabase 기본 의존 | `/api/account/*`·인증 경로 WAF 규칙 1개 (P1) |
| CAPTCHA/Bot | Supabase Turnstile/hCaptcha(`captchaToken`), Vercel BotID Basic 무료. web.dev "필요할 때만" | 없음 | Turnstile 관리형(보이지 않는) 모드 (P1) |
| 세션 | 액세스 토큰 1시간(5분 미만 금지), 리프레시 1회용(재사용 창 10초), Inactivity/Time-box는 Pro. 로그아웃 시 서버 무효화 + 로컬 미러 정리 | 미러 퍼지 ✅ | `Clear-Site-Data` 검토 (P2) |
| 서버 검증 | `getSession()` 서버 신뢰 금지 → `getUser()`(매 호출 네트워크) 또는 `getClaims()`(서명 검증, 비대칭 키면 로컬). Next 16은 `middleware.ts→proxy.ts` | `getUser()` ✅ | JWT Signing Keys 전환 시 `getClaims()`로 지연 감소 (P2) |
| PKCE | 코드 5분·1회·**같은 브라우저** — 관광객이 호텔 PC로 메일 링크 열면 실패 | callback 원인별 에러 ✅ | OTP 코드 입력(`verifyOtp`) 병행 검토 (P2) |
| 커스텀 SMTP | 내장 SMTP는 2통/시간·승인 주소만·best-effort → 실가입 차단 위험. SPF/DKIM/DMARC | HANDOFF: 도메인 선행 필요(보류) | 도메인 구매 → Resend 등 → 템플릿 교체 (P1, 기존 백로그) |
| 재인증 | 계정 삭제·이메일 변경 전 최근 인증 요구, 완료 메일 통지 | 확인 모달 ✅ | 최근 로그인 5분 게이트 (P2) |
| 익명 로그인 | localStorage 게스트 대안. `is_anonymous` RLS 분기, CAPTCHA 필수, 30일 수동 정리 | 현 구조가 데이터 최소화에 유리 | 기기 간 동기화 없이 서버 저장 필요할 때만 |
| Next.js CVE-2025-29927 | `x-middleware-subrequest` 미들웨어 우회. 15.2.3+ 패치. 미들웨어 단독 인가 금지 | 15.5 ✅, 미들웨어는 세션 갱신만 ✅ | Dependabot/Renovate (P1) |
| 데이터 보안 | DAL `server-only`, 최소 DTO, `process.env`는 DAL만, `[param]`은 사용자 입력(uuid/slug 검증), `route.ts`·`proxy.ts` 집중 감사 | — | `NEXT_PUBLIC_` 비밀 grep, 공유 리스트 uuid 검증 (P1) |
| RLS | 모든 정책 `to authenticated using ((select auth.uid()) = user_id)`, 정책 컬럼 인덱스, `user_metadata` 참조 금지, 뷰는 `security_invoker` 또는 PII 미노출 definer. Security Advisor 0건 | RLS ✅, 마스킹 뷰 ✅ | Advisor 경고 확인, FK `on delete cascade` 전수 (P1) |
| GDPR 적용 | Art.3(2): EU 거주자 대상 서비스면 적용. 근거: 계정·즐겨찾기=계약, 에러 리포팅=정당한 이익, 분석=동의. 권리 8종, 침해 72시간 | export/delete ✅ | 처리방침 P0 #8 |
| 쿠키 동의 | 필수 쿠키 면제(목록 설명), 분석·마케팅은 사전 opt-in, 거부해도 서비스 이용 가능 | 필수만 ✅ | 분석 도입 시 EU opt-in 배너 |
| PIPA | Art.15 동의 고지 4항목, Art.22 항목별 분리 동의, Art.21 즉시 파기, Art.28-8 국외이전(수탁자·국가·목적·항목·기간·거부권), 72시간 통지, **2026-09-11 개정 시행** | — | 가입 동의 필수/선택 분리, 처리방침 표 (P0 #8) |
| Google OAuth 검증 | 기본 스코프(openid email profile)만이면 제한 없음. 이름/로고 노출은 브랜드 검증(정책 페이지가 같은 도메인·홈 링크·Search Console) | Google ✅ | 도메인 확정 후 브랜드 검증 |
| Sign in with Apple | App Store 앱(4.8)에만 해당, 웹은 불필요 | 버튼 "준비 중" | 래퍼 앱 배포 시에만 |
| 위치정보 | W3C: 필요할 때만·작업에만·즉시 폐기·고지. 좌표를 서버·client_errors·분석·URL에 저장/전송 금지 | 클라이언트 거리 계산 ✅ | 처리방침에 "브라우저 내에서만 사용" 명시, 리포터 좌표 제외 확인 |

출처: OWASP [Top 10:2025](https://top10.owasp.org/2025) · [HTTP Headers CS](https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html) · [CSP CS](https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html) · [CSRF CS](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html) · [Redirects CS](https://cheatsheetseries.owasp.org/cheatsheets/Unvalidated_Redirects_and_Forwards_Cheat_Sheet.html) · [Input Validation CS](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html) · [Logging CS](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html) · [Authentication CS](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html) · [Forgot Password CS](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html) · [Session Management CS](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html) · [XS-Leaks CS](https://cheatsheetseries.owasp.org/cheatsheets/XS_Leaks_Cheat_Sheet.html) / [NIST SP 800-63B-4](https://pages.nist.gov/800-63-4/sp800-63b.html) / Supabase [Password security](https://supabase.com/docs/guides/auth/password-security) · [Rate limits](https://supabase.com/docs/guides/auth/rate-limits) · [Captcha](https://supabase.com/docs/guides/auth/auth-captcha) · [Sessions](https://supabase.com/docs/guides/auth/sessions) · [SSR Next.js](https://supabase.com/docs/guides/auth/server-side/nextjs) · [PKCE](https://supabase.com/docs/guides/auth/sessions/pkce-flow) · [Custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp) · [Anonymous sign-ins](https://supabase.com/docs/guides/auth/auth-anonymous) · [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security) · [Database Advisors](https://supabase.com/docs/guides/database/database-advisors) · [Production checklist](https://supabase.com/docs/guides/deployment/going-into-prod) · [deleteUser](https://supabase.com/docs/reference/javascript/auth-admin-deleteuser) / Next.js [Data security](https://nextjs.org/docs/app/guides/data-security) · [CSP guide](https://nextjs.org/docs/app/guides/content-security-policy) · [Vercel CVE-2025-29927 postmortem](https://vercel.com/blog/postmortem-on-next-js-middleware-bypass) · [Vercel WAF rate limiting](https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting) · [BotID](https://vercel.com/docs/botid) / web.dev [Sign-in form](https://web.dev/articles/sign-in-form-best-practices) · [Sign-up form](https://web.dev/articles/sign-up-form-best-practices) · [Passkeys](https://web.dev/articles/passkey-registration) / [gdpr.eu](https://gdpr.eu/what-is-gdpr/) · [GDPR Art.3](https://gdpr-info.eu/art-3-gdpr/) · [Privacy notice](https://gdpr.eu/privacy-notice/) · [Cookies](https://gdpr.eu/cookies/) · [PIPA (KLRI 영문)](https://elaw.klri.re.kr/eng_mobile/viewer.do?hseq=62389&type=part&key=4) · [DLA Piper Korea](https://www.dlapiperdataprotection.com/index.html?t=law&c=KR) · [PIPC](https://www.pipc.go.kr/eng/) / Google [OAuth verification](https://support.google.com/cloud/answer/13464321) · [App audience](https://support.google.com/cloud/answer/15549945) / [Apple App Review 4.8](https://developer.apple.com/app-store/review/guidelines/) / [W3C Geolocation](https://www.w3.org/TR/geolocation/) · [MDN Permissions-Policy geolocation](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Permissions-Policy/geolocation)

### 3.6 i18n · SEO · 공유 · 커뮤니티 출시 교훈 (W3C i18n · MDN Intl · Next.js · Google Search Central · HN/Front-End-Checklist)

| 항목 | 규칙·수치 | 현재 | 조치·우선순위 |
|---|---|---|---|
| `<html lang>` | 항상, 로케일마다 다르게. `meta Content-Language`는 사용 금지 | `lang="en"` 하드코딩 | `[locale]` 세그먼트 도입 시 `<html lang={locale}>` (P1) |
| 인라인 `lang="ko"` | 다른 언어 구간은 감싸기. 로케일이 ja/zh가 되면 영어 표시명에도 `lang="en"` 필요 | 6곳 ✅ | 택시 카드·즐겨찾기·OG alt 확인 (P1) |
| 언어 협상 | "항상, 그러나 단독은 아님" — Accept-Language 제안 + 스위처 상시 + 선택 고정(쿠키/URL). **Google: 자동 리다이렉트 금지**, Googlebot은 미국발 | localization-operations-plan.md 계획 일치 ✅ | 첫 방문 배너("日本語で見る?")로 대체, 접두어 없는 루트에만 리다이렉트 (P1) |
| 번역 확장률 | 10자 이하 영문 200–300%, 11–20자 180–200%. CJK는 가로 공간↑, Thai는 줄간격↑ | 탭·칩·버튼 라벨 | 고정 width 금지, 2줄 허용/아이콘 폴백 (P1) |
| 한국어 줄바꿈 | `word-break: keep-all` + `overflow-wrap: anywhere`; ja/zh 본문에는 `keep-all` 쓰지 말 것(`html[lang^="ko"]` 한정) | keep-all 3곳 ✅ | 셀렉터 범위 확인 (P2) |
| 언어 태그 | 가능한 짧게. 중국어는 스크립트 서브태그 `zh-Hans`/`zh-Hant` (URL은 `/zh-CN`·`/zh-TW` 써도 hreflang·lang은 매핑) | 계획 `/zh-CN` `/zh-TW` | 매핑 테이블 (P1) |
| `dir="auto"` | 대상 로케일 전부 LTR → 문서 `dir` 불필요, 리뷰 `textarea`·렌더에는 `dir="auto"` | — | (P2) |
| 이름 필드 | "first/last" 라벨 금지, 한·일·중은 성이 먼저 → 단일 "Display name" | 단일 이름 ✅ | 유지 |
| `Intl.Segmenter` | 공백 없는 언어(ja/zh/th) 단어 분할·문장 요약·글자 수(grapheme). Baseline 2024-04 | — | 리뷰 요약·검색 토크나이즈 (P2) |
| `Intl.DisplayNames` | 스위처 라벨을 자국어로(`of("zh")→"中文"`) | — | (P1) |
| next-intl | 감지 순서 URL→쿠키(`NEXT_LOCALE`, 세션 쿠키=GDPR)→Accept-Language→default. `localePrefix:'as-needed'`로 영어 URL 보존 + 자동 hreflang `Link` 헤더. `setRequestLocale` 미호출 시 전 페이지 동적 렌더링 함정. Supabase 미들웨어와 체이닝 | 미도입 | 계획 문서와 정합 (P1) |
| CJK 웹폰트 | Google Fonts Noto Sans KR/JP는 `unicode-range` **124조각**, Thai 3조각 → `next/font`가 슬라이스 그대로 셀프호스팅, 페이지당 3–6조각만 다운로드. 로케일별 루트 레이아웃에서만 로드, CJK `preload:false` | 한글은 시스템 폰트 ✅ | 로케일 도입 시 (P1) |
| OG 폰트 | `ImageResponse` `fonts:[]`에 로컬 바이너리 주입 — 현재 라틴 전용 Michroma라 한글/일본어 제목은 tofu | ❌ | P0 #1과 함께 |
| KRW 서식 | ISO 4217 KRW 소수 0자리. `Intl.NumberFormat(locale,{style:'currency',currency:'KRW',currencyDisplay:'narrowSymbol'})` | `NumberFormat("ko-KR")` 순수 숫자, 하드코딩 `₩45,000` 잔존 | 통화 스타일 + 로케일 인자화 (P1) |
| 영업시간 시간대 | `timeZone:'Asia/Seoul'` 고정(출국 전 집에서 보는 사용자), 12/24h는 로케일에 맡김, 사용자 TZ≠Seoul이면 "KST" 병기 | — | (P0 — 영업 상태 배지 정확성) |
| 거리·단위 | `style:'unit', unit:'meter'|'kilometer'|'minute'` — 한국은 미터법 유지, 표기만 로케일화 | 문자열 조립 | (P2) |
| 도로명주소 | 한국어 원문 크게 + 로마자 보조. 로마자는 자체 변환 금지(발음 동화 미반영 규칙) → juso.go.kr 영문 주소 필드 저장. 5자리 우편번호, `-daero/-ro/-gil` | address(한글) ✅ | 영문 주소 필드 파이프라인 (P2) |
| 전화번호 | E.164(`+82…`, ≤15자리) 저장, 국제 형식 표시 + `tel:` — 로밍/현지 유심 혼재 | 실전화 제거됨(감사 대응) | 데이터 원장 도입 시 |
| hreflang | 3방식(link/HTTP Link/sitemap `xhtml:link`), **상호 링크 필수**, `x-default`, 절대 URL. Google은 `lang`으로 언어 판별 안 함 | 없음 | 로케일 도입 시 `generateMetadata.alternates.languages` + sitemap alternates 단일 헬퍼 (P1) |
| canonical | 같은 언어끼리, 절대 경로, JS로 변경 금지. 신호 강도 리다이렉트 > canonical > 사이트맵 | `metadataBase` ✅ | 공유 URL 쿼리 정리 (P2) |
| 한글 ID URL | 비ASCII는 percent-encoding, 하이픈 권장. 사이트맵 50k URL/50MB, UTF-8, `priority/changefreq` 무시, `lastmod`는 정확할 때만 | `encodeURIComponent` ✅ | 장기적으로 로마자 slug + 301 (P2) |
| 장소 페이지 메타 | 고유 title/description, 없는 ID는 진짜 404 | `notFound()` ✅, 메타 ❌ | P0 #1 |
| 구조화 데이터 | JSON-LD, 가장 구체적 하위 타입(`HairSalon`/`Store`/`MedicalClinic`/`TouristAttraction`), `address` 로마자·`geo` 소수 5자리·`telephone` E.164·`priceRange`. **`aggregateRating`은 타 업체 리뷰 사이트만**, 페이지에 실제 보이는 리뷰만, 편집자 산정 금지 | 없음 | P0 #1. 큐레이션 44곳 합성 평점은 넣지 말 것(감사 대응과 일치) |
| 모바일 우선 인덱싱 | 상호작용 후 지연 로드된 주요 콘텐츠는 색인 안 됨 → 리뷰·영업시간은 초기 HTML. SSR 유지 | 서버 컴포넌트 상세 ✅ | 아코디언·탭 내용 초기 HTML 포함 확인 (P1) |
| OG 카드 | 필수 `og:title/type/image/url`, 1200×630(1.91:1), `og:image:width/height/alt`, `og:locale` + `og:locale:alternate`, 8MB 이하. 카카오톡·LINE 공유 → 초기 HTML | 루트 ✅ | 장소별·리스트별 OG (P0 #1) |
| CWV & 검색 | LCP 2.5s/INP 200ms/CLS 0.1, "핵심 랭킹 시스템이 보상". Search Console CWV 리포트 모니터링 | 랩만 | P0 #7 |
| **HN 2026 출시 점검** | "사용자는 자기 데이터만", 엔드포인트 파괴적 재활용 불가, 로그에 시크릿 금지, 인증 레이트리밋; 원글: 보안 헤더 부재·프라이버시 페이지 약함·모바일 경험·접근성·**"SEO 메타데이터를 마지막에 남겨둠"**·클라이언트 번들에 구현 노출 | RLS ✅, 헤더 ✅, SEO 메타 ❌ | P0 #1·#9 |
| HN 2017 고-라이브(274pt) | HTTPS/HSTS, securityheaders.io·SSL Labs, hstspreload, 죽은 링크 크롤, 프로덕션 키, Lighthouse, axe, SPF/DKIM/DMARC, 자동화 후에도 수동 확인 | 대부분 ✅ | 3,600 URL 링크 크롤 1회, axe CI |
| Front-End-Checklist(74k★) | doctype·UTF-8·viewport·라벨·키보드(Critical), `lang` BCP 47, **페이지 무게 <1500KB(이상 500KB)**, 대비, favicon(High/Medium) | 대부분 ✅ | `/map` 예산 별도, 나머지 500KB |
| 12-Factor | 의존성 명시(lockfile+`npm ci`), 설정은 환경, dev/prod 동일성(preview/prod Supabase 분리), 로그는 이벤트 스트림 | `^15.5.23` + lockfile ✅ | preview용 Supabase 분리 검토 (P2) |
| 실전 반복 교훈 | **분석은 사용자 0명일 때**, 에러 추적+중복 억제, 업타임, 백업+**복구 리허설**, 프로덕션 새 계정으로 크리티컬 패스(가입→재설정 메일→리뷰→공유), **실기기 테스트**, 정책 페이지, 문의 채널, 인증은 직접 만들지 않기(Supabase ✅) | client_errors ✅, uptime ✅, E2E ✅, 분석 ❌, 백업 리허설 ⚠️ | 분석(언어·국가·길찾기 앱 선택 비율) + Supabase PITR 복구 리허설 (P1) |
| 도구 합의 2025 | SO 2025: Node 48.7%·React 44.7%·Next 20.8%·PostgreSQL 55.6%(1위)·Vercel 10.6%. State of JS 2025: Next 만족 68→55%(최대 하락), Playwright 만족 94%, 고충 2위 "Dates" → `Intl`/`Temporal` | Next+Supabase+Vercel+Playwright ✅ | 날짜는 라이브러리 대신 `Intl` |

출처: W3C i18n [Declaring language](https://www.w3.org/International/questions/qa-html-language-declarations) · [Language negotiation](https://www.w3.org/International/questions/qa-when-lang-neg) · [Text size in translation](https://www.w3.org/International/articles/article-text-size) · [Choosing a language tag](https://www.w3.org/International/questions/qa-choosing-language-tags) · [Personal names](https://www.w3.org/International/questions/qa-personal-names) · [KLREQ](https://www.w3.org/TR/klreq/) / MDN [word-break](https://developer.mozilla.org/en-US/docs/Web/CSS/word-break) · [Intl.Segmenter](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/Segmenter) · [Intl.DisplayNames](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DisplayNames) · [Intl.NumberFormat](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/NumberFormat/NumberFormat) · [Intl.DateTimeFormat](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat/DateTimeFormat) · [unicode-range](https://developer.mozilla.org/en-US/docs/Web/CSS/@font-face/unicode-range) / Next.js [Internationalization](https://nextjs.org/docs/app/guides/internationalization) · [generateMetadata](https://nextjs.org/docs/app/api-reference/functions/generate-metadata) · [sitemap.xml](https://nextjs.org/docs/app/api-reference/file-conventions/metadata/sitemap) · [opengraph-image](https://nextjs.org/docs/app/api-reference/file-conventions/metadata/opengraph-image) / next-intl [Routing](https://next-intl.dev/docs/routing/configuration) · [Middleware](https://next-intl.dev/docs/routing/middleware) / Google Search Central [Localized versions](https://developers.google.com/search/docs/specialty/international/localized-versions) · [Multi-regional sites](https://developers.google.com/search/docs/specialty/international/managing-multi-regional-sites) · [Canonical](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls) · [URL structure](https://developers.google.com/search/docs/crawling-indexing/url-structure) · [Sitemaps](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap) · [JavaScript SEO](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics) · [Mobile-first indexing](https://developers.google.com/search/docs/crawling-indexing/mobile/mobile-sites-mobile-first-indexing) · [LocalBusiness](https://developers.google.com/search/docs/appearance/structured-data/local-business) · [Review snippet](https://developers.google.com/search/docs/appearance/structured-data/review-snippet) · [CWV and Search](https://developers.google.com/search/docs/appearance/core-web-vitals) / [ogp.me](https://ogp.me/) · [Meta link images](https://developers.facebook.com/docs/sharing/webmasters/images/) / [국립국어원 로마자 표기법](https://www.korean.go.kr/front_eng/roman/roman_01.do) · [Twilio E.164](https://www.twilio.com/docs/glossary/what-e164) · [ISO 4217 list](https://www.six-group.com/dam/download/financial-information/data-center/iso-currrency/lists/list-one.xml) / HN [2026 launch checks](https://news.ycombinator.com/item?id=47937333) · [2017 go-live checklist](https://news.ycombinator.com/item?id=14958394) · [2011 launch checklist](https://news.ycombinator.com/item?id=2883651) · [2024 build/deploy/maintain](https://news.ycombinator.com/item?id=40521013) · [Front-End-Checklist](https://github.com/thedaviddias/Front-End-Checklist) · [12factor.net](https://12factor.net/) · [SO Survey 2025](https://survey.stackoverflow.co/2025/technology) · [State of JS 2025](https://2025.stateofjs.com/en-US/libraries/)

---

## 4. 2025–2026에 바뀐 것 (프로젝트에 영향 있는 것만)

| 영역 | 변화 | 영향 |
|---|---|---|
| Core Web Vitals | INP가 FID 대체(2024-03), CrUX FID 제거(2024-09). 기준값 LCP 2.5s/INP 200ms/CLS 0.1 **변경 없음**. `scheduler.yield()` Chrome 129+/Firefox 142+(Safari 미지원) | 마커 탭·필터 INP 계측 필요 |
| Next.js 15 (2024-10) | `fetch`·GET Route Handler·라우터 캐시 기본 비캐시, 비동기 `params/cookies`, `ssr:false`는 클라이언트 컴포넌트에서만 | 현재 버전. 장소 JSON Route Handler는 `force-static` 명시 필요 |
| Next.js 16 (2025-10) | Cache Components(`'use cache'`/`cacheLife`), Turbopack 기본, React Compiler 안정, **`middleware.ts → proxy.ts`**, `next/image` `priority→preload`·`qualities [75]`, Node 20.9+/Safari 16.4+ | 업그레이드 시 미들웨어 리네임·이미지 옵션 점검 |
| WCAG 2.2 (2023-10) | 9개 신규 기준(Target Size 24px, Focus Not Obscured, Dragging Movements, Redundant Entry, Accessible Authentication…), 4.1.1 삭제 | §3.3 상단 6항목 |
| OWASP Top 10:2025 | A03 Software Supply Chain, A10 Mishandling of Exceptional Conditions 신설 | 의존성 자동 업데이트, 예외 시 정보 노출 점검 |
| NIST SP 800-63B-4 (2025-08 최종) | 단일요소 비밀번호 최소 15자, 조합 규칙·주기 변경 금지 명문화 | 비밀번호 정책 P0 #5 |
| Next.js CVE-2025-29927 (2025-03) | 미들웨어 우회. 15.2.3+ 패치. Vercel 호스팅은 비취약 | 미들웨어 단독 인가 금지 원칙 유지 |
| iOS 26 / Safari 26 (2025 가을) | 홈 화면 추가 시 기본 "Open as Web App", 설치 요건 0. iOS 18.4 Declarative Web Push | iOS 설치 안내 갱신 |
| CARTO Basemaps Terms (2026-08-26) | API 키 필수, 월 500만 요청, 클라이언트 캐시 30일 상한, 서버 프록시 금지 | P0 #6 |
| 한국 PIPA 개정 (2026-03 공포, 2026-09-11 시행) | 특정 위반 과징금 매출 10%, 국외이전 규정 정비(EU/EEA 적정성 결정 2025-09) | 처리방침·동의 화면 P0 #8 |
| Vercel | Fluid compute 신규 기본(2025-04), Speed Insights 무료=RES만/Plus $10, 이미지 최적화 과금 변환 단위, React Best Practices 70규칙(2026-01) | 측정·이미지 비용 설계 |
| HTTP Archive 2025 | 모바일 페이지 8.4% 증가, TBT 중앙값 1,916ms(+58%), CWV 전부 통과 48% | 현 TBT 380ms는 우수 — 유지가 과제 |
| Google Fonts | Noto Sans KR/JP 124조각 슬라이스(`unicode-range`) | CJK 로케일 폰트 비용은 `next/font`로 흡수 가능 |

---

## 5. 권장 실행 순서 (제안)

1. **P0 배치 A — 코드 1일**: 장소 `generateMetadata` + OG + JSON-LD(#1) · `next/font` 전환(#2) · 위치 요청을 제스처로(#3) · 비밀번호 최소 길이(#5) · 에러 리포터 마스킹(#9) · CARTO 키(#6, 계정 발급 필요)
2. **P0 배치 B — 계측·문서**: `useReportWebVitals` RUM(#7) · 개인정보처리방침 표 갱신 + 가입 동의 분리(#8) · 오렌지 텍스트 토큰 분리(#10)
3. **P1 — 다음 스프린트**: 장소 데이터 번들 분리(#4) · 접근성 4스펙(axe) + 시트 모달/비모달 정리 + 결과 수 `role=status` · SW 업데이트 토스트/navigation preload · ITP 7일 대비 게스트 넛지 · 필터 "Show N" + 적용 칩 · 분석 도구(+EU 배너) · Turnstile · WAF 1규칙 · Supabase Advisor 0건
4. **P1 — i18n 착수 시**: `[locale]`+next-intl(as-needed)·hreflang·`Intl` 서식·CJK `next/font`·OG 폰트 주입 — `docs/localization-operations-plan.md`와 병합
5. **P2**: 클러스터링·CircleMarker 오버뷰·`Intl.Segmenter`·로마자 slug·익명 로그인 검토·COOP·nonce CSP

---

## 6. 원문 리포트 (전체 근거·인용문·URL·미수집 출처 고지)

- `docs/research/raw/01-performance.md` — Core Web Vitals·Next.js/React·Leaflet·네트워크·측정 (5장 22항목)
- `docs/research/raw/02-mobile-ux.md` — NN/g·Apple HIG·Material 3·Baymard·지도 UX (7장 30항목 + 체크리스트 10)
- `docs/research/raw/03-accessibility.md` — WCAG 2.2·APG·지도 접근성·폼·도구 (6장 25항목 + 체크리스트 10)
- `docs/research/raw/04-pwa-offline-ios.md` — 설치성·SW·타일 정책·iOS/Android 함정·오프라인·위치 (7장 30항목 + 체크리스트 12)
- `docs/research/raw/05-security-privacy.md` — OWASP·NIST·Supabase·Next.js·GDPR/PIPA·위치 (7장 33항목 + 체크리스트 12)
- `docs/research/raw/06-i18n-seo-community.md` — W3C i18n·Intl·next-intl·Search Central·OG·HN/체크리스트 (5장 38항목 + 체크리스트 15)

> 참고: 이 저장소의 `.gitignore`는 `/docs/*`를 기본 무시하고 화이트리스트로 추적합니다. 이 문서를 커밋하려면 `!/docs/research/`·`!/docs/research/**` 예외를 추가해야 합니다.
