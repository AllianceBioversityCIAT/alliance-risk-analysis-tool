# Multi-Country Enablement — Requirements

## 1. Document Control

| Field | Value |
|-------|-------|
| **Module** | `enhancements/multi-country-enablement` |
| **Type** | Change |
| **Depth** | Standard |
| **Version** | 1.0 |
| **Date** | 2026-07-27 |
| **Proposal** | `proposal.md` (approved intent) |

### References

| Ref | Document |
|-----|----------|
| C1 | `docs/prd.md` — US-02, OQ-02 |
| C2 | `docs/ux-ui/design.md` — §5 Navigation, dashboard flows |
| C3 | `docs/trd/trd.md` — Assessment entity, job pipeline |
| C4 | `docs/figma-design/screens/02-dashboard.md` — context selector |
| C5 | `docs/figma-design/screens/03-start-assessment-modal.md` — country Select |

---

## 2. Executive Summary

**Answer:** Enable four supported countries (Kenya, Ethiopia, Nigeria, Zambia) across assessment intake, dashboard filtering, display, and AI prompt context — without changing the seven-category risk framework or scoring thresholds.

Today the database already stores `Assessment.country` (default Kenya), but the UI locks creation to Kenya, the dashboard does not filter by country, and AI job handlers do not inject the selected country into prompts. This spec defines observable behavior to close those gaps using a code-level country allowlist shared between API and Web.

---

## 3. Glossary

| Term | Definition |
|------|------------|
| **Supported country** | One of Kenya, Ethiopia, Nigeria, Zambia — the only values accepted on create/update and shown in UI selectors |
| **Assessment country** | `Assessment.country` — program context chosen at intake; drives filtering and AI context |
| **Country of operation (gap field)** | Document-extracted gap field `country_of_operation` — may differ from assessment country; not modified by this spec |
| **Active country filter** | Dashboard view scope selected in the header context selector |
| **Country context injection** | Replacing `{{country}}` in AI prompt templates with the assessment's country before Bedrock invocation |

---

## 4. System Context & Scope

### In scope

- Shared allowlist of four countries (label + display flag)
- Required country selection on assessment create (Web)
- Optional country filter on assessment list and stats (API + Web)
- Country validation on API create/update
- Persistent active country filter (localStorage)
- Country display in assessment table, workflow views, web report, PDF (where not already present)
- `{{country}}` injection in gap detection, risk analysis, and report generation prompts
- Seed prompt updates for new environments; guidance for updating active production prompts
- Implementation note documenting approach and limitations

### Out of scope

- Country-specific scoring thresholds or weighted models
- Regulatory rule engines or official-source validation
- External data integrations per country
- Multilingual UI
- Admin UI to add countries without deploy
- Changing seven risk categories or subcategory definitions
- Resolving conflicts between gap field `country_of_operation` and `Assessment.country` beyond documenting the distinction

---

## 5. Stakeholders / Personas

| Persona | Need |
|---------|------|
| **Risk Analyst** | Create and review assessments per country; filter dashboard by country |
| **Platform Administrator** | Optional prompt tuning in Prompt Manager for country-aware templates |
| **CGIAR Program Lead** | Consistent reports grouped by country (indirect beneficiary) |

---

## 6. Functional Requirements

### FR-MC-001: Supported country catalog

The system SHALL expose exactly four supported countries: **Kenya**, **Ethiopia**, **Nigeria**, and **Zambia**, each with a display label and flag indicator suitable for UI selectors.

**Priority:** Must | **Persona:** Analyst, System

#### Scenario: Analyst views country options

- **GIVEN** the analyst opens the start-assessment modal or dashboard country selector
- **WHEN** the country control renders
- **THEN** exactly four options appear with correct labels and flags
- **AND IT MUST** not include any country outside the supported set
- **BUT it must NOT** allow free-text country entry in the create flow

---

### FR-MC-002: Country required on assessment create

The system SHALL require a supported country when creating an assessment and persist it on `Assessment.country`.

**Priority:** Must | **Persona:** Analyst

