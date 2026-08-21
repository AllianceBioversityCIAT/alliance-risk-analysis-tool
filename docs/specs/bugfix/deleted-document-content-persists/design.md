# Design — Deleted Document Content Persists In Gap Detection

## 1. Document Control

| Field | Value |
|-------|-------|
| **Module** | `docs/specs/bugfix/deleted-document-content-persists` |
| **Requirements ref** | `./requirements.md` (v2.0) |
| **Proposal ref** | `./proposal.md` (v1.2) |
| **Review history** | `./judgment.md` — v1.x lineage, escalated |
| **Version** | 2.0 |
| **Date** | 2026-08-21 |
| **Depth** | Standard (Bug Mode) |
| **Migration required** | No |

### Why there is a v2.0

The v1.x lineage went through two Judgment Day fix rounds and escalated with two severe findings open. The cause was not the individual defects — it was the shape of the design. v1.x asked **"does the snapshot's document set still equal the current one?"** and treated every inequality as a deletion. That question is wrong in a way that is expensive to patch: adding a document also makes the sets unequal, so valid content kept being withheld and the Analyst kept being told a document had been removed when one had been added. Three successive fixes each corrected the symptom in one time window and moved it to the next.

v2.0 asks a different question:

> **Does the snapshot contain a document that no longer exists?**

That question has one answer, no time windows, and no states. The five-state machine, the in-flight tracking, the recency window, the client attempt-cap-as-correctness-mechanism, and the legacy filename fallback are all **deleted** — every one of them existed to contain a consequence of asking the wrong question.

| | v1.2 (escalated) | v2.0 |
|---|---|---|
| Tasks | 12 | 8 |
| Lines of code | ~810 | ~300 |
| API fields added | `freshness` enum (5 values) + `analysisInFlight` | one boolean |
| New shared enum | yes | no |
| Severe findings open | 2 | — |

**What carries over unchanged:** the merge-scoping fix (`DD-DDP-001`), which every one of the four review passes confirmed sound. That is the fix for the reported bug.

---

## 2. Executive Summary

| # | Change | Fixes | Requirements |
|---|--------|-------|--------------|
| 1 | Build the gap-detection input from the assessment's **current documents**, and record which parse jobs fed the result | Scenario 1 — delete + replace | FR-DDP-001 |
| 2 | On read, withhold the stored analysis if it references a document that no longer exists | Scenario 2 — delete only | FR-DDP-002 |
| 3 | Say so on screen, with a way to refresh; invalidate the client cache on deletion and on run completion | The visible half of Scenario 2 | FR-DDP-003 |
| 4 | Delete the orphaned parse job with the document | Storage growth | FR-DDP-004 |

No schema migration: change 1's record lives in a JSON column that already exists.

---

## 3. Architecture & Data Flow

```
 DELETE /assessments/:id/documents/:docId
   └─ deleteDocument()
        ├─ S3 object deleted                     ✓ already correct
        ├─ AssessmentDocument row deleted         ✓ already correct
        └─ PARSE_DOCUMENT Job row                ✗ never deleted        → change 4

 Gap-detection run (chained after documents parse)
   └─ processUploadMode()
        └─ Job.findMany({ input.assessmentId })  ✗ every historical job,
                                                    including deleted   → change 1
             └─ merge → Bedrock
                  └─ persisted to the GAP_DETECTION job's result

 GET /assessments/:id/merged-content
   └─ getMergedContent()
        └─ serves that stored result verbatim    ✗ never checks whether the
                                                    documents still exist  → change 2
             └─ web: useMergedContent → DocumentViewer
                  ✗ no cache invalidation on delete or on completion    → change 3
                  ✗ polls every 5s forever when content never arrives   → change 3
```

**Entry points:** one job handler method, two service methods, two hooks, two components, one modal call site. No new routes.

---

## 4. Extended Directory Structure

