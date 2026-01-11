# ADR-009: Branch-First Workflow Rule

**Status**: Accepted  
**Date**: 2026-01  
**Issue**: Process improvement (triggered by #115)  
**Author**: Claude (AI Assistant)

## Context

In collaborative AI-assisted development, the workflow must be strict about version control discipline:

**Problem**: Started Issue #115 directly on `development` branch without creating a feature branch first.

**Risk**:
- Accidental commits to main branches
- No safe rollback if code doesn't work
- Conflicts if multiple people work simultaneously
- Unclear which branch contains which feature

**Root Cause**:
1. `*next` command lacks branch creation automation
2. No explicit "branch-first" rule in AI workflow guidelines

## Decision

**ALWAYS create a feature branch BEFORE any code changes.** This is a CRITICAL pre-condition for starting work on any issue.

### Branch Naming Convention

```
feature/#XXX-short-description    (new features)
bugfix/#XXX-short-description     (bug fixes)
hotfix/#XXX-short-description     (urgent production fixes)
```

**Examples**:
- `feature/115-unified-filter-bar`
- `bugfix/47-quota-not-persisted`
- `hotfix/88-database-locked-error`

### Pre-Coding Checklist

**BEFORE writing any code**, verify all of these:

```
Git Branch Checklist
==================
- [ ] NOT on `development` or `master` branch
- [ ] Branch name follows convention
  - [ ] Prefixed: feature/ | bugfix/ | hotfix/
  - [ ] Issue number: #XXX
  - [ ] Description: kebab-case
- [ ] Created from latest `development`
- [ ] Committed and pushed to origin (for safety)

Example:
✅ git branch --show-current
   feature/115-unified-filter-bar
```

### Proper Workflow

```bash
# 1. Check current branch
git branch --show-current
# Output: development

# 2. If on development/master, pull latest
git checkout development
git pull origin development

# 3. Create feature branch
git checkout -b feature/115-unified-filter-bar
git push origin feature/115-unified-filter-bar

# 4. NOW start coding
# (safe to experiment, easy to rollback)

# 5. When done
git push origin feature/115-unified-filter-bar
# Create PR: GitHub UI
```

### Why Branch-First?

| Benefit | Impact |
|---------|--------|
| **Safe experimentation** | Code can be rewritten without affecting `development` |
| **Easy rollback** | If something breaks, delete branch and start over |
| **Clean history** | Final commit to `development` is merge commit, not messy inline commits |
| **Parallel development** | Multiple people can work on different features simultaneously |
| **Clear attribution** | Branch name tells you exactly what was being worked on |
| **PR review** | Code review happens before merge (GitHub PR review) |

### Implementation: Command Automation

**`*next` command enhancement** (future improvement):
```bash
*next #115
→ Creates branch: feature/115-[title-from-github]
→ Prints: "Branch created: feature/115-..."
→ Checks out branch automatically
```

**Until then**: Manual step:
```bash
# User confirms issue
# AI creates branch
git checkout -b feature/#XXX-short-description
git push origin feature/#XXX-short-description
# AI confirms: "Branch created and checked out"
```

### Exceptions

**None.** Even for small bugfixes or hotfixes, use the appropriate branch prefix.

**Exception Override** (if absolutely necessary):
- Only with explicit user approval
- Document reason in PR description
- Not recommended

## Consequences

**Positive**:
- ✅ Safe code experimentation (no risk to `development`)
- ✅ Clear audit trail (branch per feature)
- ✅ Easy team collaboration (no merge conflicts on main)
- ✅ Enables proper PR review workflow
- ✅ Aligns with Git best practices

**Negative**:
- ❌ One extra step at session start (2 minutes)
- ❌ Requires automation to be frictionless

## Implementation Status

- ✅ Rule documented (this ADR)
- ✅ Documented in `.claude/rules/workflow.md`
- ✅ Added to `.claude/WORKFLOW.md`
- 🔄 `*next` command to auto-create branches (future)
- ✅ Team alignment (explicit expectation)

## Remediation for Existing Work

**If you're on `development` branch with uncommitted changes**:

```bash
# 1. Stash changes
git stash

# 2. Create feature branch
git checkout -b feature/#XXX-short-description

# 3. Pop changes back
git stash pop

# 4. Commit and push
git add .
git commit -m "feat(#XXX): title"
git push origin feature/#XXX-short-description
```

## Enforcement

**AI Assistant Checklist** (at session start):
```
Before starting work:
- [ ] Confirm GitHub issue number
- [ ] Run: git branch --show-current
- [ ] If not on feature/bugfix/hotfix branch → Create it
- [ ] Check branch name matches convention
- [ ] Push to origin immediately
```

## References

- `.claude/rules/workflow.md` - Full workflow documentation
- `.claude/WORKFLOW.md` - Main workflow index
- Git Best Practices: https://git-scm.com/book/en/v2/Git-Branching-Branching-Workflows

## Related Issues

- #115: Starting issue that triggered this rule
- #105: Code Commands Optimization (similar workflow improvements)
