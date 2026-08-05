# Validation Report — All-Countries Dashboard Filter

## 1. Document Control

| Field | Value |
|-------|-------|
| **Module** | `changes/all-countries-filter` |
| **Command** | `/akili-validate changes/all-countries-filter` |
| **Auditor** | AKILI Specification Validator (T3), model **Opus** — independent of the Sonnet Implementers/Reviewers (author ≠ auditor honored) |
| **Requirements ref** | `requirements.md` v1.0 |
| **Design ref** | `design.md` v1.0 (post-Judgment Day Round 1) |
| **Tasks ref** | `tasks.md` v1.0 (T-001 "Done when" amended post-Pivot) |
| **Date** | 2026-08-05 |
| **HEAD audited** | `ce735f2` |
| **Spec commits** | `71a46de` (T-001), `411c13a` (T-002/003/004), `ce735f2` (test phase) |

---

## 2. Summary

**Overall verdict: PASS — archive-ready.**

Independent re-audit confirms the shipped code matches every requirement, design decision, and task. Build is clean, lint is clean, and all four spec-relevant test suites pass. The two full-suite test failures are in `assessment-table.test.tsx` — I **independently reproduced** the "pre-existing, unrelated" claim via git isolation (4/4 fail pre-spec → 2/4 with spec applied; the spec *reduced* failures, never introduced them). NFR-ACF-001 (no backend/shared change) holds structurally: zero `packages/api/` or `packages/shared/` files touched by any spec commit.

| Check | Result |
|-------|--------|
| Phase 1 — Task completion | **PASS** |
| Phase 2 — File existence | **PASS** |
| Phase 3 — Build integrity | **PASS** |
| Phase 4 — Requirement coverage | **PASS** (8/8 IDs, clause-level) |
| Phase 5 — Quality / 4R (advisory) | **PASS** + advisories carried forward |
| Phase 6 — Design conformance | **PASS** (2 non-gating figure-drift WARNs) |

**Finding counts:** PASS across all gates · **0 FAIL** · **2 WARN** (both non-gating documentation/figure drift) · 4 ADVISORY (carried forward).

---

## 3. Task Completion (Phase 1)

All 4 tasks are genuinely `[x]` with execution notes **and** verification evidence backing each — not bare checkboxes.

| Task | Status | Requirements | Attempts | Evidence in `execution.md` | Verdict |
|------|--------|--------------|----------|----------------------------|---------|
| T-001 | `[x]` | FR-ACF-002/003/004, NFR-ACF-001/002, BR-ACF-001 | 1 (Pivot, 0 rework) | §2 + Pivot Record; 7/7 provider tests, isolated `tsc --noEmit` | PASS |
| T-002 | `[x]` | FR-ACF-001 | 1 | §2; 3/3 header tests, full build restored | PASS |
| T-003 | `[x]` | FR-ACF-002 | 1 | §2; lint clean, no `exhaustive-deps` warning | PASS |
| T-004 | `[x]` | FR-ACF-005 | 1 | §2; 4/4 modal tests | PASS |

**T-001 Pivot Record:** Verified. The Reviewer's FAIL was correctly attributed to a `tasks.md` *wording* defect (an unsatisfiable full-package-build gate inside a task whose consumer lands later), not a code defect — resolved by user-approved amendment, no rework attempt consumed. The amended "Done when" text is **present in `tasks.md` today** (line 65: scopes the typecheck to exclude `app-header.tsx`, defers full build to a PR-level gate, tagged `Amended 2026-08-05 post-Pivot`). Manual QA checklist (`tasks.md` §7) — all 6 items checked.

---

## 4. File Existence (Phase 2)

Every file `design.md` §4 names as changing did change; no unexpected files touched. Confirmed against the exact per-commit file lists (`git show --stat`), not the summaries.

| Expected file | Change | Present | Verdict |
|---------------|--------|---------|---------|
| `providers/country-filter-provider.tsx` | modified (sentinel, types, helper) | ✅ `71a46de` | PASS |
| `components/layout/app-header.tsx` | modified (5th option) | ✅ `411c13a` | PASS |
| `app/(protected)/dashboard/page.tsx` | modified (translation point) | ✅ `411c13a` | PASS |
| `components/assessment/start-assessment-modal.tsx` | modified (create guard) | ✅ `411c13a` | PASS |
| `providers/__tests__/country-filter-provider.test.tsx` | new | ✅ `71a46de` | PASS |
| `components/layout/__tests__/app-header.test.tsx` | new | ✅ `411c13a` | PASS |
| `components/assessment/__tests__/start-assessment-modal.test.tsx` | extended | ✅ `411c13a` + `ce735f2` | PASS |
| `hooks/__tests__/use-assessments.test.ts` | extended (+2 tests) | ✅ `ce735f2` | PASS |
| `__mocks__/radix-ui.js` | extended (additive `DropdownMenu`) | ✅ `411c13a` | PASS |

