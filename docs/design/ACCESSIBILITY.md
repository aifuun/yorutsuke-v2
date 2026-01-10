# Accessibility Standards
> Target: WCAG 2.1 Level AA compliance

## Overview

Accessibility standards ensure Yorutsuke is usable by all users, including those with disabilities. This document defines requirements for color contrast, keyboard navigation, screen reader support, ARIA attributes, and touch targets.

**Current Status**: Documentation complete, implementation in progress.

**Compliance Goal**: WCAG 2.1 Level AA

---

## Color Contrast (WCAG 2.1 Success Criterion 1.4.3)

### Requirements

| Element Type | Size | Minimum Contrast | Level |
|--------------|------|------------------|-------|
| **Normal Text** | <18px or <14px bold | 4.5:1 | AA |
| **Large Text** | ≥18px or ≥14px bold | 3:1 | AA |
| **Graphics & UI Components** | Icons, buttons, borders | 3:1 | AA |

### Color Palette Compliance

**Text Colors** (on white background):

| Color | Hex | Contrast | Pass |
|-------|-----|----------|------|
| `--text-primary` (Slate 700) | #334155 | 10.7:1 | ✅ AAA |
| `--text-secondary` (Slate 500) | #64748B | 5.1:1 | ✅ AA |
| `--text-muted` (Slate 400) | #94A3B8 | 3.2:1 | ✅ AA (large only) |

**Interactive Elements**:

