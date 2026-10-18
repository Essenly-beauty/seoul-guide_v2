# Partner Shared Booking Contracts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 고객 예약 화면과 업체 관리자가 함께 사용할 메뉴 공개·금액·영업시간 규칙을 테스트 가능한 공통 모듈로 구현한다.

**Architecture:** 승인된 업체 관리자 설계의 A단계를 작은 단위로 실행한다. 이번 A1은 외부 입출력이 없는 도메인 규칙이며, A2의 실제 Supabase 저장·권한 계층과 A3의 관리자 화면이 이를 사용한다. 메뉴 공개 가능성과 영업시간은 정의하지만, 실제 예약 가능 시간 계산·결제·확정·DB 권한 검증을 구현한 것으로 간주하지 않는다.

**Tech Stack:** Existing TypeScript, Vitest 3, Next.js 15 repository; no new packages.

---

## 승인된 전체 범위와 이번 작업의 위치

설계: `docs/superpowers/specs/2026-10-18-partner-admin-booking-design.md` (commit `cecc25c`).

| 순서 | 산출물과 검증 | 이번 계획 |
| --- | --- | --- |
| A1 | 공유 메뉴 모델·공개 조건·시간 규칙, 실제 함수 단위 테스트 | 아래 실행 작업 |
| A2 | 업체/소유자/카테고리/메뉴/시간 테이블, RLS, 변경 이력, 계정 삭제 보호, 로컬 DB 허용·거절 테스트 | DB 환경 확인 후 별도 구체 계획 |
| A3 | `/partner` 설정 상태, 메뉴 편집, 영업시간 편집, 업체 설정; 실제 서버 저장 및 오류 UI | A2 계약에 연결하는 별도 구체 계획 |
| A4 | 계정 A/B 격리, 재접속 후 저장 유지, 폼·모바일·기존 서비스 회귀 검증 | 관리자 기반 전체 완료 조건 |
| B | 고객 선택·결제·확정·내 예약·취소 ↔ 업체 목록·집계 연결 | 결제사·제휴·정책 확정 후 별도 설계 |

A1은 전체 기획의 메뉴/시간 검증 및 앱↔업체 공통 계약을 담당한다. 업체 계정 생성, RLS, 화면, 원자적 예약 점유, 예약 사본, 결제와 대시보드 집계는 A1의 완료 주장에 포함하지 않는다. A단계 전체 완료 또는 배포 승인을 뜻하지 않는다.

## 작업 환경과 제약

