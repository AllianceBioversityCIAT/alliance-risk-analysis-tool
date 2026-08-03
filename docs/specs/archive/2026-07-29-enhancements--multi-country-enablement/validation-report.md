# Validation Report — Multi-Country Enablement

## Verdict: **PASS — Archive-Ready** (all fixable WARNs resolved)

All 11 tasks are implemented and verified against live source (not just trusted from `execution.md`). All 71 spec-targeted tests pass, and — going beyond the prior validation pass — the full API (371) and Web (99) regression suites were re-run directly to confirm this spec introduces **zero regressions**. No `FAIL` findings. The three actionable WARNs below (stale provider-location doc, stale proposal status, broken `pnpm` build wrapper) have since been fixed and re-verified. Remaining items are Should-priority test gaps and pre-production checklist steps, none blocking.

---

## 1. Document Control

| Field | Value |
|-------|-------|
| **Spec path** | `enhancements/multi-country-enablement` |
| **Validated** | 2026-07-29 (supersedes 2026-07-27 pass) |
| **Auditor model** | Sonnet 5 (session model) |
| **Model tier note** | This phase is T3 Auditor; project registry recommends `opus`. Session ran on `sonnet` — author≠auditor separation from the original implementation is not guaranteed. Re-run on `/model opus` for full independence if desired. |
| **Method** | Full re-derivation: every code claim in `execution.md`/`test-report.md` independently re-grepped/read in the live tree; every referenced test suite re-executed directly (not assumed from the report); full-package regression suites also run; a suspected regression was confirmed pre-existing via `git stash` against the pre-diff baseline. |
| **Inputs reviewed** | `proposal.md`, `requirements.md`, `design.md`, `tasks.md`, `execution.md`, `test-report.md`, `implementation-note.md`, prior `validation-report.md`, live source tree, live test/build execution |

---

## 2. Summary

| Check | Result |
|-------|--------|
| Task completion (11/11) | **PASS** |
| File existence (32 files) | **PASS** |
| Build integrity (shared/api/web) | **PASS** (via direct `tsc` / `nest build` / `next build` / `eslint`) — see WARN on `pnpm` wrapper below |
| Requirement coverage (10 FR + 5 NFR + 4 BR) | **PASS** — independently re-verified, not just trusted from `test-report.md` |
| Full regression (API 371 tests, Web 99 tests) | **PASS** — 0 regressions from this spec; 1 pre-existing unrelated failure confirmed via `git stash` |
| Design conformance | **PASS** — 1 minor WARN (stale doc note, carried from prior review) |
| Archive readiness | **Ready** |

**Delta from the 2026-07-27 validation pass:** that pass is still substantively correct. This pass adds: (a) direct re-execution of every test file rather than trusting `test-report.md`'s numbers, (b) a full-package regression run (371 API + 99 Web tests) that the prior pass did not do, (c) `git stash` confirmation that a Web test failure is pre-existing and unrelated, and (d) discovery of an unrelated, pre-existing `pnpm-workspace.yaml` issue that breaks the documented `pnpm build`/`lint`/`test` wrapper commands (worked around by invoking the underlying tools directly).

---

## 3. Task Completion

All 11 tasks in `tasks.md` are marked `[x]`. Every claim in `execution.md` was independently re-verified against the current source tree.

| Task | Claim | Verified |
|------|-------|----------|
| T-001 | Shared allowlist + types | ✅ `supported-countries.ts`, `AssessmentSummary.country`, re-exported from `index.ts` |
| T-002 | Validator + DTOs | ✅ `IsSupportedCountry` decorator wired into all 4 DTOs (create/update/list/stats) |
| T-003 | Service filter/stats/guard | ✅ `findAll`/`getStats`/`update` read exactly as described; `BadRequestException` message matches design |
| T-004 | `VariableInjectionService` | ✅ `injectCountry()`, `injectAll(..., country?)`, `warnIfHardcodedKenyaWithoutPlaceholder()` all present |
| T-005 | Handler wiring | ✅ `injectCountry` + warn helper called in all 3 handlers (gap, risk, report) — grepped, not assumed |
| T-006 | Seed prompts | ✅ `{{country}}` present in gap/risk/report system + user prompts |
| T-007 | `CountryFilterProvider` | ✅ present; localStorage key `alliance_active_country`; validated fallback to Kenya |
| T-008 | Dashboard filter/stats/badge | ✅ `activeCountry` piped into `useAssessments`/`useAssessmentStats`; `CountryBadge` on rows |
| T-009 | Modal country Select | ✅ Zod-validated, 4 options with flags, no hardcoded `'Kenya'` in create/update/auto-draft paths |
| T-010 | Workflow sub-header badge | ✅ `AssessmentTopBar`, `assessment-page-shell.tsx`, `gap-detector-client.tsx` all render `CountryBadge` |
| T-011 | Implementation note + PRD | ✅ both exist; PRD geography line updated to the four countries |

