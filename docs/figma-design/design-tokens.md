# Design Tokens

All design tokens extracted from the Figma file, organized by category. OKLCH values are provided for CSS variable usage in `globals.css`.

## Colors

### Brand (Teal/Cyan)

| Figma Name | Hex | OKLCH | Role | CSS Variable |
|------------|-----|-------|------|-------------|
| Bondi Blue | `#009CA6` | `oklch(0.62 0.13 195)` | Primary buttons, CTAs, focus rings | `--primary` |
| Teal | `#008F8F` | `oklch(0.58 0.12 190)` | Sidebar background | `--sidebar` |
| Blue Chill | `#0D9488` | `oklch(0.59 0.11 180)` | Sidebar border, active nav accent | `--sidebar-border` |
| Feta / Zumthor | `#F4F9F9` | `oklch(0.98 0.01 195)` | Light teal tinted backgrounds, stat card icon bg | `--secondary` |
| Mint Tulip | `#CCFBF1` | `oklch(0.94 0.06 175)` | Sidebar inactive nav text | — |
| Ice Cold | `#99F6E4` | `oklch(0.91 0.1 175)` | Sidebar muted text (light teal) | — |
| Scandal | `#DCFCE7` | `oklch(0.95 0.06 150)` | Success badge border | — |
| Teal (dark link) | `#00857D` | `oklch(0.55 0.11 180)` | Login "Forgot password" link | — |
| Eden 50% | `#115E59` | `oklch(0.42 0.08 180)` | Sidebar user card bg (50% opacity) | — |
| Carrot Orange | `#F18E1C` | `oklch(0.72 0.17 65)` | Active nav indicator (orange pip) | — |

### Neutrals (Slate/Blue undertone)

| Figma Name | Hex | OKLCH | Role | CSS Variable |
|------------|-----|-------|------|-------------|
| Ebony | `#111827` | `oklch(0.21 0.02 265)` | Headings, darkest text | `--foreground` |
| Mirage | `#1F2937` | `oklch(0.27 0.02 260)` | Header title text | — |
| Pickled Bluewood | `#374151` | `oklch(0.37 0.01 260)` | Form labels, secondary headings | — |
| Fiord | `#475569` | `oklch(0.45 0.02 260)` | Table cell text, button text | — |
| River Bed | `#4B5563` | `oklch(0.44 0.02 260)` | Checkbox label text | — |
| Slate Gray | `#64748B` | `oklch(0.55 0.03 260)` | Muted text, descriptions | `--muted-foreground` |
| Shuttle Gray | `#6B7280` | `oklch(0.55 0.02 260)` | Login subtitle text, secondary body | — |
| Gull Gray | `#9CA3AF` | `oklch(0.7 0.02 260)` | Placeholder text, table headers | — |
| Gray Chateau | `#9CA3AF` | `oklch(0.7 0.02 260)` | Icon color (muted) | — |
| Silver Sand | `#D1D5DB` | `oklch(0.87 0.01 260)` | Input borders, form field strokes | — |
| Geyser / Mystic | `#E2E8F0` | `oklch(0.93 0.01 260)` | Borders, dividers | `--border` |
| Catskill White | `#F5F5F5` | `oklch(0.97 0 0)` | Table header bg, row borders | — |
| Athens Gray | `#F9FAFB` | `oklch(0.98 0.005 260)` | Page background, input bg | `--background` |
| White | `#FFFFFF` | `oklch(1 0 0)` | Cards, inputs, sidebar text | `--card` |

### Status Colors

| Figma Name | Hex | OKLCH | Role | CSS Variable |
|------------|-----|-------|------|-------------|
| Salem | `#16A34A` | `oklch(0.6 0.18 145)` | Success / Low Risk | `--success` |
| Mountain Meadow | `#22C55E` | `oklch(0.72 0.19 150)` | Progress bar (complete) | — |
| Chateau Green | `#4CAF50` | `oklch(0.66 0.15 145)` | "Start New Assessment" button bg | — |
| Jewel | `#15803D` | `oklch(0.52 0.14 150)` | "Complete" status text | — |
| Tangerine | `#F48C06` | `oklch(0.72 0.17 70)` | Warning / Moderate Risk, notification dot | `--warning` |
| Christine | `#EA580C` | `oklch(0.6 0.19 45)` | Error / Critical Risk | `--destructive` |
| Royal Blue | `#2563EB` | `oklch(0.55 0.22 265)` | Info / Links | `--info` |
| Persian Blue | `#1D4ED8` | `oklch(0.5 0.22 265)` | "Analyzing" status text | — |
| Dodger Blue | `#3B82F6` | `oklch(0.62 0.22 265)` | Progress bar (analyzing) | — |

### Chart Colors

