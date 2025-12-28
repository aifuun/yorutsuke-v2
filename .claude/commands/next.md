# Execute Next Task

Continue working on current task or pick the next one.

## Workflow

1. **Check current task**: Read .claude/TODO.md
   - If there's an incomplete step, work on it
   - If all steps done, mark issue complete and pick next

2. **If no current task**:
   - Run `gh issue list --limit 5`
   - Suggest picking one with `*issue pick <n>`

3. **Before executing step**:
   - Check Tier info in TODO.md (if classified)
   - If no Tier: assume T1 (simple read/UI task)
   - **Load in-code checklist**: @.prot/checklists/in-code.md
   - If creating new file, check for Template:
     ```
     Creating headless hook? → .prot/pillar-l/headless.ts
     Creating adapter?       → .prot/pillar-b/airlock.ts
     Creating saga?          → .prot/pillar-m/saga.ts
     Creating FSM state?     → .prot/pillar-d/fsm-reducer.ts
     ```

4. **Execute**:
   - If complex/risky: explain plan, wait for `*approve`
   - If simple: execute directly
   - Copy from Template if applicable

5. **Update**: Mark step as done in TODO.md

6. **When issue complete**:
   - Suggest `*review` or `*issue close <n>`
   - Update MEMORY.md with learnings

## Template Quick Reference

| File Type | Template Location |
|-----------|-------------------|
| Headless hook | `.prot/pillar-l/headless.ts` |
| Adapter | `.prot/pillar-b/airlock.ts` |
| Branded types | `.prot/pillar-a/branded.ts` |
| FSM reducer | `.prot/pillar-d/fsm-reducer.ts` |
| Saga workflow | `.prot/pillar-m/saga.ts` |
| Idempotency | `.prot/pillar-q/idempotency.ts` |

## Notes

- Focus on one issue at a time
- Break large tasks into small steps
- Always update TODO.md after completing a step
- Use Templates to ensure Pillar compliance
