# AGENTS.md — CGIAR Risk Intelligence Tool

Agent operating guide for AI assistants working in this repository. Root rules apply everywhere; package-level guides add module-specific conventions.

---

## Constitutional Baseline (AKILI-SPECS)

Read these **before** implementing features or running `/akili-specify`, `/akili-execute`, or `/akili-test`:

| Document | Purpose | When to consult |
|----------|---------|-----------------|
| [`docs/prd.md`](docs/prd.md) | Product intent, personas, scope, success metrics | New features, scope questions, acceptance criteria |
| [`docs/ux-ui/design.md`](docs/ux-ui/design.md) | UI/UX system, tokens, flows, component inventory | All frontend work |
| [`docs/trd/trd.md`](docs/trd/trd.md) | Technical architecture, API, data model, NFRs | Backend, integration, security |
| [`docs/infrastructure.md`](docs/infrastructure.md) | AWS topology, deploy order, **local environment contract** | Deploy, infra, local stack setup |
| [`docs/specs/general-setup/`](docs/specs/general-setup/) | Templates for module specs (requirements, design, tasks) | Writing new specs |

Module specs live under `docs/specs/{domain|enhancement|bugfix|epic}/<module>/` with at minimum `requirements.md`, `design.md`, and `tasks.md`.

### Figma implementation detail

For pixel-level screen guides and token values, also use [`docs/figma-design/`](docs/figma-design/README.md) — the UX blueprint in `docs/ux-ui/design.md` references but does not duplicate this layer.

---

## Multi-Agent Personas (`.agents/`)

AKILI execution harness personas — read by `/akili-execute` and `/akili-test` Leaders:

| Persona | File | Role |
|---------|------|------|
| Leader | [`.agents/leader.md`](.agents/leader.md) | Orchestration, task selection, rework loop |
| Implementer | [`.agents/implementer.md`](.agents/implementer.md) | Code + verification |
| Reviewer | [`.agents/reviewer.md`](.agents/reviewer.md) | Diff-only spec audit (author ≠ auditor) |
| Tester | [`.agents/tester.md`](.agents/tester.md) | Per-suite test authoring/execution |

---

## Module Guides

Child guides extend (never replace) this file:

| Guide | Scope |
|-------|-------|
| [`packages/api/CLAUDE.md`](packages/api/CLAUDE.md) | NestJS layers, endpoints, guards, job handlers, Prisma |
| [`packages/web/CLAUDE.md`](packages/web/CLAUDE.md) | Next.js static export, routing, hooks, gap detector UX |
| [`packages/shared/CLAUDE.md`](packages/shared/CLAUDE.md) | Shared types, enums, Bedrock config |
| [`infra/CLAUDE.md`](infra/CLAUDE.md) | CDK stack, deploy commands, IAM |

Always read the child guide for the package you are editing.

---

## Before Implementing (Quick Reference)

