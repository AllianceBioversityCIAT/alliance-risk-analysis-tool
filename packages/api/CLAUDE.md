# CLAUDE.md — @alliance-risk/api

NestJS 10 backend (CommonJS, port 3001).

## Commands

```bash
pnpm dev              # nest start --watch
pnpm build            # nest build
pnpm test             # jest
pnpm test -- --testPathPattern=<pattern>
pnpm lint             # eslint "{src,test}/**/*.ts"
pnpm test:e2e         # jest --config ./test/jest-e2e.json
```

## Structure

```
src/
  main.ts                  # Entry point (port 3001)
  app.module.ts            # Root module
  app.controller.ts        # Health endpoint
  app.service.ts           # Health service
  router/models/           # Bedrock model providers (one per model)
test/
  unit/                    # Unit tests
  integration/             # Integration tests
  jest-e2e.json            # E2E test config
```

## Conventions

- **Module → Service → Controller** pattern for all features
- DTOs for all controller input/output
- Each Bedrock model is a provider in `src/router/models/`
- Do not hardcode model IDs; use `bedrock.config.ts`
- Tests required for all routing and scoring logic
- Test files use `.spec.ts` suffix, colocated with source in `src/`

## TypeScript

- Strict mode enabled
- `emitDecoratorMetadata` + `experimentalDecorators` required for NestJS DI
- CommonJS module system (`"module": "commonjs"`)

## ESLint

- `@typescript-eslint/recommended` rules
- Config in `.eslintrc.js`
