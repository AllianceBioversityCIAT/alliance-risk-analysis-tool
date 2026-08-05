# All-Countries Dashboard Filter — Task Plan

## 1. Document Control

| Field | Value |
|-------|-------|
| **Document** | All-Countries Dashboard Filter — Task Plan |
| **Project** | CGIAR Risk Intelligence Tool |
| **Phase** | Change |
| **Version** | 1.0 |
| **Date** | 2026-08-05 |

### Source Documents

| Ref | Document |
|-----|----------|
| R1 | Requirements — `docs/specs/changes/all-countries-filter/requirements.md` |
| R2 | Design — `docs/specs/changes/all-countries-filter/design.md` (post-Judgment Day revision) |

---

## 2. Legend

| Marker | Meaning |
|--------|---------|
| `[ ]` Not started · `[~]` In progress · `[x]` Complete | Status |
| `[FE]` `packages/web/` | Scope tag |

### Skill References

| Skill | Usage |
|-------|-------|
| `vercel-react-best-practices` | Provider/context patterns, React Query hook usage |
| `shadcn-ui` | `DropdownMenu` option rendering |
| `tailwind-design-system` | Header selector styling consistency |

---

## Phase A: Foundation (Sequential — unblocks all)

### T-001: Sentinel, widened types, and `resolveListCountryParam` in `CountryFilterProvider` `[FE]`

- **Status:** `[x]`
- **Skills:** `vercel-react-best-practices`
- **Size:** M
- **Dependencies:** None
- **Requirements:** FR-ACF-002, FR-ACF-003, FR-ACF-004, NFR-ACF-001, NFR-ACF-002, BR-ACF-001
- **Design Ref:** §4.1, DD-ACF-001, DD-ACF-002
- **Scope:**
  - `packages/web/src/providers/country-filter-provider.tsx`:
    - Export `const ALL_COUNTRIES_FILTER = 'ALL_COUNTRIES'`
    - Export `type CountryFilterValue = SupportedCountryLabel | typeof ALL_COUNTRIES_FILTER`
    - Retype `CountryFilterContextValue.activeCountry` / `.setActiveCountry` to `CountryFilterValue`
    - Widen `readStoredCountry()`'s return type to `CountryFilterValue`; accept a stored value `=== ALL_COUNTRIES_FILTER` as valid; change **both** fallback points (SSR early-return and missing/invalid storage) from `DEFAULT_COUNTRY` to `ALL_COUNTRIES_FILTER`
    - Change the initial `useState<...>(DEFAULT_COUNTRY)` to `useState<CountryFilterValue>(ALL_COUNTRIES_FILTER)`
    - Export `function resolveListCountryParam(value: CountryFilterValue): string | undefined` — returns `undefined` for the sentinel, the value unchanged otherwise
  - Do **not** touch `@alliance-risk/shared` — `SUPPORTED_COUNTRIES`, `SupportedCountryLabel`, `DEFAULT_COUNTRY`, `isSupportedCountry` stay exactly as-is (NFR-ACF-001)
- **Tests:** New `packages/web/src/providers/__tests__/country-filter-provider.test.tsx`:
  - empty `localStorage` → `activeCountry === ALL_COUNTRIES_FILTER` (FR-ACF-003)
  - invalid stored value (e.g. `"Uganda"`, corrupted JSON) → falls back to `ALL_COUNTRIES_FILTER`, not `"Kenya"` (FR-ACF-003)
  - **regression:** valid stored real country (e.g. `"Ethiopia"`) → restores unchanged, does NOT become `ALL_COUNTRIES_FILTER` (FR-ACF-003 regression scenario)
  - `setActiveCountry(ALL_COUNTRIES_FILTER)` persists the sentinel to `localStorage`; a later re-read restores it (FR-ACF-004)
  - `resolveListCountryParam(ALL_COUNTRIES_FILTER) === undefined`; `resolveListCountryParam('Nigeria') === 'Nigeria'` (FR-ACF-002)
