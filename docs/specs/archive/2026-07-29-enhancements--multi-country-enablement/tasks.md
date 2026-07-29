# Multi-Country Enablement — Task Plan

## 1. Document Control

| Field | Value |
|-------|-------|
| **Document** | Multi-Country Enablement — Task Plan |
| **Project** | CGIAR Risk Intelligence Tool |
| **Phase** | Enhancement |
| **Version** | 1.0 |
| **Date** | 2026-07-27 |

### Source Documents

| Ref | Document | Location |
|-----|----------|----------|
| R1 | Requirements | `docs/specs/enhancements/multi-country-enablement/requirements.md` |
| R2 | Design | `docs/specs/enhancements/multi-country-enablement/design.md` |

---

## 2. Legend

### Expertise Tags

| Tag | Meaning |
|-----|---------|
| `[SHARED]` | `@alliance-risk/shared` |
| `[BE]` | Backend (NestJS) |
| `[FE]` | Frontend (Next.js) |
| `[DOCS]` | Documentation |

### Status Markers

| Marker | Meaning |
|--------|---------|
| `[ ]` | Not started |
| `[~]` | In progress |
| `[x]` | Complete |

### Skill References

| Skill | Usage |
|-------|-------|
| `nestjs-expert` | DTOs, service, validators, handler changes |
| `api-design-principles` | Query params, validation, error shapes |
| `error-handling-patterns` | DRAFT-only country update guard |
| `shadcn-ui` | Select, DropdownMenu, Badge |
| `tailwind-design-system` | Country badge, header selector styling |
| `vercel-react-best-practices` | React Query cache keys, provider pattern |

---

## Phase A: Shared Foundation (Sequential — unblocks all)

### T-001: Add `SUPPORTED_COUNTRIES` constant and types `[SHARED]`

- **Status:** `[x]`
- **Skills:** (none — shared constants)
- **Size:** S
- **Dependencies:** None
- **Requirements:** FR-MC-001, NFR-MC-001
- **Design Ref:** §9
- **Scope:**
  - Create `packages/shared/src/constants/supported-countries.ts` with Kenya, Ethiopia, Nigeria, Zambia (label + flag emoji)
  - Export `SUPPORTED_COUNTRIES`, `SUPPORTED_COUNTRY_LABELS`, `SupportedCountryLabel`, `DEFAULT_COUNTRY`, `isSupportedCountry()`
  - Add `country: string` to `AssessmentSummary` in `assessment.types.ts`
  - Export all from `packages/shared/src/index.ts`
  - Run `pnpm --filter @alliance-risk/shared build`
- **Tests:** Typecheck passes; `isSupportedCountry('Kenya')` true, `'Uganda'` false (unit test optional in shared or defer to API)
- **Verification:** `pnpm --filter @alliance-risk/shared build && pnpm --filter @alliance-risk/shared typecheck`
- **Done when:** API and Web can import country constants and updated `AssessmentSummary` type.

---

## Phase B: API Layer (Sequential after T-001)

### T-002: Country validation decorator + DTO updates `[BE]`

- **Status:** `[x]`
- **Skills:** `nestjs-expert`, `api-design-principles`
- **Size:** S
- **Dependencies:** T-001
- **Requirements:** FR-MC-002, FR-MC-003, FR-MC-007
- **Design Ref:** §6, §7.1
- **Scope:**
  - Create `packages/api/src/common/validators/is-supported-country.validator.ts` (`@IsSupportedCountry()` using shared labels)
  - `CreateAssessmentDto`: add `@IsOptional() @IsSupportedCountry()` on `country`
  - `UpdateAssessmentDto`: add optional `country` with `@IsSupportedCountry()`
  - `ListAssessmentsQueryDto`: add optional `country` with `@IsSupportedCountry()`
  - Add `AssessmentStatsQueryDto` (or shared query) with optional `country` for stats endpoint
- **Tests:** Controller/service specs — 400 on `country: 'Uganda'`
- **Verification:** `pnpm --filter @alliance-risk/api test -- --testPathPattern=assessments.controller`
- **Done when:** Invalid country rejected at validation layer; valid country accepted.

