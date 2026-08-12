# MYSEOULDROP — 작업 핸드오프 (2026-08-11 기준)

> 다음 세션에서 이 문서 하나로 바로 이어서 작업할 수 있게 정리한 문서.
> 프로젝트 전반 문서는 `docs/README.md`, 인증 설정은 `docs/auth-setup.md` 참고.

---

## 1. 프로젝트 한 줄 요약

서울 K-뷰티 여행자용 지도 앱 (구 Essenly → **MYSEOULDROP** 리브랜딩).
Next.js 14 App Router + Supabase(인증/DB) + Vercel 배포. 실데이터 ~600곳.

| 항목 | 값 |
|---|---|
| **프로덕션** | https://seoul-guide-v2.vercel.app |
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

1. ~~[필수] Supabase Site URL~~ — ✅ 8/11 완료 (Site URL + Redirect 3개 등록 확인)
2. **[보류] 이메일 템플릿 token_hash 교체** — Supabase가 내장 메일러 사용 중엔 템플릿 편집을 잠금 → **커스텀 SMTP 선행 필요**, SMTP는 발신 도메인 필요. 순서: 도메인 구매(P2) → Resend 등 도메인 인증 → SMTP 연결 → 템플릿 교체 (auth-setup.md §1.5)
3. **소셜 로그인 콘솔 등록** — Google Cloud Console, Kakao Developers (각 ~10분, 무료). Apple은 연 $129라 보류 중 (버튼은 "준비 중" 안내)
   - 두 콘솔 모두에 등록할 **콜백 URL**: `https://njsocpyuesntblifpips.supabase.co/auth/v1/callback`
   - 발급받은 Client ID/Secret은 Supabase Dashboard → Authentication → Providers → Google/Kakao에 붙여넣고 Enable

---

## 4. 다음 작업 백로그 (우선순위순)

### P1 — 계정 기능 마무리
- [x] ~~Saved 탭 서버 우선 로딩~~ (8/10 완료 — useFavoritesReady + 스켈레톤)
- [x] ~~프로필 계정화~~ (8/10 완료 — profiles 테이블+동기화)
- [x] ~~별점 계정화~~ (8/11 완료 — ratings 테이블+스토어. Reservations 카운트만 데모값 잔존)
- [x] ~~텍스트 리뷰 작성 (private-first MVP)~~ (8/12 완료 — 상세페이지 별점 아래 컴포저, ratings.body 저장/수정/계정동기화, My reviews 노출. **본인에게만 표시** — 공개 전환은 모더레이션 도입 후 표시 로직만 변경하면 됨. 실브라우저 8/8 검증)
- [ ] **리뷰 공개 전환**: 모더레이션(신고/차단 or 사전 필터) 설계 후 상세페이지 리뷰 목록에 실사용자 리뷰 노출 (지금은 데모 리뷰만 표시). reviews/new 목업 페이지 정리 포함
- [ ] 소셜 로그인 마무리 — **범위 변경(8/11): Kakao 제외, Google+Apple 체제** (버튼도 제거됨)
  - **Google ✅ 설정 완료(8/11)** — authorize→동의화면 진입 + 앱 버튼 클릭 플로우 검증됨. 남은 건 실계정 로그인 1회 스모크(사용자)
  - **Apple ⬜ 대기** — Apple Developer Program 가입(연 $129) 필요. 가입 후: App ID + **Services ID**(=Client ID) 생성 → Sign in with Apple 키(.p8) 발급 → Supabase Providers → Apple에 Services ID + Team ID + Key ID + .p8로 생성한 secret 등록. 그 전까지 버튼은 "준비 중" 안내
  - 실로그인 후 확인 포인트: 메뉴에 프로필 이름 표시(`user_metadata.full_name`), 게스트 데이터 계정 병합
