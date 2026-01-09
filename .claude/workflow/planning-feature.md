# Step 2: Feature-Level Planning (1-2 hours)

> Detailed planning for a single feature before development. Creates implementation plan and test cases.

**Duration**: 1-2 hours  
**Output**: Dev Plan + Test Cases (in GitHub Issue comments)  
**Timing**: When ready to start developing a feature  
**Prerequisites**: MVP-Level Decomposition complete (see `planning-mvp.md`)

---

## 📋 When to Use

- About to start developing a specific feature
- Ready to understand implementation details
- Need to create test cases for TDD

**Do NOT use for**: Getting overview of entire MVP (→ see `planning-mvp.md` instead)

---

## 🎯 Why Feature-Level?

**After MVP-Level Decomposition**, you know:
- ✅ What features exist
- ✅ Rough sizes (8h, 6h, 12h)
- ✅ Dependencies

**Before Feature development**, you need:**
- ❌ Detailed implementation steps
- ❌ Exact file changes
- ❌ Test cases for TDD

**Feature-Level Planning provides these**, but ONLY when you're ready to develop.

---

## 🔄 Workflow Integration

```
Day 1: MVP-Level Decomposition (40 min)
└─ Create Issues #100, #101, #102, etc.

Day 5: Ready to start Feature #100
└─ Do Feature-Level Planning (1-2h)
   └─ Create PLAN + TEST-CASES files
   └─ Add to GitHub Issue comment
   └─ Ready to *issue pick and code

Day 8: Ready to start Feature #101
└─ Do Feature-Level Planning (1-2h)
   └─ (Now you know how Feature #100 turned out)
   └─ Can adjust Feature #101 plan based on learnings
```

**Key difference**: Feature plans are made JUST before development, not all upfront.

---

## 📝 Step 1: Validate Requirements Against Docs

**Duration**: 15 minutes

Ensure all prerequisite docs are ready:

**Checklist:**
- [ ] REQUIREMENTS.md has user story for this feature
- [ ] ARCHITECTURE.md defines module boundaries
- [ ] SCHEMA.md lists required entities
- [ ] DESIGN.md has UI mockups/specifications
- [ ] INTERFACES.md has API definitions (if needed)

**If incomplete:**
→ Update docs first (see `workflow/docs.md`)

---

## 🛠️ Step 2: Create Detailed Development Plan

**Duration**: 30-45 minutes

Create `.claude/[feature-name]-PLAN.md`:

```markdown
# Feature: [Name] - Development Plan

## Overview
[1-2 sentence summary of what this feature accomplishes]

## Implementation Steps

### Step 1: [Module/Component Name]
- **Files affected**: src/redux/cart.slice.ts, src/redux/store.ts
- **Description**: Create Redux state management for cart
- **Subtasks**:
  - [ ] Create Redux slice (reducer, actions)
  - [ ] Add cart selectors
  - [ ] Write unit tests for reducer
- **Estimated time**: 2 hours
- **Pillar concerns**: L (Headless - separate logic), F (Consistency)

### Step 2: [Module/Component Name]
- **Files affected**: [list]
- **Description**: [what this does]
- **Subtasks**: [checklist]
- **Estimated time**: [estimate]
- **Pillar concerns**: [relevant pillars]

### Step 3: [Module/Component Name]
...

## Technical Decisions
- Why Redux instead of Context API?
- Why localStorage instead of IndexedDB?

## Risk Assessment
- High-risk areas? (Complex state, performance)
- Unknown technologies?

## Deployment Notes
- Any migration needed?
- Breaking changes?
```

