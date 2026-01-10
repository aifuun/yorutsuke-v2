# Spacing System

> Comprehensive spacing guidelines for Yorutsuke v2 UI.
>
> **Source of Truth**: All spacing must follow this specification.
> **Strategy**: 70% Material Design 3 + 30% Yorutsuke pragmatism

---

## Design Principles

1. **4px Base Grid**: All spacing values are multiples of 4px
2. **Semantic Tokens**: Use named tokens instead of raw values
3. **Consistency**: Same spacing for same purpose across the app
4. **Exceptions Documented**: 6px allowed for legacy compatibility (see below)

---

## Spacing Scale (4px Base Grid)

Based on Material Design 3 with Yorutsuke adjustments.

| Token | Value | Multiplier | M3 | Usage |
|-------|-------|------------|----|----|
| `--space-0` | 0px | 0 | ✅ | Reset, no spacing |
| `--space-1` | 4px | 1 | ✅ | Icon gap, tight spacing |
| `--space-2` | 8px | 2 | ✅ | Button padding (vertical), small gaps |
| `--space-3` | 12px | 3 | ✅ | Input padding, card padding (small) |
| `--space-4` | 16px | 4 | ✅ | Standard gap, section spacing |
| `--space-6` | 24px | 6 | ✅ | Card padding (medium), large gaps |
| `--space-8` | 32px | 8 | ✅ | Section spacing, layout gaps |
| `--space-10` | 40px | 10 | ✅ | Page padding, hero spacing |
| `--space-12` | 48px | 12 | ✅ | Large section gaps, page margins |

**Total**: 9 levels (0, 4, 8, 12, 16, 24, 32, 40, 48)

---

## CSS Tokens

Define these in your root CSS:

```css
:root {
  /* Spacing Scale - 4px base grid */
  --space-0: 0;
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;
  --space-12: 48px;
}
```

---

## Usage by Component

### Buttons

```css
.button {
  padding: var(--space-2) var(--space-4);  /* 8px 16px */
}

.button.sm {
  padding: var(--space-2) var(--space-3);  /* 8px 12px */
}

.button.lg {
  padding: var(--space-3) var(--space-6);  /* 12px 24px */
}
```

### Cards

```css
.card {
  padding: var(--space-6);          /* 24px */
  gap: var(--space-4);               /* 16px between elements */
  margin-bottom: var(--space-6);     /* 24px */
}

.card--hero {
  padding: var(--space-10);          /* 40px */
}
```

### Forms

```css
.input {
  padding: var(--space-3);           /* 12px */
  margin-bottom: var(--space-4);     /* 16px */
}

.form-label {
  margin-bottom: var(--space-2);     /* 8px */
}
```

### Layout

```css
.page {
  padding: var(--space-10);          /* 40px */
}

.section {
  margin-bottom: var(--space-8);     /* 32px */
}

.grid {
  gap: var(--space-4);               /* 16px */
}
```

### Lists

```css
.list {
  gap: var(--space-3);               /* 12px */
}

.list-item {
  padding: var(--space-3);           /* 12px */
}
```

---

## Usage by Context

| Context | Token | Value | Example |
|---------|-------|-------|---------|
| **Micro** | `--space-1` | 4px | Icon-text gap, badge padding |
| **Tight** | `--space-2` | 8px | Button padding (vertical), small gaps |
| **Base** | `--space-3` | 12px | Input padding, list items |
| **Standard** | `--space-4` | 16px | Card gaps, section spacing |
| **Medium** | `--space-6` | 24px | Card padding, large elements |
| **Large** | `--space-8` | 32px | Section gaps, layout spacing |
| **XL** | `--space-10` | 40px | Page padding, hero elements |
| **XXL** | `--space-12` | 48px | Large page sections |

---

## Current Usage Audit

Based on code analysis (4928 lines of CSS):

| Value | Occurrences | Compliant | Action |
|-------|-------------|-----------|--------|
| **0** | 29 | ✅ Yes | Keep |
| **4px** | 10 | ✅ Yes | Keep (--space-1) |
| **6px** | 4 | ⚠️ No | **Exception** (see below) |
| **8px** | 19 | ✅ Yes | Keep (--space-2) |
| **12px** | 27 | ✅ Yes | Keep (--space-3) ← Most used |
| **16px** | 24 | ✅ Yes | Keep (--space-4) ← 2nd most |
| **20px** | 2 | ❌ No | **Migrate to 24px** |
| **24px** | 20 | ✅ Yes | Keep (--space-6) ← 3rd most |
| **32px** | 5 | ✅ Yes | Keep (--space-8) |
| **40px** | 7 | ✅ Yes | Keep (--space-10) |
| **48px** | 0 | ✅ Yes | Add (--space-12) |

**Compliance Rate**: 95% (only 6px and 20px violations)

---

## Exception: 6px Spacing

### Status: **Allowed (Legacy)**

