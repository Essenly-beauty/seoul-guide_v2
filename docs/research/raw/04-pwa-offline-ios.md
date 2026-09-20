## MYSEOULDROP PWA / 오프라인 / 플랫폼 함정 리서치 보고서 (2025–2026 기준, 조회일 2026-09-20)

모든 항목은 실제로 페이지를 가져와 확인한 내용입니다. 가져오지 못한 페이지는 맨 끝 "미확인/실패" 절에 명시했습니다.

---

## A. 설치성·매니페스트

### A1. Chrome 설치 기준 — 최소 요건과 "30초·1탭" 휴리스틱
- 규칙/사실: HTTPS, `name` 또는 `short_name`, **192px + 512px 아이콘**, `start_url`, `display`가 `fullscreen|standalone|minimal-ui|window-controls-overlay` 중 하나, `prefer_related_applications` 없거나 `false`. 추가로 "사용자가 페이지를 최소 1회 클릭/탭" + "최소 30초 체류" 휴리스틱을 넘어야 설치 프롬프트가 뜸. 메뉴 설치는 Chrome 108(모바일)/112(데스크톱)부터 `fetch()` 핸들러가 있는 SW 없이도 가능하지만, **`beforeinstallprompt`를 띄우는 알고리즘은 여전히 `fetch()` 핸들러를 요구**. MDN도 "Service workers are not required for installability"라고 명시.
- 적용 제안: 현재 `public/sw.js`에 `fetch` 핸들러가 있으므로 유지(제거하면 Android 인앱 설치 프롬프트가 사라짐). manifest에 192/512 PNG(`purpose: any`)와 512 maskable을 **별도 엔트리**로 두기. `prefer_related_applications` 키는 넣지 말 것.
- 출처: web.dev — "What does it take to be installable?" — https://web.dev/articles/install-criteria — (2024-09-19) / Chrome for Developers — "Update on installability criteria" — https://developer.chrome.com/blog/update-install-criteria — (accessed 2026-09) / MDN — "Making PWAs installable" — https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable — (accessed 2026-09)

### A2. `id`와 `scope`를 명시 — 설치 앱의 정체성 고정
- 규칙/사실: `id`는 `start_url` origin 기준으로 해석되며(`/foo`, `foo`, `./foo` 모두 동일), MDN은 "use a leading `/`" 권고. `id`가 같으면 URL이 달라도 **같은 앱의 갱신**, 다르면 **별도 앱**으로 취급. `id` 미설정 시 `start_url`이 대체값이라 `start_url`을 바꾸면 기존 설치를 못 알아볼 수 있음(web.dev). `scope` 미지정 시 `start_url`의 파일명·쿼리·프래그먼트를 뗀 경로가 scope가 됨. scope 밖 페이지는 앱 안에서 열리되 URL 바 등 브라우저 UI가 노출됨. WebKit 16.4는 `id`를 "같은 앱을 여러 개 설치했을 때 알림·배지 구분"과 Focus 동기화에 사용.
- 적용 제안: manifest에 `"id": "/"`, `"scope": "/"`, `"start_url": "/map"` 명시. `/place/[slug]`, `/account`, `/login` 등이 모두 scope 안에 들어가야 Home Screen 앱 안에서 URL 바 없이 이동됨. Supabase OAuth 콜백(`/auth/callback`)도 same-origin이면 scope 내.
- 출처: MDN — "id" (Manifest Reference) — https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/id — (accessed 2026-09) / MDN — "scope" — https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/scope — (accessed 2026-09) / web.dev — "Web App Manifest" (Learn PWA) — https://web.dev/learn/pwa/web-app-manifest — (accessed 2026-09) / WebKit — "WebKit Features in Safari 16.4" — https://webkit.org/blog/13966/webkit-features-in-safari-16-4/ — (2023-03)

### A3. Richer Install UI — `screenshots` + `description` (Android Chrome)
- 규칙/사실: `screenshots`가 최소 1장 있으면 Android의 작은 "홈 화면에 추가" 인포바 대신 큰 대화상자가 뜸. 요건: **가로·세로 320px 이상 3,840px 이하**, 최대변/최소변 비율 **2.3 이하**, 같은 `form_factor`끼리 **동일 종횡비**, **JPEG/PNG만**, **최대 8장** 표시(초과분 무시). `form_factor`는 `"narrow"`(모바일)/`"wide"`(데스크톱). `description`은 **7줄(약 324자)** 넘으면 잘리고 말줄임 처리.
- 적용 제안: `form_factor: "narrow"` 1080×1920(비율 1.78) 스크린샷 3–4장(지도, 장소 상세, 지하철 경로, 즐겨찾기). `description`은 영어 2문장 이내. `categories: ["travel","lifestyle","shopping"]`(소문자).
- 출처: web.dev — "How to add Richer Install UI" — https://web.dev/articles/web-apps/richer-install-ui — (accessed 2026-09) / web.dev — "Installation prompt" (Learn PWA) — https://web.dev/learn/pwa/installation-prompt — (accessed 2026-09)

### A4. `beforeinstallprompt` 타이밍과 1회성 `prompt()`
- 규칙/사실: 이벤트는 Chromium 계열에서만 발생(비표준). `preventDefault()`로 미니 인포바를 막고 이벤트를 저장 → 사용자 제스처에서 `prompt()`. **`prompt()`는 저장된 이벤트에 대해 한 번만 호출 가능**. `userChoice.outcome`은 `accepted|dismissed`. `appinstalled` 이벤트로 설치 완료 감지(설치 경로 무관). 이미 설치됐거나 기준 미달이면 이벤트 자체가 안 뜸. 권장 노출 위치: "사이드 메뉴, 주문 완료 같은 핵심 여정 직후, 가입 페이지 직후". 설치 상태는 `window.matchMedia('(display-mode: standalone)')`로 판별.
- 적용 제안: 첫 즐겨찾기 저장 직후 또는 경로 검색 성공 직후 인라인 배너("Add MYSEOULDROP to your home screen — works with spotty data")로 1회 노출; 거절 시 설정 메뉴에 "Install app" 항목으로 상주. `display-mode: standalone`이면 배너·"Open in app" 유도 숨김.
- 출처: MDN — "How to trigger install prompt" — https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/How_to/Trigger_install_prompt — (accessed 2026-09) / web.dev — "How to provide your own in-app install experience" — https://web.dev/articles/customize-install — (accessed 2026-09) / web.dev — "Installation prompt" — https://web.dev/learn/pwa/installation-prompt — (accessed 2026-09)

