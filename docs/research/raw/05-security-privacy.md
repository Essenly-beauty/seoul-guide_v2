# MYSEOULDROP 웹 보안·인증 UX·개인정보 컴플라이언스 리서치 리포트 (2025–2026 1차 출처 기준)

조사 방식: 아래 모든 규칙은 2026-09-20에 실제로 페이지를 fetch 하여 확인했습니다. 페이지를 가져오지 못했거나 내용이 부족했던 경우는 각 항목과 말미의 "미확인/대체 출처" 절에 명시했습니다. 출처 표기는 `기관 — 페이지 제목(영문) — URL — (날짜 또는 accessed 2026-09)` 입니다.

---

## A. OWASP · 보안 헤더 · CSP

### A1. OWASP Top 10:2025 카테고리를 점검 프레임으로 채택
- **규칙**: 2025 최종판 10개 항목 — A01 Broken Access Control, A02 Security Misconfiguration, A03 Software Supply Chain Failures, A04 Cryptographic Failures, A05 Injection, A06 Insecure Design, A07 Authentication Failures, A08 Software or Data Integrity Failures, A09 Security Logging and Alerting Failures, A10 Mishandling of Exceptional Conditions. A01 예방책: "Except for public resources, deny by default", "enforce record ownership", "Log access control failures, alert admins", "Implement rate limits on API and controller access", "Stateless JWT tokens should be short-lived". A07 예방책: "validate against lists of known breached credentials", NIST 800-63B 5.1.1 정렬, "same messages for all outcomes"(열거 방지), "Limit or increasingly delay failed login attempts".
- **적용 제안**: MYSEOULDROP 보안 점검표를 A01(RLS·소유권), A02(헤더·CSP·Supabase 설정), A03(npm 의존성·GitHub Actions 핀), A07(비밀번호 정책·열거 방지·레이트리밋), A09(client_errors·인증 실패 로깅), A10(에러 핸들링 시 정보 노출) 6축으로 구성. 표(favorites/ratings/profiles/shared_lists)의 모든 정책이 "행 소유권(user_id = auth.uid())" 기준인지 확인.
- **출처**: OWASP — OWASP Top 10:2025 — https://top10.owasp.org/2025 — (accessed 2026-09); OWASP — A01:2025 Broken Access Control — https://top10.owasp.org/2025/A01_2025-Broken_Access_Control/ ; OWASP — A07:2025 Authentication Failures — https://top10.owasp.org/2025/A07_2025-Authentication_Failures/ ; OWASP — OWASP Top Ten (project page) — https://owasp.org/www-project-top-ten/

### A2. 기본 보안 헤더 세트 (정확한 값)
- **규칙(OWASP HTTP Headers CS 권장값)**: `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` / `X-Content-Type-Options: nosniff` / `X-Frame-Options: DENY` / `Referrer-Policy: strict-origin-when-cross-origin` / `Permissions-Policy: geolocation=(), camera=(), microphone=()` / `Cross-Origin-Opener-Policy: same-origin` / `Cross-Origin-Resource-Policy: same-site` / 민감 응답 `Cache-Control: no-store`. 제거: `Server`, `X-Powered-By`. 폐기: `X-XSS-Protection`(0 또는 생략), `Expect-CT`, HPKP. Next.js 문서도 동일 HSTS 값과 `Permissions-Policy: camera=(), microphone=(), geolocation=(), browsing-topics=()` 예시를 제시하되, "X-Frame-Options … has been superseded by CSP's frame-ancestors"라고 명시.
- **적용 제안**: `next.config.js` `headers()`의 `source: '/:path*'`에 위 세트를 추가. 단 지도 앱이므로 `Permissions-Policy`는 `geolocation=(self), camera=(), microphone=(), browsing-topics=()`로(G2 참고). Vercel이 `X-Powered-By`를 붙이는지 `curl -I`로 확인하고 `poweredByHeader: false` 설정. `/api/account/export` 응답에 `Cache-Control: no-store` 필수. COEP(`require-corp`)는 외부 지도 타일/이미지가 깨질 수 있으니 Report-Only 검증 후 도입.
- **출처**: OWASP — HTTP Security Response Headers Cheat Sheet — https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html — (accessed 2026-09); Next.js — headers (next.config.js) — https://nextjs.org/docs/app/api-reference/config/next-config-js/headers — (lastUpdated 2026-06-30)

### A3. CSP: nonce 기반 strict CSP, Report-Only로 롤아웃
- **규칙(OWASP)**: "current leading practice is to create a 'Strict' CSP". 권장: `Content-Security-Policy: script-src 'nonce-{RANDOM}' 'strict-dynamic'; object-src 'none'; base-uri 'none';` 최소 비-strict 기준선: `default-src 'self'; frame-ancestors 'self'; form-action 'self';`. 먼저 `Content-Security-Policy-Report-Only`로 배포 후 enforce. Next.js 공식 예시(middleware/proxy): `default-src 'self'; script-src 'self' 'nonce-${nonce}' 'strict-dynamic'; style-src 'self' 'nonce-${nonce}'; img-src 'self' blob: data:; font-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests;` — 단 "you must use dynamic rendering to add nonces", "Partial Prerendering (PPR) is incompatible with nonce-based CSP", 개발 환경만 `'unsafe-eval'` 필요.
- **적용 제안**: 지도(타일/SDK), Supabase(`connect-src https://<project>.supabase.co wss://…`), 이미지 CDN을 `img-src`/`connect-src`에 명시. 정적 페이지가 많으면 Next.js "Without Nonces" 방식(next.config에서 `'unsafe-inline'` 허용 + `frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'`)으로 시작 → 위반 리포트 수집 → 로그인/계정 페이지만 nonce 적용 검토. CSP matcher는 `_next/static`, `_next/image`, prefetch 요청 제외.
- **출처**: OWASP — Content Security Policy Cheat Sheet — https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html — (accessed 2026-09); Next.js — How to set a Content Security Policy (CSP) — https://nextjs.org/docs/app/guides/content-security-policy — (lastUpdated 2026-03-20)

### A4. CSRF: 상태 변경은 POST + Sec-Fetch-Site/Origin 검증 + SameSite
- **규칙(OWASP)**: "Do not use GET requests for state changing operations." Fetch Metadata: "Servers can use these headers — most importantly `Sec-Fetch-Site` — as a lightweight and reliable method to block obvious cross-site requests" → 비안전 메서드(POST/PUT/PATCH/DELETE)에 `Sec-Fetch-Site: cross-site`면 거부. Origin 검사 시 "make sure the target origin check is strong"(`example.org.attacker.com` 우회 주의). SameSite는 "defense in depth against CSRF, not a replacement". Next.js Server Actions는 자체적으로 "compare the Origin header to the Host header (or X-Forwarded-Host). If these don't match, the request will be aborted."
- **적용 제안**: `POST /api/account/delete`의 same-origin guard가 (1) `Origin`을 정확 일치(`new URL(origin).host === host`, 접두/접미 우회 불가)로 비교하고, (2) `Sec-Fetch-Site`가 `same-origin`/`none`이 아니면 403, (3) Origin 헤더가 아예 없으면 거부하는지 확인. `GET /api/account/export`는 상태 변경이 없으므로 GET 허용 가능하나 `Cache-Control: no-store` + `Sec-Fetch-Site` 검사(XS-Leak 대비, A8). 즐겨찾기/평점 토글이 Route Handler라면 GET으로 상태 변경하지 않는지 점검.
- **출처**: OWASP — Cross-Site Request Forgery Prevention Cheat Sheet — https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html — (accessed 2026-09); Next.js — How to think about data security in Next.js — https://nextjs.org/docs/app/guides/data-security — (lastUpdated 2026-08-25)

