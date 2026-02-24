# Dashboard

Figma: https://www.figma.com/design/5HHOnHNcqeVyLcebGs5kuW?node-id=2:1729

## Screenshot Description

The dashboard is the primary authenticated landing page. It features a 256px teal sidebar on the left, a 64px white header bar at the top, and a content area with a light gray background (`#F9FAFB`).

The content area contains:
1. A row of 4 equal-width stat cards showing key performance indicators (Active Assessments, Drafts Pending, Completed Projects, Current Region Context).
2. Below the stat cards, a white rounded card containing an assessment data table with header, column headers, 4 sample data rows, and a pagination footer.

The header displays "Project Dashboard" as the page title, a Kenya context selector with a flag icon, a green "Start New Assessment" button, a search input, and a notification bell with an orange indicator dot.

## Component Breakdown

### Header (`app-header.tsx`)
- **Left section:** "Project Dashboard" title (`text-xl font-bold text-[#1F2937]`) + 1px vertical divider (`w-px h-6 bg-border`) + Context selector showing "Kenya" with flag emoji and `ChevronDown` icon
- **Right section:** Green "Start New Assessment" button (`bg-[#4CAF50] text-white shadow-[0_1px_2px_#bbf7d0]` with `Plus` icon) + 1px vertical divider + Search input (`w-64 bg-[#F9FAFB] rounded-lg` with `Search` icon prefix) + Notification bell (`Bell` icon with 8px `bg-warning` dot positioned top-right)

### Stat Cards (4 in a row)

| Card | Value | Trend | Icon | Icon Bg |
|------|-------|-------|------|---------|
| Active Assessments | 28 | +12% (green) | `ClipboardCheck` | `bg-[#F4F9F9]` (Feta/Zumthor) |
| Drafts Pending | 8 | -- (no trend) | `FileBox` | `bg-[#F5F5F5]` (neutral gray) |
| Completed Projects | 142 | +5% (green) | `CircleCheckBig` | `bg-[#F4F9F9]` (Feta/Zumthor) |
| Current Region Context | Kenya | (none) | `Flag` | `bg-primary/10` (`#009CA6` at 10%) |

Each card: white background, `border border-[#F5F5F5]`, `rounded-2xl`, `shadow-sm`, `p-6`. Value displayed in `text-[30px] font-bold leading-9`. Label in `text-sm text-muted-foreground`. Trend badge: `bg-secondary rounded-full px-2 py-0.5 text-xs font-medium text-success`.

### Assessment Table

**Table header bar:** "Active Assessments" title (`text-lg font-bold` / 18px bold, `tracking-[-0.45px]`) + subtitle text + right-aligned Filter and Export buttons (outlined).

**Column headers:** `text-[11px] font-bold uppercase tracking-[1.1px] text-[#9CA3AF]`, background `bg-[#F8FAFC]/50`.

| Column | Content | Style Details |
|--------|---------|---------------|
| BUSINESS NAME | Avatar initials (40px rounded-lg) + name (semibold) + subtitle (muted xs) | Default avatar: `bg-muted text-[#475569]`. Active avatar: `bg-primary/10 text-primary` |
| DATE MODIFIED | Date string | `text-sm text-[#475569]` |
| PROGRESS | Horizontal bar + percentage | Bar: `h-2 rounded-full`, gray track `bg-muted`, colored fill. Gray for draft, `bg-[#3B82F6]` for analyzing, `bg-[#22C55E]` for complete |
| STATUS | Pill badge | See status variants below |
| ACTIONS | 3-dot icon button | `MoreVertical` icon, `text-muted-foreground` |

**Sample rows:**

| Business | Initials | Progress | Status | Avatar Style |
|----------|----------|----------|--------|-------------|
| Kilimo Tech Solutions | KT | 20% | Draft | Default gray |
| Rift Valley Dairy Cooperative | RV | 65% | Analyzing | Active teal bg, blue initials |
| GreenLeaf Agro Ltd | GL | 100% | Complete | Active teal bg, blue initials |
| Mavuno Kwanza Enterprises | MK | 45% | Draft | Default gray |

**Status badge variants:**

| Status | Background | Border | Text Color |
|--------|-----------|--------|------------|
| Draft | `bg-[#F5F5F5]` | `border-[#E2E8F0]` | `text-[#475569]` |
| Analyzing | `bg-[#F4F9F9]` | `border-[#DCFCE7]` | `text-[#1D4ED8]` |
| Complete | `bg-[#F4F9F9]` | `border-[#DCFCE7]` | `text-[#15803D]` |