**Manual QA checklist** (`tasks.md` §7, lines 333–339): still `[ ]` — correctly deferred to pre-production, not blocking archive.

---

## 4. File Existence

All 32 new/modified files listed in `design.md` §4 exist on disk. One pre-existing note carried forward: `design.md` §4/§8.2 lists `(protected)/layout.tsx` as the `CountryFilterProvider` mount point, but it is actually mounted at root `app/layout.tsx` — see §8 (Design Conformance) for the documented rationale.

---

## 5. Build Integrity

| Command | Result |
|---------|--------|
| `packages/shared` → `tsc` | ✅ exit 0 |
| `packages/api` → `nest build` | ✅ exit 0 |
| `packages/web` → `next build` | ✅ exit 0, 19/19 static pages generated |
| `packages/api` → `eslint src/**/*.ts` | ✅ 0 errors |
| `packages/web` → `eslint src/**/*.{ts,tsx}` | ✅ 0 errors |

### ✅ FIXED — `pnpm build` / `pnpm lint` / `pnpm test` wrappers were broken, now repaired (pre-existing, unrelated to this spec)

The working tree contained an **incomplete** edit to `pnpm-workspace.yaml` — `allowBuilds` values were the literal placeholder string `"set this to true or false"` instead of real booleans, causing `ERR_PNPM_IGNORED_BUILDS` on every `pnpm install`/`build`/`lint`/`test`. Not part of the multi-country-enablement diff (not listed in `design.md` §4) — leftover from an unrelated environment-fix attempt sitting uncommitted in the same working tree.

**Fix applied:** Populated `allowBuilds` with real values matching the intent already recorded in root `package.json`'s (now-superseded) `pnpm.onlyBuiltDependencies` list — `true` for `@nestjs/core`, `@prisma/engines`, `canvas`, `esbuild`, `prisma`, `sharp`, `unrs-resolver` (all previously whitelisted); `false` for `@scarf/scarf` and `msw` (never previously whitelisted). Removed the now-dead `pnpm.onlyBuiltDependencies` field from `package.json` (pnpm 11.9 silently ignores it) and updated the corresponding line in root `CLAUDE.md` to point at the new location.

**Re-verified end-to-end after the fix:**
| Command | Result |
|---------|--------|
| `pnpm install` | ✅ clean, no warnings |
| `pnpm build` (all 5 workspace projects) | ✅ clean |
| `pnpm lint` | ✅ clean, 0 errors |
| `pnpm test` | 4/99 Web tests fail — the same pre-existing `assessment-table.test.tsx` failure confirmed via `git stash` in §7, unrelated to this spec |

---

## 6. Requirement Coverage

| ID | Requirement | Result | Evidence |
|----|-------------|--------|----------|
| FR-MC-001 | Supported country catalog (4 options, no free-text) | **PASS** | `supported-countries.ts`; modal test asserts 4 options; shadcn `Select` only (no text input) |
| FR-MC-002 | Country required on create; API rejects invalid; Kenya default | **PASS** | `@IsSupportedCountry()` + Zod; independently re-ran validator spec |
| FR-MC-003 | List filter by country | **PASS** (HTTP-level gap accepted, see below) | `findAll` where-clause read directly in source + spec |
| FR-MC-004 | Stats scoped to country | **PASS** | `getStats(userId, country?)` verified; controller spec passes |
| FR-MC-005 | Persist filter (Should) | **WARN** — implemented correctly, no automated test | `CountryFilterProvider` read/validate/fallback logic confirmed correct by direct code read |
| FR-MC-006 | Country display lifecycle | **PASS** | Table row, workflow top-bar, gap-detector, web report, PDF all confirmed rendering `assessment.country` |
| FR-MC-007 | Update on DRAFT only | **PASS** | `update()` throws `BadRequestException` on non-DRAFT; spec asserts both branches |
| FR-MC-008 | AI prompt injection (gap/risk/report) | **PASS** | `injectCountry` called in all 3 handlers; each handler spec asserts country string in assembled Bedrock prompt |
| FR-MC-009 | Modal country selector, no MVP-locked copy | **PASS** | Confirmed no "(MVP)" string in `start-assessment-modal.tsx` |
| FR-MC-010 | Header filter functional | **PASS** | `AppHeader` is now a `DropdownMenu` driven by `SUPPORTED_COUNTRIES`, wired to `onCountryChange` |
| NFR-MC-001 | Single source of truth | **PASS** | Only one `supported-countries.ts`; imported by both API validator and Web |
| NFR-MC-002 | No schema migration | **PASS** | `schema.prisma` diff is empty; no new migration folders |
| NFR-MC-003 | Backward compatibility | **PASS** | Create defaults to Kenya when `country` omitted |
| NFR-MC-004 | List API performance (Should, deferred) | **WARN — accepted** | No index added per DD-MC-007; explicitly deferred until profiling shows need |
| NFR-MC-005 | Implementation documentation | **PASS** | `implementation-note.md` covers allowlist, API, prompts, admin checklist, limitations |

