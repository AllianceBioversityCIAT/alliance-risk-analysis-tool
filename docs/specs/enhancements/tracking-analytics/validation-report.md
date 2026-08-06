# Validation Report — Tracking Analytics (GA4 + Microsoft Clarity)

## 1. Document Control

| Field | Value |
|-------|-------|
| **Module** | `docs/specs/enhancements/tracking-analytics` |
| **Requirements** | `requirements.md` v1.0 |
| **Design** | `design.md` v1.0 |
| **Tasks** | `tasks.md` v1.0 (4 tasks, all `[x]`) |
| **Judgment Day** | `judgment.md` — APPROVED (round 2); C1–C4 confirmed, N1–N4 carried to tasks |
| **Execution** | `execution.md` — 4/4 PASS, attempt 1 |
| **Test Report** | `test-report.md` — overall PASS, 3 suites / 9 tests |
| **Date** | 2026-08-06 |
| **Depth** | Lite |
| **Auditor** | `opus` (T3) — independent of Implementer (`sonnet`) and of the execute-time Reviewers (`opus`, different context/task) |
| **Branch / HEAD** | `tracking-tools` @ `4f86fa8` — working tree clean |
| **Spec commits audited** | `4dce1ef` (T-001), `9e556ff` (T-002), `9c5486b` (T-004), `310004b` (T-003), `cd47bcc` (test pass), `4f86fa8` (masking attestation) |

## 2. Summary

**Verdict: PASS WITH WARNINGS — archive-ready after a documentation-correction pass.**

| Level | Count | Nature |
|---|---|---|
| **FAIL** | **0** | — |
| **BLOCKED** | **0** | — |
| **PASS** | 26 | All 4 tasks, all 8 expected files, all 6 build/lint/test checks, all 18 requirement scenarios/clauses, all 9 design decisions |
| **WARN** | 12 | All in **documents and verification commands** — none in shipped behavior |
| **Unverifiable (attestation)** | 1 | Clarity dashboard Strict masking mode — external system, see §9.1 |
| **Advisory (4R, non-verdict)** | 14 | 9 carried forward from `execution.md` (7 still open), 5 new from this sweep |

**The shipped code is correct.** Every functional requirement, negative constraint, and design decision was re-verified against the current working tree — not accepted from prior documents. All four Judgment Day findings (C1–C4) are confirmed fixed *in the code and in the build output*, reproduced independently:

- **C1 (vacuous Suspense check)** — configured build: 17/17 routes still `○ (Static)`. DD-TRK-002's scoped `Suspense` holds.
- **C2 (feature ships inert)** — configured build: both IDs present in **16/16** HTML and **15/15** `.txt` RSC payloads; `${VAR:-}` exports at `scripts/deploy-web.sh:69-70` precede the build at line 76.
- **C3 (page_view double-fire)** — `send_page_view: false` present at `google-analytics.tsx:41`, asserted by unit test, corroborated by the T-003 live `dataLayer` check.
- **C4/N2 (Clarity exposure)** — `data-clarity-mask="true"` present at `user-management.tsx:250` and `document-viewer.tsx:535`; dashboard setting attested (§9.1).

**Every WARN is a document or a verification command, not a defect in the product.** They cluster into three themes:

1. **`design.md` was never corrected after Judgment Day N1–N3.** The fixes were folded into `tasks.md` and the code, but the design of record still asserts three things the shipped code contradicts (W1–W3). This matters at archive time because `design.md` is the document that survives.
2. **Two *new* vacuous-verification instances of the exact class Judgment Day C1 caught** (W8, W9): the spec's own literal verification command silently runs zero tests, and the spec's unconfigured-build check is contaminated by an untracked `.env.local` in any real working copy.
3. **Cross-document figures don't survive contact with the code** (W5–W7): the LOC budget is off by 2.4×, and `test-report.md`'s per-file test counts and masking-status row are both wrong.

## 3. Task Completion

All 4 tasks are `[x]`, all 4 have `execution.md` entries with Implementer **and** independent Reviewer records. Evidence was re-derived, not accepted.