### A5. 오픈 리다이렉트: `next`/`redirect_to` 파라미터 허용목록
- **규칙(OWASP)**: "Simply avoid using redirects and forwards" / "do not allow the URL as user input for the destination"; 불가피하면 "have the user provide short name, ID or token which is mapped server-side" 또는 "Sanitize input by creating a list of trusted URLs (lists of hosts or a regex)"(allowlist). Supabase: `redirectTo`는 "should match the Redirect URLs list configuration", Site URL이 기본값, Vercel 프리뷰는 `https://*-<team-or-account-slug>.vercel.app/**` 와일드카드.
- **적용 제안**: 로그인 후 복귀용 `?next=` 값은 `/`로 시작하고 `//`·`\`·`http`로 시작하지 않는 상대경로만 허용(그 외 `/`로 폴백). `/auth/callback`에서 `next` 검증 동일 적용. Supabase 대시보드 Redirect URLs에 프로덕션 도메인 + 프리뷰 와일드카드만 등록되어 있는지 확인(`**` 남용 금지).
- **출처**: OWASP — Unvalidated Redirects and Forwards Cheat Sheet — https://cheatsheetseries.owasp.org/cheatsheets/Unvalidated_Redirects_and_Forwards_Cheat_Sheet.html — (accessed 2026-09); Supabase — Redirect URLs — https://supabase.com/docs/guides/auth/redirect-urls — (accessed 2026-09)

### A6. 입력 검증: 서버측 allowlist, 이메일 길이 254/63, 자유 텍스트 정규화
- **규칙(OWASP)**: 서버측 검증 필수("Client-side validation … cannot be the security layer"), allowlist 우선, 정규식은 `^…$` 전체 매칭. 이메일: `@` 구분 2부분, 위험문자(백틱·따옴표·null) 없음, 도메인은 영숫자·하이픈·마침표, "Local part: max 63 characters", "Total length: max 254 characters", 의미 검증은 "single-use, time-limited tokens (32+ characters)" 확인 메일. 자유 텍스트는 "Normalize to canonical encoding, allowlist Unicode character categories".
- **적용 제안**: `ratings`(리뷰 텍스트), `feedback`, `profiles`(jsonb), `shared_lists` 이름에 서버측(zod 등) 길이 상한·NFC 정규화·허용 문자 카테고리 적용. jsonb `profiles`는 허용 키 스키마를 고정하고 크기 상한(예: 8KB)을 DB `check` 제약으로. `client_errors.message/stack`도 길이 상한(로그 폭주 방지).
- **출처**: OWASP — Input Validation Cheat Sheet — https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html — (accessed 2026-09)

### A7. 로깅: 기록 금지 데이터와 반드시 기록할 이벤트
- **규칙(OWASP)**: 절대 직접 기록 금지 — "Authentication passwords", "Session identification values", "Access tokens", 건강/정부ID, 결제정보, "Database connection strings", "Encryption keys", 사용자가 동의하지 않은 데이터. "Consider" 제외 — 파일 경로, 내부 네트워크 주소, "Non-sensitive personal data (names, phone numbers, email addresses)". 반드시 기록 — 인증 성공/실패("Failed authentication attempts provide critical early indicators"), 인가 실패, 입력 검증 실패. 로그 인젝션 방지: "sanitization on all event data … carriage return (CR), line feed (LF) and delimiter characters".
- **적용 제안**: 자체 에러 리포터가 `client_errors`에 쓰기 전에 URL 쿼리(`?code=`, `access_token`, `#access_token` 프래그먼트), 쿠키, 이메일, 좌표를 마스킹. 스택/메시지에서 CR/LF 제거 및 길이 제한. `client_errors`는 insert-only이므로 SELECT 정책이 없는지 확인(A1/C2). Supabase Auth 로그·Vercel 로그에서 인증 실패 급증 알림(GitHub Actions uptime cron과 별개로) 검토.
- **출처**: OWASP — Logging Cheat Sheet — https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html — (accessed 2026-09)

### A8. XS-Leaks: 인증 응답 `no-store`, COOP, iframe 차단
- **규칙(OWASP)**: `SameSite`(Chromium 기본 `Lax`), `Sec-Fetch-Site === 'cross-site'` → 403, `Sec-Fetch-Dest === 'iframe'` → 403, `frame-ancestors`/`X-Frame-Options`, CORP `same-site|same-origin`, COOP `same-origin`, 민감 리소스 `Cache-Control: no-store`.
- **적용 제안**: `/api/account/export`(JSON 개인정보)·`/api/account/*` 전부 `Cache-Control: no-store` + `Sec-Fetch-Site` 검사. 공개 리뷰 마스킹 뷰 응답은 캐시 가능하나 로그인 사용자 전용 응답과 URL을 분리.
- **출처**: OWASP — Cross-Site Leaks Cheat Sheet — https://cheatsheetseries.owasp.org/cheatsheets/XS_Leaks_Cheat_Sheet.html — (accessed 2026-09)

---

## B. 인증 · 비밀번호 · 세션 (NIST / Supabase)

### B1. NIST SP 800-63B rev.4 비밀번호 규칙(2025-08-26 최종)
- **규칙**: 단일 요소 인증 시 최소 "15 characters", MFA의 한 요소일 때 "minimum of eight characters"; "SHOULD permit a maximum password length of at least 64 characters"; "SHALL NOT impose other composition rules"; "SHALL NOT require subscribers to change passwords periodically"(침해 증거 시 예외); "SHALL compare the prospective secret against a blocklist that contains known commonly used, expected, or compromised passwords"; "SHOULD offer an option to display the password"; "SHOULD permit claimants to use the 'paste' function"; 연속 실패 "100 consecutive failed authentication attempts" 이하로 제한; 미인증자에게 비밀번호 힌트 노출 금지. OWASP Authentication CS도 동일: MFA 없으면 15자 미만은 약함, 64자 이상 허용, "There should be no password composition rules", 유니코드·공백 허용.
- **적용 제안**: 가입/비밀번호 변경 폼: 최소 길이 12–15(현재 정책 확인), 최대 64자 이상(단 Supabase는 bcrypt이므로 72바이트 상한 — B2), 조합 규칙·주기 변경 없음, "Show password" 토글, 붙여넣기 차단 금지. 클라이언트에서 가입 시 HIBP k-anonymity 확인은 Supabase Pro 기능으로 대체 가능(B2).
- **출처**: NIST — SP 800-63B-4 Digital Identity Guidelines: Authentication and Authenticator Management — https://pages.nist.gov/800-63-4/sp800-63b.html — (published 2025-08-26); OWASP — Authentication Cheat Sheet — https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html — (accessed 2026-09)

