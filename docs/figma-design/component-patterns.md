# Component Patterns Catalog

22 reusable UI patterns identified across all 10 Figma screens. Each pattern includes which screens use it, which shadcn/ui components to leverage, and implementation approach.

## Prerequisites: Additional shadcn Components to Install

```bash
pnpm --filter @alliance-risk/web dlx shadcn@latest add sidebar
pnpm --filter @alliance-risk/web dlx shadcn@latest add progress
pnpm --filter @alliance-risk/web dlx shadcn@latest add dropdown-menu
pnpm --filter @alliance-risk/web dlx shadcn@latest add avatar
pnpm --filter @alliance-risk/web dlx shadcn@latest add breadcrumb
pnpm --filter @alliance-risk/web dlx shadcn@latest add accordion
pnpm --filter @alliance-risk/web dlx shadcn@latest add tooltip
pnpm --filter @alliance-risk/web dlx shadcn@latest add collapsible
pnpm --filter @alliance-risk/web dlx shadcn@latest add checkbox
pnpm --filter @alliance-risk/web dlx shadcn@latest add scroll-area
```

Also install recharts for the radar chart:

```bash
pnpm --filter @alliance-risk/web add recharts
```

---

## Pattern 1: App Sidebar (Teal)

**Screens:** 2-10 (all authenticated screens)
**shadcn Base:** `sidebar` component
**File:** `src/components/layout/app-sidebar.tsx`

### Description
Fixed 256px teal sidebar with logo, navigation links, settings, and user profile card.

### Structure
- **Logo area** (h-16): White logo on teal, left-aligned with px-6
- **Navigation** (flex-1, scrollable): Vertical nav items with icons
  - Active item: `bg-white/20`, white text, orange left indicator (4px wide, rounded-r-full, `#F18E1C`)
  - Inactive item: `text-[#CCFBF1]` (Ice Cold), hover `bg-white/10`
  - Items: Dashboard, Prompt manager, Admin
- **Bottom section**: Settings link + User profile card
  - User card: Semi-transparent bg (`rgba(17,94,89,0.5)`), avatar with orange ring, name + role

### Key Colors
- Background: `--sidebar` (`#008F8F`)
- Border-right: `--sidebar-border` (`#0D9488`)
- Active bg: `rgba(255,255,255,0.2)`
- Active indicator: `#F18E1C` (Carrot Orange)
- Inactive text: `#CCFBF1` (Ice Cold)
- User card bg: `rgba(17,94,89,0.5)`
- Avatar ring: `#F18E1C`

---

## Pattern 2: Top Header Bar

**Screens:** 2-10 (all authenticated screens)
**shadcn Base:** Custom
**File:** `src/components/layout/app-header.tsx`

### Description
64px white header with page title, context selector, action buttons, search, and notifications.

### Structure
- **Left:** Page title (h1, 20px bold) + vertical divider + Context selector (country flag + name + chevron)
- **Right:** "Start New Assessment" green button + divider + Search input (256px) + Notification bell with dot

### Key Elements
- Title: `text-xl font-bold text-[#1F2937]`
- Divider: `w-px h-6 bg-border`
- Context label: `text-sm font-medium text-muted-foreground`
- Country button: `text-sm font-semibold text-[#374151]` with flag icon + ChevronDown
- Green CTA: `bg-[#4CAF50] text-white shadow-[0_1px_2px_#bbf7d0]` rounded-lg
- Search: `bg-[#F9FAFB] w-64 rounded-lg` with Search icon prefix
- Notification: Bell icon with `bg-warning` 8px dot, positioned top-right

---

## Pattern 3: Stat Cards

**Screens:** 2 (Dashboard)
**shadcn Base:** `Card`
**File:** `src/components/dashboard/stat-card.tsx`

### Description
Row of 4 equal-width stat cards showing KPI numbers.

### Structure per Card
```
[Icon (40px, rounded-lg, tinted bg)]  [Badge (+12%, green text)]
[Large number (30px bold)]
[Label (14px, muted text)]
```

### Props
```ts
interface StatCardProps {
  icon: LucideIcon;
  value: string | number;
  label: string;
  trend?: { value: string; positive: boolean };
  iconBgClass?: string;  // e.g. "bg-secondary" or "bg-primary/10"
}
```

