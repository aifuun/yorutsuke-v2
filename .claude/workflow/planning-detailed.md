# Phase B: Planning - Steps 4-8 (Detailed)

> Deep dive into planning, evaluation, confirmation, test cases, and prioritization

**Prerequisites**: Complete Steps 0-3 first (see `planning-core.md`)

---

## Step 4: Plan - Create Detailed Development Plan

**Objective**: Break down the feature into actionable, implementable steps with clear technical details.

**Step 4.1: Identify technical approach**

For each sub-task, document:
1. What files will change?
2. What existing code can be reused?
3. What new components/functions are needed?
4. What dependencies (libraries, APIs) are required?
5. Are there Pillar concerns? (Idempotency, security, observability)

**Step 4.2: Define implementation steps**

Create a detailed plan in `.claude/[feature-name]-PLAN.md`:

```markdown
# Feature: [Name] - Development Plan

## Overview
[1-2 sentence summary]

## Implementation Steps

### Step 1: [Module/Layer name]
- **Files affected**: src/components/Cart.tsx, src/hooks/useCart.ts
- **Description**: Create cart state management
- **Subtasks**:
  - [ ] Define Redux slice (cart reducer)
  - [ ] Add selectors for cart items
  - [ ] Add actions (add, remove, update)
- **Estimated time**: 2 hours
- **Pillar concerns**: F (Consistency - optimistic updates)

### Step 2: [Module/Layer name]
- **Files affected**: [list]
- **Description**: [what this does]
- **Subtasks**: [checklist]
- **Estimated time**: [estimate]
- **Pillar concerns**: [relevant pillars]

## Testing Strategy
- Unit tests: [What to test]
- Integration tests: [What to test]
- Manual QA: [What to test]

## Deployment Notes
[Any special considerations for release]
```

**Step 4.3: Estimate effort per step**

| Size | Time | Examples |
|------|------|----------|
| Small | < 1 hour | UI text changes, simple bug fix |
| Medium | 1-4 hours | Component creation, hook logic |
| Large | 4-8 hours | Complex state, multiple modules |
| Spike | Unknown | Research needed, create separate issue |

If any step > 8 hours → Split it further

**Step 4.4: Identify Pillar requirements**

For each step, check if it involves:
```
✓ Pillar A (Composition)?      → Modular, injectable dependencies
✓ Pillar B (Airlock)?          → Validation at boundaries
✓ Pillar F (Consistency)?      → Optimistic updates, conflict resolution
✓ Pillar L (Headless)?         → Logic separated from UI
✓ Pillar M (Compensation)?     → Rollback/undo support
✓ Pillar Q (Idempotency)?      → Safe duplicate calls
✓ Pillar R (Observability)?    → Semantic logging
```

Mark relevant Pillars in each step.

---

## Step 5: Evaluate Plan - Validate and Refine

**Objective**: Review the plan for completeness, feasibility, and risk.

**Step 5.1: Self-review checklist**

- [ ] **Clarity**: Can another developer understand each step?
- [ ] **Completeness**: Are all files/components identified?
- [ ] **Feasibility**: Is timeline realistic? (Ask: "Can I do this in the estimated time?")
- [ ] **Dependencies**: Are all blockers identified and ordered correctly?
- [ ] **Pillar alignment**: Are Pillar concerns addressed in each step?
- [ ] **Acceptance criteria**: Does plan achieve original issue acceptance criteria?
- [ ] **Risk**: Are high-risk items identified? (Complex logic, performance, breaking changes)

**Step 5.2: Identify potential issues**

| Red Flag | What to Do |
|----------|-----------|
| Step takes > 8 hours | Split into smaller steps |
| Unknown technology | Add spike issue to research first |
| Multiple interdependencies | Redraw dependency diagram |
| Pillar violation possible | Flag for review before coding |
| Acceptance criteria unclear | Add clarification to issue |

**Step 5.3: Optimize plan (optional)**

- Can any steps be parallelized?
- Can any steps be removed or deferred?
- Are there quick wins that unlock other work?

