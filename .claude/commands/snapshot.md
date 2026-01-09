---
name: snapshot
category: infrastructure
requires: none
---

# Command: *snapshot

## Purpose
Collect all project text files into a single Markdown file for sharing or archiving

## Usage
```bash
*snapshot [filename]    # Create snapshot with optional filename
```

- Default output: `snapshots/snapshot-YYYY-MM-DD.md`
- Example: `*snapshot context.md` outputs to `snapshots/context.md`

## Workflow

1. **Scan**: Recursively scan current directory for all text files
2. **Filter**: Auto-exclude node_modules, .git, dist, etc.
3. **Generate tree**: Create visual file structure
4. **Collect content**: Embed each file content in code blocks
5. **Output**: Save as single Markdown file

## Execution

```bash
node $(npm root -g)/long-term-dev/src/collect-files.js . PROJECT_SNAPSHOT.md
```

Or if locally installed:
```bash
npx long-term-dev snapshot
```

## Output Format

Files saved to `snapshots/` directory (added to .gitignore):

```
snapshots/
├── snapshot-2025-01-15.md
├── snapshot-2025-01-16.md
└── custom-name.md
```

Content format:
```markdown
# Project Snapshot: project-name

> Generated: 2025-01-15T00:00:00.000Z
> Total files: 42

## Directory Structure
├── src/
│   └── index.js
└── package.json

## File Contents

### src/index.js
\`\`\`js
// file content
\`\`\`
```

## Auto-Ignored

- `node_modules/`, `.git/`, `dist/`, `build/`
- `__pycache__/`, `.venv/`, `venv/`
- `*.log`, `*.lock`, `package-lock.json`
- `.DS_Store`, `.env`

## Notes

- Only collects text files (js, ts, py, md, json, etc.)
- Binary files automatically skipped
- Large projects: clean up unnecessary files first

## Related
- Commands: *update
- CLI: `ltd snapshot <path>` (global command)
- Output: `.claude/snapshot.txt` or `cwd/snapshot.txt`
