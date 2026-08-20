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
| KZ-005 | The documented `pnpm --filter <pkg> test -- --testPathPattern=<pattern>` command (double `--`) is broken in this repo's pnpm — false green on `web`, hard failure on `api`. Use single `--testPathPattern=` | enhancements/tracking-analytics | Medium | Product | Root `CLAUDE.md`, `packages/api/CLAUDE.md`, `packages/web/CLAUDE.md` (test command examples) | Applied |
| KZ-006 | Judgment Day round-2 re-judgment findings routed to `tasks.md` only (not `design.md`) let the design-of-record silently drift from shipped code — backport design-decision fixes to `design.md` too | enhancements/tracking-analytics | Medium | Methodology | — (no local edit — upstream candidate for `judgment-day` skill) | Deferred |
| KZ-007 | A verification command added specifically to fix a "vacuous check" finding (e.g. Judgment Day C1) must itself be checked for the same vacuity class before being recorded as closing the finding | enhancements/tracking-analytics | Medium | Methodology | — (no local edit — upstream candidate for `judgment-day`/`akili-validate`) | Deferred |
| KZ-008 | 4 real post-validation bugs (cache invalidation, scope-too-narrow design, cross-field propagation) were all invisible to mocked unit tests and only found by manual browser testing after the spec was already "archive-ready" — design.md must name cross-screen cache invalidation and cross-field interaction as defect classes requiring an explicit manual-QA step | changes/country-document-match-validation | High | Product | `docs/specs/general-setup/design.md` §7 | Applied |
| KZ-009 | AKILI-SPECS has no named workflow for "a real bug is found after archive-readiness but before archiving" — the ad-hoc pattern that worked here (amend requirements/design → re-run Implementer/Reviewer → addend test-report/validation-report → then archive) is worth formalizing | changes/country-document-match-validation | Medium | Methodology | — (no local edit — upstream candidate for a named `/akili-validate` post-audit amendment flow) | Deferred |
| KZ-010 | Root `CLAUDE.md`'s documented `npx --prefix packages/api tsx prisma/seed.ts` fails with `ERR_MODULE_NOT_FOUND` — `--prefix` only selects the binary's package, not the cwd the path argument resolves against | changes/country-document-match-validation | Low | Product | Root `CLAUDE.md` (Local Development Setup) | Applied |

## Entries

### 2026-08-19 — changes/country-document-match-validation

**Metrics**

| Signal | Value | Source |
|---|---|---|
| Tasks executed | 5 original + 4 post-validation design amendments (DD-CMV-007–010) | tasks.md, execution.md |
| Reviewer FAIL rework attempts | 2 (T-001 attempt 1; DD-CMV-009 attempt 1) — both PASSed on attempt 2 | execution.md |
| HALTs / FATAL_FAILs | 0 | execution.md |
| Pivots | 0 formal `## Pivot Record` blocks — but 4 post-archive-ready design amendments (DD-CMV-007–010) functioned as pivots in substance | execution.md |
| PRODUCT_BUGs | 0 | test-report.md |
| Judgment-day severe findings | 3 rounds during `/akili-specify` — JD-01/JD-02 confirmed severe by both judges (round 1), 3 fix-caused defects found and closed (round 2), 1 SEVERE query-invalidation gap found and closed out-of-band (round 3, user-authorized) | judgment.md |
| Validation FAIL / WARN | 0 FAIL / 4 WARN (all closed with real evidence, incl. a live end-to-end DB verification) | validation-report.md |
| Post-validation manual-testing findings | 4 (DD-CMV-007, 008, 009, 010) — all found by the user directly using the shipped feature, none caught by any automated layer | execution.md, validation-report.md §14 |

**Lessons**

