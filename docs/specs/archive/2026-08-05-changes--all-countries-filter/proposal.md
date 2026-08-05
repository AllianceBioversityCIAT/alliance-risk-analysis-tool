# All-Countries Dashboard Filter — Proposal

## 1. Document Control

| Field | Value |
|-------|-------|
| **Spec path** | `changes/all-countries-filter` |
| **Type** | Change |
| **Approval Mode** | gated |
| **Status** | Approved |
| **Project** | CGIAR Risk Intelligence Tool |
| **Version** | 1.0 |
| **Date** | 2026-08-05 |
| **Source** | Direct user request (escalated from `/akili-quick` — fails the triviality gate: touches shared-package types, changes default behavior, spans 5+ files) |
| **Related spec** | `docs/specs/archive/2026-07-29-enhancements--multi-country-enablement/` — this change amends that spec's FR-MC-005 and FR-MC-010 |

### References

| Ref | Document |
|-----|----------|
| C1 | `docs/specs/archive/2026-07-29-enhancements--multi-country-enablement/requirements.md` — FR-MC-003, FR-MC-004, FR-MC-005, FR-MC-009, FR-MC-010 |
| C2 | `docs/figma-design/screens/02-dashboard.md` — context selector (designed for 4 countries only, not "All") |
| C3 | `docs/ux-ui/design.md` — no dedicated token for a country selector exists; reuses the shadcn `DropdownMenu` pattern already in place |

---

## 2. Intent

Let an analyst see assessments across **all four countries at once** from the dashboard, and make that the default landing view — instead of always starting scoped to Kenya and having to actively switch. "All countries" exists **only** as a dashboard filter state; it must never be a selectable value when creating an assessment, since every assessment still belongs to exactly one real country.

---

## 3. Problem / Current Behavior

| Area | Today |
|------|-------|
| **Default view** | `CountryFilterProvider` initializes to `DEFAULT_COUNTRY` (`"Kenya"`); a first-time or cleared-storage user always lands scoped to Kenya |
| **Header selector** | Lists exactly the 4 supported countries (`SUPPORTED_COUNTRIES` from `@alliance-risk/shared`) — no "all" option |
| **List/stats API** | `GET /api/assessments` and `GET /api/assessments/stats` already treat an **omitted** `country` query param as "no filter" — this behavior already exists and needs no backend change |
| **Create flow** | `start-assessment-modal.tsx` pre-fills its country `Select` from the dashboard's `activeCountry` — if that becomes an "All countries" sentinel, it would leak into the creation form unless explicitly guarded |

Analysts managing assessments across multiple countries currently have no single view of everything — they must check each country's filter one at a time, and the app always defaults to Kenya even for someone whose day starts by reviewing all open work.

---

## 4. Proposed Outcome

1. The header's country dropdown gains a 5th, top-of-list option: **"All countries"**.
2. **"All countries" becomes the default** — a fresh session (no valid stored preference) lands showing every assessment across all countries, not Kenya.
3. Selecting "All countries" clears the `country` query param sent to the list and stats endpoints, so both show unscoped totals — reusing the API's existing "omit = all" behavior, with **no backend change**.
4. The **create-assessment country `Select`** (`start-assessment-modal.tsx`) is unaffected: it still lists only the 4 real countries. When "All countries" is the active dashboard filter and the analyst opens "Start New Assessment," the form's default country falls back to `"Kenya"` (matching today's backward-compatible default) rather than showing no selection or leaking the sentinel.
5. The persisted filter (`localStorage`) supports "All countries" as a valid stored state, restored on return visits exactly like a real country is today.

---

## 5. Scope

### In scope

- Add an "All countries" pseudo-value to the **dashboard header filter only**
- Change the filter's default from `"Kenya"` to "All countries"
- Wire the dashboard list + stats queries to omit `country` when "All countries" is active
- Guard the create-assessment modal's default-country logic so the sentinel never reaches it
- Guard the dashboard's empty-state messaging (`AssessmentTable`) so "All countries" doesn't render literally as a country name (e.g. "No assessments for All countries yet" reads fine, but implementation must not require a new `SUPPORTED_COUNTRIES` entry to make that string work)
- Persist the new default/state in `localStorage`, backward-compatible with existing stored values (`"Kenya"`, `"Ethiopia"`, etc. remain valid)

