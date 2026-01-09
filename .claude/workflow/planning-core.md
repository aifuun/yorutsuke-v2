# Phase B: Planning - Core Steps 0-3

> Quick overview of requirement analysis, issue creation, and feature decomposition

## When to Use

- Breaking down large features
- Creating new GitHub issues  
- Understanding feature boundaries
- Getting started with planning workflow

---

## Workflow Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│        FEATURE DEVELOPMENT - PLANNING PHASE OVERVIEW                 │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  Step 0         Step 1           Step 2            Step 3            │
│  ┌────────┐    ┌────────┐      ┌────────┐        ┌────────┐         │
│  │  DOCS  │ → │ANALYZE │  →   │ ISSUES │   →    │DECOMPOSE        │
│  └────────┘    └────────┘      └────────┘        └────────┘         │
│     ▼              ▼               ▼                 ▼               │
│  Check ready   Requirements    Check exists    Break down           │
│                Analysis        or create       Identify sub-tasks   │
│                Scope                          Define dependencies   │
│                                                                       │
│         → Step 4-8: Planning, Evaluation, Confirmation, Tests      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Step 0: Check Documentation (Prerequisite)

Before planning, verify `docs/` is ready:

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

**Example:**
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

Mark dependencies in issue body:
```markdown
## Dependencies
- Blocked by #123 (schema changes)
- Requires: API endpoint `/users`
```

### Example: Shopping Cart Breakdown

**Original request**: "Implement complete shopping cart"

**Decomposition by Layer + Flow:**

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

**Order dependencies:**
- #1, #2: Docs first (Phase A)
- #3: Depends on #2 (IPC schema)
- #4-#7: Can run in parallel after #3
- #8, #9: After core complete

---

## Next: Steps 4-8

After decomposition is complete, continue with:

- **Step 4**: Create detailed development plan (see `workflow/planning-detailed.md`)
- **Step 5**: Evaluate and refine the plan
- **Step 6**: Confirm plan in GitHub issue
- **Step 7**: Create test cases
- **Step 8**: Assess complexity and prioritize

→ See `planning-detailed.md` for detailed guidance on Steps 4-8

---

## Quick Commands Reference

```bash
# Workflow commands
gh issue list --search "feature-name"      # Find existing issue
gh issue create --title "Feature: X"       # Create new issue
gh issue comment <n> -b "Plan..."          # Add plan to issue
gh issue edit <n> --add-label "label"      # Apply labels

# Next steps
# When Steps 0-3 are complete:
*plan [feature-name]   # Start detailed planning (Steps 4-8)
```

---

## Quick Start: Steps 0-3

```bash
# 1. Check documentation ready
# (Manual review of docs/)

# 2. Analyze requirements
# Create 1 sentence goal + boundaries

# 3. Search for existing issue
gh issue list --search "feature-name"

# 4. Create issue (if needed)
gh issue create --title "Feature: X" --body "..."

# 5. Decompose feature
# Identify 3-5 sub-issues
# Map dependencies
# Size each task (1-3 days work)

# 6. Continue to Step 4
# → See workflow/planning-detailed.md
```

---

## Success Criteria for Steps 0-3

✅ **Steps 0-3 complete when:**

- [ ] Documentation reviewed and ready
- [ ] Feature goal clear and boundaries defined
- [ ] GitHub issue #N created with acceptance criteria
- [ ] Feature decomposed into 3-5 sub-issues
- [ ] Dependencies identified and ordered
- [ ] Each sub-issue sized (1-3 days work)
- [ ] Ready for detailed planning (Step 4)

✅ **Next** → Continue to `planning-detailed.md` for Steps 4-8

