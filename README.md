# CGIAR Risk Intelligence Tool

> Overview of the CGIAR Risk Intelligence Tool for agricultural SME risk assessment

The CGIAR Risk Intelligence Tool is a web-based platform designed to assess the risk profile of agricultural small and medium enterprises (SMEs) in Kenya. The system enables analysts to evaluate businesses across seven risk dimensions, generating comprehensive risk assessments and actionable recommendations.

## What It Does

The platform automates the risk assessment workflow from data intake to final report generation:

1. **Data Intake** — Analysts collect business information through three modes:
   - **Upload**: Extract data from business plan PDFs or DOCX files
   - **Guided Interview**: Step-by-step questionnaire for structured data collection
   - **Manual Entry**: Direct input of financial and operational data

2. **Gap Detection** — AI-powered validation identifies missing or incomplete data fields across all risk categories, ensuring data completeness before analysis.

3. **Risk Analysis** — The system scores the business across 7 risk categories with 35 total indicators (5 subcategories per category), each rated as High, Medium, or Low.

4. **Report Generation** — Generate downloadable PDF reports with risk scorecards, evidence-based narratives, and prioritized recommendations.

## Risk Assessment Model

Every assessment evaluates businesses across **7 risk categories**, each containing **5 subcategories** for a total of **35 risk indicators**:

| Category | Subcategories |
|----------|--------------|
| **Financial** | Revenue stability, cost management, credit access, liquidity, capital structure |
| **Climate-Environmental** | Weather exposure, climate adaptation, water access, biodiversity impact, carbon footprint |
| **Behavioral** | Management competence, governance practices, compliance, innovation capacity, stakeholder relations |
| **Operational** | Supply chain resilience, production capacity, technology adoption, HR management, quality control |
| **Market** | Demand volatility, competitive pressure, pricing power, distribution channels, regulatory environment |
| **Governance & Legal** | Legal structure, contract management, intellectual property, regulatory compliance, financial reporting |
| **Technology & Data** | IT infrastructure, data management, cybersecurity, digital tools adoption, analytics capabilities |

> **Scoring:** Each indicator uses a traffic light system — **High (Red)**, **Medium (Yellow)**, **Low (Green)**. The overall risk score is a weighted average across all 35 indicators.

## Who It's For

### Analysts

Primary users who create and manage risk assessments. Key capabilities:

- Create new assessments and select intake mode
- Upload business documents (PDF/DOCX) for automated parsing
- Review and correct data gaps identified by the system
- View risk scorecards with subcategory breakdowns
- Edit AI-generated recommendations for clarity and context
- Generate and download PDF reports
- Search and filter assessments on the dashboard

### Administrators

Full system access with additional management privileges:

- All analyst capabilities
- User management (create, edit, disable accounts)
- Prompt management for AI agents (parser, gap detector, risk analyzer, report generator)
- Version control and change tracking for prompts
- System configuration and monitoring

> **Note:** User roles are managed through AWS Cognito user groups. Users in the `admin` group have administrator privileges.

## Key Features

### Multi-Agent AI Pipeline

The platform uses **AWS Bedrock** with Claude 3.5 Sonnet v2 across four specialized agents:

```
Document Upload --> Parser Agent --> Gap Detector Agent --> Risk Analysis Agent --> Report Generator Agent --> PDF Report
```

| Agent | Responsibility |
|-------|---------------|
| **Parser Agent** | Extracts structured data from unstructured business documents |
| **Gap Detector Agent** | Validates completeness across all 35 risk indicators |
| **Risk Analysis Agent** | Scores each indicator and generates evidence-based narratives |
| **Report Generator Agent** | Creates formatted PDF reports with recommendations |

### Asynchronous Job Processing

Long-running AI operations use a fire-and-forget pattern:

1. API creates a Job record with status `PENDING`
2. Worker Lambda processes the job asynchronously
3. Frontend polls job status until `COMPLETED` or `FAILED`

```typescript
// Create a job (returns immediately with job ID)
POST /api/assessments/:id/documents/:documentId/parse

// Poll job status
GET /api/jobs/:jobId
// Response:
{
  id: string,
  type: 'PARSE_DOCUMENT' | 'GAP_DETECTION' | 'RISK_ANALYSIS' | 'REPORT_GENERATION',
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED',
  result?: object,
  error?: string
}
```

### Real-Time Collaboration

- **Assessment Comments**: Add notes and observations to assessments
- **Prompt Comments**: Threaded discussions on AI prompt improvements (admin only)
- **Change History**: Track all modifications to prompts with version snapshots

### Data Security

| Area | Details |
|------|---------|
| **Authentication** | AWS Cognito with email-based authentication, password policies, and forgot-password flows |
| **Authorization** | Role-based access control with JWT tokens, session management, and auto-refresh |
| **Data Encryption** | RDS PostgreSQL with encryption at rest, Secrets Manager for credentials |
| **File Storage** | S3 with pre-signed URLs for secure upload/download, private bucket with VPC endpoints |