### Non-goals

- No change to the 4-country allowlist used for assessment creation (`SUPPORTED_COUNTRIES`, `SupportedCountryLabel`)
- No backend/API change — the "omit `country` = all" behavior already exists and is reused as-is
- No change to AI prompt injection, scoring, or the report/PDF pipeline
- No "All countries" option anywhere except the one dashboard header dropdown (not in `AssessmentStatsQueryDto`-driven UI elsewhere, not in draft-resume, not in any admin screen)

---

## 6. Affected Users, Systems, And Specs

| Actor / System | Impact |
|----------------|--------|
| **Risk Analyst** | New default view; can explicitly filter back to one country same as today |
| **Web — `providers/country-filter-provider.tsx`** | State type widens to include the new sentinel; default init and `localStorage` validation both change |
| **Web — `components/layout/app-header.tsx`** | New dropdown option; must not call `getCountryFlag()` (typed for real countries only) on the sentinel |
| **Web — `app/(protected)/dashboard/page.tsx`** | Must translate "All countries" → omitted `country` param before calling `useAssessments`/`useAssessmentStats`, and before passing `activeCountry` into `<AssessmentTable>`'s empty-state prop |
| **Web — `components/assessment/start-assessment-modal.tsx`** | Default-country fallback logic needs a guard so the sentinel never becomes a create-time value |
| **`@alliance-risk/shared`** | **Not touched** — see Recommended Approach; the sentinel is a Web-only view concept, not a real country |
| **API** | **Not touched** — existing optional-`country`-means-all behavior is reused verbatim |

---

## 7. Visual Reference

- **Source:** None (no Figma link or mockup provided)
- **Location:** N/A
- **Notes:** This extends the existing `AppHeader` `DropdownMenu` pattern already implemented (flag emoji + label, per `docs/figma-design/screens/02-dashboard.md` Pattern 2) with one additional row. No new visual design was requested; the proposal recommends a globe icon (🌍) for the "All countries" row as a placeholder, open to revision at `/akili-specify` time or if the user wants a Figma-driven icon instead.

---

## 8. Requirement Delta Preview

Amends `docs/specs/archive/2026-07-29-enhancements--multi-country-enablement/requirements.md`.

### ADDED Requirements

- **FR-ACF-001:** The header country selector SHALL expose a 5th option, "All countries," positioned above the 4 real countries.
- **FR-ACF-002:** Selecting "All countries" SHALL cause the assessment list and dashboard stats to reflect every country, by omitting the `country` query parameter entirely (not sending an empty/wildcard value).

### MODIFIED Requirements

- **FR-MC-005 (persist active filter):** default value on first visit or invalid stored state changes from `"Kenya"` → `"All countries"`.
- **FR-MC-010 (header filter functional):** the selector's option set grows from 4 to 5; behavior for the 4 real-country options is unchanged.
- **FR-MC-009 (start-assessment modal default):** pre-fill logic must resolve "All countries" → `"Kenya"` before defaulting the create form's country field (today it copies `activeCountry` verbatim, which would break once `activeCountry` can be the sentinel).

### REMOVED Requirements

- None.

---

## 9. Approach Options

### Option A — Web-local sentinel constant, typed union on the provider (Recommended)

Add a small, **Web-package-only** sentinel (e.g. `ALL_COUNTRIES = 'ALL_COUNTRIES'` and `type CountryFilterValue = SupportedCountryLabel | typeof ALL_COUNTRIES`) living in `packages/web/src/providers/country-filter-provider.tsx` (or a tiny co-located constants file) — **not** in `@alliance-risk/shared`. `CountryFilterProvider`'s state becomes `CountryFilterValue`; every consumer that needs a real country (the create modal's default, `AssessmentTable`'s empty-state country name) explicitly narrows `activeCountry === ALL_COUNTRIES ? <fallback> : activeCountry` at the point of use.

