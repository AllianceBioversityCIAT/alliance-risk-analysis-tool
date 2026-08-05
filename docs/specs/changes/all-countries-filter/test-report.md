# All-Countries Dashboard Filter — Test Report

## 1. Document Control

| Field | Value |
|-------|-------|
| **Module** | `changes/all-countries-filter` |
| **Requirements ref** | `requirements.md` v1.0 |
| **Design ref** | `design.md` v1.0 |
| **Execution ref** | `execution.md` (all 4 tasks `[x]`, manual QA complete) |
| **Date** | 2026-08-05 |
| **Suites run** | 1 (Frontend unit) — 1 Tester spawned (Sonnet, general-purpose subagent, fallback sub-prompt) |

---

## 2. Summary

**Overall status: PASS.** No product bugs found. Two real coverage gaps identified by the Leader before delegation were closed with new, focused tests. All 8 requirement/NFR/BR IDs have direct test evidence — none rely on "related code exists" as proof.

- **Suites planned:** Frontend unit only. This spec is Web-only (NFR-ACF-001) with zero backend/shared-package change, and the existing "omit `country` = all" API behavior is inherited, untouched, and out of this spec's test scope — no backend, integration, or E2E suite was needed.
- **Testers spawned:** 1 (single substantial suite, Standard depth, per the Deployment Rule).
- **New tests added:** 4 — 2 in `use-assessments.test.ts` (Gap 1), 1 in `start-assessment-modal.test.tsx` (Gap 2), plus the Tester's inner-loop verification confirmed all pre-existing tests still pass.
- **Total suite result:** 19/19 new-and-existing targeted tests pass; full-package run 112/114 (2 pre-existing, unrelated failures — see §9).
- **Product bugs found:** None.

---

## 3. Backend Unit Tests

Not applicable. NFR-ACF-001 requires zero backend/`@alliance-risk/shared` change; verified structurally (`git diff` touches nothing under `packages/api/` or `packages/shared/`) rather than by a new backend suite.

---

## 4. Frontend Unit Tests

**Command:** `cd packages/web && npx jest --testPathPattern="country-filter-provider|app-header|start-assessment-modal|use-assessments"`

**Result:** 4 suites, 19/19 tests passed (10 pre-existing/execute-phase + 4 new from this test pass + 1 pre-existing use-assessments test).

New tests added this pass:
- `use-assessments.test.ts` — `useAssessments({ country: undefined })` never sends a literal/empty/sentinel `country` param
- `use-assessments.test.ts` — `useAssessmentStats(undefined)` omits the `params` object entirely
- `start-assessment-modal.test.tsx` — auto-draft-save while "All countries" is active saves `country: "Kenya"`

---

## 5. Integration Tests

Not applicable — no cross-module/API behavior introduced by this spec beyond the existing, unmodified "omit `country` = all" endpoint behavior (already covered by the archived multi-country-enablement spec's own test suite).

---

## 6. E2E Tests

Not applicable for this spec's size/risk — covered instead by the user's manual QA pass (`tasks.md` §7, all 6 items confirmed 2026-08-05) plus the analyst 17-step protocol (`docs/testing/analyst-test-protocol.md`) at the next full regression pass, not a per-spec obligation.

---

## 7. Coverage & Traceability

| Requirement | Scenario | Test Type | Test File / Command | Result | Notes |
|---|---|---|---|---|---|
| FR-ACF-001 | 5 options, "All countries" first; no `getCountryFlag()` call on sentinel | Unit (RTL) | `app-header.test.tsx` | PASS | Pre-existing (execute phase) |
| FR-ACF-001 | `BUT it must NOT` leak into `SUPPORTED_COUNTRIES`/create list | Unit (RTL) + structural | `start-assessment-modal.test.tsx::"renders four country options"` | PASS | `SUPPORTED_COUNTRIES` is a `const`, only `.map()`'d (non-mutating) — accepted non-gap, no redundant test needed |
| FR-ACF-002 | `resolveListCountryParam` maps sentinel → `undefined` | Unit | `country-filter-provider.test.tsx` | PASS | Pre-existing |
| FR-ACF-002 | **Gap 1:** `useAssessments` omits `country` at the actual API-call boundary | Unit | `use-assessments.test.ts` (new) | PASS | Gap closed this pass |
| FR-ACF-002 | **Gap 1:** `useAssessmentStats` omits `country` at the actual API-call boundary | Unit | `use-assessments.test.ts` (new) | PASS | Gap closed this pass |
| FR-ACF-003 | Fresh session → sentinel default; invalid/corrupted storage → sentinel | Unit | `country-filter-provider.test.tsx` | PASS | Pre-existing |
| FR-ACF-003 | Regression: valid stored real country restores unchanged | Unit | `country-filter-provider.test.tsx` | PASS | Pre-existing |
| FR-ACF-004 | Sentinel persists like any real value | Unit | `country-filter-provider.test.tsx` | PASS | Pre-existing |
| FR-ACF-005 | Explicit create: 4-option Select, defaults to Kenya | Unit (RTL) | `start-assessment-modal.test.tsx` | PASS | Pre-existing |
| FR-ACF-005 | **Gap 2:** Auto-draft-save while sentinel active → `country: "Kenya"` | Unit (RTL) | `start-assessment-modal.test.tsx` (new) | PASS | Gap closed this pass — exercises the real `handleClose` path, not just the rendered field default |
| NFR-ACF-001 | No backend/shared-contract change | Structural | `git diff` scope | PASS | No `packages/api/` or `packages/shared/` file touched |
| NFR-ACF-002 | Backward compatibility for real-country storage | Unit | `country-filter-provider.test.tsx` | PASS | Pre-existing |
| BR-ACF-001 | Sentinel never sent to API as a literal string | Unit | `use-assessments.test.ts` (new) | PASS | Proven directly by the Gap 1 tests |

Every FR/NFR/BR ID in the spec has direct test evidence. No ID is marked covered solely because production code exists.

---

## 8. Remediation

None required — no failures, no product bugs.

---

## 9. Accepted Gaps

| Gap | Reason automation was deferred | Mitigation |
|---|---|---|
| `assessment-table.test.tsx` — 2 pre-existing failing assertions (`getByText('Draft')` ambiguous match) | Predates this spec entirely (confirmed via `git stash` isolation against the T-001-only-committed base during `/akili-execute`); unrelated to the "All countries" filter logic | Out of scope for this spec — recommend a separate ticket/spec to fix the test's ambiguous query |
| No dedicated E2E suite for the full dashboard → header → create-modal flow | Spec size/risk (Web-only, view-state-only, no backend) doesn't warrant a new E2E harness; manual QA (`tasks.md` §7) already exercised the full flow in a real browser | User completed the 6-item manual QA checklist 2026-08-05, zero issues reported |

---

## 10. Next Command

Testing complete, all gaps closed or accepted with rationale. Recommend proceeding to PR creation, or `/akili-validate` if an additional independent spec-to-code alignment audit is wanted first.
