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
| KZ-003 | `design.md` must not assert a file's current imports/exports/consumers from memory — verify by reading the file before writing the claim | changes/all-countries-filter | Medium | Product | `docs/specs/general-setup/design.md` §7 | Applied |
| KZ-004 | A foundation task's "Done when" must never require full-package build/typecheck success before its dependent consumer task lands — scope the check to the task's own files | changes/all-countries-filter | High | Product | `docs/specs/general-setup/task.md` §8 | Applied |

## Entries

### 2026-08-05 — changes/all-countries-filter

**Metrics**

| Signal | Value | Source |
|---|---|---|
| Tasks executed | 4 | tasks.md |
| Reviewer FAIL rework attempts | 0 consumed (T-001's 1 FAIL was correctly diagnosed as a Pivot, not rework; T-002/T-003/T-004 PASSed on attempt 1) | execution.md |
| HALTs / FATAL_FAILs | 0 | execution.md |
| Pivots | 1 (T-001 — `tasks.md` "Done when" wording defect) | execution.md — `## Pivot Record: T-001` |
| PRODUCT_BUGs | 0 | test-report.md |
| Judgment-day severe findings | 1 confirmed SEVERE, 2 confirmed WARNING (both judges agreed); resolved pre-implementation via "Fix only", no re-judgment needed | judgment.md |
| Validation FAIL / WARN | 0 FAIL / 2 WARN (both non-gating, one fixed same day) | validation-report.md |

**Lessons**

- **KZ-003 — `design.md` asserted a file's current imports as fact without reading the file.** (Product, Medium)
  - Root cause: `design.md` §4.4 (pre-Judgment-Day draft) claimed `DEFAULT_COUNTRY` was already imported in `start-assessment-modal.tsx` — it was not. Implemented literally, the guard would have referenced an undefined symbol and failed to compile. Two related findings share the same root cause: an unlisted real consumer of `useCountryFilter()` (`app-layout.tsx`) missing from the design's "four files" inventory despite a "grepped every consumer" claim, and a Testing Strategy row targeting the wrong test file for a Must requirement's core guarantee (the sentinel-translation logic that `use-assessments.test.ts` cannot actually exercise). All three are instances of a design document asserting the current state of code without reading it first.
  - Evidence: `judgment.md` — Merged Ledger findings #1 (SEVERE, confirmed by both judges), #2 and #3 (WARNING, confirmed by both).
  - Standardization: added a checklist line to `docs/specs/general-setup/design.md` §7 Design Review Checklist. **Status: Applied 2026-08-05 (user-approved, "Apply all").**

- **KZ-004 — A Foundation-phase task's acceptance criterion required a full-package build pass that was structurally unreachable in isolation.** (Product, High)
  - Root cause: `tasks.md` T-001 (Phase A: Foundation) widened `CountryFilterValue` ahead of its only real-code consumer needing the same widening (`app-header.tsx`, assigned to T-002, Phase B). T-001's own "Done when" nonetheless demanded `pnpm --filter @alliance-risk/web build` succeed — a criterion that could only be true once T-002 (a task depending on T-001) had also landed. This triggered a Reviewer FAIL that the Leader correctly diagnosed as a spec defect (not a code defect) and resolved via the Pivot Protocol with user approval, but the Pivot itself was avoidable: the task plan's own dependency graph (`T-001 ─► T-002/T-003/T-004`) already predicted the ordering problem.
  - Evidence: `execution.md` — `## Pivot Record: T-001`; `tasks.md` T-001's amended "Done when" line (tagged `Amended 2026-08-05 post-Pivot`).
  - Standardization: added a checklist line to `docs/specs/general-setup/task.md` §8 Task Plan Checklist. **Status: Applied 2026-08-05 (user-approved, "Apply all").**

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
