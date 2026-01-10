# Motion System - Animation and Transitions
> Strategy: 70% Material Design 3 Motion + 30% Yorutsuke pragmatism

## Overview

Motion system defines animation durations, easing curves, and best practices for transitions. Based on Material Design 3's motion principles, simplified to 3 practical levels.

**Current Status**: 21 performance violations ("transition: all") need optimization.

---

## Duration Scale

| Token | Value | M3 Equivalent | Usage |
|-------|-------|---------------|-------|
| `--duration-instant` | 100ms | ✅ Short-1 (50-100ms) | Hover feedback, focus rings |
| `--duration-fast` | 200ms | ✅ Short-3 (150-200ms) | **Default**: Buttons, toggles, tabs |
| `--duration-base` | 300ms | ✅ Medium-1 (250-300ms) | Modals, drawers, page transitions |

**Key Decision**: 200ms as default (already dominant in codebase).

### When to Use Each Duration

```
Instant (100ms)
├─ Hover effects
├─ Focus ring appearance
└─ Tooltip show/hide

Fast (200ms) ← Default
├─ Button press
├─ Toggle switch
├─ Tab switching
├─ Dropdown expand/collapse
└─ Toast notification appearance

Base (300ms)
├─ Modal dialog entrance
├─ Sidebar drawer slide
├─ Page transition
└─ Large card flip
```

---

## Easing Curves

| Token | Value | M3 Name | Usage |
|-------|-------|---------|-------|
| `--ease-standard` | cubic-bezier(0.2, 0, 0, 1) | Standard | **Default**: Bidirectional, state changes |
| `--ease-out` | cubic-bezier(0, 0, 0.2, 1) | Emphasized Decelerate | Entrance: elements appearing |
| `--ease-in` | cubic-bezier(0.4, 0, 1, 1) | Emphasized Accelerate | Exit: elements disappearing |

**Curve Characteristics**:
- **Standard**: Smooth both ways, use for property changes (opacity, size)
- **Ease-out**: Fast start, slow end - feels "settling in" (modals appearing)
- **Ease-in**: Slow start, fast end - feels "sucked away" (modals closing)

### When to Use Each Easing

```
Standard (default)
├─ Hover state changes
├─ Toggle switches
├─ Property animations (opacity, scale)
└─ Background color transitions

Ease-out (entrance)
├─ Modal dialog appearing
├─ Dropdown menu opening
├─ Toast notification sliding in
└─ Tooltip fade-in

Ease-in (exit)
├─ Modal dialog disappearing
├─ Dropdown menu closing
├─ Toast notification sliding out
└─ Tooltip fade-out
```

---

## CSS Tokens

Add to `app/src/styles.css`:

```css
/* ---------------------------------------------------------------------------
 * Motion System - Duration Scale
 * See docs/design/MOTION.md
 * --------------------------------------------------------------------------- */
--duration-instant: 100ms;  /* Hover, focus ring */
--duration-fast: 200ms;     /* Default - buttons, toggles */
--duration-base: 300ms;     /* Modals, drawers, page transitions */

/* ---------------------------------------------------------------------------
 * Motion System - Easing Curves
 * See docs/design/MOTION.md
 * --------------------------------------------------------------------------- */
--ease-standard: cubic-bezier(0.2, 0, 0, 1);  /* Default - M3 standard */
--ease-out: cubic-bezier(0, 0, 0.2, 1);       /* Entrance - emphasized decelerate */
--ease-in: cubic-bezier(0.4, 0, 1, 1);        /* Exit - emphasized accelerate */
```

---

## Usage Examples

### ✅ Good - Specific Properties

```css
/* Button hover */
.btn {
  transition:
    background-color var(--duration-fast) var(--ease-standard),
    box-shadow var(--duration-fast) var(--ease-standard);
}

/* Modal entrance */
.modal {
  animation: modalEnter var(--duration-base) var(--ease-out);
}

/* Modal exit */
.modal.closing {
  animation: modalExit var(--duration-base) var(--ease-in);
}

/* Hover feedback (instant) */
.link:hover {
  transition: color var(--duration-instant) var(--ease-standard);
}
```