- **KZ-008 — 4 real bugs were invisible to the entire automated test suite and only found by manual testing after "archive-ready."** (Product, High)
  - Root cause: DD-CMV-007 (a scope-too-narrow design decision — restricting country detection to a 4-country allowlist defeated the feature's own purpose), DD-CMV-008 (a cache-invalidation signal missing for one specific async-completion path — the initial, non-re-analyze gap-detection run), and DD-CMV-010 (a cross-field interaction — a Core-10 field correction not propagating to a separate derived value) share a common shape: none are things a mocked unit test can structurally observe, because each requires either a product-judgment call about scope (DD-CMV-007) or a real, unmocked React-Query-cache-across-navigation / cross-signal-propagation behavior (DD-CMV-008, DD-CMV-010) that a Jest mock of `useAssessment`/`useGapFields`/Prisma cannot represent. This project's only integration/e2e suite (`packages/api/test/auth-throttler.e2e-spec.ts`) is itself broken and unrelated (already an accepted gap in `test-report.md` §5), so there is currently no automated layer above unit tests that could have caught any of this.
  - Evidence: `execution.md`'s "T-003 (re-opened)"/"T-005 (re-opened)" entries for DD-CMV-007/008/010; `validation-report.md` §14; `test-report.md` §5.
  - Standardization: added a line to `docs/specs/general-setup/design.md` §7 Design Review Checklist naming cross-screen cache invalidation and cross-field interaction as defect classes requiring an explicit manual-QA step, not just mocked unit tests. **Status: Applied 2026-08-19 (user-approved, "Apply all").**

- **KZ-009 — No named AKILI-SPECS workflow exists for "a real bug found after archive-readiness but before archiving."** (Methodology, Medium)
  - Root cause: `/akili-validate` defines archive-readiness and `/akili-archive` defines the archive move, but neither names what to do when a user's own manual testing (which `/akili-validate`'s own WARN-1 recommendation directly motivated here) finds a genuine gap in the window between the two. The pattern that worked in practice — amend `requirements.md`/`design.md` first (with full rationale, dated, DD-numbered), re-run the same Implementer → Reviewer gate used throughout execution, then addend `test-report.md`/`validation-report.md` rather than rewriting them — is not documented anywhere as a recognized flow; it was improvised consistently across 4 separate incidents in this one spec.
  - Evidence: `execution.md`'s 4 "(re-opened)" task entries; `validation-report.md` §13–14 addenda; `test-report.md` §10–11 addenda.
  - Standardization proposal: no local edit — recommend upstreaming to the AKILI methodology repository: a named "post-validation amendment" mode for `/akili-validate` or `/akili-archive`, formalizing the amend → re-review → addend pattern this spec used 4 times successfully.
  - Status: **Deferred (upstream candidate)** — recorded for methodology maintainers; the pattern is fully documented in this spec's own `execution.md` as a worked example.

