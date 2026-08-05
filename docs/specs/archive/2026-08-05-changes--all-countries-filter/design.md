# All-Countries Dashboard Filter — Design

## 1. Document Control

| Field | Value |
|-------|-------|
| **Module** | `docs/specs/changes/all-countries-filter` |
| **Requirements ref** | `requirements.md` v1.0 |
| **Version** | 1.0 |
| **Date** | 2026-08-05 |
| **Architecture tier** | Trivial extension of existing Web-only state (no new services, no backend touch) |
| **Judgment Day** | `judgment.md` — Round 1, `ESCALATED`, resolved via "Fix only" (this revision incorporates all confirmed findings) |

### Requirement coverage map

| Design section | Requirements |
|----------------|--------------|
| §2 Architecture | FR-ACF-001, FR-ACF-002, FR-ACF-003 |
| §4 Frontend Changes | FR-ACF-001–FR-ACF-005 |
| §6 Decision Records | NFR-ACF-001, NFR-ACF-002, BR-ACF-001 |

---

## 2. Executive Summary

**Approach:** Add a Web-only sentinel value (`ALL_COUNTRIES_FILTER`) and widen `CountryFilterProvider`'s state type to `CountryFilterValue = SupportedCountryLabel | typeof ALL_COUNTRIES_FILTER`. Every consumer that needs a *real* country (the create-assessment default, in particular) narrows explicitly at its one call site. The sentinel never crosses into `@alliance-risk/shared`, the API, or `Assessment.country` — it exists only inside `packages/web/`.

Four files change: `country-filter-provider.tsx` (source of the type/constant and a new exported pure helper), `app-header.tsx` (renders the new option), `dashboard/page.tsx` (calls the helper to translate sentinel → omitted query param), `start-assessment-modal.tsx` (resolves sentinel → `"Kenya"` for create defaults). A fifth file, `components/layout/app-layout.tsx`, is a **verified pass-through** — it already destructures `{ activeCountry, setActiveCountry }` from `useCountryFilter()` and forwards them into `AppHeader`; the type widening flows through it with no code change required, confirmed by reading its current source (not assumed).

---

## 3. Data Model

No change. `Assessment.country` is untouched — "All countries" never becomes a stored value (BR-ACF-001).

## API Design

No change. `ListAssessmentsQueryDto`, `AssessmentStatsQueryDto`, and `AssessmentsService` are untouched — the existing "omit `country` = no filter" behavior is reused as-is (NFR-ACF-001).

## Backend Module Design

N/A — this spec is Web-only.

---

## 4. Frontend Changes

### 4.1 `providers/country-filter-provider.tsx` — source of the sentinel

| Export | Change |
|--------|--------|
| `ALL_COUNTRIES_FILTER` | **New** — `const ALL_COUNTRIES_FILTER = 'ALL_COUNTRIES'` (a string that can never collide with a real country label) |
| `CountryFilterValue` | **New type** — `SupportedCountryLabel \| typeof ALL_COUNTRIES_FILTER` |
| `CountryFilterContextValue` | `activeCountry` / `setActiveCountry` retyped from `SupportedCountryLabel` to `CountryFilterValue` |
| `readStoredCountry()` | Accepts a stored value equal to `ALL_COUNTRIES_FILTER` as valid, in addition to the existing `isSupportedCountry()` check; falls back to `ALL_COUNTRIES_FILTER` (not `DEFAULT_COUNTRY`) on missing/invalid storage. **Its declared return type must widen from `SupportedCountryLabel` to `CountryFilterValue`**, and its SSR early-return (`typeof window === 'undefined'`) must also return `ALL_COUNTRIES_FILTER` instead of `DEFAULT_COUNTRY` for consistency — as written today this branch is unreachable dead code (the function is only invoked inside the mount `useEffect`), but the type must still widen or the file will not compile |
| Initial `useState` | Changes from `useState<SupportedCountryLabel>(DEFAULT_COUNTRY)` to `useState<CountryFilterValue>(ALL_COUNTRIES_FILTER)` — same SSR-safe pattern (synchronous default, real restore happens in the existing `useEffect` on mount) |
| `resolveListCountryParam()` | **New, exported pure function** — `(value: CountryFilterValue): string \| undefined => value === ALL_COUNTRIES_FILTER ? undefined : value`. Extracted here (not inlined in `dashboard/page.tsx`) specifically so FR-ACF-002's "omit `country` when All countries is active" guarantee is unit-testable in isolation, without rendering the dashboard page or its React Query hooks |

