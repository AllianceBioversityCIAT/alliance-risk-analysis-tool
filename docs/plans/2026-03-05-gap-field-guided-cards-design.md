# Gap Field Guided Cards + Auto Re-analyze

**Date:** 2026-03-05
**Status:** Approved
**Problem:** Clients don't understand WHY they should provide data in gap field cards. The current UI shows a plain input with vague placeholders and no context about what the data is used for.

## Solution: Guided Card Pattern

Redesign each gap field card to include inline helper text explaining the field's purpose, a visible read-only AI extraction block, a textarea for user input, and automatic re-analysis on save.

## Card Layout

```
+-- border-l-4 (color by status) ----------------------------+
|                                                              |
|  Label *               [STATUS BADGE]   [CONFIDENCE]         |
|  Helper text explaining why this data matters (muted)        |
|                                                              |
|  +-- AI Found (read-only, bg-muted/30) ------------------+  |
|  | "Revenue comes almost entirely from honey sales..."    |  |
|  +--------------------------------------------------------+  |
|                                                              |
|  +-- Textarea ---------------------------------+  +------+  |
|  | Add or correct information...                |  | Save |  |
|  +----------------------------------------------+  +------+  |
|                                                              |
|  > AI Reasoning                                              |
+--------------------------------------------------------------+
```

### States

- **MISSING**: Red left border, red-tinted background, no AI extraction block, placeholder: "Provide the missing information..."
- **PARTIAL**: Amber left border, AI extraction shown, placeholder: "Add more details to complete this field..."
- **VERIFIED**: Green left border, AI extraction shown, placeholder: "Correct or add to the AI extraction..."
- **Re-analyzing**: After save, card shows inline spinner with "Re-analyzing..." text, input disabled until complete.

## Helper Text Definitions

| Field | Description |
|-------|-------------|
| Business Model Summary | Describes how the business creates and delivers value |
| Enterprise Type | Classifies the business structure for regulatory assessment |
| Country of Operation | Determines geopolitical and market-specific risk factors |
| Product/Service Description | Identifies the offering and its market positioning |
| Revenue Model | Helps assess income stability and lending capacity |
| Cost Drivers | Understanding costs helps evaluate profitability risk |
| Supply Chain Overview | Maps dependencies that could disrupt operations |
| Workforce Summary | Assesses human capital risks and organizational capacity |
| Customer Base | Evaluates revenue concentration and market risk |
| Key Challenges | Identifies known risks the business is already facing |

## Auto Re-analyze Flow

```
User saves field
  |
  v
1. PUT /api/assessments/{id}/gap-fields       (persist correctedValue)
  |
  v
2. POST /api/assessments/{id}/gap-fields/submit  (trigger GAP_DETECTION job)
  |
  v
3. Card shows "Re-analyzing..." inline spinner
  |
  v
4. Frontend polls GET /api/jobs/{jobId} until COMPLETED/FAILED
  |
  v
5. Refetch GET /api/assessments/{id}/gap-fields
  |
  v
6. Cards update with new status, confidence, AI reasoning
```

The existing `POST /gap-fields/submit` endpoint already creates a GAP_DETECTION job via the jobs service. The frontend just needs to call it after saving.

## Changes by File

### Backend

**`packages/api/src/domain/gap-detection/gap-detection.config.ts`**
- Add `description: string` to `Core10FieldDefinition` interface
- Add description text to each of the 10 core field definitions

**`packages/api/prisma/schema.prisma`**
- Add `description String? @db.VarChar(500)` to `GapField` model
- Run migration

**`packages/api/src/platform/jobs/handlers/gap-detection.handler.ts`**
- When creating GapField records, populate `description` from config

**`packages/shared/src/types/gap-field.types.ts`**
- Add `description: string | null` to `GapFieldResponse`

### Frontend

**`packages/web/src/components/gap-detector/gap-field-card.tsx`**
- Add `description` prop to `GapFieldCardProps`
- Add helper text line below label (muted, text-xs)
- Add "AI Found" read-only block when `extractedValue` exists and differs from `correctedValue`
- Replace `<Input>` with `<Textarea>` (auto-grow, min 2 rows)
- Add `isReanalyzing` state with inline spinner
- Update placeholders by status

**`packages/web/src/app/(protected)/assessments/gap-detector/gap-detector-client.tsx`**
- Wire save flow: PUT update -> POST submit -> poll job -> refetch fields
- Pass `description` to GapFieldCard
- Manage re-analyzing state per card

**`packages/web/src/hooks/use-gap-detection.ts`**
- Add `useSubmitGapFields` mutation that calls `POST /api/assessments/{id}/gap-fields/submit`
- Combine with existing `useUpdateGapFields` in a sequential flow

## Migration

```sql
ALTER TABLE gap_fields ADD COLUMN description VARCHAR(500);
```

Existing gap fields (from prior assessments) will have `description = NULL`. The frontend falls back gracefully (no helper text shown). New gap detections will populate the field from config.
