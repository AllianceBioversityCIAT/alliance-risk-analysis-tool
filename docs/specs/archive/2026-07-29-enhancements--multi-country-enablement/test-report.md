# Test Report — Multi-Country Enablement

## 1. Document Control

| Field | Value |
|-------|-------|
| **Spec path** | `enhancements/multi-country-enablement` |
| **Tested** | 2026-07-27 |
| **Leader** | AKILI test harness (Cursor session) |
| **Implementation ref** | `execution.md` v1.0, `validation-report.md` |
| **Suites run** | 9 (7 API unit, 2 Web unit) |
| **Testers spawned** | 0 — Leader ran inline (gap remediation + suite execution; Deployment Rule: focused test additions cheaper than subagent spawn) |

---

## 2. Summary

| Metric | Result |
|--------|--------|
| **Overall status** | **PASS WITH ACCEPTED GAPS** |
| **Automated tests** | **71 passed**, 0 failed, 0 skipped |
| **Product bugs (`PRODUCT_BUG`)** | **0** |
| **Requirements with automated evidence** | 11 / 15 |
| **Scenarios fully automated** | 14 / 22 |
| **Integration / E2E** | Not run — unit coverage sufficient for MVP gate; manual QA deferred |

**Answer:** Core multi-country behavior is covered by 71 passing unit tests across API validation, service filtering, AI prompt injection (all three handlers), and frontend hooks/modal. Residual gaps are UI persistence, header filter integration, empty-state flows, and HTTP-level 400 assertions — accepted for archive with documented manual steps.

**Tests added in this run:**

| File | Tests added |
|------|-------------|
| `packages/api/src/common/validators/is-supported-country.validator.spec.ts` | List + stats query DTO validation (+ `reflect-metadata` import fix) |
| `packages/api/src/platform/jobs/handlers/gap-detection.handler.spec.ts` | New — Zambia country injection in upload mode |
| `packages/api/src/platform/jobs/handlers/report-generation.handler.spec.ts` | Nigeria country injection during `execute` |

---

## 3. Commands Run

### API — multi-country suites

```bash
cd packages/api && npx jest \
  --testPathPattern="is-supported-country|assessments\.(service|controller)|variable-injection|gap-detection\.handler|risk-analysis\.handler|report-generation\.handler" \
  --no-coverage
```

| Result | Detail |
|--------|--------|
| **PASS** | 7 suites, **67 tests** passed in ~6s |

### Web — multi-country suites

```bash
cd packages/web && npx jest \
  --testPathPattern="start-assessment-modal|use-assessments" \
  --no-coverage
```

| Result | Detail |
|--------|--------|
| **PASS** | 2 suites, **4 tests** passed in ~5s |

### Not run (accepted gaps)

| Command | Reason |
|---------|--------|
| `pnpm test` (full monorepo) | Scoped to spec-related suites only |
| API e2e (`pnpm --filter @alliance-risk/api test:e2e`) | No e2e spec for country filter; DTO validation covered at unit layer |
| Playwright / browser E2E | No E2E harness in repo for dashboard header flow |
| Manual stack (`pnpm dev`) | Deferred to pre-production QA checklist |

---

## 4. Backend Unit Tests

| Suite | Tests | Status |
|-------|-------|--------|
| `is-supported-country.validator.spec.ts` | 4 | PASS |
| `assessments.service.spec.ts` | (country filter, stats, draft update) | PASS |
| `assessments.controller.spec.ts` | (stats country param) | PASS |
| `variable-injection.service.spec.ts` | 14 | PASS |
| `gap-detection.handler.spec.ts` | 1 | PASS |
| `risk-analysis.handler.spec.ts` | (incl. country in Bedrock prompts) | PASS |
| `report-generation.handler.spec.ts` | (incl. country in Bedrock prompts) | PASS |

**Key assertions:**

- Supported countries accepted; `Uganda` rejected on create, list query, and stats query DTOs
- `findAll` / `getStats` apply `country` to Prisma `where`
- DRAFT-only country update; non-DRAFT rejects
- `injectCountry` / `injectAll` replace `{{country}}`
- Gap, risk, and report handlers pass assessment country into Bedrock `systemPrompt` and `userPrompt`

---

## 5. Frontend Unit Tests

| Suite | Tests | Status |
|-------|-------|--------|
| `start-assessment-modal.test.tsx` | 2 | PASS |
| `use-assessments.test.ts` | 2 | PASS |

**Key assertions:**

- Modal renders exactly four country options (Kenya, Ethiopia, Nigeria, Zambia)
- Create payload includes `country: 'Kenya'` (default from mocked active filter)
- `useAssessments({ country: 'Nigeria' })` sends `country=Nigeria` to list API
- `useAssessmentStats('Ethiopia')` uses country in queryKey and stats API params

---

## 6. Integration Tests

| Area | Status | Notes |
|------|--------|-------|
| API Gateway + ValidationPipe 400 on invalid `?country=` | **GAP** | DTO unit tests prove validation; no supertest/e2e asserting HTTP 400 body |
| Full job pipeline with real Bedrock | **GAP** | Handler unit tests mock Bedrock; acceptable for spec depth |
| Dashboard list + stats + header filter end-to-end | **GAP** | Requires running web + API; manual QA |

---

## 7. E2E Tests

| Journey | Status | Notes |
|---------|--------|-------|
| Select Nigeria in header → table shows Nigeria only | **GAP** | No Playwright/Cypress in repo |
| Persist Ethiopia in localStorage → restore on reload | **GAP** | `CountryFilterProvider` untested |
| Start assessment pre-fill from active filter | **GAP** | Modal test mocks provider with Kenya only |
| Web report / PDF shows assessment country | **GAP** | Pre-existing report components; out of unit scope |

