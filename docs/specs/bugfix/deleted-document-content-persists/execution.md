# Execution Log — Deleted Document Content Persists In Gap Detection

## 1. Document Control

| Field | Value |
|-------|-------|
| **Module** | `docs/specs/bugfix/deleted-document-content-persists` |
| **Requirements** | `./requirements.md` (v2.0) |
| **Design** | `./design.md` (v2.0) |
| **Tasks** | `./tasks.md` (v1.0) |
| **Started** | 2026-08-21 |
| **Approval Mode** | `gated` |
| **Branch** | `bugfix-deleted-document` |
| **Budget of record** | 8 tasks · ~300 LOC · 1 review round (`design.md` §12) |

### Triad configuration

| Role | Agent | Independence |
|------|-------|--------------|
| Leader | this session (T1) | writes no production code |
| Implementer | `.claude/agents/akili-implementer.md` (T2) | — |
| Reviewer | `.claude/agents/akili-reviewer.md` (T3) | author ≠ auditor, enforced by wrapper model binding |

---

## 2. Task Execution History

### T-001 — Shared merged-content response type `[SHARED]`

| Field | Value |
|-------|-------|
| **Status** | ✅ **PASS** on attempt 1 |
| **Date** | 2026-08-21 |
| **Requirements covered** | enables FR-DDP-002, FR-DDP-003 |
| **Design ref** | §9 Shared Contracts, §6 API Design |
| **Effort** | `low` (Leader selection — mechanical type declaration) |
| **Skills** | none — repo conventions only, as the task specifies |

**Attempt 1**

- **Files changed:** `packages/shared/src/types/assessment.types.ts`, `packages/shared/src/index.ts`
- **Change:** added `MergedContentResponse` = `{ mergedMarkdown: string | null; superseded: boolean }` and its `type` export in the barrel.
- **Verification:** `pnpm --filter @alliance-risk/shared build` → `tsc` clean, no errors.
- **Disqualifier check** (T-001: "the build passes because the type was added but not exported"): the Implementer read the emitted `dist/index.d.ts` and `dist/types/assessment.types.d.ts` after building. The **Reviewer independently re-verified** both files rather than accepting the report — `dist/index.d.ts:13` names `MergedContentResponse` in the type export, and `dist/types/assessment.types.d.ts:29-32` emits the interface with both fields at the declared types.
- **Reviewer verdict:** `STATUS: PASS` — the type matches `design.md` §9's contract and §6's semantics field-for-field, sits on the correct side of the package's value-vs-type export split, and touches nothing outside the two-file scope. No enum was introduced, honouring §6's deliberate one-boolean decision (DD-DDP-003).
- **Not Done / Assumptions:** none reported.
- **KZ-004 compliance:** the done-when was scoped to `@alliance-risk/shared` only. API and Web build/typecheck were deliberately **not** run — their consumers land in T-005…T-007 and would fail correctly.

**ADVISORY (4R lenses — recorded, never gating, never a new task)**

