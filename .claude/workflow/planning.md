# Phase B: Planning

> Load when breaking down features or creating implementation plans

## When to Use

- Breaking down large features
- Creating new GitHub issues
- Planning implementation approach
- Identifying tier requirements (T1/T2/T3)

## Workflow

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

### 2. Issue Creation

For each sub-task:
```bash
gh issue create --title "Sub-task title" --body "..."
```

Issue template:
```markdown
## Goal
[What this accomplishes]

## Acceptance Criteria
- [ ] Criterion 1
- [ ] Criterion 2

## Notes
[Context, constraints, dependencies]
```

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

### 4. Complexity Assessment

Quick check - Does it involve:
- Data writes / mutations?
- State management (forms, wizards)?
- Critical operations (payment, sync)?

If YES → Note "Needs Tier classification" in issue

### 5. Prioritization

#### MoSCoW Framework

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

#### MVP Definition Process

**Step 1: Extract features from REQUIREMENTS.md**

Open `docs/REQUIREMENTS.md` and list all user stories:
```markdown
## Feature List (from REQUIREMENTS.md)
- [ ] US-001: User login
- [ ] US-002: Dashboard
- [ ] US-003: Data export
- [ ] US-004: Dark mode
- [ ] ...
```

**Step 2: Apply MoSCoW**
```markdown
## MVP Scope
### Must (Release blocker)
- [ ] User login
- [ ] Dashboard

### Should (Target for v1.0)
- [ ] Data export

### Could (If time permits)
- [ ] Dark mode

### Won't (v1.1+)
- [ ] ...
```

**Step 3: Validate MVP**
- [ ] Can user complete core workflow?
- [ ] Are all "Must" items achievable?
- [ ] Is scope testable in reasonable time?

#### Priority Labels

| Label | Use When | Example |
|-------|----------|---------|
| `priority/must` | Blocks release | Auth, core CRUD |
| `priority/should` | High value | Search, filters |
| `priority/could` | Enhancement | Animations, shortcuts |
| `priority/wont` | Deferred | Advanced analytics |
| `blocked` | Waiting on dependency | Needs API first |

#### Decision Matrix

For complex prioritization, score each feature:

| Feature | Value (1-5) | Effort (1-5) | Risk (1-5) | Score |
|---------|-------------|--------------|------------|-------|
| Login | 5 | 2 | 1 | **12** |
| Dashboard | 4 | 3 | 2 | **9** |
| Export | 3 | 2 | 1 | **8** |
| Dark mode | 2 | 2 | 1 | **5** |

**Score** = Value × 2 + (6 - Effort) + (6 - Risk)

Higher score = Higher priority

## Commands

| Command | Description |
|---------|-------------|
| `*issue new <title>` | Create issue |
| `*issue` | List issues |
| `*plan <desc>` | Create detailed plan |

## Outputs

- GitHub Issues created
- Labels applied
- Dependencies noted
