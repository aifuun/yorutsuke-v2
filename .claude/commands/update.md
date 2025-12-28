# Update LTD System

Update the ltd command system in another project.

## Two Ways to Update

### 1. CLI (Recommended)

```bash
# From anywhere
npx ltd update ../my-app

# Or if globally installed
ltd update ../my-app
```

### 2. Claude Command (This File)

```
*update <project-path>
```

## Workflow (Claude Command)

1. **Validate target**:
   ```bash
   ls <project-path>/.claude/commands/
   ```
   - If no `.claude/` exists, suggest `ltd init` instead

2. **Preview changes**:
   - Compare target commands with templates/shared
   - Show what will be added/updated

3. **Execute via CLI**:
   ```bash
   npx ltd update <project-path>
   ```

4. **Report results**

## What Gets Updated

| Component | Updated | Notes |
|-----------|---------|-------|
| `.claude/commands/*.md` | ✅ | Shared + template-specific |
| `docs/WORKFLOW.md` | ✅ | If exists in template |
| `CLAUDE.md` | ❌ | Project-specific, not touched |
| `MEMORY.md`, `TODO.md` | ❌ | User data, preserved |

## Notes

- CLI reads `settings.json` to detect project type (code/write/study)
- Falls back to feature file detection if no settings
- Local custom commands are preserved (not deleted)
