# Technical Requirements Document — CGIAR Risk Intelligence Tool

> **Status:** Living technical blueprint  
> **Last updated:** 2026-07-27  
> **Architecture tier:** **Robust** (serverless AWS, multi-Lambda, private DB, async job pipeline)

---

## 1. System Overview

Multi-agent AI pipeline for agricultural SME risk assessment. Analysts interact via a Next.js static SPA; a NestJS API on Lambda orchestrates auth, assessments, async jobs, and admin functions; a Worker Lambda runs long-running Bedrock/Textract work against RDS PostgreSQL.

**Packages:** `@alliance-risk/api`, `@alliance-risk/web`, `@alliance-risk/shared`, `@alliance-risk/infra`

---

## 2. Architecture Overview & Decisions

### C4 Context

```
[Analyst/Admin Browser] --HTTPS--> [CloudFront CDN]
                                        |
                    +-------------------+-------------------+
                    |                                       |
              [S3 Static Web]                          [API Gateway]
                                                          |
                                                    [API Lambda]
                                                    /    |    \
                                            [Cognito] [RDS] [Worker Lambda]
                                                              |
                                                    [Bedrock / Textract / S3]
```

### C4 Container

| Container | Technology | Responsibility |
|-----------|------------|----------------|
| Web SPA | Next.js 15 static export | UI, auth token management, job polling |
| API | NestJS 10 on Lambda | REST `/api/*`, job dispatch, Cognito integration |
| Worker | NestJS app context on Lambda | Job handlers: parse, gap, risk, report, preview |
| Database | PostgreSQL 15 + Prisma 7 | Assessments, jobs, prompts, users (FK anchor) |
| Shared | TypeScript package | Cross-boundary types, enums, Bedrock config |

### Style & tier

- **Architecture style:** Modular monolith (NestJS) deployed as two Lambda functions
- **Tier:** Robust — VPC-bound RDS, Secrets Manager, circuit breakers, async offload for AI
- **Integration:** Synchronous HTTP for CRUD; asynchronous invoke for AI jobs

### ADR Index

| ID | Decision | Status |
|----|----------|--------|
| ADR-001 | Fire-and-forget jobs with DB polling (not WebSockets) | Accepted |
| ADR-002 | Unweighted mean for overall risk score (MVP) | Accepted — see `DD-WEIGHTS` in risk-analyzer spec |
| ADR-003 | Static export Next.js (no SSR) on S3/CloudFront | Accepted |
| ADR-004 | Cognito as identity source; DB `User` as FK anchor only | Accepted |
| ADR-005 | Bedrock model IDs in `@alliance-risk/shared` only | Accepted |
| ADR-006 | Query-param IDs instead of dynamic routes | Accepted |
| ADR-007 | Moonshot Kimi K2.5 for all agent sections (via Bedrock) | Accepted |

---

## 3. Quality Attribute Scenarios

### Security

| Scenario | Stimulus | Response (measurable) | Tactic |
|----------|----------|----------------------|--------|
| SEC-01 Unauthorized API access | Request without valid JWT | 401 within 50ms | Global JwtAuthGuard + Cognito JWKS (prod) |
| SEC-02 Privilege escalation | Non-admin hits `/api/admin/*` | 403 | AdminGuard on admin controllers |
| SEC-03 Job snooping | User polls another user's jobId | 404/403 | JobsService ownership check |
| SEC-04 Credential leak | Lambda env inspection | No plaintext DB creds in code | Secrets Manager → `DATABASE_URL` |

### Performance

| Scenario | Stimulus | Response | Tactic |
|----------|----------|----------|--------|
| PERF-01 API CRUD | GET assessment by id | p95 < 500ms (warm Lambda) | Prisma connection pool, cached Nest instance |
| PERF-02 Document parse | 20-page PDF upload | Job COMPLETED < 3 min p95 | Async Worker + Textract |
| PERF-03 Gap detection | Submit 10 fields | Job COMPLETED < 2 min p95 | Worker Lambda 15min timeout |

### Scalability

| Scenario | Stimulus | Response | Tactic |
|----------|----------|----------|--------|
| SCALE-01 Concurrent analysts | 50 simultaneous assessments | No shared-state blocking | Stateless Lambdas + RDS connections |
| SCALE-02 AI burst | 10 parallel Bedrock calls | Throttling handled | Circuit breaker + exponential backoff |

### Availability

