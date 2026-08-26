# Test Report — Deleted Document Content Persists In Gap Detection

## Verdict

> **PASS.** Both suites green, no product bugs found. Twelve tests added, every one proven to fail against a named wrong implementation by **mutating production code and re-running** — not by assertion.
>
> The run closed the two gaps `/akili-validate` named, and returned one honest **"not automatable"** rather than a test that would have looked like coverage.

| Suite | Tester | Result | Tests | Gap closed |
|---|---|---|---|---|
| Frontend unit — `upload-business-plan-modal` | Opus, fresh context | ✅ PASS | 7 new | FR-DDP-004 Sc 3 had **zero** automated evidence |
| Backend unit — `gap-detection.handler` | Opus, fresh context | ✅ PASS | 5 new | The reported bug had a **single point of failure** |
| Cross-package timing invariant | (assessed) | ⚠️ **GAP** | 0 | Not automatable without a production change — see §9 |

---

## 1. Document Control

| Field | Value |
|-------|-------|
| **Spec** | `docs/specs/bugfix/deleted-document-content-persists` |
| **Date** | 2026-08-26 |
| **Depth** | Standard · **Suites run** 2 · **Testers spawned** 2, in parallel · **Inline** none |
| **Prior evidence** | `execution.md` (per-task TDD, cited not rewritten), `validation-report.md` §11 (the gap list this run took as its brief) |

### Why this run happened at all, and the deviation that made it worth it

`/akili-test` was **not** obviously needed here: this spec ran in Bug Mode, so tests were built continuously — a mandatory red regression suite (T-002) plus per-task coverage, each audited by an independent Reviewer that rejected several as non-gates.

What justified it was `/akili-validate` producing a **named work list** the run did not have before, plus one structural fact: **author ≠ tester was never satisfied.** Every test in this spec was written by the same agent that wrote the code it tests.

**Leader deviation, recorded:** the `akili-tester` wrapper binds to T2 — the same tier the Implementers ran on, so spawning it as-configured would have reproduced the very bias this command exists to remove. Both Testers were overridden to **Opus**, giving genuine model diversity from the T2 Implementers.

**Scope discipline, recorded:** `/akili-validate` also carried an advisory that the new `DocumentViewer` states lack `role="status"`/`aria-live`. It was **excluded** from this run. `docs/ux-ui/design.md` §10 lists concrete accessibility expectations — form labels, focus rings, colour-not-sole-indicator, dialog focus trap, semantic headers, contrast — and **none mandates live regions for dynamic content**. Writing a test for behaviour no requirement demands would mint scope from an advisory. It remains a recorded advisory.

---

## 2. Summary

| Metric | Before | After |
|---|---|---|
| API tests | 413 passed | **418 passed**, 2 skipped, 0 failed |
| Web tests | 194 passed | **201 passed**, 2 failed (pre-existing, unrelated) |
| Total passing | 607 | **619** |
| Production files changed | — | **zero** |

The 2 web failures are `assessment-table.test.tsx`, a dashboard suite this spec never touches, failing identically at the base commit.

---

## 3. Backend Unit Tests — PASS

**File:** `packages/api/src/platform/jobs/handlers/gap-detection.handler.spec.ts` (+247, appended only)

`/akili-validate` found that most pre-existing tests stub `job.findMany` with a bare `mockResolvedValue` that **ignores the `where` clause**, leaving T-002's three fixtures as the **sole automated gate on the bug this whole spec exists to fix**. Editing those three would have removed all coverage of it, silently.

The Tester built a **self-contained** block with its own helpers, driving the public `execute()` rather than the private method — which also proves `sourceParseJobIds` reaches the persisted job result. Its fake honours only the post-fix query shape and **silently ignores** an `input.assessmentId` filter, so a reverted query leaks orphans and fails on content rather than on an equality.

### Mutation evidence — the concentration is genuinely broken

