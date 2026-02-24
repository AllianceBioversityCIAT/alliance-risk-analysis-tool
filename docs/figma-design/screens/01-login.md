# Login

**Figma:** [Login Screen](https://www.figma.com/design/5HHOnHNcqeVyLcebGs5kuW/RISK-ANALYSIS-TOOL?node-id=97:12636)
**Node ID:** `97:12636`

## Screenshot Description

A centered white card on a soft gradient/light background. The card contains the "Risk Intelligence" logo with an Africa map icon at the top, a title, subtitle, email and password inputs with leading icons, a "Remember me" checkbox paired with a "Forgot password?" link, and a full-width teal "Log In" button. The overall feel is clean, corporate, and minimal with generous whitespace.

## Component Breakdown

| # | Element | Figma Details | Notes |
|---|---------|---------------|-------|
| 1 | **Background** | Gradient or light neutral fill covering the full viewport | `min-h-screen`, light warm gradient (not the current dark slate) |
| 2 | **Card container** | White (`#FFFFFF`), border `1px #E2E8F0`, `rounded-2xl`, shadow `0px 10px 36px rgba(0,0,0,0.04)` | `max-w-md` centered horizontally and vertically |
| 3 | **Logo icon** | Africa map icon inside a rounded container | Custom SVG or image asset; teal/green accent color |
| 4 | **App title** | "Risk Intelligence Portal", 24px bold, color `#111827` | `text-2xl font-bold text-gray-900` |
| 5 | **Subtitle** | "Sign in to access climate risk analytics", 16px regular, color `#6B7280` | `text-base font-normal text-gray-500` |
| 6 | **Email label** | "Email Address", medium weight, color `#374151` | `text-sm font-medium text-gray-700` |
| 7 | **Email input** | Background `#F9FAFB`, border `1px #D1D5DB`, placeholder "name@organization.org" | Prefix icon: `mail_outline` (`#9CA3AF`) mapped to Lucide `Mail` |
| 8 | **Password label** | "Password", same style as email label | `text-sm font-medium text-gray-700` |
| 9 | **Password input** | Same styling as email input, type `password` | Prefix icon: `lock_outline` mapped to Lucide `Lock`; Suffix icon: `visibility_off` mapped to Lucide `EyeOff` / `Eye` toggle |
| 10 | **Remember me** | Checkbox + "Remember me" label | Native checkbox or shadcn `Checkbox` |
| 11 | **Forgot password?** | Link, semibold, color `#00857D` (teal) | `font-semibold text-teal-600 hover:underline`, routes to `/forgot-password` |
| 12 | **Log In button** | Full width, background `#00857D`, white text, `rounded-lg` | `w-full bg-[#00857D] hover:bg-[#006B65] text-white rounded-lg` |
| 13 | **Server error alert** | Red-tinted banner (not in Figma but required for UX) | Keep existing destructive alert pattern |

## Layout Structure

```
<main>                              /* min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 px-4 py-12 */
  <div>                             /* w-full max-w-md */

    {/* Branding header */}
    <div>                           /* text-center mb-8 */
      <LogoIcon />                  /* inline-flex items-center justify-center mb-4 */
      <h1>Risk Intelligence Portal</h1>   /* text-2xl font-bold text-gray-900 */
      <p>Sign in to access...</p>         /* text-base text-gray-500 mt-1 */
    </div>

    {/* Card */}
    <div>                           /* bg-white border border-slate-200 rounded-2xl p-8 shadow-[0px_10px_36px_rgba(0,0,0,0.04)] */
      <LoginForm />
    </div>

    {/* Footer */}
    <p>(c) 2026 Alliance...</p>     /* text-center text-xs text-gray-400 mt-6 */
  </div>
</main>
```

- Outer `<main>`: Full viewport height, flexbox centering, light gradient background.
- Inner wrapper `<div>`: Constrains card to `max-w-md` (448px).
- Card `<div>`: White fill, subtle border, large border-radius, soft box shadow.
- Inside the card, the `<LoginForm>` component handles the form layout as a vertical `space-y-5` flex column.

## shadcn Components Used

| Component | Import Path | className Overrides |
|-----------|-------------|---------------------|
| `Button` | `@/components/ui/button` | `w-full h-10 bg-[#00857D] hover:bg-[#006B65] text-white rounded-lg font-medium` |
| `Input` | `@/components/ui/input` | `h-10 bg-[#F9FAFB] border-[#D1D5DB] pl-10` (for prefix icon variant) |
| `Label` | `@/components/ui/label` | `text-sm font-medium text-gray-700` |
| `Form`, `FormField`, `FormItem`, `FormControl`, `FormMessage` | `@/components/ui/form` | No overrides |
| `Checkbox` (optional) | `@/components/ui/checkbox` | Replace native `<input type="checkbox">` if desired |

## Custom Components Needed

| Component | File Path | Description |
|-----------|-----------|-------------|
| `InputWithIcon` | `packages/web/src/components/ui/input-with-icon.tsx` | Wrapper around `Input` that accepts `prefixIcon` and `suffixIcon` props, positions them absolutely inside a `relative` container. Used for email (`Mail` prefix) and password (`Lock` prefix, `Eye`/`EyeOff` suffix toggle). |
| `AppLogo` | `packages/web/src/components/brand/app-logo.tsx` | Renders the Africa map icon + "Risk Intelligence" wordmark. Reusable in login, sidebar, and header. Accepts `size` prop (`sm`, `md`, `lg`). |

## Data Requirements

### API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `POST` | `/api/auth/login` | Authenticate with email + password via Cognito |
| `POST` | `/api/auth/forgot-password` | Initiate password reset (linked from this screen) |

### Types

```typescript
// Zod schema (already exists in login-form.tsx)
const loginSchema = z.object({
  email: z.string().min(1).email().transform(val => val.toLowerCase().trim()),
  password: z.string().min(1).min(8),
  rememberMe: z.boolean(),
});
```

### Hooks / Providers

| Hook / Provider | File Path | Usage |
|-----------------|-----------|-------|
| `useAuth()` | `packages/web/src/providers/auth-provider.tsx` | `login()`, `isAuthenticated`, `isLoading` |
| `useRouter()` | `next/navigation` | Redirect to `/dashboard` on success |
| `useSearchParams()` | `next/navigation` | Read `returnTo` query param for post-login redirect |

## Implementation Notes

### Differences from Current Implementation

The existing login page uses a **dark glassmorphism** theme (dark slate gradient, `bg-white/5` translucent card, white text, emerald accent). The Figma design uses a **light card** theme (light background, solid white card, dark text, teal `#00857D` accent). The restyle requires:

1. **Background**: Change from `bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900` to a light gradient such as `bg-gradient-to-br from-gray-50 to-gray-100`.
2. **Card**: Change from `bg-white/5 backdrop-blur-sm border-white/10` to `bg-white border-slate-200 shadow-[0px_10px_36px_rgba(0,0,0,0.04)]`.
3. **Typography**: Title from `text-white` to `text-gray-900`; subtitle from `text-slate-400` to `text-gray-500`.
4. **Button color**: From the default primary (emerald via theme) to explicit `bg-[#00857D]` teal, or update the CSS `--primary` token globally (see `globals-update.md`).
5. **Input prefix icons**: Add `Mail` and `Lock` icons positioned inside the input fields. The current implementation has no prefix icons.
6. **Placeholder text**: Change email placeholder from `"you@example.com"` to `"name@organization.org"`.
7. **Title text**: Change from "CGIAR Risk Intelligence" to "Risk Intelligence Portal".
8. **Subtitle text**: Change from "Sign in to your account to continue" to "Sign in to access climate risk analytics".
9. **Logo**: Replace the shield SVG icon with the Africa map icon from the design asset.

### Responsive Behavior

- On mobile (`< 640px`), the card fills nearly the full width with `px-4` padding on `<main>`.
- The `max-w-md` constraint keeps the card at 448px maximum width on larger screens.
- Input fields and button remain full-width within the card at all breakpoints.

### Animations

- Button shows a `Loader2` spinner with `animate-spin` while submitting (already implemented).
- Consider adding a subtle `transition-shadow` on the card for hover states (optional enhancement).
- Focus rings on inputs should use the teal accent color (`ring-[#00857D]` or theme `ring-primary` after token update).

### Edge Cases

- **Already authenticated**: The `LoginPageClient` component redirects to `/dashboard` if the user is already logged in (already handled).
- **Password change required**: Cognito `NEW_PASSWORD_REQUIRED` challenge redirects to `/change-password` with session token (already handled).
- **returnTo param**: After login, redirects to the `returnTo` query param if present, otherwise `/dashboard` (already handled).
- **Server error display**: The red error alert banner above the form fields is not in the Figma design but must be kept for usability.
- **Remember me**: Controls whether tokens are stored in `localStorage` (persistent) or `sessionStorage` (session-only).
