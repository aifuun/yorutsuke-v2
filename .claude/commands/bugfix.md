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
