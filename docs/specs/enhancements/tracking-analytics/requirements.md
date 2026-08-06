# Requirements — Tracking Analytics (GA4 + Microsoft Clarity)

## 1. Document Control

| Field | Value |
|-------|-------|
| **Module** | `enhancements/tracking-analytics` |
| **Project** | CGIAR Risk Intelligence Tool |
| **Version** | 1.0 |
| **Date** | 2026-08-06 |
| **Depth** | Lite |
| **Author** | Daniela Gómez (via Claude Code) |

### References

| Ref | Document | Location |
|-----|----------|----------|
| C1 | Product Requirements | `docs/prd.md` |
| C2 | UX/UI Design | `docs/ux-ui/design.md` |
| C3 | Technical Requirements | `docs/trd/trd.md` |

## 2. Executive Summary

Add Google Analytics 4 (GA4) and Microsoft Clarity to `packages/web` for usage/behavior insight. Both are client-side-only scripts, conditionally loaded from environment variables, and must never block rendering or break the static export build when credentials are absent.

## 3. Glossary

| Term | Meaning |
|---|---|
| GA4 | Google Analytics 4, identified by a `G-XXXXXXXXXX` Measurement ID |
| Clarity | Microsoft Clarity session-replay/heatmap tool, identified by a short Project ID |
| Route change | Client-side navigation in Next.js App Router (no full page reload) |

## 4. System Context & Scope

**In scope:** `packages/web` only — conditional script injection, GA4 page-view tracking (initial load + every route change), production env-var delivery via `scripts/deploy-web.sh`.

**Out of scope:** backend/API, database, custom event tracking beyond page views, cookie-consent UI (see Open Questions).

## 5. Stakeholders

| Persona | Interest |
|---|---|
| Product | Usage insight, adoption metrics |
| Engineering | Must not affect build reliability or load performance |
| End users | Privacy — no PII beyond each tool's default collection |

## 6. Functional Requirements

### FR-TRK-001: Conditional script loading

The system SHALL load the GA4 script only when `NEXT_PUBLIC_GA_MEASUREMENT_ID` is set, and the Clarity script only when `NEXT_PUBLIC_CLARITY_ID` is set.

#### Scenario: Env var absent
- GIVEN `NEXT_PUBLIC_GA_MEASUREMENT_ID` is not set
- WHEN the app renders
- THEN no GA `<script>` tag is injected into the DOM
- AND IT MUST render with no console errors
- BUT it must NOT make any network request to `googletagmanager.com`

#### Scenario: Env var present
- GIVEN `NEXT_PUBLIC_GA_MEASUREMENT_ID` is set to a valid Measurement ID
- WHEN the app renders
- THEN the GA `<script>` tag is injected with that ID

*(Same scenario pair applies to Clarity via `NEXT_PUBLIC_CLARITY_ID`.)*

### FR-TRK-002: GA4 page-view tracking, exactly once per view

The system SHALL fire exactly one GA4 `page_view` event per view — on initial load and on every subsequent client-side route change — when GA4 is configured.

