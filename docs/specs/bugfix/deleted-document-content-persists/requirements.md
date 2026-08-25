# Requirements — Deleted Document Content Persists In Gap Detection

## 1. Document Control

| Field | Value |
|-------|-------|
| **Module** | `bugfix/deleted-document-content-persists` |
| **Project** | CGIAR Risk Intelligence Tool |
| **Version** | 2.0 |
| **Date** | 2026-08-21 |
| **Author** | Daniela Gómez (via Claude Code) |
| **Type** | Bug |
| **Depth** | Standard (Bug Mode) |
| **Module code** | `DDP` |
| **Approval Mode** | gated |

### References

| Ref | Document | Location |
|-----|----------|----------|
| C1 | Product Requirements | `docs/prd.md` |
| C2 | UX/UI Design | `docs/ux-ui/design.md` |
| C3 | Technical Requirements | `docs/trd/trd.md` |
| C4 | Approved proposal | `./proposal.md` (v1.2) |
| C5 | Design | `./design.md` (v2.0) |
| C6 | Review history — v1.x lineage, escalated | `./judgment.md` |
| C7 | Archived spec sharing the corrupted input | `docs/specs/archive/2026-08-19-changes--country-document-match-validation/` |

### Why there is a v2.0

The v1.x requirements grew scenarios and clauses to constrain a design that modelled the snapshot/document relationship as a five-state machine. That design escalated out of Judgment Day, and `design.md` v2.0 replaced it with a single directional rule. These requirements are restated at that altitude: what the Analyst must observe, without the vocabulary of the machine that is gone.

Two substantive changes beyond simplification, both from the final verification of the v1.x lineage:

- **A self-contradiction is removed (F-2).** v1.x required that deleting *one of several* documents produce "the same state as" deleting the *only* document, while a separate requirement forbade presenting the zero-document case as a re-analysable stale state. The two cases share an outcome — the stale content is not served — but not a remedy, and requirements now say only what is true of both.
- **Polling is bounded by effort, not by inferred intent (NFR-DDP-010).** v1.x required polling to track whether an analysis was "genuinely" running. Nothing in the platform makes that knowable: a job that fails below its attempt limit is reset to `PENDING` and never retried.

---

## 2. Overview & Scope

### Problem

Deleting a document does not remove its parsed content from what the application analyses and displays. Two failure paths:

| | Scenario 1 — delete A, then upload B | Scenario 2 — delete A, upload nothing |
|---|---|---|
| **Refresh trigger** | Uploading B chains a new analysis | None — deletion triggers nothing |
| **User-visible result** | Analysis and viewer show A+B merged | Analysis and viewer keep showing A, indefinitely |

Root cause confirmed in `proposal.md` §9. Requirements below state the corrected behaviour, not the mechanism.

### In Scope

- Analysis input built only from documents that currently exist.
- The stored analysis withheld when it describes a document that is gone.
- An on-screen explanation with a reachable way to refresh.
- Removal of the orphaned parse job on deletion.
- Regression tests for both scenarios.

### Out of Scope

- S3 deletion logic (already correct).
- `GapField` lifecycle (already recreated per run) — see D8.
- Document versioning or audit trail.
- Automatic re-analysis on deletion (NFR-DDP-011).
- The missing job-retry driver — a pre-existing platform defect, recorded in `design.md` §8.2.
- Fixing the archived country-match spec (C7), whose extraction consumes the same corrupted input.

---

## 3. Functional Requirements

### FR-DDP-001: The analysis reads only documents that currently exist

**Priority:** Must **Persona:** System

An analysis run SHALL build its input exclusively from documents that exist on the assessment at the time the run starts. Content belonging to a deleted document SHALL NOT appear, regardless of how many runs preceded it.

#### Scenario 1: Delete then replace

- **GIVEN** an UPLOAD-mode assessment whose document A has parsed and completed an analysis
- **WHEN** the Analyst deletes A, uploads B, and the analysis re-runs
- **THEN** the merged input contains only B's content
- **AND IT MUST** name only B in the merged content's document separators
- **BUT it must NOT** contain any of A's text, section header, or filename

#### Scenario 2: Delete one of several

