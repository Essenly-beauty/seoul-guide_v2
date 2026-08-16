# Auth 설정 가이드 (Supabase)

> 최종 갱신: 2026-08-16 — Twilio 전화 인증 + Kakao 로그인 연동 작업 반영, LINE 검토 결과 추가.
> 앱 브랜드: MYSEOULDROP / 배포: https://seoul-guide-v2.vercel.app
> Supabase 프로젝트: `supabase-indigo-mountain` (ref `njsocpyuesntblifpips`, Free Plan, main = **PRODUCTION**)
> Vercel Marketplace 연동 — Vercel 대시보드 → Integrations → Supabase → Open in Supabase

앱의 이메일+비밀번호 로그인은 코드만으로 동작하지만, 아래 항목은
**Supabase/각 프로바이더 대시보드에서 계정 소유자가 직접** 설정해야 한다.

## 진행 현황 요약

| # | 항목 | 상태 | 비고 |
|---|---|---|---|
| 1 | 프로덕션 URL 설정 | ✅ 완료 | 2026-08-11 |
| 1.5 | 이메일 템플릿 token_hash 교체 | ⏸️ 보류 | 커스텀 도메인 + SMTP 선행 필요 |
| 2 | Google 로그인 | ✅ 완료 | 이전 문서에 미완료로 적혀 있었으나 실제로는 완료 상태였음 |
| 3 | Kakao 로그인 | ✅ 설정 완료 | 실제 로그인·계정 연결까지 검증. 앱에 버튼만 없음 |
| 4 | 전화 인증 (SMS) | 🟡 설정 완료 / 실발송 대기 | Twilio Verify. 체험 계정 제약으로 실발송만 미검증 |
| 5 | Apple 로그인 | ⏸️ 보류 | 연 $129 유료 |
| 6 | LINE 로그인 | ⏸️ 보류 (조사 완료) | 기술 난이도 높음. §6 참조 |

## 🎯 로그인 화면 정책 (2026-08-16 결정)

**주력은 Google + 이메일 회원가입 두 가지로 간다.**

주 사용자가 외국인 관광객이므로 전 세계에서 통용되는 Google과, 어떤 나라
사용자든 받아줄 수 있는 이메일 가입이 실질적인 커버리지를 만든다.
Kakao·Apple·LINE은 각각 사정이 있어 후순위로 둔다 (각 절 참조).

## 1. 필수 — 프로덕션 URL 설정 ✅ 2026-08-11 완료

Supabase Dashboard → Authentication → URL Configuration:

| 항목 | 값 |
|---|---|
| Site URL | `https://seoul-guide-v2.vercel.app` |
| Redirect URLs | `https://seoul-guide-v2.vercel.app/auth/callback`, `http://localhost:3000/auth/callback`, `http://localhost:3100/auth/callback` |

2026-08-16 재확인 — 위 값 그대로 유지되고 있음.

### 도메인을 나중에 바꿀 때

커스텀 도메인 구매 후 교체할 때 손댈 곳은 생각보다 적다. 각 OAuth
프로바이더에 등록한 Redirect URI는 앱 도메인이 아니라 **Supabase 프로젝트
주소**(`njsocpyuesntblifpips.supabase.co`)를 가리키므로 그대로 유효하다.

바꿔야 하는 곳:

| 위치 | 내용 |
|---|---|
| Vercel | 커스텀 도메인 연결 (DNS). 기존 vercel.app 주소도 계속 살아있어 무중단 |
| Supabase → URL Configuration | Site URL, Redirect URLs — **필수** |
| 카카오 → 앱 기본 정보 | 앱 대표 도메인 (표시용, 심사 없음) |
| 앱 코드 | `NEXT_PUBLIC_SITE_URL` 등 하드코딩 값이 있다면 |

안 바꿔도 되는 곳: 카카오/구글 Redirect URI, Twilio Verify, Supabase 프로젝트 URL·anon key.

커스텀 도메인은 §1.5 커스텀 SMTP와 묶여 있다. 도메인을 사면 **도메인 연결 +
Supabase URL 교체 + SMTP 연동 + 이메일 템플릿 교체**를 한 번에 처리하는 게 효율적이다.

## 1.5 보류 — 이메일 템플릿 token_hash 교체 (커스텀 SMTP 선행 필요)