**No `app-layout.tsx` change** in any spec commit — consistent with DD-ACF-004's "verified pass-through, no code change."

**NFR-ACF-001 structural check:** the three spec commits touch **no** file under `packages/api/` or `packages/shared/`. Confirmed. (An earlier broad `git diff 8e5b423..ce735f2` spans the *prior* multi-country-enablement spec's commits, which is why api/shared appear there — those are not this spec's.)

---

## 5. Build Integrity (Phase 3)

Re-run independently at HEAD `ce735f2`.

| Command | Result | Verdict |
|---------|--------|---------|
| `pnpm --filter @alliance-risk/web build` | ✓ Compiled, static export 19/19 pages | PASS |
| `pnpm --filter @alliance-risk/web lint` | ✔ No ESLint warnings or errors | PASS |
| `npx jest` (full package) | **112 passed / 114 total**, 2 failed (1 suite) | PASS for this spec |

**Failing suite:** `components/dashboard/__tests__/assessment-table.test.tsx` — 2 tests. This file was **not touched by any spec commit** (last modified by unrelated `8785694`). All four spec-relevant suites pass: `country-filter-provider`, `app-header`, `start-assessment-modal`, `use-assessments`.

**Independent pre-existence verification (I did not trust the write-up):** I reverted `__mocks__/radix-ui.js` to its pre-spec version (`433ebad`) and re-ran the suite:

| Mock state | `assessment-table.test.tsx` result |
|-----------|-----------------------------------|
| Pre-spec (`433ebad`) | **4/4 fail** |
| Spec applied (`ce735f2`) | **2/4 fail** (2 recovered by the additive `DropdownMenu` mock) |

Failure cause inspected directly: `TestingLibraryElementError: Found multiple elements with the text: Draft` and `.../text: /No Match/i` — ambiguous `getByText` queries in the table's own suite, with **no connection to the sentinel-filter logic**. The spec strictly *improved* this file (4→2) and introduced zero regressions. Claim confirmed. File restored to `ce735f2`.

---

## 6. Requirement Coverage (Phase 4)

Verified at scenario / `AND IT MUST` / `BUT it must NOT` clause granularity against **current source** and a **read sample of the actual test files** (not just the matrix).

