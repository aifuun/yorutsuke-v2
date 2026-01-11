# Design System Integration Guide

**Complete workflow for developing with the Design System in Claude**

---

## 1. Starting a New Feature

### Step 1: Understand Your Task
```bash
# Read the issue plan
ls .claude/plans/active/#XXX-*

# Example: Starting #114 Dashboard Today's Summary
Issue: #114 Dashboard Today's Summary (T1, 4h)
```

### Step 2: Read Design Specifications (10 min)
```bash
# Read the view specification
cat docs/design/01-dashboard.md

# Note key sections:
# - Component layout
# - Color usage
# - Typography styles
# - Responsive breakpoints
# - Accessibility requirements
```

### Step 3: Identify Component Types
Look at your view spec and identify which components you need:
- **Buttons?** → Read `docs/design/BUTTONS.md`
- **Stats cards?** → Check `STATES.md` + `COLOR.md`
- **Typography?** → Read `docs/design/TYPOGRAPHY.md`
- **Forms?** → Read `docs/design/FORMS.md`
- **Special components?** → Check specific design doc

### Step 4: Create a Design Checklist
Use `.prot/checklists/design-compliance.md` as your guide. For each component, note:
```
Component: StatCard (showing today's totals)
Colors: --bg-card, --text-default, --color-success
Spacing: --space-4 padding, --space-2 gap
Typography: --text-sm title, --text-lg amount
States: Default (normal), Loading (skeleton), Error (warning)
Accessibility: aria-label for amounts, contrast 4.5:1
```

---

## 2. During Implementation

### Workflow A: Simple Component (Button, Icon)

**Example: Create a "Confirm Transaction" button**

```bash
# Step 1: Read spec
cat docs/design/BUTTONS.md | grep -A 20 "Primary Button"

# Step 2: Note requirements from spec
# - Height: 40px
# - Padding: 12px 16px (= --space-3 --space-4)
# - Background: --color-primary
# - Text: --text-sm, font-weight 600
# - Focus: outline 2px --color-primary
# - States: hover, focus, disabled

# Step 3: Create component
cat > app/src/components/Button/ConfirmButton.tsx << 'EOF'
import './ConfirmButton.css';

interface ConfirmButtonProps {
  onClick: () => void;
  disabled?: boolean;
  label?: string;
}

export function ConfirmButton({
  onClick,
  disabled,
  label = 'Confirm',
}: ConfirmButtonProps) {
  return (
    <button
      className="btn btn-primary"
      onClick={onClick}
      disabled={disabled}
      aria-label={`${label} transaction`}
    >
      ✓ {label}
    </button>
  );
}
EOF

# Step 4: Create CSS (copy structure from BUTTONS.md spec)
cat > app/src/components/Button/ConfirmButton.css << 'EOF'
.btn {
  height: 40px;
  padding: var(--space-3) var(--space-4);
  background: transparent;
  border: none;
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  font-weight: 600;
  cursor: pointer;
  transition: background-color var(--duration-fast) var(--ease-out);
}

.btn-primary {
  background: var(--color-primary);
  color: var(--text-inverse);
}

.btn-primary:hover:not(:disabled) {
  background: var(--color-primary-dark);
}

.btn-primary:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

@media (prefers-reduced-motion: reduce) {
  .btn {
    transition: none;
  }
}
EOF

# Step 5: Export from index
echo "export { ConfirmButton } from './Button/ConfirmButton';" >> app/src/components/index.ts

# Step 6: Test visual match with BUTTONS.md spec
# - Open app, compare button appearance
# - Check hover, focus, disabled states
# - Test keyboard navigation (Tab, Enter, Space)
```

### Workflow B: Complex Component (Card, List)

**Example: Create a StatCard showing today's net profit**

