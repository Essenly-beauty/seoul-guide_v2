# 웹앱 Codex 코드 리뷰 수정 기록 (2026-10-20 밤, Claude)

어젯밤 구현(비회원 ♥ 미보관·스켈레톤·사진 헤더·첫 리뷰·지하철 밀도·관리자 사진 영역 스위치)에 대한 Codex 코드 리뷰를 9점까지 올리는 반복 기록. 작업 트리는 `.worktrees/service-quality-20261018`(브랜치 `codex/service-quality-release-20261018`), 개발 서버 127.0.0.1:3113, 로컬 QA DB 54382. 원격 DB에는 아무것도 적용하지 않았다.

## 1. 1차 리뷰 (SCORE 6) → 수정

| # | 지적 | 수정 | 파일 | 검증 |
|---|---|---|---|---|
| 1 | [P1] RPC가 5키만 허용 → 마이그레이션 전 DB에서 연락처·공지 저장까지 실패 | SQL이 4/5키 허용(`p_values - 'showPhotos'` 키 수 4 + 필수키 4), `showPhotos`는 있을 때만 boolean 검사, 누락 시 `coalesce(…, p.show_photos, true)`로 기존 값 유지. 관리자 UI는 서버 스냅샷에 `showPhotos`가 있을 때만 필드와 스위치를 보냄/표시 | `supabase/migrations/20261020123000_store_profile_show_photos.sql`, `components/partner/partner-store-profile.tsx:22,60` | DB 테스트 157 checks(4키 저장 → true 유지, 5키 false → 4키 저장 시 false 유지, `'yes'`·여분 키 거부, 공개 프로필 false), 실 API 4키 PATCH 200 |
| 2 | [P1] 지도 상세는 정적 장소라 사진 OFF 미적용 | 새 훅 `usePublishedPlace`: `/api/places/{id}/profile`·`/media`를 가져와 서버와 같은 `mergePublicPlaceProfile`→`mergePublicPlaceMedia`로 병합, 지도 시트의 요약·상세·CTA·액션바에 전달 | `components/place/use-published-place.ts`, `components/map/map-sheet.tsx` | `qa/impl-map-photos-off.cjs` 10/10 (OFF → `.place-hero-chrome` 1·사진 영역 0·프로필 이름 표시 → ON 복귀) |
| 3 | [P2] 가입 복귀 저장: pending 먼저 삭제, 서버 응답 전 성공 토스트 | `saveFavorite()`가 서버 결과(`saved`/`failed`/`superseded`)를 기다림; 성공 후에만 보류 요청 삭제·토스트, 실패는 다음 화면에서 재시도(`peek`/`clear` 분리) | `lib/favorites.ts`, `lib/signup-return.ts`, `components/auth/signup-return-notice.tsx` | 회귀 스크립트(비회원 ♥→가입 시트→로그인 복귀 저장) 21/21, 단위 `lib/favorites-save.test.ts` 5 |
| 4 | [P2] 라이트박스 포커스 관리 없음 | `useDialogFocus`(초기 포커스 ×, Tab 트랩, 닫힌 뒤 타일로 복귀), ‹ › 버튼 + ←/→ 키, 가장자리는 clamp(disabled로 두면 포커스가 페이지로 떨어짐) | `components/place/place-detail-body.tsx` PhotoLightbox | `qa/impl-map-lightbox.cjs` |
| 5 | [P2] 라이트박스가 transform 있는 지도 시트에 갇힘 | `.app-shell`로 `createPortal`, `host !== null`일 때 포커스 훅 open | 같은 파일 | 포털 부모 `app-shell`, 390×844 전면 |
| 6 | [P2] 48역·좁은 화면에서 트랙 잘림, 포인터 좌표 어긋남 | 역을 레일(`.subway-track-rail`, inset 10px) 위에 `left: index/last %`로 절대 배치, 밀도는 ResizeObserver로 잰 레일 폭으로 결정(`lib/subway-track.ts`), `focusStopAt`도 레일 기준 | `components/subway/subway-route-controller.tsx`, `app/globals.css`, `lib/subway-track.ts`(+test) | `qa/impl-track-geometry.cjs` 8/8 (320/390px × 16·39·48·60역: 넘침 0, 중심 ↔ `round(ratio*last)` 일치), 단위 테스트 3 |
| 7 | [P2] 썸네일 cover 변경이 기존 테스트와 불일치 | `ImageThumbnail`에 `fit` prop — **장소 사진만 cover**, 상품(`fit="contain"`)·브랜드는 contain 유지(상품 패키지명 잘림 방지, Codex가 쓴 상품 테스트와 일치). 테스트 기대값 갱신 | `components/ui/image-thumbnail.tsx`, `components/product/product-thumbnail.tsx`, `lib/place-image.test.tsx`, `lib/map-selection-wiring.test.ts` | vitest |

