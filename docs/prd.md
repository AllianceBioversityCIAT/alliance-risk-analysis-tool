# Product Requirements Document — CGIAR Risk Intelligence Tool

> **Status:** Living document (MVP baseline)  
> **Last updated:** 2026-07-27  
> **Geography:** Kenya, Ethiopia, Nigeria, Zambia (multi-country enablement, 2026-07)

---

## 1. Overview & Purpose

The **CGIAR Risk Intelligence Tool** is a web platform that helps CGIAR Alliance analysts assess agricultural SME risk profiles. Analysts upload business documents; the system validates data completeness, scores risk across seven categories and 35 indicators, and produces evidence-based narratives with a downloadable PDF report.

The product automates a workflow that is today manual, inconsistent, and slow — giving analysts a repeatable, auditable assessment pipeline backed by AI agents on AWS Bedrock.

---

## 2. Problem Statement

Agricultural SME risk assessments require synthesizing fragmented business documents, checking field completeness, scoring multiple risk dimensions, and writing structured reports. Today this work is:

- **Labor-intensive** — analysts manually extract and validate enterprise fields from PDFs and Word documents
- **Inconsistent** — scoring and narrative quality vary by analyst and session
- **Slow** — end-to-end assessment cycles stretch across days when document parsing and gap review are manual
- **Hard to audit** — recommendations and evidence trails are not systematically captured

Analysts need a guided tool that ingests documents, flags gaps, scores risk with transparent evidence, and exports a stakeholder-ready PDF — without replacing human judgment on final recommendations.

---

## 3. Target Personas

| Persona | Role | Jobs to be done |
|---------|------|-----------------|
| **Risk Analyst** | Primary user | Create assessments, upload documents, review gap fields, edit AI recommendations, download PDF reports |
| **Platform Administrator** | Secondary user | Manage Cognito users/groups, author and version AI prompts, preview agent output, configure system behavior |
| **CGIAR Program Lead** | Stakeholder (indirect) | Receive consistent risk reports for portfolio decisions; not a daily app user in MVP |

### Analyst workflow (happy path)

1. Log in → create assessment on dashboard
2. Upload business plan (PDF/DOCX/etc.)
3. Review 10 core gap fields; edit and re-run until VERIFIED
4. Submit for risk analysis → review 7 category scorecards
5. View web report → download PDF

---

## 4. Goals & Success Metrics

### North Star Metric

**Time from document upload to downloadable PDF report** — median under 30 minutes for a standard single-document assessment (excluding analyst review time at gap and scorecard stages).

### Supporting metrics

| Metric | Target (MVP) | Measurement |
|--------|--------------|-------------|
| Core pipeline completion rate | ≥ 80% of started assessments reach PDF | DB: `Assessment.status` funnel |
| Gap field auto-verification rate | ≥ 60% of fields VERIFIED on first parse | `GapField.status` on first gap run |
| Analyst edit rate on recommendations | Track baseline; no hard target in MVP | `Recommendation` update count |
| PDF generation success rate | ≥ 95% | `Job` type `REPORT_GENERATION` COMPLETED vs FAILED |
| Platform availability (dev/staging) | 99% during business hours | CloudWatch / synthetic checks |

---

## 5. Scope

### In scope (MVP)

- Email/password auth via AWS Cognito (admin-managed users)
- Assessment CRUD and dashboard statistics
- Document upload (PDF via Textract; DOCX/XLSX/CSV/HTML/MD/TXT in-process)
- Gap detection on 10 core enterprise fields with analyst edit + AI re-validation
- Risk analysis across 7 categories × 5 subcategories (35 indicators)
- Report generation (web view + PDF download)
- Admin: user management, prompt CMS (versioning, preview, comments, history)
- Async job polling pattern for all long-running AI operations
- Multi-country support: Kenya, Ethiopia, Nigeria, Zambia

### Out of scope (MVP)