- **GIVEN** an assessment with parsed documents A, B and C and a completed analysis over all three
- **WHEN** the Analyst deletes B and the analysis runs again
- **THEN** the merged input contains A and C only
- **AND IT MUST** preserve the existing oldest-first ordering of the surviving documents
- **BUT it must NOT** contain B's content

#### Scenario 3: No deletions — behaviour unchanged

- **GIVEN** an assessment with parsed documents A and B, none deleted
- **WHEN** the analysis runs
- **THEN** the merged input contains both, exactly as today
- **AND IT MUST** preserve the current oldest-first order and separator format

---

### FR-DDP-002: A stored analysis describing a deleted document is not served

**Priority:** Must **Persona:** Analyst

What the document viewer shows is an analysis stored when a run last completed, not a live recomputation, and deletion triggers no run. The application SHALL therefore withhold a stored analysis whenever it describes a document that no longer exists — **and SHALL keep serving it otherwise**, including while a newer analysis is being computed.

#### Scenario 1: Delete the only document, upload nothing

- **GIVEN** an assessment whose sole document A has parsed and completed an analysis
- **WHEN** the Analyst deletes A and uploads nothing
- **THEN** requesting the merged content returns none of A's content
- **BUT it must NOT** return A's content at any later point in the assessment's life

#### Scenario 2: Delete one of several, never re-run

- **GIVEN** an assessment with parsed documents A, B and C and a completed analysis over all three
- **WHEN** the Analyst deletes B, uploads nothing, and no analysis ever runs again
- **THEN** the stored analysis is withheld in full
- **BUT it must NOT** be served on the grounds that two of its three documents still exist

*The remedy differs between Scenarios 1 and 2 — re-analysing is meaningful only while documents remain — but the content outcome is identical, and that is all this requirement constrains.*

#### Scenario 3: Withholding survives a reload

- **GIVEN** the state at the end of Scenario 1 or 2
- **WHEN** the Analyst reloads the Gap Detector after any elapsed time
- **THEN** the withheld content is still absent
- **BUT it must NOT** be re-served from any client-side cache

#### Scenario 4: Adding a document withholds nothing

- **GIVEN** an assessment with a completed, correct analysis over document A
- **WHEN** the Analyst uploads document B
- **THEN** A's analysis stays **readable on screen** — not replaced by a spinner, a placeholder, or an empty panel
- **AND IT MUST** stay readable throughout: while B uploads, while B parses, **and while the new analysis runs**
- **AND IT MUST** stay readable if B's parse fails, since a failed document contributes nothing
- **BUT it must NOT** be described as no longer matching the current documents, at any point, merely because a document was added

*This scenario is the one the v1.x lineage failed three times (`judgment.md`). Each attempt tested whether the analysed set still **equalled** the current set — which an addition also breaks — and each fix narrowed the window in which an addition was misread as a deletion rather than removing the misreading. The final clause's "at any point" is deliberate: it admits no time window.*

---

### FR-DDP-003: The screen explains withheld content and offers the remedy

**Priority:** Must **Persona:** Analyst

When content is withheld under FR-DDP-002, the Gap Detector SHALL say so and name how to refresh it. It SHALL NOT present a silently empty or absent document panel, which is indistinguishable from "still loading" and from "nothing was ever uploaded".

#### Scenario 1: Withholding is explained, not implied

- **GIVEN** an assessment whose stored analysis is withheld because a document was deleted
- **WHEN** the Analyst opens the Gap Detector
- **THEN** the screen states that the analysis no longer matches the current documents, and offers a way to re-analyse
- **AND IT MUST** be distinguishable from an assessment that has never been analysed
- **BUT it must NOT** render any of the deleted document's text in the document panel
- **BUT it must NOT** drop the document panel from the layout with no explanation

*Clause scoping:* the document panel is the only surface this spec makes authoritative. Gap-field values and the country-mismatch hint on the same screen also derive from the deleted document's text, but the `GapField` lifecycle is out of scope (§2) and those values are overwritten by the next run. The residue is recorded as **D8** with a manual-QA step, not silently ignored.

- **AND IT MUST NOT** state a cause the application cannot know — content is withheld for deletion, for re-parsing, and for analyses stored before this fix, and these are not distinguishable from the stored record

#### Scenario 2: The explanation clears on a fresh run

- **GIVEN** an assessment showing the withheld-content notice with at least one document remaining
- **WHEN** an analysis completes
- **THEN** the notice disappears and the viewer shows the freshly merged content, **without a manual page reload**
- **AND IT MUST** reflect only the surviving documents

