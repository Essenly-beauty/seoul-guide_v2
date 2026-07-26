# Essenly 디자인 시스템 (v1.1)

> 작성: 2026-07-25 · 근거: 서비스 전수 감사 + 사용자 제공 4-레이어 토큰 가이드(files/doc2)
> 목표: 흩어진 클래스 조합을 **토큰 → 컴포넌트 → 제품 패턴** 구조로 정리해 서비스 일관성 확보

---

## 1. 감사 결과 (현재 상태)

| 영역 | 발견 | 문제 |
|---|---|---|
| 버튼 | `.btn`(21) `.btn ghost`(17) `.btn danger`(4) `.btn outline`(5) `.btn sm`(계열) + 단발 커스텀 5종 + `linkbtn`(3) | ghost와 outline이 **동일 스타일 중복**, 변형이 클래스 문자열로 산재, Tailwind `.outline` 유틸과 이름 충돌 사고 발생 |
| 아이콘 버튼 | `iconbtn`(23) `soft`(4) `bordered`(2) + 단발 2종 | 변형 기준 불명확 (언제 soft/bordered?) |
| 칩 | `chip`(32) `chip soft`(4) `chip mono`(3) `statuschip` 3종 + 단발 | 선택/필터/상태 역할이 클래스 조합에 의존 |
| 공통 | 인라인 스타일로 크기·색 덮어쓰기 다수 | 컴포넌트 부재가 근본 원인 |

## 2. 파운데이션 (4-레이어, doc2 가이드 적용)

기존 CSS 변수를 **raw**로 보고, 역할(semantic) 별칭을 얹는다. 화이트라벨 시 raw만 교체.

| Layer | 정의 위치 | 예 |
|---|---|---|
| raw | `:root` 기존 변수 | `--accent #0C8E70`, `--border #E2E8F0`, `--r-md 10px` |
| semantic | `:root` 신규 별칭 | `--text-primary→--text`, `--text-secondary→--muted`, `--text-disabled→--dim`, `--bg-page→--bg`, `--bg-surface→--surface`, `--border-default→--border`, `--brand→--accent`, `--focus-ring-*` |
| component | 컴포넌트 CSS | `.btn.primary{background:var(--brand)}` |
| 카테고리/노선 | 기존 | `--c-*`(7 카테고리+mall), LINE_META |

타이포/간격: 기존 시맨틱 유틸(`.t-heading-sm .t-label-md/sm .t-caption .num`)과 `--r-*`, 12px 리듬 유지 — 이미 doc 기준으로 구축됨.

## 3. 코어 컴포넌트 API

### Button (`components/ui/button.tsx`)
```tsx
<Button variant="primary|secondary|tonal|danger" size="md|sm" full icon="gift"
        href external disabled buttonRef onClick>label</Button>
```
| variant | 스타일 | 용도 |
|---|---|---|
| primary | 솔리드 브랜드 | 화면당 1개 주 행동 (Apply, Show route, View details-CTA) |
| secondary | 헤어라인 뉴트럴 + 다크 텍스트 | 더보기/보조 (기존 ghost·outline **통합**) |
| tonal | brand-soft 배경 + 브랜드 텍스트 | primary 옆 짝 버튼 (All Categories류) |
| danger | 기존 유지 | 파괴적 행동 |
- 클래스 산출: `btn primary|secondary|tonal|danger [sm] [full]` — **`outline`/`ghost` 클래스는 폐기**(Tailwind 충돌 원천 제거), 마이그레이션 완료까지 CSS 별칭만 유지.

### IconButton (`components/ui/icon-button.tsx`)
```tsx
<IconButton name="share" label="Share" variant="plain|soft|overlay"
            disabled pressed buttonRef onClick/>
```
- plain: 투명(리스트 행 안) · soft: brand-soft 원형(CTA 바) · overlay: 흰 배경+보더(사진 위)

### Chip (`components/ui/chip.tsx`)
```tsx
<Chip selected soft mono buttonRef onClick>label</Chip>   // 필터/선택
<StatusChip status="confirmed|pending|cancelled" />
```
- `role="radio"`/`aria-checked`, `role="tab"`/`aria-selected`를 지원하며 이 경우 불필요한 `aria-pressed`를 만들지 않는다.

### 기본 컴포넌트 v2 (`components/ui/`)

| 컴포넌트 | API 요약 |
|---|---|
| ListRow (`list-row.tsx`) | `href?/onClick? media? title titleAccessory? caption? meta? trailing? top?` → `.listrow v2 [top]`; trailing이 있으면 링크/버튼은 콘텐츠 영역에만 |
| SearchField (`search-field.tsx`) | `value onChange label placeholder? onClear? clearLabel? clearVariant? autoFocus? inputRef?` → `.mobile-search-field` 필 (아이콘+인풋+클리어) |
| BottomSheet (`bottom-sheet.tsx`) | `title ariaLabel? kicker? onClose footer?` → visible title과 dialog name 연결 · `.app-shell` 포털 · `.overlay/.sheet/.shead/.sbody[/.sfoot]` · useDialogFocus 포커스 트랩 |
| Switch (`switch.tsx`) | `checked onChange` + `label` 또는 `labelledBy` 필수, `describedBy? disabled?` → `.notification-switch` `role="switch"` |
| Badge (`badge.tsx`) | `tone: accent\|warning\|info\|success\|error\|dim` → `.badge {tone}` 모노 대문자 태그 |
| EmptyState (`empty-state.tsx`) | `icon? action? children` → `.empty` 대시 카드 (+`.ic` 아이콘 원형) |
| Avatar (`avatar.tsx`) | `name? size?(기본 30) href?` → `.avatar` 이니셜 원형, href면 Link |
| Notice (`notice.tsx`) | `tone?: info\|warning\|accent icon? onDismiss? role? className? style?` → `.banner {tone}` 인라인 배너. 정적 안내는 live role 없음; 동적 메시지만 `status/alert` 지정 |
| SectionDivider (`section-divider.tsx`) | props 없음 → `<hr class="sec-divider">` |

