# Command Template

Standard format for `.claude/commands/*.md` files.

## Format

```yaml
---
name: command-name
category: workflow | planning | quality | infrastructure
requires: file-list | none
---

# Command: *name

## Purpose
One-line description (imperative mood, active voice)

## Usage
```bash
*command [args]          # Description
*command --flag value    # Description
```

## Workflow
1. **Step Name**: High-level description
   - Implementation detail
   - Implementation detail
2. **Step Name**: High-level description
   - Implementation detail

## Output Format (if applicable)
```
Example output here
```

## Related
- Commands: *other-command, *another-command
- Files: @path/to/reference.md
- Pillars: A, D, L (if applicable)
```

## Guidelines

**YAML Frontmatter**:
- `name`: Command name (without asterisk)
- `category`: One of: workflow, planning, quality, infrastructure
- `requires`: List of files needed, or "none"

**Purpose**:
- Single line, imperative mood
- Starts with verb (e.g., "Commit and push", "Generate structure")

**Usage**:
- Show command syntax with examples
- Include parameter variations if applicable
- Add inline comments for clarity

**Workflow**:
- Numbered steps (1-10 steps ideal)
- Bold step names for scannability
- Sub-bullets for implementation details

**Output Format**:
- Optional section
- Show example output to set expectations
- Use code blocks for structured output

**Related**:
- Link to related commands (prefix with *)
- Reference files using @-paths
- List applicable Pillars if relevant

## Validation

Check compliance:
```bash
# All commands have frontmatter
grep -L "^---$" .claude/commands/*.md

# No Chinese text
grep -P "[\p{Han}]" .claude/commands/*.md

# Section order correct
# Expected: Purpose → Usage → Workflow → Output → Related
```

## Examples

See actual commands in `.claude/commands/` for reference implementations.