### T-003: AssessmentsService — list filter, stats filter, draft update guard `[BE]`

- **Status:** `[x]`
- **Skills:** `nestjs-expert`, `error-handling-patterns`
- **Size:** M
- **Dependencies:** T-002
- **Requirements:** FR-MC-003, FR-MC-004, FR-MC-007, NFR-MC-003
- **Design Ref:** §7.1
- **Scope:**
  - `findAll`: add `country` to Prisma `where` when query param present
  - `getStats(userId, country?)`: filter all four counts by country when provided
  - `update`: allow `country` only when `status === 'DRAFT'`; else `BadRequestException`
  - `AssessmentsController.getStats`: accept `@Query()` country param and pass to service
  - Ensure list response includes `country` field (Prisma model already has it)
- **Tests:** `assessments.service.spec.ts` — filter by country; stats scoped; reject country update on ANALYZING assessment
- **Verification:** `pnpm --filter @alliance-risk/api test -- --testPathPattern=assessments.service`
- **Done when:** All service tests pass; list/stats/update behaviors match FR-MC-003, FR-MC-004, FR-MC-007 scenarios.

---

## Phase C: AI Prompt Injection (Sequential after T-001; parallel with Phase B)

### T-004: Extend `VariableInjectionService` with country injection `[BE]`

- **Status:** `[x]`
- **Skills:** `nestjs-expert`
- **Size:** S
- **Dependencies:** T-001
- **Requirements:** FR-MC-008
- **Design Ref:** §7.2
- **Scope:**
  - Add `injectCountry(text: string, country: string): string` replacing `{{country}}`
  - Add `injectAllWithCountry(prompt, categories, country)` or extend existing `injectAll` to accept optional country
  - Unit tests for replacement and unreplaced placeholder left intact
- **Tests:** `variable-injection.service.spec.ts` — `{{country}}` → `Nigeria`; unknown placeholders unchanged
- **Verification:** `pnpm --filter @alliance-risk/api test -- --testPathPattern=variable-injection`
- **Done when:** Service tests green; handlers can import injection helper.

### T-005: Wire country injection into job handlers `[BE]`

- **Status:** `[x]`
- **Skills:** `nestjs-expert`
- **Size:** M
- **Dependencies:** T-004
- **Requirements:** FR-MC-008
- **Design Ref:** §7.2
- **Scope:**
  - `gap-detection.handler.ts`: after DB prompt fetch, inject country from `assessment.country` into system + user prompts before Bedrock
  - `risk-analysis.handler.ts`: inject country alongside existing template replacements
  - `report-generation.handler.ts`: inject country before Bedrock narrative/financial sub-calls
  - Log `warn` when assessment country ≠ Kenya and prompt contains hardcoded "Kenya" without `{{country}}`
- **Tests:** `risk-analysis.handler.spec.ts` — assert assembled prompt contains assessment country
- **Verification:** `pnpm --filter @alliance-risk/api test -- --testPathPattern=handler`
- **Done when:** Handler tests pass; country appears in prompt assembly for at least risk-analysis path.

### T-006: Update seed prompts with `{{country}}` context `[BE]` `[DOCS]`

- **Status:** `[x]`
- **Skills:** `nestjs-expert`
- **Size:** S
- **Dependencies:** T-004
- **Requirements:** FR-MC-008, NFR-MC-005
- **Design Ref:** §7.3
- **Scope:**
  - Update `packages/api/prisma/seed.ts` prompts for `gap_detector`, `risk_analysis`, `report_generation`
  - Add country-context instruction using `{{country}}` placeholder
  - Remove/replace Kenya-specific wording where present
- **Tests:** Seed runs without error (`npx --prefix packages/api tsx prisma/seed.ts` against local DB)
- **Verification:** Manual — inspect seeded prompt text contains `{{country}}`
- **Done when:** Fresh seed produces country-aware default prompts.

---

