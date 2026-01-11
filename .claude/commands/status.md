---
name: status
category: workflow
requires: [MEMORY.md, .claude/plans/active/]
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
3. **Memory summary**: Read ADR index from `.claude/MEMORY.md`
4. **Active plans**: List active plans in `.claude/plans/active/`
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
10. **MEMORY.md health**: Check if ADR links are fresh (any stale references)

## Output Format

### Default
```
## Project Status

**Branch**: main (clean/dirty)
**Last commit**: abc1234 commit message

**Recent decisions**: [top ADRs from MEMORY.md index]

**Active plans**: 2
- Issue #115: Transaction filters
- Issue #118: Offline CRUD testing

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
- Files: @.claude/MEMORY.md, @.claude/plans/active/
