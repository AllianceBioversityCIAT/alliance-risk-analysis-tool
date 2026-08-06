# Execution Log — Tracking Analytics (GA4 + Microsoft Clarity)

## 1. Document Control

| Field | Value |
|-------|-------|
| **Module** | `docs/specs/enhancements/tracking-analytics` |
| **Requirements** | `requirements.md` |
| **Design** | `design.md` |
| **Tasks** | `tasks.md` |
| **Judgment Day** | `judgment.md` — APPROVED (round 2) |
| **No `.claude/agents/` Step 8E wrappers found** — Leader spawns fallback subagents seeded with `.agents/implementer.md` / `.agents/reviewer.md` persona content. Implementer on `sonnet` (T2), Reviewer on `opus` (T3) — author ≠ auditor. |

## 2. Task Execution History

### T-001: GoogleAnalytics component + pageview tracker `[FE]` — PASS (attempt 1)

- **Date:** 2026-08-06
- **Implementer (sonnet):** Created `packages/web/src/components/analytics/google-analytics.tsx`, `packages/web/src/hooks/use-analytics-pageview.ts`, and their test files. Structural `null`-guard (DD-TRK-001), gtag bootstrap with `send_page_view: false` (fixes C3), `Suspense` scoped to `GAPageviewTracker` only (DD-TRK-002), effect keyed on `searchParams.toString()` (fixes S4).
  - Verification: `pnpm --filter @alliance-risk/web test --testPathPattern=analytics` → 3 suites/8 tests pass; `pnpm --filter @alliance-risk/web build` (no env) and with `NEXT_PUBLIC_GA_MEASUREMENT_ID=G-TEST00000` both succeed.
  - Not Done/Assumptions: manual GA4 DebugView check (task's "Done when") not runnable — no real GA4 property exists yet (per requirements.md §10, credentials are supplied later by the user). `layout.tsx` correctly left untouched (T-003 scope).
- **Reviewer (opus):** **STATUS: PASS.** Independently re-ran all tests/builds/lint. Went beyond the spec's own checks: built a jsdom harness reproducing the component's exact JSX to empirically confirm exactly one `page_view` fires on initial load with `window.gtag` defined before the tracker's effect runs (dataLayer ends with exactly 3 entries: `js`, `config`, one `page_view`) — direct empirical proof C3 is fixed, not just structurally plausible.
  - **Important finding, not a FAIL against this diff:** the C1 build-check (`NEXT_PUBLIC_GA_MEASUREMENT_ID=... build`) is **still vacuous at T-001** — `layout.tsx` doesn't mount the component yet, so `out/` contains zero trace of GA and chunk hashes are byte-identical between configured/unconfigured builds. **C1 is not actually verified until T-003's build.** Carried forward below.
  - ADVISORY (non-blocking): `tasks.md`'s literal verification command (`test -- --testPathPattern=...`, double `--`) silently reports "No tests found, exiting with code 0" in this repo's pnpm — a false green. The Implementer used the working single-`--` form. This form is used repo-wide (root `CLAUDE.md` too) — flagging for a future doc pass, out of this spec's scope. Also: harden `gtag('config', '${measurementId}', ...)` with `JSON.stringify(measurementId)` against a pathological ID value (low risk, build-time/operator-supplied). Test for the S4 fix (`searchParams.toString()` vs object identity) doesn't yet exercise the regression it targets, since the mock always returns a fresh object — suggest a same-string/new-object rerender case.
- **Files changed:** `packages/web/src/components/analytics/google-analytics.tsx`, `packages/web/src/components/analytics/__tests__/google-analytics.test.tsx`, `packages/web/src/hooks/use-analytics-pageview.ts`, `packages/web/src/hooks/__tests__/use-analytics-pageview.test.ts`
- **Requirements covered:** FR-TRK-001, FR-TRK-002, FR-TRK-003, NFR-TRK-010 (partial — see C1 note), NFR-TRK-011
- **Outstanding:** C1's real verification gate is T-003's two-var build, not T-001's. Re-confirm at T-003.

### T-002: MicrosoftClarity component `[FE]` — PASS (attempt 1)

- **Date:** 2026-08-06
- **Implementer (sonnet):** Created `packages/web/src/components/analytics/microsoft-clarity.tsx` with `id="ms-clarity"` (avoids next/script dedupe-cache defect) and its test file; added `data-clarity-mask="true"` to `user-management.tsx:250` (table root) and `document-viewer.tsx:535` (markdown preview root).
  - Verification: `pnpm --filter @alliance-risk/web test --testPathPattern=microsoft-clarity` → 2/2 pass; grep confirms both `data-clarity-mask` attributes; ESLint clean.
  - Not Done/Assumptions: Clarity dashboard masking-mode (Strict) is a manual, non-code step — flagged for the PR description, cannot be verified by any repo command.
- **Reviewer (opus):** **STATUS: PASS.** Independently re-ran tests (2/2) and lint (clean). Confirmed the snippet is byte-equivalent to Clarity's official snippet with no invented masking parameter (correctly avoids the N2 conflation). Confirmed via `next/script` internals that the negative test case has real discriminating power.
  - ADVISORY (non-blocking): same `test -- --` double-dash false-green issue as T-001. Test suite is order-dependent on `next/script`'s module-level `LoadCache` (T-001's file guards this structurally; T-002's doesn't yet, but currently passes because of test order) — suggest `jest.resetModules()` in `beforeEach` if the file grows. Nothing pins `strategy="afterInteractive"` itself (S5, shared with T-001). `data-clarity-mask` on the user-management table root doesn't cover the delete-confirmation dialog's rendered email or the search input — out of T-002's stated scope, recorded against requirements.md §11's accepted risk for awareness.