| Requirement / clause | Owner task | Code evidence (verified) | Test evidence (verified) | Verdict |
|---|---|---|---|---|
| **FR-ACF-001** 5 options, "All countries" first | T-002 | `app-header.tsx:20-23` sentinel-first `countryOptions` | `app-header.test.tsx:29-42` asserts 5, order Kenya→Zambia | PASS |
| FR-ACF-001 · *AND IT MUST* not call `getCountryFlag()` | T-002 | `getCountryFlag` **never referenced** in `app-header.tsx` (grep=0); renders from `countryOptions` | `app-header.test.tsx:55-62` renders sentinel w/o throw, shows 🌍 not raw string | PASS |
| FR-ACF-001 · *BUT it must NOT* add to `SUPPORTED_COUNTRIES` | T-002 | `SUPPORTED_COUNTRIES` only spread/`.map()`'d (`app-header.tsx:22`), never mutated; sentinel prepended to a local array | `start-assessment-modal.test.tsx:38-55` create Select still exactly 4 | PASS |
| **FR-ACF-002** omit `country` param when active | T-001/T-003 | `resolveListCountryParam` → `undefined` (`provider:88-90`); used at all 3 dashboard sites (`page.tsx:59,70,199`) | `country-filter-provider.test.tsx:96-102` + `use-assessments.test.ts:47-64` | PASS |
| FR-ACF-002 · *AND IT MUST* send no `country` (not '', not literal) | T-003 | dashboard passes helper result everywhere | `use-assessments.test.ts:61-63` asserts `undefined`, `not ''`, `not 'All countries'`; stats `params:undefined` (`:97-99`) | PASS |
| FR-ACF-002 · *BUT it must NOT* send a 400-triggering request | T-003 | undefined param dropped by axios serializer | dedicated assertions above (not narrative) | PASS |
| **FR-ACF-003** default = sentinel on no/invalid pref | T-001 | `useState(ALL_COUNTRIES_FILTER)` (`:48`); `readStoredCountry` falls back to sentinel on empty/invalid/SSR (`:36-45`) | `provider.test.tsx:22-37` empty + `'Uganda'` invalid → sentinel | PASS |
| FR-ACF-003 · *AND IT MUST* fall back to sentinel not Kenya on invalid | T-001 | both fallback branches return `ALL_COUNTRIES_FILTER` | `provider.test.tsx:30-53` incl. throwing-storage case | PASS |
| FR-ACF-003 · regression: valid stored country restores | T-001 | `isSupportedCountry(stored)` branch preserved | `provider.test.tsx:55-63` `'Ethiopia'` restores, `not` sentinel | PASS |
| **FR-ACF-004** persist sentinel like a real value | T-001 | `setActiveCountry` writes raw string to `localStorage` (`:54-61`) | `provider.test.tsx:67-92` persists + re-reads sentinel | PASS |
| **FR-ACF-005** create Select never includes sentinel; default never sentinel | T-004 | `defaultCountry = sentinel ? DEFAULT_COUNTRY : activeCountry` (`modal:69`); Select maps only `SUPPORTED_COUNTRIES` (`:283`) | `modal.test.tsx:78-106` defaults Kenya + exactly 4 options under sentinel | PASS |
| FR-ACF-005 · *AND IT MUST* default to Kenya (not blank/error/sentinel) | T-004 | `defaultCountry` used in `useForm`, reset `useEffect`, `handleClose` payload + reset | `modal.test.tsx:78-85` field = Kenya, `not 'ALL_COUNTRIES'` | PASS |
| FR-ACF-005 · *BUT it must NOT* allow create with country unset/sentinel | T-004 | Zod `country: min(1)`; payload uses `selectedCountry \|\| defaultCountry`; Select offers only real countries | `modal.test.tsx:57-76` payload `country:'Kenya'` | PASS (see ADV-4) |
| FR-ACF-005 · auto-draft-save = Kenya under sentinel | T-004 | `handleClose` uses `defaultCountry` (`:123`) | `modal.test.tsx:108-127` real `handleClose` path → `country:'Kenya'` | PASS |
| **NFR-ACF-001** no backend/shared change | T-001 | zero api/shared files in any spec commit | structural `git show --stat` | PASS |
| **NFR-ACF-002** backward compat (only no/invalid default changes) | T-001 | real-country restore path untouched | `provider.test.tsx:55-63` regression | PASS |
| **BR-ACF-001** view-only sentinel, never to API/DB | T-001 | sentinel only in `localStorage` + view state; never in a payload | `use-assessments.test.ts` proves never sent as literal | PASS |

Every FR/NFR/BR ID has direct code **and** test evidence; the three high-risk negative clauses (FR-ACF-001 no-`SUPPORTED_COUNTRIES`-mutation, FR-ACF-002 no-400-request, FR-ACF-005 no-sentinel-create) each have a **dedicated assertion**, not just an ID-complete row. The `test-report.md` matrix is accurate — spot-checked against the real test files, not fabricated.

---

## 7. Linting & Code Quality (Phase 5)

**Gating:** lint clean (§5). Architecture boundary respected — Web-only, no Bedrock/API/shared calls introduced; dashboard reaches the API only through the existing `use-assessments` React Query hooks. Dropdown pattern reuses the existing shadcn `DropdownMenu` (consistent with app convention and `docs/figma-design/screens/02-dashboard.md` Pattern 2). No new hardcoded hex introduced by the diff (the pre-existing `#1F2937` / `#4CAF50` literals in `app-header.tsx` predate this spec and are outside its scope).

### 4R sweep — advisory only, never gates

