# Test Report — Tracking Analytics (GA4 + Microsoft Clarity)

## 1. Document Control

| Field | Value |
|-------|-------|
| **Module** | `docs/specs/enhancements/tracking-analytics` |
| **Requirements** | `requirements.md` |
| **Design** | `design.md` |
| **Tasks / Execution** | `tasks.md` / `execution.md` — all 4 tasks PASS |
| **Depth** | Lite |
| **Date** | 2026-08-06 |

## 2. Summary

**Overall: PASS.** All automated suites green, all key requirement scenarios have test evidence, 1 accepted gap (documented below, not automatable).

- **Suites run:** 1 (frontend unit — `packages/web`). No backend suite (no API changes). No dedicated E2E suite exists in this repo (Jest + Testing Library only, no Playwright/Cypress) — see §5 and §9.
- **Deployment Rule applied:** Lite depth, single suite → **run inline by the Leader**, not delegated to a separate Tester subagent. This is a deliberate deviation from spawning per the rule's own table ("Lite depth... → Run inline"), recorded here per Delegation Discipline.
- **Author ≠ tester note:** the bulk of this suite's tests were authored during `/akili-execute` by an Implementer on `sonnet` and independently re-run (not just read) by a Reviewer on `opus` for each task — that independence already happened once. This pass adds 3 new assertions/tests (closing gaps the Reviewers flagged as advisory) and re-validates the full suite; it does not re-litigate what the Reviewers already confirmed.
- **New tests added this pass:** 3 (2 merged into existing tests to avoid a `next/script` cache-collision hazard discovered while authoring them — see §3 "Notes on test authoring").
- **Product bugs found:** 0.

## 3. Frontend Unit Tests (`packages/web`)

**Command:** `pnpm --filter @alliance-risk/web test --testPathPattern=analytics`

**Result:**
```
Test Suites: 3 passed, 3 total
Tests:       9 passed, 9 total
```

| File | Tests | Origin |
|---|---|---|
| `src/components/analytics/__tests__/google-analytics.test.tsx` | 2 | Both authored at T-001 (execute); the `afterInteractive`-strategy assertion added this pass was merged into the existing "renders with ID" test rather than counted as a separate `it()` (see the cache-collision note above), so the file's test *count* didn't change, only its assertion count |
| `src/components/analytics/__tests__/microsoft-clarity.test.tsx` | 2 | 1 authored at T-002 (execute); the `afterInteractive`-strategy assertion added this pass was likewise merged into the existing "injects with ID" test |
| `src/hooks/__tests__/use-analytics-pageview.test.ts` | 5 | 4 authored at T-001 (execute), 1 new `it()` added this pass (the new-`URLSearchParams`-same-string regression test — this one *did* land as a separate test, since the hook file has no `next/script` module-cache hazard) |

**Corrected during `/akili-validate` (W6):** this table originally read GA 3 / Clarity 2 / hook 4 — the total (9) was right, which is exactly why the per-file miscount went unnoticed. Corrected to GA 2 / Clarity 2 / hook 5, verified against actual file contents.

**Notes on test authoring (this pass):** the first attempt at closing the "nothing pins `strategy=afterInteractive`" gap (Judgment Day round-1 suspect S5) added it as a *separate* `it()` block reusing the same `measurementId="G-TEST00000"` / `projectId="test123"` already used by an earlier test in the same file. Both new tests failed with `data-nscript` reading `undefined`. Root cause: `next/script` keys `LoadCache`/`ScriptCache` by `id`/`src` in **module-level singletons** that persist for the lifetime of the test file (not reset between `it()` blocks) — a second render with the same key short-circuits before creating any DOM element. This is exactly the hazard the test files' own top-of-file comments already document and guard against (`google-analytics.test.tsx`'s comment explicitly states "G-TEST00000 is rendered exactly once across this whole file"). Fix: merged the new assertions into the existing test that already used that ID, instead of adding a new `it()`. Left the incident in this report as a caution for future edits to these files — the module-singleton hazard is easy to reintroduce.

