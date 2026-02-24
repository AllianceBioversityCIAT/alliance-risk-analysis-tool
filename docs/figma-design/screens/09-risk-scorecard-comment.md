# Risk Scorecard with Comment
Figma: https://www.figma.com/design/5HHOnHNcqeVyLcebGs5kuW/?node-id=425:2490

## Screenshot Description
Same as the Risk Scorecard Results screen but with a comment panel open on the right side or as an overlay. Shows the comment thread and input area for adding analyst notes.

## Component Breakdown
- **Everything from Screen 8** (Risk Scorecard Results)
- **Comment Panel** (overlaid or side panel):
  - Panel header: "Comments" + close X + comment count
  - **Comment thread**:
    - Individual comments:
      - Avatar (initials or photo, 32px)
      - Author name (semibold, 14px) + role (regular, 12px, muted)
      - Timestamp (12px, muted)
      - Comment text (14px, regular)
      - Optional: attached to specific risk category (category badge)
    - Comments sorted newest first or by thread
  - **New comment input** (bottom):
    - Textarea (auto-expanding, min 2 rows)
    - "Attach to category" dropdown (optional, selects risk category)
    - Send button (icon button or primary button)
    - Character count or limit indicator

## Layout Structure
Two options (based on Figma):
1. **Side panel**: Content area shrinks, comment panel slides in from right (320-400px wide)
2. **Overlay**: Full-height panel overlays the right side of the content

```
[Sidebar] | [Main Content (shrunk)] | [Comment Panel 360px]
```

- Comment panel: `w-[360px] border-l border-border bg-card flex flex-col h-full`
- Thread area: `flex-1 overflow-y-auto p-4 space-y-4`
- Input area: `border-t border-border p-4`

## shadcn Components Used
- All components from Screen 8
- `Textarea` for comment input
- `Button` for send
- `Avatar`, `AvatarFallback` for commenter avatars
- `Select` for category attachment
- `ScrollArea` for comment thread

## Custom Components Needed
- `src/components/risk-analysis/comment-panel.tsx` — Side panel container
- `src/components/risk-analysis/comment-thread.tsx` — List of comments
- `src/components/risk-analysis/comment-item.tsx` — Single comment display
- `src/components/risk-analysis/comment-input.tsx` — New comment textarea + send

## Data Requirements
- GET /api/assessments/:id/comments — Fetch comments for assessment
- POST /api/assessments/:id/comments — Add new comment
- Types:
  ```ts
  interface AssessmentComment {
    id: string;
    authorId: string;
    authorName: string;
    authorRole: string;
    text: string;
    category?: RiskCategory;
    createdAt: string;
  }
  ```

## Implementation Notes
- Comment panel should animate in (slide from right)
- Existing comment-section.tsx in components/prompts/ can be referenced for patterns
- Real-time updates would be nice but not MVP — simple refetch on submit
- Textarea should support Shift+Enter for newlines, Enter for submit
- Empty state: "No comments yet. Be the first to add a note."
- Consider optimistic updates for better UX
- The comment panel state (open/closed) can be managed via URL search params or local state
