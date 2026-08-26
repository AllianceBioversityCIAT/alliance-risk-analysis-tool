# Judgment Day — Design Review Ledger

## Transaction

| Field | Value |
|-------|-------|
| **Target** | `design.md` — reviewed at v1.0, corrected to v1.1, corrected to v1.2 |
| **In-scope companions** | `requirements.md` (v1.0 → v1.2), `proposal.md` (v1.1 → v1.2) |
| **Mode** | `judgment_day` — blind dual review |
| **Rounds used** | 2 of 2 fix rounds · 1 scoped re-judgment · 1 final verification |
| **Date** | 2026-08-21 |
| **Terminal state** | **`escalated`** — the two-round fix ceiling is exhausted and two severe findings remain. Per the contract, an exhausted lineage is never reset or extended |

### Judges

| Judge | Model | Context | Tools | Verdict |
|-------|-------|---------|-------|---------|
| A | Opus 5 | Fresh, blind | Read / Grep / Glob | 8 SEVERE, 10 WARNING, 5 SUGGESTION |
| B | Sonnet 5 | Fresh, blind | Read / Grep / Glob | 3 SEVERE, 3 WARNING, 1 SUGGESTION |

**Author ≠ auditor:** the design was authored on Opus 5. Judge B ran on a different model to give genuine model diversity; Judge A ran on Opus for detection depth. Both judges had fresh contexts, identical scope, and identical criteria, and neither could see the other or the author's reasoning.

**No contradictions between judges.** Judge B's findings are a subset of Judge A's plus two unique items. No escalation-for-contradiction is triggered.

### Skill resolution

`nestjs-expert`, `api-design-principles`, `error-handling-patterns`, `vercel-react-best-practices`, `tailwind-design-system` — passed identically to both judges.

### Disposition rule applied

The contract fixes only SEVERE findings confirmed by both judges, recording single-judge findings as `suspect`. Eleven single-judge findings were **independently verified against the code by the orchestrator**, which converts them from `suspect` to `proven` on evidence rather than on vote. Verification commands and their output are recorded per row. Findings neither corroborated nor verified remain `suspect` and are not auto-fixed.

---

## Severe — proven, must fix

