---
name: plan
category: planning
requires: none
---

# Command: *plan

## Purpose
Router for planning: MVP decomposition or feature implementation planning.

**Note**: Executing `*plan` enters **Plan Mode** - exploration and design before coding.

---

## Usage

```bash
*plan           # Show planning menu
*plan mvp       # MVP decomposition → planning-mvp.md
*plan #<n>      # Feature planning → planning-feature.md
```

---

## Planning Layers

### Layer 1: MVP Planning (战略层)
**Command**: `*plan mvp`
**Purpose**: Decompose MVP into GitHub Issues (features)
**Output**: GitHub Issues with rough estimates + dependency graph
**Guide**: `.claude/workflow/planning-mvp.md`

**Workflow**:
```
Analyze MVP goal → Identify features → Map dependencies → Create Issues
```

---

### Layer 2: Feature Planning (战役层)
**Command**: `*plan #<n>`
**Purpose**: Plan implementation for one feature (= one Issue)
**Output**: Dev plan + function contracts + test cases
**Guide**: `.claude/workflow/planning-feature.md`

**Workflow**:
```
Architecture review → Function contracts → Validate requirements → Dev plan → Ready to code
```

**Note**: Feature = Issue (one-to-one relationship)

---

## Common Protocols

These rules apply to **all** planning activities:

### Plan Mode Behavior

When you execute `*plan`, you enter **Plan Mode**:

1. **Exploration**: Use Glob, Grep, Read, Explore to understand codebase
2. **Analysis**: Analyze patterns, architecture, dependencies
3. **Design**: Create detailed plan
4. **Presentation**: Write plan to file or GitHub
5. **Approval**: Wait for user approval/modification/rejection
6. **Exit**: Exit Plan Mode once approved or aborted

**Characteristics**:
- ✅ No coding - planning only
- ✅ Deep exploration - read many files to understand context
- ✅ Architecture-aware - check ADRs, Pillars, patterns
- ✅ Risk identification - spot issues before coding
- ✅ Safe - exploration only, no code changes until approved

### After Plan Mode

Once plan is approved:
- Use `*approve` to start implementation
- Or use `*next` to continue workflow

### Plan Quality Standards

All plans should have:
- ✅ Clear goal and scope
- ✅ Actionable steps (typically 3-7 steps)
- ✅ Each step is testable
- ✅ Risks identified upfront
- ✅ Dependencies noted

### Architecture Decision Recording

If planning results in major architectural changes:
- Create ADR in `docs/architecture/ADR/NNN-title.md`
- Add link to `.claude/MEMORY.md` (see `.claude/rules/memory-management.md`)

---

## Routing

### *plan mvp
**AI**: Read `.claude/workflow/planning-mvp.md` for complete MVP decomposition workflow.

### *plan #<n>
**AI**: Read `.claude/workflow/planning-feature.md` for complete feature planning workflow.

---

## Templates

| Planning Type | Template | Output Location |
|---------------|----------|-----------------|
| MVP | `TEMPLATE-mvp.md` | `docs/dev/MVPX.md` |
| Feature | `TEMPLATE-feature-plan.md` | `.claude/plans/active/#XXX.md` |
| Issue (from MVP) | `TEMPLATE-github-issue.md` | GitHub Issues |

Templates: `.claude/workflow/templates/`

---

## Command Chaining

```bash
# Layer 1: MVP Planning
*plan mvp              # Creates Issues #100-#107
*issue pick 100        # Pick an issue to work on

# Layer 2: Feature Planning
*plan #100             # Create detailed plan for Issue #100
*approve               # Start implementation
```

---

## Related

- **MVP guide**: `.claude/workflow/planning-mvp.md`
- **Feature guide**: `.claude/workflow/planning-feature.md`
- **Commands**: `*approve`, `*tier`, `*issue`
- **Workflow**: `.claude/rules/workflow.md`
- **Summary**: `docs/workflow/PLANNING_WORKFLOW_SUMMARY.md`
