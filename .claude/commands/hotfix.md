---
name: hotfix
category: workflow
requires: none
---

# Command: *hotfix

## Purpose
Fix critical production bugs using proper Git Flow workflow.
Hotfixes are created from main and merged back to BOTH main AND development.

## Usage
```bash
*hotfix start <desc>   # Create hotfix branch from main
*hotfix finish         # Merge hotfix to main + development
*hotfix                # Show current hotfix status
```

## Commands

### *hotfix (no args)
Show current hotfix status:
```bash
git branch --show-current
git status --short
```

### *hotfix start <desc>
Create hotfix branch from main:

1. **Ensure clean state**:
   ```bash
   git status --short
   ```
   - If uncommitted changes, ask to stash or commit first

2. **Create hotfix branch from main**:
   ```bash
   git checkout main
   git pull origin main
   git checkout -b hotfix/<desc>
   git push -u origin hotfix/<desc>
   ```

3. **Update TODO.md**:
   ```markdown
   ## Current Hotfix: <desc>

   **Branch**: hotfix/<desc>
   **Urgency**: PRODUCTION FIX

   ### Steps
   - [ ] Identify root cause
   - [ ] Implement minimal fix
   - [ ] Test fix locally
   - [ ] Verify no regression
   ```

4. Start working on the fix

### *hotfix finish
Complete hotfix and merge to main + development:

1. **Verify fix is complete**:
   - Fix is minimal and targeted
   - Tests passing
   - TODO.md steps completed

2. **Commit final changes**:
   ```bash
   git add -A
   git commit -m "fix: <desc> (hotfix)"
   git push
   ```

3. **Merge to main**:
   ```bash
   git checkout main
   git pull origin main
   git merge --no-ff hotfix/<desc> -m "Hotfix: <desc>"
   ```

4. **Tag hotfix release** (optional, ask user):
   ```bash
   # If version bump needed
   npm version patch
   git push origin main --tags
   ```

5. **CRITICAL: Sync to development**:
   ```bash
   git checkout development
   git pull origin development
   git merge main -m "Sync hotfix/<desc> from main"
   git push origin development
   ```

6. **Delete hotfix branch**:
   ```bash
   git branch -d hotfix/<desc>
   git push origin --delete hotfix/<desc>
   ```

7. **Clear TODO.md** hotfix section

## Output Format

### *hotfix start
```
## Hotfix Started

**Branch**: hotfix/<desc>
**Base**: main (production)

IMPORTANT: This is a production hotfix.
- Keep changes minimal
- Test thoroughly before finishing
- Run `*hotfix finish` when done
```

### *hotfix finish
```
## Hotfix Complete

**Branch**: hotfix/<desc> (deleted)
**Merged to**: main + development
**Tag**: v1.0.1 (if created)

Production fix deployed. Development synced.
```

## Important Notes

- Hotfix is ONLY for production (main) issues
- For development issues, use `*bugfix` instead
- **MUST sync to development** after merging to main
- Keep hotfix scope minimal - fix only the critical issue
- Consider creating a patch release tag

## Workflow Diagram

```
main ◄─────────────── hotfix/<desc>
  │                        │
  │  (1) create from main  │
  │                        │
  │  (2) fix & commit      │
  │                        │
  ◄──── (3) merge ─────────┘
  │
  │  (4) tag release
  │
  └───► (5) sync to development
```

## Related
- Commands: *bugfix (for development), *release, *sync
- Patterns: @.claude/patterns/git-workflow.md