기존 유지: CategoryBadge · LiveBadge · RatingLine · SectionHeader · HScroll · RatingBars · AnchorTabs · ImgPh · MapLinkButtons(브랜드 필은 예외적 커스텀).

## 4. 쇼케이스
`/design` 페이지 — 토큰 팔레트·타이포·전 컴포넌트 상태를 한 화면에. 일관성 점검 기준점.

## 5. 마이그레이션 맵

| 기존 | → |
|---|---|
| `className="btn"` | `<Button>` |
| `btn ghost` / `btn outline` / `btn sm outline` | `<Button variant="secondary" [size=sm]>` |
| primary 옆 짝 ghost | `<Button variant="tonal">` (문맥 판단) |
| `btn danger` | `<Button variant="danger">` |
| `iconbtn` / `soft` / `bordered` | `<IconButton variant=plain/soft/overlay>` |
| `chip`(+selected/soft/mono) | `<Chip …>` |
| `statuschip *` | `<StatusChip status=*>` |
| 단발(product-cta-*, metro-*) | 컴포넌트 + className 병기 허용 |

규칙: 마이그레이션 후 `className="btn…"`/`"chip…"` 원시 문자열 신규 사용 금지(계약 테스트로 고정).

## 6. 상태 계약

모든 인터랙티브 컴포넌트는 아래 상태를 API·CSS·쇼케이스에서 함께 관리한다.

| 상태 | 필수 계약 |
|---|---|
| default / hover / pressed | 색상 변화만으로 레이아웃이 이동하지 않는다 |
| focus-visible | 배경색과 구분되는 외곽 링을 제공한다 |
| selected | `aria-pressed` 또는 `aria-selected`와 시각 상태를 함께 제공한다 |
| disabled | native `disabled` 우선, 텍스트·배경·커서를 모두 비활성 상태로 표시한다 |
| loading / error | 비동기·폼 컴포넌트 도입 시 상태와 접근 가능한 설명을 동시에 추가한다 |

## 7. 접근성·다국어

- 아이콘 전용 버튼은 `label`이 필수이며 터치 영역은 최소 44×44px다.
- Switch는 `label` 또는 `labelledBy` 중 하나가 반드시 있어야 한다.
- Dialog/BottomSheet는 포커스를 내부에 유지하고 닫힌 뒤 호출 요소로 복원한다.
- 정보는 색상만으로 전달하지 않고 텍스트·아이콘·상태 속성을 병행한다.
- 영어·한국어 병기, 긴 로마자 상호명, 200% 확대에서도 행의 핵심 행동이 잘리지 않아야 한다.
- 역명·주소·매장명은 원문을 유지하고 번역/로마자 표기는 별도 필드로 제공한다.

## 8. 채택·예외 규칙

- 새 화면은 `components/ui`의 컴포넌트를 우선 사용한다.
- 기존 화면은 DOM과 동작이 동일하게 표현되는 경우에만 공용 컴포넌트로 치환한다.
- 지도 마커, 지하철 경로, 결제 단계처럼 도메인 동작이 강한 UI는 전용 컴포넌트를 유지한다.
- `btn`/`iconbtn`/`chip` 원시 문자열은 실제 화면에서 0건이며, 모든 문자열 리터럴을 syntax-aware 계약 테스트로 검사한다.
- P3 복합 행·다단계 시트 원시 클래스 예외 28건은 파일 단위가 아니라 정확한 패턴과 개수로 계약 테스트에 기록한다.
- 예외 사유가 사라지면 같은 변경에서 공용 컴포넌트로 마이그레이션한다.

## 9. 검증

- `npm test` (현재 183/183, 정적 계약 + 실제 렌더 마크업)
- `npm run typecheck`
- `npm run lint`
- `npm run build`
- 키보드 포커스, 200% 확대, 긴 영문/한글 문자열, reduced-motion 수동 확인

## 10. 실행 이력

1. **P1 파운데이션+컴포넌트** — semantic 별칭, Button/IconButton/Chip, `/design` 쇼케이스
2. **P2 마이그레이션(병렬)** — A: `app/**` · B: `components/**` 전 사용처 치환, ghost/outline 클래스 제거
3. **P3 기초 컴포넌트** — ListRow, BottomSheet, SearchField, Switch, Notice, EmptyState, Avatar, Badge, SectionDivider
4. **P4 hardening** — 실제 화면 채택, 모든 렌더 분기의 event/ref 전달, 상태·접근성 계약, syntax-aware 원시 패턴 검사, 문서 Git 추적
