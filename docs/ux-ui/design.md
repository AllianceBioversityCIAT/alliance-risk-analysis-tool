# UX/UI Design System — CGIAR Risk Intelligence Tool

> **Status:** Living design blueprint  
> **Last updated:** 2026-07-27  
> **Source of truth for tokens:** [`docs/figma-design/design-tokens.md`](figma-design/design-tokens.md)  
> **Figma:** [Risk Analysis Tool](https://www.figma.com/design/5HHOnHNcqeVyLcebGs5kuW/RISK-ANALYSIS-TOOL)

This document defines the visual and interaction system. Low-level CSS variable values and per-screen specs live in `docs/figma-design/`.

---

## 1. Product Experience Principles

| Principle | Meaning in this product |
|-----------|-------------------------|
| **Clarity over density** | Risk data is complex; use progressive disclosure (dashboard → gap → scorecard → report) |
| **Analyst in control** | AI suggests; analyst edits gap fields and recommendations before finalizing |
| **Status at a glance** | Color-coded risk levels and gap field badges (MISSING / PARTIAL / VERIFIED) |
| **Consistent shell** | Sidebar + header layout on all authenticated screens |
| **Accessible by default** | WCAG 2.1 AA target for contrast, focus rings, and form labels |

---

## 2. Information Architecture

```
Login / Forgot password / Change password
    └── Dashboard (assessment list + stats)
            └── Assessment workflow (query param ?id=)
                    ├── Upload documents
                    ├── Gap detector
                    ├── Risk scorecard
                    └── Full report (+ PDF)
            └── Admin (admin role only)
                    ├── User management
                    └── Prompt manager (list / create / edit)
```

**Intake modals (designed, partial deploy):** Start Assessment → Upload | Guided Interview | Manual Entry

---

## 3. Primary User Flows

### Flow A — Document upload assessment

Dashboard → Start New Assessment → Upload → Parse (async) → Gap Detector → Analyze Risks → Risk Scorecard → Report → Download PDF

### Flow B — Gap field correction loop

Gap Detector → Edit field → Save → Re-analyze (optional) → Submit → (validation pass/fail) → retry or proceed

### Flow C — Admin prompt tuning

Prompt Manager → Edit prompt → Preview (job poll) → Toggle active → Change history

---

## 4. Screen Inventory

| Screen | Route | Figma guide | Status |
|--------|-------|-------------|--------|
| Login | `/login` | `screens/01-login.md` | Implemented |
| Dashboard | `/dashboard` | `screens/02-dashboard.md` | Implemented |
| Start Assessment modal | (modal) | `screens/03-start-assessment-modal.md` | Implemented |
| Upload | `/assessments/upload?id=` | `screens/04-upload-business-plan-modal.md` | Implemented |
| Guided interview | `/assessments/interview?id=` | `screens/05-guided-interview-modal.md` | Placeholder |
| Manual entry | `/assessments/manual-entry?id=` | `screens/06-manual-data-entry-modal.md` | Placeholder |
| Gap detector | `/assessments/gap-detector?id=` | `screens/07-gap-detector.md` | Implemented |
| Risk scorecard | `/assessments/risk-scorecard?id=` | `screens/08-risk-scorecard-results.md` | Implemented |
| Scorecard + comment | (inline) | `screens/09-risk-scorecard-comment.md` | Partial |
| Full report | `/assessments/report?id=` | `screens/10-full-report.md` | Implemented |
| Admin users | `/admin/users` | — | Implemented |
| Prompt manager | `/admin/prompt-manager` | — | Implemented |

---

## 5. Navigation Model

- **Authenticated shell:** Teal sidebar (`--sidebar`) with nav items, user card, active indicator (orange pip)
- **Admin section:** Visible only when `isAdmin`; separate route group `(admin)/`
- **Assessment context:** Workflow steps linked via `?id=<assessmentUuid>` — never path segments
- **Breadcrumbs:** Page title in header (`AppHeader`); no deep breadcrumb trail in MVP

---

## 6. Layout Patterns

| Pattern | Usage | Reference |
|---------|-------|-----------|
| **AppLayout** | Sidebar + main content | `component-patterns.md` |
| **Stat cards** | Dashboard KPIs | 4-column grid, icon in tinted bg |
| **Data table** | Assessments, users, prompts | Sortable headers, pagination |
| **Split pane** | Gap detector | Document viewer (left) + field panel (right) |
| **Modal / dialog** | Create assessment, CRUD modals | shadcn `Dialog` |
| **Filter pills** | Gap detector status tabs | All / Needs Attention / Verified |
| **Card grid** | Prompt list | `PromptCard` with badges |

See [`docs/figma-design/component-patterns.md`](figma-design/component-patterns.md) for 22 documented patterns.

---

## 7. Design Tokens

### Brand

| Token | Value | CSS variable | Usage |
|-------|-------|--------------|-------|
| Primary (Bondi Blue) | `#009CA6` | `--primary` | Buttons, CTAs, focus rings |
| Sidebar (Teal) | `#008F8F` | `--sidebar` | Navigation background |
| Secondary tint | `#F4F9F9` | `--secondary` | Stat card backgrounds |

### Typography

- **Font:** Inter (via `next/font/google`)
- **Scale:** `heading-1` 30px/700 → `body` 14px/400 (see design-tokens.md)

### Spacing & radius

- Base unit: 4px grid
- Card radius: `--radius` (0.5rem default)
- Input border: `#D1D5DB` / `--border` for dividers

### Risk & status colors

| Level | Color | CSS variable |
|-------|-------|--------------|
| Low / Success | `#16A34A` | `--success` |
| Moderate / Warning | `#F48C06` | `--warning` |
| High / Critical | `#EA580C` | `--destructive` |
| Info / Links | `#2563EB` | `--info` |

### Chart palette

`--chart-1` through `--chart-5` — teal, blue, green, orange, red (radar chart, heatmap)

**Rule:** Use CSS variables from `globals.css`; never hardcode hex in components. Apply one-time token sync from [`globals-update.md`](figma-design/globals-update.md).

---

## 8. Component Inventory

### shadcn/ui primitives (`packages/web/src/components/ui/`)

button, card, dialog, form, input, label, select, separator, skeleton, switch, table, tabs, textarea, badge, sidebar, sheet, and others (~26 components)

### Feature components

| Area | Key components |
|------|----------------|
| Auth | `login-form`, `forgot-password-form`, `change-password-form` |
| Gap detector | `gap-field-card`, `gap-layout`, `document-viewer` |
| Admin | `user-management`, `create-user-modal`, `edit-user-modal` |
| Prompts | `prompt-list`, `prompt-editor-form`, `prompt-preview-panel`, `change-history` |
| Notifications | `sileo` toaster (not sonner) |

### Icons

Lucide React — map from Figma Material icons via [`icon-mapping.md`](figma-design/icon-mapping.md)

---

## 9. Responsive Behavior

| Breakpoint | Behavior |
|------------|----------|
| Desktop (≥1280px) | Full sidebar + split-pane gap detector |
| Tablet (768–1279px) | Collapsible sidebar; stacked panes where needed |
| Mobile (<768px) | Sidebar → sheet/drawer; tables scroll horizontally |

MVP primary target: **desktop-first** (analyst workstation). Mobile is supported but not optimized for full assessment workflow.

---

## 10. Accessibility Expectations

- Form inputs: associated `<Label>`, visible focus ring (`--ring`)
- Color is not sole indicator — pair risk colors with text labels (LOW, MODERATE, HIGH, CRITICAL)
- Dialogs: focus trap, Escape to close
- Tables: semantic `<th>` headers
- Target: WCAG 2.1 AA contrast for text on `--background` and `--card`

---

## 11. Dark Mode Behavior

- `next-themes` provider with `@custom-variant dark` in `globals.css`
- Dark tokens defined in `:root` / `.dark` pairs (see globals-update.md)
- MVP: light mode is primary QA path; dark mode should not regress but is lower priority

---

## 12. Design Decisions

| ID | Decision | Rationale |
|----|----------|-----------|
| DD-UX-01 | Teal brand palette | CGIAR Alliance visual identity from Figma |
| DD-UX-02 | Query-param routing for IDs | Static export constraint — no `[id]` segments |
| DD-UX-03 | sileo for toasts | Project standard; sonner deprecated in web package |
| DD-UX-04 | Filter pills on gap detector | Reduces cognitive load vs dropdown for 3 states |
| DD-UX-05 | Split-pane gap layout | Analysts need document context while editing fields |

---

## 13. Open Gaps / Open Questions

| Gap | Notes |
|-----|-------|
| Guided interview screens | Figma spec exists; pages are placeholders |
| Manual entry screens | Same as above |
| Scorecard comment UX | Partial — inline comments not fully aligned with Figma node `425:2490` |
| Loading skeletons | Inconsistent across assessment workflow steps |
| Empty states | Dashboard zero-state copy not finalized |
