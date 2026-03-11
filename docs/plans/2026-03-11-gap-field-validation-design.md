# Design — AI-Powered Gap Field Validation on Submit

## Document Control

| Field   | Value                                           |
| ------- | ----------------------------------------------- |
| Project | CGIAR Agricultural Risk Intelligence Tool (MVP) |
| Module  | Gap Detector — Field Validation Gate            |
| Date    | 2026-03-11                                      |
| Status  | Approved                                        |

---

## 1. Problem

When a user edits a PARTIAL (pending verification) gap field, the system accepts any non-empty text as valid and marks the field VERIFIED. This allows trivial or nonsensical input (e.g., appending "the team -1" to an AI extraction) to pass validation, undermining data quality before risk analysis.

## 2. Solution

Add an AI-powered validation gate when the user clicks "Analyze Risks." Before triggering risk analysis, the system sends only user-edited fields to Bedrock for validation. Fields that don't meaningfully address their requirement are rejected with feedback, and the hard stop re-engages.

Fields the AI originally marked VERIFIED (untouched by the user) skip validation entirely.

## 3. Flow

```
User clicks "Analyze Risks"
  → 1. Collect fields where correctedValue IS NOT NULL (user-edited)
  → 2. If no edited fields → proceed to risk analysis (existing behavior)
  → 3. If edited fields exist → call Bedrock validation (single call)
  → 4. All valid? → trigger RISK_ANALYSIS job as before
  → 5. Any invalid? → set those fields back to PARTIAL
       → return 400 with per-field feedback
       → hard stop re-engages
```

## 4. API Changes

### 4.1 Submit Endpoint (Modified)

`POST /api/assessments/:id/gap-fields/submit` gains a validation step before creating the risk analysis job.

**Validation failure response (400):**

```json
{
  "statusCode": 400,
  "message": "Some fields did not pass validation",
  "invalidFields": [
    {
      "id": "uuid-123",
      "field": "workforce_summary",
      "feedback": "The appended text does not add meaningful workforce information."
    }
  ]
}
```

### 4.2 New Service Method

`GapDetectionService.validateEditedFields(assessmentId)`:

1. Query gap fields where `correctedValue IS NOT NULL`
2. Build validation prompt with field labels, descriptions, and corrected values
3. Call `BedrockService.invokeModel()` with validation config
4. Parse response — array of `{ field, valid, feedback }`
5. For invalid fields: update status to PARTIAL in DB
6. Return validation results

### 4.3 Validation Config

Added to `gap-detection.config.ts`:

```typescript
export const GAP_VALIDATION_CONFIG = {
  model: 'anthropic.claude-sonnet-4-6',
  maxTokens: 4096,
  temperature: 0.1,  // Very low — deterministic yes/no decisions
  topP: 0.9,
};
```

## 5. Prompt Design

### System Prompt

```
You are a data quality validator for agricultural business plan fields.
Your task is to determine whether user-provided corrections meaningfully
address each field's requirement.

Rules:
- VALID: The text contains substantive, relevant information for the field.
- INVALID: The text is trivial, nonsensical, irrelevant, or does not
  meaningfully add to or correct the field's content.
- Compare the corrected value against the field description to judge relevance.
- Be lenient with formatting/grammar but strict on substance.

Return JSON: { "results": [{ "field": "field_key", "valid": true/false,
"feedback": "brief reason if invalid, null if valid" }] }
```

### User Prompt Template

```
Validate these user-corrected business plan fields:

{{fields_json}}

Each entry contains:
- field: the field key
- label: human-readable name
- description: what this field should contain
- extractedValue: what the AI originally found (may be null)
- correctedValue: what the user provided

Determine if each correctedValue meaningfully addresses the field requirement.
```

## 6. Frontend Changes

### 6.1 gap-detector-client.tsx

When "Analyze Risks" returns 400 with `invalidFields`:

1. Update local query cache: set rejected fields' status back to PARTIAL
2. Show toast: "X field(s) need more detail before analysis"
3. Store feedback per field ID in local state
4. Hard stop re-engages (allMandatoryComplete becomes false)

### 6.2 gap-field-card.tsx

New optional `validationFeedback` prop. When present and field is PARTIAL:

- Show inline warning below the textarea
- Amber text with AI feedback message
- Clears when user saves a new correction

## 7. Shared Type Changes

```typescript
// gap-field.types.ts — add optional field
export interface GapFieldResponse {
  // ... existing fields
  validationFeedback?: string | null;  // NEW — AI feedback on rejected correction
}

// New type for validation failure response
export interface GapFieldValidationError {
  invalidFields: Array<{
    id: string;
    field: string;
    feedback: string;
  }>;
}
```

## 8. What Stays the Same

- Save button behavior — still saves correctedValue and marks VERIFIED optimistically
- Hard stop logic — still checks allMandatoryComplete
- Re-analysis on MISSING field edits — still triggers for new data
- PARTIAL field saves skip re-analysis (fix from earlier today)

## 9. Cost Estimate

- Validation prompt: ~500-2000 tokens input (only edited fields + descriptions)
- Response: ~200-500 tokens
- Cost per validation: ~$0.005-0.01
- Only runs when user clicks "Analyze Risks" — not on every save

## 10. Files to Modify

| Layer  | File                          | Change                                              |
| ------ | ----------------------------- | --------------------------------------------------- |
| API    | `gap-detection.service.ts`    | Add `validateEditedFields()` method                 |
| API    | `gap-field.controller.ts`     | Inject validation into submit endpoint              |
| API    | `gap-detection.config.ts`     | Add `GAP_VALIDATION_CONFIG` + validation prompt     |
| Web    | `gap-detector-client.tsx`     | Handle 400 response, show feedback, revert fields   |
| Web    | `gap-field-card.tsx`          | Display validation feedback inline                  |
| Shared | `gap-field.types.ts`          | Add `validationFeedback` + `GapFieldValidationError` |