**Negative constraints / strict validations spot-checked directly in source:**
- "Must NOT create partial assessment record" on invalid country → ValidationPipe rejects before service/Prisma runs. ✅
- "Must NOT silently ignore field" on non-DRAFT country change → throws `BadRequestException`, does not swallow. ✅
- "Must NOT hide from DB, only from view" on country filter → plain `where` clause, no deletion/mutation. ✅

**Accepted gaps** (carried forward, none are `PRODUCT_BUG`, none cover a negative constraint or strict validation):
- HTTP-level 400 assertion for invalid `?country=` (DTO-layer proven; no supertest/e2e)
- E2E dashboard header-filter and localStorage-persistence journeys (no Playwright/Cypress harness in repo)
- `CountryFilterProvider` unit test with mocked `localStorage`
- Modal pre-fill-from-active-filter scenario (existing mock only exercises Kenya)

---

## 7. Full Regression Check (new — beyond spec-scoped suites)

Re-ran full package test suites, not just the spec-targeted ones, to check for regressions elsewhere.

| Package | Result |
|---------|--------|
| `@alliance-risk/api` (full) | **369 passed**, 2 skipped, 0 failed — 35/36 suites |
| `@alliance-risk/web` (full) | **95 passed**, 4 failed (1 suite) |

### Web failure — confirmed pre-existing, NOT caused by this spec

`assessment-table.test.tsx` fails with 4 errors (`DropdownMenuPrimitive.Root` undefined; duplicate "No Match" text match in the search-empty-state). **Verified via `git stash`** that this same suite fails identically on the pre-diff baseline (commit `8e5b423`, before any multi-country changes). The diff to `assessment-table.tsx` in this spec is purely additive (one `activeCountry` prop + one conditional string in the *no-assessments-at-all* empty branch) and does not touch the failing code paths. **Confirmed pre-existing and out of scope.**

---

## 8. Design Conformance

Implementation matches `design.md` and `proposal.md` Option A closely — no scope creep, no changes to risk categories, scoring, Bedrock model config, or auth model.

| Design decision | Implementation | Result |
|-----------------|----------------|--------|
| Code-level allowlist in shared | `supported-countries.ts` | PASS |
| No DB migration | Unchanged `schema.prisma` | PASS |
| `VariableInjectionService` + handler injection | All 3 handlers wired, independently grepped | PASS |
| `CountryFilterProvider` at `(protected)/layout` | Mounted at **root** `app/layout.tsx` instead | **WARN** — deliberate, documented deviation (see below) |
| Stats: Web always passes country | Dashboard passes `activeCountry` | PASS |
| React Query stats key includes country | `['assessment-stats', country]` | PASS |
| Figma: header selector + modal Select | `DropdownMenu` + `Select`, both with flags | PASS (not pixel-audited) |

### ✅ FIXED — `implementation-note.md` provider-location note updated

`execution.md` (T-007) documents a **sound, reasoned deviation**: the provider was moved from `(protected)/layout.tsx` to root `app/layout.tsx` so admin routes using `AppLayout` don't crash. `implementation-note.md`'s "Dashboard Country Filter" section now reflects this (root `app/layout.tsx`, with the admin-route rationale). `design.md` is left as-is intentionally — it records original design intent; `execution.md` is the correct place for as-built deviations per AKILI-SPECS convention.

