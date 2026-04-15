# Changelog

All notable changes to the CGIAR Agricultural Risk Intelligence Tool are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

This changelog was seeded on **2026-04-15** from the `risk-analysis` branch at commit `502726c` (96 commits). Pre-MVP history is grouped by theme rather than per-commit.

---

## [Unreleased]

### Added

- `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `INSTALL.md`, `CITATION.cff`, `SECURITY.md` at repo root for open-source release readiness.
- `docs/testing/analyst-test-protocol.md` — step-by-step UAT script with error edge cases, Likert rating scale, and a 35-indicator analyst scoring sheet.
- `docs/testing/simulation-log.md` — consolidated log template for multi-session user-testing observations.
- `docs/infrastructure/staging-setup.md` — readiness guide for provisioning a staging environment (not yet provisioned).
- Design decision records in `docs/specs/risk-analyzer/design.md` documenting the unweighted-mean rollup (DD-WEIGHTS) and the AI-only risk-matrix threshold strategy (DD-RISKMATRIX) as intentional MVP choices.
- `.github/workflows/ci.yml` — baseline continuous integration workflow (install → build → lint → test across all three packages) on every push to `main` and pull request.

### Changed

- None in this release window.

### Fixed

- None in this release window.

---

## [0.1.0] — 2026-04-15 (MVP snapshot)

First tagged MVP snapshot. This release represents a functionally complete risk-assessment pipeline from document upload through to PDF report generation, suitable for internal user-acceptance testing.

### Infrastructure and toolchain

- pnpm monorepo with three workspaces — `@alliance-risk/api`, `@alliance-risk/web`, `@alliance-risk/shared` — plus an `infra/` package for CloudFormation + CDK.
- Node.js 22.x on AWS Lambda (ARM64), Next.js 15 static export on S3 + CloudFront, PostgreSQL 15 on RDS inside a private VPC.
- Single-stack CloudFormation template with a CDK parity mirror (`pnpm cfn:synth` keeps them aligned).
- Deployment scripts for code-only (`pnpm deploy:api`, `pnpm deploy:web`) and infrastructure (`pnpm cfn:deploy dev`) paths.
- Remote Prisma migrations via the Worker Lambda's authenticated `run-sql` action (RDS is not publicly accessible).

### Authentication and authorisation

- Cognito user pool with admin group.
- JWT-backed route guards (`JwtAuthGuard`, `AdminGuard`) across the API.
- Cross-tab token synchronisation in the web client.
- Rate limiting on sensitive auth endpoints (forgot-password, reset-password, change-password, admin reset-password).

### Prompt management

- Prompt CRUD with versioning, threaded comments, change history, and conflict detection.
- Live AI preview via asynchronous job polling.
- Bulk import/export of prompts as JSON.
- Variable injection (`{{category_N}}`, `{{categories}}`) evaluated at runtime.

### Document intake pipeline

- Multi-file upload with client-side queue, per-file retry, and drag-and-drop.
- Strategy-pattern extractor: PDFs routed through AWS Textract; DOCX/XLSX/CSV/HTML/Markdown/plain text handled in-process by the `ProgrammaticExtractor` (mammoth, xlsx/SheetJS, turndown).
- DOCX fast-path via `mammoth.extractRawText` (default); legacy HTML+turndown path preserved behind the `DOCX_EXTRACTION_MODE=html` feature flag for rollback.
- Structured JSON telemetry per extraction for CloudWatch Logs Insights queries (fields: `mime`, `fileName`, `mode`, `download_ms`, `extract_ms`, `total_ms`, `content_length`).
- Targeted rejection of legacy `.doc` binary format with an actionable user-facing error message.
- One-time backfill tooling (`reprocess-failed-docx.sh`) for re-queueing previously `FAILED` Word-MIME documents through the new path.

### Gap detection

- AI-powered validation over 10 core enterprise fields (business model summary, enterprise type, country of operation, product/service description, revenue model, cost drivers, supply chain overview, workforce summary, customer base, key challenges).
- Per-field `VERIFIED / PARTIAL / MISSING` classification with AI-produced validation feedback.
- Compact inbox with sticky action bar, filter pills (All / Needs Attention / Verified), and auto-re-analysis on manual edit.
- Guided cards with helper text per field.
- PDF highlighting with clustering for source-document evidence.

### Risk analysis

- Seven risk categories × five subcategories each = 35 scored indicators per assessment.
- Numeric score (0–100) and qualitative level (LOW / MODERATE / HIGH / CRITICAL) per category and subcategory.
- AI-generated evidence text, narrative, and recommendations per category.
- Analyst override of recommendations (isEdited flag, editedText column).
- Category re-calculation on analyst edit (RECALCULATE_CATEGORY job).
- Unweighted-mean rollup for the overall score (see DD-WEIGHTS in `docs/specs/risk-analyzer/design.md`).

### Report generation

- Configurable PDF with toggleable sections: company profile, executive summary, radar chart, risk heatmap, category detail pages, subcategory charts, financial overview, recommendations, action plan, evidence traces, methodology, appendix, disclaimer.
- Professional preset that enables all sections.
- Two-pass PDFKit rendering with accurate Table of Contents page numbers.
- Stage-based live progress card (Generating executive summary → Extracting financial metrics → Planning action timeline → Rendering PDF document → Uploading report).
- Action plan timeframes assigned via Bedrock with priority-based fallback.
- Financial metrics (Revenue, Costs, Margins) extracted and visualised as vertical bar chart, stacked horizontal bar, and margin pills with progress bars.
- Appendix tables (Document Sources, Gap Detection Summary, Detailed Evidence) with repeating headers on continuation pages and ellipsis-clipped long cells.
- Post-render verification: bundled tests assert that no phantom blank pages are generated, and page footers maintain `Page X of Y` continuity.

### Frontend experience

- Dashboard with workflow step completion indicators pulled from live assessment data.
- Responsive sidebar with breadcrumb trigger.
- shadcn/ui + Tailwind CSS v4 design system with icon mapping (Material → Lucide).
- Grouped and filterable key recommendations view.
- Report configuration dialog with scrollable body, locked-on Executive Summary and Disclaimer toggles, and accessible switch labelling.

### Security hardening

- VPC isolation for Lambdas with dedicated VPC endpoints for Cognito IDP, Bedrock Runtime, Textract, Lambda, and S3.
- Rate limiting on sensitive endpoints; job-polling routes exempted to prevent user-facing throttles.
- Admin-token authentication on the Worker Lambda `run-sql` action.
- No plaintext credentials in repo — all secrets managed in AWS Secrets Manager.
- SonarCloud clean gate (22 annotations addressed during late development cycles).
- Sentinel security findings addressed (user enumeration, rate-limit gaps).

### Observability

- Structured logging across both Lambdas with Nest's `Logger`.
- CloudWatch Insights query templates documented in `docs/runbooks/docx-extraction.md`.

---

## Notable pre-MVP milestones (week-by-week)

Derived from the 96 commits on the `risk-analysis` branch. Precise counts can be recomputed with `git log --since=... --pretty=format:"%ad" --date=format:"%G-%V" | sort | uniq -c`.

| Week (ISO YYYY-WW) | Theme |
|:------------------:|-------|
| 2026-W08 | Monorepo scaffold, shared types, NestJS + Next.js packages |
| 2026-W09 | Cognito auth, API response envelope, provider hook centralisation |
| 2026-W10 | Infrastructure CDK/CFN, API deploy script, Kimi K2.5 migration, OpenAPI docs |
| 2026-W11 | Multi-document upload, screaming architecture |
| 2026-W12 | Gap detector AI validation, UX filtering, guided cards |
| 2026-W13 | Risk analysis pipeline, PDF generation scaffolding |
| 2026-W14 | Report generator: data visualisations, config dialog, preview scroll |
| 2026-W15 | Report redesign: radar, heatmap, action plan, appendix; DOCX speed-up |
| 2026-W16 | DOCX `mammoth.extractRawText` path, reprocess tooling, deploy-script hardening |

---

## Conventions

- Public-facing entries (features analysts or stakeholders can observe) go under `Added / Changed / Fixed`. Internal refactors can be summarised in one line rather than enumerated.
- The `Unreleased` section accumulates work between tagged releases. At release time, rename it to the new version and date, and open a fresh `Unreleased` section.
- Security fixes that required a CVE are surfaced prominently and are never silently bundled into other categories.

[Unreleased]: https://github.com/<org>/alliance-risk-analysis-tool/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/<org>/alliance-risk-analysis-tool/releases/tag/v0.1.0