### B2. Supabase 비밀번호 정책 설정 + 유출 비밀번호 차단(Pro)
- **규칙**: "Set a large minimum password length. Anything less than 8 characters is not recommended." 문자 요건 옵션(숫자/영문/기호) 제공하지만 NIST상 강제하지 않는 것이 맞음. "Leaked password protection is available on the Pro Plan and above" — "uses the open-source HaveIBeenPwned.org Pwned Passwords API". 저장은 "Supabase Auth uses bcrypt". OWASP Password Storage CS: bcrypt는 "password limit of 72 bytes".
- **적용 제안**: 대시보드 Auth > Password 에서 최소 길이 12+ 설정, 문자 조합 요건은 끄기, Pro라면 Leaked password protection ON(아니면 가입 시 클라이언트에서 HIBP range API 확인 고려). 폼에서 72바이트 초과 입력은 명시적으로 안내(멀티바이트 문자 사용 일본/중국/태국 사용자 고려).
- **출처**: Supabase — Password security — https://supabase.com/docs/guides/auth/password-security — (accessed 2026-09); OWASP — Password Storage Cheat Sheet — https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html — (accessed 2026-09)

### B3. 사용자 열거(enumeration) 방지: 로그인·가입·비밀번호 재설정 메시지 통일
- **규칙(OWASP)**: 로그인 실패는 "Login failed; Invalid user ID or password." 하나로, 처리 시간도 일정하게. Forgot Password: "Return a consistent message for both existent and non-existent accounts", "responses return in a consistent amount of time", per-account rate limit, 계정 잠금 금지("enables attackers to deny access"), 재설정 후 자동 로그인 금지, 비밀번호 변경 알림 발송, 기존 세션 무효화 옵션, 보안질문을 단독 수단으로 사용 금지. OWASP Top 10 A07: "same messages for all outcomes".
- **적용 제안**: `/login` 에러 문구 단일화(i18n 6개 언어 모두). `/forgot-password`는 항상 "등록된 이메일이면 링크를 보냈습니다"로 응답. `/signup`은 Supabase 이메일 확인 활성 시 이미 존재하는 이메일의 응답이 구분되는지 실제로 테스트(가입 응답 형태·시간 차이). 비밀번호 변경 시 알림 메일 + "다른 기기 로그아웃"(Supabase `signOut({scope:'others'})` 지원 여부는 본 조사에서 미확인 — 문서 확인 필요).
- **출처**: OWASP — Forgot Password Cheat Sheet — https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html — (accessed 2026-09); OWASP — Authentication Cheat Sheet — https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html

### B4. 레이트리밋: Supabase Auth 기본값 + Vercel WAF
- **규칙(Supabase 기본)**: 이메일 발송 "2 emails per hour with the built-in email provider"; 가입/로그인 "30 requests per 5 minutes"; OTP/매직링크·가입확인·비밀번호재설정 "60 seconds window … for the same user"; 검증 요청 30/5분; 토큰 엔드포인트(password, refresh, PKCE) "150 requests per 5 minutes"; 익명 로그인 "30 requests per hour"; MFA 15/분(고정). Vercel WAF Rate Limiting: Hobby도 사용 가능(규칙 1개/프로젝트, 키 IP·JA4, 창 10s–10min, 기본 60s/100req, 액션 429/Log/Deny/Challenge), Pro 40개 규칙, "Rate limit counters are tracked on a per-region basis".
- **적용 제안**: `/api/account/delete`, `/api/account/export`, 로그인·가입 경로에 WAF 규칙(예: IP당 60초 20회 → Challenge). Supabase 대시보드에서 이메일 레이트리밋은 커스텀 SMTP 후 조정(B9). 즐겨찾기/평점 insert에 per-user DB 제약(예: 동일 place 1행 unique) 도 남용 방지에 도움.
- **출처**: Supabase — Rate limits — https://supabase.com/docs/guides/auth/rate-limits — (accessed 2026-09); Vercel — WAF Rate Limiting — https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting — (last_updated 2026-08-28)

### B5. 가입/로그인/재설정 CAPTCHA(Turnstile) 또는 Vercel BotID
- **규칙**: Supabase는 "hCaptcha"와 "Cloudflare Turnstile" 지원, "adding CAPTCHA to your sign-in, sign-up, and password reset forms", `supabase.auth.signUp({ email, password, options: { captchaToken } })`. Vercel BotID: "invisible CAPTCHA … without showing visible challenges", Basic "free of charge for all plans", Deep Analysis(Kasada) Pro "$1/1000 checkBotId() Deep Analysis calls". web.dev 가입 가이드: "Avoid CAPTCHA unless necessary".
- **적용 제안**: 관광객 UX상 보이지 않는 방식 우선 — Supabase Auth에 Turnstile(관리형 모드)을 켜고 signUp/signInWithPassword/resetPasswordForEmail에 `captchaToken` 전달. Route Handler(`/api/account/*`)는 Vercel BotID Basic으로 보완 가능. 익명 로그인 도입 시(B11) 캡차 필수.
- **출처**: Supabase — Enable Captcha Protection — https://supabase.com/docs/guides/auth/auth-captcha — (accessed 2026-09); Vercel — BotID — https://vercel.com/docs/botid — (last_updated 2026-06-16); web.dev — Sign-up form best practices — https://web.dev/articles/sign-up-form-best-practices

### B6. 세션 수명·쿠키 속성·로그아웃
- **규칙**: OWASP Session Management: 세션ID 엔트로피 64비트 이상, `Secure`+`HttpOnly`+`SameSite=Strict|Lax`, `__Host-` 접두사 권장, 유휴 타임아웃 저위험 앱 15–30분, 절대 타임아웃 4–8시간, 로그인 후 세션ID 재발급, 로그아웃 시 서버측 무효화 + `Clear-Site-Data: "cache", "cookies", "storage"` 고려. Supabase: 액세스 토큰 기본 1시간(1시간 초과 비권장, "values below 5 minutes … should not be used"), 리프레시 토큰 1회용(재사용 허용창 "By default this is 10 seconds", 초과 재사용 시 세션 종료), Time-box/Inactivity timeout/Single session per user는 Pro 이상. `@supabase/ssr`의 `setAll`은 세션 캐싱 방지를 위해 `Cache-Control`/`Expires`/`Pragma`를 설정. OWASP A01: "Stateless JWT tokens should be short-lived".
- **적용 제안**: JWT 만료 1시간 유지. Pro라면 Inactivity timeout(예: 30일)과 Time-box(예: 90일) 설정 — 관광객은 단기 방문이므로 긴 절대 만료는 불필요. 로그아웃 시 `signOut()` 후 localStorage 게스트 데이터도 정리(Clear-Site-Data 헤더 검토). Supabase SSR 쿠키의 `SameSite`/`Secure` 실제 값을 브라우저 devtools에서 확인(본 조사에서 기본값은 미확인).
- **출처**: OWASP — Session Management Cheat Sheet — https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html — (accessed 2026-09); Supabase — User sessions — https://supabase.com/docs/guides/auth/sessions — (accessed 2026-09)

### B7. 서버측 검증: `getSession()` 금지, `getClaims()`/`getUser()` 사용, Next.js 15는 `middleware.ts`
- **규칙(Supabase)**: "*Never* trust `supabase.auth.getSession()` inside server code such as Proxy. It reads the session out of the cookie without revalidating it." "Always use `supabase.auth.getClaims()` to protect pages and user data." — "`getClaims()` verifies the token's signature on every call"(비대칭 키면 로컬, 대칭 키면 Auth 서버). `getUser()`는 "when you need an up-to-date user record from the Auth server". 미들웨어 역할: "Refreshing the Auth token by calling `supabase.auth.getClaims()`; Passing the refreshed Auth token to Server Components". 파일명: "On Next.js 15 and earlier, a `proxy.ts` file is never called … Before that, it's `middleware.ts`".
- **적용 제안**: 컨텍스트상 "getUser vs getSession" 패턴을 쓰고 있다면 OK(getUser는 매 호출 네트워크). 프로젝트가 JWT Signing Keys(비대칭)로 전환되어 있으면 `getClaims()`로 바꿔 지연 감소. 삭제/내보내기 Route Handler에서는 즉시 무효화(밴·삭제)를 반영해야 하므로 `getUser()` 유지가 합리적. Next.js 16 업그레이드 시 `middleware.ts → proxy.ts` 리네임 필수.
- **출처**: Supabase — Setting up Server-Side Auth for Next.js — https://supabase.com/docs/guides/auth/server-side/nextjs — (accessed 2026-09); Supabase — Creating a Supabase client for SSR — https://supabase.com/docs/guides/auth/server-side/creating-a-client — (accessed 2026-09)

