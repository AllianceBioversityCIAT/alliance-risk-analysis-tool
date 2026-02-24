# Guided Interview Modal
Figma: https://www.figma.com/design/5HHOnHNcqeVyLcebGs5kuW/?node-id=97:728

## Screenshot Description
Multi-step wizard modal for guided interview. Shows a stepper at top, question content in the middle, and navigation at bottom.

## Component Breakdown
- **Modal header**: "Guided Interview" title + step indicator "Step 2 of 7" + close X
- **Stepper**: Horizontal step indicators for each risk category
  - Circle with number or check (completed)
  - Category name below
  - Connecting lines between steps
- **Question area**:
  - Category heading (e.g., "Climate Risk")
  - Question text (body, semibold)
  - Answer input: varies by question type
    - Yes/No choice cards (binary)
    - Text input (free text)
    - Number input (with unit)
    - Select dropdown (predefined options)
- **Footer**: Back button (outlined) + Next/Complete button (primary) + Skip link

## Layout Structure
- Modal: max-w-2xl, min-h-[500px]
- Stepper: flex items-center justify-between, full width
- Question area: flex-1, flex flex-col gap-6, px-8
- Footer: flex justify-between items-center

## shadcn Components Used
- `Dialog`, `DialogContent`
- `Button` (outline for Back, default for Next)
- `Input`, `Select`, `Textarea` for answer types

## Custom Components Needed
- `src/components/assessment/wizard-stepper.tsx` - Horizontal step indicator
- `src/components/assessment/choice-cards.tsx` - Yes/No binary selection
- `src/components/assessment/guided-interview-modal.tsx` - Modal with step management
- `src/components/assessment/interview-question.tsx` - Renders question + appropriate input type

## Data Requirements
- GET /api/assessments/:id/interview/questions - Fetch interview questions per category
- POST /api/assessments/:id/interview/answers - Submit answers per step
- Interview questions organized by 7 risk categories
- Types from shared package: risk category enum, question types

## Implementation Notes
- Stepper should show all 7 risk categories
- Questions per category come from the API (driven by prompts)
- Support keyboard navigation between steps
- Auto-save answers as user progresses
- "Skip" should mark category as incomplete but allow progression
- On final step "Complete" replaces "Next"
