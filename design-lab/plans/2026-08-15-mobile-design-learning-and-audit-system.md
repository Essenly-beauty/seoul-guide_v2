# Mobile Design Learning and Audit Lab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Git-tracked, continuously extensible mobile design learning and audit lab under `design-lab/` without changing or importing into the existing MYSEOULDROP service.

**Architecture:** The lab stores human-readable current truth in Markdown, append-only preference history in JSONL, and a deterministic source inventory in JSON. Small Node.js scripts use only built-in modules to validate records and read the existing app source without modifying it. The app, package configuration, build graph, tests, and deployment remain untouched.

**Tech Stack:** Markdown, JSONL, Node.js built-in `fs/path/url` modules, Node.js built-in test runner (`node:test`)

---

## File Structure

Create or update only the following paths:

```text
design-lab/
├── README.md                                  # Entry point, isolation contract, usage
├── taste-profile.md                           # Working hypotheses and confirmed preferences
├── preference-log.jsonl                       # Append-only preference evidence
├── qa-matrix.md                               # Flow × screen × state × viewport tracker
├── review-playbook.md                         # Repeatable review and expansion rules
├── generated/
│   └── inventory.json                         # Deterministic route/overlay inventory
├── references/
│   └── 2026-08-15-initial-directions.md       # Initial A/B/C reference study
├── findings/
│   ├── README.md                              # Finding lifecycle and index rules
│   └── DLAB-001-map-mobile-layering.md        # First observed candidate finding
├── reports/
│   ├── README.md                              # Report retention rules
│   └── 2026-08-15-baseline.md                 # First baseline record
├── templates/
│   ├── finding.md                             # New finding template
│   └── review-report.md                       # Review round template
├── scripts/
│   ├── validation-lib.mjs                     # Pure validators
│   ├── validate-lab.mjs                       # Validation CLI
│   ├── inventory-lib.mjs                      # Pure route/overlay extraction
│   └── inventory.mjs                          # Read-only source scanner and check CLI
├── tests/
│   ├── validation.test.mjs                    # Validation unit tests
│   └── inventory.test.mjs                     # Inventory unit tests
├── plans/
│   └── 2026-08-15-mobile-design-learning-and-audit-system.md
└── specs/
    └── 2026-08-15-mobile-design-learning-and-audit-system.md
```

Do not modify `package.json`, `app/`, `components/`, `lib/`, `.impeccable.md`, `AGENTS.md`, Next.js configuration, Tailwind configuration, or deployment files.

### Task 1: Scaffold the isolated lab and validate its contract

**Files:**
- Create: `design-lab/README.md`
- Create: `design-lab/review-playbook.md`
- Create: `design-lab/scripts/validation-lib.mjs`
- Create: `design-lab/tests/validation.test.mjs`

- [ ] **Step 1: Write the failing validation tests**

Create `design-lab/tests/validation.test.mjs`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import {
  collectQaIds,
  parsePreferenceLog,
  validateIsolationPaths,
} from "../scripts/validation-lib.mjs";

test("parses a valid append-only preference record", () => {
  const line = JSON.stringify({
    id: "PREF-20260815-001",
    recordedAt: "2026-08-15T17:40:00+09:00",
    source: "initial-direction-board",
    judgment: "prefer",
    reasons: ["직관적인 사용성"],
    traits: ["map-first", "high-information-density"],
    contexts: ["map", "search"],
    status: "observation",
  });

  assert.deepEqual(parsePreferenceLog(`${line}\n`), [JSON.parse(line)]);
});

test("rejects malformed JSONL with a line number", () => {
  assert.throws(
    () => parsePreferenceLog('{"id":"PREF-1"}\nnot-json\n'),
    /line 2/,
  );
});

test("rejects duplicate QA matrix ids", () => {
  const markdown = [
    "| ID | Flow |",
    "|---|---|",
    "| QA-MAP-001 | Map |",
    "| QA-MAP-001 | Search |",
  ].join("\n");
  assert.throws(() => collectQaIds(markdown), /Duplicate QA id: QA-MAP-001/);
});

