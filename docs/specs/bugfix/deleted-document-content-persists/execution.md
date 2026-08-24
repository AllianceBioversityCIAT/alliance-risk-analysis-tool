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

**User decision (2026-08-21): re-baseline and continue.** `design.md` §12 updated to ~1,050 LOC (≈115 backend, ≈140 frontend, ≈795 tests) and 2 review rounds. Rationale accepted: the overrun is concentrated in test evidence that has already demonstrated its value, so trimming it would optimise the wrong dimension. Implementation LOC remains close to the original estimate — the spec did not grow, the estimate of its test weight was wrong by roughly 6×. Flagged as a `/akili-archive` Kaizen candidate: Step 2.4 sizing should price gate rigour explicitly.

---

### T-004 — Delete the orphaned parse job with the document `[BE]`

| Field | Value |
|-------|-------|
| **Status** | ✅ **PASS** on attempt 1 |
| **Date** | 2026-08-21 |
| **Requirements covered** | FR-DDP-004 Sc 1–2, NFR-DDP-011, BR-DDP-004 |
| **Design ref** | §7.2, §10 |
| **Effort** | `medium` |
| **Skills** | `nestjs-expert`, `error-handling-patterns` |

**Attempt 1**

- **Files changed:** `assessments.service.ts` (`deleteDocument`), plus the single NFR-DDP-011 assertion in `assessments.service.spec.ts` permitted by the Leader adjudication below.
- **Change:** both row deletions moved into one interactive `$transaction` — document first (FK-correct: the FK is `assessment_documents.parse_job_id → jobs.id`, so the referencing row must go first), then its own job scoped by `id` **and** `type: 'PARSE_DOCUMENT'`. S3 deletion unchanged, still before and outside the transaction, still best-effort.
- **Verification:** `pnpm --filter @alliance-risk/api test --testPathPattern=assessments.service` → 22 passed, 4 failed, 26 total. The 3 FR-DDP-004 tests green; all 19 pre-existing green; the 4 failures are the `getMergedContent` fixtures, which are T-005's scope. Baseline confirmed by `git stash`: 19/7 before → 22/4 after, exactly the 3 target tests flipping and nothing else moving.
- **Not Done / Assumptions:** none.

**Leader adjudication — a conflict inside the task itself.** T-004's *scope* said production file only, but its *done-when* required "an assertion proves no job is enqueued on the delete path (NFR-DDP-011)", and no such assertion existed or was owned elsewhere. I authorised exactly one assertion in the existing Sc 1 test. Recorded because it is a deviation from the task's written scope, made to satisfy that same task's written done-when.

**Reviewer verdict:** `STATUS: PASS`. The highest-value check was whether `type` is legal in a Prisma `delete` where-clause, since `delete` requires a unique selector and `type` is not unique — if Prisma silently dropped it, FR-DDP-004 Sc 1's "not any other job type" clause would be enforced only by the mock. The Reviewer verified against the **generated client**: `JobWhereUniqueInput` is `Prisma.AtLeast<{ id?, type?, … }, "id">`, so `id` satisfies the uniqueness requirement and `type` is a first-class additional filter (extended where-unique, GA since Prisma 5; this repo is on `@prisma/client` 7.4.1). It compiles to `DELETE … WHERE id = $1 AND type = $2`, and a non-match raises P2025 rather than being ignored. **The clause is a real database-level constraint.**

Also confirmed: `parseJobId` captured before the callback so the transaction reads no stale state; neither delete's return value dereferenced (the sharp edge carried forward from T-002's review); with `parseJobId === null` the transaction holds one delete and "both or neither" is vacuously satisfied; the NFR-DDP-011 assertion is non-vacuous (`mockJobs.create` is proven observable by the `triggerParseDocument` suite).

**ADVISORY (recorded, non-gating)**

