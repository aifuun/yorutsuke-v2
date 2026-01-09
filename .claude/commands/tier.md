---
name: tier
category: quality
requires: [.prot/CHEATSHEET.md]
---

# Command: *tier

## Purpose
Classify task complexity (T1/T2/T3) per AI_DEV_PROT v15

## When to Use

Run *tier when task involves:
- ✅ Data writes/mutations
- ✅ State management (forms, wizards)
- ✅ Critical operations (payment, sync)

Skip for:
- ❌ Pure UI changes (styling, layout)
- ❌ Text/content updates
- ❌ Simple read-only fixes

**Special Cases**:
- **Bug fix with state**: Classify based on scope (T1=read-only, T2=local, T3=distributed)
- **Refactoring**: Usually skip unless changing state patterns (e.g., adding FSM)

## Process

1. Read task description (from TODO.md or user input)
2. Classify using criteria: @.prot/CHEATSHEET.md (Tier Classification section)
3. Identify applicable Pillars: @.claude/patterns/pillar-reference.md
4. Recommend templates from .prot/pillar-*/
5. Output classification summary

## Output Format

```markdown
## Task Classification

**Task**: [description]
**Tier**: T[1/2/3] - [Direct|Logic|Saga]

### Pillars
| Pillar | Rule | Template |
|--------|------|----------|
| A | Branded Types for IDs | .prot/pillar-a/branded.ts |
| D | FSM over boolean flags | .prot/pillar-d/fsm-reducer.ts |
| L | Headless separation | .prot/pillar-l/headless.ts |

### Pattern
[Recommended architectural pattern]

### Pre-Code Checks
- [ ] Key items from @.prot/checklists/pre-code.md

### Files to Create/Modify
| File | Template |
|------|----------|
| src/.../headless/useXxx.ts | pillar-l/headless.ts |
| src/.../adapters/xxxApi.ts | pillar-b/airlock.ts |
```

## After Classification

1. Load: @.prot/checklists/pre-code.md
2. Copy applicable templates from .prot/pillar-*/
3. Create TODO.md task breakdown with pillar references
4. Suggest: `*scaffold module {name} --t{X}` (if new module)

## Related
- Commands: *plan, *scaffold
- Reference: @.prot/CHEATSHEET.md (Tier Classification)
- Patterns: @.claude/patterns/pillar-reference.md
