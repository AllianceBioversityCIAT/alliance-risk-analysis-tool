# Multi-Country Enablement — Proposal

## Document Control

| Field | Value |
|-------|-------|
| **Spec path** | `enhancements/multi-country-enablement` |
| **Type** | Change |
| **Project** | CGIAR Risk Intelligence Tool |
| **Version** | 1.0 |
| **Date** | 2026-07-27 |
| **Status** | Approved |
| **Source** | Client proposal — *Multi-Country Enablement (Code-Level Country Configuration)* |

### References

| Ref | Document |
|-----|----------|
| C1 | `docs/prd.md` — OQ-02 (multi-country expansion) |
| C2 | `docs/trd/trd.md` — Assessment entity, async job pipeline |
| C3 | `docs/ux-ui/design.md` — Dashboard context selector, start-assessment modal |
| C4 | `docs/figma-design/screens/02-dashboard.md` — country context selector (designed) |
| C5 | `docs/figma-design/screens/03-start-assessment-modal.md` — country Select (designed) |

---

## Intent

Enable analysts to create, filter, and run risk assessments for **Kenya, Ethiopia, Nigeria, and Zambia** using the **same seven-category framework and scoring thresholds**. The selected country is stored on each assessment, visible throughout the UI and reports, and injected into AI prompts so gap detection, risk analysis, and report generation reference the correct national context instead of assuming Kenya.

---

## Problem / Current Behavior

| Area | Today |
|------|-------|
| **Database** | `Assessment.country` exists (`VARCHAR`, default `"Kenya"`) — field is present but underused |
| **API create** | Accepts optional `country`; defaults to `"Kenya"` if omitted (`assessments.service.ts`) |
| **API list** | No `country` query filter — only `status`, `search`, `cursor`, `limit` |
| **Start assessment UI** | Country is **locked** to Kenya (read-only muted field); create calls hardcode `country: 'Kenya'` |
| **Dashboard header** | Context selector shows Kenya only; selection does **not** filter assessments |
| **AI prompts** | Risk/report handlers pass document content and categories; **`assessment.country` is not injected** into gap/risk prompt templates via a standard placeholder |
| **Reports / PDF** | Already display `assessment.country` in metadata |
| **Product copy** | README, PRD, and UI label everything as Kenya MVP |

Analysts operating in Ethiopia, Nigeria, or Zambia cannot select their country at intake, filter the dashboard by country, or rely on AI outputs consistently referencing the assessment's country.

---

## Proposed Outcome

After this change:

1. Analysts pick one of **four supported countries** when creating an assessment (dropdown).
2. The dashboard **filters assessments by selected country** (header context selector or equivalent filter control).
3. `Assessment.country` stores the selection and appears in list rows, workflow screens, web report, and PDF.
4. Gap detection, risk analysis, and report generation prompts receive **`{{country}}`** (or equivalent) so AI outputs reference the selected country’s regulatory, climate, market, and financial context.
5. Existing Kenya assessments remain valid (default unchanged).
6. A short **implementation note** documents supported countries, configuration location, and known limitations.

---

## Scope

### In scope

- Code-level allowlist: **Kenya, Ethiopia, Nigeria, Zambia** (shared constants in `@alliance-risk/shared`)
- Country dropdown on start-assessment modal (replace locked Kenya field)
- Dashboard country filter wired to `GET /api/assessments?country=…`
- API validation: `country` must be one of the four supported values on create/update
- Display country consistently in assessment table, scorecard, report, PDF (mostly already present)
- Extend prompt injection (`VariableInjectionService` or handler-level) with `{{country}}` from `assessment.country`
- Review and update seeded/admin prompts where Kenya is implicit; add country-context instruction where missing
- Sample assessment smoke path per country (manual QA)
- Implementation note under `docs/specs/enhancements/multi-country-enablement/` or `docs/runbooks/`

### Non-goals

- Country-specific scoring thresholds or weighted models
- Formal regulatory rule engines or validation against official national sources
- External data integrations per country
- Multilingual localization (UI remains English)
- Admin UI to add countries without a code deploy
- Automated country profile updates
- Changes to the seven risk categories or subcategory definitions
- Distinguishing `Assessment.country` (program context) from gap field `country_of_operation` (document extraction) beyond documenting the relationship

---

## Affected Users, Systems, And Specs

| Actor / System | Impact |
|----------------|--------|
| **Risk Analyst** | Selects country at intake; filters dashboard by country |
| **Administrator** | May review/update prompts in Prompt Manager for country-aware wording |
| **API** | `packages/api/src/domain/assessments/` — create, list filter, DTO validation |
| **Shared** | New `SUPPORTED_COUNTRIES` constant + types |
| **Web** | `start-assessment-modal.tsx`, `app-header.tsx`, dashboard hooks/filters |
| **Job handlers** | `gap-detection`, `risk-analysis`, `report-generation` — prompt context |
| **Prompts** | Seed data + active DB prompts — `{{country}}` placeholder adoption |
| **Prisma** | Likely **no schema migration** (field exists); optional index on `(userId, country)` if list filter performance requires it |
| **Constitution** | Update `docs/prd.md` geography scope after delivery |

---

## Visual Reference

- **Source:** Existing Figma implementation guides (no new Figma link provided)
- **Location:**
  - `docs/figma-design/screens/02-dashboard.md` — context selector with flag + chevron
  - `docs/figma-design/screens/03-start-assessment-modal.md` — country `Select` in business-info step