## Phase D: Frontend — Country Filter & Intake (Sequential after T-001; after T-003 for API)

### T-007: `CountryFilterProvider` + layout wiring `[FE]`

- **Status:** `[x]`
- **Skills:** `vercel-react-best-practices`
- **Size:** S
- **Dependencies:** T-001
- **Requirements:** FR-MC-005, FR-MC-010
- **Design Ref:** §8.2
- **Scope:**
  - Create `packages/web/src/providers/country-filter-provider.tsx`
  - localStorage key `alliance_active_country`; validate on init; fallback Kenya
  - Wrap `(protected)/layout.tsx` inner content with provider
  - Wire `AppLayout` / `AppHeader` with `activeCountry` + `onCountryChange` from context
  - Replace hardcoded `CONTEXT_OPTIONS` in `app-header.tsx` with `SUPPORTED_COUNTRIES` from shared
- **Tests:** Optional — provider restores from localStorage mock
- **Verification:** `pnpm --filter @alliance-risk/web build`
- **Done when:** Header selector switches country; selection persists on page reload.

### T-008: Dashboard filter + stats + table country display `[FE]`

- **Status:** `[x]`
- **Skills:** `shadcn-ui`, `tailwind-design-system`, `vercel-react-best-practices`
- **Size:** M
- **Dependencies:** T-003, T-007
- **Requirements:** FR-MC-003, FR-MC-004, FR-MC-006
- **Design Ref:** §8.3, §8.4
- **Scope:**
  - `use-assessments.ts`: add `country` to `AssessmentFilters`; pass to API; fix `useAssessmentStats` to accept `{ country }` and use `queryKey: ['assessment-stats', country]`
  - `dashboard/page.tsx`: read `activeCountry` from context; pass to hooks; reset pagination on country change; map `country` into `AssessmentRowData`
  - `assessment-table-row.tsx`: add country badge (flag + label)
  - `assessment-table.tsx` or dashboard: country-specific empty state message
- **Tests:** `use-assessments.test.ts` — query params include country; stats queryKey includes country
- **Verification:** `pnpm --filter @alliance-risk/web test -- --testPathPattern=use-assessments`
- **Done when:** Dashboard list and stats reflect selected country; badge visible on rows.

### T-009: Start-assessment modal country Select `[FE]`

- **Status:** `[x]`
- **Skills:** `shadcn-ui`, `tailwind-design-system`
- **Size:** M
- **Dependencies:** T-007, T-003
- **Requirements:** FR-MC-002, FR-MC-009, FR-MC-007
- **Design Ref:** §8.3, §8.5
- **Scope:**
  - Add `country` to Zod schema + React Hook Form in `start-assessment-modal.tsx`
  - Replace read-only Kenya field with shadcn `Select` (4 options from shared)
  - Default country from `CountryFilterProvider`
  - Pass selected country to `createAssessment` in `handleModeSelect`
  - Fix `handleClose` auto-draft path — use form/context country, **not** hardcoded `'Kenya'`
  - Draft resume: pre-fill country from `draftAssessment.country` (row data); include country in `updateAssessment` when resuming
  - Remove "(MVP)" locked Kenya UI copy
- **Tests:** `start-assessment-modal.test.tsx` — 4 options; create payload includes country; handleClose uses selected country
- **Verification:** `pnpm --filter @alliance-risk/web test -- --testPathPattern=start-assessment-modal`
- **Done when:** Cannot create assessment without country; no hardcoded Kenya in create/draft paths.

---

## Phase E: Workflow Display & Documentation (Sequential after Phase D)

### T-010: Show country in assessment workflow sub-header `[FE]`

- **Status:** `[x]`
- **Skills:** `shadcn-ui`, `tailwind-design-system`
- **Size:** S
- **Dependencies:** T-001
- **Requirements:** FR-MC-006
- **Design Ref:** §8.3 (workflow pages)
- **Scope:**
  - Display assessment country (flag + label) in upload, gap-detector, and risk-scorecard workflow headers using `useAssessment(id)`
  - Match existing sub-header/teal header pattern in those pages
