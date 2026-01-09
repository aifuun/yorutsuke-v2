# Phase B: Planning - Two-Step Workflow

> Feature-driven development: Fast MVP decomposition followed by detailed feature planning

---

## 🎯 Core Philosophy

**Feature is the unit of work**  
Each feature = 1 GitHub Issue = 1 development cycle

**Two planning steps**:
1. **MVP-Level** (40 min): Understand features in the release
2. **Feature-Level** (1-2h): Prepare a feature for development

---

## 🚀 Quick Start

### Step 1: Planning an MVP Release

**When**: Starting MVP v1.0, MVP3.0, etc.  
**Duration**: 40 minutes  
**Output**: GitHub Issues + dependency graph  

→ Go to **[`planning-mvp.md`](planning-mvp.md)**

```
MVP x.0 (5-8 features)
  ↓
Decompose into Features (10 min)
  ↓
Identify dependencies (15 min)
  ↓
Create GitHub Issues (15 min)
  ↓
Ready to prioritize work
```

---

### Step 2: Planning a Feature for Development

**When**: About to start developing a specific feature  
**Duration**: 1-2 hours  
**Output**: Dev Plan + Test Cases (in GitHub Issue)  

→ Go to **[`planning-feature.md`](planning-feature.md)**

```
Feature #N selected from backlog
  ↓
Validate requirements (15 min)
  ↓
Create detailed implementation plan (45 min)
  ↓
Create test cases with coverage (45 min)
  ↓
Add to GitHub Issue + labels
  ↓
Ready to *issue pick and develop
```

---

## 📊 Timeline Example

```
Day 1: MVP3.0 Planning (40 min)
├─ Identify 8 features
├─ Map dependencies
└─ Create Issues #100-#107

Day 3: Ready to start Feature #100
├─ Feature-Level Planning (1-2h)
├─ Create PLAN + TEST-CASES
└─ Ready to develop

Day 5: Feature #100 complete
├─ Pick Feature #101
├─ Feature-Level Planning (1-2h, informed by #100)
└─ Ready to develop
```

**Key insight**: Feature plans made WHEN you're ready to develop, not all upfront.

---

## 🔄 Why Two Steps?

### Problem with One-Step Planning

**All-at-once approach**:
```
MVP3.0 (8 features)
  ↓
Plan all 8 features upfront
├─ Total time: 20-40 hours
├─ Risk: Plans get outdated
├─ Inflexible: Can't adjust based on learnings
└─ Waterfall-like: Do all planning, then coding
```

### Benefits of Two-Step Approach

**Separated concerns**:
```
MVP-Level (40 min)
├─ Fast: Just understand what exists
├─ Flexible: Can adjust Feature priorities later
└─ Output: Roadmap + dependency graph

Feature-Level (1-2h per feature)
├─ Deep: Detailed implementation plan
├─ Timely: Made right before development
├─ Adaptive: Can adjust based on learnings from previous features
└─ Output: Ready-to-code Issue
```

---

## 📋 Step Comparison

| Aspect | MVP-Level | Feature-Level |
|--------|-----------|---------------|
| **When** | Per release start | Before developing a feature |
| **Who** | Tech Lead / Product | Dev + Tech Lead |
| **Duration** | 40 min | 1-2 hours |
| **Input** | MVP goal + docs | Feature request + docs |
| **Output** | GitHub Issues (minimal) | Dev Plan + Test Cases |
| **Details** | Rough sizes, dependencies | Detailed steps, files, tests |
| **Changes** | Can adjust later | Finalizes before coding |

---

## 🎯 MVP-Level: What You Get

**After 40 minutes:**
- ✅ All features identified
- ✅ Rough sizes estimated (8h, 16h, etc.)
- ✅ Dependencies mapped
- ✅ GitHub Issues created (with minimal info)
- ✅ Development order clear
- ✅ MVP timeline understood

