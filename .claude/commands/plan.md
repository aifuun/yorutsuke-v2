---
name: plan
category: planning
requires: none
---

# Command: *plan

## Purpose
Create implementation plan for MVP, feature/issue, or quick task

**Note**: Executing `*plan` will **enter Plan Mode**, a specialized planning environment where you explore the codebase and design solutions before coding. Plan Mode is exited when you approve the plan or abort it.

## Usage
```bash
*plan                  # Show planning menu
*plan mvp              # Step 1: MVP decomposition (战略层)
*plan #<n>             # Step 2: Feature planning for issue #n (战役层)
*plan <description>    # Quick plan for simple task (战术层)
```

## Subcommands

### *plan (no args)
Show interactive menu:
```
Planning Menu:

1. MVP Planning (战略层)
   → Decompose MVP into GitHub Issues
   → Use: *plan mvp

2. Feature Planning (战役层)
   → Create detailed plan for Issue #n
   → Use: *plan #<n>

3. Quick Plan (战术层)
   → Plan a simple task
   → Use: *plan <description>

Which planning level? (1/2/3)
```

### *plan mvp
**Step 1: MVP Decomposition** (40 min)

1. Identify current/next MVP from `docs/dev/MVP*.md`
2. Load template: `.claude/workflow/templates/TEMPLATE-mvp.md`
3. Follow guide: `.claude/workflow/planning-mvp.md`
4. Output: GitHub Issues + dependency graph
5. Update MVP file with Issue references

**Workflow**:
```
Analyze MVP goal → Identify features → Map dependencies → Create Issues
```

### *plan #<n>
**Step 2: Feature Planning** (1.5-2h)

**Workflow**:
```
Architecture review → Function contracts + Unit tests → Validate requirements → Create dev plan → Ready to code
```

#### Phase 1: Architecture Context (15 min)

**Step 0: Review Architecture Context**
- **Read relevant ADRs** from `docs/architecture/ADR/`:
  - If data fetching → check ADR-001 (Service Pattern)
  - If state management → check ADR-006 (Mock DB), ADR-007 (Cloud Sync)
  - If UI components → check ADR-008 (Component Library)
  - If workflow → check ADR-009 (Branch-First), ADR-010 (Three-layer)
- **Identify applicable Pillars** from `.prot/`:
  - **T1 tasks** → Pillar A (Nominal Types), Pillar B (Airlock), Pillar L (Headless)
  - **T2 tasks** → Add Pillar D (FSM), Pillar E (Orchestration)
  - **T3 tasks** → Add Pillar F (Concurrency), Pillar M (Saga), Pillar Q (Idempotency)
- **Check architecture patterns** from `docs/architecture/`:
  - `PATTERNS.md` - Service Pattern, Adapter Pattern, etc.
  - `LAYERS.md` - 00_kernel, 01_domains, 02_modules structure
  - `SCHEMA.md` - Data model constraints
- **Output**: Create "Architecture Context" section in plan with:
  - Relevant ADRs (with file links)
  - Applicable Pillars (with checklist)
  - Architecture patterns to follow

**Step 1: Define Key Functions + Unit Tests** (30 min)
- **Define core function contracts**:
  - Function name, parameters with types, return type
  - Pre-conditions (what must be true before calling)
  - Post-conditions (what will be true after successful execution)
  - Side effects (mutations, I/O, events)
- **Write unit tests BEFORE implementation** (TDD approach):
  - Test happy path (normal case)
  - Test edge cases (empty input, boundaries)
  - Test error cases (invalid input, exceptions)
  - Tests serve as **executable specifications**
- **Example**:
  ```typescript
  // Function contract
  function calculateDailyStats(
    transactions: Transaction[],  // Branded type (Pillar A)
    date: Date                     // Local timezone
  ): DailyStats {
    // Returns: { income: number, expense: number, net: number }
    // Pre: transactions array (may be empty), date is valid Date object
    // Post: All amounts in cents (integer), net = income - expense
    // Side effects: None (pure function)
  }

  // Unit tests (specification)
  describe('calculateDailyStats', () => {
    it('should calculate stats for mixed transactions', () => {
      const txs = [
        { type: 'income', amount: 50000, date: '2026-01-12' },
        { type: 'expense', amount: 30000, date: '2026-01-12' }
      ];
      expect(calculateDailyStats(txs, new Date('2026-01-12')))
        .toEqual({ income: 50000, expense: 30000, net: 20000 });
    });

    it('should return zeros for empty transactions', () => {
      expect(calculateDailyStats([], new Date('2026-01-12')))
        .toEqual({ income: 0, expense: 0, net: 0 });
    });

    it('should filter by date correctly', () => {
      const txs = [
        { type: 'income', amount: 10000, date: '2026-01-11' },
        { type: 'income', amount: 20000, date: '2026-01-12' }
      ];
      expect(calculateDailyStats(txs, new Date('2026-01-12')))
        .toEqual({ income: 20000, expense: 0, net: 20000 });
    });
  });
  ```
