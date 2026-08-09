# Auth 설정 가이드 (Supabase)

앱의 이메일+비밀번호 로그인은 코드만으로 동작하지만, 아래 항목은
**Supabase/각 프로바이더 대시보드에서 계정 소유자가 직접** 설정해야 한다.
Supabase 프로젝트: `supabase-indigo-mountain` (Vercel Marketplace 연동 —
Vercel 대시보드 → Integrations → Supabase → Open in Supabase).

## 1. 필수 — 프로덕션 URL 설정 (이거 없으면 가입 메일 링크가 localhost로 감)

Supabase Dashboard → Authentication → URL Configuration:

| 항목 | 값 |
|---|---|
| Site URL | `https://seoul-guide-v2.vercel.app` |
| Redirect URLs | `https://seoul-guide-v2.vercel.app/auth/callback`, `http://localhost:3000/auth/callback`, `http://localhost:3100/auth/callback` |

## 1.5 필수 — 이메일 템플릿을 token_hash 방식으로 (다른 브라우저에서 링크 열어도 동작)

기본 PKCE 링크는 가입한 브라우저에서만 확인이 됩니다 (메일앱 내장 브라우저에서
열면 실패). Dashboard → Authentication → Email Templates에서 링크를 교체:

- **Confirm signup**: `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=email&next=/onboarding/mode`
- **Reset password**: `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=recovery`

`/auth/callback`이 token_hash(verifyOtp)와 code(PKCE) 둘 다 처리하므로
템플릿 교체 전에도 같은 브라우저 플로우는 동작한다.

## 2. Google 로그인 (~10분, 무료)

1. [Google Cloud Console](https://console.cloud.google.com/apis/credentials) → 프로젝트 생성 → OAuth 동의 화면(External) 구성
2. Credentials → Create OAuth client ID → Web application
   - Authorized redirect URI: `https://<SUPABASE_PROJECT_REF>.supabase.co/auth/v1/callback`
     (정확한 값은 Supabase Dashboard → Authentication → Providers → Google 화면에 표시됨)
3. Client ID / Client Secret 복사 → Supabase Providers → Google에 붙여넣고 Enable

## 3. Kakao 로그인 (~10분, 무료)

1. [Kakao Developers](https://developers.kakao.com/console/app) → 애플리케이션 추가
2. 앱 설정 → 플랫폼 → Web → 사이트 도메인: `https://seoul-guide-v2.vercel.app`
3. 제품 설정 → 카카오 로그인 → 활성화, Redirect URI에 Supabase 콜백 URL 등록
   (Supabase Providers → Kakao 화면에 표시되는 값)
4. 앱 키의 **REST API 키** → Supabase Kakao provider의 Client ID로,
   카카오 로그인 → 보안 → Client Secret 발급 → Supabase의 Client Secret으로
5. 동의 항목: 닉네임/이메일 설정 (이메일은 비즈 앱 전환 필요할 수 있음)

## 4. Apple 로그인 (보류 권장)

Apple Developer Program **연 $129 유료**. 결제 전까지 앱의 Apple 버튼은
"준비 중" 에러 메시지를 표시한다 (AuthShell이 처리).

## 코드 쪽 참고

- 세션: `@supabase/ssr` 쿠키 기반 — `middleware.ts`가 매 요청 세션 갱신
- 클라이언트: `lib/supabase/client.ts` / 서버: `lib/supabase/server.ts`
- OAuth·메일 확인 랜딩: `app/auth/callback/route.ts` (상대경로만 허용 — open redirect 방어)
- 화면: `/login`, `/register`(확인 메일 안내 상태 포함), 로그아웃은 설정 화면 모달
- 게스트 모드는 그대로 — 로그인 없이 전 기능 탐색 가능
