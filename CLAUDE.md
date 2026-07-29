# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

CGIAR Agricultural Risk Intelligence Tool (MVP). Multi-agent pipeline using AWS Bedrock models for document parsing, gap detection, risk analysis, and report generation across 7 risk categories.

## Constitutional Baseline (AKILI-SPECS)

These documents form the project constitution — consult before specs and implementation:

| Document | Purpose |
|----------|---------|
| [`docs/prd.md`](docs/prd.md) | Product requirements, personas, scope, metrics |
| [`docs/ux-ui/design.md`](docs/ux-ui/design.md) | UI/UX system blueprint and design tokens |
| [`docs/trd/trd.md`](docs/trd/trd.md) | Technical architecture, API, data model, NFRs |
| [`docs/infrastructure.md`](docs/infrastructure.md) | AWS deploy topology + **local environment contract** |
| [`docs/specs/general-setup/`](docs/specs/general-setup/) | Module spec templates (requirements, design, tasks) |
| [`AGENTS.md`](AGENTS.md) | Agent personas, model routing, skill map |

Multi-agent personas for `/akili-execute` and `/akili-test`: [`.agents/`](.agents/)

## Module Guides

Child guides add package-specific rules (root rules always apply):

| Guide | Scope |
|-------|-------|
| [`packages/api/CLAUDE.md`](packages/api/CLAUDE.md) | NestJS backend |
| [`packages/web/CLAUDE.md`](packages/web/CLAUDE.md) | Next.js frontend |
| [`packages/shared/CLAUDE.md`](packages/shared/CLAUDE.md) | Shared types and constants |
| [`infra/CLAUDE.md`](infra/CLAUDE.md) | AWS CDK / CloudFormation |

## Before Implementing

1. Read constitutional docs above and the module spec in `docs/specs/{domain|enhancement|bugfix|epic}/<module>/` (minimum: `requirements.md`, `design.md`, `tasks.md`)
2. Check OpenAPI spec at `docs/api/openapi.yaml` (when present)
3. **CRITICAL:** Always read the specific `CLAUDE.md` for the package you are working in *before* writing code
4. For UI/frontend work, consult [`docs/ux-ui/design.md`](docs/ux-ui/design.md) and Figma detail in [`docs/figma-design/`](docs/figma-design/README.md):
   - Design tokens: `docs/figma-design/design-tokens.md`
   - CSS variable updates: `docs/figma-design/globals-update.md`
   - Component patterns: `docs/figma-design/component-patterns.md`
   - Icon mapping: `docs/figma-design/icon-mapping.md`
   - Per-screen guides: `docs/figma-design/screens/`
