---
name: sync
category: workflow
aliases: [save]
requires: [MEMORY.md, feature branch]
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
1. **Check current branch**:
   ```bash
   git branch --show-current
   ```
   - Show branch name to user
   - Warn if on `main` or `development` directly (should use feature branch)

2. **Sync with development** (NEW):
   ```bash
   # Save current branch name
   CURRENT_BRANCH=$(git branch --show-current)

   # If on feature branch, sync from development
   if [ "$CURRENT_BRANCH" != "development" ] && [ "$CURRENT_BRANCH" != "main" ]; then
     # Pull latest development
     git fetch origin development:development

     # Merge development into current branch
     git merge development --no-edit
   fi

   # If on development, just pull
   if [ "$CURRENT_BRANCH" = "development" ]; then
     git pull origin development
   fi
   ```

   **Conflict handling**:
   - If merge has conflicts, pause and show:
     ```
     ⚠️  Merge conflicts detected in:
     <list of files>

     Please resolve conflicts manually:
     1. Edit conflicted files
     2. Stage resolved files: git add <files>
     3. Complete merge: git commit
     4. Run *sync again
     ```

3. **Update memory** (if significant progress):
   - Update `.claude/MEMORY.md` with ADR links if major decision made

4. **Stage changes**: `git add -A`

5. **Auto-generate commit message** from git diff

6. **Commit and push to current branch**:
   ```bash
   git commit -m "<message>"
   git push origin $(git branch --show-current)
   ```
   Follow @.claude/patterns/git-workflow.md

### Interactive Mode (*sync --ask)
1. **Check current branch** (same as default mode)
2. **Sync with development** (same as step 2 in default mode)
3. **Show diff**: `git diff --stat` and present to user
4. **Ask for summary**: Prompt user for one-line session summary
5. **Update MEMORY.md**: If ADR created, link from MEMORY.md
6. **Commit**: `git commit -m "feat: [user summary]"`
7. **Push**: `git push`

### Memory-Only Mode (*sync --memory)
1. **Check current branch**
2. **Sync with development** (NEW)
3. **Update MEMORY.md** first
4. Then proceed with default sync flow

### Commit-Only Mode (*sync --no-push)
1. **Check current branch**
2. **Sync with development** (NEW)
3. **Update memory** (if needed)
4. **Stage changes**
5. **Commit changes** locally
6. Skip push step (useful for batching commits)

## Output Format
```
## Sync Complete

Branch: issue/138-split-mock-data

Sync with development:
 ✅ Pulled latest development
 ✅ Merged development → current branch (no conflicts)

Changes:
 3 files changed, 45 insertions(+), 12 deletions(-)

Summary: [auto-generated or user-provided]

✅ Committed: [commit message]
✅ Pushed to origin/issue/138-split-mock-data
```

**If conflicts occur**:
```
## Sync Paused - Conflicts Detected

⚠️  Merge conflicts in:
  - app/src/02_modules/debug/adapters/adminApi.ts
  - docs/tests/MOCKING.md

Please resolve manually:
1. Edit conflicted files
2. Stage resolved files: git add <files>
3. Complete merge: git commit
4. Run *sync again
```

## Constraints
- **Sync with development**: ALWAYS sync before committing (ensures feature branch is up-to-date)
- **Conflict handling**: If merge conflicts occur, MUST pause and guide user through resolution
- **Interactive mode**: MUST ask user for summary, never auto-generate
- **MEMORY.md**: Always append, never overwrite
- **First push**: Use `git push -u origin <branch>` for new branches
- **On development branch**: Skip merge step, only pull latest changes
- **On main branch**: Warn user (should not work directly on main)

## Examples

### Example 1: Sync feature branch (happy path)

```bash
*sync
```

**Process**:
1. Current branch: `issue/138-split-mock-data`
2. Fetch and merge `development` → `issue/138-split-mock-data`
3. No conflicts ✅
4. Stage changes
5. Commit: "feat: centralize mock data (#138)"
6. Push to `origin/issue/138-split-mock-data`

**Output**:
```
Branch: issue/138-split-mock-data

Sync with development:
 ✅ Pulled latest development
 ✅ Merged development → current branch (no conflicts)

Changes:
 8 files changed, 359 insertions(+), 80 deletions(-)

✅ Committed: feat: centralize mock data (#138)
✅ Pushed to origin/issue/138-split-mock-data
```

---

### Example 2: Sync with conflicts

```bash
*sync
```

**Process**:
1. Current branch: `issue/115-transaction-list`
2. Fetch and merge `development` → `issue/115-transaction-list`
3. Conflicts detected in `adminApi.ts` ⚠️
4. Pause and guide user

**Output**:
```
⚠️  Merge conflicts detected in:
  - app/src/02_modules/debug/adapters/adminApi.ts

Please resolve conflicts manually:
1. Edit conflicted files (look for <<<<<<< HEAD markers)
2. Stage resolved files: git add app/src/02_modules/debug/adapters/adminApi.ts
3. Complete merge: git commit
4. Run *sync again
```

**User actions**:
1. Open `adminApi.ts` and resolve conflicts
2. `git add app/src/02_modules/debug/adapters/adminApi.ts`
3. `git commit` (merge commit message already prepared)
4. Run `*sync` again to push

---

### Example 3: Sync on development branch

```bash
*sync
```

**Process**:
1. Current branch: `development`
2. Pull latest from `origin/development` (no merge needed)
3. Stage changes
4. Commit and push

**Output**:
```
Branch: development

Sync with development:
 ✅ Pulled latest development (already on development)

Changes:
 2 files changed, 15 insertions(+), 3 deletions(-)

✅ Committed: chore: update documentation
✅ Pushed to origin/development
```

## Benefits of Syncing with Development

✅ **Prevents merge conflicts later**: Catches conflicts early, not when closing PR
✅ **Always up-to-date**: Feature branch includes latest changes from team
✅ **Safer pushes**: Ensures your code works with latest development
✅ **Cleaner history**: Regular small merges better than one big merge at end

## Related
- Files: @.claude/patterns/git-workflow.md
- Commands: *resume, *status, *issue close
