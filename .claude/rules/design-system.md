# Design System Integration Rules

> **Goal**: Ensure all UI/UX implementations align with documented design specifications before coding.
> **Workflow**: Read design docs → Check tokens → Verify accessibility → Code with confidence

---

## Design System Structure

The design system is organized in `docs/design/` with clear ownership:

### Foundation (Design Tokens)
| Document | Purpose | Coverage |
|----------|---------|----------|
| **COLOR.md** | 25-color palette + semantic tokens | `--color-primary`, `--bg-success`, etc. |
| **TYPOGRAPHY.md** | Font scales, line heights, weights | `--text-sm`, `--text-lg`, font families |
| **SPACING.md** | Space tokens (`--space-1` to `--space-10`) | Padding, margin, gaps |
| **RADIUS.md** | Border radius tokens | `--radius-xs`, `--radius-md`, etc. |
| **SHADOWS.md** | Elevation system (`--shadow-1` to `--shadow-4`) | Cards, dropdowns, modals |
| **MOTION.md** | Animation tokens | `--duration-fast`, `--ease-out` |

### Components (UI Specs)
| Document | Contains | Checklist |
|----------|----------|-----------|
| **BUTTONS.md** | Button variants, states, sizes | 6 items per button type |
| **FORMS.md** | Input, Select, Textarea, Checkbox, Radio | 5 form components verified |
| **FEEDBACK.md** | Toast, Modal, Progress, Loading | 4 feedback types + accessibility |
| **ICONS.md** | Emoji (MVP) + Lucide React migration plan | Icon sizing, accessibility |
| **ACCESSIBILITY.md** | WCAG 2.1 AA/AAA compliance | Color contrast, keyboard nav, ARIA |
| **STATES.md** | Component states (hover, focus, disabled, error) | State patterns and transitions |
| **DATA-VIZ.md** | Charts, graphs, progress visualization | Dashboard specific |

### Views (Screen Specs)
| Document | Contains | Status |
|----------|----------|--------|
| **01-dashboard.md** | Today's summary, stats, queue | Design ready |
| **02-ledger.md** | Transaction list, filters, sorting | Design ready |
| **03-capture.md** | Receipt upload, preview, queue | Design ready |
| **04-settings.md** | User preferences, theme, app settings | Design ready |
| **05-admin-panel.md** | Batch config, logs, monitoring | Design + implementation ready |

---

## Pre-Development Checklist (必读)

**Before coding ANY component**, read:

### Step 1: Identify Your Component Type
- [ ] **Form component?** → Read `FORMS.md`
- [ ] **Feedback/Modal?** → Read `FEEDBACK.md`
- [ ] **Button/action?** → Read `BUTTONS.md`
- [ ] **Custom view?** → Read relevant `0X-*.md`
- [ ] **Accessibility critical?** → Read `ACCESSIBILITY.md`

### Step 2: Identify Required Tokens
- [ ] **Colors**: Check `COLOR.md` (semantic tokens only)
- [ ] **Typography**: Check `TYPOGRAPHY.md` (use `--text-sm`, not `14px`)
- [ ] **Spacing**: Check `SPACING.md` (use `--space-3`, not `12px`)
- [ ] **Shadows**: Check `SHADOWS.md` (use `--shadow-2`, not custom)
- [ ] **Motion**: Check `MOTION.md` (use `--duration-base`, not `300ms`)
- [ ] **Radius**: Check `RADIUS.md` (use `--radius-md`, not `8px`)

### Step 3: Verify Accessibility
- [ ] **Color contrast**: Check `ACCESSIBILITY.md` color specs (4.5:1 or 3:1)
- [ ] **Focus management**: Check `ACCESSIBILITY.md` keyboard section
- [ ] **ARIA labels**: Check `FORMS.md` or `FEEDBACK.md` for pattern
- [ ] **Reduced motion**: Ensure all animations have `@media (prefers-reduced-motion)`

### Step 4: Implementation Approach
- [ ] Copy exact component structure from design doc
- [ ] Use tokens, NOT hard-coded values
- [ ] Include accessibility attributes (ARIA, role, aria-label)
- [ ] Test responsive design (desktop, tablet, mobile)

---

## Token Usage Rules

### Rule 1: No Hard-Coded Values