- 작업 경로: `/Users/hanmyeong-gwan/mobile_design/.worktrees/service-quality-20261018`.
- 브랜치: `codex/service-quality-release-20261018`. 원래 작업 디렉터리의 미커밋 변경은 건드리지 않는다.
- 기존 미추적 `reports/operations/service-quality-release-2026-10-18.md`를 커밋에 포함하지 않는다. 원격 push·배포 없음.
- Git 작성자: `gksaudrhks12-sys <gksaudrhks12@gmail.com>`.
- 2026-10-18 확인: Docker daemon 연결 실패. Supabase CLI는 기본 실행 시 홈 디렉터리 telemetry 쓰기 권한 오류가 있었지만, 공식 문서의 `SUPABASE_TELEMETRY_DISABLED=1`을 해당 명령에만 적용해 버전 `2.115.0` 및 도움말 실행을 확인했다. 영구 설정 변경이나 권한 확대는 하지 않았다. 사용자에게 Docker 실행을 요청했으며, 운영 DB로 검증을 대체하지 않는다. A1은 이 환경과 무관하게 검증 가능하다. [공식 텔레메트리 설정](https://supabase.com/docs/guides/local-development/cli/getting-started#telemetry)
- A2 시작 전 CLI 동작 및 로컬 DB를 확보한다. Supabase 스킬에 따라 로컬 SQL 반복 검증 → advisors → 생성 migration → migration list 검증 순서. 실제 SQL 실행/권한 테스트 없이 RLS 통과라고 표현하지 않는다.
- 현재 Next.js 15와 기존 Supabase 인증을 유지한다. 데이터·인증 제공업체를 교체하거나 결제 SDK를 설치하지 않는다.

## 파일 구조

- `lib/partner/catalog.ts`: 메뉴/카테고리 계약, 저장값 검증, 신규 고객 노출용 투영. DB·인증·React 의존 없음.
- `lib/partner/catalog.test.ts`: 실제 함수 호출로 금액·소속·미설정·노출 및 비공개 필드 차단 검증.
- `lib/partner/availability.ts`: 한국 날짜, 영업시간·휴게·차단 구간 검증과 영업 구간 계산. 예약/결제 점유 계산 아님.
- `lib/partner/availability.test.ts`: 날짜 경계·겹침·자정·휴게·차단 및 업체 일치 검증.

## Task 1: 공유 카탈로그와 영업시간 규칙 (하나의 검토 가능한 변경)

**Files:** 위 네 파일만 생성한다. 테스트 fixture는 테스트 파일 안에만 둔다. 앱에 샘플 업체나 예약을 제공하는 fallback을 만들지 않는다.

- [x] **Step 1: 기준 테스트 실행**

Run: `npm test`.
Expected: 기존 전체 테스트 통과. 실패하면 새 기능과 분리해서 보고하고 진행 여부를 확인한다.

- [x] **Step 2: 카탈로그 실패 테스트 작성**

Create `lib/partner/catalog.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { validateMenu, menuReadiness, publicMenu, type PartnerCategory, type PartnerMenu } from "./catalog";

const category: PartnerCategory = {
  id: "category-a", merchantId: "merchant-a", nameKo: "커트", nameEn: "Cut",
  visibility: "visible", sortOrder: 0,
};
const menu: PartnerMenu = {
  id: "menu-a", merchantId: "merchant-a", categoryId: category.id,
  nameKo: "커트", nameEn: "Haircut", descriptionKo: "커트 서비스", descriptionEn: "Haircut service",
  priceKrw: 50000, depositKrw: 10000, durationMinutes: 60, cleanupMinutes: 10,
  visibility: "visible", sortOrder: 0,
};

describe("shared partner catalog", () => {
  it("accepts a complete fixed-price menu", () => {
    expect(validateMenu(menu, [category])).toEqual([]);
    expect(menuReadiness(menu, [category])).toEqual([]);
  });
  it("allows incomplete drafts without treating a missing deposit as zero", () => {
    const draft = { ...menu, visibility: "draft" as const, depositKrw: null, priceKrw: null, durationMinutes: null };
    expect(validateMenu(draft, [category])).toEqual([]);
    expect(menuReadiness(draft, [category])).toEqual(expect.arrayContaining(["depositKrw.required", "priceKrw.required", "durationMinutes.required", "menu.not_visible"]));
    expect(publicMenu(draft, [category], "merchant-a", true)).toBeNull();
  });
  it.each([0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])("rejects invalid monetary value %s", (value) => {
    expect(validateMenu({ ...menu, priceKrw: value }, [category])).toContain("priceKrw.invalid");
    expect(validateMenu({ ...menu, depositKrw: value }, [category])).toContain("depositKrw.invalid");
  });
  it("rejects deposits larger than the service price", () => {
    expect(validateMenu({ ...menu, depositKrw: 50001 }, [category])).toContain("depositKrw.exceeds_price");
  });
  it("rejects foreign and unknown categories", () => {
    expect(validateMenu(menu, [{ ...category, merchantId: "merchant-b" }])).toContain("category.invalid");
    expect(validateMenu(menu, [])).toContain("category.invalid");
  });
  it.each(["hidden", "archived", "draft"] as const)("does not expose a %s category", (visibility) => {
    expect(publicMenu(menu, [{ ...category, visibility }], "merchant-a", true)).toBeNull();
  });
  it.each(["hidden", "archived", "draft"] as const)("does not expose a %s menu", (visibility) => {
    expect(publicMenu({ ...menu, visibility }, [category], "merchant-a", true)).toBeNull();
  });
  it("requires English information, matching merchant, and server-controlled booking activation", () => {
    expect(publicMenu({ ...menu, descriptionEn: " " }, [category], "merchant-a", true)).toBeNull();
    expect(publicMenu(menu, [category], "merchant-b", true)).toBeNull();
    expect(publicMenu(menu, [category], "merchant-a", false)).toBeNull();
  });
  it("projects explicit customer fields and preserves input", () => {
    const before = structuredClone(menu);
    const projected = publicMenu({ ...menu, internalNote: "private" } as PartnerMenu, [category], "merchant-a", true);
    expect(projected).toEqual({ id: "menu-a", merchantId: "merchant-a", categoryId: "category-a", name: "Haircut", description: "Haircut service", currency: "KRW", priceKrw: 50000, depositKrw: 10000, balanceKrw: 40000, durationMinutes: 60, cleanupMinutes: 10 });
    expect(projected).not.toHaveProperty("internalNote");
    expect(menu).toEqual(before);
  });
  it("validates duration, cleanup, sort order, and text length", () => {
    expect(validateMenu({ ...menu, durationMinutes: 0, cleanupMinutes: -1, sortOrder: 0.5, nameEn: "x".repeat(121) }, [category])).toEqual(expect.arrayContaining(["durationMinutes.invalid", "cleanupMinutes.invalid", "sortOrder.invalid", "nameEn.invalid"]));
  });
});
```

- [x] **Step 3: 실패 확인**

Run: `npm test -- lib/partner/catalog.test.ts`.
Expected initial RED: `./catalog` missing. 파일 생성 후에는 실패한 동작별 구현으로 진행하고, 테스트가 우연히 통과한 기존 기능이 아닌지 확인한다.

- [x] **Step 4: 최소 카탈로그 구현**

Create `lib/partner/catalog.ts`:

```ts
export type Visibility = "draft" | "visible" | "hidden" | "archived";
export type PartnerCategory = {
  id: string; merchantId: string; nameKo: string; nameEn: string;
  visibility: Visibility; sortOrder: number;
};
export type PartnerMenu = {
  id: string; merchantId: string; categoryId: string;
  nameKo: string; nameEn: string; descriptionKo: string; descriptionEn: string;
  priceKrw: number | null; depositKrw: number | null; durationMinutes: number | null;
  cleanupMinutes: number; visibility: Visibility; sortOrder: number;
};
const validVisibility = new Set<Visibility>(["draft", "visible", "hidden", "archived"]);
const integerAtLeast = (value: number, minimum: number) => Number.isSafeInteger(value) && value >= minimum;

export function validateMenu(menu: PartnerMenu, categories: readonly PartnerCategory[]): string[] {
  const issues: string[] = [];
  for (const field of ["id", "merchantId", "categoryId"] as const) {
    if (typeof menu[field] !== "string" || !menu[field].trim()) issues.push(`${field}.invalid`);
  }
  for (const field of ["nameKo", "nameEn", "descriptionKo", "descriptionEn"] as const) {
    const limit = field.startsWith("name") ? 120 : 4000;
    if (typeof menu[field] !== "string" || menu[field].length > limit) issues.push(`${field}.invalid`);
  }
  for (const field of ["priceKrw", "depositKrw", "durationMinutes"] as const) {
    if (menu[field] !== null && !integerAtLeast(menu[field], 1)) issues.push(`${field}.invalid`);
  }
  if (!integerAtLeast(menu.cleanupMinutes, 0)) issues.push("cleanupMinutes.invalid");
  if (!integerAtLeast(menu.sortOrder, 0)) issues.push("sortOrder.invalid");
  if (!validVisibility.has(menu.visibility)) issues.push("visibility.invalid");
  if (menu.priceKrw !== null && menu.depositKrw !== null && menu.depositKrw > menu.priceKrw) issues.push("depositKrw.exceeds_price");
  if (!categories.some(category => category.id === menu.categoryId && category.merchantId === menu.merchantId)) issues.push("category.invalid");
  return issues;
}

export function menuReadiness(menu: PartnerMenu, categories: readonly PartnerCategory[]): string[] {
  const issues = validateMenu(menu, categories);
  for (const field of ["nameKo", "nameEn", "descriptionKo", "descriptionEn"] as const) {
    if (typeof menu[field] !== "string" || !menu[field].trim()) issues.push(`${field}.required`);
  }
  for (const field of ["priceKrw", "depositKrw", "durationMinutes"] as const) {
    if (menu[field] === null) issues.push(`${field}.required`);
  }
  if (menu.visibility !== "visible") issues.push("menu.not_visible");
  const category = categories.find(item => item.id === menu.categoryId && item.merchantId === menu.merchantId);
  if (!category || category.visibility !== "visible") issues.push("category.not_visible");
  return issues;
}

// bookingEnabled must come from trusted server state, never a customer request.
// This projection is NOT authentication, authorization, or a reservation snapshot.
export function publicMenu(menu: PartnerMenu, categories: readonly PartnerCategory[], merchantId: string, bookingEnabled: boolean) {
  if (!bookingEnabled || menu.merchantId !== merchantId || menuReadiness(menu, categories).length) return null;
  if (menu.priceKrw === null || menu.depositKrw === null || menu.durationMinutes === null) return null;
  return {
    id: menu.id, merchantId: menu.merchantId, categoryId: menu.categoryId,
    name: menu.nameEn.trim(), description: menu.descriptionEn.trim(), currency: "KRW" as const,
    priceKrw: menu.priceKrw, depositKrw: menu.depositKrw, balanceKrw: menu.priceKrw - menu.depositKrw,
    durationMinutes: menu.durationMinutes, cleanupMinutes: menu.cleanupMinutes,
  };
}
```

- [x] **Step 5: 카탈로그 GREEN 확인**

Run: `npm test -- lib/partner/catalog.test.ts`.
Expected: 모든 테스트 통과. 컴파일만으로 API 입력 검증·DB 권한을 보장한다고 주장하지 않는다.

- [x] **Step 6: 영업시간 실패 테스트 작성**

Create `lib/partner/availability.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { businessIntervals, seoulDateKey, validateSchedule, type PartnerSchedule } from "./availability";

const schedule: PartnerSchedule = {
  merchantId: "merchant-a",
  hours: [{ weekday: 0, startMinute: 540, endMinute: 1080 }],
  breaks: [{ weekday: 0, startMinute: 720, endMinute: 780 }],
  blocks: [{ date: "2026-10-18", startMinute: 900, endMinute: 960 }],
};
describe("shared business hours", () => {
  it("subtracts breaks and date blocks without mutating source", () => {
    const before = structuredClone(schedule);
    expect(businessIntervals(schedule, "merchant-a", "2026-10-18")).toEqual([{ startMinute: 540, endMinute: 720 }, { startMinute: 780, endMinute: 900 }, { startMinute: 960, endMinute: 1080 }]);
    expect(schedule).toEqual(before);
  });
  it("does not apply a date block to a different week", () => {
    expect(businessIntervals(schedule, "merchant-a", "2026-10-25")).toEqual([{ startMinute: 540, endMinute: 720 }, { startMinute: 780, endMinute: 1080 }]);
  });
  it("returns no hours for a closed weekday or full-day block", () => {
    expect(businessIntervals(schedule, "merchant-a", "2026-10-19")).toEqual([]);
    expect(businessIntervals({ ...schedule, blocks: [{ date: "2026-10-18", startMinute: 0, endMinute: 1440 }] }, "merchant-a", "2026-10-18")).toEqual([]);
  });
  it("rejects foreign merchants and invalid dates", () => {
    expect(() => businessIntervals(schedule, "merchant-b", "2026-10-18")).toThrow("merchant.mismatch");
    expect(() => businessIntervals(schedule, "merchant-a", "2026-02-30")).toThrow("date.invalid");
  });
  it("accepts adjacent periods but rejects overlap", () => {
    const adjacent = { ...schedule, breaks: [], hours: [{ weekday: 0, startMinute: 540, endMinute: 600 }, { weekday: 0, startMinute: 600, endMinute: 720 }] };
    expect(validateSchedule(adjacent)).toEqual([]);
    expect(validateSchedule({ ...adjacent, hours: [...adjacent.hours, { weekday: 0, startMinute: 590, endMinute: 610 }] })).toContain("hours.overlap");
  });
  it("rejects overnight, zero-length, fractional, and out-of-range periods", () => {
    for (const [startMinute, endMinute] of [[1000, 500], [600, 600], [540.5, 600], [-1, 600], [0, 1441]]) {
      expect(validateSchedule({ ...schedule, hours: [{ weekday: 0, startMinute, endMinute }] })).toContain("hours.invalid");
    }
  });
  it("rejects a break outside opening hours and an invalid block date", () => {
    expect(validateSchedule({ ...schedule, breaks: [{ weekday: 0, startMinute: 500, endMinute: 600 }] })).toContain("breaks.outside_hours");
    expect(validateSchedule({ ...schedule, blocks: [{ date: "2026-02-30", startMinute: 600, endMinute: 660 }] })).toContain("blocks.invalid");
  });
  it("uses Seoul midnight independently of machine timezone", () => {
    expect(seoulDateKey(new Date("2026-10-18T14:59:59Z"))).toBe("2026-10-18");
    expect(seoulDateKey(new Date("2026-10-18T15:00:00Z"))).toBe("2026-10-19");
    expect(() => seoulDateKey(new Date(NaN))).toThrow("date.invalid");
  });
});
```

- [x] **Step 7: 영업시간 RED 확인**

Run: `npm test -- lib/partner/availability.test.ts`.
Expected initial RED: `./availability` missing. 이후 각 동작이 실패하는 것을 확인하고 최소 구현한다.

- [x] **Step 8: 최소 영업시간 구현**

Create `lib/partner/availability.ts`:

```ts
export type MinuteInterval = { startMinute: number; endMinute: number };
export type WeeklyPeriod = MinuteInterval & { weekday: number };
export type DateBlock = MinuteInterval & { date: string };
export type PartnerSchedule = { merchantId: string; hours: WeeklyPeriod[]; breaks: WeeklyPeriod[]; blocks: DateBlock[] };

function dateValue(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? date : null;
}
function validInterval(value: MinuteInterval) {
  return Number.isInteger(value.startMinute) && Number.isInteger(value.endMinute) && value.startMinute >= 0 && value.endMinute <= 1440 && value.startMinute < value.endMinute;
}
function validWeekly(value: WeeklyPeriod) {
  return validInterval(value) && Number.isInteger(value.weekday) && value.weekday >= 0 && value.weekday <= 6;
}
function overlaps(a: MinuteInterval, b: MinuteInterval) {
  return a.startMinute < b.endMinute && b.startMinute < a.endMinute;
}
export function validateSchedule(schedule: PartnerSchedule): string[] {
  const issues: string[] = [];
  if (!schedule.merchantId?.trim()) issues.push("merchant.invalid");
  if (schedule.hours.some(period => !validWeekly(period))) issues.push("hours.invalid");
  if (schedule.breaks.some(period => !validWeekly(period))) issues.push("breaks.invalid");
  if (schedule.blocks.some(period => !validInterval(period) || !dateValue(period.date))) issues.push("blocks.invalid");
  for (const [name, periods] of [["hours", schedule.hours], ["breaks", schedule.breaks]] as const) {
    if (periods.some((a, i) => periods.slice(i + 1).some(b => a.weekday === b.weekday && overlaps(a, b)))) issues.push(`${name}.overlap`);
  }
  if (schedule.breaks.some(rest => !schedule.hours.some(open => open.weekday === rest.weekday && open.startMinute <= rest.startMinute && rest.endMinute <= open.endMinute))) issues.push("breaks.outside_hours");
  if (schedule.blocks.some((a, i) => schedule.blocks.slice(i + 1).some(b => a.date === b.date && overlaps(a, b)))) issues.push("blocks.overlap");
  return issues;
}
export function seoulDateKey(date: Date): string {
  if (!Number.isFinite(date.getTime())) throw new Error("date.invalid");
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const part = (type: string) => parts.find(item => item.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}
// Business hours only. B must additionally subtract holds/bookings and fit
// service duration + cleanup before offering an actual bookable start time.
export function businessIntervals(schedule: PartnerSchedule, merchantId: string, date: string): MinuteInterval[] {
  if (schedule.merchantId !== merchantId) throw new Error("merchant.mismatch");
  const day = dateValue(date);
  if (!day) throw new Error("date.invalid");
  const issues = validateSchedule(schedule);
  if (issues.length) throw new Error(issues.join(","));
  const weekday = day.getUTCDay();
  let intervals = schedule.hours.filter(period => period.weekday === weekday).map(({ startMinute, endMinute }) => ({ startMinute, endMinute }));
  const masks = [...schedule.breaks.filter(period => period.weekday === weekday), ...schedule.blocks.filter(period => period.date === date)];
  for (const mask of masks) {
    intervals = intervals.flatMap(interval => {
      if (!overlaps(interval, mask)) return [interval];
      const remaining: MinuteInterval[] = [];
      if (interval.startMinute < mask.startMinute) remaining.push({ startMinute: interval.startMinute, endMinute: mask.startMinute });
      if (mask.endMinute < interval.endMinute) remaining.push({ startMinute: mask.endMinute, endMinute: interval.endMinute });
      return remaining;
    });
  }
  return intervals.sort((a, b) => a.startMinute - b.startMinute);
}
```

- [x] **Step 9: 통합 GREEN 및 정적 검사**

Run: `npm test -- lib/partner/catalog.test.ts lib/partner/availability.test.ts`.
Run: `npm run typecheck`.
Run: `npm run lint`.
Run: `npm test`.
Expected: 새 테스트 및 기존 테스트 모두 통과. 전체 DB·예약 기능이 검증됐다는 의미는 아니다.

- [x] **Step 10: 사양 검토 → 코드 품질 검토 → 수정 → 재검증**

검토자는 원본을 읽고 계약을 검증한다. 특히 ① null과 0 구분 ② 공개 필드 allowlist ③ 업체 일치 ④ 입력 불변성 ⑤ 한국 날짜 ⑥ 자정/구간 경계 ⑦ 영업시간을 예약 가능 시간으로 오인하지 않는 문서화를 확인한다. 카탈로그에는 DB 권한이 없으므로 인증·RLS를 통과했다고 주장하면 안 된다.

- [x] **Step 11: 지정 파일만 커밋하고 상태 기록**

```bash
git add lib/partner/catalog.ts lib/partner/catalog.test.ts lib/partner/availability.ts lib/partner/availability.test.ts
git diff --cached --check
git commit -m "feat: add shared partner catalog and business-hour contracts"
git show --stat --oneline HEAD
git status --short
```

## A2 시작 전 전달 계약

DB 명칭은 snake_case, TypeScript는 위 camelCase로 매핑한다. 업체와 카테고리의 복합 관계를 보장하고, 예약 공개 활성화는 업체 편집 요청으로 바꿀 수 없게 한다. 메뉴 visibility는 공개 요청 상태일 뿐 사업자·결제·정책 승인을 대신하지 않는다. `publicMenu()`는 승인된 서버 상태에만 사용한다. 미설정 nullable 금액은 DB에서도 null로 유지한다.

매주 반복되는 영업시간은 `Asia/Seoul`의 weekday+분 값이며 날짜별 차단은 한국 달력 날짜다. 실제 예약 시작·종료 시각만 UTC 시각으로 저장하는 B단계 모델과 구분한다. `businessIntervals()` 결과는 예약 재고가 아니며, 결제 대기·예약 점유와 서비스+정리시간 검사가 별도로 필요하다.

추가 설계에서 DB 테이블·API·UI를 위 계약에 연결할 때 테스트 fixture를 운영 seed나 fallback으로 옮기지 않는다. 처음부터 실데이터 저장과 권한 검증을 사용하는 관리자만 제공한다.

참고: [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [Supabase SSR](https://supabase.com/docs/guides/auth/server-side/creating-a-client), [Next.js 15 cookies](https://nextjs.org/docs/15/app/api-reference/functions/cookies). 기존 프로젝트 버전을 기준으로 구현하고 불필요한 업그레이드는 하지 않는다.

## 실행 기록 — 2026-10-18

- 구현 커밋: `0c1a6b001d893d81b4ff18d7a76ce6fd91f02cb7` (지정한 도메인/테스트 파일 네 개만).
- 기존 기준: 116개 테스트 파일, 1,089개 테스트 통과.
- 구현 담당자 RED 확인: 카탈로그 20개 실패 후 21개 통과, 영업시간 16개 실패 후 17개 통과. `merchant.invalid` 계약 교정도 별도 실패 테스트 후 수정.
- 루트 재검증: 신규 38개 통과, 전체 118개 파일/1,127개 테스트 통과, 타입 검사·린트 통과. 린트 도구의 기존 Next deprecation 및 workspace-root 안내는 남아 있음.
- 독립 사양 검토 및 코드 품질 검토: 승인, 수정 필요 사항 없음. 각 검토자도 신규 38개 테스트를 실행함.
- A1만 완료. A2의 로컬 DB 권한 테스트, A3 관리자 UI, A4 관리자 통합 검증, B 고객 예약·결제 연결은 완료하지 않았다. 배포하지 않았다.
- Docker 연결 재확인 결과 엔진에 연결되지 않음. 사용자에게 Docker Desktop 실행을 요청한 상태. 운영 DB로 대체하지 않음.