**Rationale**:
- Used 4 times in codebase (small usage)
- Not used in new code (Dashboard Phase 1)
- Visual balance for small elements
- Cost of migration > benefit

**Rule**:
- ✅ Allowed in existing code
- ❌ Avoid in new code (use 4px or 8px instead)
- 📝 Document when used

**Migration Path** (Optional):
- If touch target: 6px → 8px (better for accessibility)
- If visual only: Keep 6px (mark as legacy)

---

## Violations & Migration

### 20px → 24px (2 occurrences)

**Action**: Migrate immediately (low risk)

```diff
- padding: 20px 24px;
+ padding: var(--space-6) var(--space-6);  /* 24px 24px */

- margin: 0 0 20px 0;
+ margin: 0 0 var(--space-6) 0;  /* 0 0 24px 0 */
```

**Impact**: Minimal visual change (+4px = 20% increase)

---

## Units: px vs rem

### Current State
Mixed usage:
- `px`: 80% of spacing
- `rem`: 20% of spacing (0.5rem=8px, 0.75rem=12px, 1rem=16px)

### Strategy

**Use px for spacing** (recommended):
```css
✅ gap: var(--space-4);        /* 16px - clear */
✅ padding: var(--space-3);    /* 12px - clear */
```

**Use rem only for responsive typography**:
```css
✅ font-size: 1rem;             /* 16px base, scales with user preference */
⚠️ padding: 1rem;               /* Avoid - spacing shouldn't scale with font */
```

**Rationale**:
1. **Spacing is absolute** - Should not scale with user font size
2. **px is clearer** - Direct mapping to design specs
3. **rem for type** - Respects user preferences for text size

### Migration Guide

```diff
- gap: 0.5rem;
+ gap: var(--space-2);   /* 8px */

- padding: 0.75rem;
+ padding: var(--space-3);   /* 12px */

- margin: 1rem;
+ margin: var(--space-4);   /* 16px */

- padding: 2rem;
+ padding: var(--space-8);   /* 32px */
```

**Estimated**: ~30 occurrences to migrate

---

## M3 Comparison

| Aspect | Material 3 | Yorutsuke | Adoption |
|--------|------------|-----------|----------|
| **Base Grid** | 4dp | 4px | ✅ 100% |
| **Scale** | 0-64 (11 levels) | 0-48 (9 levels) | ⚠️ 85% |
| **Token System** | Yes | Yes | ✅ 100% |
| **Exceptions** | None | 6px allowed | ⚠️ Pragmatic |

**Overall M3 Adoption**: 85%

**Yorutsuke Adjustments**:
- Shorter scale (48px max vs 64px) - Desktop app doesn't need very large spacing
- 6px exception - Legacy compatibility
- px over rem - Clearer for spacing

---

## Anti-Patterns

### ❌ DON'T

```css
/* Magic numbers */
padding: 13px;
gap: 18px;
margin: 22px;

/* Raw values */
padding: 24px;
gap: 16px;

/* rem for spacing */
padding: 1.5rem;
gap: 0.875rem;
```

### ✅ DO

```css
/* Use tokens */
padding: var(--space-6);
gap: var(--space-4);
margin: var(--space-3);

/* Combine tokens */
padding: var(--space-2) var(--space-4);  /* 8px 16px */

/* Zero is OK without token */
margin: 0;
```

---

## Implementation Checklist

### Phase 1: Documentation ✅
- [x] Define spacing scale
- [x] Create CSS tokens
- [x] Document usage patterns
- [x] Audit current code
- [x] Define migration path

### Phase 2: CSS Tokens ✅
- [x] Add tokens to `app/src/styles.css`

### Phase 3: Migration ✅
- [x] Migrate 20px → 24px (2 occurrences)
- [x] Migrate rem → px tokens (8 occurrences)
- [x] Update new code to use tokens

### Phase 4: Enforcement ✅
- [x] Add stylelint rule for spacing (disallow rem/em in padding/margin/gap)
- [x] Add npm script: `npm run lint:css`
- [ ] Add pre-commit check (optional)
- [ ] Update component templates (optional)

---

## Quick Reference

| Need | Use |
|------|-----|
| Tiny gap | `--space-1` (4px) |
| Small gap | `--space-2` (8px) |
| Medium gap | `--space-3` or `--space-4` (12px or 16px) |
| Large gap | `--space-6` (24px) |
| Section spacing | `--space-8` (32px) |
| Page padding | `--space-10` (40px) |
| Hero spacing | `--space-12` (48px) |

---

## Related Documentation

- `COLOR.md` - Color system (25 colors)
- `TYPOGRAPHY.md` - Typography scale
- `RADIUS.md` - Border radius system (#122)
- Material Design 3 Spacing: https://m3.material.io/foundations/layout/applying-layout/spacing

---

*Version: 1.0*
*Last updated: 2026-01-10*
*Author: Design System Working Group*
*Issue: #121*
