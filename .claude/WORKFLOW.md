# Workflow Index

> 按需加载，减少常驻内存

## Phases

| Phase | File | When |
|-------|------|------|
| A | `workflow/docs.md` | Documentation updates |
| B | `workflow/planning.md` | Feature planning, issue breakdown |
| C | `workflow/development.md` | Coding, tier classification |
| D | `workflow/release.md` | Version release, publish |

## Quick Start

```
*resume → *issue pick <n> → *next → *sync
```

## Load Phase

Use `@` import when entering a phase:
- `@.claude/workflow/development.md` - Most common

## Session Commands

| Command | Description |
|---------|-------------|
| `*status` | Git + issue overview |
| `*resume` | Pull + load context |
| `*sync` | Commit + push |

## Context Files

| File | Purpose | Update Frequency |
|------|---------|------------------|
| `TODO.md` | Session tasks | Per session |
| `MEMORY.md` | Decisions, learnings | When notable |

---

**Full development workflow**: @.claude/workflow/development.md
