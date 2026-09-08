You are performing a read-only pre-launch code and data-quality cross-check for
the MYSEOULDROP Next.js app in the current repository.

Do not edit, create, delete, or format any project file. Do not commit. Inspect
the current working tree and return a concise evidence-based review only.

Review these areas:

1. Trace every place journey from search, category lists, saved lists, shared
   lists, and subway station lists into place detail and the map. Find cases
   where a list row can exist but its detail or selected map marker is absent,
   incorrect, filtered out, clustered invisibly, or positioned at another
   venue. Include exact file and line references and concrete reproduction
   paths.
2. Review the new includeSelectedPlace marker-layer fix and its tests. Identify
   regressions, missing dependencies, stale state, duplicate markers, or cases
   where the fix does not satisfy the owner report.
3. Review the place audit model, generated report, and manual verdict file.
   Check whether exact English-name search in Naver is represented separately
   from English service support, whether unchecked status is honest, and
   whether duplicate coordinates, missing Korean names, promotional English
   titles, generated romanizations, approximate pins, and outside-Seoul rows
   are detected correctly.
4. Check the ranking and brand directory. Confirm whether current rankings and
   icons are demo data or authoritative, and identify any public-facing copy
   that could misleadingly imply official Olive Young rankings or official
   brand CI.
5. Review the automated pre-deploy command and QA report. Note missing tests or
   launch blockers, prioritised as P0, P1, P2, or P3.

Run only read-only commands and tests that do not require network access or a
local web server. Do not expose environment-variable values.

Output sections:

- Verdict
- Confirmed findings, ordered by severity
- Review of the marker fix
- Review of the data audit
- Missing regression tests
- Launch blockers
- Exact recommended next actions

Distinguish confirmed facts from hypotheses. Do not claim Naver, Google, Kakao,
or production-browser verification unless you actually obtained that evidence.
