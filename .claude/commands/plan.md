---
name: plan
category: planning
requires: none
---

# Command: *plan

## Purpose
Create implementation plan for a task or feature

## Usage
```bash
*plan <description>    # Create plan for task
```

Example: `*plan add user authentication`

## Workflow

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

## Notes

- Good plans have 3-7 steps
- Each step should be testable
- Identify risks upfront

## Templates Available

When creating a plan, use the appropriate template:

### MVP Planning (战略层)
**Template**: `.claude/workflow/templates/TEMPLATE-mvp.md`
- **Copy to**: `docs/dev/MVPX_NAME.md`
- **See**: `workflow/planning-mvp.md` for Step 1 guidance (40 min)
- **Process**: Analyze goal → Identify features → Create Issues

### Feature Planning (战役层)
**Template**: `.claude/workflow/templates/TEMPLATE-feature-plan.md`
- **Copy to**: `.claude/plans/active/#xxx-name.md`
- **See**: `workflow/planning-feature.md` for Step 2 guidance (1-2h)
- **Process**: Detailed plan → Test cases → Ready to code

### Issue Creation
**Template**: `.claude/workflow/templates/TEMPLATE-github-issue.md`
- **Use during**: Step 1 MVP decomposition
- **Format**: Lightweight Issue with links to detailed plan

## Two-Step Planning

1. **Determine plan type**: MVP-level or Feature-level?
2. **Copy appropriate template**
3. **Follow guidance** from workflow files
4. **Execute** two-step planning process

See: `.claude/workflow/planning.md` for complete workflow

## Command Chaining

**After plan created**: Waits for `*approve` to execute plan
**After approval**: Starts first step from plan

## Related
- Commands: *approve, *tier, *issue
- Templates: @.claude/workflow/templates/
- Workflow: @.claude/rules/workflow.md
