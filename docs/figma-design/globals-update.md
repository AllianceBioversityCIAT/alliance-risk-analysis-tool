# Globals CSS Update

Copy-paste-ready CSS variable overrides to brand the entire app with the Figma design system. Replace the `:root` block in `packages/web/src/app/globals.css`.

## Before (current defaults)

The current `globals.css` uses shadcn's default neutral OKLCH tokens (pure gray, no hue). This update adds teal brand colors and slate-tinted neutrals.

## Updated `:root` Block

Replace the existing `:root { ... }` block (lines 48-81) with:

```css
:root {
  --radius: 0.625rem;

  /* Page & surface */
  --background: oklch(0.98 0.005 260);     /* #F9FAFB - Athens Gray */
  --foreground: oklch(0.21 0.02 265);      /* #111827 - Ebony */

  /* Cards */
  --card: oklch(1 0 0);                    /* #FFFFFF */
  --card-foreground: oklch(0.21 0.02 265); /* #111827 */

  /* Popovers / Dropdowns */
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.21 0.02 265);

  /* Primary (Teal) */
  --primary: oklch(0.62 0.13 195);         /* #009CA6 - Bondi Blue */
  --primary-foreground: oklch(1 0 0);      /* White */

  /* Secondary (Light Teal Tint) */
  --secondary: oklch(0.98 0.01 195);       /* #F4F9F9 - Feta */
  --secondary-foreground: oklch(0.21 0.02 265);

  /* Muted */
  --muted: oklch(0.97 0 0);               /* #F5F5F5 - Catskill White */
  --muted-foreground: oklch(0.55 0.03 260); /* #64748B - Slate Gray */

  /* Accent (hover states, subtle highlights) */
  --accent: oklch(0.98 0.01 195);          /* #F4F9F9 - matches secondary */
  --accent-foreground: oklch(0.21 0.02 265);

  /* Destructive (Error / Critical Risk) */
  --destructive: oklch(0.6 0.19 45);       /* #EA580C - Christine */

  /* Borders */
  --border: oklch(0.93 0.01 260);          /* #E2E8F0 - Mystic */
  --input: oklch(0.93 0.01 260);           /* Same as border */
  --ring: oklch(0.62 0.13 195);            /* Matches --primary for focus rings */

  /* Chart colors (matched to design palette) */
  --chart-1: oklch(0.62 0.13 195);         /* Teal - #009CA6 */
  --chart-2: oklch(0.55 0.22 265);         /* Blue - #2563EB */
  --chart-3: oklch(0.6 0.18 145);          /* Green - #16A34A */
  --chart-4: oklch(0.72 0.17 70);          /* Orange - #F48C06 */
  --chart-5: oklch(0.6 0.19 45);           /* Red - #EA580C */

  /* Sidebar (Teal) */
  --sidebar: oklch(0.58 0.12 190);         /* #008F8F - Teal */
  --sidebar-foreground: oklch(1 0 0);      /* White */
  --sidebar-primary: oklch(0.62 0.13 195); /* #009CA6 - Bondi Blue */
  --sidebar-primary-foreground: oklch(1 0 0);
  --sidebar-accent: oklch(1 0 0 / 20%);   /* White 20% - active nav bg */
  --sidebar-accent-foreground: oklch(1 0 0);
  --sidebar-border: oklch(0.59 0.11 180);  /* #0D9488 - Blue Chill */
  --sidebar-ring: oklch(0.62 0.13 195);

  /* === Custom tokens (not in default shadcn) === */

  /* Status colors */
  --success: oklch(0.6 0.18 145);          /* #16A34A - Salem */
  --success-foreground: oklch(1 0 0);
  --warning: oklch(0.72 0.17 70);          /* #F48C06 - Tangerine */
  --warning-foreground: oklch(1 0 0);
  --info: oklch(0.55 0.22 265);            /* #2563EB - Royal Blue */
  --info-foreground: oklch(1 0 0);
}
```

## Additional `@theme inline` Variables

Add these new custom color tokens inside the `@theme inline { ... }` block:

```css
@theme inline {
  /* ... existing variables ... */

  /* Custom status colors */
  --color-success: var(--success);
  --color-success-foreground: var(--success-foreground);
  --color-warning: var(--warning);
  --color-warning-foreground: var(--warning-foreground);
  --color-info: var(--info);
  --color-info-foreground: var(--info-foreground);
}
```

## Dark Mode

The Figma design shows no dark mode. The existing `.dark { ... }` block can remain as-is (no changes needed). It will not be used unless a theme toggle is added later.

## Usage After Update

Once applied, all existing shadcn components automatically adopt the teal brand:

- `bg-primary` → Teal (`#009CA6`)
- `bg-secondary` → Light teal tint (`#F4F9F9`)
- `bg-sidebar` → Dark teal (`#008F8F`)
- `text-muted-foreground` → Slate gray (`#64748B`)
- `border-border` → Mystic gray (`#E2E8F0`)
- `bg-destructive` → Orange-red (`#EA580C`)

New utility classes available:
- `bg-success`, `text-success` → Green (`#16A34A`)
- `bg-warning`, `text-warning` → Orange (`#F48C06`)
- `bg-info`, `text-info` → Blue (`#2563EB`)

## Frequently Used Color Combos from Figma

| Pattern | Tailwind Classes |
|---------|-----------------|
| Page background | `bg-background` |
| Card on page | `bg-card border border-border shadow-sm rounded-xl` |
| Primary button | `bg-primary text-primary-foreground` |
| Muted description | `text-muted-foreground` |
| Table header text | `text-[#9CA3AF] text-[11px] font-bold uppercase tracking-[1.1px]` |
| Status badge (draft) | `bg-muted border border-border text-[#475569] text-xs font-medium rounded-full px-3 py-0.5` |
| Status badge (analyzing) | `bg-secondary border border-[#DCFCE7] text-[#1D4ED8] text-xs font-medium rounded-full px-3 py-0.5` |
| Status badge (complete) | `bg-secondary border border-[#DCFCE7] text-[#15803D] text-xs font-medium rounded-full px-3 py-0.5` |
| Sidebar nav active | `bg-white/20 text-white rounded-lg shadow-inner` |
| Sidebar nav inactive | `text-[#CCFBF1] hover:bg-white/10 rounded-lg` |
