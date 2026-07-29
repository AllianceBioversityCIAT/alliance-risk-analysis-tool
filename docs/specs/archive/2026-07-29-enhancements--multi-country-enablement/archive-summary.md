# Archive Summary — Multi-Country Enablement

## 1. Document Control

| Field | Value |
|-------|-------|
| **Spec path (original)** | `enhancements/multi-country-enablement` |
| **Archive date** | 2026-07-29 |
| **Type** | Change (enhancement) |
| **Source references** | `proposal.md`, `requirements.md` v1.0, `design.md` v1.0, `tasks.md`, `execution.md`, `test-report.md`, `validation-report.md`, `implementation-note.md` |

## 2. Original Spec Path

`docs/specs/enhancements/multi-country-enablement/`

## 3. Archive Date

2026-07-29

## 4. Final Status

**PASS — archived as complete.** All 11 implementation tasks `[x]`, all automated tests passing, validation verdict PASS with all actionable WARNs resolved before archive.

## 5. Requirements Delivered

| ID | Title | Result |
|----|-------|--------|
| FR-MC-001 | Supported country catalog (4 countries) | Delivered |
| FR-MC-002 | Country required on assessment create | Delivered |
| FR-MC-003 | Country filter on assessment list | Delivered |
| FR-MC-004 | Dashboard stats scoped to active country | Delivered |
| FR-MC-005 | Persist active country filter (Should) | Delivered |
| FR-MC-006 | Country display throughout assessment lifecycle | Delivered |
| FR-MC-007 | Update country on draft assessments (Should) | Delivered |
| FR-MC-008 | AI prompt country context injection | Delivered |
| FR-MC-009 | Start-assessment modal country selector | Delivered |
| FR-MC-010 | Header context selector as functional filter | Delivered |
| NFR-MC-001 | Single source of truth for countries | Delivered |
| NFR-MC-002 | No schema migration required | Delivered (confirmed — no migration added) |
| NFR-MC-003 | Backward compatibility | Delivered |
| NFR-MC-004 | List API performance (Should) | Deferred by design (DD-MC-007) — no index added; add only if profiling shows need |
| NFR-MC-005 | Implementation documentation | Delivered |

No requirements dropped. No scope expansion beyond `proposal.md` Option A.

## 6. Files Changed Summary

Based on `execution.md` and independently re-verified against the live tree during validation.

| Area | New | Modified |
|------|-----|----------|
| `@alliance-risk/shared` | `constants/supported-countries.ts` | `types/assessment.types.ts`, `index.ts` |
| `@alliance-risk/api` | `common/validators/is-supported-country.validator.ts` (+spec), `domain/assessments/dto/assessment-stats-query.dto.ts`, `platform/jobs/handlers/gap-detection.handler.spec.ts` | `assessments.controller.ts`, `assessments.service.ts`, `create/update/list-assessments-query.dto.ts`, `dto/index.ts`, `variable-injection.service.ts` (+spec), `gap-detection.handler.ts`, `risk-analysis.handler.ts` (+spec), `report-generation.handler.ts` (+spec), `prisma/seed.ts` |
| `@alliance-risk/web` | `providers/country-filter-provider.tsx`, `components/shared/country-badge.tsx`, `hooks/__tests__/use-assessments.test.ts`, `components/assessment/__tests__/start-assessment-modal.test.tsx` | `hooks/use-assessments.ts`, `components/layout/app-header.tsx`, `components/layout/app-layout.tsx`, `components/assessment/start-assessment-modal.tsx`, `components/dashboard/assessment-table-row.tsx`, `components/dashboard/assessment-table.tsx`, `components/shared/assessment-page-shell.tsx`, `components/shared/assessment-top-bar.tsx`, `app/(protected)/dashboard/page.tsx`, `app/(protected)/assessments/gap-detector/gap-detector-client.tsx`, `app/layout.tsx` |
| Docs | `implementation-note.md` | `docs/prd.md` (geography line) |
| Root tooling (unrelated pre-existing issue, fixed during validation) | — | `pnpm-workspace.yaml`, `package.json`, root `CLAUDE.md` |

No Prisma schema or migration changes (NFR-MC-002).

## 7. Test Evidence Summary

| Metric | Result |
|--------|--------|
| Spec-targeted automated tests | 71 passed, 0 failed, 0 `PRODUCT_BUG` |
| Full API regression suite | 369 passed, 2 skipped, 0 failed |
| Full Web regression suite | 95 passed, 4 failed — confirmed pre-existing and unrelated via `git stash` against pre-diff baseline |
| Requirements with automated evidence | 11 / 15 fully automated; remainder covered by direct code verification + accepted manual-QA gaps |

Full detail in `test-report.md` (retained in the archived folder).

## 8. Validation Summary

| Check | Result |
|-------|--------|
| Task completion | PASS — 11/11, independently re-verified against live source |
| File existence | PASS — all 32 files present |
| Build integrity | PASS — `tsc`/`nest build`/`next build`/`eslint` all clean; `pnpm build`/`lint` wrapper repaired during validation |
| Requirement coverage | PASS — 0 FAIL |
| Design conformance | PASS — 1 documented, reasoned deviation (provider mount location) |
| Archive readiness | Ready |

Full detail in `validation-report.md` (retained in the archived folder).

## 9. Accepted Warnings Or Follow-Ups

| Item | Status at archive | Follow-up |
|------|--------------------|-----------|
| `implementation-note.md` provider-location note | **Fixed** before archive | — |
| `pnpm-workspace.yaml` `allowBuilds` placeholders (unrelated pre-existing issue) | **Fixed** before archive | — |
| `proposal.md` status | **Fixed** — set to Approved | — |
| HTTP-level 400 test for invalid `?country=` | Accepted gap | Optional supertest follow-up |
| `CountryFilterProvider` localStorage unit test | Accepted gap | Optional RTL test |
| Production prompt update (admin checklist) | Open — pre-production step | Apply the 3 prompt texts (gap_detector, risk_analysis, report_generation) via Prompt Manager per `implementation-note.md` |
| Manual QA per country | Open — pre-production step | Run `tasks.md` §7 checklist (one assessment per country) before/at production rollout |

## 10. Historical Notes

- This is the **first spec archived** in this project — `docs/specs/archive/` and `docs/specs/kaizen-log.md` were created as part of this archive.
- `CountryFilterProvider` was deliberately mounted at root `app/layout.tsx` instead of `(protected)/layout.tsx` as originally designed, so `(admin)` routes using `AppLayout` don't crash without the provider. Documented in `execution.md` (T-007) and now consistently reflected in `implementation-note.md`.
- No new package or module boundary was introduced; changes extend `@alliance-risk/shared`, `@alliance-risk/api`, and `@alliance-risk/web` in place. No `## Constitution Impact` blocks were present in `execution.md`.
- Root `CLAUDE.md`, `packages/api/CLAUDE.md`, and `packages/web/CLAUDE.md` were lightly updated during archive to reflect new files (`common/validators/`, `AssessmentStatsQueryDto`, `country-filter-provider.tsx`) and the `pnpm-workspace.yaml` `allowBuilds` tooling fix.
