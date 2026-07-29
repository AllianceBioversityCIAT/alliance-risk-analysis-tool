# Multi-Country Enablement — Design

## 1. Document Control

| Field | Value |
|-------|-------|
| **Module** | `enhancements/multi-country-enablement` |
| **Requirements** | `requirements.md` v1.0 |
| **Version** | 1.0 |
| **Date** | 2026-07-27 |
| **Architecture tier** | Lite extension of existing Robust monolith (no new services) |

### Requirement coverage map

| Design section | Requirements |
|----------------|--------------|
| §5 Data Model | FR-MC-002, NFR-MC-002, NFR-MC-003 |
| §6 API Design | FR-MC-002, FR-MC-003, FR-MC-004, FR-MC-007 |
| §7 Backend | FR-MC-008, FR-MC-007 |
| §8 Frontend | FR-MC-001, FR-MC-003–010, FR-MC-005, FR-MC-006, FR-MC-009 |
| §9 Shared | FR-MC-001, NFR-MC-001 |
| §10 Decisions | All NFRs, BR-MC-* |

---

## 2. Executive Summary

**Approach:** Extend the existing assessment pipeline with a shared four-country allowlist, API query validation, a dashboard country-filter context, and `{{country}}` prompt injection — **no schema migration**, no new Lambda functions, no changes to risk categories or scoring.

The `Assessment.country` column already exists. Work concentrates on: (1) `@alliance-risk/shared` constants, (2) API list/stats/update filters and validation, (3) Web intake + dashboard UX, and (4) extending `VariableInjectionService` plus job handlers and seed prompts.

---

## 3. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│  Web (Next.js)                                                   │
│  CountryFilterProvider (localStorage)                              │
│    ├── AppHeader context selector → activeCountry                 │
│    ├── Dashboard → useAssessments({ country })                    │
│    │              → useAssessmentStats({ country })               │
│    └── StartAssessmentModal → Select country → POST create        │
└────────────────────────────┬────────────────────────────────────┘
                             │ GET /assessments?country=
                             │ GET /assessments/stats?country=
                             │ POST /assessments { country }
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  API (NestJS) — domain/assessments                                 │
│    CreateAssessmentDto / UpdateAssessmentDto → @IsSupportedCountry│
│    ListAssessmentsQueryDto.country → Prisma where clause          │
│    getStats(userId, country?) → filtered counts                   │
└────────────────────────────┬────────────────────────────────────┘
                             │ assessment.country
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  Worker handlers (gap, risk, report)                               │
│    VariableInjectionService.injectCountry(prompt, country)        │
│    → Bedrock invoke with country-aware prompts                    │
└─────────────────────────────────────────────────────────────────┘
```

### Data flow — create + filter

1. Analyst selects **Nigeria** in header → stored in `localStorage` + React context.
2. Dashboard fetches list/stats with `country=Nigeria`.
3. Start assessment defaults country to Nigeria; analyst confirms → `POST` with `country: "Nigeria"`.
4. Later jobs read `assessment.country` and inject into prompts.

---

## 4. Extended Directory Structure

New and modified paths (no new packages):

```
packages/shared/src/
  constants/supported-countries.ts     # NEW — allowlist + helpers
  types/assessment.types.ts            # MOD — add country to AssessmentSummary

packages/api/src/
  domain/assessments/
    dto/list-assessments-query.dto.ts  # MOD — country query param
    dto/create-assessment.dto.ts       # MOD — strict validation
    dto/update-assessment.dto.ts       # MOD — optional country (DRAFT only)
    assessments.service.ts             # MOD — filter, stats, update guard
    assessments.controller.ts          # MOD — pass country to stats
  common/validators/
    is-supported-country.validator.ts  # NEW — reusable class-validator decorator
  platform/prompts/
    variable-injection.service.ts      # MOD — {{country}} replacement
  platform/jobs/handlers/
    gap-detection.handler.ts           # MOD — inject country into prompts
    risk-analysis.handler.ts           # MOD — inject country into prompts
    report-generation.handler.ts       # MOD — inject country into prompts
  prisma/seed.ts                       # MOD — {{country}} in default prompts

