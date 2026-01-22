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
Complete issue #n (using Pull Request workflow):

1. **Run post-code checklist**: @.prot/checklists/post-code.md

2. **Optional: Run `*audit`** for automated verification
   - Ask user: "Run audit checks? (recommended for T2/T3)"

3. **Verify all steps in issue plan are done** (`.claude/plans/active/#n-*.md`)

4. **Commit final changes on feature branch**:
   ```bash
   git add -A
   git commit -m "feat: complete issue #<n>

   - Feature summary here
   - Implementation details
   - Test results

   Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
   git push origin feature/<n>-short-title
   ```

5. **Create Pull Request to development**:
   ```bash
   # Create PR with detailed summary
   gh pr create \
     --base development \
     --title "feat: <Issue Title> (#<n>)" \
     --body "$(cat <<'EOF'
   ## Summary
   Closes #<n>

   **Implementation**:
   - Feature 1
   - Feature 2

   **Testing**:
   - ✅ All tests passing (X/X)
   - ✅ Lint clean
   - ✅ Build successful

   **Documentation**:
   - Updated relevant docs

   **Files Changed**:
   - file1.ts (+X lines)
   - file2.ts (+Y lines)

   🤖 Generated with [Claude Code](https://claude.com/claude-code)
   EOF
   )"
   ```

6. **Wait for PR review and merge**:
   - PR will be reviewed by team
   - Address review comments if any
   - After approval, PR will be merged to development
   - GitHub will automatically close the linked issue

7. **After PR merged - Clean up feature branch**:
   ```bash
   # Switch to development and pull merged changes
   git checkout development
   git pull origin development

   # Delete local feature branch
   git branch -d feature/<n>-short-title

   # Delete remote feature branch (if not auto-deleted by GitHub)
   git push origin --delete feature/<n>-short-title

   # Clean up other merged branches
   git branch -v | grep "gone" | awk '{print $1}' | xargs git branch -d
   ```

8. **Create/update ADR if major architectural decision made**:
   - Check if decision fits ADR criteria (impacts multiple components)
   - Create `docs/architecture/ADR/NNN-title.md` if yes
   - Add ADR link to MEMORY.md (see @.claude/rules/memory-management.md)

9. **Archive plan file**:
   ```bash
   # After PR merged
   mv .claude/plans/active/#<n>-*.md .claude/plans/archive/
   git add .claude/plans/
   git commit -m "chore: archive issue #<n> plan"
   git push origin development
   ```

**Note**: Issue will be automatically closed when PR is merged (via "Closes #N" in PR body)

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

## Pull Request Workflow

### Why Use PRs?

| Benefit | Description |
|---------|-------------|
| **Code Review** | Team can review changes before merge |
| **CI/CD Integration** | Automated tests run on PR |
| **Discussion** | Centralized place for feedback |
| **Documentation** | PR history provides context for changes |
| **Rollback Safety** | Easy to identify what was merged |

### PR Best Practices

#### 1. **Commit Message Format**
```bash
# Use conventional commits
feat: add user authentication (#123)
fix: resolve memory leak in logger (#158)
docs: update API documentation (#200)
chore: upgrade dependencies (#250)
```

#### 2. **PR Title Format**
```
<type>: <Issue Title> (#<issue-number>)

Examples:
feat: Tauri Logger Enhancement (#158)
fix: Transaction Type Mismatch (#165)
docs: Update Design System Guide (#170)
```

#### 3. **PR Body Structure**
```markdown
## Summary
Closes #<n>

Brief description of what this PR does.

## Implementation
- Key change 1
- Key change 2
- Key change 3

## Testing
- ✅ All tests passing (58/58)
- ✅ Lint clean (0 warnings)
- ✅ Build successful
- ✅ Manual testing completed

## Documentation
- Updated LOGGING.md
- Added usage examples

## Files Changed
- src/path/to/file.ts (+258 lines)
- docs/operations/LOGGING.md (+214 lines)

## Breaking Changes
None / List breaking changes here

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

#### 4. **Link Issue to PR**
```markdown
# In PR body, use keywords to auto-close issue
Closes #158
Fixes #165
Resolves #170

# GitHub will automatically close the issue when PR is merged
```

#### 5. **Clean Commit History**
```bash
# Before creating PR, clean up commits if needed
git rebase -i development  # Interactive rebase

# Squash "WIP" or "fix typo" commits
# Keep meaningful commit messages
```

### PR Review Checklist

Before submitting PR, verify:
- [ ] All tests passing locally
- [ ] Lint clean (no warnings)
- [ ] Build successful
- [ ] Documentation updated
- [ ] Commit message follows format
- [ ] PR body is complete
- [ ] Issue is linked (Closes #N)
- [ ] No merge conflicts with development

### After PR Merged

1. **Pull latest development**:
   ```bash
   git checkout development
   git pull origin development
   ```

2. **Clean up feature branch**:
   ```bash
   git branch -d feature/<n>-short-title
   git push origin --delete feature/<n>-short-title
   ```

3. **Archive plan files**:
   ```bash
   mv .claude/plans/active/#<n>-*.md .claude/plans/archive/
   git add .claude/plans/
   git commit -m "chore: archive issue #<n> plan"
   git push origin development
   ```

4. **Verify issue is closed**:
   ```bash
   gh issue view <n>  # Should show "Status: Closed"
   ```

## Notes

- One active issue at a time (tracked in `.claude/plans/active/`)
- Large issues should be broken into smaller ones
- Use labels for categorization
- For T2/T3 complexity → use `*plan #<n>` before `*issue pick <n>`
- **Always use PRs** for merging to development (enables review and CI/CD)

## Related
- Commands: *tier, *review, *sync, *plan
- Templates: `.claude/workflow/templates/`
- Files: `.claude/plans/`, `.claude/MEMORY.md`, `docs/architecture/ADR/`
- GitHub CLI: `gh pr create`, `gh pr list`, `gh pr merge`
