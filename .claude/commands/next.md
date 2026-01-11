---
name: next
category: workflow
requires: [.claude/plans/active/, .claude/workflow/]
---

# Command: *next

## Purpose
Intelligent task navigator with 3-level cascade: Plans → Issues → MVP

## Workflow

### Level 1: Active Tasks (Plans)
Check `.claude/plans/active/` for active issue plans:
- If active plan with pending steps → show next step, ask to continue
- If all steps complete → suggest `*review` or `*issue close`
- If no active plans → proceed to Level 2

**Example**: "Continue with #101 Presign URL integration?"

### Level 2: Recommend Issues (Current MVP)
1. Infer current MVP from active plan (if any), or from issue list
2. Read MVP file (e.g., `docs/dev/MVP2_UPLOAD.md`)
3. Extract uncompleted issues (status `[ ]`)
4. Prioritize P1 issues first
5. Show recommendation:
   - Issue number and title
   - Related test scenarios
   - Estimated complexity (if tagged)
6. On user confirm → create feature branch, load dev plan from GitHub issue (or create new one)

**Example**: "Recommend Issue #102: S3 upload verification [P1]. Start?"

### Level 3: Recommend MVP (Strategic)
1. If current MVP all issues complete → check next MVP
2. Read `docs/dev/MVP*.md` files in sequence
3. Find first uncompleted MVP
4. Show:
   - MVP goal (one-line summary)
   - Acceptance criteria
   - Core features
5. Suggest: "Run *plan to decompose MVP into issues"

**Example**: "MVP2 complete! Next: MVP3 - Batch Processing. Plan now?"

## Pre-Execution Checks

Before executing any task, auto-load:
- **Tier-based templates**: See @.claude/patterns/pillar-reference.md
- **Pre-code checklist**: @.prot/checklists/pre-code.md
- **Complexity assessment**: If complexity ≥7, explain plan and wait for `*approve`

Template matching:
- Headless hook → .prot/pillar-l/headless.ts
- Adapter → .prot/pillar-b/airlock.ts
- Saga → .prot/pillar-m/saga.ts
- FSM reducer → .prot/pillar-d/fsm-reducer.ts

## Post-Execution Updates

After completing a sub-task:
1. **Update TODO.md**: Mark step as `[x]` complete
2. **Check for archival**: If important decision, suggest MEMORY.md update
3. **Trigger next round**: Ask "Continue with next sub-task? (yes/no)"

If all sub-tasks complete:
- Suggest: `*review` (run post-code checklist)
- Or: `*issue close <n>` (if ready to close)

## Examples

See detailed scenarios: @.claude/workflow/examples/next-command.md

**Scenario 1**: Active task with pending steps
**Scenario 2**: TODO empty, recommend Issue from current MVP
**Scenario 3**: Current MVP complete, recommend next MVP

## Template Integration

**Level 1 (Plans check)**:
- If no active plans → show available plans from `.claude/plans/active/`
- If multiple plans → ask which to continue

**Level 2 (Issue recommendation)**:
- When picking Issue → check if plan exists in `plans/active/#<n>-*.md`
- If T2/T3 complexity and no plan → prompt: "Create feature plan first?"
- If yes → copy `templates/TEMPLATE-feature-plan.md` to `plans/active/`

**Level 3 (MVP recommendation)**:
- When recommending new MVP → reference `templates/TEMPLATE-mvp.md`
- Suggest `*plan` to decompose MVP into Issues (Step 1: 40 min)

**Architecture**:
```
战略 (Strategy)  → Level 3: MVP      → TEMPLATE-mvp.md
战役 (Campaign)  → Level 2: Issues   → TEMPLATE-feature-plan.md (.claude/plans/active/)
战术 (Tactics)   → Level 1: Plans    → Issue plans stored in .claude/plans/active/
```

## Notes

- **Single focus**: One issue at a time (in active plan file)
- **Small steps**: Break tasks into 30-min chunks
- **Immediate updates**: Mark progress in plan file after each step
- **Template compliance**: Auto-suggest templates for new files
- **Smart prioritization**: Consider dependencies and priority tags

## Related
- Commands: *issue pick, *plan, *review, *tier
- Templates: `.claude/workflow/templates/`
- Workflow: `.claude/workflow/development.md`
- Patterns: `.prot/pillar-*/`
