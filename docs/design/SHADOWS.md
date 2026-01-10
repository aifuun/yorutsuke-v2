# SHADOWS.md - Shadow & Elevation System

**Status**: ✅ Design System Phase 1  
**Last Updated**: 2026-01-10  
**Version**: 1.0

---

## Overview

This document defines the **shadow system** for Yorutsuke v2, establishing a consistent visual hierarchy through elevation levels. The system balances **Material Design 3 principles (70%)** with **Yorutsuke's lightweight aesthetic (30%)**, favoring single-layer, soft shadows over M3's heavier double-layer approach.

### Philosophy

- **Single-layer shadows**: Keeps the interface light and refined
- **Soft, diffused blur**: Aligns with the "坐标纸" (coordinate paper) aesthetic
- **Glassmorphism support**: Pairs with backdrop-filter for modern UI effects
- **Accessibility-first**: High contrast elevation differences for visual clarity
- **Performance**: Minimal shadow layers to reduce GPU load

---

## Elevation System

### 5 Elevation Levels

Each level represents a distinct layer in the visual hierarchy, from the base surface (Level 0) to floating modals (Level 4).

| Level | Name | Blur | Offset | Color Alpha | Use Cases |
|-------|------|------|--------|-------------|-----------|
| **0** | Base | — | — | — | No shadow (app bg, base surface) |
| **1** | Raised | 3px | 1px | 0.05 | Cards, buttons, idle state |
| **2** | Floating | 8px | 4px | 0.08 | Card hover, dropdown menu, tooltip |
| **3** | Modal | 20px | 10px | 0.15 | Modal overlay, lightbox, popover |
| **4** | Overlay | 40px | 15px | 0.20 | Full-page modal, loading overlay |

### CSS Token Definitions

```css
/* Elevation Level 0: Base - No shadow */
--shadow-none: none;

/* Elevation Level 1: Raised (default card) */
--shadow-1: 0 1px 3px rgba(0, 0, 0, 0.05);

/* Elevation Level 2: Floating (hover, dropdown) */
--shadow-2: 0 4px 12px rgba(0, 0, 0, 0.08);

/* Elevation Level 3: Modal (dialog, lightbox) */
--shadow-3: 0 10px 30px rgba(0, 0, 0, 0.15);

/* Elevation Level 4: Overlay (full-screen modal) */
--shadow-4: 0 20px 50px rgba(0, 0, 0, 0.20);

/* Inset shadow for depth (input focus, recessed button) */
--shadow-inset: inset 0 1px 2px rgba(0, 0, 0, 0.05);
```

---

## Shadow by Component

### Cards & Containers

**Elevation Level 1** - Default state
```css
box-shadow: var(--shadow-1);  /* 0 1px 3px rgba(0,0,0,0.05) */
```

**Elevation Level 2** - Hover / Interactive state
```css
box-shadow: var(--shadow-2);
transition: box-shadow 0.2s ease-out;
```

**Examples**:
- `.card` — Base card element
- `.transaction-row` — Ledger entries (Level 1, hover → Level 2)
- `.summary-card` — Dashboard statistics cards

---

### Dropdowns, Popovers, Tooltips

**Elevation Level 2**
```css
box-shadow: var(--shadow-2);  /* 0 4px 12px rgba(0,0,0,0.08) */
position: absolute;
z-index: 100;
```

**Examples**:
- Date picker menu
- Status filter dropdown
- Category selector dropdown
- User menu (top-right)

---

### Modals, Dialogs, Lightbox

**Elevation Level 3**
```css
box-shadow: var(--shadow-3);  /* 0 10px 30px rgba(0,0,0,0.15) */
position: fixed;
z-index: 200;
```

**Examples**:
- Image lightbox (full-screen viewer)
- Confirm delete dialog
- Edit transaction modal
- Settings modal
- Image zoom overlay

---

### Full-Screen Overlays

**Elevation Level 4**
```css
box-shadow: var(--shadow-4);  /* 0 20px 50px rgba(0,0,0,0.20) */
position: fixed;
z-index: 300;
```

**Examples**:
- Loading spinner overlay
- Network error banner overlay
- Full-page offline mode indicator

