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

- **`@alliance-risk/api`** (`packages/api/`) — NestJS 10 backend (CommonJS, port 3001) → see [`packages/api/CLAUDE.md`](packages/api/CLAUDE.md)
- **`@alliance-risk/web`** (`packages/web/`) — Next.js 15 frontend with App Router (port 3000) → see [`packages/web/CLAUDE.md`](packages/web/CLAUDE.md)

## Rules

- **Frontend NEVER talks directly to Bedrock** — always through the API
- Do not hardcode model IDs; use `bedrock.config.ts`
- Tests required for all routing and scoring logic

## Key Constraints
- ESLint 8.x is used (required for `eslint-config-next` and `@typescript-eslint` compatibility)
- `pnpm.onlyBuiltDependencies` in root `package.json` whitelists packages needing postinstall scripts
- Web test script includes `--passWithNoTests` since test files may not always exist