## 4. Backend Unit Tests

**N/A.** This spec is frontend-only (`packages/web`); no `packages/api` changes.

## 5. Integration Tests

**No dedicated integration suite exists for this feature**, and no new infrastructure was added to author one. The behavior that would normally need integration-level testing — the components actually mounted in `layout.tsx`, wired to real env vars, producing real script injection and `gtag`/`clarity` calls in a real browser — was already exhaustively verified during `/akili-execute`'s T-003 Reviewer pass:

- Both static-export builds (unconfigured, and with `NEXT_PUBLIC_GA_MEASUREMENT_ID=G-TEST00000 NEXT_PUBLIC_CLARITY_ID=test123`) succeeded with all 17 routes remaining statically prerendered.
- The configured build's output was served and loaded in **headless Chrome** (not jsdom): `window.gtag`/`window.clarity` confirmed live, `dataLayer` showed `js` → `config` (with `send_page_view: false` honored) → exactly one `page_view` on initial load, and the Clarity snippet was observed creating its own `<script src="https://www.clarity.ms/tag/test123">` at runtime.
- The unconfigured build was also served and loaded: zero script tags, `window.gtag`/`window.clarity` both `undefined`, `dataLayer` empty.

This is stronger evidence than a jsdom-based integration test could provide for this specific feature — jsdom does not execute injected `<script>` content by default (confirmed: `jest.config.js` has no `runScripts: 'dangerously'`), so a jsdom "integration" test would only prove element presence, which the unit suite in §3 already does. Full detail: `execution.md`, T-003 entry.

**Not re-run in this test pass** — the build/serve/headless-Chrome check is not wired into any repeatable script or CI step. See §9 Accepted Gaps.

## 6. E2E Tests

