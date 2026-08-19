# Validation Report — Country / Business-Plan Mismatch Validation

## 1. Document Control

| Field | Value |
|-------|-------|
| **Module** | `docs/specs/changes/country-document-match-validation` |
| **Requirements** | `requirements.md` |
| **Design** | `design.md` |
| **Tasks** | `tasks.md` |
| **Execution** | `execution.md` |
| **Test report** | `test-report.md` |
| **Date** | 2026-08-18 |
| **Auditor model** | opus (independent of the implementing session, which ran on sonnet — author ≠ auditor) |

## 2. Summary

**Verdict: ARCHIVE-READY.** No FAIL, no BLOCKED. 4 non-blocking WARN findings were identified (all documentation/coverage-completeness gaps, not code defects) and **all 4 have since been closed** (post-validation fix pass, user-approved) — see each phase below for what changed and the closure evidence. 7 advisory (4R lens) notes remain, carried forward as optional Kaizen candidates.

| Phase | Verdict |
|---|---|
| 1. Task Completion | PASS (1 WARN) |
| 2. File Existence | PASS (1 WARN) |
| 3. Build Integrity | PASS (1 WARN — doc-accuracy only) |
| 4. Requirement Coverage | PASS (1 WARN) |
| 5. Quality Audit (4R) | Advisory only |
| 6. Design Conformance | PASS |
| 7. Constitution Impact | PASS |

Most significantly for this spec: **every Judgment Day fix (3 adversarial-review rounds during `/akili-specify`) was independently re-verified present in the actually-shipped code**, not just claimed — including the one round-3 SEVERE finding (missing `['assessment', id]` query invalidation) that would have silently broken a Must requirement (FR-CMV-006) if it had regressed during implementation. It did not regress.

## 3. Task Completion

All 5 tasks `[x]` in `tasks.md`; all 6 items in the Task Plan Checklist `[x]`. `execution.md` has a full entry per task with real evidence (exit codes, Reviewer re-runs, mutation testing on T-003, a real live Bedrock call on T-004, byte-for-byte diffs on T-005) — not bare claims.

**WARN-1 — Two "Done when" manual-verification clauses lack recorded evidence.**
- T-003's "Done when" calls for manually triggering gap detection against a real business-plan fixture and observing a populated `Assessment.detectedCountry`. T-004's real Bedrock call proves the *model* returns `detectedCountry`/`detectedCountryConfidence` correctly, but no entry records the *persistence* half (an actual DB row updated end-to-end).
- T-005's "Done when" calls for a manual `pnpm dev` walkthrough of the dialog/hint/auto-clear. No such walkthrough is recorded (unlike the prior `all-countries-filter` spec, which has a manual QA checklist artifact).

*Remediation:* add a short Manual QA section to `execution.md`, or explicitly downgrade these clauses with stated rationale, before archiving.

**CLOSED (post-validation):** `execution.md` §3 now records both. T-003's persistence half was performed for real — a genuine end-to-end run (real `Assessment` row, real completed parse job describing a Zambia-based business while `Assessment.country` was deliberately set to Kenya, real `GapDetectionHandler.execute()` via `NestFactory.createApplicationContext`, real Bedrock call) — observed `Assessment.detectedCountry: "Zambia"` on the real row afterward, then cleaned up with zero residue. T-005's browser walkthrough was honestly downgraded rather than fabricated: no browser-automation tool was engaged this session, so the clause is explicitly noted as not performed, with the 15 automated tests plus the Reviewer's byte-for-byte gating-logic diff recorded as the substitute evidence.

## 4. File Existence

5 spec commits (`8f6d4ce`, `54da92f`, `7227d40`, `1fbc0a3`, `e060544`). `git diff --name-status` against the pre-spec commit returns exactly 11 changed files — every one accounted for by `design.md` §4-§7 plus the 3 user-approved ripple-fix files from T-001's scope amendment. No stray or undocumented file. The migration is a single additive `ALTER TABLE "assessments" ADD COLUMN "detected_country" VARCHAR(100);` — nullable, no default, no backfill.

**WARN-2 — `design.md` was never amended for the T-001 scope amendment.** `report.service.ts`, `report-generation.handler.ts`, `pdf.service.spec.ts` each gained a `detectedCountry` line because the shared field is required — this is recorded in `tasks.md` and `execution.md`, but `design.md` §4 still reads as touching only the shared type file.

*Remediation:* one line in `design.md` §4 naming the 3 downstream `AssessmentDetail`-literal consumers.

**CLOSED (post-validation):** `design.md` §4 now has a "Scope amendment note" naming all 3 files and pointing to the `execution.md`/`tasks.md` entries that recorded the original decision.

