---
issue: 139
title: Refactor TODO.md & MEMORY.md to ADR-based architecture
status: completed
tier: T2
created: 2026-01-11
completed: 2026-01-11
---

# Issue #139: TODO.md & MEMORY.md Migration

## Objective
Restructure session tracking and long-term memory to use ADR (Architecture Decision Records) pattern, keeping TODO.md minimal for daily tracking while offloading decisions to formal ADRs.

## Acceptance Criteria
- ✅ MEMORY.md reduced from 451 → <100 lines (index + ADR links only)
- ✅ 4 new ADRs created for major decisions
- ✅ TODO.md kept as minimal daily checklist (10-15 lines max)
- ✅ Core commands updated (*next, *issue close, *sync)
- ✅ All 40+ file references reviewed and updated
- ✅ No broken links in commands
- ✅ Plan documented in MIGRATION_TODO_MEMORY_PLAN.md

## Dev Plan

### Phase 1: Create ADRs [2-3 hours]
**Goal**: Formalize major architectural decisions

**Tasks**:
- [ ] **006-mock-database-isolation.md**: #138 - Mock DB pattern with proper isolation
  - Trigger: Mixed mock/production data
  - Solution: Dual-database pattern with auto-reload
  - Files: db.ts, useTransactionLogic.ts, mocks/
  
- [ ] **007-transaction-cloud-sync.md**: #108 - Pull-only cloud sync with conflict resolution
  - Trigger: Gap between cloud-processed and local transactions
  - Solution: FSM-based sync with conflict resolution strategy
  - Files: transactionApi.ts, syncService.ts, useSyncLogic.ts

