# MYSEOULDROP Place Catalog Shadow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 기존 장소 ID·화면·저장 링크를 그대로 둔 채, 장소 원본과 게시본을 로컬 Supabase DB에 병행 적재하고 100% 동등성을 검사하는 첫 릴리스를 만든다.

**Architecture:** `CATALOGUE_PLACES`는 내부 원본, `PLACES`는 현재 승인된 공개본으로 취급한다. 결정적 JSON manifest를 만든 뒤 비노출 `internal.place_source_records`와 RLS가 적용된 `public.places`에 로컬 전용으로 적재한다. 앱은 계속 `lib/data.ts`를 읽는다. 운영 DB 반영·앱 DB 조회 전환·사진 이동은 별도 릴리스다.

**Tech Stack:** Next.js 15, TypeScript, Vitest, `vite-node`, Supabase Postgres 17 로컬 개발환경, pgTAP, `pg`.

---

## 실행 체크포인트 — 2026-10-04

- 인증된 GitHub SSH 계정 `mg1018-whatap`으로 최신 `main`을 분리 복제하고 `feat/place-catalog-shadow-20261004` 브랜치를 만들었다. 원래 작업 트리의 미커밋 변경은 덮어쓰지 않았다.
- Task 1·2의 manifest 계약, 생성/검사 명령을 구현했다. 분리 브랜치의 기존 테스트 965개가 시작 시 통과했고, 신규 테스트와 `lib/data.test.ts`를 합친 29개가 통과했다. 현재 소스 1,122건과 공개 장소 1,008건을 manifest로 내보내며 `--check`가 일치했다.
- Task 3은 **미실행/차단**이다. Supabase CLI 2.115.0은 확인했지만 Docker 데몬이 없고, 이 실행 환경에서 Docker Desktop을 열거나 로그 파일을 만들 수 없었다. pgTAP·SQL 마이그레이션·실제 DB 적재/패리티는 아직 실행하지 않았다.
- 운영 Supabase, 앱 조회, 이미지, 상품 랭킹, 블로그는 변경하지 않았다. 현재 상태는 병행 카탈로그의 로컬 코드 준비 단계다.

## 범위와 선행 조건

이 문서는 [전체 데이터 구조 설계](service-data-architecture-design-2026-10-04.md)의 **B1: 병행 카탈로그**만 실행한다. 결과물은 실제 로컬 DB에 적재·권한 테스트·전수 패리티 검사를 할 수 있는 소프트웨어다. B2에서 `place_hours`, `place_features`, `place_services`, 필드별 근거·승인 이력·미디어 메타데이터와 앱 조회 전환을 진행한다. B1의 `payload`는 기존 `Place` 형식을 손실 없이 보존하는 임시 읽기 모델이다. 이후 정규화 테이블의 값과 독립적으로 수정하는 이중 원본으로 쓰지 않는다. 스토리·상품 랭킹·회원·리뷰 스키마는 변경하지 않는다.

원래 작업 트리는 다수의 사용자 변경이 있고 원격 `main`보다 뒤에 있다. `.git` 쓰기 권한도 없으므로 **그 작업 트리에서 커밋·체리픽·리베이스하지 않는다.** 실행은 인증된 SSH로 복제한 분리 브랜치에서 진행한다. 현재 환경에서는 Docker 데몬이 없어 pgTAP을 실행할 수 없다. Supabase CLI 텔레메트리 파일 오류는 `SUPABASE_TELEMETRY_DISABLED=1`로 우회해 CLI 2.115.0을 확인했지만, 로컬 DB 검증의 대안은 아니다. DB가 실행되기 전에는 SQL 통과나 운영 적용을 주장하지 않는다.

