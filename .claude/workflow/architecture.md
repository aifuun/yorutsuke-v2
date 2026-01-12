# Workflow Architecture - MVP → Issues → TODO

> Master index explaining how feature planning and development workflow connects three layers

---

## 📋 Quick Navigation

### 🟢 New to the workflow?

→ **Read [`architecture-core.md`](architecture-core.md)**

- Understand the three-layer hierarchy (MVP → Issues → TODO)
- Learn what information lives in each layer
- See how phases connect: Phase B (planning) → GitHub Issues, Phase C (dev) → plans/active/
- Grasp the `*next` command flow

### 🟡 Want a detailed example?

→ **See [`architecture-examples.md`](architecture-examples.md)** (coming soon)

- Complete Shopping Cart feature walkthrough
- From MVP file → Planning → GitHub Issue → Development
- Real code examples and output samples

---

## 🎯 Three Layers Explained in 30 Seconds

```
MVP File (Strategic)
├─ WHAT: Business goals + acceptance criteria
├─ WHEN: Release planning (1-4 weeks)
└─ EXAMPLE: "MVP3 - Process batched results"

GitHub Issues (Tactical)
├─ WHAT: Detailed technical plan + test cases
├─ WHEN: Feature planning (1-7 days)
└─ EXAMPLE: "#99 batch-result-handler" with Dev Plan comment

plans/active/ (Operational)
├─ WHAT: Today's work + progress tracking
├─ WHEN: Coding session (same day)
└─ EXAMPLE: "- [ ] #99 Step 1: Fix timestamp bug"
```

---

## 📐 Data Flow

```
MVP (strategic)
   ↓
Phase B: Planning Workflow
   ↓ (creates/uses)
GitHub Issues (tactical)
   ↓ (loads from)
*issue pick
   ↓ (populates)
plans/active/ (operational)
   ↓ (executes)
*next (Phase 1-4)
   ↓ (completes)
*issue close
   ↓ (marks in)
MVP (acceptance criteria checked)
```

---

## 📂 Detailed Breakdown

### Layer 1: MVP 文件 (docs/dev/MVP*.md)

**Lifecycle**: Release planning (1-4 weeks)  
**Updates**: Per release version  
**Owner**: Tech Lead / Product  

**Contains**:
- Business goal (1-2 sentences)
- Acceptance criteria (checkboxes)
- Related GitHub issues (links)
- Environment config (if special setup needed)

**Does NOT contain**:
- Code implementation details
- Test scenarios (those go in GitHub Issues)
- Session-specific progress

---

### Layer 2: GitHub Issues (GitHub)

**Lifecycle**: Feature planning/development (1-7 days)  
**Updates**: When planning or working  
**Owner**: Tech Lead / AI  

**Contains** (in comments):
- Development plan (from `workflow/planning.md` Step 4)
- Test cases (from `workflow/planning.md` Step 7)
- Labels (tier/t1, pillar/a, status/planned)
- Discussion and implementation progress

**Workflow connection**:
- Created in `workflow/planning.md` Step 2
- Plan added in Step 6
- Test cases added in Step 7
- Loaded by `*issue pick` in Phase C

---

### Layer 3: plans/active/ (.claude/plans/active/)

**Lifecycle**: Coding session (same day)  
**Updates**: Per session  
**Owner**: AI  

**Contains**:
- Current issue(s) being worked on
- Subtasks checklist (from dev plan)
- Progress tracking (checked items)
- Next recommended issues

**Workflow connection**:
- Created by `*issue pick #N`
- Updated by `*next` (each step)
- Cleared by `*issue close #N`

---

## 🚀 How It Works in Practice

### Example: Shopping Cart Feature

**1. MVP File** (docs/dev/MVP2_CART.md)
```markdown
# MVP2 - Shopping Cart

Goal: Enable users to add/remove items from cart with persistence

Acceptance Criteria:
- [ ] User can add item with quantity
- [ ] User can remove item
- [ ] Cart count displays
- [ ] Cart persists

Related Issues:
- #42 (Cart state)
- #43 (Cart UI)
```

