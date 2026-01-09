# Planning Workflow - Complete Reference (Steps 0-8)

> Full reference documentation for all planning steps. For quick start, see `planning-mvp.md` (MVP-level) and `planning-feature.md` (feature-level).

---

## 📋 Quick Navigation

**For MVP decomposition** (40 minutes):
→ See `planning-mvp.md`

**For feature planning** (1-2 hours):
→ See `planning-feature.md`

**For complete reference** (this page):
→ Read Steps 0-8 below

---

## 🎯 Complete Planning Workflow (Steps 0-8)

This reference covers all 8 planning steps used in both MVP-level and Feature-level planning.

---

## Step 0: Check Documentation (Prerequisite)

Before planning, verify docs/ is ready:

| Document | Check |
|----------|-------|
| REQUIREMENTS.md | Has user stories for this feature? |
| ARCHITECTURE.md | Module boundaries defined? |
| SCHEMA.md | Entities listed? |
| DESIGN.md | Screens/components specified? |

**If docs incomplete** → Switch to Phase A first (see `workflow/docs.md`)

---

## Step 1: Requirement Analysis

Break down the feature request into clear goals and boundaries:

```
Feature Request
     │
     ▼
┌──────────────────┐
│ What's the goal? │ ← 1 sentence summary
│ What are the     │ ← Module boundaries
│ boundaries?      │ ← Acceptance criteria
└──────────────────┘
     │
     ▼
┌──────────────────┐
│ Identify         │ ← Sub-tasks  
│ sub-tasks        │ ← Dependencies
└──────────────────┘
```