| Mutant | Kills new | Kills existing three |
|---|---|---|
| M1 — restore the pre-fix assessment-scoped query *(the reported bug)* | **3** | 2 |
| M2 — drop `status: 'COMPLETED'` | 2 | **0** |
| M3 — drop the null-`parseJobId` filter | 1 | **0** |
| M4 — drop `orderBy completedAt asc` | 2 | **0** |
| M5 — record `currentParseJobIds` instead of resolved ids | 2 | **0** |
| M6 — omit `sourceParseJobIds` on the zero-jobs path | 1 | **0** |

**Four mutants kill only the new tests.** And on M1 the new block fails three tests on its own — so deleting the T-002 fixtures no longer removes coverage of the reported bug. That was the point.

Two catches worth naming for their consequence, not their count:

- **M3** — without the null filter, `id: { in: [null, 'job-B'] }` reaches Prisma, which rejects null in a String column. That is a runtime failure of *every* analysis with an unparsed document — the normal state moments after any upload.
- **M5** — recording `currentParseJobIds` rather than the resolved ids puts a **failed** job into the snapshot, so re-parsing that document later marks superseded an analysis that never contained a word of it. The false-withhold class **BR-DDP-002** exists to forbid.

## 4. Frontend Unit Tests — PASS

**File:** `packages/web/src/components/assessment/__tests__/upload-business-plan-modal.test.tsx` (new, 7 tests)

FR-DDP-004 Sc 3 — *a failed deletion must not be reported as success* — had **no automated gate anywhere**, and `requirements.md` §6 had no defect class for it despite claiming to enumerate every class. It rested on one manual walkthrough step and a Reviewer's static reading.

Five mutants applied and reverted:

| Mutant | Failed |
|---|---|
| M1 — swallow every failure *(the pre-fix bug)* | 5 |
| M2 — naive guard requiring a `response` object | 2 |
| M3 — only `AxiosError`s count as failures | 1 |
| M4 — no 404 exemption | 1 |
| M5 — row can never be removed | 3 |

The control test (success removes the row) is what stops the four "row stays listed" assertions from passing vacuously — without it, M5 would leave them all green.

**The most valuable single test:** *a request that fails with no response at all.* This is the offline case, and it kills **M2** — a guard written as `err.response && err.response.status !== 404`, which is the natural way to write it and lets an offline delete silently remove the row. It was previously covered only by a Reviewer reading the code.

## 5. Integration Tests

None. No integration harness exists in this repo, and this spec's cross-module behaviour is exercised by the manual walkthrough (`requirements.md` §6, all nine steps run and passed).

## 6. E2E Tests

None run. Out of scope for this spec's depth; the nine-step manual walkthrough is the E2E-equivalent evidence of record.

---

## 7. Coverage & Traceability

| Requirement | Scenario | Type | File | Result |
|---|---|---|---|---|
| FR-DDP-001 | Sc 1 delete + replace | backend unit | `gap-detection.handler.spec.ts` (T-002 ×3 **+ new ×3**) | PASS |
| FR-DDP-001 | Sc 2 delete one of several, ordering | backend unit | new: four-document ordering | PASS |
| FR-DDP-001 | Sc 3 no deletions, unchanged | backend unit | new: exact separator/header format, 4 docs | PASS |
| FR-DDP-001 | non-`COMPLETED` job excluded | backend unit | **new** | PASS |
| FR-DDP-001 | null `parseJobId` dropped | backend unit | **new** | PASS |
| BR-DDP-001 | current documents, never historical jobs | backend unit | new ×5 — at the **query** and at the **output** | PASS |
| BR-DDP-002 | snapshot records only resolved jobs | backend unit | **new** | PASS |
| §7.3 | `[]` vs absent key | backend unit | **new** | PASS |
| FR-DDP-002 | Sc 1–4 withholding, five fixtures | backend unit | `assessments.service.spec.ts` (cited, not rewritten) | PASS |
| FR-DDP-003 | Sc 1–4 states + precedence | frontend unit | `document-viewer.test.tsx` (cited) | PASS |
| FR-DDP-004 | Sc 1–2 transactional cleanup | backend unit | `assessments.service.spec.ts` (cited) | PASS |
| **FR-DDP-004** | **Sc 3 failed delete not reported as success** | frontend unit | **new file ×7** | **PASS — was ungated** |
| FR-DDP-004 | Sc 4 deleted document gone everywhere | frontend unit | `use-multi-document-status.test.ts` (cited) | PASS |
| NFR-DDP-010 | bounded polling, all clauses | frontend unit | `use-merged-content.test.ts` (cited) | PASS |
| NFR-DDP-011 | zero AI on delete | backend unit | `assessments.service.spec.ts` (cited) | PASS |
| D8 | cross-field propagation | **manual** | `requirements.md` §6 step 7 | PASS |
| **§7.3** | **server bound < client budget** | — | — | **GAP — §9** |

