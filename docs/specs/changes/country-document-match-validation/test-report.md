# Test Report — Country / Business-Plan Mismatch Validation

## 1. Document Control

| Field | Value |
|-------|-------|
| **Module** | `docs/specs/changes/country-document-match-validation` |
| **Requirements** | `requirements.md` |
| **Execution log** | `execution.md` |
| **Date** | 2026-08-18 |

## 2. Summary

**Overall status: PASS — no product bugs, no failures, 2 suites executed, 1 suite blocked on pre-existing unrelated infra.**

- 2 Testers spawned in parallel (backend-unit, frontend-unit) — independent files/packages, no shared fixtures.
- Both Testers were instructed to **read the existing tests first** (already authored during `/akili-execute`, per the "author TDD coverage" rule) and only add what was genuinely missing, rather than duplicate coverage.
- **Backend unit:** 16/16 passed (11 pre-existing + 5 new). Closed both Reviewer-flagged advisory gaps from `execution.md` (non-UPLOAD initializer safety, re-analyze-success path) plus a boundary-coverage gap found during independent scan (exact `>= 0.7` edge). Full API suite: 384 passed, 2 pre-existing/unrelated skips, 0 failures.
- **Frontend unit:** 14/14 passed (10 pre-existing + 4 new). Closed 2 real coverage gaps (dialog body's actual copy content was never asserted; Cancel's "does not navigate away" half of FR-CMV-004 was never asserted) plus added a happy-path flow-clarity test and a test documenting the Reviewer's accepted Advisory #1 (Escape/overlay/X dismiss doesn't set the hint, unlike Cancel).
- **Integration/E2E:** blocked — see §5/§9. The repo's only e2e suite (`auth-throttler.e2e-spec.ts`) fails to compile for reasons unrelated to this spec (stale import paths predating a `platform/auth/` restructure, already confirmed pre-existing during `/akili-execute` T-001 and T-003 via `git stash`). No new integration/E2E infrastructure was improvised — per this command's own rule, choosing/scaffolding test infra is a stack decision, not something to invent mid-suite.

## 3. Backend Unit Tests

**Suite:** `packages/api/src/platform/jobs/handlers/gap-detection.handler.spec.ts`
**Command:** `pnpm --filter @alliance-risk/api test --testPathPattern=gap-detection.handler`
**Result:** 16/16 passed

| Test | Type | Result |
|---|---|---|
| Persists a normalized `detectedCountry` at confidence ≥0.7 | pre-existing | PASS |
| `it.each`: `"unclear"` / hallucinated string / missing key / confidence <0.7 → `null` + debug log | pre-existing | PASS |
| Does not break Core-10 field parsing when `detectedCountry` is missing/malformed | pre-existing | PASS |
| Clears `detectedCountry` to `null` on re-analyze + Bedrock failure | pre-existing | PASS |
| Clears `detectedCountry` to `null` on zero parse jobs during a re-run | pre-existing | PASS |
| Exactly one `invokeModel` call per run (NFR-CMV-010) | pre-existing | PASS |
| Thrown `assessment.update()` error isn't miscategorized as a Bedrock failure (DD-CMV-006) | pre-existing | PASS |
| **New:** non-UPLOAD (`GUIDED_INTERVIEW`) → `detectedCountry: null`, Bedrock never called | new (closes Advisory A1) | PASS |
| **New:** non-UPLOAD (`MANUAL_ENTRY`) → same guarantee | new (closes Advisory A1) | PASS |
| **New:** re-analyze *success* path — refreshes `detectedCountry` via `updateFieldsFromAIResponse`/`$transaction` | new (closes Advisory A2) | PASS |
| **New:** accepts `detectedCountryConfidence` at exactly `0.7` (inclusive boundary) | new (closes a boundary gap) | PASS |
| **New:** rejects `detectedCountryConfidence` at `0.699999` (just below boundary) | new (closes a boundary gap) | PASS |

Full API suite (regression check): **384 passed, 2 skipped (pre-existing, unrelated), 0 failed.**

**Structural check (NFR-CMV-012):** `git log --oneline -- packages/api/src/domain/gap-detection/gap-detection.service.ts` shows the most recent commit as `219441a`, predating every commit this spec made (`8f6d4ce`, `54da92f`, `7227d40`, `1fbc0a3`) — the file is untouched. `pnpm --filter @alliance-risk/api test --testPathPattern=gap-field.controller` → 4/4 passed, confirming the smoke check around `allMandatoryComplete` still passes unmodified.

## 4. Frontend Unit Tests

**Suite:** `packages/web/src/app/(protected)/assessments/gap-detector/__tests__/gap-detector-client.test.tsx`
**Command:** `pnpm --filter @alliance-risk/web test --testPathPattern=gap-detector-client`
**Result:** 14/14 passed