❌ **NEVER do this**:
```css
.button {
  padding: 12px 16px;          /* Hard-coded */
  color: #1f2937;              /* Hard-coded */
  background: #3b82f6;         /* Hard-coded */
  border-radius: 8px;          /* Hard-coded */
  font-size: 14px;             /* Hard-coded */
  transition: all 200ms ease;  /* Hard-coded */
}
```

✅ **ALWAYS do this**:
```css
.button {
  padding: var(--space-3) var(--space-4);        /* Token */
  color: var(--text-default);                     /* Token */
  background: var(--color-primary);              /* Token */
  border-radius: var(--radius-md);               /* Token */
  font-size: var(--text-sm);                     /* Token */
  transition: background-color var(--duration-fast) var(--ease-out);  /* Tokens */
}
```

### Rule 2: Semantic Colors Only

✅ **Use semantic tokens** (from COLOR.md):
- `--color-primary` (brand color)
- `--color-success` (success/confirmed)
- `--color-error` (error/danger)
- `--color-warning` (warning)
- `--text-default` (primary text)
- `--text-muted` (secondary text)
- `--bg-default`, `--bg-card` (backgrounds)

❌ **Don't use raw colors**:
- `--blue-500`, `--emerald-600` (use semantic wrapper)
- RGB/Hex values (use tokens)
- Named colors like "primary", "success" (use CSS vars)

### Rule 3: Spacing Scale

All spacing uses `--space-X` tokens (4px base unit):

```
--space-1:  4px   (xs gaps, tight)
--space-2:  8px   (small gaps)
--space-3:  12px  (default padding)
--space-4:  16px  (card padding)
--space-5:  20px  (section gaps)
--space-6:  24px  (large gaps)
--space-8:  32px  (xl spacing)
--space-10: 40px  (xxl spacing)
```

**Usage**:
```css
.card {
  padding: var(--space-4);           /* 16px all sides */
  margin-bottom: var(--space-5);     /* 20px bottom */
  gap: var(--space-3);               /* 12px gaps in flex */
}
```

### Rule 4: Text Styles (Never Set Font-Size Alone)

Don't do this:
```css
.heading { font-size: 20px; }  /* ❌ Missing weight, line-height, letter-spacing */
```

Do this (copy from TYPOGRAPHY.md):
```css
.heading {
  font-size: var(--text-lg);
  font-weight: 700;
  line-height: 1.5;
  letter-spacing: -0.01em;
}
```

Or use pre-defined classes:
```html
<h2 class="text-lg font-bold">Heading</h2>
```

---

## Component Implementation Pattern

### Pattern: Minimal, Explicit, Tokens-First

```tsx
// 1. Import only what you need
import './MyComponent.css';

interface MyComponentProps {
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
}

// 2. Component logic (no styling logic)
export function MyComponent({ variant = 'primary', disabled }: MyComponentProps) {
  return (
    <div
      className={`my-component my-component--${variant}`}
      aria-disabled={disabled}  // Accessibility
    >
      {/* Content */}
    </div>
  );
}
```

```css
/* MyComponent.css - Tokens only */

.my-component {
  padding: var(--space-4);
  background: var(--bg-default);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  transition: background-color var(--duration-fast) var(--ease-out);
}

.my-component:hover:not([aria-disabled="true"]) {
  background: var(--bg-card);
}

.my-component--primary {
  color: var(--color-primary);
}

.my-component--secondary {
  color: var(--text-default);
}

/* Accessibility */
@media (prefers-reduced-motion: reduce) {
  .my-component {
    transition: none;
  }
}
```

---

## Verification Checklist (Per Component)

Use this before marking component complete:

### Visual Compliance
- [ ] Colors match design spec (no custom colors)
- [ ] Spacing uses only `--space-X` tokens
- [ ] Typography follows `TYPOGRAPHY.md` scale
- [ ] Border radius uses `--radius-*` tokens
- [ ] Shadows (if any) use `--shadow-*` tokens
- [ ] No hard-coded pixel values anywhere

### Interaction & States
- [ ] Hover state defined
- [ ] Focus state defined (outline-based)
- [ ] Disabled state defined
- [ ] Error/warning state defined (if applicable)
- [ ] Transitions use `--duration-*` and `--ease-*` tokens
- [ ] All states match design spec

### Accessibility
- [ ] ARIA roles defined (e.g., `role="button"` for custom buttons)
- [ ] ARIA labels present (`aria-label` or `aria-labelledby`)
- [ ] Keyboard navigation works (Tab, Enter, Escape)
- [ ] Focus visible (outline: 2px solid var(--color-primary))
- [ ] Color not sole indicator (icons, labels, patterns)
- [ ] Reduced motion support (@media prefers-reduced-motion)