- **KZ-010 — Root `CLAUDE.md`'s documented seed-script command is broken.** (Product, Low)
  - Root cause: `npx --prefix packages/api tsx prisma/seed.ts` fails with `ERR_MODULE_NOT_FOUND` — `--prefix` only selects which package's `tsx` binary npx resolves, it does not change the working directory the `prisma/seed.ts` path argument is resolved against (still the repo root, where no such path exists). Verified by direct reproduction (not assumed) during this spec's archive cycle.
  - Evidence: reproduced via direct command execution in this archive cycle; originally surfaced during T-004 (`execution.md`'s T-004 entry).
  - Standardization: corrected to `cd packages/api && npx tsx prisma/seed.ts` in root `CLAUDE.md`'s Local Development Setup section, with a note explaining why the `--prefix` form fails. **Status: Applied 2026-08-19.**

### 2026-08-06 — enhancements/tracking-analytics

**Metrics**

| Signal | Value | Source |
|---|---|---|
| Tasks executed | 4 | tasks.md |
| Reviewer FAIL rework attempts | 0 (all 4 tasks PASS on attempt 1) | execution.md |
| HALTs / FATAL_FAILs | 0 | execution.md |
| Pivots | 0 | execution.md |
| PRODUCT_BUGs | 0 | test-report.md |
| Judgment-day severe findings | 3 confirmed SEVERE (both judges) + 1 corroborated (C1–C4), pre-implementation; round-2 re-judgment surfaced 4 sub-severe (N1–N4) | judgment.md |
| Validation FAIL / WARN | 0 FAIL / 12 WARN (all resolved before archive) | validation-report.md |

**Lessons**

- **KZ-005 — The repo's documented test-verification command is broken.** (Product, Medium)
  - Root cause: `pnpm --filter <pkg> test -- --testPathPattern=<pattern>` (double `--`) forwards a literal `--` into Jest's arg parser, which then reads the pattern as a positional argument instead of a flag. On `web` (which has `--passWithNoTests`) this silently reports "No tests found, exiting with code 0" — a false green. On `api` (no `--passWithNoTests`) it hard-fails with "0 matches". Reproduced independently 4 times within this one spec (3 execute-time Reviewers on `web`, 1 validate-time auditor), plus reproduced again on `api` during this archive's Kaizen investigation.
  - Evidence: `execution.md` — T-001/T-002/T-004 ADVISORY notes; `validation-report.md` §5 W8.
  - Standardization: dropped the extra `--` in root `CLAUDE.md` (2 examples) and both `packages/api/CLAUDE.md` / `packages/web/CLAUDE.md` (1 line each). **Status: Applied 2026-08-06 (user-approved, "Apply all").**

- **KZ-006 — Judgment Day round-2 fixes routed only to `tasks.md` let `design.md` drift from the shipped code.** (Methodology, Medium)
  - Root cause: round-2 re-judgment findings N1–N4 were fixed with the instruction "fix in `tasks.md`" (per `judgment.md`'s own record), with no parallel instruction to backport the same correction into `design.md` when the finding concerns a design decision rather than a pure task/execution detail. The code correctly followed `tasks.md`, but `design.md` was left asserting three things the shipped code contradicts (a UA-era field name, a rejected deploy-script analogy, a nonexistent snippet parameter) — undiscovered until `/akili-validate` had to spend a full pass rediscovering and re-fixing all three.
  - Evidence: `judgment.md` (Round 2 — "Fix in tasks.md" for N1/N2); `validation-report.md` §8.2 (W1–W3).
  - Standardization proposal: no local edit — the root cause is in the `judgment-day` skill's round-2 fix-round guidance (project-agnostic). Recommend upstreaming: when an N-series (or any re-judgment) finding concerns a design decision, the fix instruction should name `design.md` as a required backport target alongside `tasks.md`, not `tasks.md` alone.
  - Status: **Deferred (upstream candidate)** — recorded for methodology maintainers; no in-repo action beyond this spec's own one-time correction (already applied via `/akili-validate`).

- **KZ-007 — A fix for a "vacuous verification" finding is not automatically immune to the same defect.** (Methodology, Medium)
  - Root cause: Judgment Day C1 found that this spec's original build-check couldn't catch a missing Suspense boundary because the unconfigured build never exercised the code path. The fix added a *new* build-check command specifically to close that gap. That new command later turned out to have its own, different vacuity: `/akili-validate` found it (and a sibling "unconfigured" check) silently picked up a developer's local `.env.local`, producing a *configured* bundle under a check documented as unconfigured evidence (W9) — the identical defect class recurring one level removed, inside the very fix meant to close the first instance.
  - Evidence: `judgment.md` C1; `validation-report.md` §5 W9.
  - Standardization proposal: no local edit — recommend upstreaming to `judgment-day`/`akili-validate`: any verification command introduced as the remedy for a "does this check actually exercise the defect" finding should itself be re-examined against that same question before the finding is recorded as closed, not assumed safe because it was written in response to critique.
  - Status: **Deferred (upstream candidate)** — recorded for methodology maintainers; this spec's own instance was fixed directly (`/akili-validate` W9 remediation).

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