### B8. PKCE 콜백: 코드 5분·1회 교환·같은 브라우저
- **규칙(Supabase)**: "the code has a validity of 5 minutes and can only be exchanged for an access token once"; "the code exchange must be initiated on the same browser and device where the flow was started"(code verifier가 로컬 저장). SSR/모바일에 적합.
- **적용 제안**: `/auth/callback` Route Handler에서 `exchangeCodeForSession(code)` 실패 시(다른 브라우저에서 이메일 링크 열기 — 관광객이 호텔 PC로 여는 사례) 명확한 에러 페이지와 "같은 기기에서 다시 시도" 안내. 이메일 확인 링크는 사용자가 다른 기기에서 열 가능성이 높으므로 필요하면 OTP 코드 입력 방식(`verifyOtp`) 병행 검토.
- **출처**: Supabase — PKCE flow — https://supabase.com/docs/guides/auth/sessions/pkce-flow — (accessed 2026-09)

### B9. 커스텀 SMTP 필수 + SPF/DKIM/DMARC
- **규칙(Supabase)**: 기본 SMTP는 "2 messages per hour", 팀 멤버 등 승인된 주소 외 "Email address not authorized", "provided as best-effort only". 커스텀 SMTP 설정 직후 "a low rate-limit of 30 messages per hour is imposed". "configure DKIM, DMARC and SPF for your sending domain". 프로덕션 체크리스트: "Use a custom SMTP server for auth emails … from a trusted domain (preferably the same domain that your app is hosted on)". 지원 예: Resend, AWS SES, Postmark, SendGrid, ZeptoMail, Brevo.
- **적용 제안**: 이미 이메일 확인이 켜져 있으므로 커스텀 SMTP가 아니면 실제 관광객 가입이 막힘 — 즉시 확인. 발신 도메인은 앱 도메인(예: `auth@myseouldrop.com`), 대시보드 이메일 레이트리밋을 트래픽에 맞게 상향.
- **출처**: Supabase — Send emails with custom SMTP — https://supabase.com/docs/guides/auth/auth-smtp — (accessed 2026-09); Supabase — Production Checklist — https://supabase.com/docs/guides/deployment/going-into-prod — (accessed 2026-09)

### B10. 재인증 후 민감 작업(계정 삭제·이메일 변경)
- **규칙(OWASP Authentication CS)**: 민감 계정 정보 변경/민감 트랜잭션 전에 현재 자격증명 재검증 요구(CSRF·세션 탈취 완화). Forgot Password: 비밀번호 변경 시 사용자에게 통지, 기존 세션 무효화 허용.
- **적용 제안**: `POST /api/account/delete`는 (1) `getUser()`로 서버 검증, (2) 최근 인증(예: 5분 내 로그인/비밀번호 재입력 또는 OAuth 재로그인) 요구, (3) 확인 문구 입력, (4) 완료 메일 통지. 삭제 후 localStorage 게스트 데이터도 제거.
- **출처**: OWASP — Authentication Cheat Sheet — https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html — (accessed 2026-09); OWASP — Forgot Password Cheat Sheet — https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html

### B11. localStorage 게스트 모드 대안: Supabase 익명 로그인
- **규칙(Supabase)**: `signInAnonymously()`로 PII 없이 인증 세션 생성; 단 "can't access their account if they sign out, clear browsing data, or use another device". 영구 전환은 `updateUser({email})`(확인 필요) 또는 `linkIdentity()`(Google OAuth). JWT에 `is_anonymous` 클레임 → RLS 예: `with check ((select (auth.jwt()->>'is_anonymous')::boolean) is false)`. 남용 방지: "invisible CAPTCHA or Cloudflare Turnstile" 강력 권장, IP당 "30 requests per hour". 자동 삭제 없음 — 30일 지난 익명 사용자 SQL로 수동 정리. Security Advisor lint `auth_allow_anonymous_sign_ins`(0012)가 경고를 띄움.
- **적용 제안**: 현 구조(localStorage → 로그인 시 merge)는 서버 부하·남용 위험이 없고 PIPA/GDPR 관점에서도 데이터 최소화에 유리. 익명 로그인은 "기기 간 동기화 없이 서버 저장이 필요할 때"만 검토. 도입 시 `favorites`/`ratings` 정책에 `is_anonymous` 분기(예: 익명은 favorites만, 공개 리뷰는 불가)와 Turnstile·정리 크론(GitHub Actions에 추가) 필수.
- **출처**: Supabase — Anonymous Sign-Ins — https://supabase.com/docs/guides/auth/auth-anonymous — (accessed 2026-09); Supabase — Database Advisors (Security lints) — https://supabase.com/docs/guides/database/database-advisors

### B12. 패스키(WebAuthn) — 로드맵
- **규칙(web.dev)**: "The private key issues a signature after user verification on the valid domain making passkeys phishing resistant"; 등록은 `navigator.credentials.create()` + `requireResidentKey: true`, `userVerification: "preferred"`; 생성 유도 시점은 "After signing in" 또는 전용 관리 페이지.
- **적용 제안**: 현재 Supabase Auth의 네이티브 패스키 지원 여부는 본 조사에서 확인하지 못함 → 로드맵 항목. 단기적으로는 Google OAuth(이미 있음) + 이메일 OTP가 관광객에게 가장 낮은 마찰.
- **출처**: web.dev — Create a passkey for passwordless logins — https://web.dev/articles/passkey-registration — (accessed 2026-09)

---

## C. Supabase RLS · DB

### C1. RLS 성능·정확성 규칙: `(select auth.uid())`, 인덱스, `to authenticated`
- **규칙(Supabase)**: "Enable RLS on every table in an exposed schema." "Grants decide whether a role can run an operation on the table at all. Policies decide which rows." "Always name the role a policy applies to, using the `to` clause." `(select auth.uid())`로 감싸면 per-row가 아니라 per-statement 캐시. "Add an index on every column your policies filter on … an unindexed filter column turns a read into a sequential scan." 순환 정책은 security definer 함수로 해소. "Creating an RLS policy that relies on the `user_metadata` claim can create security issues" → `raw_app_meta_data` 사용. Security Advisor lint: `auth_rls_initplan`(0003), `rls_disabled_in_public`(0013), `policy_exists_rls_disabled`(0007), `multiple_permissive_policies`(0006), `permissive_rls_policy`(0024), `rls_references_user_metadata`(0015), `sensitive_columns_exposed`(0023).
- **적용 제안**: favorites/ratings/profiles/shared_lists/feedback/client_errors 모든 정책을 `to authenticated using ((select auth.uid()) = user_id)` 형태로 통일하고 `user_id` 컬럼에 인덱스. `shared_lists`의 공개 조회 정책은 `to anon, authenticated`로 명시. 대시보드 Security Advisor 경고 0건을 CI 목표로(Supabase CLI `supabase inspect`/linter 활용).
- **출처**: Supabase — Row Level Security — https://supabase.com/docs/guides/database/postgres/row-level-security — (accessed 2026-09); Supabase — Database Advisors — https://supabase.com/docs/guides/database/database-advisors — (accessed 2026-09)

