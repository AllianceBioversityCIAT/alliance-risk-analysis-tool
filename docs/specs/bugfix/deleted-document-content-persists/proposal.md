# Proposal — Deleted Document Content Persists In Gap Detection

## 1. Document Control

| Field | Value |
|-------|-------|
| **Module** | `bugfix/deleted-document-content-persists` |
| **Project** | CGIAR Risk Intelligence Tool |
| **Version** | 1.3 |
| **Date** | 2026-08-21 |
| **Author** | Daniela Gómez (via Claude Code) |
| **Type** | Bug |
| **Approval Mode** | gated |
| **Slug** | `deleted-document-content-persists` — passed directly as a literal path (`bugfix/...`), not derived from free text |

### Revision History

| Version | Date | Change |
|---------|------|--------|
| 1.0 | 2026-08-19 | Initial proposal — root cause confirmed for the delete-and-replace scenario |
| 1.1 | 2026-08-21 | Review pass against current code. Added Scenario 2 (delete without replacement), which v1.0 did not cover; reclassified the DB-cascade option as infeasible; corrected stale spec references and line anchors |
| 1.3 | 2026-08-21 | Re-aligned to `design.md` v2.0 after the v1.x design lineage escalated out of Judgment Day and was replaced by a single-rule design. The recommended approach in §11 is unchanged and was never the problem |
| 1.2 | 2026-08-21 | Backward-sweep note after `/akili-specify` + Judgment Day. **Two claims in this document have been overtaken by design discovery** — §8's "one small UI surface" and §10 Option D's "a small frontend state" both understate the outcome. The recommended approach still stands unchanged; only its frontend footprint grew. See the note in §8 and `design.md` §12 for the budget of record |

### References

| Ref | Document | Location |
|-----|----------|----------|
| C1 | Technical Requirements | `docs/trd/trd.md` |
| C2 | Discovery context | Found during manual testing of `docs/specs/archive/2026-08-19-changes--country-document-match-validation/` (unrelated feature, since archived) — see that spec's `execution.md` for the session in which this was noticed |

---

## 2. Intent

Fix a data-integrity bug: deleting a document from an assessment via "Manage Documents" does not remove that document's parsed content from what the application shows and analyses. The deleted document's text keeps feeding gap detection and the document viewer indefinitely — and when no replacement document is uploaded, the application keeps serving the deleted document's content with no mechanism that would ever refresh it.

## 3. Problem / Current Behavior

A user on the Gap Detector screen clicked "Manage Documents," deleted the existing uploaded document, and uploaded a different one. Instead of the new document cleanly replacing the old one:

- The gap analysis behaved as if the old document was still in play.
- The document viewer (right pane of the Gap Detector screen) showed content from the **already-deleted** document.
- The Core-10 field extraction and country detection ran against a **mixed** old+new document blob, not the new document alone.

Investigation showed the reported case is one of **two distinct failure scenarios**, driven by the same missing cleanup but with different mechanics and different remedies:

| | Scenario 1 — delete A, then upload B | Scenario 2 — delete A, upload nothing |
|---|---|---|
| **What triggers a refresh** | Uploading B automatically chains a new gap-detection run | Nothing. Deletion triggers no run |
| **What the user sees** | Gap analysis and viewer reflect A+B merged instead of B alone | Gap analysis and viewer keep showing A, indefinitely |
| **Covered by v1.0 of this proposal** | Yes | **No** |

Scenario 2 is not an edge case: deleting one of several documents because it was wrong, or deleting the only document before going to find the correct file, are both ordinary uses of "Manage Documents." In both, the user believes the document is gone and the application continues to display and analyse it.

Neither scenario is a one-off glitch — both reproduce deterministically and affect every assessment where a document is ever deleted.

## 4. Proposed Outcome

Deleting a document SHALL remove its content from everything downstream of it — gap-detection input, document viewer, Core-10 extraction, country detection — such that:

1. **Scenario 1:** the next gap-detection run reflects only the documents that currently exist on the assessment.
2. **Scenario 2:** the application never presents an analysis or document content that includes a deleted document. Where a refreshed analysis is not yet available, the application SHALL show an explicit "this analysis no longer reflects the current documents — re-analyse" state rather than stale content or a silently empty panel.

## 5. Scope

**Backend**
- `packages/api/src/platform/jobs/handlers/gap-detection.handler.ts` — `processUploadMode()`'s document-merge query (`:124-131`).
- `packages/api/src/domain/assessments/assessments.service.ts` — `deleteDocument()` (`:349-381`): cleanup of the associated `Job` row, plus invalidation of the now-stale gap-detection snapshot.
- `packages/api/src/domain/assessments/assessments.service.ts` — `getMergedContent()` (`:389-408`): must distinguish "no analysis has run yet" from "the last analysis is stale."