### Key Styles
- Card: `bg-card border border-[#F5F5F5] rounded-xl shadow-sm p-6`
- Icon container: `h-10 w-10 rounded-lg bg-secondary flex items-center justify-center`
- Trend badge: `bg-secondary rounded-full px-2 py-0.5 text-xs font-medium text-success`
- Value: `text-[30px] font-bold leading-9 text-foreground`
- Label: `text-sm text-muted-foreground`

---

## Pattern 4: Assessment Table

**Screens:** 2 (Dashboard)
**shadcn Base:** `Table` + `dropdown-menu`
**File:** `src/components/dashboard/assessment-table.tsx`

### Description
Data table with business info, date, progress bar, status badge, and actions menu.

### Columns
1. **Business Name**: Avatar initials (40px) + name (semibold) + subtitle (muted xs)
2. **Date Modified**: Regular text, `text-[#475569]`
3. **Progress**: Progress bar (h-2, rounded-full) + percentage text
4. **Status**: Pill badge (Draft/Analyzing/Complete) with contextual colors
5. **Actions**: 3-dot menu (MoreVertical icon)

### Status Badge Variants
| Status | Background | Border | Text Color |
|--------|-----------|--------|------------|
| Draft | `#F5F5F5` | `#E2E8F0` | `#475569` |
| Analyzing | `#F4F9F9` | `#DCFCE7` | `#1D4ED8` |
| Complete | `#F4F9F9` | `#DCFCE7` | `#15803D` |

### Table Header Style
- Background: `bg-[#F8FAFC]/50`
- Text: `text-[11px] font-bold uppercase tracking-[1.1px] text-[#9CA3AF]`

### Pagination
- Footer: "Showing X of Y records" (left) + Page buttons (right)
- Active page: `bg-card border border-border shadow-sm font-bold`
- Inactive page: `text-[#475569]`
- Disabled: `opacity-50`

---

## Pattern 5: Modal Shell

**Screens:** 3-6 (all intake modals)
**shadcn Base:** `Dialog`
**File:** Uses shadcn `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`

### Description
Centered modal with overlay. Varies in width per modal (max-w-lg to max-w-2xl).

### Structure
- Overlay: Semi-transparent dark backdrop
- Content: White rounded-xl, padded, with close X button top-right
- Header: Title (heading-2) + optional subtitle
- Body: Content area
- Footer: Action buttons (Cancel left, Primary right)

---

## Pattern 6: Intake Mode Cards

**Screens:** 3 (Start Assessment Modal)
**shadcn Base:** Custom
**File:** `src/components/assessment/intake-mode-card.tsx`

### Description
Three selectable cards for choosing assessment intake mode: Upload, Guided Interview, Manual Entry.

### Structure per Card
```
[Icon (large, centered)]
[Title (heading-3)]
[Description (body, muted)]
```

### Props
```ts
interface IntakeModeCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  onClick: () => void;
}
```

### Styles
- Card: `border border-border rounded-xl p-6 hover:border-primary hover:bg-secondary cursor-pointer transition-colors`
- Icon: `h-12 w-12 text-primary mx-auto mb-4`
- Title: `text-base font-semibold text-center`
- Description: `text-sm text-muted-foreground text-center`

---

## Pattern 7: File Upload Dropzone

**Screens:** 4 (Upload Business Plan Modal)
**shadcn Base:** Custom
**File:** `src/components/assessment/file-upload-dropzone.tsx`

### Description
Dashed-border dropzone area for file upload with drag-and-drop support.

### Structure
```
[CloudUpload icon (48px, muted)]
[Drag & drop or click to upload]
[Accepted formats: PDF, DOCX, XLSX]
[File size limit]
```

### Styles
- Container: `border-2 border-dashed border-border rounded-xl p-8 text-center hover:border-primary transition-colors`
- Drag active: `border-primary bg-secondary`
- Icon: `h-12 w-12 text-muted-foreground mx-auto mb-4`
- Primary text: `text-sm font-medium`
- Secondary text: `text-xs text-muted-foreground`

---

## Pattern 8: Multi-Step Wizard Stepper

**Screens:** 5 (Guided Interview Modal)
**shadcn Base:** Custom
**File:** `src/components/assessment/wizard-stepper.tsx`

### Description
Horizontal step indicator showing interview progress across risk categories.

### Structure
```
[Step 1 (active)] --- [Step 2] --- [Step 3] --- ...
```

### Step States
| State | Circle | Text | Connector |
|-------|--------|------|-----------|
| Completed | `bg-primary text-white` + Check icon | `text-primary font-semibold` | `bg-primary` |
| Active | `bg-primary text-white` + number | `text-primary font-semibold` | `bg-border` |
| Upcoming | `bg-muted text-muted-foreground` + number | `text-muted-foreground` | `bg-border` |