### C2. 뷰·insert-only 테이블의 함정
- **규칙(Supabase)**: "Views bypass RLS by default because they are usually created with the `postgres` user" → Postgres 15+ `security_invoker = true`. lint `security_definer_view`(0010), `auth_users_exposed`(0002: "User data exposed through a view"). `rls_enabled_no_policy`(0008)는 모든 API 접근 차단 상태를 의미.
- **적용 제안**: 공개 리뷰 마스킹 뷰: `security_invoker=true`로 만들면 기반 `ratings` RLS가 적용되어 공개 조회가 막힐 수 있으므로, (a) 뷰를 security definer로 두되 `auth.users`를 조인하지 않고 PII(이메일·전체 이름) 컬럼을 절대 노출하지 않으며 `anon`에게 뷰 SELECT만 grant, 또는 (b) `ratings`에 `is_public` 행에 대한 `anon` SELECT 정책 + `security_invoker` 뷰 — 둘 중 하나로 명시적 설계. `feedback`/`client_errors`: `anon`/`authenticated`에 INSERT grant + `with check` 정책만, SELECT/UPDATE/DELETE grant 없음 확인.
- **출처**: Supabase — Row Level Security — https://supabase.com/docs/guides/database/postgres/row-level-security ; Supabase — Database Advisors — https://supabase.com/docs/guides/database/database-advisors

### C3. 계정 삭제: `service_role` 서버 전용 + FK `on delete cascade`
- **규칙(Supabase)**: `auth.admin.deleteUser` — "Requires a `service_role` key", "This function should only be called on a server. Never expose your `service_role` key in the browser", `shouldSoftDelete` 기본 false. 사용자 테이블은 "id uuid not null references auth.users on delete cascade"; "For security, the Auth schema is not exposed in the auto-generated API". FK는 primary key만 참조(lint `fkey_to_auth_unique` 0021).
- **적용 제안**: favorites/ratings/profiles/shared_lists/feedback(user_id nullable이면 `on delete set null`)의 FK가 모두 `auth.users(id) on delete cascade`인지 마이그레이션에서 확인. `POST /api/account/delete` 후 `SELECT count(*)` 검증 테스트(e2e). `SUPABASE_SERVICE_ROLE_KEY`는 `server-only` 모듈(D2)에서만 `process.env` 접근. 삭제 전 export 유도(GDPR 포터빌리티, F2).
- **출처**: Supabase — auth.admin.deleteUser — https://supabase.com/docs/reference/javascript/auth-admin-deleteuser — (accessed 2026-09); Supabase — User Management — https://supabase.com/docs/guides/auth/managing-user-data — (accessed 2026-09)

### C4. Supabase 프로덕션 체크리스트(보안)
- **규칙**: "enabled row level security (RLS) on all tables"; "review issues … using Security Advisor"; "Turn on SSL Enforcement"; "Enable Network Restrictions"; "protect your Supabase Account with multi-factor authentication (MFA)"; 조직 MFA 강제·복수 Owner 고려; "Enable email confirmations"; "Set the expiry … for one-time passwords (OTPs) to a reasonable value"; 커스텀 SMTP; "Consider how you might abuse your service as an attacker".
- **적용 제안**: 대시보드에서 SSL Enforcement·Network Restrictions(Vercel은 고정 IP가 아니므로 DB 직접 접속용 IP만 제한, API는 영향 없음)·Owner 2인·계정 MFA 즉시 설정. OTP 만료는 기본값 확인 후 1시간 이하로.
- **출처**: Supabase — Production Checklist — https://supabase.com/docs/guides/deployment/going-into-prod — (accessed 2026-09); Supabase — Security (overview) — https://supabase.com/docs/guides/security/product-security

---

## D. Next.js 특유 보안

### D1. CVE-2025-29927 미들웨어 우회 — 버전 고정 + 미들웨어 단독 의존 금지
- **규칙(Vercel 포스트모템 2025-03-25)**: "Next.js uses an internal `x-middleware-subrequest` header to detect and prevent recursion—and bypass the execution of Middleware." 패치: 15.2.3(3/18), 14.2.25(3/17), 13.5.9, 12.3.5. Vercel 호스팅은 "incidentally invulnerable"(라우팅 로직이 분리 실행). 우회 불가 시 "filtering out the header before it hit the Next.js server". "We do not recommend Middleware to be the sole method of protecting routes in your application."
- **적용 제안**: `package.json` Next.js ≥ 15.2.3 확인(Dependabot/Renovate로 보안 패치 자동화 — OWASP A03). 미들웨어는 세션 리프레시·UX 리다이렉트만 담당하고, 실제 인가는 Route Handler·Server Component의 DAL에서 `getUser()`/RLS로 수행(이미 그렇다면 확인만).
- **출처**: Vercel — Postmortem on Next.js Middleware bypass — https://vercel.com/blog/postmortem-on-next-js-middleware-bypass — (2025-03-25; nextjs.org/blog/cve-2025-29927에서 리다이렉트)

### D2. 데이터 보안: `server-only` DAL, 최소 DTO, 액션 내부 재인가, params 검증
- **규칙(Next.js)**: DAL은 "Only run on the server. Perform authorization checks. Return safe, minimal DTOs"; "only the Data Access Layer should access `process.env`"; `import 'server-only'`; 클라이언트 컴포넌트에 전체 행 전달 금지("EXPOSED: This exposes all the fields"); Server Action은 "reachable via direct POST requests and verify authentication and authorization inside each one"; 소유권(IDOR) 체크; 반환값은 "Only return what the UI needs, not raw database records"; `searchParams`/`[param]`은 사용자 입력; 렌더 중 쿠키 삭제 등 부작용 금지; 감사 포인트로 "`proxy.ts` and `route.ts`: Have a lot of power. Spend extra time auditing these".
- **적용 제안**: `lib/data/*`에 `import 'server-only'`와 `SUPABASE_SERVICE_ROLE_KEY` 접근을 집중. `/api/account/export`는 테이블 전체 행이 아니라 사용자 소유 행만, 그리고 내부 컬럼(예: `client_errors`의 IP/UA)을 포함할지 명시 결정. 장소 상세 `[slug]`·공유 리스트 `[id]` 파라미터는 형식 검증(uuid/slug 정규식). `NEXT_PUBLIC_` 접두 변수에 비밀이 없는지 grep.
- **출처**: Next.js — How to think about data security in Next.js — https://nextjs.org/docs/app/guides/data-security — (lastUpdated 2026-08-25)

### D3. Vercel Firewall·Bot 보호 활용
- **규칙(Vercel)**: 플랫폼 DDoS 완화는 "available for free for all customers without any configuration"; 실행 순서 DDoS → IP 차단 → 커스텀 규칙 → Managed Rulesets; Log Drains로 SIEM 연동. BotID Basic 무료, Deep Analysis Pro 유료(B5). WAF 레이트리밋 Hobby 1규칙(B4).
- **적용 제안**: 무료 범위에서 (1) `/api/account/*` 레이트리밋 1규칙, (2) Firewall 알림 설정. Pro 전환 시 Bot Protection managed ruleset + BotID Deep Analysis를 가입 폼에.
- **출처**: Vercel — Vercel Firewall — https://vercel.com/docs/vercel-firewall — (last_updated 2026-09-10); Vercel — BotID — https://vercel.com/docs/botid — (2026-06-16); Vercel — WAF Rate Limiting — https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting — (2026-08-28)

