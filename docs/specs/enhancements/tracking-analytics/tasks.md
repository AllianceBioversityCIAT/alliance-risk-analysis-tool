# Tasks — Tracking Analytics (GA4 + Microsoft Clarity)

## 1. Document Control

| Field | Value |
|-------|-------|
| **Module** | `docs/specs/enhancements/tracking-analytics` |
| **Requirements** | `requirements.md` |
| **Design** | `design.md` |
| **Judgment Day** | `judgment.md` — APPROVED (round 2); N1/N2/N3/N4 folded into tasks below |
| **Version** | 1.0 |
| **Depth** | Lite |

## 2. Dependency Graph

```
## Phase A: Components (parallel, different files)
T-001 [FE] GoogleAnalytics component + pageview hook ─┐
T-002 [FE] MicrosoftClarity component                  ┼─ parallel
                                                        ┘
## Phase B: Wiring (sequential, depends on Phase A)
T-003 [FE] Wire into layout.tsx + env docs — depends on T-001, T-002
T-004 [INFRA] deploy-web.sh env wiring — independent of T-001–T-003, can run in parallel with Phase A
```

---

### T-001: GoogleAnalytics component + pageview tracker `[FE]`

- **Status:** `[x]`
- **Skills:** `vercel-react-best-practices`, `tailwind-design-system` (N/A — no styling, listed per Skill Map convention)
- **Size:** M
- **Dependencies:** None
- **Requirements:** FR-TRK-001, FR-TRK-002, FR-TRK-003, NFR-TRK-010, NFR-TRK-011
- **Design Ref:** `design.md` §3 Architecture, §6 Frontend Changes (gtag bootstrap paragraph), §11 DD-TRK-001/002

**Scope:**
- Create `packages/web/src/components/analytics/google-analytics.tsx`:
  - Returns `null` entirely when `measurementId` prop is falsy (FR-TRK-001, DD-TRK-001).
  - When set: renders the `gtag/js?id=...` loader `<Script strategy="afterInteractive">` **and** a second inline bootstrap `<Script>` defining `window.dataLayer`, the `gtag()` shim, `gtag('js', new Date())`, and `gtag('config', measurementId, { send_page_view: false })` — the `send_page_view: false` is required (fixes Judgment Day C3).
  - Renders `<Suspense fallback={null}><GAPageviewTracker /></Suspense>` as a sibling of the scripts — do NOT wrap the whole component or the layout.
