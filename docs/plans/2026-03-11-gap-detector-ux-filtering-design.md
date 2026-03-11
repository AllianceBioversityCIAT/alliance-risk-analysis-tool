# Gap Detector UX — Validation Feedback & Filtering

**Date:** 2026-03-11
**Status:** Approved

## Problem

After AI validation rejects fields (marks them PARTIAL), users see a generic toast and must scroll through all 10 fields to find the ones needing attention. The completeness badge can show 100% even when fields have validation issues.

## Solution

Three frontend-only changes to the gap detector page:

### 1. Filter Pill Tabs

Horizontal pill bar between the "Gap Detector" heading and the category groups:

- **All (10)** — Shows every field (default)
- **Needs Attention (2)** — MISSING + PARTIAL fields only (amber-styled pill with count)
- **Verified (8)** — VERIFIED fields only (green-styled pill)

Behavior:
- Filtering applies at the field level within category groups. If a category has no matching fields after filtering, the entire category group is hidden.
- After validation rejection, auto-switch to "Needs Attention" tab so the user lands directly on the problematic fields.

### 2. Inline Alert Banner

Appears between the heading and the filter tabs when PARTIAL fields exist after validation rejection:

- Amber background (`bg-amber-50 border-amber-200`)
- AlertTriangle icon + bold count + message: **"2 fields need more detail"** — "Please review the highlighted fields and provide meaningful corrections before analyzing risks."
- Dismissable with X button (banner clears from UI, but tabs still show counts)
- Banner appears automatically after `handleAnalyzeRisks` catches validation errors
- Banner disappears on its own when all PARTIAL fields are resolved

### 3. Completeness Badge Update

The top-right "DATA COMPLETENESS" indicator treats PARTIAL as incomplete:

- Current logic: counts fields with `correctedValue || extractedValue`
- New logic: only count VERIFIED fields toward completeness
- PARTIAL fields count as "remaining" — e.g., "90% / 1 required field remaining"
- Badge never shows 100% while fields have validation issues

## Data Flow

All changes are frontend-only — no API or schema changes needed:

1. Validation fails → `handleAnalyzeRisks` catches 400 → refetches gap fields → sets `showValidationBanner = true` → switches active filter to "Needs Attention"
2. User fixes a field → saves → field status changes back to VERIFIED on server → refetch updates counts
3. When no PARTIAL/MISSING fields remain → banner auto-hides → filter resets to "All"
4. Completeness percentage recalculates from `verifiedCount / total`

## Files to Modify

- `packages/web/src/app/(protected)/assessments/gap-detector/gap-detector-client.tsx` — Filter state, banner, auto-switch logic, completeness calculation
- `packages/web/src/components/gap-detector/gap-field-card.tsx` — No changes needed (already has PARTIAL badge + amber feedback)

## Non-Goals

- No API changes
- No guided wizard or step-through flow
- No sticky/floating UI elements