- **Notes:** Designs already anticipate multi-country UI. Implementation should match design tokens in `docs/ux-ui/design.md` (shadcn `Select`, flag emoji per country). No new mockup generated — existing Figma docs are sufficient.

---

## Requirement Delta Preview

### ADDED Requirements

- **FR-MC-001:** System exposes exactly four selectable countries: Kenya, Ethiopia, Nigeria, Zambia.
- **FR-MC-002:** On assessment create, user must select a country; API rejects unknown values.
- **FR-MC-003:** Dashboard lists only assessments matching the active country filter.
- **FR-MC-004:** AI agents (gap, risk, report) receive the assessment country in prompt context.
- **FR-MC-005:** Country appears on assessment list, detail views, web report, and PDF.

### MODIFIED Requirements

- **FR-MC-M01:** Start-assessment country field changes from read-only Kenya to required dropdown.
- **FR-MC-M02:** Header context selector changes from cosmetic to functional filter (persists selection for session).
- **FR-MC-M03:** `GET /api/assessments` accepts optional `country` query parameter.
- **FR-MC-M04:** Default country remains Kenya when legacy clients omit the field (backward compatible).

### REMOVED Requirements

- None. Kenya-only MVP labeling and hardcoded UI constraints are removed, not product capabilities.

---

## Approach Options

### Option A — Code-level country config (recommended)

Shared constant array in `@alliance-risk/shared`; validate on API; wire UI dropdown and filter; add `{{country}}` to prompt injection pipeline.

| Pros | Cons |
|------|------|
| Matches client proposal; minimal infra | New country requires code change + deploy |
| Field already in DB — no migration risk | |
| Smallest diff; fast to ship | |
| Aligns with existing Prompt CMS pattern | |

### Option B — Database `countries` table + admin CRUD

Store countries in RDS; admin manages list.

| Pros | Cons |
|------|------|
| Flexible without deploy | Over-engineered for fixed set of four |
| | Extra UI, migrations, seed sync |
| | Out of client scope |

### Option C — Free-text country field

Keep `country` as arbitrary string; no allowlist.

| Pros | Cons |
|------|------|
| Maximum flexibility | Typos break filters and prompt consistency |
| | Conflicts with client’s four-country scope |
| | Weak validation story |

---

## Recommended Approach

**Option A — Code-level country configuration.**

Rationale: The Prisma schema and API DTO already carry `country`. The gap is **UI hardcoding**, **missing list filter**, and **prompt injection**. A shared allowlist in `@alliance-risk/shared` gives one source of truth for API validation, frontend dropdown, and flags/labels. Extend `VariableInjectionService` (or parallel helper) to replace `{{country}}` alongside existing `{{categories}}` placeholders.

Implementation sketch:

```
@alliance-risk/shared/constants/supported-countries.ts
  → SUPPORTED_COUNTRIES = [{ code, label, flag }, …]

API: ListAssessmentsQueryDto.country + where clause
API: CreateAssessmentDto — @IsIn(SUPPORTED_COUNTRY_LABELS)

Web: AppHeader context → updates filter state → useAssessments({ country })
Web: StartAssessmentModal → Select country → createAssessment({ country })

Handlers: inject assessment.country into prompts as {{country}}
Prompts: Add "Analyze in the context of {{country}}" where Kenya was implicit
```

---

## Risks, Dependencies, And Open Questions

| Risk | Mitigation |
|------|------------|
| AI hallucinates country-specific facts | Document limitation in implementation note; prompts instruct use of general knowledge, not cited regulations |
| `country_of_operation` gap field ≠ `Assessment.country` | Document distinction; gap field stays document-derived; assessment country drives program context |
| Header filter vs assessment country mismatch | Filter is **view scope**, not assessment attribute — clear UX label ("Showing: Nigeria") |
| Existing prompts in production DB lack `{{country}}` | Migration script or admin checklist to update active prompts; seed updates for new envs |
| Stats endpoint (`GET /assessments/stats`) may ignore country filter | Decide if stats are global or per-country (see OQ-03) |

### Open questions

| ID | Question | Default if unanswered |
|----|----------|----------------------|
| OQ-01 | Should country filter persist in `localStorage` across sessions? | Yes — same pattern as auth remember-me |
| OQ-02 | Index `(userId, country)` on assessments for list performance? | Add if list >1k rows per user |
| OQ-03 | Should dashboard stat cards respect country filter? | Yes — stats scoped to active country |
| OQ-04 | Allow admin to change country on existing DRAFT assessments? | Yes via update DTO |
| OQ-05 | Currency examples in prompts — leave to AI or add per-country hints in constants? | Leave to AI per client assumption |

---

## Success Criteria

| # | Criterion |
|---|-----------|
| SC-01 | Analyst can create assessments for all four countries via dropdown |
| SC-02 | Dashboard filter shows only assessments for the selected country |
| SC-03 | API returns 400 for unsupported country values |
| SC-04 | Risk analysis output for a Nigeria assessment references Nigeria (manual review of sample) |
| SC-05 | PDF and web report display correct country metadata |
| SC-06 | Existing Kenya assessments unchanged and visible when Kenya filter selected |
| SC-07 | Implementation note published with configuration path and limitations |

---

## Next Step

After approval:

```text
/akili-specify enhancements/multi-country-enablement
```