| Name | Hex | OKLCH | CSS Variable |
|------|-----|-------|-------------|
| Chart 1 (Teal) | `#009CA6` | `oklch(0.62 0.13 195)` | `--chart-1` |
| Chart 2 (Blue) | `#2563EB` | `oklch(0.55 0.22 265)` | `--chart-2` |
| Chart 3 (Green) | `#16A34A` | `oklch(0.6 0.18 145)` | `--chart-3` |
| Chart 4 (Orange) | `#F48C06` | `oklch(0.72 0.17 70)` | `--chart-4` |
| Chart 5 (Red) | `#EA580C` | `oklch(0.6 0.19 45)` | `--chart-5` |

---

## Typography

Font family: **Inter** (already configured in project via `next/font/google`)

### Type Scale

| Token | Weight | Size | Line Height | Letter Spacing | Usage |
|-------|--------|------|-------------|----------------|-------|
| `heading-1` | 700 (Bold) | 30px | 36px | — | Page titles ("Project Dashboard") |
| `heading-2` | 700 (Bold) | 20px | 28px | — | Section headings ("Active Assessments") |
| `heading-3` | 600 (Semi Bold) | 16px | 24px | — | Card titles, subsection headers |
| `body` | 400 (Regular) | 14px | 20px | — | Body text, descriptions, table cells |
| `body-medium` | 500 (Medium) | 14px | 20px | — | Links, labels, sidebar nav items |
| `body-semibold` | 600 (Semi Bold) | 14px | 20px | — | Buttons, table row names, nav active |
| `small` | 400 (Regular) | 12px | 16px | — | Subtitles, secondary info |
| `small-semibold` | 600 (Semi Bold) | 12px | 16px | — | User name in sidebar, semi-bold small |
| `data` | 700 (Bold) | 12px | 16px | — | Pagination numbers, data values |
| `caption` | 700 (Bold) | 11px | auto | 1.1px | Uppercase table headers ("BUSINESS NAME") |
| `score-large` | 700 (Bold) | 36px | 1 | — | Large stat numbers, risk scores |
| `title-xl` | 700 (Bold) | 24px | 34px | — | Login title ("Risk Intelligence Portal") |

### Tailwind Mapping

These map to standard Tailwind text size utilities:

| Token | Tailwind Classes |
|-------|-----------------|
| `heading-1` | `text-[30px] leading-9 font-bold` |
| `heading-2` | `text-xl font-bold leading-7` |
| `heading-3` | `text-base font-semibold leading-6` |
| `body` | `text-sm font-normal leading-5` |
| `body-medium` | `text-sm font-medium leading-5` |
| `body-semibold` | `text-sm font-semibold leading-5` |
| `small` | `text-xs font-normal leading-4` |
| `small-semibold` | `text-xs font-semibold leading-4` |
| `data` | `text-xs font-bold leading-4` |
| `caption` | `text-[11px] font-bold uppercase tracking-[1.1px]` |
| `score-large` | `text-4xl font-bold leading-none` |

---

## Spacing

Figma uses an 8px base grid with these common values:

| Token | Value | Usage |
|-------|-------|-------|
| `xxs` | 4px | Tight gaps (subtitle below title) |
| `xs` | 8px | Icon-to-text gap, pagination button gap |
| `sm` | 12px | Icon-to-label in sidebar, horizontal gaps |
| `md` | 16px | Sidebar padding, section gaps |
| `lg` | 24px | Card padding, page title area |
| `xl` | 32px | Table padding, content area px, page py |
| `2xl` | 40px | Content area top/bottom padding |

---

## Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `sm` | 6px | Pagination buttons, small elements |
| `md` | 8px | Buttons, inputs, nav items, sidebar items |
| `lg` | 10px | Default radius (`--radius`) |
| `xl` | 16px | Cards, stat cards, assessment table |
| `full` | 9999px | Status badges, avatar, progress bars |

---

## Shadows

| Name | Value | Usage |
|------|-------|-------|
| `shadow-sm` | `0px 1px 2px rgba(0,0,0,0.05)` | Buttons, inputs, table container, header |
| `shadow-card` | `0px 1px 2px rgba(0,0,0,0.05)` | Stat cards, assessment table card |
| `shadow-login` | `0px 10px 36px rgba(0,0,0,0.04)` | Login card (larger/softer) |
| `shadow-inset` | `inset 0px 2px 4px rgba(0,0,0,0.05)` | Active sidebar nav item |
| `shadow-green` | `0px 1px 2px #bbf7d0` | "Start New Assessment" button |

---

## Opacity

| Token | Value | Usage |
|-------|-------|-------|
| `disabled` | 0.5 | Disabled pagination "Prev" button |
| `sidebar-active-bg` | 0.2 | Active nav item background (`rgba(255,255,255,0.2)`) |
| `sidebar-user-bg` | 0.5 | User info card background (`rgba(17,94,89,0.5)`) |

---

## Sidebar Dimensions

| Property | Value |
|----------|-------|
| Width | 256px |
| Header height | 64px |
| Nav item height | 48px (12px py) |
| Nav item gap | 4px |
| Active indicator | 4px wide, orange (`#F18E1C`), left-aligned, rounded-r-full |
| User avatar | 32px, 2px orange ring |
