# Project Status

Quick overview of current project state.

## Workflow

1. **Git Status**: Run `git status --short` and `git log -1 --oneline`
2. **Memory Summary**: Read first 5 lines of "Current Context" from .claude/MEMORY.md
3. **TODO Summary**: Count completed/total tasks in current milestone from .claude/TODO.md
4. **Issues**: Run `gh issue list --limit 5` (if gh available)

## Output Format

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

## Notes

- Keep output concise (under 20 lines)
- Highlight the "next" task if any
- Show warning if MEMORY.md is outdated (>7 days)
