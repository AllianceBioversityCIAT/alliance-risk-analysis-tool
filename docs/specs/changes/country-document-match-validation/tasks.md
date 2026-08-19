# Tasks — Country / Business-Plan Mismatch Validation

## 1. Document Control

| Field | Value |
|-------|-------|
| **Module** | `docs/specs/changes/country-document-match-validation` |
| **Requirements** | `requirements.md` |
| **Design** | `design.md` (post–Judgment Day, all rounds — see `judgment.md`) |
| **Version** | 1.0 |

## 2. Legend

**Status:** `[ ]` not started · `[~]` in progress/blocked · `[x]` complete · `[!]` blocked (external dependency)
**Expertise:** `[BE]` `packages/api/` · `[FE]` `packages/web/` · `[SHARED]` `packages/shared/`
**Size:** S ≤1 file/≤2h · M 2–5 files/half day · L 5+ files or cross-package

## 3. Dependency Graph

```
## Phase A: Foundation (parallel — different packages, no shared files)
T-001 [SHARED] ─┐
T-002 [BE migration] ─┘  (independent of each other)

## Phase B: Backend logic (sequential — T-003 needs the column from T-002)
T-002 → T-003 [BE handler]

## Phase C: Prompt content (depends on T-003's final interface field names)
T-003 → T-004 [BE prompt]

## Phase D: Frontend (depends on the shared type and the real API contract)
T-001, T-003 → T-005 [FE]
```

**Leader rule:** T-001 and T-002 touch different packages with zero file overlap — safe to run in parallel. T-005 should not start until T-003 is merged, since its tests exercise the real `AssessmentDetail.detectedCountry` contract T-003 produces.

---

### T-001: Add `detectedCountry` to the shared `AssessmentDetail` type `[SHARED]`

- **Status:** `[x]` (PASS, attempt 2 — see execution.md. Scope amended, user-approved, to also fix `report.service.ts`/`report-generation.handler.ts`/`pdf.service.spec.ts`)
- **Skills:** (none from the Skill Map apply directly — this is a pure type addition; no `nestjs-expert`/`shadcn-ui` needed)
- **Size:** S
- **Dependencies:** None
- **Requirements:** FR-CMV-001 (supports downstream consumption), BR-CMV-001
- **Design Ref:** design.md §4 (Data Model Changes — shared type)
- **Scope:**
  - `packages/shared/src/types/assessment.types.ts` — add `detectedCountry: string | null;` to `AssessmentDetail` (after `country: string;`)
  - No barrel changes needed — `AssessmentDetail` is already exported from `packages/shared/src/index.ts`
  - Run `pnpm --filter @alliance-risk/shared build`
- **Tests:** None required — pure type addition, no runtime logic. `pnpm --filter @alliance-risk/shared typecheck` is the check.
- **Verification:** `pnpm --filter @alliance-risk/shared build && pnpm --filter @alliance-risk/shared typecheck`
- **Done when:** `packages/shared/dist/` rebuilds with no TypeScript errors and `AssessmentDetail` includes `detectedCountry: string | null`.

---

### T-002: Prisma migration — `Assessment.detectedCountry` column `[BE]`

- **Status:** `[x]` (PASS, attempt 1 — see execution.md)
- **Skills:** `nestjs-expert`
- **Size:** S
- **Dependencies:** None
- **Requirements:** FR-CMV-001 (persistence target), BR-CMV-002 (must not touch the DRAFT-only country guard)
- **Design Ref:** design.md §4 (Data Model Changes — Prisma schema)
- **Scope:**
  - `packages/api/prisma/schema.prisma` — add `detectedCountry String? @map("detected_country") @db.VarChar(100)` to the `Assessment` model, placed after the existing `country` field
  - Generate the migration: `pnpm --filter @alliance-risk/api exec prisma migrate dev --name add_assessment_detected_country`
  - **BUT it must NOT** touch `assessments.service.ts`'s DRAFT-only country-edit guard (lines 105-109) or `UpdateAssessmentDto` — `detectedCountry` is never client-writable (design.md §5)
