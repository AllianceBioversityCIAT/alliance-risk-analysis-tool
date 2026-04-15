# Installation Guide

Public-facing installation guide for the **CGIAR Agricultural Risk Intelligence Tool**. This document is written for someone who has not seen the codebase before and wants to get a local development environment running, or adapt the tool to a new AWS account.

For repo-native conventions and internal shortcuts, the authoritative source is the per-package `CLAUDE.md` files. This guide summarises what you need to get started.

---

## 1. Prerequisites

| Tool | Version | Why it is required |
|------|:-------:|--------------------|
| Node.js | **22.x** | Matches the AWS Lambda runtime; earlier versions will build locally but diverge in production behaviour |
| pnpm | **10.x** | Workspace manager for the three packages in this monorepo |
| PostgreSQL | **15.x** | Local database for development. A Docker image is fine. |
| AWS CLI | latest | Required for deploying to AWS and for the `run-sql` Worker action used by migrations |
| Git | recent | Standard |

Install pnpm globally if you do not already have it:

```bash
npm install -g pnpm
```

macOS users: install Node 22 via `nvm` or `fnm` and PostgreSQL 15 via Homebrew (`brew install postgresql@15`).

Linux users: prefer your distribution's Node 22 package or nvm. PostgreSQL 15 is available in Ubuntu LTS repositories (`apt install postgresql-15`).

## 2. Clone and install

```bash
git clone https://github.com/<your-org>/alliance-risk-analysis-tool.git
cd alliance-risk-analysis-tool
pnpm install
```

The first `pnpm install` will fetch approximately 1,400 dependencies across the three packages (NestJS, Next.js, Prisma, and all development tooling). On a typical broadband connection this takes 2–5 minutes.

## 3. Configure local environment variables

The API package uses an `.env` file at `packages/api/.env` (not committed). Create it:

```bash
cp packages/api/.env.example packages/api/.env
```

If no `.env.example` exists yet (some clones do not ship with one), create the file manually with the values below. All values are for the **local development case** — production credentials never live in this file.

```dotenv
# Local database (runs alongside your dev servers)
DATABASE_URL=postgresql://<your-user>@localhost:5432/alliance_risk

# Cognito — required for auth flows. Use the dev stack values or provision your own.
COGNITO_USER_POOL_ID=us-east-1_XXXXXXXXX
COGNITO_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx

# S3 bucket for file storage
S3_BUCKET_NAME=alliance-risk-files-<account-id>

# Optional (defaults are safe for local dev)
ENVIRONMENT=development
WORKER_FUNCTION_NAME=alliance-risk-worker

# Required for DOCX extraction feature flag (defaults to 'text' if missing)
DOCX_EXTRACTION_MODE=text
```

The frontend picks up AWS configuration from `NEXT_PUBLIC_*` env vars at build time. Locally, the dev server reads from `packages/web/.env.local` — again, not committed:

```dotenv
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_COGNITO_USER_POOL_ID=us-east-1_XXXXXXXXX
NEXT_PUBLIC_COGNITO_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx
```

## 4. Set up the local database

```bash
# 1. Create the database
createdb alliance_risk

# 2. Apply all Prisma migrations
pnpm --filter @alliance-risk/api exec prisma migrate deploy

# 3. Seed reference data (admin user + starter prompts)
npx --prefix packages/api tsx prisma/seed.ts
```

The seed creates an initial admin user whose credentials are printed to stdout. Save them — you will use these to sign in to the local web UI.

## 5. Run both dev servers

```bash
pnpm dev
```

This starts the API on `http://localhost:3001` and the Web UI on `http://localhost:3000`. You can also run them individually:

```bash
pnpm dev:api
pnpm dev:web
```

Open `http://localhost:3000`, log in with the seed admin credentials, and follow the analyst test protocol in [`docs/testing/analyst-test-protocol.md`](./docs/testing/analyst-test-protocol.md) to exercise the full pipeline.