**No E2E harness exists in this repo** (`packages/web/CLAUDE.md`'s Testing section lists only Jest + Testing Library — no Playwright/Cypress config found). Per this command's own rule ("no test infrastructure is a STOP, not an improvisation" — choosing/adding an E2E framework is a stack decision, not something to improvise inside a test pass), no E2E suite was authored. The manual headless-Chrome verification in §5 covers the equivalent ground for this specific feature's critical path (script injection + pageview firing across real navigation). See §9 Accepted Gaps.

## 7. Coverage & Traceability

| Requirement | Scenario | Test Type | Test File / Evidence | Result | Notes |
|---|---|---|---|---|---|
| FR-TRK-001 | GA env var absent → no script, no request | Unit | `google-analytics.test.tsx` "renders no GA script tag..." | PASS | Asserts on `document.querySelector`, not RTL container (avoids vacuous-assertion trap) |
| FR-TRK-001 | GA env var present → script injected with ID | Unit | `google-analytics.test.tsx` "renders the GA loader and bootstrap scripts..." | PASS | Also confirms `send_page_view: false` in bootstrap |
| FR-TRK-001 | Clarity env var absent → no script | Unit | `microsoft-clarity.test.tsx` "renders no script tag..." | PASS | |
| FR-TRK-001 | Clarity env var present → script injected with ID | Unit | `microsoft-clarity.test.tsx` "injects the Clarity snippet..." | PASS | |
| FR-TRK-002 | Initial load, GA configured → exactly one `page_view`, no auto-duplicate | Unit + manual browser | `use-analytics-pageview.test.ts` "calls window.gtag once on initial mount..."; corroborated live in headless Chrome (§5) | PASS | The live-browser check is the stronger evidence — it proves `send_page_view:false` actually suppresses GA's own auto-pageview, which the unit test (mocking `window.gtag` directly) cannot observe |
| FR-TRK-002 | Navigation, GA configured → exactly one `page_view` per route change | Unit | `use-analytics-pageview.test.ts` "calls window.gtag once per subsequent path change" | PASS | Includes a no-change rerender asserting no extra call |
| FR-TRK-002 | Query-string-only change → fires once | Unit | `use-analytics-pageview.test.ts` "calls window.gtag once per query-string-only change" | PASS | |
| FR-TRK-002 | New `URLSearchParams` instance, same string → does NOT re-fire | Unit | `use-analytics-pageview.test.ts` "does not re-fire when a new URLSearchParams instance has the same string" | PASS | **Added this pass** — closes Judgment Day round-1 suspect S4, previously untested (prior test's mock always returned the same cached reference) |
| FR-TRK-002 | GA not configured → no call, no throw | Unit | `use-analytics-pageview.test.ts` "does not call gtag or throw..." | PASS | |
| FR-TRK-003 | Both scripts load with `afterInteractive` (non-blocking) | Unit | `google-analytics.test.tsx` + `microsoft-clarity.test.tsx`, `data-nscript` attribute assertions | PASS | **Added this pass** — closes Judgment Day round-1 suspect S5; previously nothing pinned the strategy value, so a switch to `beforeInteractive` would have passed every other check while blocking first paint |
| FR-TRK-003 | Build succeeds without env vars | Build command | `NEXT_PUBLIC_GA_MEASUREMENT_ID= NEXT_PUBLIC_CLARITY_ID= pnpm --filter @alliance-risk/web build` (explicit empty — corrected W9, `/akili-validate`: a bare command silently picks up any local `.env.local`) | PASS (re-confirmed during `/akili-validate` with explicit overrides, `packages/web/out/*.html` has 0 references to GA/Clarity) | |
| NFR-TRK-010 | Build parity with/without env vars, Suspense boundary holds | Build command + headless Chrome | `execution.md` T-003 — all 17 routes remain static in both builds | PASS (execute-time) | The real C1 gate; confirmed only meaningful once `layout.tsx` mounted the components |
| NFR-TRK-011 | No hardcoded IDs | Manual diff review | Reviewer diff audit at each task (`execution.md`) | PASS | Requirements.md §9 explicitly states this has no automated check — human review is the designed substitute, not a gap |
| BR-TRK-001 | `NEXT_PUBLIC_*` env vars only, deploy script doesn't abort when unset | Manual shell simulation | `execution.md` T-004 — positive control reproduced the `set -u` abort, confirmed `${VAR:-}` fix survives | PASS (execute-time) | No shell-script test harness exists in this repo; manual verification is the designed approach, not a gap |

**Every FR/NFR/BR scenario in `requirements.md` has test evidence above — no orphans.**

## 8. Remediation

None required — 0 product bugs found, 0 failing tests.

## 9. Accepted Gaps

| Gap | Why not automated | Mitigation |
|---|---|---|
| No repeatable/CI-wired integration check that re-verifies real script injection + `gtag`/`clarity` calls in an actual browser against a fresh build | The one-time headless-Chrome verification during `/akili-execute` (T-003) was thorough but ad hoc — not saved as a script or CI step. Building this properly means adding an E2E framework (Playwright), which is a stack decision (per this command's rules, not something to improvise inside a test pass) | If this feature needs regression protection against future refactors, recommend a follow-up spec to introduce Playwright for `packages/web` — out of scope here. Until then, any future change to `layout.tsx`, `google-analytics.tsx`, or `microsoft-clarity.tsx` should repeat the manual build+serve+headless-Chrome check from `execution.md` T-003 |
| No E2E suite | Same root cause as above — no E2E harness exists in this repo | Same mitigation |
| `page_view` count in a real GA4 property's DebugView was never observed (requires a live GA4 property + real traffic) | Requirements.md §9 already names this as having no automated substitute; the jsdom unit tests plus the headless-Chrome `dataLayer` inspection are the strongest available substitute and were both used | Accepted per requirements.md §9 — this is a designed gap, not an oversight |
| Clarity dashboard masking mode (Strict) cannot be independently verified by any command in this repo | It's a manual dashboard setting outside this repo, per design.md §8 / Judgment Day C4/N2 | **Resolved 2026-08-06** — user confirmed Strict masking mode is set in the Clarity project dashboard (see `execution.md` §3). Recorded here as a documented user attestation, not something any test or audit in this repo can independently re-verify — must still be named in the PR description as the substitute verification for this mitigation |
