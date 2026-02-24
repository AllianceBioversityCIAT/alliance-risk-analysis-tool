# Risk Scorecard Results
Figma: https://www.figma.com/design/5HHOnHNcqeVyLcebGs5kuW/?node-id=2:352

## Screenshot Description
Full-page view showing the risk analysis results after AI processing. Displays an overall risk score prominently, followed by individual risk category score cards, and a recommendations section. Uses the standard app layout (sidebar + header).

## Component Breakdown
- **App Sidebar**: Standard teal sidebar (Pattern 1)
- **App Header**: Standard header (Pattern 2) with assessment context
- **Breadcrumb**: Dashboard > Business Name > Risk Scorecard (Pattern 12)
- **Assessment Sub-Header** (Pattern 13): Business name, type, analysis date, "Completed" status
- **Overall Score Section**:
  - Large score number (score-large: 36px bold)
  - Risk level label and color coding
  - Brief assessment summary text
- **Risk Category Cards** (7 cards, grid layout):
  - Each card shows:
    - Category name (heading-3)
    - Score number (score-large or 30px bold)
    - Risk level badge (Low/Moderate/High/Critical with color)
    - Score bar (progress-like visualization)
    - Brief finding summary (body text, 2-3 lines)
  - Cards arranged in grid: 2-3 columns
  - Risk level color coding:
    - Low (0-30): green (#16A34A) bg/text
    - Moderate (31-60): orange (#F48C06) bg/text
    - High (61-80): orange-red (#EA580C) bg/text
    - Critical (81-100): red (#EA580C) bg/text darker
- **Recommendations Section**:
  - "Key Recommendations" heading
  - List of recommendation items (Pattern 17)
  - Each: Lightbulb icon + recommendation text + priority badge
  - Priority badges: High (red), Medium (orange), Low (green)
- **Actions Bar**:
  - "View Full Report" button (primary)
  - "Add Comment" button (outlined)
  - "Export PDF" button (outlined)

## Layout Structure
```
[Sidebar 256px] | [Main Area]
                  [Header 64px]
                  [Breadcrumb]
                  [Assessment Sub-Header]
                  [Content (scrollable, max-w-6xl centered)]
                    [Overall Score Section]
                    [Category Cards Grid (2-3 cols)]
                    [Recommendations List]
                    [Actions Bar]
```
- Content area: `max-w-6xl mx-auto px-8 py-6`
- Score cards grid: `grid grid-cols-2 lg:grid-cols-3 gap-6`
- Each card: `bg-card border border-border rounded-xl p-6 shadow-sm`

## shadcn Components Used
- `Breadcrumb`, `BreadcrumbItem`, `BreadcrumbLink`
- `Card`, `CardHeader`, `CardTitle`, `CardContent`
- `Badge` for risk levels and priority
- `Progress` for score bars
- `Button` for actions

## Custom Components Needed
- `src/components/risk-analysis/overall-score.tsx` — Hero score display
- `src/components/risk-analysis/risk-score-card.tsx` — Individual category score card (Pattern 16)
- `src/components/risk-analysis/score-bar.tsx` — Color-coded score progress bar
- `src/components/risk-analysis/recommendation-item.tsx` — Single recommendation row (Pattern 17)
- `src/components/risk-analysis/recommendations-list.tsx` — Recommendations section
- `src/app/(protected)/assessments/[id]/results/page.tsx` — Page route

## Data Requirements
- GET /api/assessments/:id/results — Returns overall score + per-category scores
- GET /api/assessments/:id/recommendations — Returns AI-generated recommendations
- Types needed:
  ```ts
  interface RiskScore {
    overall: number;
    riskLevel: 'low' | 'moderate' | 'high' | 'critical';
    categories: CategoryScore[];
    summary: string;
  }
  interface CategoryScore {
    category: RiskCategory;
    score: number;
    riskLevel: string;
    finding: string;
  }
  interface Recommendation {
    id: string;
    text: string;
    priority: 'high' | 'medium' | 'low';
    category: RiskCategory;
  }
  ```

## Implementation Notes
- Score values are 0-100 scale
- Color transitions at thresholds: 0-30 green, 31-60 orange, 61-80 orange-red, 81-100 red
- Score bar fill percentage = score value, color = risk level color
- "View Full Report" navigates to screen 10 (full report)
- "Add Comment" opens the comment panel (screen 9)
- "Export PDF" triggers server-side PDF generation
- Consider animation on score bars when page loads (count-up effect)
- Show loading/skeleton state while results are being computed (async job polling)