packages/web/src/
  providers/country-filter-provider.tsx  # NEW — context + localStorage
  hooks/use-assessments.ts               # MOD — country on filters + stats
  components/layout/app-header.tsx       # MOD — functional selector
  components/layout/app-layout.tsx       # MOD — wrap provider / pass props
  components/assessment/start-assessment-modal.tsx  # MOD — country Select
  components/dashboard/assessment-table-row.tsx     # MOD — country badge
  app/(protected)/layout.tsx             # MOD — provider wiring
  app/(protected)/dashboard/page.tsx     # MOD — consume activeCountry
  app/(protected)/assessments/**         # MOD — show country in workflow sub-header (FR-MC-006)

docs/specs/enhancements/multi-country-enablement/
  implementation-note.md               # NEW — post-delivery doc (NFR-MC-005)
```

---

## 5. Data Model

### Existing entity (unchanged schema)

| Field | Type | Notes |
|-------|------|-------|
| `Assessment.country` | `VARCHAR(100)` | Default `"Kenya"` — already in Prisma |

**No migration required** (NFR-MC-002). Existing rows remain valid.

### Optional index (defer unless profiling demands)

| Index | When |
|-------|------|
| `(userId, country)` | Add via migration only if list p95 degrades with volume (NFR-MC-004) |

### Distinction (BR-MC-004)

| Concept | Storage | Purpose |
|---------|---------|---------|
| Assessment country | `Assessment.country` | Intake selection, filter, AI injection |
| Country of operation | `GapField` value for `country_of_operation` | Document extraction — unchanged |

---

## 6. API Design

### Shared validation rule

All `country` inputs MUST match a label in `SUPPORTED_COUNTRIES` from `@alliance-risk/shared` (exact string match on `label`, e.g. `"Kenya"`, not ISO codes).

Custom validator `IsSupportedCountry` wraps `@IsIn(SUPPORTED_COUNTRY_LABELS)` for DTO reuse.

### Endpoints

| Method | Path | Change | Requirements |
|--------|------|--------|--------------|
| `POST` | `/api/assessments` | Validate `country`; default `"Kenya"` if omitted | FR-MC-002 |
| `GET` | `/api/assessments` | New optional query `country` | FR-MC-003 |
| `GET` | `/api/assessments/stats` | New optional query `country` (reuse validation via shared query DTO or dedicated `AssessmentStatsQueryDto`) | FR-MC-004 |
| `PUT` | `/api/assessments/:id` | Optional `country`; allowed only when `status === DRAFT` | FR-MC-007 |

### Request / response contracts

**List query (`ListAssessmentsQueryDto`):**

| Param | Type | Validation |
|-------|------|------------|
| `country` | string? | `@IsSupportedCountry()` when present |
| (existing) | status, search, cursor, limit | unchanged |

**Stats query:** Same optional `country` param; controller passes to service.

**Create (`CreateAssessmentDto`):**

| Field | Change |
|-------|--------|
| `country` | Optional with `@IsSupportedCountry()`; service defaults to `"Kenya"` |

**Update (`UpdateAssessmentDto`):**

| Field | Change |
|-------|--------|
| `country` | Optional `@IsSupportedCountry()`; service rejects if assessment not `DRAFT` |

**List response (`AssessmentSummary`):**

| Field | Change |
|-------|--------|
| `country` | **Add** — enables dashboard badge (FR-MC-006, OQ-01 default) |

### Error responses

| Case | Status | Message pattern |
|------|--------|-----------------|
| Invalid country value | 400 | ValidationPipe standard field error |
| Country update on non-DRAFT | 400 | `"Country can only be changed while assessment is in DRAFT status"` |

### Security

- Existing `JwtAuthGuard` + ownership checks unchanged
- Country filter scoped to authenticated user's assessments only (no cross-user leakage)

---

## 7. Backend Module Design

### 7.1 AssessmentsService changes

**`findAll`:** Add `...(query.country && { country: query.country })` to Prisma `where` alongside existing `userId`, `status`, `search`.

**`getStats`:** Accept optional `country`; apply same filter to all four count queries.

**`update`:** When `dto.country` present:
1. Load assessment (existing ownership check)
2. If `status !== 'DRAFT'` → throw `BadRequestException`
3. Else include `country` in update payload

**`create`:** Keep `dto.country ?? 'Kenya'` after DTO validation.

### 7.2 Prompt injection (FR-MC-008)

Extend `VariableInjectionService` with country injection capability:

| Placeholder | Replacement |
|-------------|-------------|
| `{{country}}` | `assessment.country` string |

Apply to both `systemPrompt` and `userPromptTemplate` before Bedrock calls.

**Handler integration:**

| Handler | Injection point |
|---------|-----------------|
| `GapDetectionHandler` | After DB prompt fetch (upload-mode path uses **inline** `.replace()` today, not `VariableInjectionService`) — call `injectCountry()` on both `systemPrompt` and `userPromptTemplate` before Bedrock invoke |
| `RiskAnalysisHandler` | Add country injection alongside existing inline `{{categories}}` / `{{business_data}}` replacements — prefer shared `injectCountry()` helper |
| `ReportGenerationHandler` | Before Bedrock calls for narrative and sub-jobs |

**Fallback behavior (FR-MC-008 scenario 4):** If `{{country}}` absent in template, job proceeds; log `warn` when assessment country ≠ Kenya and template contains hardcoded "Kenya" (best-effort detection, non-blocking).

### 7.3 Seed prompts (`prisma/seed.ts`)

Update default prompts for `gap_detector`, `risk_analysis`, and `report_generation` sections:

- Add explicit instruction: *"Analyze this agricultural business in the context of {{country}}. Consider regulatory, climate, market, and financial conditions typical of {{country}} using general knowledge."*
- Replace any Kenya-specific examples with `{{country}}`-agnostic wording

**Production prompts:** Implementation note includes admin checklist to update active prompts via Prompt Manager (OQ-03 default — no automated DB migration script).

### 7.4 Testing strategy (backend)

| Area | Test file | Focus |
|------|-----------|-------|
| List filter | `assessments.service.spec.ts` | country where clause |
| Stats filter | `assessments.service.spec.ts` | counts scoped by country |
| Create validation | `assessments.controller.spec.ts` | 400 on invalid country |
| Draft update guard | `assessments.service.spec.ts` | reject non-DRAFT country change |
| Country injection | `variable-injection.service.spec.ts` | `{{country}}` replacement |
| Handler integration | `risk-analysis.handler.spec.ts` | country in assembled prompt |

---

## 8. Frontend / UX Component Architecture

### 8.1 Design tokens & visual (Figma alignment)

| Element | Token / pattern |
|---------|-----------------|
| Country selector | shadcn `Select` / `DropdownMenu` — Pattern 2 in component-patterns |
| Flag display | Emoji per country entry in shared constant (Figma uses flag + label) |
| Badge in table | shadcn `Badge` variant `secondary` with flag + country label |
| Typography | `text-sm font-medium` for selector; muted for empty state |

Reference: `docs/figma-design/screens/02-dashboard.md`, `03-start-assessment-modal.md`.

### 8.2 New provider — `CountryFilterProvider`

| Responsibility | Detail |
|----------------|--------|
| State | `activeCountry: SupportedCountryLabel` |
| Persistence | `localStorage` key `alliance_active_country` |
| Init | Read storage → validate against allowlist → fallback Kenya |
| API | `setActiveCountry(label)` updates state + storage |

Mount at `(protected)/layout.tsx` so dashboard and modal share state (FR-MC-005, FR-MC-010).

### 8.3 Component changes

| Component | Change | Requirements |
|-----------|--------|--------------|
| `AppHeader` | Accept `activeCountry`, `onCountryChange`, options from shared constant | FR-MC-010 |
| `StartAssessmentModal` | Replace locked field with `FormField` + `Select`; add `country` to Zod schema; pass to create/update/**auto-draft-on-close**; default from context. **Both** `handleModeSelect` create and `handleClose` auto-save MUST use form/context country — not hardcoded `'Kenya'` | FR-MC-009, FR-MC-002 |
| `DashboardPage` | Read `activeCountry` from context; pass to `useAssessments` + `useAssessmentStats`; reset pagination on country change; map `country` from API into `AssessmentRowData` | FR-MC-003, FR-MC-004 |
| `AssessmentTableRow` | Render country badge when `country` on row data; extend `AssessmentRowData` with `country?: string` | FR-MC-006 |
| `AssessmentTable` / empty state | Country-aware empty message: *"No assessments for {country} yet"* | FR-MC-003 |
| Assessment workflow pages | Show assessment country in workflow context (upload, gap-detector, scorecard sub-header via `useAssessment`) | FR-MC-006 |

### 8.4 Hook changes (`use-assessments.ts`)

| Hook | Change |
|------|--------|
| `AssessmentFilters` | Add optional `country?: string` |
| `useAssessments` | Append `country` query param when set |
| `useAssessmentStats` | Accept `{ country?: string }`; pass query param; **queryKey** MUST include country: `['assessment-stats', country]` to avoid stale cross-country cache |
| `useAssessments` | `queryKey` already includes `filters` object — ensure `country` is part of filters state (no stale data) |
| `CreateAssessmentData` | `country` required from Web (TypeScript); API still defaults for legacy |
| `UpdateAssessmentData` | Add optional `country` for draft resume flow |

### 8.5 Draft resume (FR-MC-007, OQ-02)

When resuming a DRAFT via `StartAssessmentModal`:

1. Pass `country` on `AssessmentRowData` from list API (via `AssessmentSummary.country`), **or** fetch `useAssessment(draftId)` when row lacks country.
2. Pre-fill country `Select` from that value.
3. On update before intake step, call `updateAssessment` with new country if changed.

### 8.6 UI states (FR-MC-009)

| State | Behavior |
|-------|----------|
| Loading | Disable country controls while create/update pending |
| Error | sileo toast; preserve form including country |
| Empty list | Country-specific copy + CTA to start assessment |
| Success | Navigate to intake route |

### 8.7 Testing strategy (frontend)

| Test | Scope |
|------|-------|
| `start-assessment-modal.test.tsx` | Country required; options count = 4; create payload includes country |
| `app-header.test.tsx` | Selector calls onCountryChange |
| `use-assessments.test.ts` | Query string includes country param |

---

## 9. Shared Contracts & Package Extensions

### New constant — `supported-countries.ts`

| Export | Purpose |
|--------|---------|
| `SUPPORTED_COUNTRIES` | Readonly array: `{ label, flag }` for four countries |
| `SupportedCountryLabel` | Union type derived from labels |
| `SUPPORTED_COUNTRY_LABELS` | String array for validation |
| `DEFAULT_COUNTRY` | `"Kenya"` |
| `isSupportedCountry(value)` | Type guard / runtime check |

**Country values (label = stored DB value):**

| Label | Flag |
|-------|------|
| Kenya | 🇰🇪 |
| Ethiopia | 🇪🇹 |
| Nigeria | 🇳🇬 |
| Zambia | 🇿🇲 |

### Modified types — `assessment.types.ts`

Add `country: string` to `AssessmentSummary` so list API returns it without extra detail fetch.

### Build order

```
pnpm --filter @alliance-risk/shared build → api → web
```

---

## 10. Design Decisions

### DD-MC-001: Code-level allowlist (not DB table)

| | |
|---|---|
| **Status** | Accepted |
| **Context** | Client scoped exactly four countries; no admin self-service |
| **Decision** | `SUPPORTED_COUNTRIES` in shared package |
| **Alternatives rejected** | DB `countries` table (over-engineered); free-text field (validation weak) |
| **Requirements** | FR-MC-001, NFR-MC-001, BR-MC-001 |

### DD-MC-002: Label-as-value storage (not ISO codes)

| | |
|---|---|
| **Status** | Accepted |
| **Context** | Column already stores `"Kenya"` string; UI displays full name |
| **Decision** | Use human-readable labels as DB values to avoid migration |
| **Consequences** | Adding country = code change; consistent with existing data |

### DD-MC-003: Extend VariableInjectionService

| | |
|---|---|
| **Status** | Accepted |
| **Context** | Three handlers need identical `{{country}}` replacement |
| **Decision** | Centralize in `VariableInjectionService` rather than per-handler string replace |
| **Alternatives rejected** | Inline replace in each handler (DRY violation) |
| **Requirements** | FR-MC-008 |

### DD-MC-004: CountryFilterProvider at protected layout

| | |
|---|---|
| **Status** | Accepted |
| **Context** | Header (layout) and dashboard/modal need shared state |
| **Decision** | React context + localStorage at `(protected)/layout` |
| **Alternatives rejected** | Prop drilling through AppLayout only (modal in layout already — context cleaner) |
| **Requirements** | FR-MC-005, FR-MC-010 |

### DD-MC-005: Stats require country param from Web (optional on API)

| | |
|---|---|
| **Status** | Accepted |
| **Context** | API backward compat vs dashboard correctness |
| **Decision** | API: `country` optional on stats (omit = all countries). Web: always pass active country |
| **Requirements** | FR-MC-004, NFR-MC-003 |

### DD-MC-006: Country change blocked after DRAFT

| | |
|---|---|
| **Status** | Accepted |
| **Context** | Changing country mid-pipeline invalidates AI context |
| **Decision** | `PUT` accepts `country` only when `status === DRAFT` |
| **Requirements** | FR-MC-007 |

### DD-MC-007: Defer DB index

| | |
|---|---|
| **Status** | Accepted |
| **Context** | Low volume MVP; index adds migration scope |
| **Decision** | Ship without index; add in follow-up if needed |
| **Requirements** | NFR-MC-004 |

---

## 11. Rollout & Observability

| Phase | Action |
|-------|--------|
| Deploy shared + API + Web | Standard `pnpm deploy:all` |
| Production prompts | Admin checklist — update active prompts with `{{country}}` |
| Verify | Sample assessment per country (manual QA per client deliverable) |
| Docs | `implementation-note.md`; update `docs/prd.md` geography line post-merge |

**Logging:** Warn in handlers when prompt templates lack `{{country}}` and assessment is non-Kenya.

**Rollback:** Revert deploy; no schema rollback needed. Kenya default preserves existing behavior.

---

## 12. Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Production prompts still Kenya-specific | Seed + admin checklist; non-blocking warn logs |
| AI invents country facts | Document in implementation note (BR-MC-003) |
| AssessmentSummary type change breaks Web | Coordinate shared build; update row mapping |
| Header filter confusion vs assessment country | Clear "Showing: {country}" label in dashboard |

---

## 13. Open design items (carried from requirements)

| ID | Resolution in design |
|----|---------------------|
| OQ-01 | Country badge on table row via `AssessmentSummary.country` |
| OQ-02 | Draft resume modal exposes country Select + update API |
| OQ-03 | Seed update + admin checklist (§7.3) — no prod migration script |

---

## Alignment check

Design implements proposal Option A without scope creep. No changes to risk categories, scoring, Bedrock model config, or auth model.
