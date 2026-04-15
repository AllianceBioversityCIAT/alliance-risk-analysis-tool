# CGIAR Risk Intelligence Tool

> AI-powered risk assessment for agricultural SMEs — Alliance of Bioversity International & CIAT.

The CGIAR Risk Intelligence Tool is a web-based platform that assesses the risk profile of agricultural small and medium enterprises. Analysts upload business documents, the system validates data completeness, scores the business across seven risk categories and 35 indicators, and generates a downloadable PDF report with evidence-based narratives and prioritised recommendations.

Current focus geography: **Kenya**. Multi-country coverage is future work.

## Project status

The MVP is **functionally complete for the core pipeline** (Upload → Gap Detection → Risk Analysis → PDF Report). For a full status breakdown — what's deployed, what's placeholder, what's deferred — see [`docs/specs/mvp-report/mvp-status-report.md`](./docs/specs/mvp-report/mvp-status-report.md).

| Lens | Estimate |
|------|:--------:|
| Functional pipeline coverage | ~85 % |
| Dev deployment readiness | 100 % |
| Open-source release readiness | ~95 % |

## What it does

The platform automates the risk-assessment workflow end-to-end:

1. **Data intake — document upload.** Analysts upload business plans as PDF (processed via AWS Textract) or DOCX/XLSX/CSV/HTML/Markdown/plain text (processed in-process by pure-Node libraries — mammoth, xlsx/SheetJS, turndown).
2. **Gap detection.** An AI agent validates that 10 core enterprise fields (business model summary, enterprise type, country, revenue model, cost drivers, supply chain overview, workforce summary, customer base, product description, key challenges) are present and substantive. Analysts edit flagged fields and re-run until all pass.
3. **Risk analysis.** A second AI agent scores the business across 7 categories × 5 subcategories = 35 indicators, assigning each a numeric score (0–100) and a level (LOW / MODERATE / HIGH / CRITICAL). It also produces narrative, evidence, and prioritised recommendations per category.
4. **Report generation.** A third AI agent produces the executive summary, strengths/weaknesses, action plan timeframes, and financial metrics. PDFKit renders a configurable PDF with radar chart, risk heatmap, financial overview, category detail pages, appendix, and disclaimer.

Guided-interview and manual-entry intake modes are **designed but not deployed** in the MVP.

## Risk model

Every assessment evaluates businesses across **7 categories × 5 subcategories = 35 indicators**:

| Category | Five subcategories (illustrative — authoritative list lives in `packages/shared/src/constants/risk-categories.ts`) |
|----------|-----------------------------------------------------------------------------------------------------------------|
| Financial | Revenue stability · cost management · credit access · liquidity · capital structure |
| Climate-Environmental | Weather exposure · climate adaptation · water access · biodiversity impact · carbon footprint |
| Behavioural | Management competence · governance practices · compliance · innovation capacity · stakeholder relations |
| Operational | Supply chain resilience · production capacity · technology adoption · HR management · quality control |
| Market | Demand volatility · competitive pressure · pricing power · distribution channels · regulatory environment |
| Governance & Legal | Legal structure · contract management · intellectual property · regulatory compliance · financial reporting |
| Technology & Data | IT infrastructure · data management · cybersecurity · digital tools adoption · analytics capabilities |

**Scoring:** Each indicator is scored `LOW / MODERATE / HIGH / CRITICAL` with a 0–100 numeric roll-up.

**Overall score calculation:** A **simple (unweighted) arithmetic mean** of the 7 category scores. This is an intentional MVP choice and is formally recorded as `DD-WEIGHTS` in [`docs/specs/risk-analyzer/design.md`](./docs/specs/risk-analyzer/design.md). A stakeholder-ratified weighted model is planned for a future release.

## Who it's for

### Analysts

Primary users. Analysts log in, create an assessment, upload business documents, review gap-detection output, edit AI-generated recommendations, and download the final PDF report.

### Administrators

Full analyst capabilities plus:

- User management (create, edit, disable accounts — managed through AWS Cognito user groups, where members of the `admin` group have administrator privileges)
- Prompt management for the AI agents (authoring, versioning, change history, live preview)
- System configuration

