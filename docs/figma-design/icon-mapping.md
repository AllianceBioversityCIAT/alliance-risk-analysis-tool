# Icon Mapping

Maps Figma Material Icons to Lucide React equivalents (already installed in the project as `lucide-react`).

## Import Pattern

```tsx
import { LayoutDashboard, Mail, Lock } from "lucide-react";

// Usage
<LayoutDashboard className="h-5 w-5" />
```

## Complete Mapping

### Navigation & Layout

| Figma Material Icon | Lucide React | Screens | Notes |
|---------------------|-------------|---------|-------|
| `dashboard` | `LayoutDashboard` | Sidebar (all screens) | Active nav item |
| `article` / `description` | `FileText` | Sidebar (Prompt manager) | |
| `admin_panel_settings` | `Shield` | Sidebar (Admin) | |
| `settings` | `Settings` | Sidebar (Settings) | |
| `menu` | `Menu` | Header (mobile toggle) | If responsive sidebar needed |
| `notifications` | `Bell` | Header | With orange notification dot |
| `search` | `Search` | Header search bar | |
| `expand_more` / `keyboard_arrow_down` | `ChevronDown` | Header context selector | |
| `more_vert` | `MoreVertical` | Table action button | 3-dot menu per row |
| `navigate_next` | `ChevronRight` | Breadcrumbs | Separator between crumbs |

### Authentication

| Figma Material Icon | Lucide React | Screens | Notes |
|---------------------|-------------|---------|-------|
| `mail_outline` | `Mail` | Login | Email input prefix icon |
| `lock_outline` | `Lock` | Login | Password input prefix icon |
| `visibility_off` | `EyeOff` | Login | Password toggle (hidden state) |
| `visibility` | `Eye` | Login | Password toggle (visible state) |

### Assessment & Actions

| Figma Material Icon | Lucide React | Screens | Notes |
|---------------------|-------------|---------|-------|
| `add` | `Plus` | Dashboard header, Start Assessment | "Start New Assessment" button |
| `cloud_upload` | `CloudUpload` | Upload Business Plan | Dropzone icon |
| `description` / `insert_drive_file` | `FileText` | Upload modal | File type reference |
| `check_circle` | `CheckCircle` | Upload success, completion states | |
| `error` / `warning` | `AlertTriangle` | Gap detector, validation errors | |
| `close` | `X` | Modal close buttons | All modal headers |

### Dashboard Stat Cards

| Figma Material Icon | Lucide React | Screens | Notes |
|---------------------|-------------|---------|-------|
| `assignment` / `fact_check` | `ClipboardCheck` | Stat card: Active Assessments | Teal tint bg icon |
| `inventory_2` / `drafts` | `FileBox` | Stat card: Drafts Pending | Neutral bg icon |
| `task_alt` / `verified` | `CircleCheckBig` | Stat card: Completed Projects | Teal tint bg icon |
| `flag` | `Flag` | Stat card: Current Region | Teal tint bg icon |

### Data Intake Modals

| Figma Material Icon | Lucide React | Screens | Notes |
|---------------------|-------------|---------|-------|
| `upload_file` | `Upload` | Upload Business Plan | Upload area |
| `chat` / `forum` | `MessageSquare` | Guided Interview | Interview mode card |
| `edit_note` / `edit` | `PenLine` | Manual Data Entry | Manual entry mode card |
| `attach_file` | `Paperclip` | Start Assessment | Upload mode card |
| `arrow_back` | `ArrowLeft` | Modal navigation | Back button |
| `arrow_forward` | `ArrowRight` | Modal navigation | Next button |
| `check` | `Check` | Stepper completed step | |

### Gap Detector

| Figma Material Icon | Lucide React | Screens | Notes |
|---------------------|-------------|---------|-------|
| `warning` / `report_problem` | `AlertTriangle` | Gap fields | Missing data indicator |
| `info` | `Info` | Gap fields | Info tooltip |
| `check_circle` | `CheckCircle` | Gap fields | Verified data indicator |
| `picture_as_pdf` | `FileText` | PDF viewer panel | Document reference |
| `zoom_in` | `ZoomIn` | PDF viewer | Zoom control |
| `zoom_out` | `ZoomOut` | PDF viewer | Zoom control |

### Risk Scorecard

| Figma Material Icon | Lucide React | Screens | Notes |
|---------------------|-------------|---------|-------|
| `speed` / `analytics` | `Gauge` | Risk score | Score visualization |
| `trending_up` | `TrendingUp` | Positive trends | Stat improvement |
| `trending_down` | `TrendingDown` | Negative trends | Stat decline |
| `lightbulb` | `Lightbulb` | Recommendations | Recommendation icon |
| `comment` | `MessageCircle` | Comment section | Add comment |
| `send` | `Send` | Comment submit | Submit button icon |

### Full Report

| Figma Material Icon | Lucide React | Screens | Notes |
|---------------------|-------------|---------|-------|
| `print` | `Printer` | Report toolbar | Print action |
| `download` | `Download` | Report toolbar | PDF export |
| `share` | `Share2` | Report toolbar | Share action |
| `toc` / `list` | `List` | Report sidebar | TOC toggle |
| `expand_less` | `ChevronUp` | Collapsible sections | Section toggle |
| `expand_more` | `ChevronDown` | Collapsible sections | Section toggle |

## Notes

- All Lucide icons default to 24px. Use `className="h-5 w-5"` (20px) or `className="h-6 w-6"` (24px) to match Figma sizes.
- Figma uses Material Icons font rendering; Lucide uses SVG strokes. Visual weight may differ slightly — adjust `strokeWidth` prop if needed.
- For the sidebar, icons should be 24px (`h-6 w-6`).
- For input prefix icons, use 20px (`h-5 w-5`) with `text-muted-foreground` color.
- For stat card icons, use 24px inside a 40px rounded-lg container with tinted background.