| Test | Type | Result |
|---|---|---|
| Shows the dialog on a true mismatch; does not show it on match/null/unsupported string | pre-existing | PASS |
| "Continue anyway" calls the identical submit endpoint | pre-existing | PASS |
| "Cancel" fires zero `apiClient` calls, closes the dialog, shows the hint banner | pre-existing | PASS |
| Dialog re-shows on a subsequent click after a prior Cancel | pre-existing | PASS |
| Hint banner auto-clears when the mismatch resolves | pre-existing | PASS |
| Cache invalidation fires only on `jobStatus === COMPLETED` (2 tests) | pre-existing | PASS |
| **New:** dialog content actually names both countries + the non-blocking statement (not just the title) | new — real coverage gap | PASS |
| **New:** "Cancel" does not call `router.push` (the other half of FR-CMV-004 Sc1) | new — real coverage gap | PASS |
| **New:** Escape/overlay/X dismiss does not set the hint banner (documents Reviewer Advisory #1 as accepted current behavior) | new — documents accepted behavior | PASS |
| **New:** happy-path flow clarity — dialog and hint never appear when there was never a mismatch | new — UX Testing Guidance | PASS |

**Accessibility note (UX Testing Guidance):** the Reviewer's Advisory #3 (`DialogDescription`'s second paragraph and `aria-describedby` wiring) was independently investigated and confirmed **not testable** under the current mock setup — `packages/web/__mocks__/radix-ui.js`'s `DialogDescription` mock doesn't replicate Radix's real id-linking to `DialogContent`, so no jsdom assertion could distinguish the two states. This matches `requirements.md` §10's own acknowledgment that dialog accessibility beyond the shadcn primitive's defaults is not verifiable via jsdom — recorded as an accepted risk, not a new gap.

## 5. Integration Tests

**Status: Blocked — pre-existing, unrelated infrastructure failure.**

The only integration/e2e suite in the repo, `packages/api/test/auth-throttler.e2e-spec.ts`, fails to compile:
```
test/auth-throttler.e2e-spec.ts:6:28 - error TS2307: Cannot find module '../src/auth/auth.module'
test/auth-throttler.e2e-spec.ts:7:32 - error TS2307: Cannot find module '../src/auth/cognito.service'
```
Both modules live at `src/platform/auth/...` today — this is a stale import path predating that restructure, already independently confirmed pre-existing (not caused by this spec) twice during `/akili-execute` (T-001's and T-003's Reviewers both verified via `git stash` that the identical 2 errors exist with and without this spec's changes).

Per this command's testing rules, choosing/fixing test infrastructure is a stack decision outside `/akili-test`'s scope — no new integration suite was improvised. This is the same gap already flagged in `execution.md` as a Kaizen candidate ("worth its own bugfix ticket").

## 6. E2E Tests

**Status: Not applicable / accepted gap.** No browser-based E2E framework (Playwright/Cypress) exists in this repo — the project's testing strategy (per `docs/trd/trd.md` §12) relies on Jest unit tests, the one (currently broken) Jest-based API integration suite above, and a manual UAT protocol (`docs/testing/analyst-test-protocol.md`). This feature's own `requirements.md` §10 already scoped real-browser dialog accessibility as an accepted risk rather than something this spec would add new E2E infra to cover — consistent with that decision, no new E2E suite was created here either.

## 7. Coverage & Traceability

| Requirement | Scenario | Test Type | Test | Result |
|---|---|---|---|---|
| FR-CMV-001 | Sc1 — confident detection persists | Backend unit | `gap-detection.handler.spec.ts` | PASS |
| FR-CMV-001 | Sc2 — unclear/low-confidence → null, no block | Backend unit | `gap-detection.handler.spec.ts` (`it.each` + boundary pair) | PASS |
| FR-CMV-001 | Sc3 — non-UPLOAD unaffected | Backend unit | `gap-detection.handler.spec.ts` (new, closes A1) | PASS |
| FR-CMV-002 | Sc1 — dialog on mismatch, names both + non-blocking | Frontend unit | `gap-detector-client.test.tsx` (new, closes real gap) | PASS |
| FR-CMV-002 | Sc2 — match/null/unsupported skip dialog | Frontend unit | `gap-detector-client.test.tsx` | PASS |
| FR-CMV-003 | Sc1 — identical submit flow | Frontend unit | `gap-detector-client.test.tsx` | PASS |
| FR-CMV-004 | Sc1 — zero side effects, no navigation | Frontend unit | `gap-detector-client.test.tsx` (navigation half new, closes real gap) | PASS |
| FR-CMV-004 | Sc2 — reappears every click | Frontend unit | `gap-detector-client.test.tsx` | PASS |
| FR-CMV-005 | Sc1 — hint with both countries + both remediation paths | Frontend unit | `gap-detector-client.test.tsx` | PASS |
| FR-CMV-006 | Sc1 (backend half) — re-detection follows document changes | Backend unit | `gap-detection.handler.spec.ts` (new, closes A2) | PASS |
| FR-CMV-006 | Sc1 (frontend half) — cache invalidation | Frontend unit | `gap-detector-client.test.tsx` | PASS |
| NFR-CMV-010 | Exactly one Bedrock invocation | Backend unit | `gap-detection.handler.spec.ts` | PASS |
| NFR-CMV-011 | Fail-quiet on uncertain/failed detection | Backend unit | `gap-detection.handler.spec.ts` | PASS |
| NFR-CMV-012 | No regression to `allMandatoryComplete` | Structural check + smoke test | `gap-field.controller.spec.ts` (unmodified) | PASS (structural) |
| BR-CMV-001 | Mismatch = supported-country ∧ differs | Backend + Frontend unit | both files | PASS |
| BR-CMV-002 | Country immutability outside DRAFT unchanged | Structural check (T-002 Reviewer, `/akili-execute`) | `git diff` empty on `assessments.service.ts` | PASS (structural) |
| BR-CMV-003 | Shared ≥0.7 confidence threshold | Backend unit | `gap-detection.handler.spec.ts` (new boundary pair) | PASS |

**Every requirement in `requirements.md` has test evidence or an explicit, reasoned accepted gap (see §9).** No requirement is marked covered solely because related code exists.

## 8. Remediation

No failures and no product bugs were found — nothing requires remediation in application code. One test-authoring note carried forward: `.agents/tester.md`'s own reference table still documents the double-`--` `pnpm test -- --testPathPattern=` form that KZ-005 already identified as broken elsewhere in the project's docs (`CLAUDE.md`, package guides) — both Testers were briefed around it directly in this run, but the persona file itself wasn't corrected (out of this test run's scope; flagged here for `/akili-archive`).