---

## E. 로그인/가입 폼 UX (web.dev)

### E1. 시맨틱 폼 + autocomplete 속성
- **규칙(web.dev)**: "Use meaningful HTML elements: `<form>`, `<input>`, `<label>`, and `<button>`"; div로 감싸면 "problems for browser password managers and autofill"; 이메일 `type="email"` + `autocomplete="username"`; 로그인 비밀번호 `autocomplete="current-password"`, 가입/재설정 `autocomplete="new-password"`; `required` 사용; 플레이스홀더를 라벨로 쓰지 말 것; 페이지 전체를 하나의 `<form>`으로 감싸지 말 것.
- **적용 제안**: `/login`, `/signup`, `/forgot-password`, `/reset-password` 4개 폼의 input에 위 속성 부여(React 19 `<form action>` 사용 시에도 동일). 재설정 폼의 새 비밀번호 필드는 `id="new-password"`.
- **출처**: web.dev — Sign-in form best practices — https://web.dev/articles/sign-in-form-best-practices — (accessed 2026-09)

### E2. 비밀번호 표시 토글, 중복 입력 금지, 붙여넣기 허용, 모바일 터치
- **규칙(web.dev)**: "usability suffers when users can't see the text they've entered" → Show password 토글(+`aria-label`); "Don't double up inputs"(이메일/비밀번호 재입력은 "increases abandonment rates"); 붙여넣기 차단은 "may actually reduce security"; 모바일 input/button에 "about 15 px of padding", 폰트 "20px", 키보드가 제출 버튼을 가리지 않게, 테두리 `#ccc` 이상. NIST: "SHOULD offer an option to display the password", 붙여넣기 허용.
- **적용 제안**: OWASP Forgot Password CS는 "confirm new passwords twice"를 권하지만 web.dev/NIST는 표시 토글로 대체를 권장 → MYSEOULDROP은 모바일 우선이므로 단일 입력 + 표시 토글 채택. 6개 언어 `aria-label` 번역.
- **출처**: web.dev — Sign-in form best practices — https://web.dev/articles/sign-in-form-best-practices ; web.dev — Sign-up form best practices — https://web.dev/articles/sign-up-form-best-practices — (accessed 2026-09); NIST — SP 800-63B-4 — https://pages.nist.gov/800-63-4/sp800-63b.html

### E3. 가입 폼: 최소 정보, 유출 비밀번호 거부, 소셜 로그인 병행
- **규칙(web.dev)**: "ask for as little as possible"; "you should never allow passwords that have been exposed in security breaches"(HIBP); 임의 조합 규칙 금지(NIST 따르기); 인라인 검증; 제3자 로그인 제공; 민감 데이터면 MFA.
- **적용 제안**: 가입 시 이메일+비밀번호만(이름·국적은 프로필에서 선택 입력). Google 버튼을 최상단에. Supabase Leaked password protection(B2). 국가/언어는 브라우저 `Accept-Language`로 추론하되 저장하지 않음(데이터 최소화).
- **출처**: web.dev — Sign-up form best practices — https://web.dev/articles/sign-up-form-best-practices — (accessed 2026-09)

### E4. 제출 후 처리·중복 제출·서버 검증
- **규칙(web.dev)**: 제출 확인은 "Navigate to a different page" 또는 `History.pushState()`로 폼 제거; "users click buttons multiple times" 방지 위해 제출 후 비활성화(입력 대기 중엔 비활성화 금지); `:invalid` 셀렉터로 하이라이트; "You must always validate and sanitize data on your backend".
- **적용 제안**: React 19 `useActionState`/`pending`으로 버튼 비활성화, 성공 시 `router.replace('/')`로 비밀번호 폼 제거(뒤로가기 시 재제출 방지).
- **출처**: web.dev — Sign-in form best practices — https://web.dev/articles/sign-in-form-best-practices

---

## F. 개인정보 · 동의 · 법규 (GDPR / PIPA / OAuth 정책)

### F1. GDPR 적용 여부와 7원칙·6가지 적법 근거
- **규칙**: Art. 3(2) "This Regulation applies to the processing of personal data of data subjects who are in the Union by a controller or processor not established in the Union, where the processing activities are related to: (a) the offering of goods or services, irrespective of whether a payment of the data subject is required … or (b) the monitoring of their behaviour". 7원칙(적법·공정·투명, 목적 제한, 데이터 최소화, 정확성, 보관 제한, 무결성·기밀성, 책임성). 적법 근거 6개(동의, 계약 이행, 법적 의무, 생명 보호, 공익, 정당한 이익). 8개 권리(정보, 접근, 정정, 삭제, 제한, 이동, 반대, 자동화 결정). 침해 통지 "72 hours". 과징금 "€20 million or 4% of global revenue".
- **적용 제안**: 서비스가 EU 관광객을 명시적으로 겨냥(영어·EU 언어·유로 표기 없음이라도 "Seoul for foreign tourists"로 홍보)하므로 Art.3(2)(a) 적용 가능성이 높다고 보고 준비. 근거 매핑: 계정·즐겨찾기·평점 = 계약 이행(서비스 제공), 에러 리포팅 = 정당한 이익, 분석/마케팅 쿠키 = 동의. 저장 기간(예: 삭제 요청 즉시, 비활성 계정 N년) 문서화.
- **출처**: gdpr.eu (Proton) — What is GDPR, the EU's new Data Protection Law? — https://gdpr.eu/what-is-gdpr/ — (accessed 2026-09); gdpr-info.eu — Art. 3 GDPR Territorial scope — https://gdpr-info.eu/art-3-gdpr/ — (accessed 2026-09; gdpr.eu의 Art.3 페이지는 404)

### F2. 개인정보처리방침(Privacy Notice) 필수 항목 — GDPR Art.13 + PIPA Art.30
- **규칙(GDPR)**: 관리자 신원·연락처(DPO 있으면), 목적과 법적 근거(정당한 이익 포함), 수령자, "any transfer of personal data to a third country and the safeguards taken", 보관 기간 또는 기준, 각 권리, 동의 철회권, "The right to lodge a complaint with a supervisory authority", 제공이 법정/계약상 요건인지와 미제공 결과, 자동화 결정 여부; "In a concise, transparent, intelligible, and easily accessible form … clear and plain language". PIPA Art.30(1)은 개인정보 처리방침 수립·공개 의무이며 검색 요약에 따르면 국외이전 사항도 30(1)(viii)에 포함(원문 미확인 — 아래 미확인 절 참고).
- **적용 제안**: `/privacy` 페이지를 영/일/중(간·번)/태 6개 언어로, 표 형태(항목·목적·근거·보관·수령자[Supabase(호스팅 리전 명시), Vercel, Google OAuth, SMTP 벤더]·국외이전). 이미 존재하는 export/delete 기능을 "권리 행사 방법"으로 링크. 감독기관 진정권(EU 거주자: 각국 DPA / 한국: PIPC) 명시.
- **출처**: gdpr.eu — Writing a GDPR-compliant privacy notice (template included) — https://gdpr.eu/privacy-notice/ — (accessed 2026-09); Baker McKenzie — South Korea Issues Guidelines on Applying the PIPA to Foreign Business Operators — https://connectontech.bakermckenzie.com/south-korea-issues-guidelines-on-applying-the-personal-information-protection-act-to-foreign-business-operators/ — (2024-04-04)

