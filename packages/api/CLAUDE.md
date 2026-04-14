# CLAUDE.md — @alliance-risk/api

NestJS 10 backend (CommonJS, port 3001).

## Commands

```bash
pnpm dev              # nest start --watch
pnpm build            # nest build
pnpm test             # jest
pnpm test -- --testPathPattern=<pattern>
pnpm lint             # eslint "{src,test}/**/*.ts"
pnpm test:e2e         # jest --config ./test/jest-e2e.json
```

## Architecture

Screaming architecture in 4 explicit layers. Opening `src/` immediately tells you this is a risk analysis tool; AWS plumbing is buried in `infrastructure/`.

### Layer Responsibilities

| Layer | Path | Purpose |
|-------|------|---------|
| **Domain** | `src/domain/` | Core business logic — assessments, gap detection, risk analysis, reports |
| **Platform** | `src/platform/` | Auth, admin, prompt management, async job orchestration |
| **Infrastructure** | `src/infrastructure/` | AWS SDK wrappers (Bedrock, Textract, S3, RDS/Prisma) |
| **Common** | `src/common/` | Guards, decorators, exception filters, shared utilities |

### Import Path Conventions

| From | To | Pattern |
|------|----|---------|
| `domain/*` | infrastructure | `../../infrastructure/<module>/` |
| `domain/*` | platform | `../../platform/<module>/` |
| `domain/*` | common | `../../common/` |
| `platform/*` | infrastructure | `../../infrastructure/<module>/` |
| `platform/*` | common | `../../common/` |
| `platform/jobs/handlers/*` | infrastructure | `../../../infrastructure/<module>/` |
| `platform/jobs/handlers/*` | domain config | `../../../domain/<module>/` |
| `infrastructure/*` | common | `../../common/` |

## Structure

