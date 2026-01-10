# Typography Standards

> Comprehensive font usage guidelines for Yorutsuke v2 UI.
>
> **Source of Truth**: All text styles must follow this specification.

## Font Stack

### Families

| Token | Value | CSS Variable |
|-------|-------|--------------|
| UI Font | `'Inter', -apple-system, BlinkMacSystemFont, sans-serif` | `var(--font-ui)` |
| Mono Font | `'JetBrains Mono', ui-monospace, monospace` | `var(--font-mono)` |

### Base Settings

```css
body {
  font-family: var(--font-ui);
  font-size: 14px;               /* --font-size-base */
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
}
```

---

## Color Palette (Slate)

> Use Slate palette consistently. Do NOT use Tailwind gray.

| Token | Hex | CSS Variable | Usage |
|-------|-----|--------------|-------|
| slate-900 | `#0F172A` | - | Dark backgrounds only |
| slate-800 | `#1E293B` | `--text-main` | Hero numbers, dark panel text |
| slate-700 | `#334155` | - | **Primary text**, titles, labels |
| slate-500 | `#64748B` | `--text-muted` | Secondary text, body |
| slate-400 | `#94A3B8` | `--text-disabled` | Hints, captions, section headers |
| slate-300 | `#CBD5E1` | - | Counts, subtle badges |

### Prohibited Grays

Do NOT use these Tailwind gray values:
- `#6b7280` (gray-500) → Use `#64748B` (slate-500)
- `#374151` (gray-700) → Use `#334155` (slate-700)
- `#4b5563` (gray-600) → Use `#475569` (slate-600)
- `#9ca3af` (gray-400) → Use `#94A3B8` (slate-400)

---

## Text Hierarchy

### Level 1: Page Title

Main screen titles (Dashboard, Ledger, Capture, Settings, Debug).

```css
.{page}-title {
  font-size: 18px;
  font-weight: 700;
  color: #334155;              /* slate-700 */
  letter-spacing: -0.025em;
}
```

| Property | Value |
|----------|-------|
| font-size | 18px |
| font-weight | 700 (bold) |
| color | #334155 |
| font-style | normal (never italic) |

### Level 2: Section Header

Card/section labels.

```css
.section-header {
  font-size: 11px;
  font-weight: 800;
  color: #94A3B8;              /* slate-400 */
  text-transform: uppercase;
  letter-spacing: 0.2em;
}
```

| Property | Value |
|----------|-------|
| font-size | 11px |
| font-weight | 800 (extrabold) |
| color | #94A3B8 |
| text-transform | uppercase |
| letter-spacing | 0.2em |

### Level 3: Card Title / Item Title

Transaction names, activity titles.

```css
.item-title {
  font-size: 14px;
  font-weight: 600;
  color: #334155;              /* slate-700 */
}
```

### Level 4: Label

Form labels, setting names.

```css
.label {
  font-size: 14px;
  font-weight: 600;
  color: #334155;              /* slate-700 */
}
```

### Level 5: Body Text

Primary content text.

```css
.body {
  font-size: 14px;
  font-weight: 400;
  color: #64748B;              /* slate-500 */
}
```

### Level 6: Secondary Text

Subtitles, descriptions.

```css
.secondary {
  font-size: 12px;
  font-weight: 400;
  color: #64748B;              /* slate-500 */
}
```

### Level 7: Hint / Caption

Help text, timestamps.

```css
.hint {
  font-size: 12px;
  font-weight: 400;
  color: #94A3B8;              /* slate-400 */
}
```

### Level 8: Micro Text

Counts, badges, small labels.

```css
.micro {
  font-size: 10px;
  font-weight: 600-700;
  color: #94A3B8;              /* slate-400 */
}
```

---

## Font Weights Reference

| Token | Value | Usage |
|-------|-------|-------|
| Regular | 400 | Body text, descriptions |
| Medium | 500 | Form inputs, subtle emphasis |
| Semibold | 600 | Labels, buttons, item titles |
| Bold | 700 | Page titles, important values |
| Extrabold | 800 | Section headers (uppercase) |
| Black | 900 | Special emphasis (rare) |

---

## Numeric Typography

Use monospace font for all numeric data.

```css
.amount, .stat-value, .count {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
}
```

### Numeric Hierarchy

| Size | Usage | Example |
|------|-------|---------|
| 48px | Hero number | Dashboard main balance |
| 20px | Secondary stats | Monthly income, category totals |
| 14px | Regular amounts | Transaction list amounts |
| 12px | Small numbers | Counts, micro stats |

### Amount Colors

| Type | Color | Example |
|------|-------|---------|
| Income | `#10B981` (emerald-500) | +1,234 |
| Expense | `#F43F5E` (rose-500) | -1,234 |
| Neutral | `#334155` (slate-700) | 1,234 |

---

## Special Elements

### Brand Logo (Sidebar)

The brand name is the ONLY element that uses italic.

```css
.brand {
  font-size: 18px;
  font-weight: 700;
  font-style: italic;          /* Exception: brand only */
  color: #FFFFFF;
}
```

### Navigation Item

```css
.nav-item {
  font-size: 14px;
  font-weight: 600;
  color: #64748B;              /* inactive */
}

.nav-item.active {
  color: #3B82F6;              /* accent */
}
```

### Status Badge

```css
.status-badge {
  font-size: 10px;
  font-weight: 700;
}
```

### Debug Panel (Dark Theme)

```css
.debug-panel {
  font-family: var(--font-mono);
  font-size: 12px;
}

.debug-panel__label { color: #64748B; }
.debug-panel__value { color: #E2E8F0; }
```

---

## Quick Reference Table

| Element | Size | Weight | Color |
|---------|------|--------|-------|
| Page Title | 18px | 700 | #334155 |
| Section Header | 11px | 800 | #94A3B8 (uppercase) |
| Item Title | 14px | 600 | #334155 |
| Label | 14px | 600 | #334155 |
| Body | 14px | 400 | #64748B |
| Secondary | 12px | 400 | #64748B |
| Hint | 12px | 400 | #94A3B8 |
| Micro | 10px | 600 | #94A3B8 |
| Button | 13px | 600 | varies |
| Badge | 10px | 700 | varies |
| **Hero Number** | **48px** | **700** | **#1E293B** (mono) |
| **Stat Number** | **20px** | **700** | **#1E293B** (mono) |

---

## Anti-Patterns

| Pattern | Issue | Correct |
|---------|-------|---------|
| `font-style: italic` on titles | Inconsistent | Normal style only |
| `font-weight: 800` on page titles | Too heavy | Use 700 |
| `#6b7280` for text | Wrong palette | Use `#64748B` (slate) |
| `#374151` for primary text | Wrong palette | Use `#334155` (slate) |
| `font-size: 11px` for section headers in one file, `14px` in another | Inconsistent | Always 11px |

---

## Migration Checklist

Files updated:

- [x] `ledger.css` - Title fixed (weight, color, italic removed)
- [x] `debug.css` - Title color, section header style, label colors
- [x] `report.css` - Gray palette → Slate palette (25+ occurrences)
- [x] `styles.css` - Gray palette → Slate palette

---

*Last updated: 2026-01-10*
