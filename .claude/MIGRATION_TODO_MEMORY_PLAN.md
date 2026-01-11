# Migration Plan: TODO.md & MEMORY.md Refactoring

**Date**: 2026-01-11  
**Status**: PLANNING  
**Impact**: Workflow & documentation restructuring

## Vision

**Current State**:
- `.claude/TODO.md` - Session task tracking (177 lines)
- `.claude/MEMORY.md` - Long-term project knowledge (451 lines)
- Multiple commands and docs reference these files

**New State**:
- ❌ Remove `.claude/TODO.md` - Use GitHub Issue plans instead (`.claude/plans/active/#XXX.md`)
- ✅ Refactor `.claude/MEMORY.md` - Keep ONLY architecture decision record (ADR) links + short index
- ✅ Create/update `.claude/plans/` for active issue tracking
- ✅ Update `.prot/STRUCTURE.md` to reflect new architecture

**Rationale**:
- **Single source of truth**: GitHub Issues + Issue Plans (in `.claude/plans/`) for current work
- **Decision preservation**: Only major decisions go to ADR (formal architecture records)
- **Reduced noise**: MEMORY.md becomes a lean index, not a dump
- **Cleaner collaboration**: Each issue has dedicated plan file, not mixed in TODO

---

## Files to Update

### 1. Remove TODO.md ❌

**File**: `.claude/TODO.md` (177 lines, current session tracking)

**Action**: DELETE after migration is complete

**Why**: 
- Session tasks should be tracked in GitHub Issue plans (`.claude/plans/active/#XXX.md`)
- Current issue status visible in GitHub UI
- Feature planning templates cover this need

**Migration Path**:
- Any in-progress task → Create/update corresponding issue plan in `.claude/plans/active/`
- Completed tasks → Documented in issue closure + ADR if major decision
- Backlog items → Move to GitHub Issues backlog

---

### 2. Refactor MEMORY.md 📋

**File**: `.claude/MEMORY.md` (451 lines, currently mixed content)