**Checklist:**
- [ ] What is the main goal? (1 sentence)
- [ ] What are the boundaries? (What's IN scope, what's OUT)
- [ ] What are the acceptance criteria? (How do we know it's done)
- [ ] What sub-tasks are needed?

---

## Step 2: Open Issues (Check & Create)

**Objective**: Ensure there's a GitHub issue for this feature/task.

**Checklist:**

```bash
# Step 2.1: Search for existing issue
gh issue list --search "feature-name" --state open

# Step 2.2: Decide - Reuse or Create?
# Issue exists & matches scope? → Reuse it (pick #N)
# Issue too broad? → Split into sub-issues
# No issue exists? → Create new

# Step 2.3: Create issue (if needed)
gh issue create --title "Feature: [name]" --body "..."
```

**Issue template:**
```markdown
## Goal
[What this accomplishes - 1 sentence]

## Acceptance Criteria
- [ ] Criterion 1 (must-have)
- [ ] Criterion 2 (must-have)
- [ ] Criterion 3 (nice-to-have)

## Context
[Why this matters, user story reference]

## Notes
[Constraints, assumptions, related issues]
```

---

## Step 3: Feature Decomposition

### Decomposition Patterns

| Pattern | When to Use | How to Split |
|---------|-------------|--------------|
| **By Layer** | Full-stack feature | UI → Logic → API → DB |
| **By User Flow** | Multi-step process | Step 1 → Step 2 → Step 3 |
| **By Entity** | Multiple data types | User → Order → Payment |
| **By Variant** | Multiple modes | Create → Edit → Delete |

### Sizing Criteria

Each issue should be **1-3 days of work**. Split if:

| Signal | Action |
|--------|--------|
| > 5 files to modify | Split by layer or module |
| > 3 acceptance criteria | Split by criterion |
| Multiple "AND" in title | Split each "AND" |
| Unclear scope | Create spike issue first |

### Dependency Checklist

Before creating issues, identify:

- [ ] **Data dependencies**: Does this need schema changes first?
- [ ] **API dependencies**: Does this need backend endpoints first?
- [ ] **UI dependencies**: Does this need design/components first?
- [ ] **External dependencies**: Third-party services, approvals?

---

## Step 4: Plan - Create Detailed Development Plan

**Objective**: Break down the feature into actionable, implementable steps with clear technical details.

**Step 4.1: Identify technical approach**

For each sub-task, document:
1. What files will change?
2. What existing code can be reused?
3. What new components/functions are needed?
4. What dependencies (libraries, APIs) are required?
5. Are there Pillar concerns?

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
...

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

---

## Step 5: Evaluate Plan - Validate and Refine

**Objective**: Review the plan for completeness, feasibility, and risk.

**Step 5.1: Self-review checklist**

- [ ] **Clarity**: Can another developer understand each step?
- [ ] **Completeness**: Are all files/components identified?
- [ ] **Feasibility**: Is timeline realistic?
- [ ] **Dependencies**: Are all blockers identified and ordered correctly?
- [ ] **Pillar alignment**: Are Pillar concerns addressed in each step?
- [ ] **Acceptance criteria**: Does plan achieve original issue acceptance criteria?
- [ ] **Risk**: Are high-risk items identified?

**Step 5.2: Identify potential issues**

| Red Flag | What to Do |
|----------|-----------|
| Step takes > 8 hours | Split into smaller steps |
| Unknown technology | Add spike issue to research first |
| Multiple interdependencies | Redraw dependency diagram |
| Pillar violation possible | Flag for review before coding |
| Acceptance criteria unclear | Add clarification to issue |

**Step 5.3: Optimize plan**

- Can any steps be parallelized?
- Can any steps be removed or deferred?
- Are there quick wins that unlock other work?

---

## Step 6: Confirm and Add Plan to Issue Comment

**Objective**: Get approval on the detailed plan before starting development.

**Step 6.1: Add plan as issue comment**

```bash
gh issue comment <n> -b "## Development Plan

[Copy the complete plan from Step 4 here]

### Checklist for Development
- [ ] Pull latest code
- [ ] Create feature branch: \`feature/[name]-#N\`
- [ ] Follow all implementation steps in order
- [ ] Run tests after each step
- [ ] Commit with step number: \`Step 1: [description] (#N)\`"
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
```

**Step 7.3: Create coverage matrix**

```markdown
## Test Coverage Matrix

| Acceptance Criteria | Test Cases | Status |
|-------------------|-----------|--------|
| User can add item | TC-1.1, TC-2.2 | ✅ |
| User can remove item | TC-1.3, TC-2.3 | ✅ |
| Cart count displays | TC-2.1, TC-3.1 | ✅ |
| Cart persists | TC-3.1 | ✅ |

Coverage: 100% of acceptance criteria
```

---

## Step 8: Complexity Assessment & Prioritization

**Step 8.1: Assess complexity**

Quick check - Does it involve:
- Data writes / mutations?
- State management (forms, wizards)?
- Critical operations (payment, sync)?
- Multiple Pillars?

**Step 8.2: MoSCoW Prioritization**

| Category | Label | Meaning |
|----------|-------|---------|
| **Must** | `priority/must` | Cannot ship without |
| **Should** | `priority/should` | Important, not critical |
| **Could** | `priority/could` | Nice to have |
| **Won't** | `priority/wont` | Not this release |

**Step 8.3: Apply Priority Labels**

```bash
gh issue edit <n> --add-label "priority/must,status/planned"
```

---

## 📊 Example: Complete Shopping Cart Planning

### Issue Creation
```markdown
Title: Feature: Shopping cart state management

Goal: Implement Redux slice for managing cart items

Acceptance Criteria:
- [ ] Add item with quantity
- [ ] Remove item from cart
- [ ] Display cart count
- [ ] Persist cart to localStorage

Rough Size: 8 hours
Dependencies: None
```

### Development Plan (Step 4)
```markdown
# Shopping Cart State - Development Plan

Step 1: Redux Slice (2h)
- Files: src/redux/cart.slice.ts
- Add actions, reducers, selectors
- Pillar: L (Headless), F (Consistency)

Step 2: UI Components (3h)
- Files: src/components/CartIcon.tsx, CartDrawer.tsx
- Build UI, connect Redux
- Pillar: A (Composition)

Step 3: Persistence (1h)
- Files: src/middleware/cartPersistence.ts
- localStorage middleware
- Pillar: Q (Idempotency)

Total: 6 hours
```

### Test Cases (Step 7)
```markdown
# Shopping Cart State - Test Cases

TC-1.1: Add item
- Given: Cart empty
- When: Add Coffee (qty: 2)
- Then: State shows 1 item, qty=2

TC-1.2: Duplicate add
- Given: Cart has Coffee (qty: 2)
- When: Add Coffee (qty: 1)
- Then: Qty updates to 3

... (8 total test cases)

Coverage: 100%
```

---

## ✅ Complete Planning Checklist

- [ ] Step 0: Documentation ready
- [ ] Step 1: Requirements analyzed
- [ ] Step 2: GitHub issue created
- [ ] Step 3: Features decomposed
- [ ] Step 4: Development plan detailed
- [ ] Step 5: Plan evaluated and optimized
- [ ] Step 6: Plan added to issue + labeled
- [ ] Step 7: Test cases created with coverage matrix
- [ ] Step 8: Complexity and priority assessed
- [ ] Ready to develop: `*issue pick <n>`

---

## 📚 See Also

- **MVP-Level Planning**: `planning-mvp.md`
- **Feature-Level Planning**: `planning-feature.md`
- **Architecture**: `workflow/architecture.md`
- **Development**: `workflow/development.md`
