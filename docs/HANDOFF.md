# MYSEOULDROP — 작업 핸드오프 (2026-09-20 기준, PR #2 배포 완료)

> 다음 세션에서 이 문서 하나로 바로 이어서 작업할 수 있게 정리한 문서.
> 프로젝트 전반 문서는 `docs/README.md`, 인증 설정은 `docs/auth-setup.md` 참고.

---

## 1. 프로젝트 한 줄 요약

서울 K-뷰티 여행자용 지도 앱 (구 Essenly → **MYSEOULDROP** 리브랜딩).
Next.js 14 App Router + Supabase(인증/DB) + Vercel 배포. 실데이터 ~600곳.

| 항목 | 값 |
|---|---|
| **프로덕션** | https://myseouldrop.app (커스텀 도메인) · https://seoul-guide-v2.vercel.app (Vercel 기본) |
| GitHub | `Essenly-beauty/seoul-guide_v2` (main 브랜치가 배포 기준) |
| Vercel 프로젝트 | `seoul-guide-v2` (팀 admin-28156576s-projects, CLI 로그인 유지 중) |
| Supabase | `supabase-indigo-mountain` (Vercel Marketplace 연동, 무료 티어) |
| 로컬 실행 | `start-essenly.command` 더블클릭 (포트 3000, .next 자가치유) |
| 로컬 env | `.env.local` (git 제외, `vercel env pull --yes`로 재생성 가능) |

### 자주 쓰는 명령
```bash
npm run dev            # 로컬 (start-essenly.command 권장 — 헬스체크 포함)
npm run typecheck && npm run lint && npm test   # 202개 테스트
npm run build          # ⚠️ dev 서버와 .next 공유 — 빌드 후 dev 서버 재시작 필요
vercel deploy --prod --yes                      # 프로덕션 배포
vercel env pull --yes  # .env.local 재생성
```

---

## 2. 완료된 작업 (시간순 요약)

### A. 버그 수정·지도 기반 (7/28~29)
- 하단 탭바 먹통 원인 수정: `MapWiring` 인라인 콜백 무한 리렌더 → useCallback 안정화
- 실데이터 파이프라인 3종 (지오코딩 캐시 커밋됨 → 재실행 수 초):
  - **미용실 205곳**: Creatrip CSV → `scripts/build-creatrip-places.mjs` (Nominatim, 94% 주소 정확)
  - **올리브영 239곳**: 카카오맵 구별 캡처(`scripts/capture-kakao-oy.sh`) → `build-oliveyoung-kakao.mjs` (99% 정확, OSM 폴백 스크립트 별도)
  - **관광지·시장 112곳**: a_drop_of_seoul CSV 2종 → `build-ados-places.mjs` (about/aboutKr 설명 포함, 상세페이지 노출)
- 존 5개 추가(jamsil/yeongdeungpo/seoul_etc/busan/gyeonggi), 데이터 무결성 테스트 (`lib/creatrip-places.test.ts`)