**Example:**
```markdown
# Feature: Shopping Cart State - Development Plan

## Overview
Implement Redux-based shopping cart state management with persistence

## Implementation Steps

### Step 1: Redux Slice Creation
- **Files affected**: src/redux/cart.slice.ts, src/redux/store.ts
- **Description**: Create Redux slice for cart state
- **Subtasks**:
  - [ ] Define initial state (items array, total)
  - [ ] Create addItem action
  - [ ] Create removeItem action
  - [ ] Create updateQuantity action
  - [ ] Create selectors (getItems, getTotal, getCount)
  - [ ] Write unit tests for all actions
- **Estimated time**: 2 hours
- **Pillar concerns**: L (Headless)

### Step 2: localStorage Middleware
- **Files affected**: src/middleware/cartPersistence.ts
- **Description**: Auto-save cart to localStorage on changes
- **Subtasks**:
  - [ ] Create middleware that watches cart state
  - [ ] Save to localStorage on each change
  - [ ] Load from localStorage on app init
  - [ ] Handle localStorage errors
  - [ ] Write integration tests
- **Estimated time**: 1 hour
- **Pillar concerns**: Q (Idempotency), R (Observability)

### Step 3: Integration Tests
- **Files affected**: src/__tests__/cart.integration.test.ts
- **Description**: Test cart state + persistence together
- **Subtasks**:
  - [ ] Test add → localStorage → reload → verify
  - [ ] Test remove → localStorage → reload → verify
  - [ ] Test localStorage quota exceeded
- **Estimated time**: 1 hour
- **Pillar concerns**: Q (Idempotency)

## Technical Decisions
- Redux: Centralized state management, good tooling
- localStorage: Simple persistence, sufficient for shopping cart
- Middleware: Clean way to handle side effects (persistence)

## Risk Assessment
- Low risk: Redux is standard pattern
- Medium risk: localStorage might fill up (handled in tests)
- Mitigation: All steps have tests

## Deployment Notes
- No breaking changes to existing Cart API
- localStorage migration: Old carts lost (acceptable for v1)
```

---

## 🧪 Step 3: Create Test Cases

**Duration**: 30-45 minutes

Create `.claude/[feature-name]-TEST-CASES.md`:

```markdown
# Feature: [Name] - Test Cases

## Test Case Format
```
TC-N.M: [Title]
├─ Given: [Initial state]
├─ When: [User action or trigger]
└─ Then: [Expected result with checkboxes]
```
```

**Example:**
```markdown
# Feature: Shopping Cart State - Test Cases

## Step 1: Redux Slice Tests

### TC-1.1: Add item to empty cart
- Given: Cart is empty []
- When: dispatch addItem({id: "coffee", name: "Coffee", price: 5, qty: 2})
- Then:
  - [ ] Redux state contains 1 item
  - [ ] Item has: id="coffee", qty=2, price=5
  - [ ] Cart total = 10 (price × qty)

### TC-1.2: Add duplicate item (same ID)
- Given: Cart has [{id: "coffee", qty: 2}]
- When: dispatch addItem({id: "coffee", qty: 1})
- Then:
  - [ ] Cart still has 1 item (not 2)
  - [ ] Item qty updated to 3
  - [ ] No duplicates created

### TC-1.3: Remove item
- Given: Cart has [{id: "coffee", qty: 2}, {id: "tea", qty: 1}]
- When: dispatch removeItem("coffee")
- Then:
  - [ ] Coffee removed from state
  - [ ] Tea remains in cart
  - [ ] Cart length = 1

### TC-1.4: Update quantity
- Given: Cart has [{id: "coffee", qty: 2}]
- When: dispatch updateQuantity({id: "coffee", qty: 5})
- Then:
  - [ ] Quantity updated to 5
  - [ ] Item still in cart
  - [ ] No duplicates

## Step 2: localStorage Persistence Tests

### TC-2.1: Cart saves to localStorage on add
- Given: Cart is empty
- When: dispatch addItem({id: "coffee", qty: 2})
- Then:
  - [ ] localStorage["cart"] contains the item
  - [ ] Data is JSON stringified
  - [ ] Can be parsed back to object

### TC-2.2: Cart loads from localStorage on app init
- Given: localStorage has {"cart": "[{id: \"coffee\", qty: 2}]"}
- When: App initializes and cart middleware loads
- Then:
  - [ ] Redux state populated from localStorage
  - [ ] Cart shows 1 item with qty=2
  - [ ] No errors in console

### TC-2.3: Corrupted localStorage handled gracefully
- Given: localStorage["cart"] = "invalid json"
- When: App initializes
- Then:
  - [ ] No crash
  - [ ] Cart starts empty
  - [ ] Error logged to console

## Step 3: Integration Tests

### TC-3.1: Add → Persist → Reload → Verify
- Given: App running, localStorage empty
- When: 
  1. Add Coffee (qty: 2)
  2. Add Tea (qty: 1)
  3. Reload page
- Then:
  - [ ] After reload, cart has 2 items
  - [ ] Coffee qty still 2
  - [ ] Tea qty still 1
  - [ ] No data loss

### TC-3.2: Remove → Persist → Reload → Verify
- Given: Cart has Coffee and Tea
- When:
  1. Remove Coffee
  2. Reload page
- Then:
  - [ ] After reload, only Tea in cart
  - [ ] Coffee gone
  - [ ] localStorage updated

## Coverage Matrix

| Acceptance Criterion | Test Cases | Status |
|-------------------|-----------|--------|
| Add item with qty | TC-1.1, TC-2.1 | ✅ |
| Prevent duplicates | TC-1.2 | ✅ |
| Remove item | TC-1.3, TC-3.2 | ✅ |
| Update quantity | TC-1.4 | ✅ |
| Persist to storage | TC-2.1, TC-3.1 | ✅ |
| Load from storage | TC-2.2, TC-3.1 | ✅ |
| Handle errors | TC-2.3 | ✅ |

**Coverage**: 9 test cases covering all acceptance criteria (100%)
**Estimated testing time**: 1 hour manual + automated
```

