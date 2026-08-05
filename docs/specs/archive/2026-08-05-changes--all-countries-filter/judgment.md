# Judgment Day — Design Review

## Document Control

| Field | Value |
|-------|-------|
| **Spec path** | `changes/all-countries-filter` |
| **Target** | `requirements.md` v1.0 + `design.md` v1.0 (pre-implementation) |
| **Round** | 1 |
| **Judges** | Judge A (opus), Judge B (opus) — blind, parallel, identical scope |
| **Author model** | Sonnet 5 (author ≠ auditor honored) |
| **Date** | 2026-08-05 |

## Merged Ledger

| # | Severity (A / B) | Finding | Confirmed by both? |
|---|---|---|---|
| 1 | SEVERE / WARNING | `design.md` §4.4 falsely claims `DEFAULT_COUNTRY` is already imported in `start-assessment-modal.tsx` — it is not (only `IntakeMode`, `SUPPORTED_COUNTRIES`, `SupportedCountryLabel` are). Implemented literally, the guard references an undefined symbol and fails to compile. | **Yes — same fact, both judges independently verified it against source** |
| 2 | WARNING / WARNING | `app-layout.tsx` is an unlisted consumer of `useCountryFilter()` — it's the actual component that renders `<AppHeader activeCountry={...} onCountryChange={...} />`. Design's "four files" inventory and DD-ACF-002's "grepped every consumer" claim are incomplete. Confirmed non-breaking (types widen compatibly) but the design never verified or stated this. | **Yes** |
| 3 | WARNING / WARNING | Testing Strategy row for FR-ACF-002 ("dashboard query mapping") targets `use-assessments.test.ts`, but the sentinel→`undefined` translation lives in `dashboard/page.tsx` per §4.3 — the hook never sees the sentinel. A hook-level test cannot exercise the new logic; the Must requirement's core guarantee would ship with no direct unit test. | **Yes** |
| 4 | SUGGESTION | `react-hooks/exhaustive-deps` may flag `countryParam` if it's not in the filters-effect dependency array. | Yes (both, independently) |
| 5 | SUGGESTION (A only) | `readStoredCountry()`'s declared return type (`SupportedCountryLabel`) is never widened to `CountryFilterValue` in the design, even though its fallback branches must now return the sentinel — as declared, this will not type-check. | Suspect (one judge) — verified directly against the design's own described behavior; not a guess |

**Confirmed SEVERE (both judges agree on the underlying fact):** 1
**Confirmed WARNING (both):** 2, 3
**Suggestions:** 4, 5
**Contradictions:** none

## Verdict

`JUDGMENT: ESCALATED ⚠️` — one confirmed correctness defect (#1) requires a decision before `tasks.md` is written; per Judgment Day's Decision Gate, a confirmed severe finding always stops for the user before correction.

## Resolution — "Fix only" (round 1, no re-judgment)

| # | Outcome | Where fixed |
|---|---|---|
| 1 | **Fixed** | `design.md` §4.4 now states `DEFAULT_COUNTRY` must be *added* to the import, not that it's already present |
| 2 | **Fixed** | `design.md` Executive Summary + new DD-ACF-004 document `app-layout.tsx` as a verified pass-through |
| 3 | **Fixed** | `design.md` §4.1 adds `resolveListCountryParam()` as an exported pure function; §8 Testing Strategy retargets its test to the provider's test file instead of `use-assessments.test.ts` |
| 4 | **Fixed** | `design.md` §4.3 specifies the filters-effect should call the helper inline, keyed only on `activeCountry`, avoiding the lint warning entirely |
| 5 | **Fixed** | `design.md` §4.1 now states `readStoredCountry()`'s return type must widen to `CountryFilterValue`, including its SSR branch |

All findings resolved by direct documentation correction — no re-judgment run (user selected "Fix only"; all fixes were mechanical corrections grounded in evidence both/one judge(s) verified directly against source, not requiring adversarial re-verification).
