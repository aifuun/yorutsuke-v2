# Git Workflow Patterns

Shared git operations for commands (sync, release, cdk).

## Standard Commit Flow

1. **Check status**: `git status --short`
2. **Stage files**: `git add -A`
3. **Commit**: `git commit -m "type: message"`
4. **Pull with rebase**: `git pull --rebase`
5. **Push**: `git push`

## Commit Message Format

Use conventional commits:
- `feat:` New feature
- `fix:` Bug fix
- `chore:` Maintenance (docs, config, tooling)
- `refactor:` Code restructuring without behavior change
- `test:` Test additions or updates
- `docs:` Documentation only

Example: `feat: add user authentication (#42)`

## Conflict Resolution

If `git pull --rebase` fails with conflicts:

1. **Notify user**: "Conflicts detected in [file list]"
2. **List conflicted files**: `git status --short | grep "^UU"`
3. **Pause execution**: Wait for manual resolution
4. **Guide user**:
   ```
   Please resolve conflicts manually:
   1. Edit conflicted files
   2. Stage resolved files: git add <files>
   3. Continue rebase: git rebase --continue
   4. Run command again
   ```

## Branch Protection

- **Never force push** to main/master without explicit user confirmation
- **Check for uncommitted changes** before operations
- **Verify remote exists** before push: `git remote -v`
- **First-time push**: Use `git push -u origin <branch>` for new branches

## Pre-Commit Checks

Before committing:
- [ ] Run tests (if applicable)
- [ ] Check for large files (>5MB)
- [ ] Verify no secrets in staged files (.env, credentials)

## Post-Push Actions

After successful push:
- Update MEMORY.md with session summary (if significant)
- Clear TODO.md completed tasks
- Close related GitHub issues

## Common Scenarios

### Amend Last Commit
```bash
git add <files>
git commit --amend --no-edit
git push --force-with-lease
```
**Warning**: Only amend unpushed commits

### Undo Last Commit (keep changes)
```bash
git reset --soft HEAD~1
```

### Undo Last Commit (discard changes)
```bash
git reset --hard HEAD~1
```
**Warning**: Destructive operation, confirm with user

## Usage in Commands

Reference this pattern:
```markdown
## Workflow
1. **Commit changes**: Follow @.claude/patterns/git-workflow.md
2. ...
```

Used by:
- `sync.md` - All commit/push operations
- `release.md` - Version tagging and push
- `cdk.md` - Post-deploy commits