---

## Glassmorphism & Backdrops

### Frosted Glass Effect

Combines **semi-transparent background** + **backdrop-filter blur** + **subtle shadow** for modern UI:

```css
.glass-panel {
  background: rgba(255, 255, 255, 0.5);  /* 50% opacity white */
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  box-shadow: 0 8px 20px -5px rgba(0, 0, 0, 0.08);  /* Level 2 shadow */
  border-radius: var(--radius-xl);
}
```

**Current Usage**:
- Dashboard header (`DashboardView`)
- Transaction header
- Sidebar (dark variant)

**Notes**:
- Require fallback `background-color` for non-supporting browsers
- Use with semi-transparent colors (0.4–0.8) for clarity
- Pair with Level 1–2 shadows only (heavier shadows defeat the glass effect)

---

## Focus & Interactive States

### Keyboard Focus Ring (Accessibility)

Combine **outer focus ring** (no shadow) with **subtle inner shadow** for clarity:

```css
.button:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
  box-shadow: var(--shadow-inset);  /* Optional inner focus depth */
}
```

### Input Focus State

**Recommended**: Use `outline` property (not `box-shadow`) for better accessibility:

```css
input:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
  border-color: var(--color-primary);
}

/* Error state */
input.error:focus-visible {
  outline: 2px solid var(--rose-500);
  outline-offset: 2px;
  border-color: var(--rose-500);
}
```

**Why `outline` over `box-shadow`?**
- Semantic: `outline` is designed for focus indication
- Accessible: Better screen reader support
- Predictable: Doesn't affect layout (unlike border)
- Standard: Follows WCAG best practices

---

## Anti-Patterns & Constraints

### ❌ Do NOT

1. **Use double-layer shadows** — Keep it single-layer (lightweight aesthetic)
2. **Use hard/sharp shadows** — Prefer soft blur (minimum 3px)
3. **Nest shadows (shadow on shadow)** — Flatten to single, highest-z shadow
4. **Use colored shadows** — Stick to `rgba(0, 0, 0, ...)` (black)
5. **Use `box-shadow: 0 0 Xpx`** — Always include offset for depth perception
6. **Animate shadows via `transition: all`** — Animate only `box-shadow` property:
   ```css
   transition: box-shadow 0.2s ease-out;  /* ✅ Good */
   transition: all 0.2s;                   /* ❌ Bad (performance) */
   ```

### ✅ Do

1. **Use CSS custom properties** — `var(--shadow-1)` vs hard-coded values
2. **Pair shadow with z-index** — Higher elevation → Higher z-index
3. **Test on dark mode** — Shadows may need opacity adjustment (increase alpha by 0.05)
4. **Provide smooth transitions** — `transition: box-shadow 0.2s ease-out`
5. **Consider motion preferences** — Reduce motion for accessibility:
   ```css
   @media (prefers-reduced-motion: reduce) {
     * { transition: none !important; }
   }
   ```

### Linting & Enforcement

**Stylelint Rule** (Phase 3-B): Hard-coded `box-shadow` values are enforced via stylelint:
```json
{
  "declaration-property-value-disallowed-list": {
    "box-shadow": ["/rgba\\(/", "/rgb\\(/", "/hsl\\(/", "/[0-9]+px/", "/^0\\s+0\\s+/"]
  }
}
```

**Exceptions**: Hard-coded shadows are allowed ONLY when used for **decorative effects** (not elevation), with explicit documentation:

```css
/* ✅ Allowed: Decorative glow (not elevation) */
.nav-item.active::before {
  box-shadow: 0 0 10px rgba(59, 130, 246, 0.5);  /* Glow effect */
  /* @explain: Decorative glow for visual emphasis - not elevation shadow */
}

/* ❌ Disallowed: Hard-coded elevation shadow */
.card {
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);  /* Use var(--shadow-1) instead */
}
```

---

## Dark Mode Adjustments

In dark mode, shadows are more visible. Slight opacity increases recommended:

```css
@media (prefers-color-scheme: dark) {
  :root {
    /* Increase opacity by ~0.05 for visibility */
    --shadow-1: 0 1px 3px rgba(0, 0, 0, 0.10);
    --shadow-2: 0 4px 12px rgba(0, 0, 0, 0.13);
    --shadow-3: 0 10px 30px rgba(0, 0, 0, 0.20);
    --shadow-4: 0 20px 50px rgba(0, 0, 0, 0.25);
    --shadow-inset: inset 0 1px 2px rgba(0, 0, 0, 0.10);
  }
}
```

---

## Migration Guide

### From Inline Shadows to Tokens

**Before** (hard-coded):
```css
.card {
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);  /* Non-standard */
}
```

**After** (tokenized):
```css
.card {
  box-shadow: var(--shadow-1);  /* 0 1px 3px rgba(0, 0, 0, 0.05) */
}
```

### Gradual Rollout Strategy

1. **Phase 1** (Now): Define tokens in `styles.css`
2. **Phase 2** (Next sprint): Update new components to use tokens
3. **Phase 3** (Future): Refactor existing components systematically
4. **Phase 4** (Optional): Create `.elevation-1`, `.elevation-2` utility classes

---

## Testing & Validation

### Visual QA Checklist

- [ ] All cards have distinct shadow at rest
- [ ] Hover/interactive states show elevation increase
- [ ] Modal backgrounds are significantly darker (Level 3–4)
- [ ] Glassmorphism panels have readable text over backdrop
- [ ] Dark mode shadows remain visible
- [ ] Focus rings are accessible (WCAG AA contrast)
- [ ] Transitions are smooth (no jank)

### Performance Audit

```bash
# Check for "transition: all" (performance issue)
grep -r "transition: all" src/
```

### Accessibility Audit

- Verify focus rings meet WCAG AAA contrast (7:1 ratio)
- Test keyboard navigation (Tab key) shows clear focus indicators
- Test with `prefers-reduced-motion: reduce` enabled

---

## Related Documents

- **[COLOR.md](./COLOR.md)** — Color palette & semantic tokens
- **[SPACING.md](./SPACING.md)** — Spacing scale (4px grid)
- **[RADIUS.md](./RADIUS.md)** — Border radius scale
- **[MOTION.md](./MOTION.md)** — Animation & transition system
- **[BUTTONS.md](./BUTTONS.md)** — Button component spec (uses elevation)
- **[FORMS.md](./FORMS.md)** — Form component spec (input focus shadows)
- **[FEEDBACK.md](./FEEDBACK.md)** — Feedback components (modal shadows)

---

## Implementation Checklist

- [x] Define 5-level elevation system
- [x] Create CSS custom properties (tokens)
- [x] Add tokens to `styles.css` (CSS root) - Lines 148-168
- [x] Test dark mode adjustments - Lines 1464-1492
- [x] Refactor existing hard-coded shadows (Phase 3-A/3-B)
- [x] Add stylelint enforcement rule (Phase 3-B)
- [x] Update component documentation
- [ ] Create utility classes (optional)
- [ ] Perform accessibility audit
- [ ] Document in Storybook (future)

---

## Appendix A: Shadow Recipes

### Card with Hover Effect
```css
.card {
  background: var(--bg-card);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-1);
  transition: box-shadow 0.2s ease-out;
}

.card:hover {
  box-shadow: var(--shadow-2);
}
```

### Sticky Header (Glassmorphism)
```css
.sticky-header {
  position: sticky;
  top: 0;
  background: rgba(255, 255, 255, 0.6);
  backdrop-filter: blur(12px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  z-index: 50;
}
```

### Modal Overlay with Backdrop
```css
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 200;
}

.modal {
  background: var(--bg-card);
  box-shadow: var(--shadow-3);
  border-radius: var(--radius-2xl);
  z-index: 201;
}
```

### Input with Focus Glow
```css
input {
  border: 1px solid var(--border);
  background: var(--bg-input);
  box-shadow: var(--shadow-inset);
  transition: box-shadow 0.2s ease-out;
}

input:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
  outline: none;
}
```

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-01-10 | Initial: 5-level system, single-layer shadows, glassmorphism support |

---

**Owner**: Design System Team  
**Last Reviewed**: 2026-01-10  
**Next Review**: 2026-02-10
