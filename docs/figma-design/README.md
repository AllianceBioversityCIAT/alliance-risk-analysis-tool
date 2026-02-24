# Figma Design System Documentation

Implementation guides for the CGIAR Alliance Risk Intelligence Tool UI, derived from the Figma design file.

**Figma File:** [Risk Analysis Tool](https://www.figma.com/design/5HHOnHNcqeVyLcebGs5kuW/RISK-ANALYSIS-TOOL)
**Page:** RISK ANALYSIS TOOL V1 (nodeId: `2:2`)

## Quick Links

| Document | Description |
|----------|-------------|
| [Design Tokens](./design-tokens.md) | Colors, typography, spacing, radius, shadows |
| [Globals CSS Update](./globals-update.md) | Copy-paste-ready `:root` CSS variable overrides |
| [Component Patterns](./component-patterns.md) | 22 reusable UI patterns catalog |
| [Icon Mapping](./icon-mapping.md) | Figma Material Icons to Lucide React equivalents |

## Screen Guides

| # | Screen | Guide | Figma Node |
|---|--------|-------|------------|
| 1 | Login | [01-login.md](./screens/01-login.md) | `97:12636` |
| 2 | Dashboard | [02-dashboard.md](./screens/02-dashboard.md) | `2:1729` |
| 3 | Start Assessment Modal | [03-start-assessment-modal.md](./screens/03-start-assessment-modal.md) | `97:54` |
| 4 | Upload Business Plan Modal | [04-upload-business-plan-modal.md](./screens/04-upload-business-plan-modal.md) | `97:454` |
| 5 | Guided Interview Modal | [05-guided-interview-modal.md](./screens/05-guided-interview-modal.md) | `97:728` |
| 6 | Manual Data Entry Modal | [06-manual-data-entry-modal.md](./screens/06-manual-data-entry-modal.md) | `97:1002` |
| 7 | Gap Detector | [07-gap-detector.md](./screens/07-gap-detector.md) | `119:1013` |
| 8 | Risk Scorecard Results | [08-risk-scorecard-results.md](./screens/08-risk-scorecard-results.md) | `2:352` |
| 9 | Risk Scorecard with Comment | [09-risk-scorecard-comment.md](./screens/09-risk-scorecard-comment.md) | `425:2490` |
| 10 | Full Report | [10-full-report.md](./screens/10-full-report.md) | `2:3` |

## How to Use These Docs

### For implementing a screen:

1. Read the **screen guide** for the page you're building
2. Reference **design-tokens.md** for exact color/typography values
3. Check **component-patterns.md** to see if the pattern already exists or has been documented
4. Use **icon-mapping.md** to find the correct Lucide icon for each Material icon in Figma

### Before starting any implementation:

1. Apply the `globals.css` update from **globals-update.md** (one-time setup)
2. Install additional shadcn/ui components listed in **component-patterns.md**
3. Install `recharts` for the radar chart in the Full Report screen

## Implementation Order

1. **Design System Foundation** — `globals.css` token update, install new shadcn components, create `AppSidebar` + `AppHeader` + `AppLayout`
2. **Login** — Restyle existing login page to match Figma white-card design
3. **Dashboard** — StatCard, AssessmentTable, pagination
4. **Assessment Intake Flow** — 4 modals (Start, Upload, Guided, Manual)
5. **Gap Detector** — Split pane, PDF viewer, GapField cards
6. **Risk Results** — RiskScoreCard, RecommendationItem, comments
7. **Full Report** — ReportSidebar, ReportContent, radar chart, PDF export

## Architecture Notes

- All new screens live under `packages/web/src/app/(protected)/` route group
- New components go in `packages/web/src/components/{feature}/`
- Shared types for new domain concepts go in `packages/shared/src/`
- The app uses Next.js 15 App Router with static export (`output: 'export'`)
- Forms use React Hook Form with Zod validation
- API calls go through `src/lib/api-client.ts`
