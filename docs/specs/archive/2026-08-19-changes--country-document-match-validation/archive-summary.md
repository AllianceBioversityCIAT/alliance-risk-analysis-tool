# Archive Summary — Country / Business-Plan Mismatch Validation

## 1. Document Control

| Field | Value |
|-------|-------|
| **Original spec path** | `docs/specs/changes/country-document-match-validation/` |
| **Archive date** | 2026-08-19 |
| **Final status** | Archive-ready, all findings closed |

## 2. Original Spec Path

`docs/specs/changes/country-document-match-validation/`

## 3. Archive Date

2026-08-19

## 4. Final Status

**PASS.** 5 original tasks + 4 post-validation design amendments (DD-CMV-007 through 010), all implemented and independently Reviewer-verified, most via mutation testing (deliberately breaking the fix to confirm the tests actually catch it — not just asserting the happy path).

## 5. Requirements Delivered

- Detects the country described in an uploaded business plan (any real country, not limited to the 4 platform-supported ones — widened by DD-CMV-007) and compares it to the country selected at assessment creation.
- Shows a non-blocking confirmation dialog on a mismatch, naming both countries; "Continue anyway" proceeds exactly as the pre-existing flow; "Cancel" is a pure no-op that shows a dismissible hint with both remediation paths.
- Re-detection follows both document replacement and manual field correction (DD-CMV-010: a manual `country_of_operation` correction takes precedence over the model's independent re-detection).
- Zero added Bedrock calls, fail-quiet on uncertain detection, zero regression to the pre-existing mandatory-field gating or country-immutability rules.

Full detail: `requirements.md` (FR-CMV-001 through 006, NFR-CMV-010/011/012, BR-CMV-001 through 004).

## 6. Files Changed Summary

| File | Change |
|---|---|
| `packages/shared/src/types/assessment.types.ts` | +1 field, `detectedCountry: string \| null` |
| `packages/api/prisma/schema.prisma` + migration | +1 nullable column, `Assessment.detectedCountry` |
| `packages/api/src/platform/jobs/handlers/gap-detection.handler.ts` | Detection, confidence gate, fold-in write, correction precedence (DD-CMV-006, 007, 010) |
| `packages/api/src/platform/jobs/handlers/gap-detection.handler.spec.ts` | 25 tests (from 1 pre-existing) |
| `packages/api/prisma/seed.ts` | `gap_detector` prompt — Country Detection instruction, widened to any country |
| `packages/web/.../gap-detector/gap-detector-client.tsx` | Mismatch dialog, hint banner, cache invalidation (2 mechanisms — jobStatus + gapData.total), visual polish |
| `packages/web/.../gap-detector/__tests__/gap-detector-client.test.tsx` | 17 tests (new file) |
| `packages/api/src/domain/report/report.service.ts`, `report-generation.handler.ts`, `pdf.service.spec.ts` | 1-line ripple fix each (required field on a shared type) |
| `docs/specs/changes/country-document-match-validation/prod-prompt-update.md` | Manual production deployment artifact (DD-CMV-005) |

12 commits total on `country-adapter`: `8f6d4ce`, `54da92f`, `7227d40`, `1fbc0a3`, `e060544`, `caf8f11`, `78d95aa`, `d720c70`, `63cdea1`, `b129694`, `f64cc45`, `8b834d4`.

Full detail: `execution.md` (14 task entries including 4 post-validation re-opens).

## 7. Test Evidence Summary

- Backend: 25/25 (`gap-detection.handler.spec.ts`), full API suite 384+ passed, 0 failed.
- Frontend: 17/17 (`gap-detector-client.test.tsx`), full web suite passing except 2 pre-existing, independently-confirmed-unrelated flaky tests.
- 2 real, live (non-mocked) Bedrock verifications performed: once for the original prompt (T-004), once again after DD-CMV-007's prompt rewrite, both confirming anti-anchoring holds and detection returns clean values.
- 1 real, live end-to-end persistence check (real DB row, real handler, real Bedrock call) for WARN-1 closure.
- Integration/E2E: blocked — the repo's only such suite (`test/auth-throttler.e2e-spec.ts`) is pre-existing, broken, and unrelated (stale import paths); recorded as an accepted gap, not improvised around.

Full detail: `test-report.md` (11 sections including 2 addenda).

## 8. Validation Summary

Independent audit (opus, different model than the implementing session) across all 8 phases: **ARCHIVE-READY**, 0 FAIL, 4 WARN (all subsequently closed with real evidence, not just doc edits), 7 advisory notes (optional, deferred to Kaizen). Every Judgment Day fix from `/akili-specify` (3 adversarial-review rounds) was independently re-verified present in the actually-shipped code. Two further addenda cover the 4 post-audit design amendments (DD-CMV-007 through 010) — none reopened or contradicted the original audit's findings.

Full detail: `validation-report.md` (14 sections including 2 addenda).

## 9. Accepted Warnings Or Follow-Ups

| Item | Status |
|---|---|
| Integration/E2E test infrastructure is broken (pre-existing, unrelated) | Accepted gap — a separate bugfix proposal now exists for the root cause of a *different* bug found during this spec's manual testing (`docs/specs/bugfix/deleted-document-content-persists/`, not yet specified/implemented — intentionally deferred to a fresh session) |
| Dialog accessibility beyond the shadcn `Dialog` primitive's defaults | Accepted risk — not verifiable under jsdom, primitive already provides focus-trap/Escape-to-close |
| Real-world LLM classification accuracy on diverse business plans | Accepted risk — not unit-testable; mitigated by the confidence gate and 3 separate live Bedrock verifications performed across this spec's lifecycle |
| Once `country_of_operation` carries a correction, it stays pinned across all subsequent re-analyzes (not just the triggering one) | Accepted, correct-by-design (DD-CMV-010) — escape hatch is replacing the document |
| Manual production Prompt Manager update | Still pending the user's own action in the deployed environment (by design, DD-CMV-005) — exact text and location in `prod-prompt-update.md` |
| Root `CLAUDE.md`'s seed-script command was broken (`ERR_MODULE_NOT_FOUND`) | **Fixed during this archive cycle** — see Constitution Sync below |

## 10. Historical Notes

This spec is a strong worked example of the AKILI-SPECS discipline holding up under real-world pressure: 3 adversarial Judgment Day rounds during `/akili-specify` caught a genuine data-loss bug (JD-01) before any code was written; then, after implementation, testing, and full validation all passed, **4 more rounds of real user testing found 4 more real gaps** (DD-CMV-007 through 010) — none of them things automated review could have caught, because they were scope-definition and cross-signal-propagation questions, not spec-conformance bugs. Every one was closed with the same rigor as the original build: design docs amended first, then Implementer → Reviewer, with 2 of the 4 rounds using mutation testing to independently confirm the fix (not just the existence of a passing test) actually closes the gap. One Reviewer FAIL occurred along the way (DD-CMV-009, a layout-ordering defect), fixed same-session.
