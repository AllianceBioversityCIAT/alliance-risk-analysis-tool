# CLAUDE.md — @alliance-risk/infra

AWS CDK infrastructure and CloudFormation templates for the Alliance Risk platform.

## Commands

```bash
# CDK workflow
pnpm build            # tsc
pnpm synth            # cdk synth
pnpm deploy           # cdk deploy
pnpm diff             # cdk diff
pnpm test             # jest (snapshot tests)

# CloudFormation workflow (no CDK dependency required)
pnpm cfn:synth        # regenerate template from CDK
pnpm cfn:validate     # aws cloudformation validate-template
pnpm cfn:deploy       # bash cfn/deploy.sh (pass env: dev|staging|production)
```

## Structure

```
bin/
  app.ts                              # CDK app entry point
lib/
  alliance-risk-stack.ts              # Single stack — all resources
cfn/
  alliance-risk-stack.template.yaml   # Standalone CloudFormation template
  parameters.json                     # Environment-specific parameter overrides
  deploy.sh                           # Wrapper for aws cloudformation deploy
test/
  alliance-risk-stack.test.ts         # Snapshot test for template stability
```

## Stack Resources

Single stack (`AllianceRiskStack`) provisions:
- **Cognito** — User Pool, Client, `admin` group
- **RDS PostgreSQL 15** — `db.t3.micro`, credentials in Secrets Manager
- **API Lambda** — ARM64, 1024MB, Node.js 20, behind API Gateway HTTP API
- **Worker Lambda** — ARM64, 1024MB, 15min timeout, async invocation
- **API Gateway HTTP API** — 30s timeout, routes to API Lambda
- **S3** — file storage bucket + web hosting bucket
- **CloudFront** — SPA distribution with OAI, 403/404 fallback to `/index.html`
- **IAM** — Cognito, Bedrock, Textract, S3, Lambda:InvokeFunction policies

## Conventions

- One stack, one file (`lib/alliance-risk-stack.ts`) — do not split into nested stacks
- CDK and CloudFormation templates must stay in parity; after CDK changes run `pnpm cfn:synth`
- Environment variables for Lambdas are defined in the stack, not in `.env` files
- DB credentials go through Secrets Manager, never hardcoded
- All Lambdas use ARM64 architecture for cost optimization

## Two Deployment Paths

| Path | Tool | When to use |
|------|------|-------------|
| CDK | `pnpm deploy` | Development — requires Node.js + CDK CLI |
| CloudFormation | `pnpm cfn:deploy` | CI/CD or environments without CDK toolchain |

## Application Deployment

Deployment scripts live in `scripts/` (see `scripts/README.md` for full usage).

### API Deployment (`scripts/deploy-api.sh`)

Uses **esbuild** to bundle the NestJS API into single-file CJS bundles for each Lambda entry point. Only ~18 external packages (Prisma + pg ecosystem) are copied unbundled.

**Why esbuild?** Reduces the deployment package from ~80MB to ~8MB and deploy time from 10+ minutes to <2 minutes. NestJS's 1,400+ `node_modules` packages are inlined into the bundle; only packages that cannot be bundled (WASM binaries, native addons, dynamic requires) remain external.

**External packages (cannot be bundled):**

| Package | Reason |
|---------|--------|
| `@prisma/client`, `.prisma/client` | Generated code with WASM binaries, dynamic requires |
| `@prisma/adapter-pg`, `@prisma/driver-adapter-utils`, `@prisma/client-runtime-utils`, `@prisma/debug` | `instanceof` checks require module identity; transitive deps |
| `pg`, `pg-pool`, `pg-cloudflare` | Native addon loading patterns, runtime `require()` |
| `@nestjs/microservices`, `@nestjs/websockets` | Optional NestJS deps (lazy `require()`, not installed) |

**Critical tsconfig requirement:** `packages/api/tsconfig.json` MUST have `"esModuleInterop": true`. Without it, `import express from 'express'` compiles to `express_1.default()` without the `__importDefault` wrapper, causing a runtime crash in Lambda.

### Web Deployment (`scripts/deploy-web.sh`)

Builds Next.js as a static export (`output: 'export'`) and syncs to S3 with two-tier caching:
- **Hashed assets** (JS, CSS, images): 1-year `max-age`, immutable
- **HTML, JSON**: `max-age=0, must-revalidate`

Creates a CloudFront invalidation (`/*`) after upload. Propagation takes 1-2 minutes.

### Lambda Environment Variables

Both Lambdas require these environment variables (defined in the CloudFormation template):

| Variable | Source | Notes |
|----------|--------|-------|
| `ENVIRONMENT` | Parameter | `dev`, `staging`, or `production` |
| `COGNITO_USER_POOL_ID` | `!Ref UserPool` | API Lambda only |
| `COGNITO_CLIENT_ID` | `!Ref UserPoolClient` | API Lambda only |
| `S3_BUCKET_NAME` | `!Ref FileBucket` | API Lambda only |
| `WORKER_FUNCTION_NAME` | `!Ref WorkerLambda` | API Lambda only |
| `CORS_ORIGIN` | Parameter | API Lambda only |
| `DATABASE_URL` | Constructed from Secrets Manager + RDS endpoint | **Both Lambdas** — critical, without it Prisma falls back to `localhost` |
| `AWS_ACCOUNT_ID` | `!Ref AWS::AccountId` | Both Lambdas |

**`DATABASE_URL` construction pattern in CloudFormation:**
```yaml
DATABASE_URL: !Sub
  - "postgresql://${Username}:${Password}@${Host}:5432/alliance_risk"
  - Username: postgres
    Password: !Sub "{{resolve:secretsmanager:${DbSecret}:SecretString:password}}"
    Host: !GetAtt Database.Endpoint.Address
```

### Deployment Order

```
1. Deploy infrastructure:   pnpm --filter @alliance-risk/infra cfn:deploy dev
2. Run database migrations:  pnpm migrate:deploy
3. Deploy API:               pnpm deploy:api
4. Deploy frontend:          pnpm deploy:web
```

Steps 1-2 are only needed when infrastructure or schema changes.

### Troubleshooting Lambda Crashes

If the Lambda returns HTTP 500 (often masked as a CORS error on the frontend):

1. Check CloudWatch logs: `/aws/lambda/alliance-risk-api` or `/aws/lambda/alliance-risk-worker`
2. Common causes:
   - **Missing module**: A transitive dependency was not included in the external packages list. Add it to `EXTERNALS` and the copy logic in `deploy-api.sh`.
   - **`(0, x.default) is not a function`**: ESM/CJS interop issue. Ensure `esModuleInterop: true` in `tsconfig.json`.
   - **Prisma connection failure**: `DATABASE_URL` env var missing on the Lambda. Check CloudFormation template and Lambda configuration.

## TypeScript

- Strict mode enabled
- CommonJS module system
- `ts-node` used by CDK CLI to run `bin/app.ts` directly
