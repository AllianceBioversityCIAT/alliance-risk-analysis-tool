# Design — Tracking Analytics (GA4 + Microsoft Clarity)

## 1. Document Control

| Field | Value |
|-------|-------|
| **Module** | `docs/specs/enhancements/tracking-analytics` |
| **Requirements ref** | `requirements.md` |
| **Version** | 1.0 |
| **Date** | 2026-08-06 |
| **Depth** | Lite |

## 2. Overview

Two independent, self-disabling client components render inside the root layout. Each renders `null` when its env var is absent, so the "off" state is structurally guaranteed rather than an internal branch inside an always-mounted script. Covers FR-TRK-001, FR-TRK-002, FR-TRK-003.

## 3. Architecture & Data Flow

```
RootLayout (src/app/layout.tsx)
 ├── <GoogleAnalytics measurementId={env} />   ── renders null if !measurementId
 │      ├── <Script> gtag.js loader (afterInteractive)
 │      └── <Suspense><GAPageviewTracker /></Suspense>   ── usePathname + useSearchParams → gtag('event','page_view')
 └── <MicrosoftClarity projectId={env} />      ── renders null if !projectId
        └── <Script> Clarity inline snippet (afterInteractive)
```

No backend, database, or job-pipeline involvement — this is frontend-only, static-export-safe.

## 4. Data Model Changes

None.

## 5. API Surface

None — no new or modified endpoints.

## 6. Frontend Changes

**New files:**

| File | Purpose |
|---|---|
| `packages/web/src/components/analytics/google-analytics.tsx` | GA4 `<Script>` tags + `null`-guard on missing ID |
| `packages/web/src/components/analytics/microsoft-clarity.tsx` | Clarity inline `<Script>` + `null`-guard on missing ID |
| `packages/web/src/hooks/use-analytics-pageview.ts` | `usePathname`/`useSearchParams` effect that calls `window.gtag('event', 'page_view', { page_location, page_title })` on change — `page_path` is a Universal Analytics field GA4 ignores; `page_location`/`page_title` are the correct GA4 parameters (corrected from an earlier draft, see Judgment Day round-1 suspect S3) |
| `packages/web/.env.example` | Documents `NEXT_PUBLIC_GA_MEASUREMENT_ID`, `NEXT_PUBLIC_CLARITY_ID` (new file — none existed for `web`) |
| `.../analytics/__tests__/google-analytics.test.tsx` | Unit tests (added W4, `/akili-validate`) |
| `.../analytics/__tests__/microsoft-clarity.test.tsx` | Unit tests (added W4, `/akili-validate`) |
| `.../hooks/__tests__/use-analytics-pageview.test.ts` | Unit tests (added W4, `/akili-validate`) |

**Modified files:**

| File | Change |
|---|---|
| `packages/web/src/app/layout.tsx` | Render `<GoogleAnalytics />` and `<MicrosoftClarity />` inside `<body>`, alongside existing providers |
| `packages/web/CLAUDE.md` | Short "Analytics" section documenting the two env vars and where the components live |
| `packages/web/src/components/admin/user-management.tsx` | Adds `data-clarity-mask="true"` to the user table root (T-002, defense-in-depth for C4/N2 — added W4, `/akili-validate`) |
| `packages/web/src/components/gap-detector/document-viewer.tsx` | Adds `data-clarity-mask="true"` to the markdown preview root (T-002, same rationale — added W4, `/akili-validate`) |
| `scripts/deploy-web.sh` | Export `NEXT_PUBLIC_GA_MEASUREMENT_ID` / `NEXT_PUBLIC_CLARITY_ID` before the build step, alongside the existing `NEXT_PUBLIC_API_URL`/Cognito exports (lines ~65-68) — **without this, the feature is permanently inert in production** (Judgment Day C2). These are **operator-supplied shell exports**, unlike the Cognito values immediately above them, which are fetched from CloudFormation stack outputs via `get_output` — no CloudFormation output is added for these, since they're third-party IDs with no infra dependency. **Must use `${VAR:-}` default-empty expansion, not a bare `${VAR}` reference** — the script runs under `set -euo pipefail`, so referencing an unset variable directly aborts the entire deploy (Judgment Day round-2 finding N1; corrected from an earlier draft that incorrectly suggested modeling this on the Cognito pattern) |

