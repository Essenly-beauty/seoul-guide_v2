# Design System Hardening

## Goal

Turn the v1 component inventory into an enforced product system without changing
the current visual language.

## Scope

1. Adopt the nine v2 primitives in production screens where the existing markup
   maps cleanly to their APIs.
2. Keep specialized map rows, multi-step booking flows, and domain controls
   custom when a generic primitive would reduce clarity or behavior.
3. Fix silent prop loss, keyboard focus visibility, accessible naming, and
   disabled-state contracts in the core controls.
4. Replace broad source-file exemptions with syntax-aware design-system usage
   checks and explicit exceptions.
5. Track the design-system documentation in Git and document state,
   accessibility, localization, and contribution rules.

## Compatibility

- Existing class names remain the styling source, so migrated screens retain
  their current layout and visual treatment.
- Raw CSS tokens remain available during migration. New component state styles
  use semantic tokens, with dark and high-contrast modes deferred to the next
  foundation phase.
- Complex call sites may remain raw only with a narrow documented exception.

## Verification

- Contract tests fail before each enforcement change and pass after migration.
- Run the full Vitest suite, TypeScript, ESLint, production build, and
  `git diff --check`.
- Review the final diff for accidental layout changes and stale migration
  comments.
