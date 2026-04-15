# User Testing Simulation Log — CGIAR Risk Intelligence Tool

This is the consolidated log of every internal or analyst-led simulation performed against the tool. Each session appends a new entry. The goal is to produce a single rollup of system failures, logic inconsistencies, methodology misalignments, and UX confusion points so the engineering team can triage them.

| Field | Value |
|-------|-------|
| Log maintained by | Engineering team |
| Start date | 2026-04-15 |
| Companion document | [analyst-test-protocol.md](./analyst-test-protocol.md) |

---

## How to add a session

1. Copy the **Session template** below to the bottom of the "Sessions" section.
2. Fill in fields — `TBD` or `n/a` are acceptable if not observed.
3. Reference the completed analyst scoring sheet (§5 of the protocol) by attachment path or inline block.
4. Open a small PR (`docs: add simulation session YYYY-MM-DD — <analyst initials>`) so each session is tracked in git.

## Severity scale used in this log

| Level | Meaning | Example |
|:-----:|---------|---------|
| `S0` | Blocker — prevents the smoke path from completing | Lambda fails on upload; all uploads return 500 |
| `S1` | Major — smoke path completes but a step is severely degraded | PDF generates with phantom blank pages; gap detection returns nothing |
| `S2` | Moderate — smoke path completes but output is misleading or confusing | Gap field label reads `workforce_summary`; timeframe badge reads `SHORT_TERM` |
| `S3` | Minor — cosmetic or low-impact | A heading is slightly misaligned in the PDF |
| `S4` | Informational — worth capturing but not actionable | Model choice Q: "Why Kimi K2.5 vs Claude?" |

---

## Summary dashboard (updated per session)

| Category | S0 | S1 | S2 | S3 | S4 | Resolved |
|----------|:-:|:-:|:-:|:-:|:-:|:-:|
| System failures | 0 | 0 | 0 | 0 | 0 | 0 |
| Logic inconsistencies | 0 | 0 | 0 | 1 | 0 | 0 |
| Methodology misalignments | 0 | 0 | 0 | 0 | 2 | 0 |
| UI / UX confusion | 0 | 0 | 1 | 2 | 0 | 5 |
| **Totals to date** | **0** | **0** | **1** | **3** | **2** | **5** |

> Totals reflect only **Session 1** (engineering-led retrospective capture from `execution.md` records). The moment an analyst-led session is added, re-tally.

---

## Sessions

### Session 1 — Engineering retrospective (2026-04-15)

- **Analyst(s):** Engineering team (retrospective capture)
- **Environment:** Dev — `https://d363y7wran37rr.cloudfront.net`
- **Source assessments:** Ecovado Oil Processing smoke upload (2026-04-13); Bluewave Fisheries smoke (2026-04-08 during `report-generator` Phase 1 deploy); Phase 2 smoke (2026-04-09)
- **Scope:** Not a full analyst simulation. A consolidation of already-recorded observations from `docs/specs/*/execution.md` files into this log's format.

#### Observations

| # | Type | Severity | Observation | First seen | Status | Evidence |
|:-:|------|:--------:|-------------|:----------:|--------|----------|
| 1 | System failure | S1→Resolved | DOCX extraction 10–30× slower than PDF for equivalent content | 2026-04-12 | ✅ Resolved 2026-04-13 via `mammoth.extractRawText` default path | `docs/specs/enhancements/upload-word-documents/execution.md` §T-001..T-011 |
| 2 | UI/UX | S2→Resolved | PDF appendix table headers not repeating on continuation pages | 2026-04-10 | ✅ Resolved via `renderAppendixTable.drawHeader()` redraw | `docs/specs/report-generator/execution.md` |
| 3 | UI/UX | S3→Resolved | Mobile viewport: report-configuration dialog Cancel / Generate PDF buttons clipped | 2026-04-10 | ✅ Resolved via scrollable dialog body | `docs/specs/report-generator/execution.md` |
| 4 | UI/UX | S2→Resolved | Gap-detector field labels rendered as `workforce_summary` (snake_case) in the PDF | ~2026-04-10 | ✅ Resolved via `formatFieldLabel()` helper | `docs/specs/report-generator/execution.md` |
| 5 | UI/UX | S2→Resolved | Action-plan timeframe badges rendered as `SHORT_TERM` / `MEDIUM_TERM` | ~2026-04-10 | ✅ Resolved — same helper (Short-Term, Medium-Term) | `docs/specs/report-generator/execution.md` |
| 6 | UI/UX | S2 | Gap-detector: when the user edits a field and the API rejects it, the user can lose track of which field the feedback applies to | 2026-03 (earlier) | ✅ Resolved via auto-filter to "Needs Attention" + banner | `docs/specs/gap-detector/design.md` + code |
| 7 | Logic inconsistency | S3 | Bedrock occasionally returns `margins.gross` as `60` instead of `0.60`; the progress-bar clamp treats `60` as `1.0` (100% width), and the displayed label reads "6000%" — which is an obvious visual red flag rather than silent miscalculation | ~2026-04 | ⚠️ Defensive only — no upstream correction | `docs/specs/report-generator/execution.md` + `pdf.service.ts` |
| 8 | Methodology | S4 | Category rollup is an **unweighted mean** of the 7 categories. Design docs reference a weighting model but none is applied today. Documented as an intentional MVP choice — see [`docs/specs/risk-analyzer/design.md`](../specs/risk-analyzer/design.md) DD-WEIGHTS. | baseline | ⚠️ Pending stakeholder validation | Design decision record |
| 9 | Methodology | S4 | The Alliance/CIAT risk-matrix thresholds from the source spreadsheet are NOT encoded as deterministic checks. The AI applies domain knowledge via prompt. Documented as intentional — see DD-RISKMATRIX. | baseline | ⚠️ Pending stakeholder validation | Design decision record |
| 10 | UI/UX | S3 | Long gap-field "Detected Value" text was being clipped without an ellipsis in earlier PDFs | ~2026-04 | ✅ Resolved via `ellipsis: true` and row-height clamp in `renderAppendixTable` | `docs/specs/report-generator/execution.md` |