| Lens | Finding | Disposition |
|------|---------|-------------|
| Resilience | A job row missing or of the wrong type makes `tx.job.delete` raise P2025 and roll back the document delete — **while the S3 object was already removed before the transaction.** The document becomes permanently undeletable with its file already gone, and every retry fails identically. `design.md` §10 assumes transaction failure is retryable; this sub-case is not | **Recorded as a real gap in §10's assumption.** Risk is low today (no code path in `packages/api/src` deletes `Job` rows, and all three parse paths write `parseJobId` in the same call). If ever observed, the fix is to catch P2025 specifically on the job delete — **not** to relax the scoping |
| Resilience | The `PARSING` guard and the `parseJobId` read happen outside the transaction; a re-parse racing between them would delete the old job while orphaning the new one. Pre-existing class, not introduced here | Recorded |
| Risk | Assessment-level deletion cascades `AssessmentDocument` rows but leaves their `PARSE_DOCUMENT` jobs behind, so FR-DDP-004's storage-growth motivation is closed only for the per-document path | Recorded as a follow-up; correctly excluded under NFR-DDP-012 |

---

## Pivot Record: T-003

**Status:** ⛔ blocked, awaiting user approval. T-003 marked `[~]`. Rework attempts **not** consumed — this is a spec defect, not an implementation failure, and the Pivot Protocol forbids looping on one.

### The blocker

T-003's disqualifier and its scope instruct opposite things for one input.

- **Scope says:** guard `createSkeletonFields` behind `!isReAnalyze` — stated twice, with a design rationale (`design.md` §7.1).
- **Disqualifier says:** all 25 pre-existing handler tests must still pass.

One pre-existing test asserts the *unguarded* behaviour for exactly the input the guard closes:

```
✕ clears detectedCountry to null on zero completed parse jobs during a re-run,
  without createSkeletonFields() touching prisma.assessment
```

It calls `execute({ assessmentId, reAnalyze: true })` with zero completed parse jobs and asserts `gapField.createMany` **was** called once. With the guard in place it is called zero times. No implementation satisfies both.

The Implementer implemented the guard as specified, reported the conflict in `Not Done / Assumptions` rather than silently reverting it or editing the test, and left the suite at 27 passed / 1 failed. **That was the correct call** and is why this reached a Pivot rather than a HALT.

### Leader investigation (inline, two file reads)

**1. The duplication the guard prevents is real.** `GapField` (`schema.prisma:309-329`) carries only `@@index([assessmentId, category])` — **no unique constraint** on `(assessmentId, field)`. So `createMany` of ten Core-10 rows against an assessment that already has ten genuinely produces twenty. Combined with `execute()` deleting existing fields only when `!isReAnalyze` (`gap-detection.handler.ts:65`), a re-analyse resolving zero jobs duplicates the list. **The design is correct; the guard must stay.**

**2. The pre-existing test's subject is not skeleton creation.** Reading it in full, its own comments give it away:

> `// createSkeletonFields() ran (GapField-only helper) ...`
> `// ... but the ONLY prisma.assessment.update call is the single execute()-level fold-in write — createSkeletonFields() performs no Assessment write of its own.`

Its claim, inherited from the archived country-match spec, is **"`createSkeletonFields` performs no `Assessment` write of its own."** The `createMany` assertion is the *precondition* establishing that the helper ran, so the next assertion means something. It is not the thing under test.

The guard removes that precondition **in re-analyse mode only**. The test's actual subject is untouched and still verifiable — in a non-re-analyse run, where the helper still executes.

### Conclusion

Neither `design.md` nor `requirements.md` is wrong. The defect is in **`tasks.md` T-003's disqualifier**, which was written assuming the guard could not disturb existing coverage. It can, for one input, and the affected test is incidentally — not essentially — coupled to the old behaviour.

### Alternatives considered

| Option | Verdict |
|---|---|
| Drop the guard to keep all 25 green | **Rejected.** Ships a real data-corruption path (twenty Core-10 rows), and T-007's re-analyse control makes it reachable. The disqualifier would be protecting a bug |
| Weaken the pre-existing test to `toHaveBeenCalledTimes(0)` | **Rejected.** Destroys the CMV coverage it exists for — its "no `Assessment` write" claim needs the helper to actually run |
| **Retarget the pre-existing test to a non-re-analyse run, and add a test for the guard** | **Recommended.** Preserves the CMV claim in a scenario where its precondition holds, and gives the new behaviour its own gate |
| Treat it as an acceptable known failure | **Rejected.** A permanently red test is indistinguishable from a regression to every future run |