---

## Pattern 9: Yes/No Choice Cards

**Screens:** 5 (Guided Interview Modal)
**shadcn Base:** Custom
**File:** `src/components/assessment/choice-cards.tsx`

### Description
Binary choice cards for guided interview questions.

### Structure
Two side-by-side cards:
```
[Yes/No label]
[Optional description]
```

### Styles
- Unselected: `border border-border rounded-lg p-4 cursor-pointer hover:border-primary/50`
- Selected: `border-2 border-primary bg-secondary rounded-lg p-4`
- Label: `text-sm font-semibold`

---

## Pattern 10: Vertical Side Tabs

**Screens:** 6 (Manual Data Entry Modal)
**shadcn Base:** `Tabs` (vertical orientation)
**File:** Uses shadcn `Tabs` with `orientation="vertical"`

### Description
Left-side vertical tabs for switching between risk category sections in manual data entry.

### Structure
```
[Category tab 1 (active)]
[Category tab 2]
[Category tab 3]
...
```

### Tab Styles
- Active: `bg-secondary text-primary font-semibold border-l-2 border-primary`
- Inactive: `text-muted-foreground hover:text-foreground`
- Container: `w-48 border-r border-border`

---

## Pattern 11: Currency/Unit Input

**Screens:** 6 (Manual Data Entry Modal)
**shadcn Base:** Custom wrapping `Input`
**File:** `src/components/assessment/currency-input.tsx`

### Description
Input field with currency or unit prefix/suffix.

### Structure
```
[USD ▼] [Input field] [/year]
```

### Implementation
Compose shadcn `Input` with a leading select for currency and trailing unit text.

---

## Pattern 12: Breadcrumb Trail

**Screens:** 7-10 (assessment detail screens)
**shadcn Base:** `breadcrumb`
**File:** Uses shadcn `Breadcrumb`, `BreadcrumbItem`, `BreadcrumbLink`, `BreadcrumbSeparator`

### Description
Navigation breadcrumb showing hierarchy: Dashboard > Business Name > Current Step.

### Example
```
Dashboard / GreenLeaf Agro Ltd / Gap Analysis
```

### Styles
- Links: `text-sm text-muted-foreground hover:text-foreground`
- Current: `text-sm font-medium text-foreground`
- Separator: ChevronRight icon, `text-muted-foreground`

---

## Pattern 13: Teal Assessment Sub-Header

**Screens:** 7-10 (assessment detail screens)
**shadcn Base:** Custom
**File:** `src/components/assessment/assessment-header.tsx`

### Description
Teal-tinted header bar below the main header, showing assessment context (business name, date, status).

### Structure
```
[Business name + type]  [Date]  [Status badge]  [Actions]
```

### Styles
- Background: `bg-primary` or `bg-[#008F8F]`
- Text: White
- Works with breadcrumb above it

---

## Pattern 14: Split Pane Layout

**Screens:** 7 (Gap Detector)
**shadcn Base:** Custom (CSS Grid)
**File:** `src/components/gap-detector/split-pane.tsx`

### Description
Two-column layout: left panel shows gap fields, right panel shows uploaded document (PDF viewer).

### Structure
```
[Left: Gap fields (scrollable)]  |  [Right: PDF viewer]
```

### Implementation
CSS Grid: `grid grid-cols-2 gap-0 h-full` with a divider between panels. Each panel independently scrollable with `overflow-y-auto`.

---

## Pattern 15: Gap Field Card

**Screens:** 7 (Gap Detector)
**shadcn Base:** Custom
**File:** `src/components/gap-detector/gap-field-card.tsx`

### Description
Card showing a data field that may be missing or incomplete, with status indicator and input.

### Structure
```
[Status icon (warning/check)]  [Field label]
[Current value or "Missing"]
[Input field for correction]
```

### Props
```ts
interface GapFieldCardProps {
  label: string;
  currentValue?: string;
  status: "missing" | "partial" | "verified";
  onUpdate: (value: string) => void;
}
```

### Status Indicators
| Status | Icon | Color |
|--------|------|-------|
| Missing | `AlertTriangle` | `text-warning` |
| Partial | `Info` | `text-info` |
| Verified | `CheckCircle` | `text-success` |

---

## Pattern 16: Risk Score Cards

