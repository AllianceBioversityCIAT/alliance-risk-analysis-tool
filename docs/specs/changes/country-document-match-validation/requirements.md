# Requirements — Country / Business-Plan Mismatch Validation

## 1. Document Control

| Field | Value |
|-------|-------|
| **Module** | `changes/country-document-match-validation` |
| **Project** | CGIAR Risk Intelligence Tool |
| **Version** | 1.0 |
| **Date** | 2026-08-18 |
| **Author** | Daniela Gómez (via Claude Code) |
| **Depth** | Standard |

### References

| Ref | Document | Location |
|-----|----------|----------|
| C1 | Product Requirements | `docs/prd.md` |
| C2 | UX/UI Design | `docs/ux-ui/design.md` |
| C3 | Technical Requirements | `docs/trd/trd.md` |
| C4 | Proposal (approved) | `docs/specs/changes/country-document-match-validation/proposal.md` |
| C5 | Prior scoping decision | `docs/specs/archive/2026-07-29-enhancements--multi-country-enablement/requirements.md:368` |

---

## 2. Executive Summary

The gap detector already extracts a `country_of_operation` field from uploaded business plans via an LLM pass, but nothing compares it to the country the Analyst selected when creating the assessment. This spec adds a **non-blocking** confirmation dialog on the "Analyze Risks" click: if the AI-detected country differs from the selected one, the Analyst sees both names and can continue or cancel. Nothing about the existing gap-completion gating, risk-analysis trigger, or country-immutability rule changes — this is a warning layer in front of an already-working flow.

## 3. Glossary

| Term | Meaning |
|------|---------|
| `Assessment.country` | The country selected at assessment creation, from the 4-country allowlist (Kenya, Ethiopia, Nigeria, Zambia). Editable only while `Assessment.status = DRAFT`. |
| `detectedCountry` | New field: the AI's best guess at the country the uploaded business plan describes. **(Revised 2026-08-19, BR-CMV-001/DD-CMV-007 — corrected here after a Reviewer caught this row was missed by the original correction-closure sweep):** the AI response value can be *any* country name (not limited to the 4 supported ones) or the literal `"unclear"`. The persisted `Assessment.detectedCountry` column holds that country-name string as-is, or `null` — `"unclear"` and anything failing the confidence/length gate (see design.md §6.2) normalize to `null`; being outside the 4-country allowlist is no longer, by itself, a reason to normalize to `null`. |
| Core-10 fields | The 10 mandatory business fields the gap detector classifies per assessment, including `country_of_operation`. |
| Mismatch | `detectedCountry` is a confidently-detected, non-empty country string (**any country, not limited to the 4 supported ones — revised 2026-08-19**) **and** differs from `Assessment.country`. `"unclear"` and `null` are never a mismatch. |
| ACTION_REQUIRED | `Assessment.status` value while the Analyst is reviewing gap fields (set once gap detection completes). |

## 4. System Context & Scope

### In scope

- Extending the gap-detection AI response with a top-level `detectedCountry` value.
- Persisting it on `Assessment` (new nullable column, 1 migration).
- A confirmation dialog on "Analyze Risks" click when a mismatch exists.
- A persistent, dismissible hint after "Cancel" pointing to the two manual remediation paths.
- Re-detection whenever gap detection re-runs (document replacement, re-analyze).

### Out of scope

- Editing `Assessment.country` from the gap-detector screen (stays DRAFT-only — no change to `assessments.service.ts:105-109`).
- A static city → country lookup table.
- Any new Bedrock invocation, new API endpoint, or new React Query hook.
- Changes to `allMandatoryComplete`, the Core-10 field contract, or risk scoring.
- Guided-interview / manual-entry intake modes (they skip Bedrock entirely and are unaffected).

## 5. Stakeholders / Personas

| Persona | Relevance |
|---------|-----------|
| **Risk Analyst** (primary) | Sees the dialog/hint; decides whether to continue or fix the mismatch. |
| **System** (AI pipeline) | Produces `detectedCountry` as part of the existing gap-detection job. |
| **Platform Administrator** | No direct interaction; the prompt they can already edit via seed/admin tooling gains one more instruction. |

