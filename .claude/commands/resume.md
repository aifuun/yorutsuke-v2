---
name: resume
category: workflow
requires: [MEMORY.md, TODO.md]
---

# Command: *resume

## Purpose
Resume previous session with automatic sync and context loading

## Workflow

1. **Sync first**: Pull latest changes
   ```bash
   git pull --rebase
   ```
   - If conflicts, notify user and pause

2. **Load context**: Read "Current Context" from .claude/MEMORY.md

3. **Check progress**: Read .claude/TODO.md for current milestone status

4. **Health check**:
   - If MEMORY.md has >20 entries in any section, suggest `*tidy`
   - If TODO.md has stale tasks (>30 days), mention it

5. **Remind workflow**: Mention workflow guide for new users
   - "For full workflow, see: @.claude/WORKFLOW.md"

6. **Summarize**: Show previous state and ask what to continue

## Output Format

```
## Session Resumed

**Last session**: [summary from MEMORY.md]
**Progress**: 3/5 tasks in current milestone

Ready to continue. What would you like to work on?
```

## CLI Reminder

After resuming, briefly mention global CLI commands:

```
💡 Global CLI: ltd update <path> | ltd snapshot <path>
```
