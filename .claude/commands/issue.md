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
   git checkout -b feature/<n>-short-title
   git push -u origin feature/<n>-short-title
   ```

3. **Check for existing feature plan**: `.claude/plans/active/#<n>-*.md`
   - If exists → load steps from plan, proceed to step 6
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

6. Start working on first step from plan (or create plan if missing)

### *issue close <n>
Complete issue #n (with automatic branch cleanup):

1. **Run post-code checklist**: @.prot/checklists/post-code.md

2. **Optional: Run `*audit`** for automated verification
   - Ask user: "Run audit checks? (recommended for T2/T3)"

3. **Verify all steps in issue plan are done** (`.claude/plans/active/#n-*.md`)

4. **Commit final changes on feature branch**:
   ```bash
   git add -A
   git commit -m "feat: complete issue #<n>"
   git push
   ```

5. **Merge to development AND delete feature branch**:
   ```bash
   # Update development
   git checkout development
   git pull origin development
   
   # Merge feature branch
   git checkout feature/<n>-short-title
   git merge development  # Resolve conflicts if any
   git checkout development
   git merge --no-ff feature/<n>-short-title -m "Merge feature/<n>: <title> (#<n>)"
   git push origin development
   
   # ⭐ DELETE FEATURE BRANCH (CRITICAL)
   git branch -d feature/<n>-short-title
   git push origin --delete feature/<n>-short-title
   
   # Clean up merged branches locally
   git branch -v | grep "gone" | awk '{print $1}' | xargs git branch -d
   ```

6. **Close GitHub issue**:
   ```bash
   gh issue close <n> --comment "Completed and merged to development"
   ```

7. **Create/update ADR if major architectural decision made**:
   - Check if decision fits ADR criteria (impacts multiple components)
   - Create `docs/architecture/ADR/NNN-title.md` if yes
   - Add ADR link to MEMORY.md (see @.claude/rules/memory-management.md)

8. **Move plan file from active → archive**:
   ```bash
   mv .claude/plans/active/#<n>-*.md .claude/plans/archive/
   git add .claude/plans/
   git commit -m "Archive issue #<n> plan"
   git push origin development
   ```

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
2. Create ADR if major decision (see step 7 above)
3. Update MEMORY.md with ADR link

## Notes

- One active issue at a time (tracked in `.claude/plans/active/`)
- Large issues should be broken into smaller ones
- Use labels for categorization
- For T2/T3 complexity → use `*plan #<n>` before `*issue pick <n>`

## Related
- Commands: *tier, *review, *sync, *plan
- Templates: `.claude/workflow/templates/`
- Files: `.claude/plans/`, `.claude/MEMORY.md`, `docs/architecture/ADR/`