## 5. Build Integrity

| Command | Result |
|---|---|
| `pnpm --filter @alliance-risk/shared build && typecheck` | clean, exit 0 |
| `pnpm --filter @alliance-risk/api build` | clean |
| `pnpm --filter @alliance-risk/api exec -- tsc -p tsconfig.json --noEmit` | only the 2 documented pre-existing `TS2307` errors (`test/auth-throttler.e2e-spec.ts`) — nothing else |
| `pnpm --filter @alliance-risk/web build` | success, static export |
| `pnpm --filter @alliance-risk/web lint` / `api lint` | clean |
| `pnpm --filter @alliance-risk/api test` | 384 passed, 2 skipped (pre-existing, env-gated), 0 failed |
| `pnpm --filter @alliance-risk/web test` | 135 passed, 2 failed |

**The 2 web failures are proven pre-existing, not assumed:** the auditor built an isolated git worktree at the commit immediately preceding this spec and reran the full web suite — **identical 2 failures, same suite, same error messages**, 121 passed. Zero new failures introduced by this spec.

**WARN-3 — the pre-existing flake is mis-identified in `execution.md`/`test-report.md`.** Both docs name it as a `user-management.test.tsx` ordering issue. It is actually cross-suite DOM pollution (missing Testing-Library cleanup) whose *victim test* varies by scheduling — it manifested as `assessment-table.test.tsx` failures in the auditor's direct run and `user-management.test.tsx` in the pnpm-orchestrated run. The substance of the claim (pre-existing, unrelated, order-dependent) is correct; only the named file is incomplete.

*Remediation:* reword both docs to "order-dependent RTL-cleanup pollution in the web suite (manifests in `user-management.test.tsx` or `assessment-table.test.tsx` depending on scheduling)".

**CLOSED (post-validation):** `execution.md`'s T-005 entry now names both files and describes the pollution accurately as order-dependent, citing this validation's independent worktree reproduction as the confirming evidence.

## 6. Requirement Coverage

Verified at scenario/clause granularity — every `GIVEN/WHEN/THEN`, every `BUT it must NOT`, every `AND IT MUST` — against the real code and real test bodies, not the spec's description of them.