| Scenario | Stimulus | Response | Tactic |
|----------|----------|----------|--------|
| AVAIL-01 Bedrock throttle | ThrottlingException | Retry 3× then job FAILED | withRetry + circuit breaker |
| AVAIL-02 Worker crash mid-job | Lambda timeout | Job reset PENDING up to maxAttempts | JobsService retry policy |

---

## 4. Domain Modules & Responsibilities

### API layers (`packages/api/src/`)

| Layer | Path | Modules |
|-------|------|---------|
| **Domain** | `domain/` | assessments, gap-detection, risk-analysis, report |
| **Platform** | `platform/` | auth, admin, prompts, jobs |
| **Infrastructure** | `infrastructure/` | bedrock, textract, storage, database, extractors |
| **Common** | `common/` | guards, filters, decorators, utils |

### Frontend (`packages/web/src/`)

| Area | Path | Concern |
|------|------|---------|
| Routes | `app/(auth|protected|admin)/` | Page composition, route guards |
| Features | `components/{feature}/` | UI by domain |
| Data | `hooks/` | React Query wrappers — never call axios from pages |
| Auth | `providers/auth-provider.tsx`, `lib/token-manager.ts` | Cognito token lifecycle |

### Shared (`packages/shared/src/`)

Enums, API response types, risk categories, Bedrock model registry — single contract layer.

---

## 5. Data Model & Entities

Source: `packages/api/prisma/schema.prisma`

| Entity | Purpose |
|--------|---------|
| `User` | Cognito sync anchor (id, cognitoId, email) |
| `Assessment` | Company metadata, status, intake mode, overall score |
| `AssessmentDocument` | S3-backed uploads, parse job link |
| `GapField` | 10 core fields per assessment (MISSING/PARTIAL/VERIFIED) |
| `RiskScore` | Per-category score, subcategories JSON, narrative |
| `Recommendation` | Linked to RiskScore; analyst-editable |
| `Job` | Async pipeline state machine |
| `Prompt`, `PromptVersion`, `PromptComment`, `PromptChange` | Prompt CMS + audit |

Key enums: `AssessmentStatus`, `IntakeMode`, `RiskCategory`, `RiskLevel`, `GapFieldStatus`, `JobType`, `AgentSection`

See [`docs/architecture/erd.md`](architecture/erd.md) for diagram.

---

## 6. API Surface & Contracts

- **Prefix:** `/api` on all routes
- **Response wrapper:** `ApiResponse<T>`, `PaginatedResponse<T>` from `@alliance-risk/shared`
- **Validation:** class-validator DTOs; global ValidationPipe (whitelist, transform)
- **OpenAPI:** Target spec at `docs/api/openapi.yaml` (restore/generate — currently missing)

### Endpoint groups

| Group | Base | Auth |
|-------|------|------|
| Health | `GET /api` | Public |
| Auth | `/api/auth/*` | Mixed |
| Assessments | `/api/assessments/*` | JWT |
| Gap fields | `/api/assessments/:id/gap-fields/*` | JWT |
| Risk scores | `/api/assessments/:id/risk-scores` | JWT |
| Report | `/api/assessments/:id/report` | JWT |
| Jobs | `GET /api/jobs/:id` | JWT + ownership |
| Admin users/groups | `/api/admin/*` | JWT + AdminGuard |
| Admin prompts | `/api/admin/prompts/*` | JWT + AdminGuard |
| Prompt runtime | `GET /api/prompts/section/:section` | Public (worker use) |

Full endpoint inventory: [`docs/architecture/overview.md`](architecture/overview.md) §3.5, `packages/api/CLAUDE.md`

---

## 7. Backend Workflows & Business Rules

### Async job pipeline

```
API: create Job(PENDING) → invoke Worker(async) → return 202/jobId
Worker: PROCESSING → handler → COMPLETED | FAILED (retry up to maxAttempts)
Frontend: poll GET /api/jobs/:id every 3s
```

### Job types

| JobType | Handler | Trigger |
|---------|---------|---------|
| `PARSE_DOCUMENT` | ParseDocumentHandler | Document upload / parse |
| `GAP_DETECTION` | GapDetectionHandler | Re-analyze gap fields |
| `RISK_ANALYSIS` | RiskAnalysisHandler | Gap submit (after validation) |
| `REPORT_GENERATION` | ReportGenerationHandler | Report/PDF request |
| `AI_PREVIEW` | AiPreviewHandler | Prompt preview |

