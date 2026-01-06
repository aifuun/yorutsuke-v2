# Color System

Yorutsuke uses a minimal, consistent color palette based on Tailwind CSS Slate scale with semantic colors for states.

## Design Principles

1. **Minimal palette**: 4 semantic colors + 1 neutral scale
2. **Consistent usage**: Same color = same meaning everywhere
3. **CSS variables**: All colors defined as tokens, no magic values
4. **Accessibility**: WCAG 2.1 AA contrast ratios

## Color Palette

### Neutral (Slate)

Used for text, backgrounds, borders, and UI chrome.

| Token | Value | Usage |
|-------|-------|-------|
| `--slate-50` | #F8FAFC | Subtle backgrounds |
| `--slate-100` | #F1F5F9 | App background, input bg |
| `--slate-200` | #E2E8F0 | Borders, dividers |
| `--slate-300` | #CBD5E1 | Inactive borders, progress bg |
| `--slate-400` | #94A3B8 | Disabled text, placeholders |
| `--slate-500` | #64748B | Muted text, hints |
| `--slate-600` | #475569 | Secondary text |
| `--slate-700` | #334155 | Primary text |
| `--slate-800` | #1E293B | Headers, dark panels |
| `--slate-900` | #0F172A | Sidebar, dark surfaces |

### Primary (Blue)

Used for interactive elements, links, focus states.

| Token | Value | Usage |
|-------|-------|-------|
| `--blue-50` | #EFF6FF | Info banner bg |
| `--blue-100` | #DBEAFE | Hover states, badges |
| `--blue-200` | #BFDBFE | Borders |
| `--blue-500` | #3B82F6 | Primary buttons, links |
| `--blue-600` | #2563EB | Hover state |
| `--blue-700` | #1D4ED8 | Active state |

### Success (Emerald)

Used for positive states, income, completed actions.

| Token | Value | Usage |
|-------|-------|-------|
| `--emerald-50` | #ECFDF5 | Success banner bg |
| `--emerald-100` | #D1FAE5 | Success badges |
| `--emerald-200` | #A7F3D0 | Borders |
| `--emerald-400` | #34D399 | Accent lines |
| `--emerald-500` | #10B981 | Success icons |
| `--emerald-600` | #059669 | Income text |

### Warning (Amber)

Used for warnings, pending states, guest mode.

| Token | Value | Usage |
|-------|-------|-------|
| `--amber-50` | #FFFBEB | Warning banner bg |
| `--amber-100` | #FEF3C7 | Warning badges |
| `--amber-300` | #FCD34D | Borders |
| `--amber-500` | #F59E0B | Warning icons |
| `--amber-600` | #D97706 | Warning text |
| `--amber-800` | #92400E | Dark warning text |

### Error (Rose)

Used for errors, expenses, destructive actions.

| Token | Value | Usage |
|-------|-------|-------|
| `--rose-50` | #FFF1F2 | Error banner bg |
| `--rose-100` | #FFE4E6 | Error badges |
| `--rose-200` | #FECACA | Borders |
| `--rose-400` | #FB7185 | Accent lines |
| `--rose-500` | #F43F5E | Error icons |
| `--rose-600` | #E11D48 | Expense text |

## Semantic Tokens

Higher-level tokens that map to the base palette:

```css
:root {
  /* Backgrounds */
  --bg-app: var(--slate-100);
  --bg-card: #FFFFFF;
  --bg-sidebar: var(--slate-900);
  --bg-input: #FFFFFF;
  --bg-panel: var(--slate-800);

  /* Text */
  --text-primary: var(--slate-700);
  --text-secondary: var(--slate-500);
  --text-muted: var(--slate-400);
  --text-inverse: var(--slate-100);

  /* Borders */
  --border-default: var(--slate-200);
  --border-muted: var(--slate-300);

  /* States */
  --color-primary: var(--blue-500);
  --color-primary-hover: var(--blue-600);
  --color-success: var(--emerald-500);
  --color-warning: var(--amber-500);
  --color-error: var(--rose-500);

  /* Financial */
  --color-income: var(--emerald-600);
  --color-expense: var(--rose-600);
}
```

## Usage Guidelines

### DO

- Use semantic tokens for consistency: `var(--color-primary)`
- Use slate scale for neutral grays: `var(--slate-500)`
- Keep the palette minimal

### DON'T

- Use hex codes directly in CSS files
- Create new colors without adding to this spec
- Mix different gray scales (e.g., gray + slate)

## Button Colors

| Type | Background | Hover | Text |
|------|------------|-------|------|
| Primary | `--blue-500` | `--blue-600` | white |
| Secondary | `--slate-700` | `--slate-800` | white |
| Danger | `--rose-100` | `--rose-200` | `--rose-600` |
| Warning | `--amber-600` | `--amber-700` | white |
| Ghost | transparent | `--slate-100` | `--slate-700` |

## Status Badge Colors

| Status | Background | Text |
|--------|------------|------|
| Default | `--slate-200` | `--slate-600` |
| Info | `--blue-100` | `--blue-700` |
| Success | `--emerald-100` | `--emerald-700` |
| Warning | `--amber-100` | `--amber-800` |
| Error | `--rose-100` | `--rose-600` |
