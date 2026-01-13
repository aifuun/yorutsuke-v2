# MVP-Level Decomposition

> Quick feature breakdown for a release. Creates GitHub Issues without detailed implementation plans.

**Output**: GitHub Issues + dependency graph
**When**: Once per MVP release (v0.1, v1.0, MVP3.0, etc.)  

---

## 📋 When to Use

- Starting a new MVP release (v0.1, v1.0, MVP3.0, etc.)
- Understand what features exist in the release
- Identify dependencies and prioritize

**Do NOT use for**: Detailed implementation planning (→ see `planning-feature.md` instead)

---

## 🎯 Step 0: Analyze MVP Goal

Clarify the MVP's overall goal and acceptance criteria:

```markdown
MVP x.0 Goal:
- What is the primary business objective?
- What are the success metrics?
- Any hard constraints (timeline, resources)?

Example: MVP3.0 - Process batched Bedrock results
Goal: Reduce processing time by 6x (1000 items in <10s)
Metrics: Latency <10s, 99% success rate
Constraint: Lambda timeout 10 minutes
```

---

## 🔍 Step 1: Identify Feature Scope

List all features needed for this MVP:

```markdown
MVP x.0 Features:
1. Feature-A: Shopping cart state
2. Feature-B: Cart UI components
3. Feature-C: Cart persistence
4. Feature-D: Checkout integration
5. Feature-E: Order confirmation email

Total: 5 features
```

**Criteria for each feature:**
- Is it required for MVP goal? (Must-have vs Nice-to-have)
- Can it be deferred to next MVP?

---

## 📦 Step 2: Decompose with Dependencies

For each feature, identify:
1. **Rough size** (not detailed, just estimate hours)
2. **Dependencies** (what must be done first)
3. **Parallelization** (what can run in parallel)

**Decomposition template:**

```markdown
Feature-A: Shopping Cart State
├─ Rough size: 8 hours
├─ Dependencies: None (can start immediately)
├─ Blocked by: None

Feature-B: Cart UI Components
├─ Rough size: 6 hours
├─ Dependencies: Feature-A (needs state first)
├─ Blocked by: Feature-A

Feature-C: Cart Persistence
├─ Rough size: 3 hours
├─ Dependencies: Feature-A (needs state to persist)
├─ Blocked by: Feature-A

Feature-D: Checkout Integration
├─ Rough size: 12 hours
├─ Dependencies: Feature-A, Feature-B
├─ Blocked by: Feature-A, Feature-B

Feature-E: Order Confirmation Email
├─ Rough size: 4 hours
├─ Dependencies: Feature-D (needs order data)
├─ Blocked by: Feature-D
```

**Dependency graph:**
```
Feature-A (8h)
├─→ Feature-B (6h)
├─→ Feature-C (3h)
└─→ Feature-D (12h)
    └─→ Feature-E (4h)

Parallel groups:
├─ Feature-A alone: 8h
├─ Feature-B + Feature-C (after A): 6h max
├─ Feature-D (after A, B): 12h
└─ Feature-E (after D): 4h

Total MVP time: 8h + 6h + 12h + 4h = 30 hours
(with parallelization)
```

---

## 🔐 Step 3: Create GitHub Issues (Bare Minimum)

For each feature, create a GitHub issue with:

```markdown
Title: Feature: [Feature Name]

Description:
## Goal
[What this feature accomplishes - 1 sentence]

## Acceptance Criteria
- [ ] Criterion 1 (must-have)
- [ ] Criterion 2 (must-have)
- [ ] Criterion 3 (nice-to-have)

## Context
[Why this matters, user story reference]

## Dependencies
[Blocked by: #X, Requires: Feature-Y]

## Rough Size
[Estimated hours: 6h-8h]

## Notes
[Any initial thoughts, constraints]
```

**Example:**
```markdown
Title: Feature: Shopping cart state management

Description:
## Goal
Implement Redux slice for managing shopping cart items

## Acceptance Criteria
- [ ] User can add item with quantity
- [ ] User can remove item from cart
- [ ] Cart state persists in Redux
- [ ] Unit tests for reducer/actions

## Context
Required for checkout flow (Feature-D)
Blocked by: SCHEMA.md update

## Dependencies
Blocked by: None
Enables: Feature-B, Feature-C, Feature-D

## Rough Size
8 hours (includes tests)

## Notes
- Use Redux (per ARCHITECTURE.md)
- Must support undo operation
```

**Commands:**
```bash
# Create issue
gh issue create --title "Feature: [Name]" \
  --body "$(cat <<'EOF'
## Goal
...

## Acceptance Criteria
...

## Dependencies
...

## Rough Size
[hours]
EOF
)"

# Bulk create from list
for feature in feature-a feature-b feature-c; do
  gh issue create --title "Feature: $(echo $feature | tr '-' ' ')" \
    --body "Description..."
done
```

**Labeling:**
```bash
# After creating issues
gh issue edit <n> --add-label "feature/planning,size-estimate/8h"
```

---

## 📊 Output: Roadmap for MVP

**What you should have after MVP planning:**

```markdown
# MVP x.0 Roadmap

## Goal
[MVP goal]

## Features (with rough timeline)

| Feature | Size | Dependencies | Status | Issue |
|---------|------|--------------|--------|-------|
| Feature-A | 8h | None | Planned | #100 |
| Feature-B | 6h | #100 | Planned | #101 |
| Feature-C | 3h | #100 | Planned | #102 |
| Feature-D | 12h | #100, #101 | Planned | #103 |
| Feature-E | 4h | #103 | Planned | #104 |

**Total estimated time**: 30 hours (with parallelization)

## Development Order
1. Start Feature-A (8h)
2. Once A done, start Feature-B + Feature-C in parallel (6h max)
3. Once B done, start Feature-D (12h)
4. Once D done, start Feature-E (4h)

## Dependencies Graph
```
Feature-A
├─→ Feature-B
├─→ Feature-C
└─→ Feature-D
    └─→ Feature-E
```

## Next Steps
When ready to start Feature #N, see `planning-feature.md` for detailed planning
```

---

## ✅ Success Criteria

✅ **MVP-Level Decomposition is complete when:**

- [ ] MVP goal and acceptance criteria documented
- [ ] All features identified and listed
- [ ] Dependencies mapped for all features
- [ ] Rough sizes estimated (within 2x accuracy)
- [ ] GitHub Issues created for all features (with minimal info)
- [ ] Dependency graph visible
- [ ] Team understands MVP scope and order

---

## 📚 Next Phase

When **ready to start developing Feature #N**:

→ Go to `planning-feature.md` for detailed planning

This will:
- Create `.claude/feature-[n]-PLAN.md` with implementation steps
- Create `.claude/feature-[n]-TEST-CASES.md` with test coverage
- Add both to GitHub Issue comment
- Apply labels (tier, pillar, status)

---

## 🔗 See Also

- **Full Planning Reference**: `planning-reference.md` (Steps 0-8 detailed)
- **Feature-Level Planning**: `planning-feature.md` (when developing)
- **Architecture**: `workflow/architecture.md`
- **Development**: `workflow/development.md`
