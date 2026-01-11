# ADR-010: Three-Layer Task Tracking Architecture

**Status**: Adopted  
**Issue**: #139  
**Date**: 2026-01-11

## Decision

Replace TODO.md-based session tracking with a three-layer architecture:
1. **Strategy Layer**: MVP files (`docs/dev/MVP*.md`)
2. **Tactical Layer**: GitHub Issues + Issue Plans (`.claude/plans/active/#XXX.md`)
3. **Operational Layer**: Long-term architecture index (`.claude/MEMORY.md` - ADR links only)

## Context

### Problem
The original system had bloated documentation:
- **TODO.md**: 204 lines of session tracking (temporary)
- **MEMORY.md**: 451 lines mixing decisions, learnings, bugs, and current progress (permanent)

This created maintenance burden:
- Decisions scattered between files
- Current progress mixed with architectural knowledge
- High cognitive load when resuming sessions
- Difficulty distinguishing temporary vs permanent knowledge

### Requirements
1. **Single Source of Truth**: GitHub Issues for all work tracking
2. **Lean Architecture Index**: MEMORY.md only links to formal ADRs (< 50 lines)
3. **Clear Separation**: No overlap between current work and decisions
4. **Scalable**: System grows with decisions, not session volume

## Consequences

### Positive
✅ **MEMORY.md stays lean** (32 lines vs 451 original)
- Pure architecture index
- Read in < 5 minutes for context
- No maintenance burden from session tracking

✅ **Clear information hierarchy**
- Session details → `.claude/plans/active/#XXX.md` (issue-specific)
- Architecture decisions → `docs/architecture/ADR/` (formal)
- Architecture index → `.claude/MEMORY.md` (links only)

✅ **Reduced context switching**
- One source for current work (plans)
- One source for decisions (ADRs)
- No redundant information

✅ **Prevents bloat**
- MEMORY.md size limit: < 50 lines enforced
- New rule: `@.claude/rules/memory-management.md`
- Only ADR links allowed (no project tracking)

### Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Losing decision history | ADRs are permanent (never deleted) |
| TODO.md disappears without warning | Deleted deliberately (not accidental) |
| Plans not archived | Automated in `*issue close` command |
| MEMORY.md still bloats | Size limit < 50 lines + enforcement rule |

## Implementation

### What Changed
1. **Deleted**: `.claude/TODO.md` (session tracking now in issue plans)
2. **Refactored**: `.claude/MEMORY.md` (451 → 32 lines, ADR index only)
3. **Created**: `.claude/rules/memory-management.md` (enforcement rules)
4. **Updated**: 14 command files + 6 documentation files
5. **Created**: 4 new ADRs (006-009)

### Updated Commands
- `*issue pick #XXX` → Creates `.claude/plans/active/#XXX.md`
- `*issue close #XXX` → Archives to `.plans/archive/`, updates MEMORY.md with ADR link
- `*sync` → Only updates MEMORY for ADR links (not session tracking)
- `*resume` → Reads MEMORY.md (architecture) + plans/active/ (current work)

### New Rules
- **MEMORY.md updates**: Only when creating new ADR (rare)
- **Size limit**: < 50 lines enforced in `*resume` command
- **Anti-patterns**: No lessons, bugs, progress, comparisons

### File Structure
```
.claude/
├── MEMORY.md (32 lines, ADR index)
├── WORKFLOW.md (workflow guide)
├── README.md (quick start)
├── plans/
│   ├── active/ (current issue plans)
│   └── archive/ (completed plans)
└── rules/
    └── memory-management.md (enforcement)
```

## Testing

✅ Verified:
- All 9 ADRs created and linked from MEMORY.md
- TODO.md successfully deleted, no broken references
- plans/active/ contains 7 active issue plans
- MEMORY.md < 50 lines (32 lines)
- No dangling references in commands or docs
- All 14 command files updated
- All 6 documentation files updated

## Rationale

### Why Three Layers?
- **MVP layer** (strategy): What to build
- **Issues layer** (tactic): How to build it
- **Plans layer** (operations): Step-by-step execution

This mirrors military strategy:
1. Strategic objectives (what we want)
2. Campaign plans (how we'll win)
3. Daily operations (what we do today)

### Why ADR-Only MEMORY.md?
- **Architectural decisions** are permanent (not temporary)
- **Session tracking** is temporary (changes every session)
- Keep permanent and temporary completely separate
- Prevent "kitchen sink" knowledge file bloat

### Why < 50 Line Limit?
- 50 lines = ~5 minutes to read
- 9 ADRs + references fit in ~30 lines
- Room for future growth without bloat
- Easy to enforce and verify

## Related Decisions

- **ADR-001**: Service pattern (pure TypeScript layer)
- **ADR-006**: Mock database isolation (dual-DB pattern)
- **ADR-007**: Transaction cloud sync (conflict resolution)
- **ADR-008**: Component library (Material Design 3)
- **ADR-009**: Branch-first workflow (pre-code branching)

## References

- `.claude/WORKFLOW.md` - Workflow guide
- `.claude/MEMORY.md` - Architecture index (this ADR linked)
- `.claude/rules/memory-management.md` - Enforcement rules
- `.claude/plans/active/` - Current issue tracking
- Issue #139 - Implementation details

---

**Adoption Notes**:
- Adopted: 2026-01-11
- Enforced by: `.claude/rules/memory-management.md`
- No rollback needed (completed successfully)
