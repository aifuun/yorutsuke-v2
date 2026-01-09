---
name: status
category: workflow
requires: [TODO.md, MEMORY.md]
---

# Command: *status

## Purpose
Quick overview of current project state

## Usage
```bash
*status            # Overview (git status + TODO + issues)
*status --diff     # Include file-level diff stats
*status --full     # Include recent commits (last 5)
```

## Workflow

### Default Mode (*status)
1. **Git status**: `git status --short`
2. **Last commit**: `git log -1 --oneline`
3. **Memory summary**: Read first 3 lines from `.claude/MEMORY.md` Current Context
4. **TODO progress**: Count completed/total tasks from `.claude/TODO.md`
5. **Open issues**: `gh issue list --limit 5` (if gh available)

### Diff Mode (*status --diff)
Includes all default info, plus:
6. **Uncommitted changes**: `git diff --stat`
   - Files modified/added/deleted
   - Lines changed (+/-)
7. **Unpushed commits**: `git log origin/HEAD..HEAD --oneline`

### Full Mode (*status --full)
Includes all diff info, plus:
8. **Recent commits**: `git log -5 --oneline --decorate`
9. **Branch info**: Ahead/behind remote
10. **MEMORY.md age**: Warn if last update >7 days

## Output Format

### Default
```
## Project Status

**Branch**: main (clean/dirty)
**Last commit**: abc1234 commit message

**Context**: [one-line summary from MEMORY.md]

**Progress**: 3/5 tasks completed in current milestone
- [x] Task 1
- [ ] Task 2 (next)

**Open Issues**: 2
- #12 Bug: login fails
- #11 Feature: add export
```

### With --diff
```
## Project Status

[... default output ...]

**Uncommitted Changes**:
  M  src/init.js (+45, -12)
  A  .claude/commands/status.md
  D  old-file.js

**Unpushed Commits**: 2
  abc1234 feat: add status command
  def5678 fix: template paths

Total: 3 files changed, 120 insertions(+), 45 deletions(-)
```

## Notes
- Keep output concise (under 20 lines by default)
- Highlight "next" task if any
- Use before `*sync` to review changes
- Diff mode useful for reviewing before commit

## Related
- Commands: *sync, *resume, *next
- Files: @.claude/TODO.md, @.claude/MEMORY.md
