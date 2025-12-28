# Issue Management

GitHub Issues are the source of truth for project tasks.

## Commands

### *issue (no args)
List open issues:
```bash
gh issue list
```

### *issue <n>
View issue #n details:
```bash
gh issue view <n>
```
Analyze requirements and suggest approach.

### *issue pick <n>
Start working on issue #n:

1. View issue details:
   ```bash
   gh issue view <n>
   ```

2. **Quick assessment** - Does this task involve:
   - Data writes / mutations?
   - State management (forms, wizards)?
   - Payment / critical operations?

3. **If YES to any** → Run `*tier` to classify complexity
   **If NO** (read-only, pure UI/style) → Skip to step 4

4. Break down into steps and update .claude/TODO.md:
   ```markdown
   ## Current Issue: #N - Title

   **Tier**: T[1/2/3] (if classified)
   **Pillars**: [A, D, L, ...] (if classified)

   ### Steps
   - [ ] Step 1
   - [ ] Step 2
   ```

5. Update .claude/MEMORY.md current context

6. Start working on first step

### *issue close <n>
Complete issue #n:

1. **Run post-code checklist**: @.prot/checklists/post-code.md

2. **Optional: Run `*audit`** for automated verification
   - Ask user: "Run audit checks? (recommended for T2/T3)"

3. Verify all steps in TODO.md are done

4. Close issue:
   ```bash
   gh issue close <n> --comment "Completed"
   ```

5. Update MEMORY.md:
   - Record in "Solved Issues" if problems encountered
   - Record in "Best Practices" if learnings worth keeping

6. Clear "Current Issue" in TODO.md

### *issue new <title>
Create new issue:
```bash
gh issue create --title "<title>"
```
Interactively add body content.

## Notes

- One active issue at a time (tracked in TODO.md)
- Large issues should be broken into smaller ones
- Use labels for categorization
- Always run `*tier` before starting implementation