---

## 📌 Step 4: Add Plan to GitHub Issue

**Duration**: 15 minutes

In the GitHub Issue for this feature, add a comment:

```bash
gh issue comment <n> -b "## 🔧 Development Plan

[Copy content from .claude/[feature]-PLAN.md here]

## 🧪 Test Cases

[Copy content from .claude/[feature]-TEST-CASES.md here]

## Development Checklist
- [ ] All steps completed
- [ ] All tests passing
- [ ] Code reviewed
- [ ] Ready to close issue"
```

---

## 🏷️ Step 5: Apply Labels

**Duration**: 5 minutes

```bash
gh issue edit <n> --add-label \
  "status/planned,tier/t2,pillar/f,pillar/l,priority/must"
```

**Labels to apply:**
- `status/planned` - Plan complete, ready to develop
- `tier/t1|t2|t3` - Complexity tier (t1=simple, t3=complex)
- `pillar/*` - Relevant AI_DEV_PROT pillars
- `priority/must|should|could` - Business priority

---

## ✅ Success Criteria

✅ **Feature-Level Planning is complete when:**

- [ ] Requirements validated against docs
- [ ] Development plan created with all steps detailed
- [ ] Test cases created covering all acceptance criteria
- [ ] Coverage matrix shows 100% coverage
- [ ] Plan added to GitHub Issue comment
- [ ] All relevant labels applied
- [ ] Team reviewed and approved
- [ ] Ready to `*issue pick` and develop

**Typical timeline**: 1-2 hours for a feature

---

## 🚀 Next Phase

When planning is complete and approved:

```bash
# Start development
*issue pick <n>

# Execute Phase 1-4 (see workflow/development.md)
*tier            # Classify complexity
*next            # Begin Phase 1 (Pre-Code)
*next            # Continue to Phase 2 (In-Code)
*next            # Continue to Phase 3 (Tests)
*review          # Phase 4 (Post-Code review)
*issue close <n> # Done
```

---

## 💡 Example Timeline

```
Day 1: 9:00 AM - MVP-Level Decomposition
       (40 minutes)
       ✅ Issue #100 created (rough: 8h)

Day 5: 9:00 AM - Feature-Level Planning for #100
       (1.5 hours)
       └─ 9:00-9:15   Validate docs
       └─ 9:15-9:45   Create PLAN.md
       └─ 9:45-10:15  Create TEST-CASES.md
       └─ 10:15-10:30 Add to Issue + labels
       ✅ Issue #100 ready to develop

       10:30 AM - Start Development
       └─ *issue pick 100
       └─ *tier
       └─ *next → Execute steps

Day 7: 5:00 PM - Feature #100 Complete
       └─ *issue close 100
       ✅ Issue #100 done

Day 8: 9:00 AM - Feature-Level Planning for #101
       (1.5 hours, based on learnings from #100)
       └─ Can adjust plan based on what you learned
```

---

## 🔗 See Also

- **MVP-Level Decomposition**: `planning-mvp.md` (start here for new MVP)
- **Full Planning Reference**: `planning-reference.md` (complete Steps 0-8)
- **Development Execution**: `workflow/development.md`
- **Architecture**: `workflow/architecture.md`