```
packages/shared/src/
├── types/assessment.types.ts                 EDIT — MergedContentResponse
└── index.ts                                  EDIT — export it

packages/api/src/
├── platform/jobs/handlers/
│   ├── gap-detection.handler.ts              EDIT — §7.1
│   └── gap-detection.handler.spec.ts         EDIT — FR-DDP-001 tests
└── domain/assessments/
    ├── assessments.service.ts                EDIT — §7.2, §7.3
    └── assessments.service.spec.ts           EDIT — FR-DDP-002/004 tests

packages/web/src/
├── hooks/
│   ├── use-merged-content.ts                 EDIT — §8.2 bounded poll
│   ├── use-multi-document-status.ts          EDIT — §8.3 invalidate on delete
│   └── __tests__/
│       ├── use-merged-content.test.ts        NEW  — poll bound (D5)
│       └── use-multi-document-status.test.ts NEW  — invalidation call (D4)
├── components/
│   ├── gap-detector/
│   │   ├── document-viewer.tsx               EDIT — §8.1 superseded notice
│   │   └── __tests__/document-viewer.test.tsx NEW — FR-DDP-003 gate
│   └── assessment/
│       └── upload-business-plan-modal.tsx    EDIT — §10 surface failed deletes
└── app/(protected)/assessments/gap-detector/
    └── gap-detector-client.tsx               EDIT — §8.1 panel, §8.3 invalidation
```

Nine source files, three new test files.

---

## 5. Data Model

**No migration.**

| Model | Change |
|-------|--------|
| `Job` (`GAP_DETECTION`) | `result` (`Json?`, `schema.prisma:194`) gains `sourceParseJobIds: string[]` — additive, application-layer only |
| `AssessmentDocument` | Unchanged. `parseJobId` (`String? @unique`, `schema.prisma:297`) is the authoritative document→job link |

### Verified link integrity (KZ-003 — read, not assumed)

Every path that creates a `PARSE_DOCUMENT` job writes `parseJobId` back onto the document in the same call: `triggerParseDocument` (`assessments.service.ts:265`), `triggerParseAllDocuments` (`:325`), worker DOCX reprocess (`worker.ts:228`). So traversing document→job is complete: no parsed document is reachable only through the old `input.assessmentId` query.

**Pre-existing, out of scope, recorded:** job creation and the `parseJobId` write are not one transaction, so a crash between them leaves a job with no document link. Such a job is already invisible to the document-status UI, so excluding it is fail-closed and correct.

---

## 6. API Design

| Method | Path | Auth | Response |
|--------|------|------|----------|
| `GET` | `/api/assessments/:id/merged-content` | `JwtAuthGuard` + ownership | `{ mergedMarkdown: string \| null, superseded: boolean }` |
| `DELETE` | `/api/assessments/:id/documents/:documentId` | `JwtAuthGuard` + ownership | `204` — unchanged |
| `POST` | `/api/assessments/:id/gap-fields/re-analyze` | `JwtAuthGuard` + ownership | `201` — unchanged, newly reachable from the UI |

The re-analyse route responds **201**, not 202: `@Post('re-analyze')` (`gap-field.controller.ts:36`) carries no `@HttpCode` decorator, so NestJS's POST default applies — unlike `assessments.controller.ts`, which decorates `ACCEPTED` and `NO_CONTENT` explicitly.

**`superseded` is one boolean, deliberately.** It answers exactly one question — *is the stored analysis describing a document that is gone?* — and nothing else. Everything the client needs beyond that it already has: whether documents exist comes from `useMultiDocumentStatus`, and whether content is present is `mergedMarkdown` itself. v1.x added a five-value enum to describe situations the client could already see, and each added value brought its own reachable-but-unspecified combination.

When `superseded` is `true`, `mergedMarkdown` is `null`. That is what satisfies FR-DDP-002's *must NOT return A's content*.

**Additive and backward compatible.** The controller returns the service result directly (`assessments.controller.ts:126-132`) with no response-wrapping interceptor, and the web client reads `mergedMarkdown` at the top level (`use-merged-content.ts:7`).

**On the `ApiResponse<T>` envelope — escalated, not waived.** Root `CLAUDE.md` mandates it for all API responses; it is used by **zero** endpoints (all 125 `ApiResponse` occurrences under `packages/api/src` are the `@nestjs/swagger` decorator). Complying here would make this the only enveloped endpoint in the codebase. That is a repo-wide rule/reality mismatch belonging to the constitution or TRD, not to a bugfix — recorded as `requirements.md` OQ-2.

---

## 7. Backend Logic

### §7.1 `GapDetectionHandler.processUploadMode` (FR-DDP-001)

Replace `Job.findMany({ input.assessmentId })` with a two-step resolution:

1. Load the assessment's current `AssessmentDocument` rows; collect their non-null `parseJobId` values.
2. Load `COMPLETED` jobs by primary key from that set, preserving the existing `completedAt` ascending order.

