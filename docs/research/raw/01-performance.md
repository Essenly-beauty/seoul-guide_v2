# MYSEOULDROP 웹 성능 리서치 리포트 (Next.js 15/16 · React 19 · Vercel · Leaflet)

리서치 기준일: 2026-09-20. 아래 항목은 모두 실제로 페이지를 가져와 확인한 내용이며, 각 출처에 페이지 게시/갱신일을 표기했습니다. (가져오지 못한 페이지: HTTP Archive Web Almanac 2025 JavaScript 챕터 — 404, 2025년판에는 JS 챕터가 없고 Page Weight/Performance 챕터로 대체됨.)

> 프로젝트 요약 재확인: Lighthouse 모바일 81 (LCP 2.5s, TBT 380ms), 뷰포트 마커 컬링 + SSR 정적 지도 스냅샷 적용 완료, 남은 이슈는 ~600개 장소 데이터가 정적 TS 모듈로 First Load JS에 포함되는 것. 사용자는 로밍/외국 SIM의 iOS Safari·Android Chrome.

---

## A. Core Web Vitals 기준

### A1. 현재 CWV 기준값과 p75 규칙 — LCP ≤ 2.5s, INP ≤ 200ms, CLS ≤ 0.1
- **왜 중요한가**: web.dev는 세 지표를 "모바일/데스크톱으로 분리한 페이지 로드의 75번째 백분위"로 평가하며, LCP 2.5s(Needs Improvement 2.5–4.0s, Poor >4.0s), INP 200ms(201–500ms / >500ms), CLS 0.1이 "Good" 경계입니다. 2026년 9월 현재 web.dev LCP 문서(2025-09-04 갱신)와 CrUX 릴리스 노트(2026-09-08까지 확인)에 기준 변경 언급이 없습니다. 검색에 뜨는 "2026년 LCP 2.0s로 하향" 류의 SEO 블로그 주장은 1차 출처에서 확인되지 않습니다.
- **MYSEOULDROP 적용**: 현재 LCP 2.5s는 Lighthouse(랩) 값으로 "Good" 경계선에 걸쳐 있으므로, 필드(p75) 기준으로는 로밍 환경 사용자가 다수 Poor에 빠질 가능성이 큽니다. 목표를 랩 기준 LCP ≤ 1.8s 정도로 잡아 필드 p75가 2.5s 안에 들도록 여유를 확보하는 것이 안전합니다.
- 출처: Google web.dev — "Web Vitals" — https://web.dev/articles/vitals — (2024-10-31 갱신); Google web.dev — "Largest Contentful Paint (LCP)" — https://web.dev/articles/lcp — (2025-09-04 갱신); Google web.dev — "Interaction to Next Paint (INP)" — https://web.dev/articles/inp — (2025-09-02 갱신)

### A2. LCP 하위 구간 예산: TTFB ~40% / 리소스 로드 지연 <10% / 로드 시간 ~40% / 렌더 지연 <10%
- **왜 중요한가**: web.dev "Optimize LCP"는 LCP를 4개 하위 구간으로 나누고 "지연(delay)" 구간을 거의 0에 가깝게 만들라고 권고합니다. 핵심: LCP 리소스가 초기 HTML에서 preload scanner에 발견되게 할 것, LCP 이미지에 `fetchpriority="high"`, CSS/JS에서만 참조되는 리소스는 `<link rel="preload">`, **LCP 이미지에 `loading="lazy"` 금지**, 렌더 차단 CSS/동기 스크립트 줄이기, 리다이렉트·캐시를 깨는 고유 URL 파라미터 피하기.
- **MYSEOULDROP 적용**: SSR 정적 지도 스냅샷이 LCP 요소일 가능성이 높으므로 (1) 초기 HTML의 `<img>`로 존재하고 `next/image`의 `preload`(Next 16; 15에서는 `priority`) 또는 `fetchPriority="high"`가 붙어 있는지, (2) `sizes="100vw"`로 모바일 폭에 맞는 srcset 후보가 선택되는지, (3) 스냅샷 URL이 쿼리 파라미터 없이 CDN 캐시 가능한지 확인하세요. 지도 클라이언트 번들(react-leaflet + 장소 데이터)이 렌더 지연 구간을 늘리지 않도록 스냅샷은 지도 JS와 독립적으로 페인트되어야 합니다.
- 출처: Google web.dev — "Optimize Largest Contentful Paint" — https://web.dev/articles/optimize-lcp — (2025-03-31); Google web.dev — "Resource hints" (Learn Performance) — https://web.dev/learn/performance/resource-hints — (2023-11-01)

### A3. INP: 탭/클릭/키 입력만 측정, 스크롤·핀치줌은 제외 — 50ms 롱태스크 분할과 `scheduler.yield()`
- **왜 중요한가**: INP는 페이지 생애 전체의 클릭·탭·키보드 상호작용 중 최악값(50회당 1건 이상치 제외)의 p75이며, 스크롤·호버·줌은 포함되지 않습니다. 세 구간(입력 지연 / 처리 시간 / 표시 지연) 모두를 줄여야 하고, 50ms 초과 작업이 롱태스크입니다. 권장 분할 API는 `scheduler.yield()`(Chrome/Edge 129+, Firefox 142+, **Safari 미지원** → `setTimeout` 폴백 필요), `isInputPending()`은 더 이상 권장하지 않습니다. 큰 DOM은 표시 지연을 키우므로 `content-visibility`로 오프스크린 렌더를 미루라고 권고합니다.
- **MYSEOULDROP 적용**: 지도 팬/줌은 INP에 안 잡히지만 **마커 탭 → 바텀시트/상세 열기, 카테고리 필터 탭, 검색 입력**은 잡힙니다. 마커 탭 핸들러에서 무거운 계산(경로 탐색, 목록 재정렬)을 동기 실행하지 말고 `startTransition`/`useDeferredValue`로 비긴급 처리, 장소 목록에 `content-visibility: auto` 적용, 롱태스크는 `globalThis.scheduler?.yield ?? setTimeout` 래퍼로 분할하세요(iOS Safari 폴백 필수).
- 출처: Google web.dev — "Interaction to Next Paint (INP)" — https://web.dev/articles/inp — (2025-09-02); Google web.dev — "Optimize Interaction to Next Paint" — https://web.dev/articles/optimize-inp — (2025-09-02); Google web.dev — "Optimize long tasks" — https://web.dev/articles/optimize-long-tasks — (2024-12-19); Vercel — "First Input Delay (FID) vs. Interaction to Next Paint (INP)" — https://vercel.com/kb/guide/first-input-delay-vs-interaction-to-next-paint — (2023-09-26)

