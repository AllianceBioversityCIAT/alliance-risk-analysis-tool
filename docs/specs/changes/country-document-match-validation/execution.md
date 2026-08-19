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

---

### Task T-004 — Update the `gap_detector` prompt: local seed + production copy-paste text `[BE]`

- **Final Status:** PASS (attempt 1)
- **Date:** 2026-08-18
- **Implementer attempts:** 1

**Attempt 1:**
- **Files changed:** `packages/api/prisma/seed.ts` (+8 lines — the "## Country Detection" block + reordered Output Format schema, placed exactly per design.md §6.3), new file `docs/specs/changes/country-document-match-validation/prod-prompt-update.md` (production manual-update artifact per design.md §6.4)
- **Implementer verification:**
  - `npx tsx prisma/seed.ts` (run from `packages/api/`, not via `--prefix` from root — `--prefix` only affects module resolution, not cwd, so the documented root-level form needed a `cd` first; noted for future reference) → `Updated gap_detector prompt: Gap Detector - Default`
  - **A real, live Bedrock call** (not mocked) using the now-updated prompt: `{{country}}` deliberately injected as `"Kenya"`, fake business-plan text describing Zambia operations → raw response `"detectedCountry": "Zambia", "detectedCountryConfidence": 0.95, "fields": [...]` — confirms the anti-anchoring instruction actually works (the model ignored the injected Kenya context and matched the real document text), and confirms both new keys appear before `fields` in raw response order
  - `pnpm --filter @alliance-risk/api build` → exit 0
  - One-off verification script deleted after use, confirmed via `git status`
- **Reviewer verdict:** `STATUS: PASS` — independently verified byte-for-byte that the prompt text matches design.md §6.3 exactly (programmatic string comparison, not eyeballing), confirmed the schema matches `normalizeDetectedCountry()`'s actual parsing expectations (`SUPPORTED_COUNTRY_LABELS` enumeration + `>= 0.7` gate), confirmed `prod-prompt-update.md`'s every factual claim against its cited sources (handler lookup query, seed lookup query, `/admin/prompt-manager` route, `PUT /admin/prompts/:id/update` endpoint and its `PromptVersion` snapshot behavior), and confirmed scope via `git status --porcelain -uall` (exactly 2 entries, no stray files).
  - **ADVISORY:** (1) noted that `tasks.md` still showed T-004 as `[ ]` at review time — expected, this is the Leader's post-PASS update, done below. (2) `design.md` §6.4 and `prod-prompt-update.md` now duplicate the prompt text in two places — recommend a one-line pointer from §6.4 to the doc for future discoverability; not acted on now (documentation-polish, non-blocking). (3) minor paste-hygiene note for the Admin doc, already adequately worded.

**Requirements covered:** FR-CMV-001 (prompt-side instruction), BR-CMV-003
**Design refs:** design.md §6.3, §6.4, §12 DD-CMV-005
**Decisions made:** none beyond the spec.
**Issues encountered:** none — PASS on attempt 1. One minor operational note (the `--prefix` vs `cd` command-form correction) worth folding into `CLAUDE.md`'s documented command at archive time, not urgent enough to block this task.
**Final verification result:** PASS — real end-to-end Bedrock verification (not just unit-test mocks) is the strongest possible evidence for this task, since it's the only way to prove the anti-anchoring mitigation actually holds against a live model call.

---

### Task T-005 — Gap detector UI: mismatch dialog, hint banner, and cache invalidation `[FE]`