---

## 8. Remediation

None required. No `FAIL`, no `PRODUCT_BUG`.

Two documentation follow-ups the Testers surfaced:

1. **`requirements.md` §6 needs a defect-class row** for "a failed deletion removes the row anyway", now that it has a gate. Its "every class this spec can produce" claim is still one class short. The Tester declined to edit `requirements.md` — correctly outside its slice — and proposed the row.
2. **KZ-005's wording misled an agent and has been corrected.** It read *"use single `--testPathPattern=`"*, which a Tester read as a single **dash** (`-testPathPattern`), making jest print help and collect nothing. Now shows the whole command. *Lesson within the lesson: show the command, never describe the delta from a broken one.*

---

## 9. Accepted Gaps

### 9.1 The cross-package timing invariant — not automatable, and the reasoning matters

`design.md` §7.3 requires the server's `ANALYSIS_IN_FLIGHT_MAX_AGE_MS` (4 min) to stay **strictly below** the client's poll budget (`MERGED_CONTENT_MAX_EMPTY_POLLS × POLL_INTERVAL_MS`, 5 min). Lowering the client constant silently inverts it with every suite green.

**Verdict: not automatable without a production change.** Verified, not assumed:

| Constant | Exported? |
|---|---|
| `ANALYSIS_IN_FLIGHT_MAX_AGE_MS` (api) | **No** — module-private |
| `POLL_INTERVAL_MS` (web) | **No** — module-private |
| `MERGED_CONTENT_MAX_EMPTY_POLLS` (web) | Yes |

api and web are separate Jest projects with no dependency edge, and `@alliance-risk/shared` has **no test script and no Jest at all**. No test in either project can obtain both real values.

**The Tester found an option needing no production change — and rejected it, on grounds worth preserving.** An api test could `readFileSync` both sources and regex the literals out. It reads the real definitions and would go red on the named drift. It was rejected because **it asserts definitions, not uses**: inline `5000` into `refetchInterval` and leave the constant defined-but-unused, and the real budget changes while the scrape stays green — the same "green while they drift" failure, displaced one level. *"A lint rule wearing a test's clothes."*

**Recommended production change, not made** — a design decision for the Leader:

> Move the three constants into `@alliance-risk/shared`. Both packages already depend on it, so no new edge. Then one test in the existing api project asserts `ANALYSIS_IN_FLIGHT_MAX_AGE_MS < MAX_EMPTY_POLLS × POLL_INTERVAL_MS` on the **real** values — paired with a web test asserting the poll actually returns that interval, closing the definition-vs-use gap that sank the scrape.

### 9.2 Prisma fidelity

Both API suites mock Prisma. `orderBy` and `id: { in: [...] }` are modelled by the fakes, so what is gated is that the handler **issues** the documented query — not that Prisma honours it. Closing this needs an integration test against a real database.

### 9.3 Transport is never real

The offline case is asserted as a faithful *shape* of a transport failure, not an actual one. Manual step 9 remains its only real-transport evidence.

### 9.4 "Surfaced" means invoked, not legible

The toast is asserted as called with the right payload; `<Toaster />` is not mounted in a unit suite. Whether a human reads it is the **D6** comprehensibility class the spec already routes to the HITL pause — and which the walkthrough passed.