## 6. Functional Requirements

### FR-CMV-001: Detect And Normalize The Business-Plan Country

**Priority:** Must
**Persona:** System

**Description:** During gap detection (initial run and re-analyze), the system SHALL determine the primary country described in the uploaded business plan documents and return it as a top-level `detectedCountry` value — **any country the AI can confidently name, not limited to the 4 supported countries** — or `"unclear"` if it cannot, gated on the same confidence bar already used for Core-10 `VERIFIED` classification (≥ 0.7).

**Revised 2026-08-19, post-`/akili-validate`, discovered during the user's own manual browser testing before archiving:** the original version of this requirement restricted `detectedCountry` to the 4 supported countries (Kenya, Ethiopia, Nigeria, Zambia), normalizing anything else — including a real, confidently-detected country like Malawi — to `null`. Manual testing showed this defeats the feature's own purpose: a business plan describing an *unsupported* country is exactly the case a mismatch check should catch, arguably more so than a mix-up between two supported countries. The restriction is removed; see BR-CMV-001's revised definition and design.md §6.2/§6.3/§7 for the corresponding implementation change (DD-CMV-007).

#### Scenario 1: Confident detection of any country

- **GIVEN** an UPLOAD-mode assessment whose business plan clearly describes operations in Zambia
- **WHEN** gap detection runs
- **THEN** the AI response includes `detectedCountry: "Zambia"`
- **AND IT MUST** persist this value on `Assessment.detectedCountry`

#### Scenario 1b: Confident detection of a country outside the 4-country allowlist

- **GIVEN** an UPLOAD-mode assessment whose business plan clearly describes operations in Malawi (not one of the 4 supported countries)
- **WHEN** gap detection runs
- **THEN** the AI response includes `detectedCountry: "Malawi"` at confidence ≥ 0.7
- **AND IT MUST** persist `"Malawi"` on `Assessment.detectedCountry` — **it must NOT** be normalized to `null` or `"unclear"` merely because it isn't one of the 4 supported countries

#### Scenario 2: Low-confidence or unstated country

- **GIVEN** a business plan that never clearly states an operating country (e.g., only a city, or no location at all)
- **WHEN** gap detection runs
- **THEN** `detectedCountry` is `"unclear"`
- **AND IT MUST NOT** be treated as a mismatch signal downstream
- **BUT it must NOT** block gap detection or Core-10 field extraction from completing

#### Scenario 3: Non-upload intake modes are unaffected

- **GIVEN** an assessment using `GUIDED_INTERVIEW` or `MANUAL_ENTRY` intake mode (no Bedrock call in gap detection)
- **WHEN** gap detection creates skeleton fields
- **THEN** `Assessment.detectedCountry` remains `null`
- **AND IT MUST NOT** trigger any downstream country comparison

---

### FR-CMV-002: Confirmation Dialog On Country Mismatch

**Priority:** Must
**Persona:** Analyst

**Description:** When the Analyst clicks "Analyze Risks" and `Assessment.detectedCountry` is a confidently-detected country (any country, not limited to the 4 supported ones — **revised 2026-08-19**) that differs from `Assessment.country`, the system SHALL show a confirmation dialog before any submit request, naming both countries and stating the check is non-blocking.

#### Scenario 1: Mismatch triggers the dialog (both supported countries)

- **GIVEN** `Assessment.country = "Kenya"` and `Assessment.detectedCountry = "Zambia"`
- **WHEN** the Analyst clicks "Analyze Risks"
- **THEN** a confirmation dialog appears before any network request fires
- **AND IT MUST** name both "Kenya" and "Zambia", each with its flag (via `CountryBadge`/`getCountryFlag()`)
- **AND IT MUST** state the check does not block analysis

#### Scenario 1b: Mismatch triggers the dialog even when the detected country isn't one of the 4 supported ones

- **GIVEN** `Assessment.country = "Nigeria"` and `Assessment.detectedCountry = "Malawi"` (Malawi is not one of the 4 supported countries)
- **WHEN** the Analyst clicks "Analyze Risks"
- **THEN** the confirmation dialog still appears — the mismatch check does not exempt unsupported detected countries
- **AND IT MUST** name both "Nigeria" (with its flag) and "Malawi" (as plain text — `getCountryFlag()` returns an empty string for countries outside the 4-country allowlist, which is an accepted, already-graceful degradation, not an error state)

