# 출시 체크리스트 — 분업표 (2026-08-16)

> 남은 작업 전체를 **오너(대시보드·결제·결정)**와 **Claude(코드·검증)**로
> 나눈 단일 문서. 오너 항목이 하나 풀릴 때마다 Claude 후속이 이어진다.
> 인증 상세는 `docs/auth-setup.md`, 전체 이력은 `docs/HANDOFF.md`.

## ✅ 완료 상태 스냅샷

앱 기능은 출시 가능 상태다. 로그인(Google+이메일), 지도·상세·검색·지하철,
즐겨찾기/프로필/별점 계정화, 공유 리스트(+OG 카드), 공개 리뷰(동의·신고·자동숨김),
전화 인증 UI(발송만 Twilio 대기), 오류추적·Uptime·CI·E2E 16종, Lighthouse 81.

## 🧑‍💼 오너 작업 (소요시간 순)

| # | 작업 | 소요 | 방법 | 완료되면 Claude가 이어서 |
|---|---|---|---|---|
| 1 | **카카오맵 API 켜기** | 2분 | [Kakao Developers](https://developers.kakao.com/console/app) → MySeoulDrop → 제품 설정 → **카카오맵 → 활성화(ON)** | 한글 상호명 205곳 백필 실행 → 검수 → 배포 (스크립트 준비 완료: `scripts/backfill-kr-names.mjs`) |
| 2 | **Google 실계정 로그인 1회** | 2분 | 프로덕션 /login → Continue with Google → 완주 | 프로필 이름 표시·게스트 병합 확인 |
| 3 | **도메인 구매** (myseouldrop.app 추천) | 10분 | Vercel 대시보드 → 프로젝트 → Domains → 검색·구매 (DNS 자동) | URL 교체 체인 전체: 앱 메타 → Supabase Site URL → Resend 가입 안내 → SMTP → 메일 템플릿 token_hash 교체 (auth-setup §1, §1.5) |
| 4 | **Twilio 업그레이드** | 10분+결제 | Twilio Console → Upgrade → 결제수단+충전 → **Supabase 테스트 OTP 비우기** | 프로덕션 실번호 발송 검증, `(SAMPLE TEST)` 발신자명 확인 (auth-setup §4.6) |
| 5 | **Confirm email 정책 결정** | 결정 | 도메인+SMTP 전까지 내장 메일러(시간당 2통 제한). 베타 동안 OFF(즉시 가입)로 갈지: Supabase → Auth → Sign In / Providers → Email → Confirm email | OFF 결정 시 가입 플로우 문구·E2E 조정 |
| 6 | **Apple Developer 가입 여부** | 결정($129/년) | 일본·중국 시장 비중 크면 가치 있음 (auth-setup §5) | 가입 시 Services ID·키 발급 가이드 + Supabase 연결 + 버튼 활성화 |
| 7 | (제품 결정) 리뷰 수 기반 인기 표시 재도입 | 결정 | 한 번 뺐던 기능, 데이터(ratingCount)는 보존됨 | 결정대로 구현 |
| 8 | (선택) 실사진 확보 / 법무 검토 | — | — | 사진 파이프라인·문구 반영 |

## 🤖 Claude 작업

**오너 액션 대기 없는 것 — 없음** (코드 백로그 소진). 아래는 오너 항목과 짝:

- [ ] (오너 #1 후) 한글 상호명 백필: 카카오 로컬 매칭(거리≤100m+카테고리 일치, 확신 없으면 영문 유지) → `scripts/lib/kr-name-overrides.json` → 생성 파일 패치 + 파이프라인 재실행에도 유지(빌드 스크립트 통합 완료)
- [ ] (오너 #3 후) 도메인 체인: Vercel 연결 확인 → `metadataBase`·sitemap·OG → Supabase URL Configuration → SMTP → 템플릿 → 전 플로우 E2E 재검증
- [ ] (오너 #4 후) SMS 실발송 프로덕션 검증 + 오류 카피 실전 확인
- [ ] (오너 #2 후) Google 병합 검증 (favorites/profiles/ratings 3스토어)

## 보류로 확정된 것 (재론 불필요)

- LINE 로그인 — 조사·기록 완료 (auth-setup §6), HS256 비호환으로 공수 큼
- 카카오 로그인 버튼 — 인프라 완료, 정책상 미노출 (원하면 10분)
- JS 다이어트 (Lighthouse 81→90) — 체감 대비 공수 커서 보류
- 장소 데이터 DB 이전 — 운영 편집 필요해질 때
- 태블릿 레이아웃 — 불필요 결정