> ⚠️ Supabase가 내장 메일러 사용 중에는 템플릿 Source 편집을 잠가둠
> ("Set up custom SMTP to edit the source"). 즉 **커스텀 SMTP 연결이 선행
> 조건**이고, SMTP의 발신 도메인 인증에는 **소유한 도메인**이 필요하다.
>
> 순서: **① 커스텀 도메인 구매 → ② Resend 등 가입·도메인 인증(DNS 레코드)
> → ③ Supabase → Authentication → SMTP Settings에 연결 → ④ 아래 템플릿 교체**
>
> 그 전까지는 기본 PKCE 링크로 동작하며(1번 완료로 프로덕션 URL로 발송됨),
> 같은 브라우저에서 여는 일반 플로우는 정상. 메일앱 내장 브라우저에서 열면
> `/login?error=browser` 안내로 착지한다 (막다른 길 아님).

SMTP 연결 후 Dashboard → Authentication → Email Templates에서 링크 교체:

- **Confirm signup**: `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=email&next=/onboarding/mode`
- **Reset password**: `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=recovery`

`/auth/callback`이 token_hash(verifyOtp)와 code(PKCE) 둘 다 처리하므로
템플릿 교체 전에도 같은 브라우저 플로우는 동작한다.

## 2. Google 로그인 ✅ 완료

| 항목 | 값 |
|---|---|
| Provider | Enabled |
| Client ID | `348863855473-dqad5fjjl4lhurrv02a84ig71484cafh.apps.googleusercontent.com` |
| Client Secret | 설정됨 (값은 콘솔에서 확인) |
| Callback URL | `https://njsocpyuesntblifpips.supabase.co/auth/v1/callback` |

주력 소셜 로그인. 미국·유럽 관광객 커버리지가 가장 넓다.

참고: 중국 본토 사용자는 자국에서 구글이 차단돼 애초에 구글 계정이 없는
경우가 많다. (한국 네트워크에서는 구글이 열리므로 계정만 있으면 로그인
자체는 된다.) 중국 시장은 이메일 가입에 의존해야 한다.

## 3. Kakao 로그인 ✅ 설정 완료 (2026-08-16)

### 3.1 최종 설정값

카카오 개발자 콘솔:

| 항목 | 값 |
|---|---|
| 앱 | MySeoulDrop (ID 1547032) |
| 앱 아이콘 | 등록됨 (`https://seoul-guide-v2.vercel.app/apple-icon.png` 사용) |
| 회사명 / 카테고리 | MySeoulDrop / 여행/지역 정보 |
| 앱 대표 도메인 | `https://seoul-guide-v2.vercel.app` |
| 앱 등급 | **개인 개발자 비즈 앱** (전환 목적: 이메일 필수 동의) |
| 카카오 로그인 | ON |
| Redirect URI | `https://njsocpyuesntblifpips.supabase.co/auth/v1/callback` |
| REST API 키 | `2ee8b8191875bcc37d7d32b5664c3a7c` (OAuth client_id 역할 — 시크릿 별도 활성화됨) |
| 클라이언트 시크릿 | 활성화 (값은 콘솔에서 확인) |

동의항목:

| 항목 | ID | 상태 |
|---|---|---|
| 닉네임 | `profile_nickname` | 필수 동의 |
| 카카오계정(이메일) | `account_email` | **필수 동의 [수집]** |
| 프로필 사진 | `profile_image` | 선택 동의 |

`account_email`에는 "사용자에게 값이 없는 경우 카카오계정 정보 입력을
요청하여 수집" 옵션을 켜두었다. 카카오 계정에 이메일이 없는 사용자에게
입력을 요청하므로 Supabase가 항상 이메일을 받게 된다.

Supabase — Authentication → Sign In / Providers → Kakao:

| 항목 | 값 |
|---|---|
| Kakao enabled | ON |
| REST API Key | 위와 동일 |
| Client Secret Code | 설정됨 |
| Allow users without an email | OFF (이메일을 필수로 받으므로 불필요) |

### 3.2 ✅ 실제 로그인 검증 완료 — 계정이 자동 연결됨

실제 카카오 로그인을 끝까지 수행한 결과, Supabase auth.users에서:

