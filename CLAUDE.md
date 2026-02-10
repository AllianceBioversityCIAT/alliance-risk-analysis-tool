# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Agricultural risk assessment platform. Uses 9 AWS Bedrock models and 7 Knowledge Bases.

## Before Implementing

1. Read the spec in `docs/specs/{module}/`
2. Review ADRs in `docs/adrs/`
3. Check OpenAPI spec at `docs/api/openapi.yaml`

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

# Run a single test file (API)
pnpm --filter @alliance-risk/api test -- --testPathPattern=app.controller

# Run a single test file (Web)
pnpm --filter @alliance-risk/web test -- --testPathPattern=some.test
```

## Architecture

pnpm monorepo with two packages under `packages/`:

- **`@alliance-risk/api`** (`packages/api/`) — NestJS 10 backend (CommonJS, port 3001)
- **`@alliance-risk/web`** (`packages/web/`) — Next.js 15 frontend with App Router (port 3000)

### API Package (`packages/api/`)
- NestJS convention: module → service → controller
- Each Bedrock model is a provider in `src/router/models/`
- DTOs for all controller input/output
- Tests: unit in `test/unit/`, integration in `test/integration/`
- E2E test config in `test/jest-e2e.json`
- ESLint with `@typescript-eslint` recommended rules
- TypeScript: strict mode, decorators enabled (`emitDecoratorMetadata` + `experimentalDecorators`)

### Web Package (`packages/web/`)
- Next.js App Router with pages in `src/app/`
- Components in `src/components/{feature}/`
- API calls via `src/lib/api-client.ts` (never direct to Bedrock)
- Custom hooks in `src/hooks/`
- Path alias: `@/*` maps to `src/*`
- Tests: Jest via `next/jest` wrapper, jsdom environment, Testing Library
- Test setup file: `jest.setup.js` (imports `@testing-library/jest-dom`)
- ESLint extends `next/core-web-vitals`

## Rules

- **Frontend NEVER talks directly to Bedrock** — always through the API
- Do not hardcode model IDs; use `bedrock.config.ts`
- Tests required for all routing and scoring logic

## Key Constraints
- ESLint 8.x is used (required for `eslint-config-next` and `@typescript-eslint` compatibility)
- `pnpm.onlyBuiltDependencies` in root `package.json` whitelists packages needing postinstall scripts
- Web test script includes `--passWithNoTests` since test files may not always exist