## Architecture

```
Frontend (Next.js) --> API Gateway --> API Lambda (NestJS)
                                           |-- Cognito (auth)
                                           |-- Prisma --> RDS PostgreSQL
                                           '-- JobsService --> Worker Lambda --> Bedrock
```

### Packages

> **Monorepo architecture** with pnpm workspaces:

| Package | Path | Stack | Description |
|---------|------|-------|-------------|
| `@alliance-risk/api` | `packages/api/` | NestJS 10, Prisma, AWS SDK | REST API, auth, prompt management, async jobs |
| `@alliance-risk/web` | `packages/web/` | Next.js 15, React 19, Tailwind, shadcn/ui | SPA with static export for S3 + CloudFront |
| `@alliance-risk/shared` | `packages/shared/` | TypeScript | Enums, types, constants shared across packages |
| `@alliance-risk/infra` | `infra/` | AWS CDK, CloudFormation | Infrastructure-as-code for all AWS resources |

### AWS Resources

- **Cognito** — User Pool with `admin` group, email-based auth
- **RDS PostgreSQL 15** — Primary database, credentials in Secrets Manager
- **API Lambda** — NestJS behind API Gateway HTTP API (30s timeout)
- **Worker Lambda** — Background job processor (15min timeout), ARM64 Node.js 22
- **S3** — File storage + static web hosting
- **CloudFront** — CDN with SPA fallback
- **Bedrock** — Claude 3.5 Sonnet v2 for all AI agents

## Technology Stack

### Frontend

- **Next.js 15** with App Router and static export for S3 hosting
- **React 19** with TypeScript
- **Tailwind CSS** v4 for styling
- **shadcn/ui** component library
- **React Query** for server state management
- **React Hook Form** for form validation

### Backend

- **NestJS 10** REST API with TypeScript
- **Prisma** ORM with PostgreSQL
- **AWS SDK** for Bedrock, S3, Lambda, Cognito
- **AWS Lambda** on ARM64 architecture (Node.js 22)
- **API Gateway HTTP API** with 30-second timeout

### Infrastructure

- **AWS CloudFormation** / **CDK** for infrastructure as code
- **RDS PostgreSQL 15** in private VPC
- **CloudFront** CDN for web hosting
- **Cognito User Pool** for authentication
- **Bedrock** for AI model orchestration

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
        extractors/             # Document extractor strategy pattern
        database/               # Prisma service
        common/                 # Guards, decorators, exceptions, filters, utils
      prisma/
        schema.prisma           # Database schema
        migrations/             # SQL migrations
    web/                        # Next.js frontend
      src/
        app/
          (auth)/               # Login, forgot/change password
          (protected)/          # Authenticated routes (dashboard, gap detector)
          (admin)/              # Admin routes (users, prompt manager)
        components/
          ui/                   # shadcn/ui components
          auth/                 # Auth forms
          admin/                # User management
          assessment/           # Upload dropzone, business plan modal
          gap-detector/         # Document viewer, PDF viewer
          prompts/              # Prompt list, editor, preview, comments
        hooks/                  # use-prompts, use-users, use-job-polling, use-multi-document-status
        lib/                    # API client, token manager
        providers/              # Auth + React Query providers
    shared/                     # Shared enums, types, constants
      src/
        enums/                  # AgentSection
        types/                  # ApiResponse, auth, prompt, job, document types
        constants/              # Bedrock model config, risk categories, document constants
  infra/                        # Infrastructure
    lib/                        # CDK stack definition
    cfn/                        # Standalone CloudFormation templates
  docs/
    specs/                      # Spec-Driven Development docs
      general-setup/
        requirements.md         # What and why
        design.md               # How (architecture, data flow)
        task.md                 # Implementation plan
      enhancements/             # Enhancement specs (multi-file upload, etc.)
    api/
      openapi.yaml              # OpenAPI 3.0 specification
    figma-design/               # Design tokens, component patterns, screen guides
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

1. **`requirements.md`** — What are we building and why (functional + non-functional requirements)
2. **`design.md`** — How are we building it (architecture, data flow, API design)
3. **`task.md`** — Step-by-step implementation plan with dependencies and completion criteria

See `docs/specs/general-setup/` for the foundational module.

## Getting Help

- **Documentation**: [https://alliancebioversityciat-alliance-risk-analysis-tool.mintlify.app/introduction](https://alliancebioversityciat-alliance-risk-analysis-tool.mintlify.app/introduction)
- **Repository**: Internal CGIAR repository
- **Support**: Contact your system administrator for access issues or bug reports

## License

Proprietary. CGIAR / Alliance of Bioversity International and CIAT.