test("allows only design-lab paths in the change set", () => {
  assert.doesNotThrow(() => validateIsolationPaths([
    "design-lab/README.md",
    "design-lab/taste-profile.md",
  ]));
  assert.throws(
    () => validateIsolationPaths(["design-lab/README.md", "app/map/page.tsx"]),
    /Outside design-lab: app\/map\/page.tsx/,
  );
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```bash
node --test design-lab/tests/validation.test.mjs
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `design-lab/scripts/validation-lib.mjs`.

- [ ] **Step 3: Implement the pure validators**

Create `design-lab/scripts/validation-lib.mjs`:

```js
const ALLOWED_PREFERENCE_STATUSES = new Set([
  "observation",
  "hypothesis",
  "confirmed",
  "superseded",
]);

const REQUIRED_PREFERENCE_KEYS = [
  "id",
  "recordedAt",
  "source",
  "judgment",
  "reasons",
  "traits",
  "contexts",
  "status",
];

export function parsePreferenceLog(text) {
  return text
    .split(/\r?\n/)
    .map((line, index) => ({ line, lineNumber: index + 1 }))
    .filter(({ line }) => line.trim())
    .map(({ line, lineNumber }) => {
      let record;
      try {
        record = JSON.parse(line);
      } catch {
        throw new Error(`Invalid preference JSON at line ${lineNumber}`);
      }

      for (const key of REQUIRED_PREFERENCE_KEYS) {
        if (!(key in record)) {
          throw new Error(`Missing preference key ${key} at line ${lineNumber}`);
        }
      }
      if (!ALLOWED_PREFERENCE_STATUSES.has(record.status)) {
        throw new Error(`Invalid preference status at line ${lineNumber}: ${record.status}`);
      }
      for (const key of ["reasons", "traits", "contexts"]) {
        if (!Array.isArray(record[key])) {
          throw new Error(`Preference key ${key} must be an array at line ${lineNumber}`);
        }
      }
      return record;
    });
}

export function collectQaIds(markdown) {
  const ids = [];
  const seen = new Set();
  for (const match of markdown.matchAll(/\|\s*(QA-[A-Z]+-\d{3})\s*\|/g)) {
    const id = match[1];
    if (seen.has(id)) throw new Error(`Duplicate QA id: ${id}`);
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

export function validateIsolationPaths(paths) {
  for (const file of paths) {
    if (!file.startsWith("design-lab/")) {
      throw new Error(`Outside design-lab: ${file}`);
    }
  }
}
```

- [ ] **Step 4: Run the validation tests and verify they pass**

Run:

```bash
node --test design-lab/tests/validation.test.mjs
```

Expected: 4 tests pass, 0 fail.

- [ ] **Step 5: Create the lab entry point and review rules**

Create `design-lab/README.md` with these exact operating rules:

```markdown
# MYSEOULDROP Design Lab

This directory is a Git-tracked but runtime-isolated workspace for mobile design learning and release audits.

## Isolation Contract

- Read the existing app; never import this directory into it.
- Do not edit service files during a design-lab review.
- Store observations and proposals here first.
- Apply a proposal to the service only after separate user approval.
- If browser access fails once, hand off one directly executable terminal command.
- Removing `design-lab/` must not change app runtime, tests, build, or deployment.

## Start Here

1. Read `taste-profile.md`.
2. Refresh the source inventory with `node design-lab/scripts/inventory.mjs`.
3. Run `node design-lab/scripts/validate-lab.mjs`.
4. Select the next unchecked row in `qa-matrix.md`.
5. Record evidence in `reports/` and findings in `findings/`.
6. Do not change the app until the user approves a specific finding.
```

Create `design-lab/review-playbook.md` with these sections and rules:

```markdown
# Mobile Design Review Playbook

## Review Order

1. Refresh route and overlay inventory.
2. Walk the user flow, not isolated pages.
3. Capture 360px, 390×844, and 430px light-theme states.
4. Check loading, empty, error, permission, auth, long-copy, keyboard, and zoom states.
5. Compare only with references that solve the same user problem.
6. Record observations before proposing changes.
7. Require explicit approval before service implementation.
8. Re-run the same state after implementation.

## Expansion Rule

When a new route, overlay, state, issue type, or preference appears, add it during the same review round. Never drop a finding because it does not fit the current taxonomy.

## Evidence Rule

Each finding records route, viewport, theme, state, reproduction steps, user impact, and evidence path. Tool failures are recorded as review blockers, not product defects.
```

- [ ] **Step 6: Commit the isolated scaffold**

Run:

```bash
git add -- design-lab/README.md design-lab/review-playbook.md design-lab/scripts/validation-lib.mjs design-lab/tests/validation.test.mjs
git commit -m "chore(design-lab): scaffold isolated audit workspace"
```

Expected: commit contains only the four `design-lab/` files listed above.

### Task 2: Seed provisional taste evidence and an empty confirmed section

**Files:**
- Create: `design-lab/taste-profile.md`
- Create: `design-lab/preference-log.jsonl`
- Create: `design-lab/references/2026-08-15-initial-directions.md`
- Create: `design-lab/scripts/validate-lab.mjs`
- Modify: `design-lab/tests/validation.test.mjs`

- [ ] **Step 1: Add a failing test for the repository-level validator**

Append to `design-lab/tests/validation.test.mjs`:

```js
test("requires at least one preference record", () => {
  assert.throws(() => parsePreferenceLog(""), /Preference log is empty/);
});
```

Update `parsePreferenceLog` in `validation-lib.mjs` so an empty parsed result throws `Preference log is empty`. Run the test first and verify it fails because the current implementation returns an empty array.

- [ ] **Step 2: Implement the empty-log validation**

Replace the return statement in `parsePreferenceLog` with a local `records` variable, then add:

```js
if (records.length === 0) throw new Error("Preference log is empty");
return records;
```

Run:

```bash
node --test design-lab/tests/validation.test.mjs
```

Expected: 5 tests pass, 0 fail.

- [ ] **Step 3: Write the provisional taste profile**

Create `design-lab/taste-profile.md`:

```markdown
# MYSEOULDROP Taste Profile

> Review baseline: light  
> Confirmed taste rules: none yet

## Working Hypotheses

### H1. Functional screens may work best as field tools

- **Observation:** Direction A was selected as the most intuitive in the first comparison.
- **Possible contexts:** Map, search, subway, location, filter, and route states.
- **Trait to retest:** Large map area, readable information density, and visible next actions.
- **Counter-trait to retest:** Narrative cards and supporting information above the primary task.
- **Evidence:** Direction A selected for being the most intuitive.
- **Confidence:** Provisional; one comparison round.

### H2. Editorial rows may suit optional content

- **Observation:** The lower list area of Direction B received a positive response while B as a whole felt overloaded.
- **Possible contexts:** Optional content or detail-supporting content after its purpose is defined.
- **Trait to retest:** Large title, short metadata, right thumbnail, generous whitespace, and separators instead of card chrome.
- **Do not infer:** Approval for a specific feature, content type, or app-wide style.
- **Evidence:** The lower list area of Direction B was liked while its overall supporting information was considered excessive.
- **Confidence:** Provisional; one comparison round and content scope remains unset.

## Confirmation Gate

A hypothesis moves to Confirmed Preferences only after all default gates are met:

1. It is supported in at least three independent reference or review rounds.
2. It appears across at least two distinct screen types or contexts.
3. There is no unresolved recent contradiction.
4. The user explicitly confirms the rule and its application context.

An explicit confirmation never broadens a contextual rule into a universal app style.

## Confirmed Preferences

None yet.
```

- [ ] **Step 4: Write the initial append-only preference records**

Create `design-lab/preference-log.jsonl` with exactly these three JSON lines:

```jsonl
{"id":"PREF-20260815-001","recordedAt":"2026-08-15T17:40:00+09:00","source":"initial-direction-board","judgment":"prefer","reasons":["사용성 기준으로 가장 직관적임"],"traits":["map-first","high-information-density","action-first"],"contexts":["map","search","filters","directions"],"status":"observation"}
{"id":"PREF-20260815-002","recordedAt":"2026-08-15T17:42:00+09:00","source":"initial-direction-board","judgment":"reject-in-context","reasons":["핵심 화면에서 부가정보가 너무 많이 보임"],"traits":["limit-supporting-content","protect-primary-task"],"contexts":["map","search"],"status":"observation"}
{"id":"PREF-20260815-003","recordedAt":"2026-08-15T17:42:00+09:00","source":"initial-direction-board","judgment":"prefer-pattern-only","reasons":["큰 제목과 오른쪽 썸네일의 하단 목록 뷰는 선호","구체적인 콘텐츠 종류는 미정"],"traits":["editorial-row","right-thumbnail","separator-not-card","generous-spacing"],"contexts":["optional-content","stories","detail-support"],"status":"hypothesis"}
```

- [ ] **Step 5: Document the reference study**

Create `design-lab/references/2026-08-15-initial-directions.md` with:

```markdown
# Initial Mobile Direction Study

## Compared Directions

- A, field tool: KakaoMap and NAVER Map patterns for immediate local action.
- B, city editorial: Airbnb and Wanderlog patterns for discovery and edited content.
- C, beauty market: Olive Young Global, Booksy, and UNNI patterns for commerce and booking.

## User Result

- Rated A as the most intuitive option in this comparison; it was not adopted as the app-wide direction.
- Rejected B as a full-screen direction because supporting information was excessive.
- Kept B's lower editorial row as an optional visual pattern only.
- Did not approve a concrete content feature for that row.
- These are first-round observations and hypotheses; no taste preference is confirmed yet.

## Reference Links

- https://www.kakaocorp.com/page/service/service/kakaomap?lang=en
- https://apps.apple.com/us/app/naver-maps-navigation/id311867728
- https://news.airbnb.com/2023-summer-release/
- https://wanderlog.com/pages/about-us
- https://global.oliveyoung.com/app/download
- https://apps.apple.com/us/app/booksy-for-customers/id723961236
- https://apps.apple.com/gb/app/unni-korean-beauty-now/id1035105027
```

- [ ] **Step 6: Add the validation CLI**

Create `design-lab/scripts/validate-lab.mjs`:

```js
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { collectQaIds, parsePreferenceLog } from "./validation-lib.mjs";

const labRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const preferences = readFileSync(resolve(labRoot, "preference-log.jsonl"), "utf8");
const matrix = readFileSync(resolve(labRoot, "qa-matrix.md"), "utf8");

const records = parsePreferenceLog(preferences);
const qaIds = collectQaIds(matrix);

console.log(`Design lab valid: ${records.length} preferences, ${qaIds.length} QA rows`);
```

Do not run this CLI until Task 4 creates `qa-matrix.md`.

- [ ] **Step 7: Commit the taste seed**

Run:

```bash
git add -- design-lab/taste-profile.md design-lab/preference-log.jsonl design-lab/references/2026-08-15-initial-directions.md design-lab/scripts/validate-lab.mjs design-lab/scripts/validation-lib.mjs design-lab/tests/validation.test.mjs
git commit -m "docs(design-lab): seed provisional mobile preference evidence"
```

Expected: commit contains only the six listed `design-lab/` paths.

### Task 3: Build a deterministic read-only route and overlay inventory

**Files:**
- Create: `design-lab/scripts/inventory-lib.mjs`
- Create: `design-lab/scripts/inventory.mjs`
- Create: `design-lab/tests/inventory.test.mjs`
- Create: `design-lab/generated/inventory.json`

- [ ] **Step 1: Write failing inventory unit tests**

Create `design-lab/tests/inventory.test.mjs`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { detectOverlayTypes, routeFromPage } from "../scripts/inventory-lib.mjs";

test("turns App Router page files into stable route patterns", () => {
  assert.equal(routeFromPage("app/page.tsx"), "/");
  assert.equal(routeFromPage("app/map/page.tsx"), "/map");
  assert.equal(routeFromPage("app/place/[id]/page.tsx"), "/place/[id]");
  assert.equal(routeFromPage("app/(account)/settings/page.tsx"), "/settings");
});

test("detects overlay semantics without evaluating application code", () => {
  const source = `
    <BottomSheet title="Filters" onClose={close} />
    <div className="drawer" role="dialog" aria-modal="true" />
  `;
  assert.deepEqual(detectOverlayTypes(source), ["bottom-sheet", "dialog", "drawer"]);
});

test("returns no overlay types for a plain page", () => {
  assert.deepEqual(detectOverlayTypes("export default function Page() { return <main /> }"), []);
});
```

- [ ] **Step 2: Run the inventory tests and verify they fail**

Run:

```bash
node --test design-lab/tests/inventory.test.mjs
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `inventory-lib.mjs`.

- [ ] **Step 3: Implement pure inventory helpers**

Create `design-lab/scripts/inventory-lib.mjs`:

```js
export function routeFromPage(file) {
  const normalized = file.replaceAll("\\", "/");
  const route = normalized
    .replace(/^app\//, "")
    .replace(/\/page\.tsx$/, "")
    .replace(/^page\.tsx$/, "")
    .split("/")
    .filter(Boolean)
    .filter((segment) => !(segment.startsWith("(") && segment.endsWith(")")))
    .join("/");
  return route ? `/${route}` : "/";
}

export function detectOverlayTypes(source) {
  const types = new Set();
  if (source.includes("<BottomSheet")) types.add("bottom-sheet");
  if (/role=["']dialog["']/.test(source)) types.add("dialog");
  if (/className=["'][^"']*drawer/.test(source)) types.add("drawer");
  if (/className=["'][^"']*modal/.test(source)) types.add("modal");
  if (/className=["'][^"']*overlay/.test(source)) types.add("overlay");
  if (source.includes("useToast") || source.includes("<ToastProvider")) types.add("toast");
  return [...types].sort();
}
```

- [ ] **Step 4: Run the inventory unit tests**

Run:

```bash
node --test design-lab/tests/inventory.test.mjs
```

Expected: 3 tests pass, 0 fail.

- [ ] **Step 5: Implement the read-only inventory CLI**

Create `design-lab/scripts/inventory.mjs`:

```js
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { detectOverlayTypes, routeFromPage } from "./inventory-lib.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const outputPath = resolve(repoRoot, "design-lab/generated/inventory.json");

function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(dir, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

const pageFiles = walk(resolve(repoRoot, "app"))
  .filter((file) => file.endsWith("/page.tsx"))
  .map((file) => relative(repoRoot, file).replaceAll("\\", "/"))
  .sort();

const componentFiles = [resolve(repoRoot, "app"), resolve(repoRoot, "components")]
  .flatMap(walk)
  .filter((file) => file.endsWith(".tsx"))
  .sort();

const routes = pageFiles.map((file) => ({ file, route: routeFromPage(file) }));
const overlays = componentFiles
  .map((file) => {
    const source = readFileSync(file, "utf8");
    return {
      file: relative(repoRoot, file).replaceAll("\\", "/"),
      types: detectOverlayTypes(source),
    };
  })
  .filter(({ types }) => types.length > 0);

const output = `${JSON.stringify({ schemaVersion: 1, routes, overlays }, null, 2)}\n`;

if (process.argv.includes("--check")) {
  const current = existsSync(outputPath) ? readFileSync(outputPath, "utf8") : "";
  if (current !== output) {
    console.error("Design lab inventory is stale. Run: node design-lab/scripts/inventory.mjs");
    process.exit(1);
  }
  console.log(`Inventory current: ${routes.length} routes, ${overlays.length} overlay-bearing files`);
} else {
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, output);
  console.log(`Inventory written: ${routes.length} routes, ${overlays.length} overlay-bearing files`);
}
```

- [ ] **Step 6: Generate and check the initial inventory**

Run:

```bash
node design-lab/scripts/inventory.mjs
node design-lab/scripts/inventory.mjs --check
```

Expected first command: `Inventory written: 32 routes, 15 overlay-bearing files` based on the 2026-08-15 source snapshot. If the counts differ because the app changed after this plan was written, accept the new deterministic counts and note them in the baseline report.

Expected second command: `Inventory current: <same route count> routes, <same overlay count> overlay-bearing files`.

- [ ] **Step 7: Run both unit-test files**

Run:

```bash
node --test design-lab/tests/validation.test.mjs design-lab/tests/inventory.test.mjs
```

Expected: 8 tests pass, 0 fail.

- [ ] **Step 8: Commit the inventory tooling**

Run:

```bash
git add -- design-lab/scripts/inventory-lib.mjs design-lab/scripts/inventory.mjs design-lab/tests/inventory.test.mjs design-lab/generated/inventory.json
git commit -m "feat(design-lab): add read-only source inventory"
```

Expected: commit contains only the four listed `design-lab/` paths.

### Task 4: Create the evolving QA matrix, finding lifecycle, and baseline

**Files:**
- Create: `design-lab/qa-matrix.md`
- Create: `design-lab/templates/finding.md`
- Create: `design-lab/templates/review-report.md`
- Create: `design-lab/findings/README.md`
- Create: `design-lab/findings/DLAB-001-map-mobile-layering.md`
- Create: `design-lab/reports/README.md`
- Create: `design-lab/reports/2026-08-15-baseline.md`

- [ ] **Step 1: Create the initial QA matrix**

Create `design-lab/qa-matrix.md` with this header and initial rows:

```markdown
# Mobile Design QA Matrix

Status values: `unreviewed`, `blocked`, `finding`, `passed`, `reverify`.

| ID | Flow | Route / surface | State | Viewports | Theme | Status | Finding |
|---|---|---|---|---|---|---|---|
| QA-ENTRY-001 | Entry | `/` | guest default | 360, 390, 430 | light | unreviewed | — |
| QA-AUTH-001 | Authentication | `/login` | default, invalid credentials, loading | 360, 390, 430 | light | unreviewed | — |
| QA-AUTH-002 | Authentication | `/register` | default, validation, confirmation | 360, 390, 430 | light | unreviewed | — |
| QA-ONBOARD-001 | Onboarding | `/onboarding/mode` → `/onboarding/beauty-profile` | complete and skipped answers | 360, 390, 430 | light | unreviewed | — |
| QA-MAP-001 | Nearby discovery | `/map` | location denied fallback | 360, 390, 430 | light | finding | DLAB-001 |
| QA-MAP-002 | Nearby discovery | filter sheet | open, scroll, apply, clear, close | 360, 390, 430 | light | unreviewed | — |
| QA-MAP-003 | Subway discovery | subway controller | search, route, compact, half, full | 360, 390, 430 | light | unreviewed | — |
| QA-SEARCH-001 | Search | `/search` | empty query, results, no results, long text | 360, 390, 430 | light | unreviewed | — |
| QA-PLACE-001 | Place decision | `/place/[id]` | curated and generated place | 360, 390, 430 | light | unreviewed | — |
| QA-RANK-001 | Product discovery | `/ranking` → `/shop/[id]` | tabs, no results, product detail | 360, 390, 430 | light | unreviewed | — |
| QA-SAVED-001 | Saved | `/favorites` | loading, empty, populated, remove | 360, 390, 430 | light | unreviewed | — |
| QA-MY-001 | Account | `/menu` → `/settings` | guest, member, modal, sign out | 360, 390, 430 | light | unreviewed | — |
| QA-SUPPORT-001 | Support and legal | `/support`, `/legal/terms`, `/legal/privacy` | long copy, feedback sheet | 360, 390, 430 | light | unreviewed | — |
| QA-STATE-001 | Global state | loading, error, not-found | direct navigation | 360, 390, 430 | light | unreviewed | — |
| QA-THEME-001 | Theme regression | representative core flow | light baseline, dark regression | 390 | light, dark | unreviewed | — |

## Expansion Rule

Add a row in the same review round whenever a new route, overlay, state, or user flow is discovered. Keep historical rows and mark retired surfaces in notes rather than deleting evidence.
```

- [ ] **Step 2: Create the finding template**

Create `design-lab/templates/finding.md`:

```markdown
# DLAB-NNN — Finding title

- **Status:** observed
- **Category:** usability
- **Severity:** general
- **First observed:** YYYY-MM-DD
- **Last verified:** not verified
- **Routes / surfaces:** `/route`
- **Viewport / theme:** 390×844, light
- **Related QA IDs:** QA-FLOW-NNN
- **Related preference evidence:** observation, hypothesis, or confirmed rule name

## Observation

State only what is visible or reproducible.

## Reproduction

1. Open the exact route and state.
2. Perform the exact interaction.
3. Observe the result.

## User Impact

Describe the blocked, delayed, confusing, or trust-reducing outcome.

## Evidence

List local screenshot or report paths. Do not retain sensitive user data.

## Improvement Hypothesis

Describe the smallest change that could resolve the observation.

## Expected Benefit and Tradeoff

Record both the gain and what may become worse.

## Decision History

| Date | Decision | Reason |
|---|---|---|
```

Create `design-lab/templates/review-report.md`:

```markdown
# Review Round — YYYY-MM-DD

## Scope

- Flow:
- Routes and surfaces:
- Viewports:
- Theme:
- Auth and data state:

## Result

- Passed:
- Findings:
- Blocked:
- Added to matrix:

## Preference Evidence

Record only explicit user feedback or repeated observed choices.

## Next Review

List exact states that require verification or user approval.
```

- [ ] **Step 3: Create finding and report index rules**

Create `design-lab/findings/README.md`:

```markdown
# Findings

Create one file per problem or improvement hypothesis. Use sequential IDs `DLAB-001`, `DLAB-002`, and so on. A finding can move through `observed`, `proposed`, `approved`, `implemented`, `verified`, `deferred`, or `rejected`. Never mark a finding implemented or verified from a design proposal alone.
```

Create `design-lab/reports/README.md`:

```markdown
# Review Reports

Store one Markdown summary per review round. Keep durable decisions and evidence references, but do not commit screenshots containing account data or sensitive information. Temporary captures belong in ignored local review storage.
```

- [ ] **Step 4: Record the initial map observation as a candidate finding**

Create `design-lab/findings/DLAB-001-map-mobile-layering.md`:

```markdown
# DLAB-001 — Map mobile horizontal clipping and layer overlap

- **Status:** observed
- **Category:** usability
- **Severity:** high
- **First observed:** 2026-08-15
- **Last verified:** not verified
- **Routes / surfaces:** `/map`, map controls, nearby sheet, bottom navigation
- **Viewport / theme:** 390×844, light
- **Related QA IDs:** QA-MAP-001
- **Related preference evidence:** H1 — Functional screens may work best as field tools

## Observation

A user-generated 390×844 capture appeared to clip the right-side top control and the `My` bottom tab. The map compass overlapped the `Map` tab, and the nearby sheet's first row appeared behind the fixed bottom navigation. Dense pins also weakened selection priority.

## Reproduction

1. Start the existing app at `http://127.0.0.1:3000`.
2. Open `/map` in a 390×844 light-theme viewport.
3. Use the location-denied Gangnam fallback state.
4. Inspect horizontal overflow, bottom navigation visibility, map-control position, and nearby-sheet content clearance.
5. Repeat at 360px and 430px before confirming the finding.

## User Impact

If reproduced, users may lose access to a primary navigation destination and may mis-tap overlapping map controls. Hidden list content also reduces trust in the result sheet.

## Evidence

Temporary capture observed at `/tmp/myseouldrop-map-mobile.png`. Do not treat this temporary file as durable evidence.

## Improvement Hypothesis

Confirm the actual overflow source and safe-area math first. Then constrain the app shell to the viewport and reserve explicit non-overlapping zones for map controls, the nearby sheet, and bottom navigation.

## Expected Benefit and Tradeoff

The map becomes reliably operable on common mobile widths. Reserving more bottom clearance may slightly reduce visible map or list area.

## Decision History

| Date | Decision | Reason |
|---|---|---|
| 2026-08-15 | Keep as observed | One capture is insufficient to confirm implementation cause. |
```

- [ ] **Step 5: Create the baseline report**

Create `design-lab/reports/2026-08-15-baseline.md`:

```markdown
# Baseline Review — 2026-08-15

## Scope

- Product: MYSEOULDROP mobile web app only
- Representative theme: light
- Representative viewport: 390×844
- Reviewed surface: `/map`, location-denied Gangnam fallback

## Inventory Snapshot

- Source scan at planning time: 32 App Router page files
- Source scan at planning time: 15 overlay-bearing app/component files
- Final counts come from `generated/inventory.json` after Task 3 runs.

## Result

- One candidate high-severity finding recorded as DLAB-001.
- Full route and overlay review has not yet run.
- Existing service code was not changed by the review.

## Preference Evidence

- Light theme is the current review baseline, not a confirmed taste rule.
- Direction A was rated most intuitive in the first comparison.
- Direction B as a whole felt overloaded in the first comparison.
- Direction B's lower editorial row received a positive response, but its content and application context remain unset.
- No taste rule is confirmed yet; all items above remain observations or hypotheses.

## Next Review

Reproduce DLAB-001 at 360px, 390px, and 430px, then audit the complete nearby-discovery flow including filters, place selection, and sheet states.
```

- [ ] **Step 6: Run the lab validator**

Run:

```bash
node design-lab/scripts/validate-lab.mjs
```

Expected: `Design lab valid: 3 preferences, 15 QA rows`.

- [ ] **Step 7: Commit the evolving review records**

Run:

```bash
git add -- design-lab/qa-matrix.md design-lab/templates/finding.md design-lab/templates/review-report.md design-lab/findings/README.md design-lab/findings/DLAB-001-map-mobile-layering.md design-lab/reports/README.md design-lab/reports/2026-08-15-baseline.md
git commit -m "docs(design-lab): add QA matrix and baseline finding"
```

Expected: commit contains only the seven listed `design-lab/` paths.

### Task 5: Verify isolation, determinism, and handoff readiness

**Files:**
- Modify: `design-lab/README.md`
- Modify: `design-lab/reports/2026-08-15-baseline.md`

- [ ] **Step 1: Run all design-lab tests**

Run:

```bash
node --test design-lab/tests/validation.test.mjs design-lab/tests/inventory.test.mjs
```

Expected: 8 tests pass, 0 fail.

- [ ] **Step 2: Verify the generated inventory is current**

Run:

```bash
node design-lab/scripts/inventory.mjs --check
```

Expected: exit code 0 and an `Inventory current:` line whose route and overlay counts match `design-lab/generated/inventory.json`.

- [ ] **Step 3: Validate preference and QA records**

Run:

```bash
node design-lab/scripts/validate-lab.mjs
```

Expected: `Design lab valid: 3 preferences, 15 QA rows`.

- [ ] **Step 4: Prove that implementation changes are isolated**

Use the commit that introduced this plan as the implementation base:

```bash
DESIGN_LAB_PLAN_COMMIT=$(git log -1 --format=%H -- design-lab/plans/2026-08-15-mobile-design-learning-and-audit-system.md)
git diff --name-only "${DESIGN_LAB_PLAN_COMMIT}"...HEAD
```

Expected: every returned path starts with `design-lab/`. If any path is outside `design-lab/`, stop and remove it from this implementation before continuing. Do not reset or overwrite unrelated user work.

- [ ] **Step 5: Confirm the existing app verification remains unchanged**

Run the existing project checks without modifying project configuration:

```bash
npm run typecheck
npm test
npm run build
```

Expected: all three commands pass. If a command fails, compare it with the implementation base before attributing it to `design-lab/`; the lab has no runtime imports and should not affect these commands.

- [ ] **Step 6: Record verified counts and isolation evidence**

Append the actual inventory counts and verification command results to `design-lab/reports/2026-08-15-baseline.md`. Add a `Verification` section that names each command and its pass/fail result. Do not write service defects into this section unless independently reproduced.

- [ ] **Step 7: Add daily-use commands to the README**

Append to `design-lab/README.md`:

````markdown
## Verification Commands

```bash
node --test design-lab/tests/validation.test.mjs design-lab/tests/inventory.test.mjs
node design-lab/scripts/inventory.mjs --check
node design-lab/scripts/validate-lab.mjs
```

These commands read app source and design-lab records. They do not modify service code.
````

- [ ] **Step 8: Commit the verified handoff**

Run:

```bash
git add -- design-lab/README.md design-lab/reports/2026-08-15-baseline.md
git commit -m "docs(design-lab): verify isolated audit lab"
```

Expected: final implementation commit contains only the two listed `design-lab/` files.

## Final Acceptance Checklist

- [ ] Only `design-lab/` changed during implementation.
- [ ] The lab contains provisional evidence, an explicit confirmation gate, and an initially empty confirmed section.
- [ ] The source inventory is deterministic and checkable.
- [ ] The QA matrix can accept new routes, states, overlays, and issue types without rewriting history.
- [ ] Findings separate observation, proposal, approval, implementation, and verification.
- [ ] DLAB-001 remains an observation until reproduced at all three target widths.
- [ ] Browser failure hands off one directly executable terminal command after the first failure.
- [ ] Removing `design-lab/` would leave app runtime, tests, build, and deployment unchanged.