### F3. 쿠키/저장소 동의: 필수 쿠키만 동의 면제, 분석·마케팅은 사전 동의
- **규칙(gdpr.eu, ePrivacy)**: 비필수(분석·통계, 마케팅·광고, 선호) 쿠키는 사전 동의 필요; 엄격히 필요한 쿠키는 면제되나 "what they do and why they are necessary should be explained to the user"; "Provide accurate and specific information … in plain language before consent is received"; "Document and store consent"; "Allow users to access your service even if they refuse"; "Make it as easy for users to withdraw their consent as it was for them to give".
- **적용 제안**: 현재 쿠키는 Supabase 인증 세션(필수)뿐이면 배너 불필요 — 대신 프라이버시 페이지에 "필수 쿠키 목록" 표기. Vercel Analytics/Speed Insights/GA 등을 켜면 EU 방문자에게 사전 opt-in 배너 필요(거부해도 지도 사용 가능해야 함). 게스트 모드 localStorage는 사용자가 요청한 기능(즐겨찾기) 제공에 필요한 저장으로 정리하되, 이 판단은 gdpr.eu 페이지가 localStorage를 직접 다루지 않으므로 법률 검토 표시.
- **출처**: gdpr.eu — Cookies, the GDPR, and the ePrivacy Directive — https://gdpr.eu/cookies/ — (accessed 2026-09)

### F4. 한국 PIPA(한국 운영자) 핵심 의무: 동의 항목·최소수집·파기·국외이전·72시간
- **규칙**: Art.15 동의 시 고지 "(1) The purpose of the collection and use … (2) Particulars of personal information to be collected; (3) The period for retaining and using … (4) The fact that the data subject is entitled to deny consent, and disadvantages". Art.22 "each matter requiring consent is distinctly presented"(수집/제공/목적외/마케팅 분리 동의). Art.16(1) 최소 수집. Art.21 "destroy personal information without delay when … unnecessary", 복구 불가 조치. Art.28-8(1) 국외이전 적법 근거: 별도 동의, 법령·조약, 계약 이행에 필요한 처리위탁·보관(처리방침 고지), PIPC 인증, PIPC 적정성 결정(2025-09-16 EU/EEA만 인정). 28-8(2) 동의 시 고지 6항목: 이전받는 자와 연락처, 이전 국가, 목적, 항목, 보유기간, 거부권·불이익. DLA Piper: 유출 통지 "within 72 hours of becoming aware", 1,000명 이상 또는 민감정보면 규제기관 신고; 2026-03-10 개정법 대부분 2026-09-11 시행(PIPC 영문 사이트에도 "Amended Personal Information Protection Act Takes Effect" 2026.09.16 게시), 특정 위반 과징금 "10% of total revenue".
- **적용 제안**: (1) Supabase/Vercel 리전이 한국 밖이면 "처리위탁·보관" 근거로 처리방침에 수탁자명·국가·항목·기간을 명시(별도 동의 대신 가능한 경로; 법률 검토 권장). (2) 가입 동의 화면을 "필수(서비스 제공)"와 "선택(마케팅/분석)"으로 분리하고 체크박스 기본 해제. (3) 회원 탈퇴 즉시 파기(cascade, C3) + 백업 보존 기간 명시. (4) 침해 대응 절차(72시간) 문서 1페이지 준비. (5) 2026-09-11 시행 개정 내용은 PIPC 공지 원문으로 재확인 필요(본 조사에서 개정 조문 원문은 미확인).
- **출처**: KLRI — Personal Information Protection Act (English, Act No. 10465, amended 2023-03-14) Part 4 excerpt — https://elaw.klri.re.kr/eng_mobile/viewer.do?hseq=62389&type=part&key=4 — (accessed 2026-09; Art.15/16/21/22 확인, Art.28-8/30 원문은 해당 페이지에 없음); DLA Piper — Data protection laws in South Korea — https://www.dlapiperdataprotection.com/index.html?t=law&c=KR — (accessed 2026-09); bifrostindex — South Korea International Data Transfers — https://bifrostindex.ai/guides/south-korea/international-data-transfers — (updated 2026-08-26); PIPC — English homepage — https://www.pipc.go.kr/eng/ — (accessed 2026-09)

### F5. Google OAuth 동의화면·브랜드 검증 요건
- **규칙(Google)**: 기본 스코프만 쓰면 "If the app only requests basic identity scopes (`openid`, `email`, `profile`), any user can access without being on the allowlist"; Testing 상태는 "limited to up to 100 test users", 테스트 사용자 인가는 "expire seven days"; 프로덕션 전환은 "Publish app"; "Your brand must be verified if you want your application logo and application name to be visible … Without verification, only your application domain will be visible". 브랜드 검증 요건: 홈페이지는 "hosted on a verified domain you own", "can not be only a login page"; 프라이버시 정책은 "hosted within the domain that hosts your homepage", "linked on your homepage", "linked from the OAuth consent screen", "disclose how your app accesses, uses, stores, and/or shares Google user data"; Authorized domains는 "Google Search Console"로 소유 확인; 버튼은 "Google branding guidelines" 준수.
- **적용 제안**: Google Cloud 콘솔에서 앱이 "In production"인지, 스코프가 `openid email profile`뿐인지 확인. 이름/로고 노출을 원하면 브랜드 검증 제출 — `/privacy`가 같은 도메인에 있고 홈페이지 푸터에서 링크되는지, Search Console 도메인 인증 여부 확인. "Sign in with Google" 버튼 디자인은 Google 가이드라인 준수.
- **출처**: Google Cloud Help — Verification requirements — https://support.google.com/cloud/answer/13464321 — (accessed 2026-09); Google Cloud Help — Manage App Audience — https://support.google.com/cloud/answer/15549945?hl=en ; Google Cloud Help — When is verification not needed — https://support.google.com/cloud/answer/13464323?hl=en ; Google for Developers — OAuth app state overview — https://developers.google.com/identity/protocols/oauth2/production-readiness/overview

### F6. Sign in with Apple 요건은 App Store 앱에만 해당
- **규칙(Apple App Review Guidelines 4.8)**: "Apps that use a third-party or social login service (such as … Google Sign-In …) to set up or authenticate the user's primary account with the app must also offer as an equivalent option another login service" — 조건: 이름·이메일로 수집 제한, 이메일 비공개 옵션, 동의 없는 광고 추적 없음. 이는 App Store 심사 가이드라인이며 웹사이트에는 적용되지 않음.
- **적용 제안**: 현재 웹앱은 해당 없음. 향후 iOS 래퍼 앱(Capacitor 등)으로 App Store 배포 시 Google 로그인이 있으면 Sign in with Apple(또는 동등 옵션) 추가 필요 — Supabase는 Apple 프로바이더를 지원하므로 그때 추가.
- **출처**: Apple — App Review Guidelines §4.8 Login Services — https://developer.apple.com/app-store/review/guidelines/ — (accessed 2026-09)