실행 직전 Supabase CLI `--help`·버전과 [변경 이력](https://supabase.com/changelog), [Data API 권한 지침](https://supabase.com/docs/guides/api/securing-your-api)을 다시 확인한다. 현재 환경의 `.md` 변경 이력 URL은 브라우저 도구가 `text/markdown`을 처리하지 못해 읽지 못했다. 운영 DB의 실제 스키마·마이그레이션 이력·백업·Data API 노출 설정은 읽기 전용으로 대조한다. B1 명령에는 운영 DB 쓰기 경로를 넣지 않는다.

## 파일 지도

| 파일 | 책임 |
|---|---|
| `lib/place-catalog-manifest.ts` | 원본은 손실 없이 보존하고 게시 배열만 주소·좌표·필수값 검증 후 결정적 manifest로 변환 |
| `lib/place-catalog-manifest.test.ts` | 중복 ID, 게시 ID의 원본 존재, 필수값·해시·원본 불변성 검증 |
| `lib/place-catalog-stage.test.ts` | 로컬 DB 전용 적재기 연결 제한 검증 |
| `scripts/lib/place-catalog-parity.mjs`, `lib/place-catalog-parity.test.ts` | 적재 검증기가 재사용하는 ID·해시 비교와 테스트 |
| `scripts/export-place-catalog.ts` | 무비밀 로컬 manifest 생성 및 `--check` 드리프트 검사 |
| `scripts/.cache/place-catalog-manifest.json` | Git 제외된 임시 출력; 앱·운영 DB의 원본 아님 |
| `supabase/migrations/<CLI가 생성한 시각>_place_catalog_shadow.sql` | 공개 게시 테이블과 비노출 원본 테이블, GRANT/RLS |
| `supabase/tests/place_catalog_shadow.test.sql` | 익명·회원 읽기, 비공개 행 격리, 직접 쓰기/내부 스키마 차단 |
| `scripts/stage-place-catalog.mjs` | 로컬 DB만 허용하는 트랜잭션 기반 적재 |
| `scripts/verify-place-catalog.mjs` | 로컬 DB 공개 행 전체와 manifest의 ID·내용·사진 경로 패리티 검사 |
| `package.json` | `catalog:export`, `catalog:check`, `catalog:stage`, `catalog:verify` 명령 |
| `reports/operations/improvement-history.md` | 테스트 결과와 미완료 운영 게이트 이력 |

마이그레이션 경로의 시각은 임의로 만들지 않는다. `supabase migration new place_catalog_shadow`가 생성한 실제 파일명을 사용한다. 이 프로젝트는 `supabase/config.toml`의 `schema_paths=[]`인 imperative migration 방식이다.

### Task 1: 결정적 장소 manifest와 계약 테스트

**Files:** Create `lib/place-catalog-manifest.ts`, `lib/place-catalog-manifest.test.ts`.

- [ ] **Step 1: 실패하는 테스트 작성.** `lib/place-catalog-manifest.test.ts`에 아래 코드를 넣는다.

```ts
import { describe, expect, it } from "vitest";
import { buildPlaceCatalogManifest } from "./place-catalog-manifest";
import type { Place } from "./data";

const base: Place = {
  id: "oy-test", name: "Olive Young Test", nameKr: "올리브영 테스트점",
  type: "olive_young", zone: "gangnam_station", address: "서울 강남구 테스트로 1",
  lat: 37.5, lng: 127.0, tags: [], source: "olive_young",
};

describe("place catalog manifest", () => {
  it("preserves the published ID and all presentation fields", () => {
    const source = { ...base };
    const published = { ...base, name: "Verified Test", photos: ["/places/oy-test/1.webp"] };
    const result = buildPlaceCatalogManifest([source], [published]);
    expect(result.sourceRows[0].payload).toEqual(source);
    expect(result.publishedRows[0].payload).toEqual(published);
    expect(result.publishedRows[0].id).toBe("oy-test");
    expect(result.publishedRows[0].sha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it("is insensitive to object key order and never mutates input", () => {
    const first = { ...base, tags: ["tax-free"], photos: ["/a.webp"] };
    const copy = structuredClone(first);
    const reordered = Object.fromEntries(Object.entries(first).reverse()) as Place;
    expect(buildPlaceCatalogManifest([first], [first]).publishedRows[0].sha256)
      .toBe(buildPlaceCatalogManifest([reordered], [reordered]).publishedRows[0].sha256);
    expect(first).toEqual(copy);
  });

  it("rejects duplicate IDs and a published row without a source", () => {
    expect(() => buildPlaceCatalogManifest([base, base], [base])).toThrow(/duplicate source id/);
    expect(() => buildPlaceCatalogManifest([], [base])).toThrow(/missing source id/);
  });

  it("retains incomplete source rows but rejects incomplete publication", () => {
    expect(buildPlaceCatalogManifest([{ ...base, address: " " }], []).sourceRows).toHaveLength(1);
    expect(() => buildPlaceCatalogManifest([base], [{ ...base, address: " " }])).toThrow(/address/);
    expect(() => buildPlaceCatalogManifest([base], [{ ...base, lat: Number.NaN }])).toThrow(/coordinates/);
  });
});
```

- [ ] **Step 2: 실패 확인.** `npm test -- lib/place-catalog-manifest.test.ts` → 모듈/함수 없음으로 실패.
- [ ] **Step 3: 최소 구현.** `lib/place-catalog-manifest.ts`에 아래 코드를 넣는다.

```ts
import { createHash } from "node:crypto";
import type { Place } from "./data";

type Row = { id: string; source: string; payload: Place; sha256: string };
export type PlaceCatalogManifest = { schemaVersion: 1; sourceRows: Row[]; publishedRows: Row[] };

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.entries(value)
      .filter(([, part]) => part !== undefined)
      .sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
      .map(([key, part]) => [key, canonical(part)]));
  }
  return value;
}

export function canonicalPlaceJson(place: Place): string {
  return JSON.stringify(canonical(place));
}

function row(place: Place, published: boolean): Row {
  if (!place.id.trim()) throw new Error("missing place id");
  if (published && (!place.name.trim() || !place.nameKr.trim() || !place.address.trim())) {
    throw new Error(`missing published identity/address: ${place.id}`);
  }
  if (published && (!Number.isFinite(place.lat) || !Number.isFinite(place.lng)
    || place.lat < -90 || place.lat > 90 || place.lng < -180 || place.lng > 180)) {
    throw new Error(`invalid coordinates: ${place.id}`);
  }
  if (!place.source) throw new Error(`missing source: ${place.id}`);
  const payload = JSON.parse(canonicalPlaceJson(place)) as Place;
  return {
    id: place.id, source: place.source, payload,
    sha256: createHash("sha256").update(canonicalPlaceJson(place)).digest("hex"),
  };
}

function unique(places: readonly Place[], label: "source" | "published"): Row[] {
  const seen = new Set<string>();
  return places.map((place) => {
    if (seen.has(place.id)) throw new Error(`duplicate ${label} id: ${place.id}`);
    seen.add(place.id);
    return row(place, label === "published");
  }).sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

export function buildPlaceCatalogManifest(
  source: readonly Place[], published: readonly Place[],
): PlaceCatalogManifest {
  const sourceRows = unique(source, "source");
  const publishedRows = unique(published, "published");
  const sourceIds = new Set(sourceRows.map((item) => item.id));
  for (const item of publishedRows) {
    if (!sourceIds.has(item.id)) throw new Error(`missing source id: ${item.id}`);
  }
  return { schemaVersion: 1, sourceRows, publishedRows };
}
```

- [ ] **Step 4: 테스트 확인.** `npm test -- lib/place-catalog-manifest.test.ts` → 4개 통과.
- [ ] **Step 5: 커밋.** 쓰기 가능한 격리 작업 트리에서 `git add lib/place-catalog-manifest.ts lib/place-catalog-manifest.test.ts && git commit -m "feat: define deterministic place catalog manifest"`.

### Task 2: 실제 게시 경계의 manifest 생성

**Files:** Create `scripts/export-place-catalog.ts`; Modify `package.json` scripts.

- [ ] **Step 1: 실패하는 통합 테스트 작성.** `lib/place-catalog-manifest.test.ts`에 아래 테스트를 추가한다.

```ts
import { CATALOGUE_PLACES, PLACES } from "./data";

it("exports every current public place from the source catalogue", () => {
  const result = buildPlaceCatalogManifest(CATALOGUE_PLACES, PLACES);
  expect(result.sourceRows).toHaveLength(CATALOGUE_PLACES.length);
  expect(result.publishedRows).toHaveLength(PLACES.length);
  expect(result.publishedRows.map((item) => item.id))
    .toEqual([...PLACES.map((item) => item.id)].sort((a, b) => a < b ? -1 : a > b ? 1 : 0));
});
```

- [ ] **Step 2: 현재 데이터 계약 확인.** `npm test -- lib/place-catalog-manifest.test.ts` → 새 테스트가 통과해야 한다. 실패하면 중복/누락 원인을 조사하고 원본을 임의 삭제하지 않는다.
- [ ] **Step 3: 생성/검사 명령 구현.** `scripts/export-place-catalog.ts`에 아래 코드를 넣는다.

```ts
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CATALOGUE_PLACES, PLACES } from "../lib/data";
import { buildPlaceCatalogManifest } from "../lib/place-catalog-manifest";

const path = join(process.cwd(), "scripts/.cache/place-catalog-manifest.json");
const text = `${JSON.stringify(buildPlaceCatalogManifest(CATALOGUE_PLACES, PLACES))}\n`;
if (process.argv.includes("--check")) {
  if (readFileSync(path, "utf8") !== text) throw new Error("place manifest is stale");
  console.log("place manifest matches current source and publication boundary");
} else {
  mkdirSync(join(process.cwd(), "scripts/.cache"), { recursive: true });
  writeFileSync(path, text);
  console.log(`wrote ${path}`);
}
```

`package.json`의 `scripts`에 다음 네 항목을 추가한다.

```json
"catalog:export": "vite-node --script scripts/export-place-catalog.ts",
"catalog:check": "vite-node --script scripts/export-place-catalog.ts --check",
"catalog:stage": "node scripts/stage-place-catalog.mjs",
"catalog:verify": "node scripts/verify-place-catalog.mjs"
```

- [ ] **Step 4: 생성/검사.** `npm run catalog:export && npm run catalog:check` → 둘 다 0 종료. `scripts/.cache/`가 Git 제외인지 `git check-ignore scripts/.cache/place-catalog-manifest.json`로 확인.
- [ ] **Step 5: 회귀.** `npm test -- lib/data.test.ts lib/place-catalog-manifest.test.ts` → 모두 통과. 격리 작업 트리에서 두 파일만 커밋한다.

### Task 3: 로컬 DB 스키마와 역할별 계약

**Files:** Create CLI-generated `supabase/migrations/<시각>_place_catalog_shadow.sql`, `supabase/tests/place_catalog_shadow.test.sql`.

- [ ] **Step 1: CLI와 로컬 DB 확인.** `supabase --help`, `supabase migration --help`, `supabase --version`, `docker info`를 확인한다. 로컬 DB가 준비되지 않으면 여기서 중지하고 SQL 검증 완료로 표시하지 않는다.
- [ ] **Step 2: 먼저 pgTAP 테스트 작성.** `supabase/tests/place_catalog_shadow.test.sql`을 다음과 같이 만든다.

```sql
begin;
select plan(9);

select ok((select relrowsecurity from pg_class where oid = 'public.places'::regclass), 'public places has RLS');
select ok(has_table_privilege('anon', 'public.places', 'select'), 'guest has read grant');
select ok(not has_table_privilege('anon', 'public.places', 'insert'), 'guest cannot write');
select ok(not has_schema_privilege('anon', 'internal', 'usage'), 'guest cannot use internal schema');

insert into public.places
  (id, type, zone, name, name_kr, address, lat, lng, publication_state, payload, payload_sha256)
values
  ('catalog-test-live', 'daiso', 'gangnam_station', 'Live', '공개', '서울 강남구 1', 37.5, 127.0,
   'published', '{"id":"catalog-test-live"}'::jsonb, repeat('a', 64)),
  ('catalog-test-draft', 'daiso', 'gangnam_station', 'Draft', '초안', '서울 강남구 2', 37.5, 127.0,
   'draft', '{"id":"catalog-test-draft"}'::jsonb, repeat('b', 64));

set local role anon;
select results_eq($$select id from public.places where id like 'catalog-test-%' order by id$$,
  array['catalog-test-live'], 'guest sees only published row');
select throws_ok($$insert into public.places
  (id, type, zone, name, name_kr, address, lat, lng, payload, payload_sha256)
  values ('catalog-test-guest', 'daiso', 'gangnam_station', 'Guest', '게스트', '서울 강남구 3',
    37.5, 127.0, '{"id":"catalog-test-guest"}'::jsonb, repeat('c', 64))$$,
  '42501', null, 'guest insert denied');
select throws_ok($$select * from internal.place_source_records$$,
  '42501', null, 'guest cannot read source records');

set local role authenticated;
select results_eq($$select id from public.places where id like 'catalog-test-%' order by id$$,
  array['catalog-test-live'], 'member sees only published row');
select ok(not has_table_privilege('authenticated', 'public.places', 'update'), 'member cannot edit');

select * from finish();
rollback;
```

- [ ] **Step 3: 테스트 실패 확인.** `supabase test db --help`로 현재 옵션을 확인하고 `supabase test db` 실행 → `public.places` 미존재로 실패해야 한다.
- [ ] **Step 4: CLI로 마이그레이션 파일 생성 후 SQL 작성.** `supabase migration new place_catalog_shadow`를 실행하고 생성된 파일에 아래 SQL 전체를 넣는다. 운영 DB에는 적용하지 않는다.

```sql
create schema if not exists internal;
revoke all on schema internal from public, anon, authenticated;

create table public.places (
  id text primary key,
  type text not null,
  zone text not null,
  name text not null,
  name_kr text not null,
  address text not null,
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  publication_state text not null default 'draft'
    check (publication_state in ('draft', 'published', 'hidden')),
  business_state text not null default 'unknown'
    check (business_state in ('open', 'temporarily_closed', 'closed', 'unknown')),
  payload jsonb not null check (jsonb_typeof(payload) = 'object' and payload->>'id' = id),
  payload_sha256 text not null check (payload_sha256 ~ '^[0-9a-f]{64}$'),
  source_checked_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.places enable row level security;
revoke all on public.places from public, anon, authenticated;
grant select on public.places to anon, authenticated;
create policy places_read_published on public.places
  for select to anon, authenticated using (publication_state = 'published');
create index places_public_type_zone_idx on public.places (type, zone, id)
  where publication_state = 'published';

create table internal.place_source_records (
  id bigint generated always as identity primary key,
  place_id text not null,
  source_name text not null,
  payload jsonb not null check (jsonb_typeof(payload) = 'object' and payload->>'id' = place_id),
  payload_sha256 text not null check (payload_sha256 ~ '^[0-9a-f]{64}$'),
  observed_at timestamptz,
  imported_at timestamptz not null default now(),
  unique (place_id, source_name, payload_sha256)
);
create index place_source_records_place_id_idx on internal.place_source_records (place_id);
alter table internal.place_source_records enable row level security;
revoke all on internal.place_source_records from public, anon, authenticated;
```

`source_checked_at`와 `observed_at`은 기존 행에서 실제 확인일을 모르면 `null`로 둔다. `imported_at`은 수집/검수일이 아니다. `business_state`도 기존 `LIVE` 문구에서 유추하지 않고 `unknown`으로 둔다.

- [ ] **Step 5: 로컬 재적용/테스트.** `supabase db reset --local`이 현재 로컬 DB를 지우므로 격리된 일회용 로컬 프로젝트임을 확인한 뒤에만 사용한다. 그 후 `supabase test db` → 9개 통과. 기존 공유목록 pgTAP도 함께 통과해야 한다. 마이그레이션은 생성된 실제 파일명만 커밋한다.

### Task 4: 로컬 전용 적재기

**Files:** Create `scripts/stage-place-catalog.mjs`.

- [ ] **Step 1: 안전 계약 테스트 작성.** `lib/place-catalog-stage.test.ts`에 다음 테스트를 넣는다.

```ts
import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";

describe("catalog staging safety", () => {
  it("rejects a non-loopback database before connecting", () => {
    expect(() => execFileSync("node", ["scripts/stage-place-catalog.mjs"], {
      env: { ...process.env, PLACE_CATALOG_DATABASE_URL: "postgresql://u:p@db.example.com/postgres" },
      stdio: "pipe",
    })).toThrow();
  });
});
```

- [ ] **Step 2: 실패 확인.** `npm test -- lib/place-catalog-stage.test.ts` → 적재기 파일 없음으로 실패.
- [ ] **Step 3: 적재기 구현.** `scripts/stage-place-catalog.mjs`에 다음 코드를 넣는다. 이 명령은 PostgreSQL 로컬 포트만 허용하고 앱 또는 운영 Supabase에 연결하지 않는다.

```js
import { readFileSync } from "node:fs";
import pg from "pg";

const connectionString = process.env.PLACE_CATALOG_DATABASE_URL;
if (!connectionString) throw new Error("PLACE_CATALOG_DATABASE_URL is required");
const host = new URL(connectionString).hostname;
if (host !== "127.0.0.1" && host !== "localhost") throw new Error("local database only");

const manifest = JSON.parse(readFileSync("scripts/.cache/place-catalog-manifest.json", "utf8"));
if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.sourceRows)
  || !Array.isArray(manifest.publishedRows)) throw new Error("invalid manifest");
const client = new pg.Client({ connectionString });
await client.connect();
try {
  await client.query("begin");
  await client.query(`insert into internal.place_source_records
    (place_id, source_name, payload, payload_sha256)
    select id, source, payload, sha256
    from jsonb_to_recordset($1::jsonb)
      as incoming(id text, source text, payload jsonb, sha256 text)
    on conflict (place_id, source_name, payload_sha256) do nothing`,
    [JSON.stringify(manifest.sourceRows)]);
  await client.query(`insert into public.places
    (id, type, zone, name, name_kr, address, lat, lng, publication_state,
     business_state, payload, payload_sha256)
    select id, payload->>'type', payload->>'zone', payload->>'name',
      payload->>'nameKr', payload->>'address', (payload->>'lat')::double precision,
      (payload->>'lng')::double precision, 'published', 'unknown', payload, sha256
    from jsonb_to_recordset($1::jsonb)
      as incoming(id text, payload jsonb, sha256 text)
    on conflict (id) do update set
      type = excluded.type, zone = excluded.zone, name = excluded.name,
      name_kr = excluded.name_kr, address = excluded.address,
      lat = excluded.lat, lng = excluded.lng, payload = excluded.payload,
      payload_sha256 = excluded.payload_sha256, updated_at = now()
    where public.places.payload_sha256 is distinct from excluded.payload_sha256`,
    [JSON.stringify(manifest.publishedRows)]);
  await client.query("commit");
  console.log(`staged ${manifest.sourceRows.length} source and ${manifest.publishedRows.length} published rows`);
} catch (error) {
  await client.query("rollback");
  throw error;
} finally {
  await client.end();
}
```

- [ ] **Step 4: 거부/적재 확인.** `npm test -- lib/place-catalog-stage.test.ts` → 1개 통과. `npm run catalog:export && npm run catalog:check` 후 격리된 로컬 DB URL을 `PLACE_CATALOG_DATABASE_URL`로 지정해 `npm run catalog:stage` 실행 → 출력 행 수가 manifest와 일치. `npm run catalog:stage`를 한 번 더 실행해 원본 기록 수가 중복 증가하지 않는지 확인한다. 기존 `public.places`에만 남아 있는 ID는 자동 삭제/숨김하지 않는다. 누락은 다음 비교 단계에서 실패시킨다.
- [ ] **Step 5: 커밋.** 격리 작업 트리에서 적재기와 테스트만 커밋한다.

### Task 5: 전수 패리티 검사와 릴리스 게이트

**Files:** Create `scripts/lib/place-catalog-parity.mjs`, `lib/place-catalog-parity.test.ts`, `scripts/verify-place-catalog.mjs`; Modify `reports/operations/improvement-history.md`.

- [ ] **Step 1: 검증 알고리즘 테스트 작성.** `lib/place-catalog-parity.test.ts`에 아래 코드를 넣는다.

```ts
import { describe, expect, it } from "vitest";
import { compareCatalogRows } from "../scripts/lib/place-catalog-parity.mjs";

describe("catalog parity", () => {
  const expected = [{ id: "a", payload_sha256: "1" }];
  it("passes exact matches", () => expect(compareCatalogRows(expected, expected)).toEqual([]));
  it("reports missing, extra, and changed rows", () => {
    expect(compareCatalogRows(expected, [{ id: "a", payload_sha256: "2" },
      { id: "b", payload_sha256: "3" }])).toEqual(["changed:a", "extra:b"]);
    expect(compareCatalogRows(expected, [])).toEqual(["missing:a"]);
  });
});
```

- [ ] **Step 2: 실패 확인.** `npm test -- lib/place-catalog-parity.test.ts` → 모듈 없음으로 실패.
- [ ] **Step 3: 순수 비교기 구현.** `scripts/lib/place-catalog-parity.mjs`에 다음 코드를 넣는다.

```js
export function compareCatalogRows(expected, actual) {
  const left = new Map(expected.map((row) => [row.id, row.payload_sha256]));
  const right = new Map(actual.map((row) => [row.id, row.payload_sha256]));
  return [
    ...[...left].filter(([id]) => !right.has(id)).map(([id]) => `missing:${id}`),
    ...[...right].filter(([id]) => !left.has(id)).map(([id]) => `extra:${id}`),
    ...[...left].filter(([id, hash]) => right.has(id) && right.get(id) !== hash)
      .map(([id]) => `changed:${id}`),
  ].sort();
}
```

- [ ] **Step 4: DB 검사기 구현.** `scripts/verify-place-catalog.mjs`에 다음 코드를 넣는다. DB의 저장 해시만 믿지 않고 `payload`를 다시 canonical hash해 검사한다.

```js
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import pg from "pg";
import { compareCatalogRows } from "./lib/place-catalog-parity.mjs";

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
      .map(([key, part]) => [key, canonical(part)]));
  }
  return value;
}
const hash = (value) => createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex");
const url = process.env.PLACE_CATALOG_DATABASE_URL;
if (!url || !["127.0.0.1", "localhost"].includes(new URL(url).hostname)) {
  throw new Error("local database only");
}
const manifest = JSON.parse(readFileSync("scripts/.cache/place-catalog-manifest.json", "utf8"));
const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  const { rows } = await client.query(`select id, payload, payload_sha256
    from public.places where publication_state = 'published' order by id`);
  const expected = manifest.publishedRows.map((row) => ({ id: row.id, payload_sha256: row.sha256 }));
  const errors = compareCatalogRows(expected, rows);
  for (const row of rows) {
    if (hash(row.payload) !== row.payload_sha256) errors.push(`payload-hash:${row.id}`);
  }
  if (errors.length) throw new Error(`catalog parity failed: ${errors.slice(0, 20).join(", ")}`);
  console.log(`catalog parity passed: ${expected.length} published IDs and full payloads`);
} finally {
  await client.end();
}
```

- [ ] **Step 5: 검증.** `npm test -- lib/place-catalog-parity.test.ts`, `npm run catalog:verify`, `npm run catalog:check`, `npm run typecheck`, `npm run lint`, `npm test`, `npm run audit:data:check`를 실행한다. 기대값은 모든 명령 0 종료, 공개 ID·전체 `Place` 필드 해시 100% 일치. `app/place/[id]/page.tsx`, `components/map/map-screen.tsx`, 찜·공유·리뷰 참조는 변경하지 않았음을 `git diff --name-only`로 확인한다. 운영 이력에 실제 실행 환경·테스트 결과·남은 게이트를 기록하고 해당 파일만 커밋한다.

## B1 완료 판정과 B2 진입 조건

B1은 **로컬에서** 원본/게시 경계, 역할별 읽기/쓰기, 100% ID·payload 일치가 확인되어야 완료다. 이 단계에서 라이브 서비스가 DB를 읽는다고 주장하면 안 된다. 운영 데이터는 건드리지 않았으므로 앱 롤백도 필요하지 않다.

B2의 첫 작업은 운영 Supabase 백업·현재 `GRANT`/RLS·마이그레이션 이력 확인, 이미지 권리·필드별 검수 담당 확인, `place_hours`/`place_features`/`place_services`와 근거·수정 이력 구조, 기존 URL/찜/리뷰/공유 링크 전수 검증이다. `public.places`와 기존 회원 테이블의 FK 연결은 참조 ID의 누락이 0임을 확인한 뒤 별도 마이그레이션으로 한다. 앱 조회 전환은 검증된 스냅샷으로 되돌릴 수 있는 별도 릴리스에서만 진행한다. 상품 랭킹과 블로그 연동은 이 계획으로 시작하지 않는다.