### A4. CLS: 미디어에 width/height·aspect-ratio, 동적 콘텐츠 공간 예약, 폰트는 `font-display: optional` + 메트릭 매칭
- **왜 중요한가**: web.dev "Optimize CLS"는 이미지/임베드에 크기 속성 또는 `aspect-ratio`, 늦게 오는 콘텐츠에 `min-height` 예약, 웹폰트에는 `font-display: optional`과 폴백 지정, 애니메이션은 `transform` 사용을 권고하며 CLS 0.1 이하(p75)를 목표로 합니다. Vercel KB(2026-08-18)는 폰트 폴백에 `size-adjust`/`ascent-override`/`descent-override`/`line-gap-override`를 맞추고, 반응형 컴포넌트는 hydration 차이를 피하기 위해 순수 CSS `@media`로 처리하라고 덧붙입니다.
- **MYSEOULDROP 적용**: 지도 컨테이너와 바텀시트에 고정 높이/`aspect-ratio`를 주고, SSR 스냅샷 → Leaflet 마운트 전환 시 동일한 박스 크기를 유지하세요. 로그인 상태(Supabase)에 따라 헤더가 바뀌면 상단이 밀리므로 스켈레톤으로 높이를 고정하세요.
- 출처: Google web.dev — "Optimize Cumulative Layout Shift" — https://web.dev/articles/optimize-cls — (2025-02-07); Vercel — "How to improve Core Web Vitals" — https://vercel.com/kb/guide/how-to-improve-core-web-vitals — (2026-08-18)

### A5. bfcache 적격성 유지 — `unload` 금지, HTML에 `Cache-Control: no-store` 금지, `pagehide`에서 연결 정리
- **왜 중요한가**: bfcache는 뒤로/앞으로 이동을 즉시 복원해 LCP/CLS/INP 필드 데이터를 개선합니다(복원 시 CLS·INP 0으로 리셋, LCP는 `pageshow` 기준). 차단 요인은 `unload` 핸들러, `Cache-Control: no-store`, 열린 IndexedDB/fetch/WebSocket/WebRTC 연결입니다. CrUX 릴리스 노트(2025-03)는 Chrome의 bfcache 적격성 개선이 LCP 통과율을 끌어올렸다고 기록합니다.
- **MYSEOULDROP 적용**: 상세 페이지 ↔ 지도 왕복이 잦은 UX이므로, 인증 페이지가 아닌 라우트의 HTML 응답에 `no-store`를 쓰지 말고(`private`/`no-cache`로 대체), Supabase Realtime 등 WebSocket을 쓴다면 `pagehide`에서 닫고 `pageshow`에서 재연결하세요.
- 출처: Google web.dev — "Back/forward cache" — https://web.dev/articles/bfcache — (2026-07-02 갱신); Chrome for Developers — "Release notes | Chrome UX Report" — https://developer.chrome.com/docs/crux/release-notes — (2025-04-08 항목)

---

## B. Next.js / React

### B1. Server Components가 기본 — `'use client'` 경계를 "가장 작은 인터랙티브 잎"에만 두기
- **왜 중요한가**: Next.js 프로덕션 체크리스트는 "Server Components는 클라이언트 JS 번들 크기에 영향이 없다"며 `'use client'` 경계 배치를 점검하라고 명시합니다. `'use client'` 파일이 import하는 모든 모듈과 직접 렌더하는 컴포넌트가 클라이언트 번들에 포함되지만, **children/props로 넘긴 Server Component는 포함되지 않습니다**. Provider는 `<html>` 전체가 아니라 `{children}`만 감싸도록 가능한 깊게 두라고 권고합니다.
- **MYSEOULDROP 적용**: 장소 데이터 TS 모듈을 `'use client'` 컴포넌트(지도, 목록)가 import하고 있다면 그것이 First Load JS 팽창의 직접 원인입니다. 상세 페이지·목록·SEO 메타는 Server Component에서 모듈을 import(서버 전용, 번들 0)하고, 지도 클라이언트 컴포넌트에는 **뷰포트/카테고리에 필요한 최소 필드만 props로 직렬화**하거나 D1의 방식으로 fetch하세요. `import 'server-only'`를 데이터 모듈 최상단에 넣어 클라이언트 유입을 빌드 에러로 막을 수 있습니다.
- 출처: Next.js — "How to optimize your Next.js application for production" — https://nextjs.org/docs/app/guides/production-checklist — (v16.3.5, 2026-03-10); Next.js — "Server and Client Components" — https://nextjs.org/docs/app/getting-started/server-and-client-components — (2026-08-25)

### B2. 번들 분석: `next experimental-analyze`(Turbopack, 16.1+) / `@next/bundle-analyzer`(webpack) + `optimizePackageImports`
- **왜 중요한가**: Next.js 문서는 "작은 번들 = 빠른 로드, 적은 JS 실행, 낮은 콜드 스타트"라며 Turbopack 번들 분석기(`npx next experimental-analyze --output` → `.next/diagnostics/analyze`로 before/after 비교 가능)와 webpack용 `@next/bundle-analyzer`를 안내합니다. 수백 개 export를 가진 패키지는 `experimental.optimizePackageImports`로 실제 사용 모듈만 로드(`lucide-react`, `date-fns`, `lodash-es`, `@headlessui/react`, `react-icons/*` 등은 기본 적용). 데이터를 UI로 변환만 하는 라이브러리(하이라이터·마크다운 등)는 Server Component로 옮기라고 권고합니다.
- **MYSEOULDROP 적용**: 먼저 분석기로 First Load JS 중 장소 데이터 청크 / leaflet / supabase-js / 아이콘 라이브러리의 비중을 수치화하고 `--output` 결과를 저장해 D1 작업 전후를 비교하세요. Supabase 클라이언트가 지도 라우트의 초기 번들에 포함되어 있다면 인증 관련 라우트/액션에서만 동적 import하세요(Vercel 규칙 2.2).
- 출처: Next.js — "Optimizing package bundling" — https://nextjs.org/docs/app/guides/package-bundling — (2026-06-01); Next.js — "optimizePackageImports" — https://nextjs.org/docs/app/api-reference/config/next-config-js/optimizePackageImports — (2025-12-19)