| ID | Finding | Corroboration | Evidence |
|----|---------|---------------|----------|
| **S1** | The freshness comparison compares two different domains: the snapshot records only `COMPLETED` parse jobs (§6.1), but is compared against **every** current document's `parseJobId` (§6.3) with no `COMPLETED` and no non-null filter. Any document that exists without a completed parse job forces a permanent false `STALE` | **Both judges** (A-J1, B-J1, B-J2) | `requestUploadUrl` creates the document row with no `parseJobId`; `parseJobId` is written at job-creation time, before the job runs; `parse-document.handler.ts` `onFailure()` sets `status: FAILED` but never clears `parseJobId` |
| **S2** | FR-DDP-003 Scenario 2 ("the stale notice disappears when a run completes") has **no mechanism**. `['merged-content']` is invalidated nowhere in the web package, and §7.2 stops the only existing refresh path exactly in the `STALE` state | Judge A (A-J2), **verified** | `grep -rn "merged-content" packages/web/src \| grep -i invalidate` → `NEVER INVALIDATED`. `useReAnalyzeGaps` uses `onSettled` invalidating only `['gap-fields']`, fired on the response, not on job completion (`use-gap-detection.ts:49-54`) |
| **S3** | The legacy filename fallback is wrong in **both** directions: false `FRESH` when a deleted document is replaced by a same-named file — the literal reported user flow — and false `STALE` from snapshot truncation. FR-DDP-002's population (delete, then never re-run) is by definition the one that cannot "self-correct on its next run" | **Both judges** (A-J9, B-J3) | `extractedText.substring(0, maxInputCharacters)` can cut a later `## Document:` header out; headers are emitted only `if (content)`; `schema.prisma` has no filename uniqueness constraint |
| **S4** | The new "Re-analyse now" control makes a gap-field-duplicating path reachable: in re-analyze mode with zero completed parse jobs, ten extra `GapField` rows are created on top of the existing ten | Judge A (A-J12), **verified** | `execute()` deletes fields only `if (!isReAnalyze)` (`gap-detection.handler.ts:65-70`); the zero-jobs branch calls `createSkeletonFields` unconditionally (`:135`), which does `gapField.createMany` (`:495-510`) |
| **S5** | FR-DDP-003's named automated gate is **structurally blind** to everything §7.1 specifies: the only cited test stubs `DocumentViewer` out entirely, and the design creates no `document-viewer` test | Judge A (A-J3), **verified** | `__tests__/gap-detector-client.test.tsx:44-51` mocks `next/dynamic` to return `DocumentViewerStub` |
| **S6** | The NFR-DDP-010 and D4 gates name test suites whose files the design never creates. On `web` the named command **passes vacuously** | Judge A (A-J4), **verified** | `packages/web/src/hooks/__tests__/` contains only `use-analytics-pageview`, `use-assessments`, `use-job-polling`. Root `CLAUDE.md`: web test script includes `--passWithNoTests` |
| **S7** | §10's claim that a failed delete "surfaces as a 500 … Toast via sileo" is false for the only call site, which swallows the error and removes the row from the UI anyway — and the design changes no file to make it true | Judge A (A-J6), **verified** | `upload-business-plan-modal.tsx:185-193`: `catch { /* Ignore — might not exist yet */ }` followed unconditionally by `setFiles(prev => prev.filter(...))`. That file appears nowhere in §4's map |
| **S8** | §6's API table states the re-analyse endpoint responds `202`; it responds `201` | Judge A (A-J5), **verified** | `gap-field.controller.ts:36-42` — `@Post('re-analyze')` carries no `@HttpCode`, so NestJS's POST default applies. Contrast `assessments.controller.ts` which decorates `ACCEPTED`/`NO_CONTENT` explicitly |
| **S9** | `PENDING` is defined as "a run is expected" but the derivation cannot check that, so it is returned when nothing is coming — re-creating the runaway poll NFR-DDP-010 exists to stop | Judge A (A-J11), **verified** | `jobs.service.ts:170-180` chains `GAP_DETECTION` only when `allDocs.every(d => d.status === 'PARSED')`. One `FAILED` document means no run is ever queued, indefinitely |

## Warning — proven

| ID | Finding | Corroboration |
|----|---------|---------------|
| W1 | `requirements.md:29` asserts "two frontend files" and annotates itself "re-checked against the finished design"; the design touches four source files plus tests. The Standard-vs-Full depth call rests on this figure | Judge A (A-J7), **verified** |
| W2 | §3 says "one React Query hook module"; §4 and §7.3 both edit two — the omitted one carries DD-DDP-009, the change §7.3 itself calls "the cross-screen half of the bug" | **Both judges** (A-J8, B-J4) |
| W3 | Subsection labels are off by one from the document's own headings: `### §6.1–§6.3` sit under `## 7. Backend Logic`, `### §7.1–§7.4` under `## 8. Frontend`. §15's KZ-003 attestation cites the wrong numbers | Judge B (B-J5), **verified** |
| W4 | "the 400-LOC threshold" is presented as an existing rule; no constitutional document defines any LOC threshold, and repo precedent contradicts it (tracking-analytics: "Single PR recommended … even at the actual ~370 LOC") | Judge A (A-J17), **verified** |
| W5 | `FRESH` with an empty `mergedMarkdown` is reachable and unspecified, falling through to the bare "No document content available" panel FR-DDP-003 forbids | Judge A (A-J10), `suspect` — mechanism plausible (`if (content)` gate at `:145`) |
| W6 | FR-DDP-004's clause "must NOT delete job records of any other job type" has no mechanism, and the proposal's resolved decision to record a note about it was dropped | Judge A (A-J13), `suspect` |
| W7 | KZ-008 is applied at half strength: the template requires cross-screen cache invalidation **and cross-field interaction** be named; §15 checks the box having named only the first. The live cross-field case is `detectedCountry` + Core-10, both derived from the same merged blob | Judge A (A-J15), `suspect` |
| W8 | D5's coverage is stated three inconsistent ways across §11 and `requirements.md` §6 | Judge A (A-J16), `suspect` |
| W9 | The design self-exempts from root `CLAUDE.md`'s `ApiResponse<T>` rule on a route whose response contract **this spec is changing**, and it introduces a new shared response type anyway | Judge A (A-J18), `suspect` |
| W10 | FR-DDP-002 has no scenario for "delete one of several documents, never re-run" — an ordinary action the mechanism probably handles but nothing proves | Judge B (B-J6), `suspect` |
| W11 | FR-DDP-003's "must NOT render any content from the deleted document" is scoped to the screen, which still renders gap-field values and a country-mismatch hint derived from the deleted document — conflicting with the same document's own GapField out-of-scope declaration | Judge A (A-J14), `suspect` |