#### Scenario 2: Match or absent detection skips the dialog

- **GIVEN** `Assessment.detectedCountry` is `"Kenya"` (matches) or `null` (covers both an AI response of `"unclear"` and a below-confidence-threshold response — normalized to `null` before persistence, per BR-CMV-001)
- **WHEN** the Analyst clicks "Analyze Risks"
- **THEN** no dialog appears
- **AND** the existing submit flow proceeds exactly as it does today
- **BUT it must NOT** add any delay or extra network round-trip versus current behavior

---

### FR-CMV-003: "Continue Anyway" Preserves The Existing Submit Flow

**Priority:** Must
**Persona:** Analyst

**Description:** Confirming the dialog SHALL invoke the exact same submit request the app makes today with no mismatch present, with no additional payload or side effect.

#### Scenario 1: Confirm behaves identically to the no-mismatch path

- **GIVEN** the mismatch dialog is showing
- **WHEN** the Analyst clicks "Continue anyway"
- **THEN** the client calls `POST /api/assessments/:id/gap-fields/submit` exactly as `handleAnalyzeRisks` does today
- **AND** on success the Analyst is routed to `/assessments/risk-scorecard?id=...`
- **AND** on rejection (invalid fields) the existing amber validation banner and "Needs Attention" filter behavior are unaffected
- **AND IT MUST NOT** re-trigger gap detection or alter `Assessment.detectedCountry`

---

### FR-CMV-004: "Cancel" Is A Pure No-Op

**Priority:** Must
**Persona:** Analyst

**Description:** Declining the dialog SHALL close it and leave the assessment's state, gap fields, and status completely unchanged.

#### Scenario 1: Cancel produces zero side effects

- **GIVEN** the mismatch dialog is showing
- **WHEN** the Analyst clicks "Cancel"
- **THEN** the dialog closes
- **AND IT MUST NOT** call `POST /gap-fields/submit`, `POST /gap-fields/re-analyze`, or any assessment-mutating endpoint
- **AND** `Assessment.status` remains `ACTION_REQUIRED`
- **BUT it must NOT** navigate the Analyst away from the gap detector screen

#### Scenario 2: Dialog reappears on every subsequent attempt while unresolved

- **GIVEN** the Analyst previously clicked "Cancel" on the mismatch dialog for this assessment
- **WHEN** the Analyst clicks "Analyze Risks" again without the underlying mismatch having changed
- **THEN** the confirmation dialog appears again
- **AND IT MUST NOT** be permanently suppressed for that assessment or session

---

### FR-CMV-005: Persistent Remediation Hint After Cancel

**Priority:** Should
**Persona:** Analyst

**Description:** After the Analyst cancels, the gap detector screen SHOULD surface a dismissible hint (reusing the existing amber-banner visual pattern) suggesting the two manual remediation paths: replacing the business plan, or starting a new assessment with the correct country.

#### Scenario 1: Hint appears and is dismissible

- **GIVEN** the Analyst just clicked "Cancel" on the mismatch dialog
- **WHEN** the gap detector screen re-renders
- **THEN** a dismissible amber hint banner appears, naming both countries and both remediation options
- **AND IT MUST NOT** trigger either remediation action automatically
- **BUT it must NOT** block interaction with the rest of the gap detector screen

---

### FR-CMV-006: Country Re-Detection Follows Document Changes

**Priority:** Must
**Persona:** System

**Description:** Replacing/adding a document and triggering gap re-analysis SHALL re-run country detection so `Assessment.detectedCountry` reflects the current document set.

#### Scenario 1: Replacing the document clears a stale mismatch

- **GIVEN** a prior gap-detection run set `Assessment.detectedCountry = "Zambia"` while `Assessment.country = "Kenya"`
- **WHEN** the Analyst replaces the business plan with one describing Kenya and triggers re-analysis
- **THEN** the next completed gap-detection run updates `Assessment.detectedCountry` to `"Kenya"`
- **AND IT MUST** cause the mismatch dialog to stop appearing on subsequent "Analyze Risks" clicks

