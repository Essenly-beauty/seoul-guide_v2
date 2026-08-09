# 사용자 데이터 전략 — 간편 로그인 사용자 프로파일링 (1차)

> 작성: 2026-07-25 · 전제: Google 간편 로그인(추후 Kakao 추가), Supabase Postgres
> 목표: 로그인 마찰은 0에 가깝게 유지하면서, 시간이 지날수록 **활용 가능한 구조화된 사용자 DB**가 쌓이게 한다.
> 상태: **목표 아키텍처 제안** — 현재는 OAuth·Supabase가 없고 일부 응답만 `localStorage`에 저장된다. 실제 상태는 `feature-status.md`와 `data-and-integrations.md`를 우선한다.

---

## 1. 핵심 원칙

1. **가입 시점에는 아무것도 묻지 않는다.** Google이 주는 것만 받는다. 폼이 하나라도 끼면 간편 로그인의 의미가 없다.
2. **점진적 프로파일링(Progressive Profiling).** 추가 정보는 "그 정보가 즉시 가치를 돌려주는 순간"에 1~2개씩만 묻는다. 질문마다 *왜 묻는지*가 UI에 보여야 한다.
3. **묻지 말고 관찰할 수 있으면 관찰한다.** 찜/검색/조회/필터 사용은 그 자체가 최고의 프로필이다. 질문은 행동으로 알 수 없는 것에만 쓴다.
4. **모든 항목은 선택.** 건너뛰어도 서비스가 동작하고, 나중에 마이페이지에서 채울 수 있다.
5. **수집 = 스키마.** 물어보는 모든 것은 처음부터 정규화된 컬럼/코드값으로 저장한다(자유 텍스트 최소화). 나중에 세그먼트/추천/제휴 리포트에 바로 쓸 수 있어야 한다.

## 2. 수집 항목 계층 (Tier)

| Tier | 항목 | 수집 시점 · 트리거 | 사용자에게 주는 가치(인센티브) | 활용 |
|---|---|---|---|---|
| **T0 자동** | email(+인증여부), 이름, 아바타, 구글 `sub` | Google OAuth 콜백 (기본 scope). ⚠️ `locale`은 구글이 제공 축소 — Accept-Language로 대체. 나이·성별은 추가 scope+앱 심사 필요·미기입 다수라 **OAuth로 받지 않음** | — | 계정, 언어 기본값 |
| **T1 첫 세션** (2화면, 전부 탭 선택·skip 가능) | 화면① 국적/거주국 + 체류 형태(여행/거주/계획) · 화면② **관심사 멀티선택**(스킨케어·클리닉/헤어/네일/퍼스널컬러/스파/쇼핑) + **연령대·성별(선택 표기)** | 로그인 직후 **2스텝 카드** (기존 `/onboarding` 재사용) | 관심사 → 지도 카테고리 프리셋·추천 랭킹 즉시 반영, 국적 → 추천 존·세금환급 안내 | 핵심 세그먼트(관광/거주 × 관심사 × 연령대), 시즌 수요 예측 |
| **T2 컨텍스트** (한 번에 1개) | 피부 타입·고민 / 헤어 타입·고민 / 선호 언어 / 예산대 | · 스킨클리닉 첫 찜 → "피부 타입 알려주면 맞춤 추천" 카드<br>· 헤어살롱 예약 시작 → 헤어 타입<br>· Beauty Kit 신청 → 배송·취향 (기존 설문 재사용) | 맞춤 랭킹/필터 프리셋, 킷 매칭 | 카테고리별 추천, 제휴사 리포트 |
| **T3 행동 (자동)** | 찜, 검색어, 조회 장소, 사용 필터, 별점, 예약, 경로 조회 | 이벤트 로그로 상시 수집 | — | 개인화 랭킹, "Trending near you", 리텐션 분석 |
| **T4 고신뢰** | 전화/메신저(예약 확정용), 생년(성인 시술) | 예약 확정 등 **기능상 필수인 순간에만** | 예약이 됨 | 예약 운영 |