## Suggestion

| ID | Finding | Corroboration |
|----|---------|---------------|
| G1 | §4's file map omits `packages/shared/src/types/assessment.types.ts`, which §9 requires editing and which is a build-order dependency | Judge A (A-J19) |
| G2 | Neither §7.1 nor §7.4 states how `DocumentViewer` receives `freshness` or triggers re-analysis; the two sections imply different owners for the action | Judge A (A-J20) |
| G3 | Line-anchor drift on several "verified by reading" citations (`parseAll`, `useDeleteDocument`, `use-merged-content`, `assessments.service.spec.ts`, `use-gap-detection.ts` — the last is `onSettled`, not `onSuccess`) | **Both judges** (A-J21, B-J7) |
| G4 | DD-DDP-007's challenge claims mounting the panel "removes that reflow"; a one-to-two-column reflow still occurs on first paint because `hasDocument` is false while the assessment query is in flight | Judge A (A-J22) |
| G5 | Three forward references assert the contents of a `tasks.md` that does not yet exist, one of them ticking a §15 checklist box | Judge A (A-J23) |

---

## What survived

Both judges independently confirmed the core mechanism is sound and its verification honest:

- **DD-DDP-001** (resolve the merge through current documents) is correct, and all three `parseJobId` write paths exist as claimed (`assessments.service.ts:263-266`, `:323-326`, `worker.ts:224-231`).
- `Job.result` is `Json?` — the **no-migration claim holds**.
- The FK direction that makes a DB cascade infeasible is real (`schema.prisma:297-303`), so the proposal's discard of Option B stands.
- The `--warning` / `#F48C06` token exists; `packages/web/CLAUDE.md:204` and the KZ-005 reference are accurate.
- The `gap-detector-client.tsx:721` / `GapLayout` collapse behavior is exactly as described.
- The "25 passed" baseline in §11 checks out.

The defects are concentrated in the **freshness derivation and its gates**, not in the merge fix.

---

## Round-one correction scope (proposed, awaiting approval)

| Finding | Fix |
|---------|-----|
| S1 | Compare like with like: both sides become "`COMPLETED` parse jobs of currently-existing documents." Adding an unparsed document then yields `FRESH` (correct — content is still valid); a `FAILED` document is excluded from both sides; only a deletion shrinks the current set into `STALE` |
| S2 | Invalidate `['merged-content', id]` on gap-detection job completion **and** on deletion; keep polling only for `PENDING` |
| S3 | **Drop the filename fallback.** Legacy snapshots with no `sourceParseJobIds` classify as `STALE`. OQ-1 permitted a no-migration route only if unambiguous, and the design's own words concede this one is not. Fail-closed, consistent with §10 |
| S4 | Guard `createSkeletonFields` behind `!isReAnalyze`, and never offer re-analyse in a state with zero completed parse jobs |
| S5, S6 | Add real test files (`document-viewer`, `use-merged-content`, `use-multi-document-status`) and stop naming `gap-detector-client` as FR-DDP-003's gate. Name the concrete failing input for each |
| S7 | Either fix the call site to surface the failure, or delete §10's false claim and record the swallowed error as a known gap |
| S8 | Correct `202` → `201` |
| S9 | Classify `PENDING` only when a non-terminal parse or gap job actually exists; otherwise `STALE` |
| W1–W4 | Correct the four proven figures |
| W5–W11 | Resolve each; several are requirements-side edits, so the correction sweeps both documents |
| G1–G5 | Mechanical corrections |

