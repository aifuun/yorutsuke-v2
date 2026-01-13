# Planning Reference - Two-Layer System

> **Note**: This file now serves as a reference guide. For active planning, use the new two-layer system.

---

## 🚀 Quick Navigation

### For MVP Planning (Strategic)
**When**: Starting a new MVP release
**Duration**: 40 minutes
**Guide**: **[`planning-mvp.md`](planning-mvp.md)**

```bash
*plan mvp
```

**Output**: GitHub Issues + dependency graph

---

### For Feature Planning (Tactical)
**When**: Before developing a specific feature
**Duration**: 1-2 hours
**Guide**: **[`planning-feature.md`](planning-feature.md)**

```bash
*plan #<issue-number>
```

**Output**: Dev plan + function contracts + test cases

---

## 📋 Planning Steps Reference

This section provides a quick reference for all planning steps. For detailed workflows, see the guides above.

### Phase 1: Architecture Preparation (Feature Planning)

**Step 0: Review Architecture Context**
- Read relevant ADRs from `docs/architecture/ADR/`
- Identify applicable Pillars from `.prot/`
- Check architecture patterns from `docs/architecture/`

**Step 1: Define Key Functions + Unit Tests**
- Function signatures with types
- Pre-conditions and post-conditions
- Side effects documentation
- Unit test specifications (TDD approach)

**Detailed examples**: See `.claude/workflow/examples/function-contracts-example.md`

---

### Phase 2: Requirements & Planning

**Step 2: Validate Requirements**
- [ ] REQUIREMENTS.md has user story
- [ ] ARCHITECTURE.md defines module boundaries
- [ ] SCHEMA.md lists required entities
- [ ] DESIGN.md has UI specifications
- [ ] INTERFACES.md has API definitions (if needed)

**Step 3: Create Development Plan**
- Implementation steps with file paths
- Subtasks checklist per step
- Technical decisions documented
- Risk assessment
- Deployment notes

**Detailed example**: See `.claude/workflow/examples/dev-plan-example.md`

**Step 4: Create Test Cases**
- Test cases with Given/When/Then format
- Coverage matrix linking tests to acceptance criteria
- 100% coverage requirement

**Detailed example**: See `.claude/workflow/examples/test-cases-example.md`

---

### Phase 3: GitHub Integration

**Step 5: Add Plan to GitHub Issue**
```bash
gh issue comment <n> -b "## Development Plan\n[content]"
```

**Step 6: Apply Labels**
```bash
gh issue edit <n> --add-label "status/planned,tier/t2,pillar/f"
```

Labels:
- `status/planned` - Ready to develop
- `tier/t1|t2|t3` - Complexity tier
- `pillar/*` - Relevant pillars
- `priority/must|should|could` - Business priority

---

## 🔄 Two-Layer Architecture

```
Layer 1: MVP Planning (战略层)
├─ Purpose: Decompose MVP into features
├─ Duration: 40 minutes
├─ Output: GitHub Issues with rough estimates
└─ Guide: planning-mvp.md

Layer 2: Feature Planning (战役层)
├─ Purpose: Detailed implementation plan for one feature
├─ Duration: 1-2 hours
├─ Output: Dev plan + function contracts + test cases
└─ Guide: planning-feature.md
```

**Key insight**: Feature = Issue (one-to-one relationship)

---

## 📚 Complete Documentation

| Document | Purpose |
|----------|---------|
| **[planning.md](planning.md)** | Two-step overview and decision tree |
| **[planning-mvp.md](planning-mvp.md)** | MVP decomposition workflow (40 min) |
| **[planning-feature.md](planning-feature.md)** | Feature planning workflow (1-2h) |
| **[templates/](templates/)** | Plan templates (MVP, Feature, Issue) |
| **[examples/](examples/)** | Detailed examples for Steps 1, 3, 4 |

---

## ✅ Success Criteria

**MVP-Level Planning Complete**:
- [ ] All features identified and sized
- [ ] Dependencies mapped
- [ ] GitHub Issues created (5-10 issues typical)
- [ ] Team understands MVP scope
- [ ] Ready to pick features for development

**Feature-Level Planning Complete**:
- [ ] Architecture context reviewed (Step 0)
- [ ] Key functions defined with test specs (Step 1)
- [ ] Requirements validated against docs (Step 2)
- [ ] Development plan created with all steps detailed (Step 3)
- [ ] Test cases created covering all acceptance criteria (Step 4)
- [ ] Coverage matrix shows 100% coverage
- [ ] Plan added to GitHub Issue comment (Step 5)
- [ ] All relevant labels applied (Step 6)
- [ ] Team reviewed and approved
- [ ] Ready to `*issue pick` and develop

---

## 🔗 Related

- **Commands**: `.claude/commands/plan.md` (router + common protocols)
- **Workflow**: `.claude/WORKFLOW.md` (complete development workflow)
- **Architecture**: `docs/architecture/` (ADRs, patterns, pillars)
- **Templates**: `.claude/workflow/templates/README.md`

---

**Last Updated**: 2026-01-13
**Version**: v2 (Two-Layer System)
**Status**: ✅ Active Reference
