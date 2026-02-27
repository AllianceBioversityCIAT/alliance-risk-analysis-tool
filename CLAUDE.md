# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

CGIAR Agricultural Risk Intelligence Tool (MVP). Multi-agent pipeline using AWS Bedrock models for document parsing, gap detection, risk analysis, and report generation across 7 risk categories.

## Before Implementing

1. Read the Spec-Driven Development (SDD) documentation in `docs/specs/{module}/`. For every module, there MUST be at least 3 files:
   - `requirements.md` (What are we building and why)
   - `design.md` (How are we building it, architecture, data flow)
   - `task.md` (Step-by-step implementation plan)
2. Check OpenAPI spec at `docs/api/openapi.yaml`
3. **CRITICAL:** Always read the specific `CLAUDE.md` for the package you are working in *before* writing code:
   - Frontend changes: Read `packages/web/CLAUDE.md`
   - Backend changes: Read `packages/api/CLAUDE.md`
   - Infrastructure changes: Read `infra/CLAUDE.md`
4. For UI/frontend work, consult the Figma design documentation in [`docs/figma-design/`](docs/figma-design/README.md):
   - Design tokens (colors, typography, spacing): `docs/figma-design/design-tokens.md`
   - CSS variable updates: `docs/figma-design/globals-update.md`
   - Component patterns (22 reusable patterns): `docs/figma-design/component-patterns.md`
   - Icon mapping (Material → Lucide): `docs/figma-design/icon-mapping.md`
   - Per-screen implementation guides: `docs/figma-design/screens/`

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

Local dev uses a **local PostgreSQL database** (not the remote RDS, which is in a private VPC and unreachable from outside). Set in `packages/api/.env`:

```
DATABASE_URL=postgresql://<your-user>@localhost:5432/alliance_risk
```

After setting up the local database:
```bash
pnpm --filter @alliance-risk/api exec prisma migrate deploy  # Apply migrations
npx --prefix packages/api tsx prisma/seed.ts                  # Seed sample data
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
- `pnpm.onlyBuiltDependencies` in root `package.json` whitelists packages needing postinstall scripts
- Web test script includes `--passWithNoTests` since test files may not always exist
- Prisma schema lives in `packages/api/prisma/schema.prisma`
- Shared package must be built (`pnpm --filter @alliance-risk/shared build`) before API or Web can import from it
- RDS is in a private VPC — migrations and seeds must run through the Worker Lambda `run-sql` action, not directly from local machines