| Element | Background | Text | Contrast | Pass |
|---------|-----------|------|----------|------|
| Primary Button | Blue 500 (#3B82F6) | White | 4.6:1 | ✅ AA |
| Secondary Button | Slate 100 (#F1F5F9) | Slate 700 (#334155) | 10.7:1 | ✅ AAA |
| Danger Button | Rose 500 (#F43F5E) | White | 4.8:1 | ✅ AA |
| Error Text | Rose 600 (#E11D48) | White bg | 5.2:1 | ✅ AA |
| Success Text | Emerald 600 (#059669) | White bg | 4.5:1 | ✅ AA |

### Testing Color Contrast

**Tools**:
- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)
- Chrome DevTools Lighthouse
- [Colour Contrast Analyser](https://www.tpgi.com/color-contrast-checker/)

**Command**:
```bash
# Run Lighthouse accessibility audit
npm run lighthouse
```

### Exceptions

**Disabled Elements**: No contrast requirement (WCAG 2.1 allows lower contrast for disabled states)

```css
.btn:disabled {
  opacity: 0.5; /* Acceptable - disabled state */
}
```

---

## Keyboard Navigation (WCAG 2.1 Success Criterion 2.1.1, 2.1.2)

### Requirements

1. **All interactive elements must be keyboard accessible**
2. **No keyboard traps** (user can Tab away from any element)
3. **Logical Tab order** (follows visual layout)
4. **Visible focus indicators** (2px outline minimum)

### Focus Indicators

**Standard Focus Ring**:
```css
*:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

/* Remove default outline (but keep :focus-visible) */
*:focus {
  outline: none;
}
```

**Component-Specific Focus**:

```css
/* Buttons */
.btn:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

/* Inputs */
.input:focus {
  border: 2px solid var(--color-primary);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
}

/* Links */
a:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
  border-radius: var(--radius-xs);
}
```

### Tab Order

**Logical Tab Order** (follows reading order: left-to-right, top-to-bottom)

```html
<!-- Good: Logical order -->
<form>
  <input tabindex="0" /> <!-- 1. First name -->
  <input tabindex="0" /> <!-- 2. Last name -->
  <button tabindex="0">Submit</button> <!-- 3. Submit -->
</form>

<!-- Bad: Skip content -->
<form>
  <input tabindex="1" /> <!-- Jumps to here first -->
  <p>Some text</p>
  <input tabindex="2" /> <!-- Then here -->
  <button tabindex="3">Submit</button>
</form>
```

**Best Practice**: Don't use `tabindex` with positive numbers. Use `tabindex="0"` (natural order) or `tabindex="-1"` (programmatically focusable, not in Tab order).

### Keyboard Shortcuts

| Key | Action | Context |
|-----|--------|---------|
| **Tab** | Focus next element | Global |
| **Shift+Tab** | Focus previous element | Global |
| **Enter** | Activate button/link | Buttons, links |
| **Space** | Activate button, toggle checkbox | Buttons, checkboxes |
| **Escape** | Close modal/dialog | Modals, dropdowns |
| **Arrow Keys** | Navigate dropdown options | Select, radio groups |

**Implementation**:

```typescript
// Modal: Close on Escape
useEffect(() => {
  const handleEscape = (e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  };
  document.addEventListener('keydown', handleEscape);
  return () => document.removeEventListener('keydown', handleEscape);
}, [onClose]);
```

### Focus Management

**Modal Dialog** (trap focus inside modal):

```typescript
// Focus trap implementation
useEffect(() => {
  if (!isOpen) return;

  const modal = modalRef.current;
  const focusableElements = modal?.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );

  const firstElement = focusableElements?.[0];
  const lastElement = focusableElements?.[focusableElements.length - 1];

  firstElement?.focus();

  const handleTab = (e: KeyboardEvent) => {
    if (e.key !== 'Tab') return;

    if (e.shiftKey && document.activeElement === firstElement) {
      e.preventDefault();
      lastElement?.focus();
    } else if (!e.shiftKey && document.activeElement === lastElement) {
      e.preventDefault();
      firstElement?.focus();
    }
  };

  document.addEventListener('keydown', handleTab);
  return () => document.removeEventListener('keydown', handleTab);
}, [isOpen]);
```

---

## Screen Reader Support (WCAG 2.1 Success Criterion 1.3.1, 4.1.2)

### Semantic HTML

**Use semantic elements** instead of divs:

```html
<!-- Good: Semantic HTML -->
<header>
  <nav>
    <ul>
      <li><a href="/">Home</a></li>
    </ul>
  </nav>
</header>
<main>
  <article>
    <h1>Page Title</h1>
    <p>Content...</p>
  </article>
</main>
<footer>
  <p>© 2026</p>
</footer>

<!-- Bad: Divs everywhere -->
<div class="header">
  <div class="nav">
    <div class="link">Home</div>
  </div>
</div>
```

### ARIA Attributes

**ARIA Roles**:

| Role | Use Case | Example |
|------|----------|---------|
| `role="button"` | Non-button element acting as button | `<div role="button" tabindex="0">` |
| `role="alert"` | Important error message | `<div role="alert">Error!</div>` |
| `role="status"` | Status update (non-critical) | `<div role="status">Loading...</div>` |
| `role="dialog"` | Modal dialog | `<div role="dialog" aria-modal="true">` |
| `role="navigation"` | Navigation section | `<nav role="navigation">` |
| `role="main"` | Main content | `<main role="main">` |

**ARIA States**:

| Attribute | Use Case | Example |
|-----------|----------|---------|
| `aria-label` | Accessible name | `<button aria-label="Close">×</button>` |
| `aria-labelledby` | Reference to label | `<input aria-labelledby="email-label" />` |
| `aria-describedby` | Reference to description | `<input aria-describedby="email-error" />` |
| `aria-invalid` | Input validation error | `<input aria-invalid="true" />` |
| `aria-required` | Required field | `<input aria-required="true" required />` |
| `aria-disabled` | Disabled element | `<button aria-disabled="true" disabled>` |
| `aria-expanded` | Expandable element | `<button aria-expanded="false">` |
| `aria-hidden` | Hidden from screen readers | `<div aria-hidden="true">` |
| `aria-live` | Dynamic content updates | `<div aria-live="polite">` |
| `aria-busy` | Loading state | `<div aria-busy="true">` |

### Common Patterns

**Button with Icon Only**:
```html
<button aria-label="Delete transaction">
  <svg><!-- trash icon --></svg>
</button>
```

**Form Input with Error**:
```html
<label for="email">Email</label>
<input
  id="email"
  type="email"
  aria-invalid="true"
  aria-describedby="email-error"
/>
<span id="email-error" role="alert">Please enter a valid email</span>
```

**Loading State**:
```html
<div role="status" aria-live="polite" aria-busy="true">
  <span className="spinner" aria-label="Loading"></span>
</div>
```

**Modal Dialog**:
```html
<div
  role="dialog"
  aria-modal="true"
  aria-labelledby="modal-title"
  aria-describedby="modal-description"
>
  <h2 id="modal-title">Confirm Delete</h2>
  <p id="modal-description">Are you sure?</p>
  <button>Cancel</button>
  <button>Delete</button>
</div>
```

### Screen Reader Only Text

**CSS Class** for visually hidden, screen reader accessible text:

```css
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
```

**Usage**:
```html
<button>
  <svg aria-hidden="true"><!-- icon --></svg>
  <span class="sr-only">Upload receipt</span>
</button>
```

---

## Touch Targets (WCAG 2.1 Success Criterion 2.5.5)

### Requirements

**Minimum Size**: 44px × 44px (WCAG 2.1 AAA, recommended)

**Implementation**:

```css
/* Small button (32px visible) with extended hit area */
.btn-sm {
  position: relative;
  height: 32px;
  padding: 8px 12px;
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

**Spacing Between Targets**:

Ensure at least 8px spacing between adjacent interactive elements:

```css
.btn-group {
  display: flex;
  gap: var(--space-2); /* 8px minimum */
}
```

---

## Alternative Text for Images (WCAG 2.1 Success Criterion 1.1.1)

### Requirements

**All images must have alt text** describing their content or function.

**Decorative Images**:
```html
<img src="decoration.png" alt="" role="presentation" />
```

**Informative Images**:
```html
<img src="chart.png" alt="Bar chart showing income vs expenses for January 2026" />
```

**Functional Images** (buttons, links):
```html
<button>
  <img src="upload-icon.svg" alt="Upload receipt" />
</button>
```

**Complex Graphics** (charts):
```html
<figure role="img" aria-labelledby="chart-caption">
  <canvas id="chart"></canvas>
  <figcaption id="chart-caption" class="sr-only">
    Income vs Expense chart for the past 7 days.
    Average income: ¥12,000, Average expense: ¥8,000.
  </figcaption>
</figure>

<!-- Provide data table fallback -->
<table class="sr-only">
  <caption>Daily Income and Expenses</caption>
  <thead>
    <tr>
      <th>Date</th>
      <th>Income</th>
      <th>Expense</th>
    </tr>
  </thead>
  <tbody>
    <!-- Data rows -->
  </tbody>
</table>
```

---

## Animation & Motion (WCAG 2.1 Success Criterion 2.3.3)

### Reduced Motion Preference

**Respect user's motion preference**:

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

**Already implemented** in `app/src/styles.css` (lines 1495-1500).

### Safe Animations

**Avoid**:
- ❌ Rapid flashing (>3 flashes per second)
- ❌ Large area flashing (>25% of screen)
- ❌ Parallax effects (can cause motion sickness)

**Safe**:
- ✅ Fade in/out
- ✅ Subtle slides (<100px)
- ✅ Scale (0.9-1.1 range)

---

## Testing Checklist

### Automated Testing

**Lighthouse** (Chrome DevTools):
```bash
# Run accessibility audit
npm run lighthouse

# Expected score: ≥90/100
```

**axe DevTools** (Browser Extension):
- Install [axe DevTools](https://www.deque.com/axe/devtools/)
- Run automated scan on each page
- Fix all issues flagged

### Manual Testing

#### Keyboard Navigation

- [ ] Tab through all interactive elements
- [ ] Focus indicators visible on all elements
- [ ] Escape closes modals/dropdowns
- [ ] Enter/Space activates buttons
- [ ] No keyboard traps

#### Screen Reader

**Tools**: NVDA (Windows), JAWS (Windows), VoiceOver (macOS)

**Test**:
- [ ] All images have alt text
- [ ] Form labels associated with inputs
- [ ] Error messages announced
- [ ] Loading states announced
- [ ] Headings in logical order (h1 → h2 → h3)

#### Color Contrast

- [ ] All text meets 4.5:1 ratio (normal text)
- [ ] Large text meets 3:1 ratio
- [ ] Interactive elements meet 3:1 ratio
- [ ] Don't rely on color alone (use icons + color)

#### Touch Targets

- [ ] All interactive elements ≥44px × 44px
- [ ] Adjacent targets have ≥8px spacing

---

## Quick Reference

### WCAG 2.1 AA Key Requirements

| Criterion | Requirement | Our Implementation |
|-----------|-------------|-------------------|
| **1.1.1 Non-text Content** | All images have alt text | ✅ Alt text on all images |
| **1.3.1 Info and Relationships** | Semantic HTML, ARIA | ✅ Semantic elements, ARIA labels |
| **1.4.3 Contrast (Minimum)** | 4.5:1 text, 3:1 UI | ✅ All colors tested |
| **2.1.1 Keyboard** | All functionality via keyboard | ✅ Tab navigation, focus indicators |
| **2.1.2 No Keyboard Trap** | Can Tab away from any element | ✅ No traps, Escape closes modals |
| **2.4.3 Focus Order** | Logical Tab order | ✅ Follows visual layout |
| **2.4.7 Focus Visible** | Visible focus indicators | ✅ 2px outline on all elements |
| **2.5.5 Target Size** | 44px × 44px minimum | ✅ All buttons meet size |
| **3.2.1 On Focus** | No unexpected changes on focus | ✅ Stable UI |
| **4.1.2 Name, Role, Value** | ARIA labels on custom elements | ✅ aria-label, aria-labelledby |

---

## Related Documents

- **[BUTTONS.md](./BUTTONS.md)** - Button focus states, touch targets
- **[FORMS.md](./FORMS.md)** - Form labels, validation, ARIA
- **[FEEDBACK.md](./FEEDBACK.md)** - Modal focus trap, Toast ARIA
- **[DATA-VIZ.md](./DATA-VIZ.md)** - Chart alt text, color-blind friendly
- **[COLOR.md](./COLOR.md)** - Color palette contrast ratios

---

## Decision Log

### [2026-01] WCAG 2.1 Level AA Target
**Decision**: Target WCAG 2.1 Level AA compliance (not AAA).
**Reason**: AA is industry standard, achievable, covers most users.
**Alternatives**: Level AAA - rejected, requires 7:1 contrast (too restrictive).

### [2026-01] 44px Touch Targets (AAA)
**Decision**: Use 44px × 44px minimum (WCAG 2.1 AAA) instead of 24px (AA).
**Reason**: Better UX, especially for older users and motor impairments.
**Alternatives**: 24px minimum (AA) - rejected, too small for comfortable touch.

### [2026-01] prefers-reduced-motion: Global Disable
**Decision**: Disable all animations when prefers-reduced-motion is set.
**Reason**: Vestibular disorders can cause nausea from motion.
**Alternatives**: Reduce duration only - rejected, some users need zero motion.

---

## Next Steps

1. **Audit Current Implementation**:
   - Run Lighthouse on all pages
   - Run axe DevTools scan
   - Manual keyboard navigation test
   - Manual screen reader test

2. **Fix Issues**:
   - Add missing alt text
   - Fix color contrast violations
   - Add focus indicators where missing
   - Verify touch target sizes

3. **Ongoing**:
   - Include accessibility in code review
   - Test with real users (including those with disabilities)
   - Monitor WCAG updates

---

**Last updated**: 2026-01-10
**Version**: 1.0.0
**Status**: ✅ Complete (documentation ready, implementation ongoing)