```
src/
  main.ts               # Local dev entry — NestFactory.create() on port 3001
  lambda.ts             # API Lambda handler (@codegenie/serverless-express)
  worker.ts             # Worker Lambda — NestFactory.createApplicationContext()
  configure-app.ts      # Shared bootstrap: ValidationPipe, CORS, /api prefix, filters
  app.module.ts         # Root module — wires all layers together
  app.controller.ts     # GET /api/health
  app.service.ts        # Returns { status: 'ok' }

  # ── Domain ────────────────────────────────────────────────────────────────
  domain/
    assessments/
      assessments.module.ts
      assessments.controller.ts   # 14 endpoints under /api/assessments
      │  POST   /                 # Create assessment
      │  GET    /                 # List assessments (paginated + filters)
      │  GET    /stats            # Counts by status
      │  GET    /:id              # Get one
      │  PUT    /:id              # Update metadata
      │  DELETE /:id              # Delete
      │  GET    /:id/documents    # List documents
      │  POST   /:id/documents    # Request upload URL (S3 presigned)
      │  POST   /:id/documents/:documentId/parse     # Trigger parse job
      │  POST   /:id/documents/parse-all             # Parse all pending docs
      │  DELETE /:id/documents/:documentId           # Remove document
      │  GET    /:id/merged-content                  # Merged extracted text
      │  POST   /:id/comments     # Add comment
      │  GET    /:id/comments     # List comments
      assessments.service.ts      # Business logic + Prisma + S3 + JobsService
      dto/                        # CreateAssessmentDto, UpdateAssessmentDto,
                                  # ListAssessmentsQueryDto, RequestUploadDto,
                                  # CreateAssessmentCommentDto

    gap-detection/
      gap-detection.module.ts     # Imports DatabaseModule, JobsModule, BedrockModule
      gap-field.controller.ts     # 4 endpoints under /api/assessments/:id/gap-fields
      │  GET    /                 # Get all gap fields for assessment
      │  PUT    /                 # Update gap field values (clears validationFeedback)
      │  POST   /submit           # Validate edited fields via Bedrock AI → trigger risk analysis
      │  POST   /re-analyze       # Re-run gap detection with user corrections
      gap-detection.service.ts    # Gap field CRUD + AI validation + job dispatch
      gap-detection.config.ts     # CORE_10_FIELDS definitions, FIELD_DESCRIPTIONS, GAP_VALIDATION_CONFIG
      dto/                        # UpdateGapFieldsDto

    risk-analysis/
      risk-analysis.module.ts
      risk-score.controller.ts    # 2 endpoints under /api/assessments/:id
      │  GET    /risk-scores      # Get all 7 risk category scores + recommendations
      │  PUT    /recommendations/:recId  # Update a recommendation
      risk-analysis.service.ts    # Risk score queries + recommendation updates
      dto/                        # UpdateRecommendationDto

    report/
      report.module.ts
      report.controller.ts        # 2 endpoints under /api/assessments/:id/report
      │  GET    /                 # Get structured report data
      │  POST   /pdf              # Generate PDF → upload to S3 → return URL
      report.service.ts           # Report assembly logic + job dispatch
      pdf.service.ts              # PDF generation (text-based, S3 upload)
      dto/                        # (barrel index)

  # ── Platform ──────────────────────────────────────────────────────────────
  platform/
    auth/
      auth.module.ts              # Provides + exports CognitoService
      auth.controller.ts          # 8 endpoints under /api/auth
      │  POST  /login
      │  POST  /refresh-token
      │  POST  /logout
      │  POST  /forgot-password
      │  POST  /reset-password
      │  POST  /complete-password-change
      │  POST  /change-password
      │  GET   /me
      cognito.service.ts          # AWS Cognito SDK wrapper (19 methods: auth + admin ops)
      dto/                        # LoginDto, RefreshTokenDto, ForgotPasswordDto,
                                  # ResetPasswordDto, ChangePasswordDto,
                                  # CompletePasswordChangeDto

    admin/
      admin.module.ts             # Imports AuthModule; all routes require AdminGuard
      users.controller.ts         # 9 endpoints under /api/admin/users
      │  GET    /                 # List users (paginated)
      │  POST   /                 # Create user
      │  GET    /:username
      │  PUT    /:username
      │  DELETE /:username
      │  POST   /:username/enable
      │  POST   /:username/disable
      │  POST   /:username/reset-password
      groups.controller.ts        # 3 endpoints under /api/admin
      │  GET    /groups
      │  POST   /users/:username/groups/:groupName
      │  DELETE /users/:username/groups/:groupName
      dto/                        # CreateUserDto, UpdateUserDto

    prompts/
      prompts.module.ts           # Provides all prompt services + exports them
      prompts.controller.ts       # 13 endpoints under /api/admin/prompts (AdminGuard)
      │  GET    /list             # List with filters
      │  POST   /create
      │  GET    /export           # Export all as JSON
      │  POST   /import           # Bulk import
      │  POST   /preview          # AI preview via job
      │  GET    /:id
      │  PUT    /:id/update
      │  DELETE /:id
      │  POST   /:id/toggle-active
      │  POST   /:id/comments
      │  GET    /:id/comments
      │  GET    /:id/history
      prompts-runtime.controller.ts  # 1 public endpoint
      │  GET   /api/prompts/section/:section  # Used by worker at runtime
      prompts.service.ts          # CRUD + versioning + conflict detection (Prisma tx)
      comments.service.ts         # Threaded comments with denormalized count
      change-history.service.ts   # Mutation tracking with diff computation
      variable-injection.service.ts  # Replaces {{category_N}} / {{categories}} tokens
      dto/                        # CreatePromptDto, UpdatePromptDto,
                                  # ListPromptsQueryDto, PromptPreviewDto, BulkImportDto

    jobs/
      jobs.module.ts
      jobs.controller.ts          # 1 endpoint: GET /api/jobs/:id (poll status)
      jobs.service.ts             # Job lifecycle: PENDING → PROCESSING → COMPLETED/FAILED
                                  # Creates DB record + invokes Worker Lambda async
      job-handler.interface.ts    # JobHandler interface { handle(payload): Promise<void> }
      handlers/
        ai-preview.handler.ts         # Bedrock converse → prompt preview result
        parse-document.handler.ts     # ExtractorFactory → text → stores in DB
        gap-detection.handler.ts      # Bedrock → gap analysis across CORE_10_FIELDS
        risk-analysis.handler.ts      # Prisma aggregation → 7 risk category scores
        report-generation.handler.ts  # Assembles report data → PDF → S3 upload

  # ── Infrastructure ────────────────────────────────────────────────────────
  infrastructure/
    bedrock/
      bedrock.module.ts
      bedrock.service.ts          # AWS Bedrock SDK: converse() + invokeModel()
                                  # Wrapped with CircuitBreaker + exponential retry

    textract/
      textract.module.ts
      textract.service.ts         # AWS Textract: startDocumentTextDetection + poll
      textract.types.ts           # TextractBlock, TextractResult types

    storage/
      storage.module.ts
      storage.service.ts          # AWS S3: upload, getPresignedUrl, delete, getObject

    database/
      database.module.ts          # Exports PrismaService globally
      prisma.service.ts           # PrismaClient with onModuleInit / onModuleDestroy

    extractors/
      extractors.module.ts        # Provides ExtractorFactory + both extractors
      extractor-factory.ts        # Picks extractor by MIME type (PDF → Textract, else → Converse)
      document-extractor.interface.ts  # DocumentExtractor { extract(key): ExtractionResult }
      textract.extractor.ts       # PDF extraction via TextractService
      programmatic.extractor.ts   # Word/Excel/CSV/HTML/TXT/MD extraction via mammoth, xlsx, turndown

  # ── Common ────────────────────────────────────────────────────────────────
  common/
    decorators/
      public.decorator.ts         # @Public() — bypasses JwtAuthGuard globally
      current-user.decorator.ts   # @CurrentUser() — extracts UserClaims from request
    guards/
      jwt-auth.guard.ts           # Global guard: verifies Cognito token → upserts user in DB
      admin.guard.ts              # Per-controller: checks isAdmin claim, throws 403
    exceptions/
      cognito.exception.ts        # Maps Cognito SDK errors → HTTP status codes
      application.exception.ts    # Base application exception
      bedrock-model.exception.ts
      knowledge-base.exception.ts
      risk-scoring.exception.ts
      index.ts                    # Barrel export
    filters/
      http-exception.filter.ts    # Global: all exceptions → { statusCode, error, message }
                                  # Forwards `invalidFields` from BadRequestException for validation errors
    utils/
      circuit-breaker.ts          # CircuitBreaker: CLOSED → OPEN → HALF_OPEN state machine
      retry.ts                    # withRetry(): exponential backoff with jitter

prisma/
  schema.prisma     # Models: User, Assessment, Document, GapField, RiskScore,
                    #         Recommendation, Report, Prompt, PromptVersion,
                    #         PromptComment, PromptChange, Job
  seed.ts           # Initial admin user + sample prompts
  migrations/       # Prisma migration SQL files
```