1. Read constitutional docs above + relevant module spec in `docs/specs/`
2. Read package-level `CLAUDE.md`
3. Build shared first if types changed: `pnpm --filter @alliance-risk/shared build`
4. Start local stack per [`docs/infrastructure.md` § Local Environment](docs/infrastructure.md#6-local-environment)

---

## Model Routing

**Philosophy:** Match model capability to task demand — architecture and orchestration on deep-reasoning tiers; implementation on coder tiers; audit on a **different model** than the author (author ≠ auditor). Reserve frontier effort for propose/specify/verify and the orchestrating Leader. Fast/cheap models are for archive/formatting only — **`tasks.md` decomposition is T1, not cheap formatting**.

### Capability Tiers

| Tier | Name | Definition |
|------|------|------------|
| T1 | Architect | Architecture reasoning, task decomposition, live orchestration judgment |
| T2 | Coder | Implementation and test authoring throughput |
| T3 | Auditor | Independent deep review — must differ from Implementer model |
| T4 | Context-Ingest | Large-repo scanning and synthesis |
| T5 | Fast-Cheap | Formatting, archive, mechanical transforms |
| T6 | Multimodal | Image/diagram-heavy work |

### Phase → Tier Mapping

| Phase | Role | Tier | Notes |
|-------|------|------|-------|
| `/akili-constitution`, `/akili-specify` | Architect | T1 | Baseline and spec design |
| `/akili-execute` | Leader | T1 | Orchestration — no code |
| `/akili-execute` | Implementer | T2 | One task scope |
| `/akili-execute` | Reviewer | T3 | **Different model than Implementer** |
| `/akili-test` | Leader | T1 | Test orchestration |
| `/akili-test` | Tester | T2 | Prefer **different model than Implementer** |
| `/akili-validate` | Auditor | T3 | Spec/implementation alignment |
| Archive / formatting | — | T5 | Mechanical doc transforms |

### Model Registry

**Updated:** 2026-07

| Tier | Claude Code | OpenCode | Fallback |
|------|-------------|----------|----------|
| T1 Architect | `opus` | `<CONFIRM SLUG>` | `opus` |
| T2 Coder | `sonnet` | `<CONFIRM SLUG>` | `sonnet` |
| T3 Auditor | `opus` | `<CONFIRM SLUG>` | `opus` |
| T4 Context-Ingest | `haiku` | `<CONFIRM SLUG>` | `haiku` |
| T5 Fast-Cheap | `haiku` | `<CONFIRM SLUG>` | `haiku` |
| T6 Multimodal | `sonnet` | `<CONFIRM SLUG>` | `sonnet` |

To change models, edit only this registry table. Never pin a dated model name where a floating alias exists. Model selection is guidance in command prompts — enforced bindings live only in agent wrappers (not enabled in this project).

### Effort Dial

Effort is **per-task**, orthogonal to tier — tier picks the model, effort picks how hard it thinks.

| Signal | Effort |
|--------|--------|
| Trivial / mechanical | `low` |
| Standard scope | `medium` |
| Complex (algorithm, concurrency, security, ambiguity) | `xhigh` |
| Correctness-critical | `max` |

**Defaults by role:** T1 Leader/propose `high`; T2 Implementer/Tester `medium` (flex by task); T3 Reviewer `high`; T5 archive `low`.

**Rules:**
- **Rework:** bump effort one level on every retry
- **Tier↔effort:** never `max` a cheaper tier — escalate tier instead
- **Re-baseline:** effort defaults are per-generation; sweep when models change; under-specified tasks (`[~]` resume, post-Pivot) start one level higher
- **Effort is not a verbosity dial** — fix long reports in the brief, not by lowering effort

---

## Skill Map

During `/akili-specify`, derive each task's skills from this map. During `/akili-execute` and `/akili-test`, the Leader assigns skills; Implementer/Tester must load them before writing code or tests.

| Skill | Applies To | When to load |
|-------|------------|--------------|
| `nestjs-expert` | `packages/api/` | NestJS modules, guards, DTOs, services, job handlers |
| `api-design-principles` | API endpoints | New routes, request/response contracts, error shapes |
| `error-handling-patterns` | API + jobs | Exception filters, fail-closed validation, retry logic |
| `aws-serverless` | `infra/`, Lambda | CDK/CFN, Lambda config, deploy scripts, VPC |
| `shadcn-ui` | `packages/web/` | UI primitives, dialogs, forms, tables |
| `tailwind-design-system` | `packages/web/` | Tailwind v4 utilities, CSS variables, responsive layout |
| `vercel-react-best-practices` | `packages/web/` | React Query, App Router patterns, performance |
| `react-doctor` | `packages/web/` | React anti-patterns, hook hygiene (when available) |

**Not applicable (do not load):** `angular-developer` — this project uses Next.js/React.

---

## CodeGraph

**Status:** Not initialized — `codegraph` CLI not installed. Agents should use Explore subagents, `Grep`, and `Glob` for codebase analysis. If CodeGraph is added later, prefer graph lookups over bulk file reads (see `.agents/leader.md` Delegation Thresholds).

---

## Build & Test Commands

```bash
pnpm install
pnpm dev                    # API :3001 + Web :3000
pnpm build
pnpm test
pnpm lint
pnpm --filter @alliance-risk/api test -- --testPathPattern=<pattern>
pnpm --filter @alliance-risk/web test -- --testPathPattern=<pattern>
```

See [`CLAUDE.md`](CLAUDE.md) for deployment and migration commands.