- Guided interview intake mode (designed, not deployed)
- Manual data entry intake mode (designed, not deployed)
- Multi-country localization and country-specific risk models
- Weighted overall score (MVP uses unweighted mean of 7 categories — see TRD ADR)
- Direct frontend-to-Bedrock calls
- Self-service user registration
- Real-time WebSocket job updates (polling only)
- Mobile-native apps

---

## 6. User Stories

| ID | As a… | I want to… | So that… |
|----|-------|------------|----------|
| US-01 | Analyst | log in securely | only authorized staff access assessments |
| US-02 | Analyst | create a new assessment from the dashboard | I can start a fresh risk review |
| US-03 | Analyst | upload business documents | the system extracts text for analysis |
| US-04 | Analyst | see which of 10 core fields are missing or partial | I know what data to collect or fix |
| US-05 | Analyst | edit gap fields and re-run detection | AI validation confirms substantive answers |
| US-06 | Analyst | submit for risk analysis when all fields pass | the business is scored across 7 categories |
| US-07 | Analyst | review category scores, evidence, and recommendations | I can apply professional judgment before reporting |
| US-08 | Analyst | edit individual recommendations | the final report reflects analyst expertise |
| US-09 | Analyst | view and download a PDF report | I can share results with stakeholders |
| US-10 | Admin | manage users and admin group membership | access control stays current |
| US-11 | Admin | author, version, and preview AI prompts | agent behavior is tunable without redeploy |
| US-12 | Admin | see prompt change history and comments | prompt edits are auditable |

---

## 7. Acceptance Criteria

### Core pipeline

- **AC-01:** Given valid credentials, analyst reaches dashboard within 5 seconds of login on dev environment
- **AC-02:** Given a PDF upload, parse job completes and extracted text is visible in gap detector document viewer
- **AC-03:** Given all 10 gap fields VERIFIED, submit succeeds and risk analysis job is created
- **AC-04:** Given partial/invalid edited fields, submit returns 400 with per-field feedback; UI highlights affected fields
- **AC-05:** Given completed risk analysis, scorecard shows 7 categories with level, score, narrative, and recommendations
- **AC-06:** Given completed report generation, PDF download returns a valid PDF stored in S3

### Admin

- **AC-07:** Non-admin users receive 403 on all `/api/admin/*` routes
- **AC-08:** Prompt preview returns job ID; polling resolves to AI output or FAILED with error message

### Security

- **AC-09:** Frontend never calls Bedrock or Textract directly — all AI via authenticated API
- **AC-10:** Job polling enforces ownership — users cannot read other users' jobs

---

## 8. Assumptions, Dependencies, & Constraints

### Assumptions

- Analysts have stable internet and modern browsers (Chrome/Edge/Firefox current −1)
- Business documents are primarily English for Kenya MVP
- AWS Bedrock (Moonshot Kimi K2.5) remains available in target region
- Cognito admin creates all user accounts (no self-signup)

### Dependencies

- AWS: Cognito, API Gateway, Lambda, RDS PostgreSQL, S3, CloudFront, Bedrock, Textract, Secrets Manager
- pnpm monorepo: `@alliance-risk/api`, `@alliance-risk/web`, `@alliance-risk/shared`, `@alliance-risk/infra`

### Constraints

- Next.js static export — no dynamic `[id]` routes; use query params (`?id=`)
- RDS in private VPC — migrations via `pnpm migrate:remote`, not direct local connection to prod
- Model IDs centralized in `@alliance-risk/shared` — never hardcoded in services
- ESLint 8.x (compatibility with Next and TypeScript ESLint)

---

## 9. Open Questions

| # | Question | Owner | Impact |
|---|----------|-------|--------|
| OQ-01 | When will weighted scoring replace unweighted mean? | Product | Report comparability across releases |
| OQ-02 | Which countries follow Kenya in expansion? | Program | Prompt and field localization |
| OQ-03 | Should guided interview ship before or after multi-country? | Product | Intake UX roadmap |
| OQ-04 | Production custom domain and CORS lock-down timeline? | Infra | Security hardening |
| OQ-05 | OpenAPI spec restoration — regenerate from NestJS or maintain manually? | Engineering | API contract docs |
