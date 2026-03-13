# Gap Detection Module (API)

The Gap Detection module is responsible for analyzing parsed assessment documents and identifying missing or incomplete information across the 10 core business plan fields.

## Core Responsibilities

1. **Gap Analysis Orchestration**: Triggers asynchronous jobs to analyze documents using AWS Bedrock.
2. **Field Management**: Provides CRUD operations for the 10 core gap fields extracted from business plans.
3. **AI Validation**: When users edit gap fields, this module uses Bedrock to validate if the new information genuinely resolves the gap before allowing the user to proceed to Risk Analysis.

## Architecture & Data Flow

This module sits in the `domain` layer and interacts heavily with the `platform/jobs` system and `infrastructure/bedrock`.

1. **Extraction**: Documents are parsed by the `ParseDocumentHandler`.
2. **Analysis Trigger**: The frontend requests gap analysis, which enqueues a `GAP_DETECTION` job.
3. **AI Processing**: The `GapDetectionHandler` (in `platform/jobs`) sends the merged document text to Bedrock with the `GAP_DETECTOR` prompt.
4. **Result Storage**: Bedrock's JSON response is parsed and saved as `GapField` records in the database.
5. **User Review**: The frontend displays these fields. Users can edit `PARTIAL` or `MISSING` fields.
6. **Validation**: Submitting edits triggers `gap-detection.service.ts -> validateEditedFields()`, which uses Bedrock to verify the corrections. If successful, it triggers the `RISK_ANALYSIS` job.

## Key Files

*   **`gap-field.controller.ts`**: Exposes REST endpoints (`/api/assessments/:id/gap-fields`) for fetching, updating, submitting, and re-analyzing fields.
*   **`gap-detection.service.ts`**: Core business logic. Handles database interactions via Prisma and orchestrates the AI validation flow.
*   **`gap-detection.config.ts`**: Contains critical constants:
    *   `CORE_10_FIELDS`: The definitive list of the 10 required business plan fields.
    *   `FIELD_DESCRIPTIONS`: Detailed instructions used by the AI to understand what each field requires.
    *   `GAP_VALIDATION_CONFIG`: Bedrock model configuration (temperature, top_p) specifically tuned for the validation step.

## AI Validation Rules

*   Validation uses a low temperature (`0.1`) for strict, deterministic checking.
*   It only validates fields that have been explicitly edited by the user (`correctedValue !== null`).
*   If the AI determines a correction is insufficient, it returns a `validationFeedback` string, sets the field status back to `PARTIAL`, and throws a `BadRequestException` with the invalid fields.

## Dependencies

*   **Database**: `PrismaService` for `GapField` CRUD.
*   **AI**: `BedrockService` for validation.
*   **Jobs**: `JobsService` to enqueue `GAP_DETECTION` and `RISK_ANALYSIS` tasks.