| Task | Status | `execution.md` entry | Independent re-verification by this audit | Result |
|---|---|---|---|---|
| T-001 GoogleAnalytics + pageview tracker | `[x]` | Yes — Implementer + Reviewer (built a jsdom harness to empirically count `dataLayer` entries) | Read all 3 source files: `null`-guard, gtag bootstrap with `send_page_view: false`, `Suspense` scoped to `GAPageviewTracker`, effect keyed on `searchParams.toString()` — all present as specified. 9/9 tests re-run green. | **PASS** |
| T-002 MicrosoftClarity component | `[x]` | Yes — Implementer + Reviewer (confirmed snippet is byte-equivalent to Clarity's official snippet, no invented masking param) | `id="ms-clarity"` present; `data-clarity-mask="true"` grep-confirmed at `user-management.tsx:250` + `document-viewer.tsx:535`; no fabricated masking parameter in the snippet. | **PASS** (see W12) |
| T-003 Wire into `layout.tsx` + env docs | `[x]` | Yes — Implementer + Reviewer (rebuilt both variants, served the static export in headless Chrome) | `layout.tsx:41-42` mounts both as siblings of `</QueryProvider>`, not nested; `.env.example` exists with empty values; `CLAUDE.md` Analytics section present; grep confirms `layout.tsx` is the **only** importer. | **PASS** |
| T-004 `deploy-web.sh` env wiring | `[x]` | Yes — Implementer + Reviewer (reproduced the N1 defect with a positive control) | `bash -n` clean. Reproduced the positive control myself: bare `${VAR}` **does** abort with `unbound variable` under `set -euo pipefail`; the shipped `${VAR:-}` form survives unset and passes set values through. Diff is exactly 2 lines. | **PASS** |

**Evidence quality note.** The execute-time Reviewer records are unusually strong for a Lite spec — the T-001 Reviewer built a jsdom harness to count `dataLayer` entries, and the T-003 Reviewer served the real static export in headless Chrome rather than trusting the chunk-absence explanation. Both went beyond the spec's own checks. Where a claim was re-runnable, I re-ran it; where it was not (headless Chrome), I confirmed the *artifact-level* consequence instead (route staticness, ID presence in `out/`).

## 4. File Existence

Every file in `design.md` §6 exists **and** was actually touched in a spec commit (verified by `git diff --numstat`, not by presence alone).

| File | Expected | Exists | Touched in commit | Lines | Result |
|---|---|---|---|---|---|
| `packages/web/src/components/analytics/google-analytics.tsx` | new | Yes | `4dce1ef` | +61 | **PASS** |
| `packages/web/src/components/analytics/microsoft-clarity.tsx` | new | Yes | `9e556ff` | +47 | **PASS** |
| `packages/web/src/hooks/use-analytics-pageview.ts` | new | Yes | `4dce1ef` | +39 | **PASS** |
| `packages/web/.env.example` | new | Yes | `310004b` | +5 | **PASS** |
| `packages/web/src/app/layout.tsx` | modified | Yes | `310004b` | +4 | **PASS** |
| `packages/web/CLAUDE.md` | modified | Yes | `310004b` | +11 | **PASS** |
| `scripts/deploy-web.sh` | modified | Yes | `9c5486b` | +2 | **PASS** |
| `.../analytics/__tests__/google-analytics.test.tsx` | test | Yes | `4dce1ef` +62, `cd47bcc` +13 | 75 | **PASS** |
| `.../analytics/__tests__/microsoft-clarity.test.tsx` | test | Yes | `9e556ff` +23, `cd47bcc` +9 | 32 | **PASS** |
| `.../hooks/__tests__/use-analytics-pageview.test.ts` | test | Yes | `4dce1ef` +73, `cd47bcc` +19 | 92 | **PASS** |
| `packages/web/src/components/admin/user-management.tsx` | *not in design §6* | Yes | `9e556ff` | ±1 | **PASS** (see W4) |
| `packages/web/src/components/gap-detector/document-viewer.tsx` | *not in design §6* | Yes | `9e556ff` | +1 | **PASS** (see W4) |

**W4** — `design.md` §6's modified-files table omits the two masking-attribute files and all three test files, so the design's own change-set inventory is narrower than what shipped. The additions are correctly specified in `tasks.md` T-002, so this is documentation completeness, not scope creep.

## 5. Build Integrity

| # | Command | Exit | Result | Notes |
|---|---|---|---|---|
| 1 | `pnpm --filter @alliance-risk/shared build` | 0 | **PASS** | |
| 2 | `pnpm --filter @alliance-risk/web build` (no shell env vars, **as specified**) | 0 | **PASS as a build / INVALID as unconfigured evidence** | See W9 — Next.js auto-loaded `packages/web/.env.local`, so this produced a **configured** bundle containing a real GA4 ID. |
| 3 | `NEXT_PUBLIC_GA_MEASUREMENT_ID= NEXT_PUBLIC_CLARITY_ID= pnpm … build` (**true** unconfigured) | 0 | **PASS** | 16/16 HTML files: **0** references to `googletagmanager`, `clarity.ms/tag`, `ga-gtag-init`, or the real ID. This is the valid NFR-TRK-010 unconfigured evidence. |
| 4 | `NEXT_PUBLIC_GA_MEASUREMENT_ID=G-TEST00000 NEXT_PUBLIC_CLARITY_ID=test123 pnpm … build` | 0 | **PASS** | 17/17 routes `○ (Static)`; `G-TEST00000` in **16/16** HTML + **15/15** `.txt`; `test123` in 16/16 HTML; **0** chunks contain the ID (not `DefinePlugin`-inlined — RSC prop, exactly as `execution.md` T-003 explains). |
| 5 | `pnpm --filter @alliance-risk/web lint` | 0 | **PASS** | `✔ No ESLint warnings or errors`. Emits an unrelated pre-existing notice: `next lint` is deprecated, removed in Next.js 16. |
| 6 | `pnpm --filter @alliance-risk/web test --testPathPattern=analytics` | 0 | **PASS** | `Test Suites: 3 passed, 3 total / Tests: 9 passed, 9 total` — matches `test-report.md`'s headline exactly. |

### W9 — The spec's unconfigured-build check is vacuous in any real working copy

`packages/web/.env.local` (untracked, created after implementation) sets both analytics vars to **real production IDs**. Next.js loads `.env.local` automatically, so the bare `pnpm --filter @alliance-risk/web build` that `tasks.md` T-001/T-003, `design.md` §10, and `test-report.md` §7 all cite as the NFR-TRK-010 *unconfigured* evidence now silently builds a **configured** bundle — I confirmed a real `<link rel="preload" href="https://www.googletagmanager.com/gtag/js?id=G-SPD…">` in all 16 HTML files of run #2.

This is a fresh instance of exactly the defect class Judgment Day C1 caught: a check that passes for reasons unrelated to what it claims to prove. The unconfigured path itself **is** correct (run #3 proves it) — only the documented command is unsound.

**Remediation:** document the explicit-empty form `NEXT_PUBLIC_GA_MEASUREMENT_ID= NEXT_PUBLIC_CLARITY_ID= pnpm --filter @alliance-risk/web build` as the unconfigured check in `tasks.md` / `design.md` §10.

### W8 — The spec's literal verification command runs zero tests and reports success

`tasks.md` T-001 and T-002 specify `pnpm --filter @alliance-risk/web test -- --testPathPattern=…` (double `--`). Reproduced:

```
$ pnpm --filter @alliance-risk/web test -- --testPathPattern=analytics
$ jest --passWithNoTests -- --testPathPattern=analytics
No tests found, exiting with code 0
```

Zero tests, exit 0 — a false green. All three execute-time Reviewers hit this independently and used the working single-`--` form. The broken form is documented repo-wide (root `CLAUDE.md`, `packages/web/CLAUDE.md`), so the root cause is outside this spec — but this spec's own task cards carry it, which is inside scope to fix.

## 6. Requirement Coverage

Every scenario and every `BUT` / `AND IT MUST` clause in `requirements.md` is traced below at **clause granularity**. `test-report.md` §7's matrix was the starting point; **5 of its claims were spot-checked against the actual code and re-run** (exceeding the 3-claim minimum) — marked ✔re-verified.

| Requirement | Scenario / Clause | Task | Evidence | Result |
|---|---|---|---|---|
| FR-TRK-001 | GA env absent → no `<script>` in DOM | T-001 | `google-analytics.test.tsx:44-45` asserts `document.querySelector` is null (not the RTL container) ✔re-verified | **PASS** |
| FR-TRK-001 | …`AND IT MUST` render with no console errors | T-001 | T-003 headless-Chrome check (`execution.md`); jsdom render clean. Not re-runnable — see §9.2 gap | **PASS** (documented) |
| FR-TRK-001 | …`BUT must NOT` request `googletagmanager.com` | T-001 | Build #3: **0/16** HTML contain `googletagmanager` — no script tag *and* no `<link rel=preload>` ✔re-verified independently | **PASS** |
| FR-TRK-001 | GA env present → script injected with that ID | T-001 | `google-analytics.test.tsx:51-55` exact-`src` assertion; build #4: 16/16 HTML ✔re-verified | **PASS** |
| FR-TRK-001 | Clarity env absent → no script | T-002 | `microsoft-clarity.test.tsx:12`; build #3: 0 HTML contain `clarity.ms/tag` ✔re-verified | **PASS** |
| FR-TRK-001 | Clarity env present → script injected with ID | T-002 | `microsoft-clarity.test.tsx:18-21`; build #4: `test123` in 16/16 HTML | **PASS** |
| FR-TRK-002 | Initial load → exactly one `page_view` from mount effect | T-001 | `use-analytics-pageview.test.ts:26-37` (`toHaveBeenCalledTimes(1)` + exact payload); live `dataLayer` at T-003 | **PASS** |
| FR-TRK-002 | …`BUT must NOT` also take GA's auto pageview — `config` MUST set `send_page_view: false` | T-001 | `google-analytics.tsx:41` ✔re-verified in source; asserted at `google-analytics.test.tsx:59`; live `dataLayer` = `js`→`config`→exactly 1 `page_view` | **PASS** |
| FR-TRK-002 | Navigation → `gtag('event','page_view')` with new path | T-001 | `use-analytics-pageview.test.ts:39-53` (path change) and `:55-65` (query-string-only) | **PASS** |
| FR-TRK-002 | …`AND IT MUST` fire exactly once per navigation | T-001 | No-change rerender asserts no extra call (`:51-52`); **plus** `:81-91` new-`URLSearchParams`-same-string test ✔re-verified — closes judgment S4 | **PASS** |
| FR-TRK-002 | GA not configured → `must NOT` call `gtag` or throw | T-001 | `use-analytics-pageview.test.ts:67-72`; source guards `typeof window.gtag !== 'function'` | **PASS** |
| FR-TRK-003 | Both scripts non-blocking (`afterInteractive`) | T-001, T-002 | `data-nscript="afterInteractive"` asserted in **both** test files ✔re-verified — closes judgment S5 | **PASS** |
| FR-TRK-003 | Build without credentials succeeds as before | T-003 | Build #3 exit 0, 16 HTML, 17/17 routes static | **PASS** |
| NFR-TRK-010 | Build succeeds with **and** without env vars; Suspense holds | T-001, T-003, T-004 | Builds #3 and #4 both exit 0, both 17/17 `○ (Static)` ✔re-verified — **the real C1 gate** | **PASS** |
| NFR-TRK-011 | No real GA/Clarity ID hardcoded in source | T-003 | `git grep` for the real ID → **no hits in any tracked file**. Real IDs exist only in `.env.local`, which `.gitignore:14-16` covers (`.env.*` with `!.env.example`) so it cannot be committed accidentally ✔re-verified. Test files use obvious placeholders (`G-TEST00000`, `test123`) | **PASS** |
| BR-TRK-001 | IDs only via `NEXT_PUBLIC_` env vars | T-003, T-004 | `layout.tsx:41-42` reads `process.env.NEXT_PUBLIC_*`; no other source | **PASS** |
| BR-TRK-001 | …deploy must not abort when unset (`set -u`) | T-004 | Positive control reproduced: bare `${VAR}` → `unbound variable`; shipped `${VAR:-}` → `SURVIVED_UNSET ga=[] clarity=[]` ✔re-verified | **PASS** |

**No orphans.** All 6 requirement IDs, all 8 scenarios, and all 6 negative/strict clauses map to a completed task with real evidence. `test-report.md` records **0 PRODUCT_BUG, 0 FAIL, 0 flaky, 0 AUTOMATION_DEFERRED** — independently confirmed by a clean 9/9 re-run.

### W10 — C2 is only half-closed: transport exists, instruction does not

`deploy-web.sh` now *passes through* the two vars, but **nothing in the repo tells an operator to export them**. `git grep` outside the spec folder finds the vars only in `deploy-web.sh:69-70`, `packages/web/CLAUDE.md:186-187`, and `.env.example` — none of which is deploy-facing. `design.md` §6 offers a `.env.deploy` source-if-exists mechanism that **was not implemented**. A deploy today ships silently inert unless the operator already happens to know. This is the residual half of C2 ("feature ships permanently inert"), and it compounds advisory A7 (no visible deploy signal when unset).

**Remediation (small):** one line in `docs/infrastructure.md` or the deploy section of root `CLAUDE.md`, plus optionally a `log` line in `deploy-web.sh` stating whether analytics is enabled for this deploy.

## 7. Linting & Code Quality

ESLint: **clean** (`✔ No ESLint warnings or errors`). TypeScript: clean via both `next build` runs.

### 7.1 4R sweep — current code

Read in full: `google-analytics.tsx`, `microsoft-clarity.tsx`, `use-analytics-pageview.ts`, `layout.tsx:41-42`, `deploy-web.sh:65-76`, all 3 test files.

| Lens | Assessment |
|---|---|
| **Readability** | Strong. Every non-obvious decision carries a comment citing its requirement or Judgment Day finding (`DD-TRK-001`, `C3`, `S4`, `S5`, the `next/script` module-cache hazard). The test files' file-level comments are genuinely load-bearing — they explain *why* assertions are merged rather than split, which is the single easiest thing for a future editor to break. Above the bar for a Lite spec. |
| **Reliability** | Correct. The `null`-guard is structural (early return before any hook or JSX), the effect key is the query **string** not the object, `send_page_view: false` is present, and `id="ms-clarity"` defeats the `next/script` dedupe defect. No dead branches with behavioral consequence. |
| **Resilience** | Fail-closed by omission, as designed: absent env var → `null`, no error path needed. `${VAR:-}` keeps the deploy alive when unconfigured. The `window.gtag` type guard prevents throws if the loader is blocked by an ad blocker — a real scenario the spec never named but the code handles. |
| **Risk** | Two residual items: unescaped env-var interpolation into two inline `<script>` bodies (A2 below), and no dev/prod analytics separation (N-B below). Both are low-likelihood and neither is a spec violation. |

### 7.2 Carried-forward advisories from `execution.md` — re-checked against current code

Not copied blindly; each was verified in the working tree.

| # | Advisory (source) | Current status |
|---|---|---|
| A1 | `test -- --testPathPattern` double-dash false green (T-001, T-002, T-004 Reviewers) | **STILL OPEN** — reproduced this audit (see W8). Repo-wide doc issue; this spec's task cards inherit it. |
| A2 | Harden `gtag('config', '${measurementId}', …)` with `JSON.stringify` (T-001 Reviewer) | **STILL OPEN** — `google-analytics.tsx:41` raw-interpolates. **Extends further than recorded:** `microsoft-clarity.tsx:42` interpolates `"${projectId}"` into an inline script the same way, which the original advisory did not cover. Both values are build-time operator-supplied, so exploitation requires control of the deploy env — low risk, but the fix is two `JSON.stringify` calls. |
| A3 | S4 test doesn't exercise the regression it targets (T-001 Reviewer) | **CLOSED** — `use-analytics-pageview.test.ts:81-91` now builds a fresh `URLSearchParams` with an unchanged string and asserts no re-fire. Verified. |
| A4 | Clarity test order-dependent on `next/script`'s module-level `LoadCache` (T-002 Reviewer) | **PARTIALLY OPEN** — `afterEach` removes `script#ms-clarity` from the DOM, but the module-level cache is still not reset. Currently passes; remains a latent hazard if a second test reuses `projectId="test123"`. The file's comment documents the trap, which is the practical mitigation. |
| A5 | Nothing pins `strategy="afterInteractive"` (S5, T-001+T-002 Reviewers) | **CLOSED** — `data-nscript` assertions now in both test files. Verified. |
| A6 | `data-clarity-mask` misses the delete-confirmation dialog email and the search input (T-002 Reviewer) | **STILL OPEN** — accepted risk under `requirements.md` §11; out of T-002's stated scope. Now partly compensated by the attested dashboard Strict mode. |
| A7 | Deploy gives zero signal when analytics vars are unset (T-004 Reviewer) | **STILL OPEN** — confirmed: `deploy-web.sh` has no `log`/`ok` line for these two vars. Compounds W10. |
| A8 | `log "…from stack outputs…"` (line 65) now inaccurate for two operator-supplied vars (T-004 Reviewer) | **STILL OPEN** — confirmed verbatim at `deploy-web.sh:65`. Cosmetic. |
| A9 | `.env.example` documents only the 2 analytics vars, not `NEXT_PUBLIC_API_URL` etc. (T-003 Reviewer) | **STILL OPEN** — confirmed: the file has exactly 2 keys. A dev copying it as a full template gets an incomplete `.env.local`. |
| A10 | `packages/web/CLAUDE.md` `## Structure` tree not updated (T-003 Reviewer) | **STILL OPEN** — confirmed: the tree lists neither `components/analytics/` nor `hooks/use-analytics-pageview.ts`. See W11 / §10. |
| A11 | Unauthenticated landing yields 2 `page_view`s (entry + redirect to `/login`) (T-003 Reviewer) | **STILL OPEN, by design** — correct per spec; Product should know pageview counts include the auth-redirect hop. |
| A12 | Grepping chunks for `googletagmanager`/`ga-gtag-init` is not a valid "GA is off" check (T-003 Reviewer) | **CONFIRMED CORRECT and now measured** — in the *true* unconfigured build, `_next/static/chunks/app/layout-*.js` still contains the `googletagmanager` URL template, because `google-analytics.tsx` is a client component that is always imported. No script tag and no request result. The advisory's guidance stands. |

### 7.3 New advisory findings from this sweep

| # | Finding | Lens | Severity |
|---|---|---|---|
| N-B | `.env.local` now points local builds and `next dev` at the **production** GA4 property, so developer traffic pollutes production analytics. No dev/prod separation, `NODE_ENV` guard, or GA debug-mode note exists. Never required by the spec (so not a violation) but a real data-hygiene risk now that credentials are live. | Risk | Medium |
| N-C | `'use client'` asymmetry: `google-analytics.tsx` is a client component (its GA URL template ships in the layout chunk even when unconfigured), `microsoft-clarity.tsx` is a **server** component (ships nothing when unconfigured — measured). Both are correct, but the difference is undocumented and invites a future "consistency" edit that breaks one of them. | Readability | Low |
| N-D | `use-analytics-pageview.ts:30` guards `typeof window === 'undefined'` inside a `useEffect` — unreachable, since effects never run during SSR. Harmless, but it implies a hazard that does not exist. | Readability | Low |
| N-E | `declare global { interface Window { gtag?: … } }` lives inside a hook module rather than a `.d.ts`, and `window.clarity` is never typed at all — so any future code touching `window.clarity` gets no type safety. | Readability | Low |
| N-F | `google-analytics.test.tsx` mocks `next/navigation`, so no test exercises the real `useSearchParams`/`Suspense` path. Coverage for DD-TRK-002 rests entirely on the configured build (#4). Correct given no E2E harness — recorded so the dependency is visible. | Reliability | Low |

## 8. Design Conformance

### 8.1 Design decisions — all conform

| Decision / requirement | Specified in | Shipped | Result |
|---|---|---|---|
| DD-TRK-001 structural `null`-guard | `design.md` §11 | `google-analytics.tsx:25-27`, `microsoft-clarity.tsx:26` — early return before any hook or JSX | **PASS** |
| DD-TRK-002 `Suspense` scoped to tracker only | `design.md` §11 | `google-analytics.tsx:44-46` wraps only `<GAPageviewTracker />`; not the layout, not the component | **PASS** |
| gtag bootstrap with `send_page_view: false` | `design.md` §6 | `google-analytics.tsx:35-43` — `dataLayer`, `gtag()` shim, `gtag('js', …)`, `gtag('config', …, { send_page_view: false })` | **PASS** |
| `${VAR:-}` default-empty in deploy script | `tasks.md` T-004 (N1 fix) | `deploy-web.sh:69-70`, before the build at line 76 | **PASS** |
| `data-clarity-mask` on high-risk content | `tasks.md` T-002 (C4/N2) | `user-management.tsx:250`, `document-viewer.tsx:535` | **PASS** |
| `id="ms-clarity"` for `next/script` dedupe | `tasks.md` T-002 | `microsoft-clarity.tsx:34` | **PASS** |
| `afterInteractive` on all scripts | `design.md` §3 | All 3 `<Script>` tags; pinned by `data-nscript` assertions | **PASS** |
| Effect keyed on `searchParams.toString()` | `tasks.md` T-001 (S4) | `use-analytics-pageview.ts:27, 38` | **PASS** |
| Single mount point in root `<body>`, not nested in providers | `design.md` §6 | `layout.tsx:41-42`, siblings of `</QueryProvider>`; grep confirms no other importer | **PASS** |

### 8.2 Design drift — `design.md` never received the N1–N3 corrections

Judgment Day round 2 directed N1–N3 to be fixed "in `tasks.md`." That happened, and the code followed `tasks.md`. But `design.md` was never corrected, so **the design of record now contradicts the shipped code in three places**. Two documents agreeing is not evidence — here `tasks.md` and the code agree, and `design.md` disagrees with both.

| # | `design.md` says | Code / `tasks.md` says | Result |
|---|---|---|---|
| W1 | §6: hook "calls `window.gtag('event','page_view', { page_path })`" | `use-analytics-pageview.ts:34-37` sends `page_location` + `page_title`. `page_path` is a Universal Analytics field GA4 ignores (judgment S3); `tasks.md` T-001 specifies the correct fields | **WARN** — design of record documents a field the code deliberately does not send |
| W2 | §6: source the vars "the same way the Cognito values are handled today," or from a `.env.deploy` | N1 explicitly said **drop the Cognito analogy** (Cognito comes from CFN `get_output`, these do not). `tasks.md` T-004 states this correctly. `.env.deploy` was never implemented | **WARN** — retains the exact self-contradiction N1 flagged |
| W3 | §8: "enable Clarity's strict/enhanced masking mode **when initializing the snippet**" | N2's whole point: masking mode is a **dashboard** setting, not a snippet parameter. `microsoft-clarity.tsx:18-23` and `tasks.md` T-002 both say so correctly | **WARN** — retains the exact conflation N2 flagged; a future implementer reading only `design.md` would try to pass a parameter that does not exist |

### 8.3 Cross-document figure check

| Figure | Asserted | Actual (measured) | Result |
|---|---|---|---|
| Task count | 4 (`design.md` §12, `tasks.md`, `execution.md`, `test-report.md`) | 4 | **PASS** — consistent everywhere |
| Review rounds | 1 (`design.md` §12) | 1 Reviewer pass per task, 0 rework rounds | **PASS** |
| Static routes in configured build | 17 (`execution.md` T-003, `test-report.md` §5) | 17 entries, all `○ (Static)` | **PASS** — exact |
| IDs in build output | 16/16 HTML + 15/15 `.txt` (`execution.md` T-003) | 16/16 HTML + 15/15 `.txt` | **PASS** — exact |
| Chunks containing the ID | 0 (`execution.md` T-003) | 0 | **PASS** |
| Total tests | 9, 3 suites (`test-report.md` §3) | 9, 3 suites | **PASS** |
| **LOC** | **~150** (`design.md` §12), **~150-160** (`tasks.md` §3) | **370 insertions** across `packages/web` + `scripts` — test files alone are **199** vs the estimate's "2 test files ~40 LOC" | **W5 — WARN**, 2.4× over. Driven by 3 test files (not 2) and heavy explanatory comments. Depth conclusion (Lite, single PR) still holds, so this is a budgeting-accuracy finding, not a re-sizing trigger |
| **Per-file test counts** | GA **3**, Clarity 2, hook **4** (`test-report.md` §3) | GA **2**, Clarity 2, hook **5** | **W6 — WARN**. The total (9) coincidentally matches, which is why it went unnoticed — a textbook case of a right total hiding wrong components. Verified against both HEAD and the execute-time commits: GA was 2 at `4dce1ef` and is still 2; the hook was 4 at `4dce1ef` and is 5 after `cd47bcc` |
| Unit test files | 2 (`design.md` §10 table) | 3 (the hook test file has no row in §10, though `tasks.md` T-001 specifies it) | **W4 — WARN** (minor) |
| Clarity Strict masking status | "**still open** at time of this report" (`test-report.md` §9) | "**resolved** 2026-08-06, user confirmed" (`execution.md` §3, commit `4f86fa8`) | **W7 — WARN**. Direct contradiction between two spec documents. `test-report.md` (14:50) predates the `execution.md` update (14:56) — it is simply stale, but a reader consulting only `test-report.md` would conclude a release blocker is outstanding |

### 8.4 Constitutional alignment

`docs/prd.md`, `docs/trd/trd.md`, `docs/ux-ui/design.md`, and `docs/infrastructure.md` contain **no** analytics, telemetry, tracking, consent, GDPR, cookie, or privacy requirements (verified by grep). So:

- No constitutional constraint is violated by this spec.
- `requirements.md` §11's framing of cookie consent as *undefined institutional policy* is accurate, not an evasion — there is genuinely nothing upstream to conform to.
- No design-token or UX conformance check applies: the spec adds zero visible UI, and `design.md` §6's "N/A" is correct.
- No `proposal.md` exists for this spec (Lite depth, `/akili-propose` skipped), so there is no Visual Reference to audit against.

## 9. Test Evidence Summary

| Suite | Command | Result | Re-run this audit |
|---|---|---|---|
| Frontend unit (`packages/web`) | `pnpm --filter @alliance-risk/web test --testPathPattern=analytics` | 3 suites / **9 passed**, 0 failed | Yes — green |
| Backend unit | N/A — no `packages/api` changes | N/A | N/A |
| Integration | None; substituted by T-003 build + headless-Chrome verification | PASS (execute-time) | Artifact-level consequences re-verified (builds #3/#4) |
| E2E | None — no Playwright/Cypress harness in this repo | N/A | N/A |
| Build checks | 4 build variants (§5) | 4/4 exit 0 | Yes — all re-run |
| Shell behavior | `set -u` survival of `${VAR:-}` | PASS | Yes — re-run with positive control |

**Verdicts carried through:** 0 `PRODUCT_BUG`, 0 `FAIL`, 0 flaky, 0 `AUTOMATION_DEFERRED`. No requirement inherits a FAIL from `test-report.md`.

### 9.1 Clarity Strict masking mode — documented attestation, NOT an audit-verified PASS

`execution.md` §3 and commit `4f86fa8` state the user confirmed Strict masking mode is set in the Clarity project dashboard.

**I cannot verify this and am not marking it PASS.** Masking mode is a setting in an external Microsoft Clarity dashboard — there is no artifact in this repository, no API response, and no build output that could confirm or refute it. No command available to this audit can reach it.

What I can and did confirm:

| Element of the C4/N2 mitigation | Verifiable here? | Status |
|---|---|---|
| Code-side `data-clarity-mask="true"` on the two named high-risk roots | Yes | **PASS** — grep-confirmed at `user-management.tsx:250`, `document-viewer.tsx:535` |
| Snippet does **not** invent a fake masking parameter (the N2 error) | Yes | **PASS** — `microsoft-clarity.tsx` passes only the project ID; the comment names the real mechanism |
| Dashboard masking mode = Strict | **No — external system** | **ATTESTED by the user, recorded as such** |

Recorded accordingly: a documented human attestation, appropriate as the designed substitute verification for a mitigation with no automated check, and correctly labeled — but not independent evidence. `test-report.md` §9 still calls this open (W7); that row should be reconciled with `execution.md` before archive.

### 9.2 Accepted gaps — reviewed and concurred

| Gap | Assessment |
|---|---|
| No CI-wired integration/E2E check re-verifying live script injection | **Concur.** Adding Playwright is a stack decision, correctly refused inside a test pass. The mitigation (repeat the manual build+serve check when touching these 3 files) is recorded in `test-report.md` §9. |
| Real GA4 DebugView `page_view` count never observed | **Concur** — designed gap per `requirements.md` §9. Note: a real GA4 property now exists (`.env.local`), so this *became* runnable after the spec closed. Optional post-archive confirmation, not a blocker. |
| "No console errors" (FR-TRK-001) not re-runnable | Verified once at T-003 in headless Chrome; no harness preserves it. Same root cause as the E2E gap. |

## 10. Agent Guide / Constitution Impact

**Largely N/A — confirmed explicitly rather than skipped.**

| Check | Finding |
|---|---|
| Was a new module or package created? | **No.** All new files live inside the existing `packages/web` (`src/components/analytics/`, `src/hooks/`) plus one line-level edit to `scripts/deploy-web.sh`. No new workspace package, no new top-level directory needing its own guide. |
| Does root `CLAUDE.md`'s `## Module Guides` index need a new row? | **No.** `packages/web/CLAUDE.md` is already indexed. No boundary moved, no public surface changed. |
| Does `execution.md` contain a `## Constitution Impact` section? | **No** — and correctly so, given the above. |
| Was a module boundary crossed? | **No.** Frontend-only; zero API, Prisma, shared-package, or infra-topology changes. The "Frontend NEVER talks directly to Bedrock" rule is untouched (these are third-party analytics endpoints, not model calls). |
| Was the child guide updated? | **Partially.** `packages/web/CLAUDE.md` gained a correct, well-scoped `## Analytics` section (env vars, component paths, the manual Clarity step). |
| **W11 — child-guide staleness** | `packages/web/CLAUDE.md`'s `## Structure` tree lists neither `components/analytics/` nor `hooks/use-analytics-pageview.ts`. The prose section covers the feature, so the guide is not *wrong*, only incomplete. **WARN**, pending work for `/akili-archive`'s Constitution & Graph Sync step — not a full drift sweep (that is `/akili-audit`'s job). |
| CodeGraph sync | N/A — root `CLAUDE.md` records CodeGraph as not initialized. |

## 11. Remediation

**Nothing here blocks the product.** All 12 items are document or verification-command edits. Grouped by whether they should precede archive.

### 11.1 Recommended before archive — spec-document corrections (~20 min, all inside `docs/specs/enhancements/tracking-analytics/`)

| # | Action | File | Why now |
|---|---|---|---|
| W1 | Change §6's hook row from `{ page_path }` to `{ page_location, page_title }` | `design.md` | Design of record contradicts shipped code |
| W2 | Drop the "same way the Cognito values are handled today" analogy and the unimplemented `.env.deploy` option from §6's deploy row | `design.md` | Retains the exact contradiction N1 said to remove |
| W3 | Reword §8 from "when initializing the snippet" to "in the Clarity project dashboard" | `design.md` | Retains the exact N2 conflation; misleads future implementers |
| W6 | Correct §3's per-file test counts to GA 2 / Clarity 2 / hook 5 | `test-report.md` | Currently false; right total hides wrong components |
| W7 | Update §9's last row to reflect the attested Strict-masking confirmation, cross-referencing `execution.md` §3 | `test-report.md` | Two spec docs contradict each other on a release-gating item |
| W5 | Note actual 370 LOC against the ~150 estimate | `design.md` §12 / `tasks.md` §3 | Keeps future Lite-depth budgeting honest (Kaizen input) |
| W4 | Add the hook test file to §10's table; add the 2 masking files + 3 test files to §6's modified-files table | `design.md` | Change-set inventory is incomplete |

**Correction closure:** each edit above must be swept both ways per `/akili-specify`'s rule — forward (grep the superseded value across the whole spec folder for sites the finding did not cite, e.g. `page_path`, `.env.deploy`, "initializing the snippet", the LOC figure) and backward (any document citing the corrected section). W5 in particular appears in **two** documents (`design.md` §12 and `tasks.md` §3); fixing only one relocates the inconsistency instead of resolving it.

### 11.2 Recommended before archive — verification-command fidelity (~10 min)

| # | Action | File | Why now |
|---|---|---|---|
| W9 | Replace the bare unconfigured-build command with `NEXT_PUBLIC_GA_MEASUREMENT_ID= NEXT_PUBLIC_CLARITY_ID= pnpm --filter @alliance-risk/web build`, noting that `.env.local` otherwise contaminates it | `tasks.md` T-001/T-003, `design.md` §10 | A recorded verification command that no longer proves what it claims — same defect class as C1, and it will mislead the next person to re-run it |
| W8 | Fix the `test -- --testPathPattern` commands to the single-`--` form in this spec's task cards | `tasks.md` T-001/T-002 | Literal execution yields a false green (reproduced) |

### 11.3 Follow-up work — outside this spec, recommend tracking separately

| # | Action | Scope | Priority |
|---|---|---|---|
| W10 / A7 | Document how an operator supplies the two IDs at deploy time; optionally add a `log` line reporting analytics enabled/disabled | `docs/infrastructure.md` or root `CLAUDE.md` + `deploy-web.sh` | **Medium** — residual half of C2; the feature ships inert until someone knows to export them |
| W11 / A10 | Add `components/analytics/` and `hooks/use-analytics-pageview.ts` to the `## Structure` tree | `packages/web/CLAUDE.md` | Medium — assign to `/akili-archive` Constitution & Graph Sync |
| A1 | Fix the `pnpm … test -- --testPathPattern` form repo-wide (root + `packages/web` `CLAUDE.md`) | Both guides | **Medium** — a documented false-green command; all three Reviewers plus this audit hit it independently. Strong Kaizen candidate |
| N-B | Decide dev/prod analytics separation now that `.env.local` points local builds at the production GA property | `packages/web` | Medium — data hygiene; not a spec violation |
| A2 | `JSON.stringify` the interpolated ID in **both** inline scripts (`google-analytics.tsx:41`, `microsoft-clarity.tsx:42`) | `packages/web` | Low — 2-line hardening; note the Clarity half was not in the original advisory |
| A9 | Add the pre-existing `NEXT_PUBLIC_*` vars to `.env.example` so it works as a full template | `packages/web/.env.example` | Low |
| A8 | Reword `deploy-web.sh:65`'s "from stack outputs" log line | `scripts/deploy-web.sh` | Low — cosmetic |
| A6 | Extend `data-clarity-mask` to the delete-confirmation dialog email and user search input | `packages/web` | Low — accepted risk; revisit if Strict masking proves insufficient |
| A4 | Add `jest.resetModules()` guarding if the Clarity test file grows | test file | Low — latent, currently passing |
| N-C/N-D/N-E | Document the `'use client'` asymmetry; drop the unreachable SSR guard; move the `Window` augmentation to a `.d.ts` and type `window.clarity` | `packages/web` | Low — readability |
| A11 | Inform Product that pageview counts include the unauthenticated→`/login` redirect hop | Product comms | Low — informational |
| — | Consider Playwright for `packages/web` to make the T-003 browser verification repeatable | New spec | Low — a stack decision, correctly deferred |

## 12. Archive Readiness Recommendation

**Recommended: correct the spec documents, then archive.**

| Criterion | Status |
|---|---|
| All required tasks `[x]` | **Yes** — 4/4, each with Implementer + independent Reviewer records |
| No unresolved FAIL findings | **Yes** — 0 FAIL, 0 BLOCKED |
| WARN findings accepted or have follow-ups | **Yes** — all 12 are documentation/verification edits, itemized in §11 with owners |
| Tests cover key requirements and scenarios | **Yes** — 9/9 green; all 18 scenarios/clauses traced to evidence; 0 PRODUCT_BUG |
| Implementation drift reflected in the docs | **Partially — this is the one gap.** W1–W3 are shipped-code-vs-`design.md` divergences that no document currently records |
| User has reviewed the validation summary | Pending |

**Assessment.** The implementation is genuinely done and genuinely correct. The Judgment Day process worked: all four confirmed findings are fixed in code, and the two suspect findings that mattered (S4, S5) were closed by the test pass. Independent re-verification reproduced the strong claims — "17 routes static," "16/16 HTML," "0 chunks," and the `set -u` positive control all matched exactly. Nothing in `execution.md` or `test-report.md` marked "closed" or "verified" turned out to be overstated about the code.

The one thing that did not keep pace is `design.md`. Judgment Day routed the N1–N3 corrections into `tasks.md`, the implementation followed `tasks.md`, and `design.md` was left asserting three things the shipped code contradicts. Archiving in that state preserves a design of record that would mislead the next reader — the `page_path` field the code deliberately avoids, a deploy mechanism that was rejected, and a masking parameter that does not exist. Those are ~15 minutes of edits (§11.1), and they are worth making first precisely because archiving is what makes these documents authoritative.

Two verification-fidelity items (§11.2) deserve the same treatment for the same reason: both W8 and W9 are recorded commands that pass while proving nothing, which is the failure mode this spec's own Judgment Day round caught as C1. Leaving them in an archived spec hands the next person a false green.

W10 (no operator instruction for the deploy vars) is the only item touching real-world behavior — the feature ships inert until someone knows to export the IDs. It is genuinely outside this spec's file scope, so track it as follow-up rather than a blocker, but it should not be lost: it is the residual half of C2.

**Next command after the §11.1 + §11.2 corrections:**

```text
/akili-archive enhancements/tracking-analytics
```

Archiving without those corrections is defensible — no FAIL findings exist and the product is sound — but it locks in three known-false design statements and two false-green commands.
