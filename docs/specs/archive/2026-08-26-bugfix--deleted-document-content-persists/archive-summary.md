# Archive Summary — Deleted Document Content Persists In Gap Detection

## Outcome

> **Shipped and verified.** Deleting a document now removes its content from everywhere downstream — the analysis, the viewer, and the document list. 9 tasks, 619 tests, one manual walkthrough that earned its place three times over.

| Field | Value |
|-------|-------|
| **Original path** | `docs/specs/bugfix/deleted-document-content-persists` |
| **Archive date** | 2026-08-26 |
| **Final status** | ✅ Complete — 9/9 tasks, validation clean, all blocking findings closed |
| **Type** | Bug (Bug Mode) · **Depth** Standard |

---

## 1. Document Control

| Document | Version | Note |
|---|---|---|
| `proposal.md` | 1.3 | Approved intent; two claims later corrected by design discovery |
| `requirements.md` | 2.1 | 4 FR, 3 NFR, 4 BR, 9 defect classes, 9-step manual walkthrough |
| `design.md` | 2.1 | **Second lineage** — v1.x escalated out of Judgment Day and was replaced |
| `tasks.md` | 1.0 | 9 tasks; T-009 added after manual QA |
| `execution.md` | — | Full audit trail, 7 rework rounds, 2 pivots, and the Leader's own errors |
| `judgment.md` | — | 5 review passes across the discarded v1.x lineage |
| `test-report.md` | — | `/akili-test`, 2 Testers on Opus (author ≠ tester) |
| `validation-report.md` | — | `/akili-validate`, judgment half delegated for independence |
| `qa-walkthrough.md` | — | Operator guide for T-008, in Spanish by design |

## 2. The Bug, and What It Actually Was

Deleting a document via *Manage Documents* left its parsed text in the pool the analysis drew from — so it kept re-entering every future run and the document viewer, indefinitely.

Investigation split it into **two** scenarios, and the second was never in the original report:

| | Delete A, upload B | Delete A, upload nothing |
|---|---|---|
| What refreshed it | Uploading B chained a new run | **Nothing** |
| What the user saw | A+B merged instead of B | A, forever |

## 3. Requirements Delivered

| ID | Requirement | Evidence |
|---|---|---|
| FR-DDP-001 | The analysis reads only documents that currently exist | 8 backend tests, 2 independent gates |
| FR-DDP-002 | A stored analysis describing a deleted document is not served | 5 withholding fixtures |
| FR-DDP-003 | The screen explains withheld content and offers the remedy | `document-viewer` suite + manual steps 2, 4, 8 |
| FR-DDP-004 | Deleting removes the orphaned parse job — and the document disappears everywhere | transactional delete + 7 modal tests + manual step 9 |
| NFR-DDP-010 | Polling is bounded | `use-merged-content` suite |
| NFR-DDP-011 | Deletion consumes no AI budget | asserted on the delete path |
| NFR-DDP-012 | Fix confined to the root cause | **zero schema changes** across the whole spec |

## 4. Files Changed

**9 production files, 2,797 lines, no schema migration.**

| Package | Lines | What |
|---|---|---|
| `shared` | 15 | `MergedContentResponse` — three fields |
| `api` | 1,031 | merge scoping, transactional cleanup, the withholding rule, `analysisInFlight` |
| `web` | 1,751 | poll bounds, three cache invalidations, the viewer's states, the delete-failure surface |

Six new test files. The country filter, dashboard, reports and risk scorecard were **untouched** — verified by consumer analysis, not assumed.

## 5. Test Evidence

**619 passing** — API 418 (+2 skipped), Web 201 (+2 pre-existing failures in an unrelated dashboard suite).

Coverage was built continuously in Bug Mode: a mandatory red regression suite (T-002) before any fix, then per-task tests each audited by an independent Reviewer on a different model. `/akili-test` later added 12 more, every one proven by **mutating production code and re-running**.

## 6. Validation

All 7 blocking findings closed. Code conformance **PASS** at clause granularity; the failures were in the documents, not the implementation — a budget table with empty cells, a test count wrong in three places that agreed with each other, and a decision record still quoting a rejected string.

## 7. Accepted Warnings & Follow-Ups

| # | Item | Why accepted |
|---|---|---|
| 1 | **Undeletable document with its file already gone** — if the job delete raises P2025 the transaction rolls back, but S3 deletion already happened | Low likelihood (no code path deletes job rows); **high unrecoverability**. The highest-severity live item |
| 2 | Cross-package timing invariant has no automated guard | Not automatable without moving constants into `shared`; the production change is recommended, not made |
| 3 | `useMultiDocumentStatus` polls forever on an empty list | Same unbounded-poll class, one file away. Flagged three times, deliberately not minted |
| 4 | `'sourceParseJobIds' in result` should be `Array.isArray(...)` | Strictly stronger; removes a `TypeError`→500 path |
| 5 | Assessment-level deletion still leaves parse jobs behind | Storage-growth motivation only half closed |
| 6 | New viewer states lack `role="status"`/`aria-live` | Real, but **no requirement mandates it** — `docs/ux-ui/design.md` §10 lists concrete expectations and live regions are not among them |
| 7 | Prisma is mocked in both API suites | Query *issuance* is gated, not that Prisma honours it. Needs an integration harness |

## 8. Historical Notes — what this spec cost, and what it taught

**The design was written twice.** The v1.x lineage went through two Judgment Day fix rounds and **escalated** with severe findings open. Its root error: it asked *"do the document sets still match?"* and treated every inequality as a deletion — so adding a document also read as a deletion. Three successive fixes each corrected the symptom in one time window and moved it to the next.

v2.0 replaced it with one directional rule: **does the stored analysis reference a document that no longer exists?** That question has one answer, no time windows, no states — and it cut the design from 12 tasks to 7.

**Then v2.0 over-corrected.** It discarded an orthogonal in-flight boolean that round two had *already diagnosed as correct*, describing it as scaffolding. It was the answer, not the scaffolding. Manual QA found the three defects that omission caused, and v2.1 restored it.

**The manual walkthrough is why this spec shipped correct.** It found three real defects that 611 automated tests could not: a cross-screen cache the design never named, a state the design had removed, and — the most valuable finding of the whole spec — **a category of analysis completion with no client signal at all**, which had no defect class, no gate, and no reviewer who spotted it.

**Errors the Leader made, recorded because they are the reusable part:** an amendment script that failed partway and was committed unverified (caught by an Implementer); a second unverified write after a failed `cd` (caught later by the Leader); a claim that a finding broke the deploy, which it did not; and a verification gate declared as "must be clean" that was unsatisfiable.

**Kaizen:** KZ-011 through KZ-014 recorded. All three of this cycle's lessons are dual — none names a stack, domain or local convention — and are recommended for upstreaming to the AKILI methodology repository.