## AI pipeline

The platform uses **AWS Bedrock** with **Moonshot AI Kimi K2.5** across four specialised agents:

```
Document Upload → Parser (reserved) → Gap Detector → Risk Analysis → Report Generation → PDF Report
```

| Agent | Responsibility | Temperature |
|-------|----------------|:-----------:|
| Parser | Reserved for future structured parsing | — |
| Gap Detector | VERIFIED / PARTIAL / MISSING classification and validation of user-edited field values | 0.2 |
| Risk Analysis | Category scoring, evidence, narrative, per-category recommendations | 0.3 |
| Report Generation | Executive summary, strengths/weaknesses, action plan timeframes, financial metric extraction | 0.4 |

Model IDs and temperatures live in `packages/shared/src/constants/bedrock.config.ts`. The model registry is keyed by `AgentSection` so adding a new agent is a one-line change.

## Architecture

```
Frontend (Next.js static export on CloudFront)
    │
    ▼
  API Gateway HTTP API
    │
    ▼
  API Lambda (NestJS)
    ├── Cognito (auth)
    ├── Prisma → RDS PostgreSQL (private VPC)
    └── JobsService → invokes Worker Lambda (async)
                         │
                         └── Bedrock + Textract
```

Long-running AI operations follow a fire-and-forget pattern: the API creates a `Job` record with `PENDING`, invokes the Worker Lambda asynchronously, and the frontend polls `GET /api/jobs/:id` until the job reaches `COMPLETED` or `FAILED`.

### Packages

This is a pnpm monorepo. Each package has its own detailed conventions guide in a `CLAUDE.md` file at its root.

| Package | Path | Stack | Description |
|---------|------|-------|-------------|
| `@alliance-risk/api` | `packages/api/` | NestJS 10, Prisma 7, AWS SDK | REST API, auth, prompt management, async jobs |
| `@alliance-risk/web` | `packages/web/` | Next.js 15, React 19, Tailwind v4, shadcn/ui | SPA with static export for S3 + CloudFront |
| `@alliance-risk/shared` | `packages/shared/` | TypeScript | Enums, types, constants shared across API and Web |
| `@alliance-risk/infra` | `infra/` | AWS CDK + CloudFormation | Single-stack infrastructure-as-code |

### AWS resources

- **Cognito** — User Pool with `admin` group, email-based auth
- **RDS PostgreSQL 15** — primary database in a private VPC; credentials in Secrets Manager
- **API Lambda** — NestJS behind API Gateway HTTP API (30 s timeout)
- **Worker Lambda** — Background job processor (15 min timeout, ARM64, Node.js 22)
- **S3** — File storage + static web hosting
- **CloudFront** — CDN with SPA fallback
- **Bedrock** — Moonshot AI Kimi K2.5 for all AI agents
- **Textract** — OCR for PDF extraction only (non-PDF files bypass Textract)

## Getting started

A standalone, public-facing install guide lives at [`INSTALL.md`](./INSTALL.md). The short version for a developer who has the prerequisites installed:

```bash
# 1. Install
pnpm install

# 2. Configure local env in packages/api/.env (see INSTALL.md for keys)

# 3. Migrate + seed the local database
pnpm --filter @alliance-risk/api exec prisma migrate deploy
npx --prefix packages/api tsx prisma/seed.ts

# 4. Run both dev servers concurrently
pnpm dev            # API → :3001 · Web → :3000
```

## Prerequisites

| Tool | Version | Notes |
|------|:-------:|-------|
| Node.js | **22.x** | Matches the AWS Lambda runtime for parity |
| pnpm | **10.x** | Workspace manager |
| PostgreSQL | **15.x** | Local database for development |
| AWS CLI | latest | For deploys and the Worker Lambda `run-sql` action used by migrations |

## Commands

