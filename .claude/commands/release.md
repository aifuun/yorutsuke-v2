---
name: release
category: infrastructure
requires: none
---

# Command: *release

## Purpose
Create a new version release with changelog and GitHub release

## Usage

```
*release              # Interactive release (prompts for version type)
*release patch        # Bug fix release (0.1.0 → 0.1.1)
*release minor        # New feature release (0.1.0 → 0.2.0)
*release major        # Breaking change release (0.1.0 → 1.0.0)
```

## Pre-Release Checklist

Before proceeding, verify:
- [ ] All issues for milestone closed
- [ ] Tests passing (`npm test`)
- [ ] Documentation updated
- [ ] No uncommitted changes (`git status`)

## Workflow

1. **Verify clean state on development**
   ```bash
   git checkout development
   git pull origin development
   git status
   npm test
   ```

2. **Merge development to main**
   ```bash
   git checkout main
   git pull origin main
   git merge --no-ff development -m "Release v<version>"
   ```

3. **Bump version** (on main)
   ```bash
   npm version <patch|minor|major>
   ```

4. **Update CHANGELOG.md**
   ```markdown
   ## [x.y.z] - YYYY-MM-DD

   ### Added
   - New features

   ### Changed
   - Modified behavior

   ### Fixed
   - Bug fixes
   ```

5. **Commit and tag**
   ```bash
   git add CHANGELOG.md
   git commit --amend --no-edit
   git push origin main --tags
   ```

6. **Sync release back to development**
   ```bash
   git checkout development
   git merge main
   git push origin development
   ```

7. **Create GitHub release**
   ```bash
   gh release create v<version> --notes-file CHANGELOG.md
   ```

8. **Publish** (if applicable)
   ```bash
   npm publish          # npm package
   cargo publish        # Rust crate
   ```

## Output Format

```
## Release Summary

**Version**: x.y.z
**Type**: patch/minor/major
**Tag**: vx.y.z

### Changes
- [List from CHANGELOG]

### Actions Completed
- [x] Version bumped
- [x] CHANGELOG updated
- [x] Git tagged
- [x] GitHub release created
- [ ] Published (manual step)

**Release URL**: https://github.com/...
```

## Notes

- Always run tests before release
- Update CHANGELOG before tagging
- For CDK deployments, use `*cdk deploy` separately

## Related
- Commands: *sync, *cdk
- Workflow: @.claude/patterns/git-workflow.md
- Files: CHANGELOG.md, package.json