**Current Sections**:
- Architecture Decisions (18 entries: #138, #108, #126-131, #122, #105, #94, #82, #45-49, etc.)
- Solved Issues (5 entries: #101, #006, #007, #007 Tauri, #003)
- References (empty)
- Best Practices (empty)

**New Structure** (LEAN):

```markdown
# Memory - Architecture Decision Records

This document links to formal ADRs only. Detailed decisions documented in `docs/architecture/ADR/`.

## ADR Index

### Core Architecture
- [001-service-pattern.md](../docs/architecture/ADR/001-service-pattern.md) - Pillar L (Headless)
- [002-strictmode-fix.md](../docs/architecture/ADR/002-strictmode-fix.md) - Event initialization
- [003-image-compression.md](../docs/architecture/ADR/003-image-compression.md) - OCR pipeline
- [004-upload-queue-fsm.md](../docs/architecture/ADR/004-upload-queue-fsm.md) - Upload state machine
- [005-traceid-intentid.md](../docs/architecture/ADR/005-traceid-intentid.md) - Observability

### Recent Decisions (See GitHub Issues for full context)
- **#138** (2026-01): Mock Database Isolation - ADR coming
- **#108** (2026-01): Transaction Cloud Sync - ADR coming
- **#126-131** (2026-01): Component Library - ADR coming
- **#122** (2026-01): Border Radius Token Migration - ADR coming
- **#105** (2026-01-09): Code Commands Optimization - See `.claude/commands/`
- **#94** (2026-01-07): Architecture Documentation Refactoring - See `docs/architecture/`
- **#82** (2026-01-05): React = Dumb Display - ADR coming

### Bug Fixes & Patches
- **#45-49** (2026-01-03): Capture Pipeline Core Bugs - Fixed in MVP1
- **#101** (2026-01-08): Admin Config API - In production
- **#006** (2026-01-06): SQLite "database is locked" - IO-First Pattern (`.claude/rules/service-layer.md`)
- **#007a** (2026-01-07): Debug "Clear All Data" Freeze - Fixed
- **#007b** (2026-01-07): Paste Interaction Permission - Fixed
- **#007c** (2026-01-07): Tauri 2 HTTP Fetch "Load failed" - Fixed

---

## Migration Steps

### Phase 1: Create ADRs (if missing)
**Owner**: Whoever closes each major issue

**Checklist**:
- [ ] Review current MEMORY.md Architecture Decisions
- [ ] For each major decision, check if ADR exists in `docs/architecture/ADR/`
- [ ] If missing, create ADR template: DECISION | CONTEXT | CONSEQUENCES | IMPLEMENTATION
- [ ] Link ADR in MEMORY.md index

**ADRs to Create**:
- [ ] 006-mock-database-isolation.md (#138)
- [ ] 007-transaction-cloud-sync.md (#108)
- [ ] 008-component-library.md (#126-131)
- [ ] 009-branch-first-workflow.md (New process improvement)

### Phase 2: Update Workflow Files
**Owner**: AI Assistant (this plan execution)

**Files to Update**:

1. **CLAUDE.md** (312 lines)
   - [ ] Remove "TODO.md：当前 Session 正在处理的 1-3 个活跃 Issue"
   - [ ] Update: "Using GitHub Issue plans (`.claude/plans/active/`) instead"
   - [ ] Remove reference to "TEMPLATE-todo.md"
   - [ ] Update Memory & Context section

2. **`.claude/rules/workflow.md`** (327 lines)
   - [ ] Remove "TODO.md 战术层" section entirely
   - [ ] Update "三层工作流" to "Issue Plan Pattern"
   - [ ] Keep "Branch-First Rule" (✅ good)
   - [ ] Update "Two-Step Planning" examples

3. **`.claude/WORKFLOW.md`** (index file)
   - [ ] Update layered architecture section
   - [ ] Remove TODO.md from all references
   - [ ] Add `.claude/plans/` as new canonical location

4. **`.claude/commands/*.md`** (17 files)
   - [ ] `sync.md` - Update MEMORY.md references (keep), remove TODO.md
   - [ ] `approve.md` - Update task tracking reference
   - [ ] `bugfix.md` - Update TODO.md references
   - [ ] `issue.md` - Update to "create plan file instead of TODO.md entry"
   - [ ] `next.md` - Update Level 1 to check `.claude/plans/` not TODO.md
   - [ ] `plan.md` - Update output to create plan files
   - [ ] `review.md` - Update to use plan files
   - [ ] `resume.md` - Update to read from plans/ not TODO.md
   - [ ] `tidy.md` - Remove TODO.md section
   - [ ] `status.md` - Remove TODO.md reference
   - [ ] `audit.md` - Update
   - [ ] Other commands mentioning TODO

5. **`docs/` files**
   - [ ] `README.md` - Line 134: Update reference
   - [ ] `README.md` - Line 203: Update context management section
   - [ ] `docs/dev/OPTIMIZATION_SUMMARY.md` - Remove TODO.md reference
   - [ ] `docs/dev/MVP3.1_ROADMAP.md` - Update workflow references
   - [ ] Other docs with TODO.md mentions

6. **`.prot/STRUCTURE.md`** (doc index)
   - [ ] Remove TODO.md description
   - [ ] Remove "### .claude/TODO.md" section
   - [ ] Update MEMORY.md to "Decision record index (links to ADR)"

### Phase 3: Refactor MEMORY.md
**Owner**: AI Assistant

**Action**:
- [ ] Extract all current decisions to proposed ADRs (new files in `docs/architecture/ADR/`)
- [ ] Replace full decision text with ADR links only
- [ ] Keep short summary of major decisions with GitHub issue numbers
- [ ] Reduce from 451 lines → ~80 lines (index + links)

### Phase 4: Delete TODO.md
**Owner**: After Phase 1-3 complete

**Action**:
- [ ] Verify no uncommitted changes in TODO.md
- [ ] Delete file: `git rm .claude/TODO.md`
- [ ] Update .gitignore if TODO.md was excluded

---

## Reference Map: All Mentions of TODO.md & MEMORY.md

### Code/Config Files
- [ ] `README.md` - 2 references (lines 134, 203)
- [ ] `CLAUDE.md` - 7 references (lines 50, 63, 293, 294)
- [ ] `.prot/STRUCTURE.md` - 4 references (lines 63-64, 202)
- [ ] `.prot/checklists/pre-code.md` - 1 reference (line 64)
- [ ] `docs/dev/OPTIMIZATION_SUMMARY.md` - 2 references (lines 105-106)
- [ ] `docs/dev/MVP3.1_ROADMAP.md` - 1 reference (line 479)

### Commands (`.claude/commands/`)
- [ ] `sync.md` - 8 references (frontmatter, lines 17, 67-68, 86-87, 94, 143)
- [ ] `approve.md` - 1 reference (line 22)
- [ ] `bugfix.md` - 3 references (lines 45, 65, 92)
- [ ] `review.md` - 1 reference (line 14)
- [ ] `plan.md` - 2 references (lines 91, 116, 144)
- [ ] `tidy.md` - 7 references (frontmatter, lines 12-14, 23-25, 37, 68)
- [ ] `resume.md` - 7 references (frontmatter, lines 20, 22, 25-26, 38, 46)
- [ ] `next.md` - 8 references (frontmatter, lines 14-15, 23, 31, 63-64, 81-82, 98, 105)
- [ ] `hotfix.md` - 4 references (lines 46, 68, 105)
- [ ] `audit.md` - 2 references (lines 14, 37)
- [ ] `scaffold.md` - 1 reference (line 37)
- [ ] `tier.md` - 2 references (lines 30, 68)
- [ ] `issue.md` - 8 references (frontmatter, lines 54, 69, 91, 123, 127, 167-168, 172, 180)
- [ ] `status.md` - 5 references (frontmatter, lines 24-25, 39, 50, 87)

### Workflow Files
- [ ] `.claude/rules/workflow.md` - 10 references (frontmatter, etc.)
- [ ] `.claude/WORKFLOW.md` - Check all references
- [ ] `.claude/workflow/examples/next-command.md` - 13 references
- [ ] `.claude/workflow/release.md` - 1 reference (line 32)
- [ ] `.claude/workflow/templates/README.md` - 1 reference (line 12)

### Design Guides & Other
- [ ] `.claude/design-system-integration-guide.md` - 1 reference (line 12)
- [ ] `.github/ISSUE_DRAFT_109.md` - 1 reference (line 236)

---

## Implementation Order

1. **Create this plan** ✅ (you're reading it)
2. **Create ADRs** - For each major decision in MEMORY.md
3. **Update MEMORY.md** - Replace content with ADR index
4. **Update commands/** - 17 files to adjust for new pattern
5. **Update rules/** - workflow.md refactoring
6. **Update CLAUDE.md** - Remove TODO references
7. **Update docs/** - 4-5 files with workflow references
8. **Update .prot/** - STRUCTURE.md documentation
9. **Delete TODO.md** - Final cleanup
10. **Commit & document** - Single PR with all changes

---

## New Workflow (After Migration)

### When Starting New Issue

1. **GitHub** (`gh issue list`): Pick issue #XXX
2. **Create branch**: `git checkout -b feature/XXX-title`
3. **Create plan file**: `.claude/plans/active/#XXX.md` using feature-plan template
4. **Start work**: Reference plan file for detailed steps
5. **Update plan** (real-time): Check off completed steps
6. **On completion**: Move decision to ADR, close GitHub issue, delete plan file

### MEMORY.md Usage (NEW)

- **Read**: `.claude/MEMORY.md` for decision links + history
- **Write**: Only when closing issues with major decisions
- **Action**: Create ADR in `docs/architecture/ADR/` + link from MEMORY.md
- **Size target**: <100 lines (index only)

### Commands Impact

| Command | Old Behavior | New Behavior |
|---------|--------------|--------------|
| `*next` | Check TODO.md | Check `.claude/plans/active/` |
| `*issue close` | Update TODO.md + MEMORY.md | Create/update ADR + update MEMORY.md links |
| `*sync` | Commit with TODO.md + MEMORY.md updates | Commit with ADR updates only |
| `*status` | Show TODO.md progress | Show active plan files |

---

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Lose current session context | Copy TODO.md content to issue plans before deleting |
| Commands break during transition | Update all 17 commands before deleting TODO.md |
| ADRs not created | Create template + checklist for issue closure |
| MEMORY.md becomes outdated | Keep "Recent Decisions" section with GitHub issue links |

---

## Success Criteria

- ✅ TODO.md deleted
- ✅ MEMORY.md < 100 lines (index + links only)
- ✅ All workflow files updated (CLAUDE.md, rules/workflow.md, commands/)
- ✅ ADRs created for top 4 decisions (#138, #108, #126-131, #122)
- ✅ All 40+ mentions of TODO/MEMORY updated or removed
- ✅ No broken links in commands
- ✅ Tests pass (if applicable)

---

## Approval Checklist

Before considering migration complete:

- [ ] All 40+ references reviewed and updated
- [ ] No dangling TODO.md links remain
- [ ] MEMORY.md refactored to lean index (<100 lines)
- [ ] ADR links all resolve
- [ ] Commands tested (especially `*next`, `*sync`, `*issue close`)
- [ ] CLAUDE.md and rules updated
- [ ] TODO.md file deleted
- [ ] Changes committed with clear message