| Lens | Finding |
|------|---------|
| Readability | `packages/shared/CLAUDE.md` documents `assessment.types.ts` as containing only `AssessmentSummary`, `AssessmentDetail`, `AssessmentStats`. That inventory line is now stale |
| Readability / Reliability | `design.md` §6 states an invariant the type cannot express — "when `superseded` is `true`, `mergedMarkdown` is `null`". A discriminated union would contradict the mandated shape, so the Reviewer explicitly recommends **not** restructuring; a JSDoc note would carry the invariant to T-005 |
| Risk (forward) | Until T-005 and T-006 adopt the shared type, three parallel declarations of this shape coexist (shared, the API's inline return type, `use-merged-content.ts:6-8`). Correct at T-001, but **T-005 and T-006 must be audited for *replacing* the local declarations, not merely coexisting with them** |
| Resilience | Type-only change, no runtime emit; `dist/index.js` unchanged, zero blast radius on deployed consumers |

**Leader disposition of advisories:** recorded and closed here. None is minted as a task — an advisory is not approved scope (`/akili-execute` → *Advisory Never Becomes A Task*). The forward-looking risk item is carried into T-005's and T-006's Reviewer briefs as an audit focus, which is a brief instruction, not new scope.

---

### T-002 — Regression suite, RED before any fix `[BE]`

| Field | Value |
|-------|-------|
| **Status** | 🔄 in rework — attempt 1 FAIL |
| **Date** | 2026-08-21 |
| **Requirements covered** | FR-DDP-001 Sc 1–3, FR-DDP-002 Sc 1–2 & 4, FR-DDP-004 Sc 1–2, BR-DDP-003 |
| **Design ref** | §7.1, §7.2, §7.3, §11 |
| **Effort** | attempt 1 `high` → attempt 2 `xhigh` (bumped on rework) |
| **Skills** | `nestjs-expert`, `tdd` |

**Leader skill deviation (recorded per `.agents/leader.md` → Delegation Discipline):** added `tdd` beyond the task's own list. T-002's disqualifier is "the suite must fail for the right reason", which is precisely the red-green discipline and test-anti-pattern material that skill carries.

#### Attempt 1 — Reviewer `STATUS: FAIL`

- **Files changed:** `packages/api/src/domain/assessments/assessments.service.spec.ts` (+176), `packages/api/src/platform/jobs/handlers/gap-detection.handler.spec.ts` (+162). No production source touched.
- **Verification:** `pnpm --filter @alliance-risk/api test --testPathPattern='gap-detection.handler|assessments.service'` → Test Suites 2 failed / 2 total; Tests **10 failed, 44 passed**, 54 total.
- **Implementer's `Not Done / Assumptions`:** none reported.

**What the Reviewer confirmed as sound** — worth recording, because the rework must not undo it:

- The red baseline is **genuine**. All 10 failures traced to production code and confirmed behavioural (`not.toContain`, `toBeNull`, `toHaveBeenCalledWith`), none a `TypeError` or wiring artefact. 54 tests collected proves both suites compiled.
- The 44 pre-existing tests (25 handler + 19 service) still pass, none relaxed or deleted.
- **The `[jobA]` / `{A, B}` → serve fixture is strong.** It asserts both that content is served verbatim and that `superseded === false`, so a set-equality implementation — the defect three prior designs shipped — fails both assertions. This is the single most valuable test in the suite and it holds.
- `wireJobFindManyToStore` is a legitimate seam, not over-fitting: it answers by semantics and its unrecognised-`where` fallback returns *all* jobs, failing **red** rather than green. Fail-closed direction.
- KZ-005 single-dash form used correctly.

**FAIL issues (3) — Reviewer report, verbatim**

1. **Discovered Issue:** The `$transaction` mock (`assessments.service.spec.ts:66`) is a bare `jest.fn()`, and the new describe's `beforeEach` calls `mockPrisma.$transaction.mockReset()` (`:304-307`). This wiring supports **only** the array form `$transaction([p1, p2])`. If T-004 uses the interactive callback form — which is this repo's dominant idiom, 7 call sites (`prompts.service.ts:34,164,250,266,300,367`, `comments.service.ts:35`) against 2 array-form sites — the callback never executes, so `mockPrisma.job.delete` is never called and tests at `:309` and `:323` stay red against a *correct* implementation. `mockReset()` would also wipe any implementation a later task added at the mock literal. T-004's scope is `assessments.service.ts` only, so it cannot repair this, and the file's own comment at `:58-61` ("so T-004 … can turn these same tests green without touching this spec file again") is false for that path. This is criterion 4's failure mode: a test coupled to one implementation shape that blocks a right implementation.
   - **Violated Rule:** `design.md` §7.2 / DD-DDP-004 (mandates one `$transaction`, does not mandate a form); `tasks.md` T-004 Scope (production file only) and T-004 "Tests: T-002's deletion cases turn green"; repo convention `prompts.service.spec.ts:46`.
   - **Remediation Suggestion:** Adopt the established convention and make the mock form-agnostic, e.g. `$transaction: jest.fn((arg: any) => (typeof arg === 'function' ? arg(mockPrisma) : Promise.all(arg)))`, and replace the `mockReset()` in the describe's `beforeEach` with `mockClear()` (or re-install the implementation after reset) so the seam survives. The red baseline is unaffected — `deleteDocument` calls `$transaction` zero times today, so all three deletion tests stay red.

2. **Discovered Issue:** Nothing asserts that the `AssessmentDocument` row itself is deleted, nor that **both** deletes occur inside the single transaction. `:309` asserts only `job.delete`; `:352` asserts only `expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1)`. An implementation that drops the document delete entirely, or that deletes the document outside the transaction and wraps only the job delete, passes all three deletion tests. FR-DDP-004 Sc1's "**both** the document record and its parse job record are gone" and Sc2's "both or neither" are therefore ungated — and Sc2 is the whole point of the transaction.
   - **Violated Rule:** `tasks.md` T-002 Scope — "deletion removes the document **and** its parse job … the two deletes are one transaction"; `requirements.md` FR-DDP-004 Sc 1 and Sc 2; `design.md` §7.2.
   - **Remediation Suggestion:** Once issue 1 is fixed, assert `assessmentDocument.delete` was called with `{ where: { id: 'doc-1' } }`, and assert both deletes are attributable to the transaction (with the callback form, assert both delegates were called from within the `$transaction` callback; with the array form, assert `mockPrisma.$transaction.mock.calls[0][0]` has length 2 — the pattern already used at `gap-detection.handler.spec.ts:449-450`).

3. **Discovered Issue:** BR-DDP-003 has no test anywhere in the diff. `tasks.md` T-002 lists it in its **Requirements** field, and §5 Requirement Coverage names T-002 as its **sole** owner ("BR-DDP-003 | Analyst edits survive | T-002"). No new or existing assertion in `assessments.service.spec.ts` establishes that withholding an analysis leaves gap-field corrections untouched; the service spec's `mockPrisma` has no `gapField` delegate at all, so the property is only implicitly protected by a would-be `TypeError`.
   - **Violated Rule:** `tasks.md` T-002 Requirements and §5 Requirement Coverage ("a requirement ID appearing in a task is not coverage"); `requirements.md` §5 BR-DDP-003.
   - **Remediation Suggestion:** Add a `gapField: { deleteMany: jest.fn(), updateMany: jest.fn(), update: jest.fn() }` delegate to `mockPrisma` and, in the withholding fixture (`:410`), assert none of them was called — i.e. the withheld read is a pure read and destroys no Analyst edit. This will be green today and stays green through T-005, which is correct for a "must not change" business rule.

**Leader adjudication.** All three are in-scope spec-conformance failures, not stylistic preferences:
- Issues 1 and 2 are the same class the spec's own §6 gate language warns about — a check that cannot fail, or that fails a *correct* implementation. Issue 1 would have surfaced as a phantom T-004 FAIL, costing rework attempts on a task that was right.
- Issue 3 is a coverage hole against `tasks.md` §5, which closes at clause granularity and names T-002 as BR-DDP-003's only owner.

**ADVISORY (recorded, non-gating, not absorbed into this task)**

| Lens | Finding | Disposition |
|------|---------|-------------|
| Reliability | `expect(assessmentDocument.findMany).toHaveBeenCalled()` is Sc3's only red and is an implementation-shape assertion; a behaviourally equivalent `assessment.findUnique({ include: { documents: true } })` would satisfy every FR yet fail it | **Carried into T-003's brief as an audit note.** Not a T-002 change |
| Reliability | D2 fixture 3 asserts only `superseded === false`, never that content is actually served | Recorded |
| Risk (forward, T-004) | T-004's done-when requires proving no job is enqueued (NFR-DDP-011), but T-004's scope is production-only | **Carried into T-004's brief** |
| Risk (forward, T-005) | FR-DDP-002 Sc4 also requires serving while B is *unparsed* (`parseJobId: null`) and when B's parse *failed* — the case where a naive `documents.map(d => d.parseJobId)` yields `[null]` | **Carried into T-005's brief** |
| Readability | `mockResolvedValue` set inside the new describes persists into later tests; harmless today as both describes are last in the file | Recorded |

Per `/akili-execute` → *Advisory Never Becomes A Task*, none of these widens T-002 or mints new work. Three are carried forward as **brief instructions** to later tasks' workers — which is orchestration, not scope growth.

#### Attempt 2 — Reviewer `STATUS: FAIL` (1 of 3 issues remains)

- **Files changed:** `assessments.service.spec.ts` (mock rework + assertions), `gap-detection.handler.spec.ts` (comment-only).
- **Verification:** the Implementer ran a variant (`pnpm --filter @alliance-risk/api exec jest … --verbose`) rather than the command the task specifies. **The Leader re-ran the specified command inline** — `pnpm --filter @alliance-risk/api test --testPathPattern='gap-detection.handler|assessments.service'` → Test Suites 2 failed / 2 total; Tests **10 failed, 44 passed**, 54 total. Same counts; the deviation was cosmetic, and the gate as written holds.

**Fixed and confirmed by the Reviewer:**

- **Issue 2 — closed.** Test 1 now gates the `AssessmentDocument` delete, so an implementation that drops it fails. Test 3's callback branch asserts neither delegate escaped onto the raw client, so "document deleted outside the transaction, only the job wrapped" now fails; the array branch's length-2 check catches the same shape.
- **Issue 3 — closed and non-vacuous.** `gapField.{deleteMany,updateMany,update}` are real delegates on `mockPrisma`, so a T-005 implementation touching gap fields would land on them and fail.
- Attempt 1's confirmed-sound elements survived intact: `wireJobFindManyToStore`, the `[jobA]`/`{A,B}` serve fixture, and the 44 pre-existing tests.
- All 10 failures remain behavioural. Test 3 fails at the `toHaveBeenCalledTimes(1)` assertion, which aborts before `mock.calls[0][0]` could throw — correct ordering.

**Remaining FAIL issue — Reviewer report, verbatim**

1. **Discovered Issue:** `mockTx`'s delegates are never reset, so test 2 leaks its `deleteFromStore` implementation into test 3 — reintroducing exactly the attempt-1 failure mode (a correct callback-form T-004 cannot turn the suite green).

   `packages/api/package.json` Jest config sets neither `resetMocks` nor `restoreMocks`, and `jest.clearAllMocks()` (line 124) only calls `mockClear()` — it clears call history but **does not remove implementations**. The describe-level `beforeEach` (lines 335-344) resets `mockPrisma.job.delete` but nothing on `mockTx`.

   Test 2 installs `mockTx.job.delete.mockImplementation(deleteFromStore)` (line 392), closing over a `jobStore` from which `job-1` has been removed by the time that test ends. Test 3 then runs with that stale implementation still attached. Under a callback-form T-004, `deleteFromStore` finds no `job-1`, returns a rejection, it propagates out of `$transaction`, and `deleteDocument()` throws. Test 3 fails with a **mock-fixture error, not a behavioural assertion** — the precise disqualifier in T-002's "Evidence is disqualified if".

   The array form is unaffected, so the seam still silently favours one shape. The comment at lines 337-342 is true about call history and false about its conclusion, and will mislead the next maintainer.

   This does not affect today's red run (production never calls `job.delete`), so the recorded baseline stands; it fails against *correct* T-004 code, which is what T-002 exists to gate.
   - **Violated Rule:** `tasks.md` §4 T-002 — Scope and "Evidence is disqualified if: the suite fails for the wrong reason — a mock wiring error … is **not** a red test"; `design.md` §7.2 (mandates one `$transaction`, prescribes no form).
   - **Remediation Suggestion:** In the describe-level `beforeEach`, reset the transaction-scoped delegates alongside `mockPrisma.job.delete` — they carry no literal-level implementation, so `mockReset()` is safe there (unlike on `$transaction`): `mockTx.assessmentDocument.delete.mockReset(); mockTx.job.delete.mockReset();` — and correct the comment so it distinguishes "clears call history" from "removes implementations", noting that `$transaction` alone needs `mockClear()` because its dispatch implementation lives on the object literal. Symmetric treatment of `mockPrisma.job.delete` and `mockTx.job.delete` is the invariant to state.

**Leader adjudication.** Correct and in scope. The finding is the same defect class as attempt 1's issue 1 — a fixture that fails a *right* implementation — relocated from the mock's shape to its lifecycle. Attempt 2 fixed the shape and left the lifecycle, which is why the Reviewer caught it and the counts did not move: the leak is invisible in the red baseline and only bites when T-004 lands. Two of three issues are closed; one attempt of three remains.

**ADVISORY (recorded, non-gating)**

| Lens | Finding | Disposition |
|------|---------|-------------|
| Reliability | Test 3's array-form branch asserts only `toHaveLength(2)`; an implementation deleting the document outside the transaction and passing `[job.delete(...), <other write>]` satisfies it. The callback branch is strictly stronger | Recorded. The callback form is the repo's dominant idiom, so the weaker branch is the less-travelled path |
| Readability | BR-DDP-003's assertions sit at the end of D2 fixture 2, after two expectations that fail today — so they never execute in the red baseline and begin gating only when T-005 turns that fixture green. A standalone `it()` would be exercised from the first run | **Carried into T-005's brief as an audit note** |
| Risk | `mockTx` is module-scoped and shared by every `describe`; any future test installing an implementation on it inherits this same leak class. Building it in `beforeEach`, or a `resetMockTx()` helper, removes the hazard structurally | Recorded |
| Readability | Block comments carrying line-number citations will silently rot; consider trimming coordinates to file names once T-003/T-004 land | Recorded |

#### Attempt 3 — Reviewer `STATUS: PASS` ✅

- **Files changed:** `assessments.service.spec.ts` only (two added `mockReset()` lines + a rewritten comment).
- **Verification:** `pnpm --filter @alliance-risk/api test --testPathPattern='gap-detection.handler|assessments.service'` → Test Suites 2 failed / 2 total; Tests **10 failed, 44 passed**, 54 total. The specified command, not a variant.
- **Implementer's `Not Done / Assumptions`:** none.

**How the fix was proven** — this matters, because the defect was invisible in the red baseline and confirming unchanged counts would have proved nothing. The Implementer ran a controlled probe: temporarily added a callback-form `$transaction` to production `deleteDocument()`, confirmed all three deletion tests went green **with** the fix, then reverted only the fix while keeping the probe and reproduced the exact reported failure (`Record to delete does not exist.` thrown from the leaked implementation), then removed the probe entirely.

**Leader's independent checks** (the probe touched production source, so this was verified rather than trusted): `git status --porcelain` shows only the two spec files modified; `grep -rn "PROBE" packages/api/src` returns nothing; `git diff` on `assessments.service.ts` is empty.

**Reviewer verdict:** PASS. Traced test 2 → test 3 ordering under Jest 29 semantics independently rather than relying on the probe narrative. Confirmed: both `mockTx` delegates now `mockReset()` while `$transaction` stays on `mockClear()` so its literal-level dispatch survives; `mockReset()` does not replace the function object, so the `$transaction` closure still hands the callback the same `mockTx` identity; a correct T-004 turns all three deletion tests green under **both** transaction forms; no assertion was altered; the red baseline stays behavioural (10 failed = 3 handler + 3 deletion + 4 `getMergedContent`); no production file was touched. The Reviewer also searched for a third variant of the defect class and found none blocking.

**Final status: ✅ PASS on attempt 3 of 3.**

| Field | Value |
|-------|-------|
| **Requirements covered** | FR-DDP-001 Sc 1–3, FR-DDP-002 Sc 1–2 & 4, FR-DDP-004 Sc 1–2, BR-DDP-003 |
| **Red baseline of record** | 10 failed, 44 passed, 54 total |
| **Decisions** | Form-agnostic `$transaction` seam so T-004 is free to choose the callback or array form (`design.md` §7.2 mandates a transaction, not a form) |
| **Issues encountered** | The same defect class — *a fixture that fails a correct implementation* — recurred twice: first in the mock's **shape** (array-only), then in its **lifecycle** (unreset delegates). Both were invisible in the red run and would have surfaced as phantom T-004 FAILs, burning rework attempts on a task that was right |

**ADVISORY from attempt 3 (recorded, non-gating)**

| Lens | Finding | Disposition |
|------|---------|-------------|
| Reliability | After `mockReset()` the delegates return `undefined`. A T-004 that dereferences a delete's return value would throw a `TypeError` against otherwise-correct code — the last remaining way this fixture can fail right code | **Carried into T-004's brief:** do not read the return value of the deletes |
| Reliability | The stated invariant is broader than the code — `mockPrisma.assessmentDocument.delete` is deliberately not reset because it carries a literal `mockResolvedValue`. True today; a future test installing a per-test implementation on it would reopen the leak | Recorded |
| Readability | The root cause of both recurrences is that this file needs `clearAllMocks` + surgical `mockReset` where the sibling handler spec can use `jest.resetAllMocks()`, purely because implementations live on the object literal. Moving the dispatch into a `beforeEach` re-install would retire the defect class | Recorded — a legitimate follow-up, explicitly **not** minted as a task here |
| Risk | Blast radius nil — test-only, no production source, no schema, no shared types | — |

---

## 3. Budget Tripwire — ⚠️ ESCALATED TO USER

`design.md` §12 records the budget `/akili-execute` trips against. Measured after 2 of 8 tasks:

| Dimension | Budgeted (whole spec) | Actual after T-001 + T-002 | Status |
|---|---|---|---|
| Tasks | 8 | 2 complete | on track |
| **Test LOC** | **~130** | **441** | ⚠️ **3.4× over, with 3 test files still unwritten** |
| Backend LOC | ~90 | 0 | not started |
| Frontend LOC | ~80 | 0 | not started |
| Shared LOC | (in backend) | 6 | on track |
| **Total LOC** | **~300** | **447** | ⚠️ **1.5× over at 25% of tasks** |

**Cause — a sizing error in `design.md` §12, not scope creep in execution.** Every line of T-002 is inside its approved scope, and two Reviewer rounds tightened rather than widened it. What the budget mis-sized is the cost of the evidence this spec demands of itself:

- `requirements.md` §6 D2 requires **four** withholding fixtures, each needing its own mocked document/job state.
- `tasks.md` §5 closes coverage at **clause** granularity, so each `AND IT MUST` / `BUT it must NOT` needs its own assertion.
- T-002's disqualifier requires the suite fail for the *right* reason, which is what produced the form-agnostic `$transaction` seam and the `mockTx` machinery — roughly 60 lines of scaffolding that a laxer gate would not have needed.

The estimate of ~130 test LOC was made against a design of comparable behavioural surface but did not price the gate rigour the same documents mandate. That rigour has already paid: it caught two fixtures that would have failed a correct T-004.

**Projection if the pattern holds:** the three remaining test files (T-006 × 2, T-007 × 1) plus production code across T-003…T-007 put the spec near **~900–1000 LOC**, roughly 3× the budget — close to the ~810 the v1.x design was rejected for, though for a materially different reason (evidence weight, not design complexity).

**Leader disposition:** halted before starting T-003 and escalated. Per `/akili-execute` → *Budget Tripwire*, exceeding a budget is information, not failure, and the cost of a mis-sized spec is only recoverable while the spec is still running. Awaiting the user's decision.