#### Scenario: Create assessment with selected country

- **GIVEN** the analyst completes business info in the start-assessment modal
- **WHEN** they select Nigeria and proceed to intake mode
- **THEN** the created assessment has `country = "Nigeria"`
- **AND IT MUST** reject submission if country is not selected (client-side validation)

#### Scenario: API rejects invalid country on create

- **GIVEN** a client sends `POST /api/assessments` with `country: "Uganda"`
- **WHEN** the API validates the payload
- **THEN** the response is 400 with a clear validation message
- **BUT it must NOT** create a partial assessment record

#### Scenario: Backward-compatible default

- **GIVEN** a legacy API client omits `country` on create
- **WHEN** the request is otherwise valid
- **THEN** the assessment is created with `country = "Kenya"`
- **AND IT MUST** remain backward compatible for existing integrations

---

### FR-MC-003: Country filter on assessment list

The system SHALL allow filtering assessments by country on the dashboard list.

**Priority:** Must | **Persona:** Analyst

#### Scenario: Filter dashboard by active country

- **GIVEN** the analyst has assessments in Kenya and Nigeria
- **WHEN** they select Nigeria in the header context selector
- **THEN** the assessment table shows only Nigeria assessments
- **AND IT MUST** pass `country=Nigeria` to the list API
- **BUT it must NOT** hide assessments from other countries in the database — only from the current view

#### Scenario: Empty state for country with no assessments

- **GIVEN** the analyst selects Zambia and has zero Zambia assessments
- **WHEN** the list loads
- **THEN** an empty-state message indicates no assessments for Zambia
- **AND IT MUST** still allow creating a new assessment (pre-selecting Zambia in the modal when opened from that context)

#### Scenario: API list filter

- **GIVEN** `GET /api/assessments?country=Ethiopia`
- **WHEN** the API processes the request
- **THEN** only assessments with `country = "Ethiopia"` for the authenticated user are returned
- **AND IT MUST** return 400 if `country` is not a supported value

---

### FR-MC-004: Dashboard stats scoped to active country

The system SHALL scope dashboard stat cards (active, drafts, completed, total) to the active country filter.

**Priority:** Must | **Persona:** Analyst

#### Scenario: Stats match filtered country

- **GIVEN** the analyst selects Kenya and has 3 Kenya drafts and 2 Nigeria drafts
- **WHEN** the dashboard stats load
- **THEN** the drafts count reflects Kenya drafts only (3)
- **AND IT MUST** use the same country parameter as the assessment list
- **BUT it must NOT** aggregate counts across all countries when a country filter is active

---

### FR-MC-005: Persist active country filter

The system SHALL persist the analyst's last selected country filter across browser sessions.

**Priority:** Should | **Persona:** Analyst

#### Scenario: Filter restored on return visit

- **GIVEN** the analyst previously selected Ethiopia and closed the browser
- **WHEN** they log in again and open the dashboard
- **THEN** the active country filter is Ethiopia
- **AND IT MUST** default to Kenya if no prior selection exists or stored value is invalid

---

### FR-MC-006: Country display throughout assessment lifecycle

The system SHALL display the assessment country consistently in list, workflow, web report, and PDF outputs.

**Priority:** Must | **Persona:** Analyst

#### Scenario: Country visible on dashboard row

- **GIVEN** an assessment exists with `country = "Zambia"`
- **WHEN** it appears in the assessment table (within Zambia filter or when viewing detail)
- **THEN** Zambia is visible to the analyst (column, badge, or equivalent)
- **AND IT MUST** match the stored `Assessment.country` value

#### Scenario: Country on report and PDF

- **GIVEN** a completed assessment for Nigeria
- **WHEN** the analyst views the web report or downloads the PDF
- **THEN** Nigeria appears in report metadata
- **AND IT MUST** match `Assessment.country` (already partially implemented — must remain correct for all four countries)

---

### FR-MC-007: Update country on draft assessments

The system SHALL allow updating `country` on existing assessments while status is `DRAFT`.

**Priority:** Should | **Persona:** Analyst

