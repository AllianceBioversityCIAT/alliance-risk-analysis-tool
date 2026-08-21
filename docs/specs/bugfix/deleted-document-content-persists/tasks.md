# Tasks — Deleted Document Content Persists In Gap Detection

## 1. Document Control

| Field | Value |
|-------|-------|
| **Module** | `docs/specs/bugfix/deleted-document-content-persists` |
| **Requirements** | `./requirements.md` (v2.0) |
| **Design** | `./design.md` (v2.0) |
| **Version** | 1.0 |
| **Date** | 2026-08-21 |
| **Mode** | Bug Mode — T-002 is the mandatory regression task (red before, green after) |

### Budget reconciliation

`design.md` §12 estimated **7 tasks**. Decomposition produced **8**: the manual walkthrough is a task, not a footnote. `requirements.md` §6 records three defect classes with no automated gate (D4, D6, D8), and **KZ-008 exists because exactly that walkthrough was skipped on a prior spec and four real bugs shipped**. A gate nobody owns is a gate nobody runs.

LOC and PR count are unchanged (~300, one PR). The tripwire did its job at authoring time rather than mid-execution.

---

## 2. Legend

| Marker | Meaning |
|--------|---------|
| `[ ]` | Not started |
| `[~]` | In progress |
| `[x]` | Complete (Reviewer PASS + verification green) |
| `[!]` | Blocked |

Tags: `[SHARED]` `[BE]` `[FE]` `[QA]` · Sizes: S ≤ 1 file / ≤ 2 h · M 2–5 files / half day · L 5+ files

**Verification uses the single-dash form** (`--testPathPattern=`) per **KZ-005** — the double-dash form in `general-setup/task.md` §6 is broken in this repo's pnpm: false green on `web`, hard failure on `api`.

---

## 3. Dependency Graph

```
Phase A — foundation
  T-001 [SHARED] shared response type

Phase B — the red test (Bug Mode gate)
  T-002 [BE] regression suite, MUST FAIL on current code
        ↓ (T-003, T-004, T-005 each turn part of T-002 green)
Phase C — backend, parallel after T-002
  T-003 [BE] merge scoping ─┐
  T-004 [BE] delete cleanup ─┼─ different files, safe to parallelise
  T-005 [BE] withholding rule ┘   (T-005 needs T-001)

Phase D — frontend, after T-001 and T-005
  T-006 [FE] hooks: poll bound + cache invalidation ─┐
  T-007 [FE] viewer notice + delete error surface   ─┘ different files

Phase E — gate
  T-008 [QA] manual walkthrough — after T-003…T-007
```

No cycles. T-003 and T-004 touch different files and may run concurrently; T-005 depends only on T-001.

---

## 4. Tasks

### T-001: Shared merged-content response type `[SHARED]`

- **Status:** `[ ]`
- **Skills:** none beyond repo conventions
- **Size:** S · **Dependencies:** None · **Requirements:** enables FR-DDP-002, FR-DDP-003 · **Design Ref:** §9, §6
- **Scope:**
  - `packages/shared/src/types/assessment.types.ts` — add `MergedContentResponse` = `{ mergedMarkdown: string | null; superseded: boolean }`
  - `packages/shared/src/index.ts` — `type` export alongside the existing assessment types
- **Tests:** none — a type declaration with no behaviour
- **Verification:** `pnpm --filter @alliance-risk/shared build`
- **Evidence is disqualified if:** the build passes because the type was added but not exported — check the emitted barrel actually names it
- **Done when:** the shared package builds and `MergedContentResponse` is importable. **Scope the check to this package only** — do not require API or Web to typecheck yet, since their consumers land in T-005…T-007 (**KZ-004**)

---

### T-002: Regression suite — RED before any fix `[BE]`

