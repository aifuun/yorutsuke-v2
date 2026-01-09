# Feature Development Workflow - Quick Reference

**完整的 Feature 开发生命周期，从需求到测试准备**

---

## 🎯 Complete Lifecycle Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                   FEATURE DEVELOPMENT LIFECYCLE                      │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  PHASE A: DOCS              PHASE B: PLANNING                        │
│  ┌──────────────┐          ┌─────────────────────────────────────┐  │
│  │ Update/verify│          │ 0. Check Docs                       │  │
│  │ docs/ folder │          │ 1. Analyze Requirements             │  │
│  └──────────────┘          │ 2. Open Issues (check/create)       │  │
│                            │ 3. Decompose Features               │  │
│         │                  │ 4. Plan (create detailed steps)     │  │
│         │                  │ 5. Evaluate Plan (review/validate)  │  │
│         │                  │ 6. Confirm (add to issue comment)   │  │
│         │                  │ 7. Create Test Cases                │  │
│         │                  │ 8. Assess & Prioritize              │  │
│         │                  └─────────────────────────────────────┘  │
│         └────────────────────────────────────────────────┐           │
│                                                          ▼           │
│                              ┌─────────────────────────────────────┐ │
│                              │ PHASE C: DEVELOPMENT                │ │
│                              │                                     │ │
│                              │ *issue pick <n>                     │ │
│                              │ - Load plan from issue comment      │ │
│                              │ - Run *tier (if needed)             │ │
│                              │ - Execute Phase 1-4 (code)          │ │
│                              │ - Run tests from test case doc      │ │
│                              │ *issue close <n>                    │ │
│                              │                                     │ │
│                              └─────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 📝 Step-by-Step Checklist

### Phase B: Planning (Before Coding)

- [ ] **Step 0: Check Documentation**
  - [ ] REQUIREMENTS.md has user stories?
  - [ ] ARCHITECTURE.md defines modules?
  - [ ] SCHEMA.md lists entities?
  - [ ] DESIGN.md has screens/components?
  - **If incomplete** → Go to Phase A first

- [ ] **Step 1: Analyze Requirements**
  - [ ] What's the main goal? (1 sentence)
  - [ ] What are the boundaries?
  - [ ] Identify sub-tasks

- [ ] **Step 2: Open Issues (Check & Create)**
  - [ ] Search for existing issue: `gh issue list --search "feature-name"`
  - [ ] Reuse existing issue OR create new one
    ```bash
    gh issue create --title "Feature: [name]" --body "..."
    ```
  - [ ] Issue has acceptance criteria
  - [ ] Issue links to blocked/blocked-by issues

- [ ] **Step 3: Decompose Features**
  - [ ] Identify decomposition pattern (by layer, flow, entity, variant)
  - [ ] Each sub-task is 1-3 days of work
  - [ ] Dependency diagram created
  - [ ] All blockers identified

- [ ] **Step 4: Create Detailed Development Plan**
  - [ ] Create `.claude/[feature-name]-PLAN.md`
  - [ ] For each step: files, description, subtasks, time estimate, Pillar concerns
  - [ ] Total effort estimated
  - [ ] All technical decisions documented

- [ ] **Step 5: Evaluate Plan**
  - [ ] Clarity check: Could another dev understand each step?
  - [ ] Completeness check: All files/components identified?
  - [ ] Feasibility check: Timeline realistic?
  - [ ] Risk assessment: Any red flags?
  - [ ] Pillar alignment: Pillar concerns addressed?
  - [ ] Optimization: Any parallelization possible?

- [ ] **Step 6: Confirm & Add to Issue**
  - [ ] Add plan as comment to GitHub issue
    ```bash
    gh issue comment <n> -b "## Development Plan\n\n..."
    ```
  - [ ] Apply status label: `status/planned`
  - [ ] Apply tier label: `tier/t1`, `tier/t2`, or `tier/t3`
  - [ ] Apply pillar labels: `pillar/a`, `pillar/b`, etc.
  - [ ] Update issue description with plan summary

- [ ] **Step 7: Create Test Cases**
  - [ ] Create `.claude/[feature-name]-TEST-CASES.md`
  - [ ] Write test cases for each implementation step
  - [ ] Format: TC-1.1, TC-2.1, etc. with Given/When/Then
  - [ ] Create coverage matrix (criteria vs tests)
  - [ ] Estimate manual testing time
  - [ ] Link test document to issue comment

