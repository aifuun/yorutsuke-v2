---
paths:
  - docs/dev/MVP*.md
  - .claude/plans/active/*.md
---

# Planning Context

You are working on planning documents. Relevant templates and workflows:

## MVP Files (docs/dev/MVP*.md)

**Template**: `.claude/workflow/templates/TEMPLATE-mvp.md`
**Workflow**: `.claude/workflow/planning-mvp.md` (Step 1: 40 min)
**Process**: MVP decomposition → GitHub Issues

**Key principles**:
- Define goals and acceptance criteria
- List features with rough sizing
- Create dependency graph
- Generate GitHub Issues

## Feature Plans (.claude/plans/active/*.md)

**Template**: `.claude/workflow/templates/TEMPLATE-feature-plan.md`
**Workflow**: `.claude/workflow/planning-feature.md` (Step 2: 1-2h)
**Process**: Detailed implementation plan → Ready to code

**Key principles**:
- Detailed implementation steps
- Test cases with coverage
- Risk assessment
- Created WHEN needed (just-in-time)

## Three-Layer Architecture

```
战略 (Strategy)  → MVP 文件        → 整体方向和目标
战役 (Campaign)  → Feature Plans  → 达成目标的系列任务
战术 (Tactics)   → plans/active/        → 当前执行的动作
```

## Quick Actions

**Creating MVP plan**:
1. Copy `TEMPLATE-mvp.md` to `docs/dev/MVPX_NAME.md`
2. Follow `planning-mvp.md` workflow (40 min)
3. Output: GitHub Issues + dependency graph

**Creating Feature plan**:
1. Copy `TEMPLATE-feature-plan.md` to `plans/active/#xxx-name.md`
2. Follow `planning-feature.md` workflow (1-2h)
3. Output: Ready-to-code implementation plan

## See Also

- Templates: `.claude/workflow/templates/README.md`
- Two-Step Planning: `.claude/workflow/planning.md`
- Architecture: `.claude/workflow/architecture.md`