- **Status:** `[ ]`
- **Skills:** `nestjs-expert`
- **Size:** M · **Dependencies:** None · **Requirements:** FR-DDP-001 Sc 1–3, FR-DDP-002 Sc 1–2 & 4, FR-DDP-004 Sc 1–2, BR-DDP-003 · **Design Ref:** §7.1, §7.2, §7.3, §11
- **Scope:** author the failing tests first, against current behaviour. Mock Prisma per the existing convention (`assessments.service.spec.ts:38`); **do not introduce a test database**. Tag test names with their scenario, matching the existing `[A2 / FR-CMV-006 Sc1] …` format.
  - `gap-detection.handler.spec.ts` — merge input excludes a deleted document's completed job (Sc 1); excludes the middle of three while preserving oldest-first order (Sc 2); **unchanged** two-document merge with no deletions, same order and separator format (Sc 3)
  - `assessments.service.spec.ts` — the four withholding fixtures from `requirements.md` D2:

    | Recorded source | Current documents | Expected |
    |---|---|---|
    | `[jobA]` | `{A, B}` | **serve** — an addition is not a removal |
    | `[jobA]` | `{B}` | **withhold** |
    | `[]` | any | **serve** — a truthful record of a run with nothing to analyse |
    | key absent | any | **withhold** — a pre-fix analysis, unevaluable |

  - `assessments.service.spec.ts` — deletion removes the document **and** its parse job, scoped by id and by `type`; a second document's job and an unrelated `GAP_DETECTION` job survive; the two deletes are one transaction
- **Tests:** this task *is* the tests
- **Verification:** `pnpm --filter @alliance-risk/api test --testPathPattern='gap-detection.handler|assessments.service'` — **MUST FAIL**, and the failures must be assertion failures on the specific behaviours above
- **Evidence is disqualified if:** the suite fails for the wrong reason — a mock wiring error, a missing import, or a thrown `TypeError` is **not** a red test. Read each failure message and confirm it names the behaviour under test. A suite that fails because it cannot run proves nothing
- **Done when:** every listed case fails with a behavioural assertion, and the failure output is recorded in `execution.md` as the red baseline

---

### T-003: Scope the merge to current documents `[BE]`

- **Status:** `[ ]`
- **Skills:** `nestjs-expert`
- **Size:** S · **Dependencies:** T-002 · **Requirements:** FR-DDP-001 Sc 1–3, NFR-DDP-012 · **Design Ref:** §7.1
- **Scope:** `packages/api/src/platform/jobs/handlers/gap-detection.handler.ts`
  - Replace `Job.findMany({ input.assessmentId })` with: load the assessment's current `AssessmentDocument` rows → collect non-null `parseJobId`s → load `COMPLETED` jobs by primary key from that set, keeping `completedAt` ascending
  - Record the resolved ids on the result as `sourceParseJobIds`. **Record `[]` when none resolve — never omit the key.** T-005's rule depends on telling an empty record from an absent one
  - Guard `createSkeletonFields` behind `!isReAnalyze` — the zero-jobs branch currently creates ten Core-10 rows unconditionally while `execute()` deletes them only when not re-analysing, so a re-analyse with nothing to analyse would duplicate the list to twenty. Unreachable today; T-007's control makes it reachable
  - Leave separator format, `## Document: {fileName}` headers, ordering, and truncation untouched
- **Tests:** T-002's handler cases turn green
- **Verification:** `pnpm --filter @alliance-risk/api test --testPathPattern=gap-detection.handler`
- **Evidence is disqualified if:** the 25 pre-existing tests in this suite are not still passing — this task must not change behaviour for assessments with no deletions
- **Done when:** FR-DDP-001 Sc 1–3 green, the pre-existing 25 still green, and no Prisma schema file is touched

---

### T-004: Delete the orphaned parse job with the document `[BE]`

- **Status:** `[ ]`
- **Skills:** `nestjs-expert`, `error-handling-patterns`
- **Size:** S · **Dependencies:** T-002 · **Requirements:** FR-DDP-004 Sc 1–2, NFR-DDP-011, BR-DDP-004 · **Design Ref:** §7.2
- **Scope:** `packages/api/src/domain/assessments/assessments.service.ts` — `deleteDocument()`
  - Wrap both row deletions in one `$transaction`: delete the `AssessmentDocument`, then the `Job` named by the captured `parseJobId`, if any
  - Scope the job delete by **both** `id` and `type: 'PARSE_DOCUMENT'`. Identity alone covers "any other document"; the type filter is what covers "any other job type"
  - Keep S3 deletion **outside** the transaction, best-effort with a warning — an S3 failure must not roll back the row cleanup
  - Leave the `PARSING` guard and ownership check untouched. Enqueue nothing
