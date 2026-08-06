# Archive Summary — Tracking Analytics (GA4 + Microsoft Clarity)

## 1. Document Control

| Field | Value |
|-------|-------|
| **Original spec path** | `docs/specs/enhancements/tracking-analytics` |
| **Archive date** | 2026-08-06 |
| **Depth** | Lite |
| **Final status** | **Validated PASS, archive-ready** — 0 FAIL, 0 BLOCKED across `/akili-execute`, `/akili-test`, `/akili-validate` |

## 2. Original Spec Path

`docs/specs/enhancements/tracking-analytics/` → `docs/specs/archive/2026-08-06-enhancements--tracking-analytics/`

## 3. Archive Date

2026-08-06

## 4. Final Status

| Gate | Result |
|---|---|
| `/akili-specify` (Lite) | Approved after Judgment Day round 2 — 4 confirmed severe findings (C1–C4) fixed, `APPROVED ✅` |
| `/akili-execute` | 4/4 tasks PASS on first Implementer attempt (0 rework, 0 HALT, 0 pivot) |
| `/akili-test` | PASS — 9/9 tests, 0 PRODUCT_BUG. Closed 2 coverage gaps (S4, S5) discovered during test authoring |
| `/akili-validate` | PASS WITH WARNINGS → all 12 WARN items resolved (documentation drift + verification-command fidelity, zero product defects) |

## 5. Requirements Delivered

| ID | Delivered |
|---|---|
| FR-TRK-001 | Conditional script loading (GA4 + Clarity), structural `null`-guard |
| FR-TRK-002 | GA4 `page_view` fires exactly once per view (initial load + navigation), `send_page_view: false` prevents double-count |
| FR-TRK-003 | Non-blocking `afterInteractive` load strategy, pinned by test |
| NFR-TRK-010 | Build succeeds with/without env vars; `Suspense` boundary holds under static export |
| NFR-TRK-011 | No hardcoded IDs — verified by diff review |
| BR-TRK-001 | `NEXT_PUBLIC_*` env vars only; deploy script survives unset vars under `set -u` |

## 6. Files Changed Summary (from `execution.md`)

| File | Type | Task |
|---|---|---|
| `packages/web/src/components/analytics/google-analytics.tsx` | New | T-001 |
| `packages/web/src/hooks/use-analytics-pageview.ts` | New | T-001 |
| `packages/web/src/components/analytics/microsoft-clarity.tsx` | New | T-002 |
| `packages/web/src/components/admin/user-management.tsx` | Modified (+1 attr) | T-002 |
| `packages/web/src/components/gap-detector/document-viewer.tsx` | Modified (+1 attr) | T-002 |
| `scripts/deploy-web.sh` | Modified (+2 lines) | T-004 |
| `packages/web/src/app/layout.tsx` | Modified (+2 components) | T-003 |
| `packages/web/.env.example` | New | T-003 |
| `packages/web/CLAUDE.md` | Modified (Analytics section) | T-003 |
| 3 test files under `__tests__/` | New | T-001, T-002, `/akili-test` |

**Actual LOC:** ~370 (vs. ~150 estimated at design time — test-file volume was undercounted; recorded as a budgeting-accuracy note, not a scope-creep finding).

## 7. Test Evidence Summary

- 3 suites, 9 tests, 0 failures, 0 `PRODUCT_BUG`.
- No integration/E2E harness exists in this repo; the equivalent verification was a one-time headless-Chrome check during T-003 (documented in `execution.md`, not repeatable/CI-wired — recorded as an accepted gap).
- Full detail: `test-report.md`.

## 8. Validation Summary

- 0 FAIL, 0 BLOCKED, 26 PASS, 12 WARN (all resolved before archive — see `validation-report.md` §11).
- All 4 confirmed Judgment Day findings (C1–C4) independently re-verified fixed in the running build (headless Chrome, real `dataLayer`/`gtag`/`clarity` inspection), not just claimed fixed in prior documents.
- Full detail: `validation-report.md`.

## 9. Accepted Warnings / Follow-Ups (tracked outside this spec)

| Item | Scope | Priority |
|---|---|---|
| No operator-facing instruction that `deploy-web.sh` needs the two env vars exported before deploy | `docs/infrastructure.md` or root `CLAUDE.md` | Medium — residual half of C2 |
| `pnpm ... test -- --testPathPattern=...` (double `--`) produces a false green / hard failure repo-wide | Root `CLAUDE.md`, `packages/api/CLAUDE.md`, `packages/web/CLAUDE.md` | **Fixed during this archive pass — see Kaizen §below** |
| `JSON.stringify` the interpolated ID in both inline `<script>` bodies | `packages/web` | Low |
| Extend `data-clarity-mask` to the delete-confirmation dialog email + user search input | `packages/web` | Low, accepted risk |
| Dev/prod analytics separation now that `.env.local` points local builds at the production GA property | `packages/web` | Medium, data hygiene |
| Consider Playwright for `packages/web` to make the T-003 browser verification repeatable | New spec | Low — deferred stack decision |

## 10. Historical Notes

- This spec's design went through a full 2-round Judgment Day adversarial review before any code was written — 3 severe findings confirmed by both independent judges (C1: vacuous build check, C2: feature ships inert in production, C3: `page_view` double-count) plus 1 corroborated (C4: Clarity PII exposure on authenticated routes). All 4 were fixed pre-implementation.
- The re-judgment round (round 2) surfaced 4 sub-severe findings (N1–N4) that were folded directly into `tasks.md` rather than also updating `design.md` — this caused `design.md` to drift from the shipped code by the time of `/akili-validate`, which had to spend a full pass rediscovering and re-fixing 3 specific contradictions. See Kaizen lesson below.
- The `/akili-execute` Reviewers were unusually thorough for a Lite spec: the T-001 Reviewer built a jsdom harness to empirically count `dataLayer` entries rather than trust the Implementer's claim; the T-003 Reviewer served the actual static export in headless Chrome. Both went beyond the spec's own specified checks.