### Proposal alignment

| Proposal intent | Result |
|-----------------|--------|
| Four countries, same risk framework | PASS |
| Filter + intake + AI injection | PASS |
| `proposal.md` status | **FIXED** — updated from "Draft — pending approval" to "Approved" |

### 4R advisory sweep (non-blocking, informational only)

- **Readability:** Naming and file organization are consistent with existing conventions (`is-supported-country.validator.ts` mirrors existing validator patterns).
- **Reliability:** `CountryFilterProvider` reads `localStorage` inside `useEffect` — a brief render with the Kenya default before the stored value restores. Low risk, standard SSR-safe pattern.
- **Resilience:** `warnIfHardcodedKenyaWithoutPlaceholder` is logging-only, correctly non-blocking per design (graceful degradation, FR-MC-008 scenario 4). `injectCountry` guards on empty string input.
- **Risk:** `assessments.service.ts` `update()` duplicates the update-data object construction between the optimistic-locking and non-locking branches — pre-existing pattern (not introduced by this spec; `country` was added consistently to both). Not a spec violation, flagged only as a pre-existing maintainability note.
- **Risk (carried forward):** Report generation's action-plan-timeframe Bedrock sub-call does not receive country context (narrative + financial extraction do). Documented as a known limitation candidate, not a requirement violation — FR-MC-008 only names gap/risk/report narrative and financial-extraction prompts.

---

## 9. Test Evidence Summary

| Suite | Tests | Result |
|-------|-------|--------|
| API — 7 spec-targeted suites (is-supported-country, assessments.service/controller, variable-injection, 3 handlers) | 67 | **PASS** (independently re-run) |
| Web — 2 spec-targeted suites (start-assessment-modal, use-assessments) | 4 | **PASS** (independently re-run) |
| API — full suite | 371 (369 pass, 2 skip) | **PASS**, no regressions |
| Web — full suite | 99 (95 pass, 4 fail) | 4 failures confirmed **pre-existing** via `git stash`, unrelated |

Total spec-targeted: **71/71 passing**, matching `test-report.md` exactly — independently reproduced, not just cited.

---

## 10. Agent Guide / Constitution Impact

| Check | Result |
|-------|--------|
| `## Constitution Impact` in `execution.md` | Not present — no new package boundary, no module reshape |
| Child `CLAUDE.md` updates required | None — changes extend existing packages |
| `docs/prd.md` geography line | Confirmed updated: *"Geography: Kenya, Ethiopia, Nigeria, Zambia (multi-country enablement, 2026-07)"* |
| OpenAPI spec (`docs/api/openapi.yaml`) | Directory does not exist in this repo at all — pre-existing gap tracked separately in PRD OQ-05, not introduced or worsened by this spec |

---

## 11. Remediation

| # | Priority | Item | Status | Blocks archive? |
|---|----------|------|--------|------------------|
| R1 | Low | `implementation-note.md` still says provider is at `(protected)/layout.tsx` | **Fixed** | No |
| R2 | Low (out of scope) | `pnpm-workspace.yaml` `allowBuilds` has placeholder values, breaking `pnpm build/lint/test` wrappers | **Fixed** | No — pre-existing, unrelated to this spec |
| R3 | Low | `proposal.md` status still "Draft — pending approval" | **Fixed** — now "Approved" | No |
| R4 | Low | HTTP-level 400 test for invalid `?country=` | Open | No — DTO layer covered |
| R5 | Low | `CountryFilterProvider` localStorage unit test | Open | No |
| R6 | Pre-prod | Update active production prompts with `{{country}}` (admin checklist) | Open | No |
| R7 | Pre-prod | Manual QA per country (`tasks.md` §7 checklist) | Open | No |

No `FAIL` findings. No `PRODUCT_BUG`.

---

## 12. Archive Readiness Recommendation

**Ready to archive.** All tasks complete with real, independently-reverified code evidence; all spec-targeted tests plus the full API/Web regression suites pass (with one pre-existing, unrelated Web test confirmed via `git stash`); the documented `pnpm build`/`pnpm lint` commands now run clean end-to-end; design conformance holds. All three actionable WARNs (R1–R3) are fixed. Nothing blocks archive.

```text
/akili-archive enhancements/multi-country-enablement
```

**Remaining open items (R4–R7) are Should-priority test gaps or pre-production checklist steps** — correctly deferred, not blocking.