**Example output**:
```
MVP3.0 Features (30 hours total)

Feature-A: Cart state (8h)
Feature-B: Cart UI (6h, depends on A)
Feature-C: Persistence (3h, depends on A)
Feature-D: Checkout (12h, depends on A+B)
Feature-E: Confirmation (4h, depends on D)

Development path:
Start A (8h)
→ After A, start B (6h) + C (3h) in parallel
→ After B, start D (12h)
→ After D, start E (4h)
```

**GitHub Issues created:**
```
#100: Feature: Cart state (rough: 8h)
#101: Feature: Cart UI (rough: 6h, blocked by #100)
#102: Feature: Persistence (rough: 3h, blocked by #100)
#103: Feature: Checkout (rough: 12h, blocked by #100, #101)
#104: Feature: Confirmation (rough: 4h, blocked by #103)
```

---

## 🔨 Feature-Level: What You Get

**After 1-2 hours:**
- ✅ Requirements validated against docs
- ✅ Detailed implementation steps (files, subtasks, time)
- ✅ Test cases covering all acceptance criteria
- ✅ Pillar concerns identified
- ✅ Risk assessment done
- ✅ Ready to develop

**Example output**:
```
Feature #100: Cart State - Development Plan

Step 1: Redux slice (2h)
- Files: src/redux/cart.slice.ts
- Add actions, selectors
- Unit tests

Step 2: localStorage (1h)
- Files: src/middleware/cartPersistence.ts
- Middleware for persistence
- Integration tests

Step 3: Tests (1h)
- Full test coverage
- Manual QA

Total: 8 hours ✅ (matches MVP estimate)
```

**GitHub Issue enriched:**
```
Issue #100 now has:
- Development Plan (from Step 1)
- Test Cases (from Step 2)
- Labels: status/planned, tier/t2, pillar/f, pillar/l
- Status: Ready to develop
```

---

## 🔗 Decision Tree

```
You have a new MVP to develop?
  ↓
  YES → Go to planning-mvp.md
        Do MVP-Level Decomposition (40 min)
        Create GitHub Issues
  ↓
You're ready to start developing a feature?
  ↓
  YES → Go to planning-feature.md
        Do Feature-Level Planning (1-2h)
        *issue pick and code
  ↓
Want to understand all 8 steps in detail?
  ↓
  YES → See planning-reference.md
        Complete Steps 0-8 with examples
```

---

## 📂 File Structure

```
workflow/
├── planning.md (this file)
│   └─ Index with two-step overview
│
├── planning-mvp.md
│   └─ MVP-Level Decomposition (40 min, Steps 0-3 Lite)
│
├── planning-feature.md
│   └─ Feature-Level Planning (1-2h, Steps 4-8)
│
└── planning-reference.md
    └─ Complete Steps 0-8 with all details
```

---

## ⚡ Quick Commands

```bash
# MVP-Level Planning
# (When starting new MVP release)
gh issue list                        # See all issues
gh issue create --title "Feature: X" # Create issue

# Feature-Level Planning  
# (When ready to develop a feature)
gh issue edit <n> --add-label "status/planned"
gh issue comment <n> -b "## Development Plan\n..."

# Development
*issue pick <n>          # Start developing
*tier                    # Classify complexity
*next                    # Execute steps
*issue close <n>         # Complete
```

---

## ✅ Success Criteria

**MVP-Level Planning complete:**
- [ ] All features identified and sized
- [ ] Dependencies mapped
- [ ] GitHub Issues created (5-10 issues typical)
- [ ] Team understands MVP scope
- [ ] Ready to pick features for development

**Feature-Level Planning complete:**
- [ ] Development plan with detailed steps
- [ ] Test cases with 100% coverage
- [ ] All labels applied
- [ ] Issue approved by team
- [ ] Ready to `*issue pick` and code

---

## 📚 See Also

- **MVP-Level Guide**: `planning-mvp.md`
- **Feature-Level Guide**: `planning-feature.md`
- **Complete Reference**: `planning-reference.md`
- **Architecture**: `workflow/architecture.md`
- **Development**: `workflow/development.md`