Budget consequence: the design's §12 tripwire (8 tasks, ~500 LOC) will rise — three new test files and the `PENDING` derivation were not in it. The revised budget is part of the correction.


---

# Round 2 — Scoped Re-Judgment Of The v1.1 Fix Delta

Both judges re-ran blind over the frozen round-one ledger plus the immutable fix delta, with fix-caused defects explicitly in scope.

| Judge | Model | Ledger disposition | New defects |
|-------|-------|--------------------|-------------|
| A | Opus 5 | 24 FIXED, 1 PARTIAL (G5), 0 NOT_FIXED | 3 SEVERE, 2 WARNING, 4 SUGGESTION |
| B | Sonnet 5 | 24 FIXED, 1 REGRESSED (S1) | 1 SEVERE |

**The round-one corrections held: 24 of 25 findings fixed, none unfixed.** But both judges independently found the same fix-caused defect, which is the entire reason this round exists.

## Confirmed by both judges

| ID | Finding | Severity |
|----|---------|----------|
| **R-1** | The round-one fix modelled "an analysis is running" as a **sixth freshness state**, so it short-circuited the snapshot rules and nulled `mergedMarkdown` — hiding a valid analysis whenever a document was queued for parsing. This violated FR-DDP-002 Scenario 4, *the requirement added in the same round to fix S1.* Judge B classified it as a REGRESSION of S1 rather than a new finding; both readings describe the same defect | **SEVERE** |

Judge A additionally raised, and the orchestrator verified against the code:

| ID | Finding | Severity | Verification |
|----|---------|----------|--------------|
| R-2 | The in-flight state sticks forever: a job failing below `maxAttempts` is reset to `PENDING` and **nothing retries it** | SEVERE | `jobs.service.ts:222-232` writes `status: 'PENDING'` and logs "reset to PENDING for retry"; `processJob` is reachable only from `worker.ts:273`, `jobs.service.ts:192`, and `:241` — no queue, scheduler, or reaper exists |
| R-3 | Rule for "no `sourceParseJobIds`" did not distinguish an absent key from a recorded empty array | SEVERE | A run resolving zero completed parse jobs records `[]`, which is a truthful record; conflating it with the legacy absent-key case pins the assessment in a `STALE` that re-analysing re-confirms |
| R-4 | `NEVER_ANALYSED` conflated "never parsed" with "parse failed"; its copy asserted the second and its action was dead | WARNING | The empty-set branch produces nothing, so "Re-analyse now" is a dead remedy there |
| R-5 | A v1.1 correction footnote said "three files" while listing five | WARNING | 1 + 1 + 3 = 5 |
| R-6 to R-9, G5 | An unreachable remediation instruction; a task count short by one; stale cross-references and a state count; scenario mis-ordering; a checklist box ticked for a future document | SUGGESTION / PARTIAL | All verified |

## Round-two correction applied

The restructure: **five freshness states plus an orthogonal `analysisInFlight` boolean.** Content availability is a property of the snapshot; polling is a property of the run. Modelling them as one enum was the mistake.

The orchestrator's own backward sweep caught two further drifts the judges had not flagged — a state count in `requirements.md` OQ-3 and two claims in `proposal.md` that design discovery had falsified — plus one numbering error introduced by the correction itself.

---

# Final Independent Verification

Scoped to: are R-1…R-9 and G5 fixed, and did the round-two restructure introduce anything new.

**Result: `ISSUES REMAIN`.** R-1, R-2, R-4, R-5, R-7, R-9 and G5 verified FIXED; R-3, R-6 and R-8 PARTIAL. Fifteen new findings, two severe.

## The finding that matters

