# Design — Country / Business-Plan Mismatch Validation

## 1. Document Control

| Field | Value |
|-------|-------|
| **Module** | `docs/specs/changes/country-document-match-validation` |
| **Requirements ref** | `requirements.md` |
| **Version** | 1.0 |
| **Date** | 2026-08-18 |

## 2. Executive Summary

Extend the existing gap-detection Bedrock call with one additional top-level JSON key, `detectedCountry`. Persist it on `Assessment` (one nullable column, no whitelisting mapper to update — `findOne()` returns the raw Prisma object). Compare it to `Assessment.country` client-side and show a confirmation `Dialog` before the existing "Analyze Risks" submit call fires. No new endpoint, no new hook, no new Bedrock invocation. Covers FR-CMV-001 through FR-CMV-006, NFR-CMV-010/011/012.

## 3. Architecture Overview

```
Existing flow (unchanged):
  gap-detector-client.tsx ── click "Analyze Risks" ──▶ POST /gap-fields/submit ──▶ risk-scorecard

New flow (additive):
  gap-detector-client.tsx ── click "Analyze Risks"
        │
        ▼
  countryMismatch = detectedCountry is a supported country AND detectedCountry !== assessment.country
        │
        ├── false/null/"unclear" ──▶ proceedToRiskAnalysis()  (existing behavior, byte-identical)
        │
        └── true ──▶ show <CountryMismatchDialog>
                        ├── "Continue anyway" ──▶ proceedToRiskAnalysis()
                        └── "Cancel" ──▶ close dialog + show persistent hint banner (no API call)
```

**Entry points touched:**
- `packages/api/src/platform/jobs/handlers/gap-detection.handler.ts` — `processUploadMode()` (existing job handler, no new job type)
- `packages/api/prisma/seed.ts` — `gap_detector` prompt content (existing prompt section, no new `AgentSection`)
- `packages/web/.../gap-detector/gap-detector-client.tsx` — existing page, no new route

No new job types, no new controllers, no new pages.

## 4. Data Model Changes

**Prisma schema** (`packages/api/prisma/schema.prisma`) — one new nullable column on `Assessment`, placed next to the existing `country` field:

```prisma
model Assessment {
  ...
  country         String           @default("Kenya") @db.VarChar(100)
  detectedCountry String?          @map("detected_country") @db.VarChar(100)
  ...
}
```

**Migration:** required (1 new nullable column, additive — no backfill needed since `null` is the correct default for every existing row). Follow the project's standard dev migration flow (`prisma migrate dev`) and the documented remote path (`pnpm migrate:remote`) for staging/prod — no new migration tooling needed.

**Job result JSON:** unchanged. `GapDetectionResult` (handler.ts:18-24) does not need `detectedCountry` — it's persisted directly to `Assessment` inside the handler, not surfaced through the job's `result` payload (consistent with how the handler already writes `Assessment.status`/`progress` directly rather than through the job result).

**Scope amendment note (added post-`/akili-validate`, WARN-2):** because `detectedCountry` is a **required** (non-optional) field on `AssessmentDetail`, three pre-existing files that manually construct `AssessmentDetail`-shaped object literals also needed a one-line addition each (`detectedCountry: assessment.detectedCountry,` / `detectedCountry: null,`) to keep compiling — `packages/api/src/domain/report/report.service.ts`, `packages/api/src/platform/jobs/handlers/report-generation.handler.ts`, and their shared fixture in `packages/api/src/domain/report/pdf.service.spec.ts`. This was a Leader-flagged, user-approved scope amendment to T-001 during `/akili-execute` (see `execution.md`'s T-001 entry and `tasks.md`'s T-001 status line), not a change to this section's original design intent.

**Shared type:** `packages/shared/src/types/assessment.types.ts` — add one field to `AssessmentDetail`:

```ts
export interface AssessmentDetail extends AssessmentSummary {
  companyType: string | null;
  country: string;
  detectedCountry: string | null;
  createdAt: string;
}
```

No new enum needed — `detectedCountry` is `SupportedCountryLabel | null` (**correction:** the literal string `"unclear"` is never persisted — see §6.2 — only a value from `SUPPORTED_COUNTRY_LABELS` or `null` ever reaches the database), validated at the point it's written (handler), not via a DB-level enum constraint. This keeps the migration additive and avoids an enum migration for a value with an already-validated, narrower source: the handler only ever writes one of `SUPPORTED_COUNTRY_LABELS` or `null`.

## 5. API Surface

**No new endpoints.** `GET /api/assessments/:id` (existing route, `assessments.controller.ts`) already returns the raw Prisma `Assessment` row from `AssessmentsService.findOne()` (`assessments.service.ts:84-89`) with no field-whitelisting mapper — once the column exists, `detectedCountry` flows through this response automatically. The only change needed is the shared TypeScript type (§4) so the frontend's `useAssessment(id)` hook is correctly typed.