---

## 8. Coverage & Traceability

| Requirement | Scenario | Test Type | Test File / Command | Result | Gap or Notes |
|-------------|----------|-----------|---------------------|--------|--------------|
| FR-MC-001 | Four options in modal | Unit | `start-assessment-modal.test.tsx` | PASS | — |
| FR-MC-001 | No free-text entry | Unit | Modal uses Select (code review) | PARTIAL | No negative test for text input |
| FR-MC-002 | Create with selected country | Unit | `start-assessment-modal.test.tsx` | PASS | Default Kenya only; Nigeria path not asserted |
| FR-MC-002 | API rejects invalid country | Unit | `is-supported-country.validator.spec.ts` | PASS | DTO layer; not HTTP 400 |
| FR-MC-002 | Default Kenya when omitted | Unit | `assessments.service.spec.ts` (implicit via create) | PASS | — |
| FR-MC-003 | Pass `country=Nigeria` to list API | Unit | `use-assessments.test.ts` | PASS | — |
| FR-MC-003 | API list filter by country | Unit | `assessments.service.spec.ts` | PASS | — |
| FR-MC-003 | 400 invalid list country | Unit | `is-supported-country.validator.spec.ts` | PASS | HTTP integration gap |
| FR-MC-003 | Empty state Zambia | — | — | GAP | Manual / E2E |
| FR-MC-003 | Pre-select Zambia in modal | — | — | GAP | Provider pre-fill untested |
| FR-MC-004 | Stats scoped to country | Unit | `assessments.service.spec.ts`, `use-assessments.test.ts` | PASS | — |
| FR-MC-005 | Restore filter from localStorage | — | — | GAP | Should-priority; manual QA |
| FR-MC-005 | Default Kenya if invalid stored | — | — | GAP | Manual QA |
| FR-MC-006 | Country badge on dashboard row | — | — | GAP | Component exists; no test |
| FR-MC-006 | Country on web report / PDF | — | — | GAP | Pre-existing; manual QA |
| FR-MC-007 | Update country on DRAFT | Unit | `assessments.service.spec.ts` | PASS | — |
| FR-MC-007 | Block update non-DRAFT | Unit | `assessments.service.spec.ts` | PASS | — |
| FR-MC-008 | Risk analysis injection | Unit | `risk-analysis.handler.spec.ts` | PASS | — |
| FR-MC-008 | Gap detection injection | Unit | `gap-detection.handler.spec.ts` | PASS | Added this run |
| FR-MC-008 | Report generation injection | Unit | `report-generation.handler.spec.ts` | PASS | Added this run |
| FR-MC-008 | Unreplaced placeholder warning | Unit | `variable-injection.service.spec.ts` | PARTIAL | Warning path via `warnIfHardcodedKenyaWithoutPlaceholder` — no dedicated test |
| FR-MC-009 | Country Select in modal | Unit | `start-assessment-modal.test.tsx` | PASS | — |
| FR-MC-009 | No MVP locked Kenya messaging | Manual | Code review | PASS | No automated assertion |
| FR-MC-009 | Pre-fill from active filter | — | — | GAP | Mock fixes Kenya |
| FR-MC-010 | Header filter refreshes list/stats | — | — | GAP | `app-header.tsx` untested |
| NFR-MC-001 | Single source of truth | Static | `supported-countries.ts` imported by API + Web | PASS | No dedicated shared package test |
| NFR-MC-002 | No schema migration | Static | Prisma schema unchanged | PASS | Validation report |
| NFR-MC-003 | Backward compatibility | Unit | Create default + optional country filter | PASS | — |
| NFR-MC-004 | List API performance | — | — | GAP | Index on `country` assumed; no perf test |
| NFR-MC-005 | Implementation documentation | Static | `implementation-note.md` exists | PASS | — |

---

## 9. Remediation

| Priority | Item | Action |
|----------|------|--------|
| Low | HTTP 400 on invalid `?country=` | Add supertest case in `assessments.controller.spec.ts` or e2e |
| Low | `CountryFilterProvider` localStorage | Unit test with `localStorage` mock |
| Low | Header filter integration | RTL test for `app-header.tsx` changing `activeCountry` |
| Low | Modal pre-fill from filter | Test with `activeCountry: 'Ethiopia'` mock |
| Pre-prod | Manual QA per country | Run one full assessment per country per `implementation-note.md` |
| Pre-prod | Production prompts | Admin updates active prompts with `{{country}}` |

No **PRODUCT_BUG** failures require code fixes before archive.

---

## 10. Accepted Gaps

| Gap | Reason |
|-----|--------|
| E2E dashboard / header flows | No browser test harness in repo; unit + manual QA sufficient for Standard depth |
| localStorage persistence (FR-MC-005) | Should-priority; provider logic is straightforward |
| Report/PDF country display (FR-MC-006) | Pre-existing report pipeline; country field already on assessment entity |
| Empty state + Zambia pre-select scenarios | UI-only; low regression risk with hook tests in place |
| Full monorepo `pnpm test` | Spec-scoped suites all green; unrelated packages out of scope |
| `warnIfHardcodedKenyaWithoutPlaceholder` | Logging-only graceful degradation; injection tests cover happy path |

---

## 11. Verdict

**PASS WITH ACCEPTED GAPS** — All spec-targeted automated suites pass (71/71). Requirement coverage is strong for API validation, filtering, AI injection, and core frontend data flow. Documented gaps are Should-priority UX persistence, E2E journeys, and HTTP integration assertions suitable for pre-production manual QA or a follow-up test task.

Recommended next step: `/akili-archive @docs/specs/enhancements/multi-country-enablement/` after stakeholder review of accepted gaps.
