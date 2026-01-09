# Phase B: Planning - Complete Workflow

> Master index for all planning activities. Choose the section you need based on your current stage.

---

## 📋 Quick Navigation

### 🟢 Starting to plan a feature?

→ **Read [`planning-core.md`](planning-core.md)** (Steps 0-3)

- Check if documentation is ready
- Analyze requirements and create user stories
- Search for or create GitHub issue
- Decompose feature into sub-tasks
- Identify dependencies and timeline

### 🟡 Need to create a detailed development plan?

→ **Read [`planning-detailed.md`](planning-detailed.md)** (Steps 4-8)

- Define implementation steps with file changes
- Estimate effort per step
- Evaluate plan for feasibility and risk
- Add plan to GitHub issue comment
- Create test cases and coverage matrix
- Assess complexity and prioritization

### ⚡ Want a quick checklist?

→ **Jump to [Complete Checklist](#complete-checklist)** below

---

## 🎯 When to Use This Workflow

- Breaking down large features into manageable tasks
- Creating new GitHub issues for implementation
- Planning technical approach and identifying dependencies
- Determining complexity tier (T1/T2/T3)
- Creating test cases for validation
- Assessing feasibility before coding

---

## 🔄 Full Lifecycle Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│        FEATURE DEVELOPMENT - COMPLETE LIFECYCLE                      │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  Steps 0-3          Steps 4-8           Phase C                      │
│  (Core Planning)    (Detailed Planning)  (Development)               │
│                                                                       │
│  ┌──────────────┐   ┌──────────────┐   ┌────────────────┐           │
│  │ Check docs   │   │ Create plan  │   │ *issue pick    │           │
│  │ Analyze req  │   │ Evaluate     │───→ Execute steps  │           │
│  │ Open issues  │→→ │ Confirm      │   │ Write tests    │           │
│  │ Decompose    │   │ Test cases   │   │ *issue close   │           │
│  └──────────────┘   └──────────────┘   └────────────────┘           │
│                                                                       │
│     Ready to code? Continue to Phase C: Development                 │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 📁 Planning Documents

| Phase | File | Purpose | Size |
|-------|------|---------|------|
| **Core (0-3)** | `planning-core.md` | Quick overview, issue creation, decomposition | ~200 lines |
| **Detailed (4-8)** | `planning-detailed.md` | Deep guidance on plan, tests, prioritization | ~300 lines |
| **Quick Ref** | [Checklist below](#complete-checklist) | One-page checklist for quick reference | ~100 lines |

---

## Complete Checklist

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
  - [ ] Apply status label: `status/planned`
  - [ ] Apply tier label: `tier/t1`, `tier/t2`, or `tier/t3`
  - [ ] Apply pillar labels: `pillar/a`, `pillar/b`, etc.
  - [ ] Update issue description with plan summary

- [ ] **Step 7: Create Test Cases**
  - [ ] Create `.claude/[feature-name]-TEST-CASES.md`
  - [ ] Write test cases for each implementation step
  - [ ] Format: TC-1.1, TC-2.1, etc. with Given/When/Then
  - [ ] Create coverage matrix (criteria vs tests)
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
# 1. Pick issue to start working on
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

## ⚡ Quick Command Reference

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
```

---

## ✅ Success Criteria for Phase B

✅ **Phase B is complete when:**

- [ ] Issue #N exists with clear goal & acceptance criteria
- [ ] Development plan doc created with all steps detailed
- [ ] Plan review completed (clarity, feasibility, risk check)
- [ ] Plan added to issue comment with all labels
- [ ] Test cases created covering all acceptance criteria
- [ ] Issue labeled with status/planned, tier, and pillars
- [ ] Team has reviewed and approved plan
- [ ] Ready to begin Phase C: Development

---

## 📚 See Also

- **Phase A (Documentation)**: `workflow/docs.md`
- **Phase C (Development)**: `workflow/development.md`
- **Phase D (Release)**: `workflow/release.md`
- **Architecture**: `workflow/architecture.md`
- **Quick Reference**: `workflow/quick-reference.md`