- [x] ~~직접(이메일+비밀번호) 로그인 플로우 점검~~ (8/11 완료 — 프로덕션 실브라우저: 가입 폼→Supabase 응답 인라인 표시, 로그인 성공→리다이렉트, 비번 오류→인라인 에러, 비번찾기→앤티-열거 발송 안내. 참고: Supabase 공개 가입은 실존 메일 도메인만 허용 — 테스트는 admin 생성 유저로, 실가입은 실유저 검증됨)
- [x] ~~프로필 동기화 실브라우저 e2e~~ (8/11 완료 — 프로덕션에서 헤드리스 Chrome CDP로 9/9: 실로그인 → 온보딩 답변 → profiles 행 확인 → 별점 → ratings 행 확인 → 로그아웃 시 로컬 미러 4종 퍼지 + 서버 데이터 보존. 스크립트: 세션 scratchpad `e2e-browser.mjs`)

### P2 — 품질·운영
- [ ] 커스텀 도메인 연결 (myseouldrop.com 등 — `vercel domains`)
- [ ] Supabase 이메일 발신자 커스텀 (기본 noreply@mail.app.supabase.io → SMTP 설정)
- [ ] 지도 성능: 600 마커 → 뷰포트 기반 렌더링 or canvas 렌더러 검토 (현재 무리 없음, 1000+ 대비)
- [ ] 미확보 노선 지오메트리 (경의중앙 등 9개 — `build-subway-geometry.mjs` MATCHERS 보강)
- [ ] E2E 자동화: 현재 수동 스크립트(scratchpad) → Playwright 테스트로 정식화

### P3 — 제품 확장 (이전 논의)
- [ ] 장소 데이터 DB 이전 (지금은 `lib/generated/*.ts` 정적 — 운영 편집 필요 시)
- [ ] 리뷰 수 기반 인기 표시 재검토 (한 번 뺐던 기능 — 데이터는 ratingCount로 보존됨)
- [ ] Apple 로그인 (Developer Program 가입 후)

---

## 5. 주의사항 (다음 세션 함정 방지)

- **`.next` 공유 충돌**: `npm run build`나 두 번째 dev 서버는 실행 중인 dev 서버의 캐시를 깨뜨림 → 500/404. 빌드 후엔 `start-essenly.command` 재실행. dev 서버는 **하나만**.
- **환경변수**: dev 서버는 시작 시점의 `.env.local`만 읽음 — env 바뀌면 재시작.
- **스토리지 키는 essenly.* 유지** (`essenly.favorites`, `essenly.theme` 등) — 리브랜딩 시 의도적으로 남긴 내부 식별자. 바꾸면 기존 사용자 로컬 데이터 끊김.
- **DB 마이그레이션**: `supabase/migrations/*.sql` 순번 파일 + node pg로 적용 (예시는 git log의 favorites 커밋 참고). `POSTGRES_URL_NON_POOLING` 사용, URL의 `sslmode` 파라미터 제거 후 `ssl:{rejectUnauthorized:false}`.
- **관리자 테스트 유저**: service role로 `admin.createUser({email_confirm:true})` → 테스트 → `deleteUser` 정리. `@myseouldrop.app` 도메인 사용 (가짜 TLD는 Supabase가 거부).
- **협업 규칙**: main 직푸시 대신 브랜치+PR 권장, 강제 푸시 금지. 디자인 실험은 `design/*` 브랜치.

## 6. 데이터 파이프라인 재실행

```bash
node scripts/build-creatrip-places.mjs      # 미용실 (CSV 경로 인자 가능)
./scripts/capture-kakao-oy.sh && node scripts/build-oliveyoung-kakao.mjs  # 올리브영
node scripts/build-ados-places.mjs          # 관광지·시장
node scripts/build-subway-geometry.mjs      # 선로 지오메트리 (--refresh로 OSM 재조회)
npm run build:subway-data                   # 지하철 그래프
```
캐시(`scripts/.*.json`)가 커밋돼 있어 재실행은 대부분 수 초.