```bash
# Step 1: Understand the design
cat docs/design/01-dashboard.md | grep -A 30 "StatCard"
cat docs/design/COLOR.md       # Note semantic colors
cat docs/design/TYPOGRAPHY.md  # Note text scales
cat docs/design/SPACING.md     # Note padding/margin

# Step 2: Plan structure from spec
# StatCard layout:
# ┌─────────────────────────┐
# │ Title (--text-sm)       │  ← spacing: --space-4 padding
# │ Amount (--text-lg bold) │  ← gap: --space-2 between elements
# │ Change (--text-xs muted)│  ← color: semantic tokens
# └─────────────────────────┘

# Step 3: Create component with full spec compliance
cat > app/src/components/Dashboard/StatCard.tsx << 'EOF'
import './StatCard.css';

interface StatCardProps {
  title: string;
  amount: number;
  change?: number;
  type: 'income' | 'expense' | 'net';
}

export function StatCard({ title, amount, change, type }: StatCardProps) {
  const formatCurrency = (val: number) => `¥${val.toLocaleString('ja-JP')}`;

  return (
    <div className={`stat-card stat-card--${type}`}>
      <h3 className="stat-card__title">{title}</h3>
      <div className="stat-card__amount">{formatCurrency(amount)}</div>
      {change !== undefined && (
        <div className="stat-card__change">
          {change > 0 ? '+' : ''}{change.toFixed(1)}%
        </div>
      )}
    </div>
  );
}
EOF

# Step 4: Create CSS with EXACT spec compliance
cat > app/src/components/Dashboard/StatCard.css << 'EOF'
.stat-card {
  padding: var(--space-4);
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-1);
}

.stat-card__title {
  font-size: var(--text-sm);
  color: var(--text-muted);
  margin: 0 0 var(--space-2) 0;
  font-weight: 500;
}

.stat-card__amount {
  font-size: var(--text-lg);
  font-weight: 700;
  color: var(--text-default);
  margin-bottom: var(--space-2);
  line-height: 1.5;
}

.stat-card__change {
  font-size: var(--text-xs);
  color: var(--text-muted);
}

/* Type variants - use semantic colors from COLOR.md */
.stat-card--income .stat-card__amount {
  color: var(--color-success);
}

.stat-card--expense .stat-card__amount {
  color: var(--color-error);
}

.stat-card--net .stat-card__amount {
  color: var(--color-primary);
}

/* Responsive */
@media (max-width: 767px) {
  .stat-card {
    padding: var(--space-3);
  }
}

/* Accessibility: Reduced motion */
@media (prefers-reduced-motion: reduce) {
  .stat-card {
    /* No animations in this component, but include for future-proofing */
  }
}
EOF

# Step 5: Verify and test
# ✓ All spacing uses --space-X
# ✓ All colors use semantic tokens
# ✓ Typography matches spec
# ✓ Responsive on mobile
# ✓ Accessibility complete
```

---

## 3. Token Reference During Coding

### Quick Lookup Commands

```bash
# Find color tokens
grep "^--color" app/src/styles.css
# Output:
# --color-primary: #3b82f6;
# --color-success: #10b981;
# --color-error: #ef4444;

# Find spacing tokens
grep "^--space" app/src/styles.css
# Output:
# --space-1: 4px;
# --space-2: 8px;
# --space-3: 12px;

# Find text scale
grep "^--text" app/src/styles.css | head -10

# Check if component already exists
grep -r "StatCard" app/src/components/

# Verify token usage in CSS files
grep -h "transition\|background\|color\|padding\|margin" app/src/components/*/\*.css | grep -v "^--" | sort | uniq -c
```

### Common Token Patterns

```css
/* Colors: Always semantic */
color: var(--text-default);           /* Primary text */
color: var(--text-muted);             /* Secondary text */
background: var(--bg-default);        /* Light background */
background: var(--bg-card);           /* Card background */
background: var(--color-primary);     /* Brand color (interactive) */
border-color: var(--border);          /* Subtle borders */

/* Spacing: Always --space-X (4px base unit) */
padding: var(--space-3);              /* 12px - default padding */
padding: var(--space-4);              /* 16px - card padding */
margin: var(--space-2);               /* 8px - small gap */
gap: var(--space-3);                  /* 12px - flex gap */

/* Typography: Always var(--text-*) */
font-size: var(--text-sm);            /* 14px */
font-size: var(--text-md);            /* 16px */
font-size: var(--text-lg);            /* 18px */

/* Animations: Always tokens */
transition: background-color var(--duration-fast) var(--ease-out);
animation: fadeIn var(--duration-base) var(--ease-out);
```

---

## 4. Accessibility Checklist During Coding

### For Each Component

```typescript
// ✅ Form input - always include label
<label htmlFor="amount">Amount</label>
<input
  id="amount"
  type="number"
  aria-label="Transaction amount"
  aria-describedby="amount-hint"
/>

// ✅ Button with icon - include aria-label
<button aria-label="Delete transaction">🗑️</button>

// ✅ Modal/dialog - focus management
<div role="dialog" aria-modal="true" aria-labelledby="dialog-title">
  <h2 id="dialog-title">Confirm Delete</h2>
  ...
</div>

// ✅ Status indicator - announced to screen readers
<div role="status" aria-live="polite" aria-label="Loading transactions">
  {loading && <Spinner />}
</div>

// ✅ Disabled state - proper semantics
<button disabled aria-disabled="true">
  Disabled Action
</button>
```

### CSS Accessibility Rules

```css
/* ✅ Focus visible - required */
.button:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

/* ❌ Never remove focus without replacement */
.button:focus {
  outline: none;  /* DON'T DO THIS */
}

/* ✅ Reduced motion - required for all animations */
@media (prefers-reduced-motion: reduce) {
  .modal {
    animation: none;
    transition: none;
  }
}

/* ✅ Color contrast - verify in COLOR.md */
.error-text {
  color: var(--color-error);  /* Check contrast 4.5:1 in docs/design/COLOR.md */
}
```

---

## 5. Before Submitting Code

### Final Checklist