### B3. `next/dynamic` + `ssr: false`는 Client Component 안에서만 — Leaflet은 SSR 비호환
- **왜 중요한가**: react-leaflet 공식 문서는 "Leaflet은 로드 시 DOM을 직접 호출하므로 React Leaflet은 SSR과 호환되지 않는다"고 명시합니다. Next.js는 `ssr: false`를 Server Component에서 쓰면 에러(15부터 금지)이며 Client Component로 옮겨야 코드 분할이 제대로 동작합니다. 외부 라이브러리는 사용자 액션 시점에 `await import()`로 지연 로드할 수 있습니다.
- **MYSEOULDROP 적용**: `MapContainer` 래퍼를 `'use client'` 파일에서 `dynamic(() => import('./LeafletMap'), { ssr: false, loading: () => <Snapshot/> })`로 감싸고, 지하철 경로 탐색 로직/그래프 데이터도 "경로 보기" 탭 시점에 `import()`하세요. Server Component에서 Client Component를 dynamic import하면 자동 코드 분할이 지원되지 않는다는 주의사항에 유의하세요.
- 출처: Next.js — "How to lazy load Client Components and libraries" — https://nextjs.org/docs/app/guides/lazy-loading — (2026-03-10); React Leaflet — "Introduction" — https://react-leaflet.js.org/docs/start-introduction/ — (v5 문서, accessed 2026-09)

### B4. Vercel "React Best Practices" 70개 규칙 — 우선순위: 워터폴 제거(CRITICAL) > 번들 크기(CRITICAL) > 서버 성능(HIGH) > 클라이언트 데이터 페칭 > 리렌더 > 렌더링 > JS 미세최적화
- **왜 중요한가**: Vercel(2026-01-14)은 "요청 워터폴이 600ms를 더하면 useMemo 최적화는 무의미하고, 페이지마다 300KB JS를 더 보내면 루프 최적화는 의미 없다"며 8개 카테고리 70개 규칙을 영향도순으로 공개했습니다. 번들 카테고리 핵심 규칙: 배럴 파일 대신 서브패스 import(2.1), 큰 데이터/모듈은 기능 활성화 시 조건부 로드(2.2), 분석·로깅 라이브러리는 hydration 이후로 지연(2.3), 초기 렌더 밖 컴포넌트는 `next/dynamic`(2.4), 사용자 행동 신호로 무거운 번들 선제 다운로드(2.6). 렌더링: 리스트에 `content-visibility: auto`(6.2), React DOM 리소스 힌트 API로 preload(6.10), `useTransition`(6.11); 리렌더: `useState(() => ...)` 지연 초기화(5.12), `startTransition`(5.13), `useDeferredValue`(5.14), 스크롤 리스너 `{ passive: true }`(4.2).
- **MYSEOULDROP 적용**: 규칙 2.2가 이 프로젝트의 핵심 이슈를 정확히 겨냥합니다 — 600개 장소 데이터는 "기능이 활성화될 때" 로드해야 하는 큰 데이터입니다. 초기 뷰포트 밖 카테고리(클리닉·관광지 등)와 상세 필드(사진 목록·설명·영업시간)는 탭/줌인 시점에 로드하고, 분석 스크립트는 hydration 이후로 미루세요.
- 출처: Vercel — "Introducing: React Best Practices" — https://vercel.com/blog/introducing-react-best-practices — (2026-01-14); Vercel Labs — "react-best-practices AGENTS.md (v1.0.0)" — https://raw.githubusercontent.com/vercel-labs/agent-skills/main/skills/react-best-practices/AGENTS.md — (2026-01)

### B5. `next/image`: `priority` → `preload`(Next 16 deprecated), `sizes` 필수, Next 16 기본값 변경(`qualities: [75]`, `minimumCacheTTL` 4h, `imageSizes`에서 16 제거)
- **왜 중요한가**: `sizes`가 없으면 브라우저는 100vw로 가정해 과도하게 큰 이미지를 받고, `sizes`가 있어야 반응형 srcset(640w, 750w…)이 생성됩니다. Next 16부터 `priority`는 `preload`로 대체되었고 문서는 "대부분의 경우 `loading="eager"` 또는 `fetchPriority="high"`를 쓰라"고 합니다. AVIF는 WebP 대비 20% 작지만 인코딩이 50% 느리고 포맷별로 캐시가 분리됩니다. Vercel Hobby 플랜은 월 5K 변환/300K 캐시 읽기/100K 캐시 쓰기가 무료이며 초과 시 새 이미지가 402로 실패해 alt 텍스트가 표시됩니다.
- **MYSEOULDROP 적용**: 224개 올리브영 매장 사진처럼 소스 수가 많으면 (변환 수 = 소스 × deviceSizes × 포맷 × quality) Hobby 한도를 쉽게 넘습니다. `images.qualities: [75]`(Next 16 기본), `deviceSizes`를 모바일 중심으로 축소(예: 640/750/828/1080), `formats: ['image/webp']`(또는 AVIF 추가 시 비용 감안), 카드 썸네일에 정확한 `sizes`(예: `(max-width: 640px) 33vw, 200px`)를 지정하세요. 정적 import 이미지는 `immutable` 캐시가 자동 적용됩니다.
- 출처: Next.js — "Image Component" — https://nextjs.org/docs/app/api-reference/components/image — (2026-08-25); Next.js — "Next.js 16" — https://nextjs.org/blog/next-16 — (2025-10-21); Vercel — "Limits and Pricing for Image Optimization" — https://vercel.com/docs/image-optimization/limits-and-pricing — (2026-08-11)