### Gap submit validation (fail-closed)

1. Query user-edited fields (`correctedValue IS NOT NULL`)
2. Bedrock validates substance per `GAP_VALIDATION_CONFIG`
3. Invalid → 400 + `invalidFields`; valid → dispatch RISK_ANALYSIS job
4. Bedrock failure → 400 (never silent pass)

### Scoring

- 7 categories × 5 subcategories = 35 indicators
- Overall score = **unweighted arithmetic mean** of 7 category scores (ADR-002)

---

## 8. Frontend Architecture & State Boundaries

| Concern | Owner | Pattern |
|---------|-------|---------|
| Server data | React Query hooks in `hooks/` | Cache keys per resource |
| Auth session | `AuthProvider` + `tokenManager` | localStorage (remember) / sessionStorage |
| Job status | `useJobPolling` | 3s interval, max 100 attempts |
| Forms | React Hook Form + Zod | Per feature form components |
| Theme | `next-themes` | CSS variables in globals.css |

**Hard rule:** No Bedrock/Textract from browser — all via `api-client.ts`.

**Routing:** Query params for UUIDs (`?id=`) — static export constraint.

---

## 9. Integration Points

| Service | SDK / Module | Usage |
|---------|--------------|-------|
| AWS Cognito | `@aws-sdk/client-cognito-identity-provider` | Auth + admin user CRUD |
| AWS Bedrock | `BedrockService` | All AI agent calls |
| AWS Textract | `TextractService` | PDF OCR only |
| AWS S3 | `StorageService` | Documents, PDFs, presigned uploads |
| PostgreSQL | Prisma 7 + `@prisma/adapter-pg` | All app persistence |

Document extraction: `ExtractorFactory` — PDF → Textract; DOCX/XLSX/CSV/HTML/MD/TXT → programmatic (mammoth, xlsx, turndown).

---

## 10. Security & Authorization Model

```
Request → JwtAuthGuard (global)
            ├── @Public() → pass
            ├── Verify JWT (JWKS prod / decode dev)
            ├── Upsert User in DB
            └── Set request.user (userId, isAdmin, ...)
         → AdminGuard (admin routes only)
            └── isAdmin === true else 403
```

- Tokens: Bearer access token; refresh via `/api/auth/refresh-token`
- Admin: Cognito `admin` group → `isAdmin` claim
- Worker privileged actions: `WORKER_ADMIN_TOKEN` for `run-sql` migration path

---

## 11. Error Handling & Observability

| Layer | Pattern |
|-------|---------|
| HTTP | `HttpExceptionFilter` → `{ statusCode, error, message, invalidFields? }` |
| Bedrock | Circuit breaker (3 failures → 60s open) + retry on throttle |
| Jobs | FAILED status + error message in DB; frontend shows toast |
| Prisma (Lambda) | Log `.code` and `.meta` — bundled messages may be empty |

Logging: CloudWatch Logs for both Lambdas. No dedicated APM in MVP.

---

## 12. Testing Strategy

| Layer | Runner | Command | Coverage expectation |
|-------|--------|---------|---------------------|
| API unit | Jest + ts-jest | `pnpm --filter @alliance-risk/api test` | Routing, scoring, gap validation — 55% lines threshold |
| API e2e | Jest | `pnpm --filter @alliance-risk/api test:e2e` | Critical flows |
| Web unit | Jest + Testing Library | `pnpm --filter @alliance-risk/web test` | Components, hooks |
| Infra | Jest snapshot | `pnpm --filter @alliance-risk/infra test` | CFN template drift |
| Manual UAT | Protocol | `docs/testing/analyst-test-protocol.md` | 17-step smoke path |

Tests required for all routing and scoring logic (project rule).

---

## 13. Technical Constraints & Assumptions

| Constraint | Detail |
|------------|--------|
| Lambda callback | `context.callbackWaitsForEmptyEventLoop = false` (Prisma pool) |
| API timeout | 30s — all AI must be async via Worker |
| Worker timeout | 15 min |
| Build order | `shared` → `api` / `web` |
| ESLint | 8.x across monorepo |
| No dynamic routes | Next.js `output: 'export'` |
| RDS remote only | Migrations via `pnpm migrate:remote` |
| Model config | `BEDROCK_MODELS[AgentSection]` — never inline model IDs |

**Assumption:** Dev uses local PostgreSQL; prod/staging use VPC RDS unreachable from developer laptop.
