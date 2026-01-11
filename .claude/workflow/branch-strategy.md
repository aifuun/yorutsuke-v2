# Git Flow Branch Strategy

Complete guide to the Git Flow branching model used in this project.

## Branch Structure

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

## Branch Types

| Branch | Base | Merge To | Lifetime | Command |
|--------|------|----------|----------|---------|
| `main` | - | - | Permanent | - |
| `development` | main | main (release) | Permanent | - |
| `issue/<n>-desc` | development | development | Days | `*issue pick <n>` |
| `feature/<n>-desc` | development | development | Days-Weeks | `*issue pick <n>` |
| `bugfix/<desc>` | development | development | Hours-Days | `*bugfix start` |
| `hotfix/<desc>` | main | main + development | Hours | `*hotfix start` |

## Naming Conventions

```bash
# Issue/Feature branches (from development)
issue/123-add-login-button
feature/45-user-authentication

# Bug fix on development
bugfix/navbar-overflow
bugfix/form-validation-error

# Production hotfix (from main)
hotfix/critical-auth-bypass
hotfix/payment-calculation-fix
```

## Workflow: Issue/Feature

**Command**: `*issue pick <n>` → `*issue close <n>`

```bash
# 1. Create branch from development
git checkout development
git pull origin development
git checkout -b issue/123-feature-name

# 2. Work and commit
git add -A
git commit -m "feat: add feature (#123)"
git push origin issue/123-feature-name

# 3. Before merge: sync with development
git checkout development
git pull origin development
git checkout issue/123-feature-name
git merge development  # Resolve conflicts

# 4. Merge back to development
git checkout development
git merge --no-ff issue/123-feature-name -m "Merge issue/123"
git push origin development

# 5. Delete branch
git branch -d issue/123-feature-name
git push origin --delete issue/123-feature-name
```

## Workflow: Bugfix

**Command**: `*bugfix start <desc>` → `*bugfix finish`

```bash
# 1. Create from development
git checkout development
git pull origin development
git checkout -b bugfix/form-validation

# 2. Fix and commit
git add -A
git commit -m "fix: form validation error"
git push origin bugfix/form-validation

# 3. Merge to development (same as issue)
git checkout development
git merge --no-ff bugfix/form-validation
git push origin development

# 4. Delete branch
git branch -d bugfix/form-validation
git push origin --delete bugfix/form-validation
```

## Workflow: Hotfix

**Command**: `*hotfix start <desc>` → `*hotfix finish`

```bash
# 1. Create from main (production)
git checkout main
git pull origin main
git checkout -b hotfix/critical-fix

# 2. Fix and commit
git add -A
git commit -m "fix: critical security issue (hotfix)"
git push origin hotfix/critical-fix

# 3. Merge to main
git checkout main
git merge --no-ff hotfix/critical-fix
git tag -a v1.0.1 -m "Hotfix v1.0.1"
git push origin main --tags

# 4. CRITICAL: Sync to development
git checkout development
git merge main
git push origin development

# 5. Delete branch
git branch -d hotfix/critical-fix
git push origin --delete hotfix/critical-fix
```

## Workflow: Release

**Command**: `*release [patch|minor|major]`

```bash
# 1. Verify development is ready
git checkout development
git pull origin development
npm test

# 2. Merge to main
git checkout main
git pull origin main
git merge --no-ff development -m "Release v1.1.0"

# 3. Tag release
npm version minor  # or patch/major
git push origin main --tags

# 4. Sync back to development
git checkout development
git merge main
git push origin development
```

## Quick Reference

| Situation | Branch From | Command |
|-----------|-------------|---------|
| New feature/issue | development | `*issue pick <n>` |
| Bug in development | development | `*bugfix start <desc>` |
| Bug in production | main | `*hotfix start <desc>` |
| Ready to release | development | `*release` |

## Best Practices

1. **Keep branches short-lived** - Merge within days, not weeks
2. **Always sync before merge** - Pull base branch first
3. **Use `--no-ff` for merges** - Preserves branch history
4. **Hotfix MUST sync to dev** - Prevents regression in next release
5. **One branch per issue** - Clear tracking and history
6. **Delete merged branches** - Keep repository clean

## Related

- **Pattern file**: `.claude/patterns/git-workflow.md`
- **Commands**: `issue.md`, `bugfix.md`, `hotfix.md`, `release.md`
- **Quick reference**: `.claude/WORKFLOW.md` (Branch Strategy section)