### 수정 중 발견한 기존 결함
- `app/globals.css`의 예약 시트 스크림 `.overlay` 규칙이 IconButton `variant="overlay"`(class `iconbtn overlay`)에도 매칭돼 **모든 overlay 아이콘 버튼이 `position:absolute; inset:0; z-index:80` + 스크림 애니메이션**을 받고 있었다(어젯밤 라이트박스 ×도 (0,0)에 있었음). `.overlay:not(.iconbtn)`로 범위를 제한했다. 장소 헤더 뒤로가기(14,14)·지도 상세 접기 버튼 위치는 변화 없음(스크린샷 `evidence/2026-10-20-codex-round2/overlay-place-header.png`).
- 어젯밤 "vitest 36파일 938개 통과"는 부분 실행이었다. 전체 실행에서 `lib/map-selection-wiring.test.ts`의 계약 3개(삭제된 Photos 섹션·옛 collage props·`objectFit: "contain"`)와 상품 테스트 2개가 깨져 있었다 → 현재 마크업/정책으로 갱신.

## 2. 2차 리뷰 (SCORE 7) → 수정

| 판정 | 지적 | 수정 | 검증 |
|---|---|---|---|
| PARTIAL→ | 로컬 목록에 있으면 서버 확인 없이 `saved`; `adoptServerState`가 같은 seq를 재전송해 실패를 `superseded`로 오판 | 항목별 `latestSeq` — 더 새 토글이 있을 때만 `superseded`(먼저 끝나 pending을 지웠어도), 중복 재전송 삭제(계정 전환 시 다른 uid 재전송도 함께 제거), 로컬에 있어도 멱등 upsert로 서버 확인(`confirmSaved`, 롤백 없음) | `lib/favorites-save.test.ts` 5개: saved / failed·롤백·재시도 / 로컬 존재 시 서버 확인 / 더 새 토글의 delete가 먼저 끝나도 superseded / 비회원 failed |
| PARTIAL→ | HTTP 실패를 "미공개"로 병합해 60초 캐시 → OFF가 ON으로 되돌아갈 수 있음 | 두 엔드포인트 중 하나라도 실패하면 `null` → memo·setState 안 함, 마지막 정상값(없으면 정적) 유지. 60초는 "같은 핀을 다시 선택할 때 재조회"의 의미로 명시 | `lib/published-place-client.test.ts` 4개: 병합 / 미공개→정적 / 503·네트워크→null / 다른 placeId 무시 |
| 신규 | 포털 안 세로 드래그가 React 버블링으로 시트 드래그가 됨(`body.contains(target)` false → `scroller:null`) | 라이트박스 루트에서 pointer/touch/wheel/click `stopPropagation`(keydown은 제외 — `useDialogFocus`가 document에서 Tab/Esc) | `impl-map-lightbox.cjs` `dragDoesNotMoveSheet`: 340px 세로 드래그 후 `.mapsheet full has-selection` top 0 유지 |
| PARTIAL→ | 배경 비활성화 없음 | 열려 있는 동안 host(`.app-shell`)의 다른 자식에 `inert`, 닫으면 제거 | `backgroundInert`·`inertRestored` |
| 신규 | OFF가 도착해도 열린 라이트박스는 남음 | 렌더 조건에 `showPhotos`, `showPhotos`가 false가 되면 `lightbox` 초기화 | 코드 |
| [P3] | 컬럼이 이미 있으면 DB 테스트가 마이그레이션 파일을 적용하지 않음 | 컬럼이 있으면 파일의 함수 본문(`create or replace` 이후)을 트랜잭션 안에서 항상 실행 | 157 checks |

