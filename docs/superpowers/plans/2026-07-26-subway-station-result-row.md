# Subway Station Result Row Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the approved compact station-result row while preserving the existing combobox behavior and accessibility.

**Architecture:** Keep `StationCombobox` and its data flow unchanged. Add one shared Lucide history glyph, replace visible context words with icon plus screen-reader text, and express the visual change through the existing station-result CSS selectors.

**Tech Stack:** Next.js 14, React 18, TypeScript, CSS variables, Lucide SVG sprite, Vitest.

## Global Constraints

- Keep every transfer line visible.
- Use 20px badge height, 6px badge-to-name gap, 14px/12px station typography, and a minimum 56px row.
- Preserve the full-row button, listbox semantics, keyboard navigation, and selected/focus states.
- Add no dependency and change no route/search logic.

---

### Task 1: Compact station-result presentation

**Files:**
- Modify: `lib/subway-search-layout.test.ts`
- Modify: `components/icon.tsx`
- Modify: `components/subway/subway-route-controller.tsx`
- Modify: `app/globals.css`

**Interfaces:**
- Consumes: `StationLineBadges`, `Icon`, `LINE_META`, and the existing `context` value.
- Produces: `IconName` value `history` and the `station-result-context-icon` presentation hook.

- [ ] **Step 1: Write the failing layout contract**

Add assertions for a 56px result row, 6px gap, 20px badges, 14px/12px labels, the `history` icon, and visually hidden context text.

- [ ] **Step 2: Run the focused test and confirm failure**

Run: `npm test -- lib/subway-search-layout.test.ts`

Expected: FAIL because the compact measurements and history icon are not present.

- [ ] **Step 3: Implement the approved markup and CSS**

Add the Lucide history symbol, render `history` for `Recent` and `locate` for `Near you`, retain `<span className="sr-only">{context}</span>`, and update the station-result sizing selectors.

- [ ] **Step 4: Run focused and full verification**

Run:

```bash
npm test -- lib/subway-search-layout.test.ts
npm test
npm run typecheck
npm run lint
```

Expected: all commands pass with no warnings.

- [ ] **Step 5: Verify the mobile screen**

Capture `/map` at 390x844 with a station field open. Confirm badge/name spacing, truncation, trailing icon alignment, all transfer lines, focus state, and no horizontal overflow.
