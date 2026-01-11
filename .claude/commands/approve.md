---
name: approve
category: workflow
requires: none
---

# Command: *approve

## Purpose
User approval to proceed with previously proposed action

## Context Detection

Reads last AI output to determine what to approve:

### If previous command was *cdk diff
- Execute: `cdk deploy --profile dev`
- Show deployment progress
- Report stack status on completion

### If previous command was *plan (ExitPlanMode)
- Create issue plan file in `.claude/plans/active/#<n>-title.md`
- Load tier-based templates (if applicable)
- Start first step from plan

### If previous command was *tier
- Load recommended templates from .prot/pillar-*/
- Create module structure (if *scaffold suggested)
- Start implementation with pre-code checklist

### If previous command was *release
- Confirm version bump
- Execute release workflow
- Tag and push to remote

## Workflow

1. Analyze conversation context (last 3 AI messages)
2. Detect approval-gated command
3. Execute corresponding action
4. Report completion

## Error Handling

If no approval-gated action found:
- Message: "No pending action to approve. Use *status to check current state."

## Related
- Commands: *cdk, *plan, *tier, *release
- Workflow: @.claude/rules/workflow.md