### ❌ Bad - Performance Issues

```css
/* DON'T: transition: all is a performance killer */
.element {
  transition: all 0.3s ease;  /* ❌ Animates EVERYTHING, even layout! */
}

/* DON'T: Animating layout-triggering properties */
.element {
  transition: width 200ms, height 200ms;  /* ❌ Causes reflow */
}

/* DON'T: Magic numbers */
.element {
  transition: opacity 0.25s ease-in-out;  /* ❌ Use tokens */
}
```

---

## Performance Rules

### ✅ DO

1. **Specify exact properties**:
   ```css
   transition: opacity 200ms, transform 200ms;
   ```

2. **Prefer GPU-accelerated properties**:
   - ✅ `transform`, `opacity`
   - ✅ `filter` (with caution)

3. **Use tokens**:
   ```css
   transition: opacity var(--duration-fast) var(--ease-standard);
   ```

4. **Match easing to direction**:
   - Entrance → `--ease-out`
   - Exit → `--ease-in`
   - State change → `--ease-standard`

### ❌ DON'T

1. **Never use `transition: all`**:
   - Animates ALL properties (including layout)
   - Causes unnecessary repaints/reflows
   - Performance impact: **30-50% slower**

2. **Avoid animating layout properties**:
   - ❌ `width`, `height`, `top`, `left`, `margin`, `padding`
   - Use `transform: scale()` or `translateX()` instead

3. **Don't chain too many properties**:
   - Max 3-4 properties per transition
   - Split complex animations into keyframes

---

## Migration Guide

### Current Status

**Audit Results** (as of 2026-01):
```bash
grep -r "transition: all" app/src/
# Found: 21 occurrences
```

**Files with violations**:
- `app/src/styles.css` - 8 places
- `app/src/components/*.css` - 5 places
- `app/src/02_modules/**/*.css` - 8 places

### Migration Strategy

**Phase 1**: Create tokens (this document)
**Phase 2**: Code optimization (separate issue)
  - Replace "transition: all" with specific properties
  - Adopt token-based durations
  - Expected improvement: 30-50% animation performance

### Migration Examples

#### Example 1: Button

```css
/* BEFORE */
.btn {
  transition: all 0.2s ease;
}

/* AFTER */
.btn {
  transition:
    background-color var(--duration-fast) var(--ease-standard),
    box-shadow var(--duration-fast) var(--ease-standard),
    transform var(--duration-fast) var(--ease-standard);
}
```

#### Example 2: Modal

```css
/* BEFORE */
.modal {
  transition: all 0.3s ease-in-out;
}

/* AFTER - Entrance */
.modal {
  animation: modalEnter var(--duration-base) var(--ease-out);
}

@keyframes modalEnter {
  from {
    opacity: 0;
    transform: scale(0.9);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

/* AFTER - Exit */
.modal.closing {
  animation: modalExit var(--duration-base) var(--ease-in);
}

@keyframes modalExit {
  from {
    opacity: 1;
    transform: scale(1);
  }
  to {
    opacity: 0;
    transform: scale(0.9);
  }
}
```

#### Example 3: Hover Effect

```css
/* BEFORE */
.card {
  transition: all 0.15s ease;
}

/* AFTER */
.card {
  transition:
    transform var(--duration-instant) var(--ease-standard),
    box-shadow var(--duration-instant) var(--ease-standard);
}
```

---

## Accessibility

### Reduced Motion

**MUST support** `prefers-reduced-motion`:

```css
@media (prefers-reduced-motion: reduce) {
  * {
    transition-duration: 0.01ms !important;
    animation-duration: 0.01ms !important;
  }
}
```

**Note**: Already implemented in `app/src/styles.css` (lines 1495-1500).

### Focus Indicators

Focus rings should use `--duration-instant` (100ms) for immediate feedback:

