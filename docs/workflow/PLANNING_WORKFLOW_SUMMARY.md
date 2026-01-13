# Planning Workflow Summary

> Overview of the two-step planning system: MVP decomposition → Feature implementation

**Last Updated**: 2026-01-13
**Implements**: Issue #140 (Architecture review + Function contracts)

---

## 📂 File Structure

```
.claude/
├── commands/
│   └── plan.md                    ← Command reference (what to do)
└── workflow/
    ├── planning-mvp.md            ← MVP planning guide (how to decompose)
    └── planning-feature.md        ← Feature planning guide (how to implement)
```

---

## 🎯 Two-Step Planning Approach

### Step 1: MVP Planning → Strategic (40 min)
**Command**: `*plan mvp`
**Input**: `docs/dev/MVP*.md` (business goals)
**Output**: 5-8 GitHub Issues with rough estimates
**Purpose**: Understand **WHAT** features to build

### Step 2: Feature Planning → Tactical (1.5-2h)
**Command**: `*plan #<issue-number>`
**Input**: GitHub Issue (feature requirement)
**Output**: Detailed dev plan + function contracts + test cases
**Purpose**: Understand **HOW** to implement the feature

---

## 📋 plan.md - Command Reference

**File**: `.claude/commands/plan.md` (156 lines)
**Role**: Quick reference for AI and humans

### Content Overview

#### 1. Command Syntax
```bash
*plan                  # Show menu
*plan mvp              # MVP decomposition
*plan #<n>             # Feature planning
*plan <description>    # Quick plan
```

#### 2. MVP Planning (`*plan mvp`)
```
Step 1: MVP Decomposition (40 min)
├─ Identify current MVP from docs/dev/MVP*.md
├─ Load template: TEMPLATE-mvp.md
├─ Follow guide: planning-mvp.md
└─ Output: GitHub Issues + dependency graph

Workflow:
Analyze MVP goal → Identify features → Map dependencies → Create Issues
```

#### 3. Feature Planning (`*plan #<n>`)
```
Feature Planning (1.5-2h)

Workflow:
Architecture review → Function contracts → Validate requirements → Dev plan → Ready to code

Phase 1: Architecture Preparation (45 min)
├─ Step 0: Review Architecture Context (15 min)
│   ├─ Read relevant ADRs from docs/architecture/ADR/
│   ├─ Identify applicable Pillars from .prot/
│   ├─ Check architecture patterns
│   └─ Output: Architecture Context section
│
└─ Step 1: Define Key Functions (30 min)
    ├─ Define function signatures with contracts
    ├─ Write unit test specifications (TDD)
    ├─ Output: Key Functions section
    └─ Details: See planning-feature.md for examples

Phase 2: Detailed Planning (45 min)
└─ Steps 2-7: Follow planning-feature.md
    ├─ View issue, check complexity
    ├─ Load template, create plan
    ├─ Save to .claude/plans/active/#<n>-name.md
    └─ Update GitHub Issue with plan link
```

#### 4. Quick Plan (`*plan <description>`)
- For simple tasks
- 7-step workflow inline
- No separate guide needed

---

## 📘 planning-feature.md - Detailed Execution Guide

**File**: `.claude/workflow/planning-feature.md` (572 lines)
**Role**: Step-by-step instructions for AI

### Content Overview

#### Introduction
- When to use feature planning
- Why feature-level planning matters
- Workflow integration diagram

#### Phase 1: Architecture Preparation (45 min)

**Step 0: Review Architecture Context** (15 min)
```
What to Review:
1. ADRs from docs/architecture/ADR/
   - Data fetching → ADR-001 (Service Pattern)
   - State management → ADR-006 (Mock DB), ADR-007 (Cloud Sync)
   - UI components → ADR-008 (Component Library)

2. Pillars from .prot/
   - T1: Pillar A, B, L (Types, Validation, Headless)
   - T2: Add Pillar D, E (FSM, Orchestration)
   - T3: Add Pillar F, M, Q (Concurrency, Saga, Idempotency)

3. Architecture patterns from docs/architecture/
   - PATTERNS.md (Service, Adapter patterns)
   - LAYERS.md (00_kernel, 01_domains, 02_modules)
   - SCHEMA.md (Data model constraints)

Output Format:
## Architecture Context

### Relevant ADRs
- [ADR-001: Service Pattern] - Apply service + hook pattern
- [ADR-006: Mock DB] - Mock data in development mode

### Applicable Pillars
- [x] Pillar A: Nominal Types - Use branded types for IDs
- [x] Pillar B: Airlock - Validate with Zod
- [x] Pillar L: Headless - Separate UI from logic

### Architecture Patterns
- Service Pattern: Create statsService with Zustand
- Adapter Pattern: Wrap API calls in transactionApi.ts
```

