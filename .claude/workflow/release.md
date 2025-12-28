# Phase D: Release

> Load when preparing a new version release

## When to Use

- Releasing a new version
- Creating release notes
- Publishing to npm/crates.io
- Deploying infrastructure changes

## Command

```
*release [patch|minor|major]
```

> See `commands/release.md` for detailed workflow

## Quick Reference

| Version Type | When | Example |
|--------------|------|---------|
| `patch` | Bug fixes | 0.1.0 → 0.1.1 |
| `minor` | New features | 0.1.0 → 0.2.0 |
| `major` | Breaking changes | 0.1.0 → 1.0.0 |

## Post-Release

- [ ] Verify deployment/publish
- [ ] Announce release (if needed)
- [ ] Update MEMORY.md with release notes
- [ ] Close milestone

---

## Hotfix Workflow

For urgent production bugs:

### 1. Create hotfix branch
```bash
git checkout main
git pull
git checkout -b hotfix/issue-description
```

### 2. Fix and test
- Minimal change to fix the issue
- Run tests: `npm test`

### 3. Release
```bash
*release patch
```

### 4. Merge back
```bash
git checkout main
git merge hotfix/issue-description
git push
git branch -d hotfix/issue-description
```

### 5. Deploy immediately
```bash
*cdk deploy  # if infrastructure affected
```