#### Expected vs observed table (PDF output after 2026-04-13 fixes)

| Element | Expected | Observed | Agreement |
|---------|----------|----------|-----------|
| Page count for full Phase 2 report | 40–60 pages | ~55 pages (per 2026-04-09 deploy smoke) | ✅ |
| Phantom / blank pages | 0 | 0 after `doc.page.margins.bottom = 0` footer fix | ✅ |
| Footer numbering consistency | `Page 1 of N` … `Page N of N` | Matches | ✅ |
| Gap-detector label format | `Workforce Summary` | `Workforce Summary` (post-fix) | ✅ |
| Action plan badge format | `Immediate / Short-Term / Medium-Term` | Matches (post-fix) | ✅ |
| DOCX extraction wall-clock for Ecovado sample | < 1 s | ~500 ms (`mammoth.extractRawText` default path, local smoke) | ✅ |

#### Session conclusion

Engineering-side verification is complete for the issues that surfaced during development. **No analyst-led simulation has yet been recorded in this log** — item 11 below is a placeholder for the first one.

---

### Session 2 — First analyst-led UAT (TBD)

- **Analyst(s):** _to be filled_
- **Environment:** _dev / staging_
- **Source assessment:** _TBD_
- **Scope:** Follow [analyst-test-protocol.md](./analyst-test-protocol.md) smoke path + all edge cases. Fill out §3 Likert scale and §5 scoring sheet.

*This slot is reserved for the first external analyst session. Remove the "TBD" marker and fill in once conducted.*

---

## Session template (copy when adding a new entry)

```markdown
### Session N — <Analyst initials> (YYYY-MM-DD)

- **Analyst(s):** <names / roles>
- **Environment:** <dev / staging / prod URL>
- **Source assessment:** <filename or assessment-ID>
- **Scope:** <which sections of the test protocol were executed>
- **Session duration:** <HH:MM>

#### Observations

| # | Type | Severity | Observation | Status | Evidence |
|:-:|------|:--------:|-------------|--------|----------|
| 1 | <system fail / logic / methodology / UX> | S0–S4 | <concise description> | Open / Resolved / Deferred | <screenshot link or log line> |

#### Expected vs observed table

| Element | Expected | Observed | Agreement |
|---------|----------|----------|-----------|
| | | | |

#### Calibration summary (from scoring sheet §5)

| Metric | Value |
|--------|-------|
| Mean \|Δ\| across 35 indicators | |
| Indicators with \|Δ\| > 20 | |
| Indicators where evidence did NOT agree | |
| Overall agreement with category rollup | |
| Confidence in using PDF for investment committee (1–5) | |

#### Session conclusion

<two or three sentences — next action, open questions, handoff to engineering>

---
```

## Backlog triage (auto-updated from sessions)

When a new observation is added above, cross-reference it here if it requires code changes:

| Observation ref | Owner | Planned fix date | Target module |
|-----------------|-------|------------------|---------------|
| — | — | — | — |

(Empty at log initialisation. Populate as analyst sessions produce actionable items.)