### A5. iOS는 프롬프트 없음 → 안내 시트, 그리고 iOS 26의 "Open as Web App" 기본값
- 규칙/사실: iOS에는 `beforeinstallprompt`가 없고 공유 시트 → "홈 화면에 추가"만 존재. iOS 16.4+부터 Chrome/Edge/Firefox 등 서드파티 브라우저도 공유 메뉴에서 추가 가능, iOS 17부터 Safari View Controller(인앱 브라우저)에서도 가능. **iOS 26/Safari 26.0: "By default, every website added to the Home Screen opens as a web app"**, 사용자가 "Open as Web App" 토글을 끄면 북마크로 저장. WebKit 표현 그대로 "There are now zero requirements for 'installability' in Safari." 단 manifest가 있으면 아이콘·SW 오프라인 등 기능은 그대로 유효.
- 적용 제안: iOS 감지(`navigator.standalone === false` && iOS UA)이면 "Share ▸ Add to Home Screen" 2단계 그림 안내 시트. iOS 26 사용자는 토글 안내까지. 인앱 브라우저(인스타/카톡)에서 열린 경우도 iOS 17+면 동일 안내 가능.
- 출처: WebKit — "WebKit Features in Safari 26.0" — https://webkit.org/blog/17333/webkit-features-in-safari-26-0/ — (accessed 2026-09) / WebKit — "News from WWDC25: WebKit in Safari 26 beta" — https://webkit.org/blog/16993/news-from-wwdc25-web-technology-coming-this-fall-in-safari-26-beta/ — (2025-06) / WebKit — "News from WWDC23: WebKit Features in Safari 17 beta" — https://webkit.org/blog/14205/news-from-wwdc23-webkit-features-in-safari-17-beta/ — (2023-06) / MDN — "Making PWAs installable" — (위와 동일)

### A6. `shortcuts` — 앱 아이콘 롱프레스 바로가기
- 규칙/사실: `name`, `url` 필수; `short_name`, `description`, `icons` 선택. **URL은 manifest scope 안**이어야 하며 상대 URL은 manifest 파일 URL 기준으로 해석. 노출 개수·형태는 OS/브라우저 재량(잘릴 수 있음).
- 적용 제안: 최대 3개 — `/map?view=favorites`("Saved places"), `/map?near=me`("Near me"), `/map?filter=oliveyoung`("Olive Young") 등, 각 96–192px 단색 아이콘.
- 출처: MDN — "shortcuts" — https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/shortcuts — (accessed 2026-09)

### A7. iOS 전용 메타: `apple-touch-icon`, `apple-mobile-web-app-*`, 스플래시
- 규칙/사실: Safari 15.4+는 "manifest-declared icons when there is no apple-touch-icon defined"만 사용 → `apple-touch-icon`이 있으면 그것이 우선. `apple-mobile-web-app-status-bar-style`은 standalone일 때만 효과. 스플래시(`apple-touch-startup-image`) 기본값은 "마지막 실행 화면 스크린샷"이고, 커스텀 스플래시는 **기기 해상도별 `media` 쿼리로 정확히 매칭**해야 동작(Apple 포럼: "double check that you have an exact match for your device's screen resolution"), firt.dev: "Startup images only work if the `apple-mobile-web-app-capable` meta tag is present". Safari 15.4+는 페이지 로드 시 항상 manifest를 fetch.
- 적용 제안: `<link rel="apple-touch-icon" sizes="180x180">` 1장 필수(투명 배경 없이). `apple-mobile-web-app-capable=yes`, `apple-mobile-web-app-title="MYSEOULDROP"`, `status-bar-style=black-translucent`(safe-area 처리 전제). 스플래시는 `pwa-asset-generator`류로 생성한 세트를 넣거나, 비용 대비 효과가 낮으면 생략하고 첫 화면 LCP(SSR 정적 지도 스냅샷)로 대체.
- 출처: Apple — "Configuring Web Applications" (Safari Web Content Guide, archived) — https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/ConfiguringWebApplications/ConfiguringWebApplications.html — (archived, accessed 2026-09) / WebKit — "New WebKit Features in Safari 15.4" — https://webkit.org/blog/12445/new-webkit-features-in-safari-15-4/ — (2022-03) / Apple Developer Forums — "iOS web app splash screens" — https://developer.apple.com/forums/thread/733490 — (accessed 2026-09) / firt.dev — "PWA on iOS" notes — https://firt.dev/notes/pwa-ios/ — (accessed 2026-09)

---

## B. 서비스워커 전략

### B1. 리소스 유형별 전략 매핑 (Workbox 기준)
- 규칙/사실: Cache First = "hash-versioned 정적 자산"에 최적("offers a speed boost for immutable assets"). Network First = "HTML이나 API처럼 온라인이면 최신, 오프라인이면 마지막 캐시"에 적합. Stale-While-Revalidate = "최신이 중요하지만 결정적이지 않은 것(아바타 등)". Network Only = 항상 신선해야 하는 것(오프라인 불가). Workbox 기본 캐시 가능 조건: **CacheFirst는 status 200만**, SWR/NetworkFirst는 **0(opaque) 또는 200** — CacheFirst가 무기한 재사용하므로 일시 오류 opaque를 캐시하면 피해가 큼. Serwist(Next.js용)의 `defaultCache`도 같은 매핑: `/_next/static/*.js` → CacheFirst(24h, 64개), 이미지 → SWR(30일, 64개), `RSC: 1` 요청·HTML → NetworkFirst(24h, 32개), `/api/auth/*` → **NetworkOnly**, cross-origin → NetworkFirst(1h, 32개, 10s 타임아웃).
- 적용 제안: `sw.js` 라우팅 표 — `/_next/static/` CacheFirst(30일·200개) / `/_next/image?` SWR / 장소 이미지(Supabase Storage 등) SWR(30일·150개) / 네비게이션·RSC(`RSC: 1` 헤더) NetworkFirst(타임아웃 4–6초, 실패 시 offline.html) / `/api/*` GET NetworkFirst(10s) / 그 외 NetworkOnly.
- 출처: Chrome for Developers — "Caching strategies overview" (Workbox) — https://developer.chrome.com/docs/workbox/caching-strategies-overview — (accessed 2026-09) / Chrome for Developers — "workbox-strategies" — https://developer.chrome.com/docs/workbox/modules/workbox-strategies — (accessed 2026-09) / Chrome for Developers — "workbox-cacheable-response" — https://developer.chrome.com/docs/workbox/modules/workbox-cacheable-response — (accessed 2026-09) / Serwist — `packages/next/src/index.worker.ts` (defaultCache) — https://raw.githubusercontent.com/serwist/serwist/main/packages/next/src/index.worker.ts — (accessed 2026-09)