## 7. Non-Functional Requirements

### NFR-CMV-010: Zero Added Bedrock Invocations

The detection SHALL be derived from the existing gap-detection Bedrock call — no additional model invocation, no added per-assessment latency or cost beyond a marginally larger prompt/response.

- **GIVEN** gap detection runs
- **WHEN** Bedrock is invoked
- **THEN** exactly one `BedrockService.invokeModel` call occurs for gap detection (unchanged from today)
- **AND IT MUST NOT** add a second call for country detection

### NFR-CMV-011: Fail-Quiet On Uncertain Or Failed Detection

If country detection is uncertain, absent, or the underlying Bedrock call fails, the system SHALL default to "no mismatch" — never a false-positive dialog.

- **GIVEN** the gap-detection Bedrock call fails (existing catch block, `createErrorFields`)
- **WHEN** error fallback fields are created
- **THEN** `Assessment.detectedCountry` remains `null`
- **AND IT MUST NOT** show a dialog for that run

### NFR-CMV-012: No Regression To Mandatory-Field Gating

`allMandatoryComplete` and the "Analyze Risks" button's enabled/disabled state SHALL be computed exactly as today; this feature affects only what happens *after* the button is clicked, never before.

- **Correction (Judgment Day, design.md review, round 2):** `gap-field.controller.spec.ts` mocks `GapDetectionService` entirely (`allMandatoryComplete: false` is a literal in the mock fixture) — it proves the controller wires up correctly, but it does **not** and cannot exercise the real `allMandatoryComplete` computation in `gap-detection.service.ts`. This spec's diff never touches `gap-detection.service.ts`, so NFR-CMV-012 is protected **structurally** (no line in the file that computes it changes), not by an automated regression gate with the power to fail if it were somehow violated. No dedicated `gap-detection.service.spec.ts` exists in this repo today (KZ-003 compliance — verified by reading the file directly, not assumed).

## 8. Business Rules

| ID | Rule |
|----|------|
| BR-CMV-001 | **(Revised 2026-08-19)** A mismatch exists **iff** `detectedCountry` is a non-empty, confidently-detected country string (≥ 0.7 confidence, per BR-CMV-003) — **any country, not limited to the 4-country `SUPPORTED_COUNTRY_LABELS` allowlist** — **and** `detectedCountry !== Assessment.country`. `"unclear"` and `null` are never a mismatch. *Originally scoped to the 4 supported countries only; widened after manual testing showed the original scoping defeated the feature's purpose — a business plan describing an unsupported country is exactly the case this check exists to catch.* |
| BR-CMV-004 | *(New 2026-08-19)* Displaying a `detectedCountry` outside the 4-country allowlist SHALL degrade gracefully: the country's plain name with no flag (`getCountryFlag()`'s existing empty-string return for unrecognized values), never an error or blank space where the name should be. |
| BR-CMV-002 | `Assessment.country` immutability outside `DRAFT` (`assessments.service.ts:105-109`) is unchanged — this feature introduces no new mutation path for `country`. |
| BR-CMV-003 | The confidence bar for `detectedCountry` reuses the existing ≥ 0.7 threshold already defined for Core-10 `VERIFIED` classification. No separate threshold is introduced. |

## 9. Dependencies & Assumptions

**Dependencies**
- The existing gap-detection Bedrock call, active `gap_detector` prompt, and `useAssessment(id)` hook (already loads `Assessment.country` on the gap-detector screen).
- `packages/shared` must be rebuilt before API/Web pick up any shared-type changes (standard project convention; not expected to be needed here since no new shared enum/type is introduced — `detectedCountry` is a plain string field consumed directly via the existing `AssessmentDetail` type extension).

**Assumptions**
- The LLM can infer a country from business-plan text with reliability comparable to its existing `country_of_operation` field classification — no new model capability is required, same model/section (`BEDROCK_MODELS[AgentSection.GAP_DETECTOR]`).
- ~~The 4-country allowlist (`SUPPORTED_COUNTRY_LABELS`) does not change during this spec's implementation.~~ **Superseded 2026-08-19:** `SUPPORTED_COUNTRY_LABELS` itself is unchanged (still governs `Assessment.country`'s own allowlist and flag rendering), but `detectedCountry` is no longer validated against it — see BR-CMV-001's revision.