### B6. `next/font`로 셀프호스팅 + `adjustFontFallback`(기본 true)로 CLS 제거, 서브셋 최소화
- **왜 중요한가**: `next/font`는 빌드 시 Google Fonts를 내려받아 정적 자산과 함께 셀프호스팅하며(브라우저→Google 요청 0), `size-adjust` 기반 자동 폴백으로 레이아웃 시프트를 없앱니다. `display` 기본값은 `swap`, `preload` 기본 true(루트 레이아웃에서 쓰면 전 라우트 preload). web.dev는 WOFF2만 사용, `unicode-range` 서브셋, 본문은 시스템 폰트 고려, 아이콘 폰트 대신 SVG를 권고합니다.
- **MYSEOULDROP 적용**: 외국인 관광객 대상 영문 UI는 `subsets: ['latin']` 변수 폰트 1개로 제한하고, 한글 매장명 표기가 필요한 부분은 CJK 폰트 파일이 크므로(수백 KB) 시스템 폰트(`system-ui`, iOS Apple SD Gothic Neo / Android Noto Sans CJK)로 폴백하는 편이 로밍 환경에 유리합니다. `display: 'optional'`은 CLS를 완전히 막지만 느린 네트워크에서 웹폰트가 아예 안 보일 수 있어, 브랜드 폰트가 중요하면 `swap` + 폴백 메트릭 매칭을 유지하세요.
- 출처: Next.js — "Font Module" — https://nextjs.org/docs/app/api-reference/components/font — (2025-08-06); Google web.dev — "Best practices for fonts" — https://web.dev/articles/font-best-practices — (2022-10-04)

### B7. 서드파티 스크립트는 `next/script`(afterInteractive/lazyOnload)·`@next/third-parties`로 hydration 이후에
- **왜 중요한가**: 체크리스트는 `<Script>`가 "스크립트를 자동으로 지연시켜 메인 스레드를 막지 않는다"고 하고, `@next/third-parties`의 `GoogleAnalytics`/`GoogleTagManager`는 "기본적으로 hydration 이후 원본 스크립트를 가져옵니다". `GoogleMapsEmbed`는 기본 lazy 로딩입니다(다만 실험적 패키지).
- **MYSEOULDROP 적용**: 지도 페이지는 hydration 자체가 무거우므로 분석/태그 스크립트는 반드시 hydration 이후(`afterInteractive` 이상, 가능하면 `lazyOnload`)로 미루고, Speed Insights/Analytics 패키지 외 인라인 서드파티 스크립트는 최소화하세요.
- 출처: Next.js — "How to optimize third-party libraries" — https://nextjs.org/docs/app/guides/third-party-libraries — (2026-06-01); Next.js — "How to optimize your Next.js application for production" — https://nextjs.org/docs/app/guides/production-checklist — (2026-03-10)

### B8. 캐싱 모델: Next 15는 `fetch`·GET Route Handler·클라이언트 라우터 캐시가 기본 비캐시, Next 16은 `cacheComponents` + `'use cache'` + `cacheLife`
- **왜 중요한가**: Next 15(2024-10-21)부터 `fetch`는 기본 캐시되지 않고(`cache: 'force-cache'` 또는 `next: { revalidate }`로 옵트인), GET Route Handler는 기본 동적(`export const dynamic = 'force-static'`/`revalidate`로 정적화), 페이지 세그먼트 라우터 캐시 `staleTime` 0입니다. Next 16 Cache Components(`cacheComponents: true`)는 "모든 동적 코드는 요청 시 실행, 캐시는 전적으로 옵트인"이며 `'use cache'`(파일/함수/컴포넌트 단위) + `cacheLife('hours'|'days'|'max')` + `cacheTag`/`updateTag`/`revalidateTag(tag, profile)`로 정적 셸(PPR)에 포함시키고, 런타임 API(`cookies`, `searchParams`)는 `<Suspense>`로 감싸야 합니다. 모듈 import·`fs.readFileSync`·순수 계산은 "예측 가능한 값"으로 자동 프리렌더됩니다.
- **MYSEOULDROP 적용**: 장소 데이터는 빌드 시점 확정 데이터이므로 Server Component에서 모듈 import → 자동 프리렌더가 가장 싸고, Supabase 사용자 데이터(즐겨찾기·로그인 상태)만 `<Suspense>` 뒤로 스트리밍하면 정적 셸이 CDN에서 즉시 서빙됩니다. Next 16 업그레이드 시 `revalidateTag` 2-인자 시그니처, `middleware.ts → proxy.ts`, 비동기 `params/cookies` 강제에 대비하세요.
- 출처: Next.js — "Next.js 15" — https://nextjs.org/blog/next-15 — (2024-10-21); Next.js — "Caching and Revalidating (Previous Model)" — https://nextjs.org/docs/app/guides/caching-without-cache-components — (2026-08-25); Next.js — "Caching" (Cache Components) — https://nextjs.org/docs/app/getting-started/caching — (2026-08-25); Next.js — "route.js" — https://nextjs.org/docs/app/api-reference/file-conventions/route — (2026-04-30)

### B9. React Compiler(1.0 안정) — Next 16에서 `reactCompiler: true` 안정 옵션, 15.3.1+에서도 사용 가능
- **왜 중요한가**: React 공식 문서는 컴파일러가 "안정(stable)"이며 캐스케이딩 리렌더 방지와 비싼 계산 자동 메모이제이션을 수행한다고 밝힙니다(React 17/18/19 지원, 19 권장; Next 15.3.1+ swc 통합). Next 16 블로그는 `reactCompiler`가 experimental에서 안정으로 승격되었으나 Babel 의존으로 빌드 시간이 늘어 기본 비활성이라고 설명합니다.
- **MYSEOULDROP 적용**: 마커 리스트·필터·바텀시트처럼 props 변동에 따라 수백 개 자식이 리렌더되는 UI에서 INP 개선 효과가 큽니다. 켜기 전 기존 `useMemo`/`useCallback`은 유지한 채 테스트하고(문서 권고), 빌드 시간 증가를 감안하세요.
- 출처: React — "React Compiler – Introduction" — https://react.dev/learn/react-compiler/introduction — (accessed 2026-09); Next.js — "Next.js 16" — https://nextjs.org/blog/next-16 — (2025-10-21)

---

## C. 지도(Leaflet) 성능