**전략 요약: "묻는 건 T1 두 개까지, 나머지는 전부 컨텍스트 트리거."**
프로필 완성도를 마이페이지에 게이지로 노출하고, 완성 인센티브(예: 웰컴 딜 쿠폰)를 걸어 자발적 완성을 유도한다.

## 3. DB 스키마 (Supabase 기준)

```sql
-- Google이 주는 것 + 우리가 묻는 것 분리
create table profiles (
  id uuid primary key references auth.users,
  email text, display_name text, avatar_url text, locale text,   -- T0 (OAuth)
  country_code text,          -- T1 ① ISO-3166
  stay_type text,             -- T1 ② 'tourist' | 'resident' | 'planning'
  stay_until date,            -- T1 ② 여행 종료일 (tourist일 때)
  interests text[],           -- T1 ② 관심 카테고리 (PlaceType 코드값)
  age_band text, gender text, -- T1 ② 자기신고 ('18-24'… / 'female'|'male'|'other'|null)
  skin_type text, skin_concerns text[],   -- T2
  hair_type text, hair_concerns text[],   -- T2
  preferred_lang text, budget_band text,  -- T2
  completeness int generated always as (…) stored,
  updated_at timestamptz default now()
);

create table profile_consents (              -- 항목별 동의(목적 명시)
  user_id uuid references profiles, purpose text,  -- 'personalization' | 'marketing'
  granted boolean, granted_at timestamptz
);

create table user_events (                   -- T3 행동 로그 (append-only)
  id bigint generated always as identity,
  user_id uuid, type text,                   -- 'favorite' | 'search' | 'view_place' | 'filter' | 'rate' | 'route'
  target text, meta jsonb, created_at timestamptz default now()
);

create table feedback (                      -- §5 피드백 창구
  id bigint generated always as identity,
  user_id uuid null,                         -- 비로그인 허용
  category text,                             -- 'bug' | 'idea' | 'place' | 'other'
  message text, page text, app_version text,
  contact_ok boolean default false, created_at timestamptz default now()
);
```

- RLS: 본인 프로필만 읽기/쓰기, `user_events`는 insert-only, `feedback`은 insert-only(운영자만 select).
- 프로토타입 단계에서는 위 형태 그대로 **localStorage(`essenly.profile`, `essenly.feedback`)에 미러**해 두고, DB 붙일 때 키만 치환한다(찜 저장소와 같은 패턴).

## 4. 앱 반영 (이번 업그레이드 범위)

1. **마이페이지 프로필 완성도 카드** — 게이지(%) + "다음 질문 1개" 1-tap 칩 답변(답하면 즉시 다음 질문으로 교체, 전부 답하면 카드가 인센티브 안내로 바뀜). 각 질문에 "왜 묻나요" 캡션.
2. **컨텍스트 트리거 1호** — 스킨클리닉/헤어살롱 계열 장소를 처음 찜했을 때, 해당 카테고리 질문 카드가 마이페이지 상단에 우선 노출되도록 큐잉.
3. **T1 온보딩** — 기존 `/onboarding` 2스텝을 국적/체류형태 질문으로 정렬(로그인 도입 시 로그인 직후로 연결).
4. **피드백 창구(§5)**.

## 5. 피드백 창구

- **진입점**: 마이페이지 Support 섹션 "Send feedback" + 설정 하단 + Support 페이지.
- **폼(시트)**: 카테고리 4택(Bug / Idea / Wrong place info / Other) + 메시지 + "답변 받기(선택)" 토글. 현재 페이지 경로 자동 첨부.
- **저장**: `feedback` 테이블 형태(프로토타입은 localStorage) → 제출 시 토스트 "Thanks — we read every note."
- 운영 연결(추후): Supabase → Slack 웹훅으로 신규 피드백 알림.