Merge and truncate exactly as today — separator format, `## Document: {fileName}` headers, oldest-first order, `maxInputCharacters` truncation all unchanged (FR-DDP-001 Scenario 3).

Record the resolved job ids on the result as `sourceParseJobIds`. **When zero jobs resolve, record an empty array** — not an absent key. An empty array is a truthful record that the run had nothing to analyse; §7.3 relies on being able to tell it apart from a pre-fix snapshot that recorded nothing at all.

**Skeleton-field guard.** The zero-jobs branch calls `createSkeletonFields` unconditionally (`gap-detection.handler.ts:135` → `gapField.createMany` at `:509`), but `execute()` deletes existing fields only when `!isReAnalyze` (`:65`). A re-analyse resolving zero jobs therefore **adds** ten Core-10 rows on top of the existing ten. That path is unreachable today because nothing offers re-analysis in that state; §8.1's control makes it reachable. Guard the skeleton creation behind `!isReAnalyze`.

### §7.2 `AssessmentsService.deleteDocument` (FR-DDP-004)

Wrap both row deletions in one `$transaction`: delete the `AssessmentDocument`, then delete the `Job` named by the captured `parseJobId`, if any.

- Scope the job delete by **both** `id` and `type: 'PARSE_DOCUMENT'`. Identity covers the "any other document" half of FR-DDP-004's negative clause; the type filter covers the "any other job type" half — `parseJobId` is unique per document but says nothing about the job's type.
- Never a `deleteMany` scoped by assessment.
- S3 deletion stays **outside** the transaction, best-effort with a warning, exactly as today.
- The existing `PARSING` guard and ownership check are untouched.
- No gap-detection job is enqueued (NFR-DDP-011).

### §7.3 `AssessmentsService.getMergedContent` (FR-DDP-002)

Read the latest `COMPLETED` `GAP_DETECTION` job as today (`completedAt: 'desc'`, `assessments.service.ts:401`). Then apply **one rule**:

> `superseded` is true when the snapshot references a parse job that is **no longer** the `parseJobId` of any current document.
>
> In set terms: `sourceParseJobIds \ currentParseJobIds ≠ ∅`
> where `currentParseJobIds` is every non-null `parseJobId` on the assessment's current documents.

Nothing else. No status filter on the current side, no ordering, no time window.

| Situation | `superseded` | Content served? | Why |
|-----------|--------------|-----------------|-----|
| Document deleted | **true** | No | Its job is in the snapshot and attached to nothing |
| Document re-parsed | **true** | No | The document now points at a new job; the snapshot describes superseded text |
| Document added, not yet parsed | false | **Yes** | Nothing the snapshot references has gone |
| Document added, parsing now | false | **Yes** | Same — the analysis stays readable while the next one computes |
| Document added, parse failed | false | **Yes** | Same |
| Document added, parsed, gap run in flight | false | **Yes** | Same. **This is the case that defeated v1.x three times** |
| No analysis has ever run | false | No — there is nothing to serve | Not a supersession |
| Snapshot predates this fix (no `sourceParseJobIds` key) | **true** | No | Unevaluable, so fail closed |

**Why direction is the whole design.** Asking *"do the sets differ?"* conflates two opposite events: a document was removed (the snapshot is now **wrong** — withhold) and a document was added (the snapshot is merely **incomplete** — nothing in it is false, so serve it). Only removal justifies withholding. v1.x tested inequality, so every addition looked like a removal, and each fix narrowed the time window in which that misreading applied rather than removing the misreading. Subtraction in one direction is the entire fix.

**Legacy snapshots fail closed.** A pre-fix snapshot has no `sourceParseJobIds` key and cannot be evaluated, so it is superseded. v1.x tried comparing the `## Document: {fileName}` headers embedded in the stored markdown instead; that failed in the direction that matters — deleting a document and uploading a corrected file *with the same name*, the literal flow in `proposal.md` §3, produced matching filenames and served the deleted content. One notice per pre-existing assessment, cleared by one re-analysis, is the correct price; those are exactly the assessments this bug may already have corrupted.

An empty `sourceParseJobIds: []` is **not** the legacy case — it is a complete record of a run that resolved nothing, and it is never superseded (nothing to subtract). §7.1 is what makes the two distinguishable, and `tasks.md` must test both.

---

## 8. Frontend / UX Component Architecture

### §8.1 The superseded notice (FR-DDP-003)

