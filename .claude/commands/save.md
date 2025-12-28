# Command: *save

## Purpose
Persist achievements, update memory, and sync with remote repository.

## Steps
- [ ] 1. **Diff**: Run `git diff --stat` and show to user
- [ ] 2. **Summarize**: Ask user for one-line summary of this session's work
- [ ] 3. **Memory**: Append summary to `.claude/MEMORY.md` (Current Context section)
- [ ] 4. **TODO**: Update task markers in `.claude/TODO.md` to reflect completion
- [ ] 5. **Commit**: Run `git add -A && git commit -m "feat: [summary]"`
- [ ] 6. **Push**: Run `git push`

## Output Format
```
## *save

Changes:
 3 files changed, 45 insertions(+), 12 deletions(-)

Summary: [user's summary]

✅ Committed: feat: [summary]
✅ Pushed to origin/main
```

## Constraints
- MUST show diff before committing
- MUST ask user for summary (do not auto-generate)
- MUST append to MEMORY.md, never overwrite
- If push fails, guide user through conflict resolution