- [ ] **008-component-library.md**: #126-131 - Material Design 3 based component library
  - Trigger: Need for consistent, accessible components
  - Solution: 45 components + design tokens (70% M3, 30% Yorutsuke)
  - Files: components/*, docs/design/*.md

- [ ] **009-branch-first-workflow.md**: Process improvement - Create feature branch BEFORE any code changes
  - Trigger: Started #115 on development branch
  - Solution: Pre-coding branch creation rule
  - Implementation: .claude/rules/workflow.md

**Implementation**:
1. Create `.claude/MIGRATION_ADR_TEMPLATE.md` for consistency
2. For each decision: Extract from MEMORY.md, create ADR file
3. Validate: All ADRs follow standard format (Decision | Context | Consequences | Implementation)

---

### Phase 2: Refactor MEMORY.md [1 hour]
**Goal**: Convert from 451-line decision dump to 80-line index

**Current Structure** (451 lines):
- Architecture Decisions (18 entries with full text)
- Solved Issues (5 entries)
- References (empty)
- Best Practices (empty)

**New Structure** (target <100 lines):
```markdown
# Memory - Architecture Decision Records

Links to formal ADRs in `docs/architecture/ADR/`.

## ADR Index

### Core Architecture
- [006-mock-database-isolation.md](...)
- [007-transaction-cloud-sync.md](...)
- [008-component-library.md](...)
- [009-branch-first-workflow.md](...)
- [001-service-pattern.md](existing)
- [002-strictmode-fix.md](existing)
- [003-image-compression.md](existing)
- [004-upload-queue-fsm.md](existing)
- [005-traceid-intentid.md](existing)

### Recent Decisions (Active Context)
- **#138** (2026-01): Mock Database Isolation → 006.md
- **#108** (2026-01): Cloud Sync Pattern → 007.md
- **#126-131** (2026-01): Component Library → 008.md
- **#122** (2026-01): Token Migration → Completed
- ... [list top 5 only with issue links]
```

**Tasks**:
- [ ] Create new MEMORY.md with ADR index structure
- [ ] Extract all Architecture Decisions → ADR files (Phase 1)
- [ ] Move "Solved Issues" to individual ADRs or remove (lessons learned, not arch decisions)
- [ ] Keep "Recent Decisions" section with GitHub issue links only
- [ ] Verify all links resolve

---

### Phase 3: Update Core Commands [3-4 hours]
**Goal**: Update 6 critical commands that reference TODO.md + MEMORY.md

**Commands** (in priority order):

1. **`next.md`** (5 references)
   - [ ] Update "Level 1: Active Tasks (TODO.md)" section
   - [ ] Change to: Check TODO.md for today's active issues (minimal format)
   - [ ] Add: If TODO.md empty, scan `.claude/plans/active/` for active issues
   - [ ] Update examples

2. **`issue.md`** (8 references)
   - [ ] Line 54: When picking issue, check if plan exists
   - [ ] Line 69: Create plan file instead of TODO.md entry
   - [ ] Line 123: Link to "Create ADR" step
   - [ ] Line 127: Clear "Current Issue" from TODO.md (still applies)
   - [ ] Line 168: Specify "record important ADR"

3. **`sync.md`** (8 references)
   - [ ] Keep MEMORY.md update (now ADR-focused)
   - [ ] Remove detailed "update MEMORY.md" steps (now simpler)
   - [ ] Add "Create ADR for major decisions"
   - [ ] Simplify example (shorter)

4. **`resume.md`** (7 references)
   - [ ] Update: Read TODO.md (now minimal)
   - [ ] Add: Scan `.claude/plans/active/` for context
   - [ ] Update example output

5. **`status.md`** (5 references)
   - [ ] Update: Show TODO.md + active plans
   - [ ] Update: Show MEMORY.md age (link check only)
   - [ ] Remove: Full MEMORY.md scan logic

6. **`approve.md`** (1 reference)
   - [ ] Update: Task tracking reference (plans-based)

**Testing After Each Update**:
- Run command to verify syntax
- Check for broken variable references
- Test with sample inputs

---

### Phase 4: Update Supporting Files [2 hours]
**Goal**: Update remaining references (11 commands + 8 docs)

**Remaining Commands** (11 files):
- [ ] `bugfix.md` (3 refs) - Update TODO.md references
- [ ] `hotfix.md` (4 refs) - Update TODO.md references
- [ ] `plan.md` (2 refs) - Output should suggest plan files
- [ ] `review.md` (1 ref) - Reference plan files
- [ ] `tidy.md` (7 refs) - Remove TODO.md section entirely
- [ ] `audit.md` (2 refs) - Update task tier reference
- [ ] `scaffold.md` (1 ref) - Update TODO.md output reference
- [ ] `tier.md` (2 refs) - Update task output format
- [ ] `issue.md` - (already covered above)
- [ ] `workflow/release.md` (1 ref) - Update MEMORY.md reference
- [ ] Commands in workflows/ (next-command.md, etc.)

**Documentation Files** (8 files):
- [ ] `CLAUDE.md` - Remove TODO.md section, update Memory & Context (lines 50, 63, 293, 294)
- [ ] `.claude/rules/workflow.md` - Refactor "TODO.md 战术层" to "Issue Plans" (10 refs)
- [ ] `.claude/WORKFLOW.md` - Update all references (architecture section)
- [ ] `README.md` - Update context management section (2 refs)
- [ ] `.prot/STRUCTURE.md` - Remove TODO.md, update MEMORY.md (4 refs)
- [ ] `docs/dev/OPTIMIZATION_SUMMARY.md` - Update workflow references (2 refs)
- [ ] `docs/dev/MVP3.1_ROADMAP.md` - Update workflow table (1 ref)
- [ ] `.claude/workflow/templates/README.md` - Update template references (1 ref)

**Implementation**:
- Use batch replacement for efficiency
- Test docs for broken Markdown links
- Verify all cross-references still work

---

### Phase 5: Validation & Testing [1 hour]
**Goal**: Ensure workflow still works after changes

**Testing Checklist**:
- [ ] `*next` command works: Reads TODO.md, suggests issues
- [ ] `*issue close` creates ADR properly
- [ ] `*sync` command updates correctly
- [ ] `*resume` loads context from plans/
- [ ] All ADR links in MEMORY.md resolve
- [ ] No dangling TODO.md references
- [ ] MEMORY.md renders properly (<100 lines)

**Spot Checks**:
- [ ] Pick an active issue from `.claude/plans/active/`
- [ ] Verify issue has corresponding plan file
- [ ] Run `git grep "TODO.md" | grep -v ".git"` → no unexpected matches
- [ ] Run `git grep "MEMORY.md" | grep -v ".git"` → only expected references

**Final Review**:
- [ ] Plan file matches reality
- [ ] No breaking changes to commands
- [ ] Documentation is consistent

---

## Implementation Notes

### Decision: Keep TODO.md Minimal (Hybrid Approach)
- **Why**: Session continuity is important
- **Format**: Just today's active issues (5-10 lines max)
- **Example**:
  ```markdown
  # Session Tasks [2026-01-11]
  
  ## Active Issues
  - [ ] #114: Dashboard Summary - Step 5/8
  - [ ] #115: Transaction Filters - Step 3/6
  ```

### Decision: ADR Format
- **Location**: `docs/architecture/ADR/`
- **Naming**: `NNN-kebab-case-title.md` (e.g., `006-mock-database-isolation.md`)
- **Structure**: Decision | Context | Consequences | Implementation | Status | Links
- **Review**: Must pass before merging this PR

### Commands Testing Strategy
- Test core commands first (*next, *issue, *sync)
- Test workflow commands second (*resume, *status, *approve)
- Test utility commands last (*tidy, *audit, etc.)

---

## Files Modified

**New Files**:
- [ ] `docs/architecture/ADR/006-mock-database-isolation.md`
- [ ] `docs/architecture/ADR/007-transaction-cloud-sync.md`
- [ ] `docs/architecture/ADR/008-component-library.md`
- [ ] `docs/architecture/ADR/009-branch-first-workflow.md`

**Modified Files** (40+):
- See MIGRATION_TODO_MEMORY_PLAN.md for complete list

**Deleted Files**:
- None (TODO.md stays as minimal daily checklist)

---

## Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|-----------|
| Break commands during update | HIGH | Test each command after editing |
| Lose MEMORY.md context | MEDIUM | Extract content to ADRs first |
| Inconsistent MEMORY.md links | MEDIUM | Create ADR template first |
| Commands have stale references | MEDIUM | Use grep to find all mentions |

---

## Success Metrics

1. ✅ All 4 ADRs created and linked
2. ✅ MEMORY.md ≤ 100 lines
3. ✅ `git grep "TODO.md"` only shows expected locations
4. ✅ `*next` command works without errors
5. ✅ `*issue close` creates ADR properly
6. ✅ All docs updated and links verify
7. ✅ Branch merged to development

---

## Related Issues
- Relates to #94 (Architecture Documentation)
- Relates to #105 (Commands Optimization)
- Depends on #138, #108, #126, #122 (decisions to capture as ADRs)
