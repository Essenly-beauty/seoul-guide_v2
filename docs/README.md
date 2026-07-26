# Essenly 문서 인덱스

> 기준 커밋: `563950d` · 기준일: 2026-07-26

이 디렉터리는 현재 구현, 제품 계약, 출시 준비 상태를 구분해 관리한다. 화면이 존재한다는 사실과 운영 서비스가 연결됐다는 사실을 같은 의미로 사용하지 않는다.

## 기준 문서

아래 순서로 우선한다.

1. [`service-overview.md`](service-overview.md) — 현재 제품 정의, 대상 사용자, IA, 핵심 여정
2. [`feature-status.md`](feature-status.md) — 기능별 `구현 / 프로토타입 / 외부 위임 / 미구현` 상태
3. [`data-and-integrations.md`](data-and-integrations.md) — 데이터 수량, 커버리지, 저장소, 외부 연동
4. [`launch-readiness.md`](launch-readiness.md) — 출시 전 P0/P1/P2 작업과 완료 조건
5. [`design-system.md`](design-system.md) — UI 토큰, 컴포넌트, 상태 및 접근성 계약
6. [`decisions-and-history.md`](decisions-and-history.md) — 주요 제품 결정과 변경 이력

## 제품 계약

- [`subway-bottom-controller-design.md`](subway-bottom-controller-design.md) — 현재 지하철/지도 상호작용 계약
- [`map-first-v2-spec.md`](map-first-v2-spec.md) — 지도 중심 IA 설계 배경. 현재 구현과 충돌하면 기준 문서와 코드를 우선한다.
- [`user-data-strategy.md`](user-data-strategy.md) — 로컬 프로토타입과 향후 계정/DB 목표 구조. Supabase·OAuth 부분은 아직 계획이다.

## 상태 정의

| 상태 | 의미 |
|---|---|
| 구현 | 현재 샘플 데이터 범위에서 핵심 인터랙션과 화면 이동이 동작 |
| 프로토타입 | 화면은 있으나 고정 데이터, 컴포넌트 상태 또는 `localStorage`에 의존 |
| 외부 위임 | 앱 내부 처리가 아니라 Google/Naver/Kakao 등의 외부 앱·URL로 넘김 |
| 미구현 | 성공 토스트, disabled UI, 설명 문구만 있거나 운영 연동이 없음 |

## 유지 규칙

- 기능을 추가할 때 `feature-status.md`와 `launch-readiness.md` 상태를 함께 갱신한다.
- 장소·상품·지하철 데이터를 바꾸면 `data-and-integrations.md`의 수량과 검증일을 갱신한다.
- 디자인 시스템 API를 바꾸면 `/design`, `design-system.md`, 계약 테스트를 같은 변경에서 갱신한다.
- 운영 연동이 없는 기능을 문서에서 `완료`, `예약됨`, `결제됨`, `재고 있음`으로 표현하지 않는다.
- 과거 작업 계획은 결정 배경으로만 사용하며 현재 동작의 근거는 코드와 기준 문서로 제한한다.