```bash
# 1. Verify token usage
grep -E "padding:|margin:|color:|background:|font-size:|transition:|animation:" \
  app/src/components/MyComponent/MyComponent.css | \
  grep -v "var(--" | \
  grep -v "rgba\|rgb\|#" && echo "❌ Hard-coded values found!" || echo "✅ All tokens used"

# 2. Check exports
grep "MyComponent" app/src/components/index.ts && echo "✅ Exported" || echo "❌ Not exported"

# 3. Visual inspection
npm run dev
# → Open app, check:
# ✓ Colors match design spec
# ✓ Spacing correct
# ✓ Typography correct
# ✓ Responsive on mobile (F12 → Toggle device toolbar)
# ✓ Hover, focus states work
# ✓ Disabled state works
# ✓ Keyboard navigation (Tab, Enter, Escape)

# 4. Accessibility check
# → Press Tab repeatedly, check:
# ✓ Focus outline visible
# ✓ Focus order is logical
# ✓ Button/link activate with Enter/Space

# 5. Run pre-commit checks
npm test
npm run lint
npm run type-check
```

---

## 6. Design System File Organization

```
Project Root
├── docs/design/                          ← SOURCE OF TRUTH
│   ├── COLOR.md                         (25-color palette)
│   ├── TYPOGRAPHY.md                    (text scales)
│   ├── SPACING.md                       (space tokens)
│   ├── RADIUS.md                        (border radius)
│   ├── SHADOWS.md                       (elevation)
│   ├── MOTION.md                        (animations)
│   ├── BUTTONS.md                       (button variants)
│   ├── FORMS.md                         (form components)
│   ├── FEEDBACK.md                      (toast, modal, progress)
│   ├── ICONS.md                         (emoji + lucide)
│   ├── ACCESSIBILITY.md                 (WCAG compliance)
│   ├── STATES.md                        (component states)
│   ├── DATA-VIZ.md                      (charts, graphs)
│   ├── 00-overview.md                   (design overview)
│   ├── 01-dashboard.md                  (dashboard screen)
│   ├── 02-ledger.md                     (transaction list)
│   ├── 03-capture.md                    (upload screen)
│   ├── 04-settings.md                   (settings screen)
│   └── 05-admin-panel.md                (admin screen)
├── app/src/styles.css                   ← TOKEN IMPLEMENTATION
│   (Contains all CSS variables)
├── app/src/components/                  ← COMPONENTS
│   ├── Button/
│   ├── Input/
│   ├── Modal/
│   ├── ... (one folder per component)
│   └── index.ts                         (central export)
└── .claude/
    ├── rules/
    │   └── design-system.md             ← INTEGRATION RULES
    └── design-system-integration-guide.md ← THIS FILE
```

---

## 7. Common Integration Patterns

### Pattern 1: Color Variant
```typescript
// Component accepts variant prop
interface CardProps {
  variant?: 'primary' | 'success' | 'error';
}

// CSS handles semantic mapping
.card--primary { background: var(--color-primary); }
.card--success { background: var(--color-success); }
.card--error { background: var(--color-error); }
```

### Pattern 2: Size Variants
```typescript
interface ButtonProps {
  size?: 'sm' | 'md' | 'lg';
}

// CSS handles spacing
.btn--sm { padding: var(--space-2) var(--space-3); }
.btn--md { padding: var(--space-3) var(--space-4); }
.btn--lg { padding: var(--space-4) var(--space-5); }
```

### Pattern 3: State Composition
```typescript
// States are CSS classes, not props logic
<button
  className={cn(
    'btn',
    'btn--primary',
    {
      'btn--loading': isLoading,
      'btn--disabled': disabled,
    }
  )}
>
  Click me
</button>
```

### Pattern 4: Focus Management
```typescript
useEffect(() => {
  if (isOpen && modalRef.current) {
    // Focus first interactive element in modal
    const focusable = modalRef.current.querySelector(
      'button, [href], input, select, textarea, [tabindex]'
    );
    focusable?.focus();
  }
}, [isOpen]);
```

---

## 8. Troubleshooting

### Problem: Spacing doesn't match spec
**Solution**: Use the token lookup table
```bash
cat docs/design/SPACING.md | grep "^|"
```

### Problem: Colors look off
**Solution**: Verify semantic token usage
```bash
# Check what token is being used
grep "color:" app/src/components/YourComponent/YourComponent.css

# Verify token in COLOR.md
grep "your-token" docs/design/COLOR.md
```

### Problem: Focus outline invisible
**Solution**: Use correct focus style
```css
/* ❌ WRONG */
outline: 1px solid blue;

/* ✅ RIGHT */
outline: 2px solid var(--color-primary);
outline-offset: 2px;
```

### Problem: Animation doesn't respect reduced motion
**Solution**: Add media query
```css
@media (prefers-reduced-motion: reduce) {
  .component {
    animation: none;
    transition: none;
  }
}
```

---

## Quick Reference Links

| Need | Command |
|------|---------|
| Read component spec | `cat docs/design/BUTTONS.md` |
| Check token values | `grep "^--color\|^--space" app/src/styles.css` |
| Review design rules | `cat .claude/rules/design-system.md` |
| Use compliance checklist | `cat .prot/checklists/design-compliance.md` |
| View all design docs | `ls -la docs/design/` |

---

**Last Updated**: 2026-01-10
**Status**: Ready for MVP3 Frontend Development
**Next Phase**: Pick an issue (#114, #115, or #117) and follow this guide
