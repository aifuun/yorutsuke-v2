# Sync

Save progress and sync with remote.

## Workflow

1. **Update memory** (if significant progress):
   - `.claude/MEMORY.md`: Current Context, decisions made
   - `.claude/TODO.md`: Mark completed, add new tasks

2. **Commit**:
   ```bash
   git add -A
   git commit -m "chore: [brief summary]"
   ```

3. **Pull & Push**:
   ```bash
   git pull --rebase
   git push
   ```

4. **Report**: Show sync result

## Notes

- Auto-generates commit message from changes
- If conflicts, pause and help resolve
- For first-time push, use `git push -u origin <branch>`
