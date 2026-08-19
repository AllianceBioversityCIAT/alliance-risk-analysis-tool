# Execution Log — Country / Business-Plan Mismatch Validation

## 1. Document Control

| Field | Value |
|-------|-------|
| **Module** | `docs/specs/changes/country-document-match-validation` |
| **Requirements** | `requirements.md` |
| **Design** | `design.md` |
| **Tasks** | `tasks.md` |
| **Started** | 2026-08-18 |

## 2. Task Execution History

### Task T-002 — Prisma migration: `Assessment.detectedCountry` column `[BE]`

- **Final Status:** PASS (attempt 1)
- **Date:** 2026-08-18
- **Implementer attempts:** 1

**Attempt 1:**
- **Files changed:** `packages/api/prisma/schema.prisma` (+1 line), `packages/api/prisma/migrations/20260818211740_add_assessment_detected_country/migration.sql` (new)
- **Implementer verification:** `pnpm --filter @alliance-risk/api build` → exit 0; `prisma migrate dev` applied cleanly ("Your database is now in sync with your schema")
- **Reviewer verdict:** `STATUS: PASS` — schema line byte-identical to design.md §4, migration is a single additive `ADD COLUMN` with no `NOT NULL`/`DEFAULT`, BR-CMV-002 independently verified (`git diff -- packages/api/src/domain/assessments/` empty, DRAFT-only guard unmodified, zero `detectedCountry` references in that directory)

