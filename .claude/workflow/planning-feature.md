# Feature-Level Planning

> Detailed planning for a single feature before development. Creates implementation plan and test cases.

**Output**: Dev Plan + Function contracts + Test cases (in GitHub Issue comments)
**When**: Ready to start developing a feature
**Prerequisites**: MVP-Level Decomposition complete (see `planning-mvp.md`)

**New in v2**: Architecture review + Function contracts upfront (Issue #140)

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
Day 1: MVP-Level Decomposition
└─ Create Issues #100, #101, #102, etc.

Day 5: Ready to start Feature #100
└─ Do Feature-Level Planning
   └─ Create PLAN + TEST-CASES files
   └─ Add to GitHub Issue comment
   └─ Ready to *issue pick and code

Day 8: Ready to start Feature #101
└─ Do Feature-Level Planning
   └─ (Now you know how Feature #100 turned out)
   └─ Can adjust Feature #101 plan based on learnings
```

**Key difference**: Feature plans are made JUST before development, not all upfront.

---

## 🏗️ Phase 1: Architecture Preparation

### Step 0: Review Architecture Context

**Purpose**: Ensure implementation aligns with project architecture before writing code.

#### What to Review

1. **Read relevant ADRs** from `docs/architecture/ADR/`:
   - Data fetching? → ADR-001 (Service Pattern)
   - State management? → ADR-006 (Mock DB), ADR-007 (Cloud Sync)
   - UI components? → ADR-008 (Component Library)
   - Workflow? → ADR-009 (Branch-First), ADR-010 (Three-layer)

2. **Identify applicable Pillars** from `.prot/`:
   - **T1 tasks** → Pillar A (Nominal Types), Pillar B (Airlock), Pillar L (Headless)
   - **T2 tasks** → Add Pillar D (FSM), Pillar E (Orchestration)
   - **T3 tasks** → Add Pillar F (Concurrency), Pillar M (Saga), Pillar Q (Idempotency)

3. **Check architecture patterns** from `docs/architecture/`:
   - `PATTERNS.md` - Service Pattern, Adapter Pattern, etc.
   - `LAYERS.md` - 00_kernel, 01_domains, 02_modules structure
   - `SCHEMA.md` - Data model constraints

#### Output Format

Create "Architecture Context" section in your plan:

```markdown
## Architecture Context

### Relevant ADRs
- [ADR-001: Service Pattern](../docs/architecture/ADR/001-service-pattern.md)
  - Apply: Use service + hook pattern, not monolithic hooks
- [ADR-006: Mock DB](../docs/architecture/ADR/006-mock-db.md)
  - Apply: Mock data in development mode

### Applicable Pillars
- [x] Pillar A: Nominal Types - Use branded types for IDs
- [x] Pillar B: Airlock - Validate all API responses with Zod
- [x] Pillar L: Headless - Separate UI from logic
- [ ] Pillar D: FSM - Not needed (simple state)

### Architecture Patterns
- **Service Pattern**: Create `statsService` with Zustand vanilla store
- **Adapter Pattern**: Wrap API calls in `transactionApi.ts`
```

---

### Step 1: Define Key Functions + Unit Tests

**Purpose**: Define function contracts and test specifications BEFORE implementation (TDD).

#### What to Define

For each core function:
1. **Function signature**: Name, parameters with types, return type
2. **Pre-conditions**: What must be true before calling
3. **Post-conditions**: What will be true after successful execution
4. **Side effects**: Mutations, I/O operations, events emitted
5. **Unit tests**: Test cases covering happy path, edge cases, errors

#### Brief Example

```typescript
// Function contract
function calculateDailyStats(
  transactions: Transaction[],
  date: Date
): DailyStats {
  // Pre: transactions may be empty, date is valid
  // Post: All amounts in cents, net = income - expense
  // Side effects: None (pure function)
}

// Unit tests
describe('calculateDailyStats', () => {
  it('should calculate stats for mixed transactions', () => { /* ... */ });
  it('should return zeros for empty array', () => { /* ... */ });
  it('should filter by date', () => { /* ... */ });
  it('should throw on invalid date', () => { /* ... */ });
});
```

**Detailed example**: See `.claude/workflow/examples/function-contracts-example.md`

#### Output Format

Create "Key Functions" section in your plan:

```markdown
## Key Functions

### calculateDailyStats
- **Signature**: `(transactions: Transaction[], date: Date) => DailyStats`
- **Pre**: transactions may be empty, date must be valid
- **Post**: All amounts are integers (cents), net = income - expense
- **Side effects**: None (pure function)
- **Tests**: 4 test cases (mixed, empty, filter, error)

### loadTransactionsFromDB
- **Signature**: `(userId: UserId, date: Date) => Promise<Transaction[]>`
- **Pre**: userId is valid branded type, date is valid
- **Post**: Returns array (may be empty), all transactions validated with Zod
- **Side effects**: SQLite query
- **Tests**: 3 test cases (found, empty, error)
```

**Rationale**:
- Tests define behavior and serve as acceptance criteria
- All tests passing = feature complete
- Prevents scope creep (contract is clear)

---

## 🛠️ Phase 2: Detailed Planning

### Step 2: Validate Requirements Against Docs

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

## 🛠️ Step 3: Create Detailed Development Plan

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
- **Pillar concerns**: L (Headless - separate logic), F (Consistency)

### Step 2: [Module/Component Name]
- **Files affected**: [list]
- **Description**: [what this does]
- **Subtasks**: [checklist]
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

**Brief example**:
```markdown
# Feature: [Name] - Development Plan

## Overview
[1-2 sentence summary]

## Implementation Steps

### Step 1: [Component Name]
- **Files affected**: [list]
- **Description**: [what it does]
- **Subtasks**:
  - [ ] Subtask 1
  - [ ] Subtask 2
- **Pillar concerns**: [pillars]

### Step 2: [Component Name]
...

## Technical Decisions
- [Decision]: [Rationale]

## Risk Assessment
- [Risk level]: [Mitigation]

## Deployment Notes
- [Any breaking changes or migrations]
```

**Detailed example**: See `.claude/workflow/examples/dev-plan-example.md`

---

## 🧪 Step 4: Create Test Cases

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

**Brief example**:
```markdown
# Feature: [Name] - Test Cases

## Step N: [Component] Tests

### TC-N.1: [Test name]
- Given: [initial state]
- When: [action]
- Then:
  - [ ] Expected result 1
  - [ ] Expected result 2

### TC-N.2: [Test name]
- Given: [initial state]
- When: [action]
- Then:
  - [ ] Expected result

## Coverage Matrix

| Acceptance Criterion | Test Cases | Status |
|-------------------|-----------|--------|
| Criterion 1 | TC-1.1, TC-2.1 | ✅ |
| Criterion 2 | TC-1.2 | ✅ |

**Coverage**: N test cases covering all criteria (100%)
```

**Detailed example**: See `.claude/workflow/examples/test-cases-example.md`

---

## 📌 Step 5: Add Plan to GitHub Issue

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

## 🏷️ Step 6: Apply Labels

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

- [ ] Architecture context reviewed (Step 0)
- [ ] Key functions defined with test specs (Step 1)
- [ ] Requirements validated against docs (Step 2)
- [ ] Development plan created with all steps detailed (Step 3)
- [ ] Test cases created covering all acceptance criteria (Step 4)
- [ ] Coverage matrix shows 100% coverage
- [ ] Plan added to GitHub Issue comment (Step 5)
- [ ] All relevant labels applied (Step 6)
- [ ] Team reviewed and approved
- [ ] Ready to `*issue pick` and develop

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
Day 1: MVP-Level Decomposition
       ✅ Issue #100 created

Day 5: Feature-Level Planning for #100
       └─ Step 0: Architecture review (ADRs + Pillars)
       └─ Step 1: Define functions + tests
       └─ Step 2: Validate requirements
       └─ Step 3: Create PLAN.md
       └─ Step 4: Create TEST-CASES.md
       └─ Step 5: Add to Issue
       └─ Step 6: Apply labels
       ✅ Issue #100 ready to develop

       Start Development
       └─ *issue pick 100
       └─ *tier
       └─ *next → Execute steps

Day 7: Feature #100 Complete
       └─ *issue close 100
       ✅ Issue #100 done

Day 8: Feature-Level Planning for #101
       (Informed by learnings from #100)
       └─ Step 0-1: Architecture review + function contracts
       └─ Step 2-6: Requirements, plan, tests, Issue update
       └─ Can adjust approach based on what you learned
```

---

## 🔗 See Also

- **MVP-Level Decomposition**: `planning-mvp.md` (start here for new MVP)
- **Full Planning Reference**: `planning-reference.md` (complete Steps 0-8)
- **Development Execution**: `workflow/development.md`
- **Architecture**: `workflow/architecture.md`