### C1. `preferCanvas: true`는 벡터 Path(CircleMarker 등)에만 적용 — `L.Marker`(아이콘 마커)는 여전히 DOM
- **왜 중요한가**: Leaflet 1.9.4 레퍼런스에서 `preferCanvas`(기본 false)는 "Path를 SVG 대신 Canvas 렌더러에 그릴지"를 정하는 옵션이고, `Marker`는 이미지 아이콘 기반 DOM 요소, `CircleMarker`는 벡터 레이어입니다. Leaflet 이슈 #7321("make L.Marker work with canvas renderer")은 아이콘 마커의 Canvas 렌더가 코어에 없고 플러그인(leaflet-canvas-markers 등)이나 CircleMarker 우회가 거론된 채 종료되었습니다.
- **MYSEOULDROP 적용**: 600개 규모면 뷰포트 컬링만으로도 DOM 마커가 감당 가능하지만, 줌아웃 시 "점"만 보여주는 오버뷰 모드는 `CircleMarker` + `preferCanvas`로 전환하면 DOM 노드가 0이 되어 표시 지연(INP)과 메모리에 유리합니다. 상세 아이콘(브랜드 로고)은 줌인 레벨에서만 `L.Marker`/`divIcon`으로 그리세요.
- 출처: Leaflet — "Leaflet API reference (1.9.4)" — https://leafletjs.com/reference.html — (accessed 2026-09); Leaflet GitHub — "make L.Marker work with canvas renderer · Issue #7321" — https://github.com/Leaflet/Leaflet/issues/7321 — (accessed 2026-09)

### C2. 클러스터링: Leaflet.markercluster `chunkedLoading` + `removeOutsideVisibleBounds` + `disableClusteringAtZoom`
- **왜 중요한가**: Leaflet.markercluster(v1.4.1, Leaflet 1.0+)는 "10,000 또는 50,000 마커(Chrome)" 예제를 제공하고, `chunkedLoading`(마커 추가를 인터벌로 나눠 페이지 프리즈 방지), `removeOutsideVisibleBounds`(화면 밖 클러스터 제거), `maxClusterRadius`(기본 80px), `disableClusteringAtZoom`, `spiderfyOnMaxZoom` 옵션을 제공합니다. 2026-08 게시된 React+Leaflet 성능 가이드는 DOM/SVG는 ~10k 객체부터, Canvas는 ~100k, markercluster는 100k 초과에서 한계이고(200k 마커 52초), supercluster는 500k도 1–2초라고 보고합니다.
- **MYSEOULDROP 적용**: 600개는 markercluster 범위 안이므로 supercluster까지는 불필요합니다. 도시 전체 줌에서는 카테고리별 클러스터(색상 구분)로 마커 수를 줄이고, `disableClusteringAtZoom`을 역/동네 수준(예: 15~16)으로 두면 지하철 라우팅 UX와 자연스럽게 맞습니다. 기존 뷰포트 컬링과 중복되면 `removeOutsideVisibleBounds`만 남기고 자체 컬링을 단순화할 수 있습니다.
- 출처: Leaflet GitHub — "Leaflet.markercluster" README — https://github.com/Leaflet/Leaflet.markercluster — (v1.4.1, accessed 2026-09); Andrej Gajdos — "A Leaflet Developer's Guide to High-Performance Map Visualizations in React" — https://andrejgajdos.com/leaflet-developer-guide-to-high-performance-map-visualizations-in-react/ — (2026-08-08)

### C3. react-leaflet v5 함정: `MapContainer` props는 불변, 이벤트/인스턴스는 `useMap`·`useMapEvents`, React `<Activity>`와 비호환(→ `key`)
- **왜 중요한가**: 공식 문서는 "`MapContainer` props는 children을 제외하고 불변 — 최초 설정 후 변경해도 Map 인스턴스에 영향 없음", "props는 Leaflet 인스턴스 생성 옵션으로 사용"(따라서 `preferCanvas` 등 Map 옵션 전달 가능), 가변 prop은 참조 비교 후 반영, 레이어 제거 시 자동 정리라고 설명합니다. React의 `Activity`와는 호환되지 않아 `MapContainer`에 고유 `key`를 주라고 안내합니다. 위 2026 가이드는 react-leaflet 추상화가 40k GeoJSON에서 ~30초(네이티브 Leaflet은 수 초)로 느렸다며 대량 레이어는 `useMap()`으로 네이티브 API를 직접 쓰라고 권합니다.
- **MYSEOULDROP 적용**: 마커를 React 요소 600개로 매핑하기보다 `useMap()`에서 `L.layerGroup`/`markerClusterGroup`에 네이티브로 addLayer하고 React 상태는 선택된 장소 ID 정도만 유지하면 리렌더 비용이 사라집니다. `center`/`zoom`을 props로 바꾸려 하지 말고 `map.flyTo`를 쓰세요. Tab 전환에 `<Activity>`를 도입한다면 `MapContainer`에 `key`를 고정하세요.
- 출처: React Leaflet — "Introduction" — https://react-leaflet.js.org/docs/start-introduction/ — (accessed 2026-09); React Leaflet — "Map" API — https://react-leaflet.js.org/docs/api-map/ — (v5.x, accessed 2026-09)

### C4. 타일 로딩: 모바일 기본 `updateWhenIdle: true`, `keepBuffer: 2`, 타일 오리진 `preconnect`, 지도 박스 크기 고정
- **왜 중요한가**: Leaflet TileLayer의 `updateWhenIdle`은 모바일에서 기본 true(패닝 중 요청 억제), `updateWhenZooming` 기본 true, `keepBuffer` 기본 2입니다. web.dev는 "가장 중요한 크로스오리진에만 `preconnect`, CORS 리소스에는 `crossorigin`", 남용 금지를 권고하고, `<link rel="prefetch">`는 `Save-Data` 힌트를 존중하라고 합니다. CLS 문서는 임베드/지도 컨테이너에 크기 예약을 요구합니다.
- **MYSEOULDROP 적용**: 루트 레이아웃에 타일 서버 오리진 1개(+ Supabase 오리진)에만 `<link rel="preconnect">`를 두세요(폰트는 next/font로 셀프호스팅이라 불필요). 로밍 사용자에겐 타일 바이트가 곧 비용이므로 `keepBuffer`를 늘리지 말고, 줌 애니메이션 중 타일 갱신(`updateWhenZooming`)을 끄는 것도 바이트 절감에 도움이 됩니다. 지도 div는 `height: 100dvh` 등 명시 크기를 서버 HTML에서 고정하세요.
- 출처: Leaflet — "Leaflet API reference (1.9.4)" — https://leafletjs.com/reference.html — (accessed 2026-09); Google web.dev — "Resource hints" — https://web.dev/learn/performance/resource-hints — (2023-11-01); Google web.dev — "Optimize Cumulative Layout Shift" — https://web.dev/articles/optimize-cls — (2025-02-07)

