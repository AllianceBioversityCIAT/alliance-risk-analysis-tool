# Analyst Test Protocol — CGIAR Risk Intelligence Tool

| Field | Value |
|-------|-------|
| Audience | Alliance analysts, CGIAR partner teams running UAT |
| Environment | Dev — `https://d363y7wran37rr.cloudfront.net` |
| Version | 1.0 |
| Date | 2026-04-15 |
| Expected session duration | 45–60 minutes |

This protocol lets a non-engineer exercise the full risk-assessment pipeline end-to-end and record findings in a structured, comparable way. Pair it with the [simulation log](./simulation-log.md) so multiple sessions can be rolled up for triage.

---

## Pre-flight

Before the session, confirm:

- [ ] You have valid Cognito credentials for the dev environment (username + password issued by an admin via the Users page).
- [ ] You can reach `https://d363y7wran37rr.cloudfront.net` from your browser.
- [ ] You have a sample enterprise document to upload. A realistic business-plan DOCX (≥ 3 pages, with tables and headings) or PDF works. The Alliance/CIAT team has previously used *Ecovado Oil Processing Business Model*, *Bluewave Fisheries*, *Passion Farm Products*, and *Tilime Honey Produce* as references.
- [ ] You have a scoring sheet open (see §5 below) for recording observations.
- [ ] A stopwatch or phone timer is available — some steps have target latencies.

---

## 1. Smoke path (happy flow)

Target completion time: **~15 minutes** end-to-end, excluding reading time.

| # | Step | Expected behaviour | Pass / Fail notes |
|---|------|--------------------|--------------------|
| 1 | Go to `https://d363y7wran37rr.cloudfront.net` | Login screen appears | |
| 2 | Sign in with test credentials | Redirects to Dashboard with assessment list | |
| 3 | Click **New Assessment** | Assessment creation dialog opens | |
| 4 | Enter a company name (e.g. *Test SME — your initials*), country = Kenya, confirm | New assessment appears in the list with status `DRAFT` | |
| 5 | Click the assessment card | Upload page opens with drop-zone visible | |
| 6 | Drag-drop or select a DOCX/PDF sample | File appears in the queue with status `PENDING_UPLOAD` → `UPLOADED` → `PARSING` | |
| 7 | Wait for extraction | Status turns to `PARSED` within **5 s for DOCX** / **30 s for PDF** on warm Lambda (add 1.5 s each for cold start) | |
| 8 | Click **Detect Gaps** (or auto-navigate, depending on wiring) | Gap-detector inbox opens with the 10 core fields listed | |
| 9 | Review the field cards | Most fields should show `VERIFIED` for a substantive business document; a few may show `MISSING` or `PARTIAL` | |
| 10 | Edit a `MISSING` or `PARTIAL` field and click the save icon | Field moves to `VERIFIED` (optimistic update); filter pills show updated counts | |
| 11 | Repeat for every non-VERIFIED field | Counter pills show `Needs Attention (0)` | |
| 12 | Click **Analyze Risks** | Screen briefly shows a "validating" state, then navigates to the Risk Scorecard | |
| 13 | Observe the Risk Scorecard | 7 category cards with scores 0–100 and level badges; subcategory drill-down via "View details" | |
| 14 | Click **Full Report** (sidebar or top-nav) | Web preview renders with radar, exec summary, per-category detail | |
| 15 | Click **Download PDF**, choose the **Professional** preset, click **Generate PDF** | Config dialog closes; floating progress card appears bottom-right with step-by-step stages | |
| 16 | Wait for the PDF | Typical elapsed time: 30–90 s. Progress card shows "Generating executive summary → Extracting financial metrics → Planning action timeline → Rendering PDF document → Uploading report" | |
| 17 | PDF downloads automatically or a download link appears | Open the PDF. Expect ~ 25–55 pages depending on config. Verify cover page, TOC, risk overview, financial overview (if data), action plan, appendix, disclaimer. | |

### Smoke-path pass criteria

