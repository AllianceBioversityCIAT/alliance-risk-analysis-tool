# All-Countries Dashboard Filter — Execution Log

## 1. Document Control

| Field | Value |
|-------|-------|
| **Module** | `changes/all-countries-filter` |
| **Requirements ref** | `requirements.md` v1.0 |
| **Design ref** | `design.md` v1.0 |
| **Tasks ref** | `tasks.md` v1.0 |
| **Execution started** | 2026-08-05 |
| **Leader model** | Sonnet 5 (session model; registry recommends `opus` for T1 — flagged, not switched, see task entry below) |

---

## 2. Task Execution History

### T-001 — Sentinel, widened types, and `resolveListCountryParam` in `CountryFilterProvider`

- **Status:** `[~]` BLOCKED (Pivot — see Pivot Record below)
- **Date:** 2026-08-05
- **Attempts run:** 1 (loop stopped before a rework attempt — see Pivot Protocol)

#### Attempt 1

- **Implementer model:** Sonnet (general-purpose subagent, fallback sub-prompt — no Step 8E wrapper present in this project)
- **Skills instructed:** `vercel-react-best-practices`
- **Effort:** medium (default T2 — well-specified task)
- **Files changed:**
  - `packages/web/src/providers/country-filter-provider.tsx` (modified)
  - `packages/web/src/providers/__tests__/country-filter-provider.test.tsx` (new)
- **Implementer verification:**
  - `pnpm --filter @alliance-risk/web test -- --testPathPattern=country-filter-provider` → 7/7 passed (5 required scenarios + 2 extra, incl. localStorage-throw case)
  - `pnpm --filter @alliance-risk/web build` → **fails**, 1 error: `app-layout.tsx:46` — `Type 'CountryFilterValue' is not assignable to type '"Nigeria" | "Ethiopia" | "Kenya" | "Zambia"'`
  - Implementer confirmed via isolated `tsc --noEmit` sweep that this is the *only* non-test-file type error in the package, and traced it to `app-header.tsx`'s `AppHeaderProps` still being typed `SupportedCountryLabel` — explicitly T-002's scope (design.md §4.2), not T-001's.
- **Implementer report — Not Done / Assumptions:** Full-package build does not pass; attributed to T-002 not yet landed, per the tasks.md dependency graph (`T-001 ─► T-002/T-003/T-004`).
- **Reviewer model:** Opus (general-purpose subagent, fallback sub-prompt — different model than Implementer per author ≠ auditor)
- **Reviewer verdict:** `STATUS: FAIL`
  - Independently reproduced the single `app-layout.tsx:46` build error and confirmed root cause (`app-header.tsx` prop types, T-002 scope).
  - Confirmed the diff is line-for-line conformant to design.md §4.1, DD-ACF-001, DD-ACF-002; all 6 requirements/NFRs/BR mapped to T-001 (FR-ACF-002, FR-ACF-003, FR-ACF-004, NFR-ACF-001, NFR-ACF-002, BR-ACF-001) are Met; `@alliance-risk/shared` confirmed untouched; no unrelated code touched.
  - **Gate reason given:** T-001's own "Done when" line in `tasks.md` literally requires full-package `pnpm --filter @alliance-risk/web build` to succeed. That is objectively unmet — but the Reviewer explicitly flagged this as a **spec-internal contradiction**, not an implementation defect: the acceptance criterion is unsatisfiable within T-001's scope boundary given the task graph, since T-002 (which the error depends on) itself depends on T-001.
  - Recommended resolution (Reviewer's own words): either land T-002 and gate the full-build check at the PR level (tasks.md §4's single-PR strategy), or amend T-001's "Done when" to scope the typecheck to its own file, deferring the package-level gate to the consuming phase.
  - **ADVISORY (non-gating):** minor test hygiene note — `getItemSpy.mockRestore()` in the storage-throw test runs after `waitFor`; a `try/finally` or `beforeEach`-scoped mock would harden it against leaking into later tests if `waitFor` ever rejected. No action required; not a spec violation.
- **Leader adjudication:** This is Pivot Protocol territory, not a normal FAIL — per `.agents/leader.md` §5 and the command's Error Handling & Pivot Protocol: *"If Implementer or Reviewer discoveries reveal that requirements or design are wrong or technically unviable... stop looping immediately."* Spawning a fresh Implementer attempt would ask it to rework code the Reviewer itself certified as fully spec-conformant — that would waste an attempt and could only "fix" the build by having T-001 illegitimately reach into T-002's file (`app-header.tsx`), which is an explicit scope violation of the task boundary. Loop stopped before consuming attempt 2. See Pivot Record below.

