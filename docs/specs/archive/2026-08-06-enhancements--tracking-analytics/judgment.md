# Judgment Day — tracking-analytics design.md (Round 1)

**Target:** `design.md` + `requirements.md` (Lite spec, pre-`tasks.md`)
**Mode:** blind dual review, Judge A / Judge B, both on `opus` (author model: `sonnet`)
**Round:** 1 of 2 max

## Confirmed (both judges independently found the same defect) — SEVERE, fix now

| # | Finding | Target | Why | Fix direction |
|---|---|---|---|---|
| C1 | The env-var-absent build (§10 row 3 / §9 row 2) can never exercise the Suspense-boundary risk it's mapped to catch — `GoogleAnalytics` returns `null` before `useSearchParams()` is ever called, so the "dominant risk" has zero automated coverage as specified | design.md §10, requirements.md §9 | DD-TRK-001's null-guard makes the one specified build check vacuous for its stated purpose (confirmed against Next.js 15 source + this repo's actual `useSearchParams` sites) | Add a second build row: `NEXT_PUBLIC_GA_MEASUREMENT_ID=G-TEST00000 pnpm --filter @alliance-risk/web build` |
| C2 | No path delivers `NEXT_PUBLIC_GA_MEASUREMENT_ID`/`NEXT_PUBLIC_CLARITY_ID` into the production build — `scripts/deploy-web.sh` exports only 3 unrelated vars from CloudFormation, no `.env*` exists in `packages/web` | design.md §6 (modified-files list), requirements.md §10 | Feature ships permanently inert in production; also creates pressure to hardcode an ID (violates NFR-TRK-011) | Add `scripts/deploy-web.sh` to modified files; document the CloudFormation/env wiring needed to actually activate this in prod |
| C3 | `page_view` double-fires on every initial load — gtag's default `send_page_view: true` on `config` plus the tracker's own mount-time effect both fire | design.md §6, requirements.md FR-TRK-002 | FR-TRK-002 only describes "on route change," silently ignoring the mount case where the design's effect also fires | Specify `gtag('config', ID, { send_page_view: false })` so the effect owns all pageviews; add an initial-load scenario to FR-TRK-002 |

## Corroborated (both judges flagged the same substance; severity differed A=WARNING / B=SEVERE) — treated as confirmed

| # | Finding | Target | Why | Fix direction |
|---|---|---|---|---|
| C4 | §8's "public/unauthenticated-safe by nature" dismissal is wrong — mounting in root layout puts Clarity session-replay on `/admin/users` (real emails) and the document viewer (parsed source content); default masking doesn't cover rendered page text. Contradicts requirements.md §5 ("no PII beyond default collection") | design.md §8, requirements.md §5 | Materially larger exposure than the cookie-consent risk already accepted in §11, but never recorded as a risk | Replace §8's dismissal; either scope Clarity to non-sensitive routes, enable strict masking, or explicitly add this as an accepted risk in §11 alongside the consent-banner one |

## Suspect (single judge only — recorded, not auto-fixed this round)

| # | Finding | Judge | Note |
|---|---|---|---|
| S1 | Design shows only the gtag.js loader `<Script>`, omitting the required inline `dataLayer`/`gtag()` bootstrap snippet — without it `window.gtag` is undefined | B | If true this makes FR-TRK-002 unimplementable as diagrammed; worth checking during task-writing regardless |
| S2 | Proposed unit test ("renders `<Script>` with it") is vacuous — `next/script` with `afterInteractive` returns `null` from React's render and injects via `document.body.appendChild` in an effect, so RTL container assertions can't distinguish configured/unconfigured | B | Test should assert on `document.querySelector('script[src*=...]')`, not container contents |
| S3 | `page_path` param on the manual `gtag('event','page_view', ...)` call is a Universal Analytics field GA4 ignores; should be `page_location` | A | Cosmetic if `send_page_view` fix (C3) is applied, since gtag auto-populates `page_location` — but the manual call should still be correct |
| S4 | `useSearchParams()` return value dependency risk — context-identity changes without query-string changes could re-fire the effect | B | Recommend `searchParams.toString()` as the effect dependency |
| S5 | `beforeInteractive` strategy would pass every specified gate (build, tests) while violating FR-TRK-003 (blocks first paint) — no check pins the strategy itself | B | Add an explicit assertion (prop value or `data-nscript` attribute) that strategy is `afterInteractive` |

## Warnings / Suggestions (info only, not blocking)

- Clarity inline `<Script>` missing an explicit `id` prop defeats `next/script`'s dedupe on remount (both judges, WARNING) — add `id="ms-clarity"`.
- `reactStrictMode: true` in `next.config.ts` double-invokes the pageview effect in dev, so the only specified manual verification (FR-TRK-002, §9 row 3) can't tell correct behavior from the C3 double-count bug (both judges, WARNING) — verify against a production build (`next build && npx serve out`) instead of `next dev`.
- GA-vs-Clarity tracking-mechanism asymmetry (manual event vs. automatic SPA detection) is never stated in either doc; risk of a future implementer adding redundant Clarity tracking, or of Clarity failing to detect query-param-only navigation (`?id=A → ?id=B`, this app's static-export routing pattern) (both judges).
- `@next/third-parties/google` (Next's first-party GA component, not in `package.json`) wasn't considered as an alternative to hand-rolling the bootstrap — no DD records why (B, suggestion).
- NFR-TRK-010 "identically" is imprecise — builds differ in whether IDs are inlined; restate as "succeeds and produces a full static export in both cases" (B, suggestion).

## Round 1 Verdict

**ESCALATED** — 3 severe findings confirmed by both judges (C1–C3) plus 1 corroborated (C4). Per protocol: asked before round-one correction; user selected "Corregir y re-juzgar."

## Round 1 Fixes Applied

- C1: added a second build-check row (`NEXT_PUBLIC_GA_MEASUREMENT_ID=G-TEST00000 pnpm --filter @alliance-risk/web build`) as the only configuration that exercises `useSearchParams()` — design.md §10, requirements.md §9.
- C2: added `scripts/deploy-web.sh` to the modified-files list with the env-export requirement — design.md §6, requirements.md §10/§9.
- C3: specified `gtag('config', measurementId, { send_page_view: false })`; retitled FR-TRK-002 to "exactly once per view" with an initial-load scenario — design.md §6, requirements.md FR-TRK-002.
- C4: replaced the §8 security dismissal with an honest treatment of Clarity's authenticated-route exposure; recorded as an accepted risk — design.md §8, requirements.md §11.

## Round 2 — Scoped Re-judgment (fix delta only)

Both judges (blind, parallel, `opus`) re-checked C1–C4 against the frozen round-1 ledger plus the fix delta.

| Finding | Judge A | Judge B |
|---|---|---|
| C1 | PASS | PASS |
| C2 | PASS (wiring caveat) | PASS (wiring caveat) |
| C3 | PASS | PASS |
| C4 | PASS (mitigation muddled) | PASS (mitigation muddled) |

**New findings introduced by the fixes themselves (corroborated by both judges — record as info for `tasks.md`, not another fix round since neither is severe and both verdicts are APPROVE):**

- **N1 (WARNING):** design.md §6's description of how `scripts/deploy-web.sh` sources the two env vars is self-contradictory — it says "the same way the Cognito values are handled today," but Cognito values come from CloudFormation `get_output`, not operator shell export, and the script runs under `set -euo pipefail`, so a naive `export VAR="${VAR}"` would abort every deploy when the var is unset (exactly the unconfigured case NFR-TRK-010 requires to keep working). **Fix in `tasks.md`:** use `${VAR:-}` default-empty expansion or a `.env.deploy` source-if-exists guard; drop the Cognito analogy.
- **N2 (WARNING/MEDIUM):** design.md §8's Clarity mitigation ("enable strict/enhanced masking mode when initializing the snippet") conflates two different mechanisms — masking mode is a Clarity dashboard/project setting, not a snippet-init parameter (the JS API only exposes `clarity('set'|'identify'|'consent'|'upgrade')` and per-element `data-clarity-mask`). No check anywhere verifies masking is actually on. **Fix in `tasks.md`:** name the real mechanism (dashboard setting + optionally `data-clarity-mask` on known-sensitive elements) and add a manual verification step.
- **N3 (MINOR, Judge A):** the new build-check row has no FR/NFR citation; requirements.md §4/§12 still describe FR-TRK-002 as "on route change" without reflecting the initial-load half added by the C3 fix.
- **N4 (LOW, Judge B):** requirements.md §9's new deploy-verification check ("grep `out/**/*.html`") should scope to `out/**/*` or the JS chunk files, since `NEXT_PUBLIC_*` values inline into client bundles, not necessarily the HTML shell.

## Terminal Verdict

**APPROVED ✅** — Round 2. All 4 confirmed round-1 findings (C1–C4) verified fixed by both independent judges. N1–N4 are sub-severe precision issues in the fixes themselves, corroborated by both judges but rated below the auto-fix bar (WARNING/MEDIUM/LOW, not SEVERE) — carried forward as explicit line items for `tasks.md` rather than triggering a third judge round.

**Round count:** 1 fix round, 1 scoped re-judgment (within the 2-round ceiling). Lineage closed — terminal state `approved`, no further judgment rounds on this design.