| ID | Lens | Note | Severity |
|----|------|------|----------|
| ADV-1 | Reliability (test hygiene) | `country-filter-provider.test.tsx:52` — `getItemSpy.mockRestore()` runs after `waitFor`; a `try/finally` would harden against leak if `waitFor` rejected | Advisory (carried from execution.md) |
| ADV-2 | Efficiency | `dashboard/page.tsx` calls `resolveListCountryParam(activeCountry)` 3× per render (`:59,70,199`) vs one hoisted var; trivial pure ternary, no perf/correctness impact | Advisory (carried) |
| ADV-3 | Readability (symmetry) | `start-assessment-modal.tsx:180` — `form.reset({... country: activeCountry})` inside `handleModeSelect` uses raw `activeCountry` (could be sentinel) instead of `defaultCountry` | Advisory (carried) |
| ADV-4 | Risk | ADV-3 is **inert**: the reset runs post-successful-create, after `onOpenChange(false)`, before navigation; the create payload used `formValues.country` (a real 4-option pick); on any modal reopen the `open`-keyed reset `useEffect` (`:101-108`) overwrites it with `defaultCountry`→Kenya. Re-verified against source — no observable path to violating FR-ACF-005. Optional symmetry fix only. | Advisory (I confirm the prior Reviewer's judgment) |

---

## 8. Design Conformance (Phase 6)

| Decision | Claim | Verified in current source | Verdict |
|----------|-------|----------------------------|---------|
| DD-ACF-001 | Web-local sentinel, never in shared | `ALL_COUNTRIES_FILTER`/`CountryFilterValue` defined in `country-filter-provider.tsx:25-27`; not exported from shared | PASS |
| DD-ACF-002 | Default flip Kenya→sentinel, no breakage | `useState(ALL_COUNTRIES_FILTER)`; only 2 `DEFAULT_COUNTRY` consumers (provider + unrelated API create), unaffected | PASS |
| DD-ACF-003 | `AssessmentTable` needs no change | `assessment-table.tsx` not touched; dashboard passes `resolveListCountryParam(...)` (`undefined` for sentinel) into `activeCountry` prop (`page.tsx:199`) | PASS |
| DD-ACF-004 | `app-layout.tsx` verified pass-through, no code change | `app-layout.tsx:27,46-47` destructures & forwards `activeCountry`/`setActiveCountry`, no explicit `SupportedCountryLabel` annotation; not in any spec commit; full build green | PASS |

### Cross-document figure check

| Figure | Design/Tasks says | Actual | Verdict |
|--------|-------------------|--------|---------|
| Expected tasks | 4 (`design.md §7`) | 4 in `tasks.md` (T-001–T-004) | PASS |
| Review rounds | ≤ 2 (`design.md §7`) | 0 rework rounds (T-001 Pivot no-rework; T-002/3/4 PASS attempt 1) | PASS |
| LOC | ~240 (~90 prod, ~150 test) | ~62 prod insertions (**under**); ~380 test+mock insertions (**over** — driven by the unforeseen +124 additive `radix-ui.js` mock and generous coverage); ~442 total | **WARN-1** (non-gating drift) |
| Proposal scope / non-goals | Web-only, no backend, no shared, no new visual pattern | Matches final behavior exactly | PASS |
| Visual Reference | `proposal.md §7` present, explicitly **"Source: None"** | Correct — non-visual, view-state-only spec; no mockup to conform to | PASS (noted) |

**Constitution Impact:** `execution.md` has **no `## Constitution Impact` block** (grep=0). No module was created or reshaped — this section is **N/A**, correctly omitted.

---

## 9. Test Evidence Summary

- **Suites:** 15 total; 14 pass, 1 fails (`assessment-table.test.tsx`, pre-existing & unrelated — §5).
- **This spec's coverage:** 8/8 requirement IDs with direct, non-narrative test evidence; matrix spot-checked against real files.
- **`test-report.md` accuracy:** matrix and PASS verdicts hold up under independent re-verification. One documentation nit: §2 states **"New tests added: 4"** but only **3** are enumerated and actually exist in the test-phase commit `ce735f2` (1 auto-draft in `start-assessment-modal`, 2 in `use-assessments`). Coverage itself is accurate; the count is off by one → **WARN-2** (non-gating).

---

## 10. Agent Guide / Constitution Impact

- **CLAUDE.md / AGENTS.md:** no update required — no new module, command, or convention introduced.
- **TRD / PRD / design.md (constitutional):** unaffected — Web-only view-state change, no architecture/data-model/API surface.
- **Constitution Impact block:** N/A (see §8).

---

## 11. Remediation

No blocking or gating remediation. Optional, all deferrable to a separate ticket:

| Item | Type | Action |
|------|------|--------|
| `assessment-table.test.tsx` 2 ambiguous-query failures | Pre-existing, out of scope | Separate ticket — narrow `getByText('Draft')`/`/No Match/i` (e.g. `getAllByText` or scoped `within`) |
| WARN-2 — `test-report.md` §2 "4 new tests" | Doc nit | Correct to "3" for accuracy (optional) |
| ADV-1..ADV-4 | Advisory | Address opportunistically; none affect correctness |

---

## 12. Archive Readiness Recommendation

**READY TO ARCHIVE.**

All 12 checks pass with independently reproduced evidence: clean build, clean lint, 8/8 requirements satisfied at clause level with dedicated assertions for every negative constraint, NFR-ACF-001 structurally confirmed (zero api/shared touch), and the sole test-failure claim independently verified as pre-existing and *improved* by this spec. The two WARNs are documentation/estimate drift with no bearing on shipped behavior; the four advisories are non-gating. Author ≠ auditor satisfied (Opus audit of Sonnet-authored work). Proceed to `/akili-archive`.