**Current behavior, verified:** `gap-detector-client.tsx:721` passes `hasDocument && !!mergedMarkdown` into `GapLayout`, which renders the document `<aside>` only when true — so absent content removes the panel and collapses the grid to one column. `DocumentViewer` already owns an empty state (`FileX` + "No document content available", `document-viewer.tsx:404`) that this gating makes unreachable.

**Target:** mount the panel whenever `intakeMode === 'UPLOAD'` and let `DocumentViewer` render. `GapLayout`'s contract is unchanged; only the value passed to it changes.

`DocumentViewer` stays presentational, gaining `superseded: boolean` and `onReAnalyze?: () => void` from `gap-detector-client.tsx`, where `useReAnalyzeGaps` and `startPolling` already live (`:184-185`). No data fetching moves into the component.

| Condition | Copy (OQ-1 — confirm at HITL) | Action |
|-----------|-------------------------------|--------|
| `superseded` | "This analysis no longer matches the current documents — one of them was removed or replaced." | **"Re-analyse now"** |
| Content present | existing viewer | existing |
| No content, not superseded, documents exist | existing "No document content available" | none |
| No content, no documents | existing empty state | "Manage Documents" |

The copy says **"removed or replaced"** rather than asserting a removal: the rule fires on deletion, on re-parse, and on legacy snapshots, and the server cannot always distinguish which. v1.x's copy asserted a removal for all three, which was false for two of them.

Token: `--warning` (`#F48C06`, `docs/ux-ui/design.md:129`). No raw hex.

**Only one new state.** Everything else on this screen is a condition the client can already evaluate from data it holds.

### §8.2 Bounded polling (NFR-DDP-010)

`useMergedContent`'s `refetchInterval` returns `5000` whenever `mergedMarkdown` is falsy (`use-merged-content.ts:31`) and `false` once content arrives — so a response that will never carry content polls forever.

**Bound it by attempts, not by knowing why.** Keep polling while content is absent, stop after a bounded number of consecutive empty responses, and stop immediately when `superseded` is true.

This is deliberately dumber than v1.x's approach, and more robust for it. v1.x tried to poll exactly as long as an analysis was genuinely running, which required tracking job state — and that tracking was itself unbounded, because a job that fails below its attempt limit is reset to `PENDING` and **nothing in the platform ever retries it** (`jobs.service.ts:222-232`; `processJob` is reachable only from `worker.ts:273`, `jobs.service.ts:192`, and `:241` — no queue, scheduler, or reaper). An attempt cap needs no such knowledge and cannot be defeated by a stuck job. The cost is that a genuinely slow run may stop polling before it finishes; §8.3's invalidation on completion is what covers that, and `tasks.md` must set the cap above observed run duration.

Fixing the missing retry driver is out of scope — a pre-existing platform defect, recorded because this NFR would otherwise inherit it silently.

### §8.3 Cache invalidation (KZ-008 — defect class D4)

`['merged-content']` is invalidated **nowhere** in the web package. Two sites are needed:

**On deletion.** `useDeleteDocument` (`use-multi-document-status.ts:80`) has no `onSuccess` and no `invalidateQueries` at all. With `useMergedContent`'s `staleTime: 60_000`, a correct backend still serves a minute of cached deleted content. Add `onSuccess` invalidating `['merged-content', assessmentId]` and `['gap-fields', assessmentId]`, per the pattern at `use-assessments.ts:118-127`.

**On run completion.** `gap-detector-client.tsx` has **two** completion effects — one keyed on `useJobPolling`'s status (`:196-203`, the re-analyse path) and one keyed on `gapData.total` going 0 → positive (`:215-221`, which cannot fire on an already-analysed assessment). Both invalidate only `['assessment', id]`. **Amend both** to also invalidate `['merged-content', id]` and `['gap-fields', id]`. Without this the notice never clears after a successful re-analysis, and §8.2's attempt cap has no backstop.

**This is the cross-screen half of the bug and mocked tests cannot prove it** — deletion happens on `/assessments/upload`, the stale render on `/assessments/gap-detector`. A unit test asserts the invalidation call fires; only the browser walkthrough proves the effect.

### §8.4 Reaching re-analysis

`useReAnalyzeGaps` exists and works, but is only ever called from the debounced save-on-field-edit path (`gap-detector-client.tsx:232-239`). An Analyst looking at a superseded analysis has no field to edit, so without a control the remedy is unreachable and FR-DDP-003's "names the remedy" is unsatisfiable. `proposal.md` §6 permitted a new control on exactly this finding. The notice carries the button; no new endpoint, no new hook.