5. Start local stack per [`docs/infrastructure.md` § Local Environment](docs/infrastructure.md#6-local-environment) — do not guess start commands

## Build & Development Commands

```bash
# Install dependencies
pnpm install

# Run both dev servers concurrently (API :3001 + Web :3000)
pnpm dev

# Run individual dev servers
pnpm dev:api          # NestJS on http://localhost:3001
pnpm dev:web          # Next.js on http://localhost:3000

# Build all packages
pnpm build

# Test all packages
pnpm test

# Lint all packages
pnpm lint

# Target a single package
pnpm --filter @alliance-risk/api <script>
pnpm --filter @alliance-risk/web <script>
pnpm --filter @alliance-risk/shared <script>

# Run a single test file (API)
pnpm --filter @alliance-risk/api test -- --testPathPattern=app.controller

# Run a single test file (Web)
pnpm --filter @alliance-risk/web test -- --testPathPattern=some.test
```

## Architecture

pnpm monorepo with three packages and an infrastructure directory:

- **`@alliance-risk/api`** (`packages/api/`) — NestJS 10 backend (CommonJS, port 3001) → see [`packages/api/CLAUDE.md`](packages/api/CLAUDE.md)
- **`@alliance-risk/web`** (`packages/web/`) — Next.js 15 frontend with App Router (port 3000) → see [`packages/web/CLAUDE.md`](packages/web/CLAUDE.md)
- **`@alliance-risk/shared`** (`packages/shared/`) — Shared enums, types, and constants consumed by both API and Web
- **`@alliance-risk/infra`** (`infra/`) — AWS CDK + CloudFormation infrastructure → see [`infra/CLAUDE.md`](infra/CLAUDE.md)

### Data Flow

```
Frontend (Next.js) → API Client → API Gateway → API Lambda (NestJS)
                                                    ├── Cognito (auth)
                                                    ├── Prisma → RDS PostgreSQL
                                                    └── JobsService → Worker Lambda → Bedrock
```

### Async Processing

Long-running AI operations use a fire-and-forget pattern:
1. API Lambda creates a Job record (PENDING) and invokes Worker Lambda asynchronously
2. Worker Lambda processes the job (Bedrock calls) and updates Job status
3. Frontend polls `GET /api/jobs/:id` until COMPLETED or FAILED

## Deployment

```bash
# Full deployment (API + Web)
pnpm deploy:all

# Individual deployments
pnpm deploy:api          # Build + upload Lambda bundle to S3 + update Lambdas
pnpm deploy:web          # Build static export + sync to S3 + CloudFront invalidation

# Database migrations (via Worker Lambda — RDS is in a private VPC)
pnpm migrate:remote      # Runs pending migrations on RDS through Lambda
```

### Deployment Order (when infrastructure or schema changes)

```
1. Deploy infrastructure:   pnpm --filter @alliance-risk/infra cfn:deploy dev
2. Run DB migrations:       pnpm migrate:remote
3. Deploy API:              pnpm deploy:api
4. Deploy Web:              pnpm deploy:web
```

Steps 1-2 only needed when infrastructure or Prisma schema changes. For code-only changes, `pnpm deploy:all` is sufficient.

### Local Development Setup

See the full contract in [`docs/infrastructure.md` § Local Environment](docs/infrastructure.md#6-local-environment).

Quick start: local PostgreSQL (not remote RDS). Set in `packages/api/.env`:

```
DATABASE_URL=postgresql://<your-user>@localhost:5432/alliance_risk
```

```bash
pnpm --filter @alliance-risk/shared build
pnpm --filter @alliance-risk/api exec prisma migrate deploy
npx --prefix packages/api tsx prisma/seed.ts
pnpm dev    # API :3001 + Web :3000
```

## Rules

- **Frontend NEVER talks directly to Bedrock** — always through the API
- Do not hardcode model IDs; use `bedrock.config.ts` from `@alliance-risk/shared`
- Tests required for all routing and scoring logic
- All API responses use `ApiResponse<T>` or `PaginatedResponse<T>` from shared types
- DB credentials go through Secrets Manager, never hardcoded or in `.env` committed to git
- **No dynamic `[id]` routes in Next.js** — use query params (`?id=xxx`) because `output: 'export'` requires all paths at build time

## Key Constraints

- ESLint 8.x is used (required for `eslint-config-next` and `@typescript-eslint` compatibility)
- `allowBuilds` in root `pnpm-workspace.yaml` whitelists packages needing postinstall scripts (moved from the now-ignored `pnpm.onlyBuiltDependencies` field in `package.json`)
- Web test script includes `--passWithNoTests` since test files may not always exist
- Prisma schema lives in `packages/api/prisma/schema.prisma`
- Shared package must be built (`pnpm --filter @alliance-risk/shared build`) before API or Web can import from it
- RDS is in a private VPC — migrations must run via `pnpm migrate:remote` (authenticated via Secrets Manager token), not directly from local machines

## Model Routing

**Philosophy:** Match model capability to task demand — architecture and orchestration on deep-reasoning tiers; implementation on coder tiers; audit on a **different model** than the author (author ≠ auditor). Reserve frontier effort for propose/specify/verify and the orchestrating Leader. Fast/cheap models are for archive/formatting only — **`tasks.md` decomposition is T1, not cheap formatting**.

### Capability Tiers

| Tier | Name | Definition |
|------|------|------------|
| T1 | Architect | Architecture reasoning, task decomposition, live orchestration judgment |
| T2 | Coder | Implementation and test authoring throughput |
| T3 | Auditor | Independent deep review — must differ from Implementer model |
| T4 | Context-Ingest | Large-repo scanning and synthesis |
| T5 | Fast-Cheap | Formatting, archive, mechanical transforms |
| T6 | Multimodal | Image/diagram-heavy work |

### Phase → Tier Mapping

| Phase | Role | Tier | Notes |
|-------|------|------|-------|
| `/akili-constitution`, `/akili-specify` | Architect | T1 | Baseline and spec design |
| `/akili-execute` | Leader | T1 | Orchestration — no code |
| `/akili-execute` | Implementer | T2 | One task scope |
| `/akili-execute` | Reviewer | T3 | **Different model than Implementer** |
| `/akili-test` | Leader | T1 | Test orchestration |
| `/akili-test` | Tester | T2 | Prefer **different model than Implementer** |
| `/akili-validate` | Auditor | T3 | Spec/implementation alignment |
| Archive / formatting | — | T5 | Mechanical doc transforms |

### Model Registry

**Updated:** 2026-07

| Tier | Claude Code | OpenCode | Fallback |
|------|-------------|----------|----------|
| T1 Architect | `opus` | `<CONFIRM SLUG>` | `opus` |
| T2 Coder | `sonnet` | `<CONFIRM SLUG>` | `sonnet` |
| T3 Auditor | `opus` | `<CONFIRM SLUG>` | `opus` |
| T4 Context-Ingest | `haiku` | `<CONFIRM SLUG>` | `haiku` |
| T5 Fast-Cheap | `haiku` | `<CONFIRM SLUG>` | `haiku` |
| T6 Multimodal | `sonnet` | `<CONFIRM SLUG>` | `sonnet` |

To change models, edit only this registry table. Never pin a dated model name where a floating alias exists. Model selection is guidance in command prompts — enforced bindings live only in agent wrappers (not enabled in this project).

### Effort Dial

Effort is **per-task**, orthogonal to tier — tier picks the model, effort picks how hard it thinks.

| Signal | Effort |
|--------|--------|
| Trivial / mechanical | `low` |
| Standard scope | `medium` |
| Complex (algorithm, concurrency, security, ambiguity) | `xhigh` |
| Correctness-critical | `max` |

**Defaults by role:** T1 Leader/propose `high`; T2 Implementer/Tester `medium` (flex by task); T3 Reviewer `high`; T5 archive `low`.

**Rules:** bump effort one level on every rework retry; never `max` a cheaper tier (escalate tier instead); under-specified tasks start one level higher; effort is not a verbosity dial.

## Skill Map

During `/akili-specify`, derive each task's skills from this map. During `/akili-execute` and `/akili-test`, the Leader assigns skills; Implementer/Tester must load them before writing code or tests.

| Skill | Applies To | When to load |
|-------|------------|--------------|
| `nestjs-expert` | `packages/api/` | NestJS modules, guards, DTOs, services, job handlers |
| `api-design-principles` | API endpoints | New routes, request/response contracts, error shapes |
| `error-handling-patterns` | API + jobs | Exception filters, fail-closed validation, retry logic |
| `aws-serverless` | `infra/`, Lambda | CDK/CFN, Lambda config, deploy scripts, VPC |
| `shadcn-ui` | `packages/web/` | UI primitives, dialogs, forms, tables |
| `tailwind-design-system` | `packages/web/` | Tailwind v4 utilities, CSS variables, responsive layout |
| `vercel-react-best-practices` | `packages/web/` | React Query, App Router patterns, performance |

## CodeGraph

**Status:** Not initialized — `codegraph` CLI not installed. Use Explore subagents or targeted search for codebase analysis.
