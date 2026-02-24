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

## Structure

```
src/
  main.ts                      # Entry point (port 3001)
  lambda.ts                    # API Lambda handler (@codegenie/serverless-express)
  worker.ts                    # Worker Lambda entry point (NestFactory.createApplicationContext)
  configure-app.ts             # Shared app config (ValidationPipe, CORS, prefix, filters)
  app.module.ts                # Root module
  app.controller.ts            # Health endpoint

  auth/
    auth.module.ts             # Provides + exports CognitoService
    auth.controller.ts         # 8 auth endpoints (login, refresh, logout, forgot/reset/change password, me)
    cognito.service.ts         # AWS Cognito SDK wrapper (19 methods: auth + admin)
    dto/                       # LoginDto, RefreshTokenDto, ChangePasswordDto, etc.

  admin/
    admin.module.ts            # Imports AuthModule
    users.controller.ts        # 8 user CRUD endpoints (AdminGuard)
    groups.controller.ts       # 3 group management endpoints (AdminGuard)
    dto/                       # CreateUserDto, UpdateUserDto

  prompts/
    prompts.module.ts          # Provides all prompt services
    prompts.controller.ts      # 10 admin prompt endpoints (AdminGuard)
    prompts-runtime.controller.ts  # 1 public endpoint: GET /api/prompts/section/:section
    prompts.service.ts         # CRUD + versioning + conflict detection
    comments.service.ts        # Threaded comments with denormalized count
    change-history.service.ts  # Mutation tracking with diff computation
    variable-injection.service.ts  # {{category_N}} and {{categories}} replacement
    dto/                       # CreatePromptDto, UpdatePromptDto, ListPromptsQueryDto, etc.

  jobs/
    jobs.module.ts
    jobs.controller.ts         # GET /api/jobs/:id (poll status)
    jobs.service.ts            # Create, process, status lifecycle (PENDING→PROCESSING→COMPLETED/FAILED)
    job-handler.interface.ts   # JobHandler interface for handler implementations
    handlers/
      ai-preview.handler.ts   # Calls BedrockService for prompt preview

  bedrock/
    bedrock.module.ts
    bedrock.service.ts         # AWS Bedrock SDK wrapper with CircuitBreaker + retry

  database/
    database.module.ts
    prisma.service.ts          # PrismaClient lifecycle (onModuleInit/onModuleDestroy)

  common/
    decorators/
      public.decorator.ts     # @Public() — bypasses JwtAuthGuard
      current-user.decorator.ts  # @CurrentUser() — extracts user from request
    guards/
      jwt-auth.guard.ts       # Global guard, Cognito token verification
      admin.guard.ts           # Checks isAdmin, throws 403
    exceptions/
      cognito.exception.ts    # Maps Cognito SDK errors to HTTP status codes
      application.exception.ts
      bedrock-model.exception.ts
      knowledge-base.exception.ts
      risk-scoring.exception.ts
      index.ts                 # Barrel export
    filters/
      http-exception.filter.ts  # Global exception → ApiError response
    utils/
      circuit-breaker.ts       # Circuit breaker for external service calls
      retry.ts                 # Retry with exponential backoff

prisma/
  schema.prisma              # Models: User, Prompt, PromptVersion, PromptComment, PromptChange, Job
  seed.ts                    # Initial admin user + sample prompts
  migrations/                # Prisma migrations
```

## Conventions

- **Module → Service → Controller** pattern for all features
- DTOs with `class-validator` decorators for all controller input
- Email normalization: `@Transform(({ value }) => value?.toLowerCase().trim())`
- Each Bedrock model config comes from `@alliance-risk/shared` `BEDROCK_MODELS`
- Tests required for all routing and scoring logic
- Test files use `.spec.ts` suffix, colocated with source in `src/`
- All mutations in PromptsService wrapped in Prisma transactions
- Version snapshots created on every prompt update

## Guards

- `JwtAuthGuard` — registered globally via `APP_GUARD`, skips `@Public()` routes
- `AdminGuard` — applied per-controller with `@UseGuards(AdminGuard)`
- Dev/test mode: token verification is decode-only (no JWKS)

## Entry Points

| Entry | File | Purpose |
|-------|------|---------|
| Local dev | `main.ts` | `NestFactory.create()` on port 3001 |
| API Lambda | `lambda.ts` | Cached NestJS instance via `@codegenie/serverless-express` |
| Worker Lambda | `worker.ts` | `NestFactory.createApplicationContext()` for background jobs |

## TypeScript

- Strict mode enabled
- `emitDecoratorMetadata` + `experimentalDecorators` required for NestJS DI
- CommonJS module system (`"module": "commonjs"`)

## ESLint

- `@typescript-eslint/recommended` rules
- Config in `.eslintrc.js`
