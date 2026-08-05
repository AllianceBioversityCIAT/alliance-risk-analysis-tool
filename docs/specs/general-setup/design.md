# General Setup — Design Template

> **Purpose:** Canonical format for `design.md` in every module spec.  
> **Not a feature spec** — copy/adapt when running `/akili-specify`.

---

## 1. Document Control

| Field | Value |
|-------|-------|
| **Module** | `docs/specs/{taxonomy}/<module-name>` |
| **Requirements ref** | `requirements.md` |
| **Version** | 1.0 |
| **Date** | YYYY-MM-DD |

---

## 2. Design Structure

Every module `design.md` MUST contain these sections (omit only if truly N/A with explicit note):

### §1 Overview

- Problem summary (1 paragraph)
- Link to requirements IDs covered

### §2 Architecture & Data Flow

- Diagram (mermaid or ASCII) showing this module in the monorepo
- Entry points (controller routes, pages, job handlers)

### §3 Data Model Changes

- Prisma models/fields affected
- Migrations required (yes/no)
- JSON shape for job `input`/`result` if async

### §4 API Surface

| Method | Path | Auth | Request | Response |
|--------|------|------|---------|----------|

- DTOs with validation rules
- Error responses (status codes, `invalidFields` pattern)

### §5 Backend Logic

- Service methods and business rules
- Job handler registration (if applicable)
- Bedrock prompt section (`AgentSection`) and config reference

### §6 Frontend Changes

- Routes (query-param pattern: `?id=`)
- Components (under `packages/web/src/components/<feature>/`)
- React Query hooks (`packages/web/src/hooks/`)
- Design token compliance — cite `docs/ux-ui/design.md` sections

### §7 Integration Points

- AWS services touched (S3, Bedrock, Textract, Cognito)
- Shared types added to `@alliance-risk/shared`

### §8 Security & Authorization

- Guards required (JwtAuthGuard, AdminGuard)
- Ownership checks (jobs, assessments)

### §9 Error Handling

- Fail-open vs fail-closed decisions
- User-visible messages (toast copy guidelines)

### §10 Testing Strategy

- Unit test files and patterns
- Verification command: `pnpm --filter @alliance-risk/api test -- --testPathPattern=...`

### §11 Decision Records

| ID | Decision | Alternatives considered | Rationale |
|----|----------|------------------------|-----------|

---

## 3. Package Boundaries

Respect screaming architecture:

| Change type | Package |
|-------------|---------|
| Business rules | `packages/api/src/domain/` |
| Auth, jobs, admin | `packages/api/src/platform/` |
| AWS SDK wrappers | `packages/api/src/infrastructure/` |
| UI | `packages/web/src/` |
| Cross-boundary types | `packages/shared/src/` |
| IaC | `infra/` |

**Never** import domain → platform in reverse. Domain may import infrastructure via relative paths per `packages/api/CLAUDE.md`.

---

## 4. Async Job Design Pattern

When a module triggers AI or long I/O:

```
Controller → Service.createJob(type, input) → 202 { jobId }
Frontend → useJobPolling → terminal status → render result
Worker → Handler.handle → update Job COMPLETED/FAILED
```

Document: `JobType` enum value, handler class, input/result JSON schema.

---

## 5. Frontend Conventions

- API via `src/lib/api-client.ts` only
- Toasts via **sileo** (not sonner)
- shadcn/ui + Tailwind v4 utilities
- Forms: React Hook Form + Zod
- No dynamic `[id]` routes — use `useSearchParams().get('id')`

---

## 6. ADR Format (inline)

```markdown
### DD-MOD-NNN: Title

**Status:** Proposed | Accepted | Superseded  
**Context:** …  
**Decision:** …  
**Consequences:** …
```

Cross-link TRD ADRs when extending platform-wide decisions.

---

## 7. Design Review Checklist

- [ ] Matches TRD module boundaries and security model
- [ ] Model IDs from `BEDROCK_MODELS` — no hardcoded strings
- [ ] Shared types updated before API/Web implementation
- [ ] UX references design tokens, not raw hex values
- [ ] Migration path documented if schema changes
- [ ] Every claim about a file's current imports/exports/consumers is verified by reading that file directly, not assumed (KZ-003)