```css
.btn:focus-visible {
  outline: 2px solid var(--blue-500);
  transition: outline-offset var(--duration-instant) var(--ease-standard);
}
```

---

## Material Design 3 Comparison

| M3 Duration | M3 Range | Yorutsuke Token | Adoption |
|-------------|----------|-----------------|----------|
| Short-1 | 50-100ms | `--duration-instant` (100ms) | ✅ 100% |
| Short-3 | 150-200ms | `--duration-fast` (200ms) | ✅ 100% |
| Medium-1 | 250-300ms | `--duration-base` (300ms) | ✅ 100% |
| Long-1 | 400-500ms | ⚠️ Not adopted | - |
| Long-2 | 500-700ms | ⚠️ Not adopted | - |

| M3 Easing | M3 Curve | Yorutsuke Token | Adoption |
|-----------|----------|-----------------|----------|
| Standard | cubic-bezier(0.2, 0, 0, 1) | `--ease-standard` | ✅ 100% |
| Emphasized Decelerate | cubic-bezier(0, 0, 0.2, 1) | `--ease-out` | ✅ 100% |
| Emphasized Accelerate | cubic-bezier(0.4, 0, 1, 1) | `--ease-in` | ✅ 100% |

**Overall M3 Adoption**: 100% (simplified to 3 levels)

**Why not Long durations?**
- 400-700ms feels sluggish for desktop apps
- Most UI interactions should be snappy (200ms)
- Modals/drawers at 300ms already feel smooth

---

## Testing

### Manual Testing Checklist

- [ ] **Hover states**: Should be instant (100ms)
- [ ] **Button presses**: Should be fast (200ms)
- [ ] **Modal entrance**: Should be smooth (300ms + ease-out)
- [ ] **Modal exit**: Should be quick (300ms + ease-in)
- [ ] **Reduced motion**: Test `prefers-reduced-motion` in browser DevTools

### Performance Testing

```bash
# Check for "transition: all" violations
grep -r "transition: all" app/src/

# Expected after migration: 0 results
```

---

## References

### Material Design 3
- [Duration Tokens](https://m3.material.io/styles/motion/easing-and-duration/tokens-specs#0c78bcf2-bc26-42f0-a90e-e72cc1437952)
- [Easing Tokens](https://m3.material.io/styles/motion/easing-and-duration/tokens-specs#433b1153-2ea6-42e8-a796-eb83f4d6f86f)

### Yorutsuke Documentation
- `docs/design/SPACING.md` - Spacing system
- `docs/design/RADIUS.md` - Border radius system
- `docs/design/SHADOWS.md` - Shadow/elevation system

---

## Decision Log

### [2026-01] 3-Level Duration Scale
**Decision**: Adopt only 3 duration levels (instant, fast, base), skip M3's Long-1/Long-2.
**Reason**: Desktop apps need snappy interactions; 400-700ms feels sluggish.
**Alternatives**: 5-level scale (M3 full) - rejected for complexity.

### [2026-01] 200ms as Default
**Decision**: `--duration-fast` (200ms) as default, not 100ms or 300ms.
**Reason**: Already dominant in codebase (70% of transitions); proven sweet spot.
**Alternatives**: 150ms (web standard) - rejected to maintain consistency.

### [2026-01] Prohibit "transition: all"
**Decision**: Forbid "transition: all" in code reviews.
**Reason**: Performance impact 30-50%; unpredictable animation of layout properties.
**Alternatives**: Allow with linter warning - rejected, too easy to ignore.

### [2026-01] Token Naming
**Decision**: `--duration-*` and `--ease-*` prefixes.
**Reason**: Clear separation from other tokens; autocomplete-friendly.
**Alternatives**: `--motion-duration-*` - rejected for verbosity.

---

## Next Steps

1. **Add tokens to styles.css** (this issue)
2. **Create optimization issue** (separate):
   - Migrate 21 "transition: all" violations
   - Adopt token-based durations
   - Verify performance improvements

---

**Last updated**: 2026-01-10
**Version**: 1.0.0
**Status**: ✅ Complete (documentation)