### Proposed spec amendment (not yet applied — awaiting approval)

1. **`tasks.md` T-003 disqualifier** — from *"the 25 pre-existing tests must still pass"* to: *"24 of the 25 pre-existing tests pass unchanged. The one asserting unguarded skeleton creation during a re-analyse is **retargeted, not weakened**: its subject — that `createSkeletonFields` performs no `Assessment` write — must still be asserted, in a non-re-analyse run where the helper executes."*
2. **`tasks.md` T-003 scope** — add the retarget plus one new test asserting the guard: with `reAnalyze: true` and zero resolved jobs, `gapField.createMany` is **not** called.
3. **`design.md` §7.1** — record that the guard changes behaviour a pre-existing CMV test incidentally asserted, and why the retarget preserves that test's real claim.

Cost: roughly 15 lines of test change inside T-003, no change to the fix itself. `design.md` and `requirements.md` need no behavioural change.

### TRD impact

None. No `ADR-NNN` is overturned — this is a handler-level guard, not an architecture decision.

### Work already completed under T-003 and preserved

The query-shape change, `sourceParseJobIds` persistence (verified through `jobs.service.ts` to the stored `Job.result`, both the populated and empty-array cases), the skeleton guard itself, and the untouched separator/header/ordering/truncation behaviour. `pnpm --filter @alliance-risk/api build` passes clean. All three FR-DDP-001 tests are green.

### T-003 — Scope the merge to current documents `[BE]`

| Field | Value |
|-------|-------|
| **Status** | ✅ **PASS** after an approved Pivot (rework attempts not consumed) |
| **Date** | 2026-08-21 |
| **Requirements covered** | FR-DDP-001 Sc 1–3, BR-DDP-001, NFR-DDP-012 |
| **Design ref** | §7.1 |
| **Effort** | `high` |
| **Skills** | `nestjs-expert`, `tdd` (the latter for the amended test work) |

**Pivot resolution applied.** `tasks.md` T-003's disqualifier and scope amended, `design.md` §7.1 extended to record the interaction, correction-closure sweep run in both directions. The guard stayed; the pre-existing test was retargeted.

- **Files changed:** `gap-detection.handler.ts` (implementation), `gap-detection.handler.spec.ts` (one retarget + one new guard test).
- **Verification:** `pnpm --filter @alliance-risk/api test --testPathPattern=gap-detection.handler` → **29 passed, 29 total** (25 pre-existing incl. the retarget + 3 T-002 FR-DDP-001 + 1 new guard).
- **Not Done / Assumptions:** none. One judgment call flagged and not silently taken: the requirement tag chosen for the new tests, since no FR/NFR is written specifically for the skeleton guard.

**Reviewer verdict:** `STATUS: PASS`, with the retarget audited as the highest-value item:

- **The retarget preserves the original claim and is not vacuous.** Traced through the new fixture: with `isReAnalyze === false` the guard is open, so `createSkeletonFields` genuinely executes — the `createMany` precondition would read `0` if it did not. The surviving assertion (`assessment.update` called exactly once, with the exact payload) still discriminates: a helper that wrote to `Assessment` would make it 2. Crucially the retarget **kept the same call site** rather than drifting to the non-UPLOAD `createSkeletonFields` call, which an existing GUIDED_INTERVIEW test already covers — drifting there would have duplicated coverage and abandoned the original path.
- **The guard test is a real gate.** Deleting `!isReAnalyze &&` from the handler makes `execute({ reAnalyze: true })` reach `createSkeletonFields` and fail the assertion. No other `createMany` call site is reachable on that path.
- **The `[]`-vs-absent distinction reaches the persisted result.** `sourceParseJobIds` is declared non-optional, initialised to `[]`, and included unconditionally in `execute()`'s returned literal; `jobs.service.ts:152` assigns that return and `:166` writes it into `Job.result`. `[]` is a JSON value, so it serialises as `"sourceParseJobIds": []` rather than being dropped — **exactly the distinction T-005 reads.**
- Test count reconciles: 29 = 25 pre-existing + 3 T-002 + 1 guard. Nothing weakened; the rejected `toHaveBeenCalledTimes(0)` shortcut was not taken.
- **The Bedrock-failure path recording real ids is correct**, and both alternatives are wrong: the handler swallows the error and the job is marked `COMPLETED`, so this snapshot *will* be read by T-005. Omitting the key would make it indistinguishable from a pre-fix snapshot and withhold content that truthfully describes current documents; recording `[]` would make it permanently non-superseded even after every document it describes is deleted — the original bug.

