# Show Changes

Show changes since last sync/commit.

## Workflow

1. **Uncommitted changes**:
   ```bash
   git status --short
   git diff --stat
   ```

2. **If changes exist**, show summary:
   - Files modified/added/deleted
   - Lines changed (+/-)

3. **Recent commits** (if any unpushed):
   ```bash
   git log origin/HEAD..HEAD --oneline
   ```

4. **Optionally show full diff**:
   - Ask if user wants to see specific file diff
   - `git diff <file>`

## Output Format

```
## Changes

**Uncommitted**:
  M  src/init.js (+45, -12)
  A  .claude/commands/status.md
  D  old-file.js

**Unpushed commits**: 2
  abc1234 feat: add status command
  def5678 fix: template paths

Total: 3 files changed, 120 insertions, 45 deletions
```

## Notes

- Quick overview without full diff content
- Use before `*save` to review changes
