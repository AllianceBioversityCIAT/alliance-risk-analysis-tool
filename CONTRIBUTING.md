# Contributing to the CGIAR Risk Intelligence Tool

Thank you for considering a contribution. This project is maintained by the Alliance of Bioversity International & CIAT for CGIAR partner teams, and we welcome feedback, bug reports, and code contributions from anyone working on agricultural SME risk assessment.

This guide covers how to get a development environment running, how we expect code to be structured, and what to do when you open a pull request.

## Code of Conduct

By participating in this project you agree to uphold the project [Code of Conduct](./CODE_OF_CONDUCT.md). Please read it before opening issues or pull requests.

## Ways to contribute

- **Report a bug** — open a GitHub issue with steps to reproduce, expected vs observed behaviour, and your environment.
- **Propose a feature** — open a GitHub issue using the "Feature request" template; discuss scope with maintainers before starting significant work.
- **Improve documentation** — the `docs/` tree is open for small fixes via PR without prior discussion.
- **Submit code** — see the workflow below.

## Development setup

Full step-by-step instructions live in [INSTALL.md](./INSTALL.md). The short version:

```bash
# 1. Clone and install
git clone https://github.com/<org>/alliance-risk-analysis-tool.git
cd alliance-risk-analysis-tool
pnpm install

# 2. Configure local env (see INSTALL.md for details)
cp packages/api/.env.example packages/api/.env
# edit DATABASE_URL, COGNITO_*, S3_BUCKET_NAME

# 3. Migrate + seed the local database
pnpm --filter @alliance-risk/api exec prisma migrate deploy
npx --prefix packages/api tsx prisma/seed.ts

# 4. Run the dev stack
pnpm dev            # API on :3001, Web on :3000
```

## Repository layout

This is a pnpm monorepo with three packages plus infrastructure:

| Path | Role |
|------|------|
| `packages/api/` | NestJS backend (runs locally on port 3001; deployed as AWS Lambda) |
| `packages/web/` | Next.js 15 frontend with static export (runs on port 3000; deployed to CloudFront) |
| `packages/shared/` | Zero-dependency TypeScript types, enums, and constants shared between API and Web |
| `infra/` | AWS CDK + CloudFormation templates |
| `docs/specs/` | Spec-driven development docs per module (requirements, design, tasks) |
| `docs/runbooks/` | Operational runbooks |
| `docs/figma-design/` | Design system documentation (tokens, component patterns, per-screen guides) |

Before writing code, read the relevant `CLAUDE.md` file for the package you're touching:

- Root: `./CLAUDE.md`
- API: `packages/api/CLAUDE.md`
- Web: `packages/web/CLAUDE.md`
- Shared: `packages/shared/CLAUDE.md`
- Infra: `infra/CLAUDE.md`

These files are the authoritative conventions — they always reflect the current codebase.

## Branching and commits

- Create a feature branch from `main`: `git checkout -b feat/my-feature` (prefixes: `feat/`, `fix/`, `docs/`, `chore/`, `refactor/`).
- Keep pull requests focused. One feature, one PR.
- We use [Conventional Commits](https://www.conventionalcommits.org/) — at a minimum, commit messages must begin with `feat:`, `fix:`, `docs:`, `chore:`, `style:`, `refactor:`, `test:`, or `build:`. Scopes in parentheses are encouraged: `fix(docx): ...`.
- Sign off your commits if contributing from a CGIAR-affiliated organisation that requires DCO.

## Testing before you push

Every contribution must pass:

```bash
pnpm lint        # ESLint across all packages
pnpm build       # tsc + nest build + next build
pnpm test        # Jest suites across all packages
```

Feature-specific expectations:

- **Backend changes** — add / update Jest specs under `packages/api/src/**/*.spec.ts`. Follow the patterns in existing specs. If you change an extractor, run the env-gated perf spec: `RUN_DOCX_PERF=1 pnpm --filter @alliance-risk/api test -- --testPathPattern=perf`.
- **Frontend changes** — add component tests under `packages/web/src/**/__tests__/` using Testing Library.
- **Infrastructure changes** — update the CDK mirror in `infra/lib/alliance-risk-stack.ts` and re-run `pnpm cfn:synth`. The template + CDK must stay in parity.
- **Database changes** — create a Prisma migration via `pnpm --filter @alliance-risk/api exec prisma migrate dev --name <concise-name>` and commit both the schema and the generated SQL.

## Pull request checklist

Before requesting review, confirm:

- [ ] Branch is rebased against latest `main`
- [ ] `pnpm lint`, `pnpm build`, and `pnpm test` all pass locally
- [ ] If backend or infra changed, `pnpm --filter @alliance-risk/infra test` also passes
- [ ] Conventional Commits used throughout
- [ ] Code has at least one test for new behaviour (regression coverage)
- [ ] No secrets, real Cognito tokens, or real customer data in the diff
- [ ] Spec-driven development: if this is a multi-file change, there is a matching spec under `docs/specs/<module>/`
- [ ] `CHANGELOG.md` updated in the `Unreleased` section (user-facing changes only)
- [ ] Documentation: `CLAUDE.md` updated if you added a new convention or env var; `README.md` updated if the capability is visible to end users

## Security-sensitive contributions

Do **not** open a public issue if you've found a security vulnerability. Please follow the private reporting process documented in [SECURITY.md](./SECURITY.md).

## AI-generated code

We welcome AI-assisted contributions, but you are responsible for the code you submit:

- Verify generated code against real project patterns — do not merge code that contradicts the `CLAUDE.md` conventions for the package it touches.
- Do not submit contributions where the license provenance of training data is unclear (e.g., copyrighted code reproduced verbatim).
- Tests produced by an AI should be reviewed for meaningful assertions, not placeholder expectations.

## Review process

- Maintainers try to respond to pull requests within five business days.
- All PRs require at least one approval before merge.
- CI (see `.github/workflows/ci.yml`) must be green.
- For changes that touch the AWS infrastructure, an additional reviewer with AWS permissions is required.

## Scope and priorities

Active focus areas (2026-Q2):

1. Stabilising the Upload → Gap → Risk → Report pipeline for analyst UAT.
2. Closing documentation gaps for CGIAR open-source handover.
3. Guided-interview and manual-entry intake modes (pending product scope confirmation).

Out of scope for this release:

- Multi-country coverage (Kenya only for MVP).
- Report versioning, sharing via public link, multi-language reports, report comparison.

## License

By contributing, you agree that your contributions will be licensed under the project's [LICENSE](./LICENSE). The project is released under the **Apache License 2.0** — confirmed by the Alliance IBD Digital Platforms team on 2026-04-15.

## Contact

For non-security questions, the fastest path is a GitHub issue. For stakeholder-level coordination, contact the Alliance of Bioversity International & CIAT Digital Platforms team.