- **Final Status:** PASS (attempt 1)
- **Date:** 2026-08-18
- **Implementer attempts:** 1
- **Effort:** high (largest and most detail-sensitive task in the spec — 3 Judgment Day rounds' worth of specific fixes to reproduce exactly)

**Attempt 1:**
- **Files changed:** `packages/web/src/app/(protected)/assessments/gap-detector/gap-detector-client.tsx` (+123/-4 lines), new `packages/web/src/app/(protected)/assessments/gap-detector/__tests__/gap-detector-client.test.tsx` (325 lines, 10 tests)
- **Scope:** `countryMismatch` derivation placed immediately after `useAssessment(id)` (avoiding the JD-17 TDZ hazard); `handleAnalyzeRisks` renamed to `proceedToRiskAnalysis` (body byte-identical); new `handleAnalyzeRisksClick` wrapper wired only to the Button's `onClick`; confirmation `Dialog` using `CountryBadge`; hint banner with both countries and both remediation paths, auto-clearing, stacked above the validation banner; `queryClient.invalidateQueries({ queryKey: ['assessment', id] })` added to the job-completion effect (the round-3 Judgment Day fix for FR-CMV-006).
- **Implementer verification:**
  - `pnpm --filter @alliance-risk/web test --testPathPattern=gap-detector-client` → 10/10 passed
  - `pnpm --filter @alliance-risk/web build` → succeeded, static export
  - `pnpm --filter @alliance-risk/web lint` → clean
  - Full web suite → 131/133 passed; the 2 failures independently confirmed as a pre-existing, unrelated test-isolation flake — **correction (post-`/akili-validate`, WARN-3):** this is cross-suite DOM pollution from a missing Testing-Library cleanup, whose *victim test* varies by scheduling (it manifested as `user-management.test.tsx` failures in this run, and as `assessment-table.test.tsx` failures in `/akili-validate`'s independent worktree run at the pre-spec commit). Confirmed pre-existing either way: reproduces identically with this task's files excluded from the run, and each named suite passes fully in isolation.
- **Reviewer verdict:** `STATUS: PASS` — independently confirmed, byte-for-byte where it mattered most: (1) no TDZ hazard exists (every `countryMismatch` reference sits strictly below its declaration by line number); (2) `proceedToRiskAnalysis`'s body is byte-identical to the original `handleAnalyzeRisks` (diffed directly, zero differences beyond the rename); (3) `allMandatoryComplete`'s computation, the Button's `disabled` expression, and the Tooltip's gating condition are all byte-identical to pre-diff — the only change in that region is the `onClick` handler swap; (4) hint/dialog copy matches design.md §7 exactly, with neither of the two previously-caught copy defects (misleading "proceeds as soon as you click again" line, or a hint missing a remediation path) reintroduced; (5) the cache-invalidation fix from Judgment Day round 3 is present and tested in both directions. Also judged the Implementer's two disclosed judgment calls (a `data-testid` addition for test scoping; resolving an ambiguity about exactly which proposal.md sentence design.md's copy correction replaces) as reasonable, in-scope, and correctly disclosed — not defects.
  - **ADVISORY (4R, non-blocking):** (1) Resilience — dismissing the dialog via Escape/overlay-click/X doesn't set `showCountryMismatchHint`, unlike the Cancel button; conformant to design.md's literal Cancel-triggered wording, but worth unifying if the spec is revisited. (2) Readability — the dialog's non-blocking line slightly duplicates the hint's closing sentence; design-mandated text, no change required. (3) Accessibility — the dialog's second paragraph sits outside `DialogDescription`, so it won't be announced via `aria-describedby`; cheap future improvement, not spec-required. (4) Reliability — `proceedToRiskAnalysis()` is called without `await`/`.catch()`, identical to pre-diff behavior, not a regression.

**Requirements covered:** FR-CMV-002 (both scenarios), FR-CMV-003, FR-CMV-004 (both scenarios), FR-CMV-005, FR-CMV-006 Sc1 (frontend half), BR-CMV-001
**Design refs:** design.md §7, §10 (last row), §11, §12 DD-CMV-004
**Decisions made:** the two Implementer judgment calls above, both accepted by the Reviewer as reasonable and correctly disclosed.
**Issues encountered:** none blocking — PASS on attempt 1; a pre-existing, unrelated flaky test suite was identified and ruled out as related to this change.
**Final verification result:** PASS.

---

## 3. Manual QA (added post-`/akili-validate`, closes WARN-1)

**T-003's manual persistence check — performed, real, evidence below.** T-004 already proved via a real Bedrock call that the model returns the correct `detectedCountry`/`detectedCountryConfidence` JSON shape; what remained unproven was the *persistence* half — a real handler run, real Prisma, real DB row. Performed as a one-off verification (not committed — script deleted after use):

- Created a real `Assessment` (`country: 'Kenya'`, `intakeMode: 'UPLOAD'`) and a real completed `PARSE_DOCUMENT` job whose extracted text described a business operating in **Zambia** — the country deliberately set to the *wrong* value (Kenya) to also re-confirm the anti-anchoring mitigation.
- Ran the real `GapDetectionHandler.execute()` via `NestFactory.createApplicationContext(AppModule)` (the same DI pattern `worker.ts` uses in production) — no mocks, real `PrismaService`, real `BedrockService`.
- Observed, querying the real row back out: `Assessment.detectedCountry: "Zambia"`, `status: ACTION_REQUIRED`, `progress: 50`.
- Cleaned up all test rows (`GapField`, `Job`, `Assessment`) afterward — confirmed zero residue via a follow-up query. No stray files left in the repo.

**T-005's manual browser walkthrough — not performed, honestly downgraded rather than fabricated.** This session had no interactive browser-automation tool engaged (no Playwright/Chrome-extension session active) to actually click through the gap-detector screen end-to-end. Rather than claim a walkthrough that didn't happen, this clause is explicitly downgraded: the substitute evidence is (a) 15 automated frontend tests (`gap-detector-client.test.tsx`) covering every interactive state — dialog visibility across all 4 mismatch conditions, both button paths, the reappear-on-reclick behavior, the hint's both remediation paths, its dismiss button, its auto-clear, the happy-path no-mismatch case, and both dismiss-path variants (Cancel vs. the dialog's built-in Close control) — and (b) an independent Reviewer during `/akili-execute` T-005 that diffed the changed region byte-for-byte against the pre-spec file to confirm `allMandatoryComplete`, the Button's `disabled` expression, and the Tooltip gate are all untouched. If a real browser walkthrough is wanted before this ships to users, it should be performed by the user directly (`pnpm dev`, navigate to an assessment with a deliberately mismatched country) rather than claimed here without having been done.

