# Feature Development Workflow - Quick Guide

> Complete feature lifecycle from requirements to testing. For detailed guidance, see individual phase docs.

---

## 📋 Complete Lifecycle in One Page

```
┌──────────────────────────────────────────────────────────────────────┐
│                   FEATURE DEVELOPMENT LIFECYCLE                      │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  PHASE A: DOCS              PHASE B: PLANNING                        │
│  ┌──────────────┐          ┌─────────────────────────────────────┐  │
│  │ Update docs/ │          │ 0. Check Docs                       │  │
│  │ in docs/     │          │ 1. Analyze Requirements             │  │
│  └──────────────┘          │ 2. Open Issues (check/create)       │  │
│         │                  │ 3. Decompose Features               │  │
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

## 🟢 Phase A: Documentation (Prerequisite)

Update these before starting Phase B:
- REQUIREMENTS.md - User stories
- ARCHITECTURE.md - Module boundaries
- SCHEMA.md - Data entities
- DESIGN.md - UI screens/components

→ See `workflow/docs.md` for detailed guidance

---

## 🟡 Phase B: Planning (Steps 0-8)

**Duration**: 2-4 hours for typical feature  
**Output**: GitHub Issue #N + Dev Plan + Test Cases  
**See**: `workflow/planning.md` for complete guide

### Checklist

- [ ] **Step 0**: Check docs ready (REQUIREMENTS, ARCHITECTURE, SCHEMA, DESIGN)
- [ ] **Step 1**: Analyze requirements, define goal and boundaries
- [ ] **Step 2**: Create or find GitHub issue #N
- [ ] **Step 3**: Decompose feature into 3-5 sub-tasks (1-3 days each)
- [ ] **Step 4**: Create `.claude/[feature]-PLAN.md` with detailed implementation steps
- [ ] **Step 5**: Evaluate plan (clarity, feasibility, risk, optimization)
- [ ] **Step 6**: Add plan to GitHub issue comment + apply labels
- [ ] **Step 7**: Create `.claude/[feature]-TEST-CASES.md` with coverage matrix
- [ ] **Step 8**: Assess complexity and apply priority labels

**Output files:**
```
.claude/
├── [feature-name]-PLAN.md
│   └─ Implementation steps with files, subtasks, time estimates, Pillar concerns
│
└── [feature-name]-TEST-CASES.md
    └─ Test cases per step + coverage matrix
```

---

## 🔵 Phase C: Development (Execution)

**Duration**: 1-8 hours depending on tier  
**Output**: Code + tests + closed issue  
**See**: `workflow/development.md` for execution details

### Quick Start

```bash
# 1. Pick issue to start
*issue pick 42

# 2. Classify complexity (if needed)
*tier

# 3. Begin Phase 1-4 execution
*next
# - Phase 1: Pre-code checklist
# - Phase 2: Implement (follow dev plan steps)
# - Phase 3: Tests (run test cases)
# - Phase 4: Review (final audit)

# 4. Close issue
*issue close 42
```

### Four Development Phases

| Phase | What | Time |
|-------|------|------|
| **1: Pre-Code** | Setup, checklist, pillar review | 15 min |
| **2: In-Code** | Execute dev plan steps, follow templates | 2-6h |
| **3: Tests** | Run unit/integration tests, verify coverage | 30 min-2h |
| **4: Post-Code** | Review, audit, optimization, cleanup | 15-30 min |

---

## 🟣 Phase D: Release

**Duration**: 1-2 hours  
**Output**: Version tag + published release  
**See**: `workflow/release.md`

---

## 📂 Shopping Cart Example (Phases B & C)

### Phase B: Planning Output

**Issue #42: Feature: Shopping cart add/remove items**

**Dev Plan: 3 steps, 6 hours**
```
Step 1: Redux State (2h)
- Files: src/redux/cart.slice.ts
- Add slice, actions, selectors
- Pillar: L (Headless), F (Consistency)

Step 2: UI Components (3h)
- Files: src/components/CartIcon.tsx, CartDrawer.tsx
- Build UI, connect Redux
- Pillar: A (Composition), L (Headless)

Step 3: Persistence (1h)
- Files: src/middleware/cartPersistence.ts
- localStorage middleware
- Pillar: Q (Idempotency), R (Observability)
```

**Test Cases: 100% coverage**
```
TC-1.1: Add to empty cart → State shows 1 item
TC-1.2: Duplicate add → Qty updates to 3
TC-2.1: Cart badge shows count
TC-3.1: Persist & reload → Items restored
```

### Phase C: Development Execution

```bash
$ *issue pick 42
$ *next (Phase 1) → Setup
$ *next (Phase 2) → Implement Step 1 (Redux)
$ *next (Phase 2) → Implement Step 2 (UI)
$ *next (Phase 2) → Implement Step 3 (Persistence)
$ *next (Phase 3) → Run all tests
$ *review (Phase 4) → Final audit
$ *issue close 42 → Done
```

---

## ⚡ Command Reference

```bash
# Planning Phase
gh issue create --title "Feature: X"     # Create issue
gh issue comment <n> -b "Plan..."        # Add plan comment

# Development Phase
*issue pick <n>          # Start working
*tier                    # Classify complexity
*next                    # Show next steps
*review                  # Final review
*issue close <n>         # Complete issue
```

---

## ✅ Success Criteria

**Phase B Complete when:**
- Issue created with goal & acceptance criteria
- Dev plan with implementation steps
- Test cases with coverage matrix
- GitHub issue labeled + approved

**Phase C Complete when:**
- All dev plan steps executed
- All test cases passed
- Code reviewed
- Issue closed

---

## 📚 See Also

- **Phase A (Docs)**: `workflow/docs.md`
- **Phase B (Planning)**: `workflow/planning.md` (full guide)
- **Phase C (Development)**: `workflow/development.md` (full guide)
- **Phase D (Release)**: `workflow/release.md`
- **Architecture**: `workflow/architecture.md`
- **Quick Reference**: `workflow/quick-reference.md`