`setActiveCountry` and the `localStorage.setItem` write path need **no change** — writing the sentinel string works exactly like writing a real country label.

### 4.2 `components/layout/app-header.tsx` — render the new option

Normalize both the sentinel and the 4 real countries into one local shape before rendering, so the JSX has no special-case branching:

```
countryOptions = [
  { value: ALL_COUNTRIES_FILTER, label: 'All countries', flag: '🌍' },
  ...SUPPORTED_COUNTRIES.map(c => ({ value: c.label, label: c.label, flag: c.flag })),
]
```

The dropdown trigger and each `DropdownMenuItem` render from `countryOptions` by matching `option.value === activeCountry` — this guarantees `getCountryFlag()` (typed for real countries only) is never called with the sentinel (FR-ACF-001's `AND IT MUST`). `SUPPORTED_COUNTRIES` itself is read, never mutated — the create-assessment modal's import of the same constant is unaffected (`BUT it must NOT` in FR-ACF-001).

`AppHeader`'s prop types (`activeCountry`, `onCountryChange`) widen from `SupportedCountryLabel` to `CountryFilterValue`, imported from the provider module.

### 4.3 `app/(protected)/dashboard/page.tsx` — the one translation point

```
const { activeCountry } = useCountryFilter();  // CountryFilterValue
const countryParam = resolveListCountryParam(activeCountry);  // imported from country-filter-provider
```

`countryParam` (type `string | undefined`, unchanged shape) replaces the raw `activeCountry` everywhere it is currently passed to `useAssessments`, `useAssessmentStats`, and `<AssessmentTable activeCountry={...} />`. Calling the extracted helper (§4.1) — rather than inlining the ternary — is what makes FR-ACF-002 unit-testable without rendering the page. **`AssessmentTable` itself requires no code change** — its `activeCountry?: string` prop already treats `undefined` as "no country context," which is exactly what "All countries" resolves to here.

The existing filters-sync `useEffect` (keyed on `[debouncedSearch, statusFilter, activeCountry]`) should read `activeCountry` directly and call `resolveListCountryParam(activeCountry)` inline inside the effect body — not reference the outer `countryParam` variable — so `react-hooks/exhaustive-deps` has nothing to flag (the effect's only external input stays `activeCountry`, already in the dependency array).

### 4.4 `components/assessment/start-assessment-modal.tsx` — guard the create default

```
const { activeCountry } = useCountryFilter();  // CountryFilterValue
const defaultCountry = activeCountry === ALL_COUNTRIES_FILTER ? DEFAULT_COUNTRY : activeCountry;
```

`DEFAULT_COUNTRY` (`"Kenya"`) is **not currently imported** in this file — today it only imports `IntakeMode`, `SUPPORTED_COUNTRIES`, and `SupportedCountryLabel` from `@alliance-risk/shared` (verified against source; an earlier draft of this design incorrectly assumed it was already present). The implementing task must add `DEFAULT_COUNTRY` to that import — the same constant the API uses for its own create default, kept symmetric.

Every existing reference to `activeCountry` as a create-time default (initial `useForm` values, the reset `useEffect`, `handleClose`'s auto-draft-save path, `handleClose`'s form-reset call) is replaced with `defaultCountry`. The Zod schema and the `Select` itself are unchanged — they never see or offer the sentinel, satisfying FR-ACF-005 end to end.

---

## 5. Shared Contracts / Package Extensions

None. `@alliance-risk/shared` is not touched (NFR-ACF-001) — `SUPPORTED_COUNTRIES`, `SupportedCountryLabel`, `DEFAULT_COUNTRY`, `isSupportedCountry` all remain exactly as delivered by the multi-country-enablement spec.

---

## 6. Decision Records

### DD-ACF-001: Web-local sentinel, not a shared-package value

| | |
|---|---|
| **Status** | Accepted |
| **Context** | "All countries" must never be selectable at create time or reach the API |
| **Decision** | Define `ALL_COUNTRIES_FILTER` / `CountryFilterValue` inside `country-filter-provider.tsx`; never export it from `@alliance-risk/shared` |
| **Alternatives rejected** | `undefined` as the sentinel (Option B in `proposal.md`) — semantically overloaded, harder to debug; a parallel `showAllCountries` boolean (Option C) — two pieces of state that can drift out of sync |
| **Requirements** | NFR-ACF-001, BR-ACF-001 |

### DD-ACF-002: Reversion challenge — changing the default away from `"Kenya"`

| | |
|---|---|
| **Status** | Accepted |
| **Trigger** | This design inverts existing behavior: `CountryFilterProvider`'s default changes from `DEFAULT_COUNTRY` (`"Kenya"`) to `ALL_COUNTRIES_FILTER` |
| **Challenge question** | "What does removing the default-to-Kenya behavior break?" |
| **Answer** | Grepped every consumer of `DEFAULT_COUNTRY` in the codebase: exactly two — `country-filter-provider.tsx` (the code being changed here) and `assessments.service.ts`'s **create** default (`dto.country ?? DEFAULT_COUNTRY`), an unrelated, unaffected code path. No other code assumes the dashboard's initial filter is Kenya. FR-ACF-003's regression scenario further confirms an *existing* stored preference (e.g. `"Ethiopia"`) still restores correctly — only the *no-preference* and *invalid-preference* defaults change, which is the intended, requested behavior. **No breakage identified.** |
| **Requirements** | FR-ACF-003 |

### DD-ACF-004: `app-layout.tsx` is a verified pass-through, not an omission

| | |
|---|---|
| **Status** | Accepted (added after Judgment Day Round 1 — both judges flagged this file as missing from the original inventory) |
| **Context** | `app-layout.tsx` also calls `useCountryFilter()` and forwards `activeCountry`/`setActiveCountry` straight into `AppHeader` — it is the actual runtime path connecting the provider to the header, which the original design draft never named |
| **Decision** | No code change needed there — read its current source directly (not assumed) to confirm the type widening passes through with no explicit `SupportedCountryLabel` annotation to update. Documented here so the file inventory is complete and the reasoning is verifiable, not just asserted |
| **Requirements** | FR-ACF-001 (this spec), FR-MC-010 (header functional filter, inherited from the multi-country-enablement spec) |

### DD-ACF-003: `AssessmentTable` requires no code change

| | |
|---|---|
| **Status** | Accepted |
| **Context** | `AssessmentTable`'s `activeCountry?: string` prop already renders a generic empty state when `undefined` |
| **Decision** | Translate the sentinel to `undefined` once, in `dashboard/page.tsx`, before it reaches `AssessmentTable` — do not teach the table component about the sentinel |
| **Requirements** | FR-ACF-002 |

---

## 7. Design Budget (Step 2.4)

| Signal | Estimate |
|--------|----------|
| Expected tasks | 4 |
| Expected LOC | ~240 (≈90 production, ≈150 tests — including closing two previously-**accepted test gaps** from the archived multi-country spec: `CountryFilterProvider` had no localStorage unit test, and `AppHeader` had no dedicated test file; both now get real coverage as a side effect of testing the new sentinel logic) |
| Expected review rounds | ≤ 2 |

This matches **Standard** depth — not small enough for Lite (more than one trivial file, real type/behavior change), not large enough for Full (no backend, no shared contract, no migration). No depth adjustment needed.

---

## 8. Testing Strategy

| Area | Test file | Focus |
|------|-----------|-------|
| Provider default/fallback | `providers/__tests__/country-filter-provider.test.tsx` (new) | Empty storage → sentinel; invalid stored value → sentinel; valid stored real country → restores unchanged (regression); `setActiveCountry` persists sentinel and real values alike |
| `resolveListCountryParam()` mapping | `providers/__tests__/country-filter-provider.test.tsx` (same file — it's a pure function co-located with the provider) | `resolveListCountryParam(ALL_COUNTRIES_FILTER) === undefined`; `resolveListCountryParam('Nigeria') === 'Nigeria'` — this is the direct, isolated test for FR-ACF-002's core guarantee, corrected from the original plan's mistaken `use-assessments.test.ts` target (the hook never sees the sentinel) |
| Header rendering | `components/layout/__tests__/app-header.test.tsx` (new) | 5 options render, "All countries" first; selecting it calls `onCountryChange(ALL_COUNTRIES_FILTER)`; no crash / no `getCountryFlag` call on the sentinel row |
| Create-flow guard | `components/assessment/__tests__/start-assessment-modal.test.tsx` (extend) | Mocked `activeCountry = ALL_COUNTRIES_FILTER` → form defaults to `"Kenya"`; Select never offers a 5th option |

---

## Alignment check

Design implements `proposal.md` Option A / `requirements.md` without scope creep — zero backend, zero shared-package, zero new visual pattern.
