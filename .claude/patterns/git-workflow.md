# Git Workflow Patterns

Shared git operations for commands (sync, release, cdk).

## Branch Strategy (Git Flow)

```
main (production releases)
 │
 ├── hotfix/xxx ──────────────────┐
 │   └── From main, merge back    │
 │       to main + development    │
 │                                │
 ▼                                │
development (integration)  ◄──────┘
 │
 ├── feature/xxx ─────────────────┐
 ├── issue/xxx                    │ From development,
 └── bugfix/xxx                   │ merge back to development
     └──────────────────────────────┘
```

### Branch Types

| Branch | Base | Purpose | Merge To |
|--------|------|---------|----------|
| `main` | - | Production releases | - |
| `development` | main | Integration branch | main (release) |
| `feature/<n>-desc` | development | New features | development |
| `issue/<n>-desc` | development | Issue work | development |
| `bugfix/<desc>` | development | Bug fixes (dev) | development |
| `hotfix/<desc>` | main | Production fixes | main + development |

### Branch Naming

```bash
feature/123-add-login      # Feature with issue number
issue/456-fix-typo         # Issue work
bugfix/navbar-overflow     # Bug fix on development
hotfix/critical-auth       # Production hotfix
```

### Feature/Issue Branch Workflow

```bash
# 1. Create from development
git checkout development
git pull origin development
git checkout -b issue/123-feature-name

# 2. Develop and commit
git add -A
git commit -m "feat: add feature (#123)"

# 3. Before merge: update from development
git checkout development
git pull origin development
git checkout issue/123-feature-name
git merge development  # Resolve conflicts if any

# 4. Merge back to development
git checkout development
git merge --no-ff issue/123-feature-name -m "Merge issue/123-feature-name"
git push origin development

# 5. Delete feature branch
git branch -d issue/123-feature-name
git push origin --delete issue/123-feature-name
```

### Hotfix Workflow

```bash
# 1. Create from main
git checkout main
git pull origin main
git checkout -b hotfix/critical-fix

# 2. Fix and commit
git commit -m "fix: critical security issue"

# 3. Merge to main
git checkout main
git merge --no-ff hotfix/critical-fix
git tag -a v1.0.1 -m "Hotfix release"
git push origin main --tags

# 4. Sync to development (IMPORTANT!)
git checkout development
git merge main
git push origin development

# 5. Delete hotfix branch
git branch -d hotfix/critical-fix
```

### Release Workflow

```bash
# 1. Ensure development is ready
git checkout development
git pull origin development

# 2. Merge to main
git checkout main
git pull origin main
git merge --no-ff development -m "Release v1.1.0"

# 3. Tag release
git tag -a v1.1.0 -m "Release v1.1.0"
git push origin main --tags

# 4. Sync tag to development
git checkout development
git merge main
git push origin development
```

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
- Clear plans/active/ completed tasks
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
