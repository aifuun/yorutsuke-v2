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
**Step 2: Feature Planning** (1-2h)

1. View issue: `gh issue view <n>`
2. Check complexity (suggest `*tier` if T2/T3)
3. Load template: `.claude/workflow/templates/TEMPLATE-feature-plan.md`
4. Follow guide: `.claude/workflow/planning-feature.md`
5. Save to: `.claude/plans/active/#<n>-name.md`
6. Update GitHub Issue with plan link

**Workflow**:
```
Validate requirements → Create dev plan → Define test cases → Ready to code
```

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
   - Add steps to .claude/TODO.md under "Quick Tasks"
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

7. **Record decision** (if significant):
   - Update `.claude/MEMORY.md` with approach chosen
   - Note alternatives considered

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
- Or use `*next` to execute tasks from TODO.md

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