Example optimization:
```
❌ Before:
   Step 1 → Step 2 → Step 3 → Step 4
   
✅ After:
   Step 1 → ├─ Step 2 (parallel)
            ├─ Step 3 (parallel)
            └─ Step 4 (after 2-3 complete)
```

---

## Step 6: Confirm and Add Plan Details to Issue Comment

**Objective**: Get approval on the detailed plan before starting development.

**Step 6.1: Add plan as issue comment**

In the GitHub issue, add a comment:
```markdown
## 🔧 Development Plan (Detailed)

[Copy the complete plan from Step 4 here]

### Checklist for Development
- [ ] Pull latest code
- [ ] Create feature branch: `feature/cart-state-#42`
- [ ] Follow all implementation steps in order
- [ ] Run tests after each step
- [ ] Commit with step number: `Step 1: Create Redux slice (#42)`
```

**Step 6.2: Mark issue with labels**

```bash
gh issue edit <n> --add-label "status/planned,tier/t2,pillar/f,pillar/l"
```

Useful labels:
- `status/planned` - Plan is ready, awaiting implementation
- `status/in-progress` - Currently being developed
- `status/needs-review` - Code ready for review
- `tier/t1` or `tier/t2` or `tier/t3` - Complexity level
- `pillar/*` - Relevant AI_DEV_PROT pillars

**Step 6.3: Update issue description**

Add "Development Plan" section to issue body:
```markdown
## Development Plan Summary

| Step | Module | Effort | Pillars |
|------|--------|--------|---------|
| 1 | State management | 2h | F, L |
| 2 | UI Components | 3h | A, L |
| 3 | Integration | 1h | Q |

**Total estimated time**: 6 hours

See comments for detailed implementation steps.
```

---

## Step 7: Create Test Cases for Detailed Dev Plan

**Objective**: Define test scenarios that verify each implementation step succeeds.

**Step 7.1: Create test case document**

Create `.claude/[feature-name]-TEST-CASES.md`:

```markdown
# Feature: [Name] - Test Cases

## Test Case Format
```
TC-#: [Title]
├─ Given: [Initial state]
├─ When: [User action or trigger]
└─ Then: [Expected result]
```
```

**Step 7.2: Write test cases per implementation step**

```markdown
## Step 1: Redux State Management

### TC-1.1: Add item to empty cart
- Given: Cart is empty
- When: User adds item "Coffee" with qty 2
- Then: 
  - [ ] Redux state shows 1 item
  - [ ] Item properties: name="Coffee", qty=2
  - [ ] Cart total updates to qty 2

### TC-1.2: Add same item twice
- Given: Cart has Coffee (qty 2)
- When: User adds Coffee again (qty 1)
- Then:
  - [ ] Cart still shows 1 item
  - [ ] Qty updates to 3
  - [ ] No duplicate entries

### TC-1.3: Remove item from cart
- Given: Cart has multiple items
- When: User clicks "Remove" on Coffee
- Then:
  - [ ] Coffee removed from state
  - [ ] Other items remain
  - [ ] Cart total updates
```

**Step 7.3: Create UI test cases**

```markdown
## Step 2: Cart UI Components

### TC-2.1: Cart badge shows count
- Given: Cart has 3 items
- When: Cart icon renders
- Then:
  - [ ] Badge displays "3"
  - [ ] Badge is red
  - [ ] Badge is visible on icon

### TC-2.2: Cart drawer opens/closes
- Given: User is on product page
- When: User clicks cart icon
- Then:
  - [ ] Cart drawer slides in from right
  - [ ] Drawer shows all items
  - [ ] User can close by clicking X
```

**Step 7.4: Create integration test cases**

```markdown
## Step 3: End-to-End Integration

### TC-3.1: Add item → Persist → Reload
- Given: User adds item to cart
- When: Page reloads
- Then:
  - [ ] Cart items still present
  - [ ] Quantities unchanged
  - [ ] No errors in console

### TC-3.2: Add → Checkout flow
- Given: Cart has items
- When: User clicks "Checkout"
- Then:
  - [ ] Cart data passed to checkout page
  - [ ] Checkout page shows correct items
  - [ ] Order total matches cart total
```

**Step 7.5: Coverage matrix**

Map test cases to acceptance criteria:

```markdown
## Test Coverage Matrix

| Acceptance Criteria | Test Cases | Status |
|-------------------|-----------|--------|
| User can add item | TC-1.1, TC-2.1 | ✅ |
| User can remove item | TC-1.3, TC-2.2 | ✅ |
| Cart count displays | TC-2.1, TC-3.1 | ✅ |
| Cart persists | TC-3.1 | ✅ |

Coverage: 100% of acceptance criteria
```

**Step 7.6: Link test cases to issue**

Add comment to GitHub issue:
```markdown
## 🧪 Test Cases Created

Test cases defined in: `.claude/feature-[name]-TEST-CASES.md`

**Coverage**: 4 steps × 3-4 test cases = 12 total test scenarios
**Estimated manual testing**: 30 minutes
```

---

## Step 8: Complexity Assessment & Prioritization

**Step 8.1: Assess complexity**

Quick check - Does it involve:
- Data writes / mutations?
- State management (forms, wizards)?
- Critical operations (payment, sync)?
- Multiple Pillars?

If YES → Note "Needs Tier classification" in issue before development

**Step 8.2: MoSCoW Prioritization**

| Category | Label | Meaning | Guideline |
|----------|-------|---------|-----------|
| **Must** | `priority/must` | Cannot ship without | Core functionality, blockers |
| **Should** | `priority/should` | Important, not critical | High value, low risk |
| **Could** | `priority/could` | Nice to have | If time permits |
| **Won't** | `priority/wont` | Not this release | Explicitly out of scope |

**Quick Decision:**
```
Is it legally/contractually required? → Must
Does the product work without it?
  No → Must
  Yes, but poorly → Should
  Yes, just missing polish → Could
```

**Step 8.3: Apply Priority Labels**

```bash
gh issue edit <n> --add-label "priority/must,status/planned"
```

| Label | Use When | Example |
|-------|----------|---------|
| `priority/must` | Blocks release | Auth, core CRUD |
| `priority/should` | High value | Search, filters |
| `priority/could` | Enhancement | Animations, shortcuts |
| `priority/wont` | Deferred | Advanced analytics |
| `blocked` | Waiting on dependency | Needs API first |

**Step 8.4: Decision Matrix (for complex features)**

Score each sub-feature:

| Feature | Value (1-5) | Effort (1-5) | Risk (1-5) | Score |
|---------|-------------|--------------|------------|-------|
| Add to cart | 5 | 2 | 1 | **12** |
| Cart persistence | 4 | 3 | 2 | **9** |
| Undo support | 3 | 2 | 1 | **8** |
| Analytics | 2 | 2 | 1 | **5** |

**Score formula** = Value × 2 + (6 - Effort) + (6 - Risk)

Higher score = Higher priority

---

## Example: Complete Shopping Cart Plan

### Plan Document (`.claude/shopping-cart-PLAN.md`)

```markdown
# Shopping Cart - Development Plan

## Overview
Implement Redux-based cart state management with UI components and localStorage persistence

## Implementation Steps

### Step 1: Redux State Management (2h)
- **Files**: src/redux/cart.slice.ts, src/redux/store.ts
- **Subtasks**:
  - [ ] Create Redux slice (cart reducer, actions, selectors)
  - [ ] Implement addItem, removeItem, updateQuantity actions
  - [ ] Create selector for cart items and total
  - [ ] Write unit tests for reducer
- **Pillar concerns**: L (Headless - logic separated), F (Consistency - optimistic updates)

### Step 2: UI Components (3h)
- **Files**: src/components/CartIcon.tsx, src/components/CartDrawer.tsx
- **Subtasks**:
  - [ ] Create CartIcon component with badge
  - [ ] Create CartDrawer component
  - [ ] Connect to Redux state
  - [ ] Add open/close animation
  - [ ] Test component rendering
- **Pillar concerns**: A (Composition - reusable components), L (Headless - separate logic)

### Step 3: Cart Persistence (1h)
- **Files**: src/middleware/cartPersistence.ts, src/App.tsx
- **Subtasks**:
  - [ ] Create middleware to persist cart to localStorage
  - [ ] Load cart from localStorage on app init
  - [ ] Handle localStorage errors gracefully
  - [ ] Test persistence across page reload
- **Pillar concerns**: Q (Idempotency - safe load), R (Observability - log persistence)

## Testing Strategy
- Unit tests: Redux slice (actions, reducers, selectors)
- Integration tests: Redux + localStorage interaction
- Component tests: CartIcon, CartDrawer rendering
- E2E tests: Add item → persist → reload flow

## Deployment Notes
- No breaking changes
- localStorage fallback for older browsers
- No API changes required
```

### Test Cases (`.claude/shopping-cart-TEST-CASES.md`)

```markdown
# Shopping Cart - Test Cases

## Step 1: Redux State

### TC-1.1: Add item to empty cart
- Given: Redux state cart is empty
- When: dispatch addItem({name: "Coffee", qty: 2})
- Then: State shows [{name: "Coffee", qty: 2}]

### TC-1.2: Add duplicate item increments qty
- Given: Cart has [{name: "Coffee", qty: 2}]
- When: dispatch addItem({name: "Coffee", qty: 1})
- Then: Cart has [{name: "Coffee", qty: 3}]

### TC-1.3: Remove item
- Given: Cart has multiple items
- When: dispatch removeItem("Coffee")
- Then: Coffee removed, other items remain

## Step 2: UI Components

### TC-2.1: CartIcon displays badge count
- Given: Redux state has 3 items
- When: CartIcon component renders
- Then: Badge displays "3"

### TC-2.2: CartDrawer shows all items
- Given: Redux state has cart items
- When: User clicks CartIcon
- Then: CartDrawer opens showing all items with quantities

## Step 3: Persistence

### TC-3.1: Cart persists to localStorage
- Given: User adds item to cart
- When: Window.localStorage.getItem('cart')
- Then: Returns stringified cart state

### TC-3.2: Cart restores from localStorage on load
- Given: localStorage has cart data
- When: App initializes
- Then: Redux state loaded from localStorage

## Coverage Matrix

| Criterion | Tests | Status |
|-----------|-------|--------|
| Add item | TC-1.1, TC-1.2, TC-2.2 | ✅ |
| Remove item | TC-1.3 | ✅ |
| Display count | TC-2.1 | ✅ |
| Persist/restore | TC-3.1, TC-3.2 | ✅ |

**Total**: 8 test cases, 100% coverage
```

---

## Summary: Steps 4-8

| Step | Deliverable | Key Output |
|------|-------------|-----------|
| 4 | **Development Plan** | `.claude/[feature]-PLAN.md` with detailed steps |
| 5 | **Plan Review** | Self-review checklist completed, optimizations applied |
| 6 | **GitHub Issue** | Issue comment with plan + labels applied |
| 7 | **Test Cases** | `.claude/[feature]-TEST-CASES.md` with coverage matrix |
| 8 | **Prioritization** | Priority labels applied to GitHub issue |

---

## Success Criteria for Steps 4-8

✅ **Steps 4-8 complete when:**

- [ ] Development plan created with all steps detailed (files, subtasks, time, pillars)
- [ ] Plan reviewed and self-checklist passed
- [ ] Plan added as comment to GitHub issue
- [ ] Issue labeled with status/planned, tier/*, pillar/*
- [ ] Test cases created with coverage matrix
- [ ] All acceptance criteria mapped to test cases
- [ ] Priority classification applied (Must/Should/Could)
- [ ] Ready to begin development

✅ **Next** → Begin Phase C: Development (see `workflow/development.md`)

