# Report Generator — Design Document

**Date:** 2026-04-08
**Status:** Approved
**Author:** Juan Cadavid + Claude

## Problem Statement

The CGIAR Agricultural Risk Intelligence Tool generates a PDF risk report as the final stage of the analysis workflow. The current report has:

1. **Critical bug**: Pages 15-40 are completely blank (only footers render) — reported by client with Bluewave Fisheries test
2. **Design quality issues**: Text overlap on title page, oversized executive summary box, methodology text cutoff, no page numbers on content pages
3. **Missing professional sections**: No TOC, no company profile, no risk heatmap, no action plan, no appendix, no disclaimer
4. **Incomplete features**: Financial charts infrastructure exists but isn't rendered in PDF

## Audience

Both **executive decision-makers** (investment committees, board members) and **field analysts/risk officers**. The report must serve dual purposes: scannable executive summaries for leadership + detailed evidence/data for technical staff.

## Design Decision

**Keep PDFKit, fix and enhance in two phases.** The current PDF has good bones (radar chart, score bars, recommendation cards render well). Problems are fixable bugs and design refinements, not architectural failures. Migrating to Puppeteer or react-pdf introduces high risk for what's fundamentally a layout tuning problem.

## Phase 1: Bug Fix + Design Polish (Immediate)

### 1.1 Blank Pages Bug Fix
- **Root cause**: `bufferPages: true` + footer rendering loop creates phantom pages. `doc.switchToPage(i)` iterates over pages that were created by content overflow but have no content — footer text may trigger additional page creation.
- **Fix**: After content rendering, count actual content pages, apply footers only to those, strip trailing empty pages before `doc.end()`.

### 1.2 Table of Contents
- Auto-generated TOC on page 2 (after title page)
- Lists all sections with page numbers
- Two-pass rendering: first pass collects page positions, second pass writes TOC

### 1.3 Design Polish
- **Header bar**: Thin teal accent line at top of every page (except title)
- **Footer**: "CONFIDENTIAL — CGIAR Agricultural Risk Intelligence" (left) + "Page X of Y" (right) + separator line
- **Typography**: Section title 22pt, subsection 16pt, body 10pt — consistent hierarchy
- **Spacing fixes**: Executive summary teal box overflow, title page text overlap, methodology right-margin cutoff
- **Score visualizations**: Tighter spacing around radar chart and category bars
- **Recommendation cards**: Subtle left border color coding + consistent padding

### 1.4 Page Numbering
- "Page X of Y" format on all pages except title
- Depends on bufferPages fix

## Phase 2: New Content Sections (Follow-up)

### 2.1 Company Profile Section
- After TOC, before executive summary
- Structured layout: company name, sector, country, type, assessment date
- Two-column grid with key facts from assessment data

### 2.2 Risk Heatmap / Matrix
- 2D grid: X-axis = score severity (LOW → CRITICAL), Y-axis = 7 categories
- Colored dots per category on the matrix
- Complements radar chart with likelihood-vs-impact perspective

### 2.3 Financial Overview with Charts
- Revenue projection line chart (conditional on data)
- Cost breakdown horizontal bar chart
- Margin trend visualization
- Uses existing `FinancialMetrics` extraction in worker handler
- Only rendered when `includeFinancialCharts: true` and data available

### 2.4 Action Plan / Roadmap
- Groups recommendations by timeframe: Immediate (0-3mo), Short-term (3-6mo), Medium-term (6-12mo)
- AI assigns timeframes via Bedrock prompt during report generation
- Visual timeline layout with priority color coding

### 2.5 Appendix
- Document sources table (files uploaded, extraction method, character count)
- Detailed evidence traces per category (conditional)
- Raw subcategory data tables with full mitigation text
- Gap detection summary

### 2.6 Disclaimer / Legal Page
- Standard risk assessment disclaimer
- Data limitations notice
- AI-generated content disclosure
- Confidentiality statement

### 2.7 Frontend Config Dialog Update
- New toggles: Company Profile, Risk Heatmap, Action Plan, Appendix
- "Professional" preset enabling all sections

## PDF Page Order (Final State)

1. Title Page (redesigned)
2. Table of Contents
3. Company Profile
4. Executive Summary
5. Risk Overview (radar + table + heatmap)
6. Category Detail Pages (x7, improved layout)
7. All Recommendations
8. Action Plan / Roadmap
9. Strengths & Weaknesses
10. Financial Overview (conditional)
11. Methodology
12. Appendix (conditional)
13. Disclaimer

## Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| PDF library | Keep PDFKit | Working foundation, bugs are fixable, no migration risk |
| TOC implementation | Two-pass rendering | Only reliable way to get accurate page numbers |
| Blank pages fix | Post-render page stripping | Addresses root cause without refactoring entire flow |
| Action plan timeframes | Bedrock AI assignment | Leverage existing AI pipeline for intelligent categorization |
| Financial charts | Conditional rendering | Only show when data extracted, avoid empty sections |
| Delivery strategy | Phased (P1 bug fix + polish, P2 new sections) | Unblock client immediately, iterate on enhancements |

## Files Affected

**Backend:**
- `packages/api/src/domain/report/pdf.service.ts` — Major rewrite (both phases)
- `packages/api/src/platform/jobs/handlers/report-generation.handler.ts` — Phase 2 (new AI prompts)
- `packages/api/src/domain/report/report.service.ts` — Minor (config defaults)
- `packages/api/src/domain/report/dto/report-config.dto.ts` — Phase 2 (new fields)

**Shared:**
- `packages/shared/src/types/report.types.ts` — Phase 2 (extended ReportConfig, new types)

**Frontend:**
- `packages/web/src/components/risk-scorecard/report-configuration-dialog.tsx` — Phase 2
- `packages/web/src/hooks/use-report.ts` — Minor if API response shape changes