**ADVISORY (4R lens, non-blocking, from T-002's Reviewer):**
- A-1 (Scope accuracy): flagged that T-001's declared scope understated itself by 2 files once `detectedCountry` was made a required field — see T-001 entry below, already handled as an approved scope amendment before this was raised.
- A-2 (Risk, favorable): migration confirmed metadata-only on PostgreSQL 11+ (nullable, no `DEFAULT`) — safe against a populated table, no `ACCESS EXCLUSIVE` hold risk.
- A-3 (Reliability, forward-looking): schema provides no enum-level backstop for `detectedCountry` — flagged for T-003's Reviewer to treat "no value outside `SUPPORTED_COUNTRY_LABELS` ever reaches the column" as a must-verify assertion at the handler layer.

**Requirements covered:** BR-CMV-002 (verified untouched)
**Design refs:** design.md §4
**Decisions made:** none beyond the spec — implemented exactly as designed.
**Issues encountered:** none for this task in isolation (see T-001 for the cross-task ripple).
**Final verification result:** PASS.

---

### Task T-001 — Add `detectedCountry` to the shared `AssessmentDetail` type `[SHARED]`

- **Final Status:** PASS (attempt 2)
- **Date:** 2026-08-18
- **Implementer attempts:** 2

**Attempt 1:**
- **Files changed:** `packages/shared/src/types/assessment.types.ts` (+1 line)
- **Scope amendment (Leader-approved, mid-attempt, before Reviewer spawn):** adding `detectedCountry` as a **required** (non-optional) field broke `pnpm --filter @alliance-risk/api build` in two unrelated files that manually construct `AssessmentDetail`-shaped object literals for the Report feature — `packages/api/src/domain/report/report.service.ts` and `packages/api/src/platform/jobs/handlers/report-generation.handler.ts`. User was asked (AskUserQuestion) whether to (a) add the field to those 2 files, or (b) make the shared field optional instead. **User chose (a).** Implementer added `detectedCountry: assessment.detectedCountry,` to both literals.
- **Implementer verification:** `pnpm --filter @alliance-risk/shared build && pnpm --filter @alliance-risk/shared typecheck` → exit 0; `pnpm --filter @alliance-risk/api build` → exit 0 (previously failed with 2 TS2741 errors on these exact files; now clean)
- **Reviewer verdict:** `STATUS: FAIL`
  - **ISSUE 1 — Pre-existing API test suite broken by the type change (missed ripple site).** A third file, `packages/api/src/domain/report/pdf.service.spec.ts:20-35`, constructs the same `AssessmentDetail`-shaped literal and was missed — `pnpm --filter @alliance-risk/api build` structurally cannot catch it because `tsconfig.build.json` excludes `**/*spec.ts`. Reproduced independently by the Reviewer (`pnpm --filter @alliance-risk/api test --testPathPattern=pdf.service` → exit 1; `npx tsc -p packages/api/tsconfig.json --noEmit` → same TS2741). Remediation: add `detectedCountry: null,` to the fixture (matches the file's pre-`detectedCountry` era, `null` is the correct default per design.md §4).
  - **ADVISORY:** (1) verification-command gap is Kaizen-worthy — build-only verification has a permanent blind spot over spec files for required-field changes to widely-consumed shared types; recommend `tasks.md` §5's project-default verification list add a typecheck-inclusive command for shared-type tasks. (2) T-001 is no longer independently mergeable from T-002 as `tasks.md` §3 originally declared ("zero file overlap," dependencies "None") — the ripple fix's `assessment.detectedCountry` reads only type-check because T-002's Prisma client (regenerated from the now-uncommitted schema change) is present in the working tree; recommend committing T-001+T-002 together. (3) two pre-existing, unrelated failures noted so they aren't misattributed later: a `packages/web` test flake (`prompt-editor-form.test.tsx`, ordering-dependent, passes in isolation) and two stale `TS2307` import-path errors in `packages/api/test/auth-throttler.e2e-spec.ts` predating the `platform/auth/` restructure — neither touched by this diff.

**Attempt 2:**
- **Files changed:** `packages/api/src/domain/report/pdf.service.spec.ts` (+1 line — `detectedCountry: null,`, matching the file's pre-`detectedCountry`-era fixture and design.md §4's documented null default)
- **Implementer verification:**
  - `pnpm --filter @alliance-risk/api test --testPathPattern=pdf.service` → `Test Suites: 1 passed, 1 total`, `Tests: 29 passed, 29 total`
  - `pnpm --filter @alliance-risk/api exec -- tsc -p tsconfig.json --noEmit` (real workspace TS, covers spec files — the exact blind spot from attempt 1) → only 2 pre-existing, unrelated `TS2307` errors in `test/auth-throttler.e2e-spec.ts` (confirmed identical on a `git stash`-clean tree)
  - `pnpm --filter @alliance-risk/api build` → exit 0; `pnpm --filter @alliance-risk/shared build && pnpm --filter @alliance-risk/shared typecheck` → exit 0
  - Repo-wide grep sweep for other `AssessmentDetail`-shaped literals — none found beyond the 3 already fixed
- **Reviewer verdict:** `STATUS: PASS` (independent, fresh-context Reviewer, re-ran every command itself rather than trusting the report). Notably verified the "no other broken site" claim by a **compiler-exhaustive method** (stashed only the source fix, kept the shared `dist/` with the required field, and let `tsc` enumerate every site that fails — exactly 3, matching what was fixed) rather than relying on grep. Confirmed the 2 remaining `TS2307` errors are genuinely pre-existing (`test/auth-throttler.e2e-spec.ts` imports a stale `src/auth/...` path predating the `platform/auth/` restructure) and that `packages/web`'s 113 pre-existing type errors are byte-identical before/after (unrelated jest-dom matcher typings, not `detectedCountry`). Full API suite: 369 tests passed, 0 failures.
  - **ADVISORY:** (1) cross-task type dependency — `report.service.ts`/`report-generation.handler.ts` only compile because T-002's schema change is present in the same working tree; `tasks.md`'s "zero file overlap, safe to parallelize" claim holds at the file level but not the type level — **recommend landing T-001+T-002 in the same commit** (done, see below). (2) the root-cause blind spot (`tsconfig.build.json` excluding `**/*spec.ts`) is still latent — recommend adding a dedicated `typecheck` script to `packages/api` mirroring `packages/shared`'s, wired into CI, as a project-level follow-up (out of this spec's scope). (3) `auth-throttler.e2e-spec.ts`'s dead imports are a pre-existing, unrelated bug worth its own ticket. (4) the PDF fixture only covers `detectedCountry: null` — the populated-value path is deferred to T-005, appropriately (this was a type-only task).

**Requirements covered:** FR-CMV-001, BR-CMV-001
**Design refs:** design.md §4
**Decisions made:** scope amendment (widen T-001 to cover 3 ripple-fix files: `report.service.ts`, `report-generation.handler.ts`, `pdf.service.spec.ts`) — the first two user-approved via AskUserQuestion before attempt 1's Reviewer spawn; the third was a Reviewer-caught gap in the same amendment (not a new decision point, same approved direction).
**Issues encountered:** verification blind spot (build command doesn't type-check spec files) caused a 1-attempt rework cycle; corrected in attempt 2 and flagged as a project-level Kaizen candidate (see ADVISORY (2) above).
**Final verification result:** PASS — `pnpm --filter @alliance-risk/shared build && pnpm --filter @alliance-risk/shared typecheck`, `pnpm --filter @alliance-risk/api build`, `pnpm --filter @alliance-risk/api test --testPathPattern=pdf.service`, and a full-repo `tsc --noEmit` sweep all clean.

---

### Task T-003 — Gap-detection handler: detect, gate, and persist `detectedCountry` `[BE]`

- **Final Status:** PASS (attempt 1)
- **Date:** 2026-08-18
- **Implementer attempts:** 1
- **Effort:** high (correctness-critical, per Leader assignment — this is the task Judgment Day's data-loss finding (JD-01/JD-02) applies to most directly)

**Attempt 1:**
- **Files changed:** `packages/api/src/platform/jobs/handlers/gap-detection.handler.ts` (+~53 lines: `GapDetectionAIResponse` extended with `detectedCountry`/`detectedCountryConfidence`; `execute()` gains the `let detectedCountry: string | null = null` initializer and folds the value into the single existing `assessment.update()` call; `processUploadMode()`'s return type extended; new private `normalizeDetectedCountry()` helper gating on `isSupportedCountry()` + confidence ≥0.7 with a debug log on rejection), `gap-detection.handler.spec.ts` (+~176 lines: extended `mockPrisma`, 10 new tests)
- **Implementer verification:**
  - `pnpm --filter @alliance-risk/api test --testPathPattern=gap-detection.handler` → 11/11 passed
  - `pnpm --filter @alliance-risk/api build` → exit 0
  - `pnpm --filter @alliance-risk/api exec -- tsc -p tsconfig.json --noEmit` → only the 2 pre-existing, unrelated `TS2307` errors (confirmed via `git stash`)
- **Reviewer verdict:** `STATUS: PASS` — independently re-ran all verification (11/11 handler tests, 4/4 `gap-field.controller` tests as the NFR-CMV-012 smoke check, full API suite 379 tests/0 failures, build, lint, full-repo typecheck) and additionally ran **mutation testing** against the diff: reverting `>= 0.7`, removing the `isSupportedCountry()` guard, and — critically — re-introducing the exact JD-01 defect shape (moving the write back inside `processUploadMode()`'s try block) all correctly broke tests, confirming the new tests are load-bearing rather than decorative. Confirmed by direct inspection: exactly one `prisma.assessment.update` call in the whole file, `createSkeletonFields()` untouched, Core-10 field-parsing logic untouched.
  - **ADVISORY:** (A1, Risk/medium) the `let detectedCountry: string | null = null` initializer is correct but not test-guarded — widening it to allow `undefined` would still pass every current test, because all 10 new tests exercise `intakeMode: 'UPLOAD'` only; FR-CMV-001 Scenario 3 (non-UPLOAD path) has no dedicated test. Recorded as a coverage gap, not a violation — no task in `tasks.md`/`design.md` named this specific test, so it doesn't gate T-003. (A2, Reliability/low) the re-analyze *success* path (as opposed to re-analyze-failure, which is tested) is untested and `$transaction` remains unmocked — explicitly sanctioned by `tasks.md`'s own conditional wording ("only add `$transaction` mock if a re-analyze-success test is added"). (A3, informational) `logger.debug` will fire on every real UPLOAD run until T-004 lands the prompt update — expected, not a defect.

**Requirements covered:** FR-CMV-001 (all 3 scenarios), FR-CMV-006 Sc1 (backend half), NFR-CMV-010, NFR-CMV-011, BR-CMV-001, BR-CMV-003
**Design refs:** design.md §6.1, §6.2, §10, §11, §12 (DD-CMV-003, DD-CMV-006)
**Decisions made:** none beyond the spec — implemented exactly as designed; the Implementer's `normalizeDetectedCountry()` helper is an internal refactor detail (extracting the normalization logic named inline in design.md §6.2 into its own private method) and doesn't deviate from the design's intent.
**Issues encountered:** none — PASS on attempt 1.
**Final verification result:** PASS. Per Leader's own judgment (not a task requirement), advisory A1's gap is real but low-risk given PASS-on-attempt-1 status and the Reviewer's mutation-testing confirmation of the actually-critical path (JD-01 reversion); not escalated to a new task per the "Advisory Never Becomes A Task" rule.