```bash
# Development
pnpm dev                # Run API + Web concurrently
pnpm dev:api            # NestJS on http://localhost:3001
pnpm dev:web            # Next.js on http://localhost:3000

# Build / test / lint
pnpm build              # Build all packages
pnpm test               # Jest suites across all packages
pnpm lint               # ESLint across all packages

# Target a single package
pnpm --filter @alliance-risk/api test
pnpm --filter @alliance-risk/web test

# Env-gated DOCX performance regression test
RUN_DOCX_PERF=1 pnpm --filter @alliance-risk/api test -- --testPathPattern=perf

# Database
pnpm --filter @alliance-risk/api exec prisma migrate deploy
pnpm migrate:remote     # Applies pending migrations on RDS via Worker Lambda
npx --prefix packages/api tsx prisma/seed.ts

# Infrastructure
pnpm --filter @alliance-risk/infra synth       # Regenerate CloudFormation template from CDK
pnpm --filter @alliance-risk/infra cfn:deploy dev   # Deploy via aws cloudformation

# Application deploy (dev, requires AWS_PROFILE)
AWS_PROFILE=<profile> pnpm deploy:api          # Build + bundle + update API + Worker Lambdas
AWS_PROFILE=<profile> pnpm deploy:web          # Build + sync to S3 + invalidate CloudFront
AWS_PROFILE=<profile> pnpm deploy:all          # Both in sequence
```

## Project structure

```
alliance-risk-analysis-tool/
├── README.md                           ← this file
├── CONTRIBUTING.md                     ← contribution workflow, commit conventions, PR checklist
├── CODE_OF_CONDUCT.md                  ← Contributor Covenant 2.1 (adopted by reference)
├── INSTALL.md                          ← public-facing install guide (developer + AWS deploy)
├── CHANGELOG.md                        ← Keep-a-Changelog format
├── CITATION.cff                        ← CFF 1.2.0 software citation metadata
├── SECURITY.md                         ← private disclosure process + known security characteristics
├── LICENSE                             ← Apache License 2.0
├── CLAUDE.md                           ← root developer playbook (internal conventions)
│
├── packages/
│   ├── api/                            ← NestJS backend + AWS Lambda entry points
│   │   ├── CLAUDE.md                   ← backend conventions
│   │   ├── src/
│   │   │   ├── main.ts                 ← local dev entry (port 3001)
│   │   │   ├── lambda.ts               ← API Lambda handler
│   │   │   ├── worker.ts               ← Worker Lambda handler
│   │   │   ├── domain/                 ← business logic (assessments, gap detection, risk, reports)
│   │   │   ├── platform/               ← auth, admin, prompts, async jobs
│   │   │   ├── infrastructure/         ← AWS SDK wrappers (Bedrock, Textract, S3, Prisma, extractors)
│   │   │   └── common/                 ← guards, decorators, exception filters, shared utilities
│   │   ├── prisma/                     ← schema + migrations + seed
│   │   ├── test/fixtures/              ← sample DOCX and other test inputs
│   │   └── scripts/                    ← migrate-remote, reprocess-failed-docx, smoke-pdf
│   │
│   ├── web/                            ← Next.js 15 frontend (static export to S3 + CloudFront)
│   │   ├── CLAUDE.md                   ← frontend conventions
│   │   └── src/
│   │       ├── app/                    ← route groups: (auth), (protected), (admin)
│   │       ├── components/             ← feature-scoped components + shadcn/ui primitives
│   │       ├── hooks/                  ← React Query + form hooks
│   │       ├── lib/                    ← api-client, token-manager
│   │       └── providers/              ← QueryClientProvider + AuthProvider
│   │
│   └── shared/                         ← zero-dependency shared types, enums, constants
│       └── CLAUDE.md
│
├── infra/
│   ├── CLAUDE.md                       ← infrastructure playbook
│   ├── cfn/alliance-risk-stack.template.yaml
│   └── lib/alliance-risk-stack.ts      ← CDK mirror
│
├── scripts/
│   ├── deploy-api.sh                   ← Builds + bundles + deploys both Lambdas
│   ├── deploy-web.sh                   ← Builds + syncs web to S3 + invalidates CloudFront
│   └── migrate-remote.sh               ← Runs Prisma migrations via Worker Lambda
│
├── .github/
│   └── workflows/ci.yml                ← install → build → lint → test
│
└── docs/
    ├── architecture/                    ← system-level diagrams and rationale
    ├── figma-design/                    ← design tokens, component patterns, per-screen guides
    ├── infrastructure/                  ← AWS + CI/CD deep dives (includes staging-setup.md)
    ├── plans/                           ← dated design plans (brainstorm outputs)
    ├── runbooks/                        ← operational how-to (docx-extraction.md, etc.)
    ├── testing/                         ← analyst-test-protocol.md + simulation-log.md
    └── specs/                           ← spec-driven development (one subdirectory per module)
        ├── general-setup/
        ├── upload-files/
        ├── gap-detector/
        ├── risk-analyzer/
        ├── report-generator/
        ├── enhancements/
        │   ├── upload-multi-files/
        │   ├── upload-multi-file-v2/
        │   └── upload-word-documents/
        ├── design-setup/
        ├── bugs/
        └── mvp-report/                  ← handover status report (MD + DOCX)
```

