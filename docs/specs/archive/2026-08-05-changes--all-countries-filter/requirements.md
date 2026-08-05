# All-Countries Dashboard Filter — Requirements

## 1. Document Control

| Field | Value |
|-------|-------|
| **Module** | `changes/all-countries-filter` |
| **Project** | CGIAR Risk Intelligence Tool |
| **Depth** | Standard |
| **Version** | 1.0 |
| **Date** | 2026-08-05 |
| **Proposal** | `proposal.md` (Approved) |

### References

| Ref | Document |
|-----|----------|
| C1 | `docs/prd.md` — geography scope (Kenya, Ethiopia, Nigeria, Zambia) |
| C2 | `docs/specs/archive/2026-07-29-enhancements--multi-country-enablement/requirements.md` — FR-MC-003, FR-MC-004, FR-MC-005, FR-MC-009, FR-MC-010 (amended by this spec) |
| C3 | `docs/figma-design/screens/02-dashboard.md` — context selector pattern |

---

## 2. Executive Summary

**Answer:** Add a 5th option, "All countries," to the dashboard's header country filter only, make it the default landing view, and reuse the API's existing "omit `country` = all" behavior — with zero backend change and zero change to the 4-country allowlist used for assessment creation.

Today `CountryFilterProvider` always initializes to `"Kenya"` and the header dropdown only lists the 4 real countries. This spec adds a view-only "All countries" state, changes the default, and guards every place that currently assumes `activeCountry` is always a real country (chiefly the create-assessment modal's default-country pre-fill).

---

## 3. Glossary

| Term | Definition |
|------|------------|
| **Active country filter** | The dashboard's current view scope — one of the 4 real countries, or the new "All countries" state |
| **All countries (sentinel)** | A Web-only filter value meaning "no country scope" — never a valid value for `Assessment.country`, never sent to the API as a literal string |
| **Supported country** | One of Kenya, Ethiopia, Nigeria, Zambia — unchanged from the multi-country-enablement spec |

---

## 4. System Context & Scope

### In scope

- New "All countries" option in the dashboard header filter (`AppHeader`)
- Default filter state changes from `"Kenya"` to "All countries"
- List and stats queries omit `country` when "All countries" is active
- Create-assessment modal's default-country logic guarded against the sentinel
- `AssessmentTable` empty-state copy guarded against the sentinel
- `localStorage` persistence extended to support the new state

### Out of scope

- Any change to `SUPPORTED_COUNTRIES` / `SupportedCountryLabel` in `@alliance-risk/shared`
- Any change to the API (`ListAssessmentsQueryDto`, `AssessmentStatsQueryDto`, `AssessmentsService`)
- Any change to AI prompt injection, scoring, report, or PDF generation
- "All countries" appearing anywhere other than the one header dropdown

### Defect Classes & Verification Coverage

| Defect class | Example failure | Caught by |
|---|---|---|
| Sentinel leaks into assessment creation | A new assessment gets `country: "All countries"` written to the DB | TypeScript compile error (narrowed types, see design.md) + unit test on `start-assessment-modal` asserting the default is always a real country + existing API-side `@IsSupportedCountry()` validation as a last-resort backstop |
| Wrong default on first load | Fresh session shows Kenya instead of All, or a corrupted `localStorage` value crashes instead of falling back | Unit test on `country-filter-provider` covering empty/invalid/sentinel storage values |
| Wrong query params sent | API receives literal `country=All countries` and 400s, or the wrong param is omitted | Unit test on `use-assessments`/dashboard page's country-to-query-param mapping |
| Regression on existing real-country persistence | A previously-working stored `"Kenya"` preference stops restoring correctly | Unit test asserting real stored countries still restore unchanged (regression case) |
| Header rendering breaks on the sentinel | `getCountryFlag()` throws or renders `undefined` for the "All countries" row | Unit test (RTL) asserting `AppHeader` renders the "All countries" row without calling `getCountryFlag()` |

All defect classes here are unit-testable via existing Jest/RTL infrastructure — no class requires a human/visual (T6) review pass.

---

## 5. Stakeholders / Personas

| Persona | Need |
|---------|------|
| **Risk Analyst** | See all assessments across countries at a glance; still filter to one country when needed |

---

## 6. Functional Requirements

### FR-ACF-001: "All countries" header option

**Priority:** Must | **Persona:** Analyst

The header country selector SHALL expose a 5th option, "All countries," positioned above the 4 supported countries.

#### Scenario: Analyst opens the header selector

- **GIVEN** the analyst opens the header country dropdown
- **WHEN** it renders
- **THEN** 5 options appear: "All countries" first, followed by Kenya, Ethiopia, Nigeria, Zambia in their existing order
- **AND IT MUST** render "All countries" without calling `getCountryFlag()` (which only accepts real country labels)
- **BUT it must NOT** add "All countries" to `SUPPORTED_COUNTRIES` or any list consumed by the create-assessment flow

---

### FR-ACF-002: "All countries" shows every assessment

**Priority:** Must | **Persona:** Analyst

Selecting "All countries" SHALL cause the assessment list and dashboard stats to reflect every country, by omitting the `country` query parameter entirely.

#### Scenario: Analyst selects "All countries"

- **GIVEN** the analyst has assessments across Kenya and Nigeria
- **WHEN** they select "All countries" in the header
- **THEN** the assessment table shows assessments from both countries
- **AND IT MUST** call `GET /api/assessments` and `GET /api/assessments/stats` with no `country` parameter present (not an empty string, not a literal `"All countries"` value)
- **BUT it must NOT** send any request that the API would reject with 400

---

### FR-ACF-003: "All countries" is the new default

**Priority:** Must | **Persona:** Analyst

The active country filter SHALL default to "All countries" when no valid stored preference exists.

#### Scenario: Fresh session

- **GIVEN** an analyst with no prior stored country filter (new browser, cleared storage)
- **WHEN** they open the dashboard
- **THEN** the active filter is "All countries" and the list/stats show every country
- **AND IT MUST** fall back to "All countries" (not `"Kenya"`) when the stored `localStorage` value is present but invalid (e.g. corrupted, a removed country)

#### Scenario: Existing stored preference is respected (regression guard)

- **GIVEN** an analyst previously selected "Ethiopia" and it is still stored in `localStorage`
- **WHEN** they open the dashboard
- **THEN** the active filter restores to "Ethiopia," not "All countries" — this is a regression check against FR-MC-005's original default-country restore path

---

### FR-ACF-004: Persist "All countries" like any other filter value

**Priority:** Should | **Persona:** Analyst

The analyst's selection of "All countries" SHALL persist across browser sessions exactly like a real country selection does today.

#### Scenario: Filter restored on return visit

- **GIVEN** the analyst explicitly selected "Kenya" after previously having "All countries" active
- **WHEN** they close the browser and return
- **THEN** the active filter is "Kenya" (their most recent explicit choice), not "All countries"

---

### FR-ACF-005: Create-assessment flow is unaffected by "All countries"

**Priority:** Must | **Persona:** Analyst

The create-assessment country `Select` SHALL never include "All countries," and its default value SHALL never be "All countries."

#### Scenario: Start New Assessment while "All countries" is active

- **GIVEN** the dashboard's active filter is "All countries"
- **WHEN** the analyst opens "Start New Assessment"
- **THEN** the country `Select` still lists exactly the 4 supported countries
- **AND IT MUST** default to `"Kenya"` (the existing backward-compatible default from FR-MC-002/FR-MC-009), not blank, not an error, and not the sentinel
- **BUT it must NOT** allow the assessment to be created with `country` unset or equal to "All countries"

#### Scenario: Auto-draft save while "All countries" is active

- **GIVEN** the dashboard's active filter is "All countries"
- **WHEN** the analyst starts filling the create form and closes the modal before finishing (triggering the existing auto-draft-save path)
- **THEN** the draft is saved with `country: "Kenya"`, matching the explicit-create default above

---

## 7. Non-Functional Requirements

### NFR-ACF-001: No backend or shared-contract change

The API (`ListAssessmentsQueryDto`, `AssessmentStatsQueryDto`, `AssessmentsService`) and `@alliance-risk/shared` (`SUPPORTED_COUNTRIES`, `SupportedCountryLabel`, `isSupportedCountry`) SHALL remain unmodified by this change.

**Priority:** Must

### NFR-ACF-002: Backward compatibility

Analysts with an existing real-country value already in `localStorage` SHALL see no change in behavior — only the *no-stored-value* and *invalid-stored-value* defaults change.

**Priority:** Must

---

## 8. Business Rules

### BR-ACF-001: View-only sentinel

"All countries" is a dashboard view-filter state only. It is never a valid value for `Assessment.country`, is never sent to the API as a literal string, and is never persisted anywhere outside the Web app's own `localStorage` key.

---

## 9. Dependencies & Assumptions

| Dependency | Notes |
|------------|-------|
| Existing "omit `country` = all" API behavior | Already implemented in `AssessmentsService.findAll`/`getStats`; reused as-is, not modified |
| `CountryFilterProvider` (multi-country-enablement) | This spec extends, not replaces, its existing localStorage/context pattern |

| Assumption | Source |
|------------|--------|
| "All countries" icon defaults to 🌍 unless the user requests otherwise | `proposal.md` OQ-01 |
| Empty-state copy for "All countries" with zero assessments falls back to the existing generic "No assessments yet" message rather than a new country-specific string | `proposal.md` Risks table |

---

## 10. Open Questions

| ID | Question | Proposed default |
|----|----------|----------------|
| OQ-01 | Final icon for the "All countries" row | 🌍, revisit if design feedback differs |

---

## 11. Requirement ID Index

| ID | Title | Priority |
|----|-------|----------|
| FR-ACF-001 | "All countries" header option | Must |
| FR-ACF-002 | "All countries" shows every assessment | Must |
| FR-ACF-003 | "All countries" is the new default | Must |
| FR-ACF-004 | Persist "All countries" like any filter value | Should |
| FR-ACF-005 | Create-assessment flow unaffected | Must |
| NFR-ACF-001 | No backend/shared-contract change | Must |
| NFR-ACF-002 | Backward compatibility | Must |
| BR-ACF-001 | View-only sentinel | — |

---

## Alignment with proposal

Stays aligned with `proposal.md` Option A. Amends `docs/specs/archive/2026-07-29-enhancements--multi-country-enablement/requirements.md` FR-MC-005, FR-MC-009, FR-MC-010 as previewed. No scope expansion.