**Pagination footer:** Left side: "Showing 4 of 28 records" (`text-sm text-muted-foreground`). Right side: Prev button (disabled, `opacity-50`), page 1 (active: `bg-card border border-border shadow-sm font-bold`), page 2, page 3, Next button. All pagination buttons use `rounded-md` (6px) with `h-8 w-8`.

## Layout Structure

```
+---------------------------------------------------------------+
| Sidebar (256px, fixed)  |  Header (64px, sticky top)          |
|                         |  +-------------------------------+  |
| Logo                    |  | Title | Divider | Context     |  |
| Nav items               |  |       | CTA | Search | Bell  |  |
|   - Dashboard (active)  |  +-------------------------------+  |
|   - Prompt manager      |                                     |
|   - Admin               |  Content Area (flex-1, p-8)         |
|                         |  +-------------------------------+  |
|                         |  | Stat1 | Stat2 | Stat3 | Stat4 |  |
|                         |  +-------------------------------+  |
| Settings                |                                     |
| User profile card       |  +-------------------------------+  |
|                         |  | Assessment Table Card         |  |
|                         |  |   Table header + filters      |  |
|                         |  |   Column headers              |  |
|                         |  |   Row 1 (Kilimo Tech)         |  |
|                         |  |   Row 2 (Rift Valley Dairy)   |  |
|                         |  |   Row 3 (GreenLeaf Agro)      |  |
|                         |  |   Row 4 (Mavuno Kwanza)       |  |
|                         |  |   Pagination footer           |  |
|                         |  +-------------------------------+  |
+---------------------------------------------------------------+
```

- Outer layout: `flex` row. Sidebar is `w-64 fixed h-screen`. Content wrapper uses `ml-64 flex-1`.
- Header: `h-16 sticky top-0 z-10 bg-white border-b border-border shadow-sm`.
- Content area: `p-8 bg-[#F9FAFB] min-h-[calc(100vh-64px)]`.
- Stat cards row: `grid grid-cols-4 gap-6`.
- Assessment table card: `bg-card rounded-xl shadow-sm border border-[#F5F5F5] mt-6`.

## shadcn Components Used

| Component | Usage | Already Installed? |
|-----------|-------|--------------------|
| `Card` | Stat cards, assessment table wrapper | Yes |
| `Table` | Assessment data table | Yes |
| `Button` | "Start New Assessment", Filter, Export, pagination | Yes |
| `Input` | Search bar in header | Yes |
| `Badge` | Status pills (Draft/Analyzing/Complete), trend badges | Yes |
| `Avatar` + `AvatarFallback` | Business initials in table rows | Needs install |
| `DropdownMenu` | 3-dot actions menu per table row, context selector | Needs install |
| `Progress` | Progress bars in table (or custom div) | Needs install |
| `Sidebar` | App sidebar shell | Needs install |

### Components to install

```bash
pnpm --filter @alliance-risk/web dlx shadcn@latest add avatar
pnpm --filter @alliance-risk/web dlx shadcn@latest add dropdown-menu
pnpm --filter @alliance-risk/web dlx shadcn@latest add progress
pnpm --filter @alliance-risk/web dlx shadcn@latest add sidebar
```

## Custom Components Needed

| Component | File Path | Description |
|-----------|-----------|-------------|
| `AppSidebar` | `src/components/layout/app-sidebar.tsx` | 256px teal sidebar with logo, navigation (Dashboard, Prompt manager, Admin), settings link, and user profile card. See Pattern 1 in `component-patterns.md`. |
| `AppHeader` | `src/components/layout/app-header.tsx` | 64px white top bar with page title, context selector (Kenya flag + chevron), green CTA button, search input, notification bell. See Pattern 2. |
| `StatCard` | `src/components/dashboard/stat-card.tsx` | Reusable card displaying an icon (in tinted 40px container), large numeric value, label, and optional trend badge. See Pattern 3. Props: `icon`, `value`, `label`, `trend?`, `iconBgClass?`. |
| `AssessmentTable` | `src/components/dashboard/assessment-table.tsx` | Full data table with business avatar+name, date, progress bar, status badge, and actions dropdown. Includes table header with title/subtitle/filter/export and pagination footer. See Pattern 4. |
| `StatusBadge` | `src/components/dashboard/status-badge.tsx` | Pill badge with variant styles for Draft, Analyzing, and Complete statuses. Rounded-full, border, contextual bg/text colors. |
| `ProgressBar` | `src/components/dashboard/progress-bar.tsx` | Thin horizontal bar (`h-2 rounded-full`) with gray track and colored fill. Color determined by status: gray (draft), blue (analyzing), green (complete). Can also use shadcn `Progress` with custom styling. |
| `AvatarInitials` | `src/components/ui/avatar-initials.tsx` | Wrapper around shadcn `Avatar` that derives initials from a name string. Supports default (gray bg) and active (teal/primary bg) variants. |
| `ProtectedLayout` | `src/app/(protected)/layout.tsx` | Layout component wrapping sidebar + header + content area for all authenticated routes. Currently exists as a guard; needs to include the sidebar/header shell. |

