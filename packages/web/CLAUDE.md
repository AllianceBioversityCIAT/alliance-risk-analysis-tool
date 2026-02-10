# CLAUDE.md — @alliance-risk/web

Next.js 15 frontend with App Router (port 3000).

## Commands

```bash
pnpm dev              # next dev --port 3000
pnpm build            # next build
pnpm test             # jest --passWithNoTests
pnpm test -- --testPathPattern=<pattern>
pnpm lint             # next lint
```

## Structure

```
src/
  app/                     # App Router pages and layouts
    layout.tsx             # Root layout
    page.tsx               # Home page
    globals.css            # Global styles
  components/{feature}/    # Feature-scoped components
  hooks/                   # Custom React hooks
  lib/
    api-client.ts          # API client (all backend calls go through here)
```

## Conventions

- **NEVER talk directly to Bedrock** — always through the API via `src/lib/api-client.ts`
- Path alias: `@/*` maps to `src/*`
- Components organized by feature under `src/components/{feature}/`
- Test files use `.test.tsx` / `.test.ts` suffix

## Testing

- Jest via `next/jest` wrapper
- jsdom environment
- Testing Library (`@testing-library/react`, `@testing-library/jest-dom`)
- Setup file: `jest.setup.js`
- Config: `jest.config.js` (CommonJS — do NOT use `.ts`, avoids `ts-node` dependency)

## Styling

- Tailwind CSS v4 via `@tailwindcss/postcss`
- PostCSS config in `postcss.config.mjs`
- Global import: `@import "tailwindcss"` in `globals.css`
- Use Tailwind utility classes; avoid custom CSS unless necessary

## ESLint

- Extends `next/core-web-vitals`
- Config in `.eslintrc.json`