### B2. Next.js App Router 해시 자산 함정 — "라우트별 청크 목록"을 프리캐시하려 하지 말 것
- 규칙/사실: Next.js 토론(#64336, 미해결): "Next serve the assets through build-generated files… their name is randomly generated at each build" → 라우트가 어떤 청크를 쓰는지 알 수 있는 공식 매니페스트가 없음. 배포 후 예전 청크는 사라지므로 오래된 HTML을 캐시에서 서빙하면 청크 404.
- 적용 제안: 프리캐시는 `offline.html`, 아이콘, 정적 지도 스냅샷, 폰트 등 **URL이 고정된 파일만**. `/_next/static/`은 런타임 CacheFirst(해시가 있으니 안전). 네비게이션 HTML은 항상 NetworkFirst로 두어 새 빌드의 HTML+청크 조합을 받게 하고, 오프라인일 때만 마지막 HTML 캐시→그것도 없으면 `offline.html`. 캐시 이름에 빌드 ID(`process.env.NEXT_PUBLIC_BUILD_ID` 주입)를 넣어 activate 시 구버전 캐시 삭제.
- 출처: GitHub vercel/next.js — Discussion #64336 "Page and assets matching for service worker precache (PWA)" — https://github.com/vercel/next.js/discussions/64336 — (accessed 2026-09) / Serwist defaultCache — (위와 동일)

### B3. Navigation Preload — SW 부팅 지연(모바일 ~250ms) 상쇄
- 규칙/사실: SW 부팅은 "usually around 50ms. On mobile it's more like 250ms. In extreme cases… over 500ms". `activate`에서 `self.registration.navigationPreload.enable()`; fetch 핸들러에서 `event.preloadResponse` 사용. 브라우저는 `Service-Worker-Navigation-Preload: true` 헤더를 붙이므로 서버는 `Vary` 고려. **함정: `event.preloadResponse` 대신 `fetch(event.request)`를 쓰면 네비게이션 요청이 2번 나감.** SSR 앱(web.dev "Server-rendered apps")은 캐시 HTML을 못 주는 대신 반드시 navigation preload로 SW가 네비게이션을 느리게 하지 않게 해야 함.
- 적용 제안: `sw.js`의 navigate 핸들러를 `preloadResponse ?? fetch(request)` → 실패 시 `caches.match(request)` → `offline.html` 순서로. Vercel 응답에 `Vary: Service-Worker-Navigation-Preload`는 필요 시에만.
- 출처: web.dev — "Speed up service worker with navigation preloads" — https://web.dev/blog/navigation-preload — (accessed 2026-09) / web.dev — "Handling navigation requests" — https://web.dev/articles/handling-navigation-requests — (accessed 2026-09)

### B4. SW 업데이트 흐름 — "새 버전" 토스트, `skipWaiting` 남용 금지
- 규칙/사실: 브라우저는 SW 파일을 바이트 단위로 비교해 갱신을 감지하고, 새 SW는 기본적으로 **waiting 상태**에서 대기. `skipWaiting()`을 무조건 호출하면 "old service worker may have handled fetches during page startup, but the new service worker then takes over later on. This can break stuff like lazily-loaded subresources until the next navigation". `activate`에서 허용 목록 기반으로 구 캐시 정리. 사용자 알림 수단: DOM 토스트, 알림 API, Badging API.
- 적용 제안: 페이지에서 `registration.addEventListener('updatefound')` → `installing.state === 'installed' && navigator.serviceWorker.controller`이면 하단 토스트 "New version available — Reload". 탭 시 `postMessage({type:'SKIP_WAITING'})` → SW가 `skipWaiting()` → `controllerchange`에서 `location.reload()` 1회(중복 리로드 가드). 경로 탐색 중에는 토스트를 미루기.
- 출처: web.dev — "Update" (Learn PWA) — https://web.dev/learn/pwa/update — (accessed 2026-09) / Chrome for Developers — "Service worker lifecycle" (Workbox) — https://developer.chrome.com/docs/workbox/service-worker-lifecycle — (accessed 2026-09) / web.dev — "The Offline Cookbook" — https://web.dev/articles/offline-cookbook — (accessed 2026-09)

### B5. 캐시하면 안 되는 것 — 인증·세션·Supabase API·POST
- 규칙/사실: Serwist 기본값은 `/api/auth/*`를 NetworkOnly로 명시 제외하고, 나머지 API는 GET만 NetworkFirst. Workbox는 cross-origin opaque 응답을 CacheFirst에서 기본 제외(위 B1). Cache API는 "doesn't update your assets if you change them on your server nor does it delete them" — 즉 서버가 무효화해 줄 수 없음. 쿠키 세션은 사용자별 응답이므로 캐시하면 다른 사용자/로그아웃 후 데이터 노출 위험(일반 원칙; web.dev "find the balance… without consuming too much data").
- 적용 제안: `sw.js`에서 다음은 `respondWith` 없이 통과(NetworkOnly): `*.supabase.co/auth/v1/*`, `*.supabase.co/rest/v1/*`(사용자 데이터; 오프라인 대응은 IndexedDB 미러로), `/auth/*`, `/login`, `/account`, 모든 non-GET, `Authorization`/`Cookie`가 의미 있는 요청. 로그아웃 시 `caches.delete('user-*')`.
- 출처: Serwist defaultCache — (위와 동일) / web.dev — "Caching" (Learn PWA) — https://web.dev/learn/pwa/caching — (accessed 2026-09) / Chrome for Developers — "workbox-cacheable-response" — (위와 동일)

### B6. 캐시는 저절로 만료되지 않는다 — maxEntries/maxAgeSeconds + purgeOnQuotaError
- 규칙/사실: ExpirationPlugin은 `maxEntries`(LRU: "the entry least-recently requested will be removed… first"), `maxAgeSeconds`, `purgeOnQuotaError`("mark a given cache as being safe to automatically delete in the event of your web app exceeding the available storage"), `matchOptions`. 만료 정리는 IndexedDB 오픈이 느려 **응답을 한 번 쓴 뒤**에 실행되므로 만료 항목이 1회는 서빙될 수 있음. Cache API/IndexedDB 초과 시 `QuotaExceededError`.
- 적용 제안: 손으로 짠 `sw.js`라면 캐시별 메타(`{url, ts}`)를 IndexedDB나 별도 캐시에 두고 `put` 후 비동기 정리 루틴 실행. 타일 캐시는 `purgeOnQuotaError` 동등 동작(quota 에러 시 타일 캐시부터 삭제)을 구현. 큰 캐시 전부 `try/catch`로 `QuotaExceededError` 흡수.
- 출처: Chrome for Developers — "workbox-expiration" — https://developer.chrome.com/docs/workbox/modules/workbox-expiration — (accessed 2026-09) / Chrome for Developers — "Understanding storage quota" — https://developer.chrome.com/docs/workbox/understanding-storage-quota — (accessed 2026-09) / web.dev — "Storage for the web" — https://web.dev/articles/storage-for-the-web — (2024-09-23)

### B7. 오프라인 폴백 — 네비게이션에만 `offline.html`, 설치 의존성 분리
- 규칙/사실: Offline Cookbook "Generic fallback"은 "secondary imagery such as avatars, failed POST requests, and an 'Unavailable while offline' page"에 적합. 설치 시 캐시는 "essential dependencies(실패 시 설치 실패)"와 "non-essential(실패해도 설치 성공)"로 분리, 큰 리소스는 후자로. MDN 예제도 cache→network→`fallbackUrl` 순.
- 적용 제안: `install`에서 `offline.html`, 오프라인용 CSS, 로고, 정적 지도 스냅샷은 `event.waitUntil(cache.addAll(...))`(필수), 폰트·아이콘 세트는 실패 허용. 폴백은 `request.mode === 'navigate'`에만 적용하고, 이미지 실패에는 1×1 placeholder 또는 `Response.error()`.
- 출처: web.dev — "The Offline Cookbook" — https://web.dev/articles/offline-cookbook — (accessed 2026-09) / MDN — "Offline and background operation" — https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Offline_and_background_operation — (accessed 2026-09)

---

## C. 지도 타일·스토리지·정책

### C1. OSM 타일 정책 — 사전 다운로드·오프라인 사용 금지, 7일 캐시·Referer·저작권
- 규칙/사실: tile.openstreetmap.org는 "any pre-emptive fetching of tiles other than those a user is actively viewing"(pre-seeding, 아카이브, 자동 스캔) 금지, "Offline use is not permitted". 캐시는 HTTP 캐시 헤더 준수(헤더를 못 읽으면 **최소 7일**), `no-cache` 헤더를 기본으로 보내지 말 것, 웹페이지는 **유효한 HTTP Referer** 필수(제한적 Referrer-Policy 금지), 가용성은 "best-effort… no SLA", "© OpenStreetMap contributors" 저작권 표시(보통 우하단). 과부하 시 예고 없이 차단.
- 적용 제안: MYSEOULDROP은 CARTO를 쓰므로 **OSM 타일 서버를 폴백으로 붙이지 말 것**(오프라인/사전 캐시가 정책 위반). Referrer-Policy를 `no-referrer`로 설정하지 않기(`strict-origin-when-cross-origin` 이상). 저작권은 지도 위 항상 표시.
- 출처: OpenStreetMap Foundation — "Tile Usage Policy" — https://operations.osmfoundation.org/policies/tiles/ — (accessed 2026-09)

### C2. CARTO 베이스맵 약관 — 월 500만 요청, API 키, **클라이언트 캐시 30일 상한**, 서버 프록시 금지
- 규칙/사실(약관 "Last Updated: August 26, 2026"): 무료 서비스는 "fair use limit of five million (5,000,000) tile requests each calendar month"(모든 API 키 합산). "Customer must always use the Basemap Services with Customer's own unique API keys"; 키 없는 요청에는 "visible watermark" 가능(문서: 래스터 타일에 "API key required" 워터마크). 금지: "caching map content on an end user's device or in an end user's browser for longer than thirty (30) days", "proxying or caching the content on the server side". 저작권: OSM과 CARTO 모두 "prominent and conspicuous". 래스터 URL 형식 `https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png?key=YOUR_KEY`.
- 적용 제안: (1) 타일 URL에 `?key=` 추가(환경변수), (2) `sw.js` 타일 캐시 `maxAgeSeconds`를 **14일**(30일 상한 여유), (3) Vercel 라우트로 타일을 프록시/캐시하는 구조는 **약관 위반이므로 금지**, (4) "서울 전체 오프라인 팩" 같은 대량 사전 다운로드는 하지 말고 **사용자가 실제로 본 타일만 런타임 캐시**, (5) attribution 컨트롤에 OSM+CARTO 링크 둘 다.
- 출처: CARTO — "CARTO Basemaps Terms and Conditions" — https://carto.com/legal/basemap-terms/ — (Last Updated 2026-08-26) / CARTO Docs — "CARTO Basemaps" FAQ — https://docs.carto.com/faqs/carto-basemaps — (accessed 2026-09)

### C3. Opaque 응답 함정 — 타일 1개가 Chrome 쿼터 약 7MB로 계산됨
- 규칙/사실: `no-cors`로 받은 cross-origin 응답(=opaque)은 SW 캐시에 저장 가능하지만 "For Chrome, the minimum size that any single cached opaque response contributes to the overall storage used is approximately 7 megabytes"(정보 유출 방지 패딩). web.dev도 "Some browsers expose large sizes, such as 7Mb no matter if the file is just 1Kb". `estimate()`는 cross-origin 데이터를 "voluntarily pad"하므로 추정치일 뿐.
- 적용 제안: Leaflet `L.tileLayer(url, { crossOrigin: 'anonymous' })`로 타일 `<img>`에 `crossorigin` 속성을 붙여 **CORS 응답(status 200, 실제 크기)**으로 캐시(CARTO CDN이 `Access-Control-Allow-Origin: *`를 주는지 배포 전 curl로 확인 — 본 리서치에서는 검증하지 못함). CORS 불가 시엔 타일 캐시 `maxEntries`를 **≤150**으로 제한(150×7MB≈1GB 가정치)하고 quota 에러 시 타일 캐시 우선 삭제.
- 출처: Chrome for Developers — "Understanding storage quota" — https://developer.chrome.com/docs/workbox/understanding-storage-quota — (accessed 2026-09) / Chrome for Developers — "Caching resources during runtime" — https://developer.chrome.com/docs/workbox/caching-resources-during-runtime — (accessed 2026-09) / web.dev — "Caching" (Learn PWA) — (위와 동일) / Leaflet — Reference (TileLayer `crossOrigin`, `errorTileUrl`) — https://leafletjs.com/reference.html — (accessed 2026-09) / MDN — "Storage quotas and eviction criteria" — https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria — (accessed 2026-09)

### C4. 브라우저별 저장 쿼터·퇴거·`persist()`
- 규칙/사실(MDN): Chrome/Chromium — origin당 **디스크 60%**. Firefox — best-effort는 디스크 10% 또는 **10GiB** 중 작은 값, persistent는 50%(8TiB 상한). Safari(macOS 14+/iOS 17+) — 브라우저 앱 origin당 **약 60%**, 홈 화면 웹앱도 같은 60%, 비브라우저(WKWebView) 15%, 전체 상한 80%/20%. 구형 Safari — 초기 1GiB, 초과 시 사용자에게 200MB 단위로 허가 요청(web.dev). 퇴거: 저장 공간 부족 시 **LRU origin의 데이터 전부** 삭제(Cache+IndexedDB 동시). `navigator.storage.persist()`는 Firefox만 사용자 프롬프트, Safari/Chromium은 "user's history of interaction"에 따라 자동 승인/거절, persist된 origin은 LRU 퇴거에서 제외. `estimate()`는 추정치.
- 적용 제안: 설치(`appinstalled`) 또는 첫 즐겨찾기 저장 시 `navigator.storage.persist()` 호출(결과 로그). 설정 화면에 `estimate()` 기반 "오프라인 데이터 ~xx MB / 지우기" 제공. 타일 캐시 상한(C3)·이미지 캐시 상한을 합쳐 **200–300MB 이내**로 설계해 저사양 기기 LRU 퇴거를 피함.
- 출처: MDN — "Storage quotas and eviction criteria" — (위와 동일) / web.dev — "Storage for the web" — https://web.dev/articles/storage-for-the-web — (2024-09-23) / MDN — "StorageManager: persist()" — https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/persist — (accessed 2026-09)

---

## D. iOS Safari 함정

### D1. ITP 7일 규칙 — 비설치 Safari에서 localStorage/IndexedDB/Cache/SW 등록이 삭제됨
- 규칙/사실: WebKit(2020-03): 스크립트가 쓴 저장소 전부("Indexed DB, LocalStorage, Media keys, SessionStorage, Service Worker registrations and cache")는 "seven days of Safari use without user interaction on the site" 후 삭제. MDN: "If an origin has no user interaction, such as click or tap, in the last seven days of browser use, its data created from script will be deleted. **Cookies set by server are exempt**." **홈 화면 웹앱은 예외**("Their days of use will match actual use of the web application… We do not expect the first-party in such a web application to have its website data deleted"). "7일"은 달력일이 아니라 **Safari를 사용한 날 기준** 7일.
- 적용 제안: 게스트 즐겨찾기/평점이 localStorage에만 있으면 여행 중 며칠 안 쓰다 사라질 수 있음 → (1) 게스트 상태에서 즐겨찾기가 N개 이상이면 "Save to account / Add to Home Screen" 넛지, (2) Supabase 세션은 `@supabase/ssr` 서버 설정 쿠키라 예외 대상(유지됨), (3) 오프라인 캐시가 사라진 뒤 재방문 시 SW 재등록이 자연스럽게 되도록 등록 코드를 매 로드마다 실행.
- 출처: WebKit — "Full Third-Party Cookie Blocking and More" — https://webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/ — (2020-03-24) / MDN — "Storage quotas and eviction criteria" — (위와 동일) / web.dev — "Storage for the web" — (위와 동일)

### D2. Safari ↔ 홈 화면 앱 간 스토리지/쿠키 분리 — "설계상 의도", 로그인 다시 필요
- 규칙/사실: WebKit 버그 181849(NEW)에서 Apple 엔지니어(2022-02-01): "The current behavior (on Apple platforms) is by design. Home Screen apps are created as isolated entities without shared state with the browser." macOS(Dock)는 추가 시점에 **쿠키만 복사**하고 "Safari does not copy over any other kind of local storage… after a user adds a web app to the Dock, no other website data is shared"; iOS에 대해 쿠키 복사가 문서화된 문장은 찾지 못함(위 181849는 iOS 이슈). 추가로 iOS 17.2–18.1에서 홈 화면 웹앱의 **세션 쿠키가 무작위로 이전 값으로 되돌아가는 회귀 버그 272325(P2, NEW, 미해결)** 존재.
- 적용 제안: (1) A2HS 안내 시트에 "앱에서 한 번 더 로그인해야 합니다" 명시, (2) 게스트 localStorage 데이터는 설치 후 앱에서는 안 보이므로, 설치 안내 직전 "Save to account" 유도 또는 서버 저장 후 매직링크/QR로 앱에서 이어받기, (3) Supabase 세션 쿠키가 사라진 요청에 대비해 401 시 조용히 refresh→실패 시 재로그인 유도(272325 대비), (4) `HttpOnly` 쿠키 의존 API 호출 실패를 오프라인 오류로 오인하지 않도록 상태코드 구분.
- 출처: WebKit Bugzilla — "181849 – 'Add to homescreen' apps don't share storage with Safari" — https://bugs.webkit.org/show_bug.cgi?id=181849 — (comment 2022-02-01) / WebKit Bugzilla — "272325 – REGRESSION (iOS 17.x): Session cookies being reset randomly in a Home Screen web app" — https://bugs.webkit.org/show_bug.cgi?id=272325 — (accessed 2026-09) / WebKit — "WebKit Features in Safari 17.0" — https://webkit.org/blog/14445/webkit-features-in-safari-17-0/ — (2023-09) / Apple — WWDC23 "What's new in web apps" — https://developer.apple.com/videos/play/wwdc2023/10120/ — (2023-06)

### D3. Web Push는 iOS 16.4+ **홈 화면 앱에서만**, 사용자 제스처 필수; 18.4부터 Declarative Web Push
- 규칙/사실: "iOS and iPadOS 16.4 add support for Web Push to web apps added to the Home Screen"; 권한 요청은 "in response to direct user interaction — such as tapping on a 'subscribe' button"; manifest `display`가 `standalone` 또는 `fullscreen`이어야 웹앱으로 취급. Badging API도 16.4+. iOS 18.4: "Declarative Web Push is now available on iOS and iPadOS 18.4 for web apps added to the Home Screen" — SW 없이 알림 표시.
- 적용 제안: 향후 "근처 새 매장/세일 알림"을 하려면 iOS는 설치 게이트 뒤에서만 구독 버튼 노출(`display-mode: standalone` && `'PushManager' in window`). 브라우저 탭에서는 버튼 자체를 숨기고 설치 안내로 대체.
- 출처: WebKit — "Web Push for Web Apps on iOS and iPadOS" — https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/ — (2023-02-16) / WebKit — "WebKit Features in Safari 18.4" — https://webkit.org/blog/16574/webkit-features-in-safari-18-4/ — (2025-03) / WebKit — "WebKit Features in Safari 16.4" — (위와 동일)

### D4. `viewport-fit=cover` + `env(safe-area-inset-*)` — `max()`와 `@supports`로
- 규칙/사실: `<meta name="viewport" content="…, viewport-fit=cover">`로 노치/홈 인디케이터 영역까지 사용, `env(safe-area-inset-top|right|bottom|left)`로 되돌림. 기존 패딩을 지키려면 `padding-left: max(12px, env(safe-area-inset-left))`를 `@supports(padding: max(0px)) { … }` 안에 두되 "**not** specify a variable inside your @supports query". `env()` 미지원 브라우저는 해당 규칙을 무시하므로 폴백 규칙을 별도로 유지.
- 적용 제안: 지도 위 FAB/현재위치 버튼 `bottom: max(16px, env(safe-area-inset-bottom))`, 바텀시트 내부 `padding-bottom: env(safe-area-inset-bottom)`, 상단 검색바 `top: env(safe-area-inset-top)`. Leaflet 컨트롤 위치(`.leaflet-bottom`)에도 동일 인셋. `status-bar-style=black-translucent`를 쓴다면 상단 인셋 필수.
- 출처: WebKit — "Designing Websites for iPhone X" — https://webkit.org/blog/7929/designing-websites-for-iphone-x/ — (2017-09)

### D5. `100vh` 대신 `svh`/`dvh` — Safari 15.4+, Chrome 108+, dvh는 60fps로 갱신되지 않음
- 규칙/사실: `svh`=브라우저 UI가 가장 클 때(가장 작은 뷰포트), `lvh`=UI가 접힌 상태(기존 `vh`와 동일), `dvh`=둘 사이에서 동적 변화. 주의: "the values for the dynamic viewport do not update at 60fps. In all browsers updating is throttled as the UA UI expands or retracts". 지원: Safari 15.4+, Chrome 108+, Firefox 101+ (Baseline Widely available 2025-06).
- 적용 제안: 지도 컨테이너 높이는 **`100svh`**(주소창 접힘/펼침에 따라 Leaflet `invalidateSize`가 연속 호출되는 것을 피함) + standalone일 땐 `100dvh`도 무방. 바텀시트 `max-height: 85dvh`. Android Chrome에서 키보드가 올라와도 layout viewport는 안 줄어드는 점(E4)과 함께 검토.
- 출처: web.dev — "The large, small, and dynamic viewport units" — https://web.dev/blog/viewport-units — (accessed 2026-09) / WebKit — "New WebKit Features in Safari 15.4" — https://webkit.org/blog/12445/new-webkit-features-in-safari-15-4/ — (2022-03)

### D6. 입력창 글자 16px 미만이면 iOS가 자동 확대(줌) — `user-scalable=no`로 막지 말 것
- 규칙/사실: "as soon as the `font-size` is 15px or less, the viewport will zoom into that input"; 16px 이상이면 정상 포커스. `maximum-scale=1`/`user-scalable=no`는 접근성(WCAG) 위반이므로 비권장(검색 결과 요약; 1차 근거는 CSS-Tricks 실험).
- 적용 제안: 지도 상단 검색 `<input>`, 로그인 폼, 리뷰 입력에 `font-size: 16px` 고정(`@media (pointer: coarse)`로 터치 기기만 16px 적용 가능). 지도 확대 제스처를 죽이는 viewport 속성 금지.
- 출처: CSS-Tricks — "16px or Larger Text Prevents iOS Form Zoom" — https://css-tricks.com/16px-or-larger-text-prevents-ios-form-zoom/ — (2021-05-04)

### D7. 러버밴딩/풀투리프레시 — `overscroll-behavior`(Safari 16+); `-webkit-overflow-scrolling`은 iOS 13부터 no-op
- 규칙/사실: `overscroll-behavior: contain`은 "no scroll chaining… disables native browser navigation, including the vertical pull-to-refresh gesture and horizontal swipe navigation"; `none`은 바운스까지 제거. iOS Safari 16.0+ 지원(caniuse), Chrome Android·Firefox 59+ 지원. `-webkit-overflow-scrolling: touch`는 iOS 13부터 모멘텀 스크롤이 기본이라 효과 없음(CSS-Tricks 댓글·검색 요약; MDN 페이지는 404).
- 적용 제안: 바텀시트/장소 목록 스크롤 영역에 `overscroll-behavior-y: contain`, `html, body { overscroll-behavior: none }`으로 지도 드래그 중 Android 풀투리프레시·iOS 바운스 차단. 기존 코드의 `-webkit-overflow-scrolling` 제거.
- 출처: MDN — "overscroll-behavior" — https://developer.mozilla.org/en-US/docs/Web/CSS/overscroll-behavior — (accessed 2026-09) / caniuse — "CSS overscroll-behavior" — https://caniuse.com/css-overscroll-behavior — (accessed 2026-09) / WebKit — "WebKit Features in Safari 16.0" — https://webkit.org/blog/13152/webkit-features-in-safari-16-0/ — (2022-09) / CSS-Tricks — "Momentum Scrolling on iOS Overflow Elements" — https://css-tricks.com/snippets/css/momentum-scrolling-on-ios-overflow-elements/ — (accessed 2026-09)

### D8. `navigator.share` — iOS 12.2+, Chrome Android 지원, Firefox 미지원, 반드시 사용자 제스처
- 규칙/사실: "It must be triggered off a UI event like a button click"; HTTPS 필수; `url/text/title/files` 중 최소 1개. caniuse: Safari iOS 12.2+ 지원, Chrome Android 지원, Chrome 데스크톱 128+, Firefox 미지원.
- 적용 제안: 장소 상세 "Share" 버튼 → `navigator.share({title, text, url})`, 미지원/거절 시 클립보드 복사+토스트. `AbortError`(사용자 취소)는 오류로 표시하지 않기.
- 출처: MDN — "Navigator: share() method" — https://developer.mozilla.org/en-US/docs/Web/API/Navigator/share — (accessed 2026-09) / caniuse — "Web Share API" — https://caniuse.com/web-share — (accessed 2026-09)

### D9. standalone 모드의 위치 권한 프롬프트 — 과거 버그 존재, iOS 17+는 앱별 권한
- 규칙/사실: Apple 포럼 보고(iOS 14.7/15.1.1): standalone 홈 화면 앱에서 `getCurrentPosition` 호출 시 "the location alert does not open… And the call never times out… if I switch from the PWA to Safari the location alert / prompt is suddenly showing in Safari"(`browser`/`minimal-ui`는 정상). iOS 17/macOS Sonoma부터는 웹앱이 "camera, microphone, and location access… through system permission prompts and in the Privacy & Security section" 방식으로 앱별 권한을 가짐(WWDC23; iOS에서도 설정 앱에 웹앱 항목).
- 적용 제안: 위치 요청은 **항상 `timeout` 지정**(G2)해 프롬프트가 안 뜨는 상황에서도 UI가 멈추지 않게 하고, 실패 시 "역 이름으로 검색" 폴백. 권한 거부 후 안내 문구는 standalone이면 "Settings ▸ Apps ▸ MYSEOULDROP ▸ Location", 브라우저면 "Settings ▸ Safari ▸ Location"으로 분기.
- 출처: Apple Developer Forums — "Location Alert does not open in PWA" — https://developer.apple.com/forums/thread/694999 — (accessed 2026-09) / Apple — WWDC23 "What's new in web apps" — https://developer.apple.com/videos/play/wwdc2023/10120/ — (2023-06)

---

## E. Android Chrome

### E1. WebAPK — 설치 시 APK 생성, scope URL 인텐트 필터, manifest 변경 체크 **매 1일**
- 규칙/사실: "Chrome automatically generates an APK for you, which we sometimes call a WebAPK" → 런처·앱 설정·인텐트 필터 등록; scope 안 링크를 탭하면 브라우저 탭 대신 앱이 열림. Chrome 76+는 manifest 갱신을 "every 1 day or every 30 days"(서버가 갱신을 못 주면 30일) 체크하고 주요 속성 변경 시 새 APK 생성. 권고: "Don't use the manifest to store user specific identifiers, or other data that might be customized". GMS 없는 기기는 브라우저 뱃지 달린 바로가기로 설치(MDN).
- 적용 제안: manifest URL·`id`·`start_url`·아이콘 파일명을 안정적으로 유지(아이콘 교체 시 파일명 버전업은 OK지만 잦은 변경 지양). `scope: "/"`라 `myseouldrop.com/place/...` 공유 링크가 설치 앱으로 열리는 것을 QA에 포함. manifest에 빌드 해시·사용자 값 넣지 않기.
- 출처: web.dev — "WebAPKs on Android" — https://web.dev/articles/webapks — (accessed 2026-09) / Chrome for Developers — "Updating WebAPKs More Frequently" — https://developer.chrome.com/blog/webapk-update-frequency — (2019-06-13) / MDN — "Making PWAs installable" — (위와 동일)

### E2. `display_override`는 모바일에 불필요 — `standalone` 하나로 충분
- 규칙/사실: `display_override`는 `display`보다 먼저 검토되는 배열이며 `window-controls-overlay`, `tabbed`는 데스크톱 창 기능. 실험적 기능("not Baseline"). Chrome 설치 기준은 `display` 또는 `display_override`에 허용값이 있으면 만족.
- 적용 제안: `"display": "standalone"` 유지, `display_override` 생략(넣더라도 `["standalone"]` 이상 의미 없음). iOS Web Push 요건(`standalone|fullscreen`)과도 일치.
- 출처: MDN — "display_override" — https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/display_override — (accessed 2026-09) / web.dev — "What does it take to be installable?" — (위와 동일)

### E3. Play 스토어 등재를 원하면 TWA — Chrome 72+, Digital Asset Links, 설치 기준 동일
- 규칙/사실: "Trusted Web Activity is available in Chrome on Android, version 72 and above"; 앱과 사이트가 같은 개발자임을 "Digital Asset Links"로 검증; "Trusted Web activities will need to meet the same Add to Home Screen requirements"(Lighthouse 설치 가능 감사 통과); Bubblewrap CLI로 프로젝트 생성.
- 적용 제안: 지금 단계에선 불필요. 나중에 필요 시 `/.well-known/assetlinks.json`을 Vercel `public/`에 두고 Bubblewrap으로 패키징 — 앱 코드 변경 없음.
- 출처: Chrome for Developers — "Trusted Web Activity" — https://developer.chrome.com/docs/android/trusted-web-activity — (accessed 2026-09) / Chrome for Developers — "Trusted Web Activity: Overview" — https://developer.chrome.com/docs/android/trusted-web-activity/overview — (accessed 2026-09)

### E4. Android Chrome 108+ 키보드 뷰포트 동작 — `interactive-widget`
- 규칙/사실: Chrome 108부터 "Chrome on Android will adjust its viewport resize behavior to no longer resize the Layout Viewport when the on-screen keyboard is shown"(iOS Safari와 동일해짐). `<meta name="viewport" … interactive-widget=resizes-visual|resizes-content|overlays-content>`; 기본값 `resizes-visual`. 이전 동작(레이아웃 축소)을 원하면 `resizes-content`.
- 적용 제안: 검색 입력 시 지도가 키보드 뒤로 가려지는 것이 문제라면 `resizes-content`를 검토하되, 그러면 Leaflet이 리사이즈되며 재렌더 비용 발생. 기본값 유지 + 검색 결과 리스트를 `visualViewport` 높이에 맞추는 편이 지도 앱엔 안전.
- 출처: Chrome for Developers — "Prepare for viewport resize behavior changes coming to Chrome on Android" — https://developer.chrome.com/blog/viewport-resize-behavior — (accessed 2026-09)

---

## F. 오프라인 UX

### F1. 오프라인 표시 — `navigator.onLine`은 "힌트"일 뿐, 색만으로 상태 표현 금지
- 규칙/사실: MDN: "this property is inherently unreliable, and you should not disable features based on the online status, only provide hints when the user may seem offline"(LAN 연결만 돼도 true). 변화 시 `window`에 `online`/`offline` 이벤트. web.dev 가이드: 상태 변화를 "as soon as possible" 알리고, "offline"이라는 단어 대신 행동 기반 문구, "Using only color to show state can be hard… express app states in multiple ways".
- 적용 제안: `offline` 이벤트 + 실제 fetch 실패(SW의 `fetch` 예외)를 결합해 상단에 아이콘+텍스트 배지 "Showing saved places · no connection"; 복구 시 토스트 "Back online — refreshing". 기능 비활성화는 하지 않고 시도 후 실패 처리.
- 출처: MDN — "Navigator: onLine property" — https://developer.mozilla.org/en-US/docs/Web/API/Navigator/onLine — (accessed 2026-09) / web.dev — "Offline UX design guidelines" — https://web.dev/articles/offline-ux-design-guidelines — (accessed 2026-09)

### F2. 쓰기 큐(즐겨찾기·평점) — Background Sync는 **iOS Safari·Firefox 미지원**, 앱 시작/online 시 재전송
- 규칙/사실: caniuse — Background Sync: Chrome Android 지원, Samsung Internet 5+ 지원, **Safari iOS 전 버전 미지원**, Firefox 미지원. MDN: sync 등록은 "may only be made while the main app is open", Chrome은 SW가 30초 유휴/`waitUntil` 5분 초과 시 종료. Workbox BackgroundSyncPlugin은 실패 요청을 IndexedDB에 넣고 `sync` 이벤트에 재시도하며, 미지원 브라우저에서는 "automatically attempt a replay whenever your service worker starts up", `maxRetentionTime`(예: 24h)로 보존 기간 제한. web.dev: "Avoid network requests that block content. Let the user continue to browse your app and queue tasks."
- 적용 제안: 즐겨찾기/평점은 **낙관적 UI + IndexedDB 아웃박스**(`{op, placeId, value, ts}`) → `online` 이벤트, `visibilitychange`(foreground), 앱 시작, 그리고 Chromium에서는 `sync` 태그로 재전송. 게스트→로그인 병합 로직과 동일 큐를 재사용. 만료 7일, 충돌은 최신 `ts` 우선.
- 출처: caniuse — "Background Sync API" — https://caniuse.com/background-sync — (accessed 2026-09) / MDN — "Background Synchronization API" — https://developer.mozilla.org/en-US/docs/Web/API/Background_Synchronization_API — (accessed 2026-09) / MDN — "Offline and background operation" — (위와 동일) / Chrome for Developers — "workbox-background-sync" — https://developer.chrome.com/docs/workbox/modules/workbox-background-sync — (accessed 2026-09) / web.dev — "Offline UX design guidelines" — (위와 동일)

### F3. 동기화 상태·"마지막 업데이트" 표시, 오프라인 저장 항목 표시(핀)
- 규칙/사실: web.dev: "Tell the user what state their data is in. For example, you can show whether the app has synced", "Make sure there's a switch or pin to add an item for offline use… Make sure the pin or download UI is obvious", 갱신 완료는 토스트로.
- 적용 제안: 장소 목록 헤더에 "Updated 12 min ago"(IndexedDB 스냅샷 `ts`), 오프라인 시 "Saved on this phone" 라벨. 즐겨찾기 상세는 저장 시 이미지·상세 JSON을 함께 캐시하고 "Available offline" 핀 아이콘 표시.
- 출처: web.dev — "Offline UX design guidelines" — (위와 동일)

### F4. 지도 타일 실패 시 우아한 저하 — `errorTileUrl`, 목록 우선
- 규칙/사실: Leaflet `errorTileUrl`: "URL to the tile image to show in place of the tile that failed to load"; `crossOrigin` 옵션은 타일 `<img>`에 crossorigin 속성 부여. (Leaflet `tileerror` 이벤트는 레퍼런스 추출에서 확인되지 않음 — 코드에서 GridLayer 이벤트 존재 여부를 직접 확인 권장.)
- 적용 제안: `errorTileUrl`에 연한 회색 격자 PNG(인라인 data URI, 사전 캐시) 지정; 일정 비율 이상 타일 실패 시 지도 위에 "Map tiles unavailable — showing saved places" 오버레이 + 마커/목록은 IndexedDB 데이터로 계속 렌더. SSR 정적 지도 스냅샷을 오프라인 폴백 배경으로 재활용.
- 출처: Leaflet — Reference — https://leafletjs.com/reference.html — (accessed 2026-09) / web.dev — "Offline UX design guidelines" — (위와 동일)

### F5. 장소 데이터는 IndexedDB(+Cache Storage)에, localStorage는 SW에서 못 씀
- 규칙/사실: web.dev: Cache Storage는 "network resources… HTML, CSS, JavaScript, images"용, IndexedDB는 "structured data… searchable… user-specific data"용. Web Storage는 "synchronous", "not available within a service worker context", 약 5MB, 문자열만. 모든 저장소는 origin 단위.
- 적용 제안: 장소 목록 API(GET, 공개 데이터)는 SW에서 SWR/NetworkFirst로 캐시하고, 앱에서는 파싱 결과를 IndexedDB `places` 스토어에 저장해 검색/필터를 오프라인에서도 수행. 게스트 즐겨찾기도 장기적으로 localStorage → IndexedDB 이전(D1의 7일 규칙은 둘 다 적용되지만 SW 큐와 공유 가능).
- 출처: web.dev — "Offline data" (Learn PWA) — https://web.dev/learn/pwa/offline-data — (accessed 2026-09)

---

## G. 위치(Geolocation)

### G1. 사용자 제스처에서만 요청, HTTPS 필수, 이유를 먼저 설명 — 수락률 12% → 30%
- 규칙/사실: web.dev: "Always request access to location on a user gesture"; "As of Chrome 50, the Geolocation API only works on secure contexts (HTTPS)". 권한 일반 가이드: 페이지 로드 시 요청은 "asking a customer for sensitive information as they walk into a physical store"; 사전 인터랙션 없는 프롬프트는 **12%** 허용, 제스처 후 **30%**. 거부 후엔 재프롬프트 불가 → "offer a guide on how to change their settings". `navigator.permissions.query()`로 사전 상태 확인.
- 적용 제안: `/map` 진입 시 자동 요청 금지. "Near me" 버튼 탭 → 첫 탭에서만 1줄 설명("Shows K-beauty stores within walking distance") → 요청. `permissions.query({name:'geolocation'})`가 `granted`면 버튼 탭 즉시 위치 표시, `denied`면 버튼을 설정 안내로 전환.
- 출처: web.dev — "User Location" — https://web.dev/articles/user-location — (accessed 2026-09) / web.dev — "Web permissions best practices" — https://web.dev/articles/permissions-best-practices — (accessed 2026-09)

### G2. 옵션 기본값 함정 — `timeout` 기본 **Infinity**, `maximumAge` 기본 0, `enableHighAccuracy` 기본 false
- 규칙/사실(MDN): `timeout` 기본 `Infinity`("won't return until the position is available"), `maximumAge` 기본 `0`(캐시 불허), `enableHighAccuracy: true`는 "slower response times or increased power consumption (with a GPS chip…)". web.dev: "Prefer a coarse location over a fine-grained location", `maximumAge: 5 * 60 * 1000`로 GPS 재가동 회피, 타임아웃 미설정 시 "might never return".
- 적용 제안: 1단계 `{enableHighAccuracy:false, timeout:8000, maximumAge:300000}`로 빠른 대략 위치 → 마커 표시 → 2단계 사용자가 "정확히"를 원하거나 도보 경로를 시작할 때만 `{enableHighAccuracy:true, timeout:15000}`. 타임아웃 시 "역 선택" 폴백(D9 참고).
- 출처: MDN — "Geolocation: getCurrentPosition() method" — https://developer.mozilla.org/en-US/docs/Web/API/Geolocation/getCurrentPosition — (accessed 2026-09) / web.dev — "User Location" — (위와 동일)

### G3. 오류 코드 1/2/3별 복구와 `watchPosition`은 반드시 `clearWatch`
- 규칙/사실(MDN): `1 PERMISSION_DENIED`, `2 POSITION_UNAVAILABLE`("internal sources of position returned an internal error"), `3 TIMEOUT`. `watchPosition()`은 ID를 반환하고 `clearWatch(id)`로 중지; web.dev: "After you no longer need to track the user's position, call `clearWatch` to turn off the geolocation systems"(배터리).
- 적용 제안: 1 → 설정 경로 안내(플랫폼별, D9), 2 → "GPS 신호 없음, 지하철 역 선택으로 대체", 3 → 재시도 1회 후 폴백. 경로 안내 중에만 `watchPosition` 사용하고 `visibilitychange`(hidden)/경로 종료/화면 이탈 시 `clearWatch`. 지도 화면에서 벗어나면 위치 추적을 남기지 않기.
- 출처: MDN — "GeolocationPositionError: code property" — https://developer.mozilla.org/en-US/docs/Web/API/GeolocationPositionError/code — (accessed 2026-09) / MDN — "Using the Geolocation API" — https://developer.mozilla.org/en-US/docs/Web/API/Geolocation_API/Using_the_Geolocation_API — (accessed 2026-09) / web.dev — "User Location" — (위와 동일)

---

## 체크리스트 12항목

1. manifest에 `"id": "/"`, `"scope": "/"`, 192/512 PNG(any) + 512 maskable, `screenshots`(narrow, 320–3840px, 비율 ≤2.3) + `description`(≤324자), `shortcuts` 3개, `categories` 추가.
2. `<link rel="apple-touch-icon" sizes="180x180">` + `apple-mobile-web-app-capable/title/status-bar-style` 메타 존재 확인; iOS용 "Share ▸ Add to Home Screen"(iOS 26: "Open as Web App" 토글) 안내 시트 구현.
3. `beforeinstallprompt`: `preventDefault` → 저장 → 첫 즐겨찾기/경로 성공 후 1회 배너 → `prompt()` 1회 → `appinstalled`/`display-mode: standalone`으로 숨김.
4. `sw.js` 라우팅: `/_next/static` CacheFirst / 이미지 SWR / 네비게이션·RSC NetworkFirst(타임아웃+`offline.html`) / Supabase `auth|rest`·`/login`·non-GET은 NetworkOnly(통과).
5. `activate`에서 `navigationPreload.enable()` + fetch 핸들러에서 `event.preloadResponse` 우선 사용(이중 요청 금지) + 구버전 캐시 삭제.
6. 업데이트 UX: `updatefound`→"New version — Reload" 토스트→`SKIP_WAITING` 메시지→`controllerchange` 1회 리로드(무조건 `skipWaiting` 금지).
7. 타일: CARTO `?key=` 적용, 캐시 `maxAge ≤ 30일`(권장 14일)·`maxEntries` 상한·quota 에러 시 타일 캐시 우선 삭제, 서버 프록시 금지, OSM 타일 폴백 금지, OSM+CARTO attribution 상시 표시.
8. Leaflet `crossOrigin: 'anonymous'`(CARTO CDN CORS 헤더 확인 후)로 opaque 7MB 패딩 회피; 불가 시 타일 `maxEntries ≤ 150`.
9. `navigator.storage.persist()`를 설치/첫 저장 시 호출, 설정 화면에 `estimate()` 기반 사용량·삭제 버튼; 게스트 즐겨찾기 N개↑이면 계정 저장/설치 넛지(ITP 7일 대비).
10. iOS 분리 스토리지 대비: 설치 안내에 "앱에서 다시 로그인" 명시, 게스트 데이터 서버 저장 후 인계, 401 시 조용한 refresh→재로그인 유도.
11. CSS: `viewport-fit=cover` + `max(…, env(safe-area-inset-*))`, 지도 높이 `100svh`, 입력 `font-size:16px`, 리스트/시트 `overscroll-behavior: contain`, `-webkit-overflow-scrolling` 제거, `user-scalable=no` 금지.
12. 오프라인/위치: `online|offline` 이벤트+fetch 실패 결합 배지(아이콘+텍스트), IndexedDB 아웃박스 재전송(iOS는 Background Sync 없음 → 포그라운드/online 시), "Updated N min ago" 표시; 위치는 버튼 탭에서만 `{timeout:8000, maximumAge:300000, enableHighAccuracy:false}` → 오류 1/2/3 분기, `clearWatch` 보장.

---

## 미확인/가져오기 실패 (정직 고지)
- MDN `-webkit-overflow-scrolling` 페이지: 두 URL 모두 404 → iOS 13 no-op 근거는 CSS-Tricks 댓글·검색 요약(2차 출처)로만 확인.
- Apple "Safari 17 Release Notes"(developer.apple.com/documentation/...): 본문이 렌더되지 않아 미확인 → WebKit 블로그·WWDC23 영상 페이지로 대체.
- webkit.org/blog/8042: 잘못된 ID(내용 무관) → 정식 글은 /blog/7929/.
- MDN 호환성 표(Background Sync, overscroll-behavior, Web Share)는 추출되지 않아 caniuse로 버전 확인.
- CARTO `carto.com/attributions` 페이지에는 베이스맵 attribution 문구가 없었음(약관 §13과 FAQ에 "OSM과 CARTO 모두 표기"만 확인).
- CARTO CDN이 타일에 CORS 헤더를 주는지, iOS(홈 화면)에서 추가 시점에 쿠키가 복사되는지는 1차 문서에서 확인하지 못함(macOS Dock만 문서화).