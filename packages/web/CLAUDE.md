# CLAUDE.md — @alliance-risk/web

Next.js 15 frontend with App Router (port 3000). Static export for S3 + CloudFront hosting.

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
  app/
    layout.tsx                  # Root layout (QueryProvider > AuthProvider)
    page.tsx                    # Home page
    globals.css                 # Tailwind imports
    (auth)/
      login/page.tsx            # Login page
      forgot-password/page.tsx  # Two-step forgot password flow
      change-password/page.tsx  # Force change password (Cognito challenge)
    (protected)/
      layout.tsx                # ProtectedRoute guard (redirects unauthenticated)
      dashboard/page.tsx        # Dashboard
      assessments/
        gap-detector/page.tsx        # Gap detector page (SSR wrapper)
        gap-detector/gap-detector-client.tsx  # Gap detector client (validation, filtering, field management)
        risk-scorecard/page.tsx      # Risk scores display
        upload/page.tsx              # Document upload
        report/page.tsx              # Full report
        manual-entry/page.tsx        # Manual data entry
    (admin)/
      layout.tsx                # AdminRoute guard (redirects non-admin)
      admin/
        users/page.tsx          # User management (CRUD table)
        prompt-manager/
          page.tsx              # Prompt list with filters
          create/page.tsx       # Prompt editor (create mode)
          edit/page.tsx          # Prompt editor (edit mode, uses ?id= query param)

  components/
    ui/                         # shadcn/ui components (15 components)
    auth/
      login-form.tsx            # Email + password + remember me
      forgot-password-form.tsx  # Two-step: email → code + new password
      change-password-form.tsx  # New password with strength validation
    admin/
      user-management.tsx       # Paginated user table with filters
      create-user-modal.tsx     # Create user dialog
      edit-user-modal.tsx       # Edit user dialog (attributes, groups, reset)
    gap-detector/
      gap-field-card.tsx        # Individual field card (status badges, validation feedback, save)
      gap-layout.tsx            # Split-pane layout (document viewer + fields panel)
      document-viewer.tsx       # Markdown document preview with keyword highlighting
    prompts/
      prompt-list.tsx           # Grid of prompt cards
      prompt-card.tsx           # Summary card (name, section, version, active badge)
      prompt-filters.tsx        # Section, tag, search, route, is_active filters
      prompt-editor-form.tsx    # React Hook Form with all prompt fields
      prompt-preview-panel.tsx  # AI Preview via job polling
      comment-section.tsx       # View/add threaded comments
      change-history.tsx        # Version change timeline

  hooks/
    use-prompts.ts              # React Query hooks for prompt CRUD
    use-users.ts                # React Query hooks for user CRUD + groups
    use-job-polling.ts          # Polls GET /api/jobs/:id every 3s until terminal state
    use-gap-detection.ts        # React Query hooks for gap fields CRUD + re-analyze
    use-assessments.ts          # React Query hooks for assessment CRUD
    use-merged-content.ts       # Fetches merged document content for preview
    use-multi-document-status.ts # Polls document parsing status

  lib/
    api-client.ts               # Axios instance with Bearer token + 401 refresh interceptor
    token-manager.ts            # localStorage/sessionStorage with cross-tab sync
    utils.ts                    # cn() utility (clsx + tailwind-merge)

  providers/
    query-provider.tsx          # React Query client provider
    auth-provider.tsx           # AuthContext (user, isAuthenticated, isAdmin, login, logout)