---

## D. 네트워크 / 데이터 페이로드

### D1. 장소 데이터를 번들 밖으로: (a) 버전 파일명 JSON in `public/` + `headers()`로 `immutable`, 또는 (b) `force-static` Route Handler + `s-maxage`
- **왜 중요한가**: Next.js는 `public/` 파일에 `Cache-Control: public, max-age=0`만 붙이고(변경 가능성 때문), 해시가 붙은 `_next/static` 자산에만 `public, max-age=31536000, immutable`을 강제합니다. 반면 `next.config.js`의 `headers()`는 "파일시스템(pages·public)보다 먼저 검사"되어 `public/` 경로에 임의 `Cache-Control`을 붙일 수 있습니다. Vercel은 정적 파일을 배포 수명 동안 CDN에 자동 캐시하고, Route Handler 응답은 `s-maxage`/`stale-while-revalidate`가 있어야 CDN 캐시합니다(GET 핸들러는 Next 15부터 기본 동적 → `export const dynamic = 'force-static'` 또는 `revalidate`). Vercel React 규칙 2.2/2.5는 "큰 데이터는 조건부 로드, import 경로는 정적으로 분석 가능하게"입니다.
- **MYSEOULDROP 적용(권장 설계)**: ① 빌드 스크립트로 TS 모듈 → `public/data/places-index.<contenthash>.json`(id·lat·lng·category·name·slug 등 지도용 최소 필드, 600건이면 gzip 후 수십 KB 수준) + `public/data/places/<id>.json`(상세) 생성, 해시 파일명은 Server Component에서 import한 매니페스트로 주입. ② `headers()`에 `source: '/data/:path*'` → `Cache-Control: public, max-age=31536000, immutable`. ③ 지도 클라이언트는 hydration 이후 `fetch`로 인덱스를 받고(SSR 스냅샷이 먼저 페인트됨), 상세는 탭 시 로드. ④ 대안: `app/api/places/route.ts`에 `export const dynamic = 'force-static'`, `revalidate = 86400`, 응답 헤더 `Cache-Control: public, max-age=300, s-maxage=86400, stale-while-revalidate=604800`. 두 방식 모두 Vercel 캐시 응답 10MB 한도 내이며, 서버 컴포넌트(상세 페이지·SEO)는 계속 TS 모듈을 직접 import하면 됩니다.
- 출처: Next.js — "public Folder" — https://nextjs.org/docs/app/api-reference/file-conventions/public-folder — (2025-06-16); Next.js — "headers" (next.config.js) — https://nextjs.org/docs/app/api-reference/config/next-config-js/headers — (2026-06-30); Next.js — "route.js" — https://nextjs.org/docs/app/api-reference/file-conventions/route — (2026-04-30); Vercel — "Vercel CDN Cache" — https://vercel.com/docs/caching/cdn-cache — (2026-09-14); Vercel Labs — "react-best-practices AGENTS.md" — https://raw.githubusercontent.com/vercel-labs/agent-skills/main/skills/react-best-practices/AGENTS.md — (2026-01)

### D2. Vercel Cache-Control 레시피: 기본값은 비캐시, `s-maxage`/`stale-while-revalidate`는 CDN이 소비하고 브라우저엔 안 보냄, `CDN-Cache-Control` > `Cache-Control`
- **왜 중요한가**: Vercel 기본 헤더는 `public, max-age=0, must-revalidate`(CDN·브라우저 모두 비캐시). 권장표: 모든 방문자에게 동일한 SSR 페이지 `max-age=0, s-maxage=86400`, 준정적 콘텐츠 `max-age=120, s-maxage=86400`(60–120s 브라우저 TTL로 엣지 요청 절감), 개인화 `private, max-age=0`, 해시 자산 `max-age=31536000, immutable`. `Cache-Control`만 쓰면 Vercel이 `s-maxage`를 제거해 브라우저로 보내고, `CDN-Cache-Control`/`Vercel-CDN-Cache-Control`로 CDN·브라우저를 분리 제어할 수 있습니다. 캐시 조건: `set-cookie` 없음, `Authorization` 헤더 없음, `Vary: Cookie` 불가, 비스트리밍 응답 10MB 이하, 최대 1년.
- **MYSEOULDROP 적용**: 로그인 여부와 무관한 지도/장소 라우트의 응답에 Supabase 세션 쿠키가 `set-cookie`로 실리면 CDN 캐시가 통째로 무효화됩니다. 세션 갱신은 인증 라우트/서버 액션에 국한하고, 응답의 `x-vercel-cache` 헤더(HIT/MISS)를 확인해 지도 페이지가 실제로 캐시되는지 검증하세요.
- 출처: Vercel — "Cache-Control headers" — https://vercel.com/docs/caching/cache-control-headers — (2026-09-14); Vercel — "Vercel CDN Cache" — https://vercel.com/docs/caching/cdn-cache — (2026-09-14)