§7.1's skeleton-field guard is this control's safety precondition.

---

## 9. Shared Contracts

| Artifact | Location |
|----------|----------|
| `MergedContentResponse` (`{ mergedMarkdown: string \| null; superseded: boolean }`) | `packages/shared/src/types/assessment.types.ts` — replaces the local interface at `use-merged-content.ts:6-8` |
| Barrel export | `packages/shared/src/index.ts`, as a `type` export |

No new enum. Build order is mandatory: `pnpm --filter @alliance-risk/shared build` before API or Web.

---

## 10. Security & Error Handling

- **Authorization unchanged.** All touched endpoints keep `JwtAuthGuard` and the `findOne` ownership check. `superseded` is derived from records already inside the ownership boundary.
- **Fail closed.** Anything unevaluable — a legacy snapshot above all — is superseded. Withholding content the user may be entitled to is recoverable with one click; serving deleted content is the bug.
- **A failed deletion must stop being silent.** `useDeleteDocument`'s only consumer is `handleRemoveFile` (`upload-business-plan-modal.tsx:179`), which wraps the call in `try { … } catch { }` (`:188-190`) and then removes the row **unconditionally** (`:193`). A failed deletion is therefore invisible: the user believes the document is gone while the row, its job, and a matching snapshot all survive — reproducing this bug with a stronger illusion of success. Swallow only a **404** (already gone server-side — intent satisfied, remove the row); surface every other failure via **sileo** (`packages/web/CLAUDE.md:204`) and keep the row.
- **Transaction failure** in `deleteDocument` surfaces as a `500` with nothing deleted — retryable, and now visible.
- **No Bedrock call on any read or delete path** (NFR-DDP-011).

---

## 11. Testing Strategy

Single-dash form per **KZ-005** — the double-dash form in `general-setup/task.md` §6 is broken in this repo's pnpm. Baseline confirmed: `pnpm --filter @alliance-risk/api test --testPathPattern=gap-detection.handler` → 25 passed, 2.55 s.

Both API specs mock Prisma (`assessments.service.spec.ts:38`); follow that convention. Existing tests tag names with their scenario (`[A2 / FR-CMV-006 Sc1] …`); keep that format.

| Suite | Command | Covers | Input that makes it FAIL |
|-------|---------|--------|--------------------------|
| API — handler | `…api test --testPathPattern=gap-detection.handler` | FR-DDP-001, skeleton guard | Documents `{B}` plus a completed job for deleted A; fails if A's text appears in the merge |
| API — service | `…api test --testPathPattern=assessments.service` | FR-DDP-002, FR-DDP-004 | Snapshot `[jobA]` with documents `{A, B}` → must be **not** superseded; snapshot `[jobA]` with documents `{B}` → must be superseded; `[]` → never superseded; absent key → superseded |
| Web — viewer | `…web test --testPathPattern=document-viewer` — **NEW FILE** | FR-DDP-003 | Rendering superseded with no re-analyse affordance, or with the same text as the empty state |
| Web — merged-content hook | `…web test --testPathPattern=use-merged-content` — **NEW FILE** | NFR-DDP-010 (D5) | A poll that returns an interval past the cap, or one that stops while content is still expected |
| Web — delete hook | `…web test --testPathPattern=use-multi-document-status` — **NEW FILE** | D4's automated half | A delete mutation whose success handler does not invalidate the merged-content query |
| **Manual walkthrough** | `requirements.md` §6 — 9 steps | **D4, D6, D8 — no automated gate for the property that matters** | — |

**The FR-DDP-003 gate is `document-viewer`, not `gap-detector-client`.** The latter mocks `next/dynamic` to substitute a `DocumentViewerStub` (`gap-detector-client.test.tsx:44-49`), so no input to it could fail if the notice or the button were missing or mis-wired.

Mocked suites remain structurally blind to cross-screen cache invalidation (D4), to whether the copy is comprehensible (D6), and to cross-field propagation (D8). For those the walkthrough is the only gate.

---

## 12. Budget (tripwire for `/akili-execute`)

| Metric | Expected |
|--------|----------|
| Tasks | **8** |
| Lines of code | ~300 (≈90 backend, ≈80 frontend, ≈130 tests) |
| Review rounds | 1 |

