# Validation Report — Deleted Document Content Persists In Gap Detection

## Verdict

> **The implementation is archive-ready. The document set was not, and has been corrected.**
>
> Code conformance: **PASS** at clause granularity, with gates verified to be falsifiable rather than decorative. Document coherence: **FAILED** on seven checkable-arithmetic findings — all now fixed. Nine advisories remain live and are listed for `/akili-archive`.

| Area | Verdict |
|---|---|
| Task completion | ✅ PASS |
| File existence | ✅ PASS |
| Build integrity | ✅ PASS |
| Requirement coverage | ⚠️ WARN — three evidence-asymmetry gaps, none a shipped defect |
| Design conformance | ✅ PASS |
| Cross-document figures | ❌ FAIL → **fixed during validation** |
| Internal coherence | ❌ FAIL → **fixed during validation** |
| Proposal alignment | ✅ PASS |
| Constitutional compliance | ⚠️ WARN — OQ-2 honest but unrouted |

---

## 1. Document Control

| Field | Value |
|-------|-------|
| **Spec** | `docs/specs/bugfix/deleted-document-content-persists` |
| **Date** | 2026-08-25 |
| **Requirements** | v2.1 · **Design** v2.1 · **Proposal** v1.3 · **Tasks** v1.0 |
| **Base commit** | `1f52297` · **Head** at validation: post-T-008 close |

### Independence — stated, because it limits what this report is worth

`/akili-validate` is an independence check, and the orchestrator running it **authored `requirements.md`, `design.md` and `tasks.md` and made every adjudication during execution.** Auditing conformance against documents you wrote is the exact bias the phase exists to catch.

So the work was split:

| Half | Who | Why |
|---|---|---|
| Mechanical — builds, lint, tests, file existence, schema, measured LOC | Orchestrator, inline | Objective and re-runnable; authorship cannot bias a build result |
| Judgment — clause coverage, design conformance, cross-document figures, coherence, proposal alignment | **Independent auditor, fresh context, read-only** | Where authorship biases the reading |

The auditor was briefed to treat the spec documents as **suspect artifacts, not ground truth**. It found two FAIL sections, both in documents the orchestrator wrote.

---

## 2. Summary

| Metric | Value |
|---|---|
| Tasks | **9 / 9** complete |
| Code changed | **2,797 lines**, 15 files (15 shared · 1,031 api · 1,751 web) |
| Tests | **611 collected** — API 413 pass / 2 skip; Web 194 pass / 2 fail (pre-existing, unrelated) |
| Review rounds | **7** Reviewer FAIL verdicts |
| Schema changes | **zero** (NFR-DDP-012 holds) |
| Findings | 7 blocking → **all fixed**; 8 non-blocking; 9 advisories carried |

---

## 3. Task Completion — PASS

All nine tasks `[x]` with attempt-by-attempt evidence in `execution.md`. Notably **not** a clean sweep, which is a health signal rather than a blemish:

| Task | Attempts | What the extra rounds bought |
|---|---|---|
| T-002 | 3 | A transaction mock that would have failed a *correct* T-004 — twice, in shape then in lifecycle |
| T-006 | 2 | A poll cap that counted successes, not attempts — unbounded on a permanently failing request |
| T-007 | 3 | An ambiguous `documents.length === 0` fixed in the component but not in the caller's remedy gate |
| T-009 | 3 | Spec/code divergence, then a stuck-job dead end that made the remedy unreachable |

One approved **Pivot** (T-003) and one Pivot from manual QA (T-008 → T-009).

---

## 4. File Existence — PASS

All 14 files declared in `design.md` §4 present. One omission from the map, explained in `execution.md` but not where a reader looks first: `gap-detector-client.test.tsx` was edited twice and §4 never listed it.

## 5. Build Integrity — PASS

| Check | Result |
|---|---|
| `pnpm --filter @alliance-risk/shared build` | ✅ |
| `pnpm --filter @alliance-risk/api build` | ✅ |
| `pnpm --filter @alliance-risk/web build` | ✅ |
| `pnpm lint` (monorepo) | ✅ |

The 2 web test failures are in `assessment-table.test.tsx`, a dashboard suite this spec never touches, verified failing identically at the base commit.

---

## 6. Requirement Coverage — WARN

Coverage is genuinely clause-level, and the auditor probed the gates most likely to be theatre. **All five it probed are real:** the `[jobA]`/`{A,B}` serve fixture, in-flight-beats-superseded, zero-documents-beats-in-flight, at-the-cap-with-zero-successes, and non-404-does-not-invalidate.

Three gaps, none a shipped defect:

