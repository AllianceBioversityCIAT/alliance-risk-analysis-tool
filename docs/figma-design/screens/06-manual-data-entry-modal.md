# Manual Data Entry Modal
Figma: https://www.figma.com/design/5HHOnHNcqeVyLcebGs5kuW/?node-id=97:1002

## Screenshot Description
Full-width modal with vertical side tabs for risk categories on the left and data entry forms on the right.

## Component Breakdown
- **Modal header**: "Manual Data Entry" title + close X + Save Draft button
- **Side tabs** (left, 200px):
  - 7 risk category tabs (vertical list)
  - Active tab: bg-secondary, text-primary, font-semibold, left border 2px primary
  - Inactive tab: text-muted-foreground
  - Tab labels: category names with completion indicator (check icon or fraction "3/5")
- **Form area** (right):
  - Section heading (category name)
  - Form fields organized in groups
  - Field types: text input, number input, currency input (with USD prefix), textarea, select, date picker
  - Some fields have helper text/tooltips
  - Fields arranged in 2-column grid for related items
- **Footer**: Save Draft button (outlined) + Submit for Analysis button (primary)

## Layout Structure
- Modal: max-w-4xl or full-width, min-h-[600px]
- Body: flex (side tabs + form)
- Side tabs: w-48, border-r border-border, flex flex-col
- Form area: flex-1, overflow-y-auto, p-6
- Form grid: grid grid-cols-2 gap-4 for paired fields
- Footer: flex justify-end gap-3

## shadcn Components Used
- `Dialog`, `DialogContent`
- `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` (vertical orientation)
- `Input`, `Textarea`, `Select`
- `Button` (outline for Save Draft, default for Submit)
- `Tooltip` for field help icons

## Custom Components Needed
- `src/components/assessment/currency-input.tsx` - Input with currency prefix select
- `src/components/assessment/manual-data-entry-modal.tsx` - Modal with tab management
- `src/components/assessment/category-form.tsx` - Dynamic form for a risk category

## Data Requirements
- GET /api/assessments/:id/data-entry/schema - Form schema per category
- PUT /api/assessments/:id/data-entry/:category - Save data per category
- POST /api/assessments/:id/submit - Submit for analysis
- Types: form field definitions, validation rules per category

## Implementation Notes
- Use React Hook Form with dynamic field registration per category
- Tab switching should preserve unsaved data
- Completion indicator shows filled/total required fields
- Currency input needs to support multiple currencies (USD, KES, etc.)
- "Save Draft" saves without validation, "Submit" validates all required fields
- Consider autosave on tab switch
- After submit: creates async job, transitions to Gap Detector (screen 7)