- All 17 steps complete without error
- No `FAILED` job status along the way
- PDF renders without blank / phantom pages
- Footer reads "Page X of Y" with continuous numbering on every content page
- Gap-detection field labels display as "Workforce Summary" not `workforce_summary` (human-readable)
- Action plan timeframe badges read "Immediate / Short-Term / Medium-Term" (not `SHORT_TERM`)

---

## 2. Error and edge-case prompts

For each of the following, record: expected message, actual message, user clarity on next step.

### 2.1 Legacy `.doc` rejection

- Upload a Word 97–2003 `.doc` binary file.
- **Expected:** Upload dialog shows a targeted error: *"Legacy .doc format is not supported. Please save the document as .docx (Word 2007+) and re-upload."*
- Record: does the error appear before S3 upload (instant) or after (delayed)? Does the user know what to do?

### 2.2 Password-protected file

- Upload a password-protected PDF or DOCX.
- **Expected:** Parse job fails; document status becomes `FAILED` with an error message.
- Record: is the error surfaced clearly on the upload page, or silent?

### 2.3 Scanned-image PDF (no embedded text)

- Upload a scanned PDF.
- **Expected:** Textract extracts OCR text; gap detector may return many `MISSING` fields due to OCR quality.
- Record: does the analyst understand the extraction is best-effort?

### 2.4 Empty / near-empty file

- Upload a 2-sentence text file.
- **Expected:** Extraction succeeds with very short content; gap detector marks most fields `MISSING`.
- Record: is there a warning that the content seems too short for analysis?

### 2.5 Gap field auto-reject

- Edit a gap field value to something nonsensical (e.g. `asdfasdf`) and click **Analyze Risks**.
- **Expected:** Request returns `400` with `invalidFields`; UI auto-filters to "Needs Attention"; a banner explains the specific fields that failed validation.
- Record: is the guidance actionable?

### 2.6 Report generation timeout

- Start a report generation and close the browser tab before completion.
- **Expected:** Next time you open the report page, polling resumes (if same session) or the already-finished PDF is downloadable from the action button.
- Record: any lost-work surprises?

---

## 3. Navigation & UX confusion points

Rate your agreement with each statement (1 = strongly disagree, 5 = strongly agree).

| # | Statement | 1 | 2 | 3 | 4 | 5 |
|:-:|-----------|:-:|:-:|:-:|:-:|:-:|
| 3.1 | I always knew what the next step was | ☐ | ☐ | ☐ | ☐ | ☐ |
| 3.2 | Error messages told me what to do, not just what went wrong | ☐ | ☐ | ☐ | ☐ | ☐ |
| 3.3 | Loading / progress indicators are informative (stage label, elapsed time) | ☐ | ☐ | ☐ | ☐ | ☐ |
| 3.4 | The gap-detector field cards are easy to scan | ☐ | ☐ | ☐ | ☐ | ☐ |
| 3.5 | The risk scorecard makes the category/subcategory hierarchy obvious | ☐ | ☐ | ☐ | ☐ | ☐ |
| 3.6 | The PDF report is suitable to send directly to an investment committee | ☐ | ☐ | ☐ | ☐ | ☐ |
| 3.7 | On mobile (iPhone 14 / Android phone), the dashboard is usable | ☐ | ☐ | ☐ | ☐ | ☐ |

Free-form notes on UX snags observed during this session:

```
[blank space — fill in during session]




```

---

## 4. Qualitative feedback

Answer in 2–3 sentences each:

- **What was the single most confusing moment during this session?**
- **What feature, if added, would most improve the tool for your daily work?**
- **If you had to describe this tool to a colleague in one sentence, what would you say?**
- **Were any risk-score values surprising (too high, too low, wrong category)? Cite the category + your expected value.**
- **Any methodology concerns?** (e.g. a subcategory that doesn't match the Alliance/CIAT risk matrix, a weighting that feels off)

---

## 5. Analyst scoring sheet

For each of the 35 indicators in the generated report, record the AI-produced score vs your professional judgement so we can calibrate the model.

Template (one row per indicator; copy to a spreadsheet if you prefer):

| Category | Subcategory | AI score (0–100) | AI level | Your score | Your level | Δ (AI − analyst) | Evidence agrees? | Comments |
|----------|-------------|:----:|:-:|:----:|:-:|:-:|:-:|-----------|
| Financial | Cash flow stability | | | | | | ☐ Y ☐ N | |
| Financial | Capital structure | | | | | | ☐ Y ☐ N | |
| Financial | Revenue diversification | | | | | | ☐ Y ☐ N | |
| Financial | Cost control | | | | | | ☐ Y ☐ N | |
| Financial | Financial reporting quality | | | | | | ☐ Y ☐ N | |
| Operational | Production capacity | | | | | | ☐ Y ☐ N | |
| Operational | Supply-chain reliability | | | | | | ☐ Y ☐ N | |
| Operational | Workforce depth | | | | | | ☐ Y ☐ N | |
| Operational | SOPs & documentation | | | | | | ☐ Y ☐ N | |
| Operational | Facility / asset condition | | | | | | ☐ Y ☐ N | |
| Market | Demand signal | | | | | | ☐ Y ☐ N | |
| Market | Customer concentration | | | | | | ☐ Y ☐ N | |
| Market | Competitive positioning | | | | | | ☐ Y ☐ N | |
| Market | Pricing resilience | | | | | | ☐ Y ☐ N | |
| Market | Go-to-market maturity | | | | | | ☐ Y ☐ N | |
| Behavioural | Founder experience | | | | | | ☐ Y ☐ N | |
| Behavioural | Team cohesion | | | | | | ☐ Y ☐ N | |
| Behavioural | Decision-making maturity | | | | | | ☐ Y ☐ N | |
| Behavioural | Integrity signals | | | | | | ☐ Y ☐ N | |
| Behavioural | Learning orientation | | | | | | ☐ Y ☐ N | |
| Climate-Environmental | Climate exposure | | | | | | ☐ Y ☐ N | |
| Climate-Environmental | Water stress | | | | | | ☐ Y ☐ N | |
| Climate-Environmental | Soil health | | | | | | ☐ Y ☐ N | |
| Climate-Environmental | Biodiversity impact | | | | | | ☐ Y ☐ N | |
| Climate-Environmental | Adaptation plan | | | | | | ☐ Y ☐ N | |
| Governance & Legal | Ownership clarity | | | | | | ☐ Y ☐ N | |
| Governance & Legal | Regulatory compliance | | | | | | ☐ Y ☐ N | |
| Governance & Legal | Contract quality | | | | | | ☐ Y ☐ N | |
| Governance & Legal | Reporting discipline | | | | | | ☐ Y ☐ N | |
| Governance & Legal | Dispute history | | | | | | ☐ Y ☐ N | |
| Technology & Data | Core systems maturity | | | | | | ☐ Y ☐ N | |
| Technology & Data | Data capture hygiene | | | | | | ☐ Y ☐ N | |
| Technology & Data | Cybersecurity posture | | | | | | ☐ Y ☐ N | |
| Technology & Data | Traceability tooling | | | | | | ☐ Y ☐ N | |
| Technology & Data | Digital adoption roadmap | | | | | | ☐ Y ☐ N | |

> **Subcategory names above are illustrative.** The authoritative list lives in `packages/shared/src/constants/risk-categories.ts`. If an indicator produced by the tool doesn't match, record the divergence under "Methodology concerns" in §4.

### Calibration summary (complete after scoring)

| Metric | Value |
|--------|-------|
| Mean \|Δ\| across 35 indicators (lower = better agreement) | |
| Indicators with \|Δ\| > 20 points | |
| Indicators where evidence did NOT agree with the score | |
| Overall agreement with category rollup (Yes / Partial / No) | |
| Confidence in using this PDF for investment committee (1–5) | |

---

## 6. Session sign-off

- **Analyst name:** ______________________
- **Date:** ______________________
- **Assessment ID used:** ______________________
- **Session duration (actual):** ______________________
- **Recommended next action:** ☐ Tool is ready for broader UAT &nbsp; ☐ Fix issues documented above, then retest &nbsp; ☐ Methodology review needed before further testing

Send the completed sheet to the engineering team's simulation log ([../testing/simulation-log.md](./simulation-log.md)) so it gets aggregated across sessions.
