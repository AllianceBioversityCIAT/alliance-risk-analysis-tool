# Proposal — Country / Business-Plan Mismatch Validation

## 1. Document Control

| Field | Value |
|-------|-------|
| **Module** | `changes/country-document-match-validation` |
| **Project** | CGIAR Risk Intelligence Tool |
| **Version** | 1.0 |
| **Date** | 2026-08-18 |
| **Author** | Daniela Gómez (via Claude Code) |
| **Type** | Change |
| **Approval Mode** | gated |
| **Slug** | `country-document-match-validation` — matches the pre-existing empty spec folder; not derived from free text |

### References

| Ref | Document | Location |
|-----|----------|----------|
| C1 | Product Requirements | `docs/prd.md` |
| C2 | UX/UI Design | `docs/ux-ui/design.md` |
| C3 | Technical Requirements | `docs/trd/trd.md` |
| C4 | Prior scoping decision | `docs/specs/archive/2026-07-29-enhancements--multi-country-enablement/requirements.md:368` |

---

## 2. Intent

Warn the user — without blocking them — when the country selected at assessment creation (`Assessment.country`) doesn't match the country the uploaded business plan actually appears to describe. Today nothing checks this; a mismatch silently flows into risk analysis, which uses `Assessment.country` to calibrate regulatory, market, and climate risk factors that may not fit the business described in the document.

## 3. Problem / Current Behavior

- `Assessment.country` is chosen once, at creation, from a 4-country allowlist (Kenya, Ethiopia, Nigeria, Zambia) — see `packages/shared/src/constants/supported-countries.ts`.
- The gap detector already extracts a `country_of_operation` field from the uploaded documents via an LLM pass (`packages/api/src/platform/jobs/handlers/gap-detection.handler.ts`, prompt seeded in `packages/api/prisma/seed.ts:46-93`), but this value is **never compared** to `Assessment.country`.
- The prior `enhancements/multi-country-enablement` spec explicitly scoped this reconciliation out: *"`Assessment.country` is the program context for filtering and AI injection. Gap field `country_of_operation` remains document-derived and independent."* (`docs/specs/archive/2026-07-29-enhancements--multi-country-enablement/requirements.md:368`)
- Result: a user can select "Kenya" while uploading a business plan for a Zambian enterprise, and nothing surfaces the discrepancy before risk scores are generated.

## 4. Proposed Outcome

When the user clicks **"Analyze Risks"** on the gap detector screen and the AI-detected country of the uploaded documents differs from the selected `Assessment.country`, show a **confirmation dialog** (not a passive banner) that:

1. Names both countries explicitly.
2. Explains this is a non-blocking heads-up, not an error.
3. Lets the user **Continue anyway** (proceeds exactly as today) or **Cancel** (stays on the gap detector, no side effects).

No existing gate (`allMandatoryComplete`, field validation, risk-analysis job creation) changes. This is a purely additive confirmation step in front of an already-working flow.

## 5. Scope

- Extend the gap-detector Bedrock prompt to also return a normalized, top-level `detectedCountry` value (one of the 4 supported countries, or `"unclear"`).
- Persist that value on `Assessment` (new nullable column).
- Compare it to `Assessment.country` and, on mismatch, show a confirmation dialog before calling the existing `POST /gap-fields/submit` flow.
- "Cancel" is a pure client-side no-op — no API call, no status change, no re-trigger of gap detection.
- Draft the exact dialog and hint copy (see §9).

## 6. Non-Goals

- **No editing of `Assessment.country` from the gap-detector screen.** That would require relaxing the DRAFT-only guard in `packages/api/src/domain/assessments/assessments.service.ts:105-109` (`BadRequestException` today if `dto.country` is set outside `DRAFT`). Explicitly rejected during design discussion — country stays locked once the assessment leaves `DRAFT`.
- **No static city → country lookup table.** Rejected as brittle (incomplete coverage, ambiguous city names, typos) in favor of reusing the LLM pass gap detection already runs.
- **No new Bedrock call.** The detection piggybacks on the existing gap-detection invocation — zero added latency or cost beyond a slightly larger prompt/response.
- **No change to `allMandatoryComplete`, the Core-10 field contract, or risk scoring logic.**
- Remediation when the user declines is manual and outside this feature's automation: replace the business plan (already re-triggers gap detection) or start a new assessment with the correct country (only possible in `DRAFT`).