## Data Requirements

### Stat Cards

```ts
interface DashboardStats {
  activeAssessments: { count: number; trend?: string };
  draftsPending: { count: number };
  completedProjects: { count: number; trend?: string };
  currentRegion: { name: string };
}
```

**API endpoint:** `GET /api/dashboard/stats` (to be created) or derive from `GET /api/assessments` with aggregation.

### Assessment Table

```ts
interface AssessmentRow {
  id: string;
  businessName: string;
  businessSubtitle?: string;       // e.g. "Agricultural Technology"
  initials: string;                 // e.g. "KT"
  dateModified: string;             // ISO date string
  progress: number;                 // 0-100
  status: "draft" | "analyzing" | "complete";
}
```

**API endpoint:** `GET /api/assessments` with query params for pagination (`page`, `limit`), search, and filtering. Response uses `PaginatedResponse<Assessment>` from shared types.

### Pagination

```ts
interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
```

## Implementation Notes

1. **Sidebar and header are global layout components** shared across all authenticated screens (screens 2-10). They should be implemented in `src/components/layout/` and rendered by the `(protected)/layout.tsx` wrapper, not within the dashboard page itself.

2. **The dashboard page (`packages/web/src/app/(protected)/dashboard/page.tsx`)** should only contain the stat cards row and the assessment table. The sidebar and header come from the parent layout.

3. **Stat card icon backgrounds vary per card.** Use the `iconBgClass` prop to pass different tint classes: `bg-[#F4F9F9]` for teal-tinted cards, `bg-[#F5F5F5]` for neutral (Drafts), and `bg-primary/10` for the region card.

4. **Progress bar colors are determined by assessment status**, not by the progress percentage. Draft assessments always show a gray bar, analyzing shows blue (`#3B82F6`), and complete shows green (`#22C55E`).

5. **Avatar initials variant** depends on assessment status: Draft rows use default gray background (`bg-muted`) with `text-[#475569]` initials. Active statuses (Analyzing, Complete) use teal-tinted background (`bg-primary/10`) with `text-primary` initials.

6. **Table header text** uses the `caption` design token: `text-[11px] font-bold uppercase tracking-[1.1px] text-[#9CA3AF]`, which is a very specific style not covered by default shadcn table headers.

7. **The "Start New Assessment" button** in the header uses a custom green color (`#4CAF50`) rather than the primary teal. It also has a green-tinted shadow (`0px 1px 2px #bbf7d0`). This should be a one-off styled button, not a new variant, unless multiple green CTAs exist across screens.

8. **Context selector (Kenya)** should eventually be a dropdown allowing the user to switch between country contexts. For MVP, it can be a static display or a simple `DropdownMenu` trigger.

9. **Notification bell** has an 8px orange dot (`bg-warning`) absolutely positioned at the top-right of the bell icon. This indicates unread notifications. For MVP, this can be a static indicator.

10. **Pagination** uses simple numbered buttons (not a full pagination component). The "Prev" button starts disabled. Active page button has `bg-card border border-border shadow-sm` styling with bold text. The "Showing X of Y records" text sits on the left side of the footer.

11. **The assessment table card** has `rounded-xl` corners and a subtle border (`border-[#F5F5F5]`). The table itself has no outer border -- the card provides the container.

12. **Responsive behavior** is not specified in the Figma design. The sidebar is fixed at 256px. For mobile, consider implementing a collapsible sidebar behind a hamburger menu, but this is not part of the MVP scope.