## 3. 3차 리뷰 (SCORE 7, 11개 중 7개 RESOLVED) → 수정

| 지적 | 수정 | 검증 |
|---|---|---|
| [P2] `latestSeq`는 응답 순서만 막음 — UPSERT 뒤의 DELETE가 서버에서 먼저 처리되면 행이 되살아남; `confirmSaved`는 seq 검사 없음 | 항목별 쓰기 큐(`writeQueue`/`enqueueWrite`)로 `sendOp`·`confirmSaved`를 직렬화. 차례가 왔을 때 이미 더 새 토글이 있으면 **전송 자체를 생략**(되돌릴 서버 쓰기가 생기지 않음), 전송 후에도 재확인. `confirmSaved`는 `seqAtStart` 비교 | `favorites-save.test.ts`: 느린 UPSERT 뒤 DELETE 대기 → 서버 최종 unsaved; 디스패치 전 되돌린 쓰기는 upsert 0회·delete 1회; 확인 중 해제 → superseded |
| [P2] 조회 중 완료된 토글이 오래된 스냅샷에 덮임 | `settledDuringSync` — sync 중 완료된 op를 기록해 `overlayPending`에서 `pending`과 함께 적용 후 비움(로그아웃 시도 비움) | 스냅샷 조회 중 토글 완료 → `["p1","old"]` 유지 |
| [P2] 이전 저장의 완료 콜백이 새 가입 요청을 삭제 | `clearPendingFavoriteReturn(expected)` — 저장된 요청의 placeId가 같을 때만 삭제; 알림 컴포넌트는 자기 요청을 넘김 | `signup-return.test.ts`: X의 늦은 완료가 Y 요청을 지우지 않음 |
| [P2] `/media` 실패가 정상 OFF 프로필까지 폐기, 열린 핀 재검증 없음 | `fetchPublishedPlace` → `{place, complete}`: `/profile` 실패만 null, `/media` 실패면 설정 적용 + 이전 사진 재사용(`complete:false`, memo 안 함). 훅은 핀이 선택된 동안 60초(실패 시 20초)마다 재조회, abort/clearTimeout 정리 | `published-place-client.test.ts`: 사진만 실패 → 설정 적용·이전 사진·incomplete; 지도 OFF/ON 10/10 재실행 |
| [P3] 테스트가 경합을 재현하지 않음 | 상태 있는 가짜 서버(upsert/delete가 목록을 바꿈), `onAuthStateChange` 콜백 보관(로그아웃 중 저장 완료 → 롤백 없이 서버 결과) | 신규 테스트 17개 |
| PARTIAL 메모(포커스 복원·inert 해제 순서) | `useDialogFocus` 복원은 rAF, inert 해제는 effect cleanup 동기 → 복원 시점에 배경 이미 해제. Playwright가 Esc 후 타일 포커스·`[inert]` 0 확인 | 21/21 |
| TO_REACH_9 #5 새 DB 순서 적용 | **미실시** — 로컬 QA 스택 `db reset`은 테스트 매장·계정을 지우므로 사용자 확인 후 | — |

## 4. 4차 리뷰 (SCORE 7) → 수정

4차는 7개 항목 RESOLVED, 4개 PARTIAL/UNRESOLVED에 신규 3건(그중 3건은 3차 수정이 만든 결함)이었다.

