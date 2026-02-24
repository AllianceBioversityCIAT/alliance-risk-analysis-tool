# Full Report
Figma: https://www.figma.com/design/5HHOnHNcqeVyLcebGs5kuW/?node-id=2:3

## Screenshot Description
Full-page report view with the standard app layout (sidebar + header), a left TOC navigation sidebar, and a main content area showing the complete risk analysis report. This is the most content-heavy screen, designed for reading and exporting the final report.

## Component Breakdown
- **App Sidebar**: Standard teal sidebar (Pattern 1) — may collapse or narrow on this view
- **App Header**: Standard header (Pattern 2) with report-specific actions
- **Breadcrumb**: Dashboard > Business Name > Full Report (Pattern 12)
- **Assessment Sub-Header** (Pattern 13): Business name, report date, "Final Report" status
- **Report Toolbar**:
  - Print button (Printer icon)
  - Download PDF button (Download icon)
  - Share button (Share2 icon)
  - All as icon buttons or outlined buttons in a row
- **Report TOC Sidebar** (Pattern 19, left of content):
  - Fixed 250px sidebar
  - Scrollable table of contents
  - Sections: Executive Summary, each of 7 risk categories, Overall Assessment, Recommendations, Appendix
  - Active section highlighted with left border primary color
  - Tracks scroll position in main content
- **Report Content Area** (Pattern 21, main scrollable area):
  - **Executive Summary section**:
    - Business info table (name, type, region, analysis date)
    - Overall risk assessment paragraph
    - Overall score callout box
  - **Radar Chart** (Pattern 20):
    - Pentagon/spider chart showing all 7 risk category scores
    - Uses recharts RadarChart
    - Teal fill with 20% opacity, teal stroke
    - Category labels at each vertex
    - Grid lines at 20, 40, 60, 80, 100
  - **Per-Category Sections** (7 sections):
    - Category heading (h2)
    - Score + risk level badge
    - Detailed findings (prose paragraphs)
    - Key data points (table or key-value list)
    - Sub-findings per factor
  - **Overall Assessment**:
    - Summary paragraph
    - Strengths list
    - Weaknesses list
  - **Recommendations Section**:
    - Prioritized list of recommendations
    - Each with priority badge, category tag, description
    - Grouped by priority (High, Medium, Low)
  - **Appendix**:
    - Methodology notes
    - Data sources
    - Disclaimers

## Layout Structure
```
[App Sidebar 256px] | [Main Area (flex-1)]
                      [Header 64px]
                      [Breadcrumb + Toolbar]
                      [Assessment Sub-Header]
                      [Report Layout (flex-1)]
                        [TOC Sidebar 250px] | [Content Area (flex-1, scrollable)]
```

- Report layout: `flex flex-1 overflow-hidden`
- TOC sidebar: `w-[250px] border-r border-border overflow-y-auto sticky top-0 h-[calc(100vh-header)]`
- Content area: `flex-1 overflow-y-auto`
- Content inner: `max-w-4xl mx-auto py-8 px-6`
- Prose styling: `text-sm leading-relaxed`

## shadcn Components Used
- `Breadcrumb`, `BreadcrumbItem`, `BreadcrumbLink`
- `Button` for toolbar actions
- `Badge` for risk levels and priority
- `Card` for callout boxes and score displays
- `Table`, `TableBody`, `TableRow`, `TableCell` for data tables
- `ScrollArea` for TOC sidebar
- `Accordion` for collapsible sections (optional)
- `Tooltip` for toolbar button labels

## Custom Components Needed
- `src/components/report/report-sidebar.tsx` — TOC navigation (Pattern 19)
- `src/components/report/report-content.tsx` — Main report content renderer (Pattern 21)
- `src/components/report/risk-radar-chart.tsx` — Recharts radar chart (Pattern 20)
- `src/components/report/report-toolbar.tsx` — Print/Download/Share action bar
- `src/components/report/report-section.tsx` — Individual report section with heading
- `src/components/report/score-callout.tsx` — Score highlight box
- `src/components/report/findings-list.tsx` — Bulleted findings list
- `src/app/(protected)/assessments/[id]/report/page.tsx` — Page route

## Data Requirements
- GET /api/assessments/:id/report — Full report data
- GET /api/assessments/:id/report/pdf — Generate PDF download
- Types:
  ```ts
  interface FullReport {
    assessment: AssessmentSummary;
    executiveSummary: string;
    overallScore: number;
    overallRiskLevel: string;
    categoryReports: CategoryReport[];
    recommendations: Recommendation[];
    strengths: string[];
    weaknesses: string[];
    methodology: string;
    dataSources: string[];
  }
  interface CategoryReport {
    category: RiskCategory;
    score: number;
    riskLevel: string;
    findings: string;
    keyDataPoints: { label: string; value: string }[];
    subFindings: { factor: string; detail: string }[];
  }
  ```

## Implementation Notes
- **Recharts radar chart**: Install `recharts` (`pnpm --filter @alliance-risk/web add recharts`). Use `RadarChart`, `PolarGrid`, `PolarAngleAxis`, `PolarRadiusAxis`, `Radar` components.
  ```tsx
  <RadarChart data={categoryScores} cx="50%" cy="50%" outerRadius="80%">
    <PolarGrid />
    <PolarAngleAxis dataKey="category" />
    <PolarRadiusAxis angle={90} domain={[0, 100]} />
    <Radar name="Score" dataKey="score" stroke="var(--primary)" fill="var(--primary)" fillOpacity={0.2} />
  </RadarChart>
  ```
- **TOC scroll tracking**: Use IntersectionObserver to detect which section is in view and highlight the corresponding TOC item
- **PDF export**: Use server-side PDF generation endpoint. Client triggers download via API call. Alternatively, use `window.print()` with a print-optimized CSS stylesheet.
- **Print styles**: Add `@media print { ... }` rules to hide sidebar, header, TOC, and toolbar. Content should fill the page.
- **Responsive**: On smaller screens, TOC sidebar can become a collapsible drawer or top dropdown
- **Loading state**: Show skeleton for report content while data loads
- **Anchor links**: Each section heading should have an id for direct linking (e.g., `#climate-risk`)
- This is the longest page — consider lazy loading sections or virtualized rendering for very long reports
