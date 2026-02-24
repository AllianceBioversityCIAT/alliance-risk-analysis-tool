# Alliance Risk Analysis Tool — Architecture Overview

> **Audience:** New engineers onboarding to the project.  
> **Last updated:** 2026-02-24  
> **Maintainer:** Senior Software Architect

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Repository Layout](#2-repository-layout)
3. [Backend — NestJS API](#3-backend--nestjs-api)
4. [Async Job Pipeline](#4-async-job-pipeline)
5. [Frontend — Next.js](#5-frontend--nextjs)
6. [AWS Infrastructure](#6-aws-infrastructure)
7. [Cross-Cutting Concerns](#7-cross-cutting-concerns)

---

## 1. System Overview

The **Alliance Risk Analysis Tool** is a multi-agent AI pipeline that helps CGIAR analysts assess agricultural risks across seven risk categories. Analysts upload documents; the system parses them, detects coverage gaps, scores risks, and generates structured reports — all powered by AWS Bedrock (Claude 3.5 Sonnet).

The current codebase is an **MVP** covering the admin surface (user management, prompt management) and the async job infrastructure that will drive the AI pipeline. The AI analysis pipeline job types are schema-ready but not yet fully implemented beyond the `AI_PREVIEW` handler.

### Full-Stack Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│  Browser (Next.js static SPA)                                       │
│  ┌─────────────┐   ┌──────────────┐   ┌───────────────────────────┐│
│  │ Auth pages  │   │ Dashboard /  │   │ Admin (users, prompts)    ││
│  │ /login      │   │ (protected)  │   │ (admin guard)             ││
│  └──────┬──────┘   └──────┬───────┘   └─────────────┬─────────────┘│
└─────────┼────────────────┼──────────────────────────┼──────────────┘
          │  HTTPS          │  HTTPS + Bearer token    │
          ▼                 ▼                          ▼
┌─────────────────────────────────────────────────────────────────────┐
│  AWS CloudFront (CDN)                                               │
│  ┌──────────────────────┐   ┌───────────────────────────────────┐  │
│  │  S3 — Web Bucket     │   │  API Gateway HTTP API (v2)        │  │
│  │  (static HTML/JS)    │   │  /api/* → API Lambda              │  │
│  └──────────────────────┘   └──────────────┬────────────────────┘  │
└──────────────────────────────────────────── │ ──────────────────────┘
                                              │
                              ┌───────────────▼─────────────────────┐
                              │  API Lambda (NestJS)                 │
                              │  ┌──────────┐  ┌──────────────────┐ │
                              │  │ AuthCtrl │  │ AdminCtrl        │ │
                              │  │ /auth/*  │  │ /admin/users/*   │ │
                              │  └────┬─────┘  │ /admin/groups/*  │ │
                              │       │        │ /admin/prompts/* │ │
                              │  ┌────▼─────┐  └────────┬─────────┘ │
                              │  │ Cognito  │           │           │
                              │  │ Service  │  ┌────────▼─────────┐ │
                              │  └──────────┘  │ PromptsService   │ │
                              │                │ JobsService      │ │
                              │                └────────┬─────────┘ │
                              │  ┌─────────────────────┐│           │
                              │  │ PrismaService       ││           │
                              │  │ (PostgreSQL RDS)    ◄┘           │
                              │  └─────────────────────┘            │
                              │                │                     │
                              │  Invoke async  │ (production only)   │
                              └────────────────┼─────────────────────┘
                                               │
                              ┌────────────────▼─────────────────────┐
                              │  Worker Lambda (NestJS context)       │
                              │  ┌────────────────────────────────┐  │
                              │  │ JobsService.processJob(jobId)  │  │
                              │  │  └── AiPreviewHandler          │  │
                              │  │        └── BedrockService      │  │
                              │  └────────────────────────────────┘  │
                              └───────────────────────────────────────┘
                                               │
                    ┌──────────────────────────┼──────────────────────┐
                    ▼                          ▼                      ▼
          ┌──────────────────┐    ┌────────────────────┐   ┌────────────────┐
          │ AWS Cognito      │    │ AWS Bedrock         │   │ AWS RDS        │
          │ User Pool        │    │ Claude 3.5 Sonnet   │   │ PostgreSQL 15  │
          │ (auth + users)   │    │ (AI inference)      │   │ (app data)     │
          └──────────────────┘    └────────────────────┘   └────────────────┘
```

### Seven Risk Categories

The domain model is built around these categories (from `@alliance-risk/shared`):

| # | Key | Label |
|---|-----|-------|
| 1 | `behavioral` | Behavioral Risk |
| 2 | `operational` | Operational Risk |
| 3 | `financial` | Financial Risk |
| 4 | `market` | Market Risk |
| 5 | `climate_environmental` | Climate-Environmental Risk |
| 6 | `governance_legal` | Governance & Legal Risk |
| 7 | `technology_data` | Technology & Data Risk |

---

## 2. Repository Layout

The project is a **pnpm monorepo** with four packages:

```
alliance-risk-analysis-tool/
├── packages/
│   ├── api/          # @alliance-risk/api    — NestJS 10 backend (port 3001)
│   ├── web/          # @alliance-risk/web    — Next.js 15 frontend (port 3000)
│   └── shared/       # @alliance-risk/shared — Shared types, enums, constants
├── infra/            # @alliance-risk/infra  — AWS CDK v2 infrastructure
├── docs/             # Architecture, specs, plans
└── pnpm-workspace.yaml
```

### Build Order

`shared` must be built before `api` or `web` can import from it:

```
1. pnpm --filter @alliance-risk/shared build   # compiles to packages/shared/dist/
2. pnpm --filter @alliance-risk/api build      # compiles to packages/api/dist/
3. pnpm --filter @alliance-risk/web build      # static export to packages/web/.next/
```

### Common Commands

```bash
pnpm dev              # Run API (:3001) + Web (:3000) concurrently
pnpm build            # Build all packages in order
pnpm test             # Run all test suites
pnpm lint             # Lint all packages

# Target a single package
pnpm --filter @alliance-risk/api  <script>
pnpm --filter @alliance-risk/web  <script>
pnpm --filter @alliance-risk/shared <script>
```

### `@alliance-risk/shared` — The Contract Layer

This package is the **single source of truth** for types that cross the API/Web boundary. Neither package should duplicate these definitions.

| Export | File | Contents |
|--------|------|----------|
| Enums | `enums/agent-section.enum.ts` | `AgentSection`, `AGENT_SECTION_LABELS` |
| Auth types | `types/auth.types.ts` | `LoginResponse`, `UserInfo`, `CognitoUser` |
| Prompt types | `types/prompt.types.ts` | `PromptSummary`, `PromptDetail`, `PromptPreviewRequest`, `PromptPreviewResponse` |
| Job types | `types/job.types.ts` | `JobStatus`, `JobType`, `JobResponse`, `JobSubmitResponse` |
| API types | `types/api-response.types.ts` | `ApiResponse<T>`, `PaginatedResponse<T>`, `ApiError` |
| Bedrock config | `constants/bedrock.config.ts` | `BEDROCK_MODELS` — maps each `AgentSection` to a model ID |
| Risk categories | `constants/risk-categories.ts` | `RISK_CATEGORIES`, `RiskCategoryKey` |

---

## 3. Backend — NestJS API

### 3.1 Entry Points

There are three distinct entry points — all sharing the same NestJS application via `configure-app.ts`:

| File | Used when | Description |
|------|-----------|-------------|
| `src/main.ts` | Local development | `NestFactory.create()` on port 3001 |
| `src/lambda.ts` | API Lambda (production) | Wraps NestJS in `@codegenie/serverless-express`; instance cached between warm invocations |
| `src/worker.ts` | Worker Lambda (production) | `NestFactory.createApplicationContext()` — no HTTP server, just DI container for job processing |

### 3.2 Global Application Config (`configure-app.ts`)

Applied to all three entry points:

- **Prefix:** all routes under `/api`
- **CORS:** origin from `CORS_ORIGIN` env var
- **ValidationPipe:** `whitelist: true`, `transform: true`, `forbidNonWhitelisted: true` — strips unknown fields and auto-transforms query param types
- **HttpExceptionFilter:** global exception → standardized JSON error body

### 3.3 Module Graph

```
AppModule
  ├── ConfigModule (global, loads .env)
  ├── DatabaseModule (global)
  │     └── PrismaService ──► PostgreSQL RDS
  ├── AuthModule
  │     └── CognitoService (exported — used by AdminModule)
  ├── AdminModule
  │     ├── imports AuthModule
  │     ├── UsersController
  │     └── GroupsController
  ├── PromptsModule
  │     ├── imports DatabaseModule, JobsModule
  │     ├── PromptsController (admin)
  │     ├── PromptsRuntimeController (public)
  │     ├── PromptsService
  │     ├── CommentsService
  │     ├── ChangeHistoryService
  │     └── VariableInjectionService
  └── JobsModule
        ├── imports DatabaseModule, BedrockModule
        ├── JobsController
        ├── JobsService
        └── AiPreviewHandler
              └── BedrockModule
                    └── BedrockService ──► AWS Bedrock
```

### 3.4 Guards

Guards run on every request in this order:

```
Incoming request
      │
      ▼
JwtAuthGuard (global, APP_GUARD)
  ├── @Public() route? ──► skip, pass through
  ├── Extract Bearer token from Authorization header
  ├── PRODUCTION: verify signature via Cognito JWKS
  ├── DEVELOPMENT: decode only (no JWKS — enables local dev with fake tokens)
  ├── Upsert user in DB users table (cognitoId → internal UUID)
  └── Set request.user = UserClaims { userId (DB UUID), cognitoId, email, username, isAdmin }
      │
      ▼
AdminGuard (per-controller, @UseGuards)
  ├── request.user.isAdmin === true? ──► pass through
  └── throw 403 ForbiddenException
```

**Key design decision:** `JwtAuthGuard` upserts the user into the `users` table on every request. This ensures that `createdById` / `updatedById` foreign keys in Prisma models always resolve, even for users created in Cognito but not yet in the DB.

### 3.5 API Endpoints

#### Health Check

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api` | Public | Returns `{ status: 'ok' }` |

#### Auth (`/api/auth`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/auth/login` | Public | Email + password login. Returns tokens or `requiresPasswordChange: true` with a Cognito session token. |
| `POST` | `/api/auth/refresh-token` | Public | Exchange a refresh token for a new access token. |
| `POST` | `/api/auth/logout` | Public | Stateless — clears tokens client-side only. Returns 200. |
| `POST` | `/api/auth/forgot-password` | Public | Triggers Cognito to send a verification code to the user's email. |
| `POST` | `/api/auth/reset-password` | Public | Completes the forgot-password flow using the verification code. |
| `POST` | `/api/auth/complete-password-change` | Public | Responds to `NEW_PASSWORD_REQUIRED` Cognito challenge on first login. |
| `POST` | `/api/auth/change-password` | JWT | Authenticated user changes their own password. |
| `GET` | `/api/auth/me` | JWT | Returns the current user's profile. In dev mode falls back to JWT claims if Cognito `GetUser` fails. |

#### Admin — Users (`/api/admin/users`) — AdminGuard

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/admin/users` | Paginated Cognito user list. Query: `?limit=` (max 60 — Cognito hard limit), `?nextToken=` (cursor for next page). |
| `POST` | `/api/admin/users` | Create a Cognito user with a temporary password. |
| `GET` | `/api/admin/users/:username` | Get a single Cognito user with their group memberships. |
| `PUT` | `/api/admin/users/:username` | Update Cognito user attributes. |
| `DELETE` | `/api/admin/users/:username` | Permanently delete a user from Cognito. |
| `POST` | `/api/admin/users/:username/enable` | Re-enable a disabled user. |
| `POST` | `/api/admin/users/:username/disable` | Disable an active user (blocks login). |
| `POST` | `/api/admin/users/:username/reset-password` | Set a temporary password; forces change on next login. |

#### Admin — Groups (`/api/admin`) — AdminGuard

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/admin/groups` | List all Cognito groups. |
| `POST` | `/api/admin/users/:username/groups/:groupName` | Add a user to a Cognito group. |
| `DELETE` | `/api/admin/users/:username/groups/:groupName` | Remove a user from a Cognito group. |

#### Admin — Prompts (`/api/admin/prompts`) — AdminGuard

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/admin/prompts/list` | Paginated prompt list. Filters: `section`, `route`, `tag`, `search`, `isActive`, `page`, `limit`. |
| `POST` | `/api/admin/prompts/create` | Create a new prompt. Snapshots to `PromptChange`. |
| `POST` | `/api/admin/prompts/preview` | **Async.** Creates a Job record, invokes Worker Lambda. Returns `{ jobId }` immediately (202). Client must poll `/api/jobs/:id`. |
| `GET` | `/api/admin/prompts/:id` | Get a prompt. Optional `?version=N` to retrieve a historical snapshot. |
| `PUT` | `/api/admin/prompts/:id/update` | Update a prompt. Snapshots current version to `PromptVersion`, increments version number, records diff in `PromptChange`. |
| `DELETE` | `/api/admin/prompts/:id` | Delete entire prompt (cascade) or a specific `?version=N` snapshot. |
| `POST` | `/api/admin/prompts/:id/toggle-active` | Toggle `isActive`. Checks for section/route conflicts before activating. |
| `POST` | `/api/admin/prompts/:id/comments` | Add a threaded comment. Increments denormalized `commentsCount`. |
| `GET` | `/api/admin/prompts/:id/comments` | Retrieve threaded comments (top-level + nested replies). |
| `GET` | `/api/admin/prompts/:id/history` | Retrieve the full change audit trail, newest first. |

#### Public — Prompt Runtime (`/api/prompts`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/prompts/section/:section` | Public | Returns the single active prompt for an `AgentSection`. Optional `?categories=a,b,c` triggers `{{category_N}}` / `{{categories}}` variable injection. Used by AI agents at runtime. |

#### Jobs (`/api/jobs`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/jobs/:id` | JWT | Poll job status. Returns `{ id, type, status, result, error, ... }`. Ownership enforced: only the creator can read their jobs. |

### 3.6 Services

| Service | Responsibility |
|---------|---------------|
| `CognitoService` | Full AWS Cognito SDK wrapper — 19 methods covering auth flows, user CRUD, group management, and JWKS token verification. Branches on `ENVIRONMENT` for dev vs production. |
| `PromptsService` | Prompt CRUD with optimistic conflict detection, versioning, and diff computation. All mutations run inside Prisma transactions. |
| `CommentsService` | Threaded comment creation and retrieval. Maintains the denormalized `commentsCount` column on `Prompt` via `$transaction`. |
| `ChangeHistoryService` | Records every prompt mutation as a `PromptChange` entry. Exposes `computeDiff()` to produce field-level `{ old, new }` diffs. |
| `VariableInjectionService` | Replaces `{{category_N}}` (1-indexed) and `{{categories}}` (comma-joined) placeholders in prompt text before passing to Bedrock. |
| `JobsService` | Creates `Job` records, routes to the correct handler, manages the `PENDING → PROCESSING → COMPLETED / FAILED` lifecycle. In production, invokes Worker Lambda asynchronously. In development, runs the handler in-process. |
| `BedrockService` | Wraps `InvokeModelCommand` for the Anthropic Messages API format. Applies a circuit breaker (3 failures → 60s open) and exponential backoff retry (3 attempts, throttling only). |
| `PrismaService` | Extends `PrismaClient`; uses `@prisma/adapter-pg` connection pool; enables SSL for RDS endpoints. Managed lifecycle via `onModuleInit` / `onModuleDestroy`. |

### 3.7 Database Schema

The database is **PostgreSQL 15** managed by Prisma. The schema lives at `packages/api/prisma/schema.prisma`.

> **Note:** `User` in this DB is a lightweight FK reference table only — primary user data (email, status, groups) lives in **Cognito**. The DB `User` is auto-upserted by `JwtAuthGuard` on every authenticated request.

```
┌──────────────────────────────────────────────────────────┐
│ users                                                     │
│  id          UUID PK                                      │
│  cognitoId   STRING UNIQUE  ◄── Cognito sub claim        │
│  email       STRING UNIQUE                                │
│  createdAt   DATETIME                                     │
│  updatedAt   DATETIME                                     │
└──────┬───────────────────────────────────────────────────┘
       │ 1                                          1
       │ createdBy / updatedBy / authorId / authorId
       ▼ *
┌──────────────────────────────────────────────────────────┐
│ prompts                                                   │
│  id                UUID PK                               │
│  name              VARCHAR(200)                          │
│  section           AgentSection ENUM                     │
│  subSection        VARCHAR(100)?                         │
│  route             STRING?                               │
│  categories        STRING[]                              │
│  tags              STRING[]                              │
│  version           INT (increments on every update)      │
│  isActive          BOOLEAN                               │
│  systemPrompt      TEXT                                  │
│  userPromptTemplate TEXT                                 │
│  tone              VARCHAR(500)?                         │
│  outputFormat      VARCHAR(5000)?                        │
│  fewShot           JSON?  (FewShotExample[])             │
│  context           JSON?  (PromptContext)                │
│  commentsCount     INT (denormalized)                    │
│  createdById       FK → users.id                        │
│  updatedById       FK → users.id                        │
│  createdAt / updatedAt DATETIME                          │
└──────┬───────────────────────────────────────────────────┘
       │ 1
       ├──────────────────────────────┐
       │ *                            │ *
┌──────▼──────────────────┐  ┌───────▼──────────────────┐
│ prompt_versions          │  │ prompt_comments           │
│  id         UUID PK      │  │  id         UUID PK       │
│  promptId   FK (cascade) │  │  promptId   FK (cascade)  │
│  version    INT          │  │  parentId   FK (self-ref) │
│  [all prompt fields]     │  │  content    VARCHAR(1000) │
│  UNIQUE(promptId,version)│  │  authorId   FK → users.id │
└─────────────────────────┘  └──────────────────────────┘
       │ *
┌──────▼──────────────────────────────────────────────────┐
│ prompt_changes                                           │
│  id          UUID PK                                    │
│  promptId    FK (cascade)                               │
│  version     INT                                        │
│  changeType  PromptChangeType ENUM                      │
│              (CREATE/UPDATE/DELETE/ACTIVATE/DEACTIVATE) │
│  changes     JSON  { field: { old, new } }              │
│  comment     VARCHAR(500)?                              │
│  authorId    FK → users.id                             │
│  createdAt   DATETIME (indexed DESC)                    │
└─────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│ jobs                                                     │
│  id           UUID PK                                   │
│  type         JobType ENUM                              │
│               (AI_PREVIEW / PARSE_DOCUMENT /            │
│                GAP_DETECTION / RISK_ANALYSIS /          │
│                REPORT_GENERATION)                        │
│  status       JobStatus ENUM                            │
│               (PENDING / PROCESSING / COMPLETED / FAILED)│
│  input        JSON  (serialized request payload)        │
│  result       JSON?  (worker output on success)         │
│  error        STRING?  (message on failure)             │
│  attempts     INT  (incremented per processing attempt) │
│  maxAttempts  INT  (default 3)                          │
│  createdById  FK → users.id                            │
│  createdAt / startedAt / completedAt / updatedAt        │
└─────────────────────────────────────────────────────────┘
```

**DB Enums:** `AgentSection`, `JobStatus`, `JobType`, `PromptChangeType`

**Key indexes:**
- `prompts(section, isActive)` — fast lookup for the runtime endpoint
- `prompts(section, route, subSection, isActive)` — conflict detection on toggle-active
- `prompt_changes(createdAt DESC)` — change history ordered by most recent
- `jobs(status, createdAt)` — job queue queries

---

## 4. Async Job Pipeline

Long-running AI operations use a **fire-and-forget** pattern so the API Lambda never times out waiting on Bedrock.

### Lifecycle Diagram

```
Browser                  API Lambda              Worker Lambda          Bedrock
  │                          │                        │                   │
  │ POST /api/admin/          │                        │                   │
  │ prompts/preview ─────────►│                        │                   │
  │                          │ 1. Insert Job(PENDING)  │                   │
  │                          │    in PostgreSQL        │                   │
  │                          │ 2. InvokeFunction       │                   │
  │                          │    (Event, async) ──────►                   │
  │◄── 202 { jobId } ────────│                        │                   │
  │                          │                        │ 3. processJob(id) │
  │                          │                        │    set PROCESSING  │
  │ GET /api/jobs/:id ───────►│                        │                   │
  │◄── { status: PROCESSING } │                        │ 4. InvokeModel ──►│
  │                          │                        │◄── response ───────│
  │ GET /api/jobs/:id ───────►│                        │                   │
  │◄── { status: PROCESSING } │                        │ 5. set COMPLETED  │
  │                          │                        │    store result    │
  │ GET /api/jobs/:id ───────►│                        │                   │
  │◄── { status: COMPLETED,  │                        │                   │
  │      result: { ... } }    │                        │                   │
```

### Retry and Failure Handling

```
processJob(jobId)
  ├── Set status = PROCESSING, increment attempts
  ├── Route by job.type to registered handler
  ├── SUCCESS → status = COMPLETED, store result JSON
  └── FAILURE
        ├── attempts < maxAttempts (default 3)?
        │     └── Reset status = PENDING  (Worker Lambda will pick it up again
        │          on next invocation or on next scheduled retry)
        └── attempts >= maxAttempts
              └── status = FAILED, store error message
```

### Resilience Layers (BedrockService)

```
JobsService calls AiPreviewHandler.execute()
  └── AiPreviewHandler calls BedrockService.invoke()
        └── CircuitBreaker (wraps BedrockService)
              ├── CLOSED  — normal operation
              ├── OPEN    — 3 consecutive failures → reject immediately for 60s
              └── HALF_OPEN — after 60s, allow 1 probe; 2 successes → CLOSED
                    └── withRetry (wraps InvokeModelCommand)
                          ├── Max 3 attempts
                          ├── Retry on: ThrottlingException, ServiceUnavailableException
                          └── Backoff: 200ms base, exponential, 5s cap, ±25% jitter
```

### Development vs Production Mode

| Concern | Development (`ENVIRONMENT=development`) | Production (`ENVIRONMENT=production`) |
|---------|----------------------------------------|---------------------------------------|
| Token verification | Decode only (no JWKS) | Full JWKS signature verification |
| Job execution | `executeLocally()` — runs handler in same process, non-blocking | `InvokeFunction(Event)` → Worker Lambda |
| Cognito `GetUser` | Falls back to JWT claims on error | Real Cognito call |

---

## 5. Frontend — Next.js

The frontend is a **static export** (`output: 'export'`) hosted on S3 + CloudFront. There is no server-side rendering — all pages are client-side React.

### 5.1 Provider Hierarchy

Every page is wrapped in this provider tree (defined in `app/layout.tsx`):

```
QueryClientProvider  (React Query — staleTime: 5min, retry: 1)
  └── AuthProvider   (AuthContext — user, isAuthenticated, isAdmin, isLoading, login, logout)
        └── {page children}
              └── Toaster  (sonner toast notifications)
```

### 5.2 Route Groups and Guards

Next.js App Router uses layout files as client-side guards. There is no middleware — guards are pure React `useEffect` redirects.

```
app/
  layout.tsx                     ← Root layout (providers)
  page.tsx                       ← / → redirect to /login

  (auth)/                        ← Public: redirect to /dashboard if already authenticated
    login/page.tsx
    forgot-password/page.tsx
    change-password/page.tsx

  (protected)/                   ← ProtectedRoute guard
    layout.tsx                   ← if !isAuthenticated → /login
    dashboard/page.tsx

  (admin)/                       ← AdminRoute guard
    layout.tsx                   ← if !isAuthenticated → /login; if !isAdmin → /
    admin/
      users/page.tsx
      prompt-manager/
        page.tsx
        create/page.tsx
        edit/[id]/page.tsx
```

### 5.3 Authentication Flow

```
1. APP BOOT (AuthProvider useEffect on mount)
   ├── tokenManager.isAuthenticated()?
   │     ├── Yes → GET /api/auth/me → setUser(cognitoUserToUserInfo(response))
   │     └── No  → setIsLoading(false)
   └── setIsLoading(false)

2. LOGIN (LoginForm → AuthProvider.login())
   ├── POST /api/auth/login { email, password }
   ├── Response: requiresPasswordChange=true?
   │     └── Navigate to /change-password?session=...&username=...
   └── Response: tokens received
         ├── tokenManager.setTokens({ accessToken, refreshToken }, rememberMe)
         │     ├── rememberMe=true  → localStorage
         │     └── rememberMe=false → sessionStorage
         ├── GET /api/auth/me → setUser(...)
         └── Navigate to /dashboard  (user is now set → ProtectedLayout passes)

3. EVERY API REQUEST (api-client.ts Axios interceptors)
   ├── Request interceptor
   │     └── Inject: Authorization: Bearer <tokenManager.getAccessToken()>
   │           (checks localStorage first, then sessionStorage)
   └── Response interceptor — on 401 (and no prior retry flag)
         ├── GET refresh token from tokenManager
         ├── POST /api/auth/refresh-token { refreshToken }
         ├── Success → store new tokens, retry original request
         └── Failure → clearTokens(), router.push('/login')

4. LOGOUT (AuthProvider.logout())
   ├── tokenManager.clearTokens()  (clears both storages)
   ├── setUser(null)
   └── router.push('/login')

5. CROSS-TAB SYNC (AuthProvider window 'storage' event listener)
   └── access_token removed from localStorage → setUser(null), push /login
```

### 5.4 Components

#### shadcn/ui Primitives (`components/ui/`)
15 components: `badge`, `button`, `card`, `dialog`, `form`, `input`, `label`, `select`, `separator`, `skeleton`, `sonner`, `switch`, `table`, `tabs`, `textarea`

#### Auth (`components/auth/`)

| Component | Description |
|-----------|-------------|
| `login-form.tsx` | Email + password + "remember me". Delegates to `AuthProvider.login()`. Handles `requiresPasswordChange` redirect. |
| `forgot-password-form.tsx` | Two-step: (1) enter email → `POST /api/auth/forgot-password`; (2) enter code + new password → `POST /api/auth/reset-password`. |
| `change-password-form.tsx` | New password with strength validation. Uses Cognito session from URL params → `POST /api/auth/complete-password-change`. |

#### Admin — Users (`components/admin/`)

| Component | Description |
|-----------|-------------|
| `user-management.tsx` | Filterable user table with server-side cursor pagination (Cognito `nextToken`). Hosts create/edit/delete modals. |
| `create-user-modal.tsx` | Dialog for creating a new user (`useCreateUser` mutation). |
| `edit-user-modal.tsx` | Dialog for editing attributes, managing group membership (add/remove), and resetting password. |

#### Admin — Prompts (`components/prompts/`)

| Component | Description |
|-----------|-------------|
| `prompt-list.tsx` | Grid of `PromptCard` items integrated with `PromptFilters`. Paginated via `usePrompts`. |
| `prompt-card.tsx` | Summary card: name, section, version badge, `isActive` badge, comment count. |
| `prompt-filters.tsx` | Filter bar: section (enum select), tag, search text, route, `isActive` toggle. |
| `prompt-editor-form.tsx` | Full prompt editor (React Hook Form). All fields from `CreatePromptDto` / `UpdatePromptDto`. Embeds preview panel. |
| `prompt-preview-panel.tsx` | Submits to `POST /api/admin/prompts/preview`, then polls `GET /api/jobs/:id` every 3s via `useJobPolling`. Renders AI output when complete. |
| `comment-section.tsx` | Threaded comments: top-level + nested replies. Add-comment form. |
| `change-history.tsx` | Timeline of `PromptChange` records with field-level diff visualization. |

### 5.5 React Query Hooks

All API access goes through React Query hooks in `src/hooks/`. **Never call `apiClient` directly from a component.**

| Hook | Method + Path | Cache Key |
|------|--------------|-----------|
| `usePrompts(filters, page, limit)` | `GET /api/admin/prompts/list` | `['prompts', filters, page, limit]` |
| `usePrompt(id, version?)` | `GET /api/admin/prompts/:id` | `['prompt', id, version]` |
| `useCreatePrompt()` | `POST /api/admin/prompts/create` | invalidates `['prompts']` |
| `useUpdatePrompt()` | `PUT /api/admin/prompts/:id/update` | invalidates `['prompts']`, `['prompt', id]` |
| `useDeletePrompt()` | `DELETE /api/admin/prompts/:id` | invalidates `['prompts']` |
| `useToggleActive()` | `POST /api/admin/prompts/:id/toggle-active` | invalidates prompt list + single |
| `usePromptComments(id)` | `GET /api/admin/prompts/:id/comments` | `['prompt', id, 'comments']` |
| `useAddComment()` | `POST /api/admin/prompts/:id/comments` | invalidates comments + prompts |
| `usePromptHistory(id)` | `GET /api/admin/prompts/:id/history` | `['prompt', id, 'history']` |
| `useUsers(limit, nextToken?)` | `GET /api/admin/users` | `['admin', 'users', limit, nextToken]` |
| `useGroups()` | `GET /api/admin/groups` | `['admin', 'groups']` |
| `useCreateUser()` | `POST /api/admin/users` | invalidates `['admin', 'users']` |
| `useUpdateUser()` | `PUT /api/admin/users/:username` | invalidates `['admin', 'users']` |
| `useDeleteUser()` | `DELETE /api/admin/users/:username` | invalidates `['admin', 'users']` |
| `useEnableUser()` | `POST /api/admin/users/:username/enable` | invalidates `['admin', 'users']` |
| `useDisableUser()` | `POST /api/admin/users/:username/disable` | invalidates `['admin', 'users']` |
| `useResetUserPassword()` | `POST /api/admin/users/:username/reset-password` | invalidates `['admin', 'users']` |
| `useAddUserToGroup()` | `POST /api/admin/users/:username/groups/:group` | invalidates `['admin', 'users']` |
| `useRemoveUserFromGroup()` | `DELETE /api/admin/users/:username/groups/:group` | invalidates `['admin', 'users']` |
| `useJobPolling(options?)` | `GET /api/jobs/:id` (polling, 3s interval) | internal — not cached |

**`useJobPolling` details:**
- Polls every 3 seconds until status is `COMPLETED` or `FAILED`
- Max 100 attempts (~5 min timeout), then auto-stops
- Exposes: `{ status, result, error, isProcessing, attemptCount, startPolling(jobId), reset() }`

---

## 6. AWS Infrastructure

All infrastructure is defined as code in `infra/` using **AWS CDK v2** (TypeScript). A pre-generated CloudFormation template is available at `infra/cfn/alliance-risk-stack.template.yaml` for environments without the CDK toolchain.

### 6.1 Deployment Topology

```
                        ┌─────────────────────────────────────────────┐
                        │              AWS Account                    │
                        │                                             │
  Browser ──HTTPS──────►│ CloudFront Distribution                     │
                        │   ├── S3 Web Bucket (static SPA)  ◄── OAI  │
                        │   └── API Gateway HTTP API (/api/*)         │
                        │         └── API Lambda (Node 20, 1GB, 29s) │
                        │               ├── Cognito User Pool         │
                        │               ├── RDS PostgreSQL 15         │
                        │               └── Worker Lambda (async)     │
                        │                     (Node 20, 1GB, 15min)  │
                        │                     └── Bedrock Claude 3.5  │
                        │                                             │
                        │ S3 File Bucket (documents — future use)     │
                        │ Secrets Manager (DB credentials)            │
                        └─────────────────────────────────────────────┘
```

### 6.2 Resource Inventory

| Resource | Name | Key Config |
|----------|------|-----------|
| **Cognito User Pool** | `alliance-risk-user-pool` | Self-signup disabled; email sign-in; admin group; access token 1hr, refresh 30d |
| **RDS PostgreSQL 15** | `alliance-risk` DB | `db.t3.micro`, 20GB GP3, default VPC public subnet; credentials in Secrets Manager |
| **API Lambda** | `alliance-risk-api` | Node 20, ARM64, 1GB RAM, 29s timeout; handles all HTTP requests via API GW |
| **Worker Lambda** | `alliance-risk-worker` | Node 20, ARM64, 1GB RAM, **15min timeout**; invoked async by API Lambda for AI jobs |
| **API Gateway** | `alliance-risk-api` | HTTP API v2; Lambda proxy integration; payload format v2.0 |
| **S3 — Web** | `alliance-risk-web-{accountId}` | Hosts compiled Next.js static export; served via CloudFront + OAI |
| **S3 — Files** | `alliance-risk-files-{accountId}` | Document storage for future Textract pipeline; RETAIN on stack destroy |
| **CloudFront** | — | HTTPS-only; SPA routing (403/404 → `/index.html`); `PRICE_CLASS_100` |
| **Secrets Manager** | `alliance-risk/db-credentials` | Auto-generated RDS credentials; consumed as `DATABASE_URL` by Lambdas |

### 6.3 IAM Boundaries

```
API Lambda Role
  ├── AWSLambdaBasicExecutionRole
  ├── Cognito: full user management (16 actions) on User Pool ARN
  ├── Bedrock: InvokeModel, InvokeModelWithResponseStream, Retrieve on *
  ├── S3: GetObject, PutObject, DeleteObject on file bucket
  ├── Textract: StartDocumentAnalysis, GetDocumentAnalysis on *  (future)
  └── Lambda: InvokeFunction on Worker Lambda ARN only

Worker Lambda Role
  ├── AWSLambdaBasicExecutionRole
  ├── Cognito: same 16 actions
  ├── Bedrock: same actions
  ├── S3: same actions
  └── Textract: same actions
  (no Lambda:InvokeFunction — workers don't spawn other workers)
```

### 6.4 Deployment Commands

```bash
# From infra/ directory
pnpm deploy        # cdk deploy — full CDK deploy (requires cdk CLI + AWS credentials)
pnpm cfn:synth     # Regenerate CloudFormation template after CDK changes
pnpm cfn:deploy    # Deploy pre-generated CFN template (no CDK toolchain needed)
```

### 6.5 Known MVP Caveats

| Issue | Risk | Recommended Fix |
|-------|------|----------------|
| RDS is publicly accessible (`publiclyAccessible: true`) | Any IP can attempt to reach port 5432 | Move RDS to private subnet; add VPC NAT for Lambda |
| API Gateway CORS allows all origins (`*`) | Any domain can call the API | Lock to CloudFront distribution URL in production |
| No WAF on API Gateway | No rate limiting or IP filtering at edge | Add AWS WAF with rate-based rules |
| Textract / S3 SDK not yet implemented | IAM policy exists but no code path | Implement `DocumentService` when Epic 1 begins |

---

## 7. Cross-Cutting Concerns

### 7.1 Security Boundaries

The following rules are **non-negotiable** and enforced by architecture:

- **The frontend never calls Bedrock directly.** All AI inference routes through the API Lambda, which enforces authentication and ownership before dispatching to the Worker Lambda.
- **DB credentials are never in source code or `.env` files committed to git.** They are fetched from Secrets Manager at Lambda startup via the `DATABASE_URL` environment variable.
- **Job ownership is enforced server-side.** `JobsService.findOne()` validates `job.createdById === request.user.userId`. A user cannot poll another user's job.
- **Admin routes require two guards.** `JwtAuthGuard` (valid JWT) + `AdminGuard` (`isAdmin: true` on the Cognito user's group membership).

### 7.2 Shared Type Contracts

The `@alliance-risk/shared` package is the single source of truth for types crossing the API↔Web boundary. A violation of this contract (e.g., API returning a field not in the shared type) will silently break the frontend. Rules:

1. Add new API response fields to shared types first.
2. Never duplicate shared types inline in `api/` or `web/`.
3. Never use `any` for API responses in the frontend — always import from `@alliance-risk/shared`.

### 7.3 Resilience Patterns Summary

| Layer | Pattern | Config |
|-------|---------|--------|
| Bedrock calls | Circuit breaker | 3 failures → OPEN (60s); 2 successes → CLOSED |
| Bedrock calls | Exponential backoff | 3 attempts; 200ms base; 5s max; ±25% jitter; retry on throttling only |
| API/Worker Lambda | Instance caching | NestJS app cached between warm invocations to reduce cold-start latency |
| Job processing | Built-in retry | Max 3 attempts per job; status reset to PENDING on transient failure |
| Token expiry | Auto-refresh | Axios interceptor retries 401 responses after refreshing access token |

### 7.4 Planned Capabilities (Not Yet Implemented)

The schema and job type infrastructure is already in place for the full AI pipeline. The following are the next milestones:

| Epic | Job Type | Description |
|------|----------|-------------|
| Epic 1 | `PARSE_DOCUMENT` | `DocumentService` + Textract SDK; upload to S3, extract structured text |
| Epic 2 | `GAP_DETECTION` | Compare document content against expected risk category coverage |
| Epic 3 | `RISK_ANALYSIS` | Score risk subcategories using extracted evidence |
| Epic 4 | `REPORT_GENERATION` | Produce structured risk report from scored categories |

Future Prisma models (commented in schema): `Assessment`, `Document`, `RiskScore`, `RiskRule`.

### 7.5 Model Configuration

All Bedrock model IDs are defined in `@alliance-risk/shared/constants/bedrock.config.ts` as `BEDROCK_MODELS`. **Never hardcode a model ID string in service code** — always reference `BEDROCK_MODELS[section].modelId`. This allows model upgrades without touching service logic.

Current model: `anthropic.claude-3-5-sonnet-20241022-v2:0` for all four agent sections.