### Responsive Design
- [ ] Mobile (< 768px) layout correct
- [ ] Tablet (768px - 1024px) layout correct
- [ ] Desktop (> 1024px) layout correct
- [ ] Touch targets minimum 44×44px on mobile
- [ ] Font sizes readable on all devices

### Code Quality
- [ ] No inline styles (use CSS classes)
- [ ] No commented-out code
- [ ] CSS follows naming convention (.component-name)
- [ ] TypeScript types correct and specific
- [ ] Exports properly from `components/index.ts`

---

## Common Pitfalls & Fixes

### Pitfall 1: Using Hardcoded Colors

```typescript
// ❌ WRONG
<div style={{ color: '#1f2937', fontSize: '14px' }}>Content</div>

// ✅ RIGHT
<div className="text-default text-sm">Content</div>

// CSS
.text-default { color: var(--text-default); }
.text-sm { font-size: var(--text-sm); }
```

### Pitfall 2: Inventing Tokens

```typescript
// ❌ WRONG
transition: all 300ms cubic-bezier(0.4, 0, 0.2, 1);

// ✅ RIGHT
transition: all var(--duration-base) var(--ease-out);
```

### Pitfall 3: Forgetting Accessibility

```typescript
// ❌ WRONG
<button style={{ backgroundColor: '#10b981' }}>Confirm</button>

// ✅ RIGHT
<button
  className="btn btn-success"
  aria-label="Confirm action"
>
  ✅ Confirm
</button>
```

### Pitfall 4: Skipping Focus State

```css
/* ❌ WRONG */
.button:focus {
  outline: none;  /* Never do this! */
}

/* ✅ RIGHT */
.button:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}
```

### Pitfall 5: Ignoring Reduced Motion

```css
/* ❌ WRONG */
.modal {
  animation: slideIn 0.3s ease-out;
}

/* ✅ RIGHT */
.modal {
  animation: slideIn 0.3s var(--ease-out);
}

@media (prefers-reduced-motion: reduce) {
  .modal {
    animation: none;
  }
}
```

---

## Integration with Development Workflow

### When Starting a Feature

1. **Read design docs first** (before writing code)
   ```bash
   # Example: Starting #114 Dashboard
   cat docs/design/01-dashboard.md
   cat docs/design/COLOR.md
   cat docs/design/TYPOGRAPHY.md
   ```

2. **Check component spec** (if using existing component)
   ```bash
   # Example: Adding a button
   cat docs/design/BUTTONS.md
   ```

3. **Copy structure directly** (don't invent, follow spec exactly)
   - Use the HTML/CSS from design doc
   - Adapt only for React syntax
   - Keep all design decisions

4. **Run verification** before marking done
   - Visual check against design spec
   - Accessibility check
   - Responsive check
   - Token compliance check

### When Code Review

Use this checklist:
- [ ] All colors are semantic tokens
- [ ] No hard-coded pixel values
- [ ] Accessibility attributes present
- [ ] Reduced motion support
- [ ] Responsive on mobile
- [ ] Matches design spec exactly

---

## Quick Reference Commands

```bash
# View complete design system
ls -la docs/design/

# Check color tokens
grep "^--color" app/src/styles.css

# Check spacing tokens
grep "^--space" app/src/styles.css

# Find component in design spec
grep -r "button" docs/design/BUTTONS.md

# Verify token usage in CSS
grep "transition:" app/src/components/*.css
```

---

## Design System Version

| Component | Status | Last Updated |
|-----------|--------|--------------|
| Foundation (Tokens) | ✅ Complete | 2026-01-10 |
| Components (Specs) | ✅ Complete | 2026-01-10 |
| Views (Screens) | ✅ Complete | 2026-01-08 |
| Accessibility | ✅ WCAG AAA | 2026-01-10 |
| M3 Alignment | ✅ 80-90% | 2026-01-10 |

---

## References

- **SOURCE OF TRUTH**: `docs/design/` (all specifications live here)
- **Token definitions**: `app/src/styles.css`
- **Implementation patterns**: `.prot/checklists/`
- **Accessibility rules**: `.claude/rules/views.md`, `docs/design/ACCESSIBILITY.md`

---

**Last Updated**: 2026-01-10
**Version**: 1.0 (Design System Complete)
**Status**: ✅ Ready for MVP3 Frontend Development