| 지적 | 수정 | 검증 |
|---|---|---|
| [P2] 로그인 병합 UPSERT가 쓰기 큐 밖 → 병합 중 해제한 하트가 되살아남 | `mergeLocalIntoServer`가 행마다 `enqueueWrite` 로 전송(같은 항목의 DELETE는 병합 뒤) | 병합 중 해제 → DELETE가 병합 뒤 실행, 서버 최종 미저장 |
| [P2] 신규 실패한 토글도 `settledDuringSync`에 기록돼 스냅샷에 부활 | 성공한 쓰기만 기록 | 조회 중 실패 토글 부활 없음 |
| [P2] 신규 이전 계정의 완료 응답이 새 계정 목록에 섞임 | 응답 후 `userId !== uid`면 상태 변경 없이 결과만 반환 | A 디스패치 → 로그아웃 → B 로그인(스냅샷 지연) → A 완료 → B 목록 비어 있음 |
| [P2] 신규 전송 생략 후 DELETE 실패 롤백이 없는 저장을 만듦 | 항목별 `confirmed`(서버가 확정한 상태)로 복구, 스냅샷 후 정리 | 생략 후 DELETE 실패 → `[]` |
| [P2] 같은 장소 ≠ 같은 가입 요청(A→B), 토스트가 계정과 무관 | 요청마다 `requestId`, 완료 시 요청 시점 계정과 현재 계정이 다르면 아무것도 하지 않음 | `signup-return.test.ts` 5개 |
| [P2] 부분 응답(프로필 OK·사진 실패)의 OFF가 핀 재선택에서 유실 | `lib/published-place-lookup.ts`: 프로필·사진을 분리해 기억(`rememberLookup`), 훅은 수신 결과를 항상 memo, 사진 없는 항목은 fresh로 보지 않아 재조회 | `published-place-client.test.ts` 8개(memo 3 포함) |
| [P3] 테스트가 전송 후 경합·계정 전환을 재현하지 않음 | 가짜 서버가 `user_id`별 상태·배열 UPSERT 처리, 디스패치 확인 후 토글/로그아웃 | `favorites-save.test.ts` 12개 |
| [P3] 빈 Supabase DB 전체 마이그레이션 | 포트 544xx 일회용 스택(`supabase start`, 마이그레이션 25개 순서 적용) → DB 테스트 → `supabase stop --no-backup` | 빈 DB에 25개 전부 적용(`schema_migrations` 25, show_photos 컬럼·4키 분기 함수 확인, merchants 0행) → 그 DB에서 157 checks 통과 → 정리(잔여 컨테이너 없음). 스크립트는 scratchpad의 `fresh-stack.sh`(커밋 대상 아님) |

**5차 Codex 채점: 미실행** — 2026-10-21 오전 Codex CLI 로그인이 만료됐다(`refresh_token_reused` 401, `~/.codex/auth.json`은 10/11자). 사용자가 `codex login`을 하면 아래 수정이 반영된 코드로 다시 채점한다.

## 5. 내부 적대 검증 (2026-10-21, 7개 관점 · 66개 에이전트) → 수정

Codex를 기다리는 대신 Claude 쪽에서 7개 관점(즐겨찾기 동시성, 비회원 ♥→가입→저장 흐름과 호출부, 지도 시트 공개 프로필, 사진 라이트박스·접근성, 지하철 트랙, 사진 스위치 SQL·계약, 썸네일·테스트 품질)으로 다시 찾았다. 발견마다 **재현자**(현재 코드에서 실패하는 테스트를 작성)와 **반박자**(실사용 도달 가능성·의도된 동작·기존 가드·HEAD에 이미 있었는지 확인)를 따로 붙이고, 둘이 갈리면 판정자를 하나 더 붙였다. 29건 → 29건 확인(기각 0) → 같은 원인 묶어 **25건(P2 7, P3 18)**. 종합 단계가 전부를 한 패치로 묶어 작업 트리 사본에서 검증했고(테스트 2,347개·tsc 통과), 그 패치를 검토한 뒤 적용했다.