## 10. Defect Class → Verification Mapping

| Defect class | Caught by |
|---|---|
| Malformed/missing `detectedCountry` in the AI response breaks existing Core-10 field parsing | Unit test in `gap-detection.handler.spec.ts` — malformed/absent `detectedCountry` key must not throw and must not affect `fields` parsing |
| Wrong persistence/normalization of a valid `detectedCountry` value | Unit test asserting `Assessment.detectedCountry` after a mocked Bedrock response |
| Dialog shown/hidden incorrectly (comparison logic bug) | Frontend unit test (Testing Library) covering match / mismatch / unclear / null combinations of `assessment.country` × `assessment.detectedCountry` |
| "Continue anyway" diverges from the existing no-mismatch submit path | Existing `gap-field.controller.spec.ts` `triggerRiskAnalysis` tests continue passing unmodified + new frontend test asserting the same `apiClient.post` call fires |
| "Cancel" triggers an unintended network call or status change | Frontend test asserting zero `apiClient` calls fire after clicking Cancel (mocked client) |
| Regression to `allMandatoryComplete` / mandatory-field gating | Not directly test-covered (`gap-field.controller.spec.ts` mocks the service and cannot exercise this computation) — protected structurally, since this spec's diff never touches `gap-detection.service.ts` |
| Schema/migration breaks Prisma client generation or other `Assessment` consumers | `pnpm --filter @alliance-risk/api build` + existing API test suite |
| **LLM misclassifies the country on real documents (false positive/negative)** | **No automated check exists for this** — LLM output correctness on real-world text is not unit-testable. **Accepted risk**, mitigated by the ≥0.7 confidence gate (NFR-CMV-011) and the dialog's copy explicitly allowing for legitimate multi-country mentions. Recommend manual QA against a handful of real business plans per supported country before this ships to Analysts, per `docs/testing/analyst-test-protocol.md` conventions. |
| **Dialog accessibility/visual correctness (focus trap, contrast, Escape-to-close)** | **Not verifiable via `jsdom`/Jest.** Substitute: this reuses the existing shadcn `Dialog` primitive, which already provides focus-trap and Escape-to-close by default and is covered by the project's general WCAG 2.1 AA target (`docs/ux-ui/design.md` §10). No new visual pattern is introduced, so a dedicated T6 visual review is not warranted — recorded here as an accepted risk should the primitive itself regress. |

## 11. Open Questions

| # | Question | Status |
|---|----------|--------|
| OQ-CMV-01 | Is the 0.7 confidence threshold actually well-calibrated for country detection specifically (vs. the other 9 Core-10 fields it was tuned for)? | Open — recommend revisiting after real-world usage data; not blocking for MVP since it reuses an already-accepted bar. |

## 12. Requirement ID Index

| ID | Title | Priority |
|----|-------|----------|
| FR-CMV-001 | Detect And Normalize The Business-Plan Country | Must |
| FR-CMV-002 | Confirmation Dialog On Country Mismatch | Must |
| FR-CMV-003 | "Continue Anyway" Preserves The Existing Submit Flow | Must |
| FR-CMV-004 | "Cancel" Is A Pure No-Op | Must |
| FR-CMV-005 | Persistent Remediation Hint After Cancel | Should |
| FR-CMV-006 | Country Re-Detection Follows Document Changes | Must |
| NFR-CMV-010 | Zero Added Bedrock Invocations | Must |
| NFR-CMV-011 | Fail-Quiet On Uncertain Or Failed Detection | Must |
| NFR-CMV-012 | No Regression To Mandatory-Field Gating | Must |
| BR-CMV-001 | Mismatch definition (revised — any country, not just the 4 supported) | — |
| BR-CMV-004 | Graceful display fallback for unsupported detected countries | — |
| BR-CMV-002 | Country immutability unchanged | — |
| BR-CMV-003 | Shared confidence threshold | — |