| # | Gap | Why it is WARN not FAIL |
|---|---|---|
| 6.1 | **FR-DDP-004 Sc 3 has no automated gate and no §6 defect class.** No test file exists for `upload-business-plan-modal.tsx`; the "failed delete keeps the row" clauses rest on manual step 9 alone — while §6 claims to enumerate *"every class this spec can produce"* | Manual step 9 passed. What is missing is the **honesty of saying** the automated half is absent |
| 6.2 | `tasks.md` §5's NFR-DDP-010 row omits T-009, which owns the two v2.1-amended clauses | The clauses are implemented and tested; the **table** drifted |
| 6.3 | §5 discharges FR-DDP-002 Sc 3 partly to "the 404-path closure", which is not a task ID | The closure is real and tested; the naming violates §5's own contract |

**6.1 is the second instance of the exact failure mode this spec caught once and wrote a note about** — row-level ownership of a scenario mistaken for clause-level closure. The rule was right; the sweep that applies it was not re-run after the last amendment.

---

## 7. Linting & Code Quality — PASS (advisory findings below)

Lint clean. The 4R sweep found the shipped code sound:

- **Reliability** — the one-directional rule is the right shape; the auditor could construct no case where it serves what it should withhold. The `[]`-vs-absent discriminator is preserved end to end.
- **Resilience** — the poll cap is genuinely a cap, checked before every other branch; `dataUpdateCount + errorUpdateCount` properly closes the "bound that cannot fire" class.
- **Risk** — small, contained blast radius; ownership preserved on every touched path. The auditor singled out the Prisma extended-`where-unique` verification (that `type` compiles to a real `AND type = $2` rather than being silently dropped) as **the most valuable single check in the entire execution log**.
- **Readability** — comment-to-code ratio is extreme in the changed regions (~25 comment lines for one constant). Most is load-bearing *why-not* prose earned by four repeats of the same defect class and should stay, but embedded line-number citations will rot.

---

## 8. Design Conformance — PASS

Verified section by section against `design.md` v2.1: §6 response shape, §7.1–§7.3 backend, §8.1–§8.4 frontend, and DD-DDP-001…008. Every mechanism traced to a line in the tree.

Note: the brief asked about DD-DDP-009/010; those belonged to the **discarded v1.x lineage**. No decision record is missing.

### Cross-document figures & coherence — FAILED, now fixed

Seven blocking findings, all checkable arithmetic rather than judgment:

| # | Finding | Fix applied |
|---|---|---|
| 1 | §12's v2.1 column was **literally empty** for LOC and review rounds — three cells in a four-column table | Filled with measured actuals |
| 2 | Budget: ~1,050 estimated vs **2,797 measured** (2.7×; 9.3× the original) | Recorded, with the reason the tripwire stopped firing |
| 3 | Review rounds: 2 estimated vs **7 measured** | Recorded |
| 4 | `tasks.md` §1/§6 and `execution.md` §1 still asserted the pre-re-baseline budget | All three corrected |
| 5 | **"583 automated tests"** asserted in three documents that agreed with each other and with nothing else — actual 611 | Replaced with a figure that cannot rot |
| 6 | **DD-DDP-003 still quoted the `"removed or replaced"` copy that OQ-1 explicitly rejected** — the central decision record describing strings that no longer exist, in the same document that records the rejection | Corrected; the point survives, only the quoted string was stale |
| 7 | Eight stale version cross-references across four documents | All bumped |

**Finding 5 is the "two documents agreeing is one wrong idea copied forward" pattern**, caught exactly as the check is designed to catch it. **Finding 6 is the worst of the seven**: a maintainer reading decision records first — the normal order — would have got the falsified version.

---

## 9. Test Evidence Summary

No `test-report.md` exists; `/akili-test` was not run. Coverage was built continuously instead, task by task, each suite reviewed by an independent Reviewer on a different model — the Bug Mode path, which front-loads a mandatory red regression suite (T-002) rather than deferring tests.

| Defect class | Gate | Result |
|---|---|---|
| D1 merge includes deleted content | `gap-detection.handler` | ✅ |
| D2 withholding rule wrong either way | `assessments.service` | ✅ |
| D3 orphan job / wrong record deleted | `assessments.service` | ✅ |
| D4 cross-screen cache invalidation | hook test + **manual step 1** | ✅ |
| D5 unbounded polling | `use-merged-content` | ✅ |
| D6 notice not legible/actionable | `document-viewer` + **manual step 2** | ✅ |
| D7 multi-document merge regression | `gap-detection.handler` | ✅ |
| D8 cross-field propagation | **manual only** | ✅ |
| *(unnamed)* failed delete reported as success | **manual step 9 only** — see 6.1 | ✅ |

**The manual walkthrough earned its place.** It found three real defects — two of the D4/D6 classes the spec predicted would have no automated gate, and one **no defect class had anticipated**: a whole category of analysis completion (the server-chained run) had no client-side signal at all. That third finding survived design, five review passes, two Judgment Day rounds and the entire automated suite. It was only ever going to surface in a browser.