| # | 등급 | 지적 | 수정 |
|---|---|---|---|
| fav-races-1 | P2 | 늦게 도착한 '대체된' 쓰기가 확정 상태에 기록되지 않아, 이어진 토글이 실패하면 서버에 없는 상태로 되돌아감(저장 유실·유령 저장) | **즐겨찾기 저장소 재설계**(아래) — 롤백 대상 자체가 사라짐 |
| fav-flow-2 | P2 | 비회원 가입 전 ♥ 요청이 같은 탭의 다음 계정에 재생됨(B 계정에 저장·B 화면에 토스트) | 요청을 처음 시도한 계정이 `claimedBy`로 점유, 다른 계정이면 폐기; 완료는 계정과 무관하게 requestId로 정리, 토스트만 계정 확인; 로그아웃 시 요청 삭제 |
| published-2 | P2 | 지도를 움직여 접힌(peek) 카드·핸들 라벨은 여전히 카탈로그 이름·주소·정확 거리 | 접힌 카드·라벨도 공개 프로필 사용, 카드 높이 변화는 ResizeObserver로 다시 측정 |
| lightbox-1 | P2 | 가로 폰·노트북 창에서 라이트박스 사진 아래가 잘림(837장 중 810장) | figure를 `grid-template: 100% / 100%` 한 칸으로 — 이미지 max-height가 틀 기준이 됨 |
| published-1 | P2 | 올리브영·다이소 핀(650곳)은 공개 프로필이 될 수 없는 id인데 선택 중 20초마다 400 요청 | 게시 가능한 id만 조회, 연속 실패는 20s→40s→…5분 백오프, 숨은 탭에서는 멈춤 |
| tests-1 | P2 | 목록 행의 썸네일이 접근 가능한 이름에 "사진 없음"·로고명을 붙임 | 행 썸네일은 장식(`alt=""`, `aria-hidden`); 상품 상세 히어로만 의미 있는 이미지 |
| track-1 | P2 | 긴 역 이름이 노선 티켓을 시트보다 넓혀 도착 점·편집/× 잘림 | 요약 그리드 열을 `minmax(0,1fr)`, 이름 줄은 `min-width:0`(말줄임) |
| fav-races-2/3, -4, switch | P3 | 계정 전환(SIGNED_OUT 없이)·두 번째 탭·스냅샷 전 미러로 추정한 롤백 대상 | 재설계: 계정마다 새 Session, 미러는 소유 계정 태그 |
| fav-flow-3 | P3 | 저장 실패 뒤 회원이 직접 지운 장소를 다음 화면에서 다시 저장 | 회원이 그 장소를 직접 토글하면 가입 전 요청 폐기 |
| fav-flow-4 | P3 | 상품 ♥의 가입 시트가 "이 장소 저장"을 약속하고, 예전 장소 요청을 대신 저장 | 장소가 아닌 ♥는 별도 문구(5개 언어), 예전 요청 정리 |
| published-3 | P3 | 라이트박스가 열린 채 사진 영역이 꺼지면 포커스가 `<body>`로 | `useDialogFocus`에 대체 포커스(제목), 타일 key를 index로 |
| lightbox-3 | P3 | 부드러운 스크롤 중 카운터가 되돌아가고 빠른 연타가 사라짐 | 목표 위치(pendingTarget) 기준으로 다음/이전, reduced-motion이면 즉시 이동 |
| rpc-1 | P3 | `/place/[id]`는 프로필 조회 실패 시 숨긴 매장 사진을 보여줌(지도와 불일치) | 공개 프로필이 없으면 매장 사진을 섞지 않음 |
| rpc-2 | P3 | 사진 스위치·공지·영어 응대만 저장해도 진행 중인 예약 견적이 전부 무효(STALE_SELECTION) | 견적 해시는 프로필 `updated_at` 대신 예약 화면에 보이는 `name_en`; 연락처가 바뀔 때만 merchants 갱신 — **Codex의 예약 기능을 바꾸는 수정이라 별도 확인 필요** |
| rpc-3 | P3 | DB 테스트가 show_photos 컬럼 기본값을 검사하지 않음 | 컬럼 정의(NOT NULL, default true) 단언 + 검수 요청으로 처음 만든 행의 기본값 확인 |
| rpc-4 | P3 | 4/5키 롤아웃의 클라이언트 쪽(서버가 알릴 때만 전송·표시) 테스트 없음 | `storeInstantDraft`로 분리 + 단위·미리보기 테스트 |
| track-2 | P3 | 환승역으로 들어가는 구간이 다음 노선 색 | 구간 색은 그 구간을 탄 노선(`segmentIndexForHop`) |
| track-4 | P3 | 노선 슬라이더가 ←/→만 처리 | APG 슬라이더 키(↑↓, Home/End, PageUp/Down) |
| tests-3 | P3 | 지도 행 배선 테스트가 빈 문자열을 잘라 항상 통과 | 시작·끝 기준을 고치고 실제 행 마크업을 단언 |
| tests-4·5·6, track-3 | P3 | 공개 프로필 훅·OFF 렌더·라이트박스 격리·트랙 경계값이 테스트로 고정되지 않음 | 회귀 테스트 추가(아래 목록) |
| tests-7 | P3 | 배선 테스트가 쓰이지 않는 CSS를 고정 | 해당 단언 삭제 — **CSS 자체는 다른 에이전트의 진행 중 스타일 영역이라 남김** |

