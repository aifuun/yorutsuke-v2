# Design System Compliance Checklist

**Use this checklist BEFORE starting any UI component implementation**

---

## Phase 1: Design Specification Review (Before Coding)

### Step 1: Identify Component Type
- [ ] **Is it a button?** → Read `docs/design/BUTTONS.md`
- [ ] **Is it a form input?** → Read `docs/design/FORMS.md`
- [ ] **Is it feedback (toast/modal)?** → Read `docs/design/FEEDBACK.md`
- [ ] **Is it part of a view?** → Read `docs/design/0X-*.md` (0=overview, 1=dashboard, etc.)
- [ ] **Is it a custom component?** → Check `docs/design/STATES.md`, `ACCESSIBILITY.md`

### Step 2: Read Required Design Docs
- [ ] Read primary component spec
- [ ] Read `docs/design/ACCESSIBILITY.md` (all components need a11y)
- [ ] Read `docs/design/COLOR.md` (color tokens)
- [ ] Read `docs/design/TYPOGRAPHY.md` (text styles)
- [ ] Read `docs/design/SPACING.md` (padding, margin, gaps)

### Step 3: Document Your Understanding
Before coding, answer these questions:

**Colors Used**:
- [ ] List semantic color tokens (e.g., `--color-primary`, `--text-default`)
- [ ] Check contrast ratio in `ACCESSIBILITY.md` (4.5:1 for normal text, 3:1 for large)

**Spacing**:
- [ ] Padding: _______ (use `--space-X`)
- [ ] Margin: _______ (use `--space-X`)
- [ ] Gap: _______ (use `--space-X`)

**Typography**:
- [ ] Font size: _______ (use `--text-XS/SM/MD/LG/XL`)
- [ ] Font weight: _______ (400, 500, 600, 700)
- [ ] Line height: _______ (use design spec value)

**States**:
- [ ] Default state ✓
- [ ] Hover state ✓
- [ ] Focus state (outline-based, 2px) ✓
- [ ] Active state ✓
- [ ] Disabled state ✓
- [ ] Error state (if applicable) ✓

**Accessibility**:
- [ ] ARIA role needed? (e.g., `role="button"`)
- [ ] ARIA label needed? (e.g., `aria-label="Close"`)
- [ ] Keyboard navigation? (Tab, Enter, Escape)
- [ ] Focus management? (visible outline, focus trap if modal)
- [ ] Reduced motion? (@media prefers-reduced-motion)

---

## Phase 2: Implementation

### Step 1: Component Structure
- [ ] No inline styles (use CSS classes)
- [ ] Component exported from `components/index.ts`
- [ ] TypeScript types defined and specific
- [ ] Component structure matches design spec exactly

### Step 2: CSS Token Compliance

**Colors** (use only semantic tokens):
```css
/* ❌ NEVER */
background: #3b82f6;
color: rgb(31, 41, 55);

/* ✅ ALWAYS */
background: var(--color-primary);
color: var(--text-default);
```

- [ ] All colors use `var(--color-*)` or `var(--text-*)`
- [ ] No hard-coded hex/rgb values
- [ ] Semantic tokens match design intent

**Spacing** (use only `--space-X` tokens):
```css
/* ❌ NEVER */
padding: 12px 16px;
margin: 8px 0;
gap: 20px;

/* ✅ ALWAYS */
padding: var(--space-3) var(--space-4);
margin: var(--space-2) 0;
gap: var(--space-5);
```

- [ ] Padding uses `--space-X`
- [ ] Margin uses `--space-X`
- [ ] Gap uses `--space-X`

**Typography** (use design-defined values):
```css
/* ❌ NEVER */
font-size: 14px;
line-height: 1.6;
font-weight: 500;

/* ✅ ALWAYS */
font-size: var(--text-sm);
line-height: 1.5;
font-weight: 500;
```

- [ ] Font sizes use `var(--text-*)`
- [ ] Line heights from design spec
- [ ] Font weights: 400, 500, 600, 700 only

**Animations** (use motion tokens):
```css
/* ❌ NEVER */
transition: all 300ms cubic-bezier(0.4, 0, 0.2, 1);

/* ✅ ALWAYS */
transition: background-color var(--duration-base) var(--ease-out);
```

- [ ] Duration uses `--duration-instant/fast/base`
- [ ] Easing uses `--ease-out/in/standard`
- [ ] Animation-duration uses design tokens

**Shadows & Radius**:
- [ ] Shadows use `--shadow-1/2/3/4` (if any)
- [ ] Border radius uses `--radius-xs/sm/md/lg/2xl` (if any)

### Step 3: Accessibility Implementation

**ARIA Attributes**:
```tsx
/* ❌ WRONG */
<button>Delete</button>  /* No aria-label, no role */

/* ✅ RIGHT */
<button
  aria-label="Delete item"
  onClick={handleDelete}
>
  🗑️ Delete
</button>
```

- [ ] Buttons have `aria-label` (if icon-only)
- [ ] Form inputs have `aria-label` or linked label
- [ ] Modals have `role="dialog"` and `aria-modal="true"`
- [ ] Alerts have `role="alert"` and `aria-live="polite"`
- [ ] Custom elements have appropriate `role` attribute

**Focus Management**:
```css
/* ✅ REQUIRED */
.button:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

/* ❌ NEVER */
.button:focus {
  outline: none;  /* Don't remove focus! */
}
```

- [ ] Focus state uses `:focus-visible` (not :focus)
- [ ] Focus outline is 2px solid with offset
- [ ] Focus color is accessible (`--color-primary`)
- [ ] No `outline: none` without replacement