**Step 1: Define Key Functions + Unit Tests** (30 min)
```typescript
What to Define:
1. Function signature (name, params, return type)
2. Pre-conditions (what must be true before calling)
3. Post-conditions (what will be true after execution)
4. Side effects (mutations, I/O, events)
5. Unit tests (happy path, edge cases, errors)

Example:
// Function contract
function calculateDailyStats(
  transactions: Transaction[],  // Branded type
  date: Date                     // Local timezone
): DailyStats {
  // Returns: { income: number, expense: number, net: number }
  // Pre: transactions may be empty, date is valid Date object
  // Post: All amounts in cents (integer), net = income - expense
  // Side effects: None (pure function)
}

// Unit tests (executable specification)
describe('calculateDailyStats', () => {
  it('should calculate stats for mixed transactions', () => {
    // Test implementation
  });

  it('should return zeros for empty transactions', () => {
    // Test implementation
  });

  it('should filter by date correctly', () => {
    // Test implementation
  });

  it('should throw on invalid date', () => {
    // Test implementation
  });
});

Output Format:
## Key Functions

### calculateDailyStats
- **Signature**: `(transactions: Transaction[], date: Date) => DailyStats`
- **Pre**: transactions may be empty, date must be valid
- **Post**: All amounts are integers (cents), net = income - expense
- **Side effects**: None (pure function)
- **Tests**: 4 test cases (mixed, empty, filter, error)
```

#### Phase 2: Detailed Planning (45 min)

**Step 2: Validate Requirements** (15 min)
- Check REQUIREMENTS.md has user story
- Check ARCHITECTURE.md defines boundaries
- Check SCHEMA.md lists entities
- Check DESIGN.md has UI specs

**Step 3: Create Development Plan** (30-45 min)
- Create `.claude/[feature-name]-PLAN.md`
- Implementation steps with files, subtasks, time estimates
- Technical decisions and rationale
- Risk assessment

**Step 4: Create Test Cases** (30-45 min)
- Create `.claude/[feature-name]-TEST-CASES.md`
- Test case format: Given/When/Then
- Coverage matrix (100% coverage required)

**Step 5: Add to GitHub Issue** (15 min)
- Comment with development plan
- Comment with test cases
- Add development checklist

