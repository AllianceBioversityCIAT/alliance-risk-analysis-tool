# Gap Detector — Compact Inbox UX & Sticky Action Bar

**Date:** 2026-03-19
**Module:** Gap Detector
**Status:** Approved

## Problem

The Gap Detector currently displays all fields as a scrolling wall of open text areas inside expanded accordions. When reviewing 20+ fields, this creates severe information overload. Additionally, the primary "Analyze Risks" action is buried at the bottom of the list, losing context. The visual styling also trails behind the premium, "crisp minimal" design language recently established in the Risk Scorecard.

## Solution

Implement the **"Compact Inbox"** pattern. 
1. **Gap Field Cards:** By default, fields render as sleek, single-line rows showing only status, label, and a truncated preview. Clicking a row expands it into the full editor, auto-focusing the text area. Only *one* field can be expanded per category at a time.
2. **Action Bar:** Relocate the "Analyze Risks" button to a sticky header alongside the filter pills, ensuring it is always visible and provides a constant workflow anchor.

## Layout & Interaction Design

### The Action Bar (Sticky)
```
┌─────────────────────────────────────────────────────────────┐
│ [ All (25) ] [ Needs Attention (5) ] [ Verified (20) ]      │
│                                           [ ⚡️ Analyze Risks ]│
└─────────────────────────────────────────────────────────────┘
```

### The Compact Inbox (GapFieldCard)

**Collapsed State (Default):**
```
┌─────────────────────────────────────────────────────────────┐
│ ▌ 🔴 MISSING  Product Description      (No data found...)   │
└─────────────────────────────────────────────────────────────┘
```
- `bg-card`, `shadow-sm`, subtle border. Left edge has a 4px status color indicator.
- Label is bold. The preview text is muted and truncated to one line.
- Hover reveals a faint background change and a pencil icon.

**Expanded State (When Clicked):**
```
┌─────────────────────────────────────────────────────────────┐
│ ▌ 🔴 MISSING  Product Description                           │
│   Identifies the offering and its market positioning.       │
│                                                             │
│   ✨ AI Extracted                                           │
│   [ Read-only box with what the AI found ]                  │
│                                                             │
│   [ Text area automatically focused and ready to type... ]  │
│                                                             │
│   [ Cancel ]  [ Save (Ctrl+Enter) ]                         │
│                                                             │
│   ∨ AI Reasoning                                            │
└─────────────────────────────────────────────────────────────┘
```

### UX Flow
1. **Exclusive Expansion:** `GapCategoryGroup` maintains state for which field is currently `expandedId`. Clicking a collapsed card expands it and collapses any previously open card.
2. **Auto-focus:** When a card expands, its `<Textarea>` immediately receives focus.
3. **Auto-collapse:** Successfully saving a field automatically collapses the card back into the compact row format (and visually updates its status to Verified).

## Changes by File

**`packages/web/src/components/gap-detector/gap-field-card.tsx`**
- Update `GapFieldCardProps` to receive `isExpanded` and `onToggleExpand` from the parent group.
- Implement the two rendering states:
  - Collapsed: Single line `flex` row with `truncate` text.
  - Expanded: The full editor (current UI, restyled to match Risk Scorecard aesthetics).
- Refactor the inner state (`isFocused`) to tie into the external `isExpanded` state. Use a `useEffect` on `isExpanded` to call `ref.current?.focus()` on the textarea.
- Upon successful save (inside `handleSave`), call `onToggleExpand(id)` to collapse the card.
- Redesign `GapCategoryGroupInner` to hold `expandedId` state (`useState<string | null>(null)`). Pass `isExpanded={expandedId === field.id}` and `onToggleExpand` down to children.

**`packages/web/src/app/(protected)/assessments/gap-detector/gap-detector-client.tsx`**
- Relocate the `Analyze Risks` `<Button>` from the bottom of the list.
- Create a sticky header container `div` above the category list.
- Group the filter pills (All/Needs Attention/Verified) and the `Analyze Risks` button into a `flex items-center justify-between` layout inside this sticky header.
- Ensure the header has `sticky top-0 z-10 bg-background pb-4 pt-2` or similar to stay visible while scrolling the categories.