## Conventions

- **Module → Service → Controller** pattern for all features
- DTOs use `class-validator` decorators for all controller input
- Email normalization: `@Transform(({ value }) => value?.toLowerCase().trim())`
- Each Bedrock model config comes from `@alliance-risk/shared` `BEDROCK_MODELS` — never hardcode model IDs
- Tests required for all routing and scoring logic
- Test files use `.spec.ts` suffix, colocated with source
- All mutations in `PromptsService` wrapped in Prisma transactions
- Version snapshots created on every prompt update

## Guards

- `JwtAuthGuard` — registered globally via `APP_GUARD`; skips routes decorated with `@Public()`
- `AdminGuard` — applied per-controller with `@UseGuards(AdminGuard)`; checks `request.user.isAdmin`
- Dev/test mode: token verification is decode-only (no JWKS fetch)

## Async Job Flow

Long-running AI operations use a fire-and-forget pattern:

1. API Lambda creates a `Job` record (`PENDING`) and invokes Worker Lambda asynchronously
2. Worker Lambda picks up the job, runs the matching handler, updates status to `COMPLETED` or `FAILED`
3. Frontend polls `GET /api/jobs/:id` until terminal state

```
POST /api/assessments/:id/documents/:docId/parse
  └─ JobsService.createJob(PARSE_DOCUMENT)      → Job { status: PENDING }
  └─ Lambda.invoke(worker, { jobId }) async
       └─ ParseDocumentHandler.handle()         → Job { status: COMPLETED }
```