*Revised from 7 to 8 during decomposition:* the manual walkthrough is an owned task, not a footnote. `requirements.md` §6 records three defect classes with no automated gate, and **KZ-008** exists because that walkthrough was skipped on a prior spec and four real bugs shipped past green mocked tests. LOC and PR count are unchanged.

Sized against the finished design. **Standard** depth, comfortably — the v1.x lineage sat at the upper edge of it at 12 tasks and ~810 LOC, and every unit of that excess was scaffolding around the wrong question.

**PR strategy: one PR.** No constitutional LOC threshold exists in this project, and repo precedent runs toward single PRs at this size (the tracking-analytics spec recorded "Single PR recommended … even at the actual ~370 LOC"). At ~300 LOC the `shared → api → web` ordering is a task-ordering concern, not a review-surface one.

`/akili-execute` should stop and escalate if actuals exceed these numbers.

---

## 13. Decision Records

### DD-DDP-001: Resolve merge input through current documents

**Status:** Accepted — carried unchanged from v1.x, confirmed sound by all four review passes
**Context:** `processUploadMode` trusts `input.assessmentId` on the job, which records where a job came from, never whether its document still exists.
**Decision:** Traverse `AssessmentDocument → parseJobId → Job`. The document set is the authority on what belongs to an assessment.
**Alternatives:** Filter the existing query by a `documentId`-exists subquery — same result, more coupling to the JSON `input` shape the defect already over-trusted.
**Consequences:** Correct by construction; verified complete — all three parse paths write `parseJobId` (§5).

### DD-DDP-002: Record source parse jobs on each snapshot

**Status:** Accepted
**Context:** Supersession cannot be judged later without knowing what the snapshot was built from.
**Decision:** Persist `sourceParseJobIds` in the `GAP_DETECTION` result's existing JSON column — an empty array when nothing resolved, never an absent key.
**Alternatives:** A join table — a migration for data with no independent lifetime.
**Consequences:** No migration. §7.1 already resolves this list, so recording it is free.

### DD-DDP-003: One directional rule instead of a state model

**Status:** Accepted — **this is the v2.0 decision**
**Context:** v1.x classified the relationship between snapshot and documents into five states, then added an orthogonal in-flight flag, a recency window, and a client cap to contain the consequences. It escalated with two severe findings still open, having relocated the same defect three times.
**Decision:** Ask only whether the snapshot references a document that no longer exists — a one-directional set subtraction. Serve the content otherwise.
**Alternatives:** *Set equality (v1.x)* — conflates addition with removal, so every upload reads as a deletion; every subsequent fix narrowed the window in which that misreading applied rather than removing it. *A persisted staleness flag* — a migration, plus a second source of truth that can drift from the document set it describes. *Deleting superseded job rows* — destroys run history.
**Consequences:** No migration, no enum, no state machine, no time windows. Addition, re-parse, parse failure, and in-flight runs all fall out of the single rule without special cases. The trade is that supersession cannot distinguish deletion from re-parse from a legacy snapshot — which is why §8.1's copy says "removed or replaced" instead of asserting a cause it does not know.

### DD-DDP-004: Transactional orphan cleanup, scoped by identity and type

**Status:** Accepted
**Context:** No cascade exists and none can be expressed — the FK is on `AssessmentDocument.parseJobId` pointing *to* `Job`, so referential actions run the wrong direction (`proposal.md` §10 Option B, infeasible).
**Decision:** Application-level `$transaction` deleting the document then its own parse job, constrained by `id` **and** `type`.
**Consequences:** No migration, no blast radius on the shared `Job` model.

### DD-DDP-005: Deletion never triggers analysis; the notice carries the trigger

**Status:** Accepted
**Context:** Auto-running on delete would spend a Bedrock call per deletion — *n* deletions, *n* runs.
**Decision:** Deletion enqueues nothing. The superseded notice exposes "Re-analyse now", reusing the existing endpoint and hook.
**Alternatives:** *Auto-re-analyse* — rejected in `proposal.md` §10, recorded as a Non-Goal. *No control* — leaves FR-DDP-003 unsatisfiable, since the existing trigger only fires on a field save.
**Consequences:** Zero AI cost per deletion. Requires §7.1's skeleton guard to be safe.

### DD-DDP-006: Bound the poll by attempts, not by job state