- **Tests:** None (schema-only change, additive, no backfill needed — `null` is correct for every existing row)
- **Verification:** `pnpm --filter @alliance-risk/api build` (confirms Prisma client regenerates cleanly); manually inspect the generated migration SQL is a single `ADD COLUMN ... NULL` statement with no data migration
- **Done when:** the migration file exists under `packages/api/prisma/migrations/`, `prisma migrate dev` applies cleanly against local Postgres, and `pnpm --filter @alliance-risk/api build` succeeds with `Assessment.detectedCountry` available on the generated Prisma client.

---

### T-003: Gap-detection handler — detect, gate, and persist `detectedCountry` `[BE]`

- **Status:** `[x]` (PASS, attempt 1 — see execution.md; Reviewer additionally ran mutation testing confirming the JD-01 regression is caught)
- **Skills:** `nestjs-expert`, `error-handling-patterns`
- **Size:** L (touches interface, `execute()`, `processUploadMode()`, and its test file)
- **Dependencies:** T-002
- **Requirements:** FR-CMV-001 (all 3 scenarios), FR-CMV-006 (Sc1, backend half), NFR-CMV-010, NFR-CMV-011, BR-CMV-001, BR-CMV-003
- **Design Ref:** design.md §6.1, §6.2, §10, §11, §12 DD-CMV-003/DD-CMV-006
- **Scope:**
  - `packages/api/src/platform/jobs/handlers/gap-detection.handler.ts`:
    - Extend `GapDetectionAIResponse` (lines 42-44) with `detectedCountry?: string | null` and `detectedCountryConfidence?: number`
    - In `execute()` (lines 55-100): declare `let detectedCountry: string | null = null;` alongside `bedrockTokensUsed`/`mergedMarkdown` (near lines 70-71); assign it from `processUploadMode()`'s result on the UPLOAD branch; fold it into the existing single `assessment.update({ data: { status, progress, detectedCountry } })` call (lines 85-88) — **AND IT MUST NOT** add any second, separately-guarded `assessment.update()` call anywhere in this file (this is the specific shape Judgment Day found unsafe — see design.md §6.2/§12 DD-CMV-006)
    - Extend `processUploadMode()`'s private return type (line 108) with `detectedCountry: string | null`, computed per design.md §6.2 points 1-5:
      - Successful parse: `isSupportedCountry(parsed.detectedCountry)` (import from `@alliance-risk/shared`) **and** `parsed.detectedCountryConfidence >= 0.7` → that value; otherwise `null`. Log `logger.debug(...)` on rejection (value + confidence) for observability.
      - Bedrock failure on any run (existing `createErrorFields()` catch, lines 222-234): `null`
      - Bedrock failure on a re-analyze run specifically (existing `else` branch, lines 229-232): `null` explicitly
      - Zero completed parse jobs (`parseJobs.length === 0`, lines 119-123): `null` explicitly — **BUT it must NOT** add any `Assessment` write inside `createSkeletonFields()` itself (it stays a `GapField`-only helper, unchanged)
      - Non-UPLOAD intake modes: never touch `processUploadMode()` — `detectedCountry` stays at the `execute()`-level `null` initializer
  - **AND IT MUST** keep the existing `createFieldsFromAIResponse`/`updateFieldsFromAIResponse` field-parsing logic completely untouched (DD-CMV-002 — `detectedCountry` rides as a top-level key, not embedded in `fields`)