## 7. Affected Users, Systems, And Specs

| Area | Impact |
|------|--------|
| **Persona** | Analyst (assessment creator/reviewer) |
| `packages/api/src/platform/jobs/handlers/gap-detection.handler.ts` | Parse a new top-level `detectedCountry` key from the Bedrock response; persist it on `Assessment` |
| `packages/api/prisma/seed.ts` (gap_detector prompt) | Add `detectedCountry` instruction to system prompt + output schema; new prompt version per existing versioning convention |
| `packages/api/prisma/schema.prisma` | New nullable `Assessment.detectedCountry String?` column — 1 migration |
| `packages/web/.../gap-detector-client.tsx` | `handleAnalyzeRisks()` (line 196) gains a pre-check + confirmation `Dialog` before its existing `apiClient.post(.../submit)` call |
| `packages/shared/src/constants/supported-countries.ts` | Read-only reference — normalization target, no changes needed |
| `docs/specs/archive/2026-07-29-enhancements--multi-country-enablement/` | Historical context — this proposal fulfills the reconciliation that spec deliberately deferred |

## 8. Visual Reference

- Source: None
- Location: n/a
- Notes: This is a single shadcn/ui `Dialog` (already used elsewhere in `packages/web/src/components/ui/dialog.tsx`) with two buttons, plus an optional persistent hint reusing the existing amber alert-banner pattern already on this screen (`gap-detector-client.tsx:645-665`, the validation-rejection banner). No new visual language is introduced, so a mockup isn't needed — the drafted copy in §9 is enough for `/akili-specify` to work from. Happy to generate one via `stitch-design` if you'd rather see it visually first.

## 9. Requirement Delta Preview

### ADDED Requirements

- Gap-detector prompt returns a top-level `detectedCountry: "Kenya" | "Ethiopia" | "Nigeria" | "Zambia" | "unclear"`, gated on the same confidence bar the prompt already uses for `VERIFIED` classification (≥ 0.7) — reuses existing semantics instead of inventing a new confidence scale.
- `Assessment.detectedCountry` (nullable) persists the raw value from every gap-detection run (initial and re-analyze), so it naturally refreshes when the user replaces the business plan.
- On "Analyze Risks" click, if `detectedCountry` is a supported country **and** differs from `Assessment.country`, show a confirmation dialog before the existing submit call.
- Dialog "Continue anyway" → proceeds exactly as if there were no mismatch (calls the existing submit flow unchanged).
- Dialog "Cancel" → closes the dialog only. No API call, no status change, no re-analysis trigger.
- A dismissible, persistent hint (reusing the existing amber-banner visual pattern) remains after Cancel, suggesting the two manual remediation paths.
- The dialog re-appears every time the user clicks "Analyze Risks" while the mismatch persists (no permanent dismissal) — flagged as an assumption to confirm in `requirements.md`.

### MODIFIED Requirements

- `gap_detector` prompt (system prompt + output JSON schema) — additive field, new prompt version.
- `GapDetectionHandler.processUploadMode()` — one new field to parse and persist; unaffected when `intakeMode !== 'UPLOAD'` (guided interview / manual entry skip Bedrock, so `detectedCountry` stays `null`).
- `handleAnalyzeRisks()` in `gap-detector-client.tsx` — wraps the existing call with a pre-check; the existing call itself is untouched.

### REMOVED Requirements

- None.

## 10. Approach Options

### Option A — Extend existing gap-detection response + new `Assessment` column (Recommended)

Add one top-level `detectedCountry` key to the JSON the gap-detector prompt already returns (outside the `fields` array, so the existing Core-10 field parsing is untouched), persist it on `Assessment`, and derive the mismatch client-side from data the gap-detector screen already fetches (`useAssessment`).

- **Pros:** No new Bedrock call, no new API endpoint, no new React Query hook — the screen already loads `assessment.country` and can load `assessment.detectedCountry` from the same response. One nullable column, one prompt version bump.
- **Cons:** Couples country detection to the gap-detection job's cadence (only refreshes on initial run or re-analyze/document replacement) — acceptable, since that's also when the underlying documents can change.