- Create `packages/web/src/hooks/use-analytics-pageview.ts`:
  - `usePathname()` + `useSearchParams()`, effect keyed on `[pathname, searchParams.toString()]` (use the **string**, not the `ReadonlyURLSearchParams` object identity — object identity can change without the query string changing and would re-fire spuriously).
  - On change (including the initial mount — this is what makes FR-TRK-002's "initial load" scenario correct), call `window.gtag('event', 'page_view', { page_location: window.location.href, page_title: document.title })` if `window.gtag` exists; no-op otherwise (FR-TRK-002 "GA not configured" scenario).
- `GAPageviewTracker` (small internal component in `google-analytics.tsx`) calls the hook — this is the component that needs the `Suspense` boundary, not `GoogleAnalytics` itself.

**Tests:**
- `packages/web/src/components/analytics/__tests__/google-analytics.test.tsx`:
  - Renders with no `measurementId` → assert `document.querySelector('script[src*="googletagmanager"]')` is `null`. **Do not assert on the RTL container** — `next/script` with `strategy="afterInteractive"` returns `null` from React's render regardless of state and injects via `document.body.appendChild` in an effect, so a container-only assertion passes in both states (Judgment Day round-1 suspect S2).
  - Renders with `measurementId="G-TEST00000"` → assert the loader script tag exists with the right `src`, and the inline bootstrap script's content includes `send_page_view: false`.
  - Call `jest.resetModules()` (or clear `next/script`'s module-level load cache) between these two test cases — the cache is keyed by `src`/`id` and a prior test's load can make a later "not loaded" assertion falsely pass.
- `packages/web/src/hooks/__tests__/use-analytics-pageview.test.ts` (or colocated in the component test): mock `usePathname`/`useSearchParams`, assert `window.gtag` is called once on mount and once per path change, and is not called when `window.gtag` is undefined.

**Verification:** `pnpm --filter @alliance-risk/web test -- --testPathPattern=analytics`

**Done when:**
- Both test files pass.
- `pnpm --filter @alliance-risk/web build` succeeds with no env vars set (NFR-TRK-010 unconfigured half).
- `NEXT_PUBLIC_GA_MEASUREMENT_ID=G-TEST00000 pnpm --filter @alliance-risk/web build` succeeds — this is the actual Suspense/static-export check (fixes Judgment Day C1; the unconfigured build alone does not exercise `useSearchParams()`).
- Manual: `NEXT_PUBLIC_GA_MEASUREMENT_ID=G-TEST00000 pnpm --filter @alliance-risk/web build && npx serve packages/web/out` (production build, **not** `pnpm dev` — `reactStrictMode: true` double-invokes effects in dev and would mask a real double-count bug), confirm in GA4 DebugView exactly one `page_view` on load and exactly one per subsequent navigation.

---

### T-002: MicrosoftClarity component `[FE]`

- **Status:** `[x]`
- **Skills:** `vercel-react-best-practices`
- **Size:** S
- **Dependencies:** None
- **Requirements:** FR-TRK-001, FR-TRK-003, NFR-TRK-011
- **Design Ref:** `design.md` §3 Architecture, §6 Frontend Changes, §8 Security & Authorization

**Scope:**
- Create `packages/web/src/components/analytics/microsoft-clarity.tsx`:
  - Returns `null` entirely when `projectId` prop is falsy (FR-TRK-001).
  - When set: renders the Clarity inline snippet via `<Script id="ms-clarity" strategy="afterInteractive" dangerouslySetInnerHTML={{ __html: ... }} />`. **The explicit `id` prop is required** — an inline script with no `id` and no `src` has an `undefined` cache key in `next/script`'s dedupe map, so remounts (Fast Refresh, navigation) would re-inject and re-execute the snippet.
- No route-tracking hook needed — Clarity instruments the History API and detects SPA navigation on its own. (Note for whoever reads this later: Clarity's automatic detection may not reliably fire on query-param-only changes, e.g. `?id=A → ?id=B` — this app's static-export routing pattern. Accepted as a known limitation, not fixed in this iteration.)
- **Masking mitigation (fixes Judgment Day C4/N2):** masking mode (Strict/Balanced/Relaxed) is a **Clarity project dashboard setting**, not a snippet-init parameter — do not attempt to pass a masking option into the snippet, that mechanism doesn't exist. Instead:
  - Set masking mode to **Strict** in the Clarity project dashboard once the project is created (this is a manual, post-implementation step — document it in the PR description and in `packages/web/CLAUDE.md`'s new Analytics section).
  - As defense-in-depth, add a `data-clarity-mask="true"` attribute to the highest-risk rendered content: the user-management table in `src/components/admin/user-management.tsx` (real emails) and the document-viewer markdown preview in `src/components/gap-detector/document-viewer.tsx` (parsed source content).

**Tests:**
- `packages/web/src/components/analytics/__tests__/microsoft-clarity.test.tsx`:
  - Renders with no `projectId` → assert `document.querySelector('script#ms-clarity')` is `null`.
  - Renders with `projectId="test123"` → assert the script tag exists with `id="ms-clarity"` and its content references the project ID.

**Verification:** `pnpm --filter @alliance-risk/web test -- --testPathPattern=microsoft-clarity`

**Done when:**
- Test file passes.
- `data-clarity-mask="true"` attributes are present on `user-management.tsx`'s table root and `document-viewer.tsx`'s preview root (grep-verifiable, not just claimed).
- Manual note added to the PR description: "Clarity project dashboard masking mode must be set to Strict before enabling in production" — this is the substitute verification for a mitigation that has no automated check (Judgment Day N2).

---

### T-003: Wire into layout.tsx + env documentation `[FE]`

- **Status:** `[x]`
- **Skills:** `vercel-react-best-practices`
- **Size:** S
- **Dependencies:** T-001, T-002
- **Requirements:** FR-TRK-001, FR-TRK-003, BR-TRK-001, NFR-TRK-011
- **Design Ref:** `design.md` §6 Frontend Changes (modified-files table)

**Scope:**
- Modify `packages/web/src/app/layout.tsx`: import and render `<GoogleAnalytics measurementId={process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID} />` and `<MicrosoftClarity projectId={process.env.NEXT_PUBLIC_CLARITY_ID} />` inside `<body>`, as siblings alongside the existing providers — do not nest inside `QueryProvider`/`AuthProvider`/etc., these have no dependency on app state.
- Create `packages/web/.env.example` (no `.env*` file currently exists for `web`) documenting both vars with a one-line comment each and no real values.
- Add a short "Analytics" section to `packages/web/CLAUDE.md`: names the two env vars, the two component files, and the manual post-setup step from T-002 (Clarity dashboard masking mode).

**Tests:** None new — covered by T-001/T-002's component tests plus the build check below.

**Verification:** `pnpm --filter @alliance-risk/web build` (no env vars) and `NEXT_PUBLIC_GA_MEASUREMENT_ID=G-TEST00000 NEXT_PUBLIC_CLARITY_ID=test123 pnpm --filter @alliance-risk/web build` (both vars) — both must succeed.

**Done when:**
- `layout.tsx` renders both components; grep confirms no other file imports `google-analytics.tsx`/`microsoft-clarity.tsx` directly (single mount point).
- `.env.example` exists with both vars documented, no real IDs.
- `packages/web/CLAUDE.md` has the new section.
- Reviewer visually confirms the diff contains zero hardcoded GA/Clarity IDs (NFR-TRK-011 — no automated check exists for this, per requirements.md §9).

---

### T-004: `scripts/deploy-web.sh` env wiring `[INFRA]`

- **Status:** `[x]`
- **Skills:** `aws-serverless`
- **Size:** S
- **Dependencies:** None (independent of T-001–T-003; can run in parallel)
- **Requirements:** BR-TRK-001, NFR-TRK-010
- **Design Ref:** `design.md` §6 Frontend Changes (modified-files table, `scripts/deploy-web.sh` row)

**Scope:**
- Modify `scripts/deploy-web.sh`: add `export NEXT_PUBLIC_GA_MEASUREMENT_ID="${NEXT_PUBLIC_GA_MEASUREMENT_ID:-}"` and `export NEXT_PUBLIC_CLARITY_ID="${NEXT_PUBLIC_CLARITY_ID:-}"` before the `pnpm --filter @alliance-risk/web build` call (near the existing Cognito exports, lines ~65-68).
  - **Use `${VAR:-}` default-empty expansion, not a bare `${VAR}` reference** — the script runs under `set -euo pipefail`, so referencing an unset variable directly aborts the entire deploy. The default-empty form lets the deploy proceed with analytics disabled when the operator hasn't configured IDs yet, which is the whole point of FR-TRK-001's conditional-loading behavior (fixes Judgment Day N1).
  - These are **operator-supplied shell exports**, not CloudFormation stack outputs (unlike the Cognito values, which come from `get_output` — do not add a CFN output for these, they're third-party IDs with no infra dependency).
- No other script changes — the existing Cognito/API URL exports are untouched.

**Tests:** None (shell script, no existing test harness for `scripts/`).

**Verification:**
- Manual: run `bash -n scripts/deploy-web.sh` (syntax check).
- Manual: run the script (or its build step in isolation) with the two vars unset — confirm it does **not** abort due to `set -u`.
- Manual: run with both vars set to test values, then grep `packages/web/out/**/*` (HTML **and** `_next/static/chunks/*.js` — `NEXT_PUBLIC_*` inlines into client bundles, not necessarily the HTML shell) for the test ID string to confirm it reached the build output (fixes Judgment Day C2/N4).

**Done when:**
- Script change is a minimal diff (2 lines) confined to the existing export block.
- Both manual verification steps above pass.

---

## 3. PR Strategy

**Estimated LOC:** ~150-160 (in line with `design.md` §12 budget, revised post-Judgment-Day).

**Single PR recommended** — all 4 tasks are small, touch disjoint files (2 new components, 1 hook, 1 layout diff, 1 shell script), and there's no natural split boundary that reduces review burden below "read one small diff." A multi-PR split would only add coordination overhead for ~150 LOC.

**Suggested review order:** T-001 (core mechanism + the Judgment Day fixes) → T-002 (simpler, same pattern) → T-003 (wiring, easy to verify by inspection) → T-004 (shell script, independent, smallest diff).

## 4. Requirement Coverage Check

| Requirement | Scenario/Clause | Task |
|---|---|---|
| FR-TRK-001 | Env var absent (GA) | T-001 |
| FR-TRK-001 | Env var present (GA) | T-001 |
| FR-TRK-001 | Env var absent (Clarity) | T-002 |
| FR-TRK-001 | Env var present (Clarity) | T-002 |
| FR-TRK-002 | Initial load while configured (`send_page_view: false`) | T-001 |
| FR-TRK-002 | Navigation while configured | T-001 |
| FR-TRK-002 | Navigation while not configured | T-001 |
| FR-TRK-003 | Non-blocking (`afterInteractive`) | T-001, T-002 |
| FR-TRK-003 | Build succeeds without env vars | T-003 |
| NFR-TRK-010 | Build parity with/without env vars | T-001 (Suspense check), T-003, T-004 |
| NFR-TRK-011 | No hardcoded IDs | T-003 (reviewer check) |
| BR-TRK-001 | `NEXT_PUBLIC_` env vars only | T-003, T-004 |

Every scenario and negative (`BUT`/`AND IT MUST`) clause from `requirements.md` is owned by a named task above — no orphans.