#### Scenario: Change country on draft

- **GIVEN** a DRAFT assessment with `country = "Kenya"`
- **WHEN** the analyst updates country to Ethiopia via API (or UI if exposed)
- **THEN** the assessment country is Ethiopia
- **AND IT MUST** validate against the supported allowlist

#### Scenario: Block country change after analysis started

- **GIVEN** an assessment with status other than `DRAFT`
- **WHEN** a client attempts to change `country`
- **THEN** the API rejects the update with 400 or 409
- **BUT it must NOT** silently ignore the field without error

---

### FR-MC-008: AI prompt country context injection

The system SHALL inject the assessment country into gap detection, risk analysis, and report generation prompts so AI outputs reference the selected country's context.

**Priority:** Must | **Persona:** System

#### Scenario: Risk analysis references assessment country

- **GIVEN** an assessment with `country = "Nigeria"` and prompts containing `{{country}}`
- **WHEN** the risk analysis job runs
- **THEN** `{{country}}` is replaced with `Nigeria` in system and user prompt templates before Bedrock invocation
- **AND IT MUST** instruct the model to consider Nigeria's regulatory, climate, market, and financial context using general knowledge
- **BUT it must NOT** claim validation against official national sources

#### Scenario: Gap detection receives country context

- **GIVEN** gap detection prompts include `{{country}}`
- **WHEN** the gap detection job runs for a Zambia assessment
- **THEN** `{{country}}` is replaced with `Zambia` in injected prompts

#### Scenario: Report generation receives country context

- **GIVEN** report generation prompts include `{{country}}`
- **WHEN** the report job runs
- **THEN** `{{country}}` is replaced with the assessment country
- **AND IT MUST** produce narrative appropriate to that country context

#### Scenario: Unreplaced placeholder handling

- **GIVEN** an active production prompt lacks `{{country}}` but contains Kenya-specific wording
- **WHEN** a non-Kenya assessment runs
- **THEN** seed/default prompts for new environments MUST include `{{country}}`; production prompt updates are documented in the implementation note
- **BUT it must NOT** block job execution solely due to missing placeholder (graceful degradation with logged warning acceptable)

---

### FR-MC-009: Start-assessment modal country selector

The start-assessment modal SHALL replace the read-only Kenya field with a required country dropdown matching Figma spec.

**Priority:** Must | **Persona:** Analyst

#### Scenario: Country select in business-info step

- **GIVEN** the analyst opens Start New Assessment
- **WHEN** the business-info step renders
- **THEN** a `Select` control lists all four supported countries
- **AND IT MUST** disable Continue until country is selected (along with other required fields per Figma)
- **BUT it must NOT** show "(MVP)" locked Kenya messaging

#### Scenario: Pre-fill from active dashboard filter

- **GIVEN** the dashboard active country is Ethiopia
- **WHEN** the analyst opens Start New Assessment
- **THEN** the country dropdown defaults to Ethiopia
- **AND IT MUST** allow changing to another supported country before create

#### UI states

| State | Expected behavior |
|-------|-------------------|
| **Loading** | Modal shows existing skeleton/disabled pattern; country select disabled until form ready |
| **Error (create fail)** | Toast via sileo; country selection preserved |
| **Empty** | N/A — country list always has four items |
| **Success** | Navigate to intake route with new assessment id |

---

### FR-MC-010: Header context selector as functional filter

The dashboard header country selector SHALL act as the active country filter, not a cosmetic label.

**Priority:** Must | **Persona:** Analyst

#### Scenario: Switch country filter

- **GIVEN** the analyst is on the dashboard viewing Kenya assessments
- **WHEN** they select Nigeria from the header dropdown
- **THEN** the list and stats refresh for Nigeria
- **AND IT MUST** show visual indication of active country (flag + label per Figma)
- **BUT it must NOT** change the `country` field on existing assessments

---

## 7. Non-Functional Requirements

### NFR-MC-001: Single source of truth for countries

The supported country list SHALL be defined once in `@alliance-risk/shared` and consumed by API validation and Web UI without duplication.

