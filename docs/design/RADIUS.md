# Border Radius System

> Comprehensive border radius guidelines for Yorutsuke v2 UI.
>
> **Source of Truth**: All border radius values must follow this specification.
> **Strategy**: 70% Material Design 3 + 30% Yorutsuke pragmatism

---

## Design Principles

1. **7-Level Scale**: From sharp (0) to full circle (9999px)
2. **Semantic Tokens**: Use named tokens instead of raw values
3. **Consistency**: Same radius for same component type
4. **Brand Identity**: 24px as Yorutsuke signature (vs M3's 28px)

---

## Border Radius Scale

Based on Material Design 3 with Yorutsuke adjustments.

| Token | Value | M3 | Usage |
|-------|-------|----|-------|
| `--radius-none` | 0 | ✅ | Reset, sharp corners |
| `--radius-xs` | 4px | ✅ | Tags, badges, small chips |
| `--radius-sm` | 6px | ⚠️ | (Legacy optional - see exceptions) |
| `--radius-md` | 8px | ✅ | Buttons, inputs, small cards |
| `--radius-lg` | 12px | ✅ | Cards, modals, containers |
| `--radius-xl` | 16px | ✅ | Large cards, hero sections |
| `--radius-2xl` | 24px | ⚠️ | Hero cards (Yorutsuke signature) |
| `--radius-full` | 9999px | ✅ | Pills, circular avatars |

**Total**: 8 levels (0, 4, 6, 8, 12, 16, 24, 9999)

### M3 Comparison

| Aspect | Material 3 | Yorutsuke | Adoption |
|--------|------------|-----------|----------|
| **Scale** | 0, 4, 8, 12, 16, 28, 1000 | 0, 4, 6, 8, 12, 16, 24, 9999 | ⚠️ 85% |
| **Base Grid** | 4px | 4px | ✅ 100% |
| **Circle** | 1000dp | 9999px | ✅ Practical |
| **Extra Large** | 28dp | 24px | ⚠️ Brand |

**Overall M3 Adoption**: 85%

**Yorutsuke Adjustments**:
- **6px optional**: Not in M3, but common in web design (for small badges/tags)
- **24px instead of 28px**: Yorutsuke brand signature, used for hero cards
- **9999px instead of 1000px**: Web standard for full circles

---

## CSS Tokens

Define these in your root CSS:

```css
:root {
  /* Border Radius Scale */
  --radius-none: 0;
  --radius-xs: 4px;
  --radius-sm: 6px;    /* Optional - use sparingly */
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
  --radius-2xl: 24px;  /* Yorutsuke signature */
  --radius-full: 9999px;
}
```

---

## Usage by Component

### Badges & Tags

```css
.badge {
  border-radius: var(--radius-xs);  /* 4px - tight, compact */
}

.tag {
  border-radius: var(--radius-sm);  /* 6px - softer than badge */
  /* OR */
  border-radius: var(--radius-md);  /* 8px - more rounded */
}
```

### Buttons

```css
.btn {
  border-radius: var(--radius-md);  /* 8px - standard button */
}

.btn--sm {
  border-radius: var(--radius-sm);  /* 6px - smaller buttons */
}

.btn--pill {
  border-radius: var(--radius-full);  /* 9999px - pill shape */
}
```

### Inputs & Forms

```css
.input {
  border-radius: var(--radius-md);  /* 8px - standard input */
}

.select {
  border-radius: var(--radius-md);  /* 8px - dropdown */
}

.checkbox {
  border-radius: var(--radius-xs);  /* 4px - subtle roundness */
}
```

### Cards

```css
.card {
  border-radius: var(--radius-xl);  /* 16px - standard card */
}

.card--lg {
  border-radius: var(--radius-2xl);  /* 24px - hero card (Yorutsuke) */
}

.card--sm {
  border-radius: var(--radius-lg);  /* 12px - small card */
}
```

### Modals & Dialogs

```css
.modal {
  border-radius: var(--radius-lg);  /* 12px - dialog */
}

.modal--large {
  border-radius: var(--radius-xl);  /* 16px - large dialog */
}
```

### Avatars & Circular Elements

```css
.avatar {
  border-radius: var(--radius-full);  /* 9999px - circle */
}

.progress-circle {
  border-radius: 50%;  /* True circle (for aspect-ratio 1:1) */
}
```

---

## Usage by Context

| Context | Token | Value | Example |
|---------|-------|-------|---------|
| **Sharp** | `--radius-none` | 0 | Reset, rectangular images |
| **Subtle** | `--radius-xs` | 4px | Tags, badges, status indicators |
| **Soft** | `--radius-sm` | 6px | Small buttons, chips (optional) |
| **Standard** | `--radius-md` | 8px | Buttons, inputs, small cards |
| **Comfortable** | `--radius-lg` | 12px | Cards, modals, containers |
| **Spacious** | `--radius-xl` | 16px | Large cards, hero sections |
| **Hero** | `--radius-2xl` | 24px | Hero cards (brand signature) |
| **Circular** | `--radius-full` | 9999px | Pills, avatars, circular buttons |

---

## Current Usage Audit

Based on code analysis (87 CSS files):

| Value | Occurrences | Compliant | Action |
|-------|-------------|-----------|--------|
| **0** | 2 | ✅ Yes | Keep (--radius-none) |
| **2px** | 2 | ❌ No | **Migrate to 4px** |
| **4px** | 10 | ✅ Yes | Keep (--radius-xs) |
| **6px** | 0 | ⚠️ Optional | Keep as --radius-sm (optional) |
| **8px** | 34 | ✅ Yes | Keep (--radius-md) ← Most used |
| **10px** | 6 | ❌ No | **Migrate to 12px** |
| **12px** | 18 | ✅ Yes | Keep (--radius-lg) ← 2nd most |
| **16px** | 6 | ✅ Yes | Keep (--radius-xl) |
| **20px** | 1 | ❌ No | **Migrate to 24px** |
| **24px** | 2 | ✅ Yes | Keep (--radius-2xl) ← Yorutsuke |
| **28px** | 1 | ❌ No | **Migrate to 24px** |
| **50%** | 5 | ✅ Yes | Keep (true circle) |
| **9999px** | 1 | ✅ Yes | Keep (--radius-full) |

**Compliance Rate**: 83% (10 violations across 4 values)

---

## Exception: 6px Border Radius

### Status: **Optional (Not Enforced)**

**Rationale**:
- Not part of M3 standard
- Common in web design for small elements
- Visual balance for badges/tags (between 4px and 8px)
- `--radius-sm` defined but not mandatory

**Rule**:
- ✅ Allowed if needed for specific visual requirements
- ⚠️ Prefer 4px or 8px when possible
- 📝 Document when used

**Alternative**:
- Small badges: Use `--radius-xs` (4px) for tighter look
- Small buttons: Use `--radius-md` (8px) for standard look

---

## Violations & Migration

### 2px → 4px (2 occurrences)

**Action**: Migrate immediately (low risk)

```diff
- border-radius: 2px;
+ border-radius: var(--radius-xs);  /* 4px */
```

**Impact**: Minimal (+2px = 100% increase, but absolute change is tiny)

### 10px → 12px (6 occurrences)

**Action**: Migrate immediately (low risk)

```diff
- border-radius: 10px;
+ border-radius: var(--radius-lg);  /* 12px */
```

**Impact**: Small (+2px = 20% increase)

### 20px → 24px (1 occurrence)

**Action**: Migrate immediately (low risk)

```diff
- border-radius: 20px;
+ border-radius: var(--radius-2xl);  /* 24px */
```

**Impact**: Small (+4px = 20% increase)

### 28px → 24px (1 occurrence)

**Action**: Migrate immediately (low risk, alignment with Yorutsuke brand)

```diff
- border-radius: 28px;
+ border-radius: var(--radius-2xl);  /* 24px */
```

**Impact**: Small (-4px = 14% decrease)

---

## Special Cases

### 50% vs 9999px

**Use 50% when**:
- Element has equal width and height (aspect-ratio: 1/1)
- True geometric circle needed
- Example: `.avatar { aspect-ratio: 1; border-radius: 50%; }`

**Use 9999px when**:
- Element has different width/height (pill shape)
- Maximum roundness without geometric constraint
- Example: `.btn--pill { border-radius: var(--radius-full); }`

### Asymmetric Radius

Sometimes only certain corners need rounding:

```css
/* Top corners only (for stacked cards) */
.card--stacked-top {
  border-radius: var(--radius-xl) var(--radius-xl) 0 0;
}

/* Bottom corners only */
.card--stacked-bottom {
  border-radius: 0 0 var(--radius-xl) var(--radius-xl);
}
```

---

## Anti-Patterns

### ❌ DON'T

```css
/* Magic numbers */
border-radius: 7px;
border-radius: 15px;
border-radius: 22px;

/* Raw values */
border-radius: 24px;
border-radius: 12px;

/* Inconsistent within same component type */
.card-a { border-radius: 16px; }
.card-b { border-radius: 20px; }  /* Should be same */
```

### ✅ DO

```css
/* Use tokens */
border-radius: var(--radius-2xl);
border-radius: var(--radius-lg);

/* Consistent within component type */
.card { border-radius: var(--radius-xl); }
.card--hero { border-radius: var(--radius-2xl); }
```

---

## Implementation Checklist

### Phase 1: Documentation ✅
- [x] Define radius scale (8 levels)
- [x] Create CSS tokens
- [x] Document usage patterns
- [x] Audit current code
- [x] Define migration path

### Phase 2: CSS Tokens (Next)
- [ ] Add tokens to `app/src/styles.css`
- [ ] Add tokens to `app/src/index.css` (if needed)

### Phase 3: Migration (Optional)
- [ ] Migrate 2px → 4px (2 occurrences)
- [ ] Migrate 10px → 12px (6 occurrences)
- [ ] Migrate 20px → 24px (1 occurrence)
- [ ] Migrate 28px → 24px (1 occurrence)
- [ ] Update new code to use tokens

### Phase 4: Enforcement (Future)
- [ ] Add stylelint rule for border-radius
- [ ] Add pre-commit check
- [ ] Update component templates

---

## Quick Reference

| Need | Use |
|------|-----|
| Badge | `--radius-xs` (4px) |
| Tag | `--radius-sm` (6px) or `--radius-md` (8px) |
| Button | `--radius-md` (8px) |
| Input | `--radius-md` (8px) |
| Small Card | `--radius-lg` (12px) |
| Standard Card | `--radius-xl` (16px) |
| Hero Card | `--radius-2xl` (24px) ← Yorutsuke |
| Pill | `--radius-full` (9999px) |
| Circle | `50%` |

---

## Related Documentation

- `SPACING.md` - Spacing system (9 levels)
- `COLOR.md` - Color system (25 colors)
- `TYPOGRAPHY.md` - Typography scale
- `SHADOWS.md` - Shadow and elevation system (#123)
- Material Design 3 Shape: https://m3.material.io/styles/shape

---

*Version: 1.0*
*Last updated: 2026-01-10*
*Author: Design System Working Group*
*Issue: #122*