```

## Conventions

- **NEVER talk directly to Bedrock** — always through the API via `src/lib/api-client.ts`
- Path alias: `@/*` maps to `src/*`
- Components organized by feature under `src/components/{feature}/`
- Tests use `__tests__/` directories colocated with source, suffix `.test.tsx` / `.test.ts`
- Forms use React Hook Form with `class-validator` or Zod validation
- All API calls go through the centralized Axios instance in `api-client.ts`
- Route groups: `(auth)` for public auth pages, `(protected)` for authenticated, `(admin)` for admin-only

## Provider Hierarchy

```
QueryClientProvider > AuthProvider > {pages}
```

## Route Guards

| Group | Guard | Behavior |
|-------|-------|----------|
| `(auth)/*` | None | Public, redirects to `/dashboard` if already authenticated |
| `(protected)/*` | `ProtectedRoute` | Redirects to `/login` if not authenticated |
| `(admin)/*` | `AdminRoute` | Redirects to `/dashboard` if not admin |

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

## Build Output

- `output: 'export'` in `next.config.ts` — static HTML/JS for S3 hosting
- `images: { unoptimized: true }` — required for static export

## Routing Constraint (Static Export)

**No dynamic `[id]` route segments.** With `output: 'export'`, Next.js requires all paths at build time via `generateStaticParams()`. Since assessment and prompt IDs are UUIDs created at runtime, dynamic segments cannot be pre-generated.

**Use query parameters instead:**

```tsx
// ✅ Correct — static-export compatible
// Route: /assessments/upload?id=<uuid>
import { useSearchParams } from 'next/navigation';
const id = useSearchParams().get('id');

// ❌ Wrong — breaks static export
// Route: /assessments/[id]/upload
import { useParams } from 'next/navigation';
const { id } = useParams();
```

**Navigation pattern:**
```tsx
router.push(`/admin/prompt-manager/edit?id=${prompt.id}`);
// NOT: router.push(`/admin/prompt-manager/edit/${prompt.id}`);
```

## Gap Detector Page

The gap detector (`gap-detector-client.tsx`) manages the field review workflow:

### Field Statuses
- **MISSING** — No data extracted or provided (red badge)
- **PARTIAL** — AI validation rejected the user's edit (amber badge + validation feedback)
- **VERIFIED** — AI confirmed the field content is substantive (green badge)

### Validation Flow
1. User edits fields and saves → optimistic update to VERIFIED
2. User clicks "Analyze Risks" → `POST /api/assessments/:id/gap-fields/submit`
3. API validates edited fields via Bedrock AI
4. If rejected → 400 with `invalidFields` array → toast + banner + filter auto-switches to "Needs Attention"
5. If passed → navigates to `/assessments/risk-scorecard?id=...`

### Filter Pill Tabs
Three filter pills above the field list: `All (N)` / `Needs Attention (N)` / `Verified (N)`. After validation rejection, auto-switches to "Needs Attention". Auto-resets to "All" when all issues resolved.

### Validation Alert Banner
Amber banner appears between heading and filters when validation rejects fields. Dismissable with X button. Auto-clears when no PARTIAL/MISSING fields remain.

### Data Completeness
Only VERIFIED fields count toward completeness percentage. PARTIAL fields reduce the percentage and show as "remaining".

## ESLint

- Extends `next/core-web-vitals`
- Config in `.eslintrc.json`

## Notifications

Use **`sileo`** for all toast notifications. Never use `sonner`, `alert()`, or `confirm()`.

```ts
import { sileo } from 'sileo';

// Basic variants
sileo.success({ title: 'Saved', description: 'Your changes were saved.' });
sileo.error({ title: 'Failed', description: 'Something went wrong.' });
sileo.warning({ title: 'Warning', description: 'Check your input.' });
sileo.info({ title: 'Note', description: 'FYI.' });

// Promise (loading → success/error)
sileo.promise(apiCall(), {
  loading: { title: 'Saving...' },
  success: { title: 'Saved!' },
  error: (err) => ({ title: 'Failed', description: err.message }),
});

// Action toast with button
sileo.action({
  title: 'Deleted',
  description: 'The item was removed.',
  button: { title: 'Undo', onClick: () => undoDelete() },
});
```

The `<Toaster />` is mounted once in `src/app/layout.tsx` via the wrapper at `src/components/ui/sileo.tsx` (position `top-right`, respects the app theme).