**Status:** Accepted
**Context:** The poll runs while content is absent and stops only when content arrives, so a permanently empty response polls forever.
**Decision:** Cap consecutive empty polls; stop immediately on `superseded`.
**Alternatives:** *Track whether an analysis is in flight (v1.x)* — requires reading job state, and that signal is itself unbounded because nothing retries a job reset to `PENDING`. A cap needs no such knowledge and a stuck job cannot defeat it.
**Consequences:** A very slow run may stop polling before finishing; §8.3's invalidation on completion is the backstop, and the cap must be set above observed run duration.

### DD-DDP-007: Keep the document panel mounted for UPLOAD assessments

**Status:** Accepted — **reversion challenged, see §14**
**Context:** Absent content currently removes the whole panel, which reads as "still loading" or "nothing uploaded".
**Decision:** Mount whenever `intakeMode === 'UPLOAD'`; `DocumentViewer` renders the state.
**Consequences:** Reaches the empty state `DocumentViewer` already implements. Changes the loading-state layout — see the challenge.

### DD-DDP-008: Surface a failed deletion instead of swallowing it

**Status:** Accepted
**Context:** The only `useDeleteDocument` consumer catches every error and removes the row regardless, so a failed deletion looks successful.
**Decision:** Swallow only a 404; toast other failures via sileo and keep the row.
**Alternatives:** Leave it — rejected: a silent failure reproduces this exact bug with a stronger illusion of success, which makes it adjacent to the root cause rather than unrelated cleanup.
**Consequences:** One extra file in scope; it is what makes the primary fix observable.

---

## 14. Reversion Challenges

Two decisions remove shipped behavior. Each was challenged with: *what does removing this break?*

### DD-DDP-006 — removing the unconditional poll

**Breakage found:** a cap set below real run duration stops polling mid-run, and the screen would not update until reload.

**Addressed:** §8.3 invalidates merged-content on **both** job-completion effects, so completion refreshes the panel whether or not the poll is still running. The cap is a bound on waste, not the refresh mechanism. `tasks.md` must set it above observed run duration and assert both halves — that polling continues below the cap and stops at it.

### DD-DDP-007 — removing the collapse-to-one-column behavior

**Breakage found:** UPLOAD assessments currently render single-column while content loads, then reflow to two columns. Mounting the panel whenever the mode is UPLOAD makes the initial render two-column with a placeholder — a visible change on a state the Analyst sees on every upload, not only the superseded one.

**Precisely:** this does not *eliminate* the reflow. `hasDocument` derives from `assessment?.intakeMode` (`gap-detector-client.tsx:176`), which is `undefined` while the assessment query is in flight, so a one-to-two-column reflow still happens on first paint — **earlier, not never**.

**Assessment:** still an improvement, but a visible change on the normal path, so it is the user's call. Flagged at the HITL pause. MANUAL_ENTRY assessments are unaffected — `hasDocument` keeps its `intakeMode === 'UPLOAD'` gate.

---

## 15. Design Review Checklist

- [x] Matches TRD module boundaries and security model — no new routes, guards, or ownership paths
- [x] Model IDs from `BEDROCK_MODELS` — untouched
- [x] UX references design tokens (`--warning`), not raw hex
- [x] Migration path documented — none required
- [x] Every claim about a file's current imports/exports/consumers verified by reading it (KZ-003) — §5, §7, §8, §10
- [x] Cross-screen cache invalidation (D4) **and cross-field propagation (D8)** both named as classes mocked tests cannot catch, each with a manual-QA step (KZ-008 in full)
- [x] Every DD that reverts delivered behavior carries its challenge outcome (§14)
- [x] Budget recorded as an executable tripwire (§12); PR recommendation derived from repo precedent, not an invented threshold
- [x] No gate names a file that does not exist, and every gate names a failing input (§11)
- [ ] Shared types built before API/Web implementation — a forward obligation on `tasks.md`, not assertable here
- [x] No code snippets — design stays conceptual

### Forward obligations on `tasks.md`

1. Order tasks `shared → api → web`; single PR (§12).
2. Test all four sides of §7.3's rule: snapshot ⊂ current (not superseded), snapshot ⊄ current (superseded), `[]` (never superseded), absent key (superseded).
3. Create all three new test files as their own deliverables — including `use-multi-document-status.test.ts`, which is D4's only automated gate.
4. Set the poll cap above observed run duration and record the basis; assert it continues below the cap and stops at it.
5. Cover `upload-business-plan-modal.tsx` as its own task.