| Requirement / clause | Task | Mechanism verified in code | Test verified | Verdict |
|---|---|---|---|---|
| FR-CMV-001 Sc1 (persist on confident detection) | T-003 | fold-in `assessment.update` | exact payload asserted | COVERED |
| FR-CMV-001 Sc2 (`"unclear"`/low-confidence → not a mismatch) | T-003 | `isSupportedCountry` rejects, confidence gate | `it.each` 4 cases + debug-log assertion | COVERED |
| FR-CMV-001 Sc2 (BUT must not block Core-10 extraction) | T-003 | normalization is post-parse, never throws | asserts 10 fields still created | COVERED |
| FR-CMV-001 Sc3 (non-UPLOAD unaffected) | T-003 | `processUploadMode` never called; initializer holds | 2 dedicated tests (GUIDED_INTERVIEW, MANUAL_ENTRY) | COVERED |
| FR-CMV-002 Sc1 (dialog before any request) | T-005 | gate on `countryMismatch` | asserts dialog shown AND no POST fired | COVERED |
| FR-CMV-002 Sc1 (AND IT MUST name both, w/ flags) | T-005 | `CountryBadge` ×2 in dialog body | asserts both names inside `role="dialog"` | COVERED |
| FR-CMV-002 Sc1 (AND IT MUST state non-blocking) | T-005 | corrected copy present | asserts non-blocking phrase | COVERED |
| FR-CMV-002 Sc2 (match/null/unsupported skip dialog) | T-005 | `!!` + `isSupportedCountry` + inequality | 3 dedicated tests | COVERED |
| FR-CMV-003 (identical submit + routing) | T-005 | `proceedToRiskAnalysis` byte-identical to original `handleAnalyzeRisks` (diffed directly) | exact URL + route assertion | COVERED |
| FR-CMV-004 Sc1 (zero mutating calls) | T-005 | Cancel only sets local state | no-POST assertion | COVERED |
| FR-CMV-004 Sc1 (BUT must not navigate away) | T-005 | no router call on Cancel | dedicated `router.push`-not-called test | COVERED |
| FR-CMV-004 Sc2 (reappears, never suppressed) | T-005 | no persisted dismissal flag | re-click test | COVERED |
| FR-CMV-005 Sc1 (both countries + both remediation paths) | T-005 | banner copy verbatim from design.md §7 | scoped assertion on hint container | COVERED |
| FR-CMV-005 Sc1 (dismissible) | T-005 | X button wired to `setShowCountryMismatchHint(false)` | **no test clicks it** | **WARN-4** |
| FR-CMV-006 Sc1 (backend: re-detect, clear stale) | T-003 | single fold-in write always applies current value | re-analyze-success + re-analyze-failure + zero-parse-jobs tests | COVERED |
| FR-CMV-006 Sc1 (frontend: dialog stops appearing) | T-005 | `invalidateQueries({queryKey:['assessment', id]})` present in the COMPLETED effect | 2 tests (fires / doesn't) | COVERED |
| NFR-CMV-010 (exactly one invokeModel call) | T-003 | no new invocation added | explicit call-count assertion | COVERED |
| NFR-CMV-011 (fail-quiet) | T-003 | all failure paths return `null`, normalizer never throws | dedicated tests | COVERED |
| NFR-CMV-012 (no gating regression) | — | `gap-detection.service.ts` diff is empty; `allMandatoryComplete`/`disabled`/Tooltip gate byte-identical | structural + smoke test, honestly labeled as such | COVERED |
| BR-CMV-001 (mismatch definition) | T-003+T-005 | `isSupportedCountry()` on both sides | both suites | COVERED |
| BR-CMV-002 (country immutability unchanged) | T-002 | `assessments.service.ts`/`UpdateAssessmentDto` diff empty | structural | COVERED |
| BR-CMV-003 (≥0.7 confidence, inclusive) | T-003+T-004 | gate matches prompt instruction | exact boundary pair (0.7 accepted, 0.699999 rejected) | COVERED |

**Spot-check of `test-report.md`:** every count it asserts (16/16, 14/14, 4/4, 384/2/0) matches independently-rerun reality exactly; its test bodies were confirmed load-bearing (real payload assertions), not smoke checks disguised as coverage.

**WARN-4 — FR-CMV-005's "dismissible" clause is implemented but untested.** The mechanism exists and is correct; no test clicks the hint's Dismiss button to verify it actually hides. `test-report.md` does not overclaim this — the gap is real but was not previously surfaced.

*Remediation:* one small test asserting the hint disappears after its Dismiss button is clicked.

**CLOSED (post-validation):** added `hides the hint banner when its own Dismiss button is clicked` to `gap-detector-client.test.tsx` (scoped to the hint's own testid to avoid ambiguity with the validation banner's identical-looking Dismiss button). Suite now 15/15 passed.

## 7. Linting & Code Quality (4R Advisory)

Non-blocking — none of these are spec violations or gate the archive decision.

| ID | Lens | Finding |
|---|---|---|
| A-1 | Reliability | `normalizeDetectedCountry()` is called inside `processUploadMode()`'s Bedrock try block, after Core-10 fields are already written. It cannot realistically throw (only `typeof` guards and primitive `JSON.stringify`), so this doesn't reproduce JD-01's risk in practice — DD-CMV-006's actual mandate (the DB *write*) is correctly outside the try. Zero-cost hardening available: compute it before the field write. |
| A-2 | Accessibility | Dialog's second paragraph sits outside `DialogDescription` (no `aria-describedby`); hint banner has no `role="status"`/`aria-live`. Both already known — the latter mirrors the pre-existing validation banner exactly, as design.md §7 mandated. |
| A-3 | Design tokens | Hint banner hardcodes `amber-*` Tailwind classes rather than the `--warning` CSS variable — conformant (mirroring the existing banner was mandated) but perpetuates pre-existing token drift elsewhere in this screen. |
| A-4 | Responsive | No overflow risk observed; consistent with sibling banner and stock shadcn `DialogContent`. |
| A-5 | Toast convention | No violation — zero `sonner` references, no new toast added; `Dialog` used for the blocking choice per `packages/web/CLAUDE.md`. |
| A-6 | Reliability | `proceedToRiskAnalysis()` called without `await`/`.catch()` from the Continue button — identical to pre-diff behavior, not a regression. |
| A-7 | Docs | `proposal.md` still carries the original, superseded hint copy. `design.md` §7 explicitly declares itself the corrected source of truth, so this is intentional, but a reader of `proposal.md` alone would see the wrong text. |

## 8. Design Conformance

**Every Judgment Day fix re-verified present in the shipped code, first-hand:**

- **DD-CMV-006 (fold-in write):** exactly one `prisma.assessment.update()` touching `detectedCountry` in the whole handler, sitting in `execute()` genuinely after `processUploadMode()`'s try/catch has resolved. Its dedicated test proves a thrown `assessment.update()` error is not swallowed by the Bedrock catch block.
- **Initializer:** `let detectedCountry: string | null = null` present and correctly wired — never `undefined`.
- **Confidence gate:** matches BR-CMV-003 exactly; exact-boundary test pair confirms `>= 0.7` is inclusive.
- **Round-3 SEVERE fix (query invalidation):** `queryClient.invalidateQueries({ queryKey: ['assessment', id] })` is present in the job-completion effect. **Not missing.**
- **Ordering:** `countryMismatch` derived immediately after `useAssessment(id)`, no TDZ hazard.
- **Copy:** the corrected (JD-15) non-blocking line is present verbatim; the superseded misleading line appears nowhere in shipped code.
- **Untouched gating:** `allMandatoryComplete`, the Button's `disabled` expression, and the Tooltip gate are byte-identical to before this spec; `proceedToRiskAnalysis` is line-for-line identical to the original `handleAnalyzeRisks` body.
- Also confirmed: `CountryBadge` used instead of raw `getCountryFlag()`; hint banner stacked above the validation banner; auto-clear effect present; `createSkeletonFields()` remains `GapField`-only; prompt schema reordered (`detectedCountry`/`detectedCountryConfidence` before `fields`) exactly as JD-10 requires; `prod-prompt-update.md`'s every factual claim checks out.
- **`judgment.md`'s final `APPROVED ✅` verdict is accurate** — every SEVERE finding it claims resolved is verified present in the shipped code. No DD-CMV-* decision has been reverted.

**Cross-document figure check:** the 5-task count, the 0.7 confidence threshold, the 4-country list, and the schema line are all consistent across `requirements.md`/`design.md`/the prompt/the handler/the tests. No contradiction found. (Informational only, non-gating: actual non-test LOC ≈190 vs. the ~130-175 estimate in `design.md` §13's budget — seed.ts came in under estimate, the frontend came in somewhat over; test LOC ≈732 vs. ~280-380 estimated, reflecting the additional coverage closed during `/akili-test`. Neither variance is large enough to warrant a budget-tripwire escalation after the fact.)

## 9. Test Evidence Summary

`test-report.md` is accurate and was independently spot-checked, not just trusted: every test count it reports matches a fresh re-run exactly, and a sample of its test bodies were confirmed to contain real assertions (exact payloads, exact call counts) rather than vacuous smoke checks. Its two accepted-gap categories (real-world LLM accuracy, dialog accessibility beyond the shadcn default) remain accurately scoped as accepted risks, not silently-dropped requirements.

## 10. Agent Guide / Constitution Impact

`execution.md` records `Constitution Impact: none`, and this was independently confirmed true: no new module/package, no boundary moved, no public surface changed beyond the additive nullable column and additive shared-type field. No child `CLAUDE.md`/`AGENTS.md` update is needed, and none is pending.

## 11. Remediation

| ID | Severity | Finding | Remediation | Blocking? |
|---|---|---|---|---|
| WARN-1 | WARN | Two "Done when" manual-verification clauses (T-003, T-005) lack recorded evidence in `execution.md` | Add a short Manual QA section, or downgrade the clauses with stated rationale | **CLOSED** |
| WARN-2 | WARN | `design.md` §4 not amended for the T-001 scope amendment (3 ripple files) | One line naming the 3 files | **CLOSED** |
| WARN-3 | WARN | Pre-existing web test flake mis-attributed to a single file in `execution.md`/`test-report.md` | Reword to note it manifests in either of 2 files depending on scheduling | **CLOSED** |
| WARN-4 | WARN | FR-CMV-005's "dismissible" clause is implemented but has no test | Add one small test | **CLOSED** |
| A-1…A-7 | Advisory | See §7 above | Optional; candidates for the Kaizen log | Open (non-blocking) |

All 4 WARNs were closed in a post-validation fix pass (user-approved), including a real end-to-end persistence check (not just documentation) for WARN-1's T-003 half. The 7 advisory notes remain open by design — they are optional, non-blocking, and appropriate as Kaizen candidates rather than spec-blocking fixes.

## 12. Archive Readiness Recommendation

**ARCHIVE-READY.** No requirement is unmet, no Judgment Day design decision has been reverted, no new test failure or build/lint/type regression was introduced, every count in `test-report.md` was independently spot-checked and found accurate, and all 4 WARN findings from this audit have since been closed with real evidence (not just documentation edits — the persistence half of WARN-1 was verified against a real database row from a real handler run). Nothing remains outstanding except the 7 optional advisory notes, which are appropriately deferred to the Kaizen log rather than blocking archive.

```text
/akili-archive changes/country-document-match-validation
```