**Priority:** Must

### NFR-MC-002: No schema migration required

The enhancement SHALL use the existing `Assessment.country` column (default `"Kenya"`). No breaking DB migration is required for MVP delivery.

**Priority:** Must

### NFR-MC-003: Backward compatibility

Existing Kenya assessments SHALL remain readable and filterable under the Kenya filter without data migration.

**Priority:** Must

### NFR-MC-004: List API performance

Country-filtered list queries SHOULD complete within the same latency envelope as today's unfiltered list (p95 < 500ms warm API). Add a DB index on `(userId, country)` only if profiling shows need.

**Priority:** Should

### NFR-MC-005: Implementation documentation

A short implementation note SHALL document supported countries, configuration location, prompt placeholder usage, AI context limitations, and the distinction between assessment country and gap field `country_of_operation`.

**Priority:** Must

---

## 8. Business Rules

### BR-MC-001: Fixed country set

Only Kenya, Ethiopia, Nigeria, and Zambia are valid assessment countries until a new code release extends the allowlist.

### BR-MC-002: Same risk framework

All four countries use the identical seven-category framework, 35 indicators, and scoring thresholds (LOW/MODERATE/HIGH/CRITICAL bands unchanged).

### BR-MC-003: AI country context

Country-specific regulatory, climate, market, and financial context in AI outputs is derived from the model's general knowledge — not validated against official national sources.

### BR-MC-004: Assessment vs gap field country

`Assessment.country` is the program context for filtering and AI injection. Gap field `country_of_operation` remains document-derived and independent.

---

## 9. Dependencies & Assumptions

| Dependency | Notes |
|------------|-------|
| Existing `Assessment.country` column | Prisma schema already has field |
| Prompt CMS | Active prompts in production may need manual `{{country}}` updates |
| `@alliance-risk/shared` build order | Must build shared before API/Web |
| Figma screen guides | UI matches `02-dashboard` and `03-start-assessment-modal` |

| Assumption | Source |
|------------|--------|
| UI remains English | Client proposal |
| Four countries sufficient for this release | Client proposal |
| Stats scoped to active country filter | Proposal OQ-03 default |
| Filter persists in localStorage | Proposal OQ-01 default |
| Currency/locale hints left to AI | Proposal OQ-05 default |

---

## 10. Open Questions

| ID | Question | Proposed default |
|----|----------|----------------|
| OQ-01 | Show country column in assessment table or rely on filter context only? | Show country badge/column for clarity |
| OQ-02 | Expose country edit in Web UI for drafts or API-only? | API + modal edit on draft resume |
| OQ-03 | Migration script for production prompts or admin checklist only? | Seed update + admin checklist in implementation note |

---

## 11. Requirement ID Index

| ID | Title | Priority |
|----|-------|----------|
| FR-MC-001 | Supported country catalog | Must |
| FR-MC-002 | Country required on create | Must |
| FR-MC-003 | Country filter on list | Must |
| FR-MC-004 | Stats scoped to country | Must |
| FR-MC-005 | Persist active filter | Should |
| FR-MC-006 | Country display lifecycle | Must |
| FR-MC-007 | Update country on draft | Should |
| FR-MC-008 | AI prompt country injection | Must |
| FR-MC-009 | Start-assessment country selector | Must |
| FR-MC-010 | Header filter functional | Must |
| NFR-MC-001 | Shared single source of truth | Must |
| NFR-MC-002 | No schema migration | Must |
| NFR-MC-003 | Backward compatibility | Must |
| NFR-MC-004 | List performance | Should |
| NFR-MC-005 | Implementation note | Must |
| BR-MC-001 | Fixed country set | — |
| BR-MC-002 | Same risk framework | — |
| BR-MC-003 | AI country context | — |
| BR-MC-004 | Assessment vs gap field | — |

---

## Alignment with proposal

Spec stays aligned with `proposal.md` Option A (code-level config). Resolved proposal open questions with documented defaults in §9–§10. No scope expansion beyond client deliverables.
