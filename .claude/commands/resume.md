---
name: resume
category: workflow
requires: [MEMORY.md, .claude/plans/active/]
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

2. **Load context**: Read ADR index from `.claude/MEMORY.md` (architecture decisions only)

3. **Check active plans**: List `.claude/plans/active/` for ongoing issues

4. **Health check**:
   - If active plans are stale (>7 days), ask if still relevant
   - If MEMORY.md size > 50 lines, suggest creating ADRs for any embedded content

5. **Remind workflow**: Mention workflow guide for new users
   - "For full workflow, see: @.claude/WORKFLOW.md"

6. **Summarize**: Show previous state and ask what to continue

## Output Format

```
## Session Resumed

**Recent decisions**: [top 3 ADRs from MEMORY.md]
**Active plans**: 2 (Issues #115, #118 in progress)

Ready to continue. What would you like to work on?
```

## Related
- Commands: *status, *next
- Files: @.claude/MEMORY.md, @.claude/plans/active/
- Workflow: @.claude/WORKFLOW.md