| UID | 이메일 | Providers |
|---|---|---|
| `4242d99f-…` (오너 계정) | gk***@naver.com | Email, Kakao |

**새 계정이 생기지 않고 기존 이메일 계정에 카카오 identity가 병합**되었다.
이메일이 일치했기 때문이다. 닉네임도 카카오에서 정상 수집됐다.

> 💡 이것이 비즈 앱 전환을 선택한 이유의 실증이다. 이메일 없이 진행했다면
> 같은 사람에게 계정이 두 개 생겨, 저장한 장소·리뷰가 흩어졌을 것이다.
> 나중에 고치기 훨씬 어려운 문제다.

### 3.3 연동 중 만난 오류와 해결 (재발 시 참고)

| 오류 | 원인 | 해결 |
|---|---|---|
| KOE205 — 설정하지 않은 동의 항목: profile_image | Supabase Kakao provider가 profile_image를 scope에 포함해 인가 요청을 보내는데 카카오 쪽이 "사용 안 함"이었음 | profile_image를 **선택 동의**로 설정 |
| KOE006 — 등록하지 않은 리다이렉트 URI | Redirect URI가 `.../auth/v1/calback`으로 등록돼 있었음 (l 하나 누락된 오타) | 정정 후 확대 대조 확인 |
| 비즈 앱 전환 버튼 비활성 | 앱 아이콘 미등록 | 아이콘 등록 → 카카오비즈니스 약관 동의 → 개인 개발자 비즈 앱 전환 |
| Supabase Kakao 설정 창에 구글 값이 미리 채워짐 | Supabase 대시보드 UI 이슈로 추정. REST API Key 칸에 구글 Client ID가 들어 있었음 | 칸을 완전히 비운 뒤 카카오 값 입력 |

### 3.4 남은 작업

앱 로그인 화면에 카카오 버튼이 없다 (§로그인 화면 정책에 따른 의도적 상태 —
인프라는 완료, 진입점만 없음). 넣게 된다면 Google 아래, 눈에 덜 띄는 위치로
충분하다:

```ts
await supabase.auth.signInWithOAuth({ provider: 'kakao' })
```

카카오 로그인의 실제 사용자층 (외국인 관광객 대상 앱임을 감안한 현실적 평가):

- 한국 거주 외국인 (온보딩의 Living here 사용자)
- 재외동포·한국계 방문객
- 카카오T·배달앱 때문에 여행 준비 중 카카오톡을 설치한 관광객
- 팀 내부 테스트·데모, 국내 파트너 제휴

첫 방문 단기 관광객 기준으로는 비중이 낮다. 유지비가 0이므로 두되, 기대치는 낮게 잡는다.

## 4. 전화 인증 (SMS) 🟡 설정 완료 / 실발송 검증 대기

> ⚠️ **방식이 바뀌었다.** 이전 문서의 "Twilio 번호 구매 + Messaging Service"
> 대신 **Twilio Verify**를 사용한다.

### 4.1 현재 설정값

Twilio:

| 항목 | 값 |
|---|---|
| Account SID | `ACa7e7…26a` (전체 값은 Twilio 콘솔에서 — GitHub 푸시 보호가 평문 SID를 차단) |
| Verify Service | MySeoulDrop |
| Verify Service SID | `VA775f…333` (전체 값은 Twilio 콘솔 → Verify → Services) |
| 활성 채널 | SMS, Voice |
| 비활성 채널 | WhatsApp, Email |
| 계정 상태 | **Trial** (30일, 무료 SMS 100건, 잔액 $0.00, 보유 번호 0개) |

Supabase — Authentication → Sign In / Providers → Phone:

| 항목 | 값 |
|---|---|
| Enable Phone provider | ON |
| SMS provider | Twilio Verify |
| Test Phone Numbers and OTPs | 오너 번호 1건 등록 (값은 대시보드에서만 — 이 문서에 평문 금지, 아래 경고 참조) |
| Test OTPs Valid Until | 2026-08-30 |

### 4.2 왜 Verify인가 (번호 구매 대신)

- 전화번호를 살 필요가 없다. 체험 계정은 잔액 $0.00이라 번호 구매에 결제가 선행된다.
- 국가별 발신 규제를 Twilio가 대신 처리한다. 여러 나라에서 오는 관광객이
  대상이므로 국가마다 다른 발신자 ID 규정을 직접 관리하는 것은 부담이 크다.
