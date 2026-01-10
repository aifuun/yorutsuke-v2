# Button Component System
> Strategy: 70% Material Design 3 + 30% Yorutsuke pragmatism

## Overview

Button component specifications defining variants, sizes, states, and accessibility requirements. Provides unified design system for all interactive button elements across the application.

**Current Status**: Documentation complete, ready for implementation.

---

## Button Variants

### 1. Primary Button (Main Actions)

**Use Cases**: Submit forms, confirm actions, main CTA

**Visual**:
- Background: `var(--color-primary)` (Blue 500, #3B82F6)
- Text: `white`
- Border: none
- Shadow: `var(--shadow-1)` (default), `var(--shadow-2)` (hover)

**When to Use**:
- ✅ One primary action per screen
- ✅ Submit buttons
- ✅ Confirm dialogs
- ✅ Main CTAs (e.g., "Upload Receipt")

**CSS Example**:
```css
.btn-primary {
  background: var(--color-primary);
  color: white;
  border: none;
  border-radius: var(--radius-md);
  padding: 12px var(--space-4);
  font-weight: 600;
  font-size: 13px;
  box-shadow: var(--shadow-1);
  transition: all var(--duration-fast) var(--ease-standard);
}

.btn-primary:hover {
  background: var(--color-primary-hover);
  box-shadow: var(--shadow-2);
  transform: translateY(-1px);
}
```

---

### 2. Secondary Button (Alternative Actions)

**Use Cases**: Cancel, secondary actions, alternative choices

**Visual** (Updated #136 for light theme visibility):
- Background: `white`
- Text: `var(--slate-700)` (#334155)
- Border: `1px solid var(--slate-300)`
- Shadow: none (default), `var(--shadow-1)` (hover)

**When to Use**:
- ✅ Cancel buttons (next to Primary)
- ✅ Alternative actions
- ✅ Non-destructive secondary operations

**CSS Example**:
```css
.btn-secondary {
  background: white;
  color: var(--slate-700);
  border: 1px solid var(--slate-300);
  border-radius: var(--radius-md);
  padding: 12px var(--space-4);
  font-weight: 600;
  font-size: 13px;
  line-height: 1.2;
  transition:
    background-color var(--duration-fast) var(--ease-standard),
    border-color var(--duration-fast) var(--ease-standard);
}

.btn-secondary:hover {
  background: var(--slate-50);
  border-color: var(--slate-400);
  box-shadow: var(--shadow-1);
}
```

---

### 3. Ghost Button (Tertiary Actions)

**Use Cases**: Inline actions, navigation, low emphasis operations

**Visual**:
- Background: `transparent`
- Text: `var(--slate-600)` (#475569)
- Border: none
- Shadow: none

**When to Use**:
- ✅ Inline text actions (e.g., "Edit", "Delete")
- ✅ Toolbar buttons
- ✅ Navigation items
- ✅ Icon-only buttons

**CSS Example**:
```css
.btn-ghost {
  background: transparent;
  color: var(--slate-600);
  border: none;
  border-radius: var(--radius-md);
  padding: 12px var(--space-4);
  font-weight: 600;
  font-size: 13px;
  transition: all var(--duration-fast) var(--ease-standard);
}

.btn-ghost:hover {
  background: rgba(0, 0, 0, 0.05);
  color: var(--slate-800);
}
```

---

### 4. Danger Button (Destructive Actions)

**Use Cases**: Delete, remove, destructive operations

**Visual**:
- Background: `var(--color-error)` (Rose 500, #F43F5E)
- Text: `white`
- Border: none
- Shadow: `var(--shadow-1)` (default), `var(--shadow-2)` (hover)

**When to Use**:
- ✅ Delete operations
- ✅ Destructive actions (cannot undo)
- ✅ Remove/Clear data
- ⚠️ Always pair with confirmation dialog

**CSS Example**:
```css
.btn-danger {
  background: var(--color-error);
  color: white;
  border: none;
  border-radius: var(--radius-md);
  padding: 12px var(--space-4);
  font-weight: 600;
  font-size: 13px;
  box-shadow: var(--shadow-1);
  transition: all var(--duration-fast) var(--ease-standard);
}

.btn-danger:hover {
  background: var(--rose-600);
  box-shadow: var(--shadow-2);
  transform: translateY(-1px);
}
```

---

## Button Sizes

### Small (sm) - ~32px height

**Use Cases**: Inline actions, compact spaces, toolbars

**Dimensions** (Padding-based, no fixed height):
- Padding: `8px 12px`
- Font-size: `13px`
- Line-height: `1.2` (15.6px)
- Total height: ~32px (8 + 15.6 + 8)
- Icon size: `16px`

**CSS Example**:
```css
.btn-sm {
  padding: 8px 12px;
  font-size: 13px;
  line-height: 1.2;
}

.btn-sm .icon {
  width: 16px;
  height: 16px;
}
```

**Note**: No `height` property - padding determines button size (M3 standard).

---

### Medium (md) - ~40px height ← **Default**

**Use Cases**: Standard buttons, forms, most use cases

**Dimensions** (Padding-based, no fixed height):
- Padding: `12px var(--space-4)` (12px 16px)
- Font-size: `13px`
- Line-height: `1.2` (15.6px)
- Total height: ~40px (12 + 15.6 + 12)
- Icon size: `20px`

**CSS Example**:
```css
.btn, .btn-md {
  padding: 12px var(--space-4);
  font-size: 13px;
  line-height: 1.2;
}

.btn .icon {
  width: 20px;
  height: 20px;
}
```

**Note**: No `height` property - padding determines button size (M3 standard).

---

### Large (lg) - ~48px height

**Use Cases**: Hero sections, primary CTAs, emphasis

**Dimensions** (Padding-based, no fixed height):
- Padding: `16px 20px`
- Font-size: `14px`
- Line-height: `1.2` (16.8px)
- Total height: ~48px (16 + 16.8 + 16)
- Icon size: `24px`

**CSS Example**:
```css
.btn-lg {
  padding: 16px 20px;
  font-size: 14px;
  line-height: 1.2;
}

.btn-lg .icon {
  width: 24px;
  height: 24px;
}
```

**Note**: No `height` property - padding determines button size (M3 standard).

---

## Button States

### 1. Default State

Base styling as defined in variants above.

---

### 2. Hover State

**Visual Changes**:
- Background color darkens (Primary: blue-600, Secondary: slate-200)
- Shadow increases (shadow-1 → shadow-2)
- Slight lift effect: `transform: translateY(-1px)`
- Cursor: `pointer`

**Transition**: `var(--duration-fast)` (200ms)

**CSS Example**:
```css
.btn:hover {
  cursor: pointer;
  transform: translateY(-1px);
}

.btn-primary:hover {
  background: var(--color-primary-hover);
  box-shadow: var(--shadow-2);
}
```

---

### 3. Active State (Pressed)

**Visual Changes**:
- Slightly darker background
- Shadow reduces: `var(--shadow-1)` → `none`
- Press down effect: `transform: translateY(0)` or `scale(0.98)`

**CSS Example**:
```css
.btn:active {
  transform: translateY(0) scale(0.98);
  box-shadow: none;
}

.btn-primary:active {
  background: var(--blue-600);
}
```

---

### 4. Disabled State

**Visual Changes**:
- Opacity: `0.5`
- Cursor: `not-allowed`
- No hover effects
- Pointer events: `none`

**CSS Example**:
```css
.btn:disabled,
.btn[disabled] {
  opacity: 0.5;
  cursor: not-allowed;
  pointer-events: none;
}
```

**HTML**:
```html
<button class="btn btn-primary" disabled>Disabled Button</button>
```

---

### 5. Loading State

**Visual Changes**:
- Show spinner icon (animated rotation)
- Disable pointer events
- Optional: Fade out text, show "Loading..."
- Maintain button dimensions (prevent layout shift)

**CSS Example**:
```css
.btn-loading {
  position: relative;
  pointer-events: none;
}

.btn-loading::before {
  content: '';
  position: absolute;
  left: 12px;
  width: 16px;
  height: 16px;
  border: 2px solid currentColor;
  border-top-color: transparent;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.btn-loading .btn-text {
  opacity: 0.5;
  margin-left: 24px; /* Space for spinner */
}
```

**React Example**:
```typescript
<button className={`btn btn-primary ${isLoading ? 'btn-loading' : ''}`} disabled={isLoading}>
  {isLoading && <span className="spinner" />}
  <span className="btn-text">{isLoading ? 'Loading...' : 'Submit'}</span>
</button>
```

---

## Icon Support

### Icon Position

**Left Icon** (most common):
```html
<button class="btn btn-primary">
  <svg class="icon-left"><!-- icon --></svg>
  <span>Upload</span>
</button>
```

**Right Icon**:
```html
<button class="btn btn-secondary">
  <span>Next</span>
  <svg class="icon-right"><!-- icon --></svg>
</button>
```

**Icon Only**:
```html
<button class="btn btn-ghost btn-icon" aria-label="Close">
  <svg class="icon"><!-- close icon --></svg>
</button>
```

### Icon Spacing

**CSS**:
```css
.btn .icon-left {
  margin-right: 8px;
}

.btn .icon-right {
  margin-left: 8px;
}

.btn-icon {
  width: 40px;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.btn-icon.btn-sm {
  width: 32px;
}

.btn-icon.btn-lg {
  width: 48px;
}
```

---

## Design Specifications

### Common Properties

| Property | Value | Token | Notes |
|----------|-------|-------|-------|
| **Border Radius** | 8px | `var(--radius-md)` | Consistent with design system |
| **Font Weight** | 600 | `font-weight: 600` | Semi-bold for emphasis |
| **Font Family** | Inter | `var(--font-ui)` | System font |
| **Transition** | 200ms | `var(--duration-fast)` | Standard interaction speed |
| **Easing** | Standard | `var(--ease-standard)` | M3 curve |
| **Line Height** | 1.2 | - | Tight for buttons |
| **Text Transform** | none | - | No uppercase (Japanese support) |

### Touch Targets (Accessibility)

**Minimum Size**: 44px × 44px (WCAG 2.1 AAA)

- Small buttons (32px) should have extra padding/margin or larger hit area
- Use `::before` pseudo-element to extend hit area if needed

**CSS**:
```css
.btn-sm {
  position: relative;
}

.btn-sm::before {
  content: '';
  position: absolute;
  top: -6px;
  left: -6px;
  right: -6px;
  bottom: -6px;
  /* Extends hit area to 44px minimum */
}
```

---

## Accessibility

### Keyboard Navigation

**Requirements**:
- ✅ Focusable: `tabindex="0"` (default for `<button>`)
- ✅ Focus visible: Blue ring (2px solid)
- ✅ Enter/Space: Trigger click

**Focus Ring**:
```css
.btn:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}
```

### ARIA Attributes

**Icon-only buttons**:
```html
<button class="btn btn-icon" aria-label="Close dialog">
  <svg><!-- X icon --></svg>
</button>
```

**Loading state**:
```html
<button class="btn btn-primary" aria-busy="true" disabled>
  Loading...
</button>
```

**Disabled state**:
```html
<button class="btn btn-primary" disabled aria-disabled="true">
  Submit
</button>
```

### Color Contrast (WCAG AA)

| Variant | Background | Text | Ratio | Pass |
|---------|-----------|------|-------|------|
| Primary | Blue 500 | White | 4.6:1 | ✅ AA |
| Secondary | Slate 100 | Slate 700 | 7.2:1 | ✅ AAA |
| Ghost | Transparent | Slate 600 | 5.1:1 | ✅ AA |
| Danger | Rose 500 | White | 4.8:1 | ✅ AA |

**All variants meet WCAG AA standard (≥4.5:1)**.

---

## React Component Example

```typescript
import { ReactNode } from 'react';
import './Button.css';

interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
  children: ReactNode;
  onClick?: () => void;
  type?: 'button' | 'submit' | 'reset';
  'aria-label'?: string;
}

export function Button({
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  iconLeft,
  iconRight,
  children,
  onClick,
  type = 'button',
  'aria-label': ariaLabel,
}: ButtonProps) {
  const className = [
    'btn',
    `btn-${variant}`,
    `btn-${size}`,
    loading && 'btn-loading',
  ].filter(Boolean).join(' ');

  return (
    <button
      type={type}
      className={className}
      disabled={disabled || loading}
      onClick={onClick}
      aria-label={ariaLabel}
      aria-busy={loading}
    >
      {loading && <span className="spinner" />}
      {iconLeft && <span className="icon-left">{iconLeft}</span>}
      <span className="btn-text">{children}</span>
      {iconRight && <span className="icon-right">{iconRight}</span>}
    </button>
  );
}
```

**Usage**:
```typescript
import { Button } from '@/components/Button';

// Primary button
<Button variant="primary" onClick={handleSubmit}>
  Submit
</Button>

// Secondary with icon
<Button variant="secondary" iconLeft={<IconUpload />}>
  Upload
</Button>

// Small ghost button
<Button variant="ghost" size="sm">
  Cancel
</Button>

// Loading state
<Button variant="primary" loading={isSubmitting}>
  {isSubmitting ? 'Submitting...' : 'Submit'}
</Button>

// Danger button
<Button variant="danger" onClick={handleDelete}>
  Delete
</Button>
```

---

## Anti-Patterns

### ❌ DON'T

1. **Multiple Primary buttons on same screen**:
   ```html
   <!-- Bad: Too many primary actions -->
   <button class="btn btn-primary">Save</button>
   <button class="btn btn-primary">Cancel</button>
   ```

2. **Uppercase text** (bad for Japanese):
   ```css
   /* Bad: Don't use uppercase */
   .btn { text-transform: uppercase; }
   ```

3. **Too many button sizes**:
   ```css
   /* Bad: Inconsistent sizing */
   .btn-xs { height: 24px; }
   .btn-xl { height: 56px; }
   .btn-2xl { height: 64px; }
   ```

4. **Hard-coded colors**:
   ```css
   /* Bad: Use tokens instead */
   .btn-primary { background: #3B82F6; }
   ```

5. **Disabled without reason**:
   ```html
   <!-- Bad: Provide reason why disabled -->
   <button disabled>Submit</button>
   ```

### ✅ DO

1. **One Primary, others Secondary/Ghost**:
   ```html
   <button class="btn btn-primary">Save</button>
   <button class="btn btn-secondary">Cancel</button>
   ```

2. **Use design tokens**:
   ```css
   .btn-primary { background: var(--color-primary); }
   ```

3. **Provide feedback for disabled state**:
   ```html
   <button disabled aria-label="Submit disabled: Fill all required fields">
     Submit
   </button>
   <span class="help-text">Please fill all required fields</span>
   ```

---

## Button Groups

### Horizontal Button Group

**Use Case**: Related actions (e.g., Save/Cancel)

**CSS**:
```css
.btn-group {
  display: flex;
  gap: var(--space-3); /* 12px */
  align-items: center;
}

.btn-group-attached .btn:not(:first-child) {
  border-top-left-radius: 0;
  border-bottom-left-radius: 0;
}

.btn-group-attached .btn:not(:last-child) {
  border-top-right-radius: 0;
  border-bottom-right-radius: 0;
}
```

**HTML**:
```html
<!-- Spaced buttons (recommended) -->
<div class="btn-group">
  <button class="btn btn-secondary">Cancel</button>
  <button class="btn btn-primary">Save</button>
</div>

<!-- Attached buttons (segmented control) -->
<div class="btn-group btn-group-attached">
  <button class="btn btn-secondary">Day</button>
  <button class="btn btn-secondary">Week</button>
  <button class="btn btn-secondary">Month</button>
</div>
```

---

## Responsive Behavior

### Desktop (≥768px)

Standard sizing as defined above.

### Mobile (<768px)

**Option 1**: Maintain sizing (recommended for most buttons)

**Option 2**: Full-width buttons for CTAs
```css
@media (max-width: 767px) {
  .btn-mobile-full {
    width: 100%;
  }
}
```

**HTML**:
```html
<button class="btn btn-primary btn-mobile-full">
  Continue
</button>
```

---

## Testing Checklist

### Visual Testing

- [ ] **Variants**: All 4 variants render correctly
- [ ] **Sizes**: All 3 sizes have correct dimensions
- [ ] **States**: Hover, active, disabled, loading work
- [ ] **Icons**: Left/right/only positions correct
- [ ] **Focus**: Blue ring visible on Tab

### Interaction Testing

- [ ] **Click**: Triggers onClick handler
- [ ] **Keyboard**: Enter/Space trigger click
- [ ] **Disabled**: No interaction when disabled
- [ ] **Loading**: Spinner shows, button disabled

### Accessibility Testing

- [ ] **Color Contrast**: All variants ≥4.5:1 (WCAG AA)
- [ ] **Keyboard**: Tab order logical
- [ ] **Screen Reader**: aria-label on icon-only buttons
- [ ] **Touch Target**: Minimum 44px × 44px

---

## Related Documents

- **[COLOR.md](./COLOR.md)** - Color tokens (primary, error)
- **[SPACING.md](./SPACING.md)** - Padding and gap values
- **[RADIUS.md](./RADIUS.md)** - Border radius (--radius-md)
- **[MOTION.md](./MOTION.md)** - Transition timing
- **[SHADOWS.md](./SHADOWS.md)** - Box shadow elevation
- **[ACCESSIBILITY.md](./ACCESSIBILITY.md)** - WCAG standards

---

## Decision Log

### [2026-01] 4 Variants Only
**Decision**: Limit to Primary, Secondary, Ghost, Danger.
**Reason**: Covers 95% of use cases, prevents button proliferation.
**Alternatives**: Outline, Link buttons - rejected for simplicity.

### [2026-01] 3 Sizes (sm, md, lg)
**Decision**: Standard 3-size scale, md as default.
**Reason**: Sufficient granularity, prevents size chaos.
**Alternatives**: 5 sizes (xs, sm, md, lg, xl) - rejected as overkill.

### [2026-01] No Uppercase Transform
**Decision**: Don't use `text-transform: uppercase`.
**Reason**: Japanese text doesn't work with uppercase, looks aggressive.
**Alternatives**: Uppercase for English - rejected for consistency.

### [2026-01] 8px Border Radius (--radius-md)
**Decision**: Use --radius-md (8px) for all buttons.
**Reason**: Aligns with design system, balanced softness.
**Alternatives**: 12px (too round), 4px (too sharp).

---

## Next Steps

1. **Implementation**:
   - Create `Button.tsx` React component
   - Create `Button.css` with all variants/sizes/states
   - Add to component library

2. **Migration**:
   - Audit existing buttons in codebase
   - Replace with standardized Button component
   - Update styles to use design tokens

3. **Documentation**:
   - Add to Storybook (future)
   - Create usage guidelines for developers

---

**Last updated**: 2026-01-10
**Version**: 1.0.0
**Status**: ✅ Complete (documentation ready for implementation)