## Documentation map

- **Current project status** — [`docs/specs/mvp-report/mvp-status-report.md`](./docs/specs/mvp-report/mvp-status-report.md) (also available as `.docx`)
- **Setup and deployment** — [`INSTALL.md`](./INSTALL.md)
- **How to contribute** — [`CONTRIBUTING.md`](./CONTRIBUTING.md)
- **Security policy** — [`SECURITY.md`](./SECURITY.md)
- **Change history** — [`CHANGELOG.md`](./CHANGELOG.md)
- **Analyst testing** — [`docs/testing/analyst-test-protocol.md`](./docs/testing/analyst-test-protocol.md) + [`docs/testing/simulation-log.md`](./docs/testing/simulation-log.md)
- **Operational runbooks** — [`docs/runbooks/docx-extraction.md`](./docs/runbooks/docx-extraction.md)
- **Staging environment setup** — [`docs/infrastructure/staging-setup.md`](./docs/infrastructure/staging-setup.md)
- **Per-module specifications** — [`docs/specs/`](./docs/specs/)
- **Internal conventions (per-package)** — `CLAUDE.md` at the root and in each package

## Environment variables

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string |
| `COGNITO_USER_POOL_ID` | Cognito User Pool ID (API Lambda) |
| `COGNITO_CLIENT_ID` | Cognito App Client ID (API Lambda) |
| `S3_BUCKET_NAME` | File storage bucket (API Lambda) |
| `WORKER_FUNCTION_NAME` | Worker Lambda name (API Lambda) |
| `WORKER_ADMIN_TOKEN` | Authenticates the Worker's `run-sql`-style actions (Worker Lambda only) |
| `DOCX_EXTRACTION_MODE` | `text` (default) or `html` (legacy fallback). See [`docs/runbooks/docx-extraction.md`](./docs/runbooks/docx-extraction.md). |
| `ENVIRONMENT` | `development`, `staging`, or `production` |

Secrets live in AWS Secrets Manager — never in the repo. A `.env` file for local development is gitignored.

## Spec-Driven Development

Every feature module follows SDD with three documents:

1. `requirements.md` — what we're building and why (functional + non-functional requirements with stable IDs)
2. `design.md` — how we're building it (architecture, data flow, API design, design decisions)
3. `tasks.md` — step-by-step implementation plan with dependencies, requirement coverage, and acceptance criteria

See [`docs/specs/general-setup/`](./docs/specs/general-setup/) for the foundational module.

## Security

Please do **not** open public GitHub issues for security concerns. See [`SECURITY.md`](./SECURITY.md) for the private disclosure process.

## License

This project is released under the [Apache License 2.0](./LICENSE). Licence confirmed by the Alliance IBD Digital Platforms team on **2026-04-15**.

## Citation

If you use this software or its outputs in your research or reporting, please cite the package using the metadata in [`CITATION.cff`](./CITATION.cff).

## Contributing

Contributions are welcome. Start with [`CONTRIBUTING.md`](./CONTRIBUTING.md) for the full workflow, commit conventions, and PR checklist.

---

*Maintained by the Alliance of Bioversity International & CIAT — Digital Platforms team.*