### B. 디자인 전면 리뉴얼 (7/31~8/3, `design/myseouldrop-dark` → main 머지됨)
- **MYSEOULDROP 리브랜딩**: 다크(#0b0c0f) + 오렌지 #F55800, 계단형 심볼+투톤 워드마크(`components/brand/brand-logo.tsx`), Michroma 브랜드체, 전 화면 문구 교체
- **라이트 테마**: 토큰 이중화 + `ThemeProvider`(localStorage `essenly.theme`, pre-paint 부트 스크립트), 설정 화면 토글, 지도 타일도 테마 추종(dark_all/voyager)
- **지도 디자인 시스템**: 뮤트 핀 팔레트(필터 시 비비드 전환), 오렌지는 화면당 최대 2개(선택 핀+히어로 뱃지), 올리브영은 올리브 로고 마크(26px), 카카오식 역 디스크(클릭→주변 숍 브라우즈), 상단 스크림+블러
- **지하철**: 경로 편집 전체화면(카카오식), 기차표형 요약(노선색 양끝 점), **실선로 폴리라인**(`build-subway-geometry.mjs` — OSM, 1~9호선+신분당+인천1; 나머지 직선 폴백), 반경 원 표시
- **필터**: 카테고리 다중 선택, 거리 필터(500m/1km/3km), 서비스 태그 전체 노출(카테고리 카드 그룹)
- Figma 온보딩 구현: 웰컴(지도 프리뷰 카드)·스플래시·choose-mode — 양 테마

### C. 프로덕션 인프라 (8/9)
- main 머지(--no-ff)·푸시, Vercel 프로덕션 배포
- Supabase 프로비저닝(마켓플레이스, env 자동 주입)
- **실인증**: `@supabase/ssr` 쿠키 세션 + 미들웨어 갱신, `/login`·`/register`(재발송·기존이메일 가드)·`/forgot-password`·`/reset-password`, `/auth/callback`(token_hash+PKCE 겸용, 오픈리다이렉트 방어, 원인별 에러), 소셜 OAuth 연결(콘솔 등록 대기), 게스트 모드 유지
- 29-에이전트 적대적 리뷰 → 확정 결함 전부 수정 (크로스브라우저 확인 링크, 비번찾기 막다른 길, 열거 공격 안전 처리 등)
- **회원 즐겨찾기**: `favorites` 테이블+RLS(5종 격리 테스트 통과), 게스트 localStorage → 로그인 시 자동 병합, 낙관적 토글+롤백, **지도 하트 FAB 레이어**(저장한 곳만 표시)
- 첫 실유저 가입 확인됨 (gk***@naver.com, 이메일 확인 완료)

### D. 출시 준비 배치 (8/10)
- **즐겨찾기 출시 동작**: 데모 시드 제거(신규 게스트 빈 목록), `useFavoritesReady()` — Saved 탭 서버 fetch 중 스켈레톤(가짜 "nothing saved" 방지), 메뉴 Saved 뱃지/통계 실카운트(카탈로그 필터 기준)
- **프로필 계정화**: `profiles` 테이블(jsonb+RLS+updated_at 트리거, 6/6 격리 테스트 통과), 게스트 답변 로그인 시 병합(서버 필드 우선·리스트 union·미확정 로컬 수정 우선), 600ms 디바운스 write-through
- **동기화 적대적 리뷰(44 에이전트) → 확정 결함 13건 전부 수정**:
  - fetch 중 하트 토글이 스테일 스냅샷에 덮이던 레이스 → pending-intent 오버레이+플러시
  - 병합 upsert 실패에도 MERGED_KEY 소모(게스트 저장 영구 유실) → 성공 시에만 소모
  - 로그아웃 후 계정 미러가 localStorage에 잔존(공유기기 개인정보 노출 + 다음 계정에 오염) → SIGNED_OUT+로그아웃 모달에서 미러 제거(`purgeFavoritesMirror`/`purgeProfileMirror`)
  - 프로필 blind whole-row upsert(기기 간 last-writer-wins 답변 유실) → read-merge-write + dirty 필드 추적 + serverSnap 게이트(첫 fetch 실패 시 push 차단)
  - fetch 실패 시 재시도(3회 백오프), 탭 숨김/pagehide 시 디바운스 플러시, 롤백 멤버십 가드 등
- **출시 메타**: metadataBase+OG/트위터 태그, 동적 OG 카드(`app/opengraph-image.tsx`, Michroma+폴백), robots.txt(인증/계정 페이지 차단), sitemap.xml(장소 600곳 한글 id 인코딩)
- **한글 id 상세페이지 수정**: App Router params는 인코딩된 채 전달 → 올리브영 239곳 상세가 전부 soft-404였음. `lib/data.ts` decodedFind로 해결

### F. 출시 감사 대응 — Discovery-first 정직화 (8/12)
외부 감사(NO-GO 판정) 검증 결과 P0 지적 대부분 사실 → 1차 범위를 "검증된 탐색 지도"로 좁히고 즉시 반영:
- **가짜 신뢰 신호 제거**: 전 장소 공통 샘플 리뷰 6개·Verified 뱃지·합성 별점 분포·가짜 사진 128장 카운트·공통 전화/웹사이트/인스타·주차/결제 행·조작된 웰컴딜 쿠폰·"가격 N일 전 확인" 합성 문구 — 전부 삭제. 남은 건 실데이터(소스 평점·주소·내 별점/리뷰)
- **가짜 거래 차단**: 인앱 예약(₩45,000 데모 결제) → "coming soon" 안내. 메뉴/햄버거에서 Reservations·My Trip·Beauty Kit·Notifications 숨김. 키트 설문(이메일·주소 수집 후 미저장) → 미수집 안내 페이지
- **피드백 실접수**: `feedback` 테이블(insert-only RLS, 프로드 4/4 검증) + 오프라인 큐. 존재하지 않는 help@ 메일 안내 제거
- **브랜드/디자인**: manifest·아이콘이 Essenly 그대로였음 → 리브랜드(PWA/애플 아이콘 재생성). 라이트 accent #e94f00(3.76:1)→#c64200(5.0:1 AA). 브라우저 theme-color 테마 추종
- **보안**: 무음 세션 만료 후 재방문 시 계정 미러 퍼지(3개 스토어) — 공유기기 교차 계정 병합 갭 해소
- 감사 지적 중 **사실과 다른 것**: Supabase 캐시 헤더 유실 주장(코드는 공식 @supabase/ssr 패턴 그대로, 유실할 헤더 없음)
- **미반영(결정 필요)**: Next.js 15 업그레이드(major, 별도 배치), 장소 30~50곳 사람 검수 축소, 법무 검토, 계정 삭제/내보내기, CI/관측성, 실사진

### N. UX·인터랙션 / 텍스트 오버플로 / 여백 / 다이소 영문화 (9/20, **PR #2로 main 배포 완료**)
- 배포: PR #2 머지(`4d09379`) → Vercel 프로덕션. CI green, `Production public smoke`(계정 잡 포함) **9/9 통과**, 프로덕션 실측 검증 완료
- **UX 인터랙션**(`docs/research/ux-interaction-review-2026-09.md` R1~R8, 작업기록 `ux-implementation-2026-09.md`): 눌림 상태(6,400줄에 `:active` 2개뿐이었음) · 역 스테퍼가 목록 ~80px 영구 가림(WCAG 2.4.11) · 키보드 올라오면 결과 6개 중 1개만 보임 → `--kb` 훅으로 패널 축소 · 44px 미만 5계열 + 계약 테스트 무력화 2중 결함(뮤테이션 테스트로 확인) · 퇴장 애니메이션(타이머 기반, `animationend`는 reduced-motion에서 영영 안 옴) · 드래그 슬롭 4→8px + 릴리즈 시점 판정
- **긴 이름 오버플로**(`long-title-policy-2026-09.md`): 닫기 버튼이 x=413.8로 **화면 밖에서 잘려 도달 불가**였음. 원인은 `nowrap`의 min-content + row flex item `min-width:auto`. **덤으로 2줄 클램프가 원래부터 무효**였음을 발견(h2가 flex item이라 `-webkit-box`가 blockify). 전 라우트 390/360/320 스윕 → 하드 컷은 설정 행 제목 1건뿐이었고 수정
- **여백 정렬**(`gutter-alignment-2026-09.md`): 표준 16px. 신고된 "Products to look for"는 `padding` 단축이 좌우를 0으로 덮은 회귀(1df220d). 맵 크롬 5개 14→16 동시 이동(단독 이동 시 같은 결함 재생산)
- **다이소 랭킹 영문화**: 38개 전부 다이소몰 대조 + 적대적 재검증. 브랜드 오류 12건 교정("두꺼운"/"삼각"/"엠보싱"은 브랜드가 아니었음). `scripts/lib/daiso-ranking-en-overrides.json`(검증 시점 nameKr 동봉 → 재빌드 드리프트 시 테스트 실패)
- **자체 회귀 수정**: `/api/vitals`가 Next.js 자체 타이밍까지 받아 매 로드 400 반환하던 것
- 테스트 749 → 842
- **미착수(사유 기록)**: 뒤로가기 오버레이 해제(네비 회귀 위험 최고, 실기기 필요) · 지하철 그립 제스처(2026-08-22 스펙상 post-beta) · `.pad` 18→16 전면 통일(31화면 + 음수 블리드 5곳, bee7057이 같은 산술로 프로덕션 가로 스크롤바를 냄)

### M. 웹앱 베스트프랙티스 리서치 → P0 조치 배치 (9/20, 브랜치 `feat/p0-best-practices`, 미머지)
- **리서치**: `docs/research/web-app-best-practices-2026-09.md`(요약·우선순위) + `docs/research/raw/01~06`(원문 6편). W3C/WCAG 2.2·web.dev·MDN·Next.js/Vercel·Apple HIG/WebKit·Material 3·NN/g·Baymard·OWASP Top 10:2025·NIST 800-63B-4·Supabase·HTTP Archive 2025·HN 체크리스트를 코드와 대조해 P0 10건 확정
- **구현(커밋 7개, 테스트 749→780)**:
  - 장소 상세 ~600p `generateMetadata`(고유 title/description/canonical/og:url) + `app/place/[id]/opengraph-image.tsx`(한글 상호는 Noto Sans KR glyph-subset으로 렌더, `revalidate` 1일) + schema.org LocalBusiness JSON-LD(`lib/place-seo.ts` — HairSalon/MedicalClinic/Store/TouristAttraction 매핑, **aggregateRating 미출력**은 정책상 의도)
  - 폰트 셀프호스팅 `app/fonts.ts`(next/font: Fraunces·Plus Jakarta Sans·Geist Mono·Michroma) — `globals.css` Google Fonts `@import` 제거, CSP에서 googleapis/gstatic 삭제. 한글은 시스템 폰트 유지(로밍 데이터)
  - 위치 권한: 마운트 즉시 `getCurrentPosition` → **이미 granted일 때만** 자동, 아니면 FAB/지하철 "Use location" 탭에서만 프롬프트(`lib/geolocation-policy.ts`, `useLocation` status에 `idle` 추가)
  - 비밀번호 정책 `lib/auth-policy.ts`(최소 8자, bcrypt 72바이트 상한, 조합 규칙 없음) — 가입·재설정 `minLength={6}` 교체
  - CARTO 타일 키: `NEXT_PUBLIC_CARTO_API_KEY` 있으면 `?key=` 부착(`lib/map-tiles.ts`) — 2026-08-26 약관상 키 필수
  - RUM: `components/system/web-vitals-reporter.tsx` → `POST /api/vitals`(same-origin·검증·no-store) → `web_vitals` 테이블(`0010`, insert-only RLS)
  - 에러 리포터 마스킹 `lib/redact.ts`(토큰 쿼리/프래그먼트·JWT·이메일) + **버그 수정**: `client_errors.kind` 제약에 `'csp'`가 없어 CSP 위반 리포트가 전부 DB에서 거부되던 것(`0009`) — 계약 테스트로 고정
  - 개인정보처리방침 갱신: 수탁자(Supabase **AWS us-east-1**·Vercel·Google)·국외이전·보관기간(진단 데이터 12개월)·권리 행사·PIPC/EU DPA 진정 — 여전히 "법무 검토 전 초안" 표시
- **보류(사용자 결정 필요)**: ① 장소 데이터 ~1MB 번들 분리(리서치 D1 설계는 문서에 있음 — 검색·즐겨찾기·지하철이 동기 배열에 의존해 대규모 리팩터) ② 오렌지 본문 텍스트 대비 3.76:1(8/15 사용자 결정으로 복원한 색 — 토큰 분리 제안만)
- **검증(9/20, `next build` + `next start -p 3001`)**: 한글 id 상세 title/description/canonical(percent-encoded)/JSON-LD 정상, 장소 OG PNG 1200×630(한글명 렌더 확인), `/api/vitals` 204/400/403/405, 폰트 `/_next/static/media` 셀프호스팅·HTML에 googleapis 0건·CSP 축소 확인, E2E `daiso-map` 4/4 통과(스펙의 낡은 251 기대값 → 게재 다이소 수로 수정). `launch`·`account`·`error-tracking` 스펙은 Supabase 접근 불가로 실행 불가
- **확인된 한계**: ① 없는 장소 id는 `generateMetadata`에서 `notFound()`를 던져도 **HTTP 200**(루트 `app/loading.tsx` Suspense 셸이 먼저 flush — Twitterbot UA도 동일). 본문에 `<meta name="robots" content="noindex">`가 자동 삽입되어 색인은 안 되지만 진짜 404는 아님 → 진짜 404가 필요하면 loading.tsx 범위 재설계 필요 ② 한글 id의 `og:image` URL이 Next 파일 규약에서 이중 인코딩(`%25ED…`)됨 — 해당 URL로 요청해도 PNG 정상 반환(기능상 문제 없음, 미관상만)
- ✅ 마이그레이션 0009·0010 프로덕션 적용 완료(9/20 16:1x, Supabase 재개 직후 — §3-0)

### L. 지도 성능 + 게스트 로그인 퍼널 (8/15)
- **지도 성능: Lighthouse 모바일 40 → 81, LCP 12.0s → 2.5s, TBT 980 → 380ms** (시각 변화 0):
  ① 마커 뷰포트 컬링(603→~60 divIcon, 30% 패드) ② 지하철 컨트롤러+선로 지오메트리 지연 로드(역 디스크용 STATIONS는 유지) ③ 타일 CDN preconnect + 첫 화면 타일 6장 결정적 프리로드 ④ **초기 뷰 정적 스냅샷을 SSR HTML에 포함**(fetchpriority=high, 테마 게이트) → 타일 로드 시 페이드아웃 — LCP가 FCP 시점으로 이동
  - 스냅샷 재생성: 헤드리스 캡처(마커/UI 제거) → public/map-placeholder-{light,dark}.jpg. 초기 센터/줌 바꾸면 재생성 필요
- **게스트→계정 퍼널**(사용자 요청): 첫 하트/첫 별점 1회 바텀시트(?next 복귀), 빈 저장 레이어 FAB은 안내로 대체, Saved 탭 게스트 배너, 메뉴 CTA primary. 회원에겐 미표시, 컨텍스트별 기기 1회 (`essenly.nudge.*`, `components/auth/signin-nudge.tsx`)
- 잔여 성능 여지(81→90+): First Load JS 다이어트(장소 데이터 분리) — 체감 대비 공수 커서 보류

### K. 라이트 모드 기본 전환 + 플로우 맵 (8/15)
- **서비스 기본 테마 = 라이트(화이트)** (사용자 결정). 명시적으로 다크를 저장한 사용자만 다크 유지. 부트 스크립트·ThemeProvider·viewport theme-color·PWA manifest·온보딩 피커(Light 우선) 일괄 전환
- html에 suppressHydrationWarning — 부트 스크립트의 pre-paint 속성 스탬프가 React 19 hydration 경고를 유발하던 것 해결 (플로우 재촬영 중 dev 오버레이로 발견)
- **화면 플로우 맵 아티팩트**: 8개 여정 44장(라이트 기본 + 다크 샘플 3장), mermaid 여정 다이어그램 포함 — 캡처 자동화 스크립트로 갱신 가능 (세션 scratchpad `capture-flows.mjs`)
- 이후 모든 디자인/QA 작업 기준은 화이트 모드

### J. 사용성 라운드 + Next 15 (8/15)
- **자동 로그인 체감 수정**: `/`·`/login`·`/register`가 서버에서 세션 확인 → 회원은 즉시 `/map` (login/register는 서버 래퍼 + 클라이언트 컴포넌트로 분리). 가입 확인 후 웰컴에 떨어져 "가입 안 된 듯" 보이던 문제의 근본 원인
- **에러 페이지**: client_errors 첫 실전 수확 — 닫힌 라우트들의 NEXT_REDIRECT가 window 에러로 새던 것 확인 → next.config redirects()로 전환(페이지 파일 삭제), 리포터에 Next 제어흐름 에러 필터
- **register**: "Check your email" 화면에 다른 기기에서 확인한 사용자용 Sign in 경로 추가
- **오렌지 복원(사용자 결정)**: 라이트 accent를 원래 #e94f00으로 — AA-small 3.76:1 트레이드오프는 토큰 주석에 문서화. --dim 보정과 칩 토큰화는 유지
- **Next.js 15 + React 19 + react-leaflet 5 업그레이드**: 격리 워크트리에서 검증(빌드+E2E 11종+지도 마커 603개) 후 --no-ff 병합. codemod로 async cookies() 자동 전환, ref 타입 2건 수동. `.eslintrc`에 root:true
- E2E 11종 (returning-member 자동 로그인 스펙 추가)

### G. Claude×Codex 상호 검증 라운드 (8/12)
- codex CLI(읽기 전용)로 감사 대응을 역검증 → **잔여 결함 5건 확인·전부 수정**: +12 사진 뱃지·시설 칩·프로필 완성 "여권 10% 딜"·Report-an-issue 가짜 토스트·미차단 프로토타입 라우트(/bookings, /trip, /mypage/reviews/new, /mypage/notifications → redirect)·지원 FAQ/약관의 미구현 기능 서술·라이트 틴트 위 대비(accent #b83d00, 칩 토큰화, --dim 보정)
- **핵심 발견**: 스크래핑 장소에는 services가 전무 — 화면의 모든 서비스 메뉴/가격은 샘플 44곳의 창작물 → "Example menu for this category" 라벨로 전환. 진짜 해결은 P1 데이터 원장(G)
- **공유기기 A→B 직접 전환 격리**: 죽은 세션의 미러를 병합 전 소유자 불일치로 퍼지(3개 스토어) + 피드백 큐 작성자 고정·저장 read-back 검증·미저장 시 시트 유지
- **Playwright E2E 8종 정식화** (`npm run e2e`): 스모크 4 + 인증/동기화 4(공유기기 회귀 포함). GitHub Actions CI(typecheck/lint/test/build)도 커밋됨
- 합의 우선순위(양측 스코어 병합): ①공개표면 정직화 ✅ ②격리 강화 ✅ ③CI+E2E ✅ ④계정 삭제/내보내기 ✅ ⑤데이터 원장 슬라이스 ✅(8/12) ⑥오류추적 ✅(8/12) ⑦Next15 ⑧실기기 QA

### I. 오류추적 + 원장 슬라이스 (8/12)
- **자체 오류추적**: `client_errors` 테이블(insert-only RLS, 프로드 적용) + `lib/error-reporter.ts`(onerror/rejection/바운더리, 세션 10건 캡·중복제거·확장프로그램 필터) — 프로드 실브라우저 검증 통과
- **Uptime 경보**: GitHub Actions 30분 cron이 홈/맵/함수 probe, 실패 시 소유자 메일. 봇챌린지 403은 정상 처리. 수동 dispatch로 검증됨
- **`docs/runbook.md`**: 감지 채널·증상별 대응(롤백 절차)·조회 SQL·키 로테이션 1페이지
- **장소 출처 필드**: 전 장소 `source: curated|creatrip|kakao|ados` — 상세페이지에서 큐레이션 44곳의 합성 평점 숨김 + 출처 공시 문구 + 근사 좌표(geoSource:area) 표시. 전체 원장(검증일·폐업 플래그)은 백로그
- E2E 10종으로 확장 (에러 리포터 왕복 포함), CI/Uptime 모두 green

### H. 계정 삭제 + 데이터 내보내기 (8/12)
- `GET /api/account/export` — 계정·뷰티프로필·즐겨찾기·별점 JSON 다운로드(본인 세션 RLS로 조회)
- `POST /api/account/delete` — 세션 인증+same-origin 가드, service role deleteUser(행 cascade, feedback은 작성자만 NULL). 설정 → Data & privacy(확인 모달, 로컬 미러 퍼지 포함)
- 설정의 미연결 데모 폼(헤어/스킨/트립 + 가짜 "Save Changes" 토스트) 제거 — 실편집은 온보딩/프로필카드로 링크
- 개인정보처리방침을 사실로 갱신: "설정에서 즉시 자가 삭제"
- E2E `account-lifecycle.spec.ts`: 데이터 생성→export 포함 확인→UI 삭제→유저/행/미러/세션 전부 소멸 — **프로덕션에서 직접 통과**
- CI: 프리렌더가 공개 env 요구 → 플레이스홀더 폴백으로 vars 없이도 green (실값은 GitHub repo Variables에 등록 권장)
- 주의: curl 폴링이 Vercel Security Checkpoint(봇 챌린지)를 유발 — 프로드 확인은 헤드리스 Chrome으로

### E. 리뷰(별점) 계정화 (8/11)
- `ratings` 테이블(rating 1-5, body 컬럼은 향후 텍스트 리뷰용 예약, RLS 4종, touch 트리거) — 프로드 적용, 7/7 검증(게스트 병합 시 계정 별점 우선, 한글 id, 제약 가드)
- `lib/ratings.ts` — favorites와 동일한 강화 패턴(pending 오버레이·병합 플래그·재시도·로그아웃 퍼지). 레거시 `essenly.myrating` 숫자 형태 읽기 시 자동 업그레이드
- 상세페이지 별점 위젯 공유 스토어 전환, My reviews 페이지 실데이터(목업 제거), 메뉴 카운트 라이브
- Supabase Site URL 설정 완료됨(사용자 확인) — localhost 메일 문제 해결

---

## 3. ⚠️ 사용자(계정 소유자) 액션 대기 — 최우선

> 상세 절차: `docs/auth-setup.md`

0. ~~[긴급] Supabase 프로젝트 접근 불가~~ — ✅ **9/20 16:10 해결**. 원인: Free 플랜 **자동 일시중지**(대시보드 "Project is paused", 재개 기한 2027-10-06). 9/18 15:09Z 스모크 실패 메일이 첫 신호였고, 예약 스모크는 계정 잡을 skip해서 ~40시간 미감지. 오너가 백업 다운로드 후 Resume → DNS·Auth health·REST·풀러 접속·데이터(auth.users 5, favorites 10, ratings 3, client_errors 37) 전부 정상 확인 → 마이그레이션 **0009·0010 적용 완료**(검증: csp kind 허용, web_vitals RLS+insert 정책) → `Production public smoke`(계정 잡 포함) **9/9 통과**(run 35496788579). 재발 방지로 uptime cron에 Supabase Auth health + REST 핑 추가(커밋 ef8c9ea, 30분마다 API 활동 발생 → 유휴 정지 방지). 스모크 스펙 2개가 미게재 샘플 장소를 쓰던 것도 수정(15f3b1c)
0-1. **[보류 — 오너 결정 2026-09-20] Supabase Auth 비밀번호 최소 길이 상향은 하지 않는다.** 근거: 전체 5개 계정 중 비밀번호를 가진 것은 **2개뿐**이고(나머지 3개는 Google 신원으로 비밀번호가 아예 없음), 클라이언트가 `lib/auth-policy.ts`로 이미 8자·72바이트를 강제하므로 정상 경로 사용자는 6자를 만들 수 없다. 서버가 6자를 받는 것은 9/20 실측으로 확인했으나(테스트 계정 즉시 삭제), 그 구멍에 닿으려면 폼을 우회해 API를 직접 호출해야 하고 피해는 본인 계정에 한정된다. **되살릴 조건**: 이메일 가입 비중이 늘거나, 비밀번호 계정에 결제·민감정보가 붙으면 그때 Dashboard → Authentication에서 8로 올린다(소급 적용 안 되므로 그때 해도 마이그레이션·공지 불필요). 문자 조합 요건은 그때도 켜지 말 것(NIST SP 800-63B-4).
0-1-b. **[미완] Supabase에서 Kakao 프로바이더 끄기** (Dashboard → Authentication → Providers → Kakao → Disable) — 9/20 `/auth/v1/settings`에서 `kakao: true` 확인. 8/11 결정(§4 P1)으로 **카카오는 범위에서 제외**됐고 앱의 카카오 버튼도 제거된 상태라, UI에 진입로가 없는 인증 경로만 서버에 열려 있다. 악용 경로는 아니지만(콜백 URL과 클라이언트 자격증명 필요) 쓰지 않는 인증 표면은 닫는 편이 맞다.
   - **영향 범위 — 이름만 같은 별개 3가지다(9/20 코드 확인, 헷갈리기 쉬움):**
     1. **카카오맵 길찾기 버튼은 무관.** `lib/geo.ts`의 `kakaoRouteUrl()`은 `https://map.kakao.com/link/to/…` 평문 링크일 뿐 인증·키·SDK를 쓰지 않는다. 프로바이더를 꺼도 그대로 동작한다
     2. **`KAKAO_REST_API_KEY`도 무관.** `scripts/backfill-hours.mjs`·`backfill-kr-names-2.mjs`가 로컬에서 쓰는 데이터 파이프라인용 키이고 앱 번들에 들어가지 않는다(`.env.local`에 카카오 변수 없음, 브라우저에 카카오 스크립트 0건)
     3. **닫히는 것은 카카오 계정 로그인 경로 하나뿐.** 해당 신원을 가진 계정은 `gk***@naver.com` 1개인데 같은 계정에 email+비밀번호가 살아 있어 접근을 잃지 않는다
   - 되살릴 생각이면 §3-3의 Kakao Developers 등록 항목과 함께 결정할 것
0-2. ~~CARTO API 키~~ — ✅ 9/20 완료. 오너가 발급 후 Vercel env `NEXT_PUBLIC_CARTO_API_KEY`(Production+Preview, Development 제외)에 저장. Referer 제한 4개(`myseouldrop.app`, `www.myseouldrop.app`, `seoul-guide-v2.vercel.app`, `*.vercel.app`) — localhost는 폼이 거부해 제외했고, Development에 키를 두지 않으므로 로컬은 무키로 동작(워터마크만, 정상)
0-3. ~~`feat/p0-best-practices` 브랜치 리뷰·머지~~ — ✅ 9/20 PR #2로 머지·배포 완료

1. ~~[필수] Supabase Site URL~~ — ✅ 8/11 완료 (Site URL + Redirect 3개 등록 확인)
2. **[보류] 이메일 템플릿 token_hash 교체** — Supabase가 내장 메일러 사용 중엔 템플릿 편집을 잠금 → **커스텀 SMTP 선행 필요**, SMTP는 발신 도메인 필요. 순서: 도메인 구매(P2) → Resend 등 도메인 인증 → SMTP 연결 → 템플릿 교체 (auth-setup.md §1.5)
3. **소셜 로그인 콘솔 등록** — Google Cloud Console. Apple은 연 $129라 보류 중 (버튼은 "준비 중" 안내). **Kakao는 8/11에 범위에서 제외됨**(§4 P1) — 이 항목의 Kakao 부분은 그 결정 이전에 쓰인 것이므로 유효하지 않다. 서버 프로바이더는 아직 켜져 있으니 0-1-b 참조
   - 두 콘솔 모두에 등록할 **콜백 URL**: `https://njsocpyuesntblifpips.supabase.co/auth/v1/callback`
   - 발급받은 Client ID/Secret은 Supabase Dashboard → Authentication → Providers → Google/Kakao에 붙여넣고 Enable

---

## 4. 다음 작업 백로그 (우선순위순)

### P1 — 리서치 후속 (9/20, `docs/research/web-app-best-practices-2026-09.md` §5)
- [ ] 장소 데이터 번들 분리 — `public/data/places-index.<hash>.json` + `headers()` immutable, 클라이언트는 hydration 후 fetch (리서치 D1). 보류 사유: 검색·즐겨찾기·지하철 근처 목록이 동기 `PLACES` 배열 의존
- [x] ~~Uptime 워크플로에 Supabase health probe 추가~~ (9/20 완료 — Auth health + REST 핑, 비-2xx = DOWN)
- [ ] 진단 데이터 12개월 정리 잡(정책에 명시함): `delete from client_errors|web_vitals where created_at < now() - interval '12 months'` — GitHub Actions cron 또는 pg_cron
- [ ] 접근성 axe 4스펙(홈 시트 닫힘/열림·상세·로그인·지하철) + 결과 수 `role=status` + 리스트 시트 비모달(`aria-modal` 제거) 정리
- [ ] SW: 업데이트 토스트(무조건 `skipWaiting` 제거) + navigation preload + 빌드 ID 캐시 정리
- [ ] 필터 시트 "Show N places" 스티키 + 적용 필터 칩 개별 해제 + 0건 "반경 확대"
- [ ] 분석 도구(언어·국가·길찾기 앱 선택 비율) — 도입 시 EU opt-in 배너 필요
- [ ] Turnstile(가입/로그인/재설정) + Vercel WAF `/api/account/*` 레이트리밋 1규칙
- [ ] ITP 7일 대비 게스트 저장 N개↑ 시 "계정에 저장/홈 화면 추가" 넛지
- [ ] 위치 프라이밍 한 줄 시트(FAB 첫 탭 시) — 현재는 바로 브라우저 프롬프트

### P1 — 계정 기능 마무리
- [x] ~~Saved 탭 서버 우선 로딩~~ (8/10 완료 — useFavoritesReady + 스켈레톤)
- [x] ~~프로필 계정화~~ (8/10 완료 — profiles 테이블+동기화)
- [x] ~~별점 계정화~~ (8/11 완료 — ratings 테이블+스토어. Reservations 카운트만 데모값 잔존)
- [x] ~~텍스트 리뷰 작성 (private-first MVP)~~ (8/12 완료 — 상세페이지 별점 아래 컴포저, ratings.body 저장/수정/계정동기화, My reviews 노출. **본인에게만 표시** — 공개 전환은 모더레이션 도입 후 표시 로직만 변경하면 됨. 실브라우저 8/8 검증)
- [x] ~~리뷰 공개 전환~~ (8/16 완료 — **동의 우선**: 약관의 "with your consent" 준수, 컴포저 "Post publicly" 체크박스(신규 기본 ON)만 공개, 기존 리뷰 전부 비공개 유지. `0007_public_reviews.sql`: ratings.id/is_public/hidden + 마스킹 뷰 `public_reviews`(first name만, user id 미노출) + `review_reports`(계정당 1회, **3인 신고 자동 숨김** 트리거, 팀은 service role로 검토). 상세페이지 Traveler reviews 목록 + 인라인 신고. 프로덕션 왕복 E2E 통과: 공개 작성→게스트 노출→비공개 전환→노출 제거. reviews/new 목업은 이전에 redirect 처리됨)
- [ ] 소셜 로그인 마무리 — **범위 변경(8/11): Kakao 제외, Google+Apple 체제** (버튼도 제거됨)
  - **Google ✅ 설정 완료(8/11)** — authorize→동의화면 진입 + 앱 버튼 클릭 플로우 검증됨. 남은 건 실계정 로그인 1회 스모크(사용자)
  - **Apple ⬜ 대기** — Apple Developer Program 가입(연 $129) 필요. 가입 후: App ID + **Services ID**(=Client ID) 생성 → Sign in with Apple 키(.p8) 발급 → Supabase Providers → Apple에 Services ID + Team ID + Key ID + .p8로 생성한 secret 등록. 그 전까지 버튼은 "준비 중" 안내
  - 실로그인 후 확인 포인트: 메뉴에 프로필 이름 표시(`user_metadata.full_name`), 게스트 데이터 계정 병합
- [x] ~~직접(이메일+비밀번호) 로그인 플로우 점검~~ (8/11 완료 — 프로덕션 실브라우저: 가입 폼→Supabase 응답 인라인 표시, 로그인 성공→리다이렉트, 비번 오류→인라인 에러, 비번찾기→앤티-열거 발송 안내. 참고: Supabase 공개 가입은 실존 메일 도메인만 허용 — 테스트는 admin 생성 유저로, 실가입은 실유저 검증됨)
- [x] ~~프로필 동기화 실브라우저 e2e~~ (8/11 완료 — 프로덕션에서 헤드리스 Chrome CDP로 9/9: 실로그인 → 온보딩 답변 → profiles 행 확인 → 별점 → ratings 행 확인 → 로그아웃 시 로컬 미러 4종 퍼지 + 서버 데이터 보존. 스크립트: 세션 scratchpad `e2e-browser.mjs`)

### P2 — 품질·운영
- [x] ~~커스텀 도메인 연결~~ — **이미 연결되어 있음**(9/20 확인): `https://myseouldrop.app` 200으로 실앱 서빙, `www.`는 308 리다이렉트. `metadataBase`/canonical/OG가 가리키는 도메인과 일치. 백로그에 미완으로 남아 있던 것을 정정
- [ ] Supabase 이메일 발신자 커스텀 (기본 noreply@mail.app.supabase.io → SMTP 설정)
- [x] ~~지도 성능: 뷰포트 기반 렌더링~~ (8/16 완료 — bounds.pad(0.3) 뷰포트 컬링 + 타일 프리로드 + SSR 스냅샷, Lighthouse 40→81)
- [x] ~~미확보 노선 지오메트리~~ (8/16 완료 — **20/20 전 노선 실선로**. 원인은 매처가 아니라 발견 쿼리: 광역전철=route=train, 경전철=route=light_rail. 계약 테스트 `lib/subway-geometry.test.ts` 추가)
- [x] ~~E2E 자동화 정식화~~ (8/15 완료 — Playwright `e2e/` 13 specs + GitHub Actions CI)

### P3 — 제품 확장 (이전 논의)
- [x] ~~공유 즐겨찾기 리스트 → 지도 뷰~~ (8/16 v1 완료 — `shared_lists` 스냅샷 테이블+RLS(`0006_shared_lists.sql`, 오너가 직접 적용), Saved 탭 "Share this list"(게스트=join sheet), `/map?list={uuid}` 핀 레이어+배너+Save all, 깨진 링크는 토스트+일반 지도 폴백. **프로덕션 왕복 E2E 통과** — 회원 공유→게스트 열람→Save all→가입 유도. OG 미리보기 카드 8/16 완료(generateMetadata, 프로덕션 E2E 검증). 리스트 이름 직접 입력 8/16 완료 — 기능 완결)
- [ ] **한글 상호명 백필**: creatrip 205곳 전부 `nameKr`가 영어 그대로 (예: KKAL SALON). 택시 모달·카드가 한글 상호를 우선 표시하도록 되어 있어 데이터만 채우면 됨 — Kakao Local REST 키워드 검색(좌표+상호 매칭)으로 파이프라인에서 백필 (ados는 111/112 한글 보유)
- [ ] 장소 데이터 DB 이전 (지금은 `lib/generated/*.ts` 정적 — 운영 편집 필요 시)
- [ ] 리뷰 수 기반 인기 표시 재검토 (한 번 뺐던 기능 — 데이터는 ratingCount로 보존됨)
- [ ] Apple 로그인 (Developer Program 가입 후)

---

## 5. 주의사항 (다음 세션 함정 방지)

- **`.next` 공유 충돌**: `npm run build`나 두 번째 dev 서버는 실행 중인 dev 서버의 캐시를 깨뜨림 → 500/404. 빌드 후엔 `start-essenly.command` 재실행. dev 서버는 **하나만**.
- **환경변수**: dev 서버는 시작 시점의 `.env.local`만 읽음 — env 바뀌면 재시작.
- **`NEXT_PUBLIC_CARTO_API_KEY`**(9/20 추가, 선택): CARTO 베이스맵 키. 없으면 무키 URL 그대로.
- **`.next` vs `.next-dev`**: `next.config.mjs`가 dev는 `.next-dev`, build는 `.next`로 분리(9/20 확인) — 빌드가 dev 서버를 깨뜨리는 문제는 해소됨. 단 포트 3000은 다른 프로젝트(sj-studio)가 점유 중일 수 있음 → 이 앱 검증은 `next start -p 3200` 등 다른 포트.
- **스토리지 키는 essenly.* 유지** (`essenly.favorites`, `essenly.theme` 등) — 리브랜딩 시 의도적으로 남긴 내부 식별자. 바꾸면 기존 사용자 로컬 데이터 끊김.
- **DB 마이그레이션**: `supabase/migrations/*.sql` 순번 파일 + node pg로 적용 (예시는 git log의 favorites 커밋 참고). `POSTGRES_URL_NON_POOLING` 사용, URL의 `sslmode` 파라미터 제거 후 `ssl:{rejectUnauthorized:false}`.
- **관리자 테스트 유저**: service role로 `admin.createUser({email_confirm:true})` → 테스트 → `deleteUser` 정리. `@myseouldrop.app` 도메인 사용 (가짜 TLD는 Supabase가 거부).
- **협업 규칙**: main 직푸시 대신 브랜치+PR 권장, 강제 푸시 금지. 디자인 실험은 `design/*` 브랜치.

## 6. 데이터 파이프라인 재실행

```bash
node scripts/build-creatrip-places.mjs      # 미용실 (CSV 경로 인자 가능)
./scripts/capture-kakao-oy.sh && node scripts/build-oliveyoung-kakao.mjs  # 올리브영
node scripts/build-ados-places.mjs          # 관광지·시장
npm run build:daiso-data                    # 다이소 251곳 (승인 스냅샷 data/sources/daiso-seoul-2026-09-03.json)
npm run build:daiso-supplement              # 다이소 마트 입점 33곳 (오너 목록 + 다이소몰 API 스냅샷, 지오코딩 캐시 커밋됨)
node scripts/build-subway-geometry.mjs      # 선로 지오메트리 (--refresh로 OSM 재조회)
npm run build:subway-data                   # 지하철 그래프
```
캐시(`scripts/.*.json`)가 커밋돼 있어 재실행은 대부분 수 초.
