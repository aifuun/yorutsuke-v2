# File Creation Rules

> CRITICAL: Prevent temporary files from polluting the project root directory.

## Golden Rule

**NEVER create files in the project root directory except for updating existing documentation.**

## Allowed Operations

### ✅ READ Operations (Always Safe)
```
Read, Glob, Grep, LSP, Bash (read-only commands)
```

### ✅ WRITE to Existing Files
- `CLAUDE.md` - Project documentation updates
- `README.md` - User-facing readme updates
- Files in `docs/` - Architecture, design, operations docs
- Files in code directories (`app/`, `infra/`, `admin/`)

### ✅ CREATE in Specific Locations

| Location | Purpose | Examples |
|----------|---------|----------|
| `.claude/plans/active/` | Feature plans, issue analysis | `#145-remove-intentid.md` |
| `.claude/plans/archive/` | Completed plans | `feature-123-*.md` |
| `docs/architecture/ADR/` | Architecture Decision Records | `ADR-006-*.md` |
| `app/src/**/*.ts(x)` | Application code | Components, services, adapters |
| `infra/lambda/**/*.mjs` | Lambda functions | Handler code |
| `scripts/` | Utility scripts | `sync-env.sh`, `deploy.sh` |

## Forbidden Operations

### ❌ NEVER Create in Root Directory

**Forbidden files**:
```
ANALYSIS_*.md
IMPLEMENTATION_*.md
QUICK_*.md
SAFETY_*.md
SYNC_*.md
POTENTIAL_*.md
*.sh (except in scripts/)
*.txt (temporary notes)
temp-*.* (any temporary files)
```

**Forbidden directories**:
```
archives/
temp/
output/
analysis/
```

### ❌ NEVER Create Plan Files Outside `.claude/plans/`

If you need to write analysis or implementation notes:
- Use `.claude/plans/active/` for ongoing work
- Use `.claude/plans/archive/` for completed work
- NEVER write to root directory

## Decision Tree

```
Need to create a file?
│
├─ Is it temporary analysis/notes?
│  └─ YES → .claude/plans/active/
│
├─ Is it a completed feature plan?
│  └─ YES → .claude/plans/archive/
│
├─ Is it an architecture decision?
│  └─ YES → docs/architecture/ADR/
│
├─ Is it application code?
│  └─ YES → app/src/**/ (proper module structure)
│
├─ Is it infrastructure code?
│  └─ YES → infra/lib/ or infra/lambda/
│
├─ Is it a utility script?
│  └─ YES → scripts/
│
├─ Is it updating existing docs?
│  └─ YES → Use Edit tool on existing file
│
└─ Otherwise → DON'T CREATE IT
```

## Quick Reference

### When User Says "Create a plan"
```typescript
// ✅ CORRECT
Write('.claude/plans/active/#145-feature-name.md', content)

// ❌ WRONG
Write('IMPLEMENTATION_PLAN.md', content)
```

### When Analyzing Issues
```typescript
// ✅ CORRECT - No file creation needed
// Just output analysis in conversation

// ❌ WRONG
Write('ANALYSIS_RESULTS.md', content)
```

### When Creating ADR
```typescript
// ✅ CORRECT
Write('docs/architecture/ADR/007-decision-name.md', content)

// ❌ WRONG
Write('ADR_DRAFT.md', content)
```

## Checklist Before Creating File

- [ ] Is this file absolutely necessary?
- [ ] Can I just output in conversation instead?
- [ ] Is the target directory in the allowed list?
- [ ] Is the file name descriptive and follows project convention?
- [ ] Will this file be committed to git?
- [ ] Have I checked existing files with same purpose?

## Exception Handling

**If unsure where to create a file**:
1. Output content in conversation
2. Ask user where to save it
3. User decides the location

**If user explicitly requests file creation**:
1. Verify the location with user first
2. Suggest proper location if they chose root directory
3. Only create after confirmation

## Examples

### ❌ Bad (Previous Mistake)
```
Write('SAFETY_FIXES_APPLIED.md', ...)          # Root pollution
Write('SYNC_SCHEDULE.txt', ...)                # Temporary note
Write('STATUS_CHECK.sh', ...)                  # Script in wrong place
```

### ✅ Good
```
Write('.claude/plans/active/sync-analysis.md', ...)    # Proper location
Write('docs/architecture/SYNC_FLOW.md', ...)           # Permanent doc
Write('scripts/check-status.sh', ...)                  # Utility script
```

## Emergency Cleanup

If temporary files are accidentally created in root:
```bash
# 1. Delete immediately
rm TEMP_FILE.md

# 2. If already committed
git rm TEMP_FILE.md
git commit -m "chore: remove temporary file"
git push origin development
```

## Summary

**Simple Rule**: If it's not code, docs, or scripts in proper directories → **DON'T CREATE IT**.

When in doubt:
1. Output in conversation
2. Ask user first
3. Never assume root directory is OK