### 즐겨찾기 저장소: 재설계 채택
종합 단계는 두 길을 냈다: 현 구조에 약 40줄 보강(A–D), 또는 계정별 Session + 항목별 reconciler로 재작성. 둘 다 경합 재현 22건을 통과했다. Codex가 1~4차 내내 **매 차수 새로운 경합 유형**을 찾았기 때문에, 상태 지도 6개(쓰기 큐·latestSeq·confirmed·settledDuringSync·pending·stateOwner)를 없애는 재설계를 택했다.
- 항목별 화면 = `desired ?? base`. `base`는 서버가 가진 것으로 알려진 상태(스냅샷 + 도착한 쓰기), `desired`는 아직 확인되지 않은 최신 의도, `inflight`는 항목당 하나뿐인 요청. 요청이 끝나면 도착했으면 `base` 갱신, 의도가 여전히 최신이면 의도 삭제 → 성공이면 새 서버 상태, 실패면 옛 서버 상태가 보인다. 되돌릴 대상을 따로 기억하지 않는다.
- 같은 틱의 연타는 합쳐지고(되돌린 저장은 요청 0건), 계정이 바뀌면 Session을 통째로 교체 — 이전 계정의 응답은 자기 호출자에게만 답한다.
- Claude 추가: **기기 미러에 소유 계정 태그**(`essenly.favorites.owner`). 다른 계정이 남긴 미러는 시작 시 폐기(표시·병합 없음), 병합은 `mergedFor`가 비어 있을 때만(레거시 비회원 목록·실패한 병합의 재시도), 병합이 끝난 뒤의 미러는 캐시일 뿐 다시 올리지 않는다(다른 기기에서 지운 ♥가 되살아나지 않음). 이 경로는 이전 코드에도 있던 누출 가능성이다.

### 새 회귀 테스트 (26개 파일 + 기존 갱신)
`favorites-rollback`, `favorites-landed-supersede`, `favorites-account-switch(-variants)`, `favorites-two-tabs`, `favorites-stale-mirror`, `favorites-sync-interactions`, `favorites-offline`, `signup-return-handover`, `signup-return-account-change`, `signup-return-lifetime`, `signup-return-member-toggle`, `signin-nudge-item-heart`, `published-place-hook`, `published-place-backoff`, `map-sheet-published-wiring`, `map-compact-summary-published`, `place-photo-switch-render`, `place-profile-server-photo-switch`, `photo-lightbox-isolation`, `photo-lightbox-steps`, `dialog-focus-fallback`, `route-ticket-lightbox-css`, `map-row-accessible-names`, `subway-track-interaction`, `partner/store-instant-draft` (모두 `lib/`), `favorites-save`에 기기 미러 소유 5건 추가.

## 6. 재작성한 저장소의 적대 검증 (2026-10-21 오후, 2회)

재설계는 새 코드라 같은 방식(재현자 + 반박자, 갈리면 판정자)으로 두 번 더 검증했다.