- **Tests:** Optional component test — country renders when assessment loaded
- **Verification:** `pnpm --filter @alliance-risk/web build`
- **Done when:** Country visible during assessment workflow (not only on dashboard/report).

### T-011: Implementation note + constitution update `[DOCS]`

- **Status:** `[x]`
- **Skills:** (none)
- **Size:** S
- **Dependencies:** T-005, T-006, T-009
- **Requirements:** NFR-MC-005, BR-MC-003, BR-MC-004
- **Design Ref:** §11
- **Scope:**
  - Create `docs/specs/enhancements/multi-country-enablement/implementation-note.md`
  - Document: supported countries, config path, `{{country}}` usage, prod prompt admin checklist, AI limitations, assessment vs gap-field country distinction
  - Update `docs/prd.md` geography line (Kenya-only → four countries)
- **Verification:** Manual review of implementation note completeness
- **Done when:** Note exists; admin checklist for production prompt updates included.

---

## 3. Dependency Graph

```
T-001 ─┬─► T-002 ─► T-003 ─┬─► T-008
       │                    └─► T-009
       ├─► T-004 ─► T-005 ─► T-006
       │                    └─► T-011
       ├─► T-007 ─► T-008
       │         └─► T-009
       └─► T-010

T-008 + T-009 + T-005 ─► T-011
```

**Parallelizable after T-001:** T-002/T-003 (API) ∥ T-004/T-005/T-006 (prompts) ∥ T-007 (provider)

---

## 4. Estimated LOC & PR Strategy

| Metric | Estimate |
|--------|----------|
| **Total LOC** | ~900–1,100 (excluding tests and docs) |
| **New files** | ~4 (shared constant, validator, provider, implementation note) |
| **Modified files** | ~18 |

### Recommended PR split (2 PRs)

| PR | Tasks | Scope | Est. LOC |
|----|-------|-------|----------|
| **PR 1: Backend + shared** | T-001 → T-006 | Shared constants, API filter/validate, prompt injection, seed | ~450 |
| **PR 2: Frontend + docs** | T-007 → T-011 | Provider, dashboard, modal, workflow header, implementation note | ~450 |

**Review order:** PR 1 first (API contract + shared types). PR 2 depends on merged shared package.

**Out of scope per PR:** PR 1 must not touch Web; PR 2 must not change handler logic.

---

## 5. Requirement → Task Coverage

| Requirement | Task(s) |
|-------------|---------|
| FR-MC-001 | T-001, T-007, T-009 |
| FR-MC-002 | T-002, T-009 |
| FR-MC-003 | T-003, T-008 |
| FR-MC-004 | T-003, T-008 |
| FR-MC-005 | T-007 |
| FR-MC-006 | T-008, T-010 |
| FR-MC-007 | T-003, T-009 |
| FR-MC-008 | T-004, T-005, T-006 |
| FR-MC-009 | T-009 |
| FR-MC-010 | T-007, T-008 |
| NFR-MC-001 | T-001 |
| NFR-MC-002 | (no task — no migration) |
| NFR-MC-003 | T-003 |
| NFR-MC-004 | Deferred — no task unless profiling demands index |
| NFR-MC-005 | T-011 |

---

## 6. Recommended First Task

**T-001** — Shared country constants. Unblocks API, Web, and handlers with zero runtime risk.

After T-001, parallel tracks: **T-002/T-003** (API) and **T-007** (frontend provider).

---

## 7. Manual QA Checklist (post-implementation)

- [ ] Create assessment for each of 4 countries
- [ ] Verify dashboard filter isolates by country
- [ ] Verify stats match filtered list
- [ ] Run risk analysis for Nigeria — output references Nigeria context
- [ ] PDF/report shows correct country
- [ ] Existing Kenya assessments visible under Kenya filter
- [ ] localStorage restores last selected country

---

## 8. Next Command

After task approval:

```text
/akili-execute enhancements/multi-country-enablement
```

Start with **T-001** (or run PR 1 tasks T-001–T-006 as a batch).