- [ ] **Step 8: Assess & Prioritize**
  - [ ] Complexity assessment (does it need Tier?)
  - [ ] MoSCoW classification (Must/Should/Could/Won't)
  - [ ] Priority score calculated (if complex feature)
  - [ ] Final labels applied: `priority/must` or similar

---

## 📂 Artifact Checklist

**After Phase B Planning, these files should exist:**

```
.claude/
├── [feature-name]-PLAN.md                    ✅ Required
│   └── Contains: steps, files, time, pillars
│
├── [feature-name]-TEST-CASES.md               ✅ Required
│   └── Contains: test scenarios, coverage matrix
│
└── MEMORY.md (decision added here)            ✅ Update if major decision
    └── Record why this feature matters

github/
└── Issue #N
    ├── Title: "Feature: [name]"              ✅ Required
    ├── Description: goal, acceptance, context ✅ Required
    ├── Comments: 
    │   └── "## Development Plan\n[plan]"     ✅ Required
    └── Labels: status/planned, tier/t2, ...  ✅ Required
```

---

## 🚀 Transition to Phase C: Development

When all Phase B outputs are ready:

```bash
# 1. Pick issue
*issue pick <n>

# 2. Load context (auto-loads from .claude/)
# → MEMORY.md (decisions)
# → [feature-name]-PLAN.md (implementation steps)
# → [feature-name]-TEST-CASES.md (test scenarios)

# 3. Classify complexity (if needed)
*tier

# 4. Begin implementation Phase 1-4
*next

# 5. After completion, close issue
*issue close <n>
```

---

## 📊 Example: Shopping Cart Feature

### Phase B Artifacts

**Issue #42: Feature: Shopping cart add/remove items**

```markdown
## Goal
Enable users to add/remove items from shopping cart with persistent state

## Acceptance Criteria
- [ ] User can add item with quantity
- [ ] User can remove item from cart
- [ ] Cart count displays correctly
- [ ] Cart persists after page reload

## Development Plan Summary
[Linked to .claude/shopping-cart-PLAN.md]

| Step | Module | Time | Pillars |
|------|--------|------|---------|
| 1 | Redux state | 2h | F, L |
| 2 | UI components | 3h | A, L |
| 3 | Integration | 1h | Q |

## Test Cases
[Linked to .claude/shopping-cart-TEST-CASES.md]
12 total test cases, 100% coverage

Labels: status/planned, tier/t2, pillar/f, pillar/l
```

**File: `.claude/shopping-cart-PLAN.md`**

```markdown
# Shopping Cart - Development Plan

## Step 1: Redux State (2h)
- Files: src/redux/cart.slice.ts
- Add: reducer, actions, selectors
- Pillar F: Optimistic updates for consistency

## Step 2: UI Components (3h)
- Files: src/components/CartIcon.tsx, CartDrawer.tsx
- Add: badge display, drawer animation
- Pillar A: Modular, reusable components

## Step 3: Integration (1h)
- Files: src/App.tsx
- Wire: Redux to UI components
- Add: localStorage persistence
- Pillar Q: Idempotent add/remove operations
```

**File: `.claude/shopping-cart-TEST-CASES.md`**

```markdown
# Shopping Cart - Test Cases

## Step 1: Redux State

TC-1.1: Add item to empty cart
- Given: Cart is empty
- When: Add Coffee (qty: 2)
- Then: State shows 1 item, qty=2 ✓

TC-1.2: Add same item again
- Given: Cart has Coffee (qty: 2)
- When: Add Coffee (qty: 1)
- Then: Qty updates to 3, no duplicate ✓

## Step 2: UI Components

TC-2.1: Badge shows count
- Given: Cart has 3 items
- When: Cart icon renders
- Then: Badge displays "3" ✓

## Coverage Matrix

| Criterion | Tests | Status |
|-----------|-------|--------|
| Add item | TC-1.1, TC-2.1 | ✓ |
| Remove item | TC-1.3, TC-2.2 | ✓ |
| Cart count | TC-2.1, TC-3.1 | ✓ |
| Persistence | TC-3.1 | ✓ |
```

---

## 🔗 References

- **Phase A Details**: `workflow/docs.md`
- **Phase B Details**: `workflow/planning.md` (THIS WORKFLOW)
- **Phase C Details**: `workflow/development.md`
- **Phase D Details**: `workflow/release.md`

---

## ⚡ Quick Reference Commands

```bash
# Planning workflow
gh issue list --search "feature"         # Find issues
gh issue create --title "Feature: X"     # Create issue
gh issue comment <n> -b "Plan..."        # Add plan comment
gh issue edit <n> --add-label "label"    # Apply labels

# Development workflow
*issue pick <n>          # Start working on issue
*tier                    # Classify complexity
*next                    # Show next steps
*issue close <n>         # Complete issue

# Session management
*resume                  # Load context
*sync                    # Commit & push
```

---

## 📈 Success Criteria for Phase B

✅ **Phase B is complete when:**

- [ ] Issue #N exists with clear goal & acceptance criteria
- [ ] Development plan doc created with all steps detailed
- [ ] Plan review completed (clarity, feasibility, risk check)
- [ ] Plan added to issue comment with all labels
- [ ] Test cases created covering all acceptance criteria
- [ ] Issue labeled with status/planned, tier, and pillars
- [ ] Team has reviewed and approved plan (ready to start coding)

✅ **Ready to → `*issue pick <n>` → Phase C Development**

