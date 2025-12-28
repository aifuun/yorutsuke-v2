# Path-based Rules Example

This is an example rule file. Create your own rules in `.claude/rules/`.

## How It Works

Claude Code automatically loads rules based on file paths you're working with.

### 1. Create a rule file

```markdown
---
paths:
  - src/components/**/*.tsx
  - src/ui/**/*.tsx
---
# Frontend Component Rules

## Style
- Use Tailwind CSS, avoid inline styles
- Components should be functional with hooks

## Performance
- Use useMemo for expensive calculations
- Use useCallback for event handlers passed to children
```

### 2. Reference in CLAUDE.md (optional)

Add at the end of your CLAUDE.md:
```
@.claude/rules/frontend.md
@.claude/rules/api.md
```

## Common Rule Categories

- `frontend.md` - UI/component conventions
- `api.md` - Backend/API patterns
- `testing.md` - Test writing guidelines
- `security.md` - Security requirements