## 10. Agent Guide / Constitution Impact

No `## Constitution Impact` blocks in `execution.md` — no module was created or reshaped, no boundary moved. One stale guide noted: `packages/shared/CLAUDE.md`'s inventory line for `assessment.types.ts` predates `MergedContentResponse`. Pending for `/akili-archive`'s Constitution Sync.

---

## 11. Remediation

### Fixed during validation (7 — were blocking)

Findings 1–7 in §8. All were document corrections; no code changed.

### Open, not blocking (8)

| # | Finding | Suggested owner |
|---|---|---|
| 6.1 | FR-DDP-004 Sc 3 has no automated gate and no §6 class | Add a D9 row routing it to manual step 9, **or** a test asserting the row survives a 500 |
| 6.2 | §5's NFR-DDP-010 row omits T-009 | Split the row by clause |
| 6.3 | §5 names a non-task as an owner | Name it as an approved follow-on to T-007 |
| 7.1 | Manual steps 6/7 swapped between `requirements.md` §6 and the guide actually executed; D8's row cites the wrong step | Renumber §6 to match the executed guide |
| 7.2 | `requirements.md` §2 lists `GapField` lifecycle out of scope while the skeleton guard changes it; NFR-DDP-012's carve-out names only one exception | Widen the exception clause to name the two approved changes |
| 7.3 | `tasks.md` §3's dependency graph has no T-009 | Add Phase F |
| 7.4 | **OQ-2 is honest but unrouted** — no owner, no destination, no follow-up artifact | Name where it goes (TRD ADR or constitution amendment) **before archive**, or it dies with the spec |
| 7.5 | `design.md` §4's file map omits `gap-detector-client.test.tsx` | Add as EDIT |

### Advisories carried to `/akili-archive` (9, ranked)

1. **Undeletable document with its file already gone.** If `tx.job.delete` raises P2025 the transaction rolls back the document delete — but S3 deletion already happened *before* the transaction. Permanently undeletable, every retry identical. `design.md` §10 asserts transaction failure is retryable; this sub-case is not. Low likelihood, **high unrecoverability — the highest-severity live item**.
2. FR-DDP-004's storage-growth motivation is only half closed — assessment-level deletion still leaves parse jobs behind.
3. `useMultiDocumentStatus` polls forever on an empty list — the same unbounded-poll class NFR-DDP-010 exists to close, one file away, **flagged three times across three tasks and never minted**.
4. The cross-package invariant (server bound < client budget) has **no automated guard** — held together by paired comments.
5. `'sourceParseJobIds' in result` should be `Array.isArray(...)` — strictly stronger, removes a new `TypeError`→500 path on a read endpoint.
6. Query cost per poll: `findMany` selecting full rows plus two `job.count`, one on an unindexed JSON path.
7. A permanently failing documents fetch pins `documentsLoading` true, making the zero-documents state unreachable.
8. **T-002's three fixtures are the sole automated gate on the reported bug** — most pre-existing handler tests ignore `where` and are structurally blind to the new scoping. Belongs in the PR description.
9. Neither new `DocumentViewer` state carries `role="status"`/`aria-live` — silent to assistive technology, and this one has a constitutional hook the advisory never invoked.

---

## 12. Archive Readiness

> **Ready.** All blocking findings are fixed. The eight open items are documentation hygiene and routing; the nine advisories are follow-up candidates, not defects in what ships.

```text
/akili-archive bugfix/deleted-document-content-persists
```

**Before archiving, route OQ-2** (remediation 7.4) — an escalated constitutional question with no destination dies with the spec, which defeats the point of escalating rather than self-exempting.

### Kaizen inputs this spec produced

The auditor named the second as more valuable than the one `design.md` §12 already nominates, and it is hard to disagree:

1. **Step 2.4 sizing does not price gate rigour.** The estimate was 9.3× low, and the miss was concentrated entirely in test evidence the spec's own rules mandate.
2. **A tripwire checked only when someone remembers is not a tripwire.** It fired once at 447 LOC, was re-baselined, and never re-evaluated while the spec grew to 2,797. It needs to re-evaluate after *every* task.
3. **"Fixed the site the finding named, missed its identical twin one level away."** Recorded **four separate times** during execution (T-002's mock, T-006's counter, T-007's remedy gate, T-009's spec/code split) — and then a fifth time in `tasks.md` §5 itself, which caught the pattern, wrote a note about it, and produced two more instances in the same table. The rule was right; the sweep was not repeated.
4. **The manual gate found a defect class nobody had modelled.** `requirements.md` §6 enumerates classes and maps each to a gate — a good discipline that still cannot enumerate the unknown. The server-chained-completion defect had no class, no gate and no reviewer who spotted it.