- 월 번호 임대료가 없고 인증 성공 건당 과금된다.

### 4.3 ⭐ 무료로 테스트하는 방법 (결제 불필요)

Supabase의 **Test Phone Numbers and OTPs**를 쓰면 실제 SMS를 한 건도 보내지
않고 앱의 전화 인증 플로우를 끝까지 검증할 수 있다. 개발 중에는 이 방식을 쓴다.

1. Supabase → Authentication → Sign In / Providers → Phone
2. Test Phone Numbers and OTPs에 `<국가번호+번호>=<무작위 6자리>` 형식으로 입력
   (`+`와 앞자리 0을 뺀 형태. 여러 개는 쉼표로 구분)
3. **Test OTPs Valid Until에 만료일을 반드시 지정** (아래 경고 참조)
4. Save → 앱에서 해당 번호 입력 → 등록한 코드 입력 → 통과

> 🔒 **경고 — 만료일을 반드시 설정하고, 번호=코드 쌍을 문서/저장소에 평문으로
> 남기지 말 것.** 이 프로젝트는 PRODUCTION 브랜치다. 테스트 번호 등록은 그
> 번호로는 SMS 없이 고정 숫자만 입력하면 인증이 통과된다는 뜻이다. 만료일이
> 없으면 영구적인 인증 우회 통로가 남고, 쌍이 어딘가에 적혀 있으면 그 자체가
> 우회 열쇠가 된다. 코드는 추측 가능한 값(생년월일 등) 대신 무작위 6자리를 쓴다.

**검증 완료 (2026-08-16)**: 앱 → Supabase 구간 전체가 `✓ Verified +82 10-****-7527`까지
정상 통과. 앱이 `010…` 입력을 `+8210…`으로 정규화해 전송하는 것도 확인.

### 4.4 실발송이 아직 안 되는 이유 (체험 계정 제약)

실제 SMS 발송 시 Supabase Auth 로그:

```
error_code: sms_send_failed
422: Error sending phone_change OTP to provider:
The phone number is unverified. Trial accounts may only
send messages to verified numbers.
```

> 💡 이 에러는 설정이 잘못됐다는 뜻이 아니다. Twilio가 요청을 정상
> 수신·인증한 뒤 **정책상** 거절한 것이다. 자격증명이 틀렸다면 인증
> 실패(401)가 났을 것이므로, Account SID / Auth Token / Verify Service SID
> 세 값이 모두 정확하다는 근거가 된다.

한국 번호는 체험 계정에서 수신 허용 목록(Verified Caller IDs)에 등록할 수 없다:

| 방식 | 결과 |
|---|---|
| SMS로 발신번호 인증 | ❌ "blocked as this is a restricted country for verifying a caller ID by SMS" |
| 음성통화로 인증 (2회 시도) | ❌ "We were unable to place the call" — 잔액 $0.00으로 국제 발신 불가 |

→ 실발송 검증에는 **Twilio 계정 유료 업그레이드**가 필요하다. 실제 관광객에게
SMS를 보내려면 어차피 업그레이드가 필수이므로, 출시 준비 시점에 결제하고
그때 최종 확인하면 된다.

### 4.5 무료 대안 조사 결과 (2026-08-16)

**결론: 임의의 전 세계 번호로 무료 SMS를 보내는 방법은 존재하지 않는다.**
Twilio, Vonage, MessageBird, Infobip, Plivo, Telnyx, AWS SNS를 모두 확인했고
예외 없이 "사전 검증된 번호에만 배달" 정책이다.