**ADVISORY (recorded, non-gating)**

| Lens | Finding | Disposition |
|------|---------|-------------|
| Readability | Both tests are tagged `[T-003 guard / NFR-DDP-012]`, but NFR-DDP-012 is a scope constraint, not a behavioural requirement. Doubly misleading on the **retargeted** test, whose subject is the inherited country-match claim — a future maintainer removing the guard could read the tag as licence to delete it, **precisely the incidental coupling this Pivot was fought to break** | Recorded. The 11-line block comment above the test largely mitigates it. Worth correcting at `/akili-archive` |
| Reliability | The `?? []` on `assessmentDocument.findMany` is production code shaped around a test mock — unreachable in production (`findMany` always resolves an array) and unable to mask a real failure, but its only function is to let ~20 pre-existing tests leave the call unstubbed. One `mockResolvedValue([])` in the outer `beforeEach` would achieve the same and let the production fallback go away | Recorded |
| Reliability | Both new tests express "zero resolved jobs" via `job.findMany → []` while leaving the document lookup unstubbed, so neither states its actual premise (zero *current documents*) | Recorded |
| Risk | Most pre-existing tests stub `job.findMany` with `mockResolvedValue`, ignoring the `where` clause, so they are structurally blind to the new `id: { in: … }` scoping. **T-002's three FR-DDP-001 tests are therefore the sole automated gate on the merge-scoping fix** — any future edit to those three fixtures removes all coverage of the reported bug | Recorded — worth a note in the PR description |

---

### T-005 — Withhold an analysis that describes a deleted document `[BE]`

| Field | Value |
|-------|-------|
| **Status** | ✅ **PASS** on attempt 1 |
| **Date** | 2026-08-24 |
| **Requirements covered** | FR-DDP-002 Sc 1–2 (Sc 4 partially — see the coverage gap below), BR-DDP-002, BR-DDP-003 |
| **Design ref** | §7.3, §6, §9 |
| **Effort** | `high` |
| **Skills** | `nestjs-expert`, `api-design-principles` |

**Attempt 1**

- **Files changed:** `assessments.service.ts` only.
- **The rule as implemented:** `sourceParseJobIds.some((jobId) => !currentParseJobIds.has(jobId))` — one-directional subtraction, no status filter, no ordering, no time window. Absent key short-circuits to superseded before the document query runs; a recorded `[]` flows through `.some()` on an empty array and is never superseded.
- **Verification:** `pnpm --filter @alliance-risk/api test --testPathPattern=assessments.service` → **26 passed, 26 total.** Build clean.
- **Not Done / Assumptions:** none.

**Reviewer verdict:** `STATUS: PASS`, after attacking the rule across nine cases (delete only doc; delete one of several; re-parse; add one; add several; `parseJobId: null`; recorded `[]`; absent key; delete-and-add in one session). **No case serves what it should withhold, and none withholds what it should serve.**

Also confirmed: the shared type genuinely **replaced** the inline return type rather than coexisting with it (`design.md` §9); T-002's four fixtures are unedited — they still carry the pre-fix defensive cast and the RED-baseline header comment, neither of which survives a fixture rewritten to fit an implementation; BR-DDP-003's assertions now execute for real; and the producing side never omits the key, so `[]`-vs-absent stays a clean discriminator.

