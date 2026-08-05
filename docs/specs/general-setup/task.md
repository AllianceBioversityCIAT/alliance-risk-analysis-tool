# General Setup — Task Template

> **Purpose:** Canonical format for `tasks.md` (or `task.md`) in every module spec.  
> **Not a feature spec** — copy/adapt when running `/akili-specify`.

---

## 1. Document Control

| Field | Value |
|-------|-------|
| **Module** | `docs/specs/{taxonomy}/<module-name>` |
| **Requirements** | `requirements.md` |
| **Design** | `design.md` |
| **Version** | 1.0 |

---

## 2. Legend

### Status Markers

| Marker | Meaning |
|--------|---------|
| `[ ]` | Not started |
| `[~]` | In progress / blocked |
| `[x]` | Complete |
| `[!]` | Blocked (external dependency) |

### Expertise Tags

| Tag | Scope |
|-----|-------|
| `[BE]` | `packages/api/` |
| `[FE]` | `packages/web/` |
| `[SHARED]` | `packages/shared/` |
| `[INFRA]` | `infra/` |
| `[DOCS]` | Documentation only |

### Size Hints

| Size | Guidance |
|------|----------|
| S | ≤ 1 file, ≤ 2 hours |
| M | 2–5 files, half day |
| L | 5+ files or cross-package |

---

## 3. Task Entry Format

```markdown
### T-NNN: Task title `[BE|FE|...]`

- **Status:** `[ ]`
- **Skills:** `nestjs-expert`, `shadcn-ui` (from project Skill Map)
- **Size:** S | M | L
- **Dependencies:** T-NNN, T-MMM (or None)
- **Requirements:** FR-MOD-001, NFR-MOD-010
- **Design Ref:** §4 API Surface, §6 Frontend
- **Scope:**
  - Bullet list of concrete deliverables
  - Explicit file paths when known
- **Tests:** What to add/update; test file paths
- **Verification:** `pnpm --filter @alliance-risk/api test -- --testPathPattern=foo`
- **Done when:** Observable completion criteria (not just "implemented")
```

---

## 4. Dependency Graph

Express phases and parallelism explicitly:

```markdown
## Phase A: Foundation (sequential)
T-001 → T-002 → T-003

## Phase B: Core (parallel after T-003)
T-004 ─┐
T-005 ─┼─ parallel (different packages)
T-006 ─┘

## Phase C: Integration (sequential)
T-007 depends on T-004, T-005, T-006
```

**Leader rule:** Only parallelize tasks touching **different files/domains**. See `.agents/leader.md` Delegation Thresholds.

---

## 5. Execution Conventions (`/akili-execute`)

### File: `execution.md`

Created on first execute run. Append-only audit trail:

```markdown
## Task T-NNN — Attempt 1
- **Implementer:** summary
- **Verification:** command + result
- **Reviewer:** PASS | FAIL
- **Files:** list
- **Notes:** …
```

### Commits

Format: `[SPEC:<spec-path>] <imperative message>`

Example: `[SPEC:enhancements/upload-word-documents] hoist mammoth imports to module top`

### Status transitions

```
[ ] → [~]  when Leader assigns Implementer
[~] → [x]  on Reviewer PASS + verification green
[~] → [ ]  on rollback after 3 FAILs (with user guidance)
```

---

## 6. Testing Expectations (`/akili-test`)

| Suite | Command | Owner |
|-------|---------|-------|
| API unit | `pnpm --filter @alliance-risk/api test -- --testPathPattern=<pattern>` | Tester (backend-unit) |
| Web unit | `pnpm --filter @alliance-risk/web test -- --testPathPattern=<pattern>` | Tester (frontend-unit) |
| Lint | `pnpm lint` | Implementer pre-review |
| Full suite | `pnpm test` | Pre-merge validation |

Map each requirement scenario to a test in the validation matrix (`/akili-validate`).

---

## 7. Verification Commands (project defaults)

```bash
# Build (shared first)
pnpm --filter @alliance-risk/shared build
pnpm build

# Lint all
pnpm lint

# Test all
pnpm test

# Single package
pnpm --filter @alliance-risk/api test
pnpm --filter @alliance-risk/web test
```

---

## 8. Task Plan Checklist

Before approving tasks.md:

- [ ] Every FR/NFR from requirements.md maps to ≥1 task
- [ ] Each task has explicit verification command
- [ ] Dependencies form a DAG (no cycles)
- [ ] Skills listed match project Skill Map
- [ ] Cross-package tasks ordered: shared → api → web
- [ ] Infra/migration tasks precede code that depends on schema
- [ ] A foundation task's "Done when" never requires full-package build/typecheck success before a dependent consumer task lands — scope it to the task's own files/tests (KZ-004)