## 3b. Post-Archive-Readiness Behavior Change: Widen `detectedCountry` Beyond The 4-Country Allowlist

**Discovered:** 2026-08-19, during the user's own manual browser walkthrough (the T-005 "Done when" clause explicitly deferred in §3 above — this is exactly why that clause mattered).

**What happened:** the user created an assessment selecting Nigeria, uploaded a real business plan describing a company operating in Malawi, and observed no dialog/hint at all. The server log showed:
```
DEBUG [GapDetectionHandler] detectedCountry rejected: value="Malawi" confidence=0.95
```
The model correctly detected Malawi at high confidence; the handler correctly discarded it per the *original* design, because `normalizeDetectedCountry()` required `isSupportedCountry(detectedCountry)` — Malawi isn't one of the 4 supported countries, so it was treated identically to a genuinely unclear detection. This is not a bug — every task and Reviewer verified the shipped code matched the design exactly — but the design itself was wrong: restricting the mismatch check to only fire between two *supported* countries defeats its own purpose. A business plan describing a country the platform doesn't even support is arguably the strongest mismatch signal this feature could ever see, and it was the one case being silently swallowed.

**Decision (user-confirmed via `AskUserQuestion`):** widen `detectedCountry`/the mismatch check to accept any confidently-detected country, not just the 4 supported ones. Display fallback for an unsupported country: plain name, no flag (confirmed `CountryBadge` already degrades this way with zero code change, since `getCountryFlag()` already returns `''` for unrecognized values).