**Step 6: Apply Labels** (5 min)
- status/planned
- tier/t1|t2|t3
- pillar/*
- priority/must|should|could

#### Success Criteria
```
✅ Feature-Level Planning complete when:
- [x] Architecture context reviewed (Step 0)
- [x] Key functions defined with test specs (Step 1)
- [x] Requirements validated (Step 2)
- [x] Development plan created (Step 3)
- [x] Test cases created (Step 4)
- [x] Coverage matrix shows 100%
- [x] Plan added to GitHub Issue (Step 5)
- [x] All labels applied (Step 6)
- [x] Ready to *issue pick and develop

Timeline: 1.5-2 hours (45 min architecture + 45 min planning)
```

---

## 🔄 Complete Workflow Example

### Day 1: MVP Planning (40 min)

```bash
$ *plan mvp

AI Workflow:
1. Reads: plan.md → "*plan mvp section"
2. Reads: planning-mvp.md → "Step 0-3"
3. Reads: docs/dev/MVP3.0.md → Business goals
4. Analyzes: Break down into 5-8 features
5. Creates: GitHub Issues #140-#147
6. Outputs: Dependency graph

Result:
✅ MVP3.0 decomposed into 8 features
✅ Issues created with rough estimates
✅ Ready to pick features for development
```

---

### Day 5: Feature Planning for Issue #140 (1.5-2h)

```bash
$ *plan #140

AI Workflow:

Phase 1: Architecture Preparation (45 min)
├─ Reads: plan.md → "Step 0 and Step 1"
├─ Reads: planning-feature.md → Detailed instructions
│
├─ Step 0: Architecture Context (15 min)
│   ├─ Reads: docs/architecture/ADR/001-service-pattern.md
│   ├─ Reads: .prot/pillar-l/headless.md
│   ├─ Identifies: Service Pattern + Pillar L + Pillar B
│   └─ Outputs: Architecture Context section
│
└─ Step 1: Define Functions (30 min)
    ├─ Defines: enhancePlanWorkflow() signature
    ├─ Writes: 4 unit test specifications
    └─ Outputs: Key Functions section

Phase 2: Detailed Planning (45 min)
├─ Step 2: Validates requirements in docs/
├─ Step 3: Creates detailed dev plan
├─ Step 4: Creates test cases
├─ Step 5: Adds plan to GitHub Issue #140
└─ Step 6: Applies labels (status/planned, tier/t2, pillar/l)

Result:
✅ Plan created: .claude/plans/active/#140-enhance-plan.md
✅ GitHub Issue #140 updated with plan
✅ Ready to *approve and start coding
```

---

### Day 5: Development Execution (8h)

```bash
$ *approve

AI Workflow:
1. Follows: .claude/plans/active/#140-enhance-plan.md
2. Implements: Step by step according to plan
3. Runs: Unit tests from Step 1 (all pass = feature complete)
4. Commits: Changes with reference to #140

Result:
✅ Feature #140 complete
✅ All tests passing
✅ Ready to close issue
```

---

## 🆕 What Changed in Issue #140

### Before (6 steps)
```
*plan #140
  ↓
1. View issue
2. Check complexity
3. Load template
4. Create dev plan          ← Started here directly
5. Save to file
6. Update GitHub
```

**Problem**: No architecture review, no function contracts upfront

### After (8 steps with Phase 1)
```
*plan #140
  ↓
Phase 1: Architecture Preparation
  0. Review Architecture Context    ← NEW (15 min)
     - Read ADRs, identify Pillars, check patterns

  1. Define Key Functions + Tests   ← NEW (30 min)
     - Function contracts with pre/post-conditions
     - Unit test specifications (TDD)

Phase 2: Detailed Planning
  2. Validate requirements           ← Was step 1
  3. Create dev plan                 ← Was step 2
  4. Create test cases               ← Was step 3
  5. Add to GitHub                   ← Was step 4
  6. Apply labels                    ← Was step 5
```

**Benefits**:
- ✅ Plans align with established architecture patterns
- ✅ Function contracts defined before implementation
- ✅ Tests serve as acceptance criteria
- ✅ Prevents scope creep and rework
- ✅ AI doesn't violate Pillar rules

---

## 📊 Time Breakdown

### MVP Planning (`*plan mvp`)
```
Total: 40 minutes

Step 0: Analyze MVP goal           5 min
Step 1: Identify features          10 min
Step 2: Decompose + dependencies   15 min
Step 3: Create GitHub Issues       10 min
```

### Feature Planning (`*plan #<n>`)
```
Total: 1.5-2 hours

Phase 1: Architecture Preparation  45 min
  ├─ Step 0: Architecture review   15 min
  └─ Step 1: Function contracts    30 min

Phase 2: Detailed Planning         45 min
  ├─ Step 2: Validate requirements 15 min
  ├─ Step 3: Create dev plan       30-45 min
  ├─ Step 4: Create test cases     30-45 min (parallel with Step 3)
  ├─ Step 5: Add to GitHub         15 min
  └─ Step 6: Apply labels          5 min
```

---

## 🎯 Key Principles

### Separation of Concerns
- **plan.md**: Brief reference (156 lines)
- **planning-feature.md**: Detailed guide (572 lines)
- Examples in guide, not in command file

### Two-Step Planning
- **MVP level**: Strategic (WHAT to build)
- **Feature level**: Tactical (HOW to build)
- Architecture review at feature level, not MVP level

### TDD Approach
- Define function contracts BEFORE implementation
- Write test specifications BEFORE coding
- Tests = acceptance criteria (all pass = feature done)

### Architecture-First
- Review ADRs before coding
- Identify Pillars based on tier
- Check patterns to follow
- Prevents rework and violations

---

## 🔗 Related Files

| File | Purpose |
|------|---------|
| `.claude/commands/plan.md` | Command reference |
| `.claude/workflow/planning-mvp.md` | MVP planning guide |
| `.claude/workflow/planning-feature.md` | Feature planning guide |
| `.claude/workflow/planning-reference.md` | Complete reference (all steps) |
| `docs/architecture/ADR/` | Architecture decisions |
| `.prot/` | AI_DEV_PROT v15 Pillars |
| `docs/architecture/PATTERNS.md` | Architecture patterns |

---

**Version**: 2.0 (with Issue #140 enhancements)
**Status**: ✅ Ready for use