**1차(3개 관점 · 45 에이전트, 21건 모두 확인)** — 코드 결함 7가지 원인과 테스트 품질 14건.
| 원인 | 수정 |
|---|---|
| 늦게 도착한 `getUser` 응답이 이미 로그아웃·전환된 계정의 세션을 시작, 스냅샷이 계정 범위가 아니라 다른 계정 행을 그 계정 태그로 저장 | `sawAuthEvent` 가드(lib/ratings.ts·useAuthUser 와 같은 규칙) + 스냅샷 `.eq("user_id", uid)` |
| 오프라인 부팅을 로그아웃으로 처리해 아직 로그인된 계정의 기기 사본·가입 전 요청을 지움(HEAD 대비 회귀) | 확정적 로그아웃(오류 없음·AuthSessionMissingError·401/403)일 때만 정리 — `lib/auth/session-errors.ts` |
| 병합 UPSERT 에 합류하거나 DELETE 뒤에 줄 선 `saveFavorite` 가 끝나지 않음 | 병합 행 완료가 답하고, 세션 종료 시 UPSERT 가 걸리지 않은 대기자는 모두 "failed" |
| 스냅샷이 행을 가진 뒤의 확인 실패를 "failed"로 보고 | 스냅샷이 알려진 뒤에는 확인 요청 없이 "saved", 확인 실패도 스냅샷에 행이 있으면 "saved" |
| 비회원 페이지 로드의 오래된 미러 정리가 그 비회원의 가입 전 요청까지 지움 | 세션이 실제로 끝났을 때만 요청 삭제 |
| 끝난 세션의 병합이 병합 표시를 다시 씀 | 살아 있는 흐름만 표시 |
| 같은 계정이 곧바로 다시 로그인하면 이전 요청의 도착이 새 세션에 안 보이고 같은 항목 요청이 두 개 동시에 | 끝난 세션을 계정별로 보관했다가 이어받음(`ended`) + 시작 토큰으로 최신 흐름만 마무리 |
테스트: 검증자들이 쓴 고정 테스트 26개(불변식 19·대기자 3·알림 4) 이식, 의미 없는 테스트 1개 재작성, 중복 파일 1개 삭제, 옛 내부 이름을 쓰던 제목·주석 정리. 공용 하네스로 묶는 일은 후속 과제.

**2차(2개 관점 · 20 에이전트, 9건 모두 확인)** — 1차 수정이 만든 회귀 포함.
| 지적 | 수정 |
|---|---|
| 부팅 중 Supabase 가 먼저 보내는 SIGNED_OUT(만료된 세션 복원 실패) 때문에 오래된 미러 정리가 생략됨(1차 가드의 회귀) | SIGNED_OUT 은 세션이 없어도 태그된 미러를 지움(요청은 유지) |
| 오프라인 부팅 뒤 실패한 계정 스냅샷이 온라인이 돼도 다시 안 읽힘 | `online` 이벤트와 같은 계정의 다음 인증 이벤트에 재동기화(병합이 끝난 뒤엔 다시 올리지 않음) |
| 이어받은 세션에서 늦게 도착한 병합 행이 화면에 안 보임 | 병합 행 도착도 base·스냅샷 겹치기에 반영 |
| 로그아웃 모달이 `signOut()` 오류를 무시(만료 토큰 + 오프라인이면 세션이 남는데 로그아웃된 척) | 오류면 기기 사본 삭제·이동 없이 "로그아웃하지 못했어요" 알림 |
| 계정 삭제 뒤 이 페이지의 구독자들이 여전히 삭제된 계정으로 동작(가입 전 요청을 그 계정이 점유) | 삭제 성공 뒤 로컬 `signOut` 으로 SIGNED_OUT 을 모두에게, 알림은 스토어 계정이 `user.id` 와 같을 때만 |
| 오프라인에서 `useAuthUser` 는 비회원으로 떨어지고 스토어는 계정을 유지(♥가 가입 시트를 엶) | `useAuthUser` 도 확정적 로그아웃일 때만 사용자 제거 |
회귀 테스트 7개 파일 추가(부팅 SIGNED_OUT, 이어받은 병합, 스냅샷 재시도, useAuthUser 오프라인, 계정 삭제 뒤 알림, 세션 제어 7건, 로그아웃 모달 결과).