**Spec documents amended before re-implementation** (this is the correct order — design changes first, then code, per AKILI-SPECS discipline, even though the spec was already at "archive-ready"):
- `requirements.md`: BR-CMV-001 revised (mismatch is no longer restricted to the 4-country allowlist); new BR-CMV-004 (graceful display fallback); FR-CMV-001 gains Scenario 1b; FR-CMV-002 gains Scenario 1b; glossary and dependencies section updated.
- `design.md`: §4 (type widened to `string | null`), §6.2 (normalization no longer gates on `isSupportedCountry()`, only on non-empty/length-bounded/confidence), §6.3 (prompt instruction rewritten to ask for any real country name, not an enum of 4), §7 (frontend `countryMismatch` derivation simplified — `isSupportedCountry` check removed — plus a note confirming `CountryBadge`'s existing empty-flag fallback satisfies BR-CMV-004 with no code change), §10/§11 (error table and test list updated), §12 (new DD-CMV-007 recording this decision and its rationale).
- **Correction-closure sweep — first pass incomplete, caught and fixed by the re-implementation's own frontend Reviewer:** the initial sweep missed `requirements.md`'s glossary row for `detectedCountry` (line 35), which still asserted the persisted column "only ever holds a supported-country value or `null`" and referenced an "allowlist gate" — directly contradicting the revised BR-CMV-001. Corrected after the Reviewer flagged it (see T-005-reopen entry below); a second sweep confirmed no other stale references remain in `requirements.md`.

### T-003 (re-opened) — Backend: widen `normalizeDetectedCountry()` and the `gap_detector` prompt

- **Status:** PASS (attempt 1)
- **Scope:** removed the `isSupportedCountry()` gate from `gap-detection.handler.ts`'s `normalizeDetectedCountry()`, replacing it with trim + non-empty + ≤100 chars + not-`"unclear"` (case-insensitive) + confidence ≥0.7; rewrote the `gap_detector` prompt's "## Country Detection" instruction and "## Output Format" example in `seed.ts` to ask for any real country name rather than an enum of 4; re-ran the local seed; updated `prod-prompt-update.md` to match; replaced the now-wrong "hallucinated string → null" test with one proving `"Malawi"` at confidence 0.95 is persisted, plus new boundary tests (empty-after-trim, oversized, case-insensitive `"unclear"`).
- **Implementer verification:** `gap-detection.handler` suite 19/19 → 20/20 after a Leader-added boundary test (see below); `api build` clean; full-repo `tsc --noEmit` shows only the 2 pre-existing unrelated errors.
- **Reviewer verdict:** PASS. Independently byte-compared `seed.ts`'s new prompt text against `design.md` §6.3 (exact match after template-literal evaluation); confirmed `prod-prompt-update.md` updated to match; confirmed DD-CMV-006's single fold-in write is untouched; confirmed the `isSupportedCountry` import is genuinely removed (unused elsewhere in the file).
  - **ADVISORY, closed:** (A-1) recommended a live Bedrock re-verification against the revised (no-longer-enum) prompt text, since the original T-004 live check tested the old prompt — **performed**, see below. (A-3) recommended a test at exactly the 100-char boundary (only 101/rejected was tested) — **added** by the Leader directly (`accepts a detectedCountry at exactly the 100-character length boundary (inclusive)`), suite now 20/20.
- **Post-Reviewer live Bedrock re-verification (closes A-1):** a real `BedrockService.invokeModel()` call (no mocks) against the live-active, newly-seeded prompt, run twice: (1) `{{country}}` injected as `"Nigeria"` against a fake business plan describing Malawi (the new, previously-out-of-scope case) → `detectedCountry: "Malawi"`, confidence `0.95`, clean single-word value, anti-anchoring held; (2) `{{country}}` injected as `"Zambia"` against a fake business plan describing Kenya (the original in-scope case, regression check) → `detectedCountry: "Kenya"`, confidence `0.95`, and the model's own `reasoning` field explicitly stated it was rejecting the injected Zambia context in favor of Kenya. Both confirm the widened prompt still resists anchoring and returns clean, parseable values. One-off verification script deleted after use.

### T-005 (re-opened, 2nd time) — Frontend: DD-CMV-008, invalidate `['assessment', id]` on the *initial* gap-detection completion too

- **Status:** PASS (attempt 1)
- **Found:** immediately after DD-CMV-007 landed, by the user re-testing end-to-end on a fresh assessment (first document upload, not a re-analysis) — server logs and the DB confirmed `Assessment.detectedCountry` was correctly persisted, but the dialog never appeared.
- **Root cause:** the DD-CMV-006-round cache-invalidation fix only fires inside the `jobStatus === JobStatus.COMPLETED` effect, and `jobStatus` comes from `useJobPolling()`, which the frontend only starts for the **re-analyze** flow. The very first, automatic `GAP_DETECTION` job (server-chained after `PARSE_DOCUMENT`, no frontend `startPolling()` call) is invisible to that signal — the frontend instead discovers it via `useGapFields()`'s own poll-until-`total>0` loop, which never touched the `assessment` cache.
- **Scope:** added a second, independent `useEffect` watching `gapData.total`'s 0→positive transition (via a `useRef`), invalidating `['assessment', id]` exactly once on that transition — per `requirements.md` FR-CMV-006 Scenario 2 (new) and `design.md` §7/§12 DD-CMV-008 (both amended before this fix, same discipline as DD-CMV-007).
- **Implementer verification:** suite 17/17 (15 pre-existing + 2 new); `web build`/`lint` clean. One disclosed judgment call: changed the shared test fixture's default `gapData.total` from `1` to `0` (more accurate to the real "not yet loaded" state) because the new effect's on-mount check would otherwise fire an unexpected invalidate against one pre-existing test.
- **Reviewer verdict:** PASS. Independently **mutation-tested** the fixture claim rather than trusting it: reverted the fixture to `total: 1` with the fix present → exactly the one test the Implementer named failed, nothing else; removed the fix entirely with the fixture at `total: 0` → all 15 pre-existing tests still passed. Also removed the fix to confirm both new tests correctly go red without it. Confirmed the 2 full-web-suite failures (`assessment-table.test.tsx`) are the same pre-existing, unrelated flake this spec has documented since T-005's original implementation — reproduced identically on a stashed clean tree.
  - **ADVISORY (non-blocking):** (1) the fixture change silently removed the suite's only coverage of the "mount with already-warm cache" invalidate path — recommend a dedicated test for it. (2) the fixture is left in an API-impossible state (`total: 0` with 1 field in `data`) — no test currently depends on that being coherent, but a future one might. (3) the existing `beforeEach` spread-mutates rather than resets from a pristine baseline, pre-existing pattern now slightly aggravated by the 2 new tests mutating `data`. None require action before this spec proceeds; recorded for whoever next touches this test file.

### T-005 (re-opened) — Frontend: simplify `countryMismatch`

- **Status:** PASS (attempt 1)
- **Scope:** removed the `isSupportedCountry(...)` clause from `countryMismatch`'s derivation in `gap-detector-client.tsx`, leaving `!!assessment?.detectedCountry && assessment.detectedCountry !== assessment.country`; removed the now-unused import; flipped the "unsupported string skips the dialog" test to instead prove the dialog **shows** for `detectedCountry: "Malawi"` (FR-CMV-002 Sc1b).
- **Implementer verification:** suite 15/15; `web build` and `lint` clean; confirmed `CountryBadge` needed no change.
- **Reviewer verdict:** PASS. Independently proved via `--word-diff=porcelain` that the *only* changes in the whole file are the import removal and the removed `isSupportedCountry(...)` clause — `allMandatoryComplete`, the Button's `disabled` expression, the Tooltip gate, `proceedToRiskAnalysis`'s body, the dialog/hint copy, and the cache-invalidation line are byte-identical to before this diff. Independently verified `getCountryFlag()`'s `?? ''` fallback (not just trusting design.md's claim) and confirmed the dialog actually renders both countries via `CountryBadge` on the live path.
  - **ADVISORY, closed:** flagged that `requirements.md` line 35's glossary row was missed by the original correction-closure sweep and still contradicted the revised BR-CMV-001 — **corrected** (see the sweep note above).

