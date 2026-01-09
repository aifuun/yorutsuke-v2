---
name: approve
category: workflow
requires: none
---

# Command: *approve

## Purpose
User approved. Continue with the previously proposed plan.

## Workflow
1. **Detect context**: Read last AI output to identify approval-gated action
2. **Execute action**: Based on detected context:
   - If previous: `*cdk diff` → Run `cdk deploy`
   - If previous: `*plan` → Create TODO.md entries, start first step
   - If previous: `*tier` → Load templates, start implementation
   - If previous: `*release` → Confirm version bump, execute release
3. **Report completion**: Show result of executed action

## Error Handling
If no approval-gated action detected:
- Message: "No pending action to approve. Use *status to check current state."

## Related
- Commands: *cdk, *plan, *tier, *release