#### Scenario 3: Last document deleted

- **GIVEN** an assessment whose only document has been deleted
- **WHEN** the Analyst opens the Gap Detector
- **THEN** the screen states that no documents remain and offers to upload one
- **BUT it must NOT** offer re-analysing as the remedy, since re-analysing with zero documents cannot produce content

---

### FR-DDP-004: Deleting a document removes its orphaned parse job

**Priority:** Should **Persona:** System

Deleting a document SHALL remove the record holding that document's extracted text. Today each deletion leaks one permanent record carrying the full text, growing without bound.

#### Scenario 1: No leaked record

- **GIVEN** a document with a completed parse job
- **WHEN** the Analyst deletes it
- **THEN** both the document record and its parse job record are gone
- **AND IT MUST** delete by that document's own job identity, never by a query over the assessment
- **BUT it must NOT** delete records belonging to any other document, or of any other job type

*Deleting by identity covers "any other document"; the job type must be constrained separately, since a document's job link is unique per document but says nothing about that job's type.*

#### Scenario 2: Partial failure leaves no orphan

- **GIVEN** a deletion in progress
- **WHEN** the operation fails partway
- **THEN** the document and its parse job are either both removed or both retained
- **BUT it must NOT** leave a parse job whose document is gone

#### Scenario 3: A failed deletion is not reported as success

- **GIVEN** a deletion that fails server-side for any reason other than the document already being gone
- **WHEN** the Analyst removes the document in the UI
- **THEN** the failure is surfaced and the document remains listed
- **BUT it must NOT** disappear from the list, since that reproduces this very bug with a stronger illusion of success

---

## 4. Non-Functional Requirements

### NFR-DDP-010: Polling for content is bounded

**Description:** The merged-content request re-polls every 5 seconds while no content is present and stops only once content arrives, so any state that will never produce content polls forever.

- **GIVEN** an assessment whose merged content is absent
- **WHEN** the Gap Detector is left open
- **THEN** polling stops after a bounded number of attempts
- **AND IT MUST** keep polling while an analysis is genuinely in flight, since that is the **only** way the client can learn a **server-chained** run finished — that job's id never reaches the browser, so there is nothing else to wait on
- **AND IT MUST** stop immediately, without consuming attempts, when content is withheld under FR-DDP-002 **and no analysis is in flight**
- **AND IT MUST NOT** use "an analysis is running" as the **bound** — a job that fails below its attempt limit is reset to pending and never retried, so it can be true forever. The attempt cap remains the bound in every case
- **AND IT MUST** still refresh the panel when an analysis completes, whether or not polling is still active (FR-DDP-003 Scenario 2 depends on this)

*v2.1 amends two clauses.* The original forbade relying on whether an analysis was running **at all** — written to stop job state being used as a *bound*, which it cannot be, since nothing retries a job reset to pending. T-008 showed that reading was too strong: it also removed the only signal by which the client can observe a **server-chained** completion, and the panel froze until a manual reload. The distinction v2.1 draws is between using in-flight as a **bound** (still forbidden) and as a reason to **keep** polling under a bound that still applies (now required).


### NFR-DDP-011: Deletion consumes no AI budget

Deleting a document SHALL trigger **zero** model invocations. Deleting *n* documents one at a time SHALL trigger zero, not *n*. Refreshing stays an explicit action.

### NFR-DDP-012: Fix confined to the root cause

No schema migration. No unrelated cleanup folded in. Adjacent defects found during design are recorded rather than fixed, except where the primary fix is unobservable without them (FR-DDP-004 Scenario 3).

---

## 5. Business Rules

| ID | Rule |
|----|------|
| BR-DDP-001 | "Current documents" means the assessment's existing document records when a run starts — never the historical set of jobs ever created for it |
| BR-DDP-002 | A stored analysis is invalid only when it describes a document that no longer exists. A document being **added** does not invalidate it — the analysis is then incomplete, but nothing in it is false |
| BR-DDP-003 | Withholding an analysis never destroys the Analyst's own edits — gap-field corrections survive, as they do today across every run |
| BR-DDP-004 | Deletion is never a trigger for AI work |

---

## 6. Defect Classes And Their Gates