- **Tests:** T-002's deletion cases turn green
- **Verification:** `pnpm --filter @alliance-risk/api test --testPathPattern=assessments.service`
- **Evidence is disqualified if:** the test asserts only that *a* delete was called. It must assert the arguments — an unscoped `deleteMany`, or a delete missing the `type` filter, has to fail it
- **Done when:** FR-DDP-004 Sc 1–2 green, an assertion proves no job is enqueued on the delete path (NFR-DDP-011), and no schema file is touched

---

### T-005: Withhold an analysis that describes a deleted document `[BE]`

- **Status:** `[ ]`
- **Skills:** `nestjs-expert`, `api-design-principles`
- **Size:** M · **Dependencies:** T-001, T-002 · **Requirements:** FR-DDP-002 Sc 1–2 & 4, BR-DDP-002 · **Design Ref:** §7.3, §6
- **Scope:** `packages/api/src/domain/assessments/assessments.service.ts` — `getMergedContent()`
  - Read the latest `COMPLETED` `GAP_DETECTION` job as today (`completedAt: 'desc'`)
  - Apply the single rule: `superseded` is true when `sourceParseJobIds \ currentParseJobIds ≠ ∅`, where `currentParseJobIds` is every non-null `parseJobId` on the assessment's current documents. **No status filter on the current side, no ordering, no time window**
  - An absent `sourceParseJobIds` key → superseded (a pre-fix analysis, unevaluable). A recorded `[]` → never superseded
  - Return `{ mergedMarkdown, superseded }`; `mergedMarkdown` is `null` whenever `superseded`
- **Tests:** T-002's four withholding fixtures turn green
- **Verification:** `pnpm --filter @alliance-risk/api test --testPathPattern=assessments.service`
- **Evidence is disqualified if:** only the withholding direction is asserted. **The serve direction is the one three prior designs got wrong** — the `[jobA]` / `{A, B}` fixture must fail the suite if the rule ever withholds on an addition. A green run without that fixture present is not evidence
- **Done when:** all four fixtures green, the response carries `superseded`, and no schema file is touched

---

### T-006: Bound the poll and invalidate the cache `[FE]`

- **Status:** `[ ]`
- **Skills:** `vercel-react-best-practices`
- **Size:** M · **Dependencies:** T-001, T-005 · **Requirements:** NFR-DDP-010, FR-DDP-002 Sc 3, FR-DDP-003 Sc 2 · **Design Ref:** §8.2, §8.3
- **Scope:**
  - `use-merged-content.ts` — consume the shared type; stop polling immediately when `superseded`; otherwise cap consecutive empty polls. **Record the chosen cap and its basis in `execution.md`** — it must exceed observed analysis duration, since §8.3's invalidation is the backstop, not the primary refresh
  - `use-multi-document-status.ts` — add `onSuccess` to `useDeleteDocument` invalidating `['merged-content', assessmentId]` and `['gap-fields', assessmentId]`, per the pattern at `use-assessments.ts:118-127`
  - `gap-detector-client.tsx` — amend **both** completion effects (`:196-203` and `:215-221`, which today invalidate only `['assessment', id]`) to also invalidate `['merged-content', id]` and `['gap-fields', id]`. Amending only one leaves the server-chained run with no refresh path
  - **NEW** `hooks/__tests__/use-merged-content.test.ts` — the poll decision per response shape
  - **NEW** `hooks/__tests__/use-multi-document-status.test.ts` — the invalidation call fires with both query keys