- **Rationale**: Tests define behavior and serve as acceptance criteria
- **Output**: Create "Key Functions" section in plan with:
  - Function signatures with contracts
  - Unit test specifications (test cases)
  - Acceptance: All tests pass = feature complete

#### Phase 2: Detailed Planning (45 min)

**Step 2**: View issue: `gh issue view <n>`
**Step 3**: Check complexity (suggest `*tier` if T2/T3)
**Step 4**: Load template: `.claude/workflow/templates/TEMPLATE-feature-plan.md`
**Step 5**: Follow guide: `.claude/workflow/planning-feature.md`
**Step 6**: Save to: `.claude/plans/active/#<n>-name.md`
**Step 7**: Update GitHub Issue with plan link

### *plan <description>
**Quick Plan** for simple tasks

Workflow

1. **Analyze request**: Understand what needs to be done

2. **Research** (if needed):
   - Check existing code patterns
   - Identify affected files
   - Note dependencies

3. **Break down** into steps:
   - Each step should be completable in one session
   - Order by dependency (what must come first)
   - Identify risky/complex steps

4. **Create plan**:
   - Create `.claude/plans/active/#<n>-title.md` from template
   - Or create GitHub issue if substantial

5. **Present** to user:
   ```
   ## Plan: <description>

   ### Steps
   1. [ ] Step one - [details]
   2. [ ] Step two - [details]
   3. [ ] Step three - [details]

   ### Risks
   - Risk 1: mitigation

   ### Files affected
   - file1.js
   - file2.js

   Ready to proceed?
   ```

6. **Wait for approval** before executing

7. **Record decision** (if major architectural change):
   - Create ADR in `docs/architecture/ADR/NNN-title.md`
   - Add link to MEMORY.md (see @.claude/rules/memory-management.md)

## Plan Mode Explained

When you execute `*plan`, you enter **Plan Mode** - a special state where:

### What Happens in Plan Mode

1. **Exploration Phase**: I explore your codebase using specialized tools (Glob, Grep, Explore agent)
2. **Analysis Phase**: I analyze patterns, architecture, dependencies
3. **Design Phase**: I create a detailed implementation plan
4. **Presentation**: I write the plan to a file (`.claude/plans/active/`) and present it to you
5. **Approval**: You review and approve, modify, or reject the plan
6. **Exit**: Plan Mode exits once you approve or abort

### Key Features

- **No coding yet** - Plan Mode is for planning, not implementation
- **Deep exploration** - Can read and analyze many files to understand context
- **Architecture-aware** - Checks ADRs, patterns, existing code styles
- **Risk identification** - Identifies potential issues before coding
- **Test cases** - Suggests how to test the implementation

### After Plan Mode

Once you approve the plan:
- Use `*approve` to start implementing according to the plan
- Or use `*next` to pick next issue and load its plan

## Notes

- Good plans have 3-7 steps
- Each step should be testable
- Identify risks upfront
- **Plan Mode is safe** - exploration only, no code changes until approved

## Templates Summary

| Level | Template | Output |
|-------|----------|--------|
| 战略 MVP | `TEMPLATE-mvp.md` | `docs/dev/MVPX.md` |
| 战役 Feature | `TEMPLATE-feature-plan.md` | `plans/active/#xxx.md` |
| 战役 Issue | `TEMPLATE-github-issue.md` | GitHub Issues |

All templates: `.claude/workflow/templates/`

## Command Chaining

**After `*plan mvp`**: Creates Issues → use `*issue pick <n>` to start development
**After `*plan #<n>`**: Creates feature plan → use `*approve` to execute
**After `*plan <desc>`**: Creates quick plan → use `*approve` to execute

## Related
- Commands: *approve, *tier, *issue
- Templates: `.claude/workflow/templates/`
- Workflow: `.claude/rules/workflow.md`