**2. GitHub Issue** (#42, created in Planning Step 2)
```
Title: Feature: Shopping cart state management

Description:
Goal: Implement Redux slice for cart state
Acceptance Criteria:
- [ ] addItem action
- [ ] removeItem action
- [ ] Selectors for cart items

Comments:
## Development Plan
[Copied from .claude/shopping-cart-PLAN.md]
- Step 1: Redux slice (2h)
- Step 2: UI components (3h)
- Step 3: Integration (1h)

## Test Cases
[Copied from .claude/shopping-cart-TEST-CASES.md]
- TC-1.1: Add item to empty cart
- TC-1.2: Duplicate item increments qty
- ...

Labels: status/planned, tier/t2, pillar/l
```

**3. plans/active/** (when you `*issue pick 42`)
```markdown
## Current Session [2026-01-09]

### Active Issues
- [ ] #42 Cart state management
  - [ ] Step 1: Implement addItem action
  - [ ] Step 2: Implement removeItem action
  - [ ] Step 3: Create selectors
  - [ ] Step 4: Write unit tests

### Next Up
- [ ] #43 Cart UI components (depends on #42)
```

**4. Development** (when you `*next`)
```
Execute Step 1: Implement addItem action
- File: src/redux/cart.slice.ts
- Subtasks: [from dev plan]
[coding...]
Mark: [x] Step 1 complete
*next → Step 2
...
*issue close 42
→ Checks off acceptance criteria in MVP2
```

---

## 🔗 Phase Integration

### Phase A: Documentation (docs/)
↓ (informs)

### Phase B: Planning (workflow/planning.md)
- Step 0: Check MVP and docs
- Step 1-3: Analyze, open issues, decompose
- Step 4-8: Create plan, evaluate, confirm, test cases
↓ (creates)

### Phase C: Development (workflow/development.md)
- `*issue pick #N` → Load GitHub Issue + Plan + Tests
- `*next` → Execute plan steps
- `*issue close #N` → Close issue + update MVP
↓ (updates)

### Phase D: Release (workflow/release.md)
- Check all MVP acceptance criteria
- Version and publish

---

## ⚡ Quick Reference: What Goes Where?

| Question | Answer | Location |
|----------|--------|----------|
| "What's the feature goal?" | MVP goal statement | `docs/dev/MVP*.md` |
| "How do I implement it?" | Dev plan with steps | GitHub Issue comment |
| "What tests do I write?" | Test cases | GitHub Issue comment |
| "What should I do next?" | Next sub-task | `plans/active/` |
| "Is it done?" | Acceptance criteria | MVP file (checkboxes) |
| "How do I start coding?" | `*issue pick <n>` | Terminal command |

---

## 🎓 Learning Path

**To understand the architecture:**

1. **Read** `architecture-core.md` (this deep dive)
2. **Understand** the three layers and their lifecycle
3. **Connect** Phase B (planning) → Phase C (development)
4. **See** `architecture-examples.md` for complete walkthrough (coming)
5. **Practice** with `workflow/planning.md` and `workflow/development.md`

---

## ✅ Success Criteria

✅ **You understand the architecture when:**

- [ ] You can name the three layers (MVP, Issues, TODO)
- [ ] You know what lifecycle each layer has
- [ ] You understand Phase B creates Issues from MVP
- [ ] You understand Phase C executes Issues via plans/active/
- [ ] You know when to check each layer
- [ ] You understand how `*next` navigates between them

---

## 📚 See Also

- **Phase B (Planning)**: `workflow/planning.md`
- **Phase C (Development)**: `workflow/development.md`
- **Phase D (Release)**: `workflow/release.md`
- **Quick Reference**: `workflow/quick-reference.md`