### F7. 데이터 주체 권리 실행(접근/이동/삭제) — 이미 구현된 부분의 점검
- **규칙(GDPR)**: 권리 목록에 "Right of access", "Right to data portability", "Right to erasure". Supabase 삭제는 서버 전용 service_role(C3).
- **적용 제안**: 이미 `GET /api/account/export`, `POST /api/account/delete`가 있으므로 (1) export가 favorites/ratings/profiles/shared_lists/feedback(작성자 식별 가능 시)까지 포함하는지, (2) 삭제가 Auth 사용자 + 모든 테이블 + (가능하면) SMTP 벤더 로그·client_errors의 user_id 참조까지 처리하는지, (3) 처리 기한(GDPR 1개월 관행)을 처리방침에 명시하는지 점검. UI에서 export → delete 순서로 유도.
- **출처**: gdpr.eu — What is GDPR — https://gdpr.eu/what-is-gdpr/ ; Supabase — auth.admin.deleteUser — https://supabase.com/docs/reference/javascript/auth-admin-deleteuser

---

## G. 위치정보

### G1. 위치정보는 필요할 때만 요청, 작업에만 사용, 즉시 폐기, 고지
- **규칙(W3C Geolocation)**: "Recipients ought to only request position information when necessary, and only use the location information for the task for which it was provided to them." "Recipients ought to dispose of location information once that task is completed, unless expressly permitted to retain it by the user." 고지 항목: "the fact that they are collecting location data, the purpose for the collection, how long the data is retained, how the data is secured, how the data is shared … how users can access, update and delete the data." 보안 컨텍스트(HTTPS) 필수 — 아니면 `PERMISSION_DENIED`; 권한 수명은 기본 한 세션 권장.
- **적용 제안**: 위치는 사용자가 "내 주변" 버튼을 누를 때만 `getCurrentPosition` 호출(페이지 로드 시 자동 요청 금지), 거리 계산은 클라이언트에서, 좌표를 Supabase·에러 리포터(`client_errors`)·분석 도구·URL 쿼리에 절대 전송/저장하지 않음. 처리방침에 "위치는 브라우저 내에서만 사용, 서버 저장 없음" 명시. 참고: 한국의 위치정보법(위치정보의 보호 및 이용 등에 관한 법률) 적용 여부는 본 조사 범위 밖(미확인)이므로 서버 저장을 시작할 경우 별도 검토 필요.
- **출처**: W3C — Geolocation (Working Draft/Recommendation) §Security and privacy considerations — https://www.w3.org/TR/geolocation/ — (accessed 2026-09)

### G2. `Permissions-Policy: geolocation=(self)` 와 iframe
- **규칙(MDN)**: "The default allowlist for `geolocation` is `self`"; 차단 시 `getCurrentPosition()`/`watchPosition()` 콜백이 `PERMISSION_DENIED`; 헤더로 지정하면 `<iframe allow>`로도 다른 출처는 허용되지 않음. 문법 `Permissions-Policy: geolocation=(self "https://example.com")`.
- **적용 제안**: OWASP/Next.js 예시의 `geolocation=()`를 그대로 쓰면 지도 기능이 깨짐 → `geolocation=(self)`로. 외부 지도 SDK가 iframe이 아니라 스크립트라면 `self`로 충분. 다른 출처 iframe(예: 임베드 지도)에서 위치가 필요하면 그 출처를 명시 허용.
- **출처**: MDN — Permissions-Policy: geolocation directive — https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Permissions-Policy/geolocation — (accessed 2026-09); OWASP — HTTP Security Response Headers Cheat Sheet — https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html

### G3. 위치 요청 전 컨텍스트 설명(권한 프롬프트 UX)
- **규칙(W3C)**: 위치는 "default powerful feature"로 명시적 동의가 필요하며 UA는 세션 단위 권한을 권장.
- **적용 제안**: 브라우저 프롬프트 전에 인앱 안내("주변 매장을 찾기 위해 현재 위치를 사용합니다. 저장하지 않습니다")를 띄우고, 거부 시 "지역 선택(명동/홍대/강남)" 대체 UX 제공. 거부 상태를 localStorage에 기억해 반복 프롬프트 방지.
- **출처**: W3C — Geolocation — https://www.w3.org/TR/geolocation/

---

## 미확인 / 대체 출처 메모
- gdpr.eu의 Article 3 전용 페이지는 404 → gdpr-info.eu(조문 원문 사이트)로 대체.
- KLRI 영문 PIPA 전체 보기 페이지(`lawView.do?hseq=62389`)는 본문이 추출되지 않았고, part=4 페이지에는 Art.15/16/21/22만 있어 Art.28-8·Art.30의 정확한 원문은 확인하지 못함 → DLA Piper·bifrostindex(2차 출처)로 보완. 2026-09-11 시행 개정 조문 원문도 미확인.
- Supabase `/guides/auth/passwords` 페이지에는 정책 수치가 없어 `/guides/auth/password-security`를 사용. Supabase `/guides/security/product-security`는 인덱스 페이지라 세부 규칙은 `going-into-prod`에서 인용.
- Google `support.google.com/cloud/answer/13463073`, `/6158849`는 개요/클라이언트 관리 페이지라 세부 요건은 `/13464321`, `/15549945`, `/13464323`, developers.google.com 개요에서 인용.
- Supabase Auth의 네이티브 패스키 지원, `signOut({scope})` 옵션, SSR 쿠키의 기본 SameSite 값은 조사하지 않았음(문서 확인 필요).
- OWASP `owasp.org/www-project-top-ten/`는 목록이 없어 `top10.owasp.org/2025`로 대체.

---

## 즉시 점검 12항목
1. **Next.js ≥ 15.2.3**인지, 인가가 미들웨어에만 의존하지 않는지(D1).
2. **`next.config.js` 보안 헤더**: HSTS `max-age=63072000; includeSubDomains; preload`, `nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: geolocation=(self), camera=(), microphone=()`, `frame-ancestors 'none'`(A2/G2).
3. **CSP Report-Only** 배포 후 위반 수집(A3).
4. **`POST /api/account/delete`**: `Origin` 정확 일치 + `Sec-Fetch-Site` 검사 + `getUser()` 서버 검증 + 최근 재인증 요구(A4/B10).
5. **`/api/account/export`**에 `Cache-Control: no-store` 및 사용자 소유 행만 반환(A8/D2).
6. **Supabase 커스텀 SMTP** 설정 여부(기본 2통/시간·승인 주소 전용이면 실제 가입 불가)와 SPF/DKIM/DMARC(B9).
7. **비밀번호 정책**: 최소 12–15자, 조합 규칙 OFF, 유출 비밀번호 차단(Pro), 표시 토글·붙여넣기 허용(B1/B2/E2).
8. **열거 방지**: 로그인/가입/재설정 응답 메시지·시간 통일(B3).
9. **Security Advisor 0건**: 모든 public 테이블 RLS + `to authenticated` + `(select auth.uid())` + `user_id` 인덱스; 마스킹 뷰의 `security_definer_view`/`auth_users_exposed` 경고 해결; insert-only 테이블에 SELECT grant 없음(C1/C2).
10. **FK `on delete cascade`** 전수 확인 후 삭제 e2e 테스트(C3).
11. **`/privacy` 6개 언어**: 수령자(Supabase·Vercel·Google·SMTP)와 **국외이전(수탁자·국가·항목·기간)**, 보관기간, 권리 행사 방법(export/delete 링크), 감독기관 진정권; 가입 시 필수/선택 동의 분리(F2/F4).
12. **위치정보**: 사용자 액션 시에만 요청, 좌표를 서버·`client_errors`·분석·URL에 절대 저장/전송하지 않음을 코드로 확인(G1).