## 6. Running the test suites

```bash
pnpm lint           # ESLint across all packages
pnpm build          # TypeScript + Next.js build
pnpm test           # Jest suites

# Target a single package
pnpm --filter @alliance-risk/api test
pnpm --filter @alliance-risk/web test

# Env-gated DOCX performance regression test
RUN_DOCX_PERF=1 pnpm --filter @alliance-risk/api test -- --testPathPattern=perf
```

## 7. Deploying to AWS (optional)

The tool is designed for AWS deployment via a single CloudFormation stack. Deployment requires an AWS account with:

- Bedrock access for the Moonshot AI Kimi K2.5 model in `us-east-1`
- Cognito, Lambda, API Gateway, S3, RDS, Textract, and CloudFront permissions
- An appropriate IAM profile configured locally (`aws configure sso` or `aws configure --profile <name>`)

### Initial stack provisioning

```bash
# 1. Deploy infrastructure (CloudFormation stack)
AWS_PROFILE=<your-profile> pnpm --filter @alliance-risk/infra cfn:deploy dev

# 2. Run database migrations via the Worker Lambda (RDS is in a private VPC)
AWS_PROFILE=<your-profile> pnpm migrate:remote

# 3. Deploy API + Worker Lambdas
AWS_PROFILE=<your-profile> pnpm deploy:api

# 4. Deploy the web bundle to S3 + invalidate CloudFront
AWS_PROFILE=<your-profile> pnpm deploy:web
```

### Subsequent code-only deployments

For code-only changes (no infrastructure or schema changes):

```bash
AWS_PROFILE=<your-profile> pnpm deploy:all
```

This runs `deploy:api`, `migrate:remote` (a no-op if there are no pending migrations), and `deploy:web` in sequence.

See the operational runbook at [`docs/runbooks/docx-extraction.md`](./docs/runbooks/docx-extraction.md) for an example of how to observe, toggle, and roll back a feature flag post-deploy without a code redeploy.

## 8. Common troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| `pnpm install` hangs at "approve-builds" prompt | pnpm interactive-build prompt | Approve by adding the package to `pnpm.onlyBuiltDependencies` in the root `package.json` |
| Web build fails with "Cannot find module 'prisma'" | Shared types have not been built | Run `pnpm --filter @alliance-risk/shared build`, then rebuild |
| API crashes locally with "Cannot find module `.prisma/client`" | Prisma client has not been generated | Run `pnpm --filter @alliance-risk/api exec prisma generate` |
| Cognito token fails verification locally | Dev mode uses decode-only verification (no JWKS fetch) — this is expected | Ensure `ENVIRONMENT=development` in `.env` |
| `pnpm deploy:api` hangs copying `@mixmark-io/domino` | Older versions of `scripts/deploy-api.sh` did not exclude test fixture directories. Update your branch — the exclude was added 2026-04-13. | `git pull origin main` and retry |
| Lambda returns 500 ("Cannot find module 'bluebird/js/release/promise'") | `bluebird` transitive dependency of `mammoth` is missing from the Lambda bundle | Confirm `bluebird` is in the `TRANSITIVE_DEPS` list of `scripts/deploy-api.sh` |

## 9. What next?

- Read [`CONTRIBUTING.md`](./CONTRIBUTING.md) if you plan to submit changes.
- Read [`docs/specs/`](./docs/specs/) for spec-driven development modules documenting every major feature area.
- Read [`CLAUDE.md`](./CLAUDE.md) at the repo root for the overall conventions and the per-package guides it links to.
- For operational dashboards and CloudWatch queries, see [`docs/runbooks/`](./docs/runbooks/).

## 10. Licensing

This project is released under the [Apache License 2.0](./LICENSE). The Alliance IBD Digital Platforms team confirmed Apache 2.0 as the project's licence on 2026-04-15. There are no pending licence decisions.
