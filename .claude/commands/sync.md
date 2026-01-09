---
name: sync
category: workflow
aliases: [save]
requires: [MEMORY.md, TODO.md]
---

# Command: *sync

## Purpose
Save progress and sync with remote repository

## Usage
```bash
*sync              # Auto-generate commit message, push
*sync --ask        # Interactive mode (ask for summary)
*sync --memory     # Update MEMORY.md before commit
*sync --no-push    # Commit only, don't push
```

Note: `*save` is an alias for `*sync --ask --memory`

## Workflow

### Default Mode (*sync)
1. **Update memory** (if significant progress):
   - Update `.claude/MEMORY.md` Current Context
   - Update `.claude/TODO.md` (mark completed tasks)
2. **Stage changes**: `git add -A`
3. **Auto-generate commit message** from git diff
4. **Commit and push**: Follow @.claude/patterns/git-workflow.md

### Interactive Mode (*sync --ask)
1. **Show diff**: `git diff --stat` and present to user
2. **Ask for summary**: Prompt user for one-line session summary
3. **Update MEMORY.md**: Append summary to Current Context section
4. **Update TODO.md**: Mark completed tasks
5. **Commit**: `git commit -m "feat: [user summary]"`
6. **Push**: `git push`

### Memory-Only Mode (*sync --memory)
1. **Update MEMORY.md** first
2. Then proceed with default sync flow

### Commit-Only Mode (*sync --no-push)
1. Commit changes locally
2. Skip push step (useful for batching commits)

## Output Format
```
## Sync Complete

Changes:
 3 files changed, 45 insertions(+), 12 deletions(-)

Summary: [auto-generated or user-provided]

✅ Committed: [commit message]
✅ Pushed to origin/main
```

## Constraints
- **Interactive mode**: MUST ask user for summary, never auto-generate
- **MEMORY.md**: Always append, never overwrite
- **Conflicts**: If pull fails, pause and guide user through resolution
- **First push**: Use `git push -u origin <branch>` for new branches

## Related
- Files: @.claude/patterns/git-workflow.md
- Commands: *resume, *status