## 9. Accepted Gaps

| Gap | Reason accepted | Where recorded |
|---|---|---|
| Integration/E2E suite for this feature's flow (real HTTP + real DB + real Bedrock, end-to-end) | The repo's only e2e suite is pre-existing broken and unrelated (stale import paths); scaffolding new integration infra is a stack decision outside `/akili-test`'s scope, not something to improvise mid-suite | §5 above; also `execution.md` T-001/T-003 entries |
| `detectedCountryConfidence` as a wrong-type value (e.g. numeric string `"0.9"`) | Low-value incremental hardening beyond what `requirements.md` names as a scenario; the `typeof === 'number'` guard already exists and is exercised indirectly via the "missing key" case | Backend Tester's independent-scan note |
| Dialog accessibility beyond the shadcn `Dialog` primitive's defaults (`aria-describedby` wiring, focus trap under real Radix behavior) | Not verifiable under the current `radix-ui.js` jsdom mock, which doesn't replicate Radix's real id-linking; `requirements.md` §10 already named this as an accepted risk at spec-writing time | `requirements.md` §10; Frontend Tester's independent investigation |
| Real-world LLM classification accuracy of `detectedCountry` on diverse business plans | Not unit-testable; mitigated by the ≥0.7 confidence gate and real, live Bedrock calls (T-004, and again after DD-CMV-007's prompt rewrite — see addendum below) | `requirements.md` §10; `execution.md` T-004 and T-003-reopen entries |

## 10. Addendum (2026-08-19) — DD-CMV-007: `detectedCountry` Widened Beyond The 4-Country Allowlist

The user's own manual browser test before archiving found that a business plan describing an unsupported country (Malawi) produced no dialog at all — the original design silently discarded any detection outside the 4-country allowlist. `requirements.md`/`design.md` were revised (BR-CMV-001, DD-CMV-007) and the backend/frontend were re-implemented through the same Implementer → Reviewer gate. This addendum records the resulting test changes; the rest of this report (§2-§9) still accurately describes everything it originally covered and is not otherwise superseded.

| Change | Test | Result |
|---|---|---|
| `normalizeDetectedCountry()` no longer requires `isSupportedCountry()` | `gap-detection.handler.spec.ts::persists a confidently-detected country outside the 4-country allowlist instead of normalizing it to null (DD-CMV-007 / BR-CMV-001 revised)` — uses "Malawi" | PASS |
| Length/emptiness defensive bounds (replacing the old allowlist check) | 3 new/updated `it.each` rows: exactly 100 chars (accepted), 101 chars (rejected), empty-after-trim (rejected), case-insensitive `"unclear"` (rejected) | PASS |
| `countryMismatch` no longer requires `isSupportedCountry()` on the frontend | `gap-detector-client.test.tsx::SHOWS the dialog when detectedCountry is a confidently-detected country outside the 4-country allowlist (FR-CMV-002 Sc1b)` — flips the old "Atlantis skips the dialog" test | PASS |
| `CountryBadge` degrades gracefully for an unrecognized country name | Verified by both Reviewers by reading `getCountryFlag()`'s `?? ''` fallback directly — confirmed zero code change was needed, not just claimed | PASS (structural) |
| Widened prompt still resists anchoring and returns clean values | Live Bedrock call (no mocks): `{{country}}`="Nigeria" + Malawi-describing text → `detectedCountry: "Malawi"`, confidence 0.95; regression check with `{{country}}`="Zambia" + Kenya-describing text → `detectedCountry: "Kenya"`, confidence 0.95, model's own reasoning explicitly rejected the injected anchor | PASS |

Full backend suite: 20/20 (was 16/16 before this addendum). Full frontend suite: 15/15 (unchanged count — one test flipped in place, not added).
