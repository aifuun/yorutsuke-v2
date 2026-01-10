# Memory Protection Rules

These rules protect project memory files from accidental corruption.

## MEMORY.md

**Mode**: APPEND ONLY (no confirm)

- Never overwrite or delete existing content
- Use Edit tool to append new entries at section end (no permission prompt)
- Every entry must have date prefix: `[YYYY-MM]`
- Format for new entries:
  ```markdown
  ### [YYYY-MM] Title
  - **Decision**: What was decided
  - **Reason**: Why this decision
  - **Alternatives**: What was considered
  ```

## TODO.md

**Mode**: MODIFY WITH CARE

- ✅ Allowed: Change `[ ]` to `[x]`
- ✅ Allowed: Add new tasks to end of section
- ✅ Allowed: Remove completed tasks (move to Recently Completed)
- ❌ Forbidden: Delete incomplete tasks without confirmation
- ❌ Forbidden: Reorder tasks without reason

## archive/

**Mode**: WRITE ONLY

- Only write when archiving old MEMORY.md entries
- Never read unless user explicitly requests
- File naming: `YYYY-MM.md`
- Always append, never overwrite existing archives

## INBOX.md

**Mode**: PROCESS AND CLEAR

- Read when resuming session
- Process items into appropriate locations
- Clear after processing (with user confirmation)