- **Verification:** `pnpm --filter @alliance-risk/web test -- --testPathPattern=country-filter-provider`
- **Done when:** All 5 test cases above pass. `tsc --noEmit` introduces no new type errors outside `app-header.tsx` (the one file explicitly owned by T-002, which consumes the widened type). Full-package `pnpm --filter @alliance-risk/web build` is a **PR-level gate** (§4 single-PR strategy), verified once T-002/T-003/T-004 land — not an individual T-001 acceptance criterion. *(Amended 2026-08-05 post-Pivot — see `execution.md` Pivot Record: T-001; original wording required a full-package build pass that was unsatisfiable in isolation given the task dependency graph.)*

---

## Phase B: Consumers (Parallel after T-001 — different files)

### T-002: Header renders "All countries" option `[FE]`

- **Status:** `[ ]`
- **Skills:** `shadcn-ui`, `tailwind-design-system`
- **Size:** M
- **Dependencies:** T-001
- **Requirements:** FR-ACF-001
- **Design Ref:** §4.2
- **Scope:**
  - `packages/web/src/components/layout/app-header.tsx`:
    - Build a local `countryOptions` array: `{ value: ALL_COUNTRIES_FILTER, label: 'All countries', flag: '🌍' }` first, followed by `SUPPORTED_COUNTRIES.map(...)`
    - Render the trigger button and every `DropdownMenuItem` from `countryOptions`, matching `option.value === activeCountry` for the active state — never call `getCountryFlag()` with the sentinel
    - Widen `activeCountry`/`onCountryChange` prop types from `SupportedCountryLabel` to `CountryFilterValue` (import from `country-filter-provider`)
  - Read `packages/web/src/components/layout/app-layout.tsx` and confirm (do not just assume) that its pass-through of `activeCountry`/`setActiveCountry` into `<AppHeader>` still type-checks with no explicit annotation to update (DD-ACF-004) — if it does NOT type-check as expected, treat that as a design deviation and flag it, do not silently patch around it
- **Tests:** New `packages/web/src/components/layout/__tests__/app-header.test.tsx`:
  - Opening the dropdown renders exactly 5 options, "All countries" first
  - Clicking "All countries" calls `onCountryChange(ALL_COUNTRIES_FILTER)`
  - Rendering with `activeCountry={ALL_COUNTRIES_FILTER}` does not throw and does not display the sentinel's raw string value in the trigger (shows "All countries" + 🌍, not `"ALL_COUNTRIES"`)
- **Verification:** `pnpm --filter @alliance-risk/web test -- --testPathPattern=app-header`
- **Done when:** All 3 test cases pass; `pnpm --filter @alliance-risk/web build` succeeds.

### T-003: Dashboard translates the sentinel before querying `[FE]`

- **Status:** `[ ]`
- **Skills:** `vercel-react-best-practices`
- **Size:** S
- **Dependencies:** T-001
- **Requirements:** FR-ACF-002
- **Design Ref:** §4.3, DD-ACF-003
- **Scope:**
  - `packages/web/src/app/(protected)/dashboard/page.tsx`:
    - Import `resolveListCountryParam` from `country-filter-provider`
    - Inside the filters-sync `useEffect`, call `resolveListCountryParam(activeCountry)` **inline in the effect body** (not via an outer derived variable) so the dependency array stays `[debouncedSearch, statusFilter, activeCountry]` with no `react-hooks/exhaustive-deps` warning
    - Use the same helper's result for `useAssessmentStats(...)` and the `activeCountry` prop passed to `<AssessmentTable>`
  - **Do not** modify `assessment-table.tsx` — it already handles `activeCountry: undefined` correctly (DD-ACF-003)
- **Tests:** No new test file — `resolveListCountryParam`'s behavior is already covered by T-001's unit tests. Verify manually per the Done-when check below (a page-level test would require mocking React Query hooks with no behavior left to newly cover).
- **Verification:** `pnpm --filter @alliance-risk/web build` (typecheck); manual check — with `pnpm dev` running, confirm no `react-hooks/exhaustive-deps` ESLint warning is emitted for the touched `useEffect` (`pnpm --filter @alliance-risk/web lint`)
- **Done when:** Lint is clean; selecting "All countries" in the header (after T-002) visibly shows assessments from every country; selecting a real country still filters as before (no regression).

---

## Phase C: Create-Flow Guard (Parallel with Phase B — different file)

### T-004: Start-assessment modal never defaults to the sentinel `[FE]`