#### Scenario: Initial load while GA configured
- GIVEN GA4 is configured
- WHEN the page first loads
- THEN exactly one `page_view` event fires (from the tracker's mount effect)
- BUT it must NOT also receive GA's own automatic pageview from `gtag('config', ...)` — the `config` call MUST set `send_page_view: false` so the tracker is the single source

#### Scenario: Navigation while GA configured
- GIVEN GA4 is configured
- WHEN the user navigates to a new route (pathname or query params change)
- THEN a `gtag('event', 'page_view', ...)` call fires with the new path
- AND IT MUST fire exactly once per navigation (not duplicated)

#### Scenario: Navigation while GA not configured
- GIVEN GA4 is not configured
- WHEN the user navigates
- BUT it must NOT call `gtag` or throw an error

### FR-TRK-003: Non-blocking load

The system SHALL load both scripts using a non-blocking strategy so neither delays first paint nor the static export build.

#### Scenario: Build without credentials
- GIVEN no analytics env vars are set
- WHEN `pnpm --filter @alliance-risk/web build` runs
- THEN the build SHALL succeed exactly as before this change

## 7. Non-Functional Requirements

| ID | Requirement |
|---|---|
| NFR-TRK-010 | Build must succeed identically with and without analytics env vars set (static-export compatibility) |
| NFR-TRK-011 | No real GA/Clarity ID is hardcoded anywhere in source |

## 8. Business Rules

- **BR-TRK-001:** IDs are only supplied via `NEXT_PUBLIC_`-prefixed env vars (required for static export — values are inlined at build time).

## 9. Defect Classes → Verification Mapping

| Defect class | Catching command / check |
|---|---|
| Script loads even when env var absent | Unit test asserting component renders `null`/no script tag without the env var. **Note:** assert on `document.querySelector('script[...]')`, not on the RTL container — `next/script` with `afterInteractive` injects imperatively via `document.body`, so container-only assertions can pass in both configured and unconfigured states |
| Static export build breaks (e.g. `useSearchParams` without a Suspense boundary) | `NEXT_PUBLIC_GA_MEASUREMENT_ID=G-TEST00000 pnpm --filter @alliance-risk/web build` — **must be run with the env var set.** The unconfigured build (no env vars) cannot detect this class at all: DD-TRK-001's `null`-guard means `useSearchParams()` is never called when the ID is absent, so that build is vacuous for this defect (Judgment Day round 1, C1) |
| `page_view` fires zero, one, or more than one time per view (missing, or duplicated on initial load) | Manual check against a **production build** (`next build && npx serve out`), not `next dev` — `reactStrictMode: true` in `next.config.ts` double-invokes effects in dev and would mask a real duplicate-firing bug as expected behavior |
| Production deploy never receives the real IDs (build succeeds locally but ships inert) | `scripts/deploy-web.sh` must export both env vars before its build step — verify by grepping the built `packages/web/out/**/*` (HTML **and** `_next/static/chunks/*.js`, since `NEXT_PUBLIC_*` inlines into client bundles, not necessarily the HTML shell) for the configured ID string after a deploy-mode build |
| Hardcoded real ID committed | **No automated check** — substitute: reviewer visually confirms only env-var references exist in the diff (small diff, cheap to eyeball) |

## 10. Dependencies & Assumptions

- Assumes the user will create the GA4 property and Clarity project *after* this implementation and supply the real IDs via env vars — this spec ships the wiring, not the credentials.
- **Assumes `scripts/deploy-web.sh` is updated to export both env vars before its build step.** Without this, `NEXT_PUBLIC_*` values (inlined at build time per BR-TRK-001) never reach the production bundle and the feature ships permanently inert (Judgment Day round 1, C2). This is in scope for this spec — see `design.md` §6.
- Assumes no cookie-consent gate is required for this MVP iteration (see Open Questions).

## 11. Open Questions / Accepted Risks

- **Cookie consent:** CGIAR institutional policy on a consent banner (GDPR-adjacent) is undefined. Treated as an **accepted risk** for this Lite spec — if legal/privacy requirements surface later, that is a separate spec (a consent gate would change FR-TRK-001/002 behavior).
- **Clarity session-replay on authenticated routes:** mounting Clarity in the root layout means it records `(admin)/admin/users` (real emails/attributes) and document-viewer content under `(protected)/*`. Default masking covers form inputs, not arbitrary page text. **Accepted risk for this iteration**, mitigated by enabling Clarity's strict/enhanced masking mode at initialization (see `design.md` §8) — revisit with route-scoping if masking proves insufficient (Judgment Day round 1, C4).

## 12. Requirement ID Index

| ID | Summary |
|---|---|
| FR-TRK-001 | Conditional script loading (GA4 + Clarity) |
| FR-TRK-002 | GA4 page-view tracking, exactly once per view (initial load + route change) |
| FR-TRK-003 | Non-blocking load, static-export safe |
| NFR-TRK-010 | Build succeeds with/without env vars |
| NFR-TRK-011 | No hardcoded IDs |
| BR-TRK-001 | IDs via `NEXT_PUBLIC_` env vars only |
