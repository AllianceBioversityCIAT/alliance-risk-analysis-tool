# CGIAR Risk Intelligence Tool

Web platform for assessing the risk profile of agricultural SMEs in Kenya. Analysts upload business plans (PDF/DOCX), and the system extracts data, validates completeness, calculates risks across 7 dimensions, and generates a downloadable PDF report.

## Risk Model

7 categories x 5 subcategories = 35 risk indicators, each scored High / Medium / Low (traffic light):

| Category | Description |
|----------|-------------|
| Financial | Revenue, costs, credit, liquidity, capital |
| Climate-Environmental | Weather exposure, adaptation, water, biodiversity, carbon |
| Behavioral | Management competence, governance, compliance, innovation, stakeholder |
| Operational | Supply chain, production, technology, HR, quality |
| Market | Demand, competition, pricing, distribution, regulatory |
| Governance & Legal | Legal structure, contracts, IP, regulatory compliance, reporting |
| Technology & Data | IT infrastructure, data management, cybersecurity, digital tools, analytics |

## Architecture

```
Frontend (Next.js) --> API Gateway --> API Lambda (NestJS)
                                          |-- Cognito (auth)
                                          |-- Prisma --> RDS PostgreSQL
                                          '-- JobsService --> Worker Lambda --> Bedrock (9 agents, 7 KBs)
```

### Packages

| Package | Path | Stack | Description |
|---------|------|-------|-------------|
| `@alliance-risk/api` | `packages/api/` | NestJS 10, Prisma, AWS SDK | REST API, auth, prompt management, async jobs |
| `@alliance-risk/web` | `packages/web/` | Next.js 15, React 19, Tailwind, shadcn/ui | SPA with static export for S3 + CloudFront |
| `@alliance-risk/shared` | `packages/shared/` | TypeScript | Enums, types, constants shared across packages |
| `@alliance-risk/infra` | `infra/` | AWS CDK, CloudFormation | Infrastructure-as-code for all AWS resources |

### AWS Resources

- **Cognito** -- User Pool with `admin` group, email-based auth
- **RDS PostgreSQL 15** -- Primary database, credentials in Secrets Manager
- **API Lambda** -- NestJS behind API Gateway HTTP API (30s timeout)
- **Worker Lambda** -- Background job processor (15min timeout)
- **S3** -- File storage + static web hosting
- **CloudFront** -- CDN with SPA fallback
- **Bedrock** -- 9 AI agents using Claude 3.5 Sonnet v2

## Prerequisites

- **Node.js** >= 20
- **pnpm** >= 9
- **AWS CLI** configured (for infrastructure and Cognito)
- **PostgreSQL** (local dev) or RDS endpoint

## Getting Started

```bash
# Install dependencies
pnpm install

# Start both dev servers (API :3001 + Web :3000)
pnpm dev

# Or start individually
pnpm dev:api
pnpm dev:web
```

## Commands

```bash
# Development
pnpm dev                # Run API + Web concurrently
pnpm dev:api            # NestJS on http://localhost:3001
pnpm dev:web            # Next.js on http://localhost:3000

# Build
pnpm build              # Build all packages

# Test
pnpm test               # Test all packages
pnpm --filter @alliance-risk/api test -- --testPathPattern=<pattern>
pnpm --filter @alliance-risk/web test -- --testPathPattern=<pattern>

# Lint
pnpm lint               # Lint all packages

# Database
cd packages/api
npx prisma migrate dev  # Run migrations
npx prisma db seed      # Seed initial data
npx prisma studio       # Open Prisma Studio

# Infrastructure (CDK)
cd infra
pnpm synth              # Synthesize CloudFormation template
pnpm deploy             # Deploy stack
pnpm diff               # Preview changes

# Infrastructure (CloudFormation -- no CDK required)
cd infra
pnpm cfn:validate       # Validate template
pnpm cfn:deploy         # Deploy via aws cloudformation (pass env: dev|staging|production)
```

## Project Structure

```
alliance-risk-analysis-tool/
  packages/
    api/                        # NestJS backend
      src/
        auth/                   # Cognito auth (login, password flows)
        admin/                  # User + group management (admin-only)
        prompts/                # Prompt CRUD, versioning, comments, history
        jobs/                   # Async job processing (Bedrock calls)
        bedrock/                # AWS Bedrock SDK integration
        database/               # Prisma service
        common/                 # Guards, decorators, exceptions, filters, utils
      prisma/
        schema.prisma           # Database schema
        migrations/             # SQL migrations
    web/                        # Next.js frontend
      src/
        app/
          (auth)/               # Login, forgot/change password
          (protected)/          # Authenticated routes (dashboard)
          (admin)/              # Admin routes (users, prompt manager)
        components/
          ui/                   # shadcn/ui components
          auth/                 # Auth forms
          admin/                # User management
          prompts/              # Prompt list, editor, preview, comments
        hooks/                  # use-prompts, use-users, use-job-polling
        lib/                    # API client, token manager
        providers/              # Auth + React Query providers
    shared/                     # Shared enums, types, constants
      src/
        enums/                  # AgentSection
        types/                  # ApiResponse, auth, prompt, job types
        constants/              # Bedrock model config, risk categories
  infra/                        # Infrastructure
    lib/                        # CDK stack definition
    cfn/                        # Standalone CloudFormation templates
  docs/
    specs/                      # Spec-Driven Development docs
      general-setup/
        requirements.md         # What and why
        design.md               # How (architecture, data flow)
        task.md                 # Implementation plan (19 tasks)
```

## Environment Variables

The API Lambda expects these environment variables (set via CDK/CloudFormation stack):

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `COGNITO_USER_POOL_ID` | Cognito User Pool ID |
| `COGNITO_CLIENT_ID` | Cognito App Client ID |
| `COGNITO_REGION` | AWS region for Cognito |
| `WORKER_LAMBDA_NAME` | Name of the Worker Lambda function |
| `FILE_BUCKET_NAME` | S3 bucket for file uploads |
| `ENVIRONMENT` | `development`, `staging`, or `production` |

For local development, create a `.env` file in `packages/api/` (not committed to git).

## Spec-Driven Development

Every feature module follows SDD with three documents:

1. **`requirements.md`** -- What are we building and why (functional + non-functional requirements)
2. **`design.md`** -- How are we building it (architecture, data flow, API design)
3. **`task.md`** -- Step-by-step implementation plan with dependencies and completion criteria

See `docs/specs/general-setup/` for the foundational module.

## License

Proprietary. CGIAR / Alliance of Bioversity International and CIAT.