No DTO changes: `UpdateAssessmentDto` is untouched — `detectedCountry` is never client-writable, only handler-written, so no validation decorator or mutation path is added for it (reinforces BR-CMV-002: no new way to affect country-related fields is introduced for the Analyst).

## 6. Backend Logic

### 6.1 `GapDetectionAIResponse` interface (`gap-detection.handler.ts:42-44`)

Add two optional top-level fields — the country string, and a **confidence value the handler enforces itself** rather than trusting the prompt alone (closes JD-05 / BR-CMV-003):

```ts
interface GapDetectionAIResponse {
  fields: GapDetectionAIField[];
  detectedCountry?: string | null;
  detectedCountryConfidence?: number; // 0.0–1.0, transient — not persisted, gates normalization below
}
```

The existing 5-strategy defensive JSON parser (`parseAIResponse`, lines 297-336) needs no changes — it already returns the full parsed object; both new keys just ride along whether present or not.

### 6.2 Persisting the detection — fold into the existing status update, not a new write inside the Bedrock try/catch

**This is the fix for JD-01/JD-02/JD-21** (Judgment Day round 1: both judges independently found that a new `prisma.assessment.update()` placed inside `processUploadMode()`'s existing Bedrock `try` block, handler.ts:194-234, would let a transient persistence failure fall into the `catch` at line 222 — which calls `createErrorFields()` and overwrites all 10 already-extracted Core-10 fields to `MISSING`. Rather than isolating a *new* write with its own try/catch inside that method, the better fix is to not add a new write there at all).

`execute()` (handler.ts:55-100) already performs exactly one `Assessment` write **after** `processUploadMode()`/the skeleton-field branch has already fully resolved (success or internally-recovered failure) — the existing status/progress update at handler.ts:85-88:

```ts
await this.prisma.assessment.update({
  where: { id: input.assessmentId },
  data: { status: 'ACTION_REQUIRED', progress: 50 },
});
```

**Design:** in `execute()` (handler.ts:55-100), declare `let detectedCountry: string | null = null;` at the top, in the same place `bedrockTokensUsed`/`mergedMarkdown` are already declared (handler.ts:70-71) — **this explicit initializer is required** (round-2 re-judgment finding, both judges independently: without it, non-UPLOAD branches would pass `undefined` rather than `null`, and Prisma treats an `undefined` field as "leave unchanged," silently defeating the null-clearing behavior in points 3–4 below on any path that forgets to set it). Extend `processUploadMode()`'s private return type (handler.ts:108, currently `{ tokensUsed: number; mergedMarkdown: string }`) with a third field, `detectedCountry: string | null`, computed as follows and returned — never persisted directly by `processUploadMode()` itself:

1. On a successful Bedrock parse: normalize `parsed.detectedCountry` — it counts only if it's one of `SUPPORTED_COUNTRY_LABELS` (checked via the already-exported `isSupportedCountry()`, not a hand-rolled string comparison) **and** `parsed.detectedCountryConfidence >= 0.7`; anything else (missing key, hallucinated string, wrong type, low confidence, or the literal `"unclear"`) becomes `null` — fail-quiet per NFR-CMV-011. **Log a single `logger.debug()` line whenever this normalization rejects a value** (e.g. "detectedCountry rejected: value=X confidence=Y") — without it, a silently-inert feature (e.g. an Admin's §6.4 edit omitted `detectedCountryConfidence` from the Output Format example, so every response fails the confidence gate) has no diagnostic trail at all.
2. On Bedrock failure during **any** run that reaches the existing `createErrorFields()` catch (handler.ts:222-234, applies whether this is the assessment's first gap-detection job or a later non-re-analyze one — e.g. after a document was deleted and a fresh, non-re-analyze job runs): return `null`. Because the `execute()`-level fold-in write always includes `detectedCountry` unconditionally (using the initializer above, never `undefined`), this correctly clears any value a prior successful run may have set — the reasoning is not "nothing has been written yet" (that's only true for a genuine first run) but "this write always applies the current, correct value regardless of history."
3. On Bedrock failure during a **re-analyze** run specifically (existing `else` branch, handler.ts:229-232, which preserves fields and lets the job complete): return `null` explicitly — **closes JD-06** — a prior run's value must not survive a completed-but-failed re-analysis, which would otherwise present a stale mismatch.
4. On zero completed parse jobs (`parseJobs.length === 0`, handler.ts:119-123 — e.g. all documents were deleted): return `null` explicitly, same reasoning as (3). This is still just `processUploadMode()`'s return value — **`createSkeletonFields()` itself gains no new logic and performs no `Assessment` write of any kind**, on this path or any other; it remains a `GapField`-only helper exactly as it is today.
5. Non-UPLOAD intake modes never call `processUploadMode()` at all (`execute()`'s `if (assessment.intakeMode === 'UPLOAD')` branch, handler.ts:73-82) — `detectedCountry` stays at the `null` declared in the initializer, satisfying FR-CMV-001 Scenario 3 with no branch-specific code.

Then `execute()` folds the (always-defined, never-`undefined`) value into its **one existing** update call:

```ts
await this.prisma.assessment.update({
  where: { id: input.assessmentId },
  data: { status: 'ACTION_REQUIRED', progress: 50, detectedCountry },
});
```

This is strictly better than a second, separately-guarded write: it's **one** DB round trip per job (not two), it structurally **cannot** be misattributed to a Bedrock failure (it runs after every Bedrock-related try/catch inside `processUploadMode()` has already resolved one way or the other), and if this write itself fails, it fails exactly the way the pre-existing status/progress write already would — surfaced through the job's own retry mechanism (`maxAttempts`), not silently swallowed and not confused with a gap-detection content failure. No nested try/catch is needed at all.

**Accepted residual edge case:** if `processUploadMode()` throws *before* reaching its own try block (e.g. the hard `throw new Error('No active gap_detector prompt found…')` at handler.ts:161, or a `prisma.job.findMany`/`prisma.prompt.findFirst` failure), that exception propagates out of `execute()` entirely — the fold-in update never runs, and any prior `detectedCountry` is left as-is. This is not a defect this spec introduces: the same exception already fails the whole job today (pre-existing behavior, handled by the job's own `maxAttempts` retry), and a missing active prompt is a deployment-configuration problem, not a transient one retries would fix regardless of this feature.

This runs on **both** the initial run and the re-analyze path (both flow through `processUploadMode()` before reaching this update), satisfying FR-CMV-006 — replacing the document and re-triggering gap detection naturally refreshes `detectedCountry`, including correctly clearing it back to `null` per points 2–4 above when a run doesn't succeed.

### 6.3 Prompt update (`packages/api/prisma/seed.ts`, `gap_detector` section)

Add a new instruction block to the system prompt, placed **immediately before "## Output Format"** (closest possible to where the model commits to its final answer — mitigates the anchoring risk described below):

> ## Country Detection
>
> Independent of the country context stated earlier in this prompt, look **only** at what the documents themselves say and determine the primary country where this business actually operates. The context above reflects a value the user selected when starting this assessment — it may be wrong, and this check exists specifically to catch that. Do not let it influence your answer here.
>
> Return this as a top-level `detectedCountry` value using **exactly** one of: `"Kenya"`, `"Ethiopia"`, `"Nigeria"`, `"Zambia"`, or `"unclear"` if the documents don't clearly support one of those four. Also return a `detectedCountryConfidence` number from 0.0 to 1.0 for that classification, using the same bar as `VERIFIED` above (≥ 0.7 means confident) — if the documents don't clearly name an operating country, or you're below that confidence, return `"unclear"` with a correspondingly low confidence.

And extend the existing "## Output Format" JSON example — put the new keys **first**, before `fields` (closes JD-10: `repairTruncatedJson()`, handler.ts:274-295, strips the *trailing* incomplete key when a response is cut off by `maxTokens`; ordering the smaller, cheaper-to-emit country fields first means the model writes them before it has any chance to run out of tokens partway through the much larger `fields` array):

```json
{
  "detectedCountry": "<Kenya | Ethiopia | Nigeria | Zambia | unclear>",
  "detectedCountryConfidence": <0.0-1.0>,
  "fields": [ ... ]
}
```

**Known limitation, accepted (closes JD-08 with a documented mitigation, not a guarantee):** the `gap_detector` system prompt already opens with "Analyze this agricultural business in the context of `{{country}}`" and the user prompt template opens with "…for an enterprise operating in `{{country}}`" (both interpolated to the assessment's *selected* country before the model ever sees the documents). The new instruction above explicitly tells the model to disregard that framing for this one determination, and placing it immediately before the JSON request keeps it as the model's most recent instruction. This is a same-call, best-effort mitigation, not a redesign of the shared `{{country}}` injection convention (which also anchors the other two agent sections, `risk_analysis` and `report_generation`, and is out of scope here). Recorded as an accepted risk alongside requirements.md §10's existing note that real-world LLM classification accuracy has no automated check.

### 6.4 Deploying the prompt update — two separate mechanisms (dev vs. production)

**Local development:** unchanged from the original design — edit the `gap_detector` `systemPrompt` string in `seed.ts` and re-run `npx --prefix packages/api tsx prisma/seed.ts` (the command already documented in root `CLAUDE.md`'s Local Development Setup). Verified at `seed.ts:250-280`: `gap_detector` is one of three sections (along with `risk_analysis`, `report_generation`) that take the `else if (existing)` branch at line 264 and get `prisma.prompt.update()`-ed with the latest prompt text on every seed run against a DB that already has the row (a fresh DB instead takes the `create` branch, line 255-263) — either way, the local active prompt ends up current. No `PromptVersion` snapshot is created by this path.

**Staging / production (user-confirmed, by design — not automated as part of this spec):** RDS sits in a private VPC (root `CLAUDE.md`), there is no `seed-remote` script, and the Worker Lambda's only privileged actions are `run-sql` and `reprocess-failed-docx` — none of them re-run the seed script. Rather than building new deploy tooling for this MVP change, the intended path is the **existing Prompt Manager admin UI** (`/admin/prompt-manager` → edit the active `gap_detector` prompt), which the Admin persona already uses for exactly this purpose and which correctly creates a `PromptVersion` snapshot via `PromptsService` (`PUT /api/admin/prompts/:id/update`).

After this spec's code and migration are deployed, an Admin must manually:

1. Go to **Prompt Manager** → find the active **"Gap Detector - Default"** prompt (or whichever `gap_detector` prompt is currently `isActive: true`).
2. Open it for editing.
3. In the **System Prompt** field, paste the "## Country Detection" block above **immediately before the existing "## Output Format" heading**.
4. In the same **System Prompt** field, update the existing "## Output Format" JSON example to match the reordered schema shown above (`detectedCountry` and `detectedCountryConfidence` before `fields`).
5. Save — this creates a new `PromptVersion` snapshot and keeps the prompt `isActive: true`, exactly like any other admin prompt edit.

This manual step is a deliberate, accepted part of this design (not a gap left for later) — recorded here so the Admin has the exact text and location, and does not need to re-derive it from the handler code.

**Caveat, accepted:** `seed.ts:251-253` looks up the prompt to update by `{ section, name: 'Gap Detector - Default' }`, while the handler selects whichever `gap_detector` prompt has `isActive: true`, most recently updated (handler.ts:152-158). If an Admin has since created and activated a *different* `gap_detector` prompt via the Prompt Manager, the local seed script's edit and the production manual edit above must both target **whichever prompt is actually active** in each environment — not necessarily the one named "Gap Detector - Default". This is an existing repo behavior, not introduced by this spec.

## 7. Frontend Changes

**Route:** none new — `packages/web/src/app/(protected)/assessments/gap-detector/gap-detector-client.tsx` only.

**New local state** (alongside the existing `isValidating`/`showValidationBanner` state at lines 192-194):

```
showCountryMismatchDialog: boolean
showCountryMismatchHint: boolean
```

**Derived value — declare this early, near where `assessment` becomes available (right after the `useAssessment(id)` call at line 123), not down near `allMandatoryComplete` (line 281).** This closes JD-17: the original wording anchored the derivation at line 281 while also describing a click-handler wrapper effectively replacing code at lines 196-233 — since a `useCallback`'s dependency array is evaluated on every render, a wrapper declared before line 281 referencing a `const` declared at line 281 hits the temporal-dead-zone and throws on first render. Declaring `countryMismatch` immediately after `assessment` is loaded sidesteps the ordering question entirely — every callback below it can reference it safely regardless of exactly where each one ends up. Also closes JD-04 (BR-CMV-001 compliance) by using the already-exported `isSupportedCountry()` instead of a hand-rolled exclusion check:

```
import { isSupportedCountry } from '@alliance-risk/shared';

countryMismatch = !!assessment?.detectedCountry
  && isSupportedCountry(assessment.detectedCountry)
  && assessment.detectedCountry !== assessment.country
```

(Wrapped in `!!` so the value is a real `boolean`, not `string | boolean | undefined`, before it reaches any prop or JSX.)

**Refactor of `handleAnalyzeRisks`** (lines 196-233): the existing function body (the `apiClient.post(...)` call through its `try/catch/finally`) is renamed to an internal `proceedToRiskAnalysis()`, kept **byte-identical** — this is what FR-CMV-003 requires. The `Button`'s `onClick` now points to a new thin wrapper, declared after `countryMismatch` is in scope:

```
handleAnalyzeRisksClick():
  if countryMismatch → setShowCountryMismatchDialog(true)
  else → proceedToRiskAnalysis()
```

**New `Dialog`** (reusing `@/components/ui/dialog` — `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription`, `DialogFooter`), rendered near the existing validation banner block:

- Title: "Double-check the country before continuing"
- Body: uses `assessment.country` and `assessment.detectedCountry` to render the copy drafted in `proposal.md` §13, corrected per JD-15 below. Render each country via the existing `CountryBadge` component (already imported at line 64, already used at line 356) rather than calling `getCountryFlag()` directly — `CountryBadge` already handles the `string → SupportedCountryLabel` narrowing that a raw `getCountryFlag(assessment.country)` call would fail to typecheck under `strict` (closes JD-14).
- **Copy correction (closes JD-15 — revised again after round-2 re-judgment):** `proposal.md` §13's hint line — "Risk analysis won't start until you confirm how to proceed" — reads as a blocking statement, contradicting FR-CMV-002/003's non-blocking premise. The round-1 fix's replacement, *"Risk analysis proceeds as soon as you click Analyze Risks again,"* was itself wrong: per FR-CMV-004 Scenario 2, clicking "Analyze Risks" again while the mismatch is still unresolved re-shows this same dialog — it does **not** proceed automatically. Use instead: *"You're not locked out of anything — click Analyze Risks any time and choose Continue to move forward. This is a reminder, not a hold."* This phrasing makes no claim about what a *future* click does, only that nothing is currently blocked. This design.md is the corrected source of truth for this line going forward; `proposal.md` predates this review round.
- Footer buttons: `Cancel` (secondary variant) → `setShowCountryMismatchDialog(false); setShowCountryMismatchHint(true)`. `Continue anyway` (primary) → `setShowCountryMismatchDialog(false); proceedToRiskAnalysis()`.

**New hint banner (revised after round-2 re-judgment — the round-1 fix incorrectly narrowed this to a single sentence, dropping the remediation content FR-CMV-005 Scenario 1 requires):** visually similar pattern to the existing amber validation banner (lines 645-665) — same colors/icon/dismiss-button structure — but independently triggered by `showCountryMismatchHint`, not by `needsAttentionCount`. Full copy, naming both countries and both remediation paths (per FR-CMV-005 Sc1 and `proposal.md` §13's original hint, with only the blocking-sounding closing sentence corrected):

> Heads-up: the country detected in your business plan (**{{detectedCountry}}**) doesn't match the selected country (**{{assessment.country}}**). If this looks wrong, replace the document from **Manage Documents** or start a new assessment with the correct country. You're not locked out of anything — click Analyze Risks any time and choose Continue to move forward.

Dismiss button sets `showCountryMismatchHint = false`.

- **Auto-clear (closes JD-07):** add an effect mirroring the existing one at lines 292-297 — when `countryMismatch` becomes `false` (e.g. after a successful re-analysis following a document replacement), reset `showCountryMismatchHint` to `false` too. Without this, the hint keeps asserting a mismatch that has already been resolved.
- **Stacking precedence (closes JD-13):** the validation-rejection banner (lines 645-665) and this new hint banner are triggered by unrelated conditions and can both be true at once (e.g., the user clicked "Continue anyway", the AI validation then rejected some fields, and the user later cancels a *subsequent* mismatch check). Render the country-mismatch hint **above** the validation banner when both are visible — a country mismatch is more likely to be the root cause a user should address first, and a fixed stacking order avoids layout jitter versus conditionally re-ordering.

**One required cache-invalidation addition (closes a SEVERE finding surfaced by Judgment Day's final re-judgment round, applied outside the formal 2-round budget by explicit user decision — the alternative was shipping FR-CMV-006 unmet):** `useAssessment(id)` (`use-assessments.ts:70-81`) has a 2-minute `staleTime`, and nothing in the web package invalidates the `['assessment', id]` query key after a gap-detection re-analysis completes — `useReAnalyzeGaps` only invalidates `['gap-fields', assessmentId]` (`use-gap-detection.ts`), and the re-analysis job-completion effect on this screen (lines 150-156) only fires a `sileo` toast. Left as originally written ("no hook changes, no new fetch"), a user who replaces the business plan and successfully clears a mismatch (FR-CMV-006) could still see the mismatch dialog reappear for up to 2 minutes — the client keeps serving the pre-replacement `detectedCountry` from cache — and the JD-07 hint auto-clear (§7 above) can never fire either, since both depend on `countryMismatch` reflecting fresh data.

**Fix:** add one invalidation call to the existing job-completion effect (the same `useEffect` that watches `jobStatus === JobStatus.COMPLETED`, lines 150-156):

```ts
if (jobStatus === JobStatus.COMPLETED) {
  queryClient.invalidateQueries({ queryKey: ['assessment', id] });
  sileo.success({ title: 'Re-analysis complete', description: 'Gap fields updated with new insights.' });
}
```

`queryClient` is already in scope (`useQueryClient()` at line 116) and already used elsewhere in this component for `['gap-fields', id]` invalidation (line 223) — this is an additive line in an existing effect, not a new hook or a new fetch path. This is the one exception to "no hook changes" in this design; everywhere else in §7 remains as described (no new query keys, no new endpoints).

## 8. Integration Points

- **AWS Bedrock:** no change to invocation count or the `BEDROCK_MODELS[AgentSection.GAP_DETECTOR]` config — same call, marginally larger prompt/response.
- **Shared package:** one field added to `AssessmentDetail` (`packages/shared/src/types/assessment.types.ts`) — requires `pnpm --filter @alliance-risk/shared build` before API/Web pick it up.
- No S3, Textract, Cognito, or Secrets Manager touchpoints.

## 9. Security & Authorization

No change. `detectedCountry` is read-only from the client's perspective (never accepted via `UpdateAssessmentDto`), so no new input-validation surface is introduced. Existing `JwtAuthGuard` + `validateOwnership()` checks on `GET /api/assessments/:id` already gate access to this field exactly as they gate every other `Assessment` column today.

## 10. Error Handling

| Condition | Behavior |
|---|---|
| `detectedCountry` missing from AI response | Normalized to `null`, logged at `debug` level — no dialog (NFR-CMV-011) |
| `detectedCountry` present but not one of the 4 labels, or `detectedCountryConfidence < 0.7` | Normalized to `null`, logged at `debug` level — no dialog (fail-quiet, never fail-loud) |
| Bedrock invocation fails on **any** run (initial or a later non-re-analyze run) | Existing `createErrorFields()` path (handler.ts:222-234) — `processUploadMode()` returns `detectedCountry: null`; `execute()`'s single fold-in write (§6.2) persists that `null` unconditionally, so a stale value from an earlier successful run cannot survive |
| Bedrock invocation fails on a **re-analyze** run specifically | Same mechanism — the existing `else` branch (handler.ts:229-232) returns `null` explicitly (closes JD-06) |
| Re-run with zero completed parse jobs (e.g. all documents deleted) | **Correction (round-2 re-judgment):** this does **not** require any change to `createSkeletonFields()` itself, which remains a `GapField`-only helper with no `Assessment` write on any path. `processUploadMode()`'s zero-parse-jobs branch simply returns `detectedCountry: null` like every other branch, and the same single `execute()`-level write (§6.2) persists it — no special-casing needed |
| `processUploadMode()` throws before its own try block (e.g. missing active `gap_detector` prompt, handler.ts:161) | Accepted residual case, pre-existing and unrelated to this feature: the exception propagates out of `execute()` and the fold-in write never runs at all, so a prior `detectedCountry` (and `status`/`progress`) is left as-is. Recorded, not silently assumed safe — mitigated by the job's own `maxAttempts` retry for transient causes; a genuinely missing active prompt is a deployment-configuration issue, not something this feature can self-heal |
| The persistence write itself fails (DB error, connection blip) | §6.2 folds `detectedCountry` into the **existing** `execute()`-level status/progress update, which runs after `processUploadMode()` has already resolved — a failure here is handled exactly like any other failure of that pre-existing write (job retry), never misattributed to Bedrock and never discards the Core-10 fields already written (closes JD-01/JD-02/JD-21) |
| `assessment` not yet loaded when "Analyze Risks" is clicked | **Correction (closes JD-11):** the existing `if (!id) return;` guard (line 197) checks the `?id=` URL query param, not whether `useAssessment(id)` has resolved — it does **not** cover this case. The actual protection is `countryMismatch`'s optional chaining (`assessment?.detectedCountry`), which safely evaluates to `false` while `assessment` is `undefined`, and the fact that the "Analyze Risks" button only renders inside the `!isLoading` branch (line 628) once fields exist. **Accepted residual case:** if `useAssessment` itself errors (not just loads slowly), `countryMismatch` also falls back to `false` and a real mismatch would silently not be flagged for that page view — no worse than today's behavior (the button would already be unusable in that state since `gapData` would also be unavailable), but not actively guarded either; recorded here rather than silently assumed safe. |

User-visible messaging: only the dialog and hint banner text in §7 — no new toast (`sileo`) is introduced; this is a modal-choice interaction, not a fire-and-forget notification, so `Dialog` is the correct primitive per `packages/web/CLAUDE.md`'s notification conventions (`sileo` for toasts, not for blocking choices).

## 11. Testing Strategy

**Prerequisite (closes JD-02 — corrected again after round-2 re-judgment found the round-1 wording itself wrong):** `gap-detection.handler.spec.ts`'s existing test calls `(handler as any).processUploadMode(...)` directly — it never goes through `execute()` and so never touches `prisma.assessment` today, with or without this feature; the round-1 claim that this existing test would break was incorrect and is retracted. What actually needs new test coverage is `execute()` itself, since that's where the fold-in write now lives (§6.2). `execute()` needs a fuller mock than `processUploadMode()` alone: `prisma.assessment.findUniqueOrThrow` (handler.ts:59), `prisma.gapField.deleteMany` (handler.ts:65) for the non-re-analyze path, and `prisma.gapField.findMany` (handler.ts:181, re-analyze path) in addition to `prisma.assessment.update`. Extend `mockPrisma` to `{ job, prompt, gapField: { createMany, deleteMany, findMany, update }, assessment: { findUniqueOrThrow, update: jest.fn() } }` before writing any test that exercises `execute()`.

| Test | File | What it proves |
|---|---|---|
| Extend `mockPrisma` with `assessment: { update: jest.fn() }` | `gap-detection.handler.spec.ts` | Prerequisite — see above |
| `processUploadMode()`'s returned `detectedCountry` is folded into `execute()`'s single status/progress `assessment.update()` call, and a Bedrock parse failure (which resolves inside `processUploadMode()`'s own try/catch before this point) still lets that outer update run normally with `detectedCountry: null` | `gap-detection.handler.spec.ts` (new) | JD-01/JD-21 — proves the fold-into-existing-write design actually avoids a second, misattributable write |
| Malformed/missing `detectedCountry` doesn't break field parsing | `gap-detection.handler.spec.ts` (extend) | Defect class: parsing regression |
| Valid country + confidence ≥0.7 / `"unclear"` / hallucinated string / missing key / confidence <0.7 → correct normalized `Assessment.update` call in each case | `gap-detection.handler.spec.ts` (extend) | Defect class: wrong persistence/normalization; BR-CMV-003 enforcement |
| Re-analyze + Bedrock failure clears `detectedCountry` to `null`; zero-parse-jobs re-run does the same | `gap-detection.handler.spec.ts` (new) | JD-06 / FR-CMV-006 / NFR-CMV-011 |
| Exactly one `invokeModel` call per gap-detection run | `gap-detection.handler.spec.ts` (new — cheap, the mock already exists) | NFR-CMV-010 |
| Dialog shown only on true mismatch (match / unclear / null / unsupported-string all skip it) | New `packages/web/src/app/(protected)/assessments/gap-detector/__tests__/gap-detector-client.test.tsx` | Defect class: dialog logic bug; BR-CMV-001 |
| "Continue anyway" calls the exact same `apiClient.post` as today | Same file as above | FR-CMV-003 |
| "Cancel" fires zero network calls, shows hint, `Assessment.status` claim is verified transitively (no call ⇒ no mutation, not a direct server-state assertion from a Testing-Library test) | Same file as above | FR-CMV-004 |
| Hint banner auto-clears when `countryMismatch` resolves | Same file as above | JD-07 |
| Re-analysis job completion invalidates `['assessment', id]` (not just `['gap-fields', id]`) | Same file as above | FR-CMV-006 Sc1 — closes the post-round-3 SEVERE finding above |

Verification commands:
```bash
pnpm --filter @alliance-risk/api test --testPathPattern=gap-detection.handler
pnpm --filter @alliance-risk/api test --testPathPattern=gap-field.controller
pnpm --filter @alliance-risk/web test --testPathPattern=gap-detector-client
```

**Note on `gap-field.controller.spec.ts` (closes JD-09):** this suite mocks `GapDetectionService` entirely (`useValue: mockService`, with `allMandatoryComplete: false` hardcoded as a literal in the fixture) — it proves the controller still wires up correctly, but it does **not** and cannot exercise the real `allMandatoryComplete` computation in `gap-detection.service.ts`. Listed here as a smoke check that this feature doesn't touch that service at all (true, since no line in `gap-detection.service.ts` changes), not as a regression test with the power to catch one. NFR-CMV-012 is protected structurally (this spec's diff never touches `gap-detection.service.ts`), not by an automated gate that could fail if it were somehow violated.

**Not covered by these commands** (see requirements.md §10 for the full defect-class mapping): real-world LLM classification accuracy (including the anchoring risk noted in §6.3), and Dialog accessibility beyond what the shadcn primitive already guarantees — both recorded as accepted risks, not silently assumed safe.

## 12. Design Decisions

| ID | Decision | Alternatives considered | Rationale |
|----|----------|------------------------|-----------|
| DD-CMV-001 | Persist `detectedCountry` as a new `Assessment` column | New columns on `GapField`; new dedicated consistency-check table | `Assessment` is already fetched by the screen (`useAssessment`); `GapField` is a generic 10-row model, adding country-specific columns to it is a schema smell; a new table is over-engineered for one comparison (proposal.md §10) |
| DD-CMV-002 | `detectedCountry` is a new **top-level** key in the AI JSON response, not embedded per-field inside the existing `fields` array | Embed `normalizedCountry` inside the `country_of_operation` field entry | Keeps the well-tested Core-10 `fields` parsing/typing (`GapDetectionAIField`) completely untouched; strictly additive; simpler to validate independently |
| DD-CMV-003 | Reuse the existing ≥0.7 `VERIFIED` confidence bar for `detectedCountry`, but **enforce it in the handler** via a returned `detectedCountryConfidence` value, not just prompt instruction | A separate, tunable confidence threshold; trusting the prompt alone with no server-side gate | User-confirmed reuse of the 0.7 bar (BR-CMV-003); Judgment Day round 1 (JD-05) found the original prompt-only version unenforceable and untestable — returning the confidence value and gating on it in code (§6.2) closes that gap at negligible cost; `OQ-CMV-01` tracks future recalibration |
| DD-CMV-004 | Reuse the existing shadcn `Dialog` primitive for the confirmation modal, and reuse `CountryBadge` for country/flag rendering | Add a new `alert-dialog.tsx` primitive; call `getCountryFlag()` directly | No `alert-dialog.tsx` exists in this repo; `Dialog` already provides focus-trap and Escape-to-close; `CountryBadge` (already used elsewhere on this screen) avoids the `string → SupportedCountryLabel` type mismatch a raw `getCountryFlag()` call would hit (JD-14) |
| DD-CMV-005 | Two separate deployment mechanisms for the prompt update: edit `seed.ts` + re-run the seed script for **local dev**; a manual Prompt Manager admin-UI edit for **staging/production** | Build new remote-seed tooling; use only the admin CMS everywhere; use only `seed.ts` everywhere | Verified by reading `seed.ts:250-280`: `gap_detector` already takes the `else if (existing)` update branch on a non-fresh local DB — this remains correct for dev. Judgment Day round 1 (JD-03) found no path from `seed.ts` reaches the deployed DB at all (private-VPC RDS, no `seed-remote` script) — **by explicit user decision, this is not automated as part of this spec**; instead §6.4 documents the exact manual step (via the existing, already-versioned Prompt Manager UI) the Admin performs post-deploy. Caveat: the seed script's lookup-by-name (`seed.ts:251-253`) and the handler's lookup-by-active-status (handler.ts:152-158) can diverge if an Admin has activated a differently-named `gap_detector` prompt (JD-18) — both the local and the manual production edit must target whichever prompt is actually active in that environment |
| DD-CMV-006 | Fold the new `detectedCountry` write into the **existing** `execute()`-level status/progress `assessment.update()` call, rather than adding a second, separately-guarded write inside `processUploadMode()` | A second write with its own nested try/catch inside `processUploadMode()` | Judgment Day round 1 (JD-01/JD-02, confirmed severe by both judges) found that a write placed inside `processUploadMode()`'s Bedrock try/catch could be misattributed to a Bedrock failure, discarding successfully-extracted Core-10 fields. Folding into the pre-existing, already-safe write (§6.2) closes this with less code than adding isolation to a new one, and also closes JD-21 (one DB round-trip instead of two) |

**Step 2.3 — Reversion challenge, revisited after Judgment Day round 1:** the original claim ("no decision inverts existing behavior") was **not fully true as first designed** — JD-01/JD-02 showed that placing the new persistence write inside the existing Bedrock try/catch created a real path by which a transient DB error could invert a successful gap-detection run into an all-`MISSING` one, and the existing handler test's mock would have masked that (JD-02). DD-CMV-006 (fold into the existing, already-safe write) removes that path entirely rather than papering over it with a second try/catch — verified in §6.2. With that change, the claim now holds: no remaining decision in this spec removes, disables, or inverts existing behavior. The existing "Analyze Risks" flow, `allMandatoryComplete` gating, and DRAFT-only country-edit guard are all left completely intact.

## 13. Budget (Step 2.4)

| Signal | Estimate |
|---|---|
| Tasks | 5 |
| LOC (excl. tests) | ~130–175 (schema +2, shared type +1, handler ~40–55 incl. confidence gate + null-clearing paths, seed.ts prompt ~25–30 incl. reordered schema, frontend dialog/banner/state/effects ~70–90) |
| LOC (tests) | ~280–380 (revised up from the original ~150-200 estimate per Judgment Day JD-12: no repo precedent exists for testing a `(protected)` page client this size — `gap-detector-client.tsx` is 824 lines and a real test must mock 8+ hooks, `apiClient`, `sileo`, and the `next/dynamic` `DocumentViewer` import; comparable existing web test suites run 100–250 LOC each) |
| Expected Reviewer rounds | 1 per task (2 for the frontend task, unchanged — the harness-setup cost is now reflected in LOC rather than rounds) |

This still matches the **Standard** depth chosen in Phase 0 — the revised test-LOC estimate is larger than originally stated but still proportionate to a two-package, schema-touching change; not far enough above Standard to warrant Full or a split. No depth adjustment recommended, but `tasks.md` should give the frontend test task explicit room for harness setup (mocking `useAssessment`, `useGapFields`, `useUpdateGapFields`, `useMergedContent`, `useUpdateAssessment`, `useMultiDocumentStatus`, `useReAnalyzeGaps`, `useJobPolling`, `next/navigation`, `apiClient`, `sileo`, and the dynamic `DocumentViewer` import) as its own line item rather than folding it silently into "write the dialog."