## Entry Points

| Entry | File | Purpose |
|-------|------|---------|
| Local dev | `main.ts` | `NestFactory.create()` on port 3001 |
| API Lambda | `lambda.ts` | Cached NestJS instance via `@codegenie/serverless-express` |
| Worker Lambda | `worker.ts` | `NestFactory.createApplicationContext()` for background jobs |

## Lambda Environment Variables

| Variable | Lambda | Purpose |
|----------|--------|---------|
| `DOCX_EXTRACTION_MODE` | API + Worker | Controls DOCX extraction rollback mode: `text` by default, `html` for legacy HTML plus Turndown fallback |
| `WORKER_ADMIN_TOKEN` | Worker only | Authenticates privileged worker actions such as `run-sql` and DOCX reprocessing |

## TypeScript

- Strict mode enabled
- `emitDecoratorMetadata` + `experimentalDecorators` required for NestJS DI
- CommonJS module system (`"module": "commonjs"`)

## Worker Lambda — `run-sql` Action (Authenticated)

The Worker Lambda includes a `run-sql` action for executing raw SQL on the private-VPC RDS instance (unreachable from local machines). **Requires `authToken` matching `WORKER_ADMIN_TOKEN` env var** (auto-generated in Secrets Manager: `alliance-risk/worker-admin-token`).

```bash
# Run migrations remotely (from project root) — fetches token automatically
pnpm migrate:remote
```

The script `scripts/migrate-remote.sh` fetches the admin token from Secrets Manager, then sends authenticated migration SQL to the Worker Lambda.

**Direct invocation (ad-hoc SQL):**
```bash
# First fetch the token
TOKEN=$(aws secretsmanager get-secret-value \
  --secret-id alliance-risk/worker-admin-token \
  --query 'SecretString' --output text | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")

aws lambda invoke --function-name alliance-risk-worker \
  --payload "{\"action\":\"run-sql\",\"authToken\":\"${TOKEN}\",\"sql\":\"SELECT count(*) FROM users\"}" \
  /tmp/result.json
```

## Lambda Best Practices

- **`context.callbackWaitsForEmptyEventLoop = false`** — Required in both `lambda.ts` and `worker.ts`. Without it, Prisma's connection pool keeps the event loop alive and the Lambda times out.
- **Prisma errors in esbuild bundles** — `PrismaClientKnownRequestError.message` is often empty after bundling. Always log `.code` and `.meta`:
  ```ts
  catch (error) {
    if (error && typeof error === 'object' && 'code' in error) {
      logger.error(`Prisma error code=${(error as any).code} meta=${JSON.stringify((error as any).meta)}`);
    }
  }
  ```

## Gap Field Validation Flow

When a user clicks "Analyze Risks", `POST /submit` triggers AI validation before risk analysis:

1. `triggerRiskAnalysis()` calls `validateEditedFields()` which queries only user-edited fields (`correctedValue IS NOT NULL`)
2. Sends edited fields to Bedrock (`GAP_VALIDATION_CONFIG` in `gap-detection.config.ts`) for substance validation
3. AI returns `{ results: [{ field, valid, feedback }] }` — invalid fields are set to `PARTIAL` status with `validationFeedback`
4. If any fields are invalid → throws `BadRequestException` with `invalidFields` array → frontend shows feedback
5. If all fields pass → proceeds to create `RISK_ANALYSIS` job
6. If Bedrock call fails → throws `BadRequestException` (fail-closed, does NOT silently allow submission)

Key config:
- Model ID comes from `BEDROCK_MODELS[AgentSection.GAP_DETECTOR]` — never hardcode
- Only `temperature` is set (0.1) — do NOT set both `temperature` and `top_p` (Bedrock rejects it)
- `validationFeedback` is cleared on every new field edit (`updateBatch()`)

## ESLint

- `@typescript-eslint/recommended` rules
- Config in `.eslintrc.js`
