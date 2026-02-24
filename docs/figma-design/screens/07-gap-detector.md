# Gap Detector
Figma: https://www.figma.com/design/5HHOnHNcqeVyLcebGs5kuW/?node-id=119:1013

## Screenshot Description
Full-page view (not modal) with sidebar, header, breadcrumb, and a split-pane layout. Left pane shows detected data gaps organized by category. Right pane shows the uploaded document (PDF viewer) for reference. This is the data validation step after document upload/intake.

## Component Breakdown
- **App Sidebar**: Standard teal sidebar (Pattern 1)
- **App Header**: Standard header (Pattern 2) — may show assessment-specific context
- **Breadcrumb**: Dashboard > Business Name > Gap Analysis (Pattern 12)
- **Assessment Sub-Header** (Pattern 13): Teal bar with business name, type, date, status
- **Split Pane** (main content):
  - **Left Panel - Gap Fields**:
    - Section heading per risk category
    - Gap field cards (Pattern 15) stacked vertically
    - Each card shows: field label, current extracted value (or "Missing"), status icon (warning/check/info), and editable input
    - Category sections collapsible
    - Summary at top: "12 gaps detected across 4 categories" with progress indicator
    - "Approve & Continue" button at bottom
  - **Right Panel - Document Viewer**:
    - PDF viewer toolbar: zoom in/out, page navigation, fit width
    - PDF page display
    - Highlighted sections that correspond to extracted data
    - Panel can be resized via drag handle between panes

## Layout Structure
```
[Sidebar 256px] | [Main Area (flex-1)]
                  [Header 64px]
                  [Breadcrumb]
                  [Assessment Sub-Header]
                  [Split Pane (flex-1)]
                    [Left: Gap Fields (50%)] | [Right: PDF Viewer (50%)]
```
- Outer: `flex h-screen`
- Main: `flex flex-col flex-1`
- Split pane: `grid grid-cols-2 flex-1` (or resizable with drag handle)
- Each pane: `overflow-y-auto`

## shadcn Components Used
- `Breadcrumb`, `BreadcrumbItem`, `BreadcrumbLink`, `BreadcrumbSeparator`
- `Accordion` or `Collapsible` for category sections
- `Input` for gap field corrections
- `Button` for actions
- `Badge` for status indicators
- `Progress` for overall completion
- `Tooltip` for field help
- `ScrollArea` for both panes

## Custom Components Needed
- `src/components/layout/app-layout.tsx` — Combines sidebar + header + content area
- `src/components/layout/app-sidebar.tsx` — Teal sidebar (if not already created)
- `src/components/layout/app-header.tsx` — White header bar (if not already created)
- `src/components/assessment/assessment-header.tsx` — Teal assessment context sub-header
- `src/components/gap-detector/split-pane.tsx` — Resizable two-column layout
- `src/components/gap-detector/gap-field-card.tsx` — Individual gap field with status + input
- `src/components/gap-detector/gap-category-section.tsx` — Collapsible section per category
- `src/components/gap-detector/gap-summary.tsx` — Top summary bar with gap count
- `src/components/gap-detector/pdf-viewer.tsx` — PDF document viewer with toolbar
- `src/app/(protected)/assessments/[id]/gap-analysis/page.tsx` — Page route

## Data Requirements
- GET /api/assessments/:id/gaps — Returns detected gaps organized by category
- PUT /api/assessments/:id/gaps/:fieldId — Update a single gap field
- POST /api/assessments/:id/gaps/approve — Approve gaps and continue to analysis
- GET /api/assessments/:id/documents/:docId — Get document for PDF viewer
- Types needed in shared:
  ```ts
  interface GapField {
    id: string;
    category: RiskCategory;
    label: string;
    extractedValue?: string;
    status: 'missing' | 'partial' | 'verified';
    documentReference?: { page: number; coordinates: BoundingBox };
  }
  ```

## Implementation Notes
- PDF viewer can use `react-pdf` library or an iframe with a PDF URL
- Gap fields should highlight the corresponding section in the PDF when clicked
- Consider keyboard navigation between gap fields
- "Approve & Continue" should trigger the risk analysis async job
- Show loading state while gaps are being detected (async job polling)
- The right panel PDF viewer is optional — if no document was uploaded (manual entry or interview), show a placeholder or hide the right pane
- Responsive: on smaller screens, stack panes vertically or use tabs to switch
- Gap field status colors: missing = warning (#F48C06), partial = info (#2563EB), verified = success (#16A34A)
