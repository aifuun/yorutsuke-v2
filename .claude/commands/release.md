# Release

Create a new version release.

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

1. **Verify clean state**
   ```bash
   git status
   npm test
   ```

2. **Bump version**
   ```bash
   npm version <patch|minor|major>
   ```

3. **Update CHANGELOG.md**
   ```markdown
   ## [x.y.z] - YYYY-MM-DD

   ### Added
   - New features

   ### Changed
   - Modified behavior

   ### Fixed
   - Bug fixes
   ```

4. **Commit and tag**
   ```bash
   git add CHANGELOG.md
   git commit --amend --no-edit
   git push origin main --tags
   ```

5. **Create GitHub release**
   ```bash
   gh release create v<version> --notes-file CHANGELOG.md
   ```

6. **Publish** (if applicable)
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