| Pros | Cons |
|------|------|
| Zero change to `@alliance-risk/shared` — the 4-country allowlist used for validation/creation is untouched, so this closes the "touches a shared contract" concern raised when this was rejected from `/akili-quick` | A few call sites need an explicit narrowing check (small, but more than one file) |
| TypeScript makes it a compile error to accidentally pass the sentinel where a real `SupportedCountryLabel` is required (e.g. into `CreateAssessmentDto`) — directly prevents the exact leak this proposal must avoid | |
| Reuses the API's existing "omit = all" behavior as-is — no backend change | |

### Option B — Use `undefined` as the sentinel (no new constant)

`activeCountry: SupportedCountryLabel | undefined`; `undefined` means "All countries"; absence of the `localStorage` key naturally maps to it.

| Pros | Cons |
|------|------|
| No new exported name to maintain | `undefined` is semantically overloaded — harder to distinguish "intentionally showing all" from "not yet initialized" while debugging or reading a diff |
| Slightly less code | Less self-documenting at call sites (`activeCountry={undefined}` reads as a bug risk, not intent) |

### Option C — Separate `showAllCountries` boolean alongside `activeCountry`

Keep `activeCountry` always a real country; add a second flag that, when true, means "ignore `activeCountry` and show everything."

| Pros | Cons |
|------|------|
| — | Two pieces of state that must stay in sync; any code path that reads `activeCountry` without also checking the flag is a latent bug. Rejected — Option A achieves the same safety with one variable, not two. |

---

## 10. Recommended Approach

**Option A.** It fully addresses the exact risk that got this change bounced out of `/akili-quick` — that "All countries" would either pollute the shared 4-country contract or leak into assessment creation — by keeping the sentinel a Web-only, type-checked concept that never crosses into `@alliance-risk/shared`, the API, or `CreateAssessmentDto`. It also means this change, once specified, is materially smaller than the original quick-gate rejection suggested: no backend touch, no shared-package touch, four Web files.

---

## 11. Risks, Dependencies, And Open Questions

| Risk | Mitigation |
|------|------------|
| Sentinel leaks into `start-assessment-modal.tsx`'s default country | Explicit narrowing at the one call site that reads `activeCountry` for a create default (Option A design) |
| `AppHeader`'s `getCountryFlag()` call breaks or misbehaves on the sentinel | Special-case the "All countries" row's icon/label in `AppHeader` directly; never call `getCountryFlag()` with the sentinel |
| Existing users with `"Kenya"` (or another real country) already in `localStorage` see an unexpected default change | None needed — only the *no-stored-value* default changes; an existing valid stored value is respected exactly as today (no migration, no data loss) |
| `AssessmentTable` empty-state message reads awkwardly for "All countries" with zero assessments | Confirm exact copy at `/akili-specify` time (e.g. "No assessments yet" generic message vs. "No assessments for All countries yet") |

### Open questions

| ID | Question | Proposed default |
|----|----------|-------------------|
| OQ-01 | Icon for the "All countries" row? | 🌍 (globe emoji), revisit if a Figma reference is provided later |
| OQ-02 | Should dashboard stat cards' "All countries" totals be visually distinguished from a single-country view (e.g. a subtitle)? | No — reuse the existing stat card layout unchanged; scope is filter behavior, not new UI chrome |

---

## 12. Success Criteria

| # | Criterion |
|---|-----------|
| SC-01 | Fresh session (no stored preference) lands on "All countries," showing assessments from every country |
| SC-02 | Selecting "All countries" in the header shows the union of all countries' assessments and stats |
| SC-03 | Switching back to a specific country filters exactly as it does today (no regression) |
| SC-04 | "All countries" never appears as an option in the Start New Assessment country `Select` |
| SC-05 | Opening "Start New Assessment" while "All countries" is active pre-fills the form's country as `"Kenya"`, not blank or invalid |
| SC-06 | Existing `localStorage` values for real countries continue to restore correctly (no regression to FR-MC-005's non-default path) |

---

## 13. Next Step

```text
/akili-specify changes/all-countries-filter
```
