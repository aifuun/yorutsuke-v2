---
name: audit
category: quality
requires: none
---

# Command: *audit

## Purpose
Run automated compliance checks against AI_DEV_PROT v15 Pillars

## Usage
```bash
*audit              # Run all applicable audits (based on TODO.md Tier)
*audit a d l        # Run specific Pillars only
*audit --all        # Run all available audits
*audit --fix        # Run and show fix suggestions
```

## Available Audits

| Pillar | Script | Checks |
|--------|--------|--------|
| A | `pillar-a/audit.ts` | No primitive type IDs (string, number for entities) |
| B | `pillar-b/audit.ts` | Adapters use Schema.parse() |
| C | `pillar-c/audit.ts` | No JSON mock files (use factories) |
| D | `pillar-d/audit.ts` | No boolean flag combinations (isLoading && isError) |
| I | `pillar-i/audit.ts` | No deep imports (../../internal/) |
| L | `pillar-l/audit.ts` | Headless hooks have no JSX |
| M | `pillar-m/audit.ts` | Saga steps have compensation |
| Q | `pillar-q/audit.ts` | T3 operations have Intent-ID |
| R | `pillar-r/audit.ts` | Logs are JSON semantic format |

## Workflow

1. **Determine which audits to run**:
   - If TODO.md has Tier info, use recommended Pillars
   - If specific Pillars given, use those
   - If `--all`, run everything

2. **Execute each audit**:
   ```bash
   npx tsx .prot/pillar-{X}/audit.ts
   ```

3. **Collect and report results**

## Output Format

```markdown
## Audit Results

**Scope**: [All / Pillars A, D, L / Based on T2]
**Files Scanned**: 42
**Time**: 1.2s

### Summary

| Pillar | Status | Violations | Files |
|--------|--------|------------|-------|
| A | ✅ Pass | 0 | - |
| D | ❌ Fail | 3 | 2 |
| L | ✅ Pass | 0 | - |
| I | ⚠️ Warn | 1 | 1 |

**Total**: 2 Pass, 1 Fail, 1 Warning

### Violations Detail

#### Pillar D: FSM (3 violations)

**Rule**: No boolean flag combinations

1. `src/modules/cart/headless/useCart.ts:15`
   ```typescript
   const [isLoading, setIsLoading] = useState(false);
   const [isError, setIsError] = useState(false);
   ```
   **Fix**: Use FSM state: `type State = 'idle' | 'loading' | 'error'`
   **Template**: `.prot/pillar-d/fsm-reducer.ts`

2. `src/modules/user/headless/useUser.ts:8`
   ```typescript
   if (isLoading && !isError) { ... }
   ```
   **Fix**: Use pattern matching on FSM state

#### Pillar I: Firewalls (1 warning)

**Rule**: No deep imports

1. `src/modules/checkout/views/CheckoutView.tsx:3`
   ```typescript
   import { Button } from '../../shared/components/internal/Button';
   ```
   **Fix**: Import from public API: `import { Button } from '../../shared'`

### Recommendations

1. **Priority High**: Fix Pillar D violations (breaks state consistency)
2. **Priority Medium**: Fix Pillar I warning (architecture smell)

### Next Steps

- Fix violations and re-run: `*audit d i`
- Or proceed with: `*review`
```

## Tier-Based Defaults

| Tier | Default Audits |
|------|----------------|
| T1 | A, I, L |
| T2 | A, D, I, L |
| T3 | A, B, D, I, L, M, Q, R |

## Notes

- Audits are non-blocking (won't prevent commits)
- Use `*review` for full pre-close verification
- Some audits may have false positives - review manually

## Related
- Commands: *review, *tier
- Patterns: @.claude/patterns/pillar-reference.md
- Scripts: @.prot/pillar-{a-r}/audit.ts