## 7. 최종 검증 (2026-10-21 저녁)
- `tsc --noEmit` 0, `next lint` 0, vitest **214파일 2,397개** 통과.
- DB: 로컬 QA DB 161 checks; **일회용 빈 DB**(별도 project_id·포트 544xx)에 마이그레이션 25개를 순서대로 적용한 뒤 161 checks, 스택 정리(잔여 컨테이너 없음). 로컬 QA DB(54382)에는 이 마이그레이션의 함수 본문만 다시 적용했다(원격 DB는 손대지 않음).
- 브라우저(3113, 최종 코드): 회귀 `verify-impl`(비회원 ♥→가입 시트→로그인→저장, 사진 헤더, 스켈레톤, 관리자 토글) 21/21, `impl-map-lightbox` 21/21, `impl-map-photos-off` 10/10, `impl-photo-fit-and-ticket` 5/5, `impl-track-geometry` 8/8, `impl-member-roundtrip` 22/22, `impl-signout` 9/9(오프라인 + 유효 토큰은 auth-js 가 기기 세션을 지우고 성공 → 사본 삭제·재접속 후에도 로그아웃 상태; 온라인 → `/`(지도로 리다이렉트)·사본 삭제).
- 오프라인 + **만료된** 토큰의 로그아웃 실패 경로는 브라우저에서 재현이 어려워 `lib/signout-modal-result.test.ts`(알림 표시·사본 유지·이동 없음)로 고정.

## 8. Codex 5~7차 (2026-10-21 저녁, 채점 모델 gpt-6-luna)

1~4차 모델(gpt-6-astra)이 이 계정에서 더 이상 제공되지 않아(400) `GSTACK_CODEX_MODEL=gpt-6-luna` 로 요청마다 지정했다(설정 파일은 그대로).

| 차수 | 점수 | 내용 |
|---|---|---|
| 5차 | **6** | 4차 8건 중 RESOLVED 5·PARTIAL 2·OPEN 1. ① 병합 행이 항목별 단일 요청 경로 밖(같은 계정 재로그인 때 중복 전송 가능) → 병합 행을 `saveOn`(saveFavorite 와 같은 경로)으로 보냄 + 회귀 테스트. ② ID 없는 구버전 가입 요청은 장소로 비교 → 첫 읽기 때 ID 부여 + 테스트. ③ "Google 가입 경로가 요청을 저장하지 않음" → **반박**(`google` 핸들러가 OAuth 전에 `rememberSavedPlace()` 호출). ④ 테스트 본문을 못 봄 → 6차 부록에 핵심 테스트 전문 포함 |
| 6차 | **9** | 5차 4건 모두 RESOLVED(반박도 인정). 새 [P3] 1건: 사진 조회 실패 때 이전 사진을 이어받으면서 신선도 시각도 갱신해 짧은 재시도가 60초로 밀림 → `photosCurrent` 로 사진 신선도를 따로 기록 + 테스트 |
| 7차(확인) | **9** | 6차 P3 RESOLVED, 새 결함 없음, TO_REACH_9 "없음" |

최종 상태 검증: tsc 0 · lint 0 · vitest **214파일 2,399개** · DB 161(로컬 QA + 일회용 빈 DB) · 브라우저 비회원 ♥ 회귀 21/21(최종 코드), 로그아웃 9/9, 나머지 브라우저 점검 79/79(직전 코드, 이후 변경은 즐겨찾기·가입 요청·공개 프로필 메모만).

## 9. 남은 것 / 결정 필요
- **정책 확인**: 썸네일 cover 는 장소 사진만, 상품·브랜드는 contain(상품 패키지명 잘림 방지).
- **rpc-2 는 Codex 의 예약 견적 정의를 바꾼다**(`private.booking_quote` 를 이 마이그레이션에서 재정의). 예약 담당(Codex/사용자) 확인 필요.
- `lib/ratings.ts` 에도 오프라인 부팅을 로그아웃으로 보고 미러를 지우는 같은 유형의 문제가 있다(HEAD 부터, 이번 변경 범위 밖이라 미수정).
- 커밋: 이 수정은 Codex 의 미커밋 구현과 같은 파일에 섞여 있어 분리 커밋이 불가능하다. 전체 트리 기준 검증은 모두 통과 — 커밋 방식은 사용자 결정.
- 원격 DB 마이그레이션 전에는 배포하지 않는다. RPC 가 4키도 받으므로 "DB 먼저, 앱 나중" 순서가 안전하다.