| 옵션 | 무료 실발송 | 비고 |
|---|---|---|
| Vonage | 검증한 5개 번호만 | €2 크레딧, 카드 불필요, 한국행 SMS 정식 지원, Supabase 기본 provider. 문자에 `[FREE SMS DEMO]` 강제. 개발자 본인 테스트용으로는 최선 |
| NAVER Cloud SENS | ⭕ 월 50건 영구 무료 | 화이트리스트 제약 없음. 미국·일본·대만 국제 SMS 지원. Supabase 기본 목록에 없어 Send SMS Hook + Edge Function 필요. NCP 결제수단 등록 필요 |
| 솔라피(CoolSMS) | 가입 시 300P | 미국·캐나다(2024-11~), 중국(2025-12~) 발송 불가 → 관광객 앱에 구조적으로 부적합 |
| MessageBird/Bird | ❌ | 인증한 본인 번호만 + Supabase 연동이 리브랜딩 이후 깨진 상태 (auth#1830 open) |
| Textlocal | ❌ | 인도 전용 |

### 4.6 업그레이드 후 확인할 것

1. Twilio 계정 업그레이드 (결제 수단 등록 + 충전)
2. **Supabase의 Test Phone Numbers and OTPs 비우기** (우회 경로 제거)
3. 앱에서 실번호로 인증 → SMS 수신 확인
4. Twilio Console → Monitor에서 발송 로그 확인

### 4.7 알아둘 제약 사항

- 체험 계정 동안 발신자명이 `(SAMPLE TEST)`로 고정된다. Twilio 안내: "Once
  you have upgraded your account, your friendly name will appear instead of
  (SAMPLE TEST)". MySeoulDrop 브랜딩은 업그레이드 후에 적용된다.
- WhatsApp / Email 채널은 껐다. 각각 사전 연동이 필수라 켜둔 상태로는 Verify
  Service 설정 자체가 저장되지 않는다 (필수 항목 누락 에러). WhatsApp은
  WhatsApp Sender를 담은 Messaging Service가, Email은 SendGrid 연동이
  필요하다. WhatsApp은 동남아·유럽·중남미 관광객에게 SMS보다 도달률이 좋아
  나중에 붙일 가치가 있다.
- 한국(+82) SMS 발송 제약 (Twilio 공식 가이드라인):

| 발신 방식 | 지원 |
|---|---|
| 알파뉴메릭 발신자명 | ❌ |
| 한국 국내 번호 (long code) | ❌ Twilio에서 한국 번호를 살 수 없음 |
| 단축번호 (short code) | ❌ |
| 해외 번호 (international long code) | ⚠️ 지원하되 009/006 접두 + [국제발신] 태그 |

## 5. Apple 로그인 ⏸️ 보류 권장

Apple Developer Program **연 $129 유료**. 결제 전까지 앱의 Apple 버튼은
"준비 중" 에러 메시지를 표시한다 (AuthShell이 처리).

다만 중국·일본 시장에서는 Apple 로그인 비중이 높다. iOS 점유율이 높고 구글
계정이 없는 사용자를 받아줄 수 있는 거의 유일한 소셜 수단이다. 유료 결정 시
우선순위를 다시 평가할 것.

## 6. LINE 로그인 ⏸️ 보류 (2026-08-16 조사 완료)

### 6.1 왜 검토했나

온보딩에서 타겟으로 설정한 5개 시장 중 일본·대만·태국 3개에서 LINE이 지배적이다.

| 시장 | 지배적 로그인 수단 | 현재 지원 |
|---|---|---|
| 미국 | Google, Apple | ✅ |
| 일본 | LINE, Apple | ❌ |
| 대만 | LINE, Google | ⚠️ 부분 |
| 태국 | LINE, Facebook | ❌ |
| 중국 | WeChat, Apple | ❌ |

### 6.2 조사 결론 — 가능하지만 카카오보다 훨씬 까다롭다

좋은 소식:

- Supabase Custom Providers(2026-04 GA)는 Free 플랜에서 사용 가능 — 프로젝트당 3개
- LINE Login은 완전 무료. LINE 앱 계정 없이 비즈니스 이메일 계정으로 가입 가능

문제 세 가지:

**① OIDC 자동연결이 LINE에는 안 통할 가능성이 높다.** LINE은 웹 로그인에서
ID 토큰을 **HS256(채널 시크릿 대칭키)**으로 서명하는데, Supabase가 내부적으로
쓰는 coreos/go-oidc는 HS256을 지원하지 않는다. 게다가 LINE 자신의 discovery
문서는 ES256만 광고해 문서와 실제 동작이 모순된다. 동일 라이브러리를 쓰는
Ory Kratos에서 정확히 이 오류가 재현된 이력이 있다
(`oidc: id token signed with unsupported algorithm, expected ["ES256"] got "HS256"`).

**② 우회 경로(OAuth2 수동 모드)로 가면 이메일을 못 받는다.** LINE의
`/oauth2/v2.1/userinfo`는 sub, name, picture만 반환하고 이메일은 오직 ID 토큰
안에만 들어 있다. 즉 §3.2에서 카카오로 해결한 계정 분리 문제가 LINE에서
그대로 재발한다. 이메일까지 받으려면 Next.js에 LINE OAuth를 직접 구현해야
한다 (약 1~1.5일).

**③ 이메일 권한은 별도 심사.** LINE은 email scope 사용에 "이메일 수집 사실과
목적을 설명하는 화면의 스크린샷" 제출·승인이 필요하다. 개인정보처리방침에
해당 문구가 실제로 있어야 하고 0~2영업일 소요.

추가: LINE은 서비스 지역을 채널 생성 시 하나만 선택할 수 있고 이후 변경
불가. 일본·대만·태국을 모두 노리면 채널 3개가 필요하고, Supabase 무료 한도
3개를 정확히 소진한다.

### 6.3 나중에 진행할 때의 기술 참조

LINE OIDC 엔드포인트:

| 항목 | 값 |
|---|---|
| issuer | `https://access.line.me` |
| discovery | `https://access.line.me/.well-known/openid-configuration` |
| authorization_endpoint | `https://access.line.me/oauth2/v2.1/authorize` |
| token_endpoint | `https://api.line.me/oauth2/v2.1/token` |
| userinfo_endpoint | `https://api.line.me/oauth2/v2.1/userinfo` |
| jwks_uri | `https://api.line.me/oauth2/v2.1/certs` |
| PKCE | 지원 (S256만) |
| scopes | `openid`, `profile`, `email`(심사 필요) |

**경로 A — Supabase Custom Provider를 OAuth2 수동 모드로** (1순위 시도, 이메일 없음):

```
provider_type: 'oauth2'
identifier:    'custom:line'
client_id:     <Channel ID>
client_secret: <Channel secret>
authorization_url: https://access.line.me/oauth2/v2.1/authorize
token_url:         https://api.line.me/oauth2/v2.1/token
userinfo_url:      https://api.line.me/oauth2/v2.1/userinfo
scopes:            ['openid', 'profile']
email_optional:    true
pkce_enabled:      true
```

⚠️ 미해결 이슈 존재: supabase/auth#2519 — 커스텀 OAuth2 provider 콜백에서
missing provider id 오류 (2026-05 오픈, 현재도 열려 있음).

**경로 B — Next.js에서 직접 구현** (이메일 필요 시): Route Handler 2개
(`/api/auth/line/start`, `/api/auth/line/callback`)를 만들어 state +
PKCE(S256) 생성 → code 교환 → jose로 HS256 + channel secret 검증 →
supabase.auth.admin으로 유저 생성/조회 후 세션 발급.
⚠️ `signInWithIdToken`은 대안이 아니다 — 동일한 go-oidc 검증기를 타므로
HS256에서 똑같이 막힌다.

**경로 C — LIFF 병행** (보너스): LINE 인앱 브라우저 경로에서는 ID 토큰이
**ES256 + kid**로 발급되어 JWKS 검증이 정상 작동한다. 타겟 시장 사용자는
LINE 인앱 브라우저로 링크를 여는 비율이 높으므로 하이브리드 구성이 현실적이다.

LINE Developers Console 절차 요약: Provider 생성 → LINE Login 채널
생성(Messaging API 아님) → App types에 Web app 체크 → 서비스 지역
선택(변경 불가) → LINE Login 탭에 Callback URL 등록 → Basic settings에서
Channel ID(=client_id) / Channel secret(=client_secret) 확보 → Email address
permission 신청 → 채널 상태를 Published로 변경(되돌리기 불가).

공수: 순조로우면 반나절, 경로 B까지 가면 1~1.5일 + LINE 심사 대기.

## 🐛 앱 코드 이슈 (2026-08-16 발견 → 당일 수정 반영)

전화 인증·카카오 연동 과정에서 확인된 항목. **1~3번은 2026-08-16 코드 수정
완료·배포됨** (`components/auth/phone-verify.tsx`, `lib/phone.ts`,
`lib/auth/use-auth.ts`).

1. **전화번호 변경 경로가 없다 → ✅ 수정.** 인증된 상태에 "Change number"
   버튼 추가 (설정·온보딩 공통). 온보딩의 Verify your phone 단계가 verified
   상태일 때 거의 빈 화면이던 것도 Continue 버튼으로 해소.
2. **발송 실패를 "기능 미설정"으로 잘못 안내한다 → ✅ 수정.** 미설정
   신호(`smsProviderNotReady`)와 발송 실패를 분리 — 발송 실패는 유형별
   실행 가능한 안내(`smsSendErrorCopy`: 번호 확인 / 잠시 후 재시도)로,
   "준비 중" 안내에는 Try again 탈출구 추가. §4.4의 trial 제약 에러는 이제
   "Couldn't send the code right now — try again in a moment."로 표시된다.
3. **인증 상태를 세션 캐시에서 읽는다 → ✅ 수정.** 원인: `use-auth`의 순서
   가드가 `INITIAL_SESSION`(로컬 캐시 재생) 이벤트를 "더 새로운 상태"로
   취급해 서버 `getUser()` 결과를 버리고 있었음. INITIAL_SESSION은 서버
   응답 전까지의 채움용으로만 쓰고, 서버 값이 항상 이기도록 변경 —
   새로고침 시 DB의 최신 phone/identity가 반영된다.
4. **로그인 화면에 카카오 버튼이 없다 (우선순위 낮음) → 정책상 보류.**
   §로그인 화면 정책(Google + 이메일 주력)에 따른 의도적 상태. 인프라는
   완료돼 있어 넣기로 하면 AuthShell에 버튼 추가만으로 끝난다.

## 코드 쪽 참고

- 세션: `@supabase/ssr` 쿠키 기반 — `middleware.ts`가 매 요청 세션 갱신
- 클라이언트: `lib/supabase/client.ts` / 서버: `lib/supabase/server.ts`
- OAuth·메일 확인 랜딩: `app/auth/callback/route.ts` (상대경로만 허용 — open redirect 방어)
- 화면: `/login`, `/register`(확인 메일 안내 상태 포함), 로그아웃은 설정 화면 하단 Sign Out
- 게스트 모드는 그대로 — 로그인 없이 전 기능 탐색 가능
- 전화 인증 구현 방식: 이메일 계정에 번호를 부착·인증(phone_change OTP).
  전화번호 단독 로그인은 아님(이메일/Google이 primary). 온보딩 단계는
  건너뛰기 가능 — 국제 SMS 도달 실패로 가입이 막히면 안 되기 때문.

## 부록 — 2026-08-16 변경 이력

Twilio / 전화 인증:

- Twilio 계정 신규 생성 (Trial), Verify Service 생성 → 이름 MySeoulDrop
- Verify Service의 WhatsApp / Email 채널 비활성화 (SMS·Voice만 유지)
- Supabase Phone provider 활성화, SMS provider를 Twilio Verify로 설정 + 자격증명 3종 입력
- 테스트용으로 auth.users의 해당 계정 phone / phone_confirmed_at을 한 번
  NULL로 초기화했다가, 테스트 OTP로 재인증하여 원상 복구 완료
- Test Phone Number 등록 (오너 번호 1건, 만료 2026-08-30 — 쌍 값은 대시보드에서만)

Kakao:

- 카카오 개발자 앱 MySeoulDrop(ID 1547032) 생성, 앱 아이콘 등록
- 카카오비즈니스 통합 서비스 약관 동의 → 개인 개발자 비즈 앱 전환
- 카카오 로그인 활성화, Redirect URI 등록
- 동의항목: 닉네임(필수) / 이메일(필수·수집) / 프로필 사진(선택)
- Supabase Kakao provider 활성화 + 자격증명 입력
- 실제 로그인 검증 완료 — 기존 이메일 계정에 자동 병합 확인

LINE:

- 연동 가능성·공수 조사 완료 → 보류 결정. 기술 참조는 §6.3에 기록

정책 결정:

- 로그인 화면 주력을 **Google + 이메일 회원가입**으로 확정

앱 코드:

- 위 🐛 이슈 1~3 당일 수정·배포 (번호 변경 경로, 발송 실패 안내 분리, 세션 캐시 갱신)
