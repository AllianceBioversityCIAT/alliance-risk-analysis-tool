# CLAUDE.md — @alliance-risk/shared

Zero-dependency TypeScript package. Exports enums, types, and constants consumed by both `@alliance-risk/api` (NestJS) and `@alliance-risk/web` (Next.js).

## Commands

```bash
pnpm build       # tsc — compiles src/ → dist/
pnpm typecheck   # tsc --noEmit — type-check without emitting
```

**Critical:** always rebuild after any change before the API or Web packages can pick it up:

```bash
pnpm --filter @alliance-risk/shared build
```

## Structure

```
src/
  index.ts              # Single barrel export — all public surface
  enums/                # TypeScript enums (string-valued)
    agent-section.enum.ts          # AgentSection — one value per AI pipeline stage
    assessment-status.enum.ts      # AssessmentStatus — DRAFT → ANALYZING → … → COMPLETE
    document-status.enum.ts        # DocumentStatus — upload lifecycle
    gap-field-status.enum.ts       # GapFieldStatus — MISSING | PARTIAL | VERIFIED
    intake-mode.enum.ts            # IntakeMode — UPLOAD | GUIDED_INTERVIEW | MANUAL_ENTRY
    recommendation-priority.enum.ts # RecommendationPriority — HIGH | MEDIUM | LOW
    risk-level.enum.ts             # RiskLevel — LOW | MODERATE | HIGH | CRITICAL
  types/                # TypeScript interfaces (never classes)
    api-response.types.ts    # ApiResponse<T>, PaginatedResponse<T>, ApiError
    assessment.types.ts      # AssessmentSummary, AssessmentDetail, AssessmentStats, MergedContentResponse
    auth.types.ts            # LoginResponse, UserInfo, CognitoUser
    document.types.ts        # DocumentInfo, UploadUrlResponse, ExtractionResult, ExtractedTable
    gap-field.types.ts       # GapFieldResponse, InvalidField, GapFieldValidationError
    job.types.ts             # JobStatus enum, JobType enum, JobResponse, JobSubmitResponse
    prompt.types.ts          # FewShotExample, PromptContext, PromptSummary, PromptDetail, …
    report.types.ts          # ReportResponse
    risk-score.types.ts      # SubcategoryScore, RiskScoreResponse, RecommendationResponse, …
  constants/            # Runtime values used by API and/or Web
    bedrock.config.ts        # BEDROCK_MODELS — canonical model registry keyed by AgentSection
    document.constants.ts    # Allowed MIME types, file extensions, size limits
    risk-categories.ts       # RISK_CATEGORIES — 7 categories with labels and subcategory counts
```

## What belongs in shared

Only add things here if **both** API and Web need them. Ask: "Does the frontend need this to render UI or validate input?" If yes → shared. If no → keep it in the package that owns it.

| Belongs here | Does NOT belong here |
|---|---|
| Enums mirrored in the DB schema | NestJS decorators / DI tokens |
| API response shapes (`ApiResponse<T>`) | Prisma-generated types (`@prisma/client`) |
| Bedrock model IDs and invocation params | Domain-only config (e.g. `core10Fields`) |
| Document upload constraints (size, MIME) | NestJS DTOs (`class-validator` decorators) |
| Risk category labels used in the UI | Handler-level implementation details |

## Conventions

### Enums
- File: `enums/<name>.enum.ts`
- Use string values (`PENDING = 'PENDING'`) — they survive JSON serialisation and Prisma without mapping
- Export from `index.ts` directly (not `export type`)

### Types
- File: `types/<domain>.types.ts`
- Pure interfaces only — no classes, no decorators, no runtime logic
- Use `export type` in `index.ts` so bundlers can tree-shake them

### Constants
- File: `constants/<name>.config.ts` or `constants/<name>.constants.ts`
- Must be serialisable (no functions, no class instances)
- Use `as const` on all arrays and object literals to get narrow literal types

### Barrel (index.ts)
Every new export **must** be added to `src/index.ts`. Nothing is auto-exported.

```ts
// Enums: plain export
export { MyEnum } from './enums/my.enum';

// Types: export type
export type { MyInterface } from './types/my.types';

// Constants: plain export (+ export type for derived types)
export { MY_CONSTANT } from './constants/my.constants';
export type { MyDerivedType } from './constants/my.constants';
```

## BEDROCK_MODELS

The canonical registry for all Bedrock invocation config, keyed by `AgentSection`.

```ts
// packages/shared/src/constants/bedrock.config.ts
export const BEDROCK_MODELS: Record<AgentSection, {
  modelId: string;
  knowledgeBaseId?: string;
  maxTokens?: number;
  temperature?: number;
}> = { ... };
```

**Rules:**
- **Never hardcode model IDs anywhere else** — always read `BEDROCK_MODELS[section].modelId`
- `maxTokens` and `temperature` are optional; add them only for sections that deviate from Bedrock defaults or need documented reasoning
- **Do NOT set both `temperature` and `top_p`** for the same model — Bedrock rejects it for Anthropic models. Use one or the other.
- Other invocation params that are the same for all sections (e.g. `top_p`) stay in `BedrockService`, not here
- When a new `AgentSection` value is added to the enum, add a matching entry to `BEDROCK_MODELS` — the `Record<AgentSection, …>` type enforces exhaustiveness at compile time

## Adding a new AgentSection

1. Add the value to `enums/agent-section.enum.ts`
2. Add a matching entry (at minimum `{ modelId: '…' }`) to `BEDROCK_MODELS` in `constants/bedrock.config.ts`
3. Run `pnpm build` — TypeScript will error if step 2 is missing (exhaustive Record)
4. Add a corresponding `JobType` value to `types/job.types.ts` if the section maps to an async job

## Adding a new type or constant

1. Create or update the file in `src/types/` or `src/constants/`
2. Add the export to `src/index.ts`
3. Run `pnpm build`
4. In the consuming package, import from `@alliance-risk/shared` (never from a relative path into this package)

## TypeScript

- Strict mode enabled (`"strict": true`)
- ESNext target, CommonJS modules (matches API's CommonJS requirement)
- No external dependencies — `devDependencies` only has `typescript`
- `dist/` is gitignored; consumers rely on a local build via the pnpm workspace symlink