---

## 3. Pivot Record: T-001

- **Trigger:** Reviewer FAIL, but the cause is a defect in `tasks.md`'s own acceptance criterion, not the implementation.
- **What's wrong:** T-001's "Done when" line reads: *"All 5 test cases above pass; `pnpm --filter @alliance-risk/web build` (typecheck) succeeds with the widened types."* The second clause requires a **full-package** typecheck to be green. But T-001 intentionally widens `CountryFilterValue` ahead of its only consumer that needs updating (`app-header.tsx`'s props), and that consumer's widening is explicitly assigned to **T-002** (design.md §4.2; tasks.md dependency graph `T-001 ─► T-002/T-003/T-004`). A full-package build cannot go green until T-002 lands — which itself depends on T-001. The criterion as written is unsatisfiable in isolation; it describes a state that only exists after a *later* task completes.
- **Evidence:** Both Implementer and Reviewer independently reproduced the same single error (`app-layout.tsx:46`, root-caused to `app-header.tsx`'s still-narrow prop types) and confirmed no other non-test type errors exist anywhere in the package.
- **Is the code wrong?** No — Reviewer certified 100% requirement conformance (FR-ACF-002/003/004, NFR-ACF-001/002, BR-ACF-001) and 100% technical compliance with design.md §4.1. Zero unrelated files touched, `@alliance-risk/shared` untouched.
- **Alternatives considered:**
  1. **Rework the diff anyway** — rejected: there is nothing wrong with the diff to rework; the Implementer would either resubmit the same code or illegitimately touch `app-header.tsx` (T-002's file), which is a scope violation the Implementer persona explicitly prohibits.
  2. **Land T-002 first, then retroactively validate T-001's full-build clause** — viable, but inverts the documented task order and risks the same "which task actually gate on the build" ambiguity recurring for T-002/T-003/T-004 individually.
  3. **Amend `tasks.md`'s T-001 "Done when" to scope the typecheck check to this task's own file/tests, and note that the full-package build gate belongs to the PR as a whole (per tasks.md §4's own "single PR" strategy) — recommended by the Reviewer, and consistent with the fact that T-002/T-003/T-004 are designed to land before the PR closes.** — **Selected**, pending user approval below.
- **Proposed amendment to `tasks.md` (T-001 "Done when"):**
  - **From:** *"All 5 test cases above pass; `pnpm --filter @alliance-risk/web build` (typecheck) succeeds with the widened types."*
  - **To:** *"All 5 test cases above pass. `tsc --noEmit` introduces no new type errors outside `app-header.tsx` (the one file explicitly owned by T-002, which consumes the widened type). Full-package `pnpm --filter @alliance-risk/web build` is a PR-level gate (tasks.md §4), verified once T-002/T-003/T-004 land — not an individual T-001 acceptance criterion."*
- **No ADR affected** — this is a task-plan wording defect, not an architecture decision; no TRD ADR is implicated.
- **Requirements/design impact:** None. `requirements.md` and `design.md` are unaffected — only `tasks.md`'s acceptance-criterion wording for T-001 needs correction.

**Resolution:** User approved amending `tasks.md` (option: "Amend tasks.md wording"). Applied the exact amendment proposed above to T-001's "Done when" line, with an inline note pointing back to this Pivot Record. No change to `requirements.md` or `design.md` — none was implicated.

**Final status:** T-001 `[x]` PASS — closed under the amended acceptance criterion, which the Attempt 1 evidence already satisfies in full (7/7 tests; `tsc --noEmit` confirmed zero new errors outside `app-header.tsx`). No rework attempt was consumed; the Reviewer's FAIL was correctly attributed to the spec, not the code.

- **Requirements covered:** FR-ACF-002, FR-ACF-003, FR-ACF-004, NFR-ACF-001, NFR-ACF-002, BR-ACF-001
- **Decisions made:** Amended T-001's "Done when" wording in `tasks.md` to scope the typecheck gate correctly (see amendment above); no requirements/design change.
- **Issues encountered:** Spec-internal contradiction in `tasks.md`'s acceptance criterion (resolved via Pivot, user-approved).
- **Final verification result:** `pnpm --filter @alliance-risk/web test -- --testPathPattern=country-filter-provider` → 7/7 passed. Isolated `tsc --noEmit` sweep → zero new errors outside `app-header.tsx` (T-002 scope, tracked as a PR-level gate).
