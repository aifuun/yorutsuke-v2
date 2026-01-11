---
name: issue
category: planning
requires: none
---

# Command: *issue

## Purpose
Manage GitHub issues (list, view, pick, close, create)

## Usage
```bash
*issue              # List open issues
*issue <n>          # View issue #n details
*issue pick <n>     # Start working on issue #n
*issue close <n>    # Complete and close issue #n
*issue new <title>  # Create new issue
```

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

1. **View issue details**:
   ```bash
   gh issue view <n>
   ```

2. **Create feature branch from development**:
   ```bash
   # Extract short title from issue (e.g., "Add login feature" → "add-login")
   git checkout development
   git pull origin development
   git checkout -b issue/<n>-<short-title>
   git push -u origin issue/<n>-<short-title>
   ```

3. **Check for existing feature plan**: `.claude/plans/active/#<n>-*.md`
   - If exists → load steps from plan to TODO.md, proceed to step 6
   - If not exists → continue to step 4

4. **Quick assessment** - Does this task involve:
   - Data writes / mutations?
   - State management (forms, wizards)?
   - Payment / critical operations?

5. **If YES to any** (T2/T3 complexity):
   - Suggest: "Complex task detected. Create feature plan first? → `*plan #<n>`"
   - If user agrees → exit and run `*plan #<n>`
   - If user declines → proceed with simple breakdown

   **If NO** (T1 read-only, pure UI/style) → Skip to step 6

6. Break down into steps and update .claude/TODO.md:
   ```markdown
   ## Current Issue: #N - Title

   **Branch**: issue/<n>-<short-title>
   **Tier**: T[1/2/3] (if classified)

   ### Steps
   - [ ] Step 1
   - [ ] Step 2
   ```

7. Start working on first step

### *issue close <n>
Complete issue #n:

1. **Run post-code checklist**: @.prot/checklists/post-code.md

2. **Optional: Run `*audit`** for automated verification
   - Ask user: "Run audit checks? (recommended for T2/T3)"

3. Verify all steps in TODO.md are done

4. **Commit final changes on feature branch**:
   ```bash
   git add -A
   git commit -m "feat: complete issue #<n>"
   git push
   ```

5. **Merge workflow** (follow @.claude/patterns/git-workflow.md):
   ```bash
   # Update from development first
   git checkout development
   git pull origin development
   git checkout issue/<n>-<short-title>
   git merge development  # Resolve conflicts if any

   # Merge back to development
   git checkout development
   git merge --no-ff issue/<n>-<short-title> -m "Merge issue/<n>: <title> (#<n>)"
   git push origin development

   # Delete feature branch
   git branch -d issue/<n>-<short-title>
   git push origin --delete issue/<n>-<short-title>
   ```

6. Close issue:
   ```bash
   gh issue close <n> --comment "Completed and merged to development"
   ```

7. Update MEMORY.md:
   - Record in "Solved Issues" if problems encountered
   - Record in "Best Practices" if learnings worth keeping

8. Clear "Current Issue" in TODO.md

### *issue new <title>
Create new issue:
```bash
gh issue create --title "<title>"
```
Interactively add body content.

## Command Chaining

**After *issue pick <n>**:
- If T2/T3 complexity detected → suggest `*plan #<n>`
- Otherwise → start development directly

**After *issue close <n>**: Suggests `*sync` to commit all changes

## Feature Planning Integration

### Separation of Concerns
- `*issue pick <n>` = **Select** issue and start work (pure)
- `*plan #<n>` = **Plan** feature implementation (detailed)

### When to use `*plan #<n>`
Before `*issue pick <n>` for complex tasks:
1. T2/T3 complexity (data writes, state management)
2. Multi-file changes
3. New architectural patterns

**Flow**: `*plan #<n>` → creates plan → `*issue pick <n>` → loads plan → develop

### *issue new <title> - Issue Template
When creating new issue:
- Use `templates/TEMPLATE-github-issue.md` as guidance
- Follow Step 1 (MVP decomposition) format
- Include: 概要, 验收标准, 技术要点, 测试场景

### *issue close <n> - Archive Plan
When closing issue:
1. Move feature plan: `plans/active/#<n>-*.md` → `plans/archive/`
2. Update TODO.md - remove completed issue
3. Record important decisions in MEMORY.md

## Notes

- One active issue at a time (tracked in TODO.md)
- Large issues should be broken into smaller ones
- Use labels for categorization
- For T2/T3 complexity → use `*plan #<n>` before `*issue pick <n>`

## Related
- Commands: *tier, *review, *sync, *plan
- Templates: `.claude/workflow/templates/`
- Files: `.claude/TODO.md`, `.claude/MEMORY.md`, `.claude/plans/`