### D3. 벤치마크(HTTP Archive): 2025 모바일 홈페이지 중앙값 JS 632KB·이미지 911KB·폰트 122KB, 90분위 총 8.3MB; 모바일 TBT 중앙값 1,916ms; CWV 전부 통과 48%
- **왜 중요한가**: Web Almanac 2025(2025-07 데이터, 2026-01-15 발행): "median mobile home page used 22 KB HTML, 77 KB CSS, 122 KB fonts, 632 KB JavaScript, 911 KB images"(내부 페이지 JS 660 KB, 이미지 354 KB), 90분위 모바일 8,337 KB, 모바일 페이지 8.4% 증가. Performance 챕터: 모바일 CWV 전부 Good 48%(2024년 44%), LCP Good 62%, INP Good 77%, CLS Good 81%, TTFB Good 44%, 모바일 TBT 중앙값 1,916ms(+58%). 2024 JS 챕터(2025-03-03): 모바일 JS 558KB 중 미사용 206KB(44%), 90분위 TBT 5,950ms, 롱태스크 중앙값 14개.
- **MYSEOULDROP 적용**: TBT 380ms는 모바일 중앙값(1,916ms)보다 훨씬 좋지만, 로밍 사용자 기준 "상위 25%가 아니라 p75"로 판단해야 합니다. 목표치 제안: First Load JS < 300KB(gz 전 기준 JS 중앙값의 절반), LCP 이미지 ≤ 100KB, 초기 장소 인덱스 ≤ 50KB, 미사용 JS 비율을 Coverage로 20% 이하로.
- 출처: HTTP Archive — "Page Weight | 2025 | The Web Almanac" — https://almanac.httparchive.org/en/2025/page-weight — (2026-01-15); HTTP Archive — "Performance | 2025 | The Web Almanac" — https://almanac.httparchive.org/en/2025/performance — (2026-01-15); HTTP Archive — "Page Weight | 2024" — https://almanac.httparchive.org/en/2024/page-weight — (2024-12-30); HTTP Archive — "JavaScript | 2024" — https://almanac.httparchive.org/en/2024/javascript — (2025-03-03). (2025 JavaScript 챕터는 존재하지 않음 — 404 확인)

### D4. Fluid compute(2025-04-23부터 신규 프로젝트 기본) — 인스턴스 내 동시성·바이트코드 캐싱으로 콜드스타트/TTFB 완화
- **왜 중요한가**: Fluid compute는 "여러 호출이 한 함수 인스턴스를 공유", Node 20+ 바이트코드 캐싱(프로덕션만), 프로덕션 사전 워밍, AZ/리전 페일오버를 제공합니다. LCP 예산에서 TTFB는 약 40%를 차지하므로 동적 라우트의 콜드스타트는 곧 LCP입니다. Vercel KB(2026-08)는 "Fluid compute가 서버 작업을 사용자 인근 리전에서 실행해 TTFB를 줄인다"고 설명합니다.
- **MYSEOULDROP 적용**: 프로젝트가 2025-04 이전에 생성되었다면 대시보드 Functions 설정에서 Fluid 활성화를 확인하세요. 사용자가 서울에 있으므로 함수 리전을 한국 인근으로 두는 것이 TTFB에 유리합니다(리전 설정 문서는 fluid compute 페이지에서 링크만 확인, 세부 페이지는 이번에 미조회). 가장 확실한 방법은 지도/장소 라우트를 정적 셸로 프리렌더해 함수 호출 자체를 없애는 것입니다(B8).
- 출처: Vercel — "Fluid compute" — https://vercel.com/docs/fluid-compute — (2026-08-24); Vercel — "How to improve Core Web Vitals" — https://vercel.com/kb/guide/how-to-improve-core-web-vitals — (2026-08-18); Google web.dev — "Optimize LCP" — https://web.dev/articles/optimize-lcp — (2025-03-31)

---

## E. 측정 / 모니터링

### E1. Vercel Speed Insights: 무료 티어는 RES만(팀당 30일 10,000 이벤트), Plus($10/프로젝트/월, Pro)여야 LCP/INP/CLS 라우트·엘리먼트 분해
- **왜 중요한가**: Speed Insights는 실사용자 데이터(RUM) 기반이며 Lighthouse 10 채점 기준, P75 기본(P90/95/99 선택)입니다. 방문당 최대 6개 데이터 포인트(로드: TTFB·FCP, 상호작용: FID·LCP, 이탈: INP·CLS·LCP)는 **하드 내비게이션에서만** 수집됩니다(Next.js 앱은 세션의 첫 페이지뷰). 무료 티어는 RES + Great/Needs Improvement 경로 목록만, Plus는 모든 CWV·Poor 항목·국가·엘리먼트 셀렉터·30/90일 범위. 무료 할당 초과 시 14일간 수집 중단.
- **MYSEOULDROP 적용**: 관광객 트래픽이 국가별로 다양하고 "어떤 마커/버튼이 INP를 망치는지"를 알아야 하므로, 런칭 초기 1–2개월은 Pro + Plus로 엘리먼트 단위 INP 원인을 잡는 편이 비용 대비 효율적입니다. 이벤트 절약이 필요하면 `sampleRate`/`beforeSend`로 조정하세요.
- 출처: Vercel — "Speed Insights Overview" — https://vercel.com/docs/speed-insights — (2026-09-01); Vercel — "Speed Insights Metrics" — https://vercel.com/docs/speed-insights/metrics — (2026-09-01); Vercel — "Limits and Pricing for Speed Insights" — https://vercel.com/docs/speed-insights/limits-and-pricing — (2026-09-01)

### E2. `useReportWebVitals`로 자체 RUM(무료) — 별도 `'use client'` 컴포넌트 + `navigator.sendBeacon`
- **왜 중요한가**: Next.js는 `useReportWebVitals`(TTFB/FCP/LCP/FID/CLS/INP, `rating`·`navigationType`·`entries` 포함)를 루트 레이아웃에서 import하는 **독립 클라이언트 컴포넌트**로 두어 클라이언트 경계를 최소화하라고 하며, 콜백 참조를 고정해 중복 보고를 막고 `sendBeacon`(폴백 `fetch keepalive`)으로 전송하는 예제를 제공합니다.
- **MYSEOULDROP 적용**: Speed Insights Plus 없이도 Supabase 테이블(또는 Route Handler → 로그 드레인)에 `{name, value, rating, id, navigationType, path}`를 적재하면 국가/경로별 p75를 직접 계산할 수 있습니다. `entries`에서 INP의 `target` 셀렉터를 함께 저장하면 엘리먼트 분해도 자체 구현 가능합니다.
- 출처: Next.js — "useReportWebVitals" — https://nextjs.org/docs/app/api-reference/functions/use-report-web-vitals — (2026-02-27)

