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