- **Verification:** `pnpm --filter @alliance-risk/web test --testPathPattern='use-merged-content|use-multi-document-status'`
- **Evidence is disqualified if:** the command reports success having collected **zero tests**. The web test script runs with `--passWithNoTests`, so a mis-named file exits `0` while proving nothing — confirm the reported test count is non-zero and matches the cases written
- **Done when:** polling continues below the cap, stops at it, and stops immediately on `superseded`; both new suites green with a non-zero count; both completion effects amended

---

### T-007: Explain withheld content and surface failed deletions `[FE]`

- **Status:** `[ ]`
- **Skills:** `shadcn-ui`, `tailwind-design-system`, `vercel-react-best-practices`
- **Size:** M · **Dependencies:** T-001, T-005 · **Requirements:** FR-DDP-003 Sc 1–3, FR-DDP-004 Sc 3 · **Design Ref:** §8.1, §8.4, §10
- **Scope:**
  - `document-viewer.tsx` — accept `superseded: boolean` and `onReAnalyze?: () => void`; render the withheld notice with a **"Re-analyse now"** action. Copy must not assert a cause — content is withheld for deletion, for re-parsing, and for pre-fix analyses, and these are indistinguishable from the stored record. Use the `--warning` token (`docs/ux-ui/design.md:129`), never raw hex. The component stays presentational
  - `gap-detector-client.tsx` — pass `hasDocument` based on `intakeMode === 'UPLOAD'` alone, so the panel stays mounted and `DocumentViewer` renders the state instead of the panel vanishing; wire `superseded` and `onReAnalyze` from the existing `useReAnalyzeGaps` + `startPolling` (`:184-185`); with zero documents remaining, offer **Manage Documents**, not re-analysis
  - `upload-business-plan-modal.tsx` — in `handleRemoveFile` (`:179`), swallow only a **404** (already gone server-side — remove the row); surface every other failure via **sileo** (`packages/web/CLAUDE.md:204`) and **keep the row listed**
  - **NEW** `components/gap-detector/__tests__/document-viewer.test.tsx`
- **Verification:** `pnpm --filter @alliance-risk/web test --testPathPattern=document-viewer`
- **Evidence is disqualified if:** the gate is `gap-detector-client` instead. That suite mocks `next/dynamic` to substitute a `DocumentViewerStub` (`gap-detector-client.test.tsx:44-49`), so **no input to it can fail** if the notice or button is missing or mis-wired. Also disqualified if the assertion only checks that *some* text rendered — it must distinguish the withheld notice from the ordinary empty state, or it proves presence rather than behaviour
- **Done when:** the three UI conditions render distinguishably, the re-analyse action reaches the existing endpoint, a failed non-404 delete keeps the row and toasts, and the new suite is green with a non-zero count

---

### T-008: Manual browser walkthrough `[QA]`

- **Status:** `[ ]`
- **Skills:** none
- **Size:** M · **Dependencies:** T-003, T-004, T-005, T-006, T-007 · **Requirements:** FR-DDP-002 Sc 3–4, FR-DDP-003 Sc 1–3, FR-DDP-004 Sc 3, NFR-DDP-010 · **Design Ref:** §11
- **Scope:** run all nine steps in `requirements.md` §6 against a local stack (`docs/infrastructure.md` §6), recording pass/fail per step in `execution.md`.
- **Why this is a task and not a footnote:** D4 (cross-screen cache invalidation), D6 (is the copy comprehensible) and D8 (cross-field propagation) have **no automated gate for the property that matters**. `KZ-008` is in the kaizen log because this walkthrough was skipped on a prior spec and four real bugs — cache invalidation, scope-too-narrow design, cross-field propagation — reached "archive-ready" invisible to green mocked tests.
- **Highest-value steps:**
  - **Step 5** — upload a second document to an already-analysed assessment; the existing analysis must stay readable through upload, parsing, **and the new analysis run**. Three prior designs failed here, the last one during the analysis-run window specifically
  - **Step 1** — delete on `/assessments/upload`, then check `/assessments/gap-detector`. This is the cross-screen path no mocked test can see
  - **Step 9** — force a delete to fail (offline); the row must stay listed
