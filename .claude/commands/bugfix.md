---
name: bugfix
category: workflow
requires: none
---

# Command: *bugfix

## Purpose
Fix bugs on development branch using proper Git Flow workflow

## Usage
```bash
*bugfix start <desc>   # Create bugfix branch from development
*bugfix finish         # Merge bugfix back to development
*bugfix                # Show current bugfix status
```

## Commands

### *bugfix (no args)
Show current bugfix status:
```bash
git branch --show-current
git status --short
```

### *bugfix start <desc>
Create bugfix branch from development:

1. **Ensure clean state**:
   ```bash
   git status --short
   ```
   - If uncommitted changes, ask to stash or commit first

2. **Create bugfix branch**:
   ```bash
   git checkout development
   git pull origin development
   git checkout -b bugfix/<desc>
   git push -u origin bugfix/<desc>
   ```

3. **Create feature plan** (`.claude/plans/active/bugfix-desc.md`):
   ```markdown
   ---
   issue: [bug issue number]
   type: bugfix
   ---
   
   # Bugfix: <desc>
   
   ### Steps
   - [ ] Identify root cause
   - [ ] Implement fix
   - [ ] Add/update tests
   - [ ] Verify fix locally
   ```

4. Start working on the fix

### *bugfix finish
Complete bugfix and merge to development:

1. **Verify fix is complete**:
   - All tests passing
   - Feature plan steps completed

2. **Commit final changes**:
   ```bash
   git add -A
   git commit -m "fix: <desc>"
   git push
   ```

3. **Merge workflow**:
   ```bash
   # Update from development
   git checkout development
   git pull origin development
   git checkout bugfix/<desc>
   git merge development  # Resolve conflicts if any

   # Merge back to development
   git checkout development
   git merge --no-ff bugfix/<desc> -m "Merge bugfix/<desc>"
   git push origin development

   # Delete bugfix branch
   git branch -d bugfix/<desc>
   git push origin --delete bugfix/<desc>
   ```

4. **Archive feature plan**: Move to `.claude/plans/archive/`

## Diagnostic Workflow (Before Implementation)

> **排查顺序**: 本地 Logs → 云端 Logs → 模拟代码流程 → 最小复现

See: @.claude/rules/debugging.md for detailed debugging rules

### Step 1: Analyze Logs

**Local logs** (first check):
```bash
# View today's logs
cat ~/.yorutsuke/logs/$(date +%Y-%m-%d).jsonl | jq .

# Filter by error level
cat ~/.yorutsuke/logs/$(date +%Y-%m-%d).jsonl | jq 'select(.level == "error")'

# Find by traceId (trace complete request flow)
cat ~/.yorutsuke/logs/$(date +%Y-%m-%d).jsonl | jq 'select(.traceId == "trace-xxx")'
```

**Cloud logs** (Lambda/API issues):
```bash
# Tail Lambda logs in real-time
aws logs tail /aws/lambda/yorutsuke-instant-processor-dev --follow --profile dev

# Filter for specific errors
aws logs filter-log-events \
  --log-group-name /aws/lambda/yorutsuke-instant-processor-dev \
  --filter-pattern '"error"' --profile dev

# Trace by traceId
aws logs filter-log-events \
  --log-group-name /aws/lambda/yorutsuke-instant-processor-dev \
  --filter-pattern '"trace-xxx"' --profile dev
```

### Step 2: Identify Root Cause

- **Check STATE_TRANSITION logs** - Most bugs are state machine issues
- **Check error messages** - Look for SQL errors, permission denied, timeout, etc.
- **Use LSP to trace call hierarchy** - Follow function calls in code
- **Add temporary debug logs** - Narrow down exact line where bug occurs

**Update feature plan**:
```markdown
### Steps
- [x] Analyze logs → Found error in xyz.ts:123
- [ ] Implement fix
- [ ] Add/update tests
- [ ] Verify fix locally
```

### Step 3: Reproduce Minimally

Create a test that reproduces the bug:

```bash
# Write test case
vim app/src/xxx.test.ts

# Run test (should fail)
npm test -- --grep "bug-description"

# Now fix code to make test pass
```

This isolates the bug and prevents regression.

## Verification Checklist (Before Finish)

Before running `*bugfix finish`, verify:

- [ ] **Tests pass**: `npm test` (all pass, no skipped)
- [ ] **Type check passes**: `npm run type-check` (no errors)
- [ ] **Local dev works**:
  - Tauri app: `npm run tauri dev` (no crashes)
  - Or Lambda: `cdk watch` (deploy successful)
- [ ] **Logs confirm fix**:
  - Local: `cat ~/.yorutsuke/logs/$(date +%Y-%m-%d).jsonl | jq . | grep -i error`
  - Lambda: `aws logs tail /aws/lambda/xxx --follow` (no related errors)
- [ ] **Feature plan complete**: All steps marked `[x]`
- [ ] **Code follows rules**:
  - No hard-coded values (use tokens/env vars)
  - No primitive ID types (use Branded Types)
  - No JSX in headless hooks

## Output Format

### *bugfix start
```
## Bugfix Started

**Branch**: bugfix/<desc>
**Base**: development

Ready to fix. Run `*bugfix finish` when done.
```

### *bugfix finish
```
## Bugfix Complete

**Branch**: bugfix/<desc> (deleted)
**Merged to**: development

Fix deployed to development branch.
```

## Notes

- Bugfix is for development branch issues (not production)
- For production issues, use `*hotfix` instead
- Keep bugfix branches short-lived
- Follow @.claude/patterns/git-workflow.md

## Related
- Commands: *hotfix (for production), *issue, *sync
- Patterns: @.claude/patterns/git-workflow.md
