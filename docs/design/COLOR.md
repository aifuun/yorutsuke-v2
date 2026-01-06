# Color System

Yorutsuke uses a **25-color palette**: 10 neutrals + 15 accent colors.

## Design Principles

1. **Controlled palette**: 25 colors maximum, no growth without review
2. **Semantic tokens**: Developers use semantic names, not raw palette colors
3. **CSS variables**: All colors defined as tokens, no magic hex values
4. **WCAG AA compliance**: Amber-800 for warning text (yellow contrast issue)

## Color Count Summary

| Palette | Count | Shades |
|---------|-------|--------|
| Slate (Neutrals) | 10 | 50, 100, 200, 300, 400, 500, 600, 700, 800, 900 |
| Blue (Primary) | 3 | 100, 500, 600 |
| Emerald (Success) | 3 | 100, 500, 600 |
| Amber (Warning) | 5 | 100, 300, 500, 600, 800 |
| Rose (Error) | 4 | 100, 200, 500, 600 |
| **Total** | **25** | |

---

## Base Palette

### Slate (Neutrals) - 10 shades

| Token | Value | Usage |
|-------|-------|-------|
| `--slate-50` | #F8FAFC | Subtle backgrounds |
| `--slate-100` | #F1F5F9 | App background, input bg |
| `--slate-200` | #E2E8F0 | Borders, dividers |
| `--slate-300` | #CBD5E1 | Muted borders, progress bg |
| `--slate-400` | #94A3B8 | Disabled text, placeholders |
| `--slate-500` | #64748B | Muted text, hints |
| `--slate-600` | #475569 | Secondary text |
| `--slate-700` | #334155 | Primary text |
| `--slate-800` | #1E293B | Headers, dark panels |
| `--slate-900` | #0F172A | Sidebar, dark surfaces |

### Blue (Primary) - 3 shades

| Token | Value | Usage |
|-------|-------|-------|
| `--blue-100` | #DBEAFE | Info backgrounds, badges |
| `--blue-500` | #3B82F6 | Primary buttons, links |
| `--blue-600` | #2563EB | Hover/active state |

### Emerald (Success) - 3 shades

| Token | Value | Usage |
|-------|-------|-------|
| `--emerald-100` | #D1FAE5 | Success backgrounds |
| `--emerald-500` | #10B981 | Success icons |
| `--emerald-600` | #059669 | Income text, success text |

### Amber (Warning) - 5 shades

| Token | Value | Usage | Note |
|-------|-------|-------|------|
| `--amber-100` | #FEF3C7 | Warning backgrounds | |
| `--amber-300` | #FCD34D | Warning borders | Needed for visual coherence |
| `--amber-500` | #F59E0B | Warning icons | |
| `--amber-600` | #D97706 | Warning accent | |
| `--amber-800` | #92400E | Warning text | **WCAG AA required** |

### Rose (Error) - 4 shades

| Token | Value | Usage | Note |
|-------|-------|-------|------|
| `--rose-100` | #FFE4E6 | Error backgrounds | |
| `--rose-200` | #FECACA | Error hover states | Needed for interaction feedback |
| `--rose-500` | #F43F5E | Error icons | |
| `--rose-600` | #E11D48 | Expense text, error text | |

---

## Semantic Tokens

**Use these instead of raw palette colors for consistency and maintainability.**

### State Colors

```css
--color-primary: var(--blue-500);
--color-primary-hover: var(--blue-600);
--color-success: var(--emerald-500);
--color-warning: var(--amber-500);
--color-error: var(--rose-500);
```

### Financial

```css
--color-income: var(--emerald-600);
--color-expense: var(--rose-600);
```

### Backgrounds

```css
--bg-app: var(--slate-100);
--bg-card: #FFFFFF;
--bg-sidebar: var(--slate-900);
--bg-dark: var(--slate-800);

/* Component state backgrounds */
--bg-info: var(--blue-100);
--bg-success: var(--emerald-100);
--bg-warning: var(--amber-100);
--bg-error: var(--rose-100);
--bg-error-hover: var(--rose-200);
```

### Text

```css
--text-primary: var(--slate-700);
--text-secondary: var(--slate-500);
--text-muted: var(--slate-400);
--text-inverse: var(--slate-100);
```

### Borders

```css
--border: var(--slate-200);
--border-muted: var(--slate-300);
--border-warning: var(--amber-300);
--border-error: var(--rose-200);
```

---

## Usage Guidelines

### DO

```css
/* Use semantic tokens */
.banner { background: var(--bg-warning); }
.error-text { color: var(--color-error); }
.income { color: var(--color-income); }
```

### DON'T

```css
/* Don't use hex codes */
.banner { background: #FEF3C7; }

/* Don't use palette colors directly when semantic exists */
.error-text { color: var(--rose-500); } /* Use --color-error */
```

---

## Button Colors

| Type | Background | Hover | Text |
|------|------------|-------|------|
| Primary | `--blue-500` | `--blue-600` | white |
| Secondary | `--slate-700` | `--slate-800` | white |
| Danger | `--rose-100` | `--rose-200` | `--rose-600` |
| Confirm | `--emerald-100` | `box-shadow` | `--emerald-600` |

## Status Badge Colors

| Status | Background | Text |
|--------|------------|------|
| Default | `--slate-200` | `--slate-600` |
| Info | `--bg-info` | `--blue-600` |
| Success | `--bg-success` | `--emerald-600` |
| Warning | `--bg-warning` | `--amber-600` |
| Error | `--bg-error` | `--rose-600` |

---

## Rationale for Kept Colors

| Color | Why Kept |
|-------|----------|
| `amber-300` | Warning borders need yellow tint for visual coherence |
| `amber-800` | WCAG AA compliance - yellow 500/600 fail contrast on white |
| `rose-200` | Hover states need visible feedback (rose-100 too subtle) |

## Deleted Colors (Do Not Add Back)

| Deleted | Replacement |
|---------|-------------|
| `blue-50`, `blue-200`, `blue-700` | `--bg-info`, `blue-100`, `blue-600` |
| `emerald-50`, `emerald-200`, `emerald-400` | `--bg-success`, `emerald-100`, `emerald-500` |
| `amber-50` | `--bg-warning` |
| `rose-50`, `rose-400` | `--bg-error`, `rose-500` |