## 4. Summary — All Tasks Complete

| Task | Status | Attempts | Package |
|---|---|---|---|
| T-001 | PASS | 2 (scope amended, user-approved, to cover a 3-file ripple effect) | `[SHARED]` |
| T-002 | PASS | 1 | `[BE]` |
| T-003 | PASS | 1 (Reviewer used mutation testing to confirm the JD-01 regression is caught) | `[BE]` |
| T-004 | PASS | 1 (verified with a real, live Bedrock call) | `[BE]` |
| T-005 | PASS | 1 | `[FE]` |
| T-003 (re-opened) | PASS | 1 (DD-CMV-007 — widen `detectedCountry` beyond the 4-country allowlist; discovered via the user's own manual test) | `[BE]` |
| T-005 (re-opened) | PASS | 1 (DD-CMV-007, frontend half) | `[FE]` |
| T-005 (re-opened, 2nd time) | PASS | 1 (DD-CMV-008 — initial-detection cache invalidation; found by the user's real re-test) | `[FE]` |

**Total rework attempts across the spec:** 1 (T-001 attempt 1 → FAIL → attempt 2 PASS). No HALTs, no Pivots, no FATAL_FAILs. (The DD-CMV-007 re-opened tasks each PASSed on attempt 1 — not counted as "rework" in the FAIL/retry sense, since they implement a deliberate, user-approved design revision rather than fixing a defect in the original implementation.)

**Scope note:** T-001's scope was amended mid-execution (Leader-flagged, user-approved via `AskUserQuestion`) to include 3 files outside its original single-file declaration, once it became clear that `detectedCountry` being a required field on a widely-consumed shared type broke 3 pre-existing files. This is documented in T-001's entry above and does not represent uncontrolled scope creep — it was surfaced, a choice was offered, and the user decided before any code was written to fix it.

**Cumulative requirement coverage:** every FR/NFR/BR in `requirements.md` was covered by at least one PASSed task, matching the scenario-level mapping in `tasks.md` §4.

**Constitution Impact:** none — no new module/package was created, no module boundary moved, no public surface changed beyond the additive `AssessmentDetail.detectedCountry` field and the additive `Assessment.detectedCountry` column, both already covered by this spec's own documentation. No child `CLAUDE.md`/`AGENTS.md` update needed.

**Outstanding non-blocking items (advisory-level, recorded for `/akili-archive` or future specs, not for this spec's own completion):**
- A minor operational correction: root `CLAUDE.md`'s documented `npx --prefix packages/api tsx prisma/seed.ts` form doesn't `cd` into the package (discovered during T-004; worth a doc fix at archive time).
- `tasks.md`'s "1 review round expected, 2 for the frontend task" budget (design.md §13) held — every task PASSed on attempt 1 except T-001's scope-amendment cycle, and T-005 (the frontend task) PASSed in exactly 1 round despite being sized for 2.
- The manual production prompt update (`docs/specs/changes/country-document-match-validation/prod-prompt-update.md`) is still pending the user's own action in the deployed environment — this is by design (DD-CMV-005), not an incomplete task. **Its text changed under DD-CMV-007 (§3b above) — if any earlier draft of it was ever copy-pasted into a real Prompt Manager environment before 2026-08-19, that environment now has stale text and needs the update reapplied.**
- **DD-CMV-007 (§3b) means `test-report.md` and `validation-report.md` (both written before this behavior change) describe the pre-widening version of the feature.** They are not wrong about what they tested at the time, but they are now stale as a full picture of current behavior — `test-report.md`'s coverage matrix and `validation-report.md`'s requirement-coverage table should be refreshed (or a follow-up `/akili-test` + `/akili-validate` pass run) to reflect BR-CMV-001's revision before this spec is archived, rather than archiving against reports that predate the last code change.