| ID | Finding | Severity |
|----|---------|----------|
| **F-1** | **The same defect has now relocated a third time.** Each fix was locally correct and moved it: v1.0 put it in the set-comparison domain (S1), v1.1 moved it into the parse window (R-1), v1.2 moved it into the **gap-run window**. A parse job reaches `COMPLETED` *before* the gap run finishes — `jobs.service.ts:166` sets `COMPLETED`, then `:173-192` creates the `GAP_DETECTION` job and awaits `processJob` inline. During that entire Bedrock call the current completed set is `{jobA, jobB}` while the snapshot records `{jobA}` → the sets differ → `STALE` → content withheld, and the Analyst is told "a document was removed" when one was added | **SEVERE** |
| **F-2** | `requirements.md` contradicts itself and its own gate would fail a correct implementation. FR-DDP-002 Sc 3 requires "the same distinguishable state as Scenario 1" (deleting the *only* document, which the design classifies `NO_DOCUMENTS`), while defect-class D2's named failing input asserts documents `{}` "must report stale" — and FR-DDP-003 Sc 4 forbids presenting the zero-document case as a stale state | **SEVERE** |

Thirteen further findings (F-3 to F-15): the API contract table omits `analysisInFlight`; `NEVER_ANALYSED` + in-flight resolves to the wrong copy on a brand-new assessment's first parse; polling can fail to start within the 60 s `staleTime` window and only one of the two completion effects is addressed; the empty-array side of R-3 is unproducible as written; the `STALE` copy asserts a removal for the entire legacy population; a stale manual-QA step reference; `~780` vs `~810` in one section; `DD-DDP-010` still carries the instruction R-6 retired; two labels still say "freshness-keyed poll"; `NO_DOCUMENTS` + in-flight is unrendered; an assertion count mismatch; and residual anchor drift on two citations.

## Why the lineage is exhausted rather than merely unfinished

Three attempts, each fixing the stated defect and relocating it, is not bad luck — it is the signature of a model that is still wrong. The verification names the likely resolution, and it is not another patch:

> **A set difference has a direction, and the design has never used it.**
> - Current set is a strict **superset** of the snapshot's — a document was *added* and analysed. The snapshot is *incomplete* but nothing in it was deleted, so its content is safe to serve.
> - The snapshot holds a job the current set lacks — a document was *removed*. Its content must be withheld.
> - Legacy snapshots are a *third* cause: unknown, not removal.
>
> Every iteration so far tested set **inequality** and treated all inequality as removal. That is why the false-removal message and the needless withholding keep reappearing in whatever window the last fix did not cover — and why F-7's legacy-copy defect and F-1's added-document defect are the same defect seen twice.

Splitting `STALE` by the direction of the difference would close F-1, F-7, and the recurrence pattern together. **This is a recommendation for a fresh lineage, not a third round on this one.**

---

# Terminal Receipt

| Field | Value |
|-------|-------|
| **Target** | `docs/specs/bugfix/deleted-document-content-persists/design.md` v1.2 |
| **Rounds** | 2 fix rounds (ceiling), 1 scoped re-judgment, 1 final verification |
| **Round 1** | 9 SEVERE, 11 WARNING, 5 SUGGESTION — all corrected |
| **Round 2** | 24/25 fixed; 1 fix-caused SEVERE confirmed by both judges, 2 SEVERE verified by orchestrator — all corrected |
| **Final verification** | 2 SEVERE, 10 WARNING, 4 SUGGESTION remaining; 3 findings PARTIAL |
| **Correction work units** | 2 bounded fix rounds, 2 orchestrator-initiated backward sweeps |
| **Artifacts** | `design.md` v1.2, `requirements.md` v1.2, `proposal.md` v1.2, this ledger |
| **Skill resolution** | `nestjs-expert`, `api-design-principles`, `error-handling-patterns`, `vercel-react-best-practices`, `tailwind-design-system` — identical for all judges |
| **Author ≠ auditor** | Design authored on Opus 5; Judge B ran on Sonnet 5 for model diversity, Judge A on Opus for depth. All judges blind, fresh-context, read-only |

**What survived every round:** `DD-DDP-001` (resolve the merge through current documents) — confirmed sound by all four judge passes. The no-migration claim holds. The infeasibility of a DB cascade holds. **The merge fix, which is the reported bug, is correct.** The unresolved defects are all in the freshness-classification layer added to cover the second scenario.

## JUDGMENT: ESCALATED ⚠️