Every class this spec can produce, mapped to the check that catches it **and to the concrete input that would make that check fail**. A check that cannot be made to fail is not evidence, however green it reports.

Per **KZ-008**, whose four post-validation bugs were all invisible to mocked unit tests and found only by manual browser testing.

| # | Defect class | Gate | Input that makes it FAIL | Sees it? |
|---|---|---|---|---|
| D1 | Merge input still includes a deleted document's content | `…api test --testPathPattern=gap-detection.handler` | Documents `{B}` plus a completed job for deleted A; fails if A's text appears | **Yes** |
| D2 | The withholding rule is wrong in **either** direction | `…api test --testPathPattern=assessments.service` | Four fixtures: analysed `[jobA]` + documents `{A,B}` → **must serve**; analysed `[jobA]` + documents `{B}` → **must withhold**; recorded empty → **must serve**; no record at all → **must withhold**. The v1.x design failed the first | **Yes** |
| D3 | Orphan job not deleted, wrong record deleted, or a different job type deleted | `…api test --testPathPattern=assessments.service` | An assessment with two documents plus an unrelated analysis job; fails if the delete is unscoped by id or by type | **Yes** |
| D4 | **Cross-screen cache invalidation** — deletion happens on `/assessments/upload`, the stale render on `/assessments/gap-detector`. Separate caches | `…web test --testPathPattern=use-multi-document-status` (**new file**) | A mutation whose success handler does not invalidate the merged-content query | **The call, yes. The cross-screen effect, no** — KZ-008's exact class. Manual QA below |
| D5 | Polling unbounded, or stopping while content is still expected | `…web test --testPathPattern=use-merged-content` (**new file**) | A poll returning an interval past the cap, or stopping before it | **Yes** |
| D6 | The notice renders but is not legible or not actionable | `…web test --testPathPattern=document-viewer` (**new file**) | Rendering the withheld state with no re-analyse affordance, or with the same text as the ordinary empty state | **Presence, yes. Comprehensibility, no** — human check at the HITL pause |
| D7 | Regression in the undeleted multi-document merge | FR-DDP-001 Scenario 3 test | A two-document fixture with no deletions whose merged output loses a document, changes order, or changes separator format | **Yes** |
| D8 | **Cross-field propagation** — gap-field values and the country-mismatch hint derive from the same merged text, so after a deletion they still describe the deleted document until the next run | None automatable | Nothing — there is no gate. An **accepted, bounded residue**: out of scope per §2, overwritten by the next run, covered by manual step 6 | **No** |

### Mandatory manual-QA walkthrough (KZ-008)

D4, D6 and D8 have no automated gate for the property that matters. Required before this spec is done:

1. Delete A → upload B → the Gap Detector shows only B (FR-DDP-001 Sc 1).
2. Delete A → upload nothing → no A content, and an explicit notice (FR-DDP-002, FR-DDP-003).
3. Leave that screen open ~60 s → merged-content requests have stopped (NFR-DDP-010).
4. Delete the last remaining document → the no-documents state, offering upload rather than re-analysis (FR-DDP-003 Sc 3).
5. **Upload a second document to an already-analysed assessment** → the existing analysis **stays visible and readable** throughout upload, parsing, *and the new analysis run* — not replaced by a spinner or an empty panel — and the screen refreshes by itself when the run completes (FR-DDP-002 Sc 4). *This is the case the v1.x design broke three times; the third failure was during the analysis run specifically, so watch that window.*
6. **In the withheld state, look at the gap-field values and any country-mismatch hint** → the D8 residue is bounded to those surfaces and clears after re-analysing.
7. **Save a gap field and watch the document panel** → it does not blank out during the debounced re-analysis. Same class as step 5, on the higher-frequency path.
8. Click **Re-analyse now** → the notice clears with no manual reload, and the gap-field list still holds ten fields, not twenty.
9. **Force a delete to fail** (e.g. offline) → the failure is surfaced and the document stays listed (FR-DDP-004 Sc 3).

Recording "unit tests green" without this walkthrough repeats the failure KZ-008 documents.

---

## 7. Dependencies & Assumptions

**Dependencies:** None. Self-contained to the gap-detection and assessments domains. Parallel-safe — verified 2026-08-21; the only other active spec, `docs/specs/enhancements/upload-word-documents/`, touches neither the merge query nor document deletion. Not a member of any `family.md`.