**Suspense requirement (static export detail):** `useSearchParams()` opts the nearest boundary out of static rendering unless wrapped in `<Suspense>`. Only the small `GAPageviewTracker` (inside `google-analytics.tsx`) is wrapped — not the whole app — so the rest of the tree stays statically exported.

**gtag bootstrap (required, not just the loader):** the GA snippet is two parts — the remote `gtag/js?id=...` loader `<Script>` **and** an inline bootstrap `<Script>` that defines `window.dataLayer = window.dataLayer || []`, the `gtag()` shim, and calls `gtag('js', new Date())` + `gtag('config', measurementId, { send_page_view: false })`. Both render inside `GoogleAnalytics`, as siblings of the `Suspense`-wrapped tracker. `send_page_view: false` is required so the manual tracker (§6) is the single source of `page_view` events — without it, GA's own auto-fired pageview on `config` and the tracker's mount-time effect double-count every initial load (Judgment Day C3).

Design token compliance: N/A — no visible UI is added.

## 7. Integration Points

- No AWS services touched.
- No `@alliance-risk/shared` changes.
- External: `googletagmanager.com` (GA4), `clarity.ms` (Microsoft Clarity) — both loaded only when their env var is present.

## 8. Security & Authorization

No auth guards needed on the components themselves (no route/role gating required to render them). However, mounting both in the **root** layout means Clarity session-replay runs on every route, including `(admin)/admin/users` (real user emails/attributes) and the document viewer under `(protected)/assessments/*` (parsed source-document content). Clarity's default masking covers form inputs, not arbitrary rendered page text — so this is a real exposure, not a "same as a public marketing site" case (Judgment Day C4).

**Accepted mitigation for this iteration:** masking mode (Strict/Balanced/Relaxed) is a **Clarity project dashboard setting** — not a snippet-init parameter; the snippet has no such option (corrected from an earlier draft that conflated the two, Judgment Day round-2 finding N2). Set masking mode to **Strict** in the Clarity project dashboard as a manual, post-implementation step (confirmed done for this project — see `execution.md` §3). As defense-in-depth, `data-clarity-mask="true"` is also added to the two highest-risk rendered surfaces in code (the admin user table and the document-viewer preview — see T-002 in `tasks.md`). Residual exposure is recorded as an accepted risk in `requirements.md` §11 alongside the cookie-consent question. Scoping Clarity to non-sensitive routes only was considered and rejected for Lite scope (adds route-based conditional logic); revisit if masking proves insufficient.

## 9. Error Handling

- Fail-closed by omission: missing env var → component renders `null`. No error, no fallback UI needed.
- No user-visible messaging required.

## 10. Testing Strategy