- **Verification:** the walkthrough itself
- **Evidence is disqualified if:** any step is recorded as passed without being run, or if a step is run against a stale build. Rebuild the shared package and both dev servers first. **"Unit tests were green" is not a substitute for any step here** — that inference is precisely what KZ-008 records as having failed
- **Done when:** all nine steps recorded pass, or any failure is logged and routed back to the owning task

---

## 5. Requirement Coverage

Closure at **scenario and clause** granularity — a requirement ID appearing in a task is not coverage.

| Requirement | Scenario / clause | Owning task(s) |
|---|---|---|
| FR-DDP-001 | Sc 1 (delete + replace), incl. "name only B" and "must NOT contain A" | T-002, T-003 |
| | Sc 2 (delete one of several), incl. oldest-first order | T-002, T-003 |
| | Sc 3 (no deletions — unchanged), incl. separator format | T-002, T-003 |
| FR-DDP-002 | Sc 1 (delete only doc), incl. "not at any later point" | T-002, T-005 |
| | Sc 2 (delete one of several, never re-run) | T-002, T-005 |
| | Sc 3 (survives reload), incl. "not from any client-side cache" | T-006, T-008 §2 |
| | Sc 4 (addition withholds nothing) — all three `AND IT MUST` and the "at any point" clause | T-002 (serve fixture), T-005, T-008 §5 |
| FR-DDP-003 | Sc 1, incl. "distinguishable from never analysed", "must NOT render deleted text", "must NOT drop the panel", "must not state a cause it cannot know" | T-007, T-008 §2 |
| | Sc 2 (clears without manual reload) | T-006, T-008 §8 |
| | Sc 3 (last document deleted — offer upload, not re-analysis) | T-007, T-008 §4 |
| FR-DDP-004 | Sc 1, incl. "by own identity" and "not any other job type" | T-002, T-004 |
| | Sc 2 (both or neither) | T-002, T-004 |
| | Sc 3 (failed delete not reported as success) | T-007, T-008 §9 |
| NFR-DDP-010 | all four clauses | T-006, T-008 §3 |
| NFR-DDP-011 | zero model invocations | T-004 |
| NFR-DDP-012 | no migration, no unrelated cleanup | T-003, T-004, T-005 done-when |
| BR-DDP-001 | current records, not historical jobs | T-003 |
| BR-DDP-002 | only removal invalidates; addition makes incomplete | T-005 |
| BR-DDP-003 | Analyst edits survive | T-002 |
| BR-DDP-004 | deletion never triggers AI work | T-004 |

Every scenario and every `AND IT MUST` / `BUT it must NOT` clause has a named owner. No gap is discharged by citing a different requirement.

---

## 6. PR Strategy

**One PR**, ordered `shared → api → web`.

At ~300 LOC across three packages this is a single reviewable unit. No constitutional LOC threshold exists in this project, and repo precedent runs toward single PRs at this size — the tracking-analytics spec recorded *"Single PR recommended … even at the actual ~370 LOC"*.

Commit format: `[SPEC:bugfix/deleted-document-content-persists] <imperative message>`

Suggested review order for the PR description: **T-005 first** — the withholding rule is the whole design, and its serve-direction fixture is what three earlier designs got wrong. Everything else is mechanical by comparison.

---

## 7. Task Plan Checklist

- [x] Every FR/NFR/BR maps to ≥1 task, at scenario and clause granularity (§5)
- [x] Each task has an explicit verification command **and an explicit disqualifier**
- [x] Dependencies form a DAG, no cycles (§3)
- [x] Skills come from the project Skill Map
- [x] Cross-package tasks ordered `shared → api → web`
- [x] No migration task — none required
- [x] T-001's "Done when" is scoped to its own package and does not require consumers to typecheck (**KZ-004**)
- [x] Verification uses the single-dash `--testPathPattern=` form (**KZ-005**)
- [x] Bug Mode: T-002 is a regression task that must be **red** before T-003–T-005 and green after
- [x] The manual walkthrough is an owned task, not a footnote (**KZ-008**)