- **Tests** (`gap-detection.handler.spec.ts`):
  - Extend `mockPrisma` to `{ job, prompt, gapField: { createMany, deleteMany, findMany, update }, assessment: { findUniqueOrThrow, update: jest.fn() } }` (design.md §11 prerequisite) — only add `$transaction: jest.fn()` if a re-analyze-success test is added; if not, note in the PR description that `$transaction` is intentionally not mocked because no test exercises that path yet
  - Valid country + confidence ≥0.7 → normalized value persisted via the folded `execute()`-level update
  - `"unclear"` / hallucinated string / missing key / confidence <0.7 → `null` persisted, `logger.debug` called
  - Re-analyze + Bedrock failure → `detectedCountry` explicitly cleared to `null`
  - Zero parse jobs on a re-run → `detectedCountry` explicitly cleared to `null`, and assert `gapField.createMany` (not `assessment.update`) is the only call inside `createSkeletonFields()`'s own code path
  - Exactly one `invokeModel` call per gap-detection run (NFR-CMV-010)
  - A thrown error from `assessment.update()` does not get miscategorized as a Bedrock failure (proves DD-CMV-006 actually isolates this failure mode)
- **Verification:** `pnpm --filter @alliance-risk/api test --testPathPattern=gap-detection.handler`
- **Done when:** all tests above pass, `pnpm --filter @alliance-risk/api build` succeeds, and manually triggering gap detection against a local seeded prompt with the T-004 changes applied produces a populated `Assessment.detectedCountry` for at least one real business-plan fixture.

---

### T-004: Update the `gap_detector` prompt — local seed + production copy-paste text `[BE]`