| Test | File | What it proves |
|---|---|---|
| Unit: `GoogleAnalytics` renders `null` without `measurementId`, renders `<Script>` with it, pins `afterInteractive` | `packages/web/src/components/analytics/__tests__/google-analytics.test.tsx` (2 tests) | FR-TRK-001, FR-TRK-003 (GA half) |
| Unit: `MicrosoftClarity` renders `null` without `projectId`, renders `<Script>` with it, pins `afterInteractive` | `packages/web/src/components/analytics/__tests__/microsoft-clarity.test.tsx` (2 tests) | FR-TRK-001, FR-TRK-003 (Clarity half) |
| Unit: `useAnalyticsPageview` fires once on mount, once per route/query change, not on an unchanged query string in a new object, not when `gtag` is undefined | `packages/web/src/hooks/__tests__/use-analytics-pageview.test.ts` (5 tests, added W4/W6 `/akili-validate` — original count of 4 undercounted the S4-closing test) | FR-TRK-002 |
| Build: `NEXT_PUBLIC_GA_MEASUREMENT_ID= NEXT_PUBLIC_CLARITY_ID= pnpm --filter @alliance-risk/web build` (explicit empty values — corrected W9, `/akili-validate`: a bare command with no override picks up any local `.env.local`, which silently produces a *configured* bundle and invalidates this as unconfigured evidence) | N/A (CI/manual) | NFR-TRK-010 (unconfigured half) |
| Build: `NEXT_PUBLIC_GA_MEASUREMENT_ID=G-TEST00000 NEXT_PUBLIC_CLARITY_ID=test123 pnpm --filter @alliance-risk/web build` | N/A (CI/manual) | **The actual Suspense/static-export check** — this is the only build configuration where `GAPageviewTracker` renders and `useSearchParams()` executes, so it's the only one that can catch a missing/misplaced `Suspense` boundary (Judgment Day C1 — the unconfigured build alone cannot) |
| Manual: with both env vars set, run a **production build** (`next build && npx serve out`, not `next dev`) and confirm exactly one `page_view` per navigation in GA4 DebugView | N/A (documented in `tasks.md`) | FR-TRK-002 — no automated substitute exists (see requirements.md §9). Using a production build avoids `reactStrictMode`'s dev-only double-invocation masking a real double-count bug |

## 11. Decision Records

### DD-TRK-001: Structural `null`-guard instead of runtime branch inside an always-mounted script

**Status:** Accepted
**Context:** Could unconditionally render the script tags and let the vendor's own JS no-op without an ID.
**Decision:** Each component returns `null` entirely when its env var is absent — no `<script>` tag reaches the DOM, so no network request is even attempted.
**Consequences:** Slightly more code (an early return) but a structural (not behavioral) guarantee that satisfies FR-TRK-001's negative constraint. This is additive — no existing behavior is reverted, so no reversion challenge applies (Step 2.3 skipped).

### DD-TRK-002: Suspense boundary scoped to the pageview tracker only

**Status:** Accepted
**Context:** `useSearchParams()` in the App Router requires a `Suspense` boundary or the page opts out of static rendering.
**Decision:** Wrap only `GAPageviewTracker` in `<Suspense fallback={null}>`, nested inside `GoogleAnalytics`, not at the layout or page level.
**Consequences:** Keeps the static-export guarantee (`output: 'export'`) for the rest of the app intact.

## 12. Budget (Step 2.4 sizing check, revised post-Judgment Day)

| Signal | Estimate | Actual (post-`/akili-execute` + `/akili-test`) |
|---|---|---|
| Tasks | 4 (added: `scripts/deploy-web.sh` wiring) | 4 — matched |
| LOC | ~150 | **~370** (2.4× the estimate — see note below) |
| Review rounds | 1 | 1 per task, all PASS on first attempt — matched |

Still within **Lite** depth — the Judgment Day corrections added scope (deploy script, gtag bootstrap, masking config) but not architecture. Single PR, no split required.

**LOC variance note (recorded during `/akili-validate`):** the ~150 estimate undercounted test-file volume. Actual test coverage (9 tests across 3 files, including the `/akili-test` pass's additions closing S4/S5) plus doc updates (`.env.example`, `CLAUDE.md` Analytics section) came in at ~370 LOC total. This is a budget-estimate miss, not scope creep — no task was added beyond the original 4, and no architecture changed. Recorded per Step 2.4's tripwire intent: the variance is information for future Lite-depth estimates (test-file LOC is easy to undercount), not a finding against this spec.

## 13. Design Review Checklist

- [x] Matches TRD module boundaries (frontend-only change, no boundary violation)
- [x] No model IDs involved (not a Bedrock feature)
- [x] No shared-package changes needed
- [x] No visible UI — design-token compliance N/A
- [x] No schema/migration involved
- [x] `layout.tsx` current structure verified by reading the file directly (KZ-003) — see §3/§6
