# Phase B: Planning

> Load when breaking down features or creating implementation plans

## When to Use

- Breaking down large features
- Creating new GitHub issues
- Planning implementation approach
- Identifying tier requirements (T1/T2/T3)

## Workflow - Complete Feature Development Process

### 🔄 Full Lifecycle Flow

```
┌──────────────────────────────────────────────────────────────────────┐
│        FEATURE DEVELOPMENT - COMPLETE LIFECYCLE                      │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  Step 1         Step 2           Step 3            Step 4            │
│  ┌────────┐    ┌────────┐      ┌────────┐        ┌────────┐         │
│  │  DOCS  │ → │ ISSUE? │  →   │ PLAN   │   →    │EVALUATE│         │
│  └────────┘    └────────┘      └────────┘        └────────┘         │
│     ▼              ▼               ▼                 ▼               │
│  Check ready   Check exists    Decompose         Review &           │
│                or create       Details           Validate           │
│                                                                       │
│         Step 5                       Step 6                          │
│      ┌────────┐                   ┌────────┐                         │
│      │CONFIRM │  ────────────→   │ TESTS  │                         │
│      └────────┘                   └────────┘                         │
│         ▼                             ▼                              │
│  Add to Issue              Create test cases                         │
│  Comment                   per detailed plan                         │
│                                                                       │
│                       → Move to Phase C: Development                │
└──────────────────────────────────────────────────────────────────────┘
```

---

### 0. Check Documentation (Prerequisite)

Before planning, verify docs/ is ready:

| Document | Check |
|----------|-------|
| REQUIREMENTS.md | Has user stories for this feature? |
| ARCHITECTURE.md | Module boundaries defined? |
| SCHEMA.md | Entities listed? |
| DESIGN.md | Screens/components specified? |

**If docs are incomplete**:
1. Switch to Phase A (`workflow/docs.md`)
2. Update relevant documents first
3. Return to planning

### 1. Requirement Analysis

```
Feature Request
     │
     ▼
┌─────────────┐
│   Analyze   │ → What's the goal?
│   Scope     │ → What are the boundaries?
└─────────────┘
     │
     ▼
┌─────────────┐
│   Break     │ → Identify sub-tasks
│   Down      │ → Define acceptance criteria
└─────────────┘
```

### 2. Open Issues (Check & Create if Needed)

**Objective**: Ensure there's a GitHub issue for this feature/task.

**Step 2.1: Check for existing issue**
```bash
# Search existing issues
gh issue list --search "feature-name" --state open
```

**Step 2.2: Decide - Reuse or Create?**