- **Status:** `[x]` (PASS, attempt 1 — see execution.md; verified with a real live Bedrock call, not just mocks)
- **Skills:** `nestjs-expert`
- **Size:** M
- **Dependencies:** T-003 (needs final field names/schema from the interface)
- **Requirements:** FR-CMV-001 (prompt-side instruction), BR-CMV-003
- **Design Ref:** design.md §6.3, §6.4, §12 DD-CMV-005
- **Scope:**
  - `packages/api/prisma/seed.ts` — in the `gap_detector` section's `systemPrompt`:
    - Insert the "## Country Detection" instruction block immediately before "## Output Format" (exact text in design.md §6.3)
    - Reorder the "## Output Format" JSON example so `detectedCountry`/`detectedCountryConfidence` appear **before** `fields` (truncation-safety, design.md §6.3/JD-10)
  - Re-run `npx --prefix packages/api tsx prisma/seed.ts` locally to apply the change to the local dev DB (per design.md §6.4's documented dev mechanism)
  - **Deliverable for the Admin persona:** produce a short, copy-paste-ready block (the exact new "## Country Detection" text + the reordered "## Output Format" JSON) as a task artifact (e.g. `docs/specs/changes/country-document-match-validation/prod-prompt-update.md`), so the manual production Prompt Manager edit (design.md §6.4) needs no re-derivation from code
  - **BUT it must NOT** attempt to build any remote-seed tooling or touch the `PromptsService`/`worker.ts` action list — production deployment of this prompt stays the explicit manual step in design.md §6.4 (user decision, out of scope for automation)
- **Tests:** None automated (prompt content, not code) — covered indirectly by T-003's handler tests, which exercise the *parsing* side of whatever the prompt is instructed to return
- **Verification:** manually run gap detection locally against a UPLOAD-mode assessment after re-seeding; confirm the Bedrock response includes `detectedCountry`/`detectedCountryConfidence` before `fields` in the raw output (log the raw Bedrock response temporarily if needed)
- **Done when:** local re-seed applies the updated prompt, a manual local gap-detection run against a real business plan returns a populated `detectedCountry`, and `docs/specs/changes/country-document-match-validation/prod-prompt-update.md` exists with the exact text + location instructions from design.md §6.4.

---

### T-005: Gap detector UI — mismatch dialog, hint banner, and cache invalidation `[FE]`

- **Status:** `[x]` (PASS, attempt 1 — see execution.md; all 3 Judgment Day defect classes confirmed not reintroduced)
- **Skills:** `shadcn-ui`, `tailwind-design-system`, `vercel-react-best-practices`
- **Size:** L (component logic + new test file with a large mock surface)
- **Dependencies:** T-001, T-003
- **Requirements:** FR-CMV-002 (both scenarios), FR-CMV-003, FR-CMV-004 (both scenarios), FR-CMV-005, FR-CMV-006 (Sc1, frontend half), BR-CMV-001
- **Design Ref:** design.md §7, §10 (last row), §11, §12 DD-CMV-004
- **Scope:**
  - `packages/web/src/app/(protected)/assessments/gap-detector/gap-detector-client.tsx`:
    - Import `isSupportedCountry` from `@alliance-risk/shared`; derive `countryMismatch` (wrapped in `!!`) **immediately after** the `useAssessment(id)` call (line 123) — **not** near `allMandatoryComplete` (line 281), to avoid the TDZ hazard identified in design.md §7/JD-17
    - Rename the existing `handleAnalyzeRisks` body to `proceedToRiskAnalysis()`, byte-identical (FR-CMV-003) — **BUT it must NOT** change its `try/catch/finally`, its `AxiosError`/`invalidFields` handling, or its `setIsValidating` calls in any way
    - Add a thin `handleAnalyzeRisksClick()` wrapper (declared after `countryMismatch` is in scope) that shows the dialog on mismatch, else calls `proceedToRiskAnalysis()` directly; wire it to the existing Button's `onClick` (currently line ~721)
    - Add `showCountryMismatchDialog`/`showCountryMismatchHint` state; add the `Dialog` (reusing `Dialog`/`DialogContent`/`DialogHeader`/`DialogTitle`/`DialogDescription`/`DialogFooter` from `@/components/ui/dialog`) with the exact copy from design.md §7, rendering both countries via the existing `CountryBadge` component (already imported at line 64) — **not** a raw `getCountryFlag()` call
    - Add the hint banner (full copy incl. both remediation paths, per design.md §7) with an auto-clear `useEffect` mirroring the existing one at lines 292-297, and a fixed stacking order **above** the existing validation-rejection banner (lines 645-665) when both are visible
    - Add `queryClient.invalidateQueries({ queryKey: ['assessment', id] })` to the existing `jobStatus === JobStatus.COMPLETED` effect (lines 150-156), alongside its existing `sileo.success` call — this is the one addition to an existing effect, not a new hook
  - **BUT it must NOT** change `allMandatoryComplete`'s computation, the button's `disabled` expression, or the tooltip's gating condition (all untouched per FR-CMV-002 Sc2 / NFR-CMV-012)
- **Tests** (new `packages/web/src/app/(protected)/assessments/gap-detector/__tests__/gap-detector-client.test.tsx`):
  - Dialog appears only when `detectedCountry` is a supported country different from `country` (mismatch); does not appear on match, `null`, or an unsupported string (BR-CMV-001)
  - "Continue anyway" calls the exact same `apiClient.post('/api/assessments/:id/gap-fields/submit')` as the no-mismatch path (FR-CMV-003)
  - "Cancel" fires zero `apiClient` calls, closes the dialog, shows the hint banner with both countries and both remediation options (FR-CMV-004 Sc1, FR-CMV-005)
  - Clicking "Analyze Risks" again after a prior "Cancel" (mismatch still present) re-shows the dialog (FR-CMV-004 Sc2 — no persistent dismissal)
  - Hint banner auto-clears when a re-fetched `assessment.detectedCountry` no longer mismatches
  - The `['assessment', id]` query is invalidated when `jobStatus` transitions to `COMPLETED`
  - Mock surface required: `useSearchParams`/`useRouter` (`next/navigation`), `useAssessment`, `useUpdateAssessment`, `useGapFields`, `useUpdateGapFields`, `useReAnalyzeGaps`, `useJobPolling`, `useMergedContent`, `useMultiDocumentStatus`, `apiClient`, `sileo`, and the `next/dynamic` `DocumentViewer` import — treat this mock harness as its own line item, not an afterthought (design.md §13)
- **Verification:** `pnpm --filter @alliance-risk/web test --testPathPattern=gap-detector-client`
- **Done when:** all tests above pass, `pnpm --filter @alliance-risk/web build` succeeds, and a manual run through `pnpm dev` against a locally-seeded (T-004) assessment with a deliberately mismatched country shows the dialog, both button paths behave as specified, and the hint banner/auto-clear work end-to-end.

---

## 4. Coverage Check (scenario/clause-level, not just requirement-ID)

| Requirement | Scenario / Clause | Task |
|---|---|---|
| FR-CMV-001 | Sc1 (confident detection persisted) | T-003 |
| FR-CMV-001 | Sc2 (unclear/low-confidence, BUT must not block extraction) | T-003 |
| FR-CMV-001 | Sc3 (non-UPLOAD unaffected) | T-003 |
| FR-CMV-002 | Sc1 (dialog on mismatch, AND IT MUST name both + non-blocking copy) | T-005 |
| FR-CMV-002 | Sc2 (match/null skips dialog, BUT must not add delay) | T-005 |
| FR-CMV-003 | Sc1 (identical submit call, AND IT MUST NOT re-trigger gap detection) | T-005 |
| FR-CMV-004 | Sc1 (zero side effects, BUT must not navigate away) | T-005 |
| FR-CMV-004 | Sc2 (reappears every click, AND IT MUST NOT be permanently suppressed) | T-005 |
| FR-CMV-005 | Sc1 (dismissible hint, both countries + both remediation paths, AND IT MUST NOT auto-trigger remediation) | T-005 |
| FR-CMV-006 | Sc1 backend half (re-detection clears stale value, AND IT MUST update on completed run) | T-003 |
| FR-CMV-006 | Sc1 frontend half (dialog stops appearing — requires cache invalidation) | T-005 |
| NFR-CMV-010 | Exactly one `invokeModel` call | T-003 |
| NFR-CMV-011 | Fail-quiet on uncertain/failed detection | T-003 |
| NFR-CMV-012 | No regression to `allMandatoryComplete` | Structurally protected — no task touches `gap-detection.service.ts`; verified by `gap-field.controller.spec.ts` passing unmodified across all tasks |
| BR-CMV-001 | Mismatch = supported-country membership + inequality | T-003 (backend normalization) + T-005 (frontend `isSupportedCountry` derivation) |
| BR-CMV-002 | Country immutability outside DRAFT unchanged | T-002 (explicit "must not touch" constraint); verified by no diff to `assessments.service.ts` |
| BR-CMV-003 | Reuse ≥0.7 confidence bar, enforced not just instructed | T-003 (code-level gate) + T-004 (prompt instruction) |

## 5. Verification Commands (project defaults)

```bash
pnpm --filter @alliance-risk/shared build
pnpm --filter @alliance-risk/api build
pnpm --filter @alliance-risk/api test --testPathPattern=gap-detection.handler
pnpm --filter @alliance-risk/api test --testPathPattern=gap-field.controller
pnpm --filter @alliance-risk/web test --testPathPattern=gap-detector-client
pnpm build
pnpm lint
pnpm test
```

## 6. Task Plan Checklist

- [x] Every FR/NFR/BR from `requirements.md` maps to ≥1 task (see §4 above, scenario-level)
- [x] Each task has an explicit verification command
- [x] Dependencies form a DAG: T-001∥T-002 → T-003 → T-004; T-001,T-003 → T-005 (no cycles)
- [x] Skills listed match the project Skill Map (root `AGENTS.md`)
- [x] Cross-package ordering: `shared` (T-001) and `api` migration (T-002) before `api` logic (T-003) before `web` (T-005)
- [x] Migration (T-002) precedes the code that depends on the new column (T-003)
- [x] No foundation task's "Done when" requires a full-package build that depends on a later task landing (KZ-004) — T-001/T-002 each verify only their own package