**Screens:** 8-9 (Risk Scorecard)
**shadcn Base:** Custom
**File:** `src/components/risk-analysis/risk-score-card.tsx`

### Description
Cards showing risk scores per category with visual indicator (color-coded by risk level).

### Structure
```
[Category name]
[Score (large number)]  [Risk level badge]
[Score bar or gauge]
[Brief description]
```

### Risk Level Colors
| Level | Score Range | Color | Badge |
|-------|------------|-------|-------|
| Low | 0-30 | `text-success` / `bg-success/10` | Green |
| Moderate | 31-60 | `text-warning` / `bg-warning/10` | Orange |
| High | 61-80 | `text-[#EA580C]` / `bg-destructive/10` | Red-orange |
| Critical | 81-100 | `text-destructive` / `bg-destructive/10` | Red |

---

## Pattern 17: Recommendation Row

**Screens:** 8-9 (Risk Scorecard)
**shadcn Base:** Custom
**File:** `src/components/risk-analysis/recommendation-item.tsx`

### Description
Single recommendation row with priority indicator and description.

### Structure
```
[Lightbulb icon]  [Recommendation text]  [Priority badge]
```

---

## Pattern 18: Comment Textarea

**Screens:** 9 (Risk Scorecard with Comment)
**shadcn Base:** `Textarea` + `Button`
**File:** Uses existing shadcn components

### Description
Expandable comment section with textarea and submit button.

### Structure
```
[Comment icon]  [Comments header]
[Existing comments list]
[Textarea for new comment]
[Send button]
```

---

## Pattern 19: Report TOC Sidebar

**Screens:** 10 (Full Report)
**shadcn Base:** Custom + `scroll-area`
**File:** `src/components/report/report-sidebar.tsx`

### Description
Right sidebar (or left) with table of contents for the full risk report.

### Structure
```
[Report TOC]
  [Executive Summary]
  [Risk Category 1]
    [Sub-section 1.1]
    [Sub-section 1.2]
  [Risk Category 2]
  ...
  [Appendices]
```

### Styles
- Container: Fixed width (250-280px), border-left, `overflow-y-auto`
- Active section: `text-primary font-semibold border-l-2 border-primary`
- Inactive: `text-muted-foreground hover:text-foreground`

---

## Pattern 20: Radar Chart

**Screens:** 10 (Full Report)
**shadcn Base:** `recharts`
**File:** `src/components/report/risk-radar-chart.tsx`

### Description
Pentagon/spider radar chart showing scores across all 7 risk categories.

### Implementation
Use `recharts` `RadarChart` with `PolarGrid`, `PolarAngleAxis`, `PolarRadiusAxis`, `Radar` components.

### Data Shape
```ts
interface RadarDataPoint {
  category: string;
  score: number;
  fullMark: 100;
}
```

### Styles
- Fill: `var(--primary)` with 20% opacity
- Stroke: `var(--primary)` solid
- Grid: Light gray lines
- Labels: `text-xs text-muted-foreground`

---

## Pattern 21: Report Content Area

**Screens:** 10 (Full Report)
**shadcn Base:** Custom
**File:** `src/components/report/report-content.tsx`

### Description
Main scrollable content area for the full risk analysis report with prose formatting.

### Structure
Markdown-rendered content with:
- Section headings (h2, h3)
- Body paragraphs
- Data tables
- Score summaries
- Recommendation boxes
- Charts/graphs inline

### Styles
- Container: `max-w-4xl mx-auto py-8 px-6 bg-card`
- Headings: Standard typography scale from design-tokens
- Prose: `text-sm leading-relaxed text-foreground`

---

## Pattern 22: Avatar Initials

**Screens:** 2-10 (Dashboard table, sidebar user)
**shadcn Base:** `avatar`
**File:** Uses shadcn `Avatar`, `AvatarFallback`

### Description
Circular or rounded-square avatar showing user/business initials.

### Variants

| Context | Size | Shape | Background | Text |
|---------|------|-------|-----------|------|
| Table row | 40px | `rounded-lg` | `bg-muted` | `text-sm font-bold text-[#475569]` |
| Table row (active) | 40px | `rounded-lg` | `bg-primary/10` | `text-sm font-bold text-primary` |
| Sidebar user | 32px | `rounded-full` | Image or initials | With orange ring |

### Implementation
```tsx
<Avatar className="h-10 w-10 rounded-lg">
  <AvatarFallback className="rounded-lg bg-muted text-sm font-bold text-[#475569]">
    KT
  </AvatarFallback>
</Avatar>
```