| Situation | Action |
|-----------|--------|
| Issue exists, matches scope | Reuse it (pick #N) |
| Issue exists, too broad | Split into sub-issues |
| No issue exists | Create new issue |
| Issue exists but closed | Reopen if same, else create new |

**Step 2.3: Create issue (if needed)**
```bash
gh issue create --title "Feature: [name]" --body "..."
```

Use template:
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

**Example**:
```markdown
## Goal
Implement shopping cart state management for adding/removing items

## Acceptance Criteria
- [ ] User can add item to cart with quantity
- [ ] User can remove item from cart
- [ ] Cart count displays correct total
- [ ] Cart persists across page refresh (nice-to-have)

## Context
Blocked by #42 (Cart schema definition)
Requires: SCHEMA.md updated with Cart entity

## Notes
- Use Redux for state (per ARCHITECTURE.md)
- Must support undo (for accidental delete)
```

---

### 3. Feature Decomposition

#### Decomposition Patterns

| Pattern | When to Use | How to Split |
|---------|-------------|--------------|
| **By Layer** | Full-stack feature | UI → Logic → API → DB |
| **By User Flow** | Multi-step process | Step 1 → Step 2 → Step 3 |
| **By Entity** | Multiple data types | User → Order → Payment |
| **By Variant** | Multiple modes | Create → Edit → Delete |

#### Sizing Criteria

Each issue should be **1-3 days of work**. Split if:

| Signal | Action |
|--------|--------|
| > 5 files to modify | Split by layer or module |
| > 3 acceptance criteria | Split by criterion |
| Multiple "AND" in title | Split each "AND" |
| Unclear scope | Create spike issue first |

#### Dependency Checklist

Before creating issues, identify:

- [ ] **Data dependencies**: Does this need schema changes first?
- [ ] **API dependencies**: Does this need backend endpoints first?
- [ ] **UI dependencies**: Does this need design/components first?
- [ ] **External dependencies**: Third-party services, approvals?

Mark dependencies in issue body:
```markdown
## Dependencies
- Blocked by #123 (schema changes)
- Requires: API endpoint `/users`
```

#### Example: "Shopping Cart" Breakdown

**Original request**: "Implement complete shopping cart"

**Step 1: Check docs/**
| Document | Content needed |
|----------|---------------|
| REQUIREMENTS.md | US-010: "As a user, I want to add items to cart" |
| SCHEMA.md | Cart, CartItem entities |
| DESIGN.md | S-005: Cart drawer screen |
| INTERFACES.md | IPC: add_to_cart, get_cart, remove_from_cart |

**Step 2: Decomposition** (By Layer + By Flow):

```
Shopping Cart
├── #1 Docs: Update SCHEMA.md with Cart entity
├── #2 Docs: Update INTERFACES.md with cart IPC
├── #3 IPC: Cart commands (add/remove/get)
├── #4 UI: Cart icon + badge (per DESIGN.md S-005)
├── #5 UI: Cart drawer/panel
├── #6 Logic: Cart state management
├── #7 UI: Quantity controls
├── #8 Integration: Cart persistence
└── #9 UI: Empty cart state
```

**Issue order**:
- #1, #2: Docs first (Phase A)
- #3: IPC implementation (depends on #2)
- #4-#7: Parallel UI work (1-2 days each)
- #8, #9: After core complete

### 4. Plan - Create Detailed Development Plan

**Objective**: Break down the feature into actionable, implementable steps with clear technical details.

**Step 4.1: Identify technical approach**
```
For each sub-task:
1. What files will change?
2. What existing code can be reused?
3. What new components/functions are needed?
4. What dependencies (libraries, APIs) are required?
5. Are there Pillar concerns? (Idempotency, security, observability)
```

**Step 4.2: Define implementation steps**

Create a detailed checklist in a `.claude/` plan document:
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
- Small: < 1 hour (UI text changes, simple bug fix)
- Medium: 1-4 hours (component creation, hook logic)
- Large: 4-8 hours (complex state, multiple modules)
- Spike: Unknown (research needed, create separate issue)

**Step 4.4: Identify Pillar requirements**

Review AI_DEV_PROT Pillars for each step:
```
Does this step involve:
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

### 5. Evaluate Plan - Validate and Refine

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
   Step 1 → Step 2 → Step 3 (in parallel with Step 2)
            ↓
          Step 4
```

---

### 6. Confirm and Add Dev Plan Details to Issue Comment

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

**Step 6.3: Update issue description with summary**

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

### 7. Create Test Cases for Detailed Dev Plan

**Objective**: Define test scenarios that verify each implementation step succeeds.

**Step 7.1: Create test case document**

In `.claude/` or `test/` directory:
```markdown
# Feature: [Name] - Test Cases

## Test Case Format
```
TC-1: [Title]
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

Create table mapping test cases to acceptance criteria:

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

**Step 7.6: Link test cases to issue**

Add comment to GitHub issue:
```markdown
## 🧪 Test Cases Created

Test cases defined in: `.claude/feature-[name]-TEST-CASES.md`

**Coverage**: 4 steps × 3-4 test cases = 12 total test scenarios
**Estimated manual testing**: 30 minutes
```

---

### 8. Complexity Assessment & Prioritization

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

**Quick Decision**:
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

## Commands & Workflow Reference

| Phase | Command | What | Output |
|-------|---------|------|--------|
| 0 | - | Check documentation | Docs ready ✓ |
| 1 | - | Analyze requirements | User stories identified |
| **2** | `gh issue list \|create` | **Open/check GitHub issues** | Issue #N created or found |
| **4** | Create `.claude/*-PLAN.md` | **Write detailed plan** | Plan document with steps |
| **5** | Review plan document | **Evaluate & refine** | Approved plan (labeled) |
| **6** | Add comment to issue | **Confirm in GitHub** | Issue updated with plan |
| **7** | Create `.claude/*-TEST-CASES.md` | **Create test matrix** | Test cases for all steps |
| 8 | `gh issue edit -add-label` | Assess & prioritize | Labels applied |
| - | `*issue pick <n>` | **→ Move to Phase C** | Begin development |

---

## Outputs

**After completing Phase B Planning, you should have:**

1. ✅ **GitHub Issues** (Step 2)
   - Issue #N created with clear title and description
   - Labeled with tier and pillar tags

2. ✅ **Development Plan Document** (Step 4)
   - `.claude/[feature-name]-PLAN.md` 
   - Contains detailed implementation steps with file changes, estimated time, Pillar concerns
   - Example: `.claude/shopping-cart-PLAN.md`

3. ✅ **Plan Review** (Step 5)
   - Self-review checklist completed
   - Optimization applied (if applicable)
   - Risk items identified

4. ✅ **Issue Comment with Plan** (Step 6)
   - Issue comment contains full plan or link to `.claude/*-PLAN.md`
   - Status labeled as `status/planned`
   - Tier and Pillar labels applied

5. ✅ **Test Case Document** (Step 7)
   - `.claude/[feature-name]-TEST-CASES.md`
   - Test coverage matrix showing all acceptance criteria are testable
   - Example: `.claude/shopping-cart-TEST-CASES.md`

6. ✅ **Ready for Development**
   - Issue ready to `*issue pick`
   - Plan is clear, detailed, and validated
   - Tests cases are ready to verify implementation

---

## Example Complete Flow

```markdown
# Shopping Cart Feature - Complete Flow

## 1️⃣ Docs Ready ✓
- REQUIREMENTS.md has user story
- SCHEMA.md has Cart entity
- DESIGN.md has wireframes

## 2️⃣ GitHub Issue #42
Title: "Feature: Shopping cart add/remove items"
Status: open

## 3️⃣ Development Plan
Document: `.claude/shopping-cart-PLAN.md`
- Step 1: Redux state (2h)
- Step 2: UI Components (3h)
- Step 3: Integration (1h)
- Total: 6 hours

## 4️⃣ Issue Comment
✅ Plan added to issue #42
✅ Labeled: status/planned, tier/t2, pillar/f, pillar/l

## 5️⃣ Test Cases
Document: `.claude/shopping-cart-TEST-CASES.md`
- 12 test cases across 3 steps
- 100% coverage of acceptance criteria

## 6️⃣ Ready to Start
```bash
*issue pick 42
```
→ Move to Phase C: Development
```

---

## Quick Start: From Feature Request to Development

```bash
# 1. Resume session
*resume

# 2. Check if issue exists
gh issue list --search "feature-name"

# 3. If no issue, create one
gh issue create --title "Feature: [name]" --body "[details]"

# 4. Create detailed plan
# (in .claude/[feature-name]-PLAN.md)

# 5. Evaluate & optimize plan
# (self-review checklist)

# 6. Add plan to issue comment
gh issue comment 42 -b "## Development Plan\n\n..."

# 7. Create test cases
# (in .claude/[feature-name]-TEST-CASES.md)

# 8. Apply labels
gh issue edit 42 --add-label "status/planned"

# 9. Pick issue to start development
*issue pick 42
```
