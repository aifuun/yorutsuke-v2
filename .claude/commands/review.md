---
name: review
category: quality
requires: [.prot/checklists/post-code.md]
---

# Command: *review

## Purpose
Run code review before closing an issue: static checks → architecture → tests

## Usage
```bash
*review              # Review current issue from TODO.md
*review #123         # Review specific issue
*review --quick      # Skip tests + build (fast feedback)
```

## Workflow

### Phase 1: Static Checks (automated)
```bash
cd app && npm run typecheck    # TypeScript
cd app && npm run lint         # ESLint
cd app && npm run build        # Build (skip with --quick)
```

### Phase 2: Architecture Patterns (grep-based)
```bash
# No adapter imports in headless
grep -r "from.*adapters" app/src/**/headless/*.ts

# Branded types for IDs (spot check)
grep -r "string\s*)" app/src/02_modules/**/services/*.ts | grep -v "Branded"
```

Check relevant ADRs in `docs/architecture/ADR/`

### Phase 3: Tests (skip with --quick)
```bash
cd app && npm test
```

## Output Format

```markdown
## Review: #N - Title

### Summary
✅ TypeScript  ✅ ESLint  ✅ Build  ✅ Tests (105/105)

### Architecture
✅ 4-layer: No adapter imports in headless
✅ Pillar A: Branded types used
✅ Pillar D: FSM states (no boolean flags)
✅ Pillar L: No JSX in headless
✅ ADR-001: Service pattern followed

### Issues Found
1. ⚠️ file.ts:45 - Missing error state transition
2. ⚠️ file.ts:78 - Unused variable

### Verdict
**PASS** → Ready for `*issue close N`
```

Or if issues found:
```markdown
**NEEDS_FIX** → Fix issues, then re-run `*review`
```

## Quick Reference

### Checks Performed

| Phase | Check | Command |
|-------|-------|---------|
| 1 | TypeScript | `npm run typecheck` |
| 1 | ESLint | `npm run lint` |
| 1 | Build | `npm run build` |
| 2 | 4-layer | grep: no adapter in headless |
| 2 | Pillar A | grep: branded types |
| 2 | Pillar D | grep: no boolean flags |
| 2 | Pillar L | grep: no JSX in headless |
| 3 | Tests | `npm test` |

### Architecture Patterns to Verify

| Pattern | Rule | Grep Check |
|---------|------|------------|
| 4-layer | React → Service → Adapter | `grep "from.*adapters" **/headless/` |
| Pillar A | Branded types for IDs | No raw `string` for IDs |
| Pillar D | FSM states | `'idle' \| 'loading'` not `isLoading` |
| Pillar L | Headless separation | No JSX in headless hooks |

## After Review

- **PASS**: Run `*issue close N`
- **NEEDS_FIX**: Fix issues, re-run `*review`

## Related
- Checklist: `.prot/checklists/post-code.md`
- ADRs: `docs/architecture/ADR/`
- Audit: `*audit` command
