# Kaizen Log

Continuous-improvement record for this project, updated automatically by
`/akili-archive` (Kaizen Retrospective, powered by the `kaizen` skill).
Other AKILI commands read only the `## Active Lessons` table below —
keep it at 10 rows or fewer.

## Active Lessons

| ID | Lesson | Source Spec | Severity | Target | Standardized In | Status |
|---|---|---|---|---|---|---|
| KZ-001 | When a task deviates from a `design.md` decision, later tasks whose deliverable restates that same decision (e.g. an implementation note) must cross-check `execution.md`'s deviation notes before closing | enhancements/multi-country-enablement | Medium | Product | — (proposed: `.agents/implementer.md` §Scope Discipline) | Deferred |
| KZ-002 | `/akili-validate`'s Build Integrity phase should isolate spec-caused failures from unrelated, pre-existing working-tree drift (e.g. a half-edited tooling config) before treating a wrapper-script failure as a verdict signal | enhancements/multi-country-enablement | Medium | Methodology | — (no local edit — upstream candidate) | Deferred |

## Entries

### 2026-07-29 — enhancements/multi-country-enablement

**Metrics**

| Signal | Value | Source |
|---|---|---|
| Tasks executed | 11 | tasks.md |
| Reviewer FAIL rework attempts | 0 (all 11 tasks PASS on attempt 1) | execution.md |
| HALTs / FATAL_FAILs | 0 | execution.md |
| Pivots | 0 | execution.md — no `## Pivot Record` blocks |
| PRODUCT_BUGs | 0 | test-report.md |
| Judgment-day severe findings | N/A — not run for this spec | — |
| Validation FAIL / WARN | 0 FAIL / 3 WARN (all fixed before archive) + 4 accepted Should-priority gaps | validation-report.md |

**Lessons**

- **KZ-001 — Design deviation recorded in `execution.md` did not propagate to the doc task restating the same decision.** (Product, Medium)
  - Root cause: T-007 deliberately mounted `CountryFilterProvider` at root `app/layout.tsx` instead of the design-specified `(protected)/layout.tsx` (so `(admin)` routes using `AppLayout` wouldn't crash) and recorded the rationale in `execution.md`. T-011 (`implementation-note.md` — the NFR-MC-005 deliverable that restates the same architectural decision) was completed without cross-checking T-007's deviation, so the note shipped with the stale location until `/akili-validate` flagged it as a WARN.
  - Evidence: `execution.md` — T-007 attempt note; `validation-report.md` §8 (Design Conformance WARN, fixed 2026-07-29).
  - Standardization proposal: append 2–3 lines to `.agents/implementer.md` §2 (Scope Discipline) — when a task's deliverable restates a design decision already implemented by an earlier task, check `execution.md` for recorded deviations to that decision before reporting completion.
  - Status: **Deferred** — user chose "Defer all" at the Standardize approval menu (no High-severity lesson present, so deferral matched skill guidance). No local edit applied.

- **KZ-002 — `/akili-validate`'s Build Integrity phase treated a `pnpm build`/`lint`/`test` wrapper failure as spec-attributable without first isolating unrelated working-tree drift.** (Methodology, Medium)
  - Root cause: the working tree contained an incomplete, uncommitted edit to `pnpm-workspace.yaml` (`allowBuilds` values were the literal placeholder string `"set this to true or false"`), unrelated to this spec's diff. Running the documented `pnpm build`/`lint`/`test` commands failed with `ERR_PNPM_IGNORED_BUILDS`, which could easily read as a spec-caused build failure unless the auditor thinks to bypass the wrapper and invoke `tsc`/`nest build`/`next build`/`eslint` directly, then confirm via `git stash` that the failure predates the diff.
  - Evidence: this spec's `validation-report.md` §5 (Build Integrity — WARN, later fixed); the fix itself (`pnpm-workspace.yaml`, `package.json`, root `CLAUDE.md`) was unrelated to `enhancements/multi-country-enablement`'s own scope.
  - Standardization proposal: no local edit possible — the root cause is in the `/akili-validate` skill's own Phase 3 instructions (a project-agnostic methodology file), not this project's guides. Recommend upstreaming to the AKILI methodology repository: Build Integrity should recommend a direct-tool fallback (and optionally a `git stash` sanity check) when a wrapper script fails, before attributing the failure to the spec under validation.
  - Status: **Deferred (upstream candidate)** — recorded here for methodology maintainers; no in-repo action taken.
