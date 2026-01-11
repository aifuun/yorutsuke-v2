---
paths:
  - .claude/MEMORY.md
  - docs/architecture/ADR/
---

# Memory Management Rule

Strict rules to prevent MEMORY.md from bloating. MEMORY.md is ONLY an ADR index.

## What Goes in MEMORY.md

✅ **ALLOWED**:
- ADR index links (9 architecture decisions)
- Brief description of each ADR (one line max)
- References section (links to docs)
- Last updated timestamp

❌ **NOT ALLOWED**:
- Current project progress
- Issue tracking or status
- Bug fixes and lessons learned
- "Key Learnings" or "Recent Decisions" tables
- Historical context comparisons
- Any content that changes per session

## How to Update MEMORY.md

**Only two operations are allowed**:

### 1. Add New ADR Link (When Closing Major Issue)
- Create ADR file: `docs/architecture/ADR/NNN-decision-title.md`
- Add one line to MEMORY.md ADR Index:
  ```markdown
  - [NNN-decision-title.md](../docs/architecture/ADR/NNN-decision-title.md) - Brief decision
  ```
- **Frequency**: When closing architectural issues only (rare)
- **Example**: `#138` (mock DB) → ADR-006 created → added to MEMORY.md

### 2. Update Last Updated Timestamp
- Change only the date at bottom
- **Frequency**: When new ADR added

## Where Project Knowledge Goes

| Type | Location | Examples |
|------|----------|----------|
| **Current task progress** | `.claude/plans/active/#XXX.md` | Steps, blockers, next actions |
| **Architecture decisions** | `docs/architecture/ADR/NNN-*.md` | Full decision context + rationale |
| **Architecture index** | `.claude/MEMORY.md` | ADR links only (THIS FILE) |
| **Workflow rules** | `.claude/rules/workflow.md` | Git flow, three-layer architecture |
| **Development guide** | `.claude/WORKFLOW.md` | Commands, templates, quick start |

## Enforcement

**MEMORY.md file size limits**:
- ✅ < 50 lines = healthy
- ⚠️ 50-100 lines = review needed (might be bloated)
- ❌ > 100 lines = violation (too much content)

**Who can modify MEMORY.md**:
- `*issue close` command: ONLY to add ADR link + timestamp
- `*sync` command: NEVER (no memory updates)
- Manual edits: ONLY following this rule

## Example Workflow

```
1. Working on Issue #140
   → Progress tracked in .claude/plans/active/140-feature.md
   → No changes to MEMORY.md

2. Issue #140 complete with major architectural decision
   → Create ADR: docs/architecture/ADR/010-new-decision.md
   → Update MEMORY.md:
      - Add ADR link to "Recent Architectural Decisions" section
      - Update timestamp: 2026-01-12
   → Done!

3. Tomorrow starting Issue #141
   → Read MEMORY.md (3 minutes to review all decisions)
   → Work in plans/active/141-*.md
   → MEMORY.md stays unchanged
```

## Anti-Patterns to Avoid

❌ Adding "Key Learnings" or lessons to MEMORY.md
❌ Tracking solved bugs in MEMORY.md
❌ Updating MEMORY.md to track current work
❌ Adding timestamps for each work session
❌ Comparing v1 vs v2 implementations
❌ Keeping "Active Issues" section
❌ Adding decision rationale (use ADR for that)

**Fix**: If you want to add something → Create an ADR instead!

---

**Last Updated**: 2026-01-11  
**Objective**: Keep MEMORY.md < 50 lines, lean and focused