**Keyboard Navigation**:
- [ ] Tab key navigates through all interactive elements
- [ ] Enter/Space activates buttons and controls
- [ ] Escape closes modals/dialogs (if applicable)
- [ ] Arrow keys work for multi-option inputs (if applicable)

**Reduced Motion**:
```css
/* ✅ REQUIRED for all animations */
@media (prefers-reduced-motion: reduce) {
  .modal {
    animation: none;
    transition: none;
  }
}
```

- [ ] All animations have @media (prefers-reduced-motion)
- [ ] Animations disabled (none) in reduced motion mode
- [ ] Functionality preserved without animation

**Color Contrast**:
- [ ] Text contrast ≥ 4.5:1 (normal text)
- [ ] Text contrast ≥ 3:1 (large text, UI components)
- [ ] Not sole indicator: use icon, label, or pattern + color

### Step 4: Responsive Design

- [ ] Mobile (< 768px): layout correct, text readable, touch targets 44×44px
- [ ] Tablet (768px - 1024px): intermediate layout
- [ ] Desktop (> 1024px): full layout with all features
- [ ] No horizontal scroll on mobile
- [ ] Images/text scale appropriately

---

## Phase 3: Code Quality Review

### Before Submitting PR

- [ ] No `console.log()` or debug code
- [ ] No commented-out code
- [ ] No inline styles (`style={{ }}`)
- [ ] CSS file created alongside component
- [ ] Component properly exported in `components/index.ts`
- [ ] TypeScript types are specific (not `any`)
- [ ] No import of internal files (use index exports)

### CSS Code Review

```css
/* ✅ GOOD: Clear, explicit, tokens-based */
.button {
  padding: var(--space-3) var(--space-4);
  background: var(--color-primary);
  color: var(--text-inverse);
  border: none;
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  font-weight: 600;
  cursor: pointer;
  transition: background-color var(--duration-fast) var(--ease-out);
}

.button:hover:not(:disabled) {
  background: var(--color-primary-dark);
}

.button:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

@media (prefers-reduced-motion: reduce) {
  .button {
    transition: none;
  }
}
```

- [ ] All values are tokens (no hard-coded pixels)
- [ ] Clear selector naming (`.component-name`, `.component-name--variant`)
- [ ] States defined (hover, focus, active, disabled)
- [ ] Responsive rules in media queries
- [ ] Reduced motion support included
- [ ] DRY but clear (not over-abstracted)

---

## Phase 4: Testing

### Visual Testing
- [ ] Component looks identical to design spec
- [ ] Colors match exactly
- [ ] Spacing is correct
- [ ] Typography is correct
- [ ] States (hover, focus, disabled) work

### Interaction Testing
- [ ] Hover state works
- [ ] Focus state visible
- [ ] Click/tap activates action
- [ ] Keyboard navigation works (Tab, Enter, Escape)
- [ ] Disabled state prevents interaction

### Accessibility Testing
- [ ] Screen reader announces text correctly
- [ ] Tab order is logical
- [ ] Focus outline visible throughout
- [ ] Color contrast OK (use WebAIM checker)
- [ ] Animations stop in reduced motion mode

### Responsive Testing
- [ ] Mobile layout correct (resize to 375px)
- [ ] Tablet layout correct (resize to 768px)
- [ ] Desktop layout correct (full width)
- [ ] Touch targets 44×44px minimum on mobile
- [ ] Text readable on all sizes

---

## Quick Reference: Document Locations

| Need | Document | Find By |
|------|----------|---------|
| Button styles | `BUTTONS.md` | Search "variants", "states" |
| Form input spec | `FORMS.md` | Search specific input type |
| Modal/Toast | `FEEDBACK.md` | Search component name |
| Colors | `COLOR.md` | Search "semantic", "tokens" |
| Text styles | `TYPOGRAPHY.md` | Search "scale", "weights" |
| Spacing values | `SPACING.md` | Search `--space-` |
| Icons | `ICONS.md` | Search "Lucide", "mapping" |
| Accessibility | `ACCESSIBILITY.md` | Search "WCAG", "ARIA" |
| Animations | `MOTION.md` | Search "duration", "easing" |
| Shadows | `SHADOWS.md` | Search `--shadow-` |
| Radius | `RADIUS.md` | Search `--radius-` |
| Screen specs | `0X-*.md` | Search view name |

---

## Common Mistakes & Fixes

| Mistake | Fix | Reference |
|---------|-----|-----------|
| Hard-coded colors (`#3b82f6`) | Use `var(--color-primary)` | `docs/design/COLOR.md` |
| Hard-coded spacing (`12px`) | Use `var(--space-3)` | `docs/design/SPACING.md` |
| No focus state | Add `:focus-visible` with outline | `docs/design/ACCESSIBILITY.md` |
| No reduced motion | Add `@media (prefers-reduced-motion)` | `docs/design/MOTION.md` |
| No aria-label | Add `aria-label="Description"` | `docs/design/ACCESSIBILITY.md` |
| Hard-coded font-size | Use `var(--text-sm)` | `docs/design/TYPOGRAPHY.md` |
| Inline styles | Move to CSS class | `.prot/checklists/in-code.md` |
| No keyboard nav | Test Tab, Enter, Escape | `docs/design/ACCESSIBILITY.md` |

---

## Sign-Off

When complete, mark all sections done:

- [ ] Design Specification Review ✓
- [ ] Implementation ✓
- [ ] Code Quality Review ✓
- [ ] Testing ✓
- [ ] Ready for PR

**Component Name**: _____________________

**Design Docs Reviewed**: _____________________

**Accessibility Level**: [ ] WCAG AA [ ] WCAG AAA

**Notes**: _____________________

---

**Version**: 1.0
**Last Updated**: 2026-01-10
**Status**: Ready for MVP3 Frontend Development
