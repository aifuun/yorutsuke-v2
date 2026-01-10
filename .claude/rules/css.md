# CSS Rules

> Design system conventions for writing CSS. Also enforced by `npm run lint:css`.

## Spacing (SPACING.md)

**Use tokens, never raw rem/em:**

```css
/* ✅ Good */
padding: var(--space-4);
gap: var(--space-2);

/* ❌ Bad */
padding: 1rem;
gap: 0.5rem;
```

**Scale:**
| Token | Value | Use |
|-------|-------|-----|
| `--space-1` | 4px | Icon gaps, tight |
| `--space-2` | 8px | Button padding, small gaps |
| `--space-3` | 12px | Input padding, list items |
| `--space-4` | 16px | Standard gap, sections |
| `--space-6` | 24px | Card padding, large gaps |
| `--space-8` | 32px | Section spacing |
| `--space-10` | 40px | Page padding |
| `--space-12` | 48px | Hero spacing |

## Shadows (SHADOWS.md)

**Use tokens, never hard-coded rgba:**

```css
/* ✅ Good */
box-shadow: var(--shadow-1);

/* ❌ Bad */
box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
```

**Levels:**
| Token | Use |
|-------|-----|
| `--shadow-1` | Cards, buttons (default) |
| `--shadow-2` | Hover states, dropdowns |
| `--shadow-3` | Modals, dialogs |
| `--shadow-4` | Full-screen overlays |
| `--shadow-inset` | Input depth effect |

## Border Radius (RADIUS.md)

**Use tokens, never raw px:**

```css
/* ✅ Good */
border-radius: var(--radius-md);

/* ❌ Bad */
border-radius: 8px;
```

**Scale:**
| Token | Value | Use |
|-------|-------|-----|
| `--radius-xs` | 2px | Tags, badges |
| `--radius-sm` | 4px | Buttons, inputs |
| `--radius-md` | 8px | Cards, dropdowns |
| `--radius-lg` | 12px | Modals, panels |
| `--radius-xl` | 16px | Large cards |
| `--radius-2xl` | 24px | Hero sections |
| `--radius-full` | 9999px | Circles, pills |

## Focus States

**Use outline, not box-shadow:**

```css
/* ✅ Good - Accessible */
.button:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

/* ❌ Bad - Not semantic */
.button:focus {
  box-shadow: 0 0 0 2px var(--color-primary);
}
```

## Colors

**Use semantic tokens:**

```css
/* ✅ Good */
color: var(--color-income);
background: var(--bg-card);

/* ❌ Bad */
color: #059669;
background: white;
```

**Key tokens:**
- `--color-income` / `--color-expense` - Financial
- `--color-primary` / `--color-error` - States
- `--bg-app` / `--bg-card` / `--bg-panel` - Backgrounds
- `--text-primary` / `--text-secondary` - Text

## Transitions

**Animate specific properties:**

```css
/* ✅ Good */
transition: box-shadow 0.2s ease-out;

/* ❌ Bad - Performance issue */
transition: all 0.2s;
```

## Exceptions

Decorative effects (glows, animations) may use hard-coded values with comment:

```css
/* @decorative: Glow effect for emphasis */
box-shadow: 0 0 10px rgba(59, 130, 246, 0.5);
```