**A factual error in the Implementer's reasoning — confirmed, and provably harmless here.** The report claimed *"a failed parse leaves `parseJobId` null."* It does not: `parseJobId` is written at job **creation** (`assessments.service.ts:270-273`, `:330-333`) and failure sets only `status: 'FAILED'` + `errorMessage` (`parse-document.handler.ts:59-67`), leaving it populated.

The rule still produces the design-mandated verdict, necessarily: a failed-parse document is either newly added — its id was never in the snapshot, and an addition only *grows* the current set, which one-directional subtraction can never be made true by — or a re-parse, which §7.3 already requires to be superseded. The wrong belief can only shrink the *predicted* current set for ids the rule never reads.

**Where the wrong model does bite:** it predicts away a real state. Re-parsing an already-analysed document and having that parse **fail** correctly sets `superseded: true`, leaving the Analyst on a withheld notice whose "Re-analyse now" button resolves nothing until the parse succeeds. Design-conformant, but worth handing to T-007 and T-008 rather than to this task.

**ADVISORY (recorded, non-gating)**

| Lens | Finding | Disposition |
|------|---------|-------------|
| Readability | The comment at `assessments.service.ts:438-441` **encodes the same wrong model** — it says an added-but-unparsed document "is still current and cannot supersede", but such a document is *filtered out* of the current set by the `!== null` guard. It cannot supersede because it is absent from the **snapshot**, not because it is present in the current set. This is the durable artifact of the misconception, and it is what the next maintainer inherits | **Worth correcting at `/akili-archive`.** Not minted as a task |
| Reliability | Prefer `Array.isArray(result.sourceParseJobIds)` over `'sourceParseJobIds' in result` — strictly stronger, preserves both mandated verdicts, and fails closed on JSON `null` and non-array values that `?? []` currently serves open | Recorded |
| Resilience | A truthy non-object `result` makes `in` throw a `TypeError` (500) where the pre-diff code degraded to `null`. Unreachable for `GAP_DETECTION` today, but a new throw path on a read endpoint; the `Array.isArray` change removes it | Recorded |
| Risk / perf | `assessmentDocument.findMany` selects full rows on every polled read while only `parseJobId` is used; `select: { parseJobId: true }` narrows it and is mock-compatible | Recorded |

---

## Coverage Gap — ⚠️ ESCALATED TO USER

**`requirements.md` FR-DDP-002 Sc 4's clause *"AND IT MUST stay readable if B's parse fails"* has no gate anywhere in the plan** — automated or manual.

- `tasks.md` §5 names Sc 4's owners as *T-002 (serve fixture), T-005, T-008 §5*. None of the three covers this clause.
- T-002's fixture 1 gives the added document `parseJobId: 'job-B'` — added **and parsed**. No fixture anywhere sets `parseJobId: null` or `status: 'FAILED'`.
- Manual step 5 walks upload → parse → run. It never induces a parse failure.

So the clause is covered **by argument, not by evidence** — and the argument offered for it was the false one about `parseJobId`. This is precisely the failure mode `tasks.md` §5 exists to prevent: the coverage table asserts ownership that does not hold at clause granularity.

The Reviewer classified it advisory and correctly declined to gate T-005 on it — the clause is outside T-005's contract, which reads "T-002's four fixtures turn green". **This is a `tasks.md` traceability defect, not a T-005 defect.**

Cost to close: roughly 8 lines — a fifth fixture with `{ id: 'doc-B', parseJobId: 'job-B', status: 'FAILED' }` alongside `{ id: 'doc-A', parseJobId: 'job-A' }`, asserting `superseded === false`. It would have caught the mental-model error at authoring time.

Escalated rather than absorbed: minting work from a review finding without approval is exactly what `/akili-execute` → *Advisory Never Becomes A Task* forbids, and the honest alternative — leaving `tasks.md` §5 asserting coverage that does not exist — is worse. Nothing is blocked; T-006 and T-007 can proceed either way.