- **Status:** `[ ]`
- **Skills:** `shadcn-ui`, `vercel-react-best-practices`
- **Size:** M
- **Dependencies:** T-001
- **Requirements:** FR-ACF-005
- **Design Ref:** §4.4
- **Scope:**
  - `packages/web/src/components/assessment/start-assessment-modal.tsx`:
    - Add `DEFAULT_COUNTRY` to the existing `@alliance-risk/shared` import (currently only imports `IntakeMode`, `SUPPORTED_COUNTRIES`, `SupportedCountryLabel` — confirmed missing, see design.md §4.4)
    - Compute `const defaultCountry = activeCountry === ALL_COUNTRIES_FILTER ? DEFAULT_COUNTRY : activeCountry;`
    - Replace every existing use of `activeCountry` as a create-time default with `defaultCountry`: the initial `useForm` `defaultValues`, the `useEffect` that resets the form, and **both** places inside `handleClose` (the auto-draft-save payload and the post-close form reset)
  - Do **not** change the Zod schema or the `Select`'s option list — they must continue to show only the 4 real countries
- **Tests:** Extend `packages/web/src/components/assessment/__tests__/start-assessment-modal.test.tsx`:
  - Mock `useCountryFilter` to return `activeCountry: ALL_COUNTRIES_FILTER` → assert the rendered form's country field defaults to `"Kenya"`, not blank/undefined/the sentinel
  - Assert the country `Select`'s option list still has exactly 4 entries (no "All countries" leak) regardless of `activeCountry`
- **Verification:** `pnpm --filter @alliance-risk/web test -- --testPathPattern=start-assessment-modal`
- **Done when:** Both new test cases pass alongside the existing 2 tests in this file (4 total, 0 regressions).

---

## 3. Dependency Graph

```
T-001 ─┬─► T-002 (Header)
       ├─► T-003 (Dashboard)
       └─► T-004 (Create modal)

T-002 ∥ T-003 ∥ T-004 — fully parallel after T-001 (different files, no shared edits)
```

---

## 4. Estimated LOC & PR Strategy

| Metric | Estimate |
|--------|----------|
| **Total LOC** | ~240 (matches design.md §7 budget: ~90 production, ~150 tests) |
| **New files** | 2 (`country-filter-provider.test.tsx`, `app-header.test.tsx`) |
| **Modified files** | 4 (`country-filter-provider.tsx`, `app-header.tsx`, `dashboard/page.tsx`, `start-assessment-modal.tsx`) + 1 test extension (`start-assessment-modal.test.tsx`) |

### Recommended PR strategy: single PR

At ~240 LOC across 4 production files with no backend/shared-package surface, this does not warrant a split. One PR, reviewed as: T-001 first (foundation — the new types and helper), then T-002/T-003/T-004 as three independent, easily-separable diff hunks the reviewer can check against their own requirement (FR-ACF-001 / FR-ACF-002 / FR-ACF-005 respectively).

---

## 5. Requirement → Task Coverage

| Requirement | Task(s) |
|-------------|---------|
| FR-ACF-001 | T-002 |
| FR-ACF-002 | T-001, T-003 |
| FR-ACF-003 | T-001 |
| FR-ACF-004 | T-001 |
| FR-ACF-005 | T-004 |
| NFR-ACF-001 | T-001 (verified: no `@alliance-risk/shared` or API file touched by any task) |
| NFR-ACF-002 | T-001 |
| BR-ACF-001 | T-001 |

---

## 6. Recommended First Task

**T-001** — unblocks T-002, T-003, and T-004, all of which can then run in parallel (different files, no merge conflicts expected).

---

## 7. Manual QA Checklist (post-implementation)

- [ ] Fresh browser profile (no `localStorage`) → dashboard lands on "All countries," shows assessments from every country
- [ ] Select each of the 4 real countries → list/stats filter correctly (no regression)
- [ ] Select "All countries" again → list/stats show everything again
- [ ] Open "Start New Assessment" while "All countries" is active → country field defaults to Kenya, dropdown shows only 4 options
- [ ] Close the modal mid-fill (auto-draft path) while "All countries" is active → resulting draft has `country: "Kenya"`
- [ ] Reload the page after selecting "Zambia" → filter restores to "Zambia," not "All countries"

---

## 8. Next Command

After task approval:

```text
/akili-execute changes/all-countries-filter
```

Start with **T-001**.