### Option B — Add country-specific columns to `GapField`

Store `documentDetectedCountry` / `countryMismatch` directly on the `GapField` row for `country_of_operation`.

- **Pros:** Keeps the concept scoped to "the field it's about."
- **Cons:** `GapField` is a generic model shared by all 10 fields — adding columns meaningful to exactly one field is a schema smell, and every consumer of `GapField` would need to know to ignore them for the other 9 rows.

### Option C — New dedicated consistency-check table/endpoint

A standalone `AssessmentConsistencyCheck` model with its own endpoint.

- **Pros:** Most "extensible" if more cross-field checks are added later.
- **Cons:** Over-engineered for one boolean-ish comparison; new endpoint, new hook, new migration for something Option A gets with a single column. No second consistency check is currently planned.

## 11. Recommended Approach

**Option A.** It reuses infrastructure that already exists end-to-end (the gap-detection Bedrock call, the `useAssessment` hook, the amber-banner visual pattern, the `Dialog` component), adds exactly one migration and one prompt version, and requires no new endpoints or hooks. It's the smallest safe path that still fully satisfies the non-blocking, detailed-messaging requirement.

## 12. Risks, Dependencies, And Open Questions

**Risks**
- LLM misclassification of `detectedCountry` (false positive mismatch, or false negative — misses a real mismatch). Mitigated by gating on the existing ≥0.7 confidence bar and defaulting to `"unclear"` (no dialog shown) when uncertain — fail-quiet, not fail-loud.
- If a business plan legitimately discusses multiple countries (e.g., regional operations, export markets), the model could flag a false mismatch. The dialog copy explicitly accounts for this ("if the document simply references other locations...").

**Dependencies**
- Depends on: none (self-contained; reuses existing gap-detection job and screen).
- Parallel-safe: yes — no shared modules, migrations, or API contracts with any other active spec.

**Open Questions — resolved (2026-08-18, user-approved)**
1. **UI language: English.** Confirmed — dialog and hint copy stay in English, matching the rest of the app's UI.
2. **Re-prompt behavior: every click.** Confirmed — the dialog reappears every time "Analyze Risks" is clicked while the mismatch remains unresolved. No permanent dismissal.
3. **Confidence threshold: reuse the existing 0.7 `VERIFIED` bar.** Confirmed — no separate threshold for `detectedCountry`.

## 13. Draft Copy (for `/akili-specify` to formalize)

**Dialog title:** Double-check the country before continuing

**Dialog body:**
> You selected **{{assessmentCountry}}** {{flag}} when this assessment was created, but the uploaded business plan appears to describe operations in **{{detectedCountry}}** {{flag}}. Country context shapes the regulatory, market, and climate risk factors used in the analysis, so a mismatch here can affect how accurate the results are.
>
> This is just a heads-up — it won't block your analysis. Continue if the selected country is correct and the document simply references other locations (branches, suppliers, export markets, etc.). Otherwise, cancel to review the document or start a new assessment with the correct country.

**Buttons:** `Cancel` (secondary) · `Continue anyway` (primary)

**Persistent hint after Cancel** (amber banner, same visual family as the existing validation-rejection banner):
> Heads-up: the country detected in your business plan ({{detectedCountry}}) doesn't match the selected country ({{assessmentCountry}}). If this looks wrong, replace the document from **Manage Documents** or start a new assessment with the correct country. Risk analysis won't start until you confirm how to proceed.

## 14. Success Criteria

- A business plan describing a different country than `Assessment.country` triggers the confirmation dialog on "Analyze Risks" click, with both country names correctly populated.
- Clicking "Continue anyway" produces byte-identical behavior to today's flow (verified by the existing gap-fields submit tests continuing to pass unmodified).
- Clicking "Cancel" results in zero network calls beyond closing the dialog, and the assessment status remains `ACTION_REQUIRED`.
- No regression to `allMandatoryComplete` gating or the Core-10 field contract.
- Guided-interview and manual-entry assessments (which skip Bedrock entirely) are unaffected — no dialog ever appears for them.

## 15. Next Step

```text
/akili-specify changes/country-document-match-validation
```
