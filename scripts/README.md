# Deployment Scripts

Scripts for deploying application code to AWS. Infrastructure (Cognito, RDS, Lambda, API Gateway, S3, CloudFront) is managed separately via CloudFormation in `infra/cfn/`.

## Prerequisites

- **AWS CLI** configured with valid credentials (`aws sts get-caller-identity`)
- **pnpm** installed
- **jq** installed
- **zip** installed (API deploy only)
- CloudFormation stack `AllianceRiskStack` already deployed

## Quick Start

```bash
# Deploy everything (API + Web)
pnpm deploy:all

# Deploy individually
pnpm deploy:api          # API Lambda only
pnpm deploy:web          # Frontend only

# Run database migrations
pnpm migrate:deploy
```

All scripts accept an optional environment argument (default: `dev`):

```bash
pnpm deploy:api -- staging
pnpm deploy:web -- production
```

## Scripts

### `deploy-api.sh`

Bundles and deploys the NestJS API to both Lambda functions (API + Worker) using **esbuild**.

**What it does:**

1. Builds `@alliance-risk/shared` and `@alliance-risk/api` with `tsc` (preserves decorator metadata)
2. Bundles each Lambda entry point (`lambda.js`, `worker.js`) with esbuild into single CJS files — inlines all 1,400+ `node_modules` packages
3. Copies only ~18 external packages that cannot be bundled (Prisma + pg ecosystem, ~16MB)
4. Copies `prisma/schema.prisma` for Prisma Client
5. Strips `.d.ts`, `.map`, docs, tests, and `.mjs` duplicates from external packages
6. Creates a zip archive (~8MB vs ~80MB with old approach)
7. Uploads to `s3://alliance-risk-deploy-{env}/api/latest.zip`
8. Updates both `alliance-risk-api` and `alliance-risk-worker` Lambda functions
9. Waits for both functions to become active

**Why esbuild?** The previous approach (`pnpm deploy --prod`) copied all `node_modules`, producing an ~80MB zip and taking 10+ minutes. esbuild inlines everything into two single-file bundles, keeping only packages with WASM binaries, native addons, or dynamic `require()` patterns as external.

**External packages (not bundled):**
- **Prisma**: `@prisma/client`, `.prisma/client`, `@prisma/adapter-pg`, `@prisma/driver-adapter-utils`, `@prisma/client-runtime-utils`, `@prisma/debug`
- **PostgreSQL**: `pg`, `pg-pool`, `pg-cloudflare` + transitive deps (`pg-types`, `pg-protocol`, etc.)
- **NestJS optional**: `@nestjs/microservices`, `@nestjs/websockets` (lazy `require()`, not installed)

**Output:** Both Lambdas are running the new code (~8MB package). The zip is also stored in S3 for rollback.

### `deploy-web.sh`

Builds and deploys the Next.js frontend as a static site to S3 + CloudFront.

**What it does:**

1. Fetches CloudFormation stack outputs (bucket name, CloudFront ID, API URL, Cognito IDs)
2. Sets `NEXT_PUBLIC_*` environment variables from stack outputs (baked into the static build)
3. Builds `@alliance-risk/shared` and `@alliance-risk/web` (produces `packages/web/out/`)
4. Syncs to S3 with two cache strategies:
   - **JS, CSS, images:** `Cache-Control: public, max-age=31536000, immutable` (1 year, content-hashed filenames)
   - **HTML, JSON:** `Cache-Control: public, max-age=0, must-revalidate` (always revalidate)
5. Creates a CloudFront cache invalidation for `/*`

**Output:** Frontend is live at the CloudFront URL. Cache invalidation typically propagates within 1-2 minutes.

## Deployment Order

For a full deployment from scratch:

```
1. Deploy infrastructure    pnpm --filter @alliance-risk/infra cfn:deploy dev
2. Run database migrations  pnpm migrate:deploy
3. Deploy API               pnpm deploy:api
4. Deploy frontend          pnpm deploy:web
```

On **first deploy**, step 1 automatically bootstraps the deploy bucket (`alliance-risk-deploy-{env}`) and uploads a placeholder Lambda zip. After the stack is created, step 3 replaces the placeholder with the real API code.

