# Tauri/React/CDK Workflow

## Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      PROJECT WORKFLOW                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Session          Issue              Execution      Context  │
│  ───────          ─────              ─────────      ───────  │
│  *resume    →    *issue pick    →    Phase 1-4  →   *sync   │
│                       │                  │                   │
│                       ▼                  ▼                   │
│                   plans/active/           MEMORY.md                │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Session Management

| Command | Description |
|---------|-------------|
| `*status` | Quick overview (git, issues, progress) |
| `*resume` | Start session (pull, load context) |
| `*sync` | Save & sync (commit, push) |

### *resume Flow
1. Pull latest changes
2. Load `.claude/MEMORY.md` context
3. Load `.prot/CHEATSHEET.md`
4. Check `.claude/plans/active/` for pending tasks

### *sync Flow
1. Stage changes
2. Generate commit message
3. Push to remote
4. Update MEMORY.md if needed

---

## Issue Management

| Command | Description |
|---------|-------------|
| `*issue` | List open issues |
| `*issue <n>` | View issue details |
| `*issue pick <n>` | Start working on issue |
| `*issue close <n>` | Complete issue |
| `*issue new <title>` | Create new issue |

### *issue pick Flow

**Prerequisite**: Issue should have:
- ✅ Detailed development plan (from `workflow/planning.md` Step 4)
- ✅ Plan added to issue comment (Step 6)
- ✅ Test cases defined (Step 7)
- ✅ Status labeled as `status/planned`

**If issue is missing above, return to Phase B Planning first.**

1. View issue details
   ```bash
   *issue pick <n>
   ```
2. Load issue details including:
   - Acceptance criteria
   - Development plan comment
   - Test cases
3. **Quick assessment** - Does this task involve:
   - Data writes / mutations?
   - State management?
   - External IO (API, IPC)?
   - Payment / critical operations?

4. **If YES** → Run `*tier` for classification
   **If NO** (pure UI/style) → Skip to step breakdown

5. Break down plan into plans/active/ steps
6. Start execution

### Execution Flow

```
*issue pick <n>
     │
     ▼
┌─────────────────────────────────────────────────────────────┐
│                    EXECUTION LIFECYCLE                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  [Optional]      Phase 2         Phase 3         Phase 4    │
│  ┌──────┐       ┌──────┐        ┌──────┐        ┌──────┐   │
│  │ TIER │  →    │ PRE  │   →    │ CODE │   →    │REVIEW│   │
│  └──────┘       └──────┘        └──────┘        └──────┘   │
│     │              │               │               │        │
│     ▼              ▼               ▼               ▼        │
│   *tier        pre-code.md     in-code.md     post-code    │
│  (if needed)                     *next          *review     │
│                                                              │
└─────────────────────────────────────────────────────────────┘
     │
     ▼
*issue close <n>
```

---

## Context Management

### plans/active/ (Session Tasks)

```markdown
## Current Issue: #N - Title

**Tier**: T2 - Logic
**Pillars**: A, D, L

### Steps
- [x] Step 1: Create headless hook (Pillar L)
- [ ] Step 2: Add adapter (Pillar B)
- [ ] Step 3: Create view
```

### MEMORY.md (Long-term Memory)

```markdown
## Decisions
| Date | Decision | Reason | Alternatives |
|------|----------|--------|--------------|
| 2024-01 | Use Zod | Type inference | io-ts, yup |

## Best Practices
- Pattern learned from issue #5

## Solved Issues
- Issue #3: Fixed by...
```

---

## Execution Phases

### Phase 1: Tier Classification (Optional)

**When to run `*tier`**:

| Trigger | Example |
|---------|---------|
| ✅ Data writes | "Save user profile", "Update cart" |
| ✅ State management | "Form with validation", "Multi-step wizard" |
| ✅ External IO | "Fetch from API", "Call Tauri IPC" |
| ✅ Critical operations | "Payment", "File sync", "Account deletion" |
| ❌ Skip | "Fix button color", "Update text", "Add icon" |

**Process**:
1. Analyze task requirements
2. Classify into T1/T2/T3
3. Identify relevant Pillars

| Tier | When | Pattern | Pillars |
|------|------|---------|---------|
| T1 | Read-only | `View → Adapter` | A, I, L |
| T2 | Local state | `View → Headless → Adapter` | A, D, I, J, L |
| T3 | Distributed | `View → Saga` | A, B, D, F, M, Q, R |

**Output**: Update plans/active/ with Tier + Pillars (if classified)

---

### Phase 2: Pre-Code Audit

**Trigger**: After Tier classification

**Checklist**: @.prot/checklists/pre-code.md

- [ ] Correct layer? (Domain/Module/Adapter)
- [ ] Branded Types for IDs? (Pillar A)
- [ ] FSM for state? (Pillar D)
- [ ] T3: Intent-ID planned? (Pillar Q)
- [ ] T3: Compensation defined? (Pillar M)

**Templates**:
| Type | Template |
|------|----------|
| Branded Types | `.prot/pillar-a/branded.ts` |
| FSM | `.prot/pillar-d/fsm-reducer.ts` |
| Saga | `.prot/pillar-m/saga.ts` |

---

### Phase 3: In-Code Execution

**Trigger**: `*next`

**Checklist**: @.prot/checklists/in-code.md

For each step:
1. Check Pillar from plans/active/
2. Copy from Template if creating new file
3. Verify rule compliance
4. Run tests
5. Mark step complete

**Templates**:
| File Type | Template |
|-----------|----------|
| Headless hook | `.prot/pillar-l/headless.ts` |
| Adapter | `.prot/pillar-b/airlock.ts` |
| Saga | `.prot/pillar-m/saga.ts` |
| Idempotency | `.prot/pillar-q/idempotency.ts` |

---

### Phase 4: Post-Code Review

**Trigger**: `*review` or before `*issue close`

**Checklist**: @.prot/checklists/post-code.md

**Structural Review**:
- [ ] No deep imports (Pillar I)
- [ ] Headless/View separation (Pillar L)
- [ ] State locality (Pillar J)

**T3 Review**:
- [ ] Idempotency barrier (Pillar Q)
- [ ] Version checks (Pillar F)
- [ ] Compensation complete (Pillar M)
- [ ] Semantic logs (Pillar R)

**Audits**: Run `*audit` for automated checks

**Output**:
```markdown
## Review Summary
**Status**: PASS / NEEDS_FIX
**Pillars Verified**: [A, D, L, ...]
**Issues Found**: [None / List]
```

---

## Command Reference

### Workflow Commands

| Command | Description |
|---------|-------------|
| `*status` | Project overview |
| `*resume` | Start session |
| `*sync` | Save & sync |
| `*issue` | Issue management |

### Protocol Commands

| Command | Phase | Description |
|---------|-------|-------------|
| `*tier` | 1 | Classify complexity |
| `*next` | 3 | Execute next step |
| `*review` | 4 | Post-code review |
| `*audit` | 4 | Automated checks |
| `*pillar <X>` | Any | Query Pillar details |

### Infrastructure

| Command | Description |
|---------|-------------|
| `*cdk status` | Stack status |
| `*cdk diff` | Preview changes |
| `*cdk deploy` | Deploy (with approval) |

---

## Architecture

> Directory structure: see `.prot/STRUCTURE.md`

---

## Testing Strategy

| Layer | Test Type | Target |
|-------|-----------|--------|
| 01_domains | Unit | 100% |
| headless/ | Unit | High |
| adapters/ | Contract | Schema |
| workflows/ | Integration | Flow |
| views/ | Snapshot | Critical |
