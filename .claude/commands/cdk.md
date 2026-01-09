---
name: cdk
category: infrastructure
requires: none
---

# Command: *cdk

## Purpose
Manage AWS CDK infrastructure operations

## Usage
```bash
*cdk status    # Show stack status and drift
*cdk diff      # Preview pending changes
*cdk deploy    # Deploy with approval gate
*cdk destroy   # Destroy with confirmation
```

## Actions

| Action | Description |
|--------|-------------|
| `status` | Show stack status and drift |
| `diff` | Preview pending changes |
| `deploy` | Deploy with approval gate |
| `destroy` | Destroy with confirmation |

## Process

### *cdk status
1. Run `cdk list` to show stacks
2. Check CloudFormation stack status
3. Report any drift detected

### *cdk diff
1. Run `cdk synth` to validate
2. Run `cdk diff --profile dev`
3. Summarize changes (add/modify/delete)

### *cdk deploy
1. Run diff first
2. Show approval gate:
   ```
   ## CDK Deploy Approval

   **Stack**: MyAppDevStack
   **Changes**: 3 resources modified
   **Risk**: Medium

   Wait for *approve before proceeding.
   ```
3. After approval: `cdk deploy --profile dev`

### *cdk destroy
1. List all resources to be destroyed
2. Show HIGH RISK warning
3. Require explicit confirmation
4. After approval: `cdk destroy --profile dev`

## Environment

Default AWS profile: `dev` (from CLAUDE.md global config)

## Output Example

```
## CDK Status

**Stack**: MyAppDevStack
**Status**: UPDATE_COMPLETE
**Last Deploy**: 2024-01-15 10:30

### Resources (12 total)
- Lambda: 3
- DynamoDB: 2
- API Gateway: 1
- S3: 2
- IAM: 4

### Drift: None detected
```

## Command Chaining

**After *cdk deploy**: Suggests `*sync` to commit CDK changes
**Before *cdk deploy**: Requires `*approve` (approval gate pattern)

## Related
- Commands: *approve, *sync
- Files: @.claude/patterns/git-workflow.md
- Profile: `dev` (default AWS profile)