For routine code deployments, steps 1-2 are only needed when infrastructure or schema changes.

## Database Migrations

Prisma migrations live in `packages/api/prisma/migrations/`. To apply pending migrations to the remote database:

```bash
# Set DATABASE_URL (fetch from Secrets Manager)
DB_SECRET=$(aws secretsmanager get-secret-value \
  --secret-id "alliance-risk/db-credentials" \
  --query "SecretString" --output text)
DB_PASSWORD=$(echo "$DB_SECRET" | jq -r '.password')
DB_HOST=$(echo "$DB_SECRET" | jq -r '.host')

DATABASE_URL="postgresql://postgres:${DB_PASSWORD}@${DB_HOST}:5432/alliance_risk" \
  pnpm migrate:deploy
```

To create a new migration after changing `schema.prisma`:

```bash
DATABASE_URL="..." npx prisma migrate dev --name describe_your_change
```

## Architecture

```
                    ┌─────────────────┐
                    │  CloudFormation  │  Infrastructure (VPC, RDS, Cognito, etc.)
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
     ┌────────────┐  ┌─────────────┐  ┌──────────┐
     │ API Lambda │  │ Worker Lambda│  │    S3    │
     │  (NestJS)  │  │  (NestJS)   │  │  + CDN   │
     └─────┬──────┘  └──────┬──────┘  └────┬─────┘
           │                │              │
     deploy-api.sh    deploy-api.sh   deploy-web.sh
     (same zip for both Lambdas)    (static export)
```

Both Lambda functions share the same deployment package. The entry point differs:
- API Lambda: `dist/src/lambda.handler` (HTTP requests via API Gateway)
- Worker Lambda: `dist/src/worker.handler` (async job processing)

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `Could not describe stack` | Deploy infrastructure first: `pnpm --filter @alliance-risk/infra cfn:deploy dev` |
| `CloudFrontDistributionId not found` | Redeploy the CloudFormation stack (output was added recently) |
| `Build did not produce out/` | Ensure `next.config.ts` has `output: 'export'` |
| Lambda timeout after deploy | Check CloudWatch logs: `/aws/lambda/alliance-risk-api` |
| Frontend shows old content | Wait 1-2 min for CloudFront invalidation, or check `deploy-web.sh` output for invalidation ID |
| `prisma migrate deploy` fails | Ensure `DATABASE_URL` is set and the RDS instance is reachable |
| `esbuild not found` | Run `pnpm install` — esbuild is a devDependency of `@alliance-risk/api` |
| Lambda crash: `Cannot find module 'X'` | A transitive dependency is missing from the external packages copy list. Add it to `EXTERNALS` and the copy logic in `deploy-api.sh` |
| Lambda crash: `(0, x.default) is not a function` | ESM/CJS interop issue — ensure `"esModuleInterop": true` in `packages/api/tsconfig.json` |
| CORS error on frontend login | Often a symptom of Lambda 500 crash, not an actual CORS issue. Check CloudWatch logs for the real error |
| 401 on `/api/auth/me` after deploy | `DATABASE_URL` env var missing on Lambda. Prisma falls back to `localhost` and JWT guard's user upsert fails. Check the CloudFormation template |
| `esbuild: Cannot resolve @nestjs/websockets` | Already handled — these are marked as external. If new optional NestJS deps appear, add them to the `EXTERNALS` array |

## Key Configuration Requirements

| Requirement | File | Why |
|-------------|------|-----|
| `esModuleInterop: true` | `packages/api/tsconfig.json` | Without this, `import express from 'express'` crashes at runtime in Lambda |
| `DATABASE_URL` env var | CloudFormation template (both Lambdas) | Without this, Prisma falls back to `localhost:5432` and all DB operations fail |
| `esbuild` in devDependencies | `packages/api/package.json` | Required for the bundling step in `deploy-api.sh` |
| `esbuild` in `onlyBuiltDependencies` | Root `package.json` | Allows esbuild's postinstall to run under pnpm strict mode |
