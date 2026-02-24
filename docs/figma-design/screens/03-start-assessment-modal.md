# Start Assessment Modal
Figma: https://www.figma.com/design/5HHOnHNcqeVyLcebGs5kuW/?node-id=97:54

## Screenshot Description
Modal dialog triggered by the "Start New Assessment" button. Shows business info form fields at top, then 3 intake mode cards at bottom.

## Component Breakdown
- **Modal header**: "Start New Assessment" title + close X button
- **Business info section**:
  - Business Name (text input)
  - Business Type (select/dropdown)
  - Country/Region (select with flag)
- **Intake mode selection**: 3 cards in a row:
  1. **Upload Business Plan** - CloudUpload icon, title, description "Upload PDF, DOCX, or XLSX documents"
  2. **Guided Interview** - MessageSquare icon, title, description "Answer questions about your business"
  3. **Manual Data Entry** - PenLine icon, title, description "Enter data directly into forms"
- **Footer**: Cancel button (outlined) + Continue button (primary, disabled until mode selected)

## Layout Structure
- Modal: max-w-2xl, centered
- Business info: flex flex-col gap-4
- Mode cards: grid grid-cols-3 gap-4
- Footer: flex justify-end gap-3

## shadcn Components Used
- `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogFooter`
- `Input` for business name
- `Select` for business type and country
- `Button` (outline variant for Cancel, default for Continue)

## Custom Components Needed
- `src/components/assessment/intake-mode-card.tsx` - Selectable card with icon, title, description
- `src/components/assessment/start-assessment-modal.tsx` - Modal orchestrating form + mode selection

## Data Requirements
- Business types list (from shared constants or API)
- Countries/regions list
- POST /api/assessments (create new assessment)

## Implementation Notes
- Mode cards should be radio-button-like: only one can be selected at a time
- Selected card: `border-2 border-primary bg-secondary`
- Continue button disabled until: business name, type, country, and mode are all selected
- On continue: navigate to the selected mode's modal (screens 4, 5, or 6)