### E3. 랩(Lighthouse) ↔ 필드(CrUX 28일 롤링) 병행, SPA 소프트 내비게이션 측정은 아직 CrUX 미반영
- **왜 중요한가**: 체크리스트는 "Lighthouse는 시뮬레이션이므로 필드 데이터와 함께 봐야 한다"고 하고, Vercel KB는 CrUX가 28일 롤링 윈도우라 개선이 반영되기까지 약 한 달이 걸린다고 설명합니다. Chrome의 소프트 내비게이션 측정(`soft-navigation` 엔트리, `interaction-contentful-paint`, web-vitals v6.0+)은 Chrome/Edge에서 출시 단계이지만 문서상 "CrUX 보고 방식은 미정"이며 Firefox/Safari 미지원입니다. CrUX 릴리스 노트는 2026-05~08에 모바일 중심 INP 회귀를 반복 언급합니다.
- **MYSEOULDROP 적용**: 지도 앱은 클라이언트 라우팅이 많아 CrUX/Speed Insights 모두 "첫 하드 내비게이션"만 봅니다. 상세 → 지도 복귀 같은 소프트 내비게이션 체감 성능은 `web-vitals` v6의 소프트 내비 옵션이나 자체 `performance.mark`로 별도 계측하세요. PR마다 `next experimental-analyze --output` 결과 diff + Lighthouse CI를 붙이고, 배포 후에는 Speed Insights p75를 지표로 삼으세요.
- 출처: Next.js — "How to optimize your Next.js application for production" — https://nextjs.org/docs/app/guides/production-checklist — (2026-03-10); Vercel — "How to improve Core Web Vitals" — https://vercel.com/kb/guide/how-to-improve-core-web-vitals — (2026-08-18); Chrome for Developers — "Experimenting with measuring soft navigations" — https://developer.chrome.com/docs/web-platform/soft-navigations-experiment — (accessed 2026-09); Chrome for Developers — "Release notes | Chrome UX Report" — https://developer.chrome.com/docs/crux/release-notes — (2026-09-08 항목까지)

---

## 2025–2026에 바뀐 것 (요약)

1. **INP가 FID를 대체** — INP는 2024년 3월 안정 CWV가 되었고, CrUX는 2024-08(2024-09-10 발표)에 FID를 폐기·제거했으며 동시에 스크롤용 `pointerup`을 INP에서 제외했습니다. 2025-01: CrUX API에 LCP 하위구간·리소스 타입 추가, ECT → RTT 교체. 2026-05~08: 모바일 INP 회귀 관찰(원인 미확정). — https://web.dev/articles/vitals , https://developer.chrome.com/docs/crux/release-notes
2. **CWV 기준값은 그대로(LCP 2.5s / INP 200ms / CLS 0.1)** — web.dev LCP 문서(2025-09-04)와 CrUX 노트에 변경 없음. "2026년 LCP 2.0s" 주장은 1차 출처 미확인. — https://web.dev/articles/lcp
3. **`scheduler.yield()` 표준화 진행** — Chrome/Edge 129+, Firefox 142+ 지원, Safari 미지원; `isInputPending()` 비권장. — https://web.dev/articles/optimize-long-tasks
4. **소프트 내비게이션 CWV 측정** — Chrome에서 출시 단계, CrUX 반영 방식 미정. — https://developer.chrome.com/docs/web-platform/soft-navigations-experiment
5. **Next.js 15 (2024-10-21)** — `fetch`·GET Route Handler·페이지 라우터 캐시 기본 비캐시, 비동기 `params/cookies/headers`, React 19, `serverExternalPackages` 안정, `next/dynamic ssr:false`는 Client Component에서만. — https://nextjs.org/blog/next-15
6. **Next.js 16 (2025-10-21)** — Cache Components(`cacheComponents`, `'use cache'`, `cacheLife`, `updateTag`, `refresh`, `revalidateTag(tag, profile)` 필수), Turbopack 기본, React Compiler 안정 옵션, `middleware.ts → proxy.ts`, 라우터 프리페치 재작성(레이아웃 중복 제거·증분 프리페치), `next/image` `priority → preload`·`qualities [75]`·`minimumCacheTTL` 4h·`imageSizes`에서 16 제거·로컬 쿼리스트링 src에 `localPatterns` 필요, Node 20.9+/Safari 16.4+ 요구. 16.1: `next experimental-analyze`. — https://nextjs.org/blog/next-16 , https://nextjs.org/docs/app/guides/package-bundling
7. **React Compiler 1.0 안정** — Next 15.3.1+에서 swc 통합, Next 16에서 `reactCompiler` 안정 설정. — https://react.dev/learn/react-compiler/introduction
8. **Vercel** — Fluid compute 신규 프로젝트 기본(2025-04-23); Speed Insights 무료 티어(30일 10K 이벤트, RES만) + Plus $10/프로젝트; 이미지 최적화 과금이 소스 이미지 수 → 변환/캐시 읽기·쓰기 단위로 전환(2025-02-18 이후 기본); "React Best Practices" 70개 규칙 공개(2026-01-14). — https://vercel.com/docs/fluid-compute , https://vercel.com/docs/speed-insights/limits-and-pricing , https://vercel.com/docs/image-optimization/limits-and-pricing , https://vercel.com/blog/introducing-react-best-practices
9. **HTTP Archive 2025** — 모바일 페이지 8.4% 증가, 모바일 TBT 중앙값 1,916ms(+58%), CWV 전부 통과 48%; 2025년판에는 JavaScript 챕터가 없고(404) Page Weight/Performance로 대체. — https://almanac.httparchive.org/en/2025/page-weight , https://almanac.httparchive.org/en/2025/performance

---

### 가져오지 못했거나 불완전한 소스 (정직 표기)
- `https://almanac.httparchive.org/en/2025/javascript` — 404 (챕터 없음).
- `https://github.com/vercel-labs/agent-skills/blob/main/skills/react-best-practices/AGENTS.md` — GitHub UI만 반환되어 raw URL로 재조회해 성공.
- react-leaflet 설치 페이지(https://react-leaflet.js.org/docs/start-installation/)는 v5의 React 19 요구사항을 명시적으로 표기하지 않아 버전 요구는 인용하지 않았습니다.
- Vercel 함수 리전 설정 문서는 링크만 확인하고 본문은 조회하지 않았습니다(D4에 표기).
- 소프트 내비게이션 문서의 요약에 "Chrome 151"과 날짜가 섞여 나와, 정확한 출시 시점은 인용하지 않고 "출시 단계·CrUX 미정"으로만 기재했습니다.