| ID | Assumption | Basis |
|----|------------|-------|
| A1 | A parse job belongs to at most one document | `parseJobId` is `@unique` (`schema.prisma:297`) — verified |
| A2 | Every parsed document carries a link to its parse job | All three parse-creation paths write it in the same call — verified (`design.md` §5) |
| A3 | Analyses are triggered by the **last** document finishing parsing, or by the re-analyse endpoint — never by deletion. A single failed document blocks the chain indefinitely | Verified: the chain fires only when every document has parsed (`jobs.service.ts:177`) |
| A4 | Analyst edits to gap fields are not lost when an analysis is withheld | Existing behaviour — fields are deleted and recreated each run |

---

## 8. Open Questions

| ID | Question | Status |
|----|----------|--------|
| OQ-1 | Exact copy for the withheld-content notice | **Resolved 2026-08-24 (Leader decision).** Final: *"This analysis is out of date — it doesn't reflect the documents currently on this assessment."* and *"No documents on this assessment."* The provisional wording had a **dangling referent** — "the current documents — one of them was removed or replaced" points at the current set, which by definition excludes the removed document. The zero-documents string had also **drifted from the design** to "No documents *remain*", asserting there were documents before, which is false on an assessment that never had any. "Out of date" is honest for all three causes the rule fires on — deletion, re-parse, and a pre-fix analysis — without asserting which, satisfying FR-DDP-003 Sc 1's "must NOT state a cause the application cannot know" |
| OQ-2 | Root `CLAUDE.md` mandates `ApiResponse<T>` for all API responses, but **zero endpoints use it** — all 125 `ApiResponse` occurrences in `packages/api/src` are the unrelated `@nestjs/swagger` decorator. Complying here would make this the only enveloped endpoint | **Open — escalated, not self-exempted.** A repo-wide rule/reality mismatch belonging to the constitution or TRD, not to a bugfix spec |
| OQ-3 | Mounting the document panel for all UPLOAD assessments changes the loading-state layout on the normal path | **Resolved 2026-08-24 (Leader decision): keep it.** §14's challenge established the reflow is **not eliminated** either way — `hasDocument` derives from `intakeMode`, which is undefined while the assessment query is in flight, so a one-to-two-column reflow still occurs on first paint. The real choice is therefore between *one reflow, earlier* and *one reflow, later plus a panel that vanishes in several states*. The former is strictly better, and it is what makes `DocumentViewer`'s states reachable at all. Reversible in one line (`gap-detector-client.tsx`'s `hasDocument` argument) if the T-008 walkthrough disagrees |

---

## 9. Requirement ID Index

| ID | Title | Priority |
|----|-------|----------|
| FR-DDP-001 | The analysis reads only documents that currently exist | Must |
| FR-DDP-002 | A stored analysis describing a deleted document is not served | Must |
| FR-DDP-003 | The screen explains withheld content and offers the remedy | Must |
| FR-DDP-004 | Deleting a document removes its orphaned parse job | Should |
| NFR-DDP-010 | Polling for content is bounded | Must |
| NFR-DDP-011 | Deletion consumes no AI budget | Must |
| NFR-DDP-012 | Fix confined to the root cause | Should |
| BR-DDP-001 | "Current documents" means existing records, not historical jobs | — |
| BR-DDP-002 | Only a removal invalidates an analysis; an addition makes it incomplete | — |
| BR-DDP-003 | Withholding never destroys Analyst edits | — |
| BR-DDP-004 | Deletion never triggers AI work | — |

---

## 10. Constitution Alignment Checklist

- [x] Scoped items align with `docs/prd.md` — a correctness fix to existing behaviour, no new capability
- [x] Personas match PRD (Analyst / System)
- [x] No frontend-direct-Bedrock requirements
- [x] Async AI work uses the job polling pattern — unchanged by this spec
- [x] Static-export routing uses query params, not `[id]` paths — unchanged
- [x] Every defect class maps to a gate **and to the input that would make that gate fail**
- [x] KZ-008 applied in full: cross-screen cache invalidation (D4) **and** cross-field propagation (D8), each with a manual-QA step
- [x] No gate names a file that does not exist — the three new test files are named explicitly
- [x] No requirement contradicts another (the v1.x Scenario-3 contradiction is resolved above)