**Frontend** (newly in scope at v1.1 — see §9 *Second Mechanism*)
- `packages/web/src/hooks/use-merged-content.ts` — the 5-second poll currently runs forever whenever content is absent; it must terminate in the stale case.
- `packages/web/src/app/(protected)/assessments/gap-detector/gap-detector-client.tsx` and `packages/web/src/components/gap-detector/` — surface the "needs re-analysis" state instead of collapsing the document panel out of the layout.

**Tests**
- A regression test for Scenario 1 (delete A, upload B, gap-detection output reflects B only) — red before the fix, green after.
- A regression test for Scenario 2 (delete A, run nothing, served content is not A's).

## 6. Non-Goals

- No change to the S3 deletion logic itself (already correct — confirmed working).
- No change to `GapField` lifecycle (already correctly deleted/recreated on each gap-detection run — the bug is in what *content* feeds that recreation, not in stale `GapField` rows surviving).
- No new document-versioning or audit-trail feature — this is a correctness fix, not a new capability.
- **No automatic re-analysis on deletion.** Deletion marks the analysis stale; it does not spend a Bedrock call on the user's behalf. Deleting three documents one at a time must not fire three analyses. The existing re-analyse path (`POST /api/assessments/:id/gap-fields/re-analyze`) is the remedy.
- No new user-facing "Re-analyse now" button unless `/akili-specify` finds the existing re-analyse trigger insufficient to clear the stale state — the current trigger is driven by saving gap fields, not by an explicit control.

## 7. Affected Users, Systems, And Specs

| Area | Impact |
|------|--------|
| **Persona** | Analyst (anyone using "Manage Documents" to delete or replace an uploaded file) |
| `packages/api/src/platform/jobs/handlers/gap-detection.handler.ts` | Primary fix — query scoping (Scenario 1) |
| `packages/api/src/domain/assessments/assessments.service.ts` | Job-row cleanup + stale-snapshot invalidation (Scenario 2) |
| `packages/web/src/hooks/use-merged-content.ts`, `packages/web/src/components/gap-detector/` | Stale-state surface and poll termination (Scenario 2) |
| `packages/api/prisma/schema.prisma` | Possibly — only if `/akili-specify` concludes the stale state needs a persisted flag (see Open Questions) |
| `docs/specs/archive/2026-08-19-changes--country-document-match-validation/` | Archived feature, but its `detectedCountry` extraction is corrupted by this same bug (extra context, not in scope to fix there) |

## 8. Visual Reference

- Source: None
- Location: n/a
- **v1.3 note:** this section's "one small UI surface" estimate turned out to be right, but only after a detour. The v1.x design grew a five-state machine here and escalated out of Judgment Day; `design.md` v2.0 replaced it with **one notice and one button**. See `judgment.md` for why the larger model was wrong.
- Notes: Primarily a backend data-integrity fix, but it also adds one UI surface: a notice on the Gap Detector when the stored analysis is withheld. Today, when merged content is absent, the document panel is dropped from the layout entirely (`gap-detector-client.tsx:721` passes `hasDocument && !!mergedMarkdown` into `GapLayout`, which collapses from two columns to one). Left as-is, deleting a document would make the right pane silently vanish — better than showing deleted content, but not self-explanatory. `/akili-specify` should specify this state against `docs/ux-ui/design.md` existing empty/warning patterns rather than invent a new component.

## 9. Bug Diagnosis

### Observed Symptom

On the Gap Detector screen: after deleting an uploaded document and uploading a different one via "Manage Documents," (1) the new document's content did not appear to be reflected in the gap analysis, (2) the document viewer showed content from the deleted document, and (3) the gap-analysis pipeline indicator showed unexpected transitional behavior.

### Reproduction Steps

**Scenario 1 — delete and replace**

1. Create an UPLOAD-mode assessment, upload document A. Let it parse and let the automatic gap-detection run complete (a `PARSE_DOCUMENT` `Job` row now exists for A with `status: COMPLETED` and `result.markdownContent` = A's extracted text).
2. Go to Manage Documents (`/assessments/upload?id=...`), delete document A.
3. Upload document B (different content — e.g., describes a different business/country than A).
4. Wait for B to parse and for gap-detection to re-run (chained automatically after parsing).
5. **Observed:** `GET /api/assessments/:id/merged-content` (and the Gap Detector's document viewer, and the actual Bedrock input for gap extraction) reflects **A+B merged**, not B alone.
6. **Expected:** only B's content should appear anywhere, since A was deleted.

**Scenario 2 — delete without replacement**

1. Same setup as above through step 2 (document A uploaded, parsed, gap-detection completed, then A deleted).
2. Do not upload anything. Reload the Gap Detector screen.
3. **Observed:** the document viewer still shows A's full content, and the Core-10 gap fields still reflect A. No further gap-detection run is ever triggered by the deletion, so this state persists indefinitely.
4. **Expected:** A's content appears nowhere, and the screen states plainly that the analysis no longer matches the current documents.

### Root Cause (confirmed)

Verified by reading the current code, not inferred. Two independent mechanisms, one per scenario.

#### First Mechanism — the merge query is not scoped to existing documents (drives Scenario 1)

1. **`AssessmentsService.deleteDocument()`** (`assessments.service.ts:349-381`) deletes the S3 object and the `AssessmentDocument` row, but **never deletes the associated `Job` row** referenced by `doc.parseJobId`. No cascade exists in `schema.prisma` either. The orphaned `PARSE_DOCUMENT` job (status `COMPLETED`, full extracted text still in `result.markdownContent`) becomes a permanent "zombie" row.

2. **`GapDetectionHandler.processUploadMode()`** (`gap-detection.handler.ts:124-131`) rebuilds the merged document text on *every* gap-detection run by querying:
   ```ts
   const parseJobs = await this.prisma.job.findMany({
     where: {
       type: 'PARSE_DOCUMENT',
       status: 'COMPLETED',
       input: { path: ['assessmentId'], equals: assessmentId },
     },
     orderBy: { completedAt: 'asc' },
   });
   ```
   This matches on the job's `input.assessmentId` JSON field — i.e., **every historically-completed `PARSE_DOCUMENT` job ever created for the assessment**, with no check that the document it belongs to still currently exists. It concatenates all their `markdownContent` (oldest first) into `mergedMarkdown` (`gap-detection.handler.ts:139-150`), which is sent to Bedrock and persisted on the `GAP_DETECTION` job's `result`.

**Combined effect:** deleting a document never removes its job from the pool `processUploadMode()` draws from, so its content keeps getting merged back in alongside every subsequently-uploaded document, for the entire lifetime of the assessment.

#### Second Mechanism — the served content is a snapshot that deletion never invalidates (drives Scenario 2)

`getMergedContent()` (`assessments.service.ts:389-408`) does **not** recompute the merge on request. It reads `result.mergedMarkdown` off the **most recent `COMPLETED` `GAP_DETECTION` job** — a snapshot frozen at the moment that analysis ran.

A new snapshot is produced only when a gap-detection run completes, and runs are triggered by (a) a document finishing parsing, or (b) the explicit re-analyse endpoint. **Document deletion triggers neither.** So fixing the first mechanism alone does nothing for Scenario 2: the query-scoping fix only changes what a *future* run produces, and in Scenario 2 no future run ever happens.

Two further findings constrain how this must be fixed:

- **`getMergedContent()` cannot currently express "stale."** It returns `mergedMarkdown: null` for "no analysis has run yet." If invalidation is implemented by making it return `null`, the stale case becomes indistinguishable from the never-ran case.
- **Returning `null` triggers an unbounded poll.** `useMergedContent` (`use-merged-content.ts:26-32`) sets `refetchInterval` to 5 s whenever `mergedMarkdown` is falsy and stops polling only once content arrives. In the never-ran case that is correct — content is coming. In the stale case nothing is coming, so the client would poll every 5 seconds forever. This is why Scenario 2 cannot be closed purely in the backend.

### Impact & Scope

- Affects **any** assessment where a document is deleted — a documented, expected use of "Manage Documents," not an edge case. Scenario 2 (delete without replacement) has no self-healing path at all.
- Corrupts Core-10 field extraction (gap fields can reflect a mix of deleted and current content) and any country-detection logic layered on top of the same merge (see `docs/specs/archive/2026-08-19-changes--country-document-match-validation/` — archived feature, same corrupted input).
- The document viewer shows misleading content (already-deleted document text).
- **Unbounded storage growth:** the `jobs` table accumulates a permanent zombie row for every document ever deleted, across the application's lifetime — a data-integrity/scale concern independent of the user-visible symptom.
- No loss of the user's own edited data — `GapField` rows are correctly deleted and recreated on each run; only the *content* feeding that recreation is wrong.

### Fix Strategy

Not a cosmetic one-liner — this is real backend logic (a query-scoping defect), a missing cleanup, and a stale-snapshot invalidation with a client-visible state. Routes to `/akili-specify` in **Bug Mode**, not `/akili-quick`. Regression tests are mandatory for both scenarios: red before the fix, green after.

## 10. Approach Options

### Option A — Scope the merge query to currently-existing documents

In `processUploadMode()`, instead of querying `Job` by `input.assessmentId`, first fetch `AssessmentDocument.findMany({ where: { assessmentId } })`, collect their non-null `parseJobId`s, then query `Job.findMany({ where: { id: { in: parseJobIds }, status: 'COMPLETED' } })`. Pair with deleting the `Job` row inside `deleteDocument()` to prevent unbounded table growth.

- **Pros:** Fixes Scenario 1 at its exact mechanism; small, localized change; no schema migration.
- **Cons:** **Does not address Scenario 2 at all** — it changes what future runs produce, and Scenario 2 has no future run. Also, two places now need to independently agree on "which jobs belong to this assessment's current documents," so a future third code path querying `Job` by `assessmentId` the same naive way could reintroduce a sibling bug.

### Option B — DB-level cascade delete only ❌ *Infeasible as modelled*

Originally proposed as: add a schema-level `onDelete: Cascade` so deleting an `AssessmentDocument` automatically deletes its `Job` row, and rely on that alone.

**This cannot be expressed in the current data model.** The foreign key lives on `AssessmentDocument.parseJobId` pointing *to* `Job` (`schema.prisma:297-303`) — the document is the child, the job is the parent. Referential actions run parent→child, so `onDelete` on that relation governs what happens to the *document* when the *job* is deleted, which is the opposite of what is needed. "Delete document → delete its job" would require a raw SQL trigger or inverting the foreign-key direction on a model shared by every job type (`PARSE_DOCUMENT`, `GAP_DETECTION`, `RISK_ANALYSIS`, `REPORT_GENERATION`, `RECALCULATE_CATEGORY`).

Retained here only so `/akili-specify` does not re-derive it. Not a viable trade-off; discard.

### Option C — Query scoping + Job cleanup (v1.0's recommendation)

Option A's query-scoping fix **and** deletion of the `Job` row inside `deleteDocument()` at the application level (no schema migration, ideally transactional with the `AssessmentDocument` delete).

- **Pros:** Low blast radius; closes Scenario 1 and the storage-growth concern without a migration.
- **Cons:** **Leaves Scenario 2 open**, and therefore does not deliver §4's stated outcome. This was the gap found in the v1.1 review.

### Option D — Option C plus stale-snapshot invalidation (Recommended)

Everything in Option C, plus: deleting a document invalidates the assessment's existing gap-detection snapshot, and the Gap Detector shows an explicit "this analysis no longer reflects the current documents — re-analyse" state until a fresh run completes. Deletion itself never spends a Bedrock call; the existing re-analyse path is the remedy.

- **Pros:** The only option that satisfies both scenarios and §4. Cost per deletion stays at zero AI calls. Reuses the existing re-analyse endpoint rather than adding a parallel trigger.
- **Cons:** Widens the change from two backend files to backend plus frontend state (unavoidable — see *Second Mechanism*: a backend-only invalidation makes the client poll forever). *v1.3: one notice, two invalidation sites, two new test files, and one call-site fix — see `design.md` §12. The v1.x design briefly grew far larger than this before being replaced; `judgment.md` records why.* May or may not need a schema migration depending on how "stale" is represented (see Open Questions) — **resolved: no migration**, `design.md` DD-DDP-003.

### Rejected — Auto-re-analyse on deletion

Have `deleteDocument()` enqueue a gap-detection run so everything self-heals with no user action. Rejected: every deletion would spend a Bedrock call, and deleting several documents one at a time would fire a run per deletion. Recorded as a Non-Goal (§6).

## 11. Recommended Approach

**Option D.** The three parts, in descending order of how non-negotiable they are:

1. **Query scoping in `processUploadMode()`** — stops Scenario 1. Non-negotiable; correct regardless of whether anything else lands.
2. **Stale-snapshot invalidation on deletion, surfaced in the Gap Detector** — stops Scenario 2. Required to deliver §4; without it the bug is half-fixed in a way the user still sees.
3. **`Job`-row cleanup in `deleteDocument()`** — cheap, low-risk hygiene. Prevents unbounded `jobs` growth and hardens against any other code path that naively queries `Job` by `assessmentId`.

Part 1 keeps the "no schema migration" property outright. Parts 2 and 3 are likely to as well, but part 2's representation of staleness is the one open decision that could force one — flagged below rather than assumed away.

## 12. Risks, Dependencies, And Open Questions

**Risks**
- If `deleteDocument()`'s `Job` deletion isn't wrapped transactionally with the `AssessmentDocument` deletion, a crash between the two could leave a new orphan (lower severity than today's bug, but worth closing properly).
- **Stale state must not be conflated with the never-ran state.** If invalidation is implemented as "return `null`," `useMergedContent` polls every 5 seconds indefinitely (see *Second Mechanism*). Any design that reuses `null` for staleness must also give the poll a stop condition.
- **The document panel currently disappears rather than explaining itself** when merged content is absent, because `GapLayout` collapses to one column. Shipping invalidation without the stale-state surface would be correct-but-confusing.
- `useMergedContent`'s 60-second `staleTime` with no invalidation on the delete mutation means even a correctly-fixed backend could serve cached content for up to a minute after a deletion. At v1.0 this was optional polish; under Option D it is closer to required, since a delete now changes the response and the user is expected to notice.

**Dependencies**
- None. Self-contained to the gap-detection and assessments domains.
- Parallel-safe: **yes** — verified 2026-08-21. The only other active spec is `docs/specs/enhancements/upload-word-documents/`, which touches neither `gap-detection.handler.ts` nor `deleteDocument()`.

**Open Questions**
1. ~~Should the regression test hit a real test DB or fully mock Prisma?~~ **Answered:** follow the existing mocking convention — `gap-detection.handler.spec.ts` and `assessments.service.spec.ts` both already exist and establish the pattern. Do not introduce a new one.
2. ~~Should `deleteDocument()`'s cleanup defend against `parseJobId` pointing to a job of a type other than `PARSE_DOCUMENT`?~~ **Answered:** `parseJobId` is `@unique` (`schema.prisma:297`), so a job maps to at most one document. Uniqueness does not constrain *type*, so keep this as a one-line note in `design.md` rather than new logic, as originally proposed.
3. **How is "stale" represented?** Options for `/akili-specify`: (a) a persisted flag on `Assessment` — clearest, but requires a migration and breaks the "no migration" success criterion; (b) derive it from existing state — e.g. compare the latest `GAP_DETECTION` job's `completedAt` against the current document set, or use `AssessmentStatus` (`DRAFT`/`ANALYZING`/`ACTION_REQUIRED`/`COMPLETE`) as the signal — no migration, but the derivation must be unambiguous; (c) delete or mark superseded the stale `GAP_DETECTION` job rows on deletion. Prefer a no-migration route if one is genuinely unambiguous; do not contort the model to preserve that property.
4. **Does clearing the stale state need a new explicit control?** The re-analyse endpoint exists (`POST /api/assessments/:id/gap-fields/re-analyze`) but is currently driven by saving gap fields, not by a user-visible "re-analyse" button. If the stale state can only be cleared by an action the user has no obvious way to take, a control is needed. `/akili-specify` should confirm against `docs/ux-ui/design.md`.
5. **What is shown when the last document is deleted and none remain?** `processUploadMode()` already handles "no completed parse jobs" by creating skeleton fields, but the screen-level state for "assessment with zero documents and a stale analysis" should be stated explicitly rather than left to fall out of the code.

## 13. Success Criteria

- **Scenario 1:** deleting document A and uploading document B results in `GET /:id/merged-content` and the Bedrock gap-detection input reflecting B's content only, never A's.
- **Scenario 2:** deleting document A and uploading nothing results in A's content appearing nowhere — not in the document viewer, not in a subsequent gap-detection run — and the Gap Detector showing an explicit "analysis no longer reflects current documents" state rather than stale content or an unexplained empty panel.
- Deleting a document triggers **zero** Bedrock calls.
- The client does not poll indefinitely in the stale state.
- Regression tests cover both scenarios — red on current code, green after the fix.
- No regression to the existing multi-document merge behavior when documents are *not* deleted (uploading multiple documents without deleting any still merges all of them, as today).
- The `jobs` table no longer accumulates a zombie row per deleted document.
- No new schema migration — **unless** Open Question 3 concludes that representing staleness cleanly requires one, in which case the migration is justified in `design.md`.

## 14. Next Step

```text
/akili-specify bugfix/deleted-document-content-persists
```

(Bug Mode — converts this confirmed root cause into a fix plan and mandatory regression tests for both scenarios. Open Questions 3, 4 and 5 are decisions for `/akili-specify`, not blockers on this proposal.)