- **Files changed:** `packages/web/src/components/analytics/microsoft-clarity.tsx`, `packages/web/src/components/analytics/__tests__/microsoft-clarity.test.tsx`, `packages/web/src/components/admin/user-management.tsx`, `packages/web/src/components/gap-detector/document-viewer.tsx`
- **Requirements covered:** FR-TRK-001, FR-TRK-003, NFR-TRK-011
- **Outstanding:** PR description must state "Clarity project dashboard masking mode must be set to Strict before enabling in production" — the only substitute verification for the C4/N2 mitigation. Leader tracking this for the PR write-up (see §3 below).

### T-004: `scripts/deploy-web.sh` env wiring `[INFRA]` — PASS (attempt 1)

- **Date:** 2026-08-06
- **Implementer (sonnet):** Added `export NEXT_PUBLIC_GA_MEASUREMENT_ID="${NEXT_PUBLIC_GA_MEASUREMENT_ID:-}"` and the Clarity equivalent to `scripts/deploy-web.sh`, using `${VAR:-}` per the N1 fix requirement.
  - Verification: `bash -n` clean; isolated `set -euo pipefail` simulation confirmed no abort with both vars unset.
- **Reviewer (opus):** **STATUS: PASS.** Independently reproduced the N1 defect with a positive control (bare `${VAR}` genuinely aborts with "unbound variable" under `set -u`), then confirmed the shipped `${VAR:-}` form survives unset vars while passing through set values correctly. Confirmed both downstream consumers (`google-analytics.tsx`, `microsoft-clarity.tsx`) guard on falsiness, so the `undefined` → `""` change introduced by `:-}` does not break FR-TRK-001's conditional-load guard.
  - ADVISORY (non-blocking): deploy currently gives zero visible signal when analytics vars are unset (silently-inert, correct-but-invisible — explicitly *not* a fix, since failing closed would violate NFR-TRK-010). The `log` line above the export block ("from stack outputs") is now slightly inaccurate for these two operator-supplied vars — cosmetic, deferred.
- **Files changed:** `scripts/deploy-web.sh`
- **Requirements covered:** BR-TRK-001, NFR-TRK-010 (partial — see below)
- **Outstanding:** the full end-to-end grep-`out/`-for-the-ID check from `tasks.md` needs T-003's `layout.tsx` wiring to be meaningful; deferred to T-003's verification.

## 3. Carry-Forward Notes for T-003

- **C1's real verification** (the `NEXT_PUBLIC_GA_MEASUREMENT_ID=G-TEST00000 build` check) only becomes meaningful once `layout.tsx` mounts `<GoogleAnalytics />` — re-run and confirm `out/` actually contains the GA script/ID after T-003.
- **T-004's grep-`out/`-for-ID check** similarly depends on T-003's wiring — run both var's build together and grep `out/**/*` (HTML + `_next/static/chunks/*.js`) after T-003 lands.
- **PR description** must include: "Clarity project dashboard masking mode must be set to Strict before enabling in production" (T-002's C4/N2 substitute verification).
- Repo-wide observation (not this spec's scope, not actioned): the `pnpm ... test -- --testPathPattern=<pattern>` form documented in root `CLAUDE.md` produces a false "No tests found, exiting with code 0" in this repo's current pnpm/Jest setup. Both Reviewers hit this independently. Worth a separate doc-fix outside this spec.